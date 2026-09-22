/**
 * 统一AI适配器系统
 * 支持所有AI大模型连接到任意节点
 */

import { BaseGenerator } from './adapters/base';
import { backendProxyAdapter } from './adapters/backend-proxy-adapter';
import { logger } from '@/lib/logger';
import { aiProviderService } from './ai-provider-service';

export type AIModelType =
  | 'text'           // 文本模型 (DeepSeek、MiniMax 等国内模型)
  | 'image'         // 图像生成模型
  | 'video'          // 视频生成模型
  | 'audio'          // 音频模型
  | 'multimodal';    // 多模态模型

export interface UnifiedModelConfig {
  id: string;
  name: string;
  provider: string;
  type: AIModelType;
  icon: string;
  color: string;
  capabilities: string[];
  endpoint?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
}

export interface UnifiedAPIResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    model: string;
    tokens?: number;
    duration?: number;
    cost?: number;
  };
}

// 后端同步的额外模型
let backendModels: UnifiedModelConfig[] = [];

// 支持的所有AI大模型配置
export const UNIFIED_MODELS: UnifiedModelConfig[] = [
  // ========== 图像生成模型 ==========
  {
    id: 'doubao-image',
    name: '豆包图像生成',
    provider: 'doubao',
    type: 'image',
    icon: '🎨',
    color: '#007AFF',
    capabilities: ['text-to-image', 'image-to-image', 'inpainting'],
  },
  {
    id: 'seedream',
    name: '即梦Seedream',
    provider: 'seedream',
    type: 'image',
    icon: '🎨',
    color: '#FF6B35',
    capabilities: ['text-to-image', 'image-to-image'],
  },

  // ========== 视频生成模型 ==========
  {
    id: 'doubao-video',
    name: '豆包视频生成',
    provider: 'doubao',
    type: 'video',
    icon: '🎬',
    color: '#007AFF',
    capabilities: ['text-to-video', 'image-to-video', 'first-last-frame'],
  },
  {
    id: 'jimeng',
    name: '即梦视频',
    provider: 'jimeng',
    type: 'video',
    icon: '🎬',
    color: '#9C27B0',
    capabilities: ['text-to-video', 'image-to-video'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    provider: 'minimax',
    type: 'video',
    icon: '🎬',
    color: '#EC4899',
    capabilities: ['text-to-video', 'image-to-video'],
  },
];

class UnifiedAIAdapter {
  private static instance: UnifiedAIAdapter;
  private apiKeys: Record<string, Record<string, unknown>> = {};

  private constructor() { /* noop */ }

  public static getInstance(): UnifiedAIAdapter {
    if (!UnifiedAIAdapter.instance) {
      UnifiedAIAdapter.instance = new UnifiedAIAdapter();
    }
    return UnifiedAIAdapter.instance;
  }

  /**
   * 配置API密钥
   */
  public configureProvider(provider: string, config: Record<string, unknown>): void {
    this.apiKeys[provider] = config;
    logger.info(`[UnifiedAIAdapter] 配置提供商: ${provider}。生成请求由后端托管，前端不会使用密钥直连。`, {
      keys: Object.keys(config || {}),
    });
  }

  /**
   * 获取适配器实例
   */
  private getAdapter(modelId: string): BaseGenerator | null {
    const model = UNIFIED_MODELS.find(m => m.id === modelId);
    if (!model) {
      logger.error(`[UnifiedAIAdapter] 未找到模型: ${modelId}`);
      return null;
    }

    return backendProxyAdapter as any as BaseGenerator;
  }

  /**
   * 执行文本生成
   * 注意：文本生成功能需要通过 LLM 服务实现，此处提供统一接口
   */
  public async generateText(
    modelId: string,
    _prompt: string,
    _options?: {
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
    }
  ): Promise<UnifiedAPIResult> {
    const model = UNIFIED_MODELS.find(m => m.id === modelId);
    if (!model || (model.type !== 'text' && model.type !== 'multimodal')) {
      return {
        success: false,
        error: `模型 ${modelId} 不支持文本生成`,
      };
    }

    logger.warn(`[UnifiedAIAdapter] 文本生成需要通过 ai-assistant-service 或 LLM 服务实现，请使用专用的文本生成接口`);
    
    return {
      success: false,
      error: '文本生成请使用 ai-assistant-service 或 LLM 服务',
    };
  }

  /**
   * 执行图像生成
   */
  public async generateImage(
    modelId: string,
    params: {
      prompt: string;
      negativePrompt?: string;
      width?: number;
      height?: number;
      steps?: number;
      seed?: number;
    }
  ): Promise<UnifiedAPIResult> {
    const adapter = this.getAdapter(modelId);
    const model = this.getModelInfo(modelId);
    if (!adapter) {
      return {
        success: false,
        error: `无法获取模型 ${modelId} 的适配器`,
      };
    }

    try {
      const result = await adapter.generateImage({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        aspectRatio: this.calculateAspectRatio(params.width, params.height),
        modelProvider: model?.provider || modelId,
        modelId,
      } as any as Parameters<BaseGenerator['generateImage']>[0]);

      const resultRecord = result as any as { resultUrl?: string; resultUrls?: string[]; taskId: string; error?: string; status: string };
      return {
        success: result.status === 'completed',
        data: {
          imageUrl: resultRecord.resultUrl,
          taskId: resultRecord.taskId,
        },
        error: resultRecord.error,
        metadata: {
          model: modelId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '图像生成失败',
      };
    }
  }

  /**
   * 执行视频生成
   */
  public async generateVideo(
    modelId: string,
    params: {
      prompt: string;
      negativePrompt?: string;
      duration?: number;
      resolution?: string;
      startImage?: string;
      endImage?: string;
      referenceImage?: string;
    }
  ): Promise<UnifiedAPIResult> {
    const adapter = this.getAdapter(modelId);
    const model = this.getModelInfo(modelId);
    if (!adapter) {
      return {
        success: false,
        error: `无法获取模型 ${modelId} 的适配器`,
      };
    }

    try {
      const result = await adapter.generateVideo({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        resolution: (params.resolution as any as string) || '16:9',
        duration: (params.duration as any as number) || 5,
        startImage: params.startImage,
        endImage: params.endImage,
        referenceImage: params.referenceImage,
        modelProvider: model?.provider || modelId,
        modelId,
      } as any as Parameters<BaseGenerator['generateVideo']>[0]);

      const resultRecord = result as any as { taskId: string; error?: string; status: string };
      return {
        success: result.status === 'pending' || result.status === 'completed',
        data: {
          taskId: resultRecord.taskId,
        },
        error: resultRecord.error,
        metadata: {
          model: modelId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '视频生成失败',
      };
    }
  }

  /**
   * 轮询任务状态
   */
  public async pollTaskStatus(
    modelId: string,
    taskId: string,
    onProgress?: (progress: number) => void
  ): Promise<UnifiedAPIResult> {
    const adapter = this.getAdapter(modelId);
    if (!adapter) {
      return {
        success: false,
        error: `无法获取模型 ${modelId} 的适配器`,
      };
    }

    try {
      const result = await adapter.pollTaskStatus(taskId, onProgress);

      return {
        success: result.status === 'completed',
        data: {
          status: result.status,
          resultUrl: result.resultUrl,
          progress: result.progress,
        },
        error: result.error,
        metadata: {
          model: modelId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '状态查询失败',
      };
    }
  }

  /**
   * 获取模型信息
   */
  public getModelInfo(modelId: string): UnifiedModelConfig | undefined {
    return UNIFIED_MODELS.find(m => m.id === modelId);
  }

  /**
   * 获取所有可用模型
   */
  public getAllModels(type?: AIModelType): UnifiedModelConfig[] {
    const allModels = [...UNIFIED_MODELS, ...backendModels];
    if (type) {
      return allModels.filter(m => m.type === type);
    }
    return allModels;
  }

  /**
   * 获取按类型分组的模型
   */
  public getModelsByCategory(): Record<AIModelType, UnifiedModelConfig[]> {
    const allModels = [...UNIFIED_MODELS, ...backendModels];
    return {
      text: allModels.filter(m => m.type === 'text'),
      image: allModels.filter(m => m.type === 'image'),
      video: allModels.filter(m => m.type === 'video'),
      audio: allModels.filter(m => m.type === 'audio'),
      multimodal: allModels.filter(m => m.type === 'multimodal'),
    };
  }

  /**
   * 从后端同步模型列表
   */
  public async syncBackendModels(): Promise<void> {
    try {
      logger.info('[UnifiedAIAdapter] 同步后端模型...');
      const response = await aiProviderService.getAvailableModels();
      
      if (response.success && response.data?.models) {
        backendModels = response.data.models.map(model => ({
          id: model.modelId || model.id,
          name: model.name,
          provider: model.provider,
          type: this.inferModelType(model),
          icon: '🤖',
          color: '#10B981',
          capabilities: model.supportedModes || [],
          endpoint: model.endpoint,
          supportsStreaming: false,
        }));
        logger.info(`[UnifiedAIAdapter] 同步了 ${backendModels.length} 个后端模型`);
      }
    } catch (error) {
      logger.error('[UnifiedAIAdapter] 同步后端模型失败:', error);
    }
  }

  private inferModelType(model: unknown): AIModelType {
    const modelRecord = (model && typeof model === 'object' ? model : {}) as Record<string, unknown>;
    const supportedModes = Array.isArray(modelRecord.supportedModes) ? modelRecord.supportedModes : [];
    const capabilities = supportedModes.map((s: unknown) => (typeof s === 'string' ? s.toLowerCase() : ''));
    
    const isVideo = capabilities.some(c => 
      c.includes('video') || 
      c.includes('text_to_video') ||
      c.includes('image_to_video')
    );
    
    const isAudio = capabilities.some(c =>
      c.includes('audio') ||
      c.includes('speech') ||
      c.includes('tts')
    );

    if (isAudio) return 'audio';
    if (isVideo) return 'video';
    return 'image';
  }

  /**
   * 计算图片比例
   */
  private calculateAspectRatio(width?: number, height?: number): string {
    if (!width || !height) return '1:1';
    const ratio = width / height;
    if (ratio > 1.3) return '16:9';
    if (ratio < 0.8) return '9:16';
    return '1:1';
  }

  /**
   * 清除缓存的适配器
   */
  public clearCache(): void {
    logger.info('[UnifiedAIAdapter] 后端托管模式无需清除前端厂商适配器缓存');
  }
}

export const unifiedAIAdapter = UnifiedAIAdapter.getInstance();
export default UnifiedAIAdapter;
