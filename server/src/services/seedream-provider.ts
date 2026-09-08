import { BaseProvider, DEFAULT_ENDPOINTS } from './base-provider';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';

export class SeedreamProvider extends BaseProvider {
  readonly name = 'seedream';
  readonly supportedModes = ['text_to_video', 'image_to_video', 'first_last_frame'];

  protected getDefaultEndpoint(): string {
    return DEFAULT_ENDPOINTS.seedream;
  }

  private getArkBaseEndpoint(config: ApiProviderConfig): string {
    const endpoint = this.getEndpoint(config).replace(/\/$/, '');
    if (endpoint.endsWith('/contents/generations/tasks')) {
      return endpoint.replace(/\/contents\/generations\/tasks$/, '');
    }
    return endpoint;
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseEndpoint = this.getArkBaseEndpoint(config);
      const endpoint = `${baseEndpoint}/contents/generations/tasks`;
      const authHeaders = this.getAuthHeaders(config);

      const content: any[] = [];
      const promptText = params.prompt?.trim();
      if (promptText) {
        content.push({ type: 'text', text: promptText });
      }

      if (params.firstFrameUrl || params.imageUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: params.firstFrameUrl || params.imageUrl },
          role: 'first_frame',
        });
      }

      if (params.lastFrameUrl && params.mode === 'first_last_frame') {
        content.push({
          type: 'image_url',
          image_url: { url: params.lastFrameUrl },
          role: 'last_frame',
        });
      }

      const SEEDREAM_VIDEO_MODEL_MAP: Record<string, string> = {
        'doubao-seedream-5-0-lite': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5.0-lite': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5-0': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5.0': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5-0-pro': 'doubao-seedream-5-0-pro-260628',
        'doubao-seedream-5.0-pro': 'doubao-seedream-5-0-pro-260628',
        'seedream-5-0-pro': 'doubao-seedream-5-0-pro-260628',
        'seedream-5.0-pro': 'doubao-seedream-5-0-pro-260628',
        'doubao-seedream-4-5': 'doubao-seedream-4-5-251128',
        'doubao-seedream-4.5': 'doubao-seedream-4-5-251128',
        'seedream-5-0-lite': 'doubao-seedream-5-0-260128',
        'seedream-5.0-lite': 'doubao-seedream-5-0-260128',
        'seedream-4-5': 'doubao-seedream-4-5-251128',
        'seedream-4.5': 'doubao-seedream-4-5-251128',
        'doubao_seedream_5-0-lite': 'doubao-seedream-5-0-260128',
        'doubao_seedream_4-5': 'doubao-seedream-4-5-251128',
      };
      const rawModel = params.model || 'doubao-seedream-5-0-260128';
      const modelId = SEEDREAM_VIDEO_MODEL_MAP[rawModel] || rawModel;

      const body: Record<string, any> = {
        model: modelId,
        content,
        resolution: params.resolution || '720p',
        ratio: params.aspectRatio || '16:9',
        duration: params.duration ?? 5,
      };

      if (params.seed !== undefined && params.seed !== -1) {
        body.seed = params.seed;
      }

      const data = await this.apiPost(endpoint, body, authHeaders);
      const taskId = data.id || data.task_id;
      if (!taskId) {
        return {
          taskId: '',
          status: 'failed',
          provider: this.name,
          error: `Seedream API未返回task_id: ${JSON.stringify(data).substring(0, 300)}`,
        };
      }
      return this.buildStandardVideoResult(taskId, params.model, data);
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseEndpoint = this.getArkBaseEndpoint(config);
      const endpoint = `${baseEndpoint}/images/generations`;
      const imageApiKey = process.env.DOUBAO_IMAGE_KEY || config.apiKey;
      const authHeaders = {
        Authorization: `Bearer ${imageApiKey}`,
        'Content-Type': 'application/json',
      };

      const SEEDREAM_IMAGE_MODEL_MAP: Record<string, string> = {
        'doubao-seedream-5-0-lite': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5.0-lite': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5-0': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5.0': 'doubao-seedream-5-0-260128',
        'doubao-seedream-5-0-pro': 'doubao-seedream-5-0-pro-260628',
        'doubao-seedream-5.0-pro': 'doubao-seedream-5-0-pro-260628',
        'seedream-5-0-pro': 'doubao-seedream-5-0-pro-260628',
        'seedream-5.0-pro': 'doubao-seedream-5-0-pro-260628',
        'doubao-seedream-4-5': 'doubao-seedream-4-5-251128',
        'doubao-seedream-4.5': 'doubao-seedream-4-5-251128',
        'seedream-5-0-lite': 'doubao-seedream-5-0-260128',
        'seedream-5.0-lite': 'doubao-seedream-5-0-260128',
        'seedream-4-5': 'doubao-seedream-4-5-251128',
        'seedream-4.5': 'doubao-seedream-4-5-251128',
        'doubao_seedream-5-0-lite': 'doubao-seedream-5-0-260128',
        'doubao_seedream-4-5': 'doubao-seedream-4-5-251128',
      };
      const rawModel = params.model || 'doubao-seedream-5-0-lite';
      const modelId = SEEDREAM_IMAGE_MODEL_MAP[rawModel] || rawModel;
      const isSeedream5 = modelId.includes('5-0-');
      const isSeedream5Pro = modelId.includes('5-0-pro');

      const body: Record<string, any> = {
        model: modelId,
        prompt: params.prompt?.trim() || '',
        response_format: 'url',
        watermark: false,
      };

      const referenceImages = Array.isArray(params.referenceImages)
        ? params.referenceImages.filter(
            (item): item is string => typeof item === 'string' && item.length > 0
          )
        : [];
      const maxReferenceImages = isSeedream5Pro ? 10 : 14;
      const limitedReferenceImages = referenceImages.slice(0, maxReferenceImages);
      if (params.referenceImageUrl || referenceImages.length > 0) {
        body.image = params.referenceImageUrl
          ? [
              params.referenceImageUrl,
              ...limitedReferenceImages.filter((item) => item !== params.referenceImageUrl),
            ].slice(0, maxReferenceImages)
          : limitedReferenceImages;
      }

      if (params.negativePrompt && !isSeedream5) {
        body.negative_prompt = params.negativePrompt;
      }

      if (isSeedream5) {
        const allowedTiers = isSeedream5Pro ? ['1K', '2K'] : ['2K', '3K', '4K'];
        const requestedSize = String(
          params.imageSize || params.pixelResolution || params.size || ''
        ).trim();
        const isExplicitPixelSize = /^\d{2,5}x\d{2,5}$/i.test(requestedSize);
        body.size =
          isExplicitPixelSize || allowedTiers.includes(requestedSize) ? requestedSize : '2K';

        const aspectRatio = String(params.resolution || '').trim();
        if (
          aspectRatio &&
          aspectRatio !== 'auto' &&
          /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(aspectRatio)
        ) {
          body.prompt = `${body.prompt}\n输出画面宽高比为 ${aspectRatio}。`;
        }
      } else if (params.resolution) {
        const sizeMap: Record<string, string> = {
          '1:1': '2048x2048',
          '4:3': '2304x1728',
          '3:4': '1728x2304',
          '16:9': '2848x1600',
          '9:16': '1600x2848',
          '3:2': '2496x1664',
          '2:3': '1664x2496',
          '21:9': '3136x1344',
        };
        body.size = sizeMap[params.resolution] || '2K';
      } else {
        body.size = '2K';
      }

      if (!isSeedream5 && params.imageCount && params.imageCount > 1) {
        body.n = params.imageCount;
      }

      if (params.promptEnhancement !== undefined) {
        body.prompt_optimizer = params.promptEnhancement;
      } else if (params.promptOptimizer !== undefined) {
        body.prompt_optimizer = params.promptOptimizer;
      } else if (params.promptEnhancer !== undefined) {
        body.prompt_optimizer = params.promptEnhancer;
      } else {
        body.prompt_optimizer = false;
      }

      if (isSeedream5) {
        body.output_format = params.outputFormat === 'png' ? 'png' : 'jpeg';
        body.optimize_prompt_options =
          (params.promptEnhancement ?? params.promptOptimizer ?? params.promptEnhancer) === false
            ? undefined
            : {
                mode:
                  isSeedream5Pro && params.seedreamOptimizeMode === 'fast' ? 'fast' : 'standard',
              };
        if (!isSeedream5Pro && params.sequentialImageGeneration === 'auto') {
          body.sequential_image_generation = 'auto';
          const maxOutputImages = Math.max(1, 15 - limitedReferenceImages.length);
          body.sequential_image_generation_options = {
            max_images: Math.min(
              maxOutputImages,
              Math.max(1, Number(params.sequentialMaxImages || 6))
            ),
          };
          body.stream = false;
        }
        if (!isSeedream5Pro && params.webSearch === true) {
          body.tools = [{ type: 'web_search' }];
        }
        delete body.prompt_optimizer;
        if (!body.optimize_prompt_options) delete body.optimize_prompt_options;
      }

      const response = await this.apiPost(endpoint, body, authHeaders);

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return this.buildCompletedImageResult(response.data, params.model, response);
      }

      const taskId = response.id || response.task_id;
      if (taskId) {
        return this.makePendingResult(taskId, params.model, response);
      }

      return {
        taskId: '',
        status: 'failed',
        provider: this.name,
        model: params.model,
        error: `Seedream图片API未返回结果: ${JSON.stringify(response).substring(0, 300)}`,
      };
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseEndpoint = this.getArkBaseEndpoint(config);
      const endpoint = `${baseEndpoint}/contents/generations/tasks/${taskId}`;
      const data = await this.apiGetWithRetry(
        endpoint,
        this.getAuthHeaders(config),
        30000,
        2,
        1000
      );

      const statusMap: Record<string, GenerationResult['status']> = {
        queued: 'pending',
        running: 'processing',
        succeeded: 'completed',
        failed: 'failed',
        cancelled: 'cancelled',
        expired: 'failed',
      };

      const status = this.mapStatus(data.status, statusMap);
      let resultUrl: string | undefined;
      let urls: string[] = [];
      if (data.content?.video_url) {
        resultUrl = data.content.video_url;
      } else if (data.content?.image_url) {
        resultUrl = data.content.image_url;
        urls = [resultUrl];
      } else if (Array.isArray(data.content)) {
        const imageItems = data.content.filter(
          (item: any) => item.type === 'image_url' && item.image_url?.url
        );
        if (imageItems.length > 0) {
          urls = imageItems.map((item: any) => item.image_url.url);
          resultUrl = urls[0];
        }
      }

      return {
        taskId,
        status,
        provider: this.name,
        result: resultUrl
          ? {
              imageUrl: resultUrl,
              videoUrl: data.content?.video_url,
              url: resultUrl,
              urls: urls.length > 1 ? urls : undefined,
            }
          : undefined,
        error: data.error ? `${data.error.code}: ${data.error.message}` : undefined,
      };
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }
}
