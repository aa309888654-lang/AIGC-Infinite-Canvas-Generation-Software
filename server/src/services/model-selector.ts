import type { ProviderType } from './smart-router';
import { creditManager } from './credit-manager';
import { smartKeyManager } from './smart-key-manager';
import { logger } from '../utils/logger';

export type QualityTier = 'ultra' | 'high' | 'standard' | 'economy';
export type SpeedTier = 'fastest' | 'fast' | 'normal' | 'slow';

export interface ModelOption {
  provider: ProviderType;
  model: string;
  qualityTier: QualityTier;
  speedTier: SpeedTier;
  costPerRequest: number;
  maxDuration: number;
  supportsImageToVideo: boolean;
  supportsTextToVideo: boolean;
  supportsReference: boolean;
}

export interface ModelSelectionCriteria {
  quality?: QualityTier;
  speed?: SpeedTier;
  maxCost?: number;
  requireImageToVideo?: boolean;
  requireReference?: boolean;
  duration?: number;
  preferProvider?: ProviderType;
  costOptimization?: boolean;
}

export interface ModelSelectionResult {
  provider: ProviderType;
  model: string;
  score: number;
  reason: string;
  estimatedCost: number;
  qualityTier: QualityTier;
  speedTier: SpeedTier;
}

const MODEL_REGISTRY: ModelOption[] = [
  {
    provider: 'vidu', model: 'viduq3-pro', qualityTier: 'ultra', speedTier: 'slow',
    costPerRequest: 100, maxDuration: 12, supportsImageToVideo: true, supportsTextToVideo: true, supportsReference: true,
  },
  {
    provider: 'vidu', model: 'viduq3-pro-fast', qualityTier: 'high', speedTier: 'fast',
    costPerRequest: 80, maxDuration: 8, supportsImageToVideo: true, supportsTextToVideo: true, supportsReference: true,
  },
  {
    provider: 'vidu', model: 'viduq3-turbo', qualityTier: 'high', speedTier: 'fastest',
    costPerRequest: 60, maxDuration: 8, supportsImageToVideo: true, supportsTextToVideo: true, supportsReference: true,
  },
  {
    provider: 'vidu', model: 'viduq3-mix', qualityTier: 'standard', speedTier: 'normal',
    costPerRequest: 50, maxDuration: 8, supportsImageToVideo: true, supportsTextToVideo: true, supportsReference: false,
  },
  {
    provider: 'vidu', model: 'viduq2-pro', qualityTier: 'high', speedTier: 'normal',
    costPerRequest: 40, maxDuration: 8, supportsImageToVideo: true, supportsTextToVideo: true, supportsReference: true,
  },
  {
    provider: 'vidu', model: 'viduq2-turbo', qualityTier: 'standard', speedTier: 'fastest',
    costPerRequest: 30, maxDuration: 4, supportsImageToVideo: true, supportsTextToVideo: true, supportsReference: false,
  },
  {
    provider: 'doubao', model: 'doubao-seedance-1-5-pro', qualityTier: 'high', speedTier: 'normal',
    costPerRequest: 60, maxDuration: 8, supportsImageToVideo: true, supportsTextToVideo: true, supportsReference: true,
  },
];

const QUALITY_SCORE: Record<QualityTier, number> = {
  ultra: 100, high: 75, standard: 50, economy: 25,
};

const SPEED_SCORE: Record<SpeedTier, number> = {
  fastest: 100, fast: 75, normal: 50, slow: 25,
};

const QUALITY_PRIORITY: QualityTier[] = ['ultra', 'high', 'standard', 'economy'];
const SPEED_PRIORITY: SpeedTier[] = ['fastest', 'fast', 'normal', 'slow'];

