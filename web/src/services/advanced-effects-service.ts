import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type MaskShape = 
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'bezier'
  | 'freehand'
  | 'magic';

export type MaskMode = 'add' | 'subtract' | 'intersect' | 'replace';

export interface MaskPoint {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export interface Mask {
  id: string;
  clipId: string;
  name: string;
  shape: MaskShape;
  points: MaskPoint[];
  mode: MaskMode;
  enabled: boolean;
  inverted: boolean;
  feather: number;
  expansion: number;
  opacity: number;
  color?: string;
}

export interface LUTProfile {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  file?: File;
  url?: string;
  isPremium: boolean;
  intensity: number;
}

export interface NoiseReductionSettings {
  enabled: boolean;
  strength: number;
  preserveDetails: number;
  spatialFilter: number;
  temporalFilter: number;
  denoiseMode: 'spatial' | 'temporal' | 'both';
}

export interface AdvancedEffectsState {
  masks: Mask[];
  luts: LUTProfile[];
  appliedLUTs: { clipId: string; lutId: string; intensity: number }[];
  noiseReduction: Record<string, NoiseReductionSettings>;
  selectedMaskId: string | null;
  isDrawing: boolean;
}

interface AdvancedEffectsStore extends AdvancedEffectsState {
  addMask: (clipId: string, shape: MaskShape) => void;
  removeMask: (maskId: string) => void;
  updateMask: (maskId: string, updates: Partial<Mask>) => void;
  updateMaskPoints: (maskId: string, points: MaskPoint[]) => void;
  toggleMask: (maskId: string) => void;
  setSelectedMask: (maskId: string | null) => void;
  
  addLUT: (lut: LUTProfile) => void;
  removeLUT: (lutId: string) => void;
  applyLUT: (clipId: string, lutId: string, intensity: number) => void;
  removeAppliedLUT: (clipId: string) => void;
  updateLUTIntensity: (clipId: string, intensity: number) => void;
  
  setNoiseReduction: (clipId: string, settings: Partial<NoiseReductionSettings>) => void;
  
  setIsDrawing: (isDrawing: boolean) => void;
  
