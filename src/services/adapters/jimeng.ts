/**
 * Jimeng (即梦) AI 适配器
 * 
 * 字节即梦AI图像和视频生成服务
 * 
 * @extends BaseGenerator
 * @implements IAIAdapter
 * 
 * API文档: https://jimeng.jianing.com/developer
 * 注意: 此适配器需要配置 AK/SK 凭证
 */

import { BaseGenerator } from './base';
import { GenerationResult, TaskStatusResult } from '@/types/ai-models';
import { ImageParams, VideoParams, TaskStatusParams } from '@/types/adapter';

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
 * Jimeng API 响应
 */
interface JimengResponse {
  task_id?: string;
  id?: string;
  status?: string;
  image_url?: string;
  video_url?: string;
  error?: string;
}

/**
 * JimengGenerator 适配器
 * 
 * 配置说明:
 * - ak: 即梦 Access Key
 * - sk: 即梦 Secret Key
 * 
 * API端点:
 * - 图像生成: POST /api/jimeng/generation/image
 * - 视频生成: POST /api/jimeng/generation/video
 * - 任务查询: GET /api/jimeng/task/{taskId}
 */
export class JimengGenerator extends BaseGenerator {
  private ak: string;
  private sk: string;

  constructor(config: { ak: string; sk: string }) {
    super({
      apiKey: '',
      baseUrl: '/jimeng-api',
      providerName: 'jimeng'
    });
    
    if (!config) {
      throw new Error('Jimeng configuration is required');
    }
    
    if (!config.ak || !config.sk) {
      console.warn('[Jimeng] 警告: 未配置 AK/SK，即梦API可能无法正常工作');
    }
    
    this.ak = config.ak || '';
    this.sk = config.sk || '';
  }

  /**
   * 生成图片
   */
  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      // console.log('[Jimeng] 生成图片，prompt:', params.prompt);
      
      const response = await this.postRequest<JimengResponse>('/api/jimeng/generation/image', {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        image_size: this.convertAspectRatioToSize(params.aspectRatio),
        seed: params.seed
      });

      return this.createPendingResult(response.task_id || response.id || '');
    } catch (error) {
      console.error('[Jimeng] 生成图片失败:', error);
      return this.createFailedResult(error);
    }
  }

  /**
   * 生成视频
   */
  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      // console.log('[Jimeng] 生成视频，prompt:', params.prompt);
      // console.log('[Jimeng] 生成视频参数:', JSON.stringify(params, null, 2));

      const generationMode = params.generationMode || 'text_to_video';
      const requestBody: Record<string, unknown> = {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        duration: params.duration || 5,
        resolution: convertResolution(params.resolution, '720p')
      };

      if (generationMode === 'image_to_video' && (params.referenceImage || params.startImage)) {
        const imageUrl = params.referenceImage || params.startImage;
        requestBody.input_image = imageUrl;
      } else if (generationMode === 'first_last_frame') {
        if (params.startImage) {
          requestBody.first_frame = params.startImage;
        }
        if (params.endImage) {
          requestBody.last_frame = params.endImage;
        }
      }

      if (params.seed !== undefined && params.seed !== -1) {
        requestBody.seed = params.seed;
      }

      const response = await this.postRequest<JimengResponse>('/api/jimeng/generation/video', requestBody);

      return this.createPendingResult(response.task_id || response.id || '');
    } catch (error) {
      console.error('[Jimeng] 生成视频失败:', error);
      return this.createFailedResult(error);
    }
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    try {
      // console.log('[Jimeng] 获取任务状态，taskId:', params.taskId);
      
      const response = await this.getRequest<JimengResponse>(`/api/jimeng/task/${params.taskId}`);
      
      const status = this.mapStatus(response.status || '');
      const progress = status === 'processing' ? 50 : status === 'completed' ? 100 : 0;
      
      const output = response.image_url || response.video_url;
      
      return {
        status,
        progress,
        message: this.getStatusMessage(response.status || ''),
        timestamp: new Date(),
        output,
        error: response.error
      };
    } catch (error) {
      console.error('[Jimeng] 获取任务状态失败:', error);
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
    return messages[status.toLowerCase()] || '状态: ' + status;
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'default-model', name: '默认模型' }
    ];
  }}
