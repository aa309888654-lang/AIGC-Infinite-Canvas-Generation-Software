/**
 * 视频编辑器类型定义 - AI剪辑节点
 */

export interface TimeRange {
  start: number;
  end: number;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface Keyframe {
  id: string;
  time: number;
  property: 'x' | 'y' | 'scale' | 'rotation' | 'opacity';
  value: number;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface Subtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  style: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor?: string;
    position: 'top' | 'center' | 'bottom';
    animation?: 'fadeIn' | 'slideUp' | 'typewriter';
  };
}

export interface Effect {
  id: string;
  type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'grayscale' | 'sepia' | 'vignette' | 'shake' | 
        'hue' | 'temperature' | 'tint' | 'exposure' | 'highlights' | 'shadows' | 'vibrance' | 'curves' |
        'sharpen' | 'noise' | 'grain' | 'glow' | 'bloom' | 'film' | 'vintage' | 'duotone' |
        'glitch' | 'wave' | 'fisheye' | 'kaleidoscope' | 'chromatic' | 'pixelate';
  intensity: number;
  enabled: boolean;
  keyframes?: Keyframe[];
}

export interface Clip {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  source: string;
  duration: number;
  inPoint: number;
  outPoint: number;
  timeRange: TimeRange;
  transform: Transform;
  effects: Effect[];
  volume: number;
  speed: number;
  opacity: number;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle';
  clips: Clip[];
  locked: boolean;
  visible: boolean;
  height: number;
}

export interface Transition {
  id: string;
  type: 'fade' | 'dissolve' | 'slideLeft' | 'slideRight' | 'zoom';
  duration: number;
  clipAId: string;
  clipBId: string;
}

export interface VideoProject {
  id: string;
  name: string;
  duration: number;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  tracks: Track[];
  transitions: Transition[];
  subtitles: Subtitle[];
  backgroundColor: string;
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov';
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  videoCodec: 'h264' | 'h265' | 'vp9';
  audioCodec: 'aac' | 'opus' | 'mp3';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  bitrate?: number;
}

export type EditorTool = 'select' | 'cut' | 'trim' | 'move' | 'zoom' | 'hand';

export interface EditorState {
  project: VideoProject | null;
  currentTime: number;
  selectedClipIds: string[];
  selectedTrackId: string | null;
  activeTool: EditorTool;
  isPlaying: boolean;
  zoom: number;
  snapEnabled: boolean;
  snapThreshold: number;
  playbackSpeed: number;
  showWaveform: boolean;
  showKeyframes: boolean;
  splitViewEnabled: boolean;
}

export interface FFmpegCommand {
  inputs: Array<{ path: string; options?: string[] }>;
  outputs: Array<{ path: string; options: string[] }>;
  filterComplex?: string;
}
