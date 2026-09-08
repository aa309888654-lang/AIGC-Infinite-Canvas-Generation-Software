/**
 * 适配器接口定义
 * 统一所有AI适配器的接口
 */

import { GenerationResult, TaskStatusResult } from './ai-models';

/**
 * 图片生成参数
 */
export interface ImageParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  resolution?: string;
  imageSize?: string;
  pixelResolution?: string;
  quality?: string;
  style?: string;
  seed?: number;
  modelId?: string;
  generationMode?:
    | 'text_to_image'
    | 'image_to_image'
    | 'reference'
    | 'character_reference'
    | 'inpainting';
  referenceImage?: string;
  referenceImages?: string[];
  /** Inpainting: mask 图片 URL（白色=重绘区域，黑色=保留区域） */
  maskImage?: string;
  styleType?: 'comic' | 'original' | 'anime' | 'watercolor' | 'medieval';
  styleWeight?: number;
  // MiniMax image-01 专用参数
  promptOptimizer?: boolean; // 自动优化提示词
  promptEnhancer?: boolean;
  webSearch?: boolean;
  seedreamCapability?: string;
  seedreamOptimizeMode?: 'standard' | 'fast';
  seedreamAnnotations?: Array<{
    id: string;
    imageUrl: string;
    kind: 'point' | 'bbox';
    coordinates: number[];
  }>;
  sequentialImageGeneration?: 'auto' | 'disabled';
  sequentialMaxImages?: number;
  outputFormat?: 'jpeg' | 'png';
  steps?: number;
  cfgScale?: number;
  strength?: number;
  characterConsistency?: number;
  hdMode?: boolean;
  watermark?: boolean;
  faceEnhance?: boolean;
  characterName?: string;
  processingMode?: string;
  // 高级图片模型参数
  gptQuality?: 'auto' | 'low' | 'medium' | 'high' | 'standard' | 'hd';
  gptImageQuality?: 'auto' | 'low' | 'medium' | 'high';
  gptImageStyle?: string;
  gptOutputFormat?: 'png' | 'jpeg' | 'webp';
  gptBackground?: 'auto' | 'transparent' | 'opaque';
  gptCompression?: number;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  fluxFormat?: 'jpeg' | 'png';
  fluxSafety?: number;
  fluxSeed?: number;
  maskMode?: string;
  expandDirection?: string;
  expandPixels?: number;
  upscaleEngine?: string;
  stylePreset?: string;
  variationCount?: number;
  backgroundMode?: string;
  n?: number; // 生成图片数量 (1-9)
  nodeId?: string;
  idempotencyKey?: string;
}

/**
 * 视频生成参数
 */
export interface VideoParams {
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  fps?: number;
  resolution?: string;
  quality?: string;
  aspectRatio?: string;
  startImage?: string;
  endImage?: string;
  referenceImages?: string[];
  referenceImage?: string;
  referenceVideos?: string[];
  referenceAudios?: string[];
  videoInput?: string;
  modelId?: string;
  seed?: number;
  generationMode?:
    | 'text_to_video'
    | 'image_to_video'
    | 'first_last_frame'
    | 'reference_to_video'
    | 'video_to_video';
  generateAudio?: boolean;
  returnLastFrame?: boolean;
  enableWebSearch?: boolean;
  cfgScale?: number;
  cameraMovement?: string;
  motionStrength?: number;
  style?: 'general' | 'anime' | string;
  viduStyle?: 'general' | 'anime';
  creativeStyle?: string;
  motionAmplitude?: 'auto' | 'small' | 'medium' | 'large';
  minimaxMotionLevel?: number;
  filmEmulation?: boolean;
  grainSize?: number;
  promptEnhancer?: boolean;
  multiShot?: boolean;
  referenceType?: string;
  characterConsistency?: number;
  styleStrength?: number;
  keepOriginalSound?: boolean;
  videoPreset?: string;
  clipCount?: number;
  videoCount?: number;
  bgm?: boolean;
  offPeak?: boolean;
  watermark?: boolean;
  wmPosition?: number;
  wmUrl?: string;
  metaData?: string;
  callbackUrl?: string;
  payload?: string;
  templateMode?: 'standard' | 'template-story' | 'template' | 'one-click';
  templateStory?: string;
  templateName?: string;
  templateArea?: string;
  templateBeast?: string;
  templateBgm?: boolean;
  nodeId?: string;
  /** Stable for one explicit submission; changes when the user generates again. */
  idempotencyKey?: string;
}

/**
 * 任务状态参数
 */
export interface TaskStatusParams {
  taskId: string;
  provider?: string;
}

/**
 * AI适配器接口
 * 所有AI生成器都需要实现这个接口
 */
export interface IAIAdapter {
  /**
   * 生成图片
   */
  generateImage(params: ImageParams): Promise<GenerationResult>;

  /**
   * 生成视频
   */
  generateVideo(params: VideoParams): Promise<GenerationResult>;

  /**
   * 获取任务状态
   *
   * 返回标准化的任务状态对象
   */
  getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult>;

  /**
   * 获取适配器名称
   */
  getProviderName(): string;

  /**
   * 检查适配器是否可用
   */
  isAvailable(): boolean;

  /**
   * 测试连接
   */
  testConnection(): Promise<boolean>;

  /**
   * 获取支持的模型列表
   */
  getModels(): { id: string; name: string }[];
}

/**
 * 适配器工厂接口
 */
export interface IAdapterFactory {
  /**
   * 创建适配器
   */
  createAdapter(provider: string, config: AdapterConfig): IAIAdapter;

  /**
   * 获取支持的提供商列表
   */
  getSupportedProviders(): string[];

  /**
   * 检查提供商是否支持
   */
  isProviderSupported(provider: string): boolean;
}

/**
 * 适配器配置接口
 */
export interface AdapterConfig {
  provider: string;
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
  modelId?: string;
  timeout?: number;
  retries?: number;
}
