export interface FallbackEntry {
  provider: string;
  priority: number;
  isActive: boolean;
  circuitOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  avgLatencyMs: number;
  totalCalls: number;
  successCalls: number;
}

interface FallbackConfig {
  maxFailures: number;
  halfOpenAfterMs: number;
  latencyThresholdMs: number;
}

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  maxFailures: 3,
  halfOpenAfterMs: 60000,
  latencyThresholdMs: 30000,
};

const DEFAULT_VIDEO_CHAIN: FallbackEntry[] = [
  { provider: 'doubao', priority: 1, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
  { provider: 'vidu', priority: 2, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
  { provider: 'wuyinkeji', priority: 3, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
];

const DEFAULT_IMAGE_CHAIN: FallbackEntry[] = [
  { provider: 'doubao', priority: 1, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
  { provider: 'minimax', priority: 2, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
  { provider: 'wuyinkeji', priority: 3, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
];

const DEFAULT_TTS_CHAIN: FallbackEntry[] = [
  { provider: 'minimax', priority: 1, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
  { provider: 'doubao', priority: 2, isActive: true, circuitOpen: false, failureCount: 0, lastFailureTime: 0, avgLatencyMs: 0, totalCalls: 0, successCalls: 0 },
];

export type TaskType = 'video' | 'image' | 'tts' | 'llm';

export class FallbackChain {
  private chains: Map<TaskType, FallbackEntry[]> = new Map();
  private config: FallbackConfig;

  constructor(config?: Partial<FallbackConfig>) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
    this.chains.set('video', DEFAULT_VIDEO_CHAIN.map(e => ({ ...e })));
    this.chains.set('image', DEFAULT_IMAGE_CHAIN.map(e => ({ ...e })));
    this.chains.set('tts', DEFAULT_TTS_CHAIN.map(e => ({ ...e })));
    this.chains.set('llm', []);
  }

  getNextProvider(taskType: TaskType, exclude: Set<string> = new Set()): FallbackEntry | null {
    const chain = this.chains.get(taskType);
    if (!chain || chain.length === 0) return null;

    const now = Date.now();
    for (const entry of chain) {
      if (exclude.has(entry.provider)) continue;
      if (!entry.isActive) continue;

      if (entry.circuitOpen) {
        if (now - entry.lastFailureTime > this.config.halfOpenAfterMs) {
          entry.circuitOpen = false;
          console.log(`[FallbackChain] Provider "${entry.provider}" entering half-open state`);
        } else {
          continue;
        }
      }

      return entry;
    }

    return null;
  }

  reportSuccess(taskType: TaskType, provider: string, latencyMs: number): void {
    const chain = this.chains.get(taskType);
    if (!chain) return;

    const entry = chain.find(e => e.provider === provider);
    if (!entry) return;

    entry.failureCount = Math.max(0, entry.failureCount - 1);
    entry.circuitOpen = false;
    entry.totalCalls++;
    entry.successCalls++;
    entry.avgLatencyMs = entry.avgLatencyMs === 0
      ? latencyMs
      : Math.round(entry.avgLatencyMs * 0.8 + latencyMs * 0.2);
  }

  reportFailure(taskType: TaskType, provider: string): void {
    const chain = this.chains.get(taskType);
    if (!chain) return;

    const entry = chain.find(e => e.provider === provider);
    if (!entry) return;

    entry.failureCount++;
    entry.lastFailureTime = Date.now();
    entry.totalCalls++;

    if (entry.failureCount >= this.config.maxFailures) {
      entry.circuitOpen = true;
      console.warn(`[FallbackChain] Provider "${provider}" circuit opened after ${entry.failureCount} failures`);
    }
  }

  getChainStatus(taskType: TaskType): Array<{
    provider: string;
    priority: number;
    isActive: boolean;
    circuitOpen: boolean;
    failureCount: number;
    avgLatencyMs: number;
    successRate: number;
  }> {
    const chain = this.chains.get(taskType) ?? [];
    return chain.map(e => ({
      provider: e.provider,
      priority: e.priority,
      isActive: e.isActive,
      circuitOpen: e.circuitOpen,
      failureCount: e.failureCount,
      avgLatencyMs: e.avgLatencyMs,
      successRate: e.totalCalls > 0 ? Math.round((e.successCalls / e.totalCalls) * 100) : 100,
    }));
  }

  setChain(taskType: TaskType, providers: Array<{ provider: string; priority: number }>): void {
    this.chains.set(taskType, providers.map(p => ({
      provider: p.provider,
      priority: p.priority,
      isActive: true,
      circuitOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      avgLatencyMs: 0,
      totalCalls: 0,
      successCalls: 0,
    })));
  }
}

let fallbackChainInstance: FallbackChain | null = null;

export function getFallbackChain(): FallbackChain {
  if (!fallbackChainInstance) {
    fallbackChainInstance = new FallbackChain();
  }
  return fallbackChainInstance;
}
