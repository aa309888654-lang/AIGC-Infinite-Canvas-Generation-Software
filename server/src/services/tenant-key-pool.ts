import prisma from '../lib/prisma';
import { smartKeyManager, ProviderKeyWithStats } from './smart-key-manager';
import type { ProviderType } from './smart-router';
import { logger } from '../utils/logger';

export type TenantTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface TenantConfig {
  tenantId: string;
  tier: TenantTier;
  dedicatedKeys: boolean;
  maxConcurrentRequests: number;
  priorityLevel: number;
  allowedProviders: ProviderType[];
  allowedModels: string[];
  dailyRequestLimit: number;
  dailyRequestCount: number;
}

const TIER_CONFIGS: Record<TenantTier, Omit<TenantConfig, 'tenantId' | 'dailyRequestCount'>> = {
  free: {
    tier: 'free',
    dedicatedKeys: false,
    maxConcurrentRequests: 1,
    priorityLevel: 0,
    allowedProviders: ['vidu', 'doubao', 'wuyinkeji', 'agnes'],
    allowedModels: ['viduq2-turbo', 'viduq2', 'viduq3-turbo', 'doubao-seedance-2-0', 'doubao-seedance-2-0-fast', 'Wan2.7_image', 'google_omni', 'veo3.1_fast', 'Wan2.6_video', 'Wan2.7', 'sora2', 'video_vidu', 'video_omni', 'video_seedance', 'Digital_Humans', 'Package_1.0', 'agnes-video-v2.0'],
    dailyRequestLimit: 20,
  },
  basic: {
    tier: 'basic',
    dedicatedKeys: false,
    maxConcurrentRequests: 2,
    priorityLevel: 1,
    allowedProviders: ['vidu', 'doubao', 'wuyinkeji', 'agnes'],
    allowedModels: ['viduq3-turbo', 'viduq3-pro-fast', 'viduq2-pro', 'viduq2-turbo', 'viduq2', 'viduq3-mix', 'doubao-seedance-2-0', 'doubao-seedance-2-0-fast', 'Wan2.7_image', 'google_omni', 'veo3.1_fast', 'Wan2.6_video', 'Wan2.7', 'sora2', 'video_vidu', 'video_omni', 'video_seedance', 'Digital_Humans', 'Package_1.0', 'agnes-video-v2.0'],
    dailyRequestLimit: 20,
  },
  premium: {
    tier: 'premium',
    dedicatedKeys: true,
    maxConcurrentRequests: 5,
    priorityLevel: 2,
    allowedProviders: ['vidu', 'doubao', 'wuyinkeji', 'agnes'],
    allowedModels: ['viduq3-pro', 'viduq3-turbo', 'viduq3-pro-fast', 'viduq3-mix', 'viduq2-pro', 'viduq2-turbo', 'viduq2-pro-fast', 'viduq2', 'doubao-seedance-2-0', 'doubao-seedance-2-0-fast', 'doubao-seedance-1-5-pro', 'Wan2.7_image', 'google_omni', 'veo3.1_fast', 'Wan2.6_video', 'Wan2.7', 'sora2', 'video_vidu', 'video_omni', 'video_seedance', 'Digital_Humans', 'Package_1.0', 'agnes-video-v2.0'],
    dailyRequestLimit: 100,
  },
  enterprise: {
    tier: 'enterprise',
    dedicatedKeys: true,
    maxConcurrentRequests: 10,
    priorityLevel: 3,
    allowedProviders: ['vidu', 'doubao', 'wuyinkeji', 'agnes'],
    allowedModels: [],
    dailyRequestLimit: -1,
  },
};

export class TenantKeyPool {
  private tenantConfigs = new Map<string, TenantConfig>();
  private tenantDedicatedKeys = new Map<string, Map<ProviderType, ProviderKeyWithStats[]>>();
  private activeRequests = new Map<string, number>();

  getTenantConfig(tenantId: string, tier: TenantTier = 'free'): TenantConfig {
    const existingConfig = this.tenantConfigs.get(tenantId);

    if (existingConfig && existingConfig.tier === tier) {
      return existingConfig;
    }

    if (existingConfig) {
      const tierConfig = TIER_CONFIGS[tier];
      const updatedConfig: TenantConfig = {
        ...tierConfig,
        tenantId,
        dailyRequestCount: existingConfig.dailyRequestCount,
      };
      this.tenantConfigs.set(tenantId, updatedConfig);
      return updatedConfig;
    }

    const tierConfig = TIER_CONFIGS[tier];
    const config: TenantConfig = {
      ...tierConfig,
      tenantId,
      dailyRequestCount: 0,
    };
    this.tenantConfigs.set(tenantId, config);
    return config;
  }

