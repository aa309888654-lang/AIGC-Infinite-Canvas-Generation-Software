import rateLimit, { type Options, type Store } from 'express-rate-limit';
import type { Request } from 'express';
import { redisService } from '../services/redis-service';
import { logger } from '../utils/logger';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const GLOBAL_LIMIT_MAX = IS_PRODUCTION ? 600 : 3000;

type LocalHit = {
  totalHits: number;
  resetTime: Date;
};

class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = FIFTEEN_MINUTES;
  private localHits = new Map<string, LocalHit>();

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async get(key: string) {
    const redisKey = this.toRedisKey(key);
    const value = await redisService.get(redisKey);
    if (value !== null) {
      const ttl = await redisService.getTTL(redisKey);
      return {
        totalHits: Number(value) || 0,
        resetTime: new Date(Date.now() + Math.max(ttl, 1) * 1000),
      };
    }

    return this.getLocal(key);
  }

  async increment(key: string) {
    const redisKey = this.toRedisKey(key);
    const windowSeconds = Math.max(1, Math.ceil(this.windowMs / 1000));
    const totalHits = await redisService.incrWithExpiry(redisKey, windowSeconds);

    if (totalHits > 0) {
      const ttl = await redisService.getTTL(redisKey);
      return {
        totalHits,
        resetTime: new Date(Date.now() + Math.max(ttl, 1) * 1000),
      };
    }

    if (IS_PRODUCTION) {
      throw new Error('Redis rate-limit store is unavailable');
    }

    logger.warn(
      '[RateLimiter] Redis unavailable, using local in-memory fallback for development/test'
    );
    return this.incrementLocal(key);
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.toRedisKey(key);
    const current = await redisService.get(redisKey);
    if (current !== null) {
      await redisService.decrClamped(redisKey);
      return;
    }

    const local = this.getLocal(key);
    if (!local) return;
    if (local.totalHits <= 1) {
      this.localHits.delete(key);
      return;
    }
    local.totalHits -= 1;
  }

  async resetKey(key: string): Promise<void> {
    await redisService.del(this.toRedisKey(key));
    this.localHits.delete(key);
  }

  resetAll(): void {
    this.localHits.clear();
  }

  private toRedisKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private getLocal(key: string): LocalHit | undefined {
    const hit = this.localHits.get(key);
    if (!hit) return undefined;

    if (hit.resetTime.getTime() <= Date.now()) {
      this.localHits.delete(key);
      return undefined;
    }

    return hit;
  }

  private incrementLocal(key: string) {
    const existing = this.getLocal(key);
    if (existing) {
      existing.totalHits += 1;
      return existing;
    }

    const hit = {
      totalHits: 1,
      resetTime: new Date(Date.now() + this.windowMs),
    };
    this.localHits.set(key, hit);
    return hit;
  }
}

function createRedisRateLimitStore(name: string): Store {
  return new RedisRateLimitStore(`ratelimit:${name}:`);
}

const GLOBAL_LIMITER_GET_POLLING_PATHS = [
  /^\/api\/v1\/audio\/(?:music-query|image-query|async-query)$/,
  /^\/api\/v1\/video\/query\/[^/]+$/,
  /^\/api\/v1\/tasks\/[^/]+$/,
  // 轻量级轮询接口：审批待办 + 通知未读数，不消耗全局限流配额
  /^\/api\/v1\/actions\/approvals\/pending$/,
  /^\/api\/v1\/notifications\/unread-count$/,
];

function shouldSkipGlobalLimiter(req: Request): boolean {
  if (req.method === 'OPTIONS' || req.originalUrl.startsWith('/api/health')) {
    return true;
  }

  if (req.method !== 'GET') {
    return false;
  }

  const pathname = req.originalUrl.split('?')[0];
  return GLOBAL_LIMITER_GET_POLLING_PATHS.some((pattern) => pattern.test(pathname));
}

export const authLimiter = rateLimit({
  store: createRedisRateLimitStore('auth'),
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '登录请求过于频繁，请15分钟后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  keyGenerator: (req) => {
    return `${req.ip}_${req.body?.username || 'unknown'}`;
  },
});

// SMS endpoints are expensive even before authentication (provider fees and
// account-enumeration risk). Keep a separate, stricter limiter from login.
export const smsLimiter = rateLimit({
  store: createRedisRateLimitStore('sms'),
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '短信请求过于频繁，请15分钟后重试', code: 'RATE_LIMIT_EXCEEDED' },
  keyGenerator: (req) => `sms:${req.ip}:${String(req.body?.phone || 'unknown').replace(/\D/g, '')}`,
});

// Registration must not be blocked because multiple people share one network.
// Account, email/phone verification, device uniqueness and captcha safeguards
// remain enforced in the registration handlers.
export const registrationLimiter = (_req: Request, _res: unknown, next: () => void) => next();

export const captchaLimiter = rateLimit({
  store: createRedisRateLimitStore('captcha'),
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '验证码请求过于频繁，请稍后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const paymentLimiter = rateLimit({
  store: createRedisRateLimitStore('payment'),
  windowMs: FIFTEEN_MINUTES,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '支付请求过于频繁，请稍后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const aiGenerationLimiter = rateLimit({
  store: createRedisRateLimitStore('ai-generation'),
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI生成请求过于频繁，请稍后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// P1 修复 #12：密码修改类接口限流（5 次/15 分钟），防止已登录态暴力破解旧密码
export const passwordChangeLimiter = rateLimit({
  store: createRedisRateLimitStore('password-change'),
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '密码修改请求过于频繁，请15分钟后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  keyGenerator: (req) => `pwd:${req.userId || req.ip}`,
});

export const contactBindingLimiter = rateLimit({
  store: createRedisRateLimitStore('contact-binding'),
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '绑定请求过于频繁，请15分钟后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  keyGenerator: (req) => `contact:${req.userId || req.ip}`,
});

// P1 修复 #8：AI 公开接口限流（30 次/15 分钟），防止无鉴权接口被滥用消耗 AI 额度
export const aiPublicLimiter = rateLimit({
  store: createRedisRateLimitStore('ai-public'),
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI公开接口请求过于频繁，请稍后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const globalLimiter = rateLimit({
  store: createRedisRateLimitStore('global'),
  windowMs: FIFTEEN_MINUTES,
  max: GLOBAL_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipGlobalLimiter,
  message: {
    success: false,
    error: '请求过于频繁，请稍后重试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
