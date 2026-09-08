import { ProviderConfig } from './providerTypes';
import { CircuitBreaker } from './circuitBreaker';
import { logger } from '../../utils/logger';
import { isLocalOnlyMode } from '../../utils/local-mode';

interface ProviderEntry {
  config: ProviderConfig;
  currentWeight: number;
  circuitBreaker: CircuitBreaker;
}

const entries: Map<string, ProviderEntry> = new Map();
// 优先速度快、质量好的模型；慢速 Pro 模型后置
// 已废弃 (2026-07-18): glm-5.1 / glm-4-plus / nvidia-qwen3.5 / nvidia-deepseek-v4-pro 已下线，从优先级列表移除
// 国内合规：仅保留国产模型（DeepSeek/通义/Kimi/Yi/Step/SenseNova/MiniMax/GLM/火山等）
const PREFERRED_PROVIDER_ORDER = [
  'deepseek-v4-flash',
  'iamhc-deepseek-v4-flash',
  'iamhc-kimi-k2.6',
  'iamhc-qwen3.6-35b',
  'qwen3-plus',
  'moonshot-k2.5',
  'step-3.7-flash',
  'volcano',
  'sensenova-6.7-flash-lite',
  'sensenova',
  'iamhc-minimax-m3',
  'iamhc-glm-4.7',
  'iamhc-minimax-m2.7',
  'minimax',
  'longcat-flash-lite',
  'longcat-flash-thinking',
  'deepseek-v4-pro',
];

export async function initProviders(
  configs: ProviderConfig[],
  resolveApiKey: (providerName: string, envKey?: string) => Promise<string | undefined>,
): Promise<void> {
  entries.clear();
  for (const cfg of configs) {
    let apiKey = cfg.apiKey;
    if (!apiKey) {
      try {
        apiKey = await resolveApiKey(cfg.name, cfg.apiKeyEnv);
      } catch (err) {
        console.warn(`[PromptSmart3] Failed to resolve API key for "${cfg.name}":`, err);
      }
    }
    if (!apiKey) {
      const message = `[PromptSmart3] Provider "${cfg.name}" skipped: no API key`;
      if (isLocalOnlyMode()) {
        logger.debug(message);
      } else {
        console.warn(message);
      }
      continue;
    }
    cfg.apiKey = apiKey;
    entries.set(cfg.name, {
      config: cfg,
      currentWeight: cfg.weight,
      circuitBreaker: new CircuitBreaker(),
    });
    logger.info(`[PromptSmart3] Provider "${cfg.name}" loaded (model: ${cfg.model})`);
  }
}

export function selectProvider(tried: Set<string> = new Set()): ProviderEntry | null {
  const available: Array<[string, ProviderEntry]> = [];
  for (const [name, entry] of entries) {
    if (!tried.has(name) && !entry.circuitBreaker.isOpen && entry.config.weight > 0) {
      available.push([name, entry]);
    }
  }
  if (available.length === 0) return null;

  for (const providerName of PREFERRED_PROVIDER_ORDER) {
    const preferred = available.find(([name]) => name === providerName);
    if (preferred) {
      return preferred[1];
    }
  }

  let best: [string, ProviderEntry] = available[0];
  for (const entry of available) {
    if (entry[1].currentWeight > best[1].currentWeight) {
      best = entry;
    }
  }

  best[1].currentWeight -= available.reduce((sum, e) => sum + e[1].config.weight, 0);
  for (const entry of available) {
    entry[1].currentWeight += entry[1].config.weight;
  }

  return best[1];
}

export function selectProviderByName(name: string): ProviderEntry | null {
  return entries.get(name) || null;
}

export function getAllProviderNames(): string[] {
  return Array.from(entries.keys());
}

export function reportSuccess(name: string): void {
  const entry = entries.get(name);
  if (entry) {
    entry.circuitBreaker.recordSuccess();
    entry.currentWeight = Math.min(entry.currentWeight + 0.5, entry.config.weight * 2);
  }
}

export function reportFailure(name: string): void {
  const entry = entries.get(name);
  if (entry) {
    entry.circuitBreaker.recordFailure();
    entry.currentWeight = Math.max(entry.currentWeight * 0.5, 0.1);
  }
}

export function getProviderCount(): number {
  return entries.size;
}

export function getAllProviderStatus(): Array<{
  name: string;
  weight: number;
  circuitState: string;
}> {
  const result: Array<{ name: string; weight: number; circuitState: string }> = [];
  for (const [name, entry] of entries) {
    result.push({
      name,
      weight: entry.currentWeight,
      circuitState: entry.circuitBreaker.isOpen ? 'OPEN' : entry.circuitBreaker.stateInfo.state,
    });
  }
  return result;
}
