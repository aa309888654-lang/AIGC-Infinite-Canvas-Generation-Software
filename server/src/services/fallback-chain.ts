import type { ProviderType } from './smart-router';
import { smartKeyManager } from './smart-key-manager';
import { errorClassifier, ErrorCategory } from './error-classifier';

export interface FallbackLevel {
  providers: ProviderType[];
  priority: number;
  condition?: (error: string) => boolean;
}

export interface FallbackResult {
  provider: ProviderType;
  switchedFrom?: ProviderType;
  reason: string;
}

const DEFAULT_FALLBACK_CHAIN: FallbackLevel[] = [
  {
    providers: ['vidu'],
    priority: 1,
  },
  {
    providers: ['doubao'],
    priority: 2,
  },
];

const MODEL_COMPATIBILITY: Record<string, ProviderType[]> = {
  'viduq3-turbo': ['vidu'],
  'viduq3-pro': ['vidu'],
  'viduq3-pro-fast': ['vidu'],
  'viduq3-mix': ['vidu'],
  'viduq2-pro': ['vidu'],
  'viduq2-pro-fast': ['vidu'],
  'viduq2-turbo': ['vidu'],
  'doubao-seedance-1-0-pro': ['doubao'],
  'doubao-seedance-1-5-pro': ['doubao'],
};

const EQUIVALENT_MODELS: Record<ProviderType, Record<string, string>> = {
  vidu: {
    'doubao-seedance-1-5-pro': 'viduq3-turbo',
    'doubao-seedance-1-0-pro': 'viduq2-pro',
  },
  doubao: {
    'viduq3-turbo': 'doubao-seedance-1-5-pro',
    'viduq3-pro': 'doubao-seedance-1-5-pro',
    'viduq3-pro-fast': 'doubao-seedance-1-5-pro',
    'viduq2-pro': 'doubao-seedance-1-5-pro',
    'viduq2-pro-fast': 'doubao-seedance-1-5-pro',
    'viduq2-turbo': 'doubao-seedance-1-0-pro',
  },
  minimax: {},
  wuyinkeji: {
    'viduq3-turbo': 'Wan2.7',
    'doubao-seedance-1-5-pro': 'Wan2.7',
    video_seedance: 'video_vidu',
    video_vidu: 'video_omni',
    video_omni: 'Wan2.7',
    // ✅ P0-5：XT 模型（agnes-video-v2.0）失败后 fallback 到 wuyinkeji 时
    // 必须映射为 wuyinkeji 支持的模型 ID（Wan2.7），否则 wuyinkeji 收到不支持的模型 ID 报错
    'agnes-video-v2.0': 'Wan2.7',
  },
  agnes: {
    'viduq3-turbo': 'agnes-video-v2.0',
    'doubao-seedance-1-5-pro': 'agnes-video-v2.0',
  },
};

export class FallbackChain {
  private chain: FallbackLevel[];
  private providerCooldowns = new Map<ProviderType, number>();
  private failedProviders = new Map<ProviderType, ErrorCategory>();

  constructor(chain?: FallbackLevel[]) {
    this.chain = chain || DEFAULT_FALLBACK_CHAIN;
  }

  async findNextProvider(
    currentProvider: ProviderType,
    error: string,
    model?: string
  ): Promise<FallbackResult | null> {
    const classification = errorClassifier.classify(error);

    if (!classification.shouldSwitchProvider) {
      return null;
    }

    this.failedProviders.set(currentProvider, classification.category);

    if (classification.shouldMarkExhausted) {
      this.providerCooldowns.set(currentProvider, Date.now() + classification.cooldownMinutes * 60000);
    }

    const candidates = this.getCandidateProviders(currentProvider, model);

    for (const candidate of candidates) {
      if (this.isInCooldown(candidate)) {
        continue;
      }

      const hasActiveKeys = await this.hasActiveKeys(candidate);
      if (!hasActiveKeys) {
        continue;
      }

      return {
        provider: candidate,
        switchedFrom: currentProvider,
        reason: `${classification.description}，从 ${currentProvider} 切换到 ${candidate}`,
      };
    }

    return null;
  }

  private getCandidateProviders(currentProvider: ProviderType, model?: string): ProviderType[] {
    if (model && MODEL_COMPATIBILITY[model]) {
      const compatibleProviders = MODEL_COMPATIBILITY[model].filter(p => p !== currentProvider);
      if (compatibleProviders.length > 0) {
        return compatibleProviders;
      }
    }

    const sortedLevels = [...this.chain].sort((a, b) => a.priority - b.priority);
    const candidates: ProviderType[] = [];

    for (const level of sortedLevels) {
      for (const provider of level.providers) {
        if (provider !== currentProvider && !candidates.includes(provider)) {
          candidates.push(provider);
        }
      }
    }

    return candidates;
  }

  getEquivalentModel(targetProvider: ProviderType, sourceModel: string): string | null {
    const providerModels = EQUIVALENT_MODELS[targetProvider];
    if (!providerModels) return null;
    return providerModels[sourceModel] || null;
  }

  private isInCooldown(provider: ProviderType): boolean {
    const cooldownUntil = this.providerCooldowns.get(provider);
    if (!cooldownUntil) return false;

    if (Date.now() >= cooldownUntil) {
      this.providerCooldowns.delete(provider);
      this.failedProviders.delete(provider);
      return false;
    }

    return true;
  }

  private async hasActiveKeys(provider: ProviderType): Promise<boolean> {
    const keys = await smartKeyManager.getActiveKeys(provider);
    return keys.length > 0;
  }

  clearCooldown(provider: ProviderType): void {
    this.providerCooldowns.delete(provider);
    this.failedProviders.delete(provider);
  }

  clearAllCooldowns(): void {
    this.providerCooldowns.clear();
    this.failedProviders.clear();
  }

  getProviderStatus(): Record<ProviderType, { inCooldown: boolean; failedCategory?: ErrorCategory; cooldownRemaining?: number }> {
    const status: Record<string, any> = {};
    const allProviders: ProviderType[] = ['vidu', 'doubao', 'minimax', 'wuyinkeji', 'agnes'];

    for (const provider of allProviders) {
      const cooldownUntil = this.providerCooldowns.get(provider);
      const failedCategory = this.failedProviders.get(provider);

      status[provider] = {
        inCooldown: cooldownUntil ? Date.now() < cooldownUntil : false,
        failedCategory,
        cooldownRemaining: cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0,
      };
    }

    return status as any;
  }
}

export const fallbackChain = new FallbackChain();
