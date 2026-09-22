import { smartKeyManager, ProviderKeyWithStats } from './smart-key-manager';
import { errorClassifier, ErrorCategory, RecoveryAction } from './error-classifier';
import { fallbackChain } from './fallback-chain';
import { creditManager } from './credit-manager';
import { modelSelector } from './model-selector';
import { costOptimizer, type UserTier } from './cost-optimizer';
import { tenantKeyPool, type TenantTier } from './tenant-key-pool';
import { realtimeMonitor } from './realtime-monitor';
import { ViduProvider } from './vidu-provider';
import { DoubaoProvider } from './doubao-provider';
import { MinimaxProvider } from './minimax-provider';
import { WuyinkejiProvider } from './wuyinkeji-provider';
import type { VideoParams as VideoGenerationParams, GenerationResult as VideoGenerationResult } from '../types/api';
import type { ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';

export type ProviderType = 'vidu' | 'doubao' | 'minimax' | 'wuyinkeji';

export interface RouteResult {
  success: boolean;
  result?: VideoGenerationResult;
  error?: string;
  providerUsed?: string;
  keyUsed?: string;
  keyIdUsed?: string;
  responseTime?: number;
  fallbackChain?: string[];
  errorCategory?: ErrorCategory;
  creditStatus?: Record<ProviderType, { isLow: boolean; isExhausted: boolean }>;
  costOptimization?: { strategy: string; estimatedCost: number };
  tenantInfo?: { tier: TenantTier; allowed: boolean };
}

interface RouteAttempt {
  provider: ProviderType;
  key: ProviderKeyWithStats;
  model: string;
  error?: string;
  errorCategory?: ErrorCategory;
  responseTime?: number;
}

export interface SmartRouteOptions {
  userId?: string;
  userTier?: UserTier;
  costOptimization?: boolean;
  maxBudget?: number;
  autoSelectModel?: boolean;
}

const DISABLED_HAILUO_VIDEO_MODELS = new Set([
  'hailuo-video-2.3',
  'hailuo-2.3-fast-768p-6s',
  'hailuo-2.3-768p-6s',
  'minimax-hailuo-2.3',
  'minimax-hailuo-2.3-fast',
]);

function isDisabledHailuoVideoRoute(provider?: unknown, model?: unknown): boolean {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedModel = String(model || '').trim().toLowerCase();
  return (
    normalizedProvider === 'hailuo' ||
    (normalizedProvider === 'minimax' && normalizedModel.includes('hailuo')) ||
    DISABLED_HAILUO_VIDEO_MODELS.has(normalizedModel) ||
    normalizedModel.startsWith('hailuo-')
  );
}

export class SmartRouter {
  private providers: Record<ProviderType, any> = {
    vidu: ViduProvider,
    doubao: DoubaoProvider,
    minimax: MinimaxProvider,
    wuyinkeji: WuyinkejiProvider,
  };

  private readonly MAX_FALLBACK_DEPTH = 3;
  private readonly FALLBACK_PROVIDER_ORDER: ProviderType[] = ['wuyinkeji', 'vidu', 'doubao', 'minimax'];

  async routeVideoGeneration(
    params: VideoGenerationParams,
    providerType?: ProviderType,
    options?: SmartRouteOptions
  ): Promise<RouteResult> {
    const startTime = Date.now();
    const attempts: RouteAttempt[] = [];
    const visitedProviders = new Set<ProviderType>();

    let currentProvider = providerType || params.provider as ProviderType || 'wuyinkeji';
    let currentModel = params.model || 'Wan2.7';
    if (isDisabledHailuoVideoRoute(currentProvider, currentModel)) {
      return {
        success: false,
        error: '海螺视频模型当前不可用，请选择当前可用的视频模型',
        providerUsed: currentProvider,
        errorCategory: ErrorCategory.INVALID_REQUEST,
      };
    }

    logger.info(`[SmartRouter] 开始路由: provider=${currentProvider}, model=${currentModel}, user=${options?.userId || 'anonymous'}`);

    const creditStatuses = await creditManager.getAllCreditStatuses();
    const creditSnapshot: Record<string, { isLow: boolean; isExhausted: boolean }> = {};
    for (const [p, s] of Object.entries(creditStatuses)) {
      creditSnapshot[p] = { isLow: s.isLow, isExhausted: s.isExhausted };
    }

    if (options?.userId) {
      const tier = (options.userTier || 'free') as TenantTier;
      const config = tenantKeyPool.getTenantConfig(options.userId, tier);
      const canRequest = tenantKeyPool.canMakeRequest(options.userId, currentModel, config);

      if (!canRequest.allowed) {
        logger.warn(`[SmartRouter] 租户 ${options.userId} 请求被拒绝: ${canRequest.reason}`);
        return {
          success: false,
          error: canRequest.reason,
          tenantInfo: { tier: config.tier, allowed: false },
          creditStatus: creditSnapshot as any,
        };
      }

      if (!config.allowedProviders.includes(currentProvider)) {
        logger.info(`[SmartRouter] 租户 ${options.userId} 无权使用 ${currentProvider}，自动选择可用provider`);
        const allowedProvider = config.allowedProviders.find(p => creditStatuses[p] && !creditStatuses[p].isExhausted);
        if (allowedProvider) {
          currentProvider = allowedProvider;
        } else {
          return {
            success: false,
            error: 'No available provider for your tier',
            tenantInfo: { tier: config.tier, allowed: false },
            creditStatus: creditSnapshot as any,
          };
        }
      }
    }

    if (options?.autoSelectModel || options?.costOptimization) {
      const selection = await costOptimizer.optimize({
        prompt: params.prompt,
        duration: params.duration || 5,
        quality: undefined,
        maxBudget: options.maxBudget,
        userId: options.userId,
        userTier: options.userTier,
        requireImageToVideo: !!params.imageUrl,
        requireReference: !!(params.referenceImages && params.referenceImages.length > 0),
      });

      if (selection) {
        currentProvider = selection.provider;
        currentModel = selection.model;
        logger.info(`[SmartRouter] 智能选择: ${selection.provider}/${selection.model}, 策略: ${selection.reason}, 预估成本: ${selection.estimatedCost}`);
      }
    }

    if (!currentProvider || creditStatuses[currentProvider]?.isExhausted) {
      const providerWithCredit = await creditManager.findProviderWithCredit(currentModel, params.duration || 5);
      if (providerWithCredit) {
        logger.info(`[SmartRouter] 初始provider ${currentProvider} 积分不足，切换到 ${providerWithCredit}`);
        currentProvider = providerWithCredit;
      }
    }

    if (options?.userId) {
      tenantKeyPool.acquireRequestSlot(options.userId);
    }

    try {
      for (let depth = 0; depth < this.MAX_FALLBACK_DEPTH; depth++) {
        if (visitedProviders.has(currentProvider)) {
          const nextProvider = await this.findUnvisitedProvider(currentProvider, visitedProviders, currentModel);
          if (!nextProvider) break;
          currentProvider = nextProvider;
        }

        visitedProviders.add(currentProvider);

        const equivalentModel = fallbackChain.getEquivalentModel(currentProvider, currentModel);
        if (equivalentModel) {
          logger.info(`[SmartRouter] 模型映射: ${currentModel} → ${equivalentModel} (provider: ${currentProvider})`);
          currentModel = equivalentModel;
        }

        const result = await this.tryProvider(
          { ...params, model: currentModel, provider: currentProvider },
          currentProvider,
          options?.userId
        );

        if (result.success) {
          creditManager.recordConsumption(currentProvider, creditManager.estimateCost(currentProvider, currentModel, params.duration || 5));

          if (options?.userId) {
            const cost = creditManager.estimateCost(currentProvider, currentModel, params.duration || 5);
            costOptimizer.recordUserSpending(options.userId, cost);
          }

          const chain = attempts.map(a => `${a.provider}(${a.key?.keyLabel || '?'})`).concat(`${currentProvider}(success)`);

          realtimeMonitor.recordRequest({
            provider: currentProvider,
            success: true,
            responseTime: Date.now() - startTime,
            keyLabel: result.keyUsed,
            model: currentModel,
          });

          logger.info(`[SmartRouter] 路由成功: provider=${currentProvider}, key=${result.keyUsed}, 耗时=${Date.now() - startTime}ms`);

          return {
            ...result,
            fallbackChain: chain,
            creditStatus: creditSnapshot as any,
          };
        }

        attempts.push({
          provider: currentProvider,
          key: result.keyUsed as any,
          model: currentModel,
          error: result.error,
          errorCategory: result.errorCategory,
          responseTime: result.responseTime,
        });

        realtimeMonitor.recordRequest({
          provider: currentProvider,
          success: false,
          responseTime: Date.now() - startTime,
          error: result.error,
          keyLabel: result.keyUsed,
          model: currentModel,
        });

        const classification = errorClassifier.classify(result.error || 'unknown');

        if (classification.action === RecoveryAction.ABORT) {
          logger.warn(`[SmartRouter] 不可恢复错误，终止路由: ${classification.description}`);
          break;
        }

        if (classification.shouldSwitchProvider) {
          const fallback = await fallbackChain.findNextProvider(currentProvider, result.error || '', currentModel);
          if (fallback) {
            logger.info(`[SmartRouter] 跨Provider Fallback: ${currentProvider} → ${fallback.provider}, 原因: ${fallback.reason}`);
            realtimeMonitor.recordFallbackEvent(currentProvider, fallback.provider, fallback.reason);
            currentProvider = fallback.provider;
            currentModel = params.model || currentModel;
            continue;
          }
        }

        break;
      }
    } finally {
      if (options?.userId) {
        tenantKeyPool.releaseRequestSlot(options.userId);
      }
    }

    const chain = attempts.map(a => `${a.provider}(${a.errorCategory || 'failed'})`);
    const lastError = attempts[attempts.length - 1];

    logger.warn(`[SmartRouter] 路由失败: 尝试了 ${attempts.length} 次, 链路=${chain.join(' → ')}`);

    return {
      success: false,
      error: lastError?.error || 'All providers exhausted',
      providerUsed: lastError?.provider,
      keyUsed: lastError?.key?.keyLabel,
      responseTime: Date.now() - startTime,
      fallbackChain: chain,
      errorCategory: lastError?.errorCategory,
      creditStatus: creditSnapshot as any,
    };
  }

  private async tryProvider(
    params: VideoGenerationParams,
    providerType: ProviderType,
    userId?: string
  ): Promise<RouteResult> {
    let keys: ProviderKeyWithStats[];

    if (userId) {
      keys = await tenantKeyPool.getKeysForTenant(userId, providerType);
    } else {
      keys = await smartKeyManager.getActiveKeys(providerType);
    }

    if (keys.length === 0) {
      return {
        success: false,
        error: `No active keys for provider ${providerType}`,
        providerUsed: providerType,
        errorCategory: ErrorCategory.CREDIT_INSUFFICIENT,
      };
    }

    for (const key of keys) {
      const keyStartTime = Date.now();

      try {
        const result = await this.tryGenerateVideo(params, providerType, key);
        const responseTime = Date.now() - keyStartTime;

        await smartKeyManager.recordKeyUsage(key.id, true, responseTime);

        return {
          success: true,
          result,
          providerUsed: providerType,
          keyUsed: key.keyLabel,
          keyIdUsed: key.id,
          responseTime,
        };
      } catch (error) {
        const responseTime = Date.now() - keyStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const classification = errorClassifier.classify(errorMessage);

        await smartKeyManager.recordKeyUsage(key.id, false, responseTime, errorMessage);

        logger.warn(`[SmartRouter] 密钥 ${key.keyLabel} 失败: ${classification.description} (${errorMessage.substring(0, 100)})`);

        if (classification.shouldMarkExhausted) {
          await smartKeyManager.markKeyExhausted(key.id);
          logger.info(`[SmartRouter] 密钥 ${key.keyLabel} 已标记为耗尽: ${classification.description}`);
        }

        if (classification.shouldSwitchKey) {
          continue;
        }

        if (classification.shouldSwitchProvider) {
          return {
            success: false,
            error: errorMessage,
            providerUsed: providerType,
            keyUsed: key.keyLabel,
            keyIdUsed: key.id,
            responseTime,
            errorCategory: classification.category,
          };
        }

        return {
          success: false,
          error: errorMessage,
          providerUsed: providerType,
          keyUsed: key.keyLabel,
          keyIdUsed: key.id,
          responseTime,
          errorCategory: classification.category,
        };
      }
    }

    return {
      success: false,
      error: `All ${keys.length} keys failed for provider ${providerType}`,
      providerUsed: providerType,
      errorCategory: ErrorCategory.CREDIT_INSUFFICIENT,
    };
  }

  private async tryGenerateVideo(
    params: VideoGenerationParams,
    providerType: ProviderType,
    key: ProviderKeyWithStats
  ): Promise<VideoGenerationResult> {
    const ProviderClass = this.providers[providerType];
    if (!ProviderClass) {
      throw new Error(`Unknown provider type: ${providerType}`);
    }

    const provider = new ProviderClass();
    const config: ApiProviderConfig = {
      apiKey: key.apiKey,
      endpoint: undefined
    };

    return await provider.generateVideo(params, config);
  }

  private async findUnvisitedProvider(
    currentProvider: ProviderType,
    visited: Set<ProviderType>,
    model: string
  ): Promise<ProviderType | null> {
    for (const provider of this.FALLBACK_PROVIDER_ORDER) {
      if (visited.has(provider)) continue;
      if (provider === currentProvider) continue;

      const keys = await smartKeyManager.getActiveKeys(provider);
      if (keys.length === 0) continue;

      return provider;
    }

    return null;
  }

  async getProviderStats(providerType?: ProviderType): Promise<Record<string, any>> {
    return smartKeyManager.getAllStats(providerType);
  }

  async getBestKey(providerType: ProviderType): Promise<ProviderKeyWithStats | null> {
    return smartKeyManager.getBestKey(providerType);
  }

  async resetAllExhaustedKeys(): Promise<void> {
    await smartKeyManager.resetExhaustedKeys('vidu');
    await smartKeyManager.resetExhaustedKeys('doubao');
    await smartKeyManager.resetExhaustedKeys('minimax');
    fallbackChain.clearAllCooldowns();
  }

  async getFullStatus(): Promise<Record<string, any>> {
    const creditStatuses = await creditManager.getAllCreditStatuses();
    const providerStatus = fallbackChain.getProviderStatus();
    const keyStats = smartKeyManager.getAllStats();
    const systemMetrics = await realtimeMonitor.getSystemMetrics();

    return {
      credits: creditStatuses,
      providers: providerStatus,
      keys: keyStats,
      consumption: creditManager.getConsumptionHistory(),
      metrics: systemMetrics,
      alerts: realtimeMonitor.getAlerts(),
      strategies: costOptimizer.getStrategyInfo(),
      tiers: costOptimizer.getTierDefaults(),
    };
  }
}

export const smartRouter = new SmartRouter();
