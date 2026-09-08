import { ProviderKeyManager } from './provider-key-manager';
import { redisService } from './redis-service';
import { videoKeyHealthService } from './video-key-health-service';

export interface AcquireVideoKeyInput {
  provider: string;
  model: string;
  localTaskId: string;
}

export interface VideoKeyLease {
  keyId: string;
  apiKey: string;
  leaseToken: string;
  provider: string;
  model: string;
}

export interface CreateVideoLeaseInput {
  keyId: string;
  provider: string;
  model: string;
  localTaskId: string;
}

const LEASE_TTL_SECONDS = 2 * 60 * 60;

class VideoModelKeyScheduler {
  private loadKey(keyId: string): string {
    return `video:key-load:${keyId}`;
  }

  private leaseKey(keyId: string, leaseToken: string): string {
    return `video:key-lease:${keyId}:${leaseToken}`;
  }

  async acquire(input: AcquireVideoKeyInput): Promise<VideoKeyLease> {
    const candidates = (await ProviderKeyManager.getActiveKeysForModel(input.provider, input.model))
      .filter((candidate) => candidate.apiKey?.trim());

    if (candidates.length === 0) {
      throw new Error('MODEL_POOL_BUSY');
    }

    const scored = await Promise.all(
      candidates.map(async (candidate) => {
        const load = Number((await redisService.get(this.loadKey(candidate.id))) ?? '0');
        const modelScope = `${input.provider}:${input.model}`;
        const health = await videoKeyHealthService.get(candidate.id, modelScope);
        const circuitOpen = await videoKeyHealthService.isOpen(candidate.id, modelScope);
        const isHalfOpen = health.circuitState === 'half-open';

        const totalRequests = health.successCount + health.failureCount;
        const successRate = totalRequests > 0 ? health.successCount / totalRequests : 1;
        
        // 企业级打分算法 (Enterprise Scoring)
        // 1. 基础权重 (Base Weight)
        // 2. 成功率惩罚 (Success Rate Penalty)
        // 3. 延迟惩罚 (Latency Penalty - 假设基准为 2000ms)
        // 4. 负载比例惩罚 (Load Ratio Penalty)
        const loadRatio = candidate.maxConcurrency > 0 ? load / candidate.maxConcurrency : 1;
        const latencyPenalty = Math.min(50, Math.round(health.avgLatencyMs / 500)); // 每500ms扣1分，最多扣50分
        
        const score = 
          (candidate.weight * 100) + 
          (successRate * 100) - 
          (loadRatio * 150) - // 负载率高的惩罚极大，促使流量分摊 (Least Active)
          latencyPenalty - 
          (health.failureStreak * 30);

        return {
          ...candidate,
          load,
          circuitOpen,
          isHalfOpen,
          score,
          loadRatio,
        };
      })
    );

    // 过滤可用候选者
    const available = scored
      .filter((item) => {
        if (item.circuitOpen) return false;
        // 半开状态下的熔断器，只允许放入 1 个探测请求 (Test the waters)
        if (item.isHalfOpen && item.load >= 1) return false;
        return item.load < item.maxConcurrency;
      })
      .sort((a, b) => {
        // 负载优先，避免高并发时只吃满第一个 key；优先级作为同负载下的稳定兜底。
        if (a.loadRatio !== b.loadRatio) return a.loadRatio - b.loadRatio;
        if (a.load !== b.load) return a.load - b.load;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.score - a.score;
      });

    const selected = available[0];
    if (!selected) {
      throw new Error('MODEL_POOL_BUSY');
    }

    const leaseToken = `${selected.id}:${input.localTaskId}:${Date.now()}`;
    // Use atomic INCR to prevent concurrent acquire race conditions
    const newLoad = await redisService.incrWithExpiry(this.loadKey(selected.id), LEASE_TTL_SECONDS);
    // Verify we didn't exceed maxConcurrency (race between scoring and increment)
    if (newLoad > selected.maxConcurrency) {
      // Over limit, undo and try next candidate or fail
      await redisService.decrClamped(this.loadKey(selected.id));
      throw new Error('MODEL_POOL_BUSY');
    }
    await redisService.setJson(
      this.leaseKey(selected.id, leaseToken),
      {
        localTaskId: input.localTaskId,
        provider: input.provider,
        model: input.model,
        keyId: selected.id,
        leaseToken,
      },
      LEASE_TTL_SECONDS
    );

    return {
      keyId: selected.id,
      apiKey: selected.apiKey,
      leaseToken,
      provider: input.provider,
      model: input.model,
    };
  }

  async createLease(input: CreateVideoLeaseInput): Promise<VideoKeyLease> {
    const key = await ProviderKeyManager.getKeyById(input.keyId);
    if (!key) {
      throw new Error(`KEY_NOT_FOUND:${input.keyId}`);
    }

    const leaseToken = `${input.keyId}:${input.localTaskId}:${Date.now()}`;

    const newLoad = await redisService.incrWithExpiry(this.loadKey(input.keyId), LEASE_TTL_SECONDS);
    if (newLoad > key.maxConcurrency) {
      await redisService.decrClamped(this.loadKey(input.keyId));
      throw new Error(`KEY_BUSY:${input.keyId}`);
    }

    await redisService.setJson(
      this.leaseKey(input.keyId, leaseToken),
      {
        localTaskId: input.localTaskId,
        provider: input.provider,
        model: input.model,
        keyId: input.keyId,
        leaseToken,
      },
      LEASE_TTL_SECONDS
    );

    return {
      keyId: input.keyId,
      apiKey: key.key,
      leaseToken,
      provider: input.provider,
      model: input.model,
    };
  }

  async release(keyId: string, leaseToken?: string): Promise<void> {
    // Use atomic DECR (clamped to 0) to prevent lost updates on concurrent release
    await redisService.decrClamped(this.loadKey(keyId));

    if (leaseToken) {
      await redisService.del(this.leaseKey(keyId, leaseToken));
    }
  }
}

export const videoModelKeyScheduler = new VideoModelKeyScheduler();
