import { BaseGenerator, GeneratorConfig } from '@/services/adapters/base';
import {
  VideoParams,
  ImageParams,
  TaskStatusParams,
} from '@/types/adapter';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';

interface ViduQ2Response {
  status: string;
  state?: string;
  task_id?: string;
  request_id?: string;
  id?: string;
  response_url?: string;
  status_url?: string;
  cancel_url?: string;
  progress?: number;
  metrics?: {
    inference_time: number;
  };
  result?: {
    video?: {
      url: string;
      content_type: string;
    };
  };
  creations?: {
    videos?: Array<{ url: string }>;
  };
  error?: {
    message: string;
    code: string;
  };
}

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

// 所有环境统一走后端代理，不暴露外部API地址
const VIDU_OFFICIAL_BASE_URL = '/vidu-api';

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
    maxDuration: 16,
    supportedResolutions: ['720p', '1080p'],
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
};

function isViduOfficialModel(modelId: string): boolean {
  return modelId in VIDU_MODELS;
}

export class ViduQ2Adapter extends BaseGenerator {
  private modelId: string;
  private useOfficialApi: boolean;

  constructor(
    config: string | { apiKey?: string; customBaseUrl?: string; [key: string]: any },
    modelId: string = 'viduq3-pro'
  ) {
    let baseUrl = VIDU_OFFICIAL_BASE_URL;
    let apiKey: string | undefined;

    if (typeof config === 'object' && config) {
      if (config.customBaseUrl) {
        const customUrl = config.customBaseUrl.trim().replace(/`/g, '').replace(/"/g, '');
        if (customUrl.startsWith('http://') || customUrl.startsWith('https://')) {
          baseUrl = customUrl.replace(/\/v1\/?$/, '').replace(/\/ent\/?$/, '');
        }
      }
      apiKey = config.apiKey || config.API_KEY || config.key;
    }

    if (typeof config === 'string') {
      apiKey = config;
    }

    const generatorConfig: GeneratorConfig = {
      apiKey,
      baseUrl,
      providerName: 'vidu',
    };

    super(generatorConfig);
    this.modelId = modelId;
    this.useOfficialApi = isViduOfficialModel(modelId) && baseUrl.includes('vidu.cn');
  }

  async generateImage(_params: ImageParams): Promise<GenerationResult> {
    console.warn('[ViduQ2Adapter] generateImage not supported');
    return {
      taskId: '',
      status: 'failed',
      error: 'Vidu 不支持图片生成',
    };
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      if (this.useOfficialApi) {
        return this.generateViduOfficialVideo(params);
      }

      return this.generateLegacyVideo(params);
    } catch (error) {
      console.error('[ViduQ2Adapter] 视频生成失败:', error);
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : '视频生成失败',
      };
    }
  }

  private inferGenerationMode(params: VideoParams): string {
    if (params.generationMode) return params.generationMode;
    if (params.startImage && params.endImage) return 'first_last_frame';
    if (params.referenceImages?.length || params.referenceVideos?.length) return 'reference_to_video';
    if (params.referenceImage || params.startImage) return 'image_to_video';
    return 'text_to_video';
  }

  private async generateViduOfficialVideo(params: VideoParams): Promise<GenerationResult> {
    const modelConfig = VIDU_MODELS[this.modelId];
    if (!modelConfig) {
      return {
        taskId: '',
        status: 'failed',
        error: `不支持的 Vidu 模型: ${this.modelId}`,
      };
    }

    const generationMode = params.generationMode || this.inferGenerationMode(params);
    let endpoint: string;
    let officialModelId = this.modelId;
    let body: Record<string, any>;

    let duration = Math.min(params.duration || 5, modelConfig.maxDuration);
    if (duration < 1) duration = 1;

    if (generationMode === 'first_last_frame' && modelConfig.supportsStartEnd) {
      endpoint = '/ent/v2/start-end2video';
      if (officialModelId === 'viduq3-pro-fast') officialModelId = 'viduq3-pro';
      else if (officialModelId === 'viduq2') officialModelId = 'viduq2-pro';
      const images: string[] = [];
      if (params.startImage || params.referenceImage) {
        images.push(params.startImage || params.referenceImage || '');
      }
      if (params.endImage) {
        images.push(params.endImage);
      }
      body = {
        model: officialModelId,
        images,
        prompt: params.prompt || '',
        duration,
      };
    } else if (generationMode === 'reference_to_video' && modelConfig.supportsReference) {
      endpoint = '/ent/v2/reference2video';
      if (officialModelId === 'viduq3-pro' || officialModelId === 'viduq3-pro-fast') officialModelId = 'viduq3';
      else if (officialModelId === 'viduq2-turbo' || officialModelId === 'viduq2-pro-fast') officialModelId = 'viduq2';
      const images: string[] = [];
      if (params.referenceImage || params.startImage) {
        images.push(params.referenceImage || params.startImage || '');
      }
      if (params.referenceImages && params.referenceImages.length > 0) {
        images.push(...params.referenceImages.slice(0, 7 - images.length));
      }
      body = {
        model: officialModelId,
        prompt: params.prompt || '',
        duration,
      };
      if (images.length > 0) {
        body.images = images;
      }
      if (params.referenceVideos && params.referenceVideos.length > 0 && officialModelId === 'viduq2') {
        body.videos = params.referenceVideos.slice(0, 2);
      }
    } else if (generationMode === 'text_to_video' && !params.referenceImage && !params.startImage && !params.referenceImages?.length) {
      endpoint = '/ent/v2/text2video';
      if (officialModelId === 'viduq2-pro' || officialModelId === 'viduq2-turbo' || officialModelId === 'viduq2-pro-fast') officialModelId = 'viduq2';
      else if (officialModelId === 'viduq3-pro-fast') officialModelId = 'viduq3-pro';
      body = {
        model: officialModelId,
        prompt: params.prompt || '',
        duration,
      };
    } else {
      endpoint = '/ent/v2/img2video';
      if (officialModelId === 'viduq2') officialModelId = 'viduq2-pro';
      const images: string[] = [];
      if (params.referenceImage || params.startImage) {
        images.push(params.referenceImage || params.startImage || '');
      }
      body = {
        model: officialModelId,
        images,
        prompt: params.prompt || '',
        duration,
      };
    }

    if (params.resolution && modelConfig.supportedResolutions.includes(params.resolution)) {
      body.resolution = params.resolution;
    }
    if (params.aspectRatio && modelConfig.supportedAspectRatios.includes(params.aspectRatio)) {
      body.aspect_ratio = params.aspectRatio;
    }
    if (params.seed !== undefined && params.seed > 0) {
      body.seed = params.seed;
    }
    if (modelConfig.supportsAudio && officialModelId.startsWith('viduq3')) {
      if (params.generateAudio === false) {
        body.audio = false;
      } else {
        body.audio = true;
      }
    }
    
    // 安全策略：认证由后端代理处理，前端不发送 Token
    const response = await this.postRequest<ViduQ2Response>(endpoint, body);

    if (response.error) {
      throw new Error(`Vidu API错误: ${JSON.stringify(response.error)}`);
    }

    const taskId = response.task_id || response.id || response.request_id;
    if (!taskId) {
      throw new Error('Vidu API未返回task_id');
    }

    return {
      taskId,
      status: 'pending',
    };
  }

  private async generateLegacyVideo(params: VideoParams): Promise<GenerationResult> {
    const generationMode = params.generationMode || 'image_to_video';
    let endpoint: string;
    let body: Record<string, any>;

    if (generationMode === 'first_last_frame') {
      endpoint = '/queue/fal-ai/vidu/q2/start-end-to-video';
      body = {
        model: 'viduq2',
        prompt: params.prompt || '',
        start_image_url: params.startImage || params.referenceImage || '',
        end_image_url: params.endImage || '',
        duration: Math.min(params.duration || 5, 10),
        movement_amplitude: 'auto',
      };
    } else if (generationMode === 'text_to_video' && !params.referenceImage && !params.startImage) {
      endpoint = '/queue/fal-ai/vidu/q2/text-to-video';
      body = {
        model: 'viduq2',
        prompt: params.prompt || '',
        duration: Math.min(params.duration || 5, 10),
        movement_amplitude: 'auto',
      };
    } else {
      endpoint = '/queue/fal-ai/vidu/q2/text-to-video';
      body = {
        model: 'viduq2',
        prompt: params.prompt || '',
        image_url: params.referenceImage || params.startImage || '',
        duration: Math.min(params.duration || 5, 10),
        movement_amplitude: 'auto',
      };
    }

    if (params.resolution) {
      body.resolution = params.resolution;
    }
    if (params.seed !== undefined && params.seed > 0) {
      body.seed = params.seed;
    }

    const response = await this.postRequest<ViduQ2Response>(endpoint, body);

    if (response.error) {
      throw new Error(`Vidu Legacy API错误: ${JSON.stringify(response.error)}`);
    }

    const taskId = response.request_id || response.id;
    if (!taskId) {
      throw new Error('Vidu Legacy API未返回task_id');
    }

    return {
      taskId,
      status: 'pending',
    };
  }

  async getTaskStatus(taskParams: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      if (this.useOfficialApi) {
        return this.getViduOfficialTaskStatus(taskParams.taskId);
      }

      return this.getLegacyTaskStatus(taskParams.taskId);
    } catch (error) {
      console.error('[ViduQ2Adapter.getTaskStatus] 查询状态失败:', error);
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '查询状态失败',
        timestamp: new Date(),
      };
    }
  }

  private async getViduOfficialTaskStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const endpoint = `/ent/v2/tasks/${taskId}/creations`;
      // 安全策略：认证由后端代理处理
      const response = await this.getRequest<ViduQ2Response>(endpoint);

      const statusMap: Record<string, TaskStatusResult['status']> = {
        created: 'pending',
        queueing: 'pending',
        processing: 'processing',
        success: 'completed',
        failed: 'failed',
      };

      const apiStatus = response.state || response.status;
      const status = statusMap[apiStatus] || 'pending';
      const progress = status === 'processing' ? (response.progress || 50) : status === 'completed' ? 100 : 0;

      let outputUrl = '';
      if (status === 'completed') {
        outputUrl = response.creations?.[0]?.url
          || response.creations?.videos?.[0]?.url
          || response.result?.video?.url
          || '';
      }

      return {
        status,
        progress,
        message: this.getOfficialStatusMessage(apiStatus),
        timestamp: new Date(),
        output: outputUrl,
      };
    } catch (error) {
      console.error('[ViduQ2Adapter.getViduOfficialTaskStatus] 查询状态失败:', error);
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '查询状态失败',
        timestamp: new Date(),
      };
    }
  }

  private async getLegacyTaskStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const endpoint = `/queue/fal-ai/vidu/requests/${taskId}/status`;
      const response = await this.getRequest<ViduQ2Response>(endpoint);

      const statusMap: Record<string, TaskStatusResult['status']> = {
        IN_QUEUE: 'pending',
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        SUCCESS: 'completed',
        FAILED: 'failed',
        ERROR: 'failed',
      };

      const status = statusMap[response.status] || 'pending';
      const progress = status === 'processing' ? 50 : status === 'completed' ? 100 : 0;

      let outputUrl = '';
      if (status === 'completed' && response.result?.video?.url) {
        outputUrl = response.result.video.url;
      }

      return {
        status,
        progress,
        message: this.getLegacyStatusMessage(response.status),
        timestamp: new Date(),
        output: outputUrl,
      };
    } catch (error) {
      console.error('[ViduQ2Adapter.getLegacyTaskStatus] 查询状态失败:', error);
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '查询状态失败',
        timestamp: new Date(),
      };
    }
  }

  async getTaskResult(taskId: string): Promise<{ url: string; contentType: string } | null> {
    try {
      if (this.useOfficialApi) {
        const endpoint = `/ent/v2/tasks/${taskId}/creations`;
      // 安全策略：认证由后端代理处理
      const response = await this.getRequest<ViduQ2Response>(endpoint);

        const videoUrl = response.creations?.[0]?.url
          || response.creations?.videos?.[0]?.url
          || response.result?.video?.url;

        if (videoUrl) {
          return {
            url: videoUrl,
            contentType: 'video/mp4',
          };
        }
        return null;
      }

      const endpoint = `/queue/fal-ai/vidu/requests/${taskId}`;
      const response = await this.getRequest<ViduQ2Response>(endpoint);

      if (response.result?.video?.url) {
        return {
          url: response.result.video.url,
          contentType: response.result.video.content_type || 'video/mp4',
        };
      }

      return null;
    } catch (error) {
      console.error('[ViduQ2Adapter.getTaskResult] 获取结果失败:', error);
      return null;
    }
  }

  async pollTaskStatus(
    taskId: string,
    onProgress?: (progress: number) => void,
    maxRetries: number = 60,
    intervalMs: number = 5000
  ): Promise<GenerationResult> {
    let retries = 0;

    while (retries < maxRetries) {
      const statusResult = await this.getTaskStatus({ taskId });

      if (onProgress && statusResult.progress !== undefined) {
        onProgress(statusResult.progress);
      }

      switch (statusResult.status) {
        case 'completed': {
          const result = await this.getTaskResult(taskId);
          return {
            taskId,
            status: 'completed',
            resultUrl: result?.url || (statusResult.output as string) || '',
          };
        }

        case 'failed':
          console.error('[ViduQ2Adapter.pollTaskStatus] 任务失败:', statusResult.message);
          return {
            taskId,
            status: 'failed',
            error: statusResult.message || '任务失败',
          };

        case 'pending':
        case 'processing':
        default:
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
          break;
      }
    }

    console.warn('[ViduQ2Adapter.pollTaskStatus] 任务超时');
    return {
      taskId,
      status: 'failed',
      error: '任务超时',
    };
  }

  private getOfficialStatusMessage(apiStatus: string): string {
    const messages: Record<string, string> = {
      created: '任务创建成功',
      queueing: '任务排队中...',
      processing: '处理中...',
      success: '生成完成',
      failed: '生成失败',
    };
    return messages[apiStatus] || `状态: ${apiStatus}`;
  }

  private getLegacyStatusMessage(apiStatus: string): string {
    const messages: Record<string, string> = {
      IN_QUEUE: '任务排队中...',
      PENDING: '任务等待中...',
      PROCESSING: '处理中...',
      COMPLETED: '生成完成',
      SUCCESS: '生成成功',
      FAILED: '生成失败',
      ERROR: '发生错误',
    };
    return messages[apiStatus] || `状态: ${apiStatus}`;
  }

  getModels(): { id: string; name: string }[] {
    return Object.keys(VIDU_MODELS).map(id => ({
      id,
      name: `Vidu ${id.replace('vidu', '').replace(/-/g, ' ').toUpperCase()}`,
    }));
  }
}
