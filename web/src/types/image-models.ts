/**
 * 图片生成模型类型定义
 * 整合所有主流AI图片模型的参数
 */

// ==================== 图片生成模型提供商 ====================
export type ImageModelProvider =
  | 'stability_ai'     // Stability AI
  | 'openai_dalle'    // DALL-E 3
  | 'adobe_firefly'   // Adobe Firefly
  | 'leonardo_ai'     // Leonardo.AI
  | 'ideogram'        // Ideogram
  | 'recraft_ai'      // Recraft.AI
  | 'seedream'        // Seedream
  | 'doubao'          // 豆包
  | 'bilibili'        // 比列
  | 'hailuo';          // 海螺

// ==================== 基础类型 ====================
export type ImageAspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | '4:5' | '21:9' | '3:2' | '2:3' | '5:4' | '9:21' | '1:3' | '3:1' | '2:1' | '1:2' | 'auto';
export type ImageQuality = 'standard' | 'high' | 'ultra';

// ==================== 模型配置接口 ====================

/**
 * 图片生成模型配置接口
 */
export interface ImageModelConfig {
  id: ImageModelProvider;
  name: string;
  version: string;
  
  // 参数限制
  limits: {
    maxResolution: { width: number; height: number };
    supportedAspectRatios: ImageAspectRatio[];
    supportedSizes: string[];
  };
  
  // 默认参数
  defaults: {
    aspectRatio: ImageAspectRatio;
    size: string;
    quality: string;
    style?: string;
  };

  // 支持的额外参数
  supports: {
    seed: boolean;
    negativePrompt: boolean;
    style: boolean;
    imageToImage: boolean;
    controlNet: boolean;
  };
}

/**
 * 统一图片生成参数
 */
export interface UnifiedImageParams {
  modelProvider: ImageModelProvider;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: ImageAspectRatio;
  size: string;
  quality?: string;
  style?: string;
  seed?: number;
  referenceImage?: string;
  advancedParams: Record<string, unknown>;
}

// ==================== Stability AI 配置 ====================
export const StabilityAIConfig: ImageModelConfig = {
  id: 'stability_ai',
  name: 'Stability AI',
  version: '3.0',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    supportedSizes: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'standard',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: true,
    imageToImage: true,
    controlNet: true,
  },
};

// ==================== DALL-E 3 配置 ====================
export const OpenAIDALLEConfig: ImageModelConfig = {
  id: 'openai_dalle',
  name: 'DALL-E 3',
  version: '3.0',
  limits: {
    maxResolution: { width: 1792, height: 1024 },
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
    supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'standard',
  },
  supports: {
    seed: false,
    negativePrompt: false,
    style: true,
    imageToImage: false,
    controlNet: false,
  },
};

// ==================== Adobe Firefly 配置 ====================
export const AdobeFireflyConfig: ImageModelConfig = {
  id: 'adobe_firefly',
  name: 'Adobe Firefly',
  version: '3.0',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    supportedSizes: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'standard',
    style: 'photo',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: true,
    imageToImage: true,
    controlNet: false,
  },
};

// ==================== Leonardo.AI 配置 ====================
export const LeonardoAIConfig: ImageModelConfig = {
  id: 'leonardo_ai',
  name: 'Leonardo.AI',
  version: 'Phoenix',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16', '4:5'],
    supportedSizes: ['512x512', '768x768', '1024x1024', '1024x768', '768x1024', '1024x1280', '1280x1024'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'standard',
    style: 'dynamic',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: true,
    imageToImage: true,
    controlNet: true,
  },
};

// ==================== Ideogram 配置 ====================
export const IdeogramConfig: ImageModelConfig = {
  id: 'ideogram',
  name: 'Ideogram',
  version: '2.0',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    supportedSizes: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'standard',
    style: 'photograph',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: true,
    imageToImage: false,
    controlNet: false,
  },
};

// ==================== Recraft.AI 配置 ====================
export const RecraftAIConfig: ImageModelConfig = {
  id: 'recraft_ai',
  name: 'Recraft.AI',
  version: 'v3',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    supportedSizes: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'standard',
    style: 'realistic_image',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: true,
    imageToImage: false,
    controlNet: false,
  },
};

// ==================== Seedream 配置 ====================
export const SeedreamConfig: ImageModelConfig = {
  id: 'seedream',
  name: 'Seedream',
  version: '5.0',
  limits: {
    maxResolution: { width: 1920, height: 1920 },
    supportedAspectRatios: ['1:1'],
    supportedSizes: ['1920x1920'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1920x1920',
    quality: 'standard',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: false,
    imageToImage: true,
    controlNet: false,
  },
};

// ==================== 豆包配置 ====================
export const DoubaoImageConfig: ImageModelConfig = {
  id: 'doubao',
  name: '豆包',
  version: '1.0',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    supportedSizes: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'high',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: false,
    imageToImage: true,
    controlNet: false,
  },
};

// ==================== 比列配置 ====================
export const BilibiliImageConfig: ImageModelConfig = {
  id: 'bilibili',
  name: '比列',
  version: '1.0',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16', '4:5'],
    supportedSizes: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792', '1024x1280', '1280x1024'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'high',
    style: 'realistic',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: true,
    imageToImage: true,
    controlNet: true,
  },
};

