import { redisService } from '../redis-service';

const STATS_PREFIX = 'prompt:stats:';

export interface ProviderStats {
  totalCalls: number;
  successCalls: number;
  failCalls: number;
  avgLatencyMs: number;
}

export async function recordProviderCall(
  provider: string,
  success: boolean,
  latencyMs: number,
): Promise<void> {
  const key = STATS_PREFIX + provider;
  try {
    const raw = await redisService.getCache(key);
    const stats: ProviderStats = raw ? JSON.parse(raw) : {
      totalCalls: 0, successCalls: 0, failCalls: 0, avgLatencyMs: 0,
    };
    stats.totalCalls++;
    if (success) stats.successCalls++;
    else stats.failCalls++;
    stats.avgLatencyMs = Math.round(
      (stats.avgLatencyMs * (stats.totalCalls - 1) + latencyMs) / stats.totalCalls,
    );
    await redisService.setCache(key, JSON.stringify(stats), 86400);
  } catch {
    // Metrics persistence is best effort.
  }
}

export async function getProviderStats(provider: string): Promise<ProviderStats | null> {
  try {
    const raw = await redisService.getCache(STATS_PREFIX + provider);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getAllStats(): Promise<Record<string, ProviderStats>> {
  try {
    const keys = await redisService.getKeysByPattern(STATS_PREFIX + '*');
    const result: Record<string, ProviderStats> = {};
    for (const key of keys) {
      const raw = await redisService.getCache(key);
      if (raw) {
        const provider = key.replace(STATS_PREFIX, '');
        result[provider] = JSON.parse(raw);
      }
    }
    return result;
  } catch {
    return {};
  }
}
