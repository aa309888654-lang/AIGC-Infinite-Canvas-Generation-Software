/**
 * 智能路由器 - ProviderRouter
 * 角色：资深技术选型专家 + 开源软件顾问
 *
 * 核心功能：
 * 1. 自动选择最佳提供商
 * 2. 多层故障转移
 * 3. 负载均衡
 * 4. 成本优化
 */

import { logger } from '@/lib/logger';
import { OmniRouteAdapter, getOmniRouteAdapter, OmniRouteImageParams, OmniRouteVideoParams } from './omniroute-adapter';
import { ImageGenerationParams, VideoGenerationParams, GenerationResult } from '@/types/ai-models';
import { ImageParams, VideoParams } from '@/types/adapter';
import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';
import { APIKeys } from '@/types/ai-models';

// 提供商健康状态
export interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  lastCheck: number;
  latency?: number;
  errorCount: number;
}

// 故障转移策略
export interface FailoverStrategy {
  primaryProvider: string;
  fallbackProviders: string[];
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

// 路由器配置
export interface RouterConfig {
  useOmniRoute: boolean;
  omniRouteUrl?: string;
  enableFailover: boolean;
  enableHealthCheck: boolean;
  healthCheckInterval: number;
  defaultTimeout: number;
}

/**
 * 智能路由器类
 */
export class SmartRouter {
  private static instance: SmartRouter;
  private config: RouterConfig;
  private omniRouteAdapter: OmniRouteAdapter | null = null;
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private apiKeys: APIKeys = {};
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  // 默认配置
  private defaultConfig: RouterConfig = {
    useOmniRoute: false, // 大模型请求统一由后端托管；前端不再直连 OmniRoute
    enableFailover: true, // 默认启用故障转移
    enableHealthCheck: true, // 默认启用健康检查
    healthCheckInterval: 60000, // 每分钟检查一次
    defaultTimeout: 60000, // 默认60秒超时
  };

  private constructor(config?: Partial<RouterConfig>) {
    this.config = { ...this.defaultConfig, ...config };
    this.initializeOmniRoute();
  }

  public static getInstance(config?: Partial<RouterConfig>): SmartRouter {
    if (!SmartRouter.instance) {
      SmartRouter.instance = new SmartRouter(config);
    }
    return SmartRouter.instance;
  }

  /**
   * 初始化 OmniRoute 适配器
   */
  private initializeOmniRoute(): void {
    if (this.config.useOmniRoute) {
      try {
        this.omniRouteAdapter = getOmniRouteAdapter();
        logger.warn('[SmartRouter] 前端 OmniRoute 已禁用，请在后端配置模型路由');

        // 启动健康检查
        if (this.config.enableHealthCheck) {
          this.startHealthCheck();
        }
      } catch (error) {
        logger.error('[SmartRouter] OmniRoute 初始化失败:', error);
        this.config.useOmniRoute = false;
      }
    }
  }

  /**
   * 配置 API Keys
   */
  public setAPIKeys(apiKeys: APIKeys): void {
    this.apiKeys = apiKeys;
    logger.info('[SmartRouter] API Keys 已更新:', Object.keys(apiKeys));
  }

  /**
   * 图像生成 - 带智能路由和故障转移
   */
  public async generateImage(
    params: ImageGenerationParams,
    strategy?: FailoverStrategy
  ): Promise<{
    success: boolean;
    url?: string;
    base64?: string;
    provider?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    const { primaryProvider, fallbackProviders, maxRetries, retryDelay, timeout } = {
      primaryProvider: strategy?.primaryProvider || params.modelProvider || 'doubao',
      fallbackProviders: strategy?.fallbackProviders || [],
      maxRetries: strategy?.maxRetries ?? 2,
      retryDelay: strategy?.retryDelay ?? 1000,
      timeout: strategy?.timeout ?? this.config.defaultTimeout,
    };

    logger.info('[SmartRouter] 图像生成请求:', {
      primaryProvider,
      fallbackProviders,
      hasReference: !!params.referenceImage,
      generationMode: params.generationMode,
      promptLength: params.prompt?.length,
    });

    const result = await this.generateWithOriginalAdapter(primaryProvider, params, timeout);
    const totalTime = Date.now() - startTime;
    logger.info('[SmartRouter] 后端托管图像生成结束', { provider: primaryProvider, totalTime, success: result.success });
    return result.success ? { ...result, provider: primaryProvider } : result;
  }

