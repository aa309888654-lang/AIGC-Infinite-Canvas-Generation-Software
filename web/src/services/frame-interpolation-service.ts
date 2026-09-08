import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type InterpolationMode = '2x' | '4x' | '8x' | 'custom';

export type FlowModel = 
  | 'rife-v4.6'
  | 'rife-v4.7'
  | 'rife-v4.8'
  | 'rife-v4.9'
  | 'rife-v4.10';

export type SlowMotionPreset = 
  | '2x-slow'
  | '4x-slow'
  | '8x-slow'
  | 'cinematic'
  | 'action'
  | 'custom';

export interface InterpolationSettings {
  enabled: boolean;
  mode: InterpolationMode;
  customMultiplier: number;
  model: FlowModel;
  useGPU: boolean;
  gpuId: number;
  preserveAudio: boolean;
  audioPitchShift: boolean;
}

export interface SlowMotionSettings {
  enabled: boolean;
  preset: SlowMotionPreset;
  speedFactor: number;
  startTime: number;
  endTime: number;
  useOpticalFlow: boolean;
  motionBlur: number;
  quality: 'fast' | 'balanced' | 'quality';
}

export interface FrameInterpolationJob {
  id: string;
  clipId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  inputFrames: number;
  outputFrames: number;
  settings: InterpolationSettings;
  outputUrl?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface OpticalFlowResult {
  clipId: string;
  flowData: Float32Array;
  width: number;
  height: number;
  processingTime: number;
}

export interface FrameInterpolationState {
  settings: InterpolationSettings;
  slowMotionSettings: SlowMotionSettings;
  jobs: FrameInterpolationJob[];
  activeJobId: string | null;
  presets: SlowMotionPreset[];
}

interface FrameInterpolationStore extends FrameInterpolationState {
  updateSettings: (settings: Partial<InterpolationSettings>) => void;
  updateSlowMotionSettings: (settings: Partial<SlowMotionSettings>) => void;
  
  startInterpolation: (clipId: string) => string;
  updateJobProgress: (jobId: string, progress: number, outputFrames?: number) => void;
  completeJob: (jobId: string, outputUrl: string) => void;
  failJob: (jobId: string, error: string) => void;
  cancelJob: (jobId: string) => void;
  removeJob: (jobId: string) => void;
  
  setActiveJob: (jobId: string | null) => void;
  getJobById: (jobId: string) => FrameInterpolationJob | undefined;
  getJobsByClip: (clipId: string) => FrameInterpolationJob[];
  
