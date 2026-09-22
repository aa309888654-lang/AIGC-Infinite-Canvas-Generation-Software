import prisma from '../lib/prisma';
import { decryptFromStorage } from '../utils/encryption';
import { logger } from '../utils/logger';

export interface KeyStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgResponseTime: number;
  lastUsedAt: Date | null;
  lastFailureAt: Date | null;
  failureReason: string | null;
}

export interface ProviderKeyWithStats {
  id: string;
  providerName: string;
  keyLabel: string;
  apiKey: string;
  priority: number;
  isActive: boolean;
  isExhausted: boolean;
  stats: KeyStats;
}

/**
 * 密钥耗尽后的冷却时间（毫秒）。超过此时间的耗尽密钥会被自动探测恢复。
 * 5 分钟：与 Agnes 等服务商的小时级槽位释放延迟对齐。
 */
const EXHAUSTED_COOLDOWN_MS = 5 * 60 * 1000;

/** 自动探测恢复的轮询间隔（毫秒） */
const AUTO_RECOVERY_INTERVAL_MS = 5 * 60 * 1000;

export class SmartKeyManager {
  private keyCache = new Map<string, ProviderKeyWithStats>();
  private statsCache = new Map<string, KeyStats>();
  private lastRefreshTime = 0;
  private readonly REFRESH_INTERVAL = 60000;
  private autoRecoveryTimer: NodeJS.Timeout | null = null;

  async getActiveKeys(providerName: string): Promise<ProviderKeyWithStats[]> {
    await this.refreshCache(providerName);

    const keys = Array.from(this.keyCache.values())
      .filter(k => k.providerName === providerName && k.isActive && !k.isExhausted)
      .sort((a, b) => a.priority - b.priority);

    return keys;
  }

  async getBestKey(providerName: string): Promise<ProviderKeyWithStats | null> {
    const keys = await this.getActiveKeys(providerName);

    if (keys.length === 0) {
      return null;
    }

    const now = Date.now();
    const bestKey = keys.reduce((best, current) => {
      if (!best) return current;

      const bestScore = this.calculateKeyScore(best, now);
      const currentScore = this.calculateKeyScore(current, now);

      return currentScore > bestScore ? current : best;
    }, null as ProviderKeyWithStats | null);

    return bestKey;
  }

  private calculateKeyScore(key: ProviderKeyWithStats, now: number): number {
    let score = 0;

    score += key.priority * 10;

    if (key.stats.successRate > 0) {
      score += key.stats.successRate * 100;
    } else {
      score += 50;
    }

    if (key.stats.avgResponseTime > 0 && key.stats.avgResponseTime < 30000) {
      score += Math.max(0, (30000 - key.stats.avgResponseTime) / 300);
    } else {
      score += 50;
    }

    if (key.stats.lastUsedAt) {
      const idleMinutes = (now - key.stats.lastUsedAt.getTime()) / 60000;
      score += Math.max(0, 10 - idleMinutes);
    } else {
      score += 10;
    }

    if (key.stats.failureCount > 0 && key.stats.lastFailureAt) {
      const minutesSinceFailure = (now - key.stats.lastFailureAt.getTime()) / 60000;
      if (minutesSinceFailure < 5) {
        score -= (5 - minutesSinceFailure) * 10;
      }
    }

    return score;
  }

  async recordKeyUsage(keyId: string, success: boolean, responseTime: number, error?: string) {
    const stats = this.statsCache.get(keyId) || this.createEmptyStats();

    stats.totalRequests++;
    stats.lastUsedAt = new Date();

    if (success) {
      stats.successCount++;
      stats.failureReason = null;
    } else {
      stats.failureCount++;
      stats.lastFailureAt = new Date();
      stats.failureReason = error || 'Unknown error';
    }

    if (stats.totalRequests > 0) {
      stats.successRate = stats.successCount / stats.totalRequests;
    }

    if (responseTime > 0) {
      const count = stats.totalRequests;
      stats.avgResponseTime = ((stats.avgResponseTime * (count - 1)) + responseTime) / count;
    }

    this.statsCache.set(keyId, stats);

    if (stats.failureCount >= 5 && stats.successRate < 0.5) {
      await this.markKeyExhausted(keyId);
    }
  }

