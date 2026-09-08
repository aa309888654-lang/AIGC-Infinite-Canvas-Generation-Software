import { BaseProvider, DEFAULT_ENDPOINTS, STANDARD_VIDEO_STATUS_MAP } from './base-provider';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';

export class JimengProvider extends BaseProvider {
  readonly name = 'jimeng';
  readonly supportedModes = ['text_to_video', 'image_to_video', 'first_last_frame'];

  protected getDefaultEndpoint(): string {
    return DEFAULT_ENDPOINTS.jimeng;
  }

  private getArkBaseEndpoint(config: ApiProviderConfig): string {
    const endpoint = this.getEndpoint(config).replace(/\/$/, '');
    if (endpoint.endsWith('/molo/v1')) {
      return 'https://ark.cn-beijing.volces.com/api/v3';
    }
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

      const body: Record<string, any> = {
        model: params.model || 'jimeng-video-v1',
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
          error: `即梦API未返回task_id: ${JSON.stringify(data).substring(0, 300)}`,
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
      const authHeaders = this.getAuthHeaders(config);

      const body: Record<string, any> = {
        model: params.model || 'jimeng-image-v1',
        prompt: params.prompt?.trim() || '',
        response_format: 'url',
      };

      if (params.resolution) {
        const sizeMap: Record<string, string> = {
          '1:1': '1024x1024',
          '16:9': '1920x1088',
          '9:16': '1088x1920',
          '4:3': '1536x1152',
          '3:4': '1152x1536',
        };
        body.size = sizeMap[params.resolution] || '1024x1024';
      } else {
        body.size = '1024x1024';
      }

      if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
      if (params.imageCount && params.imageCount > 1) body.n = params.imageCount;
      if (params.seed !== undefined && params.seed !== -1) body.seed = params.seed;

      if (params.referenceImageUrl) {
        body.image = [params.referenceImageUrl];
      }

      const data = await this.apiPost(endpoint, body, authHeaders);
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        return this.buildCompletedImageResult(data.data, params.model, data);
      }

      const taskId = data.id || data.task_id;
      if (taskId) {
        return this.makePendingResult(taskId, params.model, data);
      }

      return {
        taskId: '',
        status: 'failed',
        provider: this.name,
        error: `即梦图片API未返回结果: ${JSON.stringify(data).substring(0, 300)}`,
      };
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseEndpoint = this.getArkBaseEndpoint(config);
      const endpoint = `${baseEndpoint}/contents/generations/tasks/${taskId}`;
      const data = await this.apiGetWithRetry(endpoint, this.getAuthHeaders(config), 30000, 2, 1000);

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
        const imageItems = data.content.filter((item: any) => item.type === 'image_url' && item.image_url?.url);
        if (imageItems.length > 0) {
          urls = imageItems.map((item: any) => item.image_url.url);
          resultUrl = urls[0];
        }
      }

      return {
        taskId,
        status,
        provider: this.name,
        result: resultUrl ? { imageUrl: resultUrl, videoUrl: data.content?.video_url, url: resultUrl, urls: urls.length > 1 ? urls : undefined } : undefined,
        error: data.error ? `${data.error.code}: ${data.error.message}` : undefined,
      };
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }
}