  getMasksForClip: (clipId: string) => Mask[];
  getAppliedLUTForClip: (clipId: string) => { lutId: string; intensity: number } | null;
  getNoiseReductionForClip: (clipId: string) => NoiseReductionSettings;
}

const BUILTIN_LUTS: LUTProfile[] = [
  {
    id: 'lut-cinematic',
    name: '电影调色',
    description: '经典电影风格LUT',
    category: '电影',
    isPremium: false,
    intensity: 100,
  },
  {
    id: 'lut-vintage',
    name: '复古胶片',
    description: '复古胶片风格LUT',
    category: '复古',
    isPremium: false,
    intensity: 100,
  },
  {
    id: 'lut-teal-orange',
    name: '青橙调色',
    description: '好莱坞青橙风格',
    category: '电影',
    isPremium: true,
    intensity: 100,
  },
  {
    id: 'lut-moody',
    name: '情绪暗调',
    description: '情绪化暗调风格',
    category: '艺术',
    isPremium: true,
    intensity: 100,
  },
  {
    id: 'lut-bright',
    name: '明亮清新',
    description: '明亮清新风格',
    category: '基础',
    isPremium: false,
    intensity: 100,
  },
  {
    id: 'lut-warm',
    name: '暖阳',
    description: '温暖阳光风格',
    category: '颜色',
    isPremium: false,
    intensity: 100,
  },
  {
    id: 'lut-cool',
    name: '冷调',
    description: '冷色调风格',
    category: '颜色',
    isPremium: false,
    intensity: 100,
  },
  {
    id: 'lut-film-stock',
    name: '胶片模拟',
    description: '模拟经典胶片色彩',
    category: '复古',
    isPremium: true,
    intensity: 100,
  },
];

const DEFAULT_NOISE_REDUCTION: NoiseReductionSettings = {
  enabled: false,
  strength: 50,
  preserveDetails: 50,
  spatialFilter: 4,
  temporalFilter: 4,
  denoiseMode: 'both',
};

export const useAdvancedEffectsStore = create<AdvancedEffectsStore>()(
  immer((set, get) => ({
    masks: [],
    luts: BUILTIN_LUTS,
    appliedLUTs: [],
    noiseReduction: {},
    selectedMaskId: null,
    isDrawing: false,

    addMask: (clipId, shape) =>
      set((state) => {
        const mask: Mask = {
          id: `mask-${Date.now()}`,
          clipId,
          name: `遮罩 ${state.masks.filter((m) => m.clipId === clipId).length + 1}`,
          shape,
          points: [],
          mode: 'add',
          enabled: true,
          inverted: false,
          feather: 0,
          expansion: 0,
          opacity: 100,
        };
        state.masks.push(mask);
        state.selectedMaskId = mask.id;
      }),

    removeMask: (maskId) =>
      set((state) => {
        state.masks = state.masks.filter((m) => m.id !== maskId);
        if (state.selectedMaskId === maskId) {
          state.selectedMaskId = null;
        }
      }),

    updateMask: (maskId, updates) =>
      set((state) => {
        const mask = state.masks.find((m) => m.id === maskId);
        if (mask) {
          Object.assign(mask, updates);
        }
      }),

    updateMaskPoints: (maskId, points) =>
      set((state) => {
        const mask = state.masks.find((m) => m.id === maskId);
        if (mask) {
          mask.points = points;
        }
      }),

    toggleMask: (maskId) =>
      set((state) => {
        const mask = state.masks.find((m) => m.id === maskId);
        if (mask) {
          mask.enabled = !mask.enabled;
        }
      }),

    setSelectedMask: (maskId) =>
      set((state) => {
        state.selectedMaskId = maskId;
      }),

    addLUT: (lut) =>
      set((state) => {
        state.luts.push(lut);
      }),

    removeLUT: (lutId) =>
      set((state) => {
        state.luts = state.luts.filter((l) => l.id !== lutId);
      }),

    applyLUT: (clipId, lutId, intensity) =>
      set((state) => {
        const existing = state.appliedLUTs.findIndex((l) => l.clipId === clipId);
        if (existing !== -1) {
          state.appliedLUTs[existing] = { clipId, lutId, intensity };
        } else {
          state.appliedLUTs.push({ clipId, lutId, intensity });
        }
      }),

    removeAppliedLUT: (clipId) =>
      set((state) => {
        state.appliedLUTs = state.appliedLUTs.filter((l) => l.clipId !== clipId);
      }),

    updateLUTIntensity: (clipId, intensity) =>
      set((state) => {
        const applied = state.appliedLUTs.find((l) => l.clipId === clipId);
        if (applied) {
          applied.intensity = intensity;
        }
      }),

    setNoiseReduction: (clipId, settings) =>
      set((state) => {
        const current = state.noiseReduction[clipId] || DEFAULT_NOISE_REDUCTION;
        state.noiseReduction[clipId] = { ...current, ...settings };
      }),

    setIsDrawing: (isDrawing) =>
      set((state) => {
        state.isDrawing = isDrawing;
      }),

    getMasksForClip: (clipId) => {
      const state = get();
      return state.masks.filter((m) => m.clipId === clipId);
    },

    getAppliedLUTForClip: (clipId) => {
      const state = get();
      const applied = state.appliedLUTs.find((l) => l.clipId === clipId);
      return applied ? { lutId: applied.lutId, intensity: applied.intensity } : null;
    },

    getNoiseReductionForClip: (clipId) => {
      const state = get();
      return state.noiseReduction[clipId] || DEFAULT_NOISE_REDUCTION;
    },
  }))
);

export class AdvancedEffectsService {
  private static instance: AdvancedEffectsService;

  static getInstance(): AdvancedEffectsService {
    if (!AdvancedEffectsService.instance) {
      AdvancedEffectsService.instance = new AdvancedEffectsService();
    }
    return AdvancedEffectsService.instance;
  }

