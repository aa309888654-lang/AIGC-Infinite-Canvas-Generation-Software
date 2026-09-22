/**
 * AI特效 Agent 类型定义
 */

export type EffectType =
  | 'particle'
  | 'filter'
  | 'transition'
  | 'distortion'
  | 'glow'
  | 'glitch'
  | 'color'
  | 'blur'
  | 'composite';

export interface EffectParams {
  intensity?: number;
  color?: string;
  opacity?: number;
  blendMode?: BlendMode;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'color-dodge'
  | 'color-burn'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface ParticleConfig {
  type: ParticleType;
  count: number;
  size: { min: number; max: number };
  speed: { min: number; max: number };
  direction: { x: number; y: number };
  colors: string[];
  lifetime: number;
  gravity?: number;
  wind?: number;
  turbulence?: number;
  rotation?: { speed: number; range: number };
  opacity?: number;
  blending?: BlendMode;
}

export type ParticleType =
  | 'fire'
  | 'smoke'
  | 'rain'
  | 'snow'
  | 'sparks'
  | 'stars'
  | 'leaves'
  | 'bubbles'
  | 'dust'
  | 'confetti'
  | 'magic'
  | 'energy'
  | 'custom';

export interface FilterConfig {
  type: FilterType;
  intensity: number;
  parameters: Record<string, number | string | boolean>;
}

export type FilterType =
  | 'vintage'
  | 'noir'
  | 'cinematic'
  | 'vaporwave'
  | 'sepia'
  | 'cool'
  | 'warm'
  | 'dramatic'
  | 'muted'
  | 'vibrant'
  | 'bleach-bypass'
  | 'cross-process'
  | 'infrared'
  | 'infrared';

export interface GlitchConfig {
  type: GlitchType;
  intensity: number;
  rgbSplit?: number;
  scanlines?: number;
  noise?: number;
  blockSize?: number;
  blockGlitch?: boolean;
  waveDistort?: boolean;
}

export type GlitchType =
  | 'digital'
  | 'datamosh'
  | 'analog'
  | 'rgb'
  | 'scanline'
  | 'block'
  | 'wave'
  | 'chromatic';

export interface GlowConfig {
  color: string;
  intensity: number;
  radius: number;
  threshold: number;
  technique: 'bloom' | 'outer' | 'inner' | ' bevel';
}

export interface DistortionConfig {
  type: DistortionType;
  amplitude: number;
  frequency: number;
  speed: number;
  centerX?: number;
  centerY?: number;
}

export type DistortionType =
  | 'wave'
  | 'ripple'
  | 'bulge'
  | 'pinch'
  | 'kaleidoscope'
  | 'fish-eye'
  | 'cylinder'
  | 'perspective';

export interface TransitionConfig {
  type: TransitionType;
  duration: number;
  easing?: string;
  parameters?: Record<string, number | string | boolean>;
}

export type TransitionType =
  | 'fade'
  | 'dissolve'
  | 'wipe'
  | 'slide'
  | 'zoom'
  | 'blur'
  | 'glitch'
  | 'warp'
  | 'morph'
  | 'circle'
  | 'polygon'
  | 'custom';

export interface ColorGradeConfig {
  preset?: string;
  exposure?: number;
  contrast?: number;
  highlights?: number;
  shadows?: number;
  whites?: number;
  blacks?: number;
  temperature?: number;
  tint?: number;
  vibrance?: number;
  saturation?: number;
  curves?: {
    red: [number, number][];
    green: [number, number][];
    blue: [number, number][];
    master: [number, number][];
  };
  splitToning?: {
    highlights: { color: string; balance: number };
    shadows: { color: string; balance: number };
  };
  lut?: string;
}

export interface CompositeConfig {
  layers: CompositeLayer[];
  canvasSize?: { width: number; height: number };
  background?: string;
}

export interface CompositeLayer {
  id: string;
  type: 'image' | 'video' | 'effect' | 'text' | 'shape';
  source: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity: number;
  blendMode: BlendMode;
  transform?: {
    scaleX: number;
    scaleY: number;
    rotation: number;
    skewX: number;
    skewY: number;
  };
  mask?: {
    type: 'rectangle' | 'ellipse' | 'polygon' | 'luma';
    points?: number[];
    invert?: boolean;
  };
  effects?: EffectParams[];
}

export interface EffectPreset {
  id: string;
  name: string;
  category: EffectType;
  icon: string;
  config: EffectParams | ParticleConfig | FilterConfig | GlitchConfig | GlowConfig | TransitionConfig;
  tags: string[];
}

export const EFFECT_PRESETS: EffectPreset[] = [
  // 粒子特效预设
  {
    id: 'fire-place',
    name: '壁炉火焰',
    category: 'particle',
    icon: '🔥',
    config: {
      type: 'fire',
      count: 150,
      size: { min: 3, max: 15 },
      speed: { min: 1, max: 4 },
      direction: { x: 0, y: -1 },
      colors: ['#ff4400', '#ff6600', '#ffaa00', '#ff2200'],
      lifetime: 2,
      gravity: -0.5,
      turbulence: 0.3,
    } as ParticleConfig,
    tags: ['fire', 'warm', 'cozy'],
  },
  {
    id: 'magic-sparkle',
    name: '魔法闪光',
    category: 'particle',
    icon: '✨',
    config: {
      type: 'magic',
      count: 100,
      size: { min: 1, max: 5 },
      speed: { min: 0.5, max: 2 },
      direction: { x: 0, y: -0.5 },
      colors: ['#ffffff', '#ffddff', '#ddffff', '#ffffdd'],
      lifetime: 3,
      turbulence: 0.8,
    } as ParticleConfig,
    tags: ['magic', 'sparkle', 'fantasy'],
  },
  {
    id: 'rain-window',
    name: '雨滴车窗',
    category: 'particle',
    icon: '🌧️',
    config: {
      type: 'rain',
      count: 200,
      size: { min: 1, max: 3 },
      speed: { min: 5, max: 10 },
      direction: { x: -0.3, y: 1 },
      colors: ['#aaccff', '#ffffff'],
      lifetime: 1,
    } as ParticleConfig,
    tags: ['rain', 'moody', 'cinematic'],
  },

  // 滤镜预设
  {
    id: 'cinematic-teal-orange',
    name: '青橙色调',
    category: 'filter',
    icon: '🎬',
    config: {
      type: 'cinematic',
      intensity: 0.7,
      parameters: {
        shadowsColor: '#0088aa',
        highlightsColor: '#ff8844',
        contrast: 0.15,
        vibrance: 0.1,
      },
    } as FilterConfig,
    tags: ['cinematic', 'teal-orange', 'movie'],
  },
  {
    id: 'retro-film',
    name: '复古胶片',
    category: 'filter',
    icon: '📽️',
    config: {
      type: 'vintage',
      intensity: 0.8,
      parameters: {
        grain: 0.3,
        vignette: 0.4,
        sepia: 0.2,
        fade: 0.1,
        scratches: 0.1,
      },
    } as FilterConfig,
    tags: ['vintage', 'film', 'retro'],
  },
  {
    id: 'cyberpunk-neon',
    name: '赛博朋克',
    category: 'filter',
    icon: '🌃',
    config: {
      type: 'vaporwave',
      intensity: 0.9,
      parameters: {
        saturation: 1.3,
        contrast: 0.2,
        colorShift: 0.3,
        glow: 0.5,
      },
    } as FilterConfig,
    tags: ['cyberpunk', 'neon', 'futuristic'],
  },

  // 故障预设
  {
    id: 'glitch-corrupt',
    name: '数据损坏',
    category: 'glitch',
    icon: '⚠️',
    config: {
      type: 'datamosh',
      intensity: 0.7,
      blockSize: 20,
      blockGlitch: true,
      rgbSplit: 8,
      scanlines: 0.5,
    } as GlitchConfig,
    tags: ['glitch', 'corrupt', 'digital'],
  },
  {
    id: 'glitch-rgb',
    name: 'RGB分离',
    category: 'glitch',
    icon: '🖥️',
    config: {
      type: 'rgb',
      intensity: 0.6,
      rgbSplit: 15,
      scanlines: 0.3,
      noise: 0.2,
    } as GlitchConfig,
    tags: ['rgb', 'glitch', 'retro'],
  },

  // 发光预设
  {
    id: 'glow-neon-sign',
    name: '霓虹招牌',
    category: 'glow',
    icon: '💡',
    config: {
      color: '#ff00ff',
      intensity: 1.5,
      radius: 15,
      threshold: 0.6,
      technique: 'bloom',
    } as GlowConfig,
    tags: ['neon', 'glow', 'sign'],
  },
  {
    id: 'glow-hologram',
    name: '全息投影',
    category: 'glow',
    icon: '👻',
    config: {
      color: '#00ffff',
      intensity: 1.2,
      radius: 8,
      threshold: 0.7,
      technique: 'outer',
    } as GlowConfig,
    tags: ['hologram', 'sci-fi', 'futuristic'],
  },
];

export interface EffectChainStep {
  id: string;
  effectType: EffectType;
  effectId: string;
  params: EffectParams;
  blendMode?: BlendMode;
  opacity?: number;
}

export interface EffectChain {
  id: string;
  name: string;
  steps: EffectChainStep[];
  preview?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EffectRenderOptions {
  outputFormat: 'png' | 'jpg' | 'webp' | 'gif' | 'mp4';
  quality: number;
  resolution: { width: number; height: number };
  frameRate?: number;
  loop?: boolean;
}
