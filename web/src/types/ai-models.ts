// AI 模型提供商类型
/**
 * @deprecated 请使用 @/types/core 中的 UnifiedAPIProvider
 * 此类型保留用于向后兼容
 */
export type AIModelProvider =
  | 'jimeng'
  | 'doubao'
  | 'doubao-video'
  | 'bytedance'
  | 'stability_ai'
  | 'minimax'
  | 'stepfun'
  | 'adobe_firefly'
  | 'leonardo_ai'
  | 'ideogram'
  | 'recraft_ai'
  | 'seedream'
  | 'stable_diffusion'
  | 'bilibili'
  | 'hailuo'
  | 'huawei'
  | 'huawei_video';

// 重新导出统一类型
export type { UnifiedAPIProvider as UnifiedProvider } from '@/types/core';
export { toUnifiedProvider, toAIModelProvider } from '@/types/core';

// 视频分辨率类型
export type VideoResolution = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

// 图片比例类型
export type ImageAspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | '4:5';

// 视频时长类型
export type VideoDuration = 3 | 5 | 8 | 10 | 15 | 30;

// 视频生成模式类型
export type VideoMode = 'standard' | 'high_quality' | 'fast';

// 视频生成方式类型（简化版）
export type GenerationMode =
  | 'text_to_video'
  | 'image_to_video'
  | 'first_last_frame'
  | 'reference_to_video'
  | 'video_to_video';

// 图片生成模式类型
export type ImageGenerationMode = 'text_to_image' | 'image_to_image' | 'reference';

// 图片模型支持的生成模式
export interface ImageModeCapabilities {
  textToImage: boolean;
  imageToImage: boolean;
  reference: boolean;
}

// 模型能力配置
export interface ModelCapabilities {
  modes: ImageModeCapabilities;
  maxResolution?: string;
  maxImages?: number;
  supportsNegativePrompt?: boolean;
  supportsStyle?: boolean;
  supportsSeed?: boolean;
}

// 分辨率配置接口
export interface ResolutionConfig {
  label: string;
  ratio: VideoResolution;
  width: number;
  height: number;
}

// 任务状态类型
export type TaskStatus =
  | 'pending'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'payment_pending';

/**
 * 任务状态结果
 *
 * 完整的任务状态信息对象，包含状态、进度、消息等
 */
export interface TaskStatusResult {
  taskId?: string;
  status: TaskStatus;
  progress: number;
  message?: string;
  timestamp?: Date;
  output?: unknown;
  resultUrl?: string;
  resultUrls?: string[];
  cosUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

// 任务优先级
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// 视频生成参数
export interface VideoGenerationParams {
  modelProvider: AIModelProvider;
  modelId?: string;
  provider?: string;
  resolution: VideoResolution;
  duration: VideoDuration;
  aspectRatio?: string;
  prompt: string;
  negativePrompt?: string;
  startImage?: string;
  endImage?: string;
  referenceImage?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  videoInput?: string;
  motionStrength?: number;
  videoMode?: VideoMode;
  generationMode?: GenerationMode;
  fps?: number;
  seed?: number;
  generateAudio?: boolean;
  returnLastFrame?: boolean;
  enableWebSearch?: boolean;
  promptEnhancer?: boolean;
  cameraMovement?: string;
  cfgScale?: number;
  style?: 'general' | 'anime' | string;
  viduStyle?: 'general' | 'anime';
  creativeStyle?: string;
  motionAmplitude?: 'auto' | 'small' | 'medium' | 'large';
  minimaxMotionLevel?: number;
  filmEmulation?: boolean;
  grainSize?: number;
  multiShot?: boolean;
  referenceType?: string;
  characterConsistency?: number;
  styleStrength?: number;
  keepOriginalSound?: boolean;
  videoPreset?: string;
  clipCount?: number;
  videoCount?: number;
  audioGeneration?: 'none' | 'music' | 'sfx' | 'ambient';
  webSearch?: boolean;
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
  videoUrl?: string;
  audioUrl?: string;
  templateId?: number;
  videoName?: string;
  nodeId?: string;
  /** Stable for one explicit submission; changes when the user generates again. */
  idempotencyKey?: string;
}

// 图片生成参数
export interface ImageGenerationParams {
  modelProvider: AIModelProvider;
  modelId?: string;
  aspectRatio: ImageAspectRatio;
  prompt: string;
  negativePrompt?: string;
  referenceImage?: string;
  referenceImages?: string[];
  seed?: number;
  resolution?: string;
  imageSize?: string;
  pixelResolution?: string;
  generationMode?: ImageGenerationMode;
  width?: number;
  height?: number;
  cfgScale?: number;
  cfgStrength?: number;
  steps?: number;
  style?: string;
  strength?: number;
  imageCount?: number;
  promptEnhancement?: boolean;
  promptOptimizer?: boolean;
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
  characterConsistency?: number;
  hdMode?: boolean;
  watermark?: boolean;
  nodeId?: string;
  /** Stable for one explicit submission; changes when the user generates again. */
  idempotencyKey?: string;
}

// 音频生成参数
export interface AudioGenerationParams {
  modelProvider: AIModelProvider;
  modelId?: string;
  text: string;
  mode: 'tts' | 'clone' | 'design' | 'async_tts' | 'voice_management' | 'music';
  voiceId?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
  sampleRate?: number;
  bitrate?: number;
  format?: 'mp3' | 'wav' | 'flac' | 'pcm';
  channel?: number;
  stream?: boolean;
  languageBoost?: string;
  subtitleEnable?: boolean;
  outputFormat?: 'url' | 'hex';
  aigcWatermark?: boolean;
  instruction?: string;
  // 音乐生成相关
  prompt?: string;
  lyrics?: string;
  audioSetting?: {
    format?: string;
    sampleRate?: number;
  };
  // 语音克隆/设计相关
  cloneFileId?: string;
  clonePromptText?: string;
  voiceAudioDataUrl?: string;
  referenceAudioUrl?: string;
  referenceAudioDataUrl?: string;
  voiceDesignPrompt?: string;
  voiceDesignGender?: 'male' | 'female';
  voiceDesignAccent?: string;
  voiceDesignAge?: number;
  // 语音修正相关 (MiniMax TTS HD)
  voiceModify?: {
    pitch?: number;
    intensity?: number;
    timbre?: number;
    soundEffects?: string;
  };
  // 音色混合
  timbreWeights?: {
    voiceId: string;
    weight: number;
  }[];
  // 自定义发音
  pronunciationDict?: {
    tone?: string[];
  };
  // 任务管理相关
  taskId?: string;
}

// API 密钥配置
export interface APIKeys {
  jimeng?: {
    ak: string;
    sk: string;
  };
  doubao?: {
    apiKey: string;
    modelId?: string;
  };
  bytedance?: {
    ak: string;
    sk: string;
  };
  stability_ai?: string;
  haiper_ai?: string;
  minimax?: string;
  adobe_firefly?: string;
  leonardo_ai?: string;
  ideogram?: string;
  recraft_ai?: string;
  seedream?: {
    apiKey: string;
    modelId?: string;
  };
  bilibili?: string;
  wanx?: string;
  hailuo?: string;
  huawei?: {
    apiKey: string;
    modelId?: string;
  };
  huawei_video?: {
    apiKey: string;
    modelId?: string;
  };
}

// 生成任务
export interface GenerationSubTask {
  index: number;
  status: TaskStatus;
  progress: number;
  resultUrl?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export interface GenerationTask {
  id: string;
  nodeId: string;
  backendTaskId?: string;
  type: 'video' | 'image' | 'audio' | 'text';
  nodeType?: 'video' | 'image' | 'audio' | 'text';
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  resultUrl?: string;
  resultUrls?: string[];
  cosUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  startedAt?: string;
  pausedAt?: string;
  updatedAt?: string;
  subTasks?: GenerationSubTask[];
  batchSize?: number;
  modelId?: string;
  modelProvider?: string;
  modelName?: string;
  promptPreview?: string;
}

// 文件项
export interface FileItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'text' | 'workflow';
  url: string;
  thumbnailUrl?: string;
  size: number;
  createdAt: string;
  source?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  path?: string;
  duration?: number;
  textContent?: string;
  textTitle?: string;
  workflowName?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
    mimeType?: string;
    category?: string;
    lyrics?: string;
    lrc?: string;
    model?: string;
    provider?: string;
    prompt?: string;
    generationId?: string;
    nodeId?: string;
    canvasAssetId?: string;
    generatedAt?: number;
    isProcessing?: boolean;
    isSynced?: boolean;
    syncError?: string;
  };
}

