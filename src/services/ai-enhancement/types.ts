/**
 * AI生成增强系统类型定义
 */

// ==================== 生成结果 ====================
export interface GenerationResult {
  id: string;
  timestamp: Date;
  imageUrl?: string;
  videoUrl?: string;
  prompt: string;
  negativePrompt?: string;
  parameters: Record<string, unknown>;
  modelProvider: string;
  modelName: string;
  qualityScore?: number;
  tags: string[];
  isFavorite: boolean;
}

// ==================== 参数变更 ====================
export interface ParameterChange {
  id: string;
  timestamp: Date;
  parameterName: string;
  oldValue: unknown;
  newValue: unknown;
  generationId?: string;
}

// ==================== 提示词建议 ====================
export interface PromptSuggestion {
  id: string;
  originalPrompt: string;
  suggestedPrompt: string;
  reason: string;
  confidence: number;
  tags: string[];
}

// ==================== 参数测试配置 ====================
export interface ParameterTestConfig {
  id: string;
  name: string;
  baseParameters: Record<string, unknown>;
  variableParameters: Record<string, unknown[]>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: GenerationResult[];
  createdAt: Date;
}

// ==================== 质量评分 ====================
export interface QualityScore {
  id: string;
  generationId: string;
  overallScore: number;
  dimensions: {
    composition: number;
    lighting: number;
    color: number;
    detail: number;
    creativity: number;
  };
  aiFeedback: string;
  timestamp: Date;
}

// ==================== 增强配置 ====================
export interface EnhancementConfig {
  enableAutoCompare: boolean;
  enableParameterTracking: boolean;
  enablePromptOptimization: boolean;
  enableBatchTesting: boolean;
  enableQualityScoring: boolean;
  maxHistoryItems: number;
  autoSaveResults: boolean;
}

export interface SavedPrompt {
  id: string;
  original: string;
  optimized: string;
  category: string;
  createdAt: Date;
  usageCount: number;
  isFavorite?: boolean;
}

export interface PromptHistoryRecord {
  id: string;
  originalPrompt: string;
  optimizedPrompt: string;
  timestamp: Date;
  category: string;
  qualityScore?: number;
}
