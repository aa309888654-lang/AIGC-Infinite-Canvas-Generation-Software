import {
  EnhancedTask,
  EnhancedTaskStatus,
  EnhancedTaskPriority,
  SchedulerConfig,
  SchedulerStats,
  SchedulerEvent,
  TaskDependency,
  PRIORITY_WEIGHTS,
  DEFAULT_SCHEDULER_CONFIG,
  createEnhancedTask,
} from '@/types/enhanced-task-scheduler';
import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface TaskExecutionContext {
  abortController: AbortController;
  startTime: number;
  timeoutId?: NodeJS.Timeout;
}

export class EnhancedTaskScheduler {
  private static instance: EnhancedTaskScheduler;
  
  private tasks: Map<string, EnhancedTask> = new Map();
  private config: SchedulerConfig;
  private runningTasks: Map<string, TaskExecutionContext> = new Map();
  private eventListeners: Set<(event: SchedulerEvent) => void> = new Set();
  private isProcessing: boolean = false;
  private stats: SchedulerStats;
  private taskHistory: EnhancedTask[] = [];
  private executionStartTime: number = Date.now();
  private completedTasksCount: number = 0;
  
  private constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.stats = this.initializeStats();
    this.loadFromStorage();
  }

  public static getInstance(config?: Partial<SchedulerConfig>): EnhancedTaskScheduler {
    if (!EnhancedTaskScheduler.instance) {
      EnhancedTaskScheduler.instance = new EnhancedTaskScheduler(config);
    }
    return EnhancedTaskScheduler.instance;
  }

  private initializeStats(): SchedulerStats {
    return {
      totalTasks: 0,
      pendingTasks: 0,
      runningTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      preemptedTasks: 0,
      averageQueueTime: 0,
      averageExecutionTime: 0,
      throughput: 0,
      successRate: 100,
      activeWorkers: 0,
      cpuUtilization: 0,
      memoryUtilization: 0,
      lastHour: { completed: 0, failed: 0, avgLatency: 0 },
      last24Hours: { completed: 0, failed: 0, avgLatency: 0 },
    };
  }

  private loadFromStorage(): void {
    try {
      const savedTasks = localStorage.getItem('enhanced-scheduler-tasks');
      const savedStats = localStorage.getItem('enhanced-scheduler-stats');
      
      if (savedTasks) {
        const parsed = JSON.parse(savedTasks);
        parsed.forEach((task: any) => {
          this.tasks.set(task.id, {
            ...task,
            createdAt: new Date(task.createdAt),
            queuedAt: task.queuedAt ? new Date(task.queuedAt) : undefined,
            scheduledAt: task.scheduledAt ? new Date(task.scheduledAt) : undefined,
            startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
            completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
            failedAt: task.failedAt ? new Date(task.failedAt) : undefined,
            cancelledAt: task.cancelledAt ? new Date(task.cancelledAt) : undefined,
            preemptedAt: task.preemptedAt ? new Date(task.preemptedAt) : undefined,
          });
        });
      }
      
      if (savedStats) {
        this.stats = JSON.parse(savedStats);
      }
    } catch (error) {
      logger.error('加载调度器状态失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const tasksArray = Array.from(this.tasks.values());
      localStorage.setItem('enhanced-scheduler-tasks', JSON.stringify(tasksArray));
      localStorage.setItem('enhanced-scheduler-stats', JSON.stringify(this.stats));
    } catch (error) {
      logger.error('保存调度器状态失败:', error);
    }
  }

  private emitEvent(event: SchedulerEvent): void {
    this.eventListeners.forEach(listener => listener(event));
  }

  public subscribe(listener: (event: SchedulerEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public addTask(
    taskData: Partial<EnhancedTask> & Pick<EnhancedTask, 'name' | 'type'>
  ): string {
    const id = taskData.id || generateId();
    const task = createEnhancedTask({ ...taskData, id });
    
    this.tasks.set(id, task);
    this.stats.totalTasks++;
    this.stats.pendingTasks++;
    
    this.emitEvent({
      type: 'task-added',
      timestamp: new Date(),
      taskId: id,
      task,
      message: `任务已添加: ${task.name}`,
    });
    
    logger.info(`[EnhancedTaskScheduler] 任务已添加: ${id} (${task.name})`);
    this.saveToStorage();
    this.processQueue();
    
    return id;
  }

  public getTask(id: string): EnhancedTask | undefined {
    return this.tasks.get(id);
  }

  public getAllTasks(): EnhancedTask[] {
    return Array.from(this.tasks.values());
  }

  public getTasksByStatus(status: EnhancedTaskStatus): EnhancedTask[] {
    return this.getAllTasks().filter(t => t.status === status);
  }

  public getTasksByPriority(priority: EnhancedTaskPriority): EnhancedTask[] {
    return this.getAllTasks().filter(t => t.priority === priority);
  }

  private areDependenciesSatisfied(task: EnhancedTask): boolean {
    if (task.dependencies.length === 0) return true;
    
    return task.dependencies.every(dep => {
      const depTask = this.tasks.get(dep.taskId);
      if (!depTask) return false;
      
      const requiredStatus = dep.requiredStatus || 'completed';
      
      if (dep.type === 'finish-to-start') {
        return depTask.status === requiredStatus;
      } else if (dep.type === 'start-to-start') {
        return ['running', 'completed'].includes(depTask.status);
      } else if (dep.type === 'finish-to-finish') {
        return depTask.status === requiredStatus;
      } else if (dep.type === 'start-to-finish') {
        return ['running', 'completed'].includes(depTask.status);
      }
      
      return false;
    });
  }

  private getSortedPendingTasks(): EnhancedTask[] {
    const pendingTasks = this.getTasksByStatus('idle')
      .concat(this.getTasksByStatus('queued'))
      .filter(task => this.areDependenciesSatisfied(task));
    
    return pendingTasks.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private checkPreemption(newTask: EnhancedTask): boolean {
    if (!this.config.enablePreemption) return false;
    if (PRIORITY_WEIGHTS[newTask.priority] < PRIORITY_WEIGHTS[this.config.preemptionThreshold]) {
      return false;
    }
    
    const preemptableTasks = Array.from(this.runningTasks.entries())
      .filter(([taskId]) => {
        const task = this.tasks.get(taskId);
        return task && task.canBePreempted && 
               PRIORITY_WEIGHTS[task.priority] < PRIORITY_WEIGHTS[newTask.priority];
      })
      .sort(([idA], [idB]) => {
        const taskA = this.tasks.get(idA)!;
        const taskB = this.tasks.get(idB)!;
        return PRIORITY_WEIGHTS[taskA.priority] - PRIORITY_WEIGHTS[taskB.priority];
      });
    
    if (preemptableTasks.length > 0) {
      const [taskIdToPreempt] = preemptableTasks[0];
      this.preemptTask(taskIdToPreempt);
      return true;
    }
    
    return false;
  }

  private preemptTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    const context = this.runningTasks.get(taskId);
    if (context) {
      context.abortController.abort();
      if (context.timeoutId) {
        clearTimeout(context.timeoutId);
      }
      this.runningTasks.delete(taskId);
    }
    
    this.updateTask(taskId, {
      status: 'preempted',
      preemptedAt: new Date(),
      preemptionCount: task.preemptionCount + 1,
    });
    
    this.stats.runningTasks--;
    this.stats.preemptedTasks++;
    
    this.emitEvent({
      type: 'task-preempted',
      timestamp: new Date(),
      taskId,
      task: this.tasks.get(taskId),
      message: `任务已被抢占: ${task.name}`,
    });
    
    logger.info(`[EnhancedTaskScheduler] 任务已被抢占: ${taskId}`);
    this.saveToStorage();
    this.processQueue();
  }

  private processQueue(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const sortedTasks = this.getSortedPendingTasks();
      const availableSlots = this.config.maxConcurrent - this.runningTasks.size;

      for (let i = 0; i < Math.min(availableSlots, sortedTasks.length); i++) {
        const task = sortedTasks[i];
        
        if (availableSlots === 0 && this.runningTasks.size > 0) {
          const preempted = this.checkPreemption(task);
          if (!preempted) continue;
        }
        
        this.startTask(task.id);
      }
      
      this.updateStats();
    } finally {
      this.isProcessing = false;
    }
  }

  private startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    const abortController = new AbortController();
    const context: TaskExecutionContext = {
      abortController,
      startTime: Date.now(),
    };
    
    if (this.config.taskTimeout > 0) {
      context.timeoutId = setTimeout(() => {
        this.failTask(taskId, 'Task timeout exceeded');
      }, this.config.taskTimeout);
    }
    
    this.runningTasks.set(taskId, context);
    
    const now = new Date();
    this.updateTask(taskId, {
      status: 'running',
      startedAt: now,
      queuedAt: task.status === 'idle' ? now : task.queuedAt,
    });
    
    this.stats.pendingTasks--;
    this.stats.runningTasks++;
    
    this.emitEvent({
      type: 'task-started',
      timestamp: new Date(),
      taskId,
      task: this.tasks.get(taskId),
      message: `任务开始执行: ${task.name}`,
    });
    
    logger.info(`[EnhancedTaskScheduler] 任务开始执行: ${taskId}`);
    this.saveToStorage();
  }

  public updateTask(taskId: string, updates: Partial<EnhancedTask>): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    this.tasks.set(taskId, { ...task, ...updates });
    this.saveToStorage();
  }

  public updateProgress(taskId: string, progress: number): void {
    this.updateTask(taskId, { progress: Math.max(0, Math.min(100, progress)) });
  }

  public completeTask(taskId: string, result?: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    const context = this.runningTasks.get(taskId);
    if (context) {
      if (context.timeoutId) {
        clearTimeout(context.timeoutId);
      }
      this.runningTasks.delete(taskId);
      
      const executionTime = Date.now() - context.startTime;
      const queueTime = task.queuedAt 
        ? (task.startedAt?.getTime() || Date.now()) - task.queuedAt.getTime()
        : 0;
      
      this.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        result,
        metrics: {
          ...task.metrics,
          queueTime,
          executionTime,
          totalTime: queueTime + executionTime,
        },
      });
    }
    
    this.stats.runningTasks--;
    this.stats.completedTasks++;
    this.completedTasksCount++;
    this.taskHistory.push(this.tasks.get(taskId)!);
    
    this.emitEvent({
      type: 'task-completed',
      timestamp: new Date(),
      taskId,
      task: this.tasks.get(taskId),
      message: `任务完成: ${task.name}`,
    });
    
    logger.info(`[EnhancedTaskScheduler] 任务完成: ${taskId}`);
    this.saveToStorage();
    this.processQueue();
    this.notifyDependents(taskId);
  }

  public failTask(taskId: string, error: string, errorStack?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    const context = this.runningTasks.get(taskId);
    if (context) {
      if (context.timeoutId) {
        clearTimeout(context.timeoutId);
      }
      this.runningTasks.delete(taskId);
    }
    
    const canRetry = this.shouldRetry(task, error);
    
    if (canRetry) {
      this.retryTask(taskId);
      return;
    }
    
    this.updateTask(taskId, {
      status: 'failed',
      failedAt: new Date(),
      lastError: error,
      errorStack,
    });
    
    this.stats.runningTasks--;
    this.stats.failedTasks++;
    
    this.emitEvent({
      type: 'task-failed',
      timestamp: new Date(),
      taskId,
      task: this.tasks.get(taskId),
      message: `任务失败: ${task.name} - ${error}`,
    });
    
    logger.error(`[EnhancedTaskScheduler] 任务失败: ${taskId}`, error);
    this.saveToStorage();
    this.processQueue();
  }

  private shouldRetry(task: EnhancedTask, error: string): boolean {
    if (task.retryConfig.currentAttempt >= task.retryConfig.maxAttempts) {
      return false;
    }
    
    const isRetryable = task.retryConfig.retryableErrors.some(
      retryableError => error.toLowerCase().includes(retryableError.toLowerCase())
    );
    
    return isRetryable;
  }

  public retryTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    const delay = task.retryConfig.exponentialBackoff
      ? task.retryConfig.retryDelay * Math.pow(task.retryConfig.backoffMultiplier, task.retryConfig.currentAttempt)
      : task.retryConfig.retryDelay;
    
    setTimeout(() => {
      this.updateTask(taskId, {
        status: 'retrying',
        retryConfig: {
          ...task.retryConfig,
          currentAttempt: task.retryConfig.currentAttempt + 1,
        },
      });
      
      this.emitEvent({
        type: 'task-retried',
        timestamp: new Date(),
        taskId,
        task: this.tasks.get(taskId),
        message: `任务重试 (${task.retryConfig.currentAttempt + 1}/${task.retryConfig.maxAttempts}): ${task.name}`,
      });
      
      logger.info(`[EnhancedTaskScheduler] 任务重试: ${taskId} (尝试 ${task.retryConfig.currentAttempt + 1})`);
      
      this.updateTask(taskId, { status: 'queued' });
      this.saveToStorage();
      this.processQueue();
    }, delay);
  }

  public cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    if (!['idle', 'queued', 'running'].includes(task.status)) return;
    
    const context = this.runningTasks.get(taskId);
    if (context) {
      context.abortController.abort();
      if (context.timeoutId) {
        clearTimeout(context.timeoutId);
      }
      this.runningTasks.delete(taskId);
      this.stats.runningTasks--;
    } else if (task.status === 'idle' || task.status === 'queued') {
      this.stats.pendingTasks--;
    }
    
    this.updateTask(taskId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });
    
    this.stats.cancelledTasks++;
    
    this.emitEvent({
      type: 'task-cancelled',
      timestamp: new Date(),
      taskId,
      task: this.tasks.get(taskId),
      message: `任务已取消: ${task.name}`,
    });
    
    logger.info(`[EnhancedTaskScheduler] 任务已取消: ${taskId}`);
    this.saveToStorage();
    this.processQueue();
  }

  private notifyDependents(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.dependents.forEach(depId => {
      const depTask = this.tasks.get(depId);
      if (depTask && this.areDependenciesSatisfied(depTask)) {
        this.processQueue();
      }
    });
  }

  public addDependency(taskId: string, dependency: TaskDependency): void {
    const task = this.tasks.get(taskId);
    const depTask = this.tasks.get(dependency.taskId);
    
    if (!task || !depTask) return;
    
    this.updateTask(taskId, {
      dependencies: [...task.dependencies, dependency],
    });
    
    this.updateTask(dependency.taskId, {
      dependents: [...depTask.dependents, taskId],
    });
    
    this.saveToStorage();
  }

  public removeDependency(taskId: string, dependencyTaskId: string): void {
    const task = this.tasks.get(taskId);
    const depTask = this.tasks.get(dependencyTaskId);
    
    if (!task || !depTask) return;
    
    this.updateTask(taskId, {
      dependencies: task.dependencies.filter(d => d.taskId !== dependencyTaskId),
    });
    
    this.updateTask(dependencyTaskId, {
      dependents: depTask.dependents.filter(id => id !== taskId),
    });
    
    this.saveToStorage();
  }

  public setTaskPriority(taskId: string, priority: EnhancedTaskPriority): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    this.updateTask(taskId, { priority });
    
    if (this.config.enablePreemption && 
        PRIORITY_WEIGHTS[priority] >= PRIORITY_WEIGHTS[this.config.preemptionThreshold]) {
      this.processQueue();
    }
    
    this.saveToStorage();
  }

  private updateStats(): void {
    const completedTasks = this.getTasksByStatus('completed');
    
    if (completedTasks.length > 0) {
      const totalQueueTime = completedTasks.reduce((sum, t) => sum + t.metrics.queueTime, 0);
      const totalExecutionTime = completedTasks.reduce((sum, t) => sum + t.metrics.executionTime, 0);
      
      this.stats.averageQueueTime = totalQueueTime / completedTasks.length;
      this.stats.averageExecutionTime = totalExecutionTime / completedTasks.length;
    }
    
    const totalCompletedAndFailed = this.stats.completedTasks + this.stats.failedTasks;
    this.stats.successRate = totalCompletedAndFailed > 0
      ? (this.stats.completedTasks / totalCompletedAndFailed) * 100
      : 100;
    
    const elapsedTime = (Date.now() - this.executionStartTime) / 1000 / 60;
    this.stats.throughput = elapsedTime > 0 ? this.completedTasksCount / elapsedTime : 0;
    
    this.stats.activeWorkers = this.runningTasks.size;
    
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const lastHourCompleted = this.taskHistory.filter(t => 
      t.completedAt && t.completedAt.getTime() > oneHourAgo
    );
    const lastHourFailed = this.taskHistory.filter(t => 
      t.failedAt && t.failedAt.getTime() > oneHourAgo
    );
    
    this.stats.lastHour.completed = lastHourCompleted.length;
    this.stats.lastHour.failed = lastHourFailed.length;
    this.stats.lastHour.avgLatency = lastHourCompleted.length > 0
      ? lastHourCompleted.reduce((sum, t) => sum + t.metrics.totalTime, 0) / lastHourCompleted.length
      : 0;
    
    const lastDayCompleted = this.taskHistory.filter(t => 
      t.completedAt && t.completedAt.getTime() > oneDayAgo
    );
    const lastDayFailed = this.taskHistory.filter(t => 
      t.failedAt && t.failedAt.getTime() > oneDayAgo
    );
    
    this.stats.last24Hours.completed = lastDayCompleted.length;
    this.stats.last24Hours.failed = lastDayFailed.length;
    this.stats.last24Hours.avgLatency = lastDayCompleted.length > 0
      ? lastDayCompleted.reduce((sum, t) => sum + t.metrics.totalTime, 0) / lastDayCompleted.length
      : 0;
  }

  public getStats(): SchedulerStats {
    this.updateStats();
    return { ...this.stats };
  }

  public setConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveToStorage();
    this.processQueue();
  }

  public getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  public clearCompletedTasks(): void {
    const idsToDelete: string[] = [];
    this.tasks.forEach((task, id) => {
      if (['completed', 'cancelled', 'failed'].includes(task.status)) {
        idsToDelete.push(id);
      }
    });
    
    idsToDelete.forEach(id => this.tasks.delete(id));
    this.saveToStorage();
    
    logger.info(`[EnhancedTaskScheduler] 已清理 ${idsToDelete.length} 个已完成的任务`);
  }

  public clearAllTasks(): void {
    this.tasks.clear();
    this.runningTasks.forEach(ctx => {
      ctx.abortController.abort();
      if (ctx.timeoutId) clearTimeout(ctx.timeoutId);
    });
    this.runningTasks.clear();
    this.stats = this.initializeStats();
    this.taskHistory = [];
    this.saveToStorage();
    
    logger.info('[EnhancedTaskScheduler] 已清空所有任务');
  }

  public pauseTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return;
    
    this.updateTask(taskId, { status: 'paused' });
    this.saveToStorage();
  }

  public resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return;
    
    this.updateTask(taskId, { status: 'running' });
    this.saveToStorage();
    this.processQueue();
  }
}

export const enhancedTaskScheduler = EnhancedTaskScheduler.getInstance();
export default EnhancedTaskScheduler;
