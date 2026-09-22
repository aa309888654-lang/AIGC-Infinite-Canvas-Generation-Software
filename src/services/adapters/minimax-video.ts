import { GenerationResult, TaskStatus, TaskStatusResult } from '@/types/ai-models';
import { BaseGenerator } from './base';
import { ImageParams, VideoParams, TaskStatusParams } from '@/types/adapter';
import { logger } from '@/lib/logger';

interface MinimaxSubjectReference {
  type: 'character' | 'image';
  image_file: string;
}

interface MinimaxImageRequest {
  model: string;
  prompt: string;
  negative_prompt?: string;
  n?: number;
  aspect_ratio?: string;
  response_format?: string;
  subject_reference?: MinimaxSubjectReference[];
  image_url?: string;
  prompt_optimizer?: boolean;
  style?: string;
}

interface MinimaxVideoRequest {
  model: string;
  prompt: string;
  negative_prompt?: string;
  image_url?: string;
  aspect_ratio: string;
  duration: number;
  fps: number;
}

interface MinimaxImageResponse {
  id: string;
  task_id?: string;
  data: {
    image_urls?: string[];
    image_base64?: string[];
  };
  image_url?: string;
  image_base64?: string;
  metadata?: {
    success_count?: string;
    failed_count?: string;
  };
  base_resp?: {
    status_code: number;
    status_msg: string;
    status_text?: string;
  };
}

interface MinimaxVideoResponse {
  id?: string;
  task_id?: string;
  status?: string;
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
}

export class MinimaxVideoAdapter extends BaseGenerator {
  constructor(apiKey: string) {
    // 所有环境统一走后端代理，不暴露外部API地址
    super(apiKey, '/minimax-api', 'minimax');
  }

