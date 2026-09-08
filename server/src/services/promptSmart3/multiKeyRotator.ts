import { redisService } from '../redis-service';

export interface KeyEntry {
  key: string;
  label: string;
  isActive: boolean;
  failureCount: number;
  lastFailureTime: number;
  totalCalls: number;
  lastCallTime: number;
}

interface RotatorConfig {
  maxFailures: number;
  cooldownMs: number;
  maxConcurrent: number;
}

const DEFAULT_CONFIG: RotatorConfig = {
  maxFailures: 5,
  cooldownMs: 60000,
  maxConcurrent: 3,
};

const LOAD_KEY_TTL_SECONDS = 300;
const LOAD_KEY_PREFIX = 'rotator:key-load:';

function loadKeyFor(key: string): string {
  return `${LOAD_KEY_PREFIX}${key}`;
}

export class MultiKeyRotator {
  private keys: KeyEntry[] = [];
  private currentIndex = 0;
  private config: RotatorConfig;
  private activeCalls = 0;

  constructor(keys: string[], config?: Partial<RotatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.keys = keys.map((key, idx) => ({
      key,
      label: `key-${idx + 1}`,
      isActive: true,
      failureCount: 0,
      lastFailureTime: 0,
      totalCalls: 0,
      lastCallTime: 0,
    }));
  }

  static fromEnv(prefix: string): MultiKeyRotator | null {
    const keys: string[] = [];
    let idx = 1;
    for (;;) {
      const key = process.env[`${prefix}_${idx}`];
      if (!key) break;
      keys.push(key);
      idx++;
    }
    const singleKey = process.env[prefix];
    if (singleKey && !keys.includes(singleKey)) {
      keys.unshift(singleKey);
    }
    return keys.length > 0 ? new MultiKeyRotator(keys) : null;
  }

  /**
   * 同步 round-robin 选 key（向后兼容）。
   * 新代码应优先使用 getNextKeyLeastActive()。
   */
  getNextKey(): string | null {
    const available = this.getAvailableKeys();
    if (available.length === 0) return null;

    if (this.activeCalls >= this.config.maxConcurrent * available.length) {
      return null;
    }

    const startIdx = this.currentIndex % available.length;
    for (let i = 0; i < available.length; i++) {
      const entry = available[(startIdx + i) % available.length];
      if (entry.isActive && this.isKeyReady(entry)) {
        this.currentIndex = (startIdx + i + 1) % available.length;
        entry.totalCalls++;
        entry.lastCallTime = Date.now();
        this.activeCalls++;
        return entry.key;
      }
    }

    return null;
  }

  /**
   * ✅ P1-7：Least-Active 选 key，基于 Redis 原子计数。
   * 从所有可用 key 中选择当前负载最低的，原子 INCR 后返回。
   * Redis 不可用时降级为同步 round-robin。
   */
  async getNextKeyLeastActive(): Promise<string | null> {
    const available = this.getAvailableKeys();
    if (available.length === 0) return null;

    if (!redisService.isAvailable()) {
      // 降级：使用同步 round-robin
      return this.getNextKey();
    }

    try {
      // 读取所有 key 的当前负载
      const loadEntries = await Promise.all(
        available
          .filter((entry) => this.isKeyReady(entry))
          .map(async (entry) => {
            const loadStr = await redisService.get(loadKeyFor(entry.key));
            const load = loadStr ? parseInt(loadStr, 10) || 0 : 0;
            return { entry, load };
          }),
      );

      if (loadEntries.length === 0) return null;

      // 检查是否所有 key 都达到并发上限
      const allBusy = loadEntries.every((item) => item.load >= this.config.maxConcurrent);
      if (allBusy) return null;

      // ✅ 按 load 升序排序，选最空闲的
      loadEntries.sort((a, b) => a.load - b.load);
      const selected = loadEntries[0].entry;

      // ✅ 原子 INCR
      const newLoad = await redisService.incrWithExpiry(
        loadKeyFor(selected.key),
        LOAD_KEY_TTL_SECONDS,
      );

      // 双重检查：INCR 后若超过 maxConcurrency，回退并返回 null
      if (newLoad > this.config.maxConcurrent) {
        await redisService.decrClamped(loadKeyFor(selected.key));
        return null;
      }

      selected.totalCalls++;
      selected.lastCallTime = Date.now();
      this.currentIndex = (this.keys.indexOf(selected) + 1) % this.keys.length;
      this.activeCalls++;
      return selected.key;
    } catch (err) {
      console.error('[MultiKeyRotator] Least-Active selection failed, falling back to round-robin:', err);
      return this.getNextKey();
    }
  }

