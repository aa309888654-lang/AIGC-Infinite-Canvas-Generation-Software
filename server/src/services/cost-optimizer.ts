import type { ProviderType } from './smart-router';
import { creditManager } from './credit-manager';
import { modelSelector, type QualityTier, type ModelSelectionResult } from './model-selector';
import { logger } from '../utils/logger';

export interface CostOptimizationStrategy {
  name: string;
  description: string;
  selectModel: (criteria: CostOptimizationCriteria) => Promise<ModelSelectionResult | null>;
}

export interface CostOptimizationCriteria {
  prompt: string;
  duration: number;
  quality?: QualityTier;
  maxBudget?: number;
  userId?: string;
  userTier?: UserTier;
  requireImageToVideo?: boolean;
  requireReference?: boolean;
}

export type UserTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface BudgetStatus {
  userId: string;
  tier: UserTier;
  dailyBudget: number;
  dailySpent: number;
  dailyRemaining: number;
  monthlyBudget: number;
  monthlySpent: number;
  monthlyRemaining: number;
  isOverBudget: boolean;
}

const TIER_DEFAULTS: Record<UserTier, { dailyBudget: number; monthlyBudget: number; defaultQuality: QualityTier; costOptimization: boolean }> = {
  free: { dailyBudget: 100, monthlyBudget: 2000, defaultQuality: 'economy', costOptimization: true },
  basic: { dailyBudget: 500, monthlyBudget: 10000, defaultQuality: 'standard', costOptimization: true },
  premium: { dailyBudget: 2000, monthlyBudget: 50000, defaultQuality: 'high', costOptimization: false },
  enterprise: { dailyBudget: 10000, monthlyBudget: 200000, defaultQuality: 'ultra', costOptimization: false },
};

class BalancedStrategy implements CostOptimizationStrategy {
  name = 'balanced';
  description = '平衡策略：质量与成本均衡';

  async selectModel(criteria: CostOptimizationCriteria): Promise<ModelSelectionResult | null> {
    return modelSelector.selectBestModel({
      quality: criteria.quality || 'high',
      speed: 'normal',
      duration: criteria.duration,
      requireImageToVideo: criteria.requireImageToVideo,
      requireReference: criteria.requireReference,
      costOptimization: false,
    });
  }
}

class CostFirstStrategy implements CostOptimizationStrategy {
  name = 'cost_first';
  description = '成本优先：选择最便宜的可用模型';

  async selectModel(criteria: CostOptimizationCriteria): Promise<ModelSelectionResult | null> {
    return modelSelector.selectBestModel({
      quality: criteria.quality || 'standard',
      speed: 'fastest',
      duration: criteria.duration,
      maxCost: criteria.maxBudget,
      requireImageToVideo: criteria.requireImageToVideo,
      requireReference: criteria.requireReference,
      costOptimization: true,
    });
  }
}

class QualityFirstStrategy implements CostOptimizationStrategy {
  name = 'quality_first';
  description = '质量优先：选择最高质量的模型';

  async selectModel(criteria: CostOptimizationCriteria): Promise<ModelSelectionResult | null> {
    return modelSelector.selectBestModel({
      quality: criteria.quality || 'ultra',
      speed: 'normal',
      duration: criteria.duration,
      requireImageToVideo: criteria.requireImageToVideo,
      requireReference: criteria.requireReference,
      costOptimization: false,
    });
  }
}

class AdaptiveStrategy implements CostOptimizationStrategy {
  name = 'adaptive';
  description = '自适应策略：根据预算和用户等级动态调整';

  async selectModel(criteria: CostOptimizationCriteria): Promise<ModelSelectionResult | null> {
    const tier = criteria.userTier || 'free';
    const tierConfig = TIER_DEFAULTS[tier];

    const budgetRatio = criteria.maxBudget
      ? Math.min(1, criteria.maxBudget / tierConfig.dailyBudget)
      : 1;

    let quality: QualityTier = criteria.quality || tierConfig.defaultQuality;
    let costOptimization = tierConfig.costOptimization;

    if (budgetRatio < 0.3) {
      quality = 'economy';
      costOptimization = true;
    } else if (budgetRatio < 0.6) {
      quality = 'standard';
      costOptimization = true;
    }

    return modelSelector.selectBestModel({
      quality,
      speed: 'normal',
      duration: criteria.duration,
      maxCost: criteria.maxBudget,
      requireImageToVideo: criteria.requireImageToVideo,
      requireReference: criteria.requireReference,
      costOptimization,
    });
  }
}

