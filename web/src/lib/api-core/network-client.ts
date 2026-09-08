import { ApiNetworkError } from './errors';
import { ApiLogger } from './logger';
import { CircuitBreaker } from './circuit-breaker';

interface RequestConfig extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  taskId?: string;
}

type UnauthorizedHandler = () => void;

export class NetworkClient {
  private circuitBreaker = new CircuitBreaker(5, 60000);
  private onUnauthorized: UnauthorizedHandler | null = null;

  /**
   * 设置401未授权处理器
   */
  public setUnauthorizedHandler(handler: UnauthorizedHandler): void {
    this.onUnauthorized = handler;
  }

  /**
   * 异步非阻塞调用，支持重试、超时、熔断
   */
  async request<T>(url: string, config: RequestConfig = {}): Promise<T> {
    const {
      timeoutMs = 30000,
      maxRetries = 3,
      baseRetryDelayMs = 1000,
      taskId = 'any',
      ...fetchConfig
    } = config;

    return this.circuitBreaker.execute(async () => {
      let attempt = 0;

      while (attempt <= maxRetries) {
        try {
          return await this.executeRequest<T>(url, fetchConfig, timeoutMs, taskId);
        } catch (error) {
          // 401错误不重试，直接触发未授权处理器
          if (error instanceof ApiNetworkError && error.statusCode === 401) {
            if (this.onUnauthorized) {
              this.onUnauthorized();
            }
            throw error;
          }

          const isRetryable = this.isRetryableError(error);

          if (!isRetryable || attempt >= maxRetries) {
            throw error; // 抛出异常由外层处理，如不可重试则直接进入失败队列
          }

          attempt++;
          const delay = baseRetryDelayMs * Math.pow(2, attempt - 1); // 指数退避
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`[NetworkClient] Task ${taskId} request failed, retrying (${attempt}/${maxRetries}) in ${delay}ms...`, errorMessage);
          await this.sleep(delay);
        }
      }

      throw new Error("Unreachable");
    });
  }

  private async executeRequest<T>(url: string, config: RequestInit, timeoutMs: number, taskId: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    ApiLogger.logRequest(url, config.method || 'GET', (config.headers as Record<string, string>) || {}, config.body ? JSON.parse(config.body as string) : undefined);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });

      const costMs = Date.now() - startTime;
      const status = response.status;
      
      if (!response.ok) {
        let errorMsg = `HTTP Error ${status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error?.message || errorData.message || errorMsg;
        } catch (e) {
          // Ignore JSON parse error
        }
        
        // 分类异常是否可重试
        const retryable = [408, 429, 500, 502, 503, 504].includes(status);
        throw new ApiNetworkError(errorMsg, retryable, status);
      }

      // Check for 202 Accepted which requires polling
      if (status === 202) {
        return { isAccepted: true, raw: await response.json() } as any as T;
      }

      const data = await response.json();
      
      // 业务code判断
      if (data.code !== undefined && data.code !== 0) {
        throw new ApiNetworkError(`Business Error: ${data.message || data.msg || 'any error'}`, false, status);
      }

      ApiLogger.logResponse(taskId, status, costMs);
      return data as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new ApiNetworkError(`Request timeout after ${timeoutMs}ms`, true); // 超时可重试
      }
      
      if (error instanceof ApiNetworkError) {
        throw error;
      }
      
      // 网络断开等底层错误
      throw new ApiNetworkError((error instanceof Error ? error.message : String(error)) || 'Network request failed', true);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof ApiNetworkError) {
      return error.retryable;
    }
    return true; // 默认所有未捕获的网络错误都重试
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const networkClient = new NetworkClient();
