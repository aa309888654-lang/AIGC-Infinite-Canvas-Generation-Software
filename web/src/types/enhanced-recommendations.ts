/**
 * 增强型推荐相关类型定义
 */

import type { QualitySuggestion } from '@/services/PromptService';

/** 推荐类型 */
export type RecommendationType = 
  | 'similar'           // 相似推荐
  | 'improvement'       // 改进建议
  | 'style_variation'   // 风格变体
  | 'completion';       // 补全推荐

/** 推荐来源 */
export type RecommendationSource = 
  | 'qdrant'           // Qdrant向量数据库
  | 'openai'           // OpenAI GPT
  | 'minimax'          // MiniMax模型
  | 'user_history';     // 用户历史

/** 推荐项目 */
export interface RecommendationItem {
  /** 推荐ID */
  id: string;
  /** 推荐类型 */
  type: RecommendationType;
  /** 来源 */
  source: RecommendationSource;
  /** 内容 */
  content: string;
  /** 描述 */
  description?: string;
  /** 相似度/置信度 */
  score: number; // 0-100
  /** 标签 */
  tags?: string[];
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: number;
  /** 是否已应用 */
  applied?: boolean;
  /** 预览图片 */
  thumbnailUrl?: string;
}

/** 推荐分组 */
export interface RecommendationGroup {
  /** 分组ID */
  id: string;
  /** 分组名称 */
  name: string;
  /** 分组类型 */
  type: RecommendationType;
  /** 推荐列表 */
  items: RecommendationItem[];
  /** 统计信息 */
  stats: {
    totalCount: number;
    averageScore: number;
    topScore: number;
  };
}

/** 推荐配置 */
export interface RecommendationConfig {
  /** 最大推荐数量 */
  maxRecommendations: number;
  /** 最小相似度阈值 */
  minSimilarityScore: number;
  /** 是否启用分组 */
  enableGrouping: boolean;
  /** 是否显示来源 */
  showSource: boolean;
  /** 是否显示分数 */
  showScore: boolean;
  /** 是否启用预览 */
  enablePreview: boolean;
  /** 自动刷新间隔（毫秒） */
  autoRefreshInterval?: number;
}

/** 推荐过滤器 */
export interface RecommendationFilter {
  /** 类型筛选 */
  types?: RecommendationType[];
  /** 来源筛选 */
  sources?: RecommendationSource[];
  /** 最小分数 */
  minScore?: number;
  /** 标签筛选 */
  tags?: string[];
  /** 搜索关键词 */
  searchKeyword?: string;
}

/** 默认配置 */
export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  maxRecommendations: 10,
  minSimilarityScore: 60,
  enableGrouping: true,
  showSource: true,
  showScore: true,
  enablePreview: false,
  autoRefreshInterval: 30000,
};

/** 推荐来源映射 */
export const RECOMMENDATION_SOURCE_LABELS: Record<RecommendationSource, string> = {
  qdrant: '向量数据库',
  openai: 'OpenAI',
  minimax: 'MiniMax',
  user_history: '用户历史',
};

/** 推荐类型映射 */
export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  similar: '相似推荐',
  improvement: '改进建议',
  style_variation: '风格变体',
  completion: '补全推荐',
};

/** 质量建议转换 */
export function qualitySuggestionToRecommendation(
  suggestion: QualitySuggestion,
  source: RecommendationSource = 'qdrant'
): RecommendationItem {
  return {
    id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: suggestion.type as RecommendationType || 'improvement',
    source,
    content: suggestion.suggestion,
    description: suggestion.reason,
    score: suggestion.impact * 100,
    tags: suggestion.category ? [suggestion.category] : undefined,
    createdAt: Date.now(),
  };
}
