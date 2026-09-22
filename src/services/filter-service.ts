import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type FilterCategory = 
  | 'basic'
  | 'color'
  | 'vintage'
  | 'cinematic'
  | 'artistic'
  | 'blur'
  | 'distort'
  | 'stylize'
  | 'custom';

export interface FilterParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface VideoFilter {
  id: string;
  name: string;
  category: FilterCategory;
  description: string;
  parameters: FilterParameter[];
  cssFilter?: string;
  ffmpegFilter?: string;
  thumbnail?: string;
  isPremium: boolean;
  tags: string[];
}

export interface AppliedFilter {
  id: string;
  filterId: string;
  clipId: string;
  parameters: Record<string, number>;
  enabled: boolean;
  opacity: number;
  blendMode: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: AppliedFilter[];
  thumbnail?: string;
  isPremium: boolean;
}

export interface FilterState {
  filters: VideoFilter[];
  presets: FilterPreset[];
  appliedFilters: AppliedFilter[];
  selectedFilterId: string | null;
  favorites: string[];
}

interface FilterStore extends FilterState {
  applyFilter: (clipId: string, filterId: string) => void;
  removeFilter: (appliedFilterId: string) => void;
  updateFilterParams: (appliedFilterId: string, params: Record<string, number>) => void;
  toggleFilter: (appliedFilterId: string) => void;
  setFilterOpacity: (appliedFilterId: string, opacity: number) => void;
  setFilterBlendMode: (appliedFilterId: string, mode: string) => void;
  
  addPreset: (preset: FilterPreset) => void;
  removePreset: (presetId: string) => void;
  applyPreset: (clipId: string, presetId: string) => void;
  
  toggleFavorite: (filterId: string) => void;
  setSelectedFilter: (filterId: string | null) => void;
  
  getFiltersByCategory: (category: FilterCategory) => VideoFilter[];
  getAppliedFiltersForClip: (clipId: string) => AppliedFilter[];
  generateCSSFilter: (appliedFilterId: string) => string;
  generateFFmpegFilter: (appliedFilterId: string) => string;
}

