/**
 * 豆包/火山引擎模型官方配置
 * 更新时间: 2026-04-05
 * 官方文档: https://console.volcengine.com/ark
 *
 * 支持的模型:
 * - Seedance 2.0 (最新版，2025年5月发布)
 * - Seedance 1.5 Pro (稳定版)
 * - Kling v3.0 (快手，通过第三方API)
 * - Sora 2.0 (OpenAI，通过第三方API)
 */

export interface DoubaoImageModelConfig {
  id: string;
  name: string;
  description: string;
  type: 'image';
  endpoint: string;
  baseURL: string;
  defaultParams: {
    model: string;
    quality: string;
    aspect_ratio: string;
    resolution: string;
  };
  supportedResolutions: string[];
  minPixels: number;
  supportedQuality: string[];
  supportedAspectRatios: string[];
}

export interface DoubaoVideoModelConfig {
  id: string;
  name: string;
  description: string;
  type: 'video';
  endpoint: string;
  baseURL: string;
  version: string;
  releaseDate: string;
  defaultParams: {
    model: string;
    duration: number;
    fps: number;
    watermark: boolean;
    camera_fixed: boolean;
    motion: number;
  };
  capabilities: VideoModelCapabilities;
  supportedDurations: number[];
  supportedFPS: number[];
  supportedResolutions: string[];
  pricing: {
    creditsPerSecond: Record<string, number>;
    withAudioMultiplier?: number;
  };
}

export const DOUBO_IMAGE_MODELS: Record<string, DoubaoImageModelConfig> = {
  seedream_5_lite: {
    id: 'ep-20260321212919-vfr2q',
    name: '豆包 Seedream 5.0 Lite',
    description: '轻量级快速图片生成 (推荐)',
    type: 'image',
    endpoint: 'images/generations',
    baseURL: '/api/v3',
    defaultParams: {
      model: 'ep-20260321212919-vfr2q',
      quality: 'standard',
      aspect_ratio: '1:1',
      resolution: '1920x1920'
    },
    supportedResolutions: ['1920x1920', '1440x1920', '1920x1440', '1920x1080', '1080x1920'],
    minPixels: 3686400,
    supportedQuality: ['standard', 'hd'],
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16']
  },
};

export const DOUBO_VIDEO_MODELS: Record<string, DoubaoVideoModelConfig> = {
  // ========== 稳定版本：Seedance 1.5 Pro ==========
  seedance_15_pro: {
    id: 'doubao-seedance-1-5-pro-251215',
    name: '✓ 豆包 Seedance 1.5 Pro (稳定)',
    description: '成熟稳定的视频生成模型，经过大量生产验证',
    type: 'video',
    endpoint: 'contents/generations/tasks',
    baseURL: '/api/v3',
    version: '1.5',
    releaseDate: '2024-12',
    defaultParams: {
      model: 'doubao-seedance-1-5-pro-251215',
      duration: 5,
      fps: 24,
      watermark: true,
      camera_fixed: true,
      motion: 50
    },
    capabilities: {
      textToVideo: true,
      imageToVideo: true,
      firstLastFrame: true,
      audioGeneration: true,
      maxDuration: 10,
      supportedDurations: [3, 5, 10],
      quality: 'balanced'
    },
    supportedDurations: [3, 5, 10],
    supportedFPS: [24, 30, 60],
    supportedResolutions: ['720p', '1080p'],
    pricing: {
      creditsPerSecond: { '720p': 8, '1080p': 15 }
    }
  },
};

export const DOUBO_MODELS = {
  ...DOUBO_IMAGE_MODELS,
  ...DOUBO_VIDEO_MODELS
};

export interface VideoModelCapabilities {
  textToVideo: boolean;
  imageToVideo: boolean;
  firstLastFrame: boolean;
  videoToVideo?: boolean;
  audioGeneration: boolean;
  maxDuration: number;
  supportedDurations: number[];
  quality: 'fast' | 'balanced' | 'high';
}

export function getDoubaoModelInfo(modelId: string): DoubaoImageModelConfig | DoubaoVideoModelConfig | undefined {
  return DOUBO_MODELS[modelId as keyof typeof DOUBO_MODELS];
}

export function getImageModels(): DoubaoImageModelConfig[] {
  return Object.values(DOUBO_IMAGE_MODELS);
}

export function getVideoModels(): DoubaoVideoModelConfig[] {
  return Object.values(DOUBO_VIDEO_MODELS);
}

export function getAllDoubaoModels(): (DoubaoImageModelConfig | DoubaoVideoModelConfig)[] {
  return Object.values(DOUBO_MODELS);
}

/**
 * 智能模型推荐
 * 根据使用场景、质量要求和预算推荐最优模型
 */
export function suggestModel(
  type: 'image' | 'video',
  quality: 'fast' | 'balanced' | 'high' = 'balanced',
  useCase?: 'preview' | 'production' | 'batch'
): string {
  if (type === 'image') {
    return 'ep-20260321212919-vfr2q'; // Seedream 5.0 Lite
  }

  // 视频模型推荐逻辑
  switch (quality) {
    case 'fast':
      return 'doubao-seedance-1-0-pro-fast-250528';

    case 'high':
      return 'doubao-seedance-1-5-pro-251215';

    case 'balanced':
    default:
      if (useCase === 'preview') {
        return 'doubao-seedance-1-0-pro-fast-250528';
      } else if (useCase === 'batch') {
        return 'doubao-seedance-1-5-pro-251215';
      } else {
        return 'doubao-seedance-1-5-pro-251215';
      }
  }
}

/**
 * 获取模型能力信息
 */
export function getModelCapabilities(modelId: string): VideoModelCapabilities | null {
  const model = getDoubaoModelInfo(modelId);
  if (model && 'capabilities' in model) {
    return model.capabilities || null;
  }
  return null;
}

/**
 * 检查模型是否支持特定功能
 */
export function isCapabilitySupported(
  modelId: string,
  capability: keyof VideoModelCapabilities
): boolean {
  const capabilities = getModelCapabilities(modelId);
  return capabilities ? !!capabilities[capability] : false;
}

/**
 * 计算预估成本（积分）
 */
export function estimateCost(
  modelId: string,
  duration: number,
  resolution: string = '720p',
  withAudio: boolean = false
): number {
  const model = getDoubaoModelInfo(modelId);
  if (!model || !('pricing' in model) || !model.pricing?.creditsPerSecond) {
    console.warn(`[estimateCost] 模型 ${modelId} 缺少定价信息`);
    return -1; // 返回 -1 表示无法估算
  }

  const costPerSecond = model.pricing.creditsPerSecond[resolution] ||
                         model.pricing.creditsPerSecond['720p'] || 10;

  let totalCost = costPerSecond * duration;

  if (withAudio && model.pricing.withAudioMultiplier) {
    totalCost *= model.pricing.withAudioMultiplier;
  }

  return Math.ceil(totalCost);
}

export type DoubaoModelId = keyof typeof DOUBO_MODELS;