export class ModelSelector {
  async selectBestModel(criteria: ModelSelectionCriteria): Promise<ModelSelectionResult | null> {
    const candidates = await this.filterCandidates(criteria);

    if (candidates.length === 0) {
      logger.warn('[ModelSelector] 没有找到符合条件的模型');
      return null;
    }

    const scored = candidates.map(option => {
      const score = this.calculateScore(option, criteria);
      return { option, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const estimatedCost = creditManager.estimateCost(best.option.provider, best.option.model, criteria.duration || 5);

    logger.info(`[ModelSelector] 选择模型: ${best.option.provider}/${best.option.model} (分数: ${best.score.toFixed(1)}, 预估成本: ${estimatedCost})`);

    return {
      provider: best.option.provider,
      model: best.option.model,
      score: best.score,
      reason: this.generateReason(best.option, criteria),
      estimatedCost,
      qualityTier: best.option.qualityTier,
      speedTier: best.option.speedTier,
    };
  }

  private async filterCandidates(criteria: ModelSelectionCriteria): Promise<ModelOption[]> {
    let candidates = [...MODEL_REGISTRY];

    if (criteria.requireImageToVideo) {
      candidates = candidates.filter(m => m.supportsImageToVideo);
    }

    if (criteria.requireReference) {
      candidates = candidates.filter(m => m.supportsReference);
    }

    if (criteria.duration && criteria.duration > 0) {
      candidates = candidates.filter(m => m.maxDuration >= criteria.duration!);
    }

    if (criteria.maxCost && criteria.maxCost > 0) {
      candidates = candidates.filter(m => m.costPerRequest <= criteria.maxCost!);
    }

    if (criteria.quality) {
      const minQualityIndex = QUALITY_PRIORITY.indexOf(criteria.quality);
      candidates = candidates.filter(m => QUALITY_PRIORITY.indexOf(m.qualityTier) <= minQualityIndex);
    }

    if (criteria.speed) {
      const minSpeedIndex = SPEED_PRIORITY.indexOf(criteria.speed);
      candidates = candidates.filter(m => SPEED_PRIORITY.indexOf(m.speedTier) <= minSpeedIndex);
    }

    const availableCandidates: ModelOption[] = [];
    for (const candidate of candidates) {
      const keys = await smartKeyManager.getActiveKeys(candidate.provider);
      if (keys.length > 0) {
        availableCandidates.push(candidate);
      }
    }

    return availableCandidates;
  }

  private calculateScore(option: ModelOption, criteria: ModelSelectionCriteria): number {
    let score = 0;

    if (criteria.quality) {
      score += QUALITY_SCORE[option.qualityTier] * 0.4;
    } else {
      score += QUALITY_SCORE[option.qualityTier] * 0.2;
    }

    if (criteria.speed) {
      score += SPEED_SCORE[option.speedTier] * 0.3;
    } else {
      score += SPEED_SCORE[option.speedTier] * 0.15;
    }

    if (criteria.costOptimization) {
      const maxCost = 100;
      score += ((maxCost - option.costPerRequest) / maxCost) * 100 * 0.4;
    } else {
      const maxCost = 100;
      score += ((maxCost - option.costPerRequest) / maxCost) * 100 * 0.15;
    }

    if (criteria.preferProvider && option.provider === criteria.preferProvider) {
      score += 20;
    }

    return score;
  }

  private generateReason(option: ModelOption, criteria: ModelSelectionCriteria): string {
    const parts: string[] = [];

    if (criteria.costOptimization) {
      parts.push(`成本优化(¥${option.costPerRequest})`);
    }
    if (criteria.quality) {
      parts.push(`质量${option.qualityTier}`);
    }
    if (criteria.speed) {
      parts.push(`速度${option.speedTier}`);
    }

    if (parts.length === 0) {
      parts.push(`综合评分最优`);
    }

    return `${option.provider}/${option.model}: ${parts.join(', ')}`;
  }

  getAvailableModels(criteria?: ModelSelectionCriteria): ModelOption[] {
    let models = [...MODEL_REGISTRY];

    if (criteria?.requireImageToVideo) {
      models = models.filter(m => m.supportsImageToVideo);
    }
    if (criteria?.requireReference) {
      models = models.filter(m => m.supportsReference);
    }
    if (criteria?.duration) {
      models = models.filter(m => m.maxDuration >= criteria.duration!);
    }

    return models;
  }

  getModelInfo(provider: ProviderType, model: string): ModelOption | undefined {
    return MODEL_REGISTRY.find(m => m.provider === provider && m.model === model);
  }
}

export const modelSelector = new ModelSelector();
