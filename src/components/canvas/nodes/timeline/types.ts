/**
 * timeline/types — 时间轴组件类型定义（存根）
 *
 * AI剪辑板块已移除，此文件保留空类型定义以维持编译兼容。
 */

/** 生成唯一ID */
export function generateId(): string {
  return `stub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface TimelineClip {
  id: string;
  type: string;
  start: number;
  duration: number;
  [key: string]: any;
}