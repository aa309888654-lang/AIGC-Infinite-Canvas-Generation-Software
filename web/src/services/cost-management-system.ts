import { logger } from '@/lib/logger';
import { modelRegistry } from './model-registry';

export interface CostRecord {
  id: string;
  modelId: string;
  taskId: string;
  userId: string;
  amount: number;
  currency: string;
  taskType: 'image' | 'video';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Budget {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  warningThreshold: number;
  actions: {
    warnAt: number;
    pauseAt: number;
    notify: boolean;
    autoPause: boolean;
  };
}

export interface CostEstimate {
  modelId: string;
  estimatedCost: number;
  breakdown: {
    baseCost: number;
    additionalCosts: Record<string, number>;
  };
  confidence: 'low' | 'medium' | 'high';
}

export interface CostOptimizationSuggestion {
  id: string;
  type: 'switch_model' | 'adjust_parameters' | 'batch_process' | 'use_cache';
  title: string;
  description: string;
  estimatedSavings: number;
  confidence: 'low' | 'medium' | 'high';
  action?: () => void;
}

class CostManagementSystem {
  private static instance: CostManagementSystem;
  private costRecords: Map<string, CostRecord> = new Map();
  private budgets: Map<string, Budget> = new Map();
  private readonly COST_RECORDS_KEY = 'cost-management-records';
  private readonly BUDGETS_KEY = 'cost-management-budgets';

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): CostManagementSystem {
    if (!CostManagementSystem.instance) {
      CostManagementSystem.instance = new CostManagementSystem();
    }
    return CostManagementSystem.instance;
  }

  public addCostRecord(record: Omit<CostRecord, 'id'>): CostRecord {
    const id = this.generateId();
    const newRecord: CostRecord = {
      ...record,
      id
    };

    this.costRecords.set(id, newRecord);
    this.saveToStorage();
    
    this.checkBudgetThresholds(record.userId);
    
    logger.info(`记录成本: ${record.modelId} - ${record.amount} ${record.currency}`);
    return newRecord;
  }

  public getCostRecord(id: string): CostRecord | undefined {
    return this.costRecords.get(id);
  }

