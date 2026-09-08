import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type UpscaleModel = 
  | 'real-esrgan-x4plus'
  | 'real-esrgan-x4plus-anime'
  | 'real-esrgan-fast'
  | 'gfpgan'
  | 'codeformer'
  | 'basicvsr-plusplus';

export type EnhanceTarget = 
  | 'general'
  | 'face'
  | 'anime'
  | 'video';

export interface UpscaleSettings {
  enabled: boolean;
  model: UpscaleModel;
  scale: 2 | 4 | 8;
  target: EnhanceTarget;
  
  denoiseStrength: number;
  faceEnhance: boolean;
  faceEnhanceStrength: number;
  
  preserveOriginal: boolean;
  tileMode: 'auto' | 'none' | 'custom';
  tileSize: number;
  
  useGPU: boolean;
  gpuId: number;
}

export interface VideoEnhanceJob {
  id: string;
  clipId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  
  frameCount: number;
  processedFrames: number;
  
  settings: UpscaleSettings;
  outputUrl?: string;
  previewUrl?: string;
  error?: string;
  
  startTime: Date;
  endTime?: Date;
}

export interface QualityEnhanceState {
  settings: UpscaleSettings;
  jobs: VideoEnhanceJob[];
  activeJobId: string | null;
  compareMode: 'side-by-side' | 'overlay' | 'split';
}

interface QualityEnhanceStore extends QualityEnhanceState {
  updateSettings: (settings: Partial<UpscaleSettings>) => void;
  
  startEnhance: (clipId: string, width: number, height: number, frameCount: number) => string;
  updateJobProgress: (jobId: string, progress: number, processedFrames?: number) => void;
  completeJob: (jobId: string, outputUrl: string, previewUrl?: string) => void;
  failJob: (jobId: string, error: string) => void;
  removeJob: (jobId: string) => void;
  
  setActiveJob: (jobId: string | null) => void;
  setCompareMode: (mode: 'side-by-side' | 'overlay' | 'split') => void;
  
  getJobById: (jobId: string) => VideoEnhanceJob | undefined;
  getJobsByClip: (clipId: string) => VideoEnhanceJob[];
}

const DEFAULT_SETTINGS: UpscaleSettings = {
  enabled: false,
  model: 'real-esrgan-x4plus',
  scale: 4,
  target: 'general',
  
  denoiseStrength: 0,
  faceEnhance: false,
  faceEnhanceStrength: 50,
  
  preserveOriginal: true,
  tileMode: 'auto',
  tileSize: 0,
  
  useGPU: true,
  gpuId: 0,
};

const MODEL_OPTIONS: { id: UpscaleModel; name: string; description: string; speed: string }[] = [
  { id: 'real-esrgan-x4plus', name: 'Real-ESRGAN x4', description: '通用超分辨率模型', speed: '中等' },
  { id: 'real-esrgan-x4plus-anime', name: 'Real-ESRGAN Anime', description: '动画专用模型', speed: '中等' },
  { id: 'real-esrgan-fast', name: 'Real-ESRGAN Fast', description: '快速处理模式', speed: '快速' },
  { id: 'gfpgan', name: 'GFPGAN', description: '人脸增强专用', speed: '较慢' },
  { id: 'codeformer', name: 'CodeFormer', description: '高质量人脸修复', speed: '较慢' },
  { id: 'basicvsr-plusplus', name: 'BasicVSR++', description: '视频超分SOTA', speed: '慢' },
];

export const useQualityEnhanceStore = create<QualityEnhanceStore>()(
  immer((set, get) => ({
    settings: DEFAULT_SETTINGS,
    jobs: [],
    activeJobId: null,
    compareMode: 'side-by-side',

    updateSettings: (newSettings) =>
      set((state) => {
        Object.assign(state.settings, newSettings);
      }),

    startEnhance: (clipId, width, height, frameCount) => {
      const jobId = `enhance-${Date.now()}`;
      const job: VideoEnhanceJob = {
        id: jobId,
        clipId,
        status: 'pending',
        progress: 0,
        inputWidth: width,
        inputHeight: height,
        outputWidth: width * get().settings.scale,
        outputHeight: height * get().settings.scale,
        frameCount,
        processedFrames: 0,
        settings: { ...get().settings },
        startTime: new Date(),
      };

      set((state) => {
        state.jobs.push(job);
        state.activeJobId = jobId;
      });

      return jobId;
    },

    updateJobProgress: (jobId, progress, processedFrames) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.progress = progress;
          job.status = 'processing';
          if (processedFrames !== undefined) {
            job.processedFrames = processedFrames;
          }
        }
      }),

    completeJob: (jobId, outputUrl, previewUrl) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.outputUrl = outputUrl;
          job.previewUrl = previewUrl;
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

    removeJob: (jobId) =>
      set((state) => {
        state.jobs = state.jobs.filter((j) => j.id !== jobId);
      }),

    setActiveJob: (jobId) =>
      set((state) => {
        state.activeJobId = jobId;
      }),

    setCompareMode: (mode) =>
      set((state) => {
        state.compareMode = mode;
      }),

    getJobById: (jobId) => {
      return get().jobs.find((j) => j.id === jobId);
    },

    getJobsByClip: (clipId) => {
      return get().jobs.filter((j) => j.clipId === clipId);
    },
  }))
);

