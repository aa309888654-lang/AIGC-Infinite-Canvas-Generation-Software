/**
 * 工作流执行工具函数
 * 提供错误处理、存储操作等通用功能
 */

import { Node } from '@xyflow/react';
import { GenerationTask } from '@/types/ai-models';
import { taskManager } from '@/store/task-manager';
import { logger } from '@/lib/logger';

/**
 * 统一的错误处理函数
 * 减少重复代码，统一错误处理逻辑
 */
export function handleExecutionError(
  error: unknown,
  task: GenerationTask,
  node: Node<Record<string, unknown>>,
  updateTask: (id: string, updates: Partial<GenerationTask>) => void,
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const failedTask = taskManager.createFailedTask(task, errorMessage);
  
  updateTask(task.id, failedTask);
  updateNodeData(node.id, {
    ...node.data,
    task: failedTask,
  });
  
  logger.error(`Node execution failed`, {
    nodeId: node.id,
    nodeType: node.data.type,
    error: errorMessage,
  });
}

/**
 * 安全的 localStorage 操作
 * 处理存储空间不足等异常情况
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.warn('localStorage quota exceeded, attempting cleanup');
      return handleStorageQuotaExceeded(key, value);
    }
    logger.error('localStorage setItem failed', { key, error });
    return false;
  }
}

/**
 * 处理存储空间不足
 * 尝试清理旧数据后重试
 */
function handleStorageQuotaExceeded(key: string, value: string): boolean {
  try {
    // 尝试清理工作流历史
    const workflowsKey = 'saved_workflows';
    let workflows: Record<string, unknown> = {};
    try {
      workflows = JSON.parse(localStorage.getItem(workflowsKey) || '{}');
    } catch {
      workflows = {};
    }
    const keys = Object.keys(workflows);

    if (keys.length > 5) {
      // 保留最近5个，删除其他的
      const sortedKeys = keys.sort((a, b) => {
        try {
          return new Date((workflows[b] as { date?: string })?.date || 0).getTime() -
                 new Date((workflows[a] as { date?: string })?.date || 0).getTime();
        } catch {
          return 0;
        }
      });
      const toDelete = sortedKeys.slice(5);
      toDelete.forEach(k => delete workflows[k]);
      localStorage.setItem(workflowsKey, JSON.stringify(workflows));

      // 重试原始操作
      localStorage.setItem(key, value);
      logger.info('Cleaned up old workflows and saved new data');
      return true;
    }

    // 尝试清理版本历史
    const versionsKey = 'workflow_versions';
    let versions: Record<string, unknown> = {};
    try {
      versions = JSON.parse(localStorage.getItem(versionsKey) || '{}');
    } catch {
      versions = {};
    }
    const versionKeys = Object.keys(versions);

    if (versionKeys.length > 0) {
      // 清理最旧的版本历史
      versionKeys.forEach(vk => {
        const v = versions[vk];
        if (Array.isArray(v) && v.length > 5) {
          versions[vk] = v.slice(-5);
        }
      });
      localStorage.setItem(versionsKey, JSON.stringify(versions));

      // 重试原始操作
      localStorage.setItem(key, value);
      logger.info('Cleaned up version history and saved new data');
      return true;
    }

    return false;
  } catch (retryError) {
    logger.error('Failed to recover from storage quota exceeded', { error: retryError });
    return false;
  }
}

/**
 * 安全的 localStorage 读取
 */
export function safeLocalStorageGetItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    logger.warn('localStorage getItem failed, returning default', { key, error });
    return defaultValue;
  }
}

/**
 * 信号量实现 - 用于控制并发
 */
export class Semaphore {
  private current = 0;
  private queue: (() => void)[] = [];
  
  constructor(private readonly max: number) {}
  
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }
  
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
  
  get available(): number {
    return this.max - this.current;
  }
}

/**
 * 带超时的 Promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 重试函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  delayMs: number
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 清理 HTML 标签（简单的 XSS 防护）
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '');
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delayMs) {
      lastCall = now;
      fn(...args);
    }
  };
}
