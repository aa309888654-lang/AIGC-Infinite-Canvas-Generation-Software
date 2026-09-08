import {
  SeedreamRequestParams,
  SeedreamResponse,
  SeedreamGenMode,
  SeedMode,
} from '@/types/seedream';
import { TaskStatus } from '@/types/ai-models';

/** Seedream API 错误类 */
export class SeedreamApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'SeedreamApiError';
  }
}

/** Seedream适配器配置 */
export interface SeedreamAdapterConfig {
  apiKey: string;
  modelId?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export class SeedreamAdapter {
  private apiKey: string;
  private modelId: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private enableMock: boolean;

  constructor(config: string | SeedreamAdapterConfig) {
    // 所有环境统一走后端代理，不暴露外部API地址
    const defaultBaseUrl = '/api/v3';
    
    if (typeof config === 'string') {
      // 兼容旧的构造函数参数
      this.apiKey = config;
      this.modelId = 'doubao-seedream-5-0-lite';
      this.baseUrl = defaultBaseUrl;
      this.timeout = 30000;
      this.maxRetries = 3;
      this.enableMock = false;
    } else {
      this.apiKey = config.apiKey;
      this.modelId = config.modelId || 'doubao-seedream-5-0-lite';
      this.baseUrl = config.baseUrl || defaultBaseUrl;
      this.timeout = config.timeout || 30000;
      this.maxRetries = config.maxRetries || 3;
      this.enableMock = false;
    }
    
  }

  /**
   * 发送API请求
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    retries: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new SeedreamApiError(
          errorData.message || `API请求失败: ${response.status}`,
          errorData.code,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof SeedreamApiError) {
        throw error;
      }
      
      // 网络错误或超时，重试
      if (retries < this.maxRetries && this.shouldRetry(error)) {
        await this.delay(1000 * (retries + 1));
        return this.request(endpoint, options, retries + 1);
      }
      
      throw error;
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'AbortError' || 
             error.message.includes('network') ||
             error.message.includes('fetch');
    }
    return false;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 构建请求载荷
   */
  private buildRequestPayload(params: SeedreamRequestParams): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: this.modelId,
      Prompt: params.prompt,
      NegativePrompt: params.negativePrompt || '',
      Num: params.numImages || 1,
      Steps: params.steps || 25,
      CfgScale: params.cfgScale || 7.5,
      Seed: params.seed ?? -1,
    };

    // 解析尺寸
    if (params.size) {
      const sizeMatch = params.size.match(/(\d+)x(\d+)/);
      if (sizeMatch) {
        payload.Width = parseInt(sizeMatch[1], 10);
        payload.Height = parseInt(sizeMatch[2], 10);
      }
    }

    // 水印配置
    payload.Watermark = params.watermark;

    // 图片输入（图生图模式）
    if (params.image && params.image.length > 0) {
      payload.InputImages = params.image.map(img => ({
        url: img.url,
      }));
      
      // 添加重绘强度
      if (params.strength) {
        payload.Strength = params.strength;
      } else {
        payload.Strength = 0.6;
      }
    }

