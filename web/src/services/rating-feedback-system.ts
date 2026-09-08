import { logger } from '@/lib/logger';

export interface Rating {
  id: string;
  modelId: string;
  userId: string;
  score: number;
  comment?: string;
  createdAt: Date;
  updatedAt?: Date;
  helpfulCount: number;
  notHelpfulCount: number;
  tags?: string[];
}

export interface ModelRatingStats {
  modelId: string;
  averageScore: number;
  totalRatings: number;
  scoreDistribution: Record<number, number>;
  topTags: string[];
  averageHelpfulness: number;
}

export interface Feedback {
  id: string;
  modelId: string;
  userId: string;
  type: 'bug' | 'feature' | 'general';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt?: Date;
  attachments?: string[];
}

class RatingFeedbackSystem {
  private static instance: RatingFeedbackSystem;
  private ratings: Map<string, Rating> = new Map();
  private feedbacks: Map<string, Feedback> = new Map();
  private readonly RATINGS_STORAGE_KEY = 'ai-model-ratings';
  private readonly FEEDBACKS_STORAGE_KEY = 'ai-model-feedbacks';

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): RatingFeedbackSystem {
    if (!RatingFeedbackSystem.instance) {
      RatingFeedbackSystem.instance = new RatingFeedbackSystem();
    }
    return RatingFeedbackSystem.instance;
  }

  public addRating(rating: Omit<Rating, 'id' | 'createdAt' | 'helpfulCount' | 'notHelpfulCount'>): Rating {
    const id = this.generateId();
    const newRating: Rating = {
      ...rating,
      id,
      createdAt: new Date(),
      helpfulCount: 0,
      notHelpfulCount: 0
    };

    this.ratings.set(id, newRating);
    this.saveToStorage();
    logger.info(`添加评分: ${rating.modelId} - ${rating.score}星`);
    return newRating;
  }

  public updateRating(id: string, updates: Partial<Omit<Rating, 'id' | 'modelId' | 'userId' | 'createdAt'>>): Rating | undefined {
    const rating = this.ratings.get(id);
    if (!rating) return undefined;

    const updatedRating: Rating = {
      ...rating,
      ...updates,
      updatedAt: new Date()
    };

    this.ratings.set(id, updatedRating);
    this.saveToStorage();
    logger.info(`更新评分: ${id}`);
    return updatedRating;
  }

  public deleteRating(id: string): boolean {
    const success = this.ratings.delete(id);
    if (success) {
      this.saveToStorage();
      logger.info(`删除评分: ${id}`);
    }
    return success;
  }

  public getRating(id: string): Rating | undefined {
    return this.ratings.get(id);
  }

  public getRatingsByModel(modelId: string): Rating[] {
    return Array.from(this.ratings.values())
      .filter(r => r.modelId === modelId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getRatingsByUser(userId: string): Rating[] {
    return Array.from(this.ratings.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getModelRatingStats(modelId: string): ModelRatingStats {
    const modelRatings = this.getRatingsByModel(modelId);
    const scoreDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const tagCounts: Record<string, number> = {};

    let totalScore = 0;
    let totalHelpfulness = 0;

    modelRatings.forEach(rating => {
      scoreDistribution[rating.score] = (scoreDistribution[rating.score] || 0) + 1;
      totalScore += rating.score;
      totalHelpfulness += rating.helpfulCount - rating.notHelpfulCount;

      rating.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    return {
      modelId,
      averageScore: modelRatings.length > 0 ? totalScore / modelRatings.length : 0,
      totalRatings: modelRatings.length,
      scoreDistribution,
      topTags,
      averageHelpfulness: modelRatings.length > 0 ? totalHelpfulness / modelRatings.length : 0
    };
  }

  public markRatingAsHelpful(ratingId: string, isHelpful: boolean): void {
    const rating = this.ratings.get(ratingId);
    if (!rating) return;

    if (isHelpful) {
      rating.helpfulCount++;
    } else {
      rating.notHelpfulCount++;
    }

    this.ratings.set(ratingId, rating);
    this.saveToStorage();
  }

  public addFeedback(feedback: Omit<Feedback, 'id' | 'createdAt' | 'status' | 'priority'>): Feedback {
    const id = this.generateId();
    const newFeedback: Feedback = {
      ...feedback,
      id,
      status: 'open',
      priority: 'medium',
      createdAt: new Date()
    };

    this.feedbacks.set(id, newFeedback);
    this.saveToStorage();
    logger.info(`添加反馈: ${feedback.modelId} - ${feedback.title}`);
    return newFeedback;
  }

  public updateFeedback(id: string, updates: Partial<Omit<Feedback, 'id' | 'modelId' | 'userId' | 'createdAt'>>): Feedback | undefined {
    const feedback = this.feedbacks.get(id);
    if (!feedback) return undefined;

    const updatedFeedback: Feedback = {
      ...feedback,
      ...updates,
      updatedAt: new Date()
    };

    this.feedbacks.set(id, updatedFeedback);
    this.saveToStorage();
    logger.info(`更新反馈: ${id}`);
    return updatedFeedback;
  }

  public getFeedback(id: string): Feedback | undefined {
    return this.feedbacks.get(id);
  }

  public getFeedbacksByModel(modelId: string): Feedback[] {
    return Array.from(this.feedbacks.values())
      .filter(f => f.modelId === modelId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getFeedbacksByStatus(status: Feedback['status']): Feedback[] {
    return Array.from(this.feedbacks.values())
      .filter(f => f.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getFeedbacksByPriority(priority: Feedback['priority']): Feedback[] {
    return Array.from(this.feedbacks.values())
      .filter(f => f.priority === priority)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getAllFeedbacks(): Feedback[] {
    return Array.from(this.feedbacks.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public deleteFeedback(id: string): boolean {
    const success = this.feedbacks.delete(id);
    if (success) {
      this.saveToStorage();
      logger.info(`删除反馈: ${id}`);
    }
    return success;
  }

  public getTopRatedModels(limit: number = 10, minRatings: number = 3): string[] {
    const allModelIds = new Set(Array.from(this.ratings.values()).map(r => r.modelId));
    const modelStats = Array.from(allModelIds)
      .map(id => this.getModelRatingStats(id))
      .filter(stats => stats.totalRatings >= minRatings)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, limit);

    return modelStats.map(stats => stats.modelId);
  }

  public getMostRatedModels(limit: number = 10): string[] {
    const allModelIds = new Set(Array.from(this.ratings.values()).map(r => r.modelId));
    const modelStats = Array.from(allModelIds)
      .map(id => this.getModelRatingStats(id))
      .sort((a, b) => b.totalRatings - a.totalRatings)
      .slice(0, limit);

    return modelStats.map(stats => stats.modelId);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadFromStorage(): void {
    try {
      const ratingsData = localStorage.getItem(this.RATINGS_STORAGE_KEY);
      const feedbacksData = localStorage.getItem(this.FEEDBACKS_STORAGE_KEY);

      if (ratingsData) {
        const parsedRatings = JSON.parse(ratingsData);
        parsedRatings.forEach((rating: any) => {
          rating.createdAt = new Date(rating.createdAt);
          if (rating.updatedAt) {
            rating.updatedAt = new Date(rating.updatedAt);
          }
          this.ratings.set(rating.id, rating);
        });
      }

      if (feedbacksData) {
        const parsedFeedbacks = JSON.parse(feedbacksData);
        parsedFeedbacks.forEach((feedback: any) => {
          feedback.createdAt = new Date(feedback.createdAt);
          if (feedback.updatedAt) {
            feedback.updatedAt = new Date(feedback.updatedAt);
          }
          this.feedbacks.set(feedback.id, feedback);
        });
      }

      logger.info('评分和反馈系统数据加载完成');
    } catch (error) {
      logger.warn('加载评分和反馈数据失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.RATINGS_STORAGE_KEY, JSON.stringify(Array.from(this.ratings.values())));
      localStorage.setItem(this.FEEDBACKS_STORAGE_KEY, JSON.stringify(Array.from(this.feedbacks.values())));
    } catch (error) {
      logger.warn('保存评分和反馈数据失败:', error);
    }
  }

  public exportData(): { ratings: Rating[], feedbacks: Feedback[] } {
    return {
      ratings: Array.from(this.ratings.values()),
      feedbacks: Array.from(this.feedbacks.values())
    };
  }

  public importData(data: { ratings: Rating[], feedbacks: Feedback[] }): void {
    data.ratings.forEach(rating => this.ratings.set(rating.id, rating));
    data.feedbacks.forEach(feedback => this.feedbacks.set(feedback.id, feedback));
    this.saveToStorage();
    logger.info('评分和反馈系统数据导入完成');
  }

  public clearAllData(): void {
    this.ratings.clear();
    this.feedbacks.clear();
    this.saveToStorage();
    logger.info('评分和反馈系统数据已清空');
  }
}

export const ratingFeedbackSystem = RatingFeedbackSystem.getInstance();
export default RatingFeedbackSystem;
