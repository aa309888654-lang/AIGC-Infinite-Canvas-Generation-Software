/**
 * Haiper AI 适配器
 */

import { BaseGenerator, GeneratorConfig } from '@/services/adapters/base';
import {
  ImageParams,
  VideoParams,
  TaskStatusParams,
} from '@/types/adapter';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';

interface HaiperResponse {
  id: string;
  status: string;
  video_url?: string;
  error?: string;
}

export class HaiperAIAdapter extends BaseGenerator {
  constructor(apiKey: string) {
    const generatorConfig: GeneratorConfig = {
      apiKey,
      baseUrl: '/haiper-api/v2',
      providerName: 'haiper-ai'
    };
    super(generatorConfig);
  }

  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      const response = await this.postRequest<HaiperResponse>('/image/generate', {
        prompt: params.prompt || '',
        aspect_ratio: params.aspectRatio || '1:1'
      });
      return this.createPendingResult(response.id);
    } catch (error) {
      return this.createFailedResult(error);
    }
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      const response = await this.postRequest<HaiperResponse>('/video/generate', {
        prompt: params.prompt || '',
        duration: params.duration || 5
      });
      return this.createPendingResult(response.id);
    } catch (error) {
      return this.createFailedResult(error);
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const response = await this.getRequest<HaiperResponse>(`/tasks/${params.taskId}`);
      const status = this.mapStatus(response.status);
      return {
        status,
        progress: status === 'completed' ? 100 : status === 'processing' ? 50 : 0,
        message: this.getStatusMessage(response.status),
        timestamp: new Date()
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
      pending: 'pending', processing: 'processing',
      completed: 'completed', failed: 'failed'
    };
    return statusMap[(status || '').toLowerCase()] || 'pending';
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: '任务等待中...', processing: '处理中...',
      completed: '生成完成', failed: '生成失败'
    };
    return messages[(status || '').toLowerCase()] || '状态: ' + status;
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'default-model', name: '默认模型' }
    ];
  }}
