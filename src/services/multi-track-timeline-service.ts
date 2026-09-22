/**
 * multi-track-timeline-service — 多轨时间轴服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

export interface TimelineClip {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  [key: string]: any;
}

export interface TimelineTrack {
  id: string;
  type: string;
  clips: TimelineClip[];
  [key: string]: any;
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
  [key: string]: any;
}

export interface ProjectSettings {
  fps: number;
  resolution: { width: number; height: number };
  [key: string]: any;
}

export interface TimelineProject {
  id: string;
  name: string;
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  settings: ProjectSettings;
  duration: number;
  [key: string]: any;
}

export interface TimelineState {
  project: TimelineProject;
  playback: { isPlaying: boolean; currentTime: number; [key: string]: any };
  selection: { selectedClipIds: string[]; [key: string]: any };
  seek: (_time: number) => void;
  splitClip: (_clipId: string, _time: number) => void;
  deleteSelectedClips: () => void;
  [key: string]: any;
}

export interface ClipEffect {
  id: string;
  type: string;
  params: Record<string, any>;
  [key: string]: any;
}

export interface MultiTrackTimeline {
  id: string;
  tracks: any[];
  duration: number;
  [key: string]: any;
}

export class MultiTrackTimelineService {
  async createTimeline(_options?: any): Promise<MultiTrackTimeline | null> {
    return null;
  }

  async getTimeline(_id: string): Promise<MultiTrackTimeline | null> {
    return null;
  }

  async updateTimeline(_id: string, _updates: any): Promise<void> {
    // no-op
  }
}

export const multiTrackTimelineService = new MultiTrackTimelineService();