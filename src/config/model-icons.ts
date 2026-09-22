// 模型图标配置 - 为每个模型分配独特的图标和颜色
// icon 字段：SVG路径(/models/xxx.svg) 或 emoji
export interface ModelIconConfig {
  icon: string;
  color: string;
  bgColor: string;
  description: string;
}

export const MODEL_ICONS: Record<string, ModelIconConfig> = {
  // 豆包/Seedance 系列
  'doubao-seedance-1-5-pro': {
    icon: '/models/doubao.svg',
    color: '#1677FF',
    bgColor: 'rgba(22,119,255,0.1)',
    description: 'Seedance 1.5 Pro'
  },
  'doubao-seedance-1-5-pro-251215': {
    icon: '/models/doubao.svg',
    color: '#1677FF',
    bgColor: 'rgba(22,119,255,0.1)',
    description: 'Seedance 1.5 Pro 2025'
  },

  // Vidu 系列
  viduq2: {
    icon: '/models/vidu-q2.svg',
    color: '#64748B',
    bgColor: 'rgba(100,116,139,0.1)',
    description: 'Vidu Q2'
  },
  'viduq2-turbo': {
    icon: '/models/vidu-q2-turbo.svg',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.1)',
    description: 'Vidu Q2 Turbo'
  },
  'viduq2-pro': {
    icon: '/models/vidu-q2-pro.svg',
    color: '#0EA5E9',
    bgColor: 'rgba(14,165,233,0.1)',
    description: 'Vidu Q2 Pro'
  },
  'viduq3-turbo': {
    icon: '/models/vidu-q3-turbo.svg',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.1)',
    description: 'Vidu Q3 Turbo'
  },
  'viduq3-pro': {
    icon: '/models/vidu-q3-pro.svg',
    color: '#0EA5E9',
    bgColor: 'rgba(14,165,233,0.15)',
    description: 'Vidu Q3 Pro'
  },

  // 图片生成模型
  'doubao-seedream-5-0-lite': {
    icon: '/models/doubao.svg',
    color: '#1677FF',
    bgColor: 'rgba(22,119,255,0.1)',
    description: 'Seedream 5.0 Lite'
  },
  'doubao-seedream-5-0': {
    icon: '/models/doubao.svg',
    color: '#1677FF',
    bgColor: 'rgba(22,119,255,0.1)',
    description: 'Seedream 5.0'
  },
  'doubao-seedream-4-5': {
    icon: '/models/doubao.svg',
    color: '#1677FF',
    bgColor: 'rgba(22,119,255,0.1)',
    description: 'Seedream 4.5'
  },

  // Vidu 系列补充
  'viduq2-pro-fast': {
    icon: '/models/vidu-q2-fast.svg',
    color: '#F97316',
    bgColor: 'rgba(249,115,22,0.1)',
    description: 'Vidu Q2 Pro Fast'
  },

  // 音频 TTS 模型
  'step-tts-mini': {
    icon: '🎤',
    color: '#22D3EE',
    bgColor: 'rgba(34,211,238,0.1)',
    description: 'StepFun TTS Mini'
  },
  'step-tts-2': {
    icon: '🎤',
    color: '#22D3EE',
    bgColor: 'rgba(34,211,238,0.1)',
    description: 'StepFun TTS 2'
  },
  'speech-2.8-hd': {
    icon: '🔊',
    color: '#FFD000',
    bgColor: 'rgba(255,208,0,0.1)',
    description: 'MiniMax Speech 2.8 HD'
  },
  'speech-2.8-turbo': {
    icon: '🔊',
    color: '#FFD000',
    bgColor: 'rgba(255,208,0,0.1)',
    description: 'MiniMax Speech 2.8 Turbo'
  },
  'speech-2.6-hd': {
    icon: '🔊',
    color: '#FFD000',
    bgColor: 'rgba(255,208,0,0.1)',
    description: 'MiniMax Speech 2.6 HD'
  },
  'speech-2.6-turbo': {
    icon: '🔊',
    color: '#FFD000',
    bgColor: 'rgba(255,208,0,0.1)',
    description: 'MiniMax Speech 2.6 Turbo'
  },
};

// 默认图标配置
export const DEFAULT_MODEL_ICON: ModelIconConfig = {
  icon: '/models/vidu.svg',
  color: '#6B7280',
  bgColor: 'rgba(107,114,128,0.1)',
  description: '视频生成模型'
};

// 获取模型图标配置
export function getModelIconConfig(modelId: string): ModelIconConfig {
  return MODEL_ICONS[modelId] || DEFAULT_MODEL_ICON;
}

// 模型类型分组
export const MODEL_GROUPS = {
  VIDEO: ['video', 'both'],
  IMAGE: ['image', 'both']
};

// 视频模型列表（用于过滤）
export const VIDEO_MODELS = [
  'doubao-seedance-1-5-pro',
  'doubao-seedance-1-5-pro-251215',
  'viduq2',
  'viduq2-turbo',
  'viduq2-pro',
];

// 图片模型列表（用于过滤）
export const IMAGE_MODELS = [
  'image-01',
  'doubao-seedream-5-0-lite',
  'doubao-seedream-5.0-lite',
  'doubao-seedream-5-0',
  'doubao-seedream-5.0',
  'doubao-seedream-5-0-pro',
  'doubao-seedream-4-5',
  'doubao-seedream-4.5',
];

// 判断是否为视频模型
export function isVideoModel(modelId: string): boolean {
  return VIDEO_MODELS.includes(modelId);
}

// 判断是否为图片模型
export function isImageModel(modelId: string): boolean {
  return IMAGE_MODELS.includes(modelId);
}
