/**
 * 统一API客户端
 * 合并 requestWithRetry 和 NetworkClient 功能
 */

import { RequestConfig} from './types';
import { logger } from '@/lib/logger';

// ==================== 错误类 ====================
export class UnifiedAPIError extends Error {
  public retryable: boolean;
  public statusCode?: number;
  public traceId?: string;
  
  constructor(message: string, retryable: boolean = true, statusCode?: number, traceId?: string) {
    super(message);
    this.name = 'UnifiedAPIError';
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.traceId = traceId;
  }
}

// ==================== 统一API客户端类 ====================
class UnifiedAPIClient {
  private static instance: UnifiedAPIClient;
  private activeConnections: number = 0;
  private maxConnections: number = 10;
  private requestCache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL: number = 60000;
  private circuitBreakerFailureCount: number = 0;
  private circuitBreakerThreshold: number = 5;
  private circuitBreakerResetTimeout: number = 60000;
  private lastCircuitBreakerFailure: number = 0;

  static getInstance(): UnifiedAPIClient {
    if (!UnifiedAPIClient.instance) {
      UnifiedAPIClient.instance = new UnifiedAPIClient();
    }
    return UnifiedAPIClient.instance;
  }

  /**
   * 发起受管控的API请求
   */
  async request<T>(
    url: string,
    options: RequestInit = {},
    config?: RequestConfig
  ): Promise<T> {
    const traceId = config?.traceId || crypto.randomUUID();
    const cacheKey = `${options.method || 'GET'}_${url}_${JSON.stringify(options.body)}`;

    // 1. 缓存层检查
    if (config?.useCache && (options.method === 'GET' || !options.method)) {
      const cached = this.requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        logger.info(`[UnifiedAPIClient] Cache hit for ${url}`, { traceId });
        return cached.data as T;
      }
    }

    // 2. 熔断器检查
    if (this.isCircuitBreakerOpen()) {
      throw new UnifiedAPIError(
        `Circuit breaker is open. Please wait ${this.getCircuitBreakerRemainingTimeout()}ms`,
        true,
        undefined,
        traceId
      );
    }

    // 3. 连接池控制
    if (this.activeConnections >= this.maxConnections) {
      logger.warn(`[UnifiedAPIClient] Connection pool exhausted. Active: ${this.activeConnections}`, { traceId });
      throw new UnifiedAPIError('Connection pool exhausted. Please try again later.', true, undefined, traceId);
    }

    this.activeConnections++;
    logger.info(`[UnifiedAPIClient] Request start: ${url}`, { traceId, activeConnections: this.activeConnections });

    try {
      // 4. 执行请求（带重试）
      const result = await this.executeWithRetry<T>(url, options, {
        maxRetries: config?.maxRetries || 3,
        timeoutMs: config?.timeoutMs || 30000,
        retryDelay: config?.baseRetryDelayMs || 1000,
        traceId
      });

      // 5. 更新缓存
      if (config?.useCache && (options.method === 'GET' || !options.method)) {
        this.requestCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }

      // 6. 重置熔断器
      this.onCircuitBreakerSuccess();

      return result;
    } catch (error) {
      logger.error(`[UnifiedAPIClient] Request failed: ${url}`, { traceId, error });
      this.onCircuitBreakerFailure();
      throw error;
    } finally {
      this.activeConnections--;
      logger.info(`[UnifiedAPIClient] Request end: ${url}`, { traceId, activeConnections: this.activeConnections });
    }
  }

  /**
   * 带重试的请求执行
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestInit,
    config: {
      maxRetries: number;
      timeoutMs: number;
      retryDelay: number;
      traceId: string;
    }
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Trace-Id': config.traceId,
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
          const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
          
          let errorMessage = `API Error: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Ignore JSON parse error
          }

          if (!retryable || attempt === config.maxRetries) {
            throw new UnifiedAPIError(errorMessage, retryable, response.status, config.traceId);
          }

          const delay = config.retryDelay * Math.pow(2, attempt);
          console.warn(`[UnifiedAPIClient] Retry ${attempt + 1}/${config.maxRetries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        logger.info(`[UnifiedAPIClient] Response received in ${responseTime}ms`, { 
          traceId: config.traceId, 
          status: response.status,
          duration: responseTime 
        });

        return response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (error instanceof UnifiedAPIError && !error.retryable) {
          throw error;
        }

        if (attempt < config.maxRetries) {
          const delay = config.retryDelay * Math.pow(2, attempt);
          console.warn(`[UnifiedAPIClient] Request failed (attempt ${attempt + 1}/${config.maxRetries}): ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new UnifiedAPIError('Request failed after all retries', true, undefined, config.traceId);
  }

  // ==================== 熔断器方法 ====================
  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerFailureCount >= this.circuitBreakerThreshold) {
      const now = Date.now();
      if (now - this.lastCircuitBreakerFailure > this.circuitBreakerResetTimeout) {
        this.circuitBreakerFailureCount = this.circuitBreakerThreshold - 1;
        return false;
      }
      return true;
    }
    return false;
  }

  private onCircuitBreakerSuccess(): void {
    this.circuitBreakerFailureCount = 0;
  }

  private onCircuitBreakerFailure(): void {
    this.circuitBreakerFailureCount++;
    this.lastCircuitBreakerFailure = Date.now();
  }

  private getCircuitBreakerRemainingTimeout(): number {
    const now = Date.now();
    const elapsed = now - this.lastCircuitBreakerFailure;
    return Math.max(0, this.circuitBreakerResetTimeout - elapsed);
  }

  // ==================== 工具方法 ====================
  public getStats() {
    return {
      activeConnections: this.activeConnections,
      cacheSize: this.requestCache.size,
      circuitBreakerState: this.isCircuitBreakerOpen() ? 'open' : 'closed',
      circuitBreakerFailures: this.circuitBreakerFailureCount,
    };
  }

  public clearCache(): void {
    this.requestCache.clear();
  }
}

// ==================== 导出单例 ====================
export const unifiedAPIClient = UnifiedAPIClient.getInstance();

// ==================== 便捷函数 ====================
export async function requestWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000,
  timeoutMs: number = 30000
): Promise<T> {
  return unifiedAPIClient.request<T>(url, options, {
    maxRetries,
    baseRetryDelayMs: retryDelay,
    timeoutMs,
  });
}
