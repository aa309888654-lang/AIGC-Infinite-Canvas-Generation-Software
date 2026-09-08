/**
 * API控制器类型定义
 * 
 * ⚠️ 已废弃：所有类型定义已迁移到 types/core/index.ts
 * 请使用统一的核心类型定义以避免重复和冲突
 * 
 * @deprecated 请使用 @/types/core 中的类型
 */

// 重新导出统一类型，保持向后兼容
export {
  type UnifiedAPIProvider as APIProvider,
  type UnifiedAPIAuthConfig as APIAuthConfig,
  type UnifiedProviderInfo as ProviderInfo,
  type UnifiedConnectionStatus as ConnectionStatus,
  type UnifiedTaskStatus,
  type UnifiedTask,
  UnifiedAPIError,
  UNIFIED_DEFAULT_AUTH_CONFIG as DEFAULT_AUTH_CONFIG,
  UNIFIED_DEFAULT_PROVIDER_CONFIGS as DEFAULT_PROVIDER_CONFIGS,
  getProviderConfig,
  supportsImageGeneration,
  supportsVideoGeneration,
} from './core';

export type { UnifiedAPIProvider, UnifiedAPIAuthConfig, UnifiedProviderInfo } from './core';
