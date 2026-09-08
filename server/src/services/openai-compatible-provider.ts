import { BaseProvider, STANDARD_VIDEO_STATUS_MAP } from './base-provider';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';

export class OpenAICompatibleProvider extends BaseProvider {
  readonly name = 'openaiCompatible';
  readonly supportedModes = ['text_to_video', 'image_to_video'];

  protected getDefaultEndpoint(): string {
    return '';
  }

  protected override getEndpoint(config: ApiProviderConfig): string {
    if (!config.endpoint) throw new Error('Endpoint is required for OpenAI compatible provider');
    return config.endpoint;
  }

  protected override getAuthHeaders(config: ApiProviderConfig): Record<string, string> {
    return { Authorization: `Bearer ${config.apiKey}` };
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const endpoint = this.getEndpoint(config);
      const body = this.buildCommonVideoBody(params);
      if (!body.model) body.model = 'video-model';

      const dimensions = this.mapResolution(params.resolution, params.pixelResolution);
      if (dimensions) body.dimension = { width: dimensions.width, height: dimensions.height };
      if (params.quality) body.quality = params.quality;
      if (params.motionIntensity) body.motion_strength = params.motionIntensity;
      if (params.cameraControl) body.camera_control = params.cameraControl;
      if (params.imageUrl && params.mode === 'image_to_video') body.image_url = params.imageUrl;

      const data = await this.apiPost(`${endpoint}/videos/generations`, body, this.getAuthHeaders(config));
      return this.buildStandardVideoResult(data.id || data.task_id, params.model, data);
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const endpoint = this.getEndpoint(config);
      const body = this.buildCommonImageBody(params);
      if (!body.model) body.model = 'image-model';

      const p = params as any;
      const dimensions = this.mapResolution(params.resolution, params.pixelResolution);
      const explicitSize = typeof p.size === 'string' && p.size.trim()
        ? p.size.trim()
        : typeof params.imageSize === 'string' && params.imageSize.trim()
          ? params.imageSize.trim()
          : undefined;
      if (explicitSize && /^(?:auto|\d{3,5}x\d{3,5})$/i.test(explicitSize)) {
        body.size = explicitSize;
      } else if (dimensions) {
        body.size = `${dimensions.width}x${dimensions.height}`;
      } else if (params.width && params.height) {
        body.size = `${params.width}x${params.height}`;
      } else if (explicitSize) {
        body.size = explicitSize;
      }
      if (config.compatibilityMode !== 'official-image' && params.resolution) {
        body.aspect_ratio = params.resolution;
      }
      if (params.style) body.style = params.style;
      if (params.imageCount) body.n = params.imageCount;
      if (params.gptQuality) body.quality = params.gptQuality;
      if (params.gptOutputFormat) body.output_format = params.gptOutputFormat;
      if (params.gptOutputCompression !== undefined || params.gptCompression !== undefined) {
        body.output_compression = params.gptOutputCompression ?? params.gptCompression;
      }
      if (params.gptBackground) body.background = params.gptBackground === 'transparent' ? 'opaque' : params.gptBackground;
      if (params.moderation) body.moderation = params.moderation;

      const data = await this.apiPost(`${endpoint}/images/generations`, body, this.getAuthHeaders(config));
      return this.buildCompletedImageResult(data.data || [data], params.model, data);
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const endpoint = this.getEndpoint(config);
      const data = await this.apiGetWithRetry(`${endpoint}/videos/generations/${taskId}`, this.getAuthHeaders(config), 30000, 2, 1000);
      return this.buildStandardTaskResult(taskId, data, STANDARD_VIDEO_STATUS_MAP);
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }
}
