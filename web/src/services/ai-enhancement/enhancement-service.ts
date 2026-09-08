/**
 * AI生成增强服务核心实现
 */

import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';
import {
  GenerationResult,
  ParameterChange,
  PromptSuggestion,
  ParameterTestConfig,
  QualityScore,
  EnhancementConfig,
  SavedPrompt,
  PromptHistoryRecord
} from './types';

// ==================== AI生成增强服务 ====================
class AIGenerationEnhancementService {
  private static instance: AIGenerationEnhancementService;

  // 存储
  private generationResults: Map<string, GenerationResult> = new Map();
  private parameterChanges: Map<string, ParameterChange> = new Map();
  private promptSuggestions: Map<string, PromptSuggestion> = new Map();
  private parameterTestConfigs: Map<string, ParameterTestConfig> = new Map();
  private qualityScores: Map<string, QualityScore> = new Map();
  private savedPrompts: Map<string, SavedPrompt> = new Map();
  private promptHistory: Map<string, PromptHistoryRecord> = new Map();

  // 配置
  private config: EnhancementConfig = {
    enableAutoCompare: true,
    enableParameterTracking: true,
    enablePromptOptimization: true,
    enableBatchTesting: true,
    enableQualityScoring: true,
    maxHistoryItems: 100,
    autoSaveResults: true
  };

  static getInstance(): AIGenerationEnhancementService {
    if (!AIGenerationEnhancementService.instance) {
      AIGenerationEnhancementService.instance = new AIGenerationEnhancementService();
    }
    return AIGenerationEnhancementService.instance;
  }

  constructor() {
    this.loadFromStorage();
  }

  // ==================== 生成结果管理 ====================

  addGenerationResult(result: Omit<GenerationResult, 'id' | 'timestamp' | 'isFavorite' | 'tags'>): GenerationResult {
    const generation: GenerationResult = {
      id: generateId(),
      timestamp: new Date(),
      isFavorite: false,
      tags: [],
      ...result
    };

    this.generationResults.set(generation.id, generation);
    this.persistToStorage();
    return generation;
  }

  getGenerationResult(id: string): GenerationResult | undefined {
    return this.generationResults.get(id);
  }

