import { modelRegistry, ModelInfo } from './model-registry';
import { modelPerformanceMonitor, ModelPerformanceStats } from './model-performance-monitor';
import { ratingFeedbackSystem, ModelRatingStats } from './rating-feedback-system';

export interface RecommendationWeights {
  quality: number;
  speed: number;
  cost: number;
  popularity: number;
  userPreference: number;
  recentPerformance: number;
}

export interface RecommendationOptions {
  taskType: 'image' | 'video' | 'both';
  budget?: number;
  maxDuration?: number;
  minQuality?: number;
  weights?: Partial<RecommendationWeights>;
  limit?: number;
  excludeModels?: string[];
}

export interface ModelRecommendation {
  model: ModelInfo;
  score: number;
  reasons: string[];
  performanceStats?: ModelPerformanceStats;
  ratingStats?: ModelRatingStats;
  estimatedCost?: number;
  estimatedDuration?: number;
}

export interface WorkflowAnalysis {
  nodes: Array<{
    id: string;
    type: 'image-gen' | 'video-gen' | 'image-input' | 'text-input' | 'output';
    modelId?: string;
  }>;
  connections: Array<{
    from: string;
    to: string;
  }>;
}

export interface ProviderCombination {
  providers: string[];
  totalEstimatedCost: number;
  totalEstimatedDuration: number;
  overallQualityScore: number;
  recommendations: Record<string, ModelRecommendation>;
}

class IntelligentRecommendationEngine {
  private static instance: IntelligentRecommendationEngine;
  private readonly DEFAULT_WEIGHTS: RecommendationWeights = {
    quality: 0.3,
    speed: 0.2,
    cost: 0.25,
    popularity: 0.1,
    userPreference: 0.1,
    recentPerformance: 0.05
  };

  private constructor() { /* noop */ }

  public static getInstance(): IntelligentRecommendationEngine {
    if (!IntelligentRecommendationEngine.instance) {
      IntelligentRecommendationEngine.instance = new IntelligentRecommendationEngine();
    }
    return IntelligentRecommendationEngine.instance;
  }