export class QualityEnhanceService {
  private static instance: QualityEnhanceService;

  static getInstance(): QualityEnhanceService {
    if (!QualityEnhanceService.instance) {
      QualityEnhanceService.instance = new QualityEnhanceService();
    }
    return QualityEnhanceService.instance;
  }

  getModelOptions() {
    return MODEL_OPTIONS;
  }

  getTargetOptions(): { id: EnhanceTarget; name: string }[] {
    return [
      { id: 'general', name: '通用' },
      { id: 'face', name: '人脸' },
      { id: 'anime', name: '动画' },
      { id: 'video', name: '视频' },
    ];
  }

  getScaleOptions(): { value: 2 | 4 | 8; label: string }[] {
    return [
      { value: 2, label: '2x' },
      { value: 4, label: '4x' },
      { value: 8, label: '8x' },
    ];
  }

  generateRealESRGANCommand(
    inputPath: string,
    outputPath: string,
    settings: UpscaleSettings
  ): string {
    let cmd = `realesrgan-ncnn-vulkan`;
    cmd += ` -i "${inputPath}"`;
    cmd += ` -o "${outputPath}"`;
    cmd += ` -n ${settings.model}`;
    cmd += ` -s ${settings.scale}`;
    
    if (settings.denoiseStrength > 0) {
      cmd += ` -d ${settings.denoiseStrength}`;
    }
    
    if (settings.useGPU) {
      cmd += ` -g ${settings.gpuId}`;
    }
    
    if (settings.tileMode === 'custom' && settings.tileSize > 0) {
      cmd += ` -t ${settings.tileSize}`;
    }

    return cmd;
  }

  generateGFPGANCommand(
    inputPath: string,
    outputPath: string,
    strength: number
  ): string {
    return `python inference_gfpgan.py ` +
      `-i "${inputPath}" ` +
      `-o "${outputPath}" ` +
      `-v 1.4 ` +
      `-s ${strength}`;
  }

  generateBasicVSRCommand(
    inputPath: string,
    outputPath: string,
    scale: number
  ): string {
    return `python inference_basicvsr.py ` +
      `-i "${inputPath}" ` +
      `-o "${outputPath}" ` +
      `-s ${scale}`;
  }

  estimateProcessingTime(
    frameCount: number,
    width: number,
    height: number,
    settings: UpscaleSettings
  ): number {
    const pixelCount = width * height;
    const baseTime = frameCount * (pixelCount / 1000000) * 0.1;
    
    const modelFactor = settings.model === 'basicvsr-plusplus' ? 3 :
                        settings.model.includes('gfpgan') || settings.model.includes('codeformer') ? 2 : 1;
    
    const scaleFactor = settings.scale;
    const gpuFactor = settings.useGPU ? 0.2 : 1;
    
    return Math.ceil(baseTime * modelFactor * scaleFactor * gpuFactor);
  }

  estimateMemoryUsage(
    width: number,
    height: number,
    scale: number,
    tileMode: string
  ): number {
    const outputPixels = width * scale * height * scale;
    const bytesPerPixel = 4;
    const frameMemory = outputPixels * bytesPerPixel;
    
    let tileFactor = 1;
    if (tileMode === 'none') {
      tileFactor = 1;
    } else if (tileMode === 'auto') {
      tileFactor = 0.5;
    }
    
    const totalMemory = frameMemory * tileFactor * 3;
    
    return Math.ceil(totalMemory / (1024 * 1024 * 1024));
  }

  calculateOutputResolution(
    inputWidth: number,
    inputHeight: number,
    scale: number
  ): { width: number; height: number } {
    return {
      width: inputWidth * scale,
      height: inputHeight * scale,
    };
  }
}

export const qualityEnhanceService = QualityEnhanceService.getInstance();