const BUILTIN_FILTERS: VideoFilter[] = [
  {
    id: 'filter-brightness',
    name: '亮度',
    category: 'basic',
    description: '调整视频亮度',
    parameters: [
      { name: 'brightness', value: 100, min: 0, max: 200, step: 1, default: 100 },
    ],
    cssFilter: 'brightness({brightness}%)',
    ffmpegFilter: 'eq=brightness=({brightness}-100)/100',
    isPremium: false,
    tags: ['基础', '亮度'],
  },
  {
    id: 'filter-contrast',
    name: '对比度',
    category: 'basic',
    description: '调整视频对比度',
    parameters: [
      { name: 'contrast', value: 100, min: 0, max: 200, step: 1, default: 100 },
    ],
    cssFilter: 'contrast({contrast}%)',
    ffmpegFilter: 'eq=contrast={contrast}/100',
    isPremium: false,
    tags: ['基础', '对比度'],
  },
  {
    id: 'filter-saturation',
    name: '饱和度',
    category: 'basic',
    description: '调整视频饱和度',
    parameters: [
      { name: 'saturation', value: 100, min: 0, max: 200, step: 1, default: 100 },
    ],
    cssFilter: 'saturate({saturation}%)',
    ffmpegFilter: 'eq=saturation={saturation}/100',
    isPremium: false,
    tags: ['基础', '饱和度'],
  },
  {
    id: 'filter-hue',
    name: '色相',
    category: 'color',
    description: '调整视频色相',
    parameters: [
      { name: 'hue', value: 0, min: -180, max: 180, step: 1, default: 0 },
    ],
    cssFilter: 'hue-rotate({hue}deg)',
    ffmpegFilter: 'hue=h={hue}',
    isPremium: false,
    tags: ['颜色', '色相'],
  },
  {
    id: 'filter-blur',
    name: '模糊',
    category: 'blur',
    description: '添加模糊效果',
    parameters: [
      { name: 'radius', value: 0, min: 0, max: 20, step: 0.5, default: 0 },
    ],
    cssFilter: 'blur({radius}px)',
    ffmpegFilter: 'boxblur={radius}:{radius}',
    isPremium: false,
    tags: ['模糊', '效果'],
  },
  {
    id: 'filter-sharpen',
    name: '锐化',
    category: 'basic',
    description: '增强画面锐度',
    parameters: [
      { name: 'amount', value: 0, min: 0, max: 100, step: 1, default: 0 },
    ],
    ffmpegFilter: 'unsharp=5:5:{amount}:5:5:0',
    isPremium: false,
    tags: ['基础', '锐化'],
  },
  {
    id: 'filter-vintage',
    name: '复古',
    category: 'vintage',
    description: '复古胶片效果',
    parameters: [
      { name: 'sepia', value: 30, min: 0, max: 100, step: 1, default: 30 },
      { name: 'vignette', value: 20, min: 0, max: 100, step: 1, default: 20 },
      { name: 'grain', value: 10, min: 0, max: 100, step: 1, default: 10 },
    ],
    cssFilter: 'sepia({sepia}%)',
    ffmpegFilter: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    isPremium: false,
    tags: ['复古', '胶片'],
  },
  {
    id: 'filter-cinematic',
    name: '电影感',
    category: 'cinematic',
    description: '电影风格调色',
    parameters: [
      { name: 'teal', value: 20, min: 0, max: 100, step: 1, default: 20 },
      { name: 'orange', value: 15, min: 0, max: 100, step: 1, default: 15 },
      { name: 'shadows', value: 10, min: 0, max: 100, step: 1, default: 10 },
    ],
    ffmpegFilter: 'colorbalance=rs=-0.1:gs=-0.05:bs=0.1:rh=0.05:gh=-0.05:bh=-0.1',
    isPremium: true,
    tags: ['电影', '调色'],
  },
  {
    id: 'filter-warm',
    name: '暖色调',
    category: 'color',
    description: '温暖色调效果',
    parameters: [
      { name: 'temperature', value: 20, min: 0, max: 100, step: 1, default: 20 },
    ],
    cssFilter: 'sepia({temperature}%) saturate(1.2)',
    isPremium: false,
    tags: ['颜色', '暖色'],
  },
  {
    id: 'filter-cool',
    name: '冷色调',
    category: 'color',
    description: '冷色调效果',
    parameters: [
      { name: 'temperature', value: 20, min: 0, max: 100, step: 1, default: 20 },
    ],
    cssFilter: 'saturate(1.1) hue-rotate(-{temperature}deg)',
    isPremium: false,
    tags: ['颜色', '冷色'],
  },
  {
    id: 'filter-vignette',
    name: '暗角',
    category: 'artistic',
    description: '添加暗角效果',
    parameters: [
      { name: 'intensity', value: 50, min: 0, max: 100, step: 1, default: 50 },
      { name: 'softness', value: 50, min: 0, max: 100, step: 1, default: 50 },
    ],
    ffmpegFilter: 'vignette=a={intensity}/100',
    isPremium: false,
    tags: ['艺术', '暗角'],
  },
  {
    id: 'filter-grayscale',
    name: '黑白',
    category: 'basic',
    description: '转换为黑白',
    parameters: [
      { name: 'intensity', value: 100, min: 0, max: 100, step: 1, default: 100 },
    ],
    cssFilter: 'grayscale({intensity}%)',
    ffmpegFilter: 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3',
    isPremium: false,
    tags: ['基础', '黑白'],
  },
  {
    id: 'filter-invert',
    name: '反色',
    category: 'artistic',
    description: '反转颜色',
    parameters: [
      { name: 'intensity', value: 100, min: 0, max: 100, step: 1, default: 100 },
    ],
    cssFilter: 'invert({intensity}%)',
    ffmpegFilter: 'negate',
    isPremium: false,
    tags: ['艺术', '反色'],
  },
  {
    id: 'filter-noise',
    name: '噪点',
    category: 'artistic',
    description: '添加胶片噪点',
    parameters: [
      { name: 'amount', value: 10, min: 0, max: 100, step: 1, default: 10 },
    ],
    ffmpegFilter: 'noise=alls={amount}:allf=t',
    isPremium: false,
    tags: ['艺术', '噪点'],
  },
  {
    id: 'filter-glow',
    name: '发光',
    category: 'artistic',
    description: '添加发光效果',
    parameters: [
      { name: 'intensity', value: 50, min: 0, max: 100, step: 1, default: 50 },
      { name: 'radius', value: 10, min: 0, max: 50, step: 1, default: 10 },
    ],
    isPremium: true,
    tags: ['艺术', '发光'],
  },
  {
    id: 'filter-pixelate',
    name: '像素化',
    category: 'distort',
    description: '像素化效果',
    parameters: [
      { name: 'size', value: 8, min: 1, max: 32, step: 1, default: 8 },
    ],
    ffmpegFilter: 'scale=iw/{size}:ih/{size},scale=iw:ih:flags=neighbor',
    isPremium: false,
    tags: ['扭曲', '像素'],
  },
];

