import { getAuthToken } from '@/lib/auth-check';
import { BaseGenerator } from './base';
import { GenerationResult, TaskStatus, TaskStatusResult, VideoGenerationParams, ImageGenerationParams } from '@/types/ai-models';

const HAILUO_MODEL_MAP: Record<string, string> = {
  'hailuo-2.3-fast-768p-6s': 'disabled-hailuo-video',
  'hailuo-2.3-768p-6s': 'disabled-hailuo-video',
  'hailuo-video-2.3': 'disabled-hailuo-video',
};

function getHailuoApiModel(modelId?: string): string {
  if (!modelId) return 'disabled-hailuo-video';
  return HAILUO_MODEL_MAP[modelId] || 'disabled-hailuo-video';
}

function getBackendUrl(): string {
  const stored = localStorage.getItem('backend-api-url');
  if (stored) return stored;
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return 'http://localhost:3200';
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3200';
  }
  return window.location.origin;
}



export class HailuoAdapter extends BaseGenerator {
  private backendUrl: string;
  // 所有环境统一走后端代理，不暴露外部API地址
  private minimaxBaseUrl = '/minimax-api/v1';

  constructor(apiKey: string) {
    super(apiKey, getBackendUrl(), 'hailuo');
    this.backendUrl = getBackendUrl();
  }

  private async backendRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.backendUrl}${endpoint}`;
    const token = getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      method: options.method || 'GET',
      headers,
      body: typeof options.body === 'string' ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`请求失败 (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async generateImage(params: ImageGenerationParams): Promise<GenerationResult> {
    try {
      const response = await this.request<{
        task_id: string;
        status: string;
      }>('/video_generation', {
        method: 'POST',
        body: JSON.stringify({
          model: getHailuoApiModel(params.modelId),
          prompt: params.prompt,
        }),
      });

      return {
        taskId: response.task_id,
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

  async generateVideo(params: VideoGenerationParams): Promise<GenerationResult> {
    return {
      taskId: '',
      status: 'failed',
      error: '海螺视频模型已禁用，请使用 Google Omni。',
    };
  }

  async checkStatus(taskId: string): Promise<{
    status: TaskStatus;
    progress?: number;
    resultUrl?: string;
    error?: string;
  }> {
    try {
      const response = await this.backendRequest<{
        success: boolean;
        data?: {
          taskId: string;
          status: string;
          resultUrl?: string;
          error?: string;
          progress?: number;
        };
        message?: string;
      }>(`/api/v1/video/query/${taskId}`, {
        method: 'GET',
      });

      const data = response.data;
      let status: TaskStatus = 'pending';
      let resultUrl: string | undefined;
      let error: string | undefined;

      if (!response.success || !data) {
        error = response.message || 'Unknown error';
        status = 'failed';
      } else {
        switch (data.status) {
          case 'completed':
            status = 'completed';
            resultUrl = data.resultUrl;
            break;
          case 'failed':
            status = 'failed';
            error = data.error || 'Generation failed';
            break;
          case 'processing':
          case 'pending':
            status = data.status as TaskStatus;
            break;
          default:
            status = 'pending';
        }
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
      progress: result.progress,
      error: result.error,
    };
  }

  getModels(): { id: string; name: string }[] {
    return [
      { id: 'hailuo-2.3-fast-768p-6s', name: 'Hailuo-2.3-Fast-768P 6s' },
      { id: 'hailuo-2.3-768p-6s', name: 'Hailuo-2.3-768P 6s' },
      { id: 'hailuo-video-2.3', name: 'Hailuo Video 2.3' },
    ];
  }
}
