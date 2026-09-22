/**
 * 后端Provider与前端模型同步服务
 * 将后端配置的AI Provider和模型同步到前端模型注册表
 */

import { aiProviderService, AIModel } from './ai-provider-service';
import { modelRegistry, ModelInfo } from './model-registry';
import { logger } from '@/lib/logger';
import { APIProvider } from '@/types/api-controller';

class ProviderModelSync {
  private static instance: ProviderModelSync;
  private syncPromise: Promise<void> | null = null;
  private isSynced = false;

  private constructor() { /* noop */ }

  public static getInstance(): ProviderModelSync {
    if (!ProviderModelSync.instance) {
      ProviderModelSync.instance = new ProviderModelSync();
    }
    return ProviderModelSync.instance;
  }

  /**
   * 从后端获取Provider列表并同步到前端
   */
  public async syncProviders(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.doSync();
    await this.syncPromise;
    this.syncPromise = null;
    this.isSynced = true;
  }

  private async doSync(): Promise<void> {
    try {
      logger.info('[ProviderSync] 开始同步后端Provider配置...');

      const response = await aiProviderService.getActiveProviders();

      if (!response.success || !response.data) {
        logger.warn('[ProviderSync] 获取Provider列表失败');
        return;
      }

      const backendProviders = response.data;
      logger.info(`[ProviderSync] 获取到 ${backendProviders.length} 个后端Provider`);

      // 同步每个Provider的模型到前端注册表
      for (const provider of backendProviders) {
        await this.syncProviderModels(provider);
      }

      logger.info('[ProviderSync] Provider同步完成');
    } catch (error) {
      logger.error('[ProviderSync] 同步失败:', error);
    }
  }

  /**
   * 同步单个Provider的模型
   */
  private async syncProviderModels(provider: any): Promise<void> {
    try {
      // 获取Provider的模型列表
      const modelsResponse = await aiProviderService.getProviderModels(provider.provider);

      if (!modelsResponse.success || !modelsResponse.data) {
        logger.warn(`[ProviderSync] 获取Provider ${provider.provider} 模型失败`);
        return;
      }

      const backendModels: AIModel[] = modelsResponse.data;

      // 将后端模型添加到前端注册表
      for (const model of backendModels) {
        const inferredType = this.inferModelType(model, provider);

        const modelInfo: ModelInfo = {
          id: model.modelId || model.id,
          name: model.name,
          provider: model.provider as APIProvider,
          type: inferredType,
          description: model.description || '',
          capabilities: model.supportedModes || [],
          maxResolution: model.maxResolution,
          maxDuration: model.maxDuration,
          supportedAspectRatios: model.supportedAspectRatios,
          supportedModes: model.supportedModes as any,
          defaultParams: model.defaultParams,
          isActive: true,
          tags: [provider.displayName || provider.name],
        };

        const existingModel = modelRegistry.getModelById(modelInfo.id);
        if (existingModel) {
          modelRegistry.updateModel(modelInfo.id, modelInfo);
        } else {
          modelRegistry.addModel(modelInfo);
        }
      }

      logger.info(
        `[ProviderSync] Provider ${provider.provider} 同步了 ${backendModels.length} 个模型`
      );
    } catch (error) {
      logger.error(`[ProviderSync] 同步Provider ${provider.provider} 失败:`, error);
    }
  }

  /**
   * 根据模型能力推断模型类型
   * 优先使用 backend 的显式分类 (videoModels, voiceModels, musicModels, imageModels)
   * fallback 到 supportedModes 推断
   */
  private inferModelType(model: AIModel, provider?: any): 'image' | 'video' | 'audio' | 'both' {
    const features = provider?.config?.features;
    const modelId = model.modelId || model.id;
    const capabilities = (model.supportedModes || []).map((s: string) => s.toLowerCase());

    const videoModelIds = (provider?.config?.videoModels || []).map((m: any) => m.id || m);
    const voiceModelIds = (provider?.config?.voiceModels || []).map((m: any) => m.id || m);
    const musicModelIds = (provider?.config?.musicModels || []).map((m: any) => m.id || m);
    const imageModelIds = (provider?.config?.imageModels || []).map((m: any) => m.id || m);

    // 优先使用 backend 的显式分类
    if (videoModelIds.includes(modelId)) return 'video';
    if (voiceModelIds.includes(modelId)) return 'audio';
    if (musicModelIds.includes(modelId)) return 'audio';
    if (imageModelIds.includes(modelId)) return 'image';

    const isVideoByCapability = capabilities.some(
      (c: string) =>
        c.includes('video') ||
        c.includes('text_to_video') ||
        c.includes('image_to_video') ||
        c.includes('text2video') ||
        c.includes('img2video') ||
        c.includes('t2v') ||
        c.includes('i2v')
    );

    const isImageByCapability = capabilities.some(
      (c: string) =>
        c.includes('image') ||
        c.includes('text_to_image') ||
        c.includes('text2img') ||
        c.includes('img2img') ||
        c.includes('stable_diffusion') ||
        c.includes('sd_')
    );

    const isAudioByCapability = capabilities.some(
      (c: string) =>
        c.includes('audio') ||
        c.includes('speech') ||
        c.includes('tts') ||
        c.includes('music') ||
        c.includes('voice') ||
        c.includes('songs')
    );

    if (isAudioByCapability && !isVideoByCapability && !isImageByCapability) {
      return 'audio';
    }

    if (features) {
      const hasVideo =
        features.videoGeneration ||
        features.textToVideo ||
        features.imageToVideo ||
        features.omniVideo ||
        features.multiImageToVideo;
      const hasImage = features.imageGeneration || features.textToImage || features.imageToImage;

      if (isAudioByCapability && !hasVideo && !hasImage) return 'audio';
      if (hasVideo && hasImage) return 'both';
      if (hasVideo) return 'video';
      if (hasImage) return 'image';
    }

    if (isVideoByCapability && isImageByCapability) return 'both';
    if (isVideoByCapability) return 'video';
    if (isImageByCapability) return 'image';

    return 'image';
  }

  /**
   * 获取所有可用的Provider
   */
  public async getAvailableProviders(): Promise<any[]> {
    await this.syncProviders();

    const response = await aiProviderService.getAvailableModels();
    return response.data?.providers || [];
  }

  /**
   * 获取所有可用的模型
   */
  public async getAvailableModels(): Promise<AIModel[]> {
    await this.syncProviders();

    const response = await aiProviderService.getAvailableModels();
    return response.data?.models || [];
  }

  /**
   * 根据类型获取模型
   */
  public async getModelsByType(type: 'image' | 'video' | 'audio'): Promise<AIModel[]> {
    const allModels = await this.getAvailableModels();

    return allModels.filter((model) => {
      const capabilities = (model.supportedModes || []).map((s) => s.toLowerCase());

      switch (type) {
        case 'video':
          return capabilities.some(
            (c) =>
              c.includes('video') || c.includes('text_to_video') || c.includes('image_to_video')
          );
        case 'image':
          return capabilities.some((c) => c.includes('image') && !c.includes('video'));
        case 'audio':
          return capabilities.some(
            (c) => c.includes('audio') || c.includes('speech') || c.includes('tts')
          );
        default:
          return true;
      }
    });
  }

  /**
   * 清除同步状态，下次调用时会重新同步
   */
  public clearSyncState(): void {
    this.isSynced = false;
  }

  /**
   * 检查是否已同步
   */
  public hasSynced(): boolean {
    return this.isSynced;
  }
}

export const providerModelSync = ProviderModelSync.getInstance();
export default ProviderModelSync;
