/**
 * 统一API服务层
 * 整合API配置、请求、适配器工厂、连接管理等功能
 * 
 * 角色：资深技术选型专家 + 开源软件顾问
 * 
 * 新增功能：
 * - OmniRoute 网关集成
 * - 智能路由器
 * - 多提供商故障转移
 */

// 导出配置管理
export { UnifiedAPIConfigStore, useUnifiedAPIConfig } from './config-store';
export type { UnifiedAPIConfig, APIProvider, APIAuthConfig, APIEnvironment } from './types';

// 导出API客户端
export { unifiedAPIClient, requestWithRetry } from './api-client';

// 导出统一服务
export { unifiedAPIService } from './unified-service';

// 导出适配器工厂
export { adapterFactory } from './adapters/factory';
export { AdapterFactory } from './adapters/factory';

// 导出 OmniRoute 适配器
export { 
  OmniRouteAdapter, 
  getOmniRouteAdapter, 
  IMAGE_PROVIDERS, 
  VIDEO_PROVIDERS,
  type ImageProvider,
  type VideoProvider,
  type OmniRouteImageParams,
  type OmniRouteVideoParams,
  type OmniRouteResponse,
  type OmniRouteImageResponse,
  type OmniRouteVideoResponse,
} from './adapters/omniroute-adapter';

// 导出智能路由器
export { 
  SmartRouter, 
  getSmartRouter,
  type ProviderHealth,
  type FailoverStrategy,
  type RouterConfig,
} from './adapters/smart-router';

// 导出连接管理
export { connectionManager } from './connection-manager';
export type { ConnectionStatus } from './types';

// 导出Core SDK
export { CoreAPISDK, sdk } from './adapters/core-sdk';

// 导出类型
export * from './types';
export * from './core/errors';
export * from './core/circuit-breaker';

// 导出增强生成服务
export { enhancedGenerationService, EnhancedGenerationService } from '@/services/enhanced-generation-service';
export type { ProviderPriority } from '@/services/enhanced-generation-service';
