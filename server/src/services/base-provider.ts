import axios, { AxiosRequestConfig } from 'axios';
import { VideoParams, ImageParams, AudioParams, GenerationResult, ApiProviderConfig } from '../types/api';

export interface IApiProvider {
  readonly name: string;
  readonly supportedModes: string[];

  generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult>;
  generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult>;
  generateAudio(params: AudioParams, config: ApiProviderConfig): Promise<GenerationResult>;
  getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult>;
}

export enum AuthType {
  BEARER = 'bearer',
  API_KEY = 'api_key',
  HMAC = 'hmac',
}

export const STANDARD_VIDEO_STATUS_MAP: Record<string, GenerationResult['status']> = {
  pending: 'pending',
  processing: 'processing',
  queued: 'pending',
  in_progress: 'processing',
  succeeded: 'completed',
  completed: 'completed',
  done: 'completed',
  Success: 'completed',
  failed: 'failed',
  Fail: 'failed',
  expired: 'failed',
};

export const DEFAULT_ENDPOINTS: Record<string, string> = {
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  minimax: 'https://api.minimaxi.com/v1',
  minimax_media: 'https://api.minimaxi.com/v1',
  jimeng: 'https://jimeng.jianying.com/molo/v1',
  seedream: 'https://ark.cn-beijing.volces.com/api/v3',
  vidu: 'https://api.vidu.cn',
  agnes: 'https://apihub.agnes-ai.com/v1',
  sensenova: 'https://token.sensenova.cn/v1',
  stepfun: 'https://api.stepfun.com/step_plan/v1',
  kling: 'https://api-beijing.klingai.com',
};

export abstract class BaseProvider implements IApiProvider {
  abstract readonly name: string;
  abstract readonly supportedModes: string[];

  protected abstract getDefaultEndpoint(): string;

  async generateVideo(params: VideoParams, config: ApiProviderConfig): Promise<GenerationResult> {
    throw new Error('Method not implemented');
  }

  async generateImage(params: ImageParams, config: ApiProviderConfig): Promise<GenerationResult> {
    throw new Error('Method not implemented');
  }

  async generateAudio(params: AudioParams, config: ApiProviderConfig): Promise<GenerationResult> {
    throw new Error('Method not implemented');
  }

  async getTaskStatus(taskId: string, config: ApiProviderConfig): Promise<GenerationResult> {
    throw new Error('Method not implemented');
  }

  protected getEndpoint(config: ApiProviderConfig): string {
    return config.endpoint || this.getDefaultEndpoint();
  }

  protected getAuthHeaders(config: ApiProviderConfig): Record<string, string> {
    return { Authorization: `Bearer ${config.apiKey}` };
  }

  protected getBearerAuthHeaders(apiKey: string): Record<string, string> {
    return { Authorization: `Bearer ${apiKey}` };
  }

  protected buildStandardVideoResult(
    taskId: string,
    model: string | undefined,
    data: any
  ): GenerationResult {
    return this.makePendingResult(taskId, model, data);
  }

  protected buildCompletedImageResult(
    images: any[],
    model: string | undefined,
    data: any
  ): GenerationResult {
    const imageData = images[0] || data;
    return {
      taskId: data.id || data.task_id || Date.now().toString(),
      status: 'completed',
      provider: this.name,
      model,
      result: {
        url: imageData.url || imageData.b64_json,
        urls: images.map((img: any) => img.url || img.b64_json),
        metadata: data,
      },
    };
  }

  protected buildStandardTaskResult(
    taskId: string,
    data: any,
    statusMap: Record<string, GenerationResult['status']>,
    extraFields?: { videoUrl?: string; thumbnailUrl?: string }
  ): GenerationResult {
    return {
      taskId,
      status: this.mapStatus(data.status, statusMap),
      provider: this.name,
      result: data.output ? {
        videoUrl: extraFields?.videoUrl || data.output.video_url,
        thumbnailUrl: extraFields?.thumbnailUrl || data.output.thumbnail_url,
        metadata: data,
      } : { metadata: data },
      error: data.error?.message || data.error,
      progress: data.progress,
    };
  }

  protected mapResolution(resolution?: string, pixelResolution?: string): { width: number; height: number } | null {
    if (!resolution && !pixelResolution) return null;

    const resolutionMap: Record<string, Record<string, { width: number; height: number }>> = {
      '16:9': {
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
        '2K': { width: 2560, height: 1440 },
        '4K': { width: 3840, height: 2160 },
      },
      '9:16': {
        '720p': { width: 720, height: 1280 },
        '1080p': { width: 1080, height: 1920 },
        '2K': { width: 1440, height: 2560 },
        '4K': { width: 2160, height: 3840 },
      },
      '1:1': {
        '720p': { width: 720, height: 720 },
        '1080p': { width: 1080, height: 1080 },
        '2K': { width: 1440, height: 1440 },
        '4K': { width: 2048, height: 2048 },
      },
      '4:3': {
        '720p': { width: 960, height: 720 },
        '1080p': { width: 1440, height: 1080 },
        '2K': { width: 1920, height: 1440 },
        '4K': { width: 2880, height: 2160 },
      },
      '21:9': {
        '720p': { width: 1512, height: 648 },
        '1080p': { width: 2560, height: 1080 },
        '2K': { width: 3384, height: 1440 },
        '4K': { width: 5120, height: 2160 },
      },
      '4:5': {
        '720p': { width: 720, height: 900 },
        '1080p': { width: 1080, height: 1350 },
        '2K': { width: 1440, height: 1800 },
        '4K': { width: 2160, height: 2700 },
      },
    };

    if (resolution && pixelResolution) {
      return resolutionMap[resolution]?.[pixelResolution] || null;
    }

    if (resolution) {
      return resolutionMap[resolution]?.['1080p'] || null;
    }

    if (pixelResolution) {
      const defaultRes = Object.values(resolutionMap)[0];
      return defaultRes?.[pixelResolution] || null;
    }

    return null;
  }