// 节点类型
export type NodeType =
  | 'videoGen'
  | 'imageGen'
  | 'unifiedImageStudio'
  | 'imageInput'
  | 'videoInput'
  | 'output';

// 视频生成节点数据
export interface VideoGenNodeData {
  type: 'videoGen';
  params: VideoGenerationParams;
  task?: GenerationTask;
  isExpanded?: boolean;
}

// 图片生成节点数据
export interface ImageGenNodeData {
  type: 'imageGen';
  params: ImageGenerationParams;
  task?: GenerationTask;
  isExpanded?: boolean;
}

// 音频生成节点数据
export interface AudioGenNodeData {
  type: 'audioGen';
  params: AudioGenerationParams;
  task?: GenerationTask;
  isExpanded?: boolean;
}

// 图片输入节点数据
export interface ImageInputNodeData {
  type: 'imageInput';
  imageUrl?: string;
  fileName?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  isExpanded?: boolean;
  processingMode?: 'none' | 'remove-background' | 'remove-person' | 'extract-subject';
  isProcessed?: boolean;
  originalImageUrl?: string;
  customBackground?: string;
  edgeFeathering?: number;
  edgeSmoothing?: number;
  imageAssetId?: string;
  flipHorizontal?: boolean;
  imageError?: boolean;
  analysisOnly?: boolean;
  analysisMode?: 'prompt_generate';
  analysisResult?: string;
  outputText?: string;
  prompt?: string;
  task?: GenerationTask;
  metadata?: {
    width?: number;
    height?: number;
  };
}

// 视频输入节点数据
export interface VideoInputNodeData {
  type: 'videoInput';
  videoUrl?: string;
  fileName?: string;
  thumbnailUrl?: string;
  videoAssetId?: string;
  startFrame?: number;
  endFrame?: number;
  width?: number;
  height?: number;
  duration?: number;
  isControllerCollapsed?: boolean;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

// 输出节点数据
export interface OutputNodeData {
  type: 'output';
  label?: string;
}

// 联合类型：所有节点数据
export type NodeData =
  | VideoGenNodeData
  | ImageGenNodeData
  | AudioGenNodeData
  | ImageInputNodeData
  | VideoInputNodeData
  | OutputNodeData;

// 生成结果
export interface GenerationResult {
  taskId: string;
  status: TaskStatus;
  resultUrl?: string;
  resultUrls?: string[];
  thumbnailUrl?: string;
  cosUrl?: string;
  output?: string;
  error?: string;
  progress?: number;
  success?: boolean;
  url?: string;
  provider?: string;
  cancelled?: boolean;
}
