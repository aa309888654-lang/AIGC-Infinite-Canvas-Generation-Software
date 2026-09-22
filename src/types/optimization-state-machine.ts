/**
 * 优化状态机相关类型定义
 */

import type { OptimizationModeType } from './optimization';

/** 优化状态 */
export type OptimizationState =
  | 'idle'
  | 'initializing'
  | 'analyzing'
  | 'optimizing'
  | 'validating'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'paused';

/** 优化事件 */
export type OptimizationEvent =
  | { type: 'START'; mode?: OptimizationModeType }
  | { type: 'ANALYSIS_COMPLETE'; result: unknown }
  | { type: 'OPTIMIZATION_COMPLETE'; result: unknown }
  | { type: 'VALIDATION_COMPLETE'; result: unknown }
  | { type: 'ERROR'; error: Error }
  | { type: 'CANCEL' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'TIMEOUT'; duration: number };

/** 状态转换 */
export interface StateTransition {
  from: OptimizationState;
  to: OptimizationState;
  event: OptimizationEvent['type'];
  guard?: (event: OptimizationEvent) => boolean;
  action?: (event: OptimizationEvent) => void;
}

/** 状态机配置 */
export interface StateMachineConfig {
  /** 初始状态 */
  initialState: OptimizationState;
  /** 状态转换 */
  transitions: StateTransition[];
  /** 状态入口动作 */
  onEntry?: (state: OptimizationState) => void;
  /** 状态退出动作 */
  onExit?: (state: OptimizationState) => void;
  /** 状态转换前动作 */
  onTransition?: (from: OptimizationState, to: OptimizationState, event: OptimizationEvent) => void;
  /** 超时配置 */
  timeouts?: Partial<Record<OptimizationState, number>>;
}

/** 状态机上下文 */
export interface StateMachineContext {
  /** 当前状态 */
  currentState: OptimizationState;
  /** 上一个状态 */
  previousState?: OptimizationState;
  /** 状态历史 */
  stateHistory: OptimizationState[];
  /** 最后更新时间 */
  lastUpdated: number;
  /** 错误信息 */
  error?: Error;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/** 状态定义 */
export interface StateDefinition {
  name: OptimizationState;
  onEntry?: () => void;
  onExit?: () => void;
  canHandle: (event: OptimizationEvent) => boolean;
}

/** 预定义状态转换 */
export const OPTIMIZATION_STATE_TRANSITIONS: StateTransition[] = [
  { from: 'idle', to: 'initializing', event: 'START' },
  { from: 'initializing', to: 'analyzing', event: 'ANALYSIS_COMPLETE' },
  { from: 'analyzing', to: 'optimizing', event: 'OPTIMIZATION_COMPLETE' },
  { from: 'optimizing', to: 'validating', event: 'VALIDATION_COMPLETE' },
  { from: 'validating', to: 'completed', event: 'VALIDATION_COMPLETE' },
  { from: 'initializing', to: 'error', event: 'ERROR' },
  { from: 'analyzing', to: 'error', event: 'ERROR' },
  { from: 'optimizing', to: 'error', event: 'ERROR' },
  { from: 'validating', to: 'error', event: 'ERROR' },
  { from: 'initializing', to: 'cancelled', event: 'CANCEL' },
  { from: 'analyzing', to: 'cancelled', event: 'CANCEL' },
  { from: 'optimizing', to: 'cancelled', event: 'CANCEL' },
  { from: 'validating', to: 'cancelled', event: 'CANCEL' },
  { from: 'initializing', to: 'paused', event: 'PAUSE' },
  { from: 'analyzing', to: 'paused', event: 'PAUSE' },
  { from: 'optimizing', to: 'paused', event: 'PAUSE' },
  { from: 'validating', to: 'paused', event: 'PAUSE' },
  { from: 'paused', to: 'initializing', event: 'RESUME' },
  { from: 'paused', to: 'analyzing', event: 'RESUME' },
  { from: 'paused', to: 'optimizing', event: 'RESUME' },
  { from: 'paused', to: 'validating', event: 'RESUME' },
  { from: 'completed', to: 'idle', event: 'RESET' },
  { from: 'error', to: 'idle', event: 'RESET' },
  { from: 'cancelled', to: 'idle', event: 'RESET' },
  { from: 'paused', to: 'idle', event: 'RESET' },
  { from: 'paused', to: 'cancelled', event: 'CANCEL' },
];

/** 超时配置（毫秒） */
export const DEFAULT_STATE_TIMEOUTS: Partial<Record<OptimizationState, number>> = {
  initializing: 5000,
  analyzing: 10000,
  optimizing: 30000,
  validating: 5000,
};

/** 状态标签 */
export const STATE_LABELS: Record<OptimizationState, string> = {
  idle: '空闲',
  initializing: '初始化中',
  analyzing: '分析中',
  optimizing: '优化中',
  validating: '验证中',
  completed: '已完成',
  error: '错误',
  cancelled: '已取消',
  paused: '已暂停',
};

/** 状态颜色 */
export const STATE_COLORS: Record<OptimizationState, string> = {
  idle: '#9CA3AF',
  initializing: '#9CA3AF',
  analyzing: '#8B5CF6',
  optimizing: '#F59E0B',
  validating: '#10B981',
  completed: '#10B981',
  error: '#EF4444',
  cancelled: '#6B7280',
  paused: '#F59E0B',
};