export class CostOptimizer {
  private strategies: Record<string, CostOptimizationStrategy>;
  private userBudgets = new Map<string, BudgetStatus>();

  constructor() {
    this.strategies = {
      balanced: new BalancedStrategy(),
      cost_first: new CostFirstStrategy(),
      quality_first: new QualityFirstStrategy(),
      adaptive: new AdaptiveStrategy(),
    };
  }

  async optimize(criteria: CostOptimizationCriteria): Promise<ModelSelectionResult | null> {
    const strategyName = this.selectStrategy(criteria);
    const strategy = this.strategies[strategyName];

    logger.info(`[CostOptimizer] 使用策略: ${strategy.name} (${strategy.description})`);

    const result = await strategy.selectModel(criteria);

    if (result && criteria.maxBudget && result.estimatedCost > criteria.maxBudget) {
      logger.warn(`[CostOptimizer] 预估成本 ${result.estimatedCost} 超出预算 ${criteria.maxBudget}，降级到成本优先策略`);
      const fallbackResult = await this.strategies.cost_first.selectModel(criteria);
      if (fallbackResult) {
        return { ...fallbackResult, reason: `${fallbackResult.reason} (预算降级)` };
      }
    }

    return result;
  }

  private selectStrategy(criteria: CostOptimizationCriteria): string {
    const tier = criteria.userTier || 'free';
    const tierConfig = TIER_DEFAULTS[tier];

    if (tier === 'enterprise' || tier === 'premium') {
      return 'quality_first';
    }

    if (criteria.maxBudget && criteria.maxBudget < tierConfig.dailyBudget * 0.3) {
      return 'cost_first';
    }

    if (tierConfig.costOptimization) {
      return 'adaptive';
    }

    return 'balanced';
  }

  getBudgetStatus(userId: string): BudgetStatus | null {
    return this.userBudgets.get(userId) || null;
  }

  initUserBudget(userId: string, tier: UserTier): BudgetStatus {
    const tierConfig = TIER_DEFAULTS[tier];
    const now = new Date();

    const budget: BudgetStatus = {
      userId,
      tier,
      dailyBudget: tierConfig.dailyBudget,
      dailySpent: 0,
      dailyRemaining: tierConfig.dailyBudget,
      monthlyBudget: tierConfig.monthlyBudget,
      monthlySpent: 0,
      monthlyRemaining: tierConfig.monthlyBudget,
      isOverBudget: false,
    };

    this.userBudgets.set(userId, budget);
    return budget;
  }

  recordUserSpending(userId: string, cost: number): BudgetStatus | null {
    const budget = this.userBudgets.get(userId);
    if (!budget) return null;

    budget.dailySpent += cost;
    budget.dailyRemaining = Math.max(0, budget.dailyBudget - budget.dailySpent);
    budget.monthlySpent += cost;
    budget.monthlyRemaining = Math.max(0, budget.monthlyBudget - budget.monthlySpent);
    budget.isOverBudget = budget.dailySpent > budget.dailyBudget || budget.monthlySpent > budget.monthlyBudget;

    this.userBudgets.set(userId, budget);
    return budget;
  }

  getStrategyInfo(): Record<string, { name: string; description: string }> {
    const info: Record<string, { name: string; description: string }> = {};
    for (const [key, strategy] of Object.entries(this.strategies)) {
      info[key] = { name: strategy.name, description: strategy.description };
    }
    return info;
  }

  getTierDefaults(): Record<UserTier, { dailyBudget: number; monthlyBudget: number; defaultQuality: QualityTier; costOptimization: boolean }> {
    return { ...TIER_DEFAULTS };
  }
}

export const costOptimizer = new CostOptimizer();
