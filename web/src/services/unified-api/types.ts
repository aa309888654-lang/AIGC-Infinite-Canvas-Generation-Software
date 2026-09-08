/**
 * 统一API服务层类型定义
 *
 * ⚠️ 已废弃：基础类型已迁移到 types/core/index.ts
 * 请使用统一的核心类型定义以避免重复和冲突
 *
 * @deprecated 请使用 @/types/core 中的类型
 */

import type { UnifiedAPIProvider, UnifiedAPIAuthConfig } from '@/types/core';

// 重新导出统一类型，保持向后兼容
export {
  type UnifiedAPIProvider as APIProvider,
  type UnifiedAPIAuthConfig as APIAuthConfig,
  type UnifiedProviderInfo as ProviderInfo,
  type UnifiedConnectionStatus as ConnectionStatus,
  type UnifiedTaskStatus,
  type UnifiedTask,
  UNIFIED_DEFAULT_AUTH_CONFIG as DEFAULT_AUTH_CONFIG,
  UNIFIED_DEFAULT_PROVIDER_CONFIGS as DEFAULT_PROVIDER_CONFIGS,
  getProviderConfig,
  supportsImageGeneration,
  supportsVideoGeneration,
} from '@/types/core';

export type {
  UnifiedAPIProvider,
  UnifiedAPIAuthConfig,
  UnifiedProviderInfo,
  UnifiedConnectionStatus,
} from '@/types/core';

export type APIEnvironment = 'development' | 'staging' | 'production';

// ==================== 统一配置接口 ====================
export interface UnifiedAPIConfig {
  configs: Record<UnifiedAPIProvider, UnifiedAPIAuthConfig>;
  currentEnvironment: APIEnvironment;
  environmentBaseUrls: Record<UnifiedAPIProvider, Record<APIEnvironment, string>>;
  activeProvider: UnifiedAPIProvider | null;
  lastSynced: Date | null;
}

// ==================== 连接状态 ====================
export type ConnectionStatusType = 'connected' | 'disconnected' | 'testing' | 'error';

export interface APIConnectionStatus {
  status: ConnectionStatusType;
  lastChecked?: Date;
  latency?: number;
  error?: string;
}

// ==================== 生成参数 ====================
export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  referenceImage?: string;
  referenceImages?: string[];
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  style?: string;
  cfgScale?: number;
  steps?: number;
  seed?: number;
  modelId?: string;
  modelProvider?: string;
  generationMode?: 'text_to_image' | 'image_to_image' | 'reference';
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
}

export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  startImage?: string;
  endImage?: string;
  duration?: number;
  resolution?: string;
  fps?: number;
  modelId?: string;
  modelProvider?: string;
}

export interface GenerationResult {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  resultUrls?: string[];
  progress?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ==================== 请求配置 ====================
export interface RequestConfig {
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  useCache?: boolean;
  taskId?: string;
  traceId?: string;
}

export interface RequestOptions extends RequestInit {
  config?: RequestConfig;
}