  /**
   * ✅ P1-7：释放 key 的负载计数（Redis DECR）。
   * 与 getNextKeyLeastActive() 配对使用。
   */
  async releaseKey(key: string): Promise<void> {
    if (redisService.isAvailable()) {
      try {
        await redisService.decrClamped(loadKeyFor(key));
      } catch (err) {
        console.error('[MultiKeyRotator] releaseKey decr failed:', err);
      }
    }
    this.activeCalls = Math.max(0, this.activeCalls - 1);
  }

  reportSuccess(key: string): void {
    const entry = this.keys.find(k => k.key === key);
    if (entry) {
      entry.failureCount = Math.max(0, entry.failureCount - 1);
    }
    this.activeCalls = Math.max(0, this.activeCalls - 1);
  }

  reportFailure(key: string): void {
    const entry = this.keys.find(k => k.key === key);
    if (entry) {
      entry.failureCount++;
      entry.lastFailureTime = Date.now();
      if (entry.failureCount >= this.config.maxFailures) {
        entry.isActive = false;
        console.warn(`[MultiKeyRotator] Key "${entry.label}" disabled after ${entry.failureCount} failures`);
      }
    }
    this.activeCalls = Math.max(0, this.activeCalls - 1);
  }

  getAvailableKeyCount(): number {
    return this.getAvailableKeys().length;
  }

  getTotalKeyCount(): number {
    return this.keys.length;
  }

  getStatus(): Array<{ label: string; isActive: boolean; failureCount: number; totalCalls: number }> {
    return this.keys.map(k => ({
      label: k.label,
      isActive: k.isActive,
      failureCount: k.failureCount,
      totalCalls: k.totalCalls,
    }));
  }

  private getAvailableKeys(): KeyEntry[] {
    const now = Date.now();
    return this.keys.filter(k => {
      if (!k.isActive && k.failureCount >= this.config.maxFailures) {
        if (now - k.lastFailureTime > this.config.cooldownMs) {
          k.isActive = true;
          k.failureCount = Math.floor(k.failureCount / 2);
          console.log(`[MultiKeyRotator] Key "${k.label}" re-enabled after cooldown`);
        }
      }
      return k.isActive;
    });
  }

  private isKeyReady(entry: KeyEntry): boolean {
    if (!entry.isActive) return false;
    if (entry.failureCount > 0 && entry.lastFailureTime > 0) {
      const backoff = Math.min(entry.failureCount * 2000, 30000);
      return Date.now() - entry.lastFailureTime > backoff;
    }
    return true;
  }
}

const rotatorRegistry = new Map<string, MultiKeyRotator>();

export function getRotator(providerName: string): MultiKeyRotator | null {
  return rotatorRegistry.get(providerName) ?? null;
}

export function registerRotator(providerName: string, rotator: MultiKeyRotator): void {
  rotatorRegistry.set(providerName, rotator);
  console.log(`[MultiKeyRotator] Registered ${rotator.getTotalKeyCount()} keys for "${providerName}" (${rotator.getAvailableKeyCount()} available)`);
}

export function initRotatorsFromEnv(): void {
  const providerEnvMap: Record<string, string> = {
    doubao: 'DOUBAO_VIDEO_KEY',
    minimax: 'MINIMAX_API_KEY',
    vidu: 'VIDU_API_KEY',
  };

  for (const [provider, envPrefix] of Object.entries(providerEnvMap)) {
    const rotator = MultiKeyRotator.fromEnv(envPrefix);
    if (rotator) {
      registerRotator(provider, rotator);
    }
  }

  // SenseNova: 支持多密钥轮换 (SENSENOVA_API_KEY + SENSENOVA_API_KEY_2)
  // 秘钥1额度耗尽自动切换秘钥2
  const sensenovaKeys: string[] = [];
  if (process.env.SENSENOVA_API_KEY) sensenovaKeys.push(process.env.SENSENOVA_API_KEY);
  if (process.env.SENSENOVA_API_KEY_2) sensenovaKeys.push(process.env.SENSENOVA_API_KEY_2);
  if (sensenovaKeys.length > 0) {
    registerRotator('sensenova', new MultiKeyRotator(sensenovaKeys));
    registerRotator('deepseek-v4-flash', new MultiKeyRotator(sensenovaKeys));
  }

  const stepfunKeys: string[] = [];
  if (process.env.STEPFUN_API_KEY) stepfunKeys.push(process.env.STEPFUN_API_KEY);
  if (process.env.STEPFUN_API_KEY_2) stepfunKeys.push(process.env.STEPFUN_API_KEY_2);
  if (process.env.STEPFUN_API_KEY_3) stepfunKeys.push(process.env.STEPFUN_API_KEY_3);
  if (stepfunKeys.length > 0) {
    registerRotator('stepfun', new MultiKeyRotator(stepfunKeys));
  }
}
