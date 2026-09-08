/**
 * 登录安全中间件
 * 防止暴力破解攻击
 * 优先使用Redis存储（支持多实例），降级到内存存储（单实例）
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { redisService } from '../services/redis-service';
import { logger } from '../utils/logger';

// 内存存储（降级方案）
interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

class LoginSecurityManager {
  private static instance: LoginSecurityManager;
  private attempts: Map<string, LoginAttempt> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private useRedis: boolean = true; // 优先使用Redis

  // 配置
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000;
  private readonly ATTEMPT_WINDOW = 15 * 60 * 1000;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 清理间隔1小时

  // Redis key 前缀
  private readonly REDIS_PREFIX = 'login_security:';
  private readonly REDIS_LOCK_PREFIX = 'login_lock:';

  private constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanup();
    }
  }

  public static getInstance(): LoginSecurityManager {
    if (!LoginSecurityManager.instance) {
      LoginSecurityManager.instance = new LoginSecurityManager();
    }
    return LoginSecurityManager.instance;
  }

  /**
   * 检查是否被锁定
   */
  public async isLocked(identifier: string): Promise<boolean> {
    // 优先检查Redis锁定key
    if (this.useRedis && redisService.isReady()) {
      try {
        const lockKey = `${this.REDIS_LOCK_PREFIX}${identifier}`;
        const locked = await redisService.getCache(lockKey);
        if (locked) {
          return true;
        }

        // 检查尝试次数
        const attemptKey = `${this.REDIS_PREFIX}${identifier}`;
        const dataStr = await redisService.getCache(attemptKey);
        if (dataStr) {
          try {
            const attempt = JSON.parse(dataStr) as LoginAttempt;
            if (Date.now() - attempt.firstAttempt < this.ATTEMPT_WINDOW && attempt.count >= this.MAX_ATTEMPTS) {
              return true;
            }
          } catch {
            // 数据损坏，忽略
          }
        }
        return false;
      } catch {
        // Redis异常，降级到内存
      }
    }

    // 内存降级
    return this.isLockedMemory(identifier);
  }

  private isLockedMemory(identifier: string): boolean {
    const attempt = this.attempts.get(identifier);

    if (!attempt) return false;

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) return true;

    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      this.attempts.delete(identifier);
      return false;
    }

    const timeSinceFirstAttempt = Date.now() - attempt.firstAttempt;
    return timeSinceFirstAttempt < this.ATTEMPT_WINDOW && attempt.count >= this.MAX_ATTEMPTS;
  }

  /**
   * 记录登录失败
   */
  public async recordFailedAttempt(identifier: string): Promise<{ locked: boolean; remainingAttempts: number }> {
    const now = Date.now();

    // 优先使用Redis
    if (this.useRedis && redisService.isReady()) {
      try {
        const attemptKey = `${this.REDIS_PREFIX}${identifier}`;
        const lockKey = `${this.REDIS_LOCK_PREFIX}${identifier}`;

        // 检查是否已锁定
        const existingLock = await redisService.getCache(lockKey);
        if (existingLock) {
          return { locked: true, remainingAttempts: 0 };
        }

        // 获取当前尝试记录
        let attempt: LoginAttempt | null = null;
        const dataStr = await redisService.getCache(attemptKey);
        if (dataStr) {
          try {
            attempt = JSON.parse(dataStr) as LoginAttempt;
          } catch {
            attempt = null;
          }
        }

        if (!attempt || (now - attempt.firstAttempt >= this.ATTEMPT_WINDOW)) {
          // 第一次失败或窗口过期，重置
          attempt = { count: 1, firstAttempt: now, lastAttempt: now };
        } else {
          attempt.count++;
          attempt.lastAttempt = now;
        }

        // 检查是否需要锁定
        if (attempt.count >= this.MAX_ATTEMPTS) {
          // 设置锁定key，TTL为锁定时长
          await redisService.setCache(lockKey, '1', this.LOCKOUT_DURATION / 1000);
          // 删除尝试记录（锁定key已接管）
          await redisService.deleteCache(attemptKey);
          return { locked: true, remainingAttempts: 0 };
        }

        // 保存尝试记录，TTL为窗口时长
        await redisService.setCache(attemptKey, JSON.stringify(attempt), this.ATTEMPT_WINDOW / 1000);
        return { locked: false, remainingAttempts: this.MAX_ATTEMPTS - attempt.count };
      } catch {
        // Redis异常，降级到内存
      }
    }

    // 内存降级
    return this.recordFailedAttemptMemory(identifier);
  }

  private recordFailedAttemptMemory(identifier: string): { locked: boolean; remainingAttempts: number } {
    const now = Date.now();
    const attempt = this.attempts.get(identifier);

    if (!attempt) {
      this.attempts.set(identifier, { count: 1, firstAttempt: now, lastAttempt: now });
      return { locked: false, remainingAttempts: this.MAX_ATTEMPTS - 1 };
    }

    if (attempt.lockedUntil && now < attempt.lockedUntil) {
      return { locked: true, remainingAttempts: 0 };
    }

    const timeSinceFirstAttempt = now - attempt.firstAttempt;
    if (timeSinceFirstAttempt >= this.ATTEMPT_WINDOW) {
      this.attempts.set(identifier, { count: 1, firstAttempt: now, lastAttempt: now });
      return { locked: false, remainingAttempts: this.MAX_ATTEMPTS - 1 };
    }

    attempt.count++;
    attempt.lastAttempt = now;

    if (attempt.count >= this.MAX_ATTEMPTS) {
      attempt.lockedUntil = now + this.LOCKOUT_DURATION;
      this.attempts.set(identifier, attempt);
      return { locked: true, remainingAttempts: 0 };
    }

    return { locked: false, remainingAttempts: this.MAX_ATTEMPTS - attempt.count };
  }

  /**
   * 记录登录成功
   */
  public async recordSuccess(identifier: string): Promise<void> {
    if (this.useRedis && redisService.isReady()) {
      try {
        const attemptKey = `${this.REDIS_PREFIX}${identifier}`;
        const lockKey = `${this.REDIS_LOCK_PREFIX}${identifier}`;
        await redisService.deleteCache(attemptKey);
        await redisService.deleteCache(lockKey);
        return;
      } catch {
        // 降级到内存
      }
    }

    this.attempts.delete(identifier);
  }

  /**
   * 获取锁定剩余时间
   */
  public async getLockoutRemainingTime(identifier: string): Promise<number> {
    if (this.useRedis && redisService.isReady()) {
      try {
        const lockKey = `${this.REDIS_LOCK_PREFIX}${identifier}`;
        const ttl = await redisService.getTTL(lockKey);
        if (ttl > 0) return ttl * 1000;
        return 0;
      } catch {
        // 降级到内存
      }
    }

    const attempt = this.attempts.get(identifier);
    if (!attempt || !attempt.lockedUntil) return 0;
    const remaining = attempt.lockedUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * 获取尝试信息（仅内存模式）
   */
  public getAttemptInfo(identifier: string): LoginAttempt | null {
    return this.attempts.get(identifier) || null;
  }

  /**
   * 手动解锁
   */
  public async unlock(identifier: string): Promise<boolean> {
    if (this.useRedis && redisService.isReady()) {
      try {
        const attemptKey = `${this.REDIS_PREFIX}${identifier}`;
        const lockKey = `${this.REDIS_LOCK_PREFIX}${identifier}`;
        await redisService.deleteCache(attemptKey);
        await redisService.deleteCache(lockKey);
        return true;
      } catch {
        // 降级到内存
      }
    }
    return this.attempts.delete(identifier);
  }

  /**
   * 解锁所有
   */
  public async unlockAll(): Promise<void> {
    this.attempts.clear();
    // Redis模式无需批量清理（TTL自动过期）
  }

  private startCleanup(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.cleanupInterval = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [identifier, attempt] of this.attempts.entries()) {
      if (now - attempt.lastAttempt > this.CLEANUP_INTERVAL) {
        this.attempts.delete(identifier);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      logger.info(`[LoginSecurity] 清理了 ${cleanedCount} 条过期记录`);
    }
  }

  public getStats(): { totalTracked: number; currentlyLocked: number } {
    let locked = 0;
    for (const attempt of this.attempts.values()) {
      if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) locked++;
    }
    return { totalTracked: this.attempts.size, currentlyLocked: locked };
  }
}

