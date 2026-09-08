import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type BeautyPreset = 
  | 'natural'
  | 'glamour'
  | 'korean'
  | 'western'
  | 'cinematic'
  | 'custom';

export type SkinSmoothMethod = 
  | 'bilateral'
  | 'gaussian'
  | 'surface-blur'
  | 'ai-denoise';

export type FaceShapeType = 
  | 'slim'
  | 'v-shape'
  | 'round'
  | 'natural';

export type EyeEnhanceType = 
  | 'brighten'
  | 'enlarge'
  | 'both'
  | 'none';

export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface FaceMesh {
  landmarks: FaceLandmark[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface BeautySettings {
  enabled: boolean;
  preset: BeautyPreset;
  
  skinSmooth: number;
  skinSmoothMethod: SkinSmoothMethod;
  skinWhiten: number;
  skinTone: number;
  
  faceSlim: number;
  faceShape: FaceShapeType;
  jawSlim: number;
  cheekSlim: number;
  
  eyeEnlarge: number;
  eyeBrighten: number;
  eyeEnhance: EyeEnhanceType;
  eyeBagRemove: number;
  
  noseSlim: number;
  noseBridge: number;
  
  lipColor: number;
  lipSaturation: number;
  lipGloss: number;
  
  eyebrowDense: number;
  eyebrowShape: number;
  
  acneRemove: boolean;
  spotRemove: boolean;
  wrinkleRemove: number;
  
  preserveSkinTexture: boolean;
  naturalLook: boolean;

  beautySafeAngle: number;
  beautyFaceRatioMin: number;
  beautyStrengthFade: number;
}

export interface BodyShapeSettings {
  enabled: boolean;
  
  overallSlim: number;
  height: number;
  proportion: number;
  
  shoulderWidth: number;
  waistSlim: number;
  hipWidth: number;
  
  armSlim: number;
  legSlim: number;
  legLength: number;
  
  breastEnhance: number;
  buttEnhance: number;
  
  postureCorrect: boolean;
  symmetryCorrect: boolean;
}

export interface FaceEnhanceJob {
  id: string;
  clipId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  frameCount: number;
  processedFrames: number;
  settings: BeautySettings;
  bodySettings: BodyShapeSettings;
  outputUrl?: string;
  error?: string;
}

export interface BeautyState {
  beautySettings: BeautySettings;
  bodySettings: BodyShapeSettings;
  faceMeshes: FaceMesh[];
  jobs: FaceEnhanceJob[];
  activeJobId: string | null;
  previewMode: 'before' | 'after' | 'compare';
}

interface BeautyStore extends BeautyState {
  updateBeautySettings: (settings: Partial<BeautySettings>) => void;
  updateBodySettings: (settings: Partial<BodyShapeSettings>) => void;
  applyPreset: (preset: BeautyPreset) => void;
  
  setFaceMeshes: (meshes: FaceMesh[]) => void;
  
  startEnhance: (clipId: string) => string;
  updateJobProgress: (jobId: string, progress: number, processedFrames?: number) => void;
  completeJob: (jobId: string, outputUrl: string) => void;
  failJob: (jobId: string, error: string) => void;
  removeJob: (jobId: string) => void;
  
  setPreviewMode: (mode: 'before' | 'after' | 'compare') => void;
  setActiveJob: (jobId: string | null) => void;
  
  resetBeautySettings: () => void;
  resetBodySettings: () => void;
}

const DEFAULT_BEAUTY_SETTINGS: BeautySettings = {
  enabled: false,
  preset: 'natural',
  
  skinSmooth: 30,
  skinSmoothMethod: 'bilateral',
  skinWhiten: 0,
  skinTone: 50,
  
  faceSlim: 0,
  faceShape: 'natural',
  jawSlim: 0,
  cheekSlim: 0,
  
  eyeEnlarge: 0,
  eyeBrighten: 0,
  eyeEnhance: 'none',
  eyeBagRemove: 0,
  
  noseSlim: 0,
  noseBridge: 0,
  
  lipColor: 0,
  lipSaturation: 50,
  lipGloss: 0,
  
  eyebrowDense: 0,
  eyebrowShape: 50,
  
  acneRemove: false,
  spotRemove: false,
  wrinkleRemove: 0,
  
  preserveSkinTexture: true,
  naturalLook: true,

  beautySafeAngle: 30,
  beautyFaceRatioMin: 0.2,
  beautyStrengthFade: 0.3,
};

const DEFAULT_BODY_SETTINGS: BodyShapeSettings = {
  enabled: false,
  
  overallSlim: 0,
  height: 100,
  proportion: 100,
  
  shoulderWidth: 100,
  waistSlim: 0,
  hipWidth: 100,
  
  armSlim: 0,
  legSlim: 0,
  legLength: 100,
  
  breastEnhance: 0,
  buttEnhance: 0,
  
  postureCorrect: false,
  symmetryCorrect: false,
};

const BEAUTY_PRESETS: Record<BeautyPreset, Partial<BeautySettings>> = {
  natural: {
    skinSmooth: 20,
    skinWhiten: 0,
    faceSlim: 0,
    eyeBrighten: 10,
    naturalLook: true,
  },
  glamour: {
    skinSmooth: 50,
    skinWhiten: 20,
    faceSlim: 15,
    eyeEnlarge: 10,
    eyeBrighten: 30,
    lipColor: 20,
    naturalLook: false,
  },
  korean: {
    skinSmooth: 40,
    skinWhiten: 30,
    faceSlim: 20,
    eyeEnlarge: 15,
    eyeBrighten: 25,
    lipColor: 15,
    naturalLook: true,
  },
  western: {
    skinSmooth: 25,
    skinWhiten: 0,
    faceSlim: 10,
    eyeBrighten: 15,
    lipSaturation: 60,
    naturalLook: true,
  },
  cinematic: {
    skinSmooth: 15,
    skinWhiten: 0,
    faceSlim: 5,
    eyeBrighten: 5,
    naturalLook: true,
    preserveSkinTexture: true,
  },
  custom: {},
};

export const useBeautyStore = create<BeautyStore>()(
  immer((set, get) => ({
    beautySettings: DEFAULT_BEAUTY_SETTINGS,
    bodySettings: DEFAULT_BODY_SETTINGS,
    faceMeshes: [],
    jobs: [],
    activeJobId: null,
    previewMode: 'after',

    updateBeautySettings: (newSettings) =>
      set((state) => {
        Object.assign(state.beautySettings, newSettings);
        if (newSettings.preset !== undefined || Object.keys(newSettings).length > 0) {
          state.beautySettings.preset = 'custom';
        }
      }),

    updateBodySettings: (newSettings) =>
      set((state) => {
        Object.assign(state.bodySettings, newSettings);
      }),

    applyPreset: (preset) =>
      set((state) => {
        const presetSettings = BEAUTY_PRESETS[preset];
        Object.assign(state.beautySettings, presetSettings, { preset });
      }),

    setFaceMeshes: (meshes) =>
      set((state) => {
        state.faceMeshes = meshes;
      }),

    startEnhance: (clipId) => {
      const jobId = `beauty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const job: FaceEnhanceJob = {
        id: jobId,
        clipId,
        status: 'pending',
        progress: 0,
        frameCount: 0,
        processedFrames: 0,
        settings: get().beautySettings,
        bodySettings: get().bodySettings,
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

    completeJob: (jobId, outputUrl) =>
      set((state) => {
        const job = state.jobs.find((j) => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.outputUrl = outputUrl;
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
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      }),

    removeJob: (jobId) =>
      set((state) => {
        state.jobs = state.jobs.filter((j) => j.id !== jobId);
      }),

    setPreviewMode: (mode) =>
      set((state) => {
        state.previewMode = mode;
      }),

    setActiveJob: (jobId) =>
      set((state) => {
        state.activeJobId = jobId;
      }),

    resetBeautySettings: () =>
      set((state) => {
        state.beautySettings = DEFAULT_BEAUTY_SETTINGS;
      }),

    resetBodySettings: () =>
      set((state) => {
        state.bodySettings = DEFAULT_BODY_SETTINGS;
      }),
  }))
);

export class BeautyService {
  private static instance: BeautyService;

  static getInstance(): BeautyService {
    if (!BeautyService.instance) {
      BeautyService.instance = new BeautyService();
    }
    return BeautyService.instance;
  }

  getBeautyPresets(): { id: BeautyPreset; name: string; description: string }[] {
    return [
      { id: 'natural', name: '自然', description: '轻微修饰，保持自然' },
      { id: 'glamour', name: '魅惑', description: '精致妆容，光彩照人' },
      { id: 'korean', name: '韩系', description: '清透白皙，韩式风格' },
      { id: 'western', name: '欧美', description: '立体轮廓，欧美风格' },
      { id: 'cinematic', name: '电影', description: '电影质感，保留细节' },
      { id: 'custom', name: '自定义', description: '自定义参数' },
    ];
  }

  getSkinSmoothMethods(): { id: SkinSmoothMethod; name: string }[] {
    return [
      { id: 'bilateral', name: '双边滤波' },
      { id: 'gaussian', name: '高斯模糊' },
      { id: 'surface-blur', name: '表面模糊' },
      { id: 'ai-denoise', name: 'AI降噪' },
    ];
  }

  getFaceShapes(): { id: FaceShapeType; name: string }[] {
    return [
      { id: 'natural', name: '自然' },
      { id: 'slim', name: '瘦脸' },
      { id: 'v-shape', name: 'V脸' },
      { id: 'round', name: '圆脸' },
    ];
  }

  getEyeEnhanceTypes(): { id: EyeEnhanceType; name: string }[] {
    return [
      { id: 'none', name: '无' },
      { id: 'brighten', name: '提亮' },
      { id: 'enlarge', name: '放大' },
      { id: 'both', name: '提亮+放大' },
    ];
  }

  applySkinSmooth(
    imageData: ImageData,
    landmarks: FaceLandmark[],
    settings: BeautySettings
  ): ImageData {
    const result = new ImageData(imageData.width, imageData.height);
    const data = imageData.data;
    const resultData = result.data;

    let effectiveSmooth = settings.skinSmooth;
    const faceProtection = this.calculateFaceProtection(imageData, landmarks, settings);
    if (faceProtection.shouldReduce) {
      effectiveSmooth = Math.round(effectiveSmooth * faceProtection.strengthMultiplier);
    }

    const smoothFactor = effectiveSmooth / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      resultData[i] = Math.round(data[i] * (1 - smoothFactor * 0.1) + 128 * smoothFactor * 0.1);
      resultData[i + 1] = Math.round(data[i + 1] * (1 - smoothFactor * 0.1) + 128 * smoothFactor * 0.1);
      resultData[i + 2] = Math.round(data[i + 2] * (1 - smoothFactor * 0.1) + 128 * smoothFactor * 0.1);
      resultData[i + 3] = data[i + 3];
    }

    return result;
  }

  applySkinWhiten(
    imageData: ImageData,
    landmarks: FaceLandmark[],
    intensity: number
  ): ImageData {
    const result = new ImageData(imageData.width, imageData.height);
    const data = imageData.data;
    const resultData = result.data;
    const factor = intensity / 100;

    for (let i = 0; i < data.length; i += 4) {
      resultData[i] = Math.min(255, data[i] + (255 - data[i]) * factor * 0.3);
      resultData[i + 1] = Math.min(255, data[i + 1] + (255 - data[i + 1]) * factor * 0.3);
      resultData[i + 2] = Math.min(255, data[i + 2] + (255 - data[i + 2]) * factor * 0.3);
      resultData[i + 3] = data[i + 3];
    }

    return result;
  }

  applyFaceSlim(
    imageData: ImageData,
    _landmarks: FaceLandmark[],
    _intensity: number
  ): ImageData {
    return imageData;
  }

  applyEyeEnlarge(
    imageData: ImageData,
    _eyeLandmarks: FaceLandmark[],
    _intensity: number
  ): ImageData {
    return imageData;
  }

  generateGFPGANCommand(
    inputPath: string,
    outputPath: string,
    settings: BeautySettings
  ): string {
    let command = `python inference_gfpgan.py`;
    command += ` -i "${inputPath}"`;
    command += ` -o "${outputPath}"`;
    command += ` -v 1.4`;
    command += ` -s ${settings.skinSmooth}`;
    
    if (settings.skinWhiten > 0) {
      command += ` --whiten ${settings.skinWhiten}`;
    }

    return command;
  }

  generateMediaPipeConfig() {
    return {
      faceMesh: {
        maxNumFaces: 5,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      },
      selfieSegmentation: {
        modelSelection: 1,
      },
    };
  }

  estimateProcessingTime(
    frameCount: number,
    settings: BeautySettings,
    bodySettings: BodyShapeSettings
  ): number {
    let baseTime = frameCount * 0.05;

    if (settings.skinSmooth > 50) baseTime *= 1.2;
    if (settings.faceSlim > 0) baseTime *= 1.3;
    if (settings.eyeEnlarge > 0) baseTime *= 1.2;
    if (bodySettings.enabled) baseTime *= 1.5;

    return Math.ceil(baseTime);
  }

  private calculateFaceProtection(
    imageData: ImageData,
    landmarks: FaceLandmark[],
    settings: BeautySettings
  ): { shouldReduce: boolean; strengthMultiplier: number } {
    if (landmarks.length === 0) {
      return { shouldReduce: false, strengthMultiplier: 1.0 };
    }

    const faceAngle = this.estimateFaceAngle(landmarks);
    const faceRatio = this.estimateFaceRatio(imageData, landmarks);

    let multiplier = 1.0;
    let shouldReduce = false;

    if (Math.abs(faceAngle) > settings.beautySafeAngle) {
      const excessAngle = Math.abs(faceAngle) - settings.beautySafeAngle;
      const anglePenalty = Math.min(excessAngle / 60, 1.0);
      multiplier *= (1 - anglePenalty * (1 - settings.beautyStrengthFade));
      shouldReduce = true;
    }

    if (faceRatio < settings.beautyFaceRatioMin) {
      const ratioPenalty = 1 - (faceRatio / settings.beautyFaceRatioMin);
      multiplier *= (1 - ratioPenalty * (1 - settings.beautyStrengthFade));
      shouldReduce = true;
    }

    return { shouldReduce, strengthMultiplier: Math.max(multiplier, settings.beautyStrengthFade) };
  }

  private estimateFaceAngle(landmarks: FaceLandmark[]): number {
    if (landmarks.length < 6) return 0;

    const noseTip = landmarks[4];
    const leftEye = landmarks[1];
    const rightEye = landmarks[2];

    if (!noseTip || !leftEye || !rightEye) return 0;

    const eyeCenter = (leftEye.x + rightEye.x) / 2;
    const deviation = noseTip.x - eyeCenter;
    const eyeDistance = Math.abs(rightEye.x - leftEye.x);

    if (eyeDistance === 0) return 0;

    return (deviation / eyeDistance) * 90;
  }

  private estimateFaceRatio(imageData: ImageData, landmarks: FaceLandmark[]): number {
    if (landmarks.length < 10) return 0.5;

    const faceLandmarks = landmarks.slice(0, 10);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const lm of faceLandmarks) {
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }

    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const faceArea = faceWidth * faceHeight;
    const imageArea = imageData.width * imageData.height;

    return imageArea > 0 ? faceArea / imageArea : 0.5;
  }
}

export const beautyService = BeautyService.getInstance();