const BUILTIN_PRESETS: FilterPreset[] = [
  {
    id: 'preset-cinematic-teal',
    name: '电影青橙',
    description: '经典电影青橙调色',
    filters: [
      { id: 'applied-1', filterId: 'filter-cinematic', clipId: '', parameters: { teal: 25, orange: 20, shadows: 15 }, enabled: true, opacity: 100, blendMode: 'normal' },
      { id: 'applied-2', filterId: 'filter-vignette', clipId: '', parameters: { intensity: 30, softness: 60 }, enabled: true, opacity: 100, blendMode: 'normal' },
    ],
    isPremium: true,
  },
  {
    id: 'preset-vintage-film',
    name: '复古胶片',
    description: '经典复古胶片效果',
    filters: [
      { id: 'applied-3', filterId: 'filter-vintage', clipId: '', parameters: { sepia: 40, vignette: 25, grain: 15 }, enabled: true, opacity: 100, blendMode: 'normal' },
      { id: 'applied-4', filterId: 'filter-noise', clipId: '', parameters: { amount: 8 }, enabled: true, opacity: 50, blendMode: 'overlay' },
    ],
    isPremium: false,
  },
  {
    id: 'preset-dreamy',
    name: '梦幻',
    description: '柔和梦幻效果',
    filters: [
      { id: 'applied-5', filterId: 'filter-blur', clipId: '', parameters: { radius: 1 }, enabled: true, opacity: 30, blendMode: 'normal' },
      { id: 'applied-6', filterId: 'filter-saturation', clipId: '', parameters: { saturation: 80 }, enabled: true, opacity: 100, blendMode: 'normal' },
    ],
    isPremium: false,
  },
];

