/**
 * Adobe Firefly 适配器
 * 
 * Adobe的AI图像和视频生成服务
 * 
 * @extends BaseGenerator
 * @implements IAIAdapter
 */

import { BaseGenerator } from './base';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';
import { ImageParams, VideoParams, TaskStatusParams } from '@/types/adapter';

/**
 * Adobe Firefly API 响应
 */
interface AdobeFireflyResponse {
  id: string;
  status: string;
  outputs?: Array<{
    image?: { url: string };
    video?: { url: string };
  }>;
  error?: string;
}

/**
 * Adobe Firefly 适配器
 */
export class AdobeFireflyAdapter extends BaseGenerator {
  
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: '/adobe-api/v2',
      providerName: 'adobe-firefly'
    });
  }

  /**
   * 生成图片
   */
  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      // console.log('[AdobeFirefly] 生成图片，prompt:', params.prompt);
      // console.log('[AdobeFirefly] 生成模式:', params.generationMode || 'text_to_image');
      
      const generationMode = params.generationMode || 'text_to_image';
      const referenceImage = params.referenceImage || params.referenceImages?.[0];
      
      const requestBody: Record<string, any> = {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        size: this.convertAspectRatioToSize(params.aspectRatio),
        content_class: 'photo',
        style: { preset: 'photo' }
      };
      
      // 处理图生图和参考图模式
      if ((generationMode === 'image_to_image' || generationMode === 'reference') && referenceImage) {
        requestBody.initialImage = referenceImage;
        requestBody.imageStrength = 0.3; // 图像保留强度
      }
      
      const response = await this.postRequest<AdobeFireflyResponse>('/images/generate', requestBody);

      return this.createPendingResult(response.id);
    } catch (error) {
      console.error('[AdobeFirefly] 生成图片失败:', error);
      return this.createFailedResult(error);
    }
  }

  /**
   * 生成视频
   */
  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      // console.log('[AdobeFirefly] 生成视频，prompt:', params.prompt);
      
      const response = await this.postRequest<AdobeFireflyResponse>('/videos/generate', {
        prompt: params.prompt,
        referenceImage: params.startImage,
        duration: params.duration,
        aspectRatio: params.aspectRatio,
        style: {
          strength: 0.5,
          reference: 'cinematic'
        }
      });

      return this.createPendingResult(response.id);
    } catch (error) {
      console.error('[AdobeFirefly] 生成视频失败:', error);
      return this.createFailedResult(error);
    }
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      // console.log('[AdobeFirefly] 获取任务状态，taskId:', params.taskId);
      
      const response = await this.getRequest<AdobeFireflyResponse>(`/tasks/${params.taskId}`);
      
      const status = this.mapStatus(response.status);
      const progress = status === 'processing' ? 50 : status === 'completed' ? 100 : 0;
      
      let output;
      if (response.outputs && response.outputs.length > 0) {
        const item = response.outputs[0];
        output = item.image?.url || item.video?.url;
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
      console.error('[AdobeFirefly] 获取任务状态失败:', error);
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
      running: 'processing',
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
      running: '运行中...',
      completed: '生成完成',
      succeeded: '生成成功',
      failed: '生成失败'
    };
    return messages[status.toLowerCase()] || `状态: ${status}`;
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'firefly-image-3', name: 'Firefly Image 3' },
      { id: 'firefly-video', name: 'Firefly Video' }
    ];
  }
}
