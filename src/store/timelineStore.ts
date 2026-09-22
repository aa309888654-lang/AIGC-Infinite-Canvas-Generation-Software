/**
 * timelineStore — 时间轴状态管理（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

interface TimelineProject {
  tracks: any[];
  [key: string]: any;
}

interface TimelinePlayback {
  isPlaying: boolean;
  currentTime: number;
  [key: string]: any;
}

interface TimelineSelection {
  selectedClipIds: string[];
  [key: string]: any;
}

interface TimelineState {
  project: TimelineProject;
  playback: TimelinePlayback;
  selection: TimelineSelection;
  seek: (_time: number) => void;
  splitClip: (_clipId: string, _time: number) => void;
  deleteSelectedClips: () => void;
  setPlaybackRate: (_rate: number) => void;
  copyClips: () => void;
  pasteClips: () => void;
  setInOutPoints: (_inPoint: number, _outPoint: number) => void;
  addClip: (..._args: any[]) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  [key: string]: any;
}

const defaultState: TimelineState = {
  project: { tracks: [] },
  playback: { isPlaying: false, currentTime: 0 },
  selection: { selectedClipIds: [] },
  seek: () => {},
  splitClip: () => {},
  deleteSelectedClips: () => {},
  setPlaybackRate: () => {},
  copyClips: () => {},
  pasteClips: () => {},
  setInOutPoints: () => {},
  addClip: () => {},
  canUndo: () => false,
  canRedo: () => false,
  undo: () => {},
  redo: () => {},
};

export const useTimelineStore = {
  getState: () => defaultState,
  subscribe: () => () => {},
};