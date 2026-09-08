/**
 * Leonardo.AI 适配器
 * 
 * Leonardo.AI的图像和视频生成服务
 * 
 * @extends BaseGenerator
 * @implements IAIAdapter
 */

import { BaseGenerator } from './base';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';
import { ImageParams, VideoParams, TaskStatusParams } from '@/types/adapter';

/**
 * Leonardo.AI API 响应
 */
interface LeonardoResponse {
  sdGenerationJob?: {
    generationId: string;
  };
  motionGenerationJob?: {
    generationId: string;
  };
  generations_by_pk?: {
    id: string;
    status: string;
    generated_images?: Array<{
      url: string;
      nsfw: boolean;
      id: string;
    }>;
    generated_motion?: {
      video: { url: string };
    };
    error?: string;
  };
}

/**
 * Leonardo.AI 适配器
 */
export class LeonardoAIAdapter extends BaseGenerator {
  
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: '/leonardo-api/api/rest/v1',
      providerName: 'leonardo-ai'
    });
  }

  /**
   * 生成图片
   */
  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      // console.log('[LeonardoAI] 生成图片，prompt:', params.prompt);
      // console.log('[LeonardoAI] 生成模式:', params.generationMode || 'text_to_image');
      
      const generationMode = params.generationMode || 'text_to_image';
      const referenceImage = params.referenceImage || params.referenceImages?.[0];
      
      const requestBody: Record<string, any> = {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        modelId: '6bef9f1b-29cb-40c7-b9df-32b51c1f67d3',
        width: this.getWidthFromAspectRatio(params.aspectRatio || '1:1'),
        height: this.getHeightFromAspectRatio(params.aspectRatio || '1:1'),
        num_images: 1,
        guidance_scale: 7,
        steps: 30,
        presetStyle: 'DYNAMIC',
        promptMagic: true
      };
      
      // 处理图生图和参考图模式
      if ((generationMode === 'image_to_image' || generationMode === 'reference') && referenceImage) {
        requestBody.imageInitStrength = 0.4; // 图像保留强度
        if (referenceImage.startsWith('data:')) {
          requestBody.init_image = referenceImage;
        } else {
          // 需要上传图片或使用已上传的图片ID
          requestBody.init_image = referenceImage;
        }
      }
      
      const response = await this.postRequest<LeonardoResponse>('/generations', requestBody);

      return this.createPendingResult(response.sdGenerationJob?.generationId || '');
    } catch (error) {
      console.error('[LeonardoAI] 生成图片失败:', error);
      return this.createFailedResult(error);
    }
  }

  /**
   * 生成视频
   */
  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      // console.log('[LeonardoAI] 生成视频，prompt:', params.prompt);
      
      let imageId = params.startImage;
      
      if (!imageId) {
        const imageResult = await this.generateImage({
          prompt: params.prompt,
          aspectRatio: params.aspectRatio || '1:1'
        });
        
        if (imageResult.status !== 'pending' || !imageResult.taskId) {
          return this.createFailedResult(new Error('Failed to generate initial image for video'));
        }
        imageId = imageResult.taskId;
      }

      const response = await this.postRequest<LeonardoResponse>('/motion-svd', {
        imageId,
        motionStrength: 0.5,
        isVariation: false
      });

      return this.createPendingResult(response.motionGenerationJob?.generationId || '');
    } catch (error) {
      console.error('[LeonardoAI] 生成视频失败:', error);
      return this.createFailedResult(error);
    }
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      // console.log('[LeonardoAI] 获取任务状态，taskId:', params.taskId);
      
      const response = await this.getRequest<LeonardoResponse>(`/generations/${params.taskId}`);
      
      const generation = response.generations_by_pk;
      if (!generation) {
        return {
          status: 'failed',
          progress: 0,
          message: 'Generation not found',
          timestamp: new Date()
        };
      }

      const status = this.mapStatus(generation.status);
      const progress = status === 'processing' ? 50 : status === 'completed' ? 100 : 0;
      
      let output;
      if (generation.generated_images && generation.generated_images.length > 0) {
        output = generation.generated_images[0].url;
      } else if (generation.generated_motion) {
        output = generation.generated_motion.video.url;
      }
      
      return {
        status,
        progress,
        message: this.getStatusMessage(generation.status),
        timestamp: new Date(),
        output,
        error: generation.error
      };
    } catch (error) {
      console.error('[LeonardoAI] 获取任务状态失败:', error);
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
      complete: 'completed',
      completed: 'completed',
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
      complete: '生成完成',
      completed: '生成完成',
      failed: '生成失败'
    };
    return messages[status.toLowerCase()] || `状态: ${status}`;
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'default-model', name: '默认模型' }
    ];
  }}
