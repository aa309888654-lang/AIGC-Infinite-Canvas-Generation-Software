import type { Agent} from '@/agents/types';

/**
 * AI特效 Agent
 * 负责视觉特效、粒子系统、风格迁移等特效相关节点开发
 */
export interface EffectsConfig {
  effectType: string;
  intensity: number;
  duration?: number;
  parameters: Record<string, unknown>;
}

export interface ParticleSystem {
  type: 'fire' | 'smoke' | 'sparks' | 'snow' | 'rain' | 'stars' | 'leaves' | 'custom';
  count: number;
  size: { min: number; max: number };
  speed: { min: number; max: number };
  direction: { x: number; y: number };
  color: string | string[];
  lifetime: number;
}

export interface VisualEffect {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  parameters: EffectParameter[];
  preview?: string;
}

export type EffectCategory =
  | 'particle'
  | 'filter'
  | 'transition'
  | 'distortion'
  | 'glow'
  | 'glitch'
  | 'color'
  | 'blur'
  | 'composite';

export interface EffectParameter {
  name: string;
  type: 'number' | 'color' | 'boolean' | 'select' | 'slider';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: unknown }[];
  description?: string;
}

// 预设特效库
export const VISUAL_EFFECTS: VisualEffect[] = [
  // 粒子特效
  {
    id: 'particle-fire',
    name: '火焰粒子',
    category: 'particle',
    description: '逼真的火焰燃烧效果',
    parameters: [
      { name: 'intensity', type: 'slider', default: 0.5, min: 0, max: 1, step: 0.1 },
      { name: 'color', type: 'color', default: '#ff4400' },
      { name: 'count', type: 'slider', default: 100, min: 10, max: 500 },
      { name: 'speed', type: 'slider', default: 2, min: 0.5, max: 10 },
    ],
  },
  {
    id: 'particle-rain',
    name: '雨滴特效',
    category: 'particle',
    description: '逼真的雨滴下落效果',
    parameters: [
      { name: 'density', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'speed', type: 'slider', default: 3, min: 1, max: 10 },
      { name: 'angle', type: 'slider', default: 15, min: 0, max: 45 },
      { name: 'splash', type: 'boolean', default: true },
    ],
  },
  {
    id: 'particle-snow',
    name: '雪花飘落',
    category: 'particle',
    description: '柔和的雪花飘落效果',
    parameters: [
      { name: 'count', type: 'slider', default: 200, min: 20, max: 1000 },
      { name: 'size', type: 'slider', default: 3, min: 1, max: 10 },
      { name: 'drift', type: 'slider', default: 0.5, min: 0, max: 2 },
    ],
  },
  {
    id: 'particle-sparks',
    name: '火花飞溅',
    category: 'particle',
    description: '金属碰撞产生的火花效果',
    parameters: [
      { name: 'intensity', type: 'slider', default: 0.7, min: 0, max: 1 },
      { name: 'color', type: 'color', default: '#ffaa00' },
      { name: 'count', type: 'slider', default: 50, min: 10, max: 200 },
      { name: 'gravity', type: 'slider', default: 0.5, min: 0, max: 2 },
    ],
  },

  // 滤镜特效
  {
    id: 'filter-vintage',
    name: '复古滤镜',
    category: 'filter',
    description: '复古胶片色调效果',
    parameters: [
      { name: 'intensity', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'grain', type: 'slider', default: 0.3, min: 0, max: 1 },
      { name: 'vignette', type: 'slider', default: 0.4, min: 0, max: 1 },
      { name: 'sepia', type: 'slider', default: 0.2, min: 0, max: 1 },
    ],
  },
  {
    id: 'filter-noir',
    name: '黑白电影',
    category: 'filter',
    description: '经典黑白电影风格',
    parameters: [
      { name: 'contrast', type: 'slider', default: 0.3, min: -1, max: 1 },
      { name: 'grain', type: 'slider', default: 0.4, min: 0, max: 1 },
      { name: 'vignette', type: 'slider', default: 0.5, min: 0, max: 1 },
    ],
  },
  {
    id: 'filter-vaporwave',
    name: '蒸汽波',
    category: 'filter',
    description: '80年代复古未来主义风格',
    parameters: [
      { name: 'saturation', type: 'slider', default: 1.2, min: 0, max: 2 },
      { name: 'glitch', type: 'slider', default: 0.2, min: 0, max: 1 },
      { name: 'colorShift', type: 'slider', default: 0.3, min: 0, max: 1 },
    ],
  },

  // 故障特效
  {
    id: 'glitch-digital',
    name: '数字故障',
    category: 'glitch',
    description: '数字信号干扰故障效果',
    parameters: [
      { name: 'intensity', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'rgbSplit', type: 'slider', default: 5, min: 0, max: 20 },
      { name: 'scanlines', type: 'slider', default: 0.3, min: 0, max: 1 },
      { name: 'noise', type: 'slider', default: 0.2, min: 0, max: 1 },
    ],
  },
  {
    id: 'glitch-datamosh',
    name: '数据损坏',
    category: 'glitch',
    description: '视频压缩损坏效果',
    parameters: [
      { name: 'intensity', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'blockSize', type: 'slider', default: 20, min: 5, max: 100 },
      { name: 'colorShift', type: 'slider', default: 0.3, min: 0, max: 1 },
    ],
  },

  // 发光特效
  {
    id: 'glow-neon',
    name: '霓虹发光',
    category: 'glow',
    description: '霓虹灯发光效果',
    parameters: [
      { name: 'color', type: 'color', default: '#ff00ff' },
      { name: 'intensity', type: 'slider', default: 1.0, min: 0, max: 3 },
      { name: 'radius', type: 'slider', default: 10, min: 1, max: 50 },
      { name: 'threshold', type: 'slider', default: 0.8, min: 0, max: 1 },
    ],
  },
  {
    id: 'glow-holographic',
    name: '全息投影',
    category: 'glow',
    description: '科幻全息效果',
    parameters: [
      { name: 'color', type: 'color', default: '#00ffff' },
      { name: 'scanlines', type: 'slider', default: 0.3, min: 0, max: 1 },
      { name: 'flicker', type: 'slider', default: 0.2, min: 0, max: 1 },
      { name: 'intensity', type: 'slider', default: 1.0, min: 0, max: 2 },
    ],
  },

  // 扭曲特效
  {
    id: 'distort-wave',
    name: '波浪扭曲',
    category: 'distortion',
    description: '水波纹扭曲效果',
    parameters: [
      { name: 'amplitude', type: 'slider', default: 10, min: 1, max: 50 },
      { name: 'frequency', type: 'slider', default: 5, min: 1, max: 20 },
      { name: 'speed', type: 'slider', default: 1, min: 0.1, max: 5 },
    ],
  },
  {
    id: 'distort-zoom',
    name: '缩放模糊',
    category: 'distortion',
    description: '缩放模糊过渡效果',
    parameters: [
      { name: 'startScale', type: 'slider', default: 1, min: 0.5, max: 2 },
      { name: 'endScale', type: 'slider', default: 2, min: 1, max: 5 },
      { name: 'centerX', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'centerY', type: 'slider', default: 0.5, min: 0, max: 1 },
    ],
  },

  // 模糊特效
  {
    id: 'blur-motion',
    name: '运动模糊',
    category: 'blur',
    description: '模拟运动产生的模糊',
    parameters: [
      { name: 'direction', type: 'select', default: 'horizontal', options: [
        { label: '水平', value: 'horizontal' },
        { label: '垂直', value: 'vertical' },
        { label: '径向', value: 'radial' },
      ]},
      { name: 'intensity', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'samples', type: 'slider', default: 16, min: 4, max: 64 },
    ],
  },
  {
    id: 'blur-tilt-shift',
    name: '移轴模糊',
    category: 'blur',
    description: '微缩模型效果的移轴模糊',
    parameters: [
      { name: 'focusCenter', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'focusWidth', type: 'slider', default: 0.2, min: 0.05, max: 0.5 },
      { name: 'shape', type: 'select', default: 'ellipse', options: [
        { label: '椭圆', value: 'ellipse' },
        { label: '矩形', value: 'rectangle' },
      ]},
    ],
  },

  // 转场特效
  {
    id: 'transition-warp',
    name: '时空扭曲',
    category: 'transition',
    description: '时空穿越转场效果',
    parameters: [
      { name: 'direction', type: 'select', default: 'center', options: [
        { label: '中心', value: 'center' },
        { label: '左', value: 'left' },
        { label: '右', value: 'right' },
        { label: '上下', value: 'vertical' },
      ]},
      { name: 'distortion', type: 'slider', default: 0.5, min: 0, max: 1 },
    ],
  },
  {
    id: 'transition-glitch',
    name: '故障转场',
    category: 'transition',
    description: '数字故障转场效果',
    parameters: [
      { name: 'intensity', type: 'slider', default: 0.5, min: 0, max: 1 },
      { name: 'duration', type: 'slider', default: 0.5, min: 0.1, max: 2 },
    ],
  },
];

