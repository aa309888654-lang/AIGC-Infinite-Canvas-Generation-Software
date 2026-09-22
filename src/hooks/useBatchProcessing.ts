/**
 * 批量处理Hook
 * 支持同时处理多个视频文件
 */

import { useState, useCallback } from 'react';
import type { VideoClip} from '@/lib/ai-video-sdk';

export interface BatchJob {
  id: string;
  inputPath: string;
  outputPath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  clips?: VideoClip[];
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface BatchProcessingState {
  jobs: BatchJob[];
  isProcessing: boolean;
  currentJobIndex: number;
  totalProgress: number;
}

export function useBatchProcessing() {
  const [state, setState] = useState<BatchProcessingState>({
    jobs: [],
    isProcessing: false,
    currentJobIndex: -1,
    totalProgress: 0,
  });

  const addJob = useCallback((inputPath: string, outputPath?: string) => {
    const job: BatchJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      inputPath,
      outputPath: outputPath || inputPath.replace(/\.[^/.]+$/, '_ai_edited.mp4'),
      status: 'pending',
      progress: 0,
    };

    setState(prev => ({
      ...prev,
      jobs: [...prev.jobs, job],
    }));

    return job.id;
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.filter(j => j.id !== jobId),
    }));
  }, []);

  const updateJob = useCallback((jobId: string, updates: Partial<BatchJob>) => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.map(j =>
        j.id === jobId ? { ...j, ...updates } : j
      ),
    }));
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.filter(j => j.status !== 'completed'),
    }));
  }, []);

  const cancelAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentJobIndex: -1,
      jobs: prev.jobs.map(j =>
        j.status === 'processing' || j.status === 'pending'
          ? { ...j, status: 'cancelled' as const }
          : j
      ),
    }));
  }, []);

  const getStatistics = useCallback(() => {
    const stats = {
      total: state.jobs.length,
      pending: state.jobs.filter(j => j.status === 'pending').length,
      processing: state.jobs.filter(j => j.status === 'processing').length,
      completed: state.jobs.filter(j => j.status === 'completed').length,
      failed: state.jobs.filter(j => j.status === 'failed').length,
      cancelled: state.jobs.filter(j => j.status === 'cancelled').length,
      averageTime: 0,
      totalDuration: 0,
    };

    const completedJobs = state.jobs.filter(j => j.startTime && j.endTime);
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, j) =>
        sum + (j.endTime! - j.startTime!), 0
      );
      stats.averageTime = totalTime / completedJobs.length;
      stats.totalDuration = totalTime;
    }

    return stats;
  }, [state.jobs]);

  const totalProgress = state.jobs.length > 0
    ? Math.round(state.jobs.reduce((sum, j) => sum + j.progress, 0) / state.jobs.length)
    : 0;

  return {
    state: { ...state, totalProgress },
    addJob,
    removeJob,
    updateJob,
    clearCompletedJobs,
    cancelAll,
    getStatistics,
  };
}
