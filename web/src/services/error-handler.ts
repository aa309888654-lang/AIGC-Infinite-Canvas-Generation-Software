/**
 * 错误处理和优化系统
 */

import { generateId } from '@/lib/utils';

// 错误类型
export type ErrorType = 
  | 'api_error'
  | 'network_error'
  | 'validation_error'
  | 'authentication_error'
  | 'rate_limit_error'
  | 'timeout_error'
  | 'storage_error'
  | 'unknown_error';

// 错误级别
export type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';

// 详细错误信息
export interface DetailedError {
  id: string;
  type: ErrorType;
  level: ErrorLevel;
  message: string;
  originalError?: string;
  solution: string;
  timestamp: Date;
  context?: Record<string, any>;
  nodeId?: string;
  retryable: boolean;
  helpUrl?: string;
}

// 错误模式
const ERROR_PATTERNS: Record<ErrorType, {
  message: string;
  solution: string;
  helpUrl?: string;
  retryable: boolean;
}> = {
  api_error: {
    message: 'API调用失败',
    solution: '请检查API密钥是否正确配置，或稍后重试。如果问题持续存在，请查看API服务状态页面。',
    helpUrl: 'https://help.example.com/api-errors',
    retryable: true
  },
  network_error: {
    message: '网络连接失败',
    solution: '请检查您的网络连接，确保可以访问外部服务。也可以尝试更换网络环境。',
    helpUrl: 'https://help.example.com/network',
    retryable: true
  },
  validation_error: {
    message: '参数验证失败',
    solution: '请检查输入的参数是否符合要求，包括提示词长度、格式等。',
    helpUrl: 'https://help.example.com/validation',
    retryable: false
  },
  authentication_error: {
    message: '认证失败',
    solution: '请检查您的API密钥是否正确，以及是否具有相应的权限。可以尝试重新配置API密钥。',
    helpUrl: 'https://help.example.com/auth',
    retryable: true
  },
  rate_limit_error: {
    message: '请求频率超限',
    solution: '您已达到API调用频率限制。请等待一段时间后再试，或升级您的API套餐以获得更高的限制。',
    helpUrl: 'https://help.example.com/rate-limit',
    retryable: true
  },
  timeout_error: {
    message: '请求超时',
    solution: 'API响应时间过长。请稍后重试，如果问题持续出现，可能是服务负载较高。',
    helpUrl: 'https://help.example.com/timeout',
    retryable: true
  },
  storage_error: {
    message: '存储操作失败',
    solution: '存储空间可能已满或出现异常。请检查存储空间，或尝试刷新页面。',
    helpUrl: 'https://help.example.com/storage',
    retryable: true
  },
  unknown_error: {
    message: '发生未知错误',
    solution: '发生了意外错误。请尝试刷新页面或重新启动应用。如果问题持续，请联系技术支持。',
    helpUrl: 'https://help.example.com/support',
    retryable: true
  }
};

// 错误级别定义
const ERROR_LEVELS: Record<ErrorLevel, string> = {
  info: '提示',
  warning: '警告',
  error: '错误',
  critical: '严重'
};

// 错误处理器
class ErrorHandler {
  private static instance: ErrorHandler;
  
  private errors: DetailedError[] = [];
  private maxErrors: number = 100;
  private listeners: Set<(error: DetailedError) => void> = new Set();
  
  private constructor() { /* no-op */ }
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  // 处理错误
  handleError(
    error: Error | string,
    _type: ErrorType = 'unknown_error',
    context?: Record<string, any>
  ): DetailedError {
    const errorMessage = error instanceof Error ? error.message : error;
    
    // 根据错误消息自动判断类型
    const detectedType = this.detectErrorType(errorMessage);
    const pattern = ERROR_PATTERNS[detectedType];
    
    const detailedError: DetailedError = {
      id: generateId(),
      type: detectedType,
      level: this.determineLevel(detectedType, errorMessage),
      message: pattern.message,
      originalError: errorMessage,
      solution: pattern.solution,
      timestamp: new Date(),
      context,
      nodeId: context?.nodeId,
      retryable: pattern.retryable,
      helpUrl: pattern.helpUrl
    };
    
    this.errors.unshift(detailedError);
    
    // 限制错误数量
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }
    
    // 通知监听器
    this.listeners.forEach(listener => listener(detailedError));
    
    // 控制台输出
    console.error(`[${ERROR_LEVELS[detailedError.level]}] ${detailedError.message}:`, errorMessage);
    
    return detailedError;
  }
  
  // 自动检测错误类型
  private detectErrorType(errorMessage: string): ErrorType {
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('api key') || lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized')) {
      return 'authentication_error';
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many request')) {
      return 'rate_limit_error';
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
      return 'network_error';
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'timeout_error';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || lowerMessage.includes('parameter')) {
      return 'validation_error';
    }
    if (lowerMessage.includes('storage') || lowerMessage.includes('disk') || lowerMessage.includes('space')) {
      return 'storage_error';
    }
    if (lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503')) {
      return 'api_error';
    }
    
    return 'unknown_error';
  }
  
  // 确定错误级别
  private determineLevel(type: ErrorType, message: string): ErrorLevel {
    const _lowerMessage = message.toLowerCase();
    
    switch (type) {
      case 'authentication_error':
      case 'rate_limit_error':
        return 'warning';
      case 'network_error':
      case 'timeout_error':
        return 'info';
      case 'validation_error':
        return 'warning';
      case 'storage_error':
        return 'error';
      default:
        return 'error';
    }
  }
  
  // 获取错误列表
  getErrors(filter?: {
    type?: ErrorType;
    level?: ErrorLevel;
    nodeId?: string;
  }): DetailedError[] {
    let result = [...this.errors];
    
    if (filter) {
      if (filter.type) {
        result = result.filter(e => e.type === filter.type);
      }
      if (filter.level) {
        result = result.filter(e => e.level === filter.level);
      }
      if (filter.nodeId) {
        result = result.filter(e => e.nodeId === filter.nodeId);
      }
    }
    
    return result;
  }
  
  // 获取错误统计
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    byLevel: Record<ErrorLevel, number>;
    retryable: number;
  } {
    const byType = {} as Record<ErrorType, number>;
    const byLevel = {} as Record<ErrorLevel, number>;
    let retryable = 0;
    
    this.errors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      byLevel[error.level] = (byLevel[error.level] || 0) + 1;
      if (error.retryable) retryable++;
    });
    
    return {
      total: this.errors.length,
      byType,
      byLevel,
      retryable
    };
  }
  
  // 清除错误
  clearErrors(nodeId?: string): void {
    if (nodeId) {
      this.errors = this.errors.filter(e => e.nodeId !== nodeId);
    } else {
      this.errors = [];
    }
  }
  
  // 订阅错误
  onError(listener: (error: DetailedError) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  // 获取错误详情
  getErrorDetail(errorId: string): DetailedError | undefined {
    return this.errors.find(e => e.id === errorId);
  }
  
  // 格式化错误显示
  formatErrorForDisplay(error: DetailedError): string {
    return `
 ├─ ${ERROR_LEVELS[error.level]} ─────────────────
 │ ${error.message}
 ├─ 详细原因 ─────────────────
 │ ${error.originalError}
 ├─ 解决方案 ─────────────────
 │ ${error.solution}
 ${error.helpUrl ? `├─ 了解更多 ─────────────────
│ ${error.helpUrl}` : ''}
 └─ 时间 ─────────────────
 │ ${error.timestamp.toLocaleString()}
    `.trim();
  }
}

export const errorHandler = ErrorHandler.getInstance();