  updateTenantTier(tenantId: string, tier: TenantTier): TenantConfig {
    const tierConfig = TIER_CONFIGS[tier];
    const existingConfig = this.tenantConfigs.get(tenantId);

    const config: TenantConfig = {
      ...tierConfig,
      tenantId,
      dailyRequestCount: existingConfig?.dailyRequestCount || 0,
    };

    this.tenantConfigs.set(tenantId, config);

    if (config.dedicatedKeys) {
      this.allocateDedicatedKeys(tenantId, tier);
    }

    logger.info(`[TenantKeyPool] 租户 ${tenantId} 升级到 ${tier} 等级`);
    return config;
  }

  async getKeysForTenant(tenantId: string, provider: ProviderType): Promise<ProviderKeyWithStats[]> {
    const config = this.getTenantConfig(tenantId);

    if (!config.allowedProviders.includes(provider)) {
      logger.warn(`[TenantKeyPool] 租户 ${tenantId} (${config.tier}) 无权访问 ${provider}`);
      return [];
    }

    const dedicatedKeys = this.tenantDedicatedKeys.get(tenantId)?.get(provider);
    if (dedicatedKeys && dedicatedKeys.length > 0) {
      return dedicatedKeys.filter(k => k.isActive && !k.isExhausted);
    }

    return smartKeyManager.getActiveKeys(provider);
  }

  canMakeRequest(tenantId: string, model: string, config?: TenantConfig): { allowed: boolean; reason?: string } {
    const tenantConfig = config || this.getTenantConfig(tenantId);

    if (tenantConfig.dailyRequestLimit > 0 && tenantConfig.dailyRequestCount >= tenantConfig.dailyRequestLimit) {
      return { allowed: false, reason: `已达到每日请求上限 (${tenantConfig.dailyRequestLimit})` };
    }

    const activeCount = this.activeRequests.get(tenantId) || 0;
    if (activeCount >= tenantConfig.maxConcurrentRequests) {
      return { allowed: false, reason: `已达到并发上限 (${tenantConfig.maxConcurrentRequests})` };
    }

    if (tenantConfig.allowedModels.length > 0 && !tenantConfig.allowedModels.includes(model)) {
      return { allowed: false, reason: `模型 ${model} 不在允许列表中` };
    }

    return { allowed: true };
  }

  acquireRequestSlot(tenantId: string): boolean {
    const config = this.getTenantConfig(tenantId);
    const activeCount = this.activeRequests.get(tenantId) || 0;

    if (activeCount >= config.maxConcurrentRequests) {
      return false;
    }

    this.activeRequests.set(tenantId, activeCount + 1);
    config.dailyRequestCount++;
    return true;
  }

  releaseRequestSlot(tenantId: string): void {
    const activeCount = this.activeRequests.get(tenantId) || 0;
    this.activeRequests.set(tenantId, Math.max(0, activeCount - 1));
  }

  private async allocateDedicatedKeys(tenantId: string, tier: TenantTier): Promise<void> {
    const providers: ProviderType[] = TIER_CONFIGS[tier].allowedProviders;
    const tenantKeys = new Map<ProviderType, ProviderKeyWithStats[]>();

    for (const provider of providers) {
      const allKeys = await smartKeyManager.getActiveKeys(provider);
      const keyCount = tier === 'enterprise' ? Math.max(2, Math.floor(allKeys.length / 2)) : 1;
      const dedicatedKeys = allKeys.slice(0, keyCount);

      tenantKeys.set(provider, dedicatedKeys);
    }

    this.tenantDedicatedKeys.set(tenantId, tenantKeys);
    logger.info(`[TenantKeyPool] 为租户 ${tenantId} 分配了独占密钥`);
  }

  resetDailyCounts(): void {
    for (const config of this.tenantConfigs.values()) {
      config.dailyRequestCount = 0;
    }
  }

  getTenantStats(tenantId: string): Record<string, any> | null {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) return null;

    return {
      tenantId: config.tenantId,
      tier: config.tier,
      dailyRequestCount: config.dailyRequestCount,
      dailyRequestLimit: config.dailyRequestLimit,
      activeRequests: this.activeRequests.get(tenantId) || 0,
      maxConcurrentRequests: config.maxConcurrentRequests,
      allowedProviders: config.allowedProviders,
      dedicatedKeys: config.dedicatedKeys,
    };
  }

  getAllTenantStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [tenantId] of this.tenantConfigs) {
      stats[tenantId] = this.getTenantStats(tenantId);
    }
    return stats;
  }
}

export const tenantKeyPool = new TenantKeyPool();
