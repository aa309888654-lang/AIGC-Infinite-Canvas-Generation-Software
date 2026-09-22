import { BaseGenerator } from './base';
import { GenerationResult, TaskStatus, TaskStatusResult, VideoGenerationParams, ImageGenerationParams } from '@/types/ai-models';

export class RecraftAIAdapter extends BaseGenerator {
  constructor(apiKey: string) {
    // 所有环境统一走后端代理，不暴露外部API地址
    super(apiKey, '/recraft-api/v1', 'recraftAI');
  }

  // 生成图片 - Recraft.AI
  async generateImage(params: ImageGenerationParams): Promise<GenerationResult> {
    try {
      const response = await this.request<{
        id: string;
        status: string;
      }>('/images/generations', {
        method: 'POST',
        body: JSON.stringify({
          prompt: params.prompt,
          negative_prompt: params.negativePrompt,
          model: 'recraft-v3',
          style: 'realistic_image',
          size: this.convertAspectRatioToSize(params.aspectRatio),
          style_id: 'realistic_image',
          colors: [],
        }),
      });

      return {
        taskId: response.id,
        status: 'pending',
      };
    } catch (error) {
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Image generation failed',
      };
    }
  }

  // 生成视频 - Recraft.AI 目前不支持视频生成
  async generateVideo(_params: VideoGenerationParams): Promise<GenerationResult> {
    return {
      taskId: '',
      status: 'failed',
      error: 'Recraft.AI does not support video generation',
    };
  }

  // 检查任务状态
  async checkStatus(taskId: string): Promise<{
    status: TaskStatus;
    progress?: number;
    resultUrl?: string;
    error?: string;
  }> {
    try {
      const response = await this.request<{
        id: string;
        status: string;
        data?: Array<{
          url: string;
          id: string;
        }>;
        error?: string;
      }>(`/images/${taskId}`, {
        method: 'GET',
      });

      let status: TaskStatus = 'pending';
      let resultUrl: string | undefined;
      let error: string | undefined;

      switch (response.status) {
        case 'processing':
          status = 'processing';
          break;
        case 'completed':
        case 'succeeded':
          status = 'completed';
          if (response.data && response.data.length > 0) {
            resultUrl = response.data[0].url;
          }
          break;
        case 'failed':
          status = 'failed';
          error = response.error || 'Generation failed';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
        progress: status === 'processing' ? 50 : status === 'completed' ? 100 : 0,
        resultUrl,
        error,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to check status',
      };
    }
  }

  // 转换比例为尺寸
  protected convertAspectRatioToSize(aspectRatio?: string): string {
    switch (aspectRatio) {
      case '1:1': return '1024x1024';
      case '3:4': return '768x1024';
      case '4:3': return '1024x768';
      case '16:9': return '1792x1024';
      case '9:16': return '1024x1792';
      default: return '1024x1024';
    }
  }

  async getTaskStatus(params: { taskId: string }): Promise<TaskStatusResult> {
    const result = await this.checkStatus(params.taskId);
    return {
      taskId: params.taskId,
      status: result.status,
      resultUrl: result.resultUrl,
      progress: result.progress || 0,
      error: result.error,
    };
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'default-model', name: '默认模型' }
    ];
  }}