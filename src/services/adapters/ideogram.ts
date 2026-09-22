/**
 * Ideogram AI 适配器
 * 
 * Ideogram AI 图像生成服务
 * 
 * @extends BaseGenerator
 * @implements IAIAdapter
 */

import { BaseGenerator } from './base';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';
import { ImageParams, VideoParams, TaskStatusParams } from '@/types/adapter';

/**
 * Ideogram API 响应
 */
interface IdeogramResponse {
  id: string;
  status: string;
  resolution?: string;
  images?: Array<{
    url: string;
    prompt: string;
    seed: number;
  }>;
  error?: string;
}

/**
 * Ideogram AI 适配器
 */
export class IdeogramAdapter extends BaseGenerator {
  
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: '/ideogram-api',
      providerName: 'ideogram'
    });
  }

  /**
   * 生成图片
   */
  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      // console.log('[Ideogram] 生成图片，prompt:', params.prompt);
      // console.log('[Ideogram] 生成模式:', params.generationMode || 'text_to_image');
      
      const generationMode = params.generationMode || 'text_to_image';
      const referenceImage = params.referenceImage || params.referenceImages?.[0];
      
      const requestBody: Record<string, any> = {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        aspect_ratio: params.aspectRatio || '1:1',
        model: 'V_2',
        magic_prompt_option: 'AUTO',
        seed: params.seed || -1,
        style_type: 'PHOTOGRAPHY'
      };
      
      // 处理图生图和参考图模式
      if ((generationMode === 'image_to_image' || generationMode === 'reference') && referenceImage) {
        // Ideogram 支持 image-to-image，需要上传参考图
        requestBody.image = referenceImage;
      }
      
      const response = await this.postRequest<IdeogramResponse>('/generate', requestBody);

      return this.createPendingResult(response.id);
    } catch (error) {
      console.error('[Ideogram] 生成图片失败:', error);
      return this.createFailedResult(error);
    }
  }

  /**
   * 生成视频 - Ideogram不支持视频生成
   */
  async generateVideo(_params: VideoParams): Promise<GenerationResult> {
    // console.log('[Ideogram] Ideogram不支持视频生成');
    return {
      taskId: '',
      status: 'failed',
      error: 'Ideogram不支持视频生成'
    };
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      // console.log('[Ideogram] 获取任务状态，taskId:', params.taskId);
      
      const response = await this.getRequest<IdeogramResponse>(`/tasks/${params.taskId}`);
      
      const status = this.mapStatus(response.status);
      const progress = status === 'processing' ? 50 : status === 'completed' ? 100 : 0;
      
      let output;
      if (response.images && response.images.length > 0) {
        output = response.images[0].url;
      }
      
      return {
        status,
        progress,
        message: this.getStatusMessage(response.status),
        timestamp: new Date(),
        output,
        error: response.error
      };
    } catch (error) {
      console.error('[Ideogram] 获取任务状态失败:', error);
      return {
        status: 'failed',
        progress: 0,
        message: error instanceof Error ? error.message : '获取状态失败',
        timestamp: new Date()
      };
    }
  }

  /**
   * 映射状态
   */
  private mapStatus(status: string): TaskStatusResult['status'] {
    const statusMap: Record<string, TaskStatusResult['status']> = {
      pending: 'pending',
      processing: 'processing',
      completed: 'completed',
      succeeded: 'completed',
      failed: 'failed'
    };
    return statusMap[status.toLowerCase()] || 'pending';
  }

  /**
   * 获取状态消息
   */
  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: '任务等待中...',
      processing: '处理中...',
      completed: '生成完成',
      succeeded: '生成成功',
      failed: '生成失败'
    };
    return messages[status.toLowerCase()] || `状态: ${status}`;
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'default-model', name: '默认模型' }
    ];
  }}
