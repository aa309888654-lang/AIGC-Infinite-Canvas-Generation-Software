/**
 * 优化历史相关类型定义
 */

import type { OptimizationModeType } from './optimization';

/** 优化历史记录 */
export interface OptimizationHistoryRecord {
  /** 记录ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 优化模式 */
  mode: OptimizationModeType;
  /** 原始提示词 */
  originalPrompt: string;
  /** 优化后提示词 */
  optimizedPrompt: string;
  /** 中间结果 */
  intermediateResults?: OptimizationStage[];
  /** 元数据 */
  metadata: OptimizationMetadata;
  /** 版本号 */
  version: number;
  /** 父版本ID（用于版本树） */
  parentId?: string;
}

/** 优化阶段结果 */
export interface OptimizationStage {
  /** 阶段名称 */
  name: string;
  /** 阶段描述 */
  description: string;
  /** 输入内容 */
  input: string;
  /** 输出内容 */
  output: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 持续时间（毫秒） */
  duration?: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/** 优化元数据 */
export interface OptimizationMetadata {
  /** 总耗时（毫秒） */
  duration: number;
  /** 是否成功 */
  success: boolean;
  /** 错误消息 */
  errorMessage?: string;
  /** Token使用量 */
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 质量评分 */
  qualityScore?: {
    before: number;
    after: number;
    improvement: number;
  };
  /** 使用的模型 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
}

/** 版本比较结果 */
export interface VersionComparison {
  /** 版本1 ID */
  version1Id: string;
  /** 版本2 ID */
  version2Id: string;
  /** 版本1 */
  version1: OptimizationHistoryRecord;
  /** 版本2 */
  version2: OptimizationHistoryRecord;
  /** 文本差异 */
  textDiff: TextDiff[];
  /** 统计信息 */
  statistics: VersionStatistics;
  /** 差异摘要 */
  summary: string;
}

/** 文本差异 */
export interface TextDiff {
  /** 差异类型 */
  type: 'added' | 'removed' | 'unchanged';
  /** 内容 */
  content: string;
  /** 位置 */
  position: {
    start: number;
    end: number;
  };
}

/** 版本统计信息 */
export interface VersionStatistics {
  /** 版本1长度 */
  version1Length: number;
  /** 版本2长度 */
  version2Length: number;
  /** 长度变化 */
  lengthChange: number;
  /** 新增词数 */
  addedWords: number;
  /** 删除词数 */
  removedWords: number;
  /** 相似度 */
  similarity: number;
}

/** 历史过滤器 */
export interface HistoryFilter {
  /** 模式筛选 */
  mode?: OptimizationModeType;
  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };
  /** 成功/失败筛选 */
  successOnly?: boolean;
  /** 搜索关键词 */
  searchKeyword?: string;
}

/** 版本标签 */
export interface VersionTag {
  /** 标签ID */
  id: string;
  /** 标签名称 */
  name: string;
  /** 标签颜色 */
  color: string;
  /** 关联的版本ID */
  versionIds: string[];
  /** 创建时间 */
  createdAt: number;
}

/** 预定义标签颜色 */
export const VERSION_TAG_COLORS = [
  '#EF4444', // 红色
  '#F59E0B', // 橙色
  '#10B981', // 绿色
  '#9CA3AF', // 蓝色
  '#8B5CF6', // 紫色
  '#EC4899', // 粉色
] as const;
