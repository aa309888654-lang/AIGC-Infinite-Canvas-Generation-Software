/**
 * simple-timeline-store — 简化时间轴状态（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

export interface TimelineClip {
  id: string;
  startTime: number;
  duration: number;
  [key: string]: any;
}

export interface TimelineTrack {
  id: string;
  clips: TimelineClip[];
  [key: string]: any;
}

interface SimpleTimelineState {
  tracks: TimelineTrack[];
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  getTotalDuration: () => number;
}

const defaultState: SimpleTimelineState = {
  tracks: [],
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  getTotalDuration: () => 0,
};

export const useSimpleTimelineStore = {
  getState: () => defaultState,
  subscribe: () => () => {},
  setState: () => {},
};