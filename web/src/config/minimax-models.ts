/**
 * MiniMax模型官方配置
 * 官方文档: https://www.minimaxi.com/document
 */

export const MINIMAX_IMAGE_MODELS = {
  image_01: {
    id: 'image-01',
    name: 'MiniMax Image-01',
    description: 'MiniMax Image-01 高质量图片生成模型',
    type: 'image' as const,
    endpoint: '/v1/images/generations',
    baseURL: '/minimax-api',
    defaultParams: {
      model: 'image-01',
      n: 1,
      aspect_ratio: '1:1',
      response_format: 'url'
    },
    supportedResolutions: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    maxImages: 4,
    qualityRating: 4.7,
    estimatedSpeed: 'fast',
    costPerImage: 0.015
  },
  image_01_preview: {
    id: 'image-01-preview',
    name: 'Image-01 Preview',
    description: 'Image-01 预览版本',
    type: 'image' as const,
    endpoint: '/v1/images/generations',
    baseURL: '/minimax-api',
    defaultParams: {
      model: 'image-01-preview',
      n: 1,
      aspect_ratio: '1:1',
      response_format: 'url'
    },
    supportedResolutions: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    maxImages: 4,
    qualityRating: 4.5,
    estimatedSpeed: 'fast',
    costPerImage: 0.012
  }
};

export const MINIMAX_VIDEO_MODELS = {
  video_01: {
    id: 'video-01',
    name: 'MiniMax Video-01',
    description: 'MiniMax视频生成模型',
    type: 'video' as const,
    endpoint: '/v1/video/generations',
    baseURL: '/minimax-api',
    defaultParams: {
      model: 'video-01',
      duration: 5,
      fps: 24,
      aspect_ratio: '16:9'
    },
    supportedDurations: [5, 10, 15, 20],
    supportedFPS: [24, 30],
    supportedResolutions: ['1280x720', '1920x1080'],
    maxDuration: 20,
    maxResolution: '1920x1080',
    qualityRating: 4.1,
    estimatedSpeed: 'fast',
    costPerMinute: 0.45
  },
  video_01_higher: {
    id: 'video-01-higher',
    name: 'MiniMax Video-01 Higher',
    description: 'MiniMax高质量视频生成模型',
    type: 'video' as const,
    endpoint: '/v1/video/generations',
    baseURL: '/minimax-api',
    defaultParams: {
      model: 'video-01-higher',
      duration: 5,
      fps: 30,
      aspect_ratio: '16:9'
    },
    supportedDurations: [5, 10, 15],
    supportedFPS: [24, 30],
    supportedResolutions: ['1920x1080', '1280x720'],
    maxDuration: 15,
    maxResolution: '1920x1080',
    qualityRating: 4.4,
    estimatedSpeed: 'medium',
    costPerMinute: 0.60
  }
};

export const MINIMAX_MODELS = {
  ...MINIMAX_IMAGE_MODELS,
  ...MINIMAX_VIDEO_MODELS
};

export function getMinimaxModelInfo(modelId: string): unknown {
  return MINIMAX_MODELS[modelId as keyof typeof MINIMAX_MODELS] || null;
}

export function getImageModels(): unknown[] {
  return Object.values(MINIMAX_IMAGE_MODELS);
}

export function getVideoModels(): unknown[] {
  return Object.values(MINIMAX_VIDEO_MODELS);
}

export function getAllMinimaxModels(): unknown[] {
  return Object.values(MINIMAX_MODELS);
}

export function suggestModel(type: 'image' | 'video', quality: 'fast' | 'balanced' | 'high'): string {
  if (type === 'image') {
    return quality === 'high' ? 'image-01' : 'image-01-preview';
  } else {
    return quality === 'high' ? 'video-01-higher' : 'video-01';
  }
}

export type MinimaxModelId = keyof typeof MINIMAX_MODELS;