  calculateOutputFrames: (inputFrames: number, mode: InterpolationMode, customMultiplier?: number) => number;
  getSlowMotionSpeed: (preset: SlowMotionPreset) => number;
}

const DEFAULT_INTERPOLATION_SETTINGS: InterpolationSettings = {
  enabled: false,
  mode: '2x',
  customMultiplier: 3,
  model: 'rife-v4.10',
  useGPU: true,
  gpuId: 0,
  preserveAudio: true,
  audioPitchShift: true,
};

const DEFAULT_SLOW_MOTION_SETTINGS: SlowMotionSettings = {
  enabled: false,
  preset: '2x-slow',
  speedFactor: 0.5,
  startTime: 0,
  endTime: 0,
  useOpticalFlow: true,
  motionBlur: 0,
  quality: 'balanced',
};

const SLOW_MOTION_PRESETS: { id: SlowMotionPreset; name: string; speed: number; description: string }[] = [
  { id: '2x-slow', name: '2倍慢动作', speed: 0.5, description: '流畅的慢动作效果' },
  { id: '4x-slow', name: '4倍慢动作', speed: 0.25, description: '电影级慢动作' },
  { id: '8x-slow', name: '8倍慢动作', speed: 0.125, description: '极致慢动作细节' },
  { id: 'cinematic', name: '电影感', speed: 0.4, description: '电影风格慢动作' },
  { id: 'action', name: '动作特写', speed: 0.2, description: '动作场景慢放' },
  { id: 'custom', name: '自定义', speed: 0.5, description: '自定义速度' },
];

export const useFrameInterpolationStore = create<FrameInterpolationStore>()(
  immer((set, get) => ({
    settings: DEFAULT_INTERPOLATION_SETTINGS,
    slowMotionSettings: DEFAULT_SLOW_MOTION_SETTINGS,
    jobs: [],
    activeJobId: null,
    presets: ['2x-slow', '4x-slow', '8x-slow', 'cinematic', 'action', 'custom'],

    updateSettings: (newSettings) =>
      set((state) => {
        Object.assign(state.settings, newSettings);
      }),

    updateSlowMotionSettings: (newSettings) =>
      set((state) => {
        Object.assign(state.slowMotionSettings, newSettings);
      }),

    startInterpolation: (clipId) => {
      const jobId = `interp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const job: FrameInterpolationJob = {
        id: jobId,
        clipId,
        status: 'pending',
        progress: 0,
        inputFrames: 0,
        outputFrames: 0,
        settings: get().settings,
        startTime: new Date(),
      };

      set((state) => {
        state.jobs.push(job);
        state.activeJobId = jobId;
      });

      return jobId;
    },

    updateJobProgress: (jobId, progress, outputFrames) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.progress = progress;
          job.status = 'processing';
          if (outputFrames !== undefined) {
            job.outputFrames = outputFrames;
          }
        }
      }),

    completeJob: (jobId, outputUrl) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.outputUrl = outputUrl;
          job.endTime = new Date();
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    failJob: (jobId, error) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error;
          job.endTime = new Date();
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    cancelJob: (jobId) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job && job.status === 'processing') {
          job.status = 'failed';
          job.error = 'Cancelled by user';
          job.endTime = new Date();
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    removeJob: (jobId) =>
      set((state) => {
        state.jobs = state.jobs.filter((j) => j.id !== jobId);
      }),

    setActiveJob: (jobId) =>
      set((state) => {
        state.activeJobId = jobId;
      }),

    getJobById: (jobId) => {
      return get().jobs.find((j) => j.id === jobId);
    },

    getJobsByClip: (clipId) => {
      return get().jobs.filter((j) => j.clipId === clipId);
    },

    calculateOutputFrames: (inputFrames, mode, customMultiplier) => {
      const multipliers: Record<InterpolationMode, number> = {
        '2x': 2,
        '4x': 4,
        '8x': 8,
        custom: customMultiplier || 3,
      };
      return Math.floor(inputFrames * multipliers[mode]);
    },

    getSlowMotionSpeed: (preset) => {
      const presetData = SLOW_MOTION_PRESETS.find((p) => p.id === preset);
      return presetData?.speed || 0.5;
    },
  }))
);

export class FrameInterpolationService {
  private static instance: FrameInterpolationService;

  static getInstance(): FrameInterpolationService {
    if (!FrameInterpolationService.instance) {
      FrameInterpolationService.instance = new FrameInterpolationService();
    }
    return FrameInterpolationService.instance;
  }

  getSlowMotionPresets() {
    return SLOW_MOTION_PRESETS;
  }

  getSlowMotionSpeed(preset: SlowMotionPreset): number {
    const presetData = SLOW_MOTION_PRESETS.find((p) => p.id === preset);
    return presetData?.speed || 0.5;
  }

  getModelNames(): { id: FlowModel; name: string; description: string }[] {
    return [
      { id: 'rife-v4.6', name: 'RIFE v4.6', description: '稳定版本，兼容性好' },
      { id: 'rife-v4.7', name: 'RIFE v4.7', description: '改进运动估计' },
      { id: 'rife-v4.8', name: 'RIFE v4.8', description: '更快处理速度' },
      { id: 'rife-v4.9', name: 'RIFE v4.9', description: '更高质量输出' },
      { id: 'rife-v4.10', name: 'RIFE v4.10', description: '最新版本，最佳效果' },
    ];
  }

  getQualityPresets(): { id: string; name: string; speed: number; quality: number }[] {
    return [
      { id: 'fast', name: '快速', speed: 1.5, quality: 0.8 },
      { id: 'balanced', name: '平衡', speed: 1.0, quality: 0.9 },
      { id: 'quality', name: '高质量', speed: 0.5, quality: 1.0 },
    ];
  }

  generateFFmpegFilter(settings: SlowMotionSettings): string {
    const filters: string[] = [];

    if (settings.useOpticalFlow) {
      filters.push(`minterpolate=mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=${60 / settings.speedFactor}`);
    } else {
      filters.push(`setpts=${1 / settings.speedFactor}*PTS`);
    }

    if (settings.motionBlur > 0) {
      filters.push(`tmix=frames=${settings.motionBlur}:weights=1`);
    }

    return filters.join(',');
  }

  generateRIFECommand(
    inputPath: string,
    outputPath: string,
    settings: InterpolationSettings
  ): string {
    const multiplier = settings.mode === 'custom' 
      ? settings.customMultiplier 
      : parseInt(settings.mode);

    let command = `rife-ncnn-vulkan`;
    command += ` -i "${inputPath}"`;
    command += ` -o "${outputPath}"`;
    command += ` -m ${settings.model}`;
    command += ` -n ${multiplier}`;
    
    if (settings.useGPU) {
      command += ` -g ${settings.gpuId}`;
    }

    return command;
  }

  async interpolateFrames(
    frames: ImageData[],
    settings: InterpolationSettings,
    onProgress: (progress: number) => void
  ): Promise<ImageData[]> {
    const multiplier = settings.mode === 'custom' 
      ? settings.customMultiplier 
      : parseInt(settings.mode);

    const outputFrames: ImageData[] = [];
    const totalSteps = frames.length - 1;

    for (let i = 0; i < frames.length - 1; i++) {
      const frame1 = frames[i];
      const frame2 = frames[i + 1];

      outputFrames.push(frame1);

      for (let j = 1; j < multiplier; j++) {
        const t = j / multiplier;
        const interpolated = this.interpolateFrame(frame1, frame2, t);
        outputFrames.push(interpolated);
      }

      onProgress((i / totalSteps) * 100);
    }

    outputFrames.push(frames[frames.length - 1]);
    onProgress(100);

    return outputFrames;
  }

  private interpolateFrame(frame1: ImageData, frame2: ImageData, t: number): ImageData {
    const result = new ImageData(frame1.width, frame1.height);
    const data1 = frame1.data;
    const data2 = frame2.data;
    const resultData = result.data;

    for (let i = 0; i < data1.length; i += 4) {
      resultData[i] = Math.round(data1[i] * (1 - t) + data2[i] * t);
      resultData[i + 1] = Math.round(data1[i + 1] * (1 - t) + data2[i + 1] * t);
      resultData[i + 2] = Math.round(data1[i + 2] * (1 - t) + data2[i + 2] * t);
      resultData[i + 3] = Math.round(data1[i + 3] * (1 - t) + data2[i + 3] * t);
    }

    return result;
  }

  estimateProcessingTime(
    inputFrames: number,
    settings: InterpolationSettings,
    fps: number = 30
  ): number {
    const multiplier = settings.mode === 'custom' 
      ? settings.customMultiplier 
      : parseInt(settings.mode);

    const qualityFactor = settings.model.includes('v4.10') ? 1.2 : 
                          settings.model.includes('v4.9') ? 1.1 : 1.0;

    const gpuFactor = settings.useGPU ? 0.3 : 1.0;

    const baseTime = (inputFrames * multiplier * qualityFactor * gpuFactor) / fps;
    
    return Math.ceil(baseTime);
  }

  calculateRequiredMemory(
    width: number,
    height: number,
    inputFrames: number,
    settings: InterpolationSettings
  ): number {
    const multiplier = settings.mode === 'custom' 
      ? settings.customMultiplier 
      : parseInt(settings.mode);

    const frameSize = width * height * 4;
    const totalFrames = inputFrames * multiplier;
    const memoryBytes = frameSize * totalFrames * 2;

    return Math.ceil(memoryBytes / (1024 * 1024 * 1024));
  }
}

export const frameInterpolationService = FrameInterpolationService.getInstance();