const loginSecurity = LoginSecurityManager.getInstance();

/**
 * 登录安全中间件
 */
// ERR-06 修复：改用 async/await 替代 Promise 链，避免未处理 rejection
export async function loginSecurityMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const identifier = `${req.ip}_${req.body?.username || 'unknown'}`;

  try {
    const locked = await loginSecurity.isLocked(identifier);
    if (locked) {
      const remainingMs = await loginSecurity.getLockoutRemainingTime(identifier);
      const remainingTime = Math.ceil(remainingMs / 1000 / 60);
      res.status(429).json({
        success: false,
        error: `登录尝试次数过多，请在 ${remainingTime} 分钟后重试`,
        code: 'ACCOUNT_LOCKED',
        retryAfter: remainingTime * 60
      });
      return;
    }
    next();
  } catch {
    // 安全检查失败时默认拒绝（fail-close策略）
    console.error('[LoginSecurity] 安全检查异常，默认拒绝登录请求');
    res.status(503).json({
      success: false,
      error: '安全服务暂时不可用，请稍后重试',
      code: 'SECURITY_SERVICE_ERROR',
    });
  }
}

/**
 * 记录登录结果
 */
export async function recordLoginResult(
  username: string,
  ip: string,
  success: boolean,
  userAgent?: string,
  userId?: string
): Promise<void> {
  const identifier = `${ip}_${username}`;

  let deviceInfo = '';
  let deviceType = 'unknown';
  let browser = 'unknown';
  let os = 'unknown';

  if (userAgent) {
    deviceInfo = parseDeviceInfo(userAgent);
    const parsed = parseUserAgent(userAgent);
    deviceType = parsed.deviceType;
    browser = parsed.browser;
    os = parsed.os;
  }

  try {
    await prisma.loginLog.create({
      data: {
        userId: userId || null,
        ip: ip || null,
        userAgent: userAgent || null,
        device: deviceInfo || null,
        location: null,
        status: success ? 'success' : 'failed',
      },
    });

    if (success && userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: ip,
        },
      });
    }
  } catch (error) {
    console.error('Failed to record login log:', error);
  }

  if (success) {
    await loginSecurity.recordSuccess(identifier);
    logger.info(`[LoginSecurity] 登录成功: ${username} from ${ip} (${deviceType}/${browser}/${os})`);
  } else {
    const result = await loginSecurity.recordFailedAttempt(identifier);
    if (result.locked) {
      console.warn(`[LoginSecurity] 账户锁定: ${username} from ${ip}`);
    } else {
      console.warn(`[LoginSecurity] 登录失败: ${username} from ${ip} - 剩余: ${result.remainingAttempts}`);
    }
  }
}

