/**
 * Anthropic 兼容适配器
 * 只支持图片大模型与视频大模型
 */

import { BaseGenerator } from '@/services/adapters/base';
import {
  ImageParams,
  VideoParams,
  TaskStatusParams,
} from '@/types/adapter';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';

interface AnthropicCompatibleConfig {
  apiKey: string;
  baseUrl: string;
  modelId?: string;
  supportsImageGeneration?: boolean;
  supportsVideoGeneration?: boolean;
}

export class AnthropicCompatibleAdapter extends BaseGenerator {
  private modelId: string;
  private supportsImage: boolean;
  private supportsVideo: boolean;

  constructor(config: string | AnthropicCompatibleConfig) {
    if (typeof config === 'string') {
      super({ apiKey: config, baseUrl: '', providerName: 'anthropic-compatible' });
      this.modelId = 'claude-image';
      this.supportsImage = true;
      this.supportsVideo = true;
    } else {
      super({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        providerName: 'anthropic-compatible'
      });
      this.modelId = config.modelId || 'claude-image';
      this.supportsImage = config.supportsImageGeneration !== false;
      this.supportsVideo = config.supportsVideoGeneration !== false;
    }
    
    // console.log('[AnthropicCompatibleAdapter] 初始化完成，baseUrl:', this.baseUrl, 'modelId:', this.modelId);
  }

  async generateImage(params: ImageParams): Promise<GenerationResult> {
    if (!this.supportsImage) {
      return {
        taskId: '',
        status: 'failed',
        error: '该提供商不支持图片生成',
        progress: 0
      };
    }

    try {
      const endpoint = '/images/generations';
      const body: Record<string, any> = {
        model: this.modelId,
        prompt: params.prompt || '',
      };

      if (params.aspectRatio) {
        body.size = this.convertAspectRatio(params.aspectRatio);
      } else if (params.resolution) {
        body.size = params.resolution;
      }

      const generationMode = params.generationMode || 'text_to_image';
      if (generationMode === 'image_to_image' && params.referenceImage) {
        body.image = params.referenceImage;
      }

      if (params.referenceImage && generationMode !== 'image_to_image') {
        body.image = params.referenceImage;
      }

      // console.log('[AnthropicCompatibleAdapter.generateImage] 请求参数:', JSON.stringify(body));
      
      const response = await this.postRequest<any>(endpoint, body);
      // console.log('[AnthropicCompatibleAdapter.generateImage] API响应:', JSON.stringify(response));

      if (response.data && response.data.length > 0) {
        const imageData = response.data[0];
        const taskId = response.id || `anthropic-img-${Date.now()}`;
        
        return {
          taskId,
          status: 'completed',
          resultUrl: imageData.url || imageData.b64_json,
          progress: 100
        };
      }

      return this.createPendingResult(response.id || `anthropic-img-${Date.now()}`);
    } catch (error) {
      console.error('[AnthropicCompatibleAdapter.generateImage] 错误:', error);
      return this.createFailedResult(error);
    }
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    if (!this.supportsVideo) {
      return {
        taskId: '',
        status: 'failed',
        error: '该提供商不支持视频生成',
        progress: 0
      };
    }

    try {
      const endpoint = '/video/generations';
      const body: Record<string, any> = {
        model: this.modelId,
        prompt: params.prompt || '',
      };

      if (params.duration) {
        body.duration = params.duration;
      }

      if (params.startImage) {
        body.image = params.startImage;
      }

      if (params.endImage) {
        body.end_image = params.endImage;
      }

      // console.log('[AnthropicCompatibleAdapter.generateVideo] 请求参数:', JSON.stringify(body));
      
      const response = await this.postRequest<any>(endpoint, body);
      // console.log('[AnthropicCompatibleAdapter.generateVideo] API响应:', JSON.stringify(response));

      const taskId = response.id || response.task_id || `anthropic-video-${Date.now()}`;
      
      if (response.data && response.data.length > 0) {
        return {
          taskId,
          status: 'completed',
          resultUrl: response.data[0].video || response.data[0].url,
          progress: 100
        };
      }

      return {
        taskId,
        status: response.status === 'completed' ? 'completed' : 'pending',
        resultUrl: response.output?.video_url || response.output?.video || response.video_url,
        progress: response.progress || 0
      };
    } catch (error) {
      console.error('[AnthropicCompatibleAdapter.generateVideo] 错误:', error);
      return this.createFailedResult(error);
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      const endpoint = `/tasks/${params.taskId}`;
      const response = await this.getRequest<any>(endpoint);
      
      return {
        taskId: params.taskId,
        status: response.status === 'completed' ? 'completed' : 
               response.status === 'failed' ? 'failed' : 
               response.status === 'in_progress' ? 'processing' : 'pending',
        progress: response.progress || 0,
        resultUrl: response.output?.video_url || response.output?.video || response.video_url,
        error: response.error?.message || response.error
      };
    } catch (error) {
      console.error('[AnthropicCompatibleAdapter.getTaskStatus] 错误:', error);
      return {
        taskId: params.taskId,
        status: 'failed',
        error: error instanceof Error ? error.message : '获取任务状态失败',
        progress: 0
      };
    }
  }

  private convertAspectRatio(aspectRatio: string): string {
    const ratioMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1024x768',
      '3:4': '768x1024',
      '21:9': '2240x1024',
    };
    return ratioMap[aspectRatio] || '1024x1024';
  }

  isAvailable(): boolean {
    return !!(this.apiKey && this.baseUrl);
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: this.modelId, name: `Anthropic兼容图片模型 (${this.modelId})` }
    ];
  }

  validateConfig(): { valid: boolean; error?: string } {
    if (!this.apiKey) {
      return { valid: false, error: 'API密钥不能为空' };
    }
    if (!this.baseUrl) {
      return { valid: false, error: 'Base URL不能为空' };
    }
    return { valid: true };
  }

  async testConnection(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const response = await this.getRequest<any>('/models');
      return !!(response.data || response.models || response.object === 'list');
    } catch (error) {
      console.error('[AnthropicCompatibleAdapter.testConnection] 测试失败:', error);
      return false;
    }
  }
}
