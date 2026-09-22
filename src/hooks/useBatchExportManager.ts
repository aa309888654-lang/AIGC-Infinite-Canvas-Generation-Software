/**
 * 批量导出管理Hook
 * 支持导出队列管理、优先级控制、历史记录
 */

import { useState, useCallback, useRef } from 'react';

export type ExportJobStatus =
  | 'queued'
  | 'preparing'
  | 'exporting'
  | 'muxing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type ExportPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ExportJob {
  id: string;
  inputPath: string;
  outputPath: string;
  status: ExportJobStatus;
  priority: ExportPriority;
  progress: number;
  currentStage: string;
  stages: ExportStage[];
  settings: ExportSettings;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedTimeRemaining?: number;
  outputSize?: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface ExportStage {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  duration?: number;
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mkv' | 'avi';
  codec: string;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution: { width: number; height: number };
  fps: number;
  audioCodec: string;
  audioBitrate: number;
  videoBitrate: number;
  customArgs?: string;
}

export interface ExportHistory {
  id: string;
  inputPath: string;
  outputPath: string;
  status: ExportJobStatus;
  settings: ExportSettings;
  outputSize?: number;
  duration?: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface BatchExportState {
  jobs: ExportJob[];
  history: ExportHistory[];
  currentJobId: string | null;
  isProcessing: boolean;
  maxConcurrent: number;
  currentConcurrent: number;
  stats: ExportStats;
}

export interface ExportStats {
  totalExports: number;
  completedExports: number;
  failedExports: number;
  cancelledExports: number;
  totalOutputSize: number;
  averageExportTime: number;
  lastExportAt?: number;
}

export interface BatchExportConfig {
  maxConcurrent: number;
  autoStart: boolean;
  continueOnError: boolean;
  saveHistory: boolean;
  maxHistoryItems: number;
  notificationEnabled: boolean;
}

const DEFAULT_CONFIG: BatchExportConfig = {
  maxConcurrent: 2,
  autoStart: false,
  continueOnError: true,
  saveHistory: true,
  maxHistoryItems: 100,
  notificationEnabled: true,
};

const DEFAULT_STAGES: ExportStage[] = [
  { name: '准备', status: 'pending', progress: 0 },
  { name: '视频编码', status: 'pending', progress: 0 },
  { name: '音频编码', status: 'pending', progress: 0 },
  { name: '封装', status: 'pending', progress: 0 },
  { name: '完成', status: 'pending', progress: 0 },
];

export function useBatchExportManager(config: Partial<BatchExportConfig> = {}) {
  const [state, setState] = useState<BatchExportState>({
    jobs: [],
    history: [],
    currentJobId: null,
    isProcessing: false,
    maxConcurrent: config.maxConcurrent || DEFAULT_CONFIG.maxConcurrent,
    currentConcurrent: 0,
    stats: {
      totalExports: 0,
      completedExports: 0,
      failedExports: 0,
      cancelledExports: 0,
      totalOutputSize: 0,
      averageExportTime: 0,
    },
  });

  const [configState, setConfigState] = useState<BatchExportConfig>({
    ...DEFAULT_CONFIG,
    ...config,
  });

  const processingRef = useRef<boolean>(false);
  const jobTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const _listenersRef = useRef<Map<string, Set<(event: string, data: unknown) => void>>>(new Map());

  const addJob = useCallback((
    inputPath: string,
    outputPath: string,
    settings: ExportSettings,
    options?: { priority?: ExportPriority; metadata?: Record<string, unknown> }
  ): string => {
    const id = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: ExportJob = {
      id,
      inputPath,
      outputPath,
      status: 'queued',
      priority: options?.priority || 'normal',
      progress: 0,
      currentStage: '准备',
      stages: DEFAULT_STAGES.map(s => ({ ...s })),
      settings,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      metadata: options?.metadata,
    };

    setState(prev => {
      const newJobs = [...prev.jobs, job];
      const sortedJobs = sortJobsByPriority(newJobs);
      return {
        ...prev,
        jobs: sortedJobs,
        stats: {
          ...prev.stats,
          totalExports: prev.stats.totalExports + 1,
        },
      };
    });

    if (configState.autoStart) {
      processQueue();
    }

    return id;
  }, [configState.autoStart]);

  const sortJobsByPriority = (jobs: ExportJob[]): ExportJob[] => {
    const priorityOrder: Record<ExportPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    return [...jobs].sort((a, b) => {
      if (a.status === 'queued' && b.status !== 'queued') return 1;
      if (a.status !== 'queued' && b.status === 'queued') return -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  const processQueue = useCallback(() => {
    if (processingRef.current) return;

    setState(prev => {
      if (prev.isProcessing) return prev;

      const availableSlots = prev.maxConcurrent - prev.currentConcurrent;
      if (availableSlots <= 0) return prev;

      const queuedJobs = prev.jobs
        .filter(j => j.status === 'queued')
        .slice(0, availableSlots);

      if (queuedJobs.length === 0) {
        return { ...prev, isProcessing: false };
      }

      processingRef.current = true;

      const newJobs = prev.jobs.map(job => {
        const shouldStart = queuedJobs.some(j => j.id === job.id);
        if (shouldStart) {
          startExportSimulation(job.id);
          return { ...job, status: 'preparing' as ExportJobStatus, startedAt: Date.now() };
        }
        return job;
      });

      return {
        ...prev,
        jobs: newJobs,
        isProcessing: true,
        currentConcurrent: prev.currentConcurrent + queuedJobs.length,
      };
    });
  }, []);

  const startExportSimulation = useCallback((jobId: string) => {
    const stages = ['准备', '视频编码', '音频编码', '封装', '完成'];
    let progress = 0;

    const timer = setInterval(() => {
      progress += Math.random() * 5 + 2;

      if (progress >= 100) {
        clearInterval(timer);
        jobTimersRef.current.delete(jobId);
        completeJob(jobId);
        return;
      }

      const stageIndex = Math.min(Math.floor(progress / 20), stages.length - 1);

      setState(prev => {
        const jobIndex = prev.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return prev;

        const newStages = stages.map((name, i) => {
          if (i < stageIndex) {
            return { name, status: 'completed' as const, progress: 100, duration: 2000 };
          } else if (i === stageIndex) {
            const stageProgress = (progress % 20) * 5;
            return { name, status: 'processing' as const, progress: stageProgress };
          } else {
            return { name, status: 'pending' as const, progress: 0 };
          }
        });

        const newJobs = prev.jobs.map((j, i) =>
          i === jobIndex
            ? {
                ...j,
                progress,
                currentStage: stages[stageIndex],
                stages: newStages,
                status: 'exporting' as ExportJobStatus,
                estimatedTimeRemaining: Math.ceil((100 - progress) * 0.5),
                outputSize: Math.ceil(progress * 50),
              }
            : j
        );

        return { ...prev, jobs: newJobs };
      });
    }, 300);

    jobTimersRef.current.set(jobId, timer);
  }, []);

  const completeJob = useCallback((jobId: string) => {
    setState(prev => {
      const jobIndex = prev.jobs.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return prev;

      const job = prev.jobs[jobIndex];

      const completedJob: ExportJob = {
        ...job,
        status: 'completed',
        progress: 100,
        currentStage: '完成',
        completedAt: Date.now(),
        stages: job.stages.map(s => ({ ...s, status: 'completed' as const, progress: 100 })),
      };

      const newJobs = prev.jobs.map((j, i) => i === jobIndex ? completedJob : j);
      const newConcurrent = Math.max(0, prev.currentConcurrent - 1);

      return {
        ...prev,
        jobs: newJobs,
        currentConcurrent: newConcurrent,
        stats: {
          ...prev.stats,
          completedExports: prev.stats.completedExports + 1,
          totalOutputSize: prev.stats.totalOutputSize + (job.outputSize || 0),
          averageExportTime: job.completedAt && job.startedAt
            ? (prev.stats.averageExportTime * prev.stats.completedExports + (job.completedAt - job.startedAt)) / (prev.stats.completedExports + 1)
            : prev.stats.averageExportTime,
          lastExportAt: Date.now(),
        },
      };
    });

    processingRef.current = false;
    processQueue();
  }, [processQueue]);

  const _addToHistory = useCallback((jobId: string) => {
    setState(prev => {
      const job = prev.jobs.find(j => j.id === jobId);
      if (!job) return prev;

      const historyEntry: ExportHistory = {
        id: job.id,
        inputPath: job.inputPath,
        outputPath: job.outputPath,
        status: job.status,
        settings: job.settings,
        outputSize: job.outputSize,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.error,
      };

      let newHistory = [historyEntry, ...prev.history];

      if (newHistory.length > configState.maxHistoryItems) {
        newHistory = newHistory.slice(0, configState.maxHistoryItems);
      }

      return { ...prev, history: newHistory };
    });
  }, [configState.maxHistoryItems]);

  return {
    state,
    config: configState,
    addJob,
    processQueue,
    getJobStats: () => ({
      total: state.jobs.length,
      queued: state.jobs.filter(j => j.status === 'queued').length,
      processing: state.jobs.filter(j => ['preparing', 'exporting', 'muxing', 'finalizing'].includes(j.status)).length,
      completed: state.jobs.filter(j => j.status === 'completed').length,
      failed: state.jobs.filter(j => j.status === 'failed').length,
    }),
  };
}
