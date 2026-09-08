/**
 * AICG Studio 共享类型定义
 * 前后端共用的类型、常量和枚举
 *
 * 原则：
 * - 仅包含跨越前后端边界（API 请求/响应）的类型
 * - 不包含仅在后端使用的实现细节（如 Prisma 模型）
 * - 不包含仅在前端使用的 UI 状态类型
 */

// ==================== 任务状态 ====================

export const TaskStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

// ==================== 支付状态 ====================

export const PaymentStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// ==================== 会员等级 ====================

export const MembershipLevel = {
  TRIAL: 'trial',
  FREE: 'free',
  LIGHT: 'light',
  PRO: 'pro',
  LOCAL: 'local',
  // Legacy aliases kept for stored records and older API clients.
  BASIC: 'basic',
  STANDARD: 'standard',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
  BETA: 'beta',
} as const;

export type MembershipLevel = (typeof MembershipLevel)[keyof typeof MembershipLevel];

// ==================== 配额交易类型 ====================

export const QuotaTransactionType = {
  EARN: 'earn',
  SPEND: 'spend',
  ADJUST: 'adjust',
  REFUND: 'refund',
} as const;

export type QuotaTransactionType = (typeof QuotaTransactionType)[keyof typeof QuotaTransactionType];

// ==================== 生成模式 ====================

export const GenerationMode = {
  TEXT_TO_VIDEO: 'text_to_video',
  IMAGE_TO_VIDEO: 'image_to_video',
  FIRST_LAST_FRAME: 'first_last_frame',
  REFERENCE_TO_VIDEO: 'reference_to_video',
  VIDEO_TO_VIDEO: 'video_to_video',
  TEXT_TO_IMAGE: 'text_to_image',
  IMAGE_TO_IMAGE: 'image_to_image',
  CHARACTER_REFERENCE: 'character_reference',
} as const;

export type GenerationMode = (typeof GenerationMode)[keyof typeof GenerationMode];

// ==================== 视频/图片分辨率 ====================

export const AspectRatio = {
  LANDSCAPE_16_9: '16:9',
  PORTRAIT_9_16: '9:16',
  SQUARE_1_1: '1:1',
  STANDARD_4_3: '4:3',
  ULTRAWIDE_21_9: '21:9',
  PORTRAIT_4_5: '4:5',
} as const;

export type AspectRatio = (typeof AspectRatio)[keyof typeof AspectRatio];

// ==================== 错误码 ====================

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TIMEOUT = 'TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

// ==================== API 响应类型 ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
  value?: any;
}

// ==================== 生成参数 ====================

export interface BaseParams {
  provider: string;
  model?: string;
}

export interface VideoParams extends BaseParams {
  mode?: GenerationMode;
  // P2-11: 前端语义化字段（与 mode 等价，video-orchestrator 会做映射）
  generationMode?: GenerationMode;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  resolution?: AspectRatio;
  pixelResolution?: '1K' | '720p' | '1080p' | '2K' | '4K';
  fps?: number;
  quality?: 'standard' | 'high' | 'ultra';
  aspectRatio?: string;
  seed?: number;
  cfgStrength?: number;
  cfgScale?: number;
  steps?: number;
  motionIntensity?: number;
  motionStrength?: number;
  cameraControl?: CameraControl;
  cameraMovement?: string;
  imageUrl?: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  templateId?: number;
  videoName?: string;
  avatarId?: string;
  avatarName?: string;
  avatarImageUrl?: string;
  lipSyncStrength?: number;
  language?: string;
  // P2-11: 前端语义化图片字段（与 firstFrameUrl/lastFrameUrl/imageUrl/videoUrl 对应，
  // 由 video-orchestrator 映射到 provider 字段）
  startImage?: string;
  endImage?: string;
  referenceImage?: string;
  videoInput?: string;
  modelId?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  audioGeneration?: string;
  webSearch?: boolean;
  // P2-11: 前端语义化字段（与 webSearch 等价，video-orchestrator 会做 fallback）
  enableWebSearch?: boolean;
  returnLastFrame?: boolean;
  generateAudio?: boolean;
  apiModelName?: string;
  promptEnhancement?: boolean;
  promptEnhancer?: boolean;
  style?: string;
  viduStyle?: string;
  creativeStyle?: string;
  motionAmplitude?: string;
  minimaxMotionLevel?: number;
  filmEmulation?: boolean;
  grainSize?: number;
  subjectReference?: {
    type: 'character';
    image: string;
  };
  camera?: string;
  enableDraft?: boolean;
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
}

