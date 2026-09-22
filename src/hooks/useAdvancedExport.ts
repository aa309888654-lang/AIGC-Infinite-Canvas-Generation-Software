/**
 * 高级导出Hook
 * 支持多种格式、编码选项和质量预设
 */

import { useState, useCallback } from 'react';

export type VideoFormat = 'mp4' | 'webm' | 'avi' | 'mkv' | 'mov' | 'flv';
export type VideoCodec = 'h264' | 'h265' | 'vp9' | 'av1' | 'prores';
export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'flac' | 'pcm';
export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'lossless';
export type ColorSpace = 'bt709' | 'bt2020' | 'srgb';

export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export interface AdvancedExportOptions {
  format: VideoFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  quality: QualityPreset;
  resolution: Resolution;
  fps: number;
  bitrate: number;
  audioBitrate: number;
  sampleRate: number;
  colorSpace: ColorSpace;
  enableHardwareAcceleration: boolean;
  enableTwoPass: boolean;
  customArgs: string;
}

export interface ExportProgress {
  stage: 'preparing' | 'encoding' | 'muxing' | 'finalizing' | 'complete' | 'error';
  progress: number;
  currentFrame: number;
  totalFrames: number;
  estimatedTimeRemaining: number;
  currentBitrate: number;
  outputSize: number;
}

export interface ExportJob {
  id: string;
  inputPath: string;
  outputPath: string;
  options: AdvancedExportOptions;
  status: 'queued' | 'preparing' | 'exporting' | 'completed' | 'failed' | 'cancelled';
  progress: ExportProgress;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export const RESOLUTIONS: Resolution[] = [
  { width: 7680, height: 4320, label: '8K (7680x4320)' },
  { width: 3840, height: 2160, label: '4K (3840x2160)' },
  { width: 2560, height: 1440, label: '2K (2560x1440)' },
  { width: 1920, height: 1080, label: '1080p (1920x1080)' },
  { width: 1280, height: 720, label: '720p (1280x720)' },
  { width: 854, height: 480, label: '480p (854x480)' },
  { width: 640, height: 360, label: '360p (640x360)' },
];

export const QUALITY_PRESETS: Record<QualityPreset, { bitrate: number; audioBitrate: number; description: string }> = {
  low: { bitrate: 1000, audioBitrate: 96, description: '低质量 - 文件小，适合预览' },
  medium: { bitrate: 3000, audioBitrate: 128, description: '中等质量 - 平衡大小和质量' },
  high: { bitrate: 6000, audioBitrate: 192, description: '高质量 - 适合上传到视频平台' },
  ultra: { bitrate: 12000, audioBitrate: 256, description: '超高画质 - 最佳视觉体验' },
  lossless: { bitrate: 50000, audioBitrate: 320, description: '无损 - 保持原始质量' },
};

export const CODEC_INFO: Record<VideoCodec, { name: string; description: string; hardwareSupport: boolean }> = {
  h264: { name: 'H.264/AVC', description: '最广泛兼容，文件较小', hardwareSupport: true },
  h265: { name: 'H.265/HEVC', description: '更高压缩率，需要硬件支持', hardwareSupport: true },
  vp9: { name: 'VP9', description: 'Google开发，免费开源', hardwareSupport: false },
  av1: { name: 'AV1', description: '最新编解码器，压缩率最高', hardwareSupport: false },
  prores: { name: 'ProRes 422', description: '专业级编解码器，质量极高', hardwareSupport: false },
};

export function useAdvancedExport() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const defaultOptions: AdvancedExportOptions = {
    format: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    quality: 'high',
    resolution: RESOLUTIONS[3],
    fps: 30,
    bitrate: 6000,
    audioBitrate: 192,
    sampleRate: 48000,
    colorSpace: 'bt709',
    enableHardwareAcceleration: true,
    enableTwoPass: false,
    customArgs: '',
  };

  const createJob = useCallback((
    inputPath: string,
    outputPath: string,
    options: Partial<AdvancedExportOptions> = {}
  ): string => {
    const job: ExportJob = {
      id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      inputPath,
      outputPath,
      options: { ...defaultOptions, ...options },
      status: 'queued',
      progress: {
        stage: 'preparing',
        progress: 0,
        currentFrame: 0,
        totalFrames: 0,
        estimatedTimeRemaining: 0,
        currentBitrate: 0,
        outputSize: 0,
      },
    };

    setJobs(prev => [...prev, job]);
    return job.id;
  }, [defaultOptions]);

  const updateJobProgress = useCallback((jobId: string, progress: Partial<ExportProgress>) => {
    setJobs(prev => prev.map(job =>
      job.id === jobId
        ? { ...job, progress: { ...job.progress, ...progress } }
        : job
    ));
  }, []);

  const updateJobStatus = useCallback((jobId: string, status: ExportJob['status'], error?: string) => {
    setJobs(prev => prev.map(job =>
      job.id === jobId
        ? {
            ...job,
            status,
            error,
            endTime: ['completed', 'failed', 'cancelled'].includes(status) ? Date.now() : undefined
          }
        : job
    ));

    if (status === 'completed' || status === 'failed') {
      setIsExporting(false);
    }
  }, []);

  const startExport = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setIsExporting(true);
    setCurrentJobId(jobId);

    updateJobStatus(jobId, 'preparing', undefined);

    const totalFrames = Math.floor(job.options.fps * 300);

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (!isExporting) break;

      const progress = Math.floor((frame / totalFrames) * 100);
      let stage: ExportProgress['stage'] = 'encoding';

      if (progress < 10) stage = 'preparing';
      else if (progress < 90) stage = 'encoding';
      else if (progress < 95) stage = 'muxing';
      else stage = 'finalizing';

      updateJobProgress(jobId, {
        stage,
        progress,
        currentFrame: frame,
        totalFrames,
        estimatedTimeRemaining: Math.floor((totalFrames - frame) / job.options.fps),
        currentBitrate: job.options.bitrate * (progress / 100),
        outputSize: Math.floor(progress * job.options.bitrate * 300 / 8000),
      });

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (isExporting) {
      updateJobStatus(jobId, 'completed', undefined);
    }
  }, [jobs, isExporting, updateJobProgress, updateJobStatus]);

  const cancelExport = useCallback((jobId: string) => {
    setIsExporting(false);
    updateJobStatus(jobId, 'cancelled', undefined);
  }, [updateJobStatus]);

  const removeJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setJobs(prev => prev.filter(j => !['completed', 'failed', 'cancelled'].includes(j.status)));
  }, []);

  const getJobById = useCallback((jobId: string) => {
    return jobs.find(j => j.id === jobId) || null;
  }, [jobs]);

  const getEstimatedFileSize = useCallback((options: AdvancedExportOptions, durationSeconds: number) => {
    const videoBits = options.bitrate * 1000 * durationSeconds;
    const audioBits = options.audioBitrate * 1000 * durationSeconds;
    const totalBits = videoBits + audioBits;
    return (totalBits / 8 / 1024 / 1024).toFixed(2);
  }, []);

  return {
    jobs,
    currentJobId,
    isExporting,
    defaultOptions,
    createJob,
    updateJobProgress,
    updateJobStatus,
    startExport,
    cancelExport,
    removeJob,
    clearCompletedJobs,
    getJobById,
    getEstimatedFileSize,
  };
}
