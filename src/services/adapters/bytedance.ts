/**
 * 字节跳动/豆包 AI 适配器
 * 
 * 支持火山引擎 ARK API 的 AK/SK 认证方式
 * 
 * @extends BaseGenerator
 */

import { BaseGenerator } from './base';
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

/**
 * BytedanceGenerator 适配器
 */
export class BytedanceGenerator extends BaseGenerator {
  private ak: string;
  private sk: string;
  private token: string | null = null;

  constructor(config: { ak: string; sk: string }) {
    // 所有环境统一走后端代理，不暴露外部API地址
    const baseUrl = '/api/v3';
    
    super({
      baseUrl,
      providerName: 'bytedance'
    });
    
    if (!config) {
      throw new Error('Bytedance configuration is required');
    }
    this.ak = config.ak;
    this.sk = config.sk;
  }

  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      const response = await this.postRequest<{ id: string; output?: { task_id?: string } }>('/images/generations', {
        model: 'doubao-seedream-5-0-lite',
        prompt: params.prompt || '',
        size: this.convertAspectRatioToSize(params.aspectRatio),
        quality: params.quality || 'standard',
        n: 1
      });

      const taskId = response?.id || response?.output?.task_id || '';
      
      return this.createPendingResult(taskId);
    } catch (error) {
      console.error('[Bytedance] generateImage 错误:', error);
      return this.createFailedResult(error);
    }
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      const generationMode = params.generationMode || 'text_to_video';
      const content: Array<{ type: string; text?: string; image_url?: { url: string; role?: string }; role?: string }> = [];

      if (params.prompt) {
        content.push({ type: 'text', text: params.prompt });
      }

      if (generationMode === 'image_to_video') {
        const imageUrl = params.referenceImage || params.startImage;
        if (imageUrl) {
          content.push({
            type: 'image_url',
            image_url: { url: imageUrl, role: 'first_frame' }
          });
        }
      } else if (generationMode === 'first_last_frame') {
        if (params.startImage) {
          content.push({
            type: 'image_url',
            image_url: { url: params.startImage, role: 'first_frame' }
          });
        }
        if (params.endImage) {
          content.push({
            type: 'image_url',
            image_url: { url: params.endImage, role: 'last_frame' }
          });
        }
      } else if (generationMode === 'video_to_video' && params.referenceImages && params.referenceImages.length > 0) {
        for (const refImage of params.referenceImages) {
          content.push({
            type: 'image_url',
            image_url: { url: refImage, role: 'reference_image' }
          });
        }
      }

      if (content.length === 0) {
        content.push({ type: 'text', text: '' });
      }

      const requestBody: Record<string, unknown> = {
        model: 'doubao-seedance-1-5-pro-251215',
        content,
        params: {
          duration: params.duration || 5,
          fps: params.fps || 24,
          resolution: convertResolution(params.resolution, '720p')
        }
      };

      if (params.seed !== undefined && params.seed !== -1) {
        (requestBody.params as Record<string, unknown>).seed = params.seed;
      }

      const response = await this.postRequest<{ id: string; output?: { task_id?: string } }>('/contents/generations/tasks', requestBody);

      const taskId = response?.id || response?.output?.task_id || '';

      return this.createPendingResult(taskId);
    } catch (error) {
      console.error('[Bytedance] generateVideo 错误:', error);
      return this.createFailedResult(error);
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const response = await this.getRequest<{
        id: string;
        status: string;
        progress?: number;
        output?: { image_url?: string; video_url?: string };
        error?: { message?: string };
      }>(`/images/generations/${params.taskId}`);

      const status = this.mapStatus(response.status);
      const progress = response.progress || (status === 'processing' ? 50 : status === 'completed' ? 100 : 0);

      return {
        status,
        progress,
        message: this.getStatusMessage(response.status),
        timestamp: new Date(),
        output: response.output?.image_url || response.output?.video_url,
        error: response.error?.message
      };
    } catch (error) {
      console.error('[Bytedance] getTaskStatus 错误:', error);
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '获取任务状态失败',
        timestamp: new Date()
      };
    }
  }

  private mapStatus(apiStatus: string): TaskStatusResult['status'] {
    const statusMap: Record<string, TaskStatusResult['status']> = {
      pending: 'pending', queued: 'pending', wait: 'pending',
      processing: 'processing', running: 'processing',
      completed: 'completed', succeed: 'completed',
      failed: 'failed', error: 'failed'
    };
    return statusMap[(apiStatus || '').toLowerCase()] || 'pending';
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: '任务等待中...',
      processing: '处理中...',
      completed: '生成完成',
      succeed: '生成成功',
      failed: '生成失败'
    };
    return messages[(status || '').toLowerCase()] || '状态: ' + status;
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'doubao-video', name: '豆包视频生成' }
    ];
  }
}
