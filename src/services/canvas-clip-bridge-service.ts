/**
 * canvas-clip-bridge-service — 画布到剪辑桥接服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

export type ClipMediaType = 'video' | 'image' | 'audio';

export interface ClipImportItem {
  id?: string;
  mediaType?: ClipMediaType;
  url: string;
  name: string;
  type?: string;
  duration?: number;
  thumbnailUrl?: string;
  storyboard?: any;
  [key: string]: any;
}

/** 发送画布媒体到剪辑编辑器 — no-op */
export async function sendCanvasMediaToClipEditor(_items: ClipImportItem[], _nodeId?: string): Promise<void> {
  // no-op: 剪辑功能已移除
}

/** 导入项目到剪辑时间轴 — no-op */
export async function importItemsToClipTimeline(_items: ClipImportItem[]): Promise<void> {
  // no-op: 剪辑功能已移除
}

/** 从画布节点获取剪辑导入项 — 返回空数组 */
export function getClipImportItemsFromNode(_node: any): ClipImportItem[] {
  return [];
}

/** 构建剪辑编辑器URL — 返回空字符串 */
export function buildClipEditorUrl(_options?: any): string {
  return '';
}