export const createEffectsAgent = (): Agent => ({
  id: 'effects',
  name: 'AI特效 Agent',
  description: '专业的视觉特效节点开发专家，支持粒子系统、滤镜、故障效果、转场等多种视觉特效',
  version: '1.0.0',
  capabilities: [
    {
      type: 'particle-effects',
      description: '粒子系统特效',
      features: ['fire', 'smoke', 'rain', 'snow', 'sparks', 'custom'],
    },
    {
      type: 'filters',
      description: '图像滤镜处理',
      features: ['vintage', 'noir', 'cinematic', 'vaporwave', 'custom'],
    },
    {
      type: 'glitch-effects',
      description: '故障艺术效果',
      features: ['digital-glitch', 'datamosh', 'rgb-split', 'scanlines'],
    },
    {
      type: 'glow-effects',
      description: '发光特效',
      features: ['neon', 'bloom', 'holographic', 'glow-outline'],
    },
    {
      type: 'distortion',
      description: '扭曲变形效果',
      features: ['wave', 'ripple', 'lens-distortion', 'perspective'],
    },
    {
      type: 'transitions',
      description: '视频转场效果',
      features: ['warp', 'glitch', 'blur', 'zoom', 'custom'],
    },
    {
      type: 'color-grading',
      description: '色彩调校',
      features: ['lut', 'curves', 'color-wheels', 'split-toning'],
    },
  ],
  tools: [
    'particle-system',
    'apply-filter',
    'glitch-effect',
    'add-glow',
    'distort',
    'create-transition',
    'color-grade',
    'composite',
    'render-preview',
  ],
  nodeTypes: [
    'particleEffect',
    'filterNode',
    'glitchNode',
    'glowNode',
    'distortNode',
    'transitionNode',
    'colorGrade',
    'compositeNode',
  ],
  execute: async (input, _context) => {
    const { type, effectId, params } = input;

    switch (type) {
      case 'apply-effect':
        return applyEffect(effectId, params);
      case 'particle-system':
        return createParticleSystem(params);
      case 'filter':
        return applyFilter(params);
      case 'glitch':
        return applyGlitch(params);
      case 'glow':
        return applyGlow(params);
      case 'transition':
        return createTransition(params);
      case 'color-grade':
        return applyColorGrading(params);
      case 'composite':
        return compositeEffects(params);
      default:
        throw new Error(`Unknown effect type: ${type}`);
    }
  },
});

