import { logger } from '@/lib/logger';
import { generateId } from '@/lib/utils';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface GenerationTask {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: 'image' | 'video';
  prompt?: string;
  parameters?: Record<string, any>;
  provider?: string;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedTime?: number;
  error?: string;
  result?: any;
  nodeId?: string;
  workflowId?: string;
}

interface TaskSchedulerConfig {
  maxConcurrent: number;
  defaultPriority: TaskPriority;
  retryAttempts: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: TaskSchedulerConfig = {
  maxConcurrent: 3,
  defaultPriority: 'medium',
  retryAttempts: 3,
  retryDelay: 1000
};

class TaskScheduler {
  private static instance: TaskScheduler;
  private tasks: Map<string, GenerationTask> = new Map();
  private config: TaskSchedulerConfig;
  private runningTasks: Set<string> = new Set();
  private listeners: Set<(tasks: GenerationTask[]) => void> = new Set();
  private isProcessing: boolean = false;

  private constructor(config: Partial<TaskSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadTasks();
  }

  public static getInstance(_config?: Partial<TaskSchedulerConfig>): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  private loadTasks() {
    try {
      const saved = localStorage.getItem('task-scheduler-tasks');
      if (saved) {
        const data = JSON.parse(saved);
        data.forEach((task: any) => {
          this.tasks.set(task.id, {
            ...task,
            createdAt: new Date(task.createdAt),
            startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
            completedAt: task.completedAt ? new Date(task.completedAt) : undefined
          });
        });
      }
    } catch (error) {
      logger.error('加载任务失败:', error);
    }
  }

  private saveTasks() {
    try {
      const tasksArray = Array.from(this.tasks.values());
      localStorage.setItem('task-scheduler-tasks', JSON.stringify(tasksArray));
    } catch (error) {
      logger.error('保存任务失败:', error);
    }
  }

  private notifyListeners() {
    const tasksArray = Array.from(this.tasks.values());
    this.listeners.forEach(listener => listener(tasksArray));
    this.saveTasks();
  }

  public subscribe(listener: (tasks: GenerationTask[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public addTask(task: Omit<GenerationTask, 'id' | 'createdAt' | 'status' | 'progress'>): string {
    const id = generateId();
    const newTask: GenerationTask = {
      ...task,
      id,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      priority: task.priority || this.config.defaultPriority
    };

    this.tasks.set(id, newTask);
    logger.info('任务已添加: ' + id);
    this.notifyListeners();
    this.processQueue();
    return id;
  }

  public getTask(id: string): GenerationTask | undefined {
    return this.tasks.get(id);
  }

  public getAllTasks(): GenerationTask[] {
    return Array.from(this.tasks.values());
  }

  public getTasksByStatus(status: TaskStatus): GenerationTask[] {
    return this.getAllTasks().filter(t => t.status === status);
  }

  public updateTask(id: string, updates: Partial<GenerationTask>) {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, ...updates });
      this.notifyListeners();
      
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
        this.runningTasks.delete(id);
        this.processQueue();
      }
    }
  }

  public cancelTask(id: string) {
    const task = this.tasks.get(id);
    if (task && (task.status === 'pending' || task.status === 'queued' || task.status === 'running')) {
      this.updateTask(id, { status: 'cancelled' });
      logger.info('任务已取消: ' + id);
    }
  }

  public retryTask(id: string) {
    const task = this.tasks.get(id);
    if (task && task.status === 'failed') {
      this.updateTask(id, {
        status: 'pending',
        progress: 0,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined
      });
      logger.info('任务已重试: ' + id);
      this.processQueue();
    }
  }

  public deleteTask(id: string) {
    if (this.tasks.delete(id)) {
      this.runningTasks.delete(id);
      logger.info('任务已删除: ' + id);
      this.notifyListeners();
      this.processQueue();
    }
  }

  public clearCompletedTasks() {
    const idsToDelete: string[] = [];
    this.tasks.forEach((task, id) => {
      if (task.status === 'completed' || task.status === 'cancelled') {
        idsToDelete.push(id);
      }
    });
    idsToDelete.forEach(id => this.tasks.delete(id));
    logger.info('已清除 ' + idsToDelete.length + ' 个已完成/取消的任务');
    this.notifyListeners();
  }

  private processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const pendingTasks = this.getTasksByStatus('pending').sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const availableSlots = this.config.maxConcurrent - this.runningTasks.size;

    for (let i = 0; i < Math.min(availableSlots, pendingTasks.length); i++) {
      const task = pendingTasks[i];
      this.startTask(task.id);
    }

    this.isProcessing = false;
  }

  private startTask(id: string) {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'pending') return;

    this.updateTask(id, {
      status: 'running',
      startedAt: new Date()
    });
    this.runningTasks.add(id);
    logger.info('任务开始执行: ' + id);
  }

  public updateProgress(id: string, progress: number) {
    this.updateTask(id, { progress });
  }

  public completeTask(id: string, result?: any) {
    this.updateTask(id, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      result
    });
    logger.info('任务完成: ' + id);
  }

  public failTask(id: string, error: string) {
    this.updateTask(id, {
      status: 'failed',
      completedAt: new Date(),
      error
    });
    logger.error('任务失败: ' + id, error);
  }

  public getStats() {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      queued: tasks.filter(t => t.status === 'queued').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
  }

  public setConfig(config: Partial<TaskSchedulerConfig>) {
    this.config = { ...this.config, ...config };
    logger.info('任务调度器配置已更新');
    this.processQueue();
  }

  public getConfig(): TaskSchedulerConfig {
    return { ...this.config };
  }
}

export const taskScheduler = TaskScheduler.getInstance();
export default TaskScheduler;
