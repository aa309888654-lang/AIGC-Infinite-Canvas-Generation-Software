/**
 * 豆包视频/图片生成适配器 - 增强版
 * 集成统一错误处理、智能重试和最新模型支持
 */

import { BaseGenerator, GeneratorConfig } from '@/services/adapters/base';
import { ImageParams, VideoParams, TaskStatusParams } from '@/types/adapter';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';
import { VideoGenerationError, VideoGenerationErrorCode, mapProviderError, withRetry, DEFAULT_RETRY_CONFIG } from './video-error-types';

function convertResolution(resolution: string | undefined, defaultRes: string = '720p'): string {
  if (!resolution) return defaultRes;
  const sizeMap: Record<string, string> = {
    '480p': '480p',
    '720p': '720p',
    '1080p': '1080p',
    '16:9': '1080p',
    '9:16': '720p',
    '1:1': '720p',
    '4:3': '720p',
    '21:9': '1080p',
    '3:4': '720p',
    '4:5': '720p',
  };
  return sizeMap[resolution] || defaultRes;
}

function getModelCapabilities(modelId: string): {
  version: string;
  maxDuration: number;
  supportsAudio: boolean;
  supportedResolutions: string[];
  supportsVideoReference: boolean;
  supportsAudioReference: boolean;
  maxImageReferences: number;
  maxVideoReferences: number;
  maxAudioReferences: number;
} {
  const lowerId = modelId.toLowerCase();

  // Seedance 1.5 Pro (V3 API)
  if (lowerId.includes('seedance-1-5-pro')) {
    return {
      version: '1.5',
      maxDuration: 12,
      supportsAudio: true, // 1.5 Pro 官方文档显示支持
      supportedResolutions: ['480p', '720p', '1080p'],
      supportsVideoReference: false,
      supportsAudioReference: false,
      maxImageReferences: 1,
      maxVideoReferences: 0,
      maxAudioReferences: 0,
    };
  }
  // Seedance 1.0 Pro / Pro Fast
  if (modelId.includes('seedance-1-0-pro') || modelId.includes('Seedance-1.0-pro')) {
    return {
      version: '1.0',
      maxDuration: modelId.includes('fast') ? 12 : 12,
      supportsAudio: true,
      supportedResolutions: modelId.includes('fast') ? ['1080p'] : ['1080p'],
      supportsVideoReference: false,
      supportsAudioReference: false,
      maxImageReferences: 1,
      maxVideoReferences: 0,
      maxAudioReferences: 0,
    };
  }
  // Seedance 1.0 Lite
  if (modelId.includes('seedance-1-0-lite') || modelId.includes('Seedance-1.0-lite')) {
    return {
      version: '1.0',
      maxDuration: 12,
      supportsAudio: false,
      supportedResolutions: ['480p', '720p'],
      supportsVideoReference: false,
      supportsAudioReference: false,
      maxImageReferences: modelId.includes('i2v') ? 4 : 0,
      maxVideoReferences: 0,
      maxAudioReferences: 0,
    };
  }
  // 默认配置
  return {
    version: '1.5',
    maxDuration: 12,
    supportsAudio: true,
    supportedResolutions: ['480p', '720p', '1080p'],
    supportsVideoReference: false,
    supportsAudioReference: false,
    maxImageReferences: 1,
    maxVideoReferences: 0,
    maxAudioReferences: 0,
  };
}

interface DoubaoResponse {
  id?: string;
  status?: string;
  error?: string | { message?: string; code?: string };
  output?: {
    task_id?: string;
    status?: string;
    progress?: number;
    image_url?: string;
    video_url?: string;
  };
  content?: {
    video_url?: string;
    image_url?: string;
  };
}

type DoubaoContentItem =
  | { type: 'text'; text: string }
  | {
      type: 'image_url';
      image_url: { url: string };
      role?: 'first_frame' | 'last_frame' | 'reference_image';
    }
  | { type: 'video_url'; video_url: { url: string }; role: 'reference_video' }
  | { type: 'audio_url'; audio_url: { url: string }; role: 'reference_audio' };

const MODEL_ID_MAP: Record<string, string> = {
  'doubao-seedance-1-5-pro': 'doubao-seedance-1-5-pro-251215',
};

export class DoubaoVideoAdapter extends BaseGenerator {
  private modelId: string;
  private modelType: 'image' | 'video';