  public getCostRecordsByUser(userId: string, limit?: number): CostRecord[] {
    const records = Array.from(this.costRecords.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? records.slice(0, limit) : records;
  }

  public getCostRecordsByModel(modelId: string, limit?: number): CostRecord[] {
    const records = Array.from(this.costRecords.values())
      .filter(r => r.modelId === modelId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? records.slice(0, limit) : records;
  }

  public getCostRecordsByPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): CostRecord[] {
    return Array.from(this.costRecords.values())
      .filter(r => 
        r.userId === userId &&
        r.timestamp >= startDate &&
        r.timestamp <= endDate
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getTotalCost(userId: string, startDate?: Date, endDate?: Date): number {
    let records = this.getCostRecordsByUser(userId);
    
    if (startDate && endDate) {
      records = records.filter(r => 
        r.timestamp >= startDate && r.timestamp <= endDate
      );
    }

    return records.reduce((sum, r) => sum + r.amount, 0);
  }

  public createBudget(budget: Omit<Budget, 'id'>): Budget {
    const id = this.generateId();
    const newBudget: Budget = {
      ...budget,
      id
    };

    this.budgets.set(id, newBudget);
    this.saveToStorage();
    
    logger.info(`创建预算: ${budget.name} - ${budget.amount} ${budget.currency}`);
    return newBudget;
  }

  public updateBudget(id: string, updates: Partial<Omit<Budget, 'id' | 'userId'>>): Budget | undefined {
    const budget = this.budgets.get(id);
    if (!budget) return undefined;

    const updatedBudget: Budget = {
      ...budget,
      ...updates
    };

    this.budgets.set(id, updatedBudget);
    this.saveToStorage();
    logger.info(`更新预算: ${budget.name}`);
    return updatedBudget;
  }

  public deleteBudget(id: string): boolean {
    const success = this.budgets.delete(id);
    if (success) {
      this.saveToStorage();
      logger.info(`删除预算: ${id}`);
    }
    return success;
  }

  public getBudget(id: string): Budget | undefined {
    return this.budgets.get(id);
  }

  public getBudgetsByUser(userId: string): Budget[] {
    return Array.from(this.budgets.values())
      .filter(b => b.userId === userId && b.isActive);
  }

  public getBudgetUsage(budgetId: string): { used: number; remaining: number; percentage: number } {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      return { used: 0, remaining: 0, percentage: 0 };
    }
    const startDate = budget.startDate;
    const endDate = budget.endDate || this.calculatePeriodEnd(startDate, budget.period);

    const used = this.getTotalCost(budget.userId, startDate, endDate);
    const remaining = Math.max(0, budget.amount - used);
    const percentage = (used / budget.amount) * 100;

    return { used, remaining, percentage };
  }

  public estimateCost(
    modelId: string,
    taskType: 'image' | 'video',
    parameters: {
      resolution?: string;
      duration?: number;
      iterations?: number;
    } = {}
  ): CostEstimate {
    const model = this.getModelInfo(modelId);
    
    let baseCost = 0;
    if (taskType === 'image') {
      baseCost = model?.costPerImage || 0.02;
    } else {
      const duration = parameters.duration || 1;
      baseCost = (model?.costPerMinute || 0.5) * (duration / 60);
    }

    const additionalCosts: Record<string, number> = {};
    if (parameters.iterations && parameters.iterations > 1) {
      additionalCosts.multipleIterations = baseCost * (parameters.iterations - 1) * 0.8;
    }

    const totalCost = baseCost + Object.values(additionalCosts).reduce((a, b) => a + b, 0);

    return {
      modelId,
      estimatedCost: totalCost,
      breakdown: {
        baseCost,
        additionalCosts
      },
      confidence: model ? 'high' : 'medium'
    };
  }

  public getOptimizationSuggestions(
    userId: string,
    modelId?: string
  ): CostOptimizationSuggestion[] {
    const suggestions: CostOptimizationSuggestion[] = [];
    
    const recentCosts = this.getCostRecordsByUser(userId, 50);
    
    if (recentCosts.length > 10) {
      suggestions.push({
        id: this.generateId(),
        type: 'batch_process',
        title: '批量处理以节省成本',
        description: '您最近有多个相似任务，可以考虑批量处理以获得折扣',
        estimatedSavings: recentCosts.length * 0.1,
        confidence: 'medium'
      });
    }

    if (modelId) {
      const modelCosts = this.getCostRecordsByModel(modelId, 20);
      if (modelCosts.length > 5) {
        suggestions.push({
          id: this.generateId(),
          type: 'use_cache',
          title: '启用缓存功能',
          description: '对于重复的输入，启用缓存可以显著降低成本',
          estimatedSavings: modelCosts.length * 0.3,
          confidence: 'high'
        });
      }
    }

    return suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  private checkBudgetThresholds(userId: string): void {
    const userBudgets = this.getBudgetsByUser(userId);
    
    userBudgets.forEach(budget => {
      const usage = this.getBudgetUsage(budget.id);
      
      if (usage.percentage >= budget.warningThreshold && budget.actions.notify) {
        this.triggerBudgetWarning(budget, usage);
      }
      
      if (usage.percentage >= budget.actions.pauseAt && budget.actions.autoPause) {
        this.triggerBudgetPause(budget, usage);
      }
    });
  }

  private triggerBudgetWarning(budget: Budget, usage: { used: number; remaining: number; percentage: number }): void {
    logger.warn(`预算警告: ${budget.name} 已使用 ${usage.percentage.toFixed(1)}%`);
    this.dispatchBudgetEvent('budget-warning', { budget, usage });
  }

  private triggerBudgetPause(budget: Budget, usage: { used: number; remaining: number; percentage: number }): void {
    logger.error(`预算暂停: ${budget.name} 已使用 ${usage.percentage.toFixed(1)}%，自动暂停任务`);
    this.dispatchBudgetEvent('budget-pause', { budget, usage });
  }

  private dispatchBudgetEvent(type: string, data: any): void {
    const event = new CustomEvent(type, { detail: data });
    window.dispatchEvent(event);
  }

  private calculatePeriodEnd(startDate: Date, period: Budget['period']): Date {
    const endDate = new Date(startDate);
    
    switch (period) {
      case 'daily':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }
    
    return endDate;
  }

  private getModelInfo(modelId: string): Record<string, any> | null {
    try {
      return modelRegistry.getModelById(modelId);
    } catch {
      return null;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadFromStorage(): void {
    try {
      const costRecordsData = localStorage.getItem(this.COST_RECORDS_KEY);
      const budgetsData = localStorage.getItem(this.BUDGETS_KEY);

      if (costRecordsData) {
        const parsed = JSON.parse(costRecordsData);
        parsed.forEach((record: any) => {
          record.timestamp = new Date(record.timestamp);
          this.costRecords.set(record.id, record);
        });
      }

      if (budgetsData) {
        const parsed = JSON.parse(budgetsData);
        parsed.forEach((budget: any) => {
          budget.startDate = new Date(budget.startDate);
          if (budget.endDate) {
            budget.endDate = new Date(budget.endDate);
          }
          this.budgets.set(budget.id, budget);
        });
      }

      logger.info('成本管理系统数据加载完成');
    } catch (error) {
      logger.warn('加载成本管理数据失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.COST_RECORDS_KEY, JSON.stringify(Array.from(this.costRecords.values())));
      localStorage.setItem(this.BUDGETS_KEY, JSON.stringify(Array.from(this.budgets.values())));
    } catch (error) {
      logger.warn('保存成本管理数据失败:', error);
    }
  }

  public exportData(): { costRecords: CostRecord[], budgets: Budget[] } {
    return {
      costRecords: Array.from(this.costRecords.values()),
      budgets: Array.from(this.budgets.values())
    };
  }

  public importData(data: { costRecords: CostRecord[], budgets: Budget[] }): void {
    data.costRecords.forEach(record => this.costRecords.set(record.id, record));
    data.budgets.forEach(budget => this.budgets.set(budget.id, budget));
    this.saveToStorage();
    logger.info('成本管理系统数据导入完成');
  }

  public clearAllData(): void {
    this.costRecords.clear();
    this.budgets.clear();
    this.saveToStorage();
    logger.info('成本管理系统数据已清空');
  }
}

export const costManagementSystem = CostManagementSystem.getInstance();
export default CostManagementSystem;