// 内部实现函数
async function applyEffect(effectId: string, params: Record<string, unknown>) {
  const effect = VISUAL_EFFECTS.find(e => e.id === effectId);
  if (!effect) {
    throw new Error(`Effect not found: ${effectId}`);
  }

  const response = await fetch('/api/effects/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ effectId, ...params }),
  });

  if (!response.ok) {
    throw new Error(`Effect application failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    effectId,
    effectName: effect.name,
    parameters: params,
  };
}

async function createParticleSystem(params: Record<string, unknown>) {
  const response = await fetch('/api/effects/particles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    previewUrl: data.previewUrl,
    particleType: params.type,
  };
}

async function applyFilter(params: Record<string, unknown>) {
  const response = await fetch('/api/effects/filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    filterType: params.filterType,
    intensity: params.intensity,
  };
}

async function applyGlitch(params: Record<string, unknown>) {
  const response = await fetch('/api/effects/glitch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    glitchType: params.glitchType,
    intensity: params.intensity,
  };
}

async function applyGlow(params: Record<string, unknown>) {
  const response = await fetch('/api/effects/glow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    glowColor: params.color,
    intensity: params.intensity,
  };
}

async function createTransition(params: Record<string, unknown>) {
  const response = await fetch('/api/effects/transition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    transitionType: params.transitionType,
    duration: params.duration,
  };
}

async function applyColorGrading(params: Record<string, unknown>) {
  const response = await fetch('/api/effects/color-grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    preset: params.preset,
    adjustments: params.adjustments,
  };
}

async function compositeEffects(params: Record<string, unknown>) {
  const response = await fetch('/api/effects/composite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  return {
    success: true,
    outputUrl: data.outputUrl,
    layers: params.layers,
  };
}

export default createEffectsAgent;
