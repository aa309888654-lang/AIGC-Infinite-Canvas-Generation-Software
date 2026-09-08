import { BaseProvider, DEFAULT_ENDPOINTS } from './base-provider';
import { ImageParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { logger } from '../utils/logger';

/**
 * SenseNova 平台 Provider
 *
 * - 图片生成: sensenova-u1-fast (信息图 Infographics 生成)
 *   使用独立的图像生成接口 /v1/images/generations，非 Chat Completions
 *   支持 11 种 aspect ratio (2K 分辨率)
 *
 * 文档: https://platform.sensenova.cn/docs
 */
export class SenseNovaProvider extends BaseProvider {
  readonly name = 'sensenova';
  readonly supportedModes = ['text_to_image'];

  protected getDefaultEndpoint(): string {
    return DEFAULT_ENDPOINTS.sensenova;
  }

  /**
   * 11 种 aspect ratio 对应的 2K 分辨率尺寸
   * 来源: SenseNova U1 Fast 文档
   */
  private static readonly SIZE_MAP: Record<string, string> = {
    '2:3': '1664x2496',
    '3:2': '2496x1664',
    '3:4': '1760x2368',
    '4:3': '2368x1760',
    '4:5': '1824x2272',
    '5:4': '2272x1824',
    '1:1': '2048x2048',
    '16:9': '2752x1536',
    '9:16': '1536x2752',
    '21:9': '3072x1376',
    '9:21': '1344x3136',
  };

  private resolveSize(resolution?: string, pixelResolution?: string): string {
    // 优先使用直接传入的 size (如 "2752x1536")
    if (pixelResolution && /^\d+x\d+$/.test(pixelResolution)) {
      return pixelResolution;
    }
    // 按 aspect ratio 映射
    if (resolution && SenseNovaProvider.SIZE_MAP[resolution]) {
      return SenseNovaProvider.SIZE_MAP[resolution];
    }
    // 默认 16:9
    return '2752x1536';
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    try {
      let baseEndpoint = this.getEndpoint(config).replace(/\/+$/, '');
      // SenseNova U1 Fast 图片生成必须使用 token.sensenova.cn 端点
      // compatible-mode 端点不支持 /images/generations，会返回 404 NOT_FOUND
      if (baseEndpoint.includes('compatible-mode')) {
        logger.warn(`[SenseNova] 检测到 compatible-mode 端点不支持图片生成，自动切换到 ${DEFAULT_ENDPOINTS.sensenova}`);
        baseEndpoint = DEFAULT_ENDPOINTS.sensenova;
      }
      // U1 Fast 使用独立的图像生成接口
      const endpoint = `${baseEndpoint}/images/generations`;
      const authHeaders = this.getAuthHeaders(config);

      const prompt = (params.prompt || '').trim();
      if (!prompt) {
        return {
          taskId: '',
          status: 'failed',
          provider: this.name,
          error: 'SenseNova 图片生成需要非空 prompt',
        };
      }

      const size = this.resolveSize(params.resolution as string, params.pixelResolution as string);

      const body: Record<string, any> = {
        model: params.model || 'sensenova-u1-fast',
        prompt,
        size,
        // SenseNova U1 系列当前只接受单张生成；多张由 UnifiedApiService 拆成多次请求。
        n: 1,
      };
      if (params.negativePrompt) {
        body.negative_prompt = params.negativePrompt;
      }
      if (params.seed !== undefined && params.seed !== -1) {
        body.seed = params.seed;
      }

      logger.info(`[SenseNova] 图片生成请求: model=${body.model}, size=${size}, n=${body.n}, promptLen=${prompt.length}, negativePromptLen=${params.negativePrompt?.length || 0}, seed=${params.seed ?? 'none'}`);

      const response = await this.apiPost(endpoint, body, authHeaders, 120000);

      // OpenAI 兼容响应: { data: [{ url | b64_json }] }
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return this.buildCompletedImageResult(response.data, params.model, response);
      }

      // 兼容其他可能的响应格式: output / result / images / url / b64_json
      const imageDataFromAlt = response.output || response.result || response.images || response.image;
      if (imageDataFromAlt) {
        const imagesArr = Array.isArray(imageDataFromAlt) ? imageDataFromAlt : [imageDataFromAlt];
        const normalized = imagesArr
          .map((item: any) => (typeof item === 'string' ? { url: item } : item))
          .filter((item: any) => item && (item.url || item.b64_json));
        if (normalized.length > 0) {
          return this.buildCompletedImageResult(normalized, params.model, response);
        }
      }

      // 顶层直接返回 url 或 b64_json
      if (response.url || response.b64_json) {
        return this.buildCompletedImageResult([response], params.model, response);
      }

      // SenseNova U1 Fast 仅支持同步模式，不存在异步任务查询
      // 如果响应中无图片数据，直接返回失败（避免进入无法轮询的 pending 状态）
      const responseId = response.id || response.task_id;
      const errMsg = response.error?.message || response.error?.code || response.message;
      return {
        taskId: responseId || '',
        status: 'failed',
        provider: this.name,
        model: params.model,
        error: errMsg
          ? `SenseNova 图片生成失败: ${errMsg}`
          : `SenseNova 图片 API 未返回图片数据: ${JSON.stringify(response).substring(0, 300)}`,
      };
    } catch (error: unknown) {
      return this.handleProviderError(error);
    }
  }

  /**
   * SenseNova U1 Fast 仅支持同步图像生成，不支持异步任务查询。
   * 此方法作为安全兜底：若被调用，直接返回失败，避免任务卡在 pending 状态。
   */
  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    logger.warn(`[SenseNova] getTaskStatus 被调用 (taskId=${taskId})，但 U1 Fast 仅支持同步模式，返回失败`);
    return {
      taskId,
      status: 'failed',
      provider: this.name,
      error: 'SenseNova U1 Fast 不支持异步任务查询，请检查生成请求是否正常返回',
    };
  }
}
