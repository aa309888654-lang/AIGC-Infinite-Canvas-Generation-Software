/**
 * 适配器基类
 * 提供通用功能和工具方法
 */

import {
  GenerationResult,
  TaskStatusResult,
} from '@/types/ai-models';
import {
  IAIAdapter,
  ImageParams,
  VideoParams,
  TaskStatusParams,
} from '@/types/adapter';

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface GeneratorConfig {
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl: string;
  providerName: string;
  timeout?: number;
  retries?: number;
}

function isBearerTokenKey(key: string): boolean {
  if (!key) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return true;
  if (/^sk-[a-zA-Z0-9]{32,}$/.test(key)) return true;
  if (/^sk-[a-f0-9]{64}$/i.test(key)) return true;
  return false;
}

export abstract class BaseGenerator implements IAIAdapter {
  protected apiKey: string = '';
  protected baseUrl: string = '';
  protected useProxy: boolean = true;
  protected accessKey?: string;
  protected secretKey?: string;
  protected providerName: string = 'any';

  constructor(config: GeneratorConfig);
  constructor(apiKey: string, baseUrl: string, providerName?: string);
  constructor(configOrApiKey: GeneratorConfig | string, baseUrl?: string, providerName?: string) {
    if (typeof configOrApiKey === 'string') {
      this.apiKey = configOrApiKey || '';
      this.baseUrl = baseUrl || '';
      this.providerName = providerName || 'any';
    } else {
      this.apiKey = configOrApiKey.apiKey || '';
      this.baseUrl = configOrApiKey.baseUrl || '';
      this.providerName = configOrApiKey.providerName || 'any';
      this.accessKey = configOrApiKey.accessKey;
      this.secretKey = configOrApiKey.secretKey;
    }
  }

  abstract generateImage(params: ImageParams): Promise<GenerationResult>;
  abstract generateVideo(params: VideoParams): Promise<GenerationResult>;
  abstract getTaskStatus(params: TaskStatusParams): Promise<TaskStatusResult>;
  abstract getModels(): { id: string; name: string }[];

  async pollTaskStatus(
    taskId: string,
    onProgress?: (progress: number) => void
  ): Promise<GenerationResult> {
    const maxRetries = 60;
    const intervalMs = 5000;
    let retries = 0;

    while (retries < maxRetries) {
      const status = await this.getTaskStatus({ taskId });
      
      if (status.status === 'completed') {
        return { taskId, status: 'completed', success: true, resultUrl: status.resultUrl };
      }
      
      if (status.status === 'failed') {
        return { taskId, status: 'failed', success: false, error: status.error || 'Task failed' };
      }

      if (onProgress) {
        onProgress(status.progress || 0);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
      retries++;
    }

    return { taskId, status: 'timeout', success: false, error: 'Timeout waiting for task completion' };
  }

  getProviderName(): string {
    return this.providerName;
  }

  isAvailable(): boolean {
    return !!(this.apiKey || (this.accessKey && this.secretKey));
  }

  async testConnection(): Promise<boolean> {
    try {
      return this.isAvailable();
    } catch {
      return false;
    }
  }

  protected isTauriAvailable(): boolean {
    return !!(window as any).__TAURI__;
  }

  protected async postRequest<T>(
    endpoint: string,
    body?: any,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body,
      ...config,
    });
  }

  protected async getRequest<T>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...config,
    });
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    timeoutMs: number = 60000
  ): Promise<T> {
    // 安全策略：所有请求统一走后端代理，不在前端暴露 API Key
    return this.backendProxyRequest<T>(endpoint, options, maxRetries, timeoutMs);
  }

  /**
   * 通过后端代理发送请求，API Key 存储在后端，前端不暴露
   */
  private async backendProxyRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    timeoutMs: number = 60000
  ): Promise<T> {
    const backendUrl = this.getBackendUrl();
    const providerPath = this.getProviderProxyPath();
    const url = `${backendUrl}/api/v1/proxy/${providerPath}${endpoint}`;
    const method = options.method || 'GET';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const token = this.getAuthToken();

        let requestBody = options.body;
        if (requestBody && typeof requestBody === 'object') {
          requestBody = JSON.stringify(requestBody);
        }

        const forwardedHeaders = { ...(options.headers as Record<string, string>) };
        delete forwardedHeaders.Authorization;
        delete forwardedHeaders.authorization;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...forwardedHeaders,
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          ...options,
          method,
          body: requestBody,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error('API Error: ' + response.status + ' - ' + errorText);
        }

        return response.json();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 8000)));
      }
    }
    throw new Error('请求失败');
  }

  /**
   * 获取后端 URL
   */
  private getBackendUrl(): string {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('backend-api-url');
      if (stored) return stored;
      if ((window as any).electronAPI) return 'http://localhost:3200';
      if (import.meta.env.DEV) return 'http://localhost:3200';
      return window.location.origin;
    }
    return 'http://localhost:3200';
  }

  /**
   * 获取当前 provider 的代理路径
   */
  private getProviderProxyPath(): string {
    return this.providerName || 'any';
  }

  /**
   * 获取认证 token
   */
  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('auth-token') || localStorage.getItem('token') || null;
    } catch {
      return null;
    }
  }

  protected convertAspectRatioToSize(aspectRatio?: string): string {
    switch (aspectRatio) {
      case '1:1': return '1920x1920';
      case '3:4': return '1440x1920';
      case '4:3': return '1920x1440';
      case '16:9': return '1920x1080';
      case '9:16': return '1080x1920';
      default: return '1920x1920';
    }
  }

  protected getWidthFromAspectRatio(aspectRatio: string): number {
    const size = this.convertAspectRatioToSize(aspectRatio);
    return parseInt(size.split('x')[0]) || 1920;
  }

  protected getHeightFromAspectRatio(aspectRatio: string): number {
    const size = this.convertAspectRatioToSize(aspectRatio);
    return parseInt(size.split('x')[1]) || 1920;
  }

  protected createFailedResult(error: any, taskId: string = ''): GenerationResult {
    return {
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  protected createPendingResult(taskId: string): GenerationResult {
    return {
      taskId,
      status: 'pending',
    };
  }

  protected extractTaskId(response: any): string {
    return response?.id || response?.output?.task_id || '';
  }
}

export default BaseGenerator;