  getMaskShapeName(shape: MaskShape): string {
    const names: Record<MaskShape, string> = {
      rectangle: '矩形',
      ellipse: '椭圆',
      polygon: '多边形',
      bezier: '贝塞尔曲线',
      freehand: '自由绘制',
      magic: '魔棒',
    };
    return names[shape];
  }

  getMaskModeName(mode: MaskMode): string {
    const names: Record<MaskMode, string> = {
      add: '添加',
      subtract: '减去',
      intersect: '相交',
      replace: '替换',
    };
    return names[mode];
  }

  getMaskShapes(): { id: MaskShape; name: string }[] {
    return [
      { id: 'rectangle', name: '矩形' },
      { id: 'ellipse', name: '椭圆' },
      { id: 'polygon', name: '多边形' },
      { id: 'bezier', name: '贝塞尔曲线' },
      { id: 'freehand', name: '自由绘制' },
      { id: 'magic', name: '魔棒' },
    ];
  }

  getMaskModes(): { id: MaskMode; name: string }[] {
    return [
      { id: 'add', name: '添加' },
      { id: 'subtract', name: '减去' },
      { id: 'intersect', name: '相交' },
      { id: 'replace', name: '替换' },
    ];
  }

  getLUTCategories(): string[] {
    return ['全部', '电影', '复古', '艺术', '基础', '颜色'];
  }

  generateFFmpegMaskFilter(mask: Mask): string {

    let filter = `drawbox=x=min_x:y=min_y:w=max_w:h=max_h:color=black:t=fill`;

    if (mask.feather > 0) {
      filter += `,boxblur=${mask.feather}:${mask.feather}`;
    }

    if (mask.inverted) {
      filter += ',negate';
    }

    return filter;
  }

  generateFFmpegDenoiseFilter(settings: NoiseReductionSettings): string {
    if (!settings.enabled) return '';

    const filters: string[] = [];

    if (settings.denoiseMode === 'spatial' || settings.denoiseMode === 'both') {
      filters.push(`hqdn3d=${settings.spatialFilter}:${settings.spatialFilter}:${settings.temporalFilter}:${settings.temporalFilter}`);
    }

    if (settings.denoiseMode === 'temporal' || settings.denoiseMode === 'both') {
      filters.push(`nlmeans=s=${settings.strength / 10}:p=${settings.preserveDetails / 10}`);
    }

    return filters.join(',');
  }

  generateFFmpegLUTFilter(lutUrl: string, _intensity: number): string {
    return `lut3d=file='${lutUrl}':interp=trilinear`;
  }

  async loadLUTFile(file: File): Promise<LUTProfile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const lut: LUTProfile = {
          id: `lut-custom-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          description: '自定义LUT',
          category: '自定义',
          file,
          url: e.target?.result as string,
          isPremium: false,
          intensity: 100,
        };
        resolve(lut);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  createRectangleMask(clipId: string, x: number, y: number, width: number, height: number): Mask {
    return {
      id: `mask-${Date.now()}`,
      clipId,
      name: '矩形遮罩',
      shape: 'rectangle',
      points: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      mode: 'add',
      enabled: true,
      inverted: false,
      feather: 0,
      expansion: 0,
      opacity: 100,
    };
  }

  createEllipseMask(clipId: string, cx: number, cy: number, rx: number, ry: number): Mask {
    const points: MaskPoint[] = [];
    const segments = 32;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      });
    }

    return {
      id: `mask-${Date.now()}`,
      clipId,
      name: '椭圆遮罩',
      shape: 'ellipse',
      points,
      mode: 'add',
      enabled: true,
      inverted: false,
      feather: 0,
      expansion: 0,
      opacity: 100,
    };
  }

  isPointInMask(x: number, y: number, mask: Mask): boolean {
    if (mask.points.length < 3) return false;

    let inside = false;
    const points = mask.points;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x,
        yi = points[i].y;
      const xj = points[j].x,
        yj = points[j].y;

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return mask.inverted ? !inside : inside;
  }
}

export const advancedEffectsService = AdvancedEffectsService.getInstance();
