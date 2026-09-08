/**
 * 任务队列优化器 - 智能调度和优化任务执行
 */

import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';

// 任务优先级
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

// 任务状态
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// 任务类型
export type TaskType = 'generation' | 'download' | 'upload' | 'processing' | 'other';

// 基础任务接口
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  progress: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number;
  result?: unknown;
  error?: string;
  retries: number;
  maxRetries: number;
}

// 任务执行器
export type TaskExecutor<T = unknown> = (task: Task, context: ExecutionContext) => Promise<T>;

// 执行上下文
export interface ExecutionContext {
  cancelTask: (taskId: string) => void;
  updateProgress: (taskId: string, progress: number) => void;
  getTaskById: (taskId: string) => Task | undefined;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
}

// 队列配置
export interface QueueConfig {
  maxConcurrent: number;
  maxQueueSize: number;
  defaultPriority: TaskPriority;
  defaultMaxRetries: number;
  retryDelay: number;
  enablePriorityBoost: boolean;
  priorityBoostInterval: number;
}

// 性能指标
export interface PerformanceMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  throughput: number;
  queueUtilization: number;
}

// 事件类型
export type TaskEventType = 
  | 'task:added' 
  | 'task:started' 
  | 'task:progress' 
  | 'task:completed' 
  | 'task:failed' 
  | 'task:cancelled' 
  | 'task:retry'
  | 'queue:full'
  | 'queue:empty';

// 事件回调
export type TaskEventCallback = (event: TaskEvent) => void;

// 任务事件
export interface TaskEvent {
  type: TaskEventType;
  task?: Task;
  timestamp: number;
  data?: Record<string, unknown>;
}

// 默认配置
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrent: 3,
  maxQueueSize: 100,
  defaultPriority: TaskPriority.NORMAL,
  defaultMaxRetries: 3,
  retryDelay: 2000,
  enablePriorityBoost: true,
  priorityBoostInterval: 5000,
};

// 任务执行器映射
const taskExecutors: Map<string, TaskExecutor> = new Map();

// 任务队列优化器类
class TaskQueueOptimizer {
  private static instance: TaskQueueOptimizer;
  
  private queue: Task[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private completedTasks: Task[] = [];
  private config: QueueConfig;
  private eventCallbacks: Set<TaskEventCallback> = new Set();
  private isProcessing = false;
  private processingLoopId: number | null = null;
  private metrics: PerformanceMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    cancelledTasks: 0,
    averageWaitTime: 0,
    averageExecutionTime: 0,
    throughput: 0,
    queueUtilization: 0,
  };
  private taskStartTimes: Map<string, number> = new Map();
  private lastMetricsUpdate = Date.now();
  
