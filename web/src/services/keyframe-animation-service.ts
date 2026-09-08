import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type EasingType = 
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  // 弹性缓动已禁用：会导致画面短暂出框，类型保留但映射到 easeInOutQuad
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic'
  | 'easeInBounce'
  | 'easeOutBounce'
  | 'easeInOutBounce'
  | 'hold'
  | 'bezier';

export type AnimatableProperty = 
  | 'position.x'
  | 'position.y'
  | 'scale.x'
  | 'scale.y'
  | 'rotation'
  | 'opacity'
  | 'volume'
  | 'speed'
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hue'
  | 'anchor.x'
  | 'anchor.y';

export interface Keyframe {
  id: string;
  time: number;
  value: number;
  easing: EasingType;
  bezierHandles?: {
    in: { x: number; y: number };
    out: { x: number; y: number };
  };
  selected?: boolean;
}

export interface KeyframeTrack {
  id: string;
  clipId: string;
  property: AnimatableProperty;
  keyframes: Keyframe[];
  enabled: boolean;
  color: string;
}

export interface KeyframeState {
  tracks: KeyframeTrack[];
  selectedKeyframeIds: string[];
  currentTime: number;
  clipboard: Keyframe | null;
}

interface KeyframeStore extends KeyframeState {
  addTrack: (clipId: string, property: AnimatableProperty) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<KeyframeTrack>) => void;
  
  addKeyframe: (trackId: string, keyframe: Omit<Keyframe, 'id'>) => void;
  removeKeyframe: (trackId: string, keyframeId: string) => void;
  updateKeyframe: (trackId: string, keyframeId: string, updates: Partial<Keyframe>) => void;
  moveKeyframe: (trackId: string, keyframeId: string, newTime: number) => void;
  
  selectKeyframe: (keyframeId: string, multi?: boolean) => void;
  deselectAll: () => void;
  deleteSelected: () => void;
  copySelected: () => void;
  pasteKeyframe: (trackId: string, time: number) => void;
  
  getValueAtTime: (trackId: string, time: number) => number;
  getTracksForClip: (clipId: string) => KeyframeTrack[];
  
  setCurrentTime: (time: number) => void;
}

const PROPERTY_COLORS: Record<AnimatableProperty, string> = {
  'position.x': '#9CA3AF',
  'position.y': '#9CA3AF',
  'scale.x': '#10B981',
  'scale.y': '#34D399',
  rotation: '#F59E0B',
  opacity: '#8B5CF6',
  volume: '#EC4899',
  speed: '#06B6D4',
  blur: '#6366F1',
  brightness: '#FCD34D',
  contrast: '#F97316',
  saturation: '#84CC16',
  hue: '#A855F7',
  'anchor.x': '#14B8A6',
  'anchor.y': '#2DD4BF',
};

const easingFunctions: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  easeInExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t) => {
    if (t === 0 || t === 1) return t;
    if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
    return 1 - 0.5 * Math.pow(2, -20 * t + 10);
  },
  // 弹性缓动已禁用：会导致画面短暂出框，回退到 easeInOutQuad
  easeInElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  easeInOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  easeInBounce: (t) => 1 - easingFunctions.easeOutBounce(1 - t),
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeInOutBounce: (t) => {
    if (t < 0.5) return 0.5 * easingFunctions.easeInBounce(t * 2);
    return 0.5 * easingFunctions.easeOutBounce(t * 2 - 1) + 0.5;
  },
  bezier: (t) => t,
  hold: (_t) => 0,
};

