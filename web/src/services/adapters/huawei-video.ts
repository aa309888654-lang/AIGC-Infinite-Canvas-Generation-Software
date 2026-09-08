/**
 * 华为云 ModelArts 视频生成适配器
 * 支持 Wan2.2-T2V-A14B 文生视频模型
 */

import { BaseGenerator, GeneratorConfig } from '@/services/adapters/base';
import {
  ImageParams,
  VideoParams,
  TaskStatusParams,
} from '@/types/adapter';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';

interface HuaweiVideoResponse {
  id?: string;
  task_id?: string;
  status?: string;
  error?: {
    code?: string;
    message?: string;
  };
  output?: {
    video_url?: string;
    task_id?: string;
    status?: string;
  };
  data?: {
    task_id?: string;
    status?: string;
    video_url?: string;
  };
}

export class HuaweiVideoAdapter extends BaseGenerator {
  private modelId: string;

  constructor(
    config: string | { accessKey: string; secretKey: string },
    modelId: string = 'Wan2.2-T2V-A14B'
  ) {
    // 所有环境统一走后端代理，不暴露外部API地址
    const baseUrl = '/huawei-api/v1';

    if (typeof config === 'string') {
      const generatorConfig: GeneratorConfig = {
        apiKey: config,
        baseUrl,
        providerName: 'huawei-video'
      };
      super(generatorConfig);
    } else {
      const generatorConfig: GeneratorConfig = {
        baseUrl,
        providerName: 'huawei-video',
        accessKey: config.accessKey,
        secretKey: config.secretKey
      };
      super(generatorConfig);
    }

    this.modelId = modelId;
  }

  async generateImage(_params: ImageParams): Promise<GenerationResult> {
    return this.createFailedResult(new Error('华为云 ModelArts 暂不支持图片生成'));
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      const endpoint = '/video/generations';
      const body: Record<string, any> = {
        model: this.modelId,
        input: {
          prompt: params.prompt || ''
        }
      };

      if (params.duration || params.fps || params.resolution) {
        body.parameters = {};
        if (params.duration) body.parameters.duration = params.duration;
        if (params.fps) body.parameters.fps = params.fps;
        if (params.resolution) {
          const sizeMap: Record<string, string> = {
            '480p': '480x832',
            '720p': '720x1280',
            '1080p': '1080x1920',
            '16:9': '1280x720',
            '9:16': '720x1280',
            '1:1': '1024x1024',
            '4:3': '1024x768',
            '21:9': '1920x816',
            '3:4': '768x1024',
            '4:5': '768x960',
          };
          body.parameters.size = sizeMap[params.resolution] || '720x1280';
        }
        if (params.seed !== undefined) body.parameters.seed = params.seed;
      }

      const response = await this.postRequest<HuaweiVideoResponse>(endpoint, body);

      if (response.error) {
        const errorMsg = response.error.message || response.error.code || '未知错误';
        console.error('[HuaweiVideoAdapter.generateVideo] API返回错误:', errorMsg);
        return this.createFailedResult(new Error(errorMsg));
      }

      const taskId = response.id || response.task_id || response.output?.task_id || '';

      return this.createPendingResult(taskId);
    } catch (error) {
      console.error('[HuaweiVideoAdapter.generateVideo] 视频生成失败:', error);
      return this.createFailedResult(error);
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const endpoint = `/video/generations/${params.taskId}`;

      const response = await this.getRequest<HuaweiVideoResponse>(endpoint);

      const status = this.mapStatus(response.status || response.output?.status || 'pending');

      let outputUrl = '';
      if (status === 'completed') {
        outputUrl = response.output?.video_url || response.data?.video_url || (response as any).video_url || '';
      }

      const progress = status === 'processing' ? 50 : status === 'completed' ? 100 : status === 'failed' ? 0 : 10;

      return {
        status,
        progress,
        message: this.getStatusMessage(status),
        timestamp: new Date(),
        output: outputUrl
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
      pending: 'pending',
      queued: 'pending',
      wait: 'pending',
      running: 'processing',
      processing: 'processing',
      doing: 'processing',
      succeed: 'completed',
      succeeded: 'completed',
      success: 'completed',
      completed: 'completed',
      failed: 'failed',
      fail: 'failed',
      error: 'failed'
    };
    return statusMap[(status || '').toLowerCase()] || 'pending';
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: '任务等待中...',
      queued: '任务排队中...',
      processing: '视频生成中...',
      running: '视频生成中...',
      completed: '生成完成',
      succeeded: '生成完成',
      success: '生成完成',
      failed: '生成失败'
    };
    return messages[status] || '状态: ' + status;
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
