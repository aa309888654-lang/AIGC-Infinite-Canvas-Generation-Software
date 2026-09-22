/**
 * 优化进度Hook
 * 提供渐进式进度展示功能
 */

import { useState, useCallback, useRef } from 'react';
import type { 
  OptimizationProgress, 
  ProgressStage, 
  ProgressStatus,
  ProgressOptions,
  ProgressCallback 
} from '@/types/optimization-progress';
import { DEFAULT_PROGRESS_STAGES, DEFAULT_PROGRESS_OPTIONS } from '@/types/optimization-progress';

interface UseOptimizationProgressReturn {
  /** 当前进度 */
  progress: OptimizationProgress;
  /** 开始进度追踪 */
  startTracking: (mode?: string) => void;
  /** 更新进度 */
  updateProgress: (update: Partial<ProgressStage>) => void;
  /** 设置总进度 */
  setProgress: (progress: number, message?: string) => void;
  /** 完成进度 */
  complete: (message?: string) => void;
  /** 标记错误 */
  setError: (message: string) => void;
  /** 取消进度 */
  cancel: () => void;
  /** 暂停进度 */
  pause: () => void;
  /** 恢复进度 */
  resume: () => void;
  /** 重置进度 */
  reset: () => void;
  /** 订阅进度更新 */
  subscribe: (callback: ProgressCallback) => () => void;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 是否可暂停 */
  isPausable: boolean;
  /** 是否可取消 */
  isCancellable: boolean;
}

/**
 * 优化进度Hook
 */
