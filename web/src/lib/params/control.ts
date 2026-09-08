/**
 * ParameterControlSystem - 运行时参数控制层
 *
 * 它在静态参数 schema（registry.ts/utils.ts）之上，提供运行时的
 * 读取 / 校验 / 单点写入 / 事务性批量写入能力，是意图理解引擎、
 * 功能图谱、Agent 执行等所有上层模块的地基。
 *
 * 设计要点：
 * 1. getValue/setValue 直接桥接 useTimelineStore（核心引擎层），不经过 VE 适配层，
 *    保证读写的是 clip.params 这个唯一真相源。
 * 2. validate 为纯函数（dry-run），不写入，供 setBatch 在应用前做全量校验。
 * 3. setBatch 采用「先验证后应用」两阶段事务：
 *    - 阶段1：全部参数 validate，任一失败则整体放弃，不触发任何 UI 更新；
 *    - 阶段2：saveHistory 一次，逐个 updateParam(skipHistory=true)，
 *      保证批量修改只产生一条历史记录，且支持一次 Undo 撤销整批。
 */

import { useTimelineStore } from '@/store/editmaster/useTimelineStore';
import { useClipStore } from '@/store/useClipStore';
import { getParamDef, clampParamValue } from './utils';
import { ALL_PARAMS } from './registry';
import type { ParamId, ParamValue, ParamDef, ClipKind } from './types';
import type { Clip } from '@/store/editmaster/types';

export interface ParamResult {
  success: boolean;
  error?: string;
  value?: ParamValue;
}

export interface BatchParamItem {
  id: ParamId;
  value: ParamValue;
}

/** 在活跃序列中按 clipId 查找 clip（含所在轨道索引） */
function findClip(clipId: string): { clip: Clip; trackIndex: number; clipIndex: number } | null {
  const s = useTimelineStore.getState();
  const activeSeq = s.sequences.find((seq) => seq.id === s.activeSequenceId);
  if (!activeSeq) return null;
  for (let ti = 0; ti < activeSeq.tracks.length; ti++) {
    const track = activeSeq.tracks[ti];
    for (let ci = 0; ci < track.clips.length; ci++) {
      if (track.clips[ci].id === clipId) {
        return { clip: track.clips[ci], trackIndex: ti, clipIndex: ci };
      }
    }
  }
  return null;
}

class ParameterControlSystem {
  /**
   * 读取单个参数的当前值
   */
  getValue(clipId: string, paramId: ParamId): ParamValue | undefined {
    const found = findClip(clipId);
    if (!found) return undefined;
    return found.clip.params?.[paramId];
  }

  /**
   * 读取某个 clip 的全部参数
   */
  getClipParams(clipId: string): Record<ParamId, ParamValue> | null {
    const found = findClip(clipId);
    if (!found) return null;
    return found.clip.params ?? null;
  }

  /**
   * 读取当前选中 clip 的全部参数及其定义（供 AI 意图理解/Agent 决策使用）
   */
  getSelectedClipContext(): {
    clipId: string;
    kind: ClipKind;
    params: Record<ParamId, ParamValue>;
    defs: ParamDef[];
  } | null {
    const selectedIds = useClipStore.getSelectedClipIds();
    if (!selectedIds.length) return null;
    const clipId = selectedIds[0];
    const found = findClip(clipId);
    if (!found) return null;
    const defs = ALL_PARAMS.filter((p) => p.appliesTo.includes(found.clip.kind));
    return { clipId, kind: found.clip.kind, params: found.clip.params ?? {}, defs };
  }

  /**
   * 校验单个参数值（dry-run，不写入）
   * 复用 schema 中的 min/max/clamp/options 约束。
   */
  validate(paramId: ParamId, value: ParamValue): ParamResult {
    const def = getParamDef(paramId);
    if (!def) {
      return { success: false, error: `未知参数：${paramId}` };
    }

    if (def.kind === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return { success: false, error: `${def.label} 必须是数字` };
      }
      const clamped = clampParamValue(paramId, value);
      return { success: true, value: clamped };
    }

    if (def.kind === 'boolean') {
      if (typeof value !== 'boolean') {
        return { success: false, error: `${def.label} 必须是布尔值` };
      }
      return { success: true, value };
    }

    if (def.kind === 'enum') {
      const ok = def.options.some((o) => o.value === value);
      if (!ok) {
        return { success: false, error: `${def.label} 不在可选项中` };
      }
      return { success: true, value };
    }