export const useKeyframeStore = create<KeyframeStore>()(
  immer((set, get) => ({
    tracks: [],
    selectedKeyframeIds: [],
    currentTime: 0,
    clipboard: null,

    addTrack: (clipId, property) =>
      set((state) => {
        const existingTrack = state.tracks.find(
          (t) => t.clipId === clipId && t.property === property
        );
        if (existingTrack) return;

        const newTrack: KeyframeTrack = {
          id: `kf-track-${Date.now()}`,
          clipId,
          property,
          keyframes: [],
          enabled: true,
          color: PROPERTY_COLORS[property] || '#6B7280',
        };
        state.tracks.push(newTrack);
      }),

    removeTrack: (trackId) =>
      set((state) => {
        state.tracks = state.tracks.filter((t) => t.id !== trackId);
      }),

    updateTrack: (trackId, updates) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          Object.assign(track, updates);
        }
      }),

    addKeyframe: (trackId, keyframeData) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const newKeyframe: Keyframe = {
            ...keyframeData,
            id: `kf-${Date.now()}`,
            selected: false,
          };
          
          const insertIndex = track.keyframes.findIndex(
            (kf) => kf.time > keyframeData.time
          );
          
          if (insertIndex === -1) {
            track.keyframes.push(newKeyframe);
          } else {
            track.keyframes.splice(insertIndex, 0, newKeyframe);
          }
        }
      }),

    removeKeyframe: (trackId, keyframeId) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.keyframes = track.keyframes.filter((kf) => kf.id !== keyframeId);
        }
        state.selectedKeyframeIds = state.selectedKeyframeIds.filter(
          (id) => id !== keyframeId
        );
      }),

    updateKeyframe: (trackId, keyframeId, updates) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const keyframe = track.keyframes.find((kf) => kf.id === keyframeId);
          if (keyframe) {
            Object.assign(keyframe, updates);
            
            if (updates.time !== undefined) {
              track.keyframes.sort((a, b) => a.time - b.time);
            }
          }
        }
      }),

    moveKeyframe: (trackId, keyframeId, newTime) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const keyframe = track.keyframes.find((kf) => kf.id === keyframeId);
          if (keyframe) {
            keyframe.time = Math.max(0, newTime);
            track.keyframes.sort((a, b) => a.time - b.time);
          }
        }
      }),

    selectKeyframe: (keyframeId, multi = false) =>
      set((state) => {
        if (multi) {
          if (state.selectedKeyframeIds.includes(keyframeId)) {
            state.selectedKeyframeIds = state.selectedKeyframeIds.filter(
              (id) => id !== keyframeId
            );
          } else {
            state.selectedKeyframeIds.push(keyframeId);
          }
        } else {
          state.selectedKeyframeIds = [keyframeId];
        }
      }),

    deselectAll: () =>
      set((state) => {
        state.selectedKeyframeIds = [];
      }),

    deleteSelected: () =>
      set((state) => {
        for (const track of state.tracks) {
          track.keyframes = track.keyframes.filter(
            (kf) => !state.selectedKeyframeIds.includes(kf.id)
          );
        }
        state.selectedKeyframeIds = [];
      }),

    copySelected: () =>
      set((state) => {
        for (const track of state.tracks) {
          const selectedKf = track.keyframes.find((kf) =>
            state.selectedKeyframeIds.includes(kf.id)
          );
          if (selectedKf) {
            state.clipboard = { ...selectedKf };
            break;
          }
        }
      }),

    pasteKeyframe: (trackId, time) =>
      set((state) => {
        if (!state.clipboard) return;
        
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          const newKeyframe: Keyframe = {
            ...state.clipboard,
            id: `kf-${Date.now()}`,
            time,
            selected: false,
          };
          
          const insertIndex = track.keyframes.findIndex(
            (kf) => kf.time > time
          );
          
          if (insertIndex === -1) {
            track.keyframes.push(newKeyframe);
          } else {
            track.keyframes.splice(insertIndex, 0, newKeyframe);
          }
        }
      }),

    getValueAtTime: (trackId, time) => {
      const state = get();
      const track = state.tracks.find((t) => t.id === trackId);
      if (!track || track.keyframes.length === 0) return 0;

      const sortedKeyframes = [...track.keyframes].sort((a, b) => a.time - b.time);

      if (time <= sortedKeyframes[0].time) {
        return sortedKeyframes[0].value;
      }

      if (time >= sortedKeyframes[sortedKeyframes.length - 1].time) {
        return sortedKeyframes[sortedKeyframes.length - 1].value;
      }

      for (let i = 0; i < sortedKeyframes.length - 1; i++) {
        const current = sortedKeyframes[i];
        const next = sortedKeyframes[i + 1];

        if (time >= current.time && time < next.time) {
          const duration = next.time - current.time;
          const elapsed = time - current.time;
          const progress = elapsed / duration;
          
          const easedProgress = easingFunctions[current.easing](progress);
          
          return current.value + (next.value - current.value) * easedProgress;
        }
      }

      return 0;
    },

    getTracksForClip: (clipId) => {
      const state = get();
      return state.tracks.filter((t) => t.clipId === clipId);
    },

    setCurrentTime: (time) =>
      set((state) => {
        state.currentTime = time;
      }),
  }))
);

export class KeyframeAnimationService {
  private static instance: KeyframeAnimationService;

  static getInstance(): KeyframeAnimationService {
    if (!KeyframeAnimationService.instance) {
      KeyframeAnimationService.instance = new KeyframeAnimationService();
    }
    return KeyframeAnimationService.instance;
  }

  interpolate(
    startValue: number,
    endValue: number,
    progress: number,
    easing: EasingType
  ): number {
    const easedProgress = easingFunctions[easing](progress);
    return startValue + (endValue - startValue) * easedProgress;
  }

