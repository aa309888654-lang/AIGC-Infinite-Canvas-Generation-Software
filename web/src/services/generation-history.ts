/**
 * 生成历史和预览对比系统
 */

import { generateId } from '@/lib/utils';

// 生成记录
export interface GenerationRecord {
  id: string;
  nodeId: string;
  type: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  config: GenerationConfig;
  resultUrl?: string;
  thumbnailUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  duration?: number; // 毫秒
  metadata?: Record<string, unknown>;
}

// 生成配置
export interface GenerationConfig {
  modelProvider: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  quality?: string;
  seed?: number;
  steps?: number;
  cfgScale?: number;
}

// 历史记录管理器
class GenerationHistoryManager {
  private static instance: GenerationHistoryManager;
  
  private records: GenerationRecord[] = [];
  private maxRecords: number = 100;
  private storageKey: string = 'generation-history';
  
  private constructor() {
    this.loadFromStorage();
  }
  
  static getInstance(): GenerationHistoryManager {
    if (!GenerationHistoryManager.instance) {
      GenerationHistoryManager.instance = new GenerationHistoryManager();
    }
    return GenerationHistoryManager.instance;
  }
  
  // 添加记录
  addRecord(record: Omit<GenerationRecord, 'id' | 'createdAt'>): string {
    const newRecord: GenerationRecord = {
      ...record,
      id: generateId(),
      createdAt: new Date()
    };
    
    this.records.unshift(newRecord);
    
    // 限制记录数量
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(0, this.maxRecords);
    }
    
    this.saveToStorage();
    return newRecord.id;
  }
  
  // 更新记录
  updateRecord(id: string, updates: Partial<GenerationRecord>): void {
    const index = this.records.findIndex(r => r.id === id);
    if (index !== -1) {
      this.records[index] = { ...this.records[index], ...updates };
      this.saveToStorage();
    }
  }
  
  // 获取记录
  getRecord(id: string): GenerationRecord | undefined {
    return this.records.find(r => r.id === id);
  }
  
  // 获取所有记录
  getRecords(filter?: {
    type?: 'image' | 'video';
    status?: GenerationRecord['status'];
    nodeId?: string;
    fromDate?: Date;
    toDate?: Date;
  }): GenerationRecord[] {
    let result = [...this.records];
    
    if (filter) {
      if (filter.type) {
        result = result.filter(r => r.type === filter.type);
      }
      if (filter.status) {
        result = result.filter(r => r.status === filter.status);
      }
      if (filter.nodeId) {
        result = result.filter(r => r.nodeId === filter.nodeId);
      }
      if (filter.fromDate) {
        result = result.filter(r => r.createdAt >= filter.fromDate!);
      }
      if (filter.toDate) {
        result = result.filter(r => r.createdAt <= filter.toDate!);
      }
    }
    
    return result;
  }
  
  // 删除记录
  deleteRecord(id: string): void {
    this.records = this.records.filter(r => r.id !== id);
    this.saveToStorage();
  }
  
  // 清空历史
  clearHistory(): void {
    this.records = [];
    this.saveToStorage();
  }
  
  // 保存到存储
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.records));
    } catch (e) {
      console.error('保存生成历史失败:', e);
    }
  }
  
  // 从存储加载
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.records = JSON.parse(stored).map((r: GenerationRecord) => ({
          ...r,
          createdAt: new Date(r.createdAt),
          completedAt: r.completedAt ? new Date(r.completedAt) : undefined
        }));
      }
    } catch (e) {
      console.error('加载生成历史失败:', e);
    }
  }
}

export const generationHistoryManager = GenerationHistoryManager.getInstance();

// 生成预览对比组件
export interface ComparisonItem {
  record: GenerationRecord;
  label?: string;
}

export function compareGenerations(items: ComparisonItem[]): {
  differences: Record<string, { old: unknown; new: unknown }>;
  summary: string;
} {
  if (items.length < 2) {
    return { differences: {}, summary: '需要至少2个生成结果进行比较' };
  }
  
  const differences: Record<string, { old: unknown; new: unknown }> = {};
  
  // 比较每个字段
  const fields = ['prompt', 'negativePrompt', 'config', 'duration', 'status'];
  
  fields.forEach(field => {
    const values = items.map(item => item.record[field as keyof GenerationRecord]);
    const uniqueValues = [...new Set(values.map(v => JSON.stringify(v)))];
    
    if (uniqueValues.length > 1) {
      differences[field] = {
        old: values[0],
        new: values[values.length - 1]
      };
    }
  });
  
  return {
    differences,
    summary: `比较了${items.length}个生成结果，发现${Object.keys(differences).length}个差异`
  };
}