  private constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }
  
  static getInstance(config?: Partial<QueueConfig>): TaskQueueOptimizer {
    if (!TaskQueueOptimizer.instance) {
      TaskQueueOptimizer.instance = new TaskQueueOptimizer(config);
    }
    return TaskQueueOptimizer.instance;
  }
  
  // 初始化
  init(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingLoop();
    logger.info('任务队列优化器已启动');
  }
  
  // 停止
  stop(): void {
    if (!this.isProcessing) return;
    
    this.isProcessing = false;
    if (this.processingLoopId !== null) {
      window.clearInterval(this.processingLoopId);
      this.processingLoopId = null;
    }
    logger.info('任务队列优化器已停止');
  }
  
  // 注册任务执行器
  static registerExecutor(type: string, executor: TaskExecutor): void {
    taskExecutors.set(type, executor);
    logger.info(`任务执行器已注册: ${type}`);
  }
  
  // 添加任务
  addTask(options: {
    type: TaskType;
    title: string;
    description?: string;
    priority?: TaskPriority;
    data?: Record<string, unknown>;
    maxRetries?: number;
    estimatedDuration?: number;
  }): string {
    // 检查队列是否已满
    if (this.queue.length >= this.config.maxQueueSize) {
      this.emit({
        type: 'queue:full',
        timestamp: Date.now(),
        data: { queueSize: this.queue.length },
      });
      throw new Error('任务队列已满');
    }
    
    const task: Task = {
      id: generateId(),
      type: options.type,
      title: options.title,
      description: options.description,
      priority: options.priority ?? this.config.defaultPriority,
      status: TaskStatus.PENDING,
      data: options.data,
      progress: 0,
      createdAt: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
      estimatedDuration: options.estimatedDuration,
    };
    
    // 根据优先级插入队列
    this.insertTaskByPriority(task);
    
    // 更新指标
    this.metrics.totalTasks++;
    
    this.emit({
      type: 'task:added',
      task,
      timestamp: Date.now(),
    });
    
    logger.info(`任务已添加: ${task.title} (优先级: ${TaskPriority[task.priority]})`);
    
    return task.id;
  }
  
  // 按优先级插入任务
  private insertTaskByPriority(task: Task): void {
    const index = this.queue.findIndex(t => t.priority < task.priority);
    if (index === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(index, 0, task);
    }
  }
  
  // 优先级提升（防止饥饿）
  private boostPriority(): void {
    if (!this.config.enablePriorityBoost) return;
    
    const now = Date.now();
    const boostedTasks: Task[] = [];
    
    this.queue.forEach(task => {
      const waitTime = now - task.createdAt;
      if (waitTime > this.config.priorityBoostInterval) {
        if (task.priority < TaskPriority.CRITICAL) {
          task.priority++;
          boostedTasks.push(task);
        }
      }
    });
    
    // 重新排序队列
    if (boostedTasks.length > 0) {
      this.queue.sort((a, b) => b.priority - a.priority);
    }
  }
  
  // 处理循环
  private processingLoop(): void {
    this.processingLoopId = window.setInterval(async () => {
      // 优先级提升
      this.boostPriority();
      
      // 执行任务
      while (this.runningTasks.size < this.config.maxConcurrent && this.queue.length > 0) {
        const task = this.queue.shift();
        if (task) {
          this.executeTask(task);
        }
      }
      
      // 更新指标
      this.updateMetrics();
    }, 100);
  }
  
  // 执行任务
  private async executeTask(task: Task): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.startedAt = Date.now();
    this.runningTasks.set(task.id, task);
    this.taskStartTimes.set(task.id, Date.now());
    
    this.emit({
      type: 'task:started',
      task,
      timestamp: Date.now(),
    });
    
    logger.debug(`开始执行任务: ${task.title}`);
    
    const executor = taskExecutors.get(task.type);
    
    if (!executor) {
      task.status = TaskStatus.FAILED;
      task.error = `未找到任务执行器: ${task.type}`;
      this.handleTaskFailure(task);
      return;
    }
    
    try {
      const context: ExecutionContext = {
        cancelTask: (taskId: string) => this.cancelTask(taskId),
        updateProgress: (taskId: string, progress: number) => this.updateProgress(taskId, progress),
        getTaskById: (taskId: string) => this.getTaskById(taskId),
        pauseTask: (taskId: string) => this.pauseTask(taskId),
        resumeTask: (taskId: string) => this.resumeTask(taskId),
      };
      
      const result = await executor(task, context);
      
      task.status = TaskStatus.COMPLETED;
      task.completedAt = Date.now();
      task.progress = 100;
      task.result = result;
      
      this.runningTasks.delete(task.id);
      this.completedTasks.push(task);
      
      this.metrics.completedTasks++;
      
      this.emit({
        type: 'task:completed',
        task,
        timestamp: Date.now(),
        data: { result },
      });
      
      logger.info(`任务完成: ${task.title}`);
      
    } catch (error) {
      task.error = error instanceof Error ? error.message : String(error);
      this.handleTaskFailure(task);
    }
  }
  
  // 处理任务失败
  private handleTaskFailure(task: Task): void {
    this.runningTasks.delete(task.id);
    
    if (task.retries < task.maxRetries) {
      // 重试
      task.retries++;
      task.status = TaskStatus.PENDING;
      task.progress = 0;
      task.startedAt = undefined;
      
      this.emit({
        type: 'task:retry',
        task,
        timestamp: Date.now(),
        data: { retryCount: task.retries },
      });
      
      // 延迟后重新加入队列
      setTimeout(() => {
        this.insertTaskByPriority(task);
      }, this.config.retryDelay);
      
      logger.debug(`任务将在重试: ${task.title} (${task.retries}/${task.maxRetries})`);
      
    } else {
      // 失败
      task.status = TaskStatus.FAILED;
      this.completedTasks.push(task);
      this.metrics.failedTasks++;
      
      this.emit({
        type: 'task:failed',
        task,
        timestamp: Date.now(),
        data: { error: task.error },
      });
      
      console.error(`任务失败: ${task.title}`, task.error);
    }
  }
  
  // 取消任务
  cancelTask(taskId: string): boolean {
    // 检查运行中的任务
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      runningTask.status = TaskStatus.CANCELLED;
      runningTask.completedAt = Date.now();
      this.runningTasks.delete(taskId);
      this.completedTasks.push(runningTask);
      this.metrics.cancelledTasks++;
      
      this.emit({
        type: 'task:cancelled',
        task: runningTask,
        timestamp: Date.now(),
      });
      
      return true;
    }
    
    // 检查队列中的任务
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue[queueIndex];
      task.status = TaskStatus.CANCELLED;
      task.completedAt = Date.now();
      this.queue.splice(queueIndex, 1);
      this.completedTasks.push(task);
      this.metrics.cancelledTasks++;
      
      this.emit({
        type: 'task:cancelled',
        task,
        timestamp: Date.now(),
      });
      
      return true;
    }
    
    return false;
  }
  
  // 更新进度
  updateProgress(taskId: string, progress: number): void {
    const task = this.runningTasks.get(taskId) || this.queue.find(t => t.id === taskId);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      
      this.emit({
        type: 'task:progress',
        task,
        timestamp: Date.now(),
        data: { progress: task.progress },
      });
    }
  }
  
  // 暂停任务
  pauseTask(taskId: string): boolean {
    const task = this.runningTasks.get(taskId);
    if (task && task.status === TaskStatus.RUNNING) {
      task.status = TaskStatus.PENDING;
      return true;
    }
    return false;
  }
  
  // 恢复任务
  resumeTask(taskId: string): boolean {
    const task = this.queue.find(t => t.id === taskId);
    if (task && task.status === TaskStatus.PENDING) {
      this.insertTaskByPriority(task);
      return true;
    }
    return false;
  }
  
  // 获取任务
  getTaskById(taskId: string): Task | undefined {
    return (
      this.runningTasks.get(taskId) ||
      this.queue.find(t => t.id === taskId) ||
      this.completedTasks.find(t => t.id === taskId)
    );
  }
  
  // 获取队列状态
  getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    total: number;
  } {
    return {
      pending: this.queue.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.length,
      total: this.metrics.totalTasks,
    };
  }
  
  // 获取所有待处理任务
  getPendingTasks(): Task[] {
    return [...this.queue];
  }
  
  // 获取所有运行中的任务
  getRunningTasks(): Task[] {
    return Array.from(this.runningTasks.values());
  }
  
  // 清空已完成任务
  clearCompleted(): void {
    this.completedTasks = [];
  }
  
  // 清空队列
  clearQueue(): Task[] {
    const cleared = [...this.queue];
    this.queue = [];
    return cleared;
  }
  
  // 更新配置
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('队列配置已更新:', this.config);
  }
  
  // 获取配置
  getConfig(): QueueConfig {
    return { ...this.config };
  }
  
  // 获取性能指标
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  // 更新指标
  private updateMetrics(): void {
    const now = Date.now();
    const elapsed = (now - this.lastMetricsUpdate) / 1000;
    
    if (elapsed >= 1) {
      // 计算吞吐量
      this.metrics.throughput = this.metrics.completedTasks / Math.max(1, elapsed);
      
      // 计算队列利用率
      this.metrics.queueUtilization = this.queue.length / this.config.maxQueueSize;
      
      // 计算平均等待时间
      const waitTimes = this.queue.map(t => now - t.createdAt);
      if (waitTimes.length > 0) {
        this.metrics.averageWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      }
      
      // 计算平均执行时间
      const execTimes: number[] = [];
      this.completedTasks.forEach(t => {
        if (t.startedAt && t.completedAt) {
          execTimes.push(t.completedAt - t.startedAt);
        }
      });
      if (execTimes.length > 0) {
        this.metrics.averageExecutionTime = execTimes.reduce((a, b) => a + b, 0) / execTimes.length;
      }
      
      this.lastMetricsUpdate = now;
    }
  }
  
  // 注册事件回调
  onEvent(callback: TaskEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }
  
  // 触发事件
  private emit(event: TaskEvent): void {
    this.eventCallbacks.forEach(cb => cb(event));
  }
}

export const taskQueueOptimizer = TaskQueueOptimizer.getInstance();