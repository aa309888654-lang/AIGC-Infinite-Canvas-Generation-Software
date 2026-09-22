
// 增强的任务优先级（支持更细粒度的优先级）
export type EnhancedTaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'background';

// 增强的任务状态
export type EnhancedTaskStatus = 
  | 'idle'
  | 'queued'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'preempted'
  | 'retrying';

// 任务依赖关系
export interface TaskDependency {
  taskId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  requiredStatus?: EnhancedTaskStatus;
}

// 重试配置
export interface RetryConfig {
  maxAttempts: number;
  currentAttempt: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// 性能指标
export interface TaskPerformanceMetrics {
  queueTime: number;
  executionTime: number;
  totalTime: number;
  waitTime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

// 资源需求
export interface ResourceRequirements {
  cpuCores?: number;
  memoryMB?: number;
  gpuRequired?: boolean;
  networkPriority?: 'low' | 'normal' | 'high';
}

// 增强的任务接口
export interface EnhancedTask {
  id: string;
  name: string;
  description?: string;
  type: 'image' | 'video' | 'workflow' | 'other';
  priority: EnhancedTaskPriority;
  status: EnhancedTaskStatus;
  progress: number;
  
  // 时间戳
  createdAt: Date;
  queuedAt?: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  preemptedAt?: Date;
  
  // 依赖关系
  dependencies: TaskDependency[];
  dependents: string[];
  
  // 重试机制
  retryConfig: RetryConfig;
  lastError?: string;
  errorStack?: string;
  
  // 性能指标
  metrics: TaskPerformanceMetrics;
  
  // 资源需求
  resources: ResourceRequirements;
  
  // 执行数据
  nodeId?: string;
  workflowId?: string;
  payload?: Record<string, unknown>;
  result?: unknown;
  
  // 分组和标签
  groupId?: string;
  tags: string[];
  
  // 抢占相关
  canBePreempted: boolean;
  preemptionCount: number;
}

// 调度器配置
export interface SchedulerConfig {
  maxConcurrent: number;
  defaultPriority: EnhancedTaskPriority;
  enablePreemption: boolean;
  preemptionThreshold: EnhancedTaskPriority;
  queueSizeLimit: number;
  taskTimeout: number;
  defaultRetryConfig: Omit<RetryConfig, 'currentAttempt'>;
  enableMetrics: boolean;
  metricsRetentionPeriod: number;
}

// 调度器统计信息
export interface SchedulerStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  preemptedTasks: number;
  
  // 性能统计
  averageQueueTime: number;
  averageExecutionTime: number;
  throughput: number;
  successRate: number;
  
  // 资源使用
  activeWorkers: number;
  cpuUtilization: number;
  memoryUtilization: number;
  
  // 时间窗口统计
  lastHour: {
    completed: number;
    failed: number;
    avgLatency: number;
  };
  last24Hours: {
    completed: number;
    failed: number;
    avgLatency: number;
  };
}

// 调度器事件
export interface SchedulerEvent {
  type: 'task-added' | 'task-started' | 'task-completed' | 'task-failed' | 
         'task-cancelled' | 'task-preempted' | 'task-retried' | 'scheduler-error';
  timestamp: Date;
  taskId?: string;
  task?: EnhancedTask;
  message?: string;
  error?: Error;
}

// 优先级权重用于排序
export const PRIORITY_WEIGHTS: Record<EnhancedTaskPriority, number> = {
  urgent: 5,
  high: 4,
  medium: 3,
  low: 2,
  background: 1,
};

// 默认调度器配置
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrent: 5,
  defaultPriority: 'medium',
  enablePreemption: true,
  preemptionThreshold: 'high',
  queueSizeLimit: 1000,
  taskTimeout: 30 * 60 * 1000,
  defaultRetryConfig: {
    maxAttempts: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    backoffMultiplier: 2,
    retryableErrors: ['network', 'timeout', 'rate-limit'],
  },
  enableMetrics: true,
  metricsRetentionPeriod: 7 * 24 * 60 * 60 * 1000,
};

// 创建增强任务的工厂函数
export function createEnhancedTask(
  data: Partial<EnhancedTask> & Pick<EnhancedTask, 'id' | 'name' | 'type'>
): EnhancedTask {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    type: data.type,
    priority: data.priority || DEFAULT_SCHEDULER_CONFIG.defaultPriority,
    status: 'idle',
    progress: 0,
    createdAt: new Date(),
    dependencies: data.dependencies || [],
    dependents: data.dependents || [],
    retryConfig: {
      ...DEFAULT_SCHEDULER_CONFIG.defaultRetryConfig,
      currentAttempt: 0,
      ...data.retryConfig,
    },
    metrics: {
      queueTime: 0,
      executionTime: 0,
      totalTime: 0,
      ...data.metrics,
    },
    resources: {
      ...data.resources,
    },
    nodeId: data.nodeId,
    workflowId: data.workflowId,
    payload: data.payload,
    groupId: data.groupId,
    tags: data.tags || [],
    canBePreempted: data.canBePreempted ?? true,
    preemptionCount: data.preemptionCount || 0,
  };
}
