import { logger } from './logger';

/**
 * Task.result 字段在 Prisma schema 中是 String?，但业务代码经常把它当对象读写，
 * 导致云端项目加载/历史缩略图/批量生成写回出现兼容性问题。
 *
 * 本工具统一 Task.result 的读写口径：
 * - 写入：始终 JSON.stringify
 * - 读取：兼容 字符串 / 对象（旧数据可能已被强转）/ null / 非法 JSON
 *
 * 见 docs/AI漫剧板块深度问题分析与升级方案-20260702.md §5.1
 */

/**
 * 解析 Task.result 字段。
 *
 * 兼容三种历史数据形态：
 * 1. 标准形态：合法 JSON 字符串
 * 2. 旧数据：已经是对象（Prisma 隐式转换或代码强转导致）
 * 3. 损坏数据：非法 JSON 字符串或 null
 *
 * 解析失败时返回 fallback（默认 null），并记录 warning，不抛异常，
 * 避免单条坏数据导致整个列表接口 500。
 */
export function parseTaskResult<T = unknown>(
  raw: string | object | null | undefined,
  fallback: T | null = null,
): T | null {
  if (raw == null) return fallback;

  if (typeof raw === 'object') {
    return raw as T;
  }

  if (typeof raw !== 'string') {
    logger.warn('[task-result-helper] result 字段为非字符串非对象类型，返回 fallback', { rawType: typeof raw });
    return fallback;
  }

  const trimmed = raw.trim();
  if (trimmed === '') return fallback;

  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    logger.warn('[task-result-helper] Task.result JSON 解析失败，返回 fallback', {
      error: err instanceof Error ? err.message : String(err),
      preview: trimmed.slice(0, 200),
    });
    return fallback;
  }
}

/**
 * 序列化 Task.result 字段。
 *
 * 始终返回字符串，确保写入 Prisma String? 字段时类型正确。
 * undefined / null / 空对象会被序列化成对应 JSON 字符串，
 * 调用方若需要写空值应直接传 null（得到 "null"）或跳过赋值。
 */
export function stringifyTaskResult(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * 判断 Task.result 字符串解析后是否为“看起来可用的对象”。
 * 用于历史接口等场景：只有解析成功且是对象，才尝试取缩略图等字段。
 */
export function isParsableObject(raw: string | object | null | undefined): boolean {
  const parsed = parseTaskResult(raw);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
}
