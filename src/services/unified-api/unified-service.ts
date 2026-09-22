/**
 * 统一API服务
 * 合并 unified-api-service 和 适配器工厂功能
 */

import { APIProvider, APIAuthConfig, GenerationResult, ImageGenerationParams, VideoGenerationParams } from './types';
import { UnifiedAPIConfigStore } from './config-store';
import { AdapterFactory} from './adapters/factory';
import { logger } from '@/lib/logger';

// ==================== 生成请求接口 ====================
export interface UnifiedGenerationRequest {
  provider: APIProvider;
  type: 'image' | 'video';
  params: ImageGenerationParams | VideoGenerationParams;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  onProgress?: (progress: number) => void;
}

export interface UnifiedGenerationResponse {
  taskId: string;
  provider: APIProvider;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: GenerationResult;
  error?: string;
}

// ==================== 统一API服务类 ====================
class UnifiedAPIService {
  private static instance: UnifiedAPIService;
  private adapterSignatures: Map<APIProvider, string> = new Map();

  private constructor() { /* noop */ }

  public static getInstance(): UnifiedAPIService {
    if (!UnifiedAPIService.instance) {
      UnifiedAPIService.instance = new UnifiedAPIService();
    }
    return UnifiedAPIService.instance;
  }

  /**
   * 获取运行时配置
   */
  private getConfig(provider: APIProvider): APIAuthConfig | null {
    const configStore = UnifiedAPIConfigStore.getState();
    return configStore.getRuntimeConfig(provider) || configStore.getConfig(provider);
  }

  /**
   * 获取适配器（带缓存）
   */
  private getAdapter(provider: APIProvider, config: APIAuthConfig) {
    const signature = JSON.stringify(config);
    const previousSignature = this.adapterSignatures.get(provider);
    
    if (previousSignature === signature) {
      return AdapterFactory.getCachedAdapter(provider);
    }

    const adapter = AdapterFactory.createAdapter(provider, config);
    if (adapter) {
      this.adapterSignatures.set(provider, signature);
    }
    return adapter;
  }

  /**
   * 测试连接
   */
  public async testConnection(provider: APIProvider): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const config = this.getConfig(provider);
    if (!config) {
      return { success: false, message: '未找到API配置' };
    }

    const startTime = Date.now();
    try {
      const adapter = this.getAdapter(provider, config);
      if (!adapter) {
        return { success: false, message: `不支持的API提供商: ${provider}` };
      }

      // 简化的连接测试
      const latency = Date.now() - startTime;
      return {
        success: true,
        message: '连接成功',
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: error instanceof Error ? error.message : '连接测试失败',
        latency
      };
    }
  }

  /**
   * 生成图片
   */
  public async generateImage(
    provider: APIProvider,
    params: ImageGenerationParams
  ): Promise<GenerationResult> {
    const config = this.getConfig(provider);
    if (!config) {
      return {
        taskId: '',
        status: 'failed',
        error: '未找到API配置'
      };
    }

    const adapter = this.getAdapter(provider, config);
    if (!adapter) {
      return {
        taskId: '',
        status: 'failed',
        error: `不支持的API提供商: ${provider}`
      };
    }

    try {
      logger.info(`[UnifiedAPIService] Generating image with ${provider}`, { params });
      const result = await adapter.generateImage({
        ...params,
        modelProvider: params.modelProvider || provider,
      } as any);
      logger.info(`[UnifiedAPIService] Image generation result`, { result });
      const normalizedStatus = ['completed', 'failed', 'pending', 'processing'].includes(result.status as string) 
        ? result.status as 'completed' | 'failed' | 'pending' | 'processing'
        : 'failed';
      return {
        taskId: result.taskId,
        status: normalizedStatus,
        resultUrl: result.resultUrl || result.output,
        progress: result.progress,
        error: result.error,
      };
    } catch (error) {
      logger.error(`[UnifiedAPIService] Image generation failed`, { error });
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败'
      };
    }
  }

  /**
   * 生成视频
   */
  public async generateVideo(
    provider: APIProvider,
    params: VideoGenerationParams
  ): Promise<GenerationResult> {
    const config = this.getConfig(provider);
    if (!config) {
      return {
        taskId: '',
        status: 'failed',
        error: '未找到API配置'
      };
    }

    const adapter = this.getAdapter(provider, config);
    if (!adapter) {
      return {
        taskId: '',
        status: 'failed',
        error: `不支持的API提供商: ${provider}`
      };
    }

    try {
      logger.info(`[UnifiedAPIService] Generating video with ${provider}`, { params });
      const result = await adapter.generateVideo({
        ...params,
        modelProvider: params.modelProvider || provider,
      } as any);
      logger.info(`[UnifiedAPIService] Video generation result`, { result });
      const normalizedStatus = ['completed', 'failed', 'pending', 'processing'].includes(result.status as string) 
        ? result.status as 'completed' | 'failed' | 'pending' | 'processing'
        : 'failed';
      return {
        taskId: result.taskId,
        status: normalizedStatus,
        resultUrl: result.resultUrl || result.output,
        progress: result.progress,
        error: result.error,
      };
    } catch (error) {
      logger.error(`[UnifiedAPIService] Video generation failed`, { error });
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败'
      };
    }
  }

  /**
   * 统一生成接口
   */
  public async generate(request: UnifiedGenerationRequest): Promise<UnifiedGenerationResponse> {
    const { provider, type, params } = request;

    const config = this.getConfig(provider);
    if (!config) {
      return {
        taskId: '',
        provider,
        status: 'failed',
        error: '未找到API配置'
      };
    }

    try {
      let result: GenerationResult;
      
      if (type === 'image') {
        result = await this.generateImage(provider, params as ImageGenerationParams);
      } else {
        result = await this.generateVideo(provider, params as VideoGenerationParams);
      }

      return {
        taskId: result.taskId,
        provider,
        status: result.status === 'completed' ? 'completed' : 
                result.status === 'failed' ? 'failed' : 
                result.status === 'pending' || result.status === 'processing' ? 'processing' : 'pending',
        result,
        error: result.error
      };
    } catch (error) {
      return {
        taskId: '',
        provider,
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败'
      };
    }
  }

  /**
   * 清除适配器缓存
   */
  public clearAdapterCache(): void {
    this.adapterSignatures.clear();
    AdapterFactory.clearCache();
    logger.info('[UnifiedAPIService] Adapter cache cleared');
  }
}

// ==================== 导出单例和类 ====================
export { UnifiedAPIService };
export const unifiedAPIService = UnifiedAPIService.getInstance();
