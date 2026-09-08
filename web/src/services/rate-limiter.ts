/**
 * rate-limiter.ts - 限流器
 * 基于 Token Bucket 算法的请求频率控制
 * 每个 Provider 独立限流，支持每秒请求数和突发容量配置
 */
import { logger } from '@/lib/logger';

// ========== 配置类型 ==========
export interface RateLimitConfig {
  /** 每秒允许的请求数 (rps) */
  requestsPerSecond: number;
  /** 突发容量 (bucket size) */
  burstCapacity: number;
  /** 可选的命名空间（如 API Key） */
  namespace?: string;
}

export interface RateLimitResult {
  /** 是否允许请求 */
  allowed: boolean;
  /** 距离下次可请求的毫秒数 */
  waitMs: number;
  /** 当前桶内剩余 token 数 */
  remainingTokens: number;
  /** 当前时间戳 */
  timestamp: number;
}

// ========== 默认配置 ==========
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  doubao: { requestsPerSecond: 10, burstCapacity: 20, namespace: 'doubao' },
  seedream: { requestsPerSecond: 5, burstCapacity: 10, namespace: 'seedream' },
  jimeng: { requestsPerSecond: 5, burstCapacity: 10, namespace: 'jimeng' },
  minimax: { requestsPerSecond: 5, burstCapacity: 10, namespace: 'minimax' },
  stability_ai: { requestsPerSecond: 3, burstCapacity: 6, namespace: 'stability_ai' },
  default: { requestsPerSecond: 5, burstCapacity: 10, namespace: 'default' },
};

// ========== TokenBucket 实现 ==========
class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;
  private readonly rps: number;       // 每秒补充的 token 数
  private readonly capacity: number; // 桶容量
  private readonly namespace: string;
  
  constructor(config: RateLimitConfig) {
    this.tokens = config.burstCapacity;
    this.lastRefillTime = Date.now();
    this.rps = config.requestsPerSecond;
    this.capacity = config.burstCapacity;
    this.namespace = config.namespace || 'default';
  }
  
  /**
   * 补充 token（根据时间流逝自动补充）
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillTime) / 1000; // 秒
    const tokensToAdd = elapsed * this.rps;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
  
  /**
   * 尝试获取一个 token
   */
  tryAcquire(): RateLimitResult {
    this.refill();
    
    const now = Date.now();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return {
        allowed: true,
        waitMs: 0,
        remainingTokens: Math.floor(this.tokens),
        timestamp: now,
      };
    }
    
    // 计算需要等待多久才能获得一个 token
    const waitMs = Math.ceil((1 - this.tokens) / this.rps * 1000);
    
    return {
      allowed: false,
      waitMs,
      remainingTokens: Math.floor(this.tokens),
      timestamp: now,
    };
  }
  
  /**
   * 等待并获取 token
   */
  async acquire(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = this.tryAcquire();
      
      if (result.allowed) {
        return true;
      }
      
      if (Date.now() - startTime + result.waitMs > timeoutMs) {
        logger.warn(`RateLimiter [${this.namespace}]: Timeout waiting for token`);
        return false;
      }
      
      await this.sleep(result.waitMs);
    }
  }
  
  /**
   * 重置桶状态
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTime = Date.now();
  }
  
  /**
   * 获取当前状态
   */
  getStatus(): { tokens: number; capacity: number; rps: number } {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      capacity: this.capacity,
      rps: this.rps,
    };
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========== 全局限流器管理器 ==========
class RateLimiterManager {
  private buckets: Map<string, TokenBucket> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private globalConfig: RateLimitConfig = DEFAULT_RATE_LIMITS.default!;
  
