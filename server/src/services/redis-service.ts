import Redis from 'ioredis';
import { logger } from '../utils/logger';

class RedisService {
  private client: Redis | null = null;
  private _isConnected: boolean = false;

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.connect();
    }
  }

  private connect() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.client.on('connect', () => {
        logger.info('[Redis] Connected successfully');
        this._isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
        this._isConnected = false;
      });

      this.client.on('close', () => {
        logger.info('[Redis] Connection closed');
        this._isConnected = false;
      });

      this.client.connect().catch((err) => {
        console.warn('[Redis] Auto-connect failed, will use fallback:', err.message);
      });
    } catch (error) {
      console.warn('[Redis] Failed to initialize, using in-memory fallback');
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  isAvailable(): boolean {
    return this._isConnected && this.client !== null;
  }

  // ==================== 验证码相关 ====================
  
  async setVerificationCode(email: string, code: string, type: string = 'register', expireSeconds: number = 300): Promise<boolean> {
    const key = `verify:${type}:${email}`;
    
    if (this.client) {
      try {
        await this.client.setex(key, expireSeconds, code);
        return true;
      } catch (error) {
        console.error('[Redis] Failed to set verification code:', error);
        return false;
      }
    }
    
    // Fallback to memory (for development without Redis)
    return false;
  }

  async getVerificationCode(email: string, type: string = 'register'): Promise<string | null> {
    const key = `verify:${type}:${email}`;
    
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (error) {
        console.error('[Redis] Failed to get verification code:', error);
        return null;
      }
    }
    
    return null;
  }

  async deleteVerificationCode(email: string, type: string = 'register'): Promise<boolean> {
    const key = `verify:${type}:${email}`;
    
    if (this.client) {
      try {
        await this.client.del(key);
        return true;
      } catch (error) {
        console.error('[Redis] Failed to delete verification code:', error);
        return false;
      }
    }
    
    return false;
  }

  // ==================== 速率限制相关 ====================
  
  async checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
    
    if (this.client) {
      try {
        // Use Lua script for atomic INCR + conditional EXPIRE (prevents key without TTL if process crashes between operations)
        const luaScript = `local current = redis.call('INCR', KEYS[1]); if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return current;`;
        const current = Number(await this.client.eval(luaScript, 1, windowKey, String(windowSeconds)));
        
        const remaining = Math.max(0, maxRequests - current);
        const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;
        
        return {
          allowed: current <= maxRequests,
          remaining,
          resetAt
        };
      } catch (error) {
        console.error('[Redis] Rate limit check failed:', error);
        return { allowed: true, remaining: maxRequests, resetAt: now + windowSeconds };
      }
    }
    
    return { allowed: true, remaining: maxRequests, resetAt: now + windowSeconds };
  }

  // ==================== 缓存相关 ====================
  
  async setCache(key: string, value: string, expireSeconds?: number): Promise<boolean> {
    if (this.client) {
      try {
        if (expireSeconds) {
          await this.client.setex(key, expireSeconds, value);
        } else {
          await this.client.set(key, value);
        }
        return true;
      } catch (error) {
        console.error('[Redis] Failed to set cache:', error);
        return false;
      }
    }
    return false;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getCache(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error('[Redis] Failed to parse JSON cache:', error);
      return null;
    }
  }

  async setJson(key: string, value: unknown, expireSeconds?: number): Promise<boolean> {
    try {
      return await this.setCache(key, JSON.stringify(value), expireSeconds);
    } catch (error) {
      console.error('[Redis] Failed to stringify JSON cache:', error);
      return false;
    }
  }

  async getCache(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (error) {
        console.error('[Redis] Failed to get cache:', error);
        return null;
      }
    }
    return null;
  }

  async deleteCache(key: string): Promise<boolean> {
    if (this.client) {
      try {
        await this.client.del(key);
        return true;
      } catch (error) {
        console.error('[Redis] Failed to delete cache:', error);
        return false;
      }
    }
    return false;
  }

  async getKeysByPattern(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    try {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const result = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');
      return keys;
    } catch (error) {
      console.error('[Redis] Failed to scan keys:', error);
      return [];
    }
  }

  // ==================== Session相关 ====================
  
  async setSession(userId: string, sessionData: object, expireSeconds: number = 86400): Promise<boolean> {
    const key = `session:${userId}`;
    
    if (this.client) {
      try {
        await this.client.setex(key, expireSeconds, JSON.stringify(sessionData));
        return true;
      } catch (error) {
        console.error('[Redis] Failed to set session:', error);
        return false;
      }
    }
    return false;
  }

  async getSession(userId: string): Promise<object | null> {
    const key = `session:${userId}`;
    
    if (this.client) {
      try {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[Redis] Failed to get session:', error);
        return null;
      }
    }
    return null;
  }

  async deleteSession(userId: string): Promise<boolean> {
    const key = `session:${userId}`;
    
    if (this.client) {
      try {
        await this.client.del(key);
        return true;
      } catch (error) {
        console.error('[Redis] Failed to delete session:', error);
        return false;
      }
    }
    return false;
  }

  // ==================== 积分缓存相关 ====================
  
  async cacheUserPoints(userId: string, points: number, expireSeconds: number = 300): Promise<boolean> {
    const key = `points:balance:${userId}`;
    
    if (this.client) {
      try {
        await this.client.setex(key, expireSeconds, points.toString());
        return true;
      } catch (error) {
        console.error('[Redis] Failed to cache points:', error);
        return false;
      }
    }
    return false;
  }

  async getCachedUserPoints(userId: string): Promise<number | null> {
    const key = `points:balance:${userId}`;
    
    if (this.client) {
      try {
        const points = await this.client.get(key);
        return points ? parseInt(points, 10) : null;
      } catch (error) {
        console.error('[Redis] Failed to get cached points:', error);
        return null;
      }
    }
    return null;
  }

  async invalidateUserPoints(userId: string): Promise<boolean> {
    const key = `points:balance:${userId}`;
    
    if (this.client) {
      try {
        await this.client.del(key);
        return true;
      } catch (error) {
        console.error('[Redis] Failed to invalidate points cache:', error);
        return false;
      }
    }
    return false;
  }

  // ==================== 健康检查 ====================

  /**
   * 检查Redis是否就绪
   */
  isReady(): boolean {
    return this._isConnected && this.client !== null;
  }

  /**
   * 获取key的TTL（秒），-1=无过期，-2=key不存在
   */
  async getTTL(key: string): Promise<number> {
    if (!this.client) return -2;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      return -2;
    }
  }

  async ping(): Promise<boolean> {
    if (this.client) {
      try {
        const result = await this.client.ping();
        return result === 'PONG';
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this._isConnected = false;
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.publish(channel, message);
      } catch (error) {
        console.error('[Redis] Failed to publish:', error);
        return 0;
      }
    }
    return 0;
  }

  async lpush(key: string, value: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.lpush(key, value);
      } catch (error) {
        console.error('[Redis] Failed to lpush:', error);
        return 0;
      }
    }
    return 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.client) {
      try {
        return await this.client.expire(key, seconds);
      } catch (error) {
        console.error('[Redis] Failed to set expire:', error);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Atomically increment a key by 1 and return the new value.
   * If the key doesn't exist, it's set to 0 before incrementing (returns 1).
   */
  async incr(key: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.incr(key);
      } catch (error) {
        console.error('[Redis] Failed to incr:', error);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Atomically decrement a key by 1 and return the new value.
   * If the key doesn't exist, it's set to 0 before decrementing (returns -1).
   * Use decrClamped to prevent negative values.
   */
  async decr(key: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.decr(key);
      } catch (error) {
        console.error('[Redis] Failed to decr:', error);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Atomically increment and set expiry if the key is new.
   * Uses a Lua script to ensure INCR + EXPIRE are atomic.
   * Returns the incremented value.
   */
  async incrWithExpiry(key: string, expireSeconds: number): Promise<number> {
    if (this.client) {
      try {
        // Use Lua script for atomic INCR + conditional EXPIRE
        const luaScript = `local current = redis.call('INCR', KEYS[1]); if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return current;`;
        const result = await this.client.eval(luaScript, 1, key, String(expireSeconds));
        return Number(result);
      } catch (error) {
        console.error('[Redis] Failed to incrWithExpiry:', error);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Atomically increment by a positive amount and set expiry if the key is new.
   */
  async incrByWithExpiry(key: string, amount: number, expireSeconds: number): Promise<number> {
    const normalizedAmount = Math.max(1, Math.floor(amount));
    if (this.client) {
      try {
        const luaScript = `
          local amount = tonumber(ARGV[1])
          local current = redis.call('INCRBY', KEYS[1], amount)
          if current == amount then
            redis.call('EXPIRE', KEYS[1], ARGV[2])
          end
          return current
        `;
        const result = await this.client.eval(
          luaScript,
          1,
          key,
          String(normalizedAmount),
          String(expireSeconds)
        );
        return Number(result);
      } catch (error) {
        console.error('[Redis] Failed to incrByWithExpiry:', error);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Atomically decrement but never go below 0.
   * Uses a Lua script to ensure atomicity.
   */
  async decrClamped(key: string): Promise<number> {
    if (this.client) {
      try {
        const luaScript = `local current = tonumber(redis.call('GET', KEYS[1]) or '0'); if current > 0 then return redis.call('DECR', KEYS[1]); else return 0; end;`;
        const result = await this.client.eval(luaScript, 1, key);
        return Number(result);
      } catch (error) {
        console.error('[Redis] Failed to decrClamped:', error);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Atomically decrement by a positive amount but never go below 0.
   */
  async decrByClamped(key: string, amount: number): Promise<number> {
    const normalizedAmount = Math.max(1, Math.floor(amount));
    if (this.client) {
      try {
        const luaScript = `
          local current = tonumber(redis.call('GET', KEYS[1]) or '0')
          local amount = tonumber(ARGV[1])
          if current <= 0 then
            return 0
          end
          local nextValue = current - amount
          if nextValue <= 0 then
            local ttl = redis.call('TTL', KEYS[1])
            redis.call('SET', KEYS[1], '0')
            if ttl > 0 then
              redis.call('EXPIRE', KEYS[1], ttl)
            end
            return 0
          end
          redis.call('DECRBY', KEYS[1], amount)
          return nextValue
        `;
        const result = await this.client.eval(luaScript, 1, key, String(normalizedAmount));
        return Number(result);
      } catch (error) {
        console.error('[Redis] Failed to decrByClamped:', error);
        return 0;
      }
    }
    return 0;
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (error) {
        console.error('[Redis] Failed to get:', error);
        return null;
      }
    }
    return null;
  }

  async set(key: string, value: string, expireSeconds?: number): Promise<string> {
    if (this.client) {
      try {
        if (expireSeconds) {
          return await this.client.setex(key, expireSeconds, value);
        }
        return await this.client.set(key, value);
      } catch (error) {
        console.error('[Redis] Failed to set:', error);
        return '';
      }
    }
    return '';
  }

  async del(key: string): Promise<number> {
    if (this.client) {
      try {
        return await this.client.del(key);
      } catch (error) {
        console.error('[Redis] Failed to delete:', error);
        return 0;
      }
    }
    return 0;
  }

  async deleteKeys(keys: string[]): Promise<number> {
    if (!this.client || keys.length === 0) {
      return 0;
    }

    try {
      return await this.client.del(...keys);
    } catch (error) {
      console.error('[Redis] Failed to delete keys:', error);
      return 0;
    }
  }
}

export const redisService = new RedisService();
export default redisService;
