/**
 * 错误处理工具
 * 提供统一的错误处理和日志记录功能
 */

import { ErrorHandler, WorkflowErrorType } from '@/store/error-handler';
import { isViteDevMode } from '@/lib/vite-env';
import React from 'react';

// 错误类型映射
const _ERROR_TYPE_MAP: Record<string, WorkflowErrorType> = {
  ValidationError: 'validation',
  NetworkError: 'connection',
  TimeoutError: 'timeout',
  APIError: 'api',
  ExecutionError: 'execution',
};

// 预编译正则表达式 - 避免重复编译提升性能
const API_KEY_REGEX = /api[-_]?key[=:]?\s*['"]?[a-zA-Z0-9]+['"]?/gi;
const AUTH_TOKEN_REGEX = /authorization[:=]\s*['"]?[^'"]+['"]?/gi;
const SENSITIVE_PARAM_REGEX = /[?&](key|token|secret)=[^&\s]*/gi;

/**
 * 安全的错误信息提取
 * 避免暴露敏感信息
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // 移除可能包含敏感信息的部分
    let message = error.message;
    
    // 移除API密钥信息 - 使用预编译正则
    message = message.replace(API_KEY_REGEX, '[API_KEY]');
    
    // 移除认证信息
    message = message.replace(AUTH_TOKEN_REGEX, '[AUTH_TOKEN]');
    
    // 移除URL中的敏感参数
    message = message.replace(SENSITIVE_PARAM_REGEX, '[SENSITIVE_PARAM]');
    
    return message;
  }
  
  return '发生未知错误';
}

/**
 * 统一的错误处理函数
 */
export function handleError(
  error: unknown,
  type: WorkflowErrorType = 'unknown',
  nodeId?: string,
  details?: Record<string, unknown>
): void {
  const sanitizedMessage = sanitizeErrorMessage(error);
  
  // 记录到错误处理器
  const errorHandler = ErrorHandler.getInstance();
  errorHandler.addError({
    type,
    message: sanitizedMessage,
    nodeId,
    details: {
      ...details,
      originalError: error instanceof Error ? error.name : String(error),
    },
  });
  
  // 开发环境输出详细错误信息
  if (isViteDevMode()) {
    console.error('[Error]', {
      type,
      message: sanitizedMessage,
      nodeId,
      originalError: error,
    });
  }
}

/**
 * 包装异步函数，提供统一的错误处理
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<any>>(
  fn: T,
  errorType: WorkflowErrorType = 'execution',
  nodeId?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, errorType, nodeId, { function: fn.name });
      throw error;
    }
  }) as T;
}

/**
 * 创建错误边界包装器
 */
export function createErrorBoundary<_T>(
  componentName: string,
  fallbackRender?: (error: Error) => React.ReactNode
) {
  return class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
    state = { hasError: false, error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      handleError(error, 'execution', undefined, {
        component: componentName,
        errorInfo: errorInfo.componentStack,
      });
    }

    render() {
      if (this.state.hasError && this.state.error) {
        return fallbackRender ? fallbackRender(this.state.error) : (
          <div className="error-fallback">
            <h3>组件加载失败</h3>
            <p>{sanitizeErrorMessage(this.state.error)}</p>
          </div>
        );
      }

      return this.props.children;
    }
  };
}

/**
 * 验证函数包装器
 */
export function createValidator<T>(
  schema: (data: T) => { valid: boolean; error?: string },
  errorType: WorkflowErrorType = 'validation'
) {
  return (data: T): T => {
    const result = schema(data);
    if (!result.valid) {
      const error = new Error(result.error || '验证失败');
      handleError(error, errorType, undefined, { data });
      throw error;
    }
    return data;
  };
}