  protected buildCommonVideoBody(params: VideoParams): Record<string, any> {
    const body: Record<string, any> = { prompt: params.prompt };

    if (params.model) body.model = params.model;
    if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
    if (params.duration) body.duration = params.duration;
    if (params.fps) body.fps = params.fps;
    if (params.seed !== undefined) body.seed = params.seed;
    if (params.cfgStrength) body.cfg_scale = params.cfgStrength;

    return body;
  }

  protected buildCommonImageBody(params: ImageParams): Record<string, any> {
    const body: Record<string, any> = { prompt: params.prompt };

    if (params.model) body.model = params.model;
    if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
    if (params.seed !== undefined && params.seed !== -1) body.seed = params.seed;
    if (params.steps) body.steps = params.steps;
    if (params.cfgStrength) body.cfg_scale = params.cfgStrength;
    if (params.promptEnhancement !== undefined) body.prompt_optimizer = params.promptEnhancement;
    if (params.promptOptimizer !== undefined) body.prompt_optimizer = params.promptOptimizer;
    if (params.hdMode !== undefined) body.hd_mode = params.hdMode;
    if (params.watermark !== undefined) body.watermark = params.watermark;

    return body;
  }

  protected handleProviderError(error: any): GenerationResult {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    return {
      taskId: '',
      status: 'failed',
      provider: this.name,
      error: message,
    };
  }

  protected mapStatus(rawStatus: string, statusMap: Record<string, GenerationResult['status']>): GenerationResult['status'] {
    return statusMap[rawStatus] || 'processing';
  }

  protected async apiPost(url: string, body: Record<string, any>, headers: Record<string, string>, timeout: number = 300000): Promise<any> {
    try {
      const response = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json', ...headers },
        timeout,
      } as AxiosRequestConfig);
      return response.data;
    } catch (error: unknown) {
      const errAxios = error as any;
      if (errAxios?.response) {
        console.error(`[BaseProvider] API POST ${url} failed with ${errAxios.response.status}:`, JSON.stringify(errAxios.response.data, null, 2));
      } else {
        console.error(`[BaseProvider] API POST ${url} failed:`, (error instanceof Error ? error.message : String(error)));
      }
      throw error;
    }
  }

  protected async apiGet(url: string, headers: Record<string, string>, timeout: number = 30000): Promise<any> {
    const response = await axios.get(url, { headers, timeout } as AxiosRequestConfig);
    return response.data;
  }

  /**
   * 判断是否为网络层错误（请求未送达或无响应）。
   * 仅用于决定是否安全重试 — 查询类请求重试不会产生重复扣费。
   * 注意：带 HTTP 响应的 4xx/5xx 不算网络错误（provider 已应答）。
   */
  protected isNetworkError(error: unknown): boolean {
    const err = error as any;
    if (!err) return false;
    // 有 response 说明 provider 已应答（即使是错误码），不属于网络错误
    if (err.response) return false;
    // axios: request 已发出但无 response，视为网络错误
    if (err.request) return true;
    const code = String(err.code || '').toUpperCase();
    const networkCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE'];
    return networkCodes.includes(code);
  }

  /**
   * 带网络错误重试的 GET（仅对网络层错误重试，指数退避）。
   * 用于轮询场景：GET 查询不会产生重复扣费，可安全重试。
   * provider 业务错误（带 response）不会被重试。
   */
  protected async apiGetWithRetry(
    url: string,
    headers: Record<string, string>,
    timeout: number = 30000,
    retries: number = 2,
    backoffMs: number = 1000,
  ): Promise<any> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.apiGet(url, headers, timeout);
      } catch (error: unknown) {
        lastError = error;
        if (attempt < retries && this.isNetworkError(error)) {
          const delay = backoffMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  protected makePendingResult(taskId: string, model?: string, metadata?: any): GenerationResult {
    return {
      taskId,
      status: 'pending',
      provider: this.name,
      model,
      result: { metadata },
    };
  }

  protected makeFailedTaskResult(taskId: string, error: any): GenerationResult {
    return {
      taskId,
      status: 'failed',
      provider: this.name,
      error: this.handleProviderError(error).error,
    };
  }
}