export const useFilterStore = create<FilterStore>()(
  immer((set, get) => ({
    filters: BUILTIN_FILTERS,
    presets: BUILTIN_PRESETS,
    appliedFilters: [],
    selectedFilterId: null,
    favorites: [],

    applyFilter: (clipId, filterId) =>
      set((state) => {
        const filter = state.filters.find((f) => f.id === filterId);
        if (!filter) return;

        const params: Record<string, number> = {};
        filter.parameters.forEach((p) => {
          params[p.name] = p.default;
        });

        const applied: AppliedFilter = {
          id: `applied-${Date.now()}`,
          filterId,
          clipId,
          parameters: params,
          enabled: true,
          opacity: 100,
          blendMode: 'normal',
        };

        state.appliedFilters.push(applied);
      }),

    removeFilter: (appliedFilterId) =>
      set((state) => {
        state.appliedFilters = state.appliedFilters.filter((f) => f.id !== appliedFilterId);
      }),

    updateFilterParams: (appliedFilterId, params) =>
      set((state) => {
        const filter = state.appliedFilters.find((f) => f.id === appliedFilterId);
        if (filter) {
          Object.assign(filter.parameters, params);
        }
      }),

    toggleFilter: (appliedFilterId) =>
      set((state) => {
        const filter = state.appliedFilters.find((f) => f.id === appliedFilterId);
        if (filter) {
          filter.enabled = !filter.enabled;
        }
      }),

    setFilterOpacity: (appliedFilterId, opacity) =>
      set((state) => {
        const filter = state.appliedFilters.find((f) => f.id === appliedFilterId);
        if (filter) {
          filter.opacity = opacity;
        }
      }),

    setFilterBlendMode: (appliedFilterId, mode) =>
      set((state) => {
        const filter = state.appliedFilters.find((f) => f.id === appliedFilterId);
        if (filter) {
          filter.blendMode = mode;
        }
      }),

    addPreset: (preset) =>
      set((state) => {
        state.presets.push(preset);
      }),

    removePreset: (presetId) =>
      set((state) => {
        state.presets = state.presets.filter((p) => p.id !== presetId);
      }),

    applyPreset: (clipId, presetId) =>
      set((state) => {
        const preset = state.presets.find((p) => p.id === presetId);
        if (!preset) return;

        preset.filters.forEach((f) => {
          const applied: AppliedFilter = {
            ...f,
            id: `applied-${Date.now()}-${Math.random()}`,
            clipId,
          };
          state.appliedFilters.push(applied);
        });
      }),

    toggleFavorite: (filterId) =>
      set((state) => {
        const index = state.favorites.indexOf(filterId);
        if (index === -1) {
          state.favorites.push(filterId);
        } else {
          state.favorites.splice(index, 1);
        }
      }),

    setSelectedFilter: (filterId) =>
      set((state) => {
        state.selectedFilterId = filterId;
      }),

    getFiltersByCategory: (category) => {
      const state = get();
      return state.filters.filter((f) => f.category === category);
    },

    getAppliedFiltersForClip: (clipId) => {
      const state = get();
      return state.appliedFilters.filter((f) => f.clipId === clipId && f.enabled);
    },

    generateCSSFilter: (appliedFilterId) => {
      const state = get();
      const applied = state.appliedFilters.find((f) => f.id === appliedFilterId);
      if (!applied) return '';

      const filter = state.filters.find((f) => f.id === applied.filterId);
      if (!filter || !filter.cssFilter) return '';

      let css = filter.cssFilter;
      Object.entries(applied.parameters).forEach(([key, value]) => {
        css = css.replace(`{${key}}`, String(value));
      });

      return css;
    },

    generateFFmpegFilter: (appliedFilterId) => {
      const state = get();
      const applied = state.appliedFilters.find((f) => f.id === appliedFilterId);
      if (!applied) return '';

      const filter = state.filters.find((f) => f.id === applied.filterId);
      if (!filter || !filter.ffmpegFilter) return '';

      let ffmpeg = filter.ffmpegFilter;
      Object.entries(applied.parameters).forEach(([key, value]) => {
        ffmpeg = ffmpeg.replace(`{${key}}`, String(value));
      });

      return ffmpeg;
    },
  }))
);

export class FilterService {
  private static instance: FilterService;

  static getInstance(): FilterService {
    if (!FilterService.instance) {
      FilterService.instance = new FilterService();
    }
    return FilterService.instance;
  }

  getCategoryName(category: FilterCategory): string {
    const names: Record<FilterCategory, string> = {
      basic: '基础',
      color: '颜色',
      vintage: '复古',
      cinematic: '电影',
      artistic: '艺术',
      blur: '模糊',
      distort: '扭曲',
      stylize: '风格化',
      custom: '自定义',
    };
    return names[category];
  }

  getAllCategories(): { id: FilterCategory; name: string }[] {
    return [
      { id: 'basic', name: '基础' },
      { id: 'color', name: '颜色' },
      { id: 'vintage', name: '复古' },
      { id: 'cinematic', name: '电影' },
      { id: 'artistic', name: '艺术' },
      { id: 'blur', name: '模糊' },
      { id: 'distort', name: '扭曲' },
      { id: 'stylize', name: '风格化' },
    ];
  }

  getBlendModes(): string[] {
    return [
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'color-dodge',
      'color-burn',
      'hard-light',
      'soft-light',
      'difference',
      'exclusion',
    ];
  }
}

export const filterService = FilterService.getInstance();