  getEasingPreview(easing: EasingType, samples: number = 100): number[] {
    const values: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      values.push(easingFunctions[easing](t));
    }
    return values;
  }

  getAllEasingTypes(): { value: EasingType; label: string; category: string }[] {
    return [
      { value: 'linear', label: '线性', category: '基础' },
      { value: 'easeIn', label: '缓入', category: '基础' },
      { value: 'easeOut', label: '缓出', category: '基础' },
      { value: 'easeInOut', label: '缓入缓出', category: '基础' },
      { value: 'easeInQuad', label: '二次缓入', category: '二次' },
      { value: 'easeOutQuad', label: '二次缓出', category: '二次' },
      { value: 'easeInOutQuad', label: '二次缓入缓出', category: '二次' },
      { value: 'easeInCubic', label: '三次缓入', category: '三次' },
      { value: 'easeOutCubic', label: '三次缓出', category: '三次' },
      { value: 'easeInOutCubic', label: '三次缓入缓出', category: '三次' },
      { value: 'easeInQuart', label: '四次缓入', category: '四次' },
      { value: 'easeOutQuart', label: '四次缓出', category: '四次' },
      { value: 'easeInOutQuart', label: '四次缓入缓出', category: '四次' },
      { value: 'easeInExpo', label: '指数缓入', category: '指数' },
      { value: 'easeOutExpo', label: '指数缓出', category: '指数' },
      { value: 'easeInOutExpo', label: '指数缓入缓出', category: '指数' },
      // 弹性缓动已禁用：会导致画面短暂出框
      // { value: 'easeInElastic', label: '弹性缓入', category: '弹性' },
      // { value: 'easeOutElastic', label: '弹性缓出', category: '弹性' },
      // { value: 'easeInOutElastic', label: '弹性缓入缓出', category: '弹性' },
      { value: 'easeInBounce', label: '弹跳缓入', category: '弹跳' },
      { value: 'easeOutBounce', label: '弹跳缓出', category: '弹跳' },
      { value: 'easeInOutBounce', label: '弹跳缓入缓出', category: '弹跳' },
      { value: 'bezier', label: '贝塞尔曲线', category: '自定义' },
    ];
  }

  getPropertyLabel(property: AnimatableProperty): string {
    const labels: Record<AnimatableProperty, string> = {
      'position.x': '位置 X',
      'position.y': '位置 Y',
      'scale.x': '缩放 X',
      'scale.y': '缩放 Y',
      rotation: '旋转',
      opacity: '不透明度',
      volume: '音量',
      speed: '速度',
      blur: '模糊',
      brightness: '亮度',
      contrast: '对比度',
      saturation: '饱和度',
      hue: '色相',
      'anchor.x': '锚点 X',
      'anchor.y': '锚点 Y',
    };
    return labels[property] || property;
  }

  getPropertyUnit(property: AnimatableProperty): string {
    const units: Record<AnimatableProperty, string> = {
      'position.x': 'px',
      'position.y': 'px',
      'scale.x': '',
      'scale.y': '',
      rotation: '°',
      opacity: '%',
      volume: '%',
      speed: 'x',
      blur: 'px',
      brightness: '%',
      contrast: '%',
      saturation: '%',
      hue: '°',
      'anchor.x': 'px',
      'anchor.y': 'px',
    };
    return units[property] || '';
  }

  getPropertyRange(property: AnimatableProperty): { min: number; max: number; step: number } {
    const ranges: Record<AnimatableProperty, { min: number; max: number; step: number }> = {
      'position.x': { min: -2000, max: 2000, step: 1 },
      'position.y': { min: -2000, max: 2000, step: 1 },
      'scale.x': { min: 0, max: 5, step: 0.01 },
      'scale.y': { min: 0, max: 5, step: 0.01 },
      rotation: { min: -360, max: 360, step: 1 },
      opacity: { min: 0, max: 100, step: 1 },
      volume: { min: 0, max: 200, step: 1 },
      speed: { min: 0.1, max: 10, step: 0.1 },
      blur: { min: 0, max: 100, step: 1 },
      brightness: { min: -100, max: 100, step: 1 },
      contrast: { min: -100, max: 100, step: 1 },
      saturation: { min: -100, max: 100, step: 1 },
      hue: { min: -180, max: 180, step: 1 },
      'anchor.x': { min: -1000, max: 1000, step: 1 },
      'anchor.y': { min: -1000, max: 1000, step: 1 },
    };
    return ranges[property] || { min: 0, max: 100, step: 1 };
  }
}

export const keyframeAnimationService = KeyframeAnimationService.getInstance();
