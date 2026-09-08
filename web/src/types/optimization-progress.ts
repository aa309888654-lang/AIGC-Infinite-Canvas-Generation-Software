/**
 * 优化进度相关类型定义
 */

/** 进度状态 */
export type ProgressStatus = 
  | 'idle'           // 空闲
  | 'preparing'      // 准备中
  | 'analyzing'      // 分析中
  | 'optimizing'     // 优化中
  | 'finalizing'      // 完成中
  | 'completed'       // 已完成
  | 'error'           // 错误
  | 'cancelled';      // 已取消

/** 进度阶段 */
export interface ProgressStage {
  /** 阶段ID */
  id: string;
  /** 阶段名称 */
  name: string;
  /** 阶段描述 */
  description: string;
  /** 预计耗时（毫秒） */
  estimatedDuration?: number;
  /** 实际开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
  /** 持续时间 */
  duration?: number;
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  /** 子进度 */
  progress: number; // 0-100
  /** 详细消息 */
  message?: string;
}

/** 优化进度 */
export interface OptimizationProgress {
  /** 总进度（0-100） */
  progress: number;
  /** 当前状态 */
  status: ProgressStatus;
  /** 当前阶段 */
  currentStage: ProgressStage | null;
  /** 所有阶段 */
  stages: ProgressStage[];
  /** 开始时间 */
  startTime: number;
  /** 预计剩余时间（毫秒） */
  estimatedRemainingTime?: number;
  /** 是否可以取消 */
  cancellable: boolean;
  /** 是否可以暂停 */
  pausable: boolean;
  /** 当前迭代次数 */
  currentIteration?: number;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 消息 */
  message?: string;
}

/** 进度更新回调 */
export type ProgressCallback = (progress: OptimizationProgress) => void;

/** 进度配置 */
export interface ProgressOptions {
  /** 是否显示预估时间 */
  showEstimatedTime: boolean;
  /** 是否显示阶段详情 */
  showStageDetails: boolean;
  /** 是否显示迭代次数 */
  showIterations: boolean;
  /** 最小更新间隔（毫秒） */
  minUpdateInterval: number;
  /** 是否启用平滑动画 */
  enableSmoothAnimation: boolean;
}

/** 预定义进度阶段 */
export const DEFAULT_PROGRESS_STAGES: Omit<ProgressStage, 'status' | 'progress'>[] = [
  {
    id: 'preparation',
    name: '准备',
    description: '初始化优化环境',
    estimatedDuration: 500,
  },
  {
    id: 'analysis',
    name: '分析',
    description: '分析输入提示词的结构和语义',
    estimatedDuration: 2000,
  },
  {
    id: 'optimization',
    name: '优化',
    description: '执行优化算法',
    estimatedDuration: 5000,
  },
  {
    id: 'validation',
    name: '验证',
    description: '验证优化结果',
    estimatedDuration: 1000,
  },
  {
    id: 'finalization',
    name: '完成',
    description: '生成最终结果',
    estimatedDuration: 500,
  },
];

/** 默认配置 */
export const DEFAULT_PROGRESS_OPTIONS: ProgressOptions = {
  showEstimatedTime: true,
  showStageDetails: true,
  showIterations: true,
  minUpdateInterval: 100,
  enableSmoothAnimation: true,
};
