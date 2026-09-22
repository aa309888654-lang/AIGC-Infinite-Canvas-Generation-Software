/**
 * useClipStore — 剪辑状态管理（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

// === 类型定义 ===
export type ClipKind = 'video' | 'audio' | 'subtitle' | 'effect';

export interface MediaAsset {
  id: string;
  url: string;
  duration: number;
  type: ClipKind;
  name?: string;
}

export interface Clip {
  id: string;
  kind: ClipKind;
  trackId: string;
  startTime: number;
  duration: number;
  asset?: MediaAsset;
  [key: string]: any;
}

export interface Track {
  id: string;
  kind: ClipKind;
  clips: Clip[];
  [key: string]: any;
}

export interface Sequence {
  id: string;
  tracks: Track[];
  duration: number;
  [key: string]: any;
}

interface ClipStoreState {
  // Read-only stubs — all return defaults
  getSelectedClipIds: () => string[];
  getPlaybackTime: () => number;
  getProjectDuration: () => number;
  splitClipAtTime: (_clipId: string, _time: number) => void;
  deleteSelectedClips: () => void;
  copyClips: () => void;
  pasteClips: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  seekToTime: (_time: number) => void;
  setInOutPoints: (_start: number, _end: number) => void;
  addClipToTrack: (_kind: ClipKind, _time: number, _duration: number, _content?: string) => string;
  play: () => void;
  pause: () => void;
}

export const useClipStore: ClipStoreState = {
  getSelectedClipIds: () => [],
  getPlaybackTime: () => 0,
  getProjectDuration: () => 0,
  splitClipAtTime: () => {},
  deleteSelectedClips: () => {},
  copyClips: () => {},
  pasteClips: () => {},
  canUndo: () => false,
  canRedo: () => false,
  undo: () => {},
  redo: () => {},
  seekToTime: () => {},
  setInOutPoints: () => {},
  addClipToTrack: () => '',
  play: () => {},
  pause: () => {},
};