export function useOptimizationProgress(
  options: Partial<ProgressOptions> = {}
): UseOptimizationProgressReturn {
  const opts = { ...DEFAULT_PROGRESS_OPTIONS, ...options };
  
  const [progress, setProgressState] = useState<OptimizationProgress>({
    progress: 0,
    status: 'idle',
    currentStage: null,
    stages: [],
    startTime: 0,
    estimatedRemainingTime: undefined,
    cancellable: true,
    pausable: true,
  });

  const subscribersRef = useRef<Set<ProgressCallback>>(new Set());
  const lastUpdateRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);

  // 通知所有订阅者
  const notifySubscribers = useCallback((prog: OptimizationProgress) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < opts.minUpdateInterval) {
      return; // 节流
    }
    lastUpdateRef.current = now;
    
    subscribersRef.current.forEach(callback => {
      try {
        callback(prog);
      } catch (error) {
        console.error('[ProgressHook] 进度回调错误:', error);
      }
    });
  }, [opts.minUpdateInterval]);

  // 更新进度状态
  const updateProgressState = useCallback((update: Partial<OptimizationProgress> | ((prev: OptimizationProgress) => Partial<OptimizationProgress>)) => {
    setProgressState(prev => {
      const resolved = typeof update === 'function' ? update(prev) : update;
      const newProgress = { ...prev, ...resolved };
      notifySubscribers(newProgress);
      return newProgress;
    });
  }, [notifySubscribers]);

  // 开始追踪
  const startTracking = useCallback((mode?: string) => {
    const now = Date.now();
    const stages: ProgressStage[] = DEFAULT_PROGRESS_STAGES.map(stage => ({
      ...stage,
      status: 'pending',
      progress: 0,
    }));

    const initialProgress: OptimizationProgress = {
      progress: 0,
      status: 'preparing',
      currentStage: stages[0] || null,
      stages,
      startTime: now,
      estimatedRemainingTime: undefined,
      cancellable: true,
      pausable: true,
      message: mode ? `开始${mode}优化...` : '开始优化...',
    };

    // 设置第一阶段为运行中
    if (stages.length > 0) {
      stages[0].status = 'running';
      stages[0].startTime = now;
      initialProgress.currentStage = stages[0];
    }

    updateProgressState(initialProgress);
    isPausedRef.current = false;
    pausedTimeRef.current = 0;
  }, [updateProgressState]);

  // 更新进度
  const updateProgress = useCallback((update: Partial<ProgressStage>) => {
    setProgressState(prev => {
      if (prev.status === 'idle' || prev.status === 'completed' || prev.status === 'error') {
        return prev;
      }

      const now = Date.now();
      const newStages = [...prev.stages];
      const currentIndex = newStages.findIndex(s => s.id === prev.currentStage?.id);
      
      if (currentIndex === -1) return prev;

      // 更新当前阶段
      const updatedStage: ProgressStage = {
        ...newStages[currentIndex],
        ...update,
      };

      if (update.status === 'completed' && !updatedStage.endTime) {
        updatedStage.endTime = now;
        updatedStage.duration = updatedStage.startTime 
          ? now - updatedStage.startTime 
          : undefined;
      }

      newStages[currentIndex] = updatedStage;

      // 计算总进度
      const completedProgress = newStages
        .filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + 100 / newStages.length, 0);
      
      const currentProgress = updatedStage.status === 'running'
        ? (updatedStage.progress / 100) * (100 / newStages.length)
        : 0;

      const totalProgress = Math.min(Math.round(completedProgress + currentProgress), 100);

      // 计算预估剩余时间
      const elapsed = now - prev.startTime - pausedTimeRef.current;
      const progressRatio = totalProgress / 100;
      const estimatedRemaining = progressRatio > 0 
        ? Math.round(elapsed / progressRatio - elapsed)
        : undefined;

      // 确定下一个阶段
      let nextStage: ProgressStage | null = null;
      let newStatus: ProgressStatus = prev.status;

      if (update.status === 'completed') {
        if (currentIndex < newStages.length - 1) {
          nextStage = { ...newStages[currentIndex + 1], status: 'running', startTime: now };
          newStages[currentIndex + 1] = nextStage;
          newStatus = getStatusForStage(nextStage.id);
        } else {
          newStatus = 'completed';
          nextStage = null;
        }
      }

      const newProgress: OptimizationProgress = {
        ...prev,
        progress: totalProgress,
        status: newStatus,
        stages: newStages,
        currentStage: nextStage,
        estimatedRemainingTime: estimatedRemaining,
        message: update.message || prev.message,
      };

      notifySubscribers(newProgress);
      return newProgress;
    });
  }, [notifySubscribers]);

  // 设置总进度
  const setProgress = useCallback((progress: number, message?: string) => {
    updateProgress({ progress: Math.min(Math.max(0, progress), 100), message });
  }, [updateProgress]);

  // 完成
  const complete = useCallback((message?: string) => {
    setProgressState(prev => {
      const newStages = prev.stages.map(s => ({
        ...s,
        status: s.status === 'running' ? 'completed' as const : s.status,
        progress: s.status === 'running' ? 100 : s.progress,
        endTime: s.status === 'running' ? Date.now() : s.endTime,
        duration: s.status === 'running' && s.startTime 
          ? Date.now() - s.startTime 
          : s.duration,
      }));

      const newProgress: OptimizationProgress = {
        ...prev,
        progress: 100,
        status: 'completed',
        stages: newStages,
        currentStage: null,
        estimatedRemainingTime: 0,
        message: message || '优化完成！',
      };

      notifySubscribers(newProgress);
      return newProgress;
    });
  }, [notifySubscribers]);

  // 错误
  const setError = useCallback((message: string) => {
    setProgressState(prev => {
      const newStages = prev.stages.map(s => ({
        ...s,
        status: s.status === 'running' ? 'failed' as const : s.status,
        endTime: s.status === 'running' ? Date.now() : s.endTime,
      }));

      const newProgress: OptimizationProgress = {
        ...prev,
        status: 'error',
        stages: newStages,
        currentStage: null,
        message,
      };

      notifySubscribers(newProgress);
      return newProgress;
    });
  }, [notifySubscribers]);

  // 取消
  const cancel = useCallback(() => {
    updateProgressState(prev => ({
      ...prev,
      status: 'cancelled',
      currentStage: null,
      message: '优化已取消',
    }));
  }, [updateProgressState]);

  // 暂停
  const pause = useCallback(() => {
    if (!progress.pausable) return;
    isPausedRef.current = true;
    pausedTimeRef.current = Date.now();
    updateProgressState(prev => ({
      ...prev,
      status: 'idle',
      message: '已暂停',
    }));
  }, [progress.pausable, updateProgressState]);

  // 恢复
  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    const _pausedDuration = Date.now() - pausedTimeRef.current;
    pausedTimeRef.current = 0;
    isPausedRef.current = false;
    
    updateProgressState(prev => ({
      ...prev,
      status: prev.currentStage ? getStatusForStage(prev.currentStage.id) : 'optimizing',
      message: '继续优化...',
    }));
  }, [updateProgressState]);

  // 重置
  const reset = useCallback(() => {
    isPausedRef.current = false;
    pausedTimeRef.current = 0;
    updateProgressState({
      progress: 0,
      status: 'idle',
      currentStage: null,
      stages: [],
      startTime: 0,
      estimatedRemainingTime: undefined,
      cancellable: true,
      pausable: true,
    });
  }, [updateProgressState]);

  // 订阅
  const subscribe = useCallback((callback: ProgressCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  return {
    progress,
    startTracking,
    updateProgress,
    setProgress,
    complete,
    setError,
    cancel,
    pause,
    resume,
    reset,
    subscribe,
    isRunning: progress.status !== 'idle' && 
                progress.status !== 'completed' && 
                progress.status !== 'error' &&
                progress.status !== 'cancelled',
    isPausable: progress.pausable && progress.status !== 'idle',
    isCancellable: progress.cancellable && progress.status !== 'idle',
  };
}

/**
 * 根据阶段ID获取状态
 */
function getStatusForStage(stageId: string): ProgressStatus {
  switch (stageId) {
    case 'preparation':
      return 'preparing';
    case 'analysis':
      return 'analyzing';
    case 'optimization':
      return 'optimizing';
    case 'validation':
    case 'finalization':
      return 'finalizing';
    default:
      return 'optimizing';
  }
}
