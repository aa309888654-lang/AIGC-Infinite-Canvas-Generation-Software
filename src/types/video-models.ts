/**
 * 视频生成模型类型定义
 * 整合所有主流AI视频模型的参数
 */

// ==================== VideoGenNode 参数类型 ====================
export interface VideoGenParams {
  // 模型选择
  modelProvider: VideoModelProvider;
  generationMode: GenerationMode;
  
  // 提示词
  prompt: string;
  negativePrompt?: string;
  
  // 图像输入
  referenceImage?: string;
  startImage?: string;
  endImage?: string;
  videoInput?: string;
  
  // 基础参数
  resolution: VideoResolution;
  pixelResolution: VideoPixelResolution;
  duration: number;
  fps: number;
  
  // 质量参数
  quality: 'standard' | 'high' | 'ultra';
  cfgScale: number;
  steps: number;
  seed: number;
  
  // 运动参数
  motionStrength: number;
  cameraControl: string;
  cameraIntensity: number;
  
  // 高级参数
  advancedParams?: Record<string, unknown>;
}

// ==================== 视频生成模型提供商 ====================
export type VideoModelProvider =
  | 'doubao'
  | 'minimax'
  | 'stability_ai'
  | 'hailuo'
  | 'vidu';

// ==================== 基础类型 ====================
export type VideoResolution = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9' | '4:5';
export type VideoPixelResolution = '480p' | '720p' | '1080p' | '2k' | '4k';
export type VideoDuration = 1 | 3 | 4 | 5 | 6 | 8 | 10 | 15 | 16 | 20 | 30 | 48 | 60;
export type GenerationMode = 'text_to_video' | 'image_to_video' | 'first_last_frame' | 'video_to_video';
export type VideoQuality = 'standard' | 'high' | 'ultra';

// ==================== 模型配置接口 ====================

/**
 * 视频生成模型配置接口
 * 每个模型可以实现此接口以提供自定义参数
 */
export interface VideoModelConfig {
  // 基础信息
  id: VideoModelProvider;
  name: string;
  version: string;
  
  // 能力支持
  supports: {
    textToVideo: boolean;
    imageToVideo: boolean;
    firstLastFrame: boolean;
    videoToVideo: boolean;
  };
  
  // 参数限制
  limits: {
    maxResolution: { width: number; height: number };
    maxDuration: number;
    maxFPS: number;
    supportedFPS: number[];
    supportedResolutions: VideoResolution[];
    supportedPixelResolutions: VideoPixelResolution[];
    supportedDurations: VideoDuration[];
    fpsConfigurable?: boolean;      // FPS是否可配置（豆包为false）
    cameraControl?: boolean;        // 是否支持镜头控制
    motionStrength?: boolean;       // 是否支持运动强度
  };
  
  // 默认参数
  defaults: {
    resolution: VideoResolution;
    pixelResolution: VideoPixelResolution;
    duration: VideoDuration;
    fps: number;
    cfg: number;
    steps: number;
  };
}

/**
 * 统一视频生成参数
 */
export interface UnifiedVideoParams {
  // 基础参数
  modelProvider: VideoModelProvider;
  generationMode: GenerationMode;
  
  // 提示词
  prompt: string;
  negativePrompt?: string;
  
  // 图像输入
  referenceImage?: string;      // 图生视频参考图
  startImage?: string;          // 首帧
  endImage?: string;            // 尾帧
  videoInput?: string;         // 视频生视频输入
  
  // 基础参数
  resolution: VideoResolution;
  pixelResolution: VideoPixelResolution;
  duration: VideoDuration;
  fps: number;
  
  // 质量参数
  quality: VideoQuality;
  cfgScale: number;            // CFG 强度
  steps: number;               // 生成步数
  
  // 运动参数
  motionStrength: number;       // 运动幅度 0-100
  cameraControl?: string;       // 镜头控制
  
  // 高级参数 (原生参数透传)
  advancedParams: Record<string, unknown>;
}

/**
 * 豆包AI模型配置
 * 已修复: 支持FPS可调、镜头控制和视频生视频
 */
