import { logger } from '@/lib/logger';

export interface PerformanceRecord {
  id: string;
  modelId: string;
  taskId: string;
  taskType: 'image' | 'video';
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  error?: string;
  cost: number;
  inputSize?: number;
  outputSize?: number;
  qualityScore?: number;
  resolution?: string;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}

export interface ModelPerformanceStats {
  modelId: string;
  totalTasks: number;
  successRate: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  totalCost: number;
  averageCost: number;
  averageQuality: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  lastUsed: Date;
}

export interface PerformanceComparison {
  modelIds: string[];
  metrics: {
    duration: Record<string, number>;
    cost: Record<string, number>;
    successRate: Record<string, number>;
    quality: Record<string, number>;
  };
  rankings: {
    fastest: string[];
    cheapest: string[];
    mostReliable: string[];
    bestQuality: string[];
  };
}

class ModelPerformanceMonitor {
  private static instance: ModelPerformanceMonitor;
  private records: Map<string, PerformanceRecord> = new Map();
  private readonly STORAGE_KEY = 'model-performance-records';
  private readonly MAX_RECORDS = 10000;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): ModelPerformanceMonitor {
    if (!ModelPerformanceMonitor.instance) {
      ModelPerformanceMonitor.instance = new ModelPerformanceMonitor();
    }
    return ModelPerformanceMonitor.instance;
  }

  public recordPerformance(record: Omit<PerformanceRecord, 'id' | 'duration'>): PerformanceRecord {
    const id = this.generateId();
    const duration = record.endTime.getTime() - record.startTime.getTime();
    
    const newRecord: PerformanceRecord = {
      ...record,
      id,
      duration
    };

    this.records.set(id, newRecord);
    this.clearOldRecords();
    this.saveToStorage();
    
    logger.info(`记录性能数据: ${record.modelId} - ${duration}ms - ${record.success ? '成功' : '失败'}`);
    return newRecord;
  }

  public getRecord(id: string): PerformanceRecord | undefined {
    return this.records.get(id);
  }

  public getRecordsByModel(modelId: string, limit?: number): PerformanceRecord[] {
    const records = Array.from(this.records.values())
      .filter(r => r.modelId === modelId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    return limit ? records.slice(0, limit) : records;
  }

  public getRecentRecords(hours: number = 24): PerformanceRecord[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return Array.from(this.records.values())
      .filter(r => r.startTime.getTime() >= cutoffTime)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  public getModelPerformanceStats(modelId: string): ModelPerformanceStats {
    const records = this.getRecordsByModel(modelId);
    
    if (records.length === 0) {
      return {
        modelId,
        totalTasks: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        totalCost: 0,
        averageCost: 0,
        averageQuality: 0,
        recentTrend: 'stable',
        lastUsed: new Date(0)
      };
    }

    const successRecords = records.filter(r => r.success);
    const durations = successRecords.map(r => r.duration).sort((a, b) => a - b);
    const costs = records.map(r => r.cost);
    const qualityScores = records.filter(r => r.qualityScore !== undefined).map(r => r.qualityScore!);

    const totalTasks = records.length;
    const successRate = successRecords.length / totalTasks;
    const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? durations[0] : 0;
    const maxDuration = durations.length > 0 ? durations[durations.length - 1] : 0;
    const p50Duration = this.getPercentile(durations, 50);
    const p95Duration = this.getPercentile(durations, 95);
    const p99Duration = this.getPercentile(durations, 99);
    const totalCost = costs.reduce((a, b) => a + b, 0);
    const averageCost = totalCost / totalTasks;
    const averageQuality = qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0;
    const lastUsed = records[0].startTime;
    const recentTrend = this.calculateTrend(successRecords);

    return {
      modelId,
      totalTasks,
      successRate,
      averageDuration,
      minDuration,
      maxDuration,
      p50Duration,
      p95Duration,
      p99Duration,
      totalCost,
      averageCost,
      averageQuality,
      recentTrend,
      lastUsed
    };
  }

  public compareModels(modelIds: string[]): PerformanceComparison {
    const stats: Record<string, ModelPerformanceStats> = {};
    modelIds.forEach(id => {
      stats[id] = this.getModelPerformanceStats(id);
    });

    const validModels = modelIds.filter(id => stats[id].totalTasks > 0);

    const metrics = {
      duration: {} as Record<string, number>,
      cost: {} as Record<string, number>,
      successRate: {} as Record<string, number>,
      quality: {} as Record<string, number>
    };

    validModels.forEach(id => {
      metrics.duration[id] = stats[id].averageDuration;
      metrics.cost[id] = stats[id].averageCost;
      metrics.successRate[id] = stats[id].successRate;
      metrics.quality[id] = stats[id].averageQuality;
    });

    const rankings = {
      fastest: [...validModels].sort((a, b) => metrics.duration[a] - metrics.duration[b]),
      cheapest: [...validModels].sort((a, b) => metrics.cost[a] - metrics.cost[b]),
      mostReliable: [...validModels].sort((a, b) => metrics.successRate[b] - metrics.successRate[a]),
      bestQuality: [...validModels].sort((a, b) => metrics.quality[b] - metrics.quality[a])
    };

    return {
      modelIds: validModels,
      metrics,
      rankings
    };
  }

  public getPerformanceHistory(modelId: string, hours: number = 168): PerformanceRecord[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.getRecordsByModel(modelId)
      .filter(r => r.startTime.getTime() >= cutoffTime);
  }

  public getAggregatedStats(hours: number = 168): {
    totalTasks: number;
    successRate: number;
    totalCost: number;
    averageDuration: number;
    topModelsByUsage: string[];
  } {
    const recentRecords = this.getRecentRecords(hours);
    
    if (recentRecords.length === 0) {
      return {
        totalTasks: 0,
        successRate: 0,
        totalCost: 0,
        averageDuration: 0,
        topModelsByUsage: []
      };
    }

    const successCount = recentRecords.filter(r => r.success).length;
    const totalCost = recentRecords.reduce((sum, r) => sum + r.cost, 0);
    const successRecords = recentRecords.filter(r => r.success);
    const averageDuration = successRecords.length > 0 
      ? successRecords.reduce((sum, r) => sum + r.duration, 0) / successRecords.length 
      : 0;

    const usageCount: Record<string, number> = {};
    recentRecords.forEach(r => {
      usageCount[r.modelId] = (usageCount[r.modelId] || 0) + 1;
    });

    const topModelsByUsage = Object.entries(usageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    return {
      totalTasks: recentRecords.length,
      successRate: successCount / recentRecords.length,
      totalCost,
      averageDuration,
      topModelsByUsage
    };
  }

  public clearOldRecords(): void {
    if (this.records.size <= this.MAX_RECORDS) return;

    const sortedRecords = Array.from(this.records.entries())
      .sort(([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime());

    const recordsToDelete = sortedRecords.slice(0, this.records.size - this.MAX_RECORDS);
    recordsToDelete.forEach(([id]) => this.records.delete(id));

    logger.info(`清理了 ${recordsToDelete.length} 条旧性能记录`);
  }

  public exportRecords(): PerformanceRecord[] {
    return Array.from(this.records.values());
  }

  public importRecords(records: PerformanceRecord[]): void {
    records.forEach(record => this.records.set(record.id, record));
    this.clearOldRecords();
    this.saveToStorage();
    logger.info(`导入了 ${records.length} 条性能记录`);
  }

  public clearAllRecords(): void {
    this.records.clear();
    this.saveToStorage();
    logger.info('所有性能记录已清空');
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private calculateTrend(records: PerformanceRecord[]): 'improving' | 'declining' | 'stable' {
    if (records.length < 10) return 'stable';

    const recent = records.slice(0, 5);
    const older = records.slice(5, 10);

    const recentAvg = recent.reduce((sum, r) => sum + r.duration, 0) / recent.length;
    const olderAvg = older.reduce((sum, r) => sum + r.duration, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent < -10) return 'improving';
    if (changePercent > 10) return 'declining';
    return 'stable';
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        parsed.forEach((record: any) => {
          record.startTime = new Date(record.startTime);
          record.endTime = new Date(record.endTime);
          this.records.set(record.id, record);
        });
        logger.info(`性能监控数据加载完成，共 ${this.records.size} 条记录`);
      }
    } catch (error) {
      logger.warn('加载性能监控数据失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(this.records.values())));
    } catch (error) {
      logger.warn('保存性能监控数据失败:', error);
    }
  }
}

export const modelPerformanceMonitor = ModelPerformanceMonitor.getInstance();
export default ModelPerformanceMonitor;
