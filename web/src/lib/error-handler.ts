import { generateId } from '@/lib/utils';

export enum AppErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export type ErrorType =
  | 'api_error'
  | 'network_error'
  | 'validation_error'
  | 'authentication_error'
  | 'rate_limit_error'
  | 'timeout_error'
  | 'storage_error'
  | 'unknown_error';

export type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';

export interface DetailedError {
  id: string;
  type: ErrorType;
  level: ErrorLevel;
  message: string;
  originalError?: string;
  solution: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  nodeId?: string;
  retryable: boolean;
  helpUrl?: string;
}

export class AppError extends Error {
  constructor(
    public type: AppErrorType,
    message: string,
    public originalError?: unknown,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const ERROR_PATTERNS: Record<ErrorType, {
  message: string;
  solution: string;
  helpUrl?: string;
  retryable: boolean;
}> = {
  api_error: {
    message: 'API调用失败',
    solution: '请检查API密钥是否正确配置，或稍后重试。如果问题持续存在，请查看API服务状态页面。',
    retryable: true,
  },
  network_error: {
    message: '网络连接失败',
    solution: '请检查您的网络连接，确保可以访问外部服务。也可以尝试更换网络环境。',
    retryable: true,
  },
  validation_error: {
    message: '参数验证失败',
    solution: '请检查输入的参数是否符合要求，包括提示词长度、格式等。',
    retryable: false,
  },
  authentication_error: {
    message: '认证失败',
    solution: '请检查您的API密钥是否正确，以及是否具有相应的权限。可以尝试重新配置API密钥。',
    retryable: true,
  },
  rate_limit_error: {
    message: '请求频率超限',
    solution: '您已达到API调用频率限制。请等待一段时间后再试，或升级您的API套餐以获得更高的限制。',
    retryable: true,
  },
  timeout_error: {
    message: '请求超时',
    solution: 'API响应时间过长。请稍后重试，如果问题持续出现，可能是服务负载较高。',
    retryable: true,
  },
  storage_error: {
    message: '存储操作失败',
    solution: '存储空间可能已满或出现异常。请检查存储空间，或尝试刷新页面。',
    retryable: true,
  },
  unknown_error: {
    message: '发生未知错误',
    solution: '发生了意外错误。请尝试刷新页面或重新启动应用。如果问题持续，请联系技术支持。',
    retryable: true,
  },
};

const ERROR_LEVELS: Record<ErrorLevel, string> = {
  info: '提示',
  warning: '警告',
  error: '错误',
  critical: '严重',
};

class ErrorHandler {
  private static instance: ErrorHandler;

  private errors: DetailedError[] = [];
  private maxErrors: number = 100;
  private listeners: Set<(error: DetailedError) => void> = new Set();

  private constructor() { /* noop */ }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handleError(
    error: Error | string,
    _type: ErrorType = 'unknown_error',
    context?: Record<string, unknown>,
  ): DetailedError {
    const errorMessage = error instanceof Error ? error.message : error;
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
      nodeId: context?.nodeId as string | undefined,
      retryable: pattern.retryable,
      helpUrl: pattern.helpUrl,
    };

    this.errors.unshift(detailedError);

    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    this.listeners.forEach((listener) => listener(detailedError));

    console.error(`[${ERROR_LEVELS[detailedError.level]}] ${detailedError.message}:`, errorMessage);

    return detailedError;
  }

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

  private determineLevel(type: ErrorType, _message: string): ErrorLevel {
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

  getErrors(filter?: { type?: ErrorType; level?: ErrorLevel; nodeId?: string }): DetailedError[] {
    let result = [...this.errors];

    if (filter) {
      if (filter.type) {
        result = result.filter((e) => e.type === filter.type);
      }
      if (filter.level) {
        result = result.filter((e) => e.level === filter.level);
      }
      if (filter.nodeId) {
        result = result.filter((e) => e.nodeId === filter.nodeId);
      }
    }

    return result;
  }

  getErrorStats(): { total: number; byType: Record<string, number>; byLevel: Record<string, number>; retryable: number } {
    const byType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    let retryable = 0;

    this.errors.forEach((error) => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      byLevel[error.level] = (byLevel[error.level] || 0) + 1;
      if (error.retryable) retryable++;
    });

    return { total: this.errors.length, byType, byLevel, retryable };
  }

  clearErrors(nodeId?: string): void {
    if (nodeId) {
      this.errors = this.errors.filter((e) => e.nodeId !== nodeId);
    } else {
      this.errors = [];
    }
  }

  onError(listener: (error: DetailedError) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getErrorDetail(errorId: string): DetailedError | undefined {
    return this.errors.find((e) => e.id === errorId);
  }

  formatErrorForDisplay(error: DetailedError): string {
    return [
      `├─ ${ERROR_LEVELS[error.level]} ─────────────────`,
      `│ ${error.message}`,
      `├─ 详细原因 ─────────────────`,
      `│ ${error.originalError}`,
      `├─ 解决方案 ─────────────────`,
      `│ ${error.solution}`,
      error.helpUrl ? `├─ 了解更多 ─────────────────\n│ ${error.helpUrl}` : '',
      `└─ 时间 ─────────────────`,
      `│ ${error.timestamp.toLocaleString()}`,
    ].join('\n').trim();
  }
}

export const errorHandler = ErrorHandler.getInstance();
