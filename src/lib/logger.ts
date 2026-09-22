/**
 * 日志工具
 * 提供环境感知的日志输出，生产环境自动过滤敏感信息
 */

import { isViteDevMode } from '@/lib/vite-env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  /** 是否包含敏感数据 */
  containsSensitive?: boolean;
  /** 数据脱敏字段列表 */
  sensitiveFields?: string[];
}

const SENSITIVE_FIELDS = ['apiKey', 'api_key', 'secret', 'password', 'token', 'access_key', 'secret_key', 'ak', 'sk'];

/**
 * 脱敏处理
 */
function sanitizeData(data: unknown, sensitiveFields: string[] = SENSITIVE_FIELDS): unknown {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    return data;
  }
  
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeData(value, sensitiveFields);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  return data;
}

/**
 * 创建日志函数
 */
function createLogger(level: LogLevel) {
  const isDev = isViteDevMode();
  
  return function log(message: string, data?: unknown, options?: LogOptions): void {
    // 生产环境不输出 debug
    if (level === 'debug' && !isDev) return;
    
    // 敏感数据处理
    let sanitizedData = data;
    if (!isDev && data && options?.containsSensitive) {
      sanitizedData = sanitizeData(data, options.sensitiveFields);
    }
    
    const prefix = `[${level.toUpperCase()}]`;
    
    switch (level) {
      case 'debug':
        isDev && console.debug(prefix, message, sanitizedData); // eslint-disable-line no-console
        break;
      case 'info':
        // console.info(prefix, message, sanitizedData);
        break;
      case 'warn':
        console.warn(prefix, message, sanitizedData);
        break;
      case 'error':
        console.error(prefix, message, sanitizedData);
        break;
    }
  };
}

export const logger = {
  debug: createLogger('debug'),
  info: createLogger('info'),
  warn: createLogger('warn'),
  error: createLogger('error'),
  
  /**
   * 安全日志 - 自动识别敏感数据
   */
  log(message: string, data?: unknown): void {
    const isDev = isViteDevMode();
    
    if (!isDev && data) {
      // console.log(message, sanitizeData(data));
    } else {
      // console.log(message, data);
    }
  },
  
  /**
   * 按分类记录日志
   */
  logWithCategory(category: string, message: string, data?: unknown): void {
    const isDev = isViteDevMode();
    const _prefix = `[${category}]`;
    
    if (!isDev && data) {
      // console.log(prefix, message, sanitizeData(data));
    } else {
      // console.log(prefix, message, data);
    }
  },
  
  /**
   * 节点相关日志
   */
  nodeLog(nodeId: string, message: string, data?: unknown): void {
    this.logWithCategory(`Node:${nodeId}`, message, data);
  },
  
  /**
   * API相关日志
   */
  apiLog(endpoint: string, message: string, data?: unknown): void {
    this.logWithCategory(`API:${endpoint}`, message, data);
  },
  
  /**
   * 性能日志
   */
  perfLog(operation: string, duration: number, data?: unknown): void {
    this.logWithCategory('Performance', `${operation} 耗时: ${duration}ms`, data);
  }
};
