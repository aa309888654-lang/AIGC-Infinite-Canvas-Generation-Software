import { BaseProvider } from './base-provider';
import { VideoParams, ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';

const VIDU_OFFICIAL_BASE_URL = 'https://api.vidu.cn';

interface ViduModelConfig {
  maxDuration: number;
  supportedResolutions: string[];
  supportedAspectRatios: string[];
  supportsAudio: boolean;
  supportsReference: boolean;
  supportsStartEnd: boolean;
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
}

const VIDU_MODELS: Record<string, ViduModelConfig> = {
  'viduq3-pro': {
    maxDuration: 16,
    supportedResolutions: ['540p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: true,
    supportsReference: true,
    supportsStartEnd: true,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
  },
  'viduq3-turbo': {
    maxDuration: 16,
    supportedResolutions: ['540p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: true,
    supportsReference: true,
    supportsStartEnd: true,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
  },
  'viduq3-pro-fast': {
    maxDuration: 16,
    supportedResolutions: ['720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: true,
    supportsReference: false,
    supportsStartEnd: false,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
  },
  'viduq3-mix': {
    maxDuration: 8,
    supportedResolutions: ['540p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: true,
    supportsReference: true,
    supportsStartEnd: false,
    supportsTextToVideo: false,
    supportsImageToVideo: false,
  },
  'viduq2-pro': {
    maxDuration: 10,
    supportedResolutions: ['540p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: false,
    supportsReference: true,
    supportsStartEnd: true,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
  },
  'viduq2-turbo': {
    maxDuration: 10,
    supportedResolutions: ['540p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: false,
    supportsReference: true,
    supportsStartEnd: true,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
  },
  'viduq2-pro-fast': {
    maxDuration: 10,
    supportedResolutions: ['720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: false,
    supportsReference: false,
    supportsStartEnd: true,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
  },
  viduq2: {
    maxDuration: 10,
    supportedResolutions: ['540p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
    supportsAudio: false,
    supportsReference: true,
    supportsStartEnd: false,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
  },
};

function isViduOfficialModel(model: string): boolean {
  return model in VIDU_MODELS;
}

function appendViduOfficialFields(
  body: Record<string, unknown>,
  params: VideoParams,
  options: { includeVisual?: boolean; includeAudio?: boolean; includeTemplate?: boolean } = {}
) {
  if (options.includeVisual) {
    const style = params.style || params.viduStyle;
    if (style) body.style = style;
    if (params.motionAmplitude) body.movement_amplitude = params.motionAmplitude;
  }

  if (options.includeAudio) {
    if (params.bgm !== undefined) body.bgm = params.bgm;
  }

  if (options.includeTemplate && params.templateBgm !== undefined) {
    body.bgm = params.templateBgm;
  }

  if (params.offPeak !== undefined) body.off_peak = params.offPeak;
  if (params.watermark !== undefined) body.watermark = params.watermark;
  if (params.wmPosition !== undefined) body.wm_position = params.wmPosition;
  if (params.wmUrl) body.wm_url = params.wmUrl;
  if (params.metaData) body.meta_data = params.metaData;
  if (params.callbackUrl) body.callback_url = params.callbackUrl;
  if (params.payload) body.payload = params.payload;
}

export class ViduProvider extends BaseProvider {
  readonly name = 'vidu';
  readonly supportedModes = ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video', 'template_story', 'template', 'one_click'];

  protected getDefaultEndpoint(): string {
    return VIDU_OFFICIAL_BASE_URL;
  }

  protected getBaseUrl(config: ApiProviderConfig): string {
    const raw = config.endpoint || VIDU_OFFICIAL_BASE_URL;
    return raw.replace(/\/v1\/?$/, '').replace(/\/ent\/?$/, '');
  }

  protected getHeaders(config: ApiProviderConfig): Record<string, string> {
    const baseUrl = this.getBaseUrl(config);
    const isOfficial = baseUrl.includes('vidu.cn');
    // 不在日志中记录 API 密钥片段；日志通常会被长期保留或转发。
    logger.debug(`[ViduProvider] getHeaders: baseUrl=${baseUrl}, isOfficial=${isOfficial}, keyConfigured=${Boolean(config.apiKey)}`);
    
    // Vidu 官方 API 使用 Token 前缀，而非 Bearer
    const authPrefix = isOfficial ? 'Token' : 'Bearer';
    
    return {
      Authorization: `${authPrefix} ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const model = params.model || 'viduq2';

      if (params.templateMode === 'template-story') {
        return this.generateTemplateStory(params, config, baseUrl);
      }
      if (params.templateMode === 'template') {
        return this.generateTemplate(params, config, baseUrl);
      }
      if (params.templateMode === 'one-click') {
        return this.generateOneClick(params, config, baseUrl);
      }

      if (isViduOfficialModel(model) || model.startsWith('vidu')) {
        return this.generateViduOfficialVideo(params, config, baseUrl, model);
      }

      return this.generateViduOfficialVideo(params, config, baseUrl, model);
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  private inferGenerationMode(params: VideoParams): string {
    if (params.mode) return params.mode;
    if (params.firstFrameUrl && params.lastFrameUrl) return 'first_last_frame';
    if (params.referenceImages?.length || params.referenceVideos?.length) return 'reference_to_video';
    if (params.imageUrl || params.firstFrameUrl) return 'image_to_video';
    return 'text_to_video';
  }

  private async generateViduOfficialVideo(
    params: VideoParams,
    config: ApiProviderConfig,
    baseUrl: string,
    model: string
  ): Promise<GenerationResult> {
    const modelConfig = VIDU_MODELS[model];
    if (!modelConfig) {
      return {
        taskId: '',
        status: 'failed',
        provider: this.name,
        model,
        error: `不支持的 Vidu 模型: ${model}`,
      };
    }

    const generationMode = params.mode || this.inferGenerationMode(params);

    // Validate model supports the determined generation mode
    const modeSupportMap: Record<string, boolean> = {
      text_to_video: modelConfig.supportsTextToVideo,
      image_to_video: modelConfig.supportsImageToVideo,
      first_last_frame: modelConfig.supportsStartEnd,
      reference_to_video: modelConfig.supportsReference,
    };
    if (modeSupportMap[generationMode] === false) {
      const modeNames: Record<string, string> = {
        text_to_video: '文生视频',
        image_to_video: '图生视频',
        first_last_frame: '首尾帧',
        reference_to_video: '参考视频',
      };
      // Try to find a fallback mode
      const hasImage = !!(params.imageUrl || params.firstFrameUrl);
      if (hasImage && modelConfig.supportsImageToVideo) {
        // Fall back to image_to_video
        return this.generateViduOfficialVideo({ ...params, mode: 'image_to_video' }, config, baseUrl, model);
      }
      return {
        taskId: '',
        status: 'failed',
        provider: this.name,
        model,
        error: `模型 ${model} 不支持${modeNames[generationMode] || generationMode}模式，请提供参考图片或选择支持该模式的模型（如 viduq3-pro、viduq3-turbo）`,
      };
    }

    let endpoint: string;
    let officialModelId = model;
    let body: Record<string, unknown>;

    const rawDuration = params.duration || 5;
    let duration = Math.min(rawDuration, modelConfig.maxDuration);
    if (duration < 1) duration = 1;

    if (generationMode === 'first_last_frame' && modelConfig.supportsStartEnd) {
      endpoint = '/ent/v2/start-end2video';
      if (model === 'viduq3-pro-fast') officialModelId = 'viduq3-pro';
      else if (model === 'viduq2') officialModelId = 'viduq2-pro';
      const images: string[] = [];
      if (params.firstFrameUrl || params.imageUrl) {
        images.push(params.firstFrameUrl || params.imageUrl || '');
      }
      if (params.lastFrameUrl) {
        images.push(params.lastFrameUrl);
      }
      body = {
        model: officialModelId,
        images,
        prompt: params.prompt?.trim() || 'Generate video based on the provided images',
        duration,
      };
    } else if (generationMode === 'reference_to_video' && modelConfig.supportsReference) {
      endpoint = '/ent/v2/reference2video';
      if (model === 'viduq3-pro' || model === 'viduq3-pro-fast') officialModelId = 'viduq3';
      else if (model === 'viduq2-turbo' || model === 'viduq2-pro-fast') officialModelId = 'viduq2';
      const images: string[] = [];
      if (params.imageUrl || params.firstFrameUrl) {
        images.push(params.imageUrl || params.firstFrameUrl || '');
      }
      if (params.referenceImages && params.referenceImages.length > 0) {
        images.push(...params.referenceImages.slice(0, 6 - images.length));
      }
      body = {
        model: officialModelId,
        prompt: params.prompt?.trim() || 'Generate video based on the reference images',
        duration,
      };
      if (images.length > 0) {
        body.images = images;
      }
      if (params.referenceVideos && params.referenceVideos.length > 0 && model === 'viduq2-pro') {
        body.videos = params.referenceVideos.slice(0, 2);
      }
    } else if (generationMode === 'text_to_video' || (!params.imageUrl && !params.firstFrameUrl && !params.referenceImages?.length)) {
      endpoint = '/ent/v2/text2video';
      if (model === 'viduq2-pro' || model === 'viduq2-turbo' || model === 'viduq2-pro-fast') officialModelId = 'viduq2';
      else if (model === 'viduq3-pro-fast') officialModelId = 'viduq3-pro';
      const promptText = params.prompt?.trim() || 'A cinematic high quality video';
      body = {
        model: officialModelId,
        prompt: promptText,
        duration,
      };
    } else {
      endpoint = '/ent/v2/img2video';
      if (model === 'viduq2') officialModelId = 'viduq2-pro';
      else if (model === 'viduq3-pro-fast') officialModelId = 'viduq3-pro-fast';
      const images: string[] = [];
      if (params.imageUrl || params.firstFrameUrl) {
        images.push(params.imageUrl || params.firstFrameUrl || '');
      }
      body = {
        model: officialModelId,
        images,
        prompt: params.prompt?.trim() || 'Generate video based on the provided image',
        duration,
      };
    }

    const requestedResolution = params.resolution as string | undefined;
    let finalResolution = requestedResolution;
    
    // Map common resolution strings to Vidu format
    if (requestedResolution === '1280x720') finalResolution = '720p';
    if (requestedResolution === '1920x1080') finalResolution = '1080p';
    if (requestedResolution === '960x540') finalResolution = '540p';

    if (finalResolution && modelConfig.supportedResolutions.includes(finalResolution)) {
      body.resolution = finalResolution;
    }
    if (params.aspectRatio && modelConfig.supportedAspectRatios.includes(params.aspectRatio)) {
      body.aspect_ratio = params.aspectRatio;
    }
    if (params.seed !== undefined && params.seed > 0) {
      body.seed = params.seed;
    }
    if (modelConfig.supportsAudio && model.startsWith('viduq3')) {
      body.audio = params.generateAudio === true;
    }
    if (params.promptEnhancer === true) {
      body.prompt_enhancer = true;
    }
    if (params.cameraMovement && params.cameraMovement !== 'auto') {
      body.camera_movement = params.cameraMovement;
    }
    if (params.referenceType) {
      body.reference_type = params.referenceType;
    }
    if (params.characterConsistency !== undefined && params.characterConsistency > 0) {
      body.character_consistency = params.characterConsistency;
    }
    if (params.styleStrength !== undefined && params.styleStrength > 0) {
      body.style_strength = params.styleStrength;
    }
    if (params.videoPreset) {
      body.video_preset = params.videoPreset;
    }
    appendViduOfficialFields(body, params, { includeVisual: true, includeAudio: true });

    logger.info(`[ViduProvider] Request to ${endpoint}: model=${officialModelId}, duration=${duration}, mode=${generationMode}, body=${JSON.stringify(body)}`);

    const data = await this.apiPost(`${baseUrl}${endpoint}`, body as Record<string, any>, this.getHeaders(config));

    logger.debug(`[ViduProvider] Official API Response for ${endpoint}:`, JSON.stringify(data, null, 2));

    if (data.error) {
      return {
        taskId: '',
        status: 'failed',
        provider: this.name,
        model,
        error: `Vidu API错误: ${JSON.stringify(data.error)}`,
      };
    }

    const taskId = data.task_id || data.id || data.request_id;
    if (!taskId) {
      logger.error(`[ViduProvider] Missing task_id in response: ${JSON.stringify(data).substring(0, 500)}`);
      return {
        taskId: '',
        status: 'failed',
        provider: this.name,
        model,
        error: `Vidu API未返回task_id: ${JSON.stringify(data).substring(0, 500)}`,
      };
    }

    return this.makePendingResult(taskId, model, data);
  }

  private async generateTemplateStory(
    params: VideoParams,
    config: ApiProviderConfig,
    baseUrl: string
  ): Promise<GenerationResult> {
    const story = params.templateStory;
    if (!story) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template-story', error: '缺少模板成片参数 (templateStory)' };
    }

    const images: string[] = [];
    if (params.imageUrl || params.firstFrameUrl) {
      images.push(params.imageUrl || params.firstFrameUrl || '');
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      images.push(...params.referenceImages);
    }
    if (images.length === 0) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template-story', error: '模板成片需要至少提供一张图片' };
    }

    const body: Record<string, unknown> = { story, images };
    if (params.prompt && !params.payload) body.payload = params.prompt;
    appendViduOfficialFields(body, params, { includeTemplate: true });

    const data = await this.apiPost(`${baseUrl}/ent/v2/template-story`, body as Record<string, any>, this.getHeaders(config));
    logger.debug(`[ViduProvider] Template-Story API Response:`, JSON.stringify(data, null, 2));

    if (data.error) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template-story', error: `Vidu API错误: ${JSON.stringify(data.error)}` };
    }

    const taskId = data.task_id || data.id;
    if (!taskId) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template-story', error: `Vidu API未返回task_id: ${JSON.stringify(data).substring(0, 500)}` };
    }

    return this.makePendingResult(taskId, 'template-story', data);
  }

  private async generateTemplate(
    params: VideoParams,
    config: ApiProviderConfig,
    baseUrl: string
  ): Promise<GenerationResult> {
    const template = params.templateName;
    if (!template) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template', error: '缺少场景特效模板参数 (templateName)' };
    }

    const images: string[] = [];
    if (params.imageUrl || params.firstFrameUrl) {
      images.push(params.imageUrl || params.firstFrameUrl || '');
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      images.push(...params.referenceImages);
    }
    if (images.length === 0) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template', error: '场景特效模板需要至少提供一张图片' };
    }

    const body: Record<string, unknown> = { template, images };
    if (params.prompt) body.prompt = params.prompt;
    if (params.seed && params.seed > 0) body.seed = params.seed;
    if (params.aspectRatio) body.aspect_ratio = params.aspectRatio;
    if (params.templateArea) body.area = params.templateArea;
    if (params.templateBeast) body.beast = params.templateBeast;
    if (params.templateBgm !== undefined) body.bgm = params.templateBgm;
    appendViduOfficialFields(body, params, { includeTemplate: true });

    const data = await this.apiPost(`${baseUrl}/ent/v2/template`, body as Record<string, any>, this.getHeaders(config));
    logger.debug(`[ViduProvider] Template API Response:`, JSON.stringify(data, null, 2));

    if (data.error) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template', error: `Vidu API错误: ${JSON.stringify(data.error)}` };
    }

    const taskId = data.task_id || data.id;
    if (!taskId) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'template', error: `Vidu API未返回task_id: ${JSON.stringify(data).substring(0, 500)}` };
    }

    return this.makePendingResult(taskId, 'template', data);
  }

  private async generateOneClick(
    params: VideoParams,
    config: ApiProviderConfig,
    baseUrl: string
  ): Promise<GenerationResult> {
    const images: string[] = [];
    if (params.imageUrl || params.firstFrameUrl) {
      images.push(params.imageUrl || params.firstFrameUrl || '');
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      images.push(...params.referenceImages.slice(0, 7 - images.length));
    }
    if (images.length === 0) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'one-click', error: '一键通用成片需要至少提供一张图片' };
    }

    const duration = Math.max(params.duration || 10, 10);
    if (duration < 10 || duration > 180) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'one-click', error: '时长需在10-180秒之间' };
    }

    const body: Record<string, unknown> = { images, duration };
    if (params.prompt) body.prompt = params.prompt;
    if (params.aspectRatio) body.aspect_ratio = params.aspectRatio;
    appendViduOfficialFields(body, params, { includeTemplate: true });

    const data = await this.apiPost(`${baseUrl}/ent/v2/one-click/general_one_click`, body as Record<string, any>, this.getHeaders(config));
    logger.debug(`[ViduProvider] One-Click API Response:`, JSON.stringify(data, null, 2));

    if (data.error) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'one-click', error: `Vidu API错误: ${JSON.stringify(data.error)}` };
    }

    const taskId = data.task_id || data.id;
    if (!taskId) {
      return { taskId: '', status: 'failed', provider: this.name, model: 'one-click', error: `Vidu API未返回task_id: ${JSON.stringify(data).substring(0, 500)}` };
    }

    return this.makePendingResult(taskId, 'one-click', data);
  }

  async generateImage(_params: ImageParams, _config: ApiProviderConfig): Promise<GenerationResult> {
    return {
      taskId: '',
      status: 'failed',
      provider: this.name,
      error: 'Vidu 不支持图片生成',
    };
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const model = config.model || '';

      if (model === 'one-click' || model === 'template' || model === 'template-story') {
        return this.getOneClickTaskStatus(taskId, config, baseUrl);
      }

      return this.getViduOfficialTaskStatus(taskId, config, baseUrl);
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }

  private async getOneClickTaskStatus(
    taskId: string,
    config: ApiProviderConfig,
    baseUrl: string
  ): Promise<GenerationResult> {
    try {
      const data = await this.apiGetWithRetry(`${baseUrl}/ent/v2/one-click/general_one_click/${taskId}`, this.getHeaders(config), 30000, 2, 1000);

      const statusMap: Record<string, GenerationResult['status']> = {
        created: 'pending',
        processing: 'processing',
        success: 'completed',
        failed: 'failed',
      };

      const status = this.mapStatus(data.state || data.status, statusMap);

      const videoUrl = data.signed_url
        || data.creations?.[0]?.url
        || data.job_records?.[0]?.jobs?.[0]?.signed_url;

      const thumbnailUrl = data.creations?.[0]?.cover_url
        || data.job_records?.[0]?.jobs?.[0]?.cover_url
        || undefined;

      const errorMsg = data.err_msg
        || (data.err_code ? `Vidu错误: ${data.err_code}` : undefined)
        || (data.state === 'failed' ? 'Vidu任务执行失败' : undefined);

      return {
        taskId,
        status,
        provider: this.name,
        result: videoUrl ? {
          videoUrl,
          url: videoUrl,
          thumbnailUrl,
          metadata: data,
        } : {
          metadata: data,
        },
        error: errorMsg,
        progress: status === 'processing' ? (data.progress || 50) : status === 'completed' ? 100 : 0,
      };
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }

  private async getViduOfficialTaskStatus(
    taskId: string,
    config: ApiProviderConfig,
    baseUrl: string
  ): Promise<GenerationResult> {
    try {
      const data = await this.apiGetWithRetry(`${baseUrl}/ent/v2/tasks/${taskId}/creations`, this.getHeaders(config), 30000, 2, 1000);

      const statusMap: Record<string, GenerationResult['status']> = {
        created: 'pending',
        queueing: 'pending',
        processing: 'processing',
        success: 'completed',
        failed: 'failed',
      };

      const status = this.mapStatus(data.state || data.status, statusMap);

      const videoUrl = data.creations?.[0]?.url
        || data.creations?.videos?.[0]?.url
        || data.result?.video?.url
        || data.video_url;

      const thumbnailUrl = data.creations?.[0]?.cover_url
        || data.creations?.[0]?.thumbnail_url
        || data.creations?.videos?.[0]?.cover_url
        || data.result?.video?.cover_url
        || data.cover_url
        || undefined;

      const errorMsg = data.error?.message 
        || (data.err_code ? `Vidu错误: ${data.err_code}${data.err_msg ? ` (${data.err_msg})` : ''}` : undefined)
        || (data.state === 'failed' ? 'Vidu任务执行失败' : undefined);

      return {
        taskId,
        status,
        provider: this.name,
        result: videoUrl ? {
          videoUrl,
          url: videoUrl,
          thumbnailUrl,
          metadata: data,
        } : {
          metadata: data,
        },
        error: errorMsg,
        progress: status === 'processing' ? (data.progress || 50) : status === 'completed' ? 100 : 0,
      };
    } catch (error: unknown) {
      return this.makeFailedTaskResult(taskId, error);
    }
  }
}