  getAllGenerationResults(): GenerationResult[] {
    return Array.from(this.generationResults.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  updateGenerationResult(id: string, updates: Partial<GenerationResult>): void {
    const result = this.generationResults.get(id);
    if (result) {
      this.generationResults.set(id, { ...result, ...updates });
      this.persistToStorage();
    }
  }

  deleteGenerationResult(id: string): void {
    this.generationResults.delete(id);
    this.persistToStorage();
  }

  toggleFavorite(id: string): void {
    const result = this.generationResults.get(id);
    if (result) {
      result.isFavorite = !result.isFavorite;
      this.persistToStorage();
    }
  }

  addTagToResult(id: string, tag: string): void {
    const result = this.generationResults.get(id);
    if (result && !result.tags.includes(tag)) {
      result.tags.push(tag);
      this.persistToStorage();
    }
  }

  // ==================== 提示词历史管理 ====================

  savePromptHistory(original: string, optimized: string, category: string, qualityScore?: number): PromptHistoryRecord {
    const record: PromptHistoryRecord = {
      id: generateId(),
      originalPrompt: original,
      optimizedPrompt: optimized,
      timestamp: new Date(),
      category,
      qualityScore
    };

    this.promptHistory.set(record.id, record);
    
    // 限制历史记录数量
    if (this.promptHistory.size > this.config.maxHistoryItems) {
      const oldestKey = Array.from(this.promptHistory.keys())[0];
      this.promptHistory.delete(oldestKey);
    }
    
    this.persistToStorage();
    return record;
  }

  getPromptHistory(): PromptHistoryRecord[] {
    return Array.from(this.promptHistory.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  clearPromptHistory(): void {
    this.promptHistory.clear();
    this.persistToStorage();
  }

  // ==================== 保存的提示词管理 ====================

  saveOptimizedPrompt(original: string, optimized: string, category: string): SavedPrompt {
    const saved: SavedPrompt = {
      id: generateId(),
      original,
      optimized,
      category,
      createdAt: new Date(),
      usageCount: 0,
      isFavorite: false
    };
    this.savedPrompts.set(saved.id, saved);
    this.persistToStorage();
    return saved;
  }

  getSavedPrompts(): SavedPrompt[] {
    return Array.from(this.savedPrompts.values())
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  getFavoritePrompts(): SavedPrompt[] {
    return this.getSavedPrompts().filter(p => p.isFavorite);
  }

  useSavedPrompt(id: string): SavedPrompt | undefined {
    const prompt = this.savedPrompts.get(id);
    if (prompt) {
      prompt.usageCount++;
      this.persistToStorage();
    }
    return prompt;
  }

  togglePromptFavorite(id: string): void {
    const prompt = this.savedPrompts.get(id);
    if (prompt) {
      prompt.isFavorite = !prompt.isFavorite;
      this.persistToStorage();
    }
  }

  deleteSavedPrompt(id: string): void {
    this.savedPrompts.delete(id);
    this.persistToStorage();
  }

  // ==================== 参数变更追踪 ====================

  trackParameterChange(change: Omit<ParameterChange, 'id' | 'timestamp'>): ParameterChange {
    const paramChange: ParameterChange = {
      id: generateId(),
      timestamp: new Date(),
      ...change
    };

    this.parameterChanges.set(paramChange.id, paramChange);
    this.persistToStorage();
    return paramChange;
  }

  getParameterChanges(): ParameterChange[] {
    return Array.from(this.parameterChanges.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getParameterChangesByGeneration(generationId: string): ParameterChange[] {
    return this.getParameterChanges().filter(change => change.generationId === generationId);
  }

  // ==================== 提示词优化 ====================

  generatePromptSuggestions(prompt: string): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];

    // 简单的提示词优化逻辑
    if (!prompt.includes('，') && !prompt.includes(',')) {
      suggestions.push({
        id: generateId(),
        originalPrompt: prompt,
        suggestedPrompt: prompt + '，细节丰富，光影效果优秀',
        reason: '添加中文逗号分隔和细节描述',
        confidence: 0.85,
        tags: ['detail', 'lighting']
      });
    }

    if (!prompt.toLowerCase().includes('high quality')) {
      suggestions.push({
        id: generateId(),
        originalPrompt: prompt,
        suggestedPrompt: prompt + ', high quality, 4K, professional',
        reason: '添加质量描述词',
        confidence: 0.9,
        tags: ['quality']
      });
    }

    if (!prompt.includes('style')) {
      suggestions.push({
        id: generateId(),
        originalPrompt: prompt,
        suggestedPrompt: prompt + ', cinematic style',
        reason: '添加风格描述',
        confidence: 0.75,
        tags: ['style']
      });
    }

    suggestions.forEach(s => {
      this.promptSuggestions.set(s.id, s);
    });

    this.persistToStorage();
    return suggestions;
  }

  getPromptSuggestions(): PromptSuggestion[] {
    return Array.from(this.promptSuggestions.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  // ==================== 质量评分 ====================

  generateQualityScore(generationId: string): QualityScore {
    const generation = this.generationResults.get(generationId);
    if (!generation) {
      throw new Error('Generation result not found');
    }

    // 简单的质量评分逻辑
    const dimensions = {
      composition: Math.random() * 20 + 80,
      lighting: Math.random() * 20 + 80,
      color: Math.random() * 20 + 80,
      detail: Math.random() * 20 + 80,
      creativity: Math.random() * 20 + 80
    };

    const overallScore = Math.round(
      (dimensions.composition + dimensions.lighting + dimensions.color + 
       dimensions.detail + dimensions.creativity) / 5
    );

    const score: QualityScore = {
      id: generateId(),
      generationId,
      overallScore,
      dimensions,
      aiFeedback: this.generateFeedback(overallScore),
      timestamp: new Date()
    };

    this.qualityScores.set(score.id, score);
    
    // 更新生成结果的质量分数
    this.updateGenerationResult(generationId, { qualityScore: overallScore });
    
    this.persistToStorage();
    return score;
  }

  private generateFeedback(score: number): string {
    if (score >= 90) return '优秀！作品质量很高，各方面表现均衡';
    if (score >= 80) return '良好，作品质量不错，可以进一步优化细节';
    if (score >= 70) return '中等，建议改进构图或增加细节';
    return '需要改进，建议调整参数或优化提示词';
  }

  getQualityScores(): QualityScore[] {
    return Array.from(this.qualityScores.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getQualityScoreByGeneration(generationId: string): QualityScore | undefined {
    return this.getQualityScores().find(score => score.generationId === generationId);
  }

  // ==================== 批量测试 ====================

  createParameterTest(test: Omit<ParameterTestConfig, 'id' | 'status' | 'results' | 'createdAt'>): ParameterTestConfig {
    const config: ParameterTestConfig = {
      id: generateId(),
      status: 'pending',
      results: [],
      createdAt: new Date(),
      ...test
    };

    this.parameterTestConfigs.set(config.id, config);
    this.persistToStorage();
    return config;
  }

  updateParameterTest(id: string, updates: Partial<ParameterTestConfig>): void {
    const test = this.parameterTestConfigs.get(id);
    if (test) {
      this.parameterTestConfigs.set(id, { ...test, ...updates });
      this.persistToStorage();
    }
  }

  getParameterTests(): ParameterTestConfig[] {
    return Array.from(this.parameterTestConfigs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==================== 数据持久化 ====================

  private persistToStorage(): void {
    if (!this.config.autoSaveResults) return;

    try {
      const data = {
        generationResults: Array.from(this.generationResults.entries()),
        parameterChanges: Array.from(this.parameterChanges.entries()),
        promptSuggestions: Array.from(this.promptSuggestions.entries()),
        parameterTests: Array.from(this.parameterTestConfigs.entries()),
        qualityScores: Array.from(this.qualityScores.entries()),
        savedPrompts: Array.from(this.savedPrompts.entries()),
        promptHistory: Array.from(this.promptHistory.entries())
      };

      localStorage.setItem('ai-enhancement-data', JSON.stringify(data));
    } catch (error) {
      logger.error('[AIGenerationEnhancement] Failed to persist data:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const dataStr = localStorage.getItem('ai-enhancement-data');
      if (!dataStr) return;

      const data = JSON.parse(dataStr);
      
      if (data.generationResults) {
        this.generationResults = new Map(data.generationResults);
      }
      if (data.parameterChanges) {
        this.parameterChanges = new Map(data.parameterChanges);
      }
      if (data.promptSuggestions) {
        this.promptSuggestions = new Map(data.promptSuggestions);
      }
      if (data.parameterTests) {
        this.parameterTestConfigs = new Map(data.parameterTests);
      }
      if (data.qualityScores) {
        this.qualityScores = new Map(data.qualityScores);
      }
      if (data.savedPrompts) {
        this.savedPrompts = new Map(data.savedPrompts);
      }
      if (data.promptHistory) {
        this.promptHistory = new Map(data.promptHistory);
      }
    } catch (error) {
      logger.error('[AIGenerationEnhancement] Failed to load data:', error);
    }
  }

  // ==================== 清理和重置 ====================

  clearAllData(): void {
    this.generationResults.clear();
    this.parameterChanges.clear();
    this.promptSuggestions.clear();
    this.parameterTestConfigs.clear();
    this.qualityScores.clear();
    localStorage.removeItem('ai-enhancement-data');
  }

  setConfig(config: Partial<EnhancementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): EnhancementConfig {
    return { ...this.config };
  }
}

// ==================== 导出单例 ====================
export const aiEnhancementService = AIGenerationEnhancementService.getInstance();