  /**
   * 视频生成 - 带智能路由和故障转移
   */
  public async generateVideo(
    params: VideoGenerationParams,
    strategy?: FailoverStrategy
  ): Promise<{
    success: boolean;
    url?: string;
    taskId?: string;
    provider?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    const { primaryProvider, fallbackProviders, maxRetries, retryDelay, timeout } = {
      primaryProvider: strategy?.primaryProvider || params.modelProvider || 'vidu',
      fallbackProviders: strategy?.fallbackProviders || [],
      maxRetries: strategy?.maxRetries ?? 2,
      retryDelay: strategy?.retryDelay ?? 1000,
      timeout: strategy?.timeout ?? this.config.defaultTimeout * 2, // 视频生成超时更长
    };

    logger.info('[SmartRouter] 视频生成请求:', {
      primaryProvider,
      fallbackProviders,
      hasStartImage: !!params.startImage,
      promptLength: params.prompt?.length,
    });

    const result = await this.generateVideoWithOriginalAdapter(primaryProvider, params, timeout);
    const totalTime = Date.now() - startTime;
    logger.info('[SmartRouter] 后端托管视频生成结束', { provider: primaryProvider, totalTime, success: result.success });
    return result.success ? { ...result, provider: primaryProvider } : result;
  }

  /**
   * 尝试使用 OmniRoute 生成图像
   */
  private async tryOmniRouteImage(
    params: ImageGenerationParams,
    provider: string
  ): Promise<{
    success: boolean;
    url?: string;
    base64?: string;
    provider?: string;
    error?: string;
  }> {
    if (!this.omniRouteAdapter) {
      return { success: false, error: 'OmniRoute 未初始化' };
    }

    try {
      // 如果没有宽高，根据 aspectRatio 映射默认宽高
      let width = params.width;
      let height = params.height;

      if (!width || !height) {
        const ratioMap: Record<string, { w: number; h: number }> = {
          '1:1': { w: 1024, h: 1024 },
          '16:9': { w: 1280, h: 720 },
          '9:16': { w: 720, h: 1280 },
          '4:3': { w: 1024, h: 768 },
          '3:4': { w: 768, h: 1024 },
        };
        const dims = ratioMap[params.aspectRatio as string] || ratioMap['1:1'];
        width = dims.w;
        height = dims.h;
      }

      const omniParams: OmniRouteImageParams = {
        provider: provider as OmniRouteImageParams['provider'],
        model: params.modelId || this.getDefaultModelForProvider(provider, 'image'),
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width,
        height,
        cfgScale: params.cfgScale,
        steps: params.steps,
        seed: params.seed,
        style: params.style,
        referenceImage: params.referenceImage || params.referenceImages?.[0],
        strength: params.strength || 0.7,
      };

      const result = await this.omniRouteAdapter.generateImage(omniParams);

      if (result.success && result.data?.url) {
        return {
          success: true,
          url: result.data.url,
          base64: result.data.base64,
          provider: `omniroute-${provider}`,
        };
      }

      return {
        success: false,
        error: result.error?.message || 'OmniRoute 生成失败',
      };
    } catch (error: unknown) {
      logger.error('[SmartRouter] OmniRoute 图像生成异常:', error);
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * 尝试使用 OmniRoute 生成视频
   */
  private async tryOmniRouteVideo(
    params: VideoGenerationParams,
    provider: string
  ): Promise<{
    success: boolean;
    url?: string;
    taskId?: string;
    provider?: string;
    error?: string;
  }> {
    if (!this.omniRouteAdapter) {
      return { success: false, error: 'OmniRoute 未初始化' };
    }

    try {
      const omniParams: OmniRouteVideoParams = {
        provider: provider as OmniRouteVideoParams['provider'],
        model: params.modelId || this.getDefaultModelForProvider(provider, 'video'),
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        duration: params.duration,
        fps: params.fps,
        resolution: params.resolution,
        referenceImage: params.startImage,
      };

      const result = await this.omniRouteAdapter.generateVideo(omniParams);

      if (result.success && result.data?.url) {
        return {
          success: true,
          url: result.data.url,
          provider: `omniroute-${provider}`,
        };
      }

      return {
        success: false,
        error: result.error?.message || 'OmniRoute 视频生成失败',
      };
    } catch (error: unknown) {
      logger.error('[SmartRouter] OmniRoute 视频生成异常:', error);
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * 使用原始适配器生成图像
   */
  private async generateWithOriginalAdapter(
    provider: string,
    params: ImageGenerationParams,
    timeout: number
  ): Promise<{ success: boolean; url?: string; base64?: string; error?: string }> {
    try {
      // 构建参数
      const generatorParams = {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        steps: params.steps,
        cfgScale: params.cfgScale,
        seed: params.seed,
        style: params.style,
        modelId: params.modelId,
        referenceImage: params.referenceImage || params.referenceImages?.[0],
        generationMode: params.generationMode,
      } as any as ImageParams;

      // 执行生成 - 图片
      const result = (await Promise.race([
        backendProxyAdapter.generateImage({
          ...generatorParams,
          modelProvider: provider,
          modelId: params.modelId,
        } as any),
        this.timeoutPromise(timeout),
      ])) as GenerationResult;

      const resultRecord = result as any as Record<string, unknown>;
      const imageUrl = (typeof resultRecord.imageUrl === 'string' ? resultRecord.imageUrl : undefined)
        || result.resultUrl
        || (typeof resultRecord.url === 'string' ? resultRecord.url : undefined);
      if (imageUrl) {
        this.updateProviderHealth(provider, true);
        return {
          success: true,
          url: imageUrl,
          base64: typeof resultRecord.base64 === 'string' ? resultRecord.base64 : undefined,
        };
      }

      return {
        success: false,
        error: result.error || '生成器返回无效结果',
      };
    } catch (error: unknown) {
      logger.error(`[SmartRouter] 原始适配器 ${provider} 异常:`, error);
      this.updateProviderHealth(provider, false);

      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * 使用原始适配器生成视频
   */
  private async generateVideoWithOriginalAdapter(
    provider: string,
    params: VideoGenerationParams,
    timeout: number
  ): Promise<{ success: boolean; url?: string; taskId?: string; error?: string }> {
    try {
      const generatorParams: VideoParams = {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        startImage: params.startImage,
        endImage: params.endImage,
        duration: params.duration,
        fps: params.fps,
        resolution: params.resolution,
        modelId: params.modelId,
      };

      const result = (await Promise.race([
        backendProxyAdapter.generateVideo({
          ...generatorParams,
          modelProvider: provider,
          modelId: params.modelId,
        } as any),
        this.timeoutPromise(timeout),
      ])) as GenerationResult;

      const resultRecord = result as any as Record<string, unknown>;
      const videoUrl = (typeof resultRecord.videoUrl === 'string' ? resultRecord.videoUrl : undefined)
        || result.resultUrl
        || (typeof resultRecord.url === 'string' ? resultRecord.url : undefined);
      const taskId = result.taskId || (typeof resultRecord.taskId === 'string' ? resultRecord.taskId : undefined);
      if (videoUrl || taskId) {
        this.updateProviderHealth(provider, true);
        return {
          success: true,
          url: videoUrl,
          taskId,
        };
      }

      return {
        success: false,
        error: result.error || '视频生成器返回无效结果',
      };
    } catch (error: unknown) {
      logger.error(`[SmartRouter] 原始视频适配器 ${provider} 异常:`, error);
      this.updateProviderHealth(provider, false);

      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * 获取提供商的默认模型
   */
  private getDefaultModelForProvider(provider: string, type: 'image' | 'video'): string {
    const modelMap: Record<string, Record<string, string>> = {
      image: {
        doubao: 'doubao-seedream-5-0-pro',
        minimax: 'image-01',
        fireworks: 'sd15',
        together: 'stabilityai/stable-diffusion-xl-base-1.0',
      },
      video: {
        minimax: 'video-01',
        runway: 'gen3a_turbo',
        pika: 'pika-1.5',
      },
    };

    return modelMap[type]?.[provider] || (type === 'image' ? 'image-01' : 'video-01');
  }

  /**
   * 更新提供商健康状态
   */
  private updateProviderHealth(provider: string, isHealthy: boolean): void {
    const current = this.providerHealth.get(provider) || {
      provider,
      isHealthy: true,
      lastCheck: Date.now(),
      errorCount: 0,
    };

    if (isHealthy) {
      current.errorCount = 0;
      current.isHealthy = true;
    } else {
      current.errorCount++;
      if (current.errorCount >= 3) {
        current.isHealthy = false;
      }
    }

    current.lastCheck = Date.now();
    this.providerHealth.set(provider, current);

    logger.info(`[SmartRouter] 提供商健康状态更新: ${provider}`, current);
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (!this.config.enableHealthCheck || !this.omniRouteAdapter) {
      return;
    }

    this.healthCheckTimer = window.setInterval(async () => {
      if (!this.config.enableHealthCheck || !this.omniRouteAdapter) {
        return;
      }

      const omniHealthy = await this.omniRouteAdapter.healthCheck();
      this.providerHealth.set('omniroute', {
        provider: 'omniroute',
        isHealthy: omniHealthy,
        lastCheck: Date.now(),
        errorCount: omniHealthy ? 0 : 1,
      });
    }, this.config.healthCheckInterval) as any as ReturnType<typeof setInterval>;
  }

  /**
   * 获取健康状态
   */
  public getHealthStatus(): ProviderHealth[] {
    return Array.from(this.providerHealth.values());
  }

  /**
   * 获取健康的提供商
   */
  public getHealthyProviders(type: 'image' | 'video'): string[] {
    return Array.from(this.providerHealth.entries())
      .filter(([_, health]) => health.isHealthy)
      .map(([name]) => name);
  }

  /**
   * 延迟工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 超时Promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`请求超时 (${ms}ms)`)), ms);
    });
  }

  /**
   * 销毁路由器
   */
  public destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    SmartRouter.instance = null;
  }
}

// 导出单例获取函数
export function getSmartRouter(config?: Partial<RouterConfig>): SmartRouter {
  return SmartRouter.getInstance(config);
}

export default SmartRouter;