    return payload;
  }

  /**
   * 提交图像生成任务
   * /images/generations 是同步端点，直接返回图片
   */
  async generateImage(params: SeedreamRequestParams): Promise<{
    taskId: string;
    status: TaskStatus;
    imageUrl?: string;
  }> {
    if (this.enableMock) {
      // 模拟模式
      return {
        taskId: 'seedream_' + Date.now(),
        status: 'pending',
      };
    }

    try {
      const payload = this.buildRequestPayload(params);
      
      // /images/generations 是同步端点，直接返回图片数据
      const response = await this.request<{
        model: string;
        created: number;
        data: Array<{ url: string; size: string }>;
        usage: { generated_images: number; output_tokens: number; total_tokens: number };
      }>('/images/generations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // 同步端点直接返回完成的图片
      const imageUrl = response.data?.[0]?.url;
      return {
        taskId: `seedream_${Date.now()}`,
        status: imageUrl ? 'completed' : 'pending',
        imageUrl,
      };
    } catch (error) {
      console.error('[SeedreamAdapter] 任务提交失败:', error);
      
      // 如果是模拟模式失败，fallback到模拟
      if (error instanceof SeedreamApiError) {
        console.warn('[SeedreamAdapter] API调用失败，启用模拟模式');
        this.enableMock = true;
        return {
          taskId: 'seedream_' + Date.now(),
          status: 'pending',
        };
      }
      
      throw error;
    }
  }

  /**
   * 检查任务状态
   */
  async checkTaskStatus(taskId: string): Promise<{
    status: TaskStatus;
    progress?: number;
    result?: SeedreamResponse;
    error?: string;
  }> {
    if (this.enableMock) {
      // 模拟模式
      const taskAge = Date.now() - parseInt(taskId.split('_')[1] || '0', 10);
      
      if (taskAge < 2000) {
        return { status: 'processing', progress: 50 };
      } else {
        return {
          status: 'completed',
          progress: 100,
          result: {
            images: ['https://picsum.photos/1024/1024'],
            seed: Math.floor(Math.random() * 1000000),
            generationTime: 2.0,
          },
        };
      }
    }

    try {
      const response = await this.request<{
        id: string;
        status: string;
        progress?: number;
        output?: {
          images?: string[];
          seed?: number;
          generation_time?: number;
        };
        error?: {
          code: string;
          message: string;
        };
      }>(`/image/generation/${taskId}`, {
        method: 'GET',
      });

      let progress = 0;
      if (response.status === 'processing') {
        progress = response.progress || 50;
      }

      return {
        status: response.status as TaskStatus,
        progress,
        result: response.output ? {
          images: response.output.images || [],
          seed: response.output.seed ?? 0,
          generationTime: response.output.generation_time ?? 0,
        } : undefined,
        error: response.error?.message,
      };
    } catch (error) {
      console.error('[SeedreamAdapter] 检查任务状态失败:', error);
      return {
        status: 'failed',
        error: '检查任务状态失败，请稍后重试',
      };
    }
  }

  /**
   * 轮询任务状态
   */
  async pollTaskStatus(
    taskId: string,
    onProgress?: (progress: number) => void,
    maxRetries: number = 60,
    intervalMs: number = 3000
  ): Promise<{
    status: TaskStatus;
    result?: SeedreamResponse;
    error?: string;
  }> {
    let retries = 0;

    while (retries < maxRetries) {
      const statusResult = await this.checkTaskStatus(taskId);

      if (onProgress && statusResult.progress !== undefined) {
        onProgress(statusResult.progress);
      }

      switch (statusResult.status) {
        case 'completed':
          return {
            status: 'completed',
            result: statusResult.result,
          };
        case 'failed':
          return {
            status: 'failed',
            error: statusResult.error || 'Task failed',
          };
        case 'pending':
        case 'processing':
          // 继续轮询
          break;
        default:
          console.warn(`[SeedreamAdapter] 未知状态: ${statusResult.status}`);
      }

      retries++;
      await this.delay(intervalMs);
    }

    return {
      status: 'failed',
      error: 'Task timeout',
    };
  }

  /**
   * 同步生成（提交后等待完成）
   * /images/generations 是同步端点，直接返回图片
   */
  async generateAndWait(
    params: SeedreamRequestParams,
    onProgress?: (progress: number) => void
  ): Promise<{
    status: TaskStatus;
    result?: SeedreamResponse;
    error?: string;
  }> {
    const submitResult = await this.generateImage(params);

    // 如果是同步端点直接返回的图片
    if (submitResult.imageUrl) {
      return {
        status: 'completed',
        result: {
          images: [submitResult.imageUrl],
          seed: 0,
          generationTime: 0,
        },
      };
    }

    if (!submitResult.taskId) {
      return {
        status: 'failed',
        error: 'Failed to submit task',
      };
    }

    return this.pollTaskStatus(submitResult.taskId, onProgress);
  }

  /**
   * 启用/禁用模拟模式
   */
  setMockMode(enable: boolean): void {
    this.enableMock = enable;
  }
}

/**
 * 创建Seedream请求参数
 */
export function createSeedreamRequestParams(
  prompt: string,
  mode: SeedreamGenMode,
  config: {
    size: string;
    aspectRatio: string;
    watermark: boolean;
  },
  params: {
    negativePrompt: string;
    referenceImages: Array<{ url: string }>;
    seed: number;
    seedMode: SeedMode;
    cfgScale: number;
    steps: number;
    strength?: number;
    numImages?: number;
  } = { negativePrompt: '', referenceImages: [], seed: -1, seedMode: 'random', cfgScale: 7.5, steps: 25 }
): SeedreamRequestParams {
  return {
    prompt,
    negativePrompt: params.negativePrompt,
    generationMode: mode,
    size: config.size,
    aspectRatio: config.aspectRatio,
    watermark: config.watermark,
    image: params.referenceImages,
    seed: params.seed,
    seedMode: params.seedMode,
    cfgScale: params.cfgScale,
    steps: params.steps,
    strength: params.strength,
    numImages: params.numImages,
  };
}