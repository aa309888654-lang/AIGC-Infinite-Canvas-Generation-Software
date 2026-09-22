/**
 * CoreAPISDK - 统一连接控制SDK
 * 提供连接池、重试、熔断、限流、缓存、日志追踪等能力
 */

import { requestWithRetry } from '../api-client';
import { logger } from '@/lib/logger';

// ==================== CoreAPISDK 类 ====================
export class CoreAPISDK {
  private static instance: CoreAPISDK;
  private activeConnections: number = 0;
  private maxConnections: number = 10;
  private requestCache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL: number = 60000;

  private constructor() { /* noop */ }

  public static getInstance(): CoreAPISDK {
    if (!CoreAPISDK.instance) {
      CoreAPISDK.instance = new CoreAPISDK();
    }
    return CoreAPISDK.instance;
  }

  /**
   * 发起受 SDK 管控的请求
   */
  public async request<T>(
    url: string,
    options: RequestInit = {},
    config?: {
      useCache?: boolean;
      maxRetries?: number;
      timeoutMs?: number;
      traceId?: string;
    }
  ): Promise<T> {
    const traceId = config?.traceId || crypto.randomUUID();
    const cacheKey = `${options.method || 'GET'}_${url}_${JSON.stringify(options.body)}`;

    // 1. 缓存层检查
    if (config?.useCache && (options.method === 'GET' || !options.method)) {
      const cached = this.requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        logger.info(`[SDK] Cache hit for ${url}`, { traceId });
        return cached.data as T;
      }
    }

    // 2. 限流与连接池控制
    if (this.activeConnections >= this.maxConnections) {
      logger.warn(`[SDK] Connection pool exhausted. Active: ${this.activeConnections}`, { traceId });
      throw new Error('Connection pool exhausted. Please try again later.');
    }

    this.activeConnections++;
    logger.info(`[SDK] Request start: ${url}`, { traceId, activeConnections: this.activeConnections });

    try {
      // 3. 执行请求 (内部已封装重试与熔断机制)
      const result = await requestWithRetry<T>(
        url,
        options,
        config?.maxRetries || 3,
        1000,
        config?.timeoutMs || 30000
      );

      // 4. 更新缓存
      if (config?.useCache && (options.method === 'GET' || !options.method)) {
        this.requestCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }

      return result;
    } catch (error) {
      logger.error(`[SDK] Request failed: ${url}`, { traceId, error });
      throw error;
    } finally {
      this.activeConnections--;
      logger.info(`[SDK] Request end: ${url}`, { traceId, activeConnections: this.activeConnections });
    }
  }

  /**
   * 监控 SDK 状态
   */
  public getStats() {
    return {
      activeConnections: this.activeConnections,
      cacheSize: this.requestCache.size,
    };
  }
}

// ==================== 导出单例 ====================
export const sdk = CoreAPISDK.getInstance();