// ==================== 海螺配置 ====================
export const HailuoImageConfig: ImageModelConfig = {
  id: 'hailuo',
  name: '海螺',
  version: '1.0',
  limits: {
    maxResolution: { width: 2048, height: 2048 },
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    supportedSizes: ['1024x1024', '768x1024', '1024x768', '1792x1024', '1024x1792'],
  },
  defaults: {
    aspectRatio: '1:1',
    size: '1024x1024',
    quality: 'high',
  },
  supports: {
    seed: true,
    negativePrompt: true,
    style: false,
    imageToImage: true,
    controlNet: false,
  },
};

// ==================== 豆包 Seedream 5.0 Pro 配置 ====================
// 已删除：原国外模型 GPT Image 2 配置（已由 doubao-seedream-5-0-pro 替代）

// ==================== 豆包 Seedream 5.0 Pro（替代 Nano Banana 2） ====================
// 已删除：原国外模型 Nano Banana 2 配置（已由 doubao-seedream-5-0-pro 替代）

// ==================== 豆包 Seedream 5.0 lite（替代 Grok Imagine） ====================
// 已删除：原国外模型 Grok Imagine 配置（已由 doubao-seedream-5-0-lite 替代）

// ==================== 豆包 Seedream 5.0 Pro（替代 Nano Banana Pro） ====================
// 已删除：原国外模型 Nano Banana Pro 配置（已由 doubao-seedream-5-0-pro 替代）

// ==================== 模型配置映射 ====================
export const IMAGE_MODEL_CONFIGS: Record<ImageModelProvider, ImageModelConfig> = {
  stability_ai: StabilityAIConfig,
  openai_dalle: OpenAIDALLEConfig,
  adobe_firefly: AdobeFireflyConfig,
  leonardo_ai: LeonardoAIConfig,
  ideogram: IdeogramConfig,
  recraft_ai: RecraftAIConfig,
  seedream: SeedreamConfig,
  doubao: DoubaoImageConfig,
  bilibili: BilibiliImageConfig,
  hailuo: HailuoImageConfig,
};

// ==================== 风格选项 ====================
export const styleOptions: Record<ImageModelProvider, { value: string; label: string }[]> = {
  stability_ai: [
    { value: 'photograph', label: '照片' },
    { value: 'digital-art', label: '数字艺术' },
    { value: 'illustration', label: '插画' },
    { value: '3d-render', label: '3D渲染' },
  ],
  openai_dalle: [
    { value: 'vivid', label: '生动' },
    { value: 'natural', label: '自然' },
  ],
  adobe_firefly: [
    { value: 'photo', label: '照片' },
    { value: 'art', label: '艺术' },
    { value: 'illustration', label: '插画' },
    { value: 'comic', label: '漫画' },
  ],
  leonardo_ai: [
    { value: 'dynamic', label: '动态' },
    { value: 'photograph', label: '照片' },
    { value: 'anime', label: '动漫' },
    { value: 'digital-art', label: '数字艺术' },
  ],
  ideogram: [
    { value: 'photograph', label: '摄影' },
    { value: 'illustration', label: '插画' },
    { value: 'design', label: '设计' },
    { value: 'paint', label: '绘画' },
  ],
  recraft_ai: [
    { value: 'realistic_image', label: '写实' },
    { value: 'digital_art', label: '数字艺术' },
    { value: 'vector_illustration', label: '矢量插画' },
    { value: 'hand_drawn', label: '手绘' },
  ],
  seedream: [],
  doubao: [],
  bilibili: [
    { value: 'realistic', label: '写实' },
    { value: 'anime', label: '动漫' },
    { value: 'digital_art', label: '数字艺术' },
    { value: '3d_render', label: '3D渲染' },
    { value: 'illustration', label: '插画' },
  ],
  hailuo: [],
};

// ==================== 参数验证 ====================

/**
 * 获取模型的默认参数
 */
export function getDefaultImageParams(modelProvider: ImageModelProvider): UnifiedImageParams {
  const config = IMAGE_MODEL_CONFIGS[modelProvider];
  return {
    modelProvider,
    prompt: '',
    aspectRatio: config.defaults.aspectRatio,
    size: config.defaults.size,
    quality: config.defaults.quality,
    style: config.defaults.style,
    advancedParams: {},
  };
}

/**
 * 验证并规范化参数
 */
export function validateAndNormalizeImageParams(
  params: Partial<UnifiedImageParams>
): UnifiedImageParams {
  const modelConfig = IMAGE_MODEL_CONFIGS[params.modelProvider || 'doubao'];
  
  const aspectRatio = modelConfig.limits.supportedAspectRatios.includes(params.aspectRatio || '1:1')
    ? (params.aspectRatio || modelConfig.defaults.aspectRatio)
    : modelConfig.defaults.aspectRatio;
  
  const size = modelConfig.limits.supportedSizes.includes(params.size || '1024x1024')
    ? (params.size || modelConfig.defaults.size)
    : modelConfig.defaults.size;
  
  return {
    modelProvider: params.modelProvider || 'doubao',
    prompt: params.prompt || '',
    negativePrompt: params.negativePrompt,
    aspectRatio,
    size,
    quality: params.quality || modelConfig.defaults.quality,
    style: params.style || modelConfig.defaults.style,
    seed: params.seed,
    referenceImage: params.referenceImage,
    advancedParams: params.advancedParams || {},
  };
}