  /**
   * 获取或创建指定 Provider 的 TokenBucket
   */
  private getBucket(provider: string): TokenBucket {
    if (!this.buckets.has(provider)) {
      const config = this.configs.get(provider) || {
        ...DEFAULT_RATE_LIMITS.default!,
        namespace: provider,
      };
      this.buckets.set(provider, new TokenBucket(config));
      logger.info(`RateLimiter: Created bucket for provider "${provider}"`);
    }
    return this.buckets.get(provider)!;
  }
  
  /**
   * 尝试请求（不等待）
   */
  tryAcquire(provider: string): RateLimitResult {
    return this.getBucket(provider).tryAcquire();
  }
  
  /**
   * 等待并获取 token
   */
  async acquire(provider: string, timeoutMs?: number): Promise<boolean> {
    return this.getBucket(provider).acquire(timeoutMs);
  }
  
  /**
   * 异步尝试（自动等待）
   */
  async tryAcquireAsync(provider: string): Promise<RateLimitResult> {
    const bucket = this.getBucket(provider);
    const result = bucket.tryAcquire();
    
    if (result.allowed) {
      return result;
    }
    
    // 自动等待
    await bucket.acquire();
    return bucket.tryAcquire();
  }
  
  /**
   * 更新 Provider 的限流配置
   */
  configure(provider: string, config: Partial<RateLimitConfig>): void {
    const existing = this.configs.get(provider) || { ...DEFAULT_RATE_LIMITS.default!, namespace: provider };
    const merged = { ...existing, ...config };
    this.configs.set(provider, merged);
    
    // 如果桶已存在，重置它
    if (this.buckets.has(provider)) {
      const bucket = this.buckets.get(provider)!;
      bucket.reset();
      logger.info(`RateLimiter: Reconfigured provider "${provider}"`, merged);
    }
  }
  
  /**
   * 设置全局默认配置
   */
  setGlobalConfig(config: Partial<RateLimitConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
  }
  
  /**
   * 获取所有 Provider 的状态
   */
  getAllStatus(): Record<string, { tokens: number; capacity: number; rps: number }> {
    const status: Record<string, { tokens: number; capacity: number; rps: number }> = {};
    
    for (const [provider, bucket] of this.buckets) {
      status[provider] = bucket.getStatus();
    }
    
    return status;
  }
  
  /**
   * 重置指定 Provider 的桶
   */
  reset(provider: string): void {
    const bucket = this.buckets.get(provider);
    if (bucket) {
      bucket.reset();
      logger.info(`RateLimiter: Reset bucket for provider "${provider}"`);
    }
  }
  
  /**
   * 重置所有桶
   */
  resetAll(): void {
    for (const bucket of this.buckets.values()) {
      bucket.reset();
    }
    logger.info('RateLimiter: Reset all buckets');
  }
  
  /**
   * 获取已配置的 Provider 列表
   */
  getProviders(): string[] {
    return Array.from(this.buckets.keys());
  }
}

// ========== 单例导出 ==========
export const rateLimiter = new RateLimiterManager();

// ========== 便捷函数 ==========

/**
 * 尝试获取请求许可（异步）
 */
export async function acquireRateLimit(
  provider: string,
  options?: { timeoutMs?: number; autoWait?: boolean }
): Promise<RateLimitResult> {
  const { timeoutMs = 30000, autoWait = true } = options || {};
  
  if (autoWait) {
    const allowed = await rateLimiter.acquire(provider, timeoutMs);
    if (allowed) {
      return rateLimiter.tryAcquire(provider);
    }
    return {
      allowed: false,
      waitMs: timeoutMs,
      remainingTokens: 0,
      timestamp: Date.now(),
    };
  }
  
  return rateLimiter.tryAcquire(provider);
}

/**
 * 包装一个异步函数，自动限流
 */
export function withRateLimit<T extends unknown[], R>(
  provider: string,
  fn: (...args: T) => Promise<R>,
  options?: { timeoutMs?: number }
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    await acquireRateLimit(provider, { autoWait: true, timeoutMs: options?.timeoutMs });
    return fn(...args);
  };
}

export default rateLimiter;
