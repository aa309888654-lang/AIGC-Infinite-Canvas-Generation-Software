/**
 * 工作流错误处理器
 * 统一管理工作流中的错误处理和日志记录
 *
 * 注意：此模块从 store/ 迁移至 lib/，修正依赖方向。
 * 原路径 @/store/error-handler 已废弃，请使用 @/lib/workflow-error-handler
 */

import { generateId } from '@/lib/utils';
import { isViteDevMode } from '@/lib/vite-env';

/** 工作流错误类型 */
export type WorkflowErrorType =
  | 'validation'    // 验证错误
  | 'execution'     // 执行错误
  | 'connection'    // 连接错误
  | 'api'          // API错误
  | 'timeout'      // 超时错误
  | 'unknown';     // 未知错误

/** 工作流错误 */
export interface WorkflowError {
  id: string;
  type: WorkflowErrorType;
  message: string;
  nodeId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * 错误处理器类
 * 提供统一的错误管理和日志记录功能
 */
export class WorkflowErrorHandler {
  private static instance: WorkflowErrorHandler | null = null;
  private errors: WorkflowError[] = [];
  private maxErrors: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors;
    this.startCleanupInterval();
  }

  static getInstance(): WorkflowErrorHandler {
    if (!WorkflowErrorHandler.instance) {
      WorkflowErrorHandler.instance = new WorkflowErrorHandler();
    }
    return WorkflowErrorHandler.instance;
  }

  /**
   * 添加错误
   */
  addError(error: Omit<WorkflowError, 'id' | 'timestamp'>): void {
    const newError: WorkflowError = {
      ...error,
      id: generateId(),
      timestamp: new Date(),
    };

    // 限制错误数量，避免内存泄漏
    if (this.errors.length >= this.maxErrors) {
      this.errors.shift(); // 移除最旧的错误
    }

    this.errors.push(newError);

    // 在生产环境中，避免输出敏感信息
    if (isViteDevMode()) {
      console.error('[Workflow Error]', newError);
    }
  }

  /**
   * 清除所有错误
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * 移除指定错误
   */
  removeError(errorId: string): void {
    this.errors = this.errors.filter((e) => e.id !== errorId);
  }

  /**
   * 获取所有错误
   */
  getErrors(): WorkflowError[] {
    return [...this.errors];
  }

  /**
   * 获取错误数量
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * 检查是否有错误
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * 获取特定类型的错误
   */
  getErrorsByType(type: WorkflowErrorType): WorkflowError[] {
    return this.errors.filter(error => error.type === type);
  }

  /**
   * 获取特定节点的错误
   */
  getErrorsByNodeId(nodeId: string): WorkflowError[] {
    return this.errors.filter(error => error.nodeId === nodeId);
  }

  // 定期清理过期错误
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldErrors(24); // 清理24小时前的错误
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  // 清理指定小时数之前的错误
  cleanupOldErrors(hours: number): number {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const initialLength = this.errors.length;

    this.errors = this.errors.filter(error => error.timestamp > cutoffTime);

    if (this.errors.length !== initialLength) {
      // 如果有清理，通知监听器
      // 这里可以添加监听器通知逻辑
    }

    return initialLength - this.errors.length;
  }

  // 销毁清理定时器
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/** @deprecated 使用 WorkflowErrorHandler 代替，原路径 @/store/error-handler 已废弃 */
export const ErrorHandler = WorkflowErrorHandler;