export const DoubaoConfig: VideoModelConfig = {
  id: 'doubao',
  name: '豆包AI',
  version: '1.5',
  supports: {
    textToVideo: true,
    imageToVideo: true,
    firstLastFrame: true,
    videoToVideo: true, // ✅ 已修复：支持视频生视频
  },
  limits: {
    maxResolution: { width: 1920, height: 1080 },
    maxDuration: 30,
    maxFPS: 60,
    supportedFPS: [24, 30, 60], // ✅ 已修复：支持多档FPS
    supportedResolutions: ['16:9', '9:16', '1:1'],
    supportedPixelResolutions: ['720p', '1080p', '2k', '4k'],
    supportedDurations: [5, 10, 15, 30],
    fpsConfigurable: true, // ✅ 已修复：FPS可配置
    cameraControl: true,   // ✅ 已修复：支持镜头控制
    motionStrength: true,  // 支持运动强度
  },
  defaults: {
    resolution: '16:9',
    pixelResolution: '1080p',
    duration: 8,
    fps: 30,
    cfg: 7,
    steps: 30,
  },
};

/**
 * MiniMax模型配置
 */
export const MinimaxConfig: VideoModelConfig = {
  id: 'minimax',
  name: 'MiniMax',
  version: '1.0',
  supports: {
    textToVideo: true,
    imageToVideo: true,
    firstLastFrame: false,
    videoToVideo: false,
  },
  limits: {
    maxResolution: { width: 1920, height: 1080 },
    maxDuration: 30,
    maxFPS: 30,
    supportedFPS: [24, 30],
    supportedResolutions: ['16:9', '9:16', '1:1'],
    supportedPixelResolutions: ['720p', '1080p', '2k'],
    supportedDurations: [5, 10, 15, 30],
  },
  defaults: {
    resolution: '16:9',
    pixelResolution: '1080p',
    duration: 8,
    fps: 24,
    cfg: 7,
    steps: 30,
  },
};

/**
 * Stability AI SVD模型配置
 */
export const StabilityAIConfig: VideoModelConfig = {
  id: 'stability_ai',
  name: 'Stability AI SVD',
  version: 'XT',
  supports: {
    textToVideo: false,
    imageToVideo: true,
    firstLastFrame: false,
    videoToVideo: true,
  },
  limits: {
    maxResolution: { width: 1280, height: 768 },
    maxDuration: 10,
    maxFPS: 30,
    supportedFPS: [24, 30],
    supportedResolutions: ['16:9', '9:16', '1:1'],
    supportedPixelResolutions: ['720p', '1080p'],
    supportedDurations: [4, 6, 8, 10],
  },
  defaults: {
    resolution: '16:9',
    pixelResolution: '720p',
    duration: 4,
    fps: 24,
    cfg: 3,
    steps: 25,
  },
};

/**
 * Vidu Q3 模型配置
 * 支持文生视频、图生视频、首尾帧生成
 * 支持音频生成（Q3模型）
 */
export const ViduConfig: VideoModelConfig = {
  id: 'vidu',
  name: 'Vidu Q3',
  version: '3.0',
  supports: {
    textToVideo: true,
    imageToVideo: true,
    firstLastFrame: true,
    videoToVideo: false,
  },
  limits: {
    maxResolution: { width: 1920, height: 1080 },
    maxDuration: 16,
    maxFPS: 30,
    supportedFPS: [24, 30],
    supportedResolutions: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportedPixelResolutions: ['720p', '1080p'],
    supportedDurations: [4, 8, 16],
    cameraControl: false,
    motionStrength: false,
  },
  defaults: {
    resolution: '16:9',
    pixelResolution: '1080p',
    duration: 8,
    fps: 24,
    cfg: 7,
    steps: 30,
  },
};