/**
 * 解析设备信息
 */
function parseDeviceInfo(userAgent: string): string {
  try {
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    const isBot = /bot|crawler|spider/i.test(userAgent);

    let device = 'Desktop';
    if (isBot) device = 'Bot';
    else if (isTablet) device = 'Tablet';
    else if (isMobile) device = 'Mobile';

    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|IE|Microsoft Edge)\/[\d.]+/i);
    const osMatch = userAgent.match(/(Windows|Mac OS|Linux|Android|iOS|Ubuntu|CentOS|Debian)\s*[\d.]*/i);

    const browser = browserMatch ? browserMatch[1] : 'Unknown';
    const os = osMatch ? osMatch[1] : 'Unknown';

    return `${device} - ${browser} on ${os}`;
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * 解析用户代理字符串
 */
function parseUserAgent(userAgent: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  let deviceType = 'Desktop';
  let browser = 'Unknown';
  let os = 'Unknown';

  // 检测设备类型
  if (/mobile|android|iphone|ipod/i.test(userAgent)) {
    deviceType = 'Mobile';
  }
  if (/tablet|ipad/i.test(userAgent)) {
    deviceType = 'Tablet';
  }
  if (/bot|crawler|spider/i.test(userAgent)) {
    deviceType = 'Bot';
  }

  // 检测浏览器
  if (/Chrome\/[\d.]+/i.test(userAgent) && !/Edg/i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/Firefox\/[\d.]+/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/Safari\/[\d.]+/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    browser = 'Safari';
  } else if (/Edg\/[\d.]+/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/Opera|OPR\/[\d.]+/i.test(userAgent)) {
    browser = 'Opera';
  } else if (/MSIE|Trident/i.test(userAgent)) {
    browser = 'IE';
  }

  // 检测操作系统
  if (/Windows NT 10/i.test(userAgent)) {
    os = 'Windows 10/11';
  } else if (/Windows NT 6.3/i.test(userAgent)) {
    os = 'Windows 8.1';
  } else if (/Windows NT 6.2/i.test(userAgent)) {
    os = 'Windows 8';
  } else if (/Windows NT 6.1/i.test(userAgent)) {
    os = 'Windows 7';
  } else if (/Mac OS X/i.test(userAgent)) {
    const version = userAgent.match(/Mac OS X ([\d_]+)/i);
    os = version ? `macOS ${version[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Linux/i.test(userAgent)) {
    if (/Ubuntu/i.test(userAgent)) {
      os = 'Ubuntu';
    } else if (/Debian/i.test(userAgent)) {
      os = 'Debian';
    } else if (/CentOS/i.test(userAgent)) {
      os = 'CentOS';
    } else {
      os = 'Linux';
    }
  } else if (/Android/i.test(userAgent)) {
    const version = userAgent.match(/Android ([\d.]+)/i);
    os = version ? `Android ${version[1]}` : 'Android';
  } else if (/iOS|iPhone|iPad|iPod/i.test(userAgent)) {
    const version = userAgent.match(/OS ([\d_]+)/i);
    os = version ? `iOS ${version[1].replace(/_/g, '.')}` : 'iOS';
  }

  return { deviceType, browser, os };
}

export { loginSecurity };
