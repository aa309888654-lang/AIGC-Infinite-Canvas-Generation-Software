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
  'image-01': {
    icon: '/models/hailuo.svg',
    color: '#10A37F',
    bgColor: 'rgba(16,163,127,0.1)',
    description: 'Image-01 高清图片生成'
  },
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

  // Agnes 系列 (Agnes Image 2.1 Flash 图片生成)
  'agnes-image-2.1-flash': {
    icon: '/models/agnes.svg',
    color: '#7C3AED',
    bgColor: 'rgba(124,58,237,0.12)',
    description: 'Agnes Image 2.1 Flash 高清图片生成'
  },
  'agnes-video-v2.0': {
    icon: '/models/agnes.svg',
    color: '#7C3AED',
    bgColor: 'rgba(124,58,237,0.12)',
    description: 'Agnes Video V2.0'
  },

  // SenseNova 系列
  'sensenova-u1-fast': {
    icon: '/models/sensenova.svg',
    color: '#7C3AED',
    bgColor: 'rgba(124,58,237,0.1)',
    description: 'SenseNova U1 Fast 2K 图片生成'
  },
  'sensenova-u1': {
    icon: '/models/sensenova.svg',
    color: '#7C3AED',
    bgColor: 'rgba(124,58,237,0.1)',
    description: 'SenseNova U1'
  },

  // StepFun 图片编辑系列
  'step-image-edit-2': {
    icon: '',
    color: '#2563EB',
    bgColor: 'rgba(37,99,235,0.12)',
    description: 'StepFun Image Edit 2'
  },

  // Vidu 系列补充
  'viduq3-mix': {
    icon: '/models/vidu-q3-mix.svg',
    color: '#EC4899',
    bgColor: 'rgba(236,72,153,0.15)',
    description: 'Vidu Q3 Mix'
  },
  'viduq3-pro-fast': {
    icon: '/models/vidu-q3-fast.svg',
    color: '#F97316',
    bgColor: 'rgba(249,115,22,0.15)',
    description: 'Vidu Q3 Pro Fast'
  },
  'viduq2-pro-fast': {
    icon: '/models/vidu-q2-fast.svg',
    color: '#F97316',
    bgColor: 'rgba(249,115,22,0.1)',
    description: 'Vidu Q2 Pro Fast'
  },

  // 音频 TTS 模型
  'stepaudio-2.5-tts': {
    icon: '🎤',
    color: '#22D3EE',
    bgColor: 'rgba(34,211,238,0.1)',
    description: 'StepFun Audio 2.5'
  },
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
  'agnes-video-v2.0',
  'doubao-seedance-1-5-pro',
  'doubao-seedance-1-5-pro-251215',
  'viduq2',
  'viduq2-turbo',
  'viduq2-pro',
  'viduq3-turbo',
  'viduq3-pro',
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
  'agnes-image-2.1-flash',
  'step-image-edit-2',
  'sensenova-u1-fast',
  'sensenova-u1',
];

// 判断是否为视频模型
export function isVideoModel(modelId: string): boolean {
  return VIDEO_MODELS.includes(modelId);
}

// 判断是否为图片模型
export function isImageModel(modelId: string): boolean {
  return IMAGE_MODELS.includes(modelId);
}