// ==================== 模型配置映射 ====================
export const VIDEO_MODEL_CONFIGS: Record<VideoModelProvider, VideoModelConfig> = {  doubao: DoubaoConfig,
  minimax: MinimaxConfig,
  stability_ai: StabilityAIConfig,
  hailuo: {
    id: 'hailuo',
    name: 'Hailuo',
    version: '1.0',
    supports: {
      textToVideo: true,
      imageToVideo: true,
      firstLastFrame: false,
      videoToVideo: false,
    },
    limits: {
      maxResolution: { width: 1280, height: 720 },
      maxDuration: 6,
      maxFPS: 24,
      supportedFPS: [24],
      supportedResolutions: ['16:9', '9:16'],
      supportedPixelResolutions: ['720p'],
      supportedDurations: [5, 6],
    },
    defaults: {
      resolution: '16:9',
      pixelResolution: '720p',
      duration: 5,
      fps: 24,
      cfg: 7.5,
      steps: 25,
    },
  },
  vidu: ViduConfig,
};

// ==================== 参数验证 ====================

/**
 * 验证并规范化参数
 */
export function validateAndNormalizeParams(
  params: Partial<UnifiedVideoParams>
): UnifiedVideoParams {
  const modelConfig = VIDEO_MODEL_CONFIGS[params.modelProvider || 'doubao'];
  
  // 验证分辨率比例
  const resolution = modelConfig.limits.supportedResolutions.includes(params.resolution || '16:9')
    ? (params.resolution || modelConfig.defaults.resolution)
    : modelConfig.defaults.resolution;
  
  // 验证像素分辨率
  const pixelResolution = modelConfig.limits.supportedPixelResolutions.includes(params.pixelResolution || '1080p')
    ? (params.pixelResolution || modelConfig.defaults.pixelResolution)
    : modelConfig.defaults.pixelResolution;
  
  // 验证时长
  const duration = modelConfig.limits.supportedDurations.includes(params.duration || 10)
    ? (params.duration || modelConfig.defaults.duration)
    : modelConfig.defaults.duration;
  
  // 验证帧率
  const fps = modelConfig.limits.supportedFPS.includes(params.fps || 24)
    ? (params.fps || modelConfig.defaults.fps)
    : modelConfig.defaults.fps;
  
  // 验证CFG
  const cfgScale = Math.max(1, Math.min(20, params.cfgScale || modelConfig.defaults.cfg));
  
  // 验证步数
  const steps = Math.max(20, Math.min(100, params.steps || modelConfig.defaults.steps));
  
  return {
    modelProvider: params.modelProvider || 'doubao',
    generationMode: params.generationMode || 'text_to_video',
    prompt: params.prompt || '',
    negativePrompt: params.negativePrompt,
    referenceImage: params.referenceImage,
    startImage: params.startImage,
    endImage: params.endImage,
    videoInput: params.videoInput,
    resolution,
    pixelResolution,
    duration,
    fps,
    quality: params.quality || 'standard',
    cfgScale,
    steps,
    motionStrength: params.motionStrength || 50,
    cameraControl: params.cameraControl,
    advancedParams: params.advancedParams || {},
  };
}

/**
 * 获取模型的默认参数
 */
export function getDefaultParams(modelProvider: VideoModelProvider): UnifiedVideoParams {
  const config = VIDEO_MODEL_CONFIGS[modelProvider];
  return {
    modelProvider,
    generationMode: 'text_to_video',
    prompt: '',
    resolution: config.defaults.resolution,
    pixelResolution: config.defaults.pixelResolution,
    duration: config.defaults.duration,
    fps: config.defaults.fps,
    quality: 'standard',
    cfgScale: config.defaults.cfg,
    steps: config.defaults.steps,
    motionStrength: 50,
    advancedParams: {},
  };
}

/**
 * 检查模型是否支持指定的生成模式
 */
export function isGenerationModeSupported(
  modelProvider: VideoModelProvider,
  mode: GenerationMode
): boolean {
  const config = VIDEO_MODEL_CONFIGS[modelProvider];
  switch (mode) {
    case 'text_to_video':
      return config.supports.textToVideo;
    case 'image_to_video':
      return config.supports.imageToVideo;
    case 'first_last_frame':
      return config.supports.firstLastFrame;
    case 'video_to_video':
      return config.supports.videoToVideo;
    default:
      return false;
  }
}