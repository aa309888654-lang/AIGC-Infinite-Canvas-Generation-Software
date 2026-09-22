/**
 * 豆包AI生成器
 */

import { BaseGenerator, GeneratorConfig } from '@/services/adapters/base';
import {
  ImageParams,
  VideoParams,
  TaskStatusParams,
} from '@/types/adapter';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';


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

interface DoubaoResponse {
  id?: string;
  model?: string;
  created?: number;
  data?: Array<{
    url?: string;
    size?: string;
  }>;
  output?: {
    task_id?: string;
    status?: string;
    progress?: number;
    image_url?: string;
    video_url?: string;
  };
  status?: string;
}

export class DoubaoGenerator extends BaseGenerator {
  private modelId: string;

  constructor(
    config: string | { accessKey: string; secretKey: string },
    modelId: string = 'ep-20260321212919-vfr2q'
  ) {
    // 所有环境统一走后端代理，不暴露外部API地址
    const baseUrl = '/api/v3';

    // 移除不正确的内置 KEY 默认值
    const effectiveConfig = config;

    if (typeof effectiveConfig === 'string') {
      const generatorConfig: GeneratorConfig = {
        apiKey: effectiveConfig,
        baseUrl,
        providerName: 'doubao'
      };
      super(generatorConfig);
    } else {
      const generatorConfig: GeneratorConfig = {
        baseUrl,
        providerName: 'doubao',
        accessKey: effectiveConfig.accessKey,
        secretKey: effectiveConfig.secretKey
      };
      super(generatorConfig);
    }
    
    this.modelId = modelId;
  }

  protected convertAspectRatioToSize(aspectRatio?: string): string {
    if (!aspectRatio) return '1024x1024';
    switch (aspectRatio) {
      case '1:1': return '1024x1024';
      case '3:4': return '768x1024';
      case '4:3': return '1024x768';
      case '16:9': return '1024x576';
      case '9:16': return '576x1024';
      case '21:9': return '1024x426';
      case '3:2': return '1024x682';
      case '2:3': return '682x1024';
      case '4:5': return '819x1024';
      case '5:4': return '1024x819';
      default: return '1024x1024';
    }
  }

  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      const endpoint = '/images/generations';
      const body: Record<string, any> = {
        model: this.modelId,
        size: this.convertAspectRatioToSize(params.aspectRatio),
        quality: params.quality || 'standard',
        n: 1
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
      
      // 处理同步响应（直接返回图片URL）
      if (response.data && response.data.length > 0 && response.data[0].url) {
        const taskId = `doubao-${Date.now()}`;
        return {
          taskId,
          status: 'completed',
          resultUrl: response.data[0].url,
          progress: 100
        };
      }
      
      // 处理异步任务响应
      const taskId = response.id || response.output?.task_id || '';
      return this.createPendingResult(taskId);
    } catch (error) {
      console.error('[DoubaoGenerator.generateImage] 捕获到错误:', error);
      console.error('[DoubaoGenerator.generateImage] 错误类型:', typeof error);
      console.error('[DoubaoGenerator.generateImage] 错误消息:', error instanceof Error ? error.message : String(error));
      console.error('[DoubaoGenerator.generateImage] 错误堆栈:', error instanceof Error ? error.stack : 'no stack');
      return this.createFailedResult(error);
    }
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      const endpoint = '/contents/generations/tasks';
      const body = {
        model: this.modelId,
        content: [{ type: 'text', text: params.prompt || '' }],
        params: {
          duration: params.duration || 5,
          fps: params.fps || 24,
          resolution: convertResolution(params.resolution, '720p'),
          watermark: true
        }
      };
      
      const response = await this.postRequest<DoubaoResponse>(endpoint, body);
      return this.createPendingResult(response.id || response.output?.task_id || '');
    } catch (error) {
      return this.createFailedResult(error);
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const endpoint = `/images/generations/${params.taskId}`;
      const response = await this.getRequest<DoubaoResponse>(endpoint);
      
      const status = this.mapStatus(response.status || response.output?.status || 'pending');
      const progress = response.output?.progress || (status === 'processing' ? 50 : status === 'completed' ? 100 : 0);
      
      return {
        status,
        progress,
        message: this.getStatusMessage(response.status || response.output?.status || 'pending'),
        timestamp: new Date(),
        output: response.output?.image_url || response.output?.video_url
      };
    } catch (error) {
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '获取状态失败',
        timestamp: new Date()
      };
    }
  }

  private mapStatus(status: string): TaskStatusResult['status'] {
    const statusMap: Record<string, TaskStatusResult['status']> = {
      pending: 'pending', queued: 'pending', wait: 'pending',
      processing: 'processing', running: 'processing', doing: 'processing',
      completed: 'completed', succeed: 'completed', success: 'completed',
      failed: 'failed', fail: 'failed', error: 'failed'
    };
    return statusMap[(status || '').toLowerCase()] || 'pending';
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: '任务等待中...', queued: '任务排队中...',
      processing: '处理中...', running: '运行中...',
      completed: '生成完成', succeed: '生成成功',
      failed: '生成失败'
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
            resultUrl: statusResult.output as string || '',
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
            await new Promise(resolve => setTimeout(resolve, intervalMs));
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
    return [
      { id: 'default-model', name: '默认模型' }
    ];
  }}
