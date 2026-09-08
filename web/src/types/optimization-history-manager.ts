/**
 * 优化历史记录相关类型定义
 * 支持撤销/重做功能
 */

import type { OptimizationModeType } from './optimization';

/** 历史动作类型 */
export type HistoryActionType =
  | 'optimize'           // 优化
  | 'template_apply'     // 应用模板
  | 'template_merge'     // 合并模板
  | 'quality_analyze'    // 质量分析
  | 'version_restore'    // 版本恢复
  | 'batch_operate';     // 批量操作

/** 历史动作 */
export interface HistoryAction {
  /** 动作ID */
  id: string;
  /** 动作类型 */
  type: HistoryActionType;
  /** 时间戳 */
  timestamp: number;
  /** 描述 */
  description: string;
  /** 优化模式（如果是优化操作） */
  mode?: OptimizationModeType;
  /** 操作前的状态快照 */
  beforeState: OptimizationSnapshot;
  /** 操作后的状态快照 */
  afterState: OptimizationSnapshot;
  /** 是否可以撤销 */
  canUndo: boolean;
  /** 是否可以重做 */
  canRedo: boolean;
  /** 标签 */
  tags?: string[];
  /** 关联的版本ID */
  versionId?: string;
}

/** 优化状态快照 */
export interface OptimizationSnapshot {
  /** 快照ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 当前提示词 */
  currentPrompt: string;
  /** 原始提示词 */
  originalPrompt: string;
  /** 优化模式 */
  mode?: OptimizationModeType;
  /** 质量评分 */
  qualityScore?: number;
  /** 使用的模板 */
  usedTemplates?: string[];
  /** 优化历史记录 */
  optimizationHistory?: string[];
  /** 其他元数据 */
  metadata?: Record<string, unknown>;
}

/** 历史记录配置 */
export interface HistoryConfig {
  /** 最大历史数量 */
  maxHistorySize: number;
  /** 是否自动保存快照 */
  autoSaveSnapshot: boolean;
  /** 快照节流间隔（毫秒） */
  snapshotThrottle: number;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 忽略的动作类型 */
  ignoredActions?: HistoryActionType[];
}

/** 默认配置 */
export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  maxHistorySize: 50,
  autoSaveSnapshot: true,
  snapshotThrottle: 1000,
  enableCompression: true,
};

/** 动作描述映射 */
export const HISTORY_ACTION_LABELS: Record<HistoryActionType, string> = {
  optimize: '优化',
  template_apply: '应用模板',
  template_merge: '合并模板',
  quality_analyze: '质量分析',
  version_restore: '版本恢复',
  batch_operate: '批量操作',
};

/** 动作图标映射 */
export const HISTORY_ACTION_ICONS: Record<HistoryActionType, string> = {
  optimize: '⚡',
  template_apply: '📋',
  template_merge: '🔗',
  quality_analyze: '🔍',
  version_restore: '⏪',
  batch_operate: '📦',
};
