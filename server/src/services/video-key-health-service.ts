import { redisService } from './redis-service';

export interface VideoKeyHealth {
  failureStreak: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  circuitState: 'closed' | 'open' | 'half-open';
  cooldownUntil: string | null;
  lastUpdateTime: string;
}

const HEALTH_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const BASE_FAILURE_COOLDOWN_MS = 60 * 1000; // 1 minute base cooldown
const MAX_FAILURE_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes max
const EMA_ALPHA = 0.3; // Weight for recent latency
const DECAY_FACTOR = 0.95; // Time-based decay for success/failure counts

class VideoKeyHealthService {
  private key(keyId: string, modelScope?: string): string {
    const normalizedScope = String(modelScope || '').trim().toLowerCase();
    return normalizedScope
      ? `video:key-health:v3:${keyId}:${normalizedScope}`
      : `video:key-health:v2:${keyId}`;
  }

  private applyTimeDecay(health: VideoKeyHealth): VideoKeyHealth {
    const now = Date.now();
    const lastUpdate = new Date(health.lastUpdateTime).getTime();
    const minutesPassed = Math.floor((now - lastUpdate) / 60000);

    if (minutesPassed > 0) {
      // Decay stats over time so old history doesn't permanently drag down a key
      const decay = Math.pow(DECAY_FACTOR, minutesPassed);
      return {
        ...health,
        successCount: health.successCount * decay,
        failureCount: health.failureCount * decay,
        lastUpdateTime: new Date().toISOString(),
      };
    }
    return { ...health, lastUpdateTime: new Date().toISOString() };
  }

  async get(keyId: string, modelScope?: string): Promise<VideoKeyHealth> {
    const data = await redisService.getJson<VideoKeyHealth>(this.key(keyId, modelScope));
    if (!data) {
      return {
        failureStreak: 0,
        successCount: 0,
        failureCount: 0,
        avgLatencyMs: 0,
        circuitState: 'closed',
        cooldownUntil: null,
        lastUpdateTime: new Date().toISOString(),
      };
    }
    return this.applyTimeDecay(data);
  }

  async recordSuccess(keyId: string, latencyMs: number, modelScope?: string): Promise<void> {
    const current = await this.get(keyId, modelScope);
    
    // Use Exponential Moving Average for latency to react faster to network conditions
    const newLatency = current.avgLatencyMs === 0 
      ? latencyMs 
      : Math.round(current.avgLatencyMs * (1 - EMA_ALPHA) + latencyMs * EMA_ALPHA);

    const next: VideoKeyHealth = {
      ...current,
      failureStreak: 0,
      successCount: current.successCount + 1,
      avgLatencyMs: newLatency,
      circuitState: 'closed',
      cooldownUntil: null,
    };

    await redisService.setJson(this.key(keyId, modelScope), next, HEALTH_TTL_SECONDS);
  }

  async recordFailure(keyId: string, latencyMs: number, modelScope?: string): Promise<void> {
    const current = await this.get(keyId, modelScope);
    const failureStreak = current.failureStreak + 1;
    
    // Dynamic streak threshold based on recent success rate (min 2, max 5)
    const totalRequests = current.successCount + current.failureCount;
    const successRate = totalRequests > 0 ? current.successCount / totalRequests : 1;
    const dynamicThreshold = Math.max(2, Math.min(5, Math.floor(successRate * 5)));

    const shouldOpen = failureStreak >= dynamicThreshold || current.circuitState === 'half-open';
    
    // Exponential backoff for cooldown
    const cooldownMs = Math.min(
      BASE_FAILURE_COOLDOWN_MS * Math.pow(1.5, failureStreak - 1),
      MAX_FAILURE_COOLDOWN_MS
    );

    const newLatency = current.avgLatencyMs === 0 
      ? latencyMs 
      : Math.round(current.avgLatencyMs * (1 - EMA_ALPHA) + latencyMs * EMA_ALPHA);

    const next: VideoKeyHealth = {
      ...current,
      failureCount: current.failureCount + 1,
      failureStreak,
      avgLatencyMs: newLatency,
      circuitState: shouldOpen ? 'open' : current.circuitState,
      cooldownUntil: shouldOpen
        ? new Date(Date.now() + cooldownMs).toISOString()
        : current.cooldownUntil,
    };

    await redisService.setJson(this.key(keyId, modelScope), next, HEALTH_TTL_SECONDS);
  }

  async isOpen(keyId: string, modelScope?: string): Promise<boolean> {
    const current = await this.get(keyId, modelScope);

    if (current.circuitState !== 'open') {
      return false;
    }

    if (!current.cooldownUntil) {
      return true;
    }

    // Check if cooldown has expired
    if (new Date(current.cooldownUntil).getTime() > Date.now()) {
      return true;
    }

    // Cooldown expired, transition to half-open
    // In half-open, we allow one request to pass through to test the waters
    await redisService.setJson(
      this.key(keyId, modelScope),
      { ...current, circuitState: 'half-open', cooldownUntil: null },
      HEALTH_TTL_SECONDS
    );
    return false;
  }
}

export const videoKeyHealthService = new VideoKeyHealthService();