  public recommendModels(options: RecommendationOptions): ModelRecommendation[] {
    const weights = { ...this.DEFAULT_WEIGHTS, ...options.weights };
    const limit = options.limit || 10;

    let candidateModels = modelRegistry.getModelsByType(options.taskType);

    if (options.excludeModels) {
      candidateModels = candidateModels.filter(m => !options.excludeModels!.includes(m.id));
    }

    const scoredModels: ModelRecommendation[] = candidateModels.map(model => {
      const scoreData = this.calculateModelScore(model, weights, options);
      return {
        model,
        score: scoreData.score,
        reasons: scoreData.reasons,
        performanceStats: modelPerformanceMonitor.getModelPerformanceStats(model.id),
        ratingStats: ratingFeedbackSystem.getModelRatingStats(model.id),
        estimatedCost: this.estimateCost(model, options.taskType),
        estimatedDuration: this.estimateDuration(model)
      };
    });

    return scoredModels
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  public getPopularModels(_taskType: 'image' | 'video' | 'both' = 'both', limit: number = 10): ModelRecommendation[] {
    const recommendations = modelRegistry.getPopularModels(limit);

    return recommendations.map(model => ({
      model,
      score: model.qualityRating || 0,
      reasons: ['热门模型', '用户推荐'],
      performanceStats: modelPerformanceMonitor.getModelPerformanceStats(model.id),
      ratingStats: ratingFeedbackSystem.getModelRatingStats(model.id)
    }));
  }

  public analyzeWorkflowAndRecommend(workflow: WorkflowAnalysis): ProviderCombination {
    const imageGenNodes = workflow.nodes.filter(n => n.type === 'image-gen');
    const videoGenNodes = workflow.nodes.filter(n => n.type === 'video-gen');

    const recommendations: Record<string, ModelRecommendation> = {};
    let totalCost = 0;
    let totalDuration = 0;
    let totalQuality = 0;
    let modelCount = 0;

    imageGenNodes.forEach(node => {
      const recs = this.recommendModels({
        taskType: 'image',
        limit: 1
      });
      if (recs.length > 0) {
        recommendations[node.id] = recs[0];
        totalCost += recs[0].estimatedCost || 0;
        totalDuration += recs[0].estimatedDuration || 0;
        totalQuality += recs[0].model.qualityRating || 0;
        modelCount++;
      }
    });

    videoGenNodes.forEach(node => {
      const recs = this.recommendModels({
        taskType: 'video',
        limit: 1
      });
      if (recs.length > 0) {
        recommendations[node.id] = recs[0];
        totalCost += recs[0].estimatedCost || 0;
        totalDuration += recs[0].estimatedDuration || 0;
        totalQuality += recs[0].model.qualityRating || 0;
        modelCount++;
      }
    });

    const providers = new Set<string>();
    Object.values(recommendations).forEach(rec => {
      providers.add(rec.model.provider);
    });

    return {
      providers: Array.from(providers),
      totalEstimatedCost: totalCost,
      totalEstimatedDuration: totalDuration,
      overallQualityScore: modelCount > 0 ? totalQuality / modelCount : 0,
      recommendations
    };
  }

  public multiObjectiveOptimize(
    options: RecommendationOptions,
    objectives: {
      prioritizeCost?: boolean;
      prioritizeSpeed?: boolean;
      prioritizeQuality?: boolean;
    }
  ): ModelRecommendation[] {
    let weights: Partial<RecommendationWeights> = {};

    if (objectives.prioritizeCost) {
      weights = { cost: 0.5, quality: 0.2, speed: 0.15, popularity: 0.1, userPreference: 0.05 };
    } else if (objectives.prioritizeSpeed) {
      weights = { speed: 0.5, quality: 0.2, cost: 0.15, popularity: 0.1, userPreference: 0.05 };
    } else if (objectives.prioritizeQuality) {
      weights = { quality: 0.5, speed: 0.15, cost: 0.15, popularity: 0.1, userPreference: 0.1 };
    }

    return this.recommendModels({ ...options, weights });
  }

  public getPersonalizedRecommendations(
    userId: string = 'default',
    options: Omit<RecommendationOptions, 'weights'>
  ): ModelRecommendation[] {
    const favorites = modelRegistry.getFavoriteModels(userId);
    const recentUsed = modelRegistry.getRecentUsedModels(userId);

    const weights: Partial<RecommendationWeights> = {
      userPreference: 0.3,
      quality: 0.25,
      speed: 0.15,
      cost: 0.15,
      popularity: 0.1,
      recentPerformance: 0.05
    };

    const recommendations = this.recommendModels({ ...options, weights });

    const favoriteIds = new Set(favorites.map(m => m.id));
    const recentUsedIds = new Set(recentUsed.map(m => m.id));

    return recommendations.map(rec => {
      const newReasons = [...rec.reasons];
      if (favoriteIds.has(rec.model.id)) {
        newReasons.push('您的收藏');
      }
      if (recentUsedIds.has(rec.model.id)) {
        newReasons.push('最近使用');
      }
      return { ...rec, reasons: newReasons };
    });
  }

  private calculateModelScore(
    model: ModelInfo,
    weights: RecommendationWeights,
    options: RecommendationOptions
  ): { score: number; reasons: string[] } {
    let totalScore = 0;
    const reasons: string[] = [];

    const qualityScore = this.getQualityScore(model);
    totalScore += qualityScore * weights.quality;
    if (qualityScore >= 0.8) reasons.push('高质量评分');

    const speedScore = this.getSpeedScore(model);
    totalScore += speedScore * weights.speed;
    if (speedScore >= 0.8) reasons.push('快速响应');

    const costScore = this.getCostScore(model, options.taskType);
    totalScore += costScore * weights.cost;
    if (costScore >= 0.8) reasons.push('高性价比');

    const popularityScore = model.isPopular ? 1 : 0.5;
    totalScore += popularityScore * weights.popularity;
    if (model.isPopular) reasons.push('热门推荐');

    const performanceScore = this.getRecentPerformanceScore(model.id);
    totalScore += performanceScore * weights.recentPerformance;
    if (performanceScore >= 0.8) reasons.push('性能表现优秀');

    const userPrefScore = this.getUserPreferenceScore(model.id);
    totalScore += userPrefScore * weights.userPreference;

    return {
      score: Math.min(1, totalScore),
      reasons
    };
  }

  private getQualityScore(model: ModelInfo): number {
    const ratingStats = ratingFeedbackSystem.getModelRatingStats(model.id);
    
    if (ratingStats.totalRatings >= 5) {
      return ratingStats.averageScore / 5;
    }
    
    return (model.qualityRating || 4) / 5;
  }

  private getSpeedScore(model: ModelInfo): number {
    const perfStats = modelPerformanceMonitor.getModelPerformanceStats(model.id);
    
    if (perfStats.totalTasks >= 10) {
      const avgDuration = perfStats.averageDuration;
      if (avgDuration < 5000) return 1;
      if (avgDuration < 15000) return 0.8;
      if (avgDuration < 30000) return 0.6;
      return 0.4;
    }

    switch (model.estimatedSpeed) {
      case 'fast': return 0.9;
      case 'medium': return 0.6;
      case 'slow': return 0.3;
      default: return 0.5;
    }
  }

  private getCostScore(model: ModelInfo, taskType: 'image' | 'video' | 'both'): number {
    if (taskType === 'image' || taskType === 'both') {
      const cost = model.costPerImage || 0.02;
      if (cost <= 0.005) return 1;
      if (cost <= 0.01) return 0.8;
      if (cost <= 0.02) return 0.6;
      if (cost <= 0.05) return 0.4;
      return 0.2;
    }

    const cost = model.costPerMinute || 0.5;
    if (cost <= 0.2) return 1;
    if (cost <= 0.5) return 0.8;
    if (cost <= 1) return 0.6;
    if (cost <= 2) return 0.4;
    return 0.2;
  }

  private getRecentPerformanceScore(modelId: string): number {
    const perfStats = modelPerformanceMonitor.getModelPerformanceStats(modelId);
    
    if (perfStats.totalTasks === 0) return 0.5;
    
    let score = perfStats.successRate;
    
    if (perfStats.recentTrend === 'improving') score += 0.1;
    if (perfStats.recentTrend === 'declining') score -= 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  private getUserPreferenceScore(modelId: string): number {
    const favorites = modelRegistry.getFavoriteModels('default');
    const recentUsed = modelRegistry.getRecentUsedModels('default');

    if (favorites.some(m => m.id === modelId)) return 1;
    if (recentUsed.some(m => m.id === modelId)) return 0.8;
    
    return 0.5;
  }

  private estimateCost(model: ModelInfo, taskType: 'image' | 'video' | 'both'): number {
    if (taskType === 'image' || taskType === 'both') {
      return model.costPerImage || 0.02;
    }
    return model.costPerMinute || 0.5;
  }

  private estimateDuration(model: ModelInfo): number {
    const perfStats = modelPerformanceMonitor.getModelPerformanceStats(model.id);
    if (perfStats.totalTasks >= 10) {
      return perfStats.averageDuration;
    }

    switch (model.estimatedSpeed) {
      case 'fast': return 5000;
      case 'medium': return 15000;
      case 'slow': return 30000;
      default: return 15000;
    }
  }
}

export const intelligentRecommendationEngine = IntelligentRecommendationEngine.getInstance();
export default IntelligentRecommendationEngine;
