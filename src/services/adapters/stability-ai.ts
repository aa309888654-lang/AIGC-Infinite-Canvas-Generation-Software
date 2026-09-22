import { BaseGenerator } from './base';
import { GenerationResult, TaskStatus, TaskStatusResult, VideoGenerationParams, ImageGenerationParams, ImageAspectRatio } from '@/types/ai-models';

function convertImageResolution(resolution: string | undefined, defaultRatio: ImageAspectRatio = '1:1'): ImageAspectRatio {
  if (!resolution) return defaultRatio;
  const ratioMap: Record<string, ImageAspectRatio> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '4:3',
    '3:4': '3:4',
    '4:5': '4:5',
    '480p': '1:1',
    '720p': '16:9',
    '1080p': '16:9',
  };
  return ratioMap[resolution] || defaultRatio;
}

export class StabilityAIAdapter extends BaseGenerator {
  constructor(apiKey: string) {
    // 所有环境统一走后端代理，不暴露外部API地址
    super(apiKey, '/stability-api/v1', 'stabilityAI');
  }

  // 生成图片 - Stable Diffusion 3
  async generateImage(params: ImageGenerationParams): Promise<GenerationResult> {
    try {
      const response = await this.request<{
        id: string;
        status: string;
        artifacts?: Array<{ base64: string; seed: number; finishReason: string }>;
      }>('/generation/stable-diffusion-3/text-to-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: params.prompt,
          negative_prompt: params.negativePrompt,
          aspect_ratio: params.aspectRatio,
          seed: params.seed || 0,
          output_format: 'png',
          model: 'sd3',
          mode: 'text-to-image',
        }),
      });

      if (response.artifacts && response.artifacts.length > 0) {
        const base64Data = response.artifacts[0].base64;
        return {
          taskId: response.id || `sd3-${Date.now()}`,
          status: 'completed',
          resultUrl: `data:image/png;base64,${base64Data}`,
        };
      }

      return {
        taskId: '',
        status: 'failed',
        error: 'No image generated',
      };
    } catch (error) {
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Image generation failed',
      };
    }
  }

  // 生成视频 - Stable Video Diffusion
  async generateVideo(params: VideoGenerationParams): Promise<GenerationResult> {
    try {
      // 如果没有参考图片，先生成一张图片
      let imageUrl = params.referenceImage;
      if (!imageUrl) {
        const imageResult = await this.generateImage({
          aspectRatio: convertImageResolution(params.resolution, '1:1'),
          modelProvider: params.modelProvider,
          modelId: params.modelId,
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
        });
        
        if (imageResult.status !== 'completed' || !imageResult.resultUrl) {
          return {
            taskId: '',
            status: 'failed',
            error: 'Failed to generate initial image for video',
          };
        }
        imageUrl = imageResult.resultUrl;
      }

      // 将图片转换为base64（如果是data URL）
      let imageBase64 = imageUrl;
      if (imageUrl.startsWith('data:')) {
        imageBase64 = imageUrl.split(',')[1];
      } else {
        // 如果是URL，需要获取图片并转换为base64
        // 这里简化处理，实际应用中需要实现图片下载
        imageBase64 = imageUrl;
      }

      const response = await this.request<{
        id: string;
        status: string;
      }>('/image-to-video', {
        method: 'POST',
        body: JSON.stringify({
          image: imageBase64,
          seed: 0,
          cfg_scale: 1.8,
          motion_bucket_id: 127,
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
        error: error instanceof Error ? error.message : 'Video generation failed',
      };
    }
  }

  // 检查任务状态
  async checkStatus(taskId: string): Promise<{
    status: TaskStatus;
    progress?: number;
    resultUrl?: string;
    error?: string;
  }> {
    try {
      // 检查图片生成任务
      if (taskId.startsWith('sd3-')) {
        return {
          status: 'completed',
          resultUrl: `https://example.com/sd3-image-${taskId}.png`,
        };
      }

      const response = await this.request<{
        id: string;
        status: string;
        video?: string;
        error?: string;
      }>(`/image-to-video/result/${taskId}`, {
        method: 'GET',
      });

      let status: TaskStatus = 'pending';
      let resultUrl: string | undefined;
      let error: string | undefined;

      switch (response.status) {
        case 'in-progress':
          status = 'processing';
          break;
        case 'completed':
        case 'succeeded':
          status = 'completed';
          resultUrl = response.video;
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