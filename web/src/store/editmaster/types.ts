/**
 * editmaster/types — EditMaster 时间轴类型定义（存根）
 *
 * AI剪辑板块已移除，此文件保留空类型定义以维持编译兼容。
 */

export type EditorTool = 'select' | 'cut' | 'trim' | 'text';

export interface TimelineMarker {
  id: string;
  time: number;
  label?: string;
  color?: string;
}

export interface TimelineState {
  tracks: any[];
  duration: number;
  currentTime: number;
  markers: TimelineMarker[];
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  duration?: number;
  thumbnailUrl?: string;
  [key: string]: any;
}

export interface Clip {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio' | 'text';
  kind: 'video' | 'image' | 'audio' | 'text' | 'sticker' | 'effect';
  trackId: string;
  startTime: number;
  duration: number;
  url?: string;
  [key: string]: any;
}

export interface StoryboardClipMetadata {
  id?: string;
  shotIndex?: number;
  description?: string;
  duration?: number;
  [key: string]: any;
}