  constructor(
    config:
      | string
      | { accessKey: string; secretKey: string }
      | { apiKey?: string; customBaseUrl?: string; [key: string]: any },
    modelId: string = 'doubao-seedance-1-5-pro',
    modelType: 'image' | 'video' = 'video'
  ) {
    const isDev = import.meta.env.DEV;
    // 所有环境统一走后端代理，不暴露外部API地址
    let baseUrl = '/api/v3';
    let apiKey: string | undefined;

    if (typeof config === 'object' && config) {
      const cfg = config as any;

      if (cfg.customBaseUrl) {
        const customUrl = cfg.customBaseUrl.trim().replace(/`/g, '').replace(/"/g, '');
        if (customUrl.startsWith('http://') || customUrl.startsWith('https://')) {
          if (!isDev) {
            baseUrl = customUrl;
          }
        } else {
          console.warn('[DoubaoVideoAdapter] URL格式无效，使用默认URL:', customUrl);
        }
      }

      apiKey = cfg.apiKey || cfg.API_KEY || cfg.key || cfg.accessKey;
      if (!apiKey) {
        console.error('[DoubaoVideoAdapter] ⚠️ 未找到 API Key，config keys:', Object.keys(cfg));
      }
    }

    if (typeof config === 'string') {
      apiKey = config;
    }

    // 构建配置并调用父类
    const generatorConfig: GeneratorConfig = {
      apiKey,
      baseUrl,
      providerName: 'doubao-video',
      accessKey: typeof config === 'object' ? config.accessKey : undefined,
      secretKey: typeof config === 'object' ? config.secretKey : undefined,
    };

    super(generatorConfig);

    this.modelId = MODEL_ID_MAP[modelId] || modelId;
    this.modelType = modelType;

    if (!this.apiKey) {
      console.error('[DoubaoVideoAdapter] ⚠️ apiKey 为空！请求将会失败 (403)');
    } else {
      // console.log(
      //   `[DoubaoVideoAdapter] 初始化成功: model=${this.modelId}, key=${this.apiKey.substring(0, 8)}...`
      // );
    }
  }

  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      const endpoint = '/images/generations';
      const body: Record<string, any> = {
        model: this.modelId,
        size: this.convertAspectRatioToSize(params.aspectRatio),
        quality: params.quality || 'standard',
        n: 1,
      };

      // 根据生成模式构建请求体
      const generationMode = params.generationMode || 'text_to_image';

      if (generationMode === 'text_to_image') {
        // 文生图模式
        body.prompt = params.prompt || '';
      } else if (generationMode === 'image_to_image') {
        // 图生图模式
        body.prompt = params.prompt || '';
        if (params.referenceImage) {
          body.image = params.referenceImage;
        } else if (params.referenceImages && params.referenceImages.length > 0) {
          body.image = params.referenceImages[0];
        }
      } else if (generationMode === 'reference') {
        // 参考图模式
        body.prompt = params.prompt || '';
        if (params.referenceImage) {
          body.image = params.referenceImage;
        } else if (params.referenceImages && params.referenceImages.length > 0) {
          body.image = params.referenceImages[0];
        }
      }

      const response = await this.postRequest<DoubaoResponse>(endpoint, body);
      return this.createPendingResult(response.id || response.output?.task_id || '');
    } catch (error) {
      return this.createFailedResult(error);
    }
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      // 模型能力检测
      const modelCaps = getModelCapabilities(this.modelId);
      const isLiteModel = this.modelId.includes('lite');

      const generationMode = params.generationMode || 'text_to_video';

      // 模式验证和警告
      if (generationMode === ('reference_to_video' as any) && !isLiteModel) {
        console.warn(
          '[DoubaoVideoAdapter] 参考图模式(reference_to_video)仅支持Lite模型，当前模型可能不支持'
        );
      }

      if (generationMode === 'video_to_video') {
        console.warn('[DoubaoVideoAdapter] video_to_video模式非官方API标准，将作为参考图模式处理');
      }

      // 检查必需的图片参数
      if (
        (generationMode === 'image_to_video' || generationMode === 'first_last_frame') &&
        !params.referenceImage &&
        !params.startImage &&
        (!params.referenceImages || params.referenceImages.length === 0)
      ) {
        throw new VideoGenerationError(
          VideoGenerationErrorCode.INVALID_PARAMETERS,
          `模式 ${generationMode} 需要提供参考图片`,
          400
        );
      }
      const content: DoubaoContentItem[] = [];

      // 添加文本提示词
      if (params.prompt) {
        content.push({ type: 'text', text: params.prompt });
      }

      // 根据生成模式构建内容（基于官方API文档）
      if (generationMode === 'image_to_video') {
        // 图生视频-首帧模式：使用单张图片作为首帧
        const imageUrl = params.referenceImage || params.startImage;
        if (imageUrl) {
          content.push({
            type: 'image_url',
            image_url: { url: imageUrl },
            role: 'first_frame',
          });
        } else {
          console.warn('[DoubaoVideoAdapter] 图生视频模式但未提供参考图片！');
        }
      } else if (generationMode === 'first_last_frame') {
        // 图生视频-首尾帧模式：需要两张图片
        if (params.startImage) {
          content.push({
            type: 'image_url',
            image_url: { url: params.startImage },
            role: 'first_frame',
          });
        }
        if (params.endImage) {
          content.push({
            type: 'image_url',
            image_url: { url: params.endImage },
            role: 'last_frame',
          });
        }

        // 如果没有startImage/endImage但有referenceImage，尝试兼容处理
        if (!params.startImage && !params.endImage && params.referenceImage) {
          content.push({
            type: 'image_url',
            image_url: { url: params.referenceImage },
            role: 'first_frame',
          });
        }

        // 兼容：如果有多张参考图，前两张作为首尾帧
        if (params.referenceImages && params.referenceImages.length >= 2 && !params.startImage) {
          content.splice(1); // 清除之前可能添加的内容
          content.push({
            type: 'image_url',
            image_url: { url: params.referenceImages[0] },
            role: 'first_frame',
          });
          content.push({
            type: 'image_url',
            image_url: { url: params.referenceImages[1] },
            role: 'last_frame',
          });
        }
      } else if ((generationMode as string) === 'reference_to_video') {
        const refImages =
          params.referenceImages || (params.referenceImage ? [params.referenceImage] : []);
        const refVideos = params.referenceVideos || (params.videoInput ? [params.videoInput] : []);
        const refAudios = params.referenceAudios || [];

        if (refImages.length === 0 && refVideos.length === 0) {
          throw new VideoGenerationError(
            VideoGenerationErrorCode.INVALID_PARAMETERS,
            '多模态参考模式至少需要 1 张参考图或 1 段参考视频',
            400
          );
        }

        for (const refImage of refImages.slice(0, modelCaps.maxImageReferences)) {
          content.push({
            type: 'image_url',
            image_url: { url: refImage },
            role: 'reference_image',
          });
        }

        if (modelCaps.supportsVideoReference) {
          for (const refVideo of refVideos.slice(0, modelCaps.maxVideoReferences)) {
            content.push({
              type: 'video_url',
              video_url: { url: refVideo },
              role: 'reference_video',
            });
          }
        }

        if (modelCaps.supportsAudioReference) {
          for (const refAudio of refAudios.slice(0, modelCaps.maxAudioReferences)) {
            content.push({
              type: 'audio_url',
              audio_url: { url: refAudio },
              role: 'reference_audio',
            });
          }
        }
      } else if (generationMode === 'video_to_video') {
        // 视频风格转换（非官方标准模式，尝试用参考图实现）
        console.warn('[DoubaoVideoAdapter] video_to_video模式非官方API标准，将作为参考图模式处理');

        if (params.referenceImages?.length > 0) {
          for (const refImage of params.referenceImages) {
            content.push({
              type: 'image_url',
              image_url: { url: refImage },
              role: 'reference_image',
            });
          }
        } else if (params.referenceImage) {
          content.push({
            type: 'image_url',
            image_url: { url: params.referenceImage },
            role: 'reference_image',
          });
        }
      }

      // 确保至少有一个内容元素
      if (content.length === 0) {
        content.push({ type: 'text', text: params.prompt || '' });
      }

      // 构建请求体（基于官方API文档格式）
      const endpoint = '/contents/generations/tasks';

      // 基础参数（所有模型通用）
      const requestedResolution = convertResolution(params.resolution, '720p');
      const normalizedResolution = modelCaps.supportedResolutions.includes(requestedResolution)
        ? requestedResolution
        : modelCaps.supportedResolutions[modelCaps.supportedResolutions.length - 1] || '720p';

      const normalizedDuration =
        params.duration === -1 ? -1 : Math.min(params.duration || 5, modelCaps.maxDuration);

      const baseParams: Record<string, any> = {
        duration: normalizedDuration,
        resolution: normalizedResolution,
        watermark: (params as any).watermark !== undefined ? (params as any).watermark : false,
      };

      // 模型特定参数
      if (modelCaps.version !== '1.0' && modelCaps.version !== '2.0') {
        // Seedance 1.5 支持camera_fixed和motion参数
        baseParams.camera_fixed =
          (params as any).cameraFixed !== undefined ? (params as any).cameraFixed : false;
        if ((params as any).motion !== undefined && (params as any).motion !== -1) {
          baseParams.motion = (params as any).motion;
        }
      }

      // 支持音频生成的模型
      if (modelCaps.supportsAudio && params.generateAudio !== undefined) {
        baseParams.generate_audio = params.generateAudio;
      }

      // 宽高比参数（根据内容自动推断或使用用户指定）
      if (params.aspectRatio) {
        const ratioMap: Record<string, string> = {
          adaptive: 'adaptive',
          '16:9': '16:9',
          '9:16': '9:16',
          '1:1': '1:1',
          '4:3': '4:3',
          '3:4': '3:4',
          '21:9': '21:9',
        };
        baseParams.ratio = ratioMap[params.aspectRatio] || 'adaptive';
      } else {
        baseParams.ratio = 'adaptive';
      }

      // 可选参数：seed
      if (params.seed !== undefined && params.seed !== -1) {
        baseParams.seed = params.seed;
      }

      if (params.returnLastFrame) {
        baseParams.return_last_frame = true;
      }

      if (params.enableWebSearch && modelCaps.version === '2.0') {
        baseParams.tools = [{ type: 'web_search' }];
      }

      const body: Record<string, any> = {
        model: this.modelId,
        content,
        ...baseParams,
      };

      // 使用智能重试机制发送请求
      const response = await withRetry(() => this.postRequest<DoubaoResponse>(endpoint, body), {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 2,
      } as any);

      if (response.error) {
        throw mapProviderError(response.error, 'doubao');
      }

      return this.createPendingResult(response.id || response.output?.task_id || '');
    } catch (error) {
      console.error('[DoubaoVideoAdapter.generateVideo] 视频生成失败:', error);

      // 转换为统一错误类型
      const videoError =
        error instanceof VideoGenerationError ? error : mapProviderError(error, 'doubao');

      return this.createFailedResult(videoError);
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const endpoint =
        this.modelType === 'video'
          ? `/contents/generations/tasks/${params.taskId}`
          : `/images/generations/${params.taskId}`;

      const response = await this.getRequest<DoubaoResponse>(endpoint);

      const status = this.mapStatus(response.status || response.output?.status || 'pending');
      const progress =
        response.output?.progress ||
        (status === 'processing' ? 50 : status === 'completed' ? 100 : 0);

      let outputUrl = '';
      if (this.modelType === 'video') {
        outputUrl = (response as any).content?.video_url || response.output?.video_url || '';
      } else {
        outputUrl = (response as any).content?.image_url || response.output?.image_url || '';
      }

      return {
        status,
        progress,
        message: this.getStatusMessage(response.status || response.output?.status || 'pending'),
        timestamp: new Date(),
        output: outputUrl,
      };
    } catch (error) {
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '获取状态失败',
        timestamp: new Date(),
      };
    }
  }

  private mapStatus(status: string): TaskStatusResult['status'] {
    const statusMap: Record<string, TaskStatusResult['status']> = {
      pending: 'pending',
      queued: 'pending',
      wait: 'pending',
      processing: 'processing',
      running: 'processing',
      doing: 'processing',
      completed: 'completed',
      succeed: 'completed',
      success: 'completed',
      succeeded: 'completed',
      failed: 'failed',
      fail: 'failed',
      error: 'failed',
    };
    return statusMap[(status || '').toLowerCase()] || 'pending';
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: '任务等待中...',
      queued: '任务排队中...',
      processing: '处理中...',
      running: '运行中...',
      completed: '生成完成',
      succeed: '生成成功',
      succeeded: '生成成功',
      success: '生成成功',
      failed: '生成失败',
    };
    return messages[(status || '').toLowerCase()] || '状态: ' + status;
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
        case 'completed':
          return {
            taskId,
            status: 'completed',
            resultUrl: (statusResult.output as string) || '',
          };
        case 'failed':
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
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
          break;
      }
    }

    return {
      taskId,
      status: 'failed',
      error: '任务超时',
    };
  }

  getModels(): { id: string; name: string }[] {
    return [{ id: 'default-model', name: '默认模型' }];
  }
}
