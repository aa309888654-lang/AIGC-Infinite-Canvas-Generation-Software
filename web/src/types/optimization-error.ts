/**
 * 优化错误处理相关类型定义
 */

import type { OptimizationModeType } from './optimization';

/** 优化错误类型 */
export type OptimizationErrorType =
  | 'network_error'           // 网络连接失败
  | 'timeout'                 // 请求超时
  | 'api_error'              // API错误
  | 'rate_limit'             // 请求频率限制
  | 'content_filter'          // 内容过滤
  | 'invalid_prompt'          // 无效的提示词
  | 'model_unavailable'       // 模型不可用
  | 'authentication_error'    // 认证错误
  | 'quota_exceeded'         // 配额超限
  | 'unknown_error';         // 未知错误

/** 错误严重程度 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/** 错误恢复策略 */
export type ErrorRecoveryStrategy =
  | 'retry'                  // 重试
  | 'retry_with_longer_timeout'  // 增加超时重试
  | 'fallback'               // 使用降级方案
  | 'queue'                  // 加入队列等待
  | 'skip'                   // 跳过
  | 'abort';                 // 中止

/** 优化错误接口 */
export interface OptimizationError {
  /** 错误类型 */
  type: OptimizationErrorType;
  /** 错误消息 */
  message: string;
  /** 详细描述 */
  description?: string;
  /** 原始错误 */
  originalError?: Error;
  /** 发生时间 */
  timestamp: number;
  /** 严重程度 */
  severity: ErrorSeverity;
  /** 恢复建议 */
  suggestion: string;
  /** 关联的优化模式 */
  relatedMode?: OptimizationModeType;
  /** 错误上下文 */
  context?: Record<string, unknown>;
}

/** 错误处理策略配置 */
export interface ErrorStrategy {
  /** 错误类型 */
  errorType: OptimizationErrorType;
  /** 用户可见的消息 */
  userMessage: string;
  /** 技术详情（用于调试） */
  technicalMessage: string;
  /** 恢复策略 */
  recoveryStrategy: ErrorRecoveryStrategy;
  /** 是否记录日志 */
  shouldLog: boolean;
  /** 是否上报错误 */
  shouldReport: boolean;
  /** 重试次数（如果是可重试错误） */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 降级提示词 */
  fallbackPrompt?: string;
}

/** 错误统计 */
export interface ErrorStatistics {
  /** 错误总数 */
  totalErrors: number;
  /** 按类型分布 */
  errorsByType: Record<OptimizationErrorType, number>;
  /** 最近错误 */
  recentErrors: OptimizationError[];
  /** 错误率 */
  errorRate: number;
  /** 平均恢复时间 */
  averageRecoveryTime: number;
  /** 最常见的错误类型 */
  mostCommonError: OptimizationErrorType;
}

/** 错误恢复记录 */
export interface ErrorRecoveryRecord {
  /** 错误ID */
  errorId: string;
  /** 恢复策略 */
  strategy: ErrorRecoveryStrategy;
  /** 恢复是否成功 */
  success: boolean;
  /** 恢复耗时（毫秒） */
  recoveryTime: number;
  /** 重试次数 */
  retryCount: number;
  /** 最终结果 */
  finalResult?: string;
  /** 错误详情 */
  error: OptimizationError;
}

/** 预定义的错误策略 */
export const ERROR_STRATEGIES: Record<OptimizationErrorType, ErrorStrategy> = {
  network_error: {
    errorType: 'network_error',
    userMessage: '网络连接失败，请检查网络设置',
    technicalMessage: 'Network connection failed',
    recoveryStrategy: 'retry',
    shouldLog: true,
    shouldReport: false,
    maxRetries: 3,
    retryDelay: 1000,
  },
  timeout: {
    errorType: 'timeout',
    userMessage: '请求超时，服务器响应时间过长',
    technicalMessage: 'Request timeout',
    recoveryStrategy: 'retry_with_longer_timeout',
    shouldLog: true,
    shouldReport: false,
    maxRetries: 2,
    retryDelay: 2000,
  },
  api_error: {
    errorType: 'api_error',
    userMessage: 'API服务暂时不可用，请稍后重试',
    technicalMessage: 'API returned error response',
    recoveryStrategy: 'fallback',
    shouldLog: true,
    shouldReport: true,
    fallbackPrompt: '请优化以下提示词，保持专业性：',
  },
  rate_limit: {
    errorType: 'rate_limit',
    userMessage: '请求过于频繁，请稍后再试',
    technicalMessage: 'Rate limit exceeded',
    recoveryStrategy: 'queue',
    shouldLog: true,
    shouldReport: false,
    maxRetries: 5,
    retryDelay: 5000,
  },
  content_filter: {
    errorType: 'content_filter',
    userMessage: '内容可能被过滤，请调整提示词',
    technicalMessage: 'Content filtered by API',
    recoveryStrategy: 'fallback',
    shouldLog: true,
    shouldReport: true,
    fallbackPrompt: '请用更中立的方式描述：',
  },
  invalid_prompt: {
    errorType: 'invalid_prompt',
    userMessage: '提示词格式不正确，请检查输入',
    technicalMessage: 'Invalid prompt format',
    recoveryStrategy: 'skip',
    shouldLog: true,
    shouldReport: false,
  },
  model_unavailable: {
    errorType: 'model_unavailable',
    userMessage: '当前模型不可用，尝试使用备用模型',
    technicalMessage: 'Model is currently unavailable',
    recoveryStrategy: 'fallback',
    shouldLog: true,
    shouldReport: true,
  },
  authentication_error: {
    errorType: 'authentication_error',
    userMessage: '认证失败，请检查API密钥设置',
    technicalMessage: 'Authentication failed',
    recoveryStrategy: 'abort',
    shouldLog: true,
    shouldReport: true,
  },
  quota_exceeded: {
    errorType: 'quota_exceeded',
    userMessage: 'API配额已用尽，请等待或升级套餐',
    technicalMessage: 'API quota exceeded',
    recoveryStrategy: 'queue',
    shouldLog: true,
    shouldReport: true,
    maxRetries: 10,
    retryDelay: 60000,
  },
  unknown_error: {
    errorType: 'unknown_error',
    userMessage: '发生未知错误，请稍后重试',
    technicalMessage: 'Unknown error occurred',
    recoveryStrategy: 'retry',
    shouldLog: true,
    shouldReport: true,
    maxRetries: 2,
    retryDelay: 1000,
  },
};