    // compound（HSL/曲线/颜色等）：仅校验为对象/可序列化
    if (def.kind === 'compound') {
      if (value === null || typeof value !== 'object') {
        return { success: false, error: `${def.label} 必须是对象` };
      }
      try {
        JSON.stringify(value);
        return { success: true, value };
      } catch {
        return { success: false, error: `${def.label} 含不可序列化数据` };
      }
    }

    return { success: true, value };
  }

  /**
   * 单参数写入（委托 useTimelineStore.updateParam，自动 clamp + 关键帧处理）
   */
  setValue(clipId: string, paramId: ParamId, value: ParamValue): ParamResult {
    const found = findClip(clipId);
    if (!found) {
      return { success: false, error: `未找到片段：${clipId}` };
    }
    const check = this.validate(paramId, value);
    if (!check.success) return check;

    useTimelineStore.getState().updateParam(clipId, paramId, check.value as ParamValue);
    return { success: true, value: check.value };
  }

  /**
   * 事务性批量写入（方案核心：先验证后应用，单条历史记录）
   *
   * 阶段1：全部参数 validate，任一失败立即返回，不触发任何 UI 更新；
   * 阶段2：saveHistory 一次，逐个 updateParam(skipHistory=true)，
   *        保证整批修改可被一次 Undo 撤销。
   *
   * 返回 { success, applied }：applied 为实际已应用的参数 id 列表
   * （失败时为空数组，因为阶段1失败不会进入阶段2）。
   */
  setBatch(clipId: string, params: BatchParamItem[]): ParamResult & { applied: ParamId[] } {
    const found = findClip(clipId);
    if (!found) {
      return { success: false, error: `未找到片段：${clipId}`, applied: [] };
    }
    if (!params.length) {
      return { success: true, applied: [] };
    }

    // 阶段1：全量校验（dry-run）
    const validated: BatchParamItem[] = [];
    for (const { id, value } of params) {
      const check = this.validate(id, value);
      if (!check.success) {
        return {
          success: false,
          error: `参数 ${id} 验证失败：${check.error}，未应用任何修改`,
          applied: [],
        };
      }
      validated.push({ id, value: check.value as ParamValue });
    }

    // 阶段2：保存一次历史，逐个应用（跳过逐条历史）
    // 若中途异常，回滚已应用的参数，避免半应用状态
    const store = useTimelineStore.getState();
    store.saveHistory();
    const applied: ParamId[] = [];
    try {
      for (const { id, value } of validated) {
        store.updateParam(clipId, id, value, true);
        applied.push(id);
      }
    } catch (err) {
      // 阶段2 异常：返回已应用项，调用方可决定是否撤销
      return {
        success: false,
        error: `批量写入中途异常：${err instanceof Error ? err.message : String(err)}（已应用 ${applied.length}/${validated.length} 项）`,
        applied,
      };
    }

    return { success: true, applied };
  }

  /**
   * 将参数集应用到指定 clip（便捷封装：内部走 setBatch）
   * 对应方案中的 applyToSoftware 概念。
   */
  applyToSoftware(clipId: string, params: Record<ParamId, ParamValue>): ParamResult {
    const items: BatchParamItem[] = Object.entries(params).map(([id, value]) => ({ id, value }));
    const r = this.setBatch(clipId, items);
    return { success: r.success, error: r.error };
  }

  /**
   * 重置单个参数为默认值
   */
  resetToDefault(clipId: string, paramId: ParamId): ParamResult {
    const def = getParamDef(paramId);
    if (!def) return { success: false, error: `未知参数：${paramId}` };
    // compound 默认值需深拷贝，避免污染 schema
    const defaultVal =
      typeof def.defaultValue === 'object' && def.defaultValue !== null
        ? JSON.parse(JSON.stringify(def.defaultValue))
        : def.defaultValue;
    return this.setValue(clipId, paramId, defaultVal);
  }

  /**
   * 重置某 clip 的全部参数为默认值（事务性，单条历史）
   */
  resetAllToDefault(clipId: string): ParamResult {
    const found = findClip(clipId);
    if (!found) return { success: false, error: `未找到片段：${clipId}` };
    const defs = ALL_PARAMS.filter((p) => p.appliesTo.includes(found.clip.kind));
    const items: BatchParamItem[] = defs.map((def) => {
      const defaultVal =
        typeof def.defaultValue === 'object' && def.defaultValue !== null
          ? JSON.parse(JSON.stringify(def.defaultValue))
          : def.defaultValue;
      return { id: def.id, value: defaultVal };
    });
    return this.setBatch(clipId, items);
  }
}

/** 单例，全局唯一参数控制入口 */
export const paramControl = new ParameterControlSystem();