export interface CameraControl {
  type?:
    | 'static'
    | 'zoom_in'
    | 'zoom_out'
    | 'pan_left'
    | 'pan_right'
    | 'pan_up'
    | 'pan_down'
    | 'rotate_cw'
    | 'rotate_ccw'
    | 'tilt_left'
    | 'tilt_right'
    | 'dolly'
    | 'crane_up'
    | 'crane_down'
    | 'pedestal'
    | 'tracking'
    | 'parallax';
  vertical?: number;
  horizontal?: number;
  pan?: number;
  tilt?: number;
  roll?: number;
  zoom?: number;
}

export interface ImageParams extends BaseParams {
  mode?: GenerationMode;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  resolution?: AspectRatio;
  size?: string;
  imageSize?: string;
  pixelResolution?: '1K' | '720p' | '1080p' | '2K' | '4K';
  style?: string;
  seed?: number;
  steps?: number;
  cfgStrength?: number;
  cfgScale?: number;
  imageCount?: number;
  referenceImageUrl?: string;
  referenceImages?: string[];
  editSourceImages?: string[];
  maskImageUrl?: string;
  promptEnhancement?: boolean;
  promptEnhancer?: boolean;
  promptOptimizer?: boolean;
  webSearch?: boolean;
  seedreamCapability?: string;
  seedreamOptimizeMode?: 'standard' | 'fast';
  sequentialImageGeneration?: 'auto' | 'disabled';
  sequentialMaxImages?: number;
  outputFormat?: 'jpeg' | 'png';
  characterConsistency?: number;
  hdMode?: boolean;
  gptQuality?: 'auto' | 'low' | 'medium' | 'high' | 'standard' | 'hd';
  gptOutputFormat?: 'png' | 'jpeg' | 'webp';
  gptBackground?: 'auto' | 'transparent' | 'opaque';
  gptCompression?: number;
  gptOutputCompression?: number;
  moderation?: 'auto' | 'low';
  providerExtensions?: {
    seed?: number;
    thinking?: 'off' | 'low' | 'medium' | 'high';
    providerRaw?: Record<string, unknown>;
  };
  vipSize?: string;
  n?: number;
  watermark?: boolean;
  strength?: number;
  quality?: string;
  generationMode?: string;
  gptImageQuality?: string;
  gptImageStyle?: string;
  thinkingLevel?: string;
  fluxFormat?: string;
  fluxSafety?: number;
  fluxSeed?: number;
  maskMode?: string;
  expandDirection?: string;
  expandPixels?: number;
  upscaleEngine?: string;
  stylePreset?: string;
  variationCount?: number;
  backgroundMode?: string;
  source?: string;
}

export interface AudioParams extends BaseParams {
  text?: string;
  prompt?: string;
  lyrics?: string;
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
  mode?: 'tts' | 'clone' | 'design' | 'async_tts' | 'voice_management' | 'music';
}

// ==================== 生成结果 ====================

export interface GenerationResult {
  taskId: string;
  status: TaskStatus;
  provider: string;
  model?: string;
  result?: {
    url?: string;
    urls?: string[];
    videoUrl?: string;
    imageUrl?: string;
    audioUrl?: string;
    thumbnailUrl?: string;
    voiceId?: string;
    metadata?: Record<string, any>;
  };
  error?: string;
  progress?: number;
}

// ==================== Provider 配置 ====================

export interface ApiProviderConfig {
  apiKey: string;
  apiSecret?: string;
  endpoint?: string;
  compatibilityMode?: 'openai-image' | 'openai-video' | 'official-image' | 'official-video';
  hailuoEndpoint?: string;
  hailuoApiKey?: string;
  model?: string;
}

// ==================== WebSocket 类型 ====================

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
}

// ==================== 分页参数 ====================

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  limit: number;
}

// ==================== 用户角色 ====================

export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
  VIP: 'vip',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