  async markKeyExhausted(keyId: string) {
    await prisma.providerApiKey.update({
      where: { id: keyId },
      data: { isExhausted: true, lastFailureAt: new Date() }
    });

    const cached = this.keyCache.get(keyId);
    if (cached) {
      cached.isExhausted = true;
    }
  }

  async resetExhaustedKeys(providerName: string) {
    await prisma.providerApiKey.updateMany({
      where: { providerName, isExhausted: true },
      data: { isExhausted: false, failureCount: 0, lastFailureAt: null }
    });
    await this.refreshCache(providerName);
  }

  /**
   * 启动密钥自动恢复定时器。
   * 每隔 AUTO_RECOVERY_INTERVAL_MS（默认 5 分钟）扫描所有 isExhausted=true 的密钥，
   * 若距 lastFailureAt 已超过冷却时间，则重置为可用，让调度器重新尝试。
   *
   * 此为"熔断半开"模式：恢复后若再次失败，会被 recordKeyUsage 重新标记为耗尽。
   */
  startAutoRecovery(intervalMs: number = AUTO_RECOVERY_INTERVAL_MS): void {
    if (this.autoRecoveryTimer) return;
    this.autoRecoveryTimer = setInterval(() => {
      this.runAutoRecovery().catch((err) => {
        logger.warn('[] auto-recovery tick failed:', err);
      });
    }, intervalMs);
    logger.info(`[] auto-recovery started (interval=${intervalMs}ms, cooldown=${EXHAUSTED_COOLDOWN_MS}ms)`);
  }

  stopAutoRecovery(): void {
    if (this.autoRecoveryTimer) {
      clearInterval(this.autoRecoveryTimer);
      this.autoRecoveryTimer = null;
      logger.info('[] auto-recovery stopped');
    }
  }

  private async runAutoRecovery(): Promise<void> {
    const now = Date.now();
    const candidates = Array.from(this.keyCache.values()).filter((k) => k.isExhausted);
    if (candidates.length === 0) return;

    for (const key of candidates) {
      const lastFailure = key.stats.lastFailureAt?.getTime() ?? 0;
      const elapsed = now - lastFailure;
      if (elapsed < EXHAUSTED_COOLDOWN_MS) continue;

      try {
        await prisma.providerApiKey.update({
          where: { id: key.id },
          data: { isExhausted: false, failureCount: 0, lastFailureAt: null },
        });
        key.isExhausted = false;
        key.stats.failureCount = 0;
        key.stats.lastFailureAt = null;
        key.stats.failureReason = null;
        logger.info(`[] key ${key.keyLabel} (${key.id}) auto-recovered after ${Math.round(elapsed / 1000)}s cooldown`);
      } catch (err) {
        logger.warn(`[] failed to auto-recover key ${key.id}:`, err);
      }
    }
  }

  private async refreshCache(_providerName?: string) {
    const now = Date.now();
    if (now - this.lastRefreshTime < this.REFRESH_INTERVAL) {
      return;
    }

    const keys = await prisma.providerApiKey.findMany({ where: { isActive: true } });

    for (const dbKey of keys) {
      let apiKey = '';
      try {
        apiKey = dbKey.encryptedKey ? decryptFromStorage(dbKey.encryptedKey) : '';
      } catch {
        continue;
      }
      const existingStats = this.statsCache.get(dbKey.id) || this.createEmptyStats();

      this.keyCache.set(dbKey.id, {
        id: dbKey.id,
        providerName: dbKey.providerName,
        keyLabel: dbKey.keyLabel || `Key ${dbKey.priority}`,
        apiKey,
        priority: dbKey.priority,
        isActive: dbKey.isActive,
        isExhausted: dbKey.isExhausted,
        stats: existingStats
      });
    }

    this.lastRefreshTime = now;
  }

  private createEmptyStats(): KeyStats {
    return {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgResponseTime: 0,
      lastUsedAt: null,
      lastFailureAt: null,
      failureReason: null
    };
  }

  getKeyStats(keyId: string): KeyStats | undefined {
    return this.statsCache.get(keyId);
  }

  getAllStats(providerName?: string): Record<string, KeyStats> {
    const result: Record<string, KeyStats> = {};

    this.keyCache.forEach((key, id) => {
      if (!providerName || key.providerName === providerName) {
        result[key.keyLabel] = this.statsCache.get(id) || this.createEmptyStats();
      }
    });

    return result;
  }
}

export const smartKeyManager = new SmartKeyManager();