  async generateImage(params: ImageParams): Promise<GenerationResult> {
    try {
      const minimaxModel = params.modelId || 'image-01';
      logger.info(`[MinimaxVideoAdapter] 使用模型: ${minimaxModel}`);

      // MiniMax image-01 只支持这些比例
      const SUPPORTED_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'];

      // 验证比例参数，如果不支持则自动调整
      let aspectRatio = params.aspectRatio || params.resolution || '1:1';
      if (!SUPPORTED_ASPECT_RATIOS.includes(aspectRatio)) {
        console.warn(`[MinimaxVideoAdapter] 不支持的比例 ${aspectRatio}，自动调整为 1:1`);
        aspectRatio = '1:1';
      }

      const requestBody: MinimaxImageRequest = {
        model: minimaxModel,
        prompt: params.prompt,
        ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
        aspect_ratio: aspectRatio,
        response_format: 'url',
        // prompt_optimizer: 从参数读取，默认true（MiniMax API推荐开启）
        prompt_optimizer: params.promptOptimizer !== undefined ? params.promptOptimizer : true,
        // n: 图片数量，支持1-9张
        ...(params.n !== undefined && params.n > 0 && { n: Math.min(params.n, 9) }),
      };

      const generationMode = params.generationMode || 'text_to_image';
      logger.info(`[MinimaxVideoAdapter] 生成模式: ${generationMode}`);

      // MiniMax image-01 支持的功能：
      // 1. 文生图 (text_to_image) - ✅ 完全支持
      // 2. 人物主体参考 (character_reference) - ⚠️ 仅用于人像角色一致性，不是传统图生图
      //    - subject_reference 用于保持生成的人物与参考人脸一致
      //    - 限制：只能用于人脸照片，type 必须是 "character"

      if (generationMode === 'character_reference' && params.referenceImage) {
        // 人物主体参考模式 - 用于保持角色一致性（人脸）
        logger.info(`[MinimaxVideoAdapter] 人物主体参考模式 - 使用人脸照片保持角色一致性`);
        logger.info(
          `[MinimaxVideoAdapter] 参考图片: ${params.referenceImage.substring(0, 100)}...`
        );

        requestBody.subject_reference = [
          {
            type: 'character', // 必须是 "character"，用于人像主体参考
            image_file: params.referenceImage,
          },
        ];
      } else if (generationMode === 'image_to_image' && params.referenceImage) {
        // 传统图生图模式（根据参考图生成新图）
        // MiniMax image-01 不支持此功能，给出明确提示
        logger.warn(
          `[MinimaxVideoAdapter] ⚠️ MiniMax image-01 不支持传统图生图（根据参考图生成新图）`
        );
        logger.warn(`[MinimaxVideoAdapter] ⚠️ subject_reference 仅用于人物主体参考，不是图生图`);
        logger.warn(`[MinimaxVideoAdapter] ⚠️ 将作为文生图处理，参考图片将被忽略`);
        logger.warn(`[MinimaxVideoAdapter] 💡 如需图生图功能，请使用 Doubao 或 Stability AI 模型`);
        // 不添加参考图参数
      } else if (params.referenceImage && generationMode === 'text_to_image') {
        // 文生图模式下意外收到了参考图
        logger.warn(`[MinimaxVideoAdapter] ⚠️ 文生图模式下收到了参考图，将作为文生图处理`);
      }

      if (params.styleType) {
        logger.warn(`[MinimaxVideoAdapter] ⚠️ 画风控制已不再支持，当前使用 ${minimaxModel}`);
      }

      const response = await this.request<MinimaxImageResponse>('/v1/image_generation', {
        method: 'POST',
        body: requestBody as any as BodyInit,
      });

      logger.info(`[MinimaxVideoAdapter] 图片生成响应:`, JSON.stringify(response, null, 2));

      // MiniMax 图片生成 API 响应格式
      // 支持多种字段名：image_urls, image_base64, image_url
      const imageUrl =
        response.data?.image_urls?.[0] ||
        (response.data as any as Record<string, any>)?.image_url as string ||
        (response as any as Record<string, any>).image_url as string;
      const imageBase64 =
        response.data?.image_base64?.[0] ||
        (response.data as any as Record<string, any>)?.image_base64 as string ||
        (response as any as Record<string, any>).image_base64 as string;

      const statusCode = response.base_resp?.status_code;
      const statusMsg = response.base_resp?.status_msg || '';

      logger.info(
        `[MinimaxVideoAdapter] 状态码检查: base_resp.status_code=${statusCode}, status_msg=${statusMsg}`
      );
      logger.info(`[MinimaxVideoAdapter] 图片URL: ${imageUrl ? '有' : '无'}`);
      logger.info(`[MinimaxVideoAdapter] Base64: ${imageBase64 ? '有' : '无'}`);

      if (statusCode !== undefined && statusCode !== 0) {
        const errorMap: Record<number, string> = {
          1002: '触发限流，请稍后再试',
          1004: '账号鉴权失败，请检查API-Key',
          1008: '账号余额不足',
          1026: '图片描述涉及敏感内容',
          2013: '传入参数异常',
          2049: '无效的API Key',
        };
        const errorMsg = errorMap[statusCode] || statusMsg || `API错误(code=${statusCode})`;
        logger.error(`[MinimaxVideoAdapter] 图片生成失败: ${errorMsg}`);
        return {
          taskId: response.id || '',
          status: 'failed',
          error: errorMsg,
        };
      }

      if (imageUrl) {
        logger.info(`[MinimaxVideoAdapter] 图片生成成功，使用URL: ${imageUrl}`);
        return {
          taskId: response.id || `minimax-${Date.now()}`,
          status: 'completed',
          resultUrl: imageUrl,
        };
      }

      if (imageBase64) {
        logger.info(`[MinimaxVideoAdapter] 图片生成成功，使用Base64`);
        return {
          taskId: response.id || `minimax-${Date.now()}`,
          status: 'completed',
          resultUrl: `data:image/jpeg;base64,${imageBase64}`,
        };
      }

      const errorMsg = statusMsg || '未获取到图片数据，API未返回图片内容';
      logger.error(`[MinimaxVideoAdapter] 图片生成失败: ${errorMsg}`);
      return {
        taskId: response.id || '',
        status: 'failed',
        error: errorMsg,
      };
    } catch (error) {
      logger.error('[MinimaxVideoAdapter] generateImage 错误:', error);
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Image generation failed',
      };
    }
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    try {
      const modelId = params.modelId || 'video-01';
      const minimaxModel = modelId === 'video-01-higher' ? 'video-01-higher' : 'video-01';

      const requestBody: MinimaxVideoRequest = {
        model: minimaxModel,
        prompt: params.prompt,
        ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
        ...(params.referenceImage && { image_url: params.referenceImage }),
        aspect_ratio: params.resolution || '16:9',
        duration: params.duration || 6,
        fps: 24,
      };

      const response = await this.request<MinimaxVideoResponse>('/v1/video_generation', {
        method: 'POST',
        body: requestBody as any as BodyInit,
      });

      const taskId = response.task_id || response.id || '';
      logger.info(`[MinimaxVideoAdapter] 视频生成任务已创建: ${taskId}`, response);

      if (!taskId) {
        logger.error('[MinimaxVideoAdapter] 响应中未找到 task_id:', response);
        return {
          taskId: '',
          status: 'failed',
          error: 'MiniMax API 未返回有效的任务 ID',
        };
      }

      return {
        taskId,
        status: 'pending',
      };
    } catch (error) {
      logger.error('[MinimaxVideoAdapter] generateVideo 错误:', error);
      return {
        taskId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Video generation failed',
      };
    }
  }

  async checkStatus(taskId: string): Promise<{
    status: TaskStatus;
    progress?: number;
    resultUrl?: string;
    error?: string;
  }> {
    try {
      const response = await this.request<Record<string, any>>(
        `/v1/query/video_generation?task_id=${taskId}`,
        {
          method: 'GET',
        }
      );

      logger.info(`[MinimaxVideoAdapter] 任务状态: ${taskId} -> ${response.status}`);

      let status: TaskStatus = 'pending';
      let resultUrl: string | undefined;
      let error: string | undefined;

      switch (response.status) {
        case 'Preparing':
        case 'Processing':
          status = 'processing';
          break;
        case 'Success':
          status = 'completed';
          resultUrl = response.file_id; // MiniMax 返回 file_id，需要进一步获取下载链接
          break;
        case 'Fail':
          status = 'failed';
          error = 'Generation failed';
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
      logger.error('[MinimaxVideoAdapter] checkStatus 错误:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to check status',
      };
    }
  }

  async getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult> {
    const result = await this.checkStatus(params.taskId);
    return {
      taskId: params.taskId,
      status: result.status,
      resultUrl: result.resultUrl,
      progress: result.progress || 0,
      error: result.error,
    };
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  getModels(): { id: string; name: string }[] {
    return [{ id: 'default-model', name: '默认模型' }];
  }
}
