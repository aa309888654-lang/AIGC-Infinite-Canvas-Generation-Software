/**
 * 增强生成服务
 * 角色：资深技术选型专家 + 开源软件顾问
 * 
 * 集成 OmniRoute 网关 + 智能路由器
 * 支持多提供商故障转移和自动选择
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/lib/logger';
import { ImageGenerationParams, VideoGenerationParams } from '@/types/ai-models';
import { backendProxyAdapter } from './adapters/backend-proxy-adapter';
import { getAuthToken } from '@/lib/auth-check';

// 提供商优先级配置
export interface ProviderPriority {
  image: {
    primary: string[];
    secondary: string[];
    fallback: string[];
  };
  video: {
    primary: string[];
    secondary: string[];
    fallback: string[];
  };
}

// 默认提供商优先级
const DEFAULT_PRIORITY: ProviderPriority = {
  image: {
    primary: ['doubao', 'minimax'],           // 国内首选
    secondary: ['stability', 'fireworks'],    // 国际主流
    fallback: ['openai', 'ideogram'],         // 备选
  },
  video: {
    primary: ['doubao', 'vidu'],              // 国内视频首选
    secondary: ['runway', 'pika'],           // 国际视频
    fallback: ['minimax', 'luma'],           // 备选
  },
};

/**
 * 增强生成服务
 */
export class EnhancedGenerationService {
  private static instance: EnhancedGenerationService;
  private providerPriority: ProviderPriority;

  private constructor() {
    this.providerPriority = DEFAULT_PRIORITY;
    logger.info('[EnhancedGenerationService] 增强生成服务已初始化（后端代理模式）');
  }

  public static getInstance(): EnhancedGenerationService {
    if (!EnhancedGenerationService.instance) {
      EnhancedGenerationService.instance = new EnhancedGenerationService();
    }
    return EnhancedGenerationService.instance;
  }

  /**
   * 配置提供商优先级
   */
  public setProviderPriority(priority: ProviderPriority): void {
    this.providerPriority = priority;
    logger.info('[EnhancedGenerationService] 提供商优先级已更新:', priority);
  }

  /**
   * 图像生成 - 智能路由版本
   * 
   * @param params 图像生成参数
   * @param preferredProvider 首选提供商
   * @returns 生成结果
   */
  public async generateImage(
    params: ImageGenerationParams,
    preferredProvider?: string
  ): Promise<{
    success: boolean;
    url?: string;
    base64?: string;
    provider?: string;
    error?: string;
    metadata?: Record<string, any>;
  }> {
    const startTime = Date.now();

    logger.info('[EnhancedGenerationService] 🚀 开始图像生成（后端代理）:', {
      provider: preferredProvider || params.modelProvider || 'default',
      generationMode: params.generationMode,
      hasReference: !!(params.referenceImage || params.referenceImages?.length),
    });

    try {
      const token = getAuthToken();
      if (token) backendProxyAdapter.setToken(token);

      const result = await backendProxyAdapter.generateImage({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        aspectRatio: params.aspectRatio,
        style: params.style,
        referenceImage: params.referenceImage,
        referenceImages: params.referenceImages,
        generationMode: params.generationMode,
        modelProvider: preferredProvider || params.modelProvider,
        modelId: params.modelId,
      } as any);

      const generationTime = Date.now() - startTime;

      if (result.success || result.status === 'completed') {
        logger.info('[EnhancedGenerationService] ✅ 图像生成成功!', {
          generationTime,
        });

        return {
          success: true,
          url: result.resultUrl || result.output,
          base64: (result as any).base64,
          provider: preferredProvider || params.modelProvider,
          metadata: { generationTime, generationMode: params.generationMode },
        };
      }

      logger.error('[EnhancedGenerationService] ❌ 图像生成失败:', {
        error: result.error,
        generationTime,
      });

      return {
        success: false,
        error: result.error || 'Image generation failed',
        metadata: { generationTime },
      };
    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      logger.error('[EnhancedGenerationService] 💥 图像生成异常:', {
        error: (error instanceof Error ? error.message : String(error)),
        generationTime,
      });

      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        metadata: { generationTime, errorType: error.name },
      };
    }
  }

  /**
   * 视频生成 - 智能路由版本
   */
  public async generateVideo(
    params: VideoGenerationParams,
    preferredProvider?: string
  ): Promise<{
    success: boolean;
    url?: string;
    taskId?: string;
    provider?: string;
    error?: string;
    metadata?: Record<string, any>;
  }> {
    const startTime = Date.now();

    logger.info('[EnhancedGenerationService] 🎬 开始视频生成（后端代理）:', {
      provider: preferredProvider || params.modelProvider || 'default',
      duration: params.duration,
      hasStartImage: !!params.startImage,
    });

    try {
      const token = getAuthToken();
      if (token) backendProxyAdapter.setToken(token);

      const result = await backendProxyAdapter.generateVideo({
        prompt: params.prompt,
        duration: params.duration,
        resolution: params.resolution,
        startImage: params.startImage,
        endImage: params.endImage,
        referenceImage: params.referenceImage,
        referenceImages: params.referenceImages,
        generationMode: params.generationMode,
        modelProvider: preferredProvider || params.modelProvider,
        modelId: params.modelId,
      } as any);

      const generationTime = Date.now() - startTime;

      if (result.success || result.status === 'pending' || result.status === 'processing') {
        logger.info('[EnhancedGenerationService] ✅ 视频任务已提交!', {
          taskId: result.taskId,
          generationTime,
        });

        return {
          success: true,
          url: result.resultUrl || result.output,
          taskId: result.taskId,
          provider: preferredProvider || params.modelProvider,
          metadata: { generationTime, duration: params.duration },
        };
      }

      logger.error('[EnhancedGenerationService] ❌ 视频生成失败:', {
        error: result.error,
        generationTime,
      });

      return {
        success: false,
        error: result.error || 'Video generation failed',
        metadata: { generationTime },
      };
    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      logger.error('[EnhancedGenerationService] 💥 视频生成异常:', {
        error: (error instanceof Error ? error.message : String(error)),
        generationTime,
      });

      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        metadata: { generationTime, errorType: error.name },
      };
    }
  }

  /**
   * 构建图像生成策略
   */
  public getProviderHealth(): Array<{
    provider: string;
    isHealthy: boolean;
    errorCount: number;
  }> {
    return [
      { provider: 'backend-proxy', isHealthy: true, errorCount: 0 },
    ];
  }

  public getRecommendedImageProvider(): string {
    return this.providerPriority.image.primary[0];
  }

  public getRecommendedVideoProvider(): string {
    return this.providerPriority.video.primary[0];
  }
}

// 导出单例
export const enhancedGenerationService = EnhancedGenerationService.getInstance();

export default EnhancedGenerationService;
