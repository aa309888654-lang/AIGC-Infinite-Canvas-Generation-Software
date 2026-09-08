/**
 * 适配器工厂
 * 合并 adapter-factory.ts 和具体适配器
 */

import { APIProvider, APIAuthConfig, DEFAULT_PROVIDER_CONFIGS } from '../types';
import { BaseGenerator } from '@/services/adapters/base';
import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';
import { logger } from '@/lib/logger';

// ==================== 适配器缓存 ====================
class AdapterFactory {
  private static instance: AdapterFactory;
  private adapterCache: Map<APIProvider, BaseGenerator> = new Map();

  static getInstance(): AdapterFactory {
    if (!AdapterFactory.instance) {
      AdapterFactory.instance = new AdapterFactory();
    }
    return AdapterFactory.instance;
  }

  /**
   * 创建适配器
   */
  static createAdapter(provider: APIProvider, config: APIAuthConfig): BaseGenerator | null {
    try {
      const providerInfo = DEFAULT_PROVIDER_CONFIGS.find(p => p.id === provider);
      
      if (!providerInfo) {
        logger.error(`[AdapterFactory] 未知的API提供商: ${provider}`);
        return null;
      }

      AdapterFactory.cacheAdapter(provider, backendProxyAdapter as any as BaseGenerator);
      logger.info(`[AdapterFactory] ${provider} 已使用后端托管适配器`, {
        hasBackendManagedConfig: !!config,
      });
      return backendProxyAdapter as any as BaseGenerator;
    } catch (error) {
      logger.error(`[AdapterFactory] 创建适配器失败: ${provider}`, error);
      return null;
    }
  }

  /**
   * 获取缓存的适配器
   */
  static getCachedAdapter(provider: APIProvider): BaseGenerator | null {
    return AdapterFactory.getInstance().adapterCache.get(provider) || null;
  }

  /**
   * 缓存适配器
   */
  static cacheAdapter(provider: APIProvider, adapter: BaseGenerator): void {
    AdapterFactory.getInstance().adapterCache.set(provider, adapter);
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    AdapterFactory.getInstance().adapterCache.clear();
  }

  /**
   * 检查是否支持图片生成
   */
  static supportsImageGeneration(provider: APIProvider): boolean {
    const providerInfo = DEFAULT_PROVIDER_CONFIGS.find(p => p.id === provider);
    return providerInfo?.supportsImageGeneration || false;
  }

  /**
   * 检查是否支持视频生成
   */
  static supportsVideoGeneration(provider: APIProvider): boolean {
    const providerInfo = DEFAULT_PROVIDER_CONFIGS.find(p => p.id === provider);
    return providerInfo?.supportsVideoGeneration || false;
  }
}

// ==================== 导出工厂单例 ====================
export const adapterFactory = AdapterFactory.getInstance();
export { AdapterFactory };
