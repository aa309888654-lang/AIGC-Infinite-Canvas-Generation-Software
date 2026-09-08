import { GenerationTask } from '@/types/ai-models';
import { generateId } from '@/lib/utils';

// 任务管理器 - 单例模式
export class TaskManager {
  private static instance: TaskManager;
  private tasks: Map<string, GenerationTask> = new Map();
  private listeners: Array<(tasks: GenerationTask[]) => void> = [];
  private maxTasks: number = 100; // 最大任务数量
  private lazyLoadedTasks: Set<string> = new Set(); // 懒加载任务集合

  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  // 创建处理中的任务
  createProcessingTask(nodeId: string, type: 'image' | 'video' | 'audio'): GenerationTask {
    const task: GenerationTask = {
      id: generateId(),
      nodeId,
      type,
      status: 'processing',
      priority: 'normal',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    
    this.tasks.set(task.id, task);
    this.notifyListeners();
    return task;
  }

  // 创建完成的任务
  createCompletedTask(originalTask: GenerationTask, resultUrl?: string): GenerationTask {
    const completedTask: GenerationTask = {
      ...originalTask,
      status: 'completed',
      progress: 100,
      resultUrl,
      completedAt: new Date().toISOString(),
    };
    
    this.tasks.set(originalTask.id, completedTask);
    this.notifyListeners();
    return completedTask;
  }

  // 创建失败的任务
  createFailedTask(originalTask: GenerationTask, error?: string): GenerationTask {
    const failedTask: GenerationTask = {
      ...originalTask,
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    };
    
    this.tasks.set(originalTask.id, failedTask);
    this.notifyListeners();
    return failedTask;
  }

  // 更新任务（带状态转换验证）
  private static readonly TERMINAL_STATUSES = new Set(['completed', 'failed']);
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    processing: ['completed', 'failed', 'paused'],
    paused: ['processing', 'failed'],
    completed: [],
    failed: [],
  };

  updateTask(taskId: string, updates: Partial<GenerationTask>): GenerationTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Validate status transition if status is being changed
    if (updates.status && updates.status !== task.status) {
      const allowed = TaskManager.VALID_TRANSITIONS[task.status] || [];
      if (!allowed.includes(updates.status)) {
        console.warn(`[TaskManager] Invalid transition: ${task.status} → ${updates.status}, ignoring status change`);
        const { status: _status, ...rest } = updates;
        updates = rest;
      }
    }

    const updatedTask = { ...task, ...updates };
    this.tasks.set(taskId, updatedTask);
    this.notifyListeners();
    return updatedTask;
  }

  // 获取任务
  getTask(taskId: string): GenerationTask | undefined {
    return this.tasks.get(taskId);
  }

  // 获取所有任务
  getAllTasks(): GenerationTask[] {
    return Array.from(this.tasks.values());
  }

  // 获取节点相关的任务
  getTasksByNodeId(nodeId: string): GenerationTask[] {
    return Array.from(this.tasks.values()).filter(task => task.nodeId === nodeId);
  }

  // 删除任务
  deleteTask(taskId: string): boolean {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  // 清理旧任务
  cleanupOldTasks(maxAgeHours: number = 24): void {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // 转换为毫秒
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.completedAt && (now.getTime() - new Date(task.completedAt).getTime()) > maxAge) {
        this.tasks.delete(taskId);
      }
    }
    
    this.notifyListeners();
  }

  // 添加监听器
  addListener(listener: (tasks: GenerationTask[]) => void): void {
    this.listeners.push(listener);
  }

  // 移除监听器
  removeListener(listener: (tasks: GenerationTask[]) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // 通知监听器（隔离错误，一个 listener 失败不影响其他）
  private notifyListeners(): void {
    const tasks = this.getAllTasks();
    this.listeners.forEach(listener => {
      try {
        listener(tasks);
      } catch (error) {
        console.error('[TaskManager] Listener error:', error);
      }
    });
  }

  // 获取任务统计
  getTaskStats(): {
    total: number;
    processing: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  } {
    const tasks = this.getAllTasks();
    
    return {
      total: tasks.length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      byType: tasks.reduce((acc, task) => {
        acc[task.type] = (acc[task.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // 设置最大任务数量
  setMaxTasks(max: number): void {
    this.maxTasks = max;
    
    // 如果当前任务数量超过限制，清理最旧的任务
    if (this.tasks.size > max) {
      const sortedTasks = Array.from(this.tasks.entries())
        .sort(([, a], [, b]) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const tasksToRemove = sortedTasks.slice(0, this.tasks.size - max);
      tasksToRemove.forEach(([taskId]) => {
        this.tasks.delete(taskId);
        this.lazyLoadedTasks.delete(taskId);
      });
      
      this.notifyListeners();
    }
  }

  // 懒加载任务数据
  async loadTaskData(taskId: string): Promise<GenerationTask | null> {
    if (this.lazyLoadedTasks.has(taskId)) {
      return this.tasks.get(taskId) || null;
    }

    // 模拟异步加载
    return new Promise((resolve) => {
      setTimeout(() => {
        const task = this.tasks.get(taskId);
        if (task) {
          this.lazyLoadedTasks.add(taskId);
        }
        resolve(task || null);
      }, 100);
    });
  }

  // 清理未使用的任务数据
  cleanupUnusedTasks(activeNodeIds: string[]): void {
    const activeTaskIds = new Set<string>();
    
    // 收集活跃节点的任务ID
    for (const [taskId, task] of this.tasks.entries()) {
      if (activeNodeIds.includes(task.nodeId)) {
        activeTaskIds.add(taskId);
      }
    }
    
    // 清理未使用的懒加载标记
    for (const taskId of this.lazyLoadedTasks) {
      if (!activeTaskIds.has(taskId)) {
        this.lazyLoadedTasks.delete(taskId);
      }
    }
  }
}

// 导出一个全局实例
export const taskManager = TaskManager.getInstance();