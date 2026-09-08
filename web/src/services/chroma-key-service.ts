import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface ChromaKeySettings {
  id: string;
  clipId: string;
  enabled: boolean;
  keyColor: { r: number; g: number; b: number };
  similarity: number;
  blend: number;
  spill: number;
  spillSuppress: number;
  edgeSoftness: number;
  edgeFeather: number;
  maskBlur: number;
  invertMask: boolean;
  showMask: boolean;
  colorSpace: 'rgb' | 'hsv' | 'lab';
  toleranceMode: 'simple' | 'advanced' | 'ai';
}

export interface ChromaKeyPreset {
  id: string;
  name: string;
  description: string;
  settings: Omit<ChromaKeySettings, 'id' | 'clipId'>;
  thumbnail?: string;
}

export interface ColorSample {
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
}

export interface ChromaKeyState {
  settings: ChromaKeySettings[];
  presets: ChromaKeyPreset[];
  selectedClipId: string | null;
  colorSamples: ColorSample[];
  isProcessing: boolean;
  previewMask: boolean;
}

interface ChromaKeyStore extends ChromaKeyState {
  setSettings: (clipId: string, settings: Partial<ChromaKeySettings>) => void;
  getSettings: (clipId: string) => ChromaKeySettings | undefined;
  enableChromaKey: (clipId: string) => void;
  disableChromaKey: (clipId: string) => void;
  resetSettings: (clipId: string) => void;
  
  addColorSample: (sample: ColorSample) => void;
  removeColorSample: (index: number) => void;
  clearColorSamples: () => void;
  pickColorFromSamples: () => { r: number; g: number; b: number } | null;
  
  applyPreset: (clipId: string, presetId: string) => void;
  saveAsPreset: (name: string, description: string, settings: ChromaKeySettings) => void;
  removePreset: (presetId: string) => void;
  
  setSelectedClipId: (clipId: string | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setPreviewMask: (preview: boolean) => void;
}

const DEFAULT_CHROMA_KEY_SETTINGS: Omit<ChromaKeySettings, 'id' | 'clipId'> = {
  enabled: true,
  keyColor: { r: 0, g: 255, b: 0 },
  similarity: 0.4,
  blend: 0.1,
  spill: 0.2,
  spillSuppress: 0.5,
  edgeSoftness: 0.1,
  edgeFeather: 2,
  maskBlur: 1,
  invertMask: false,
  showMask: false,
  colorSpace: 'hsv',
  toleranceMode: 'advanced',
};

const BUILTIN_PRESETS: ChromaKeyPreset[] = [
  {
    id: 'green-screen-standard',
    name: '标准绿幕',
    description: '适用于标准绿幕背景',
    settings: {
      enabled: true,
      keyColor: { r: 0, g: 255, b: 0 },
      similarity: 0.4,
      blend: 0.1,
      spill: 0.2,
      spillSuppress: 0.5,
      edgeSoftness: 0.1,
      edgeFeather: 2,
      maskBlur: 1,
      invertMask: false,
      showMask: false,
      colorSpace: 'hsv',
      toleranceMode: 'advanced',
    },
  },
  {
    id: 'blue-screen-standard',
    name: '标准蓝幕',
    description: '适用于标准蓝幕背景',
    settings: {
      enabled: true,
      keyColor: { r: 0, g: 0, b: 255 },
      similarity: 0.4,
      blend: 0.1,
      spill: 0.15,
      spillSuppress: 0.5,
      edgeSoftness: 0.1,
      edgeFeather: 2,
      maskBlur: 1,
      invertMask: false,
      showMask: false,
      colorSpace: 'hsv',
      toleranceMode: 'advanced',
    },
  },
  {
    id: 'green-screen-bright',
    name: '亮绿幕',
    description: '适用于较亮的绿幕背景',
    settings: {
      enabled: true,
      keyColor: { r: 50, g: 255, b: 50 },
      similarity: 0.35,
      blend: 0.15,
      spill: 0.25,
      spillSuppress: 0.4,
      edgeSoftness: 0.15,
      edgeFeather: 3,
      maskBlur: 1.5,
      invertMask: false,
      showMask: false,
      colorSpace: 'hsv',
      toleranceMode: 'advanced',
    },
  },
  {
    id: 'green-screen-dark',
    name: '暗绿幕',
    description: '适用于较暗的绿幕背景',
    settings: {
      enabled: true,
      keyColor: { r: 0, g: 180, b: 0 },
      similarity: 0.45,
      blend: 0.08,
      spill: 0.18,
      spillSuppress: 0.6,
      edgeSoftness: 0.12,
      edgeFeather: 2,
      maskBlur: 1,
      invertMask: false,
      showMask: false,
      colorSpace: 'hsv',
      toleranceMode: 'advanced',
    },
  },
  {
    id: 'white-background',
    name: '白色背景',
    description: '去除白色背景',
    settings: {
      enabled: true,
      keyColor: { r: 255, g: 255, b: 255 },
      similarity: 0.3,
      blend: 0.05,
      spill: 0,
      spillSuppress: 0,
      edgeSoftness: 0.2,
      edgeFeather: 3,
      maskBlur: 2,
      invertMask: false,
      showMask: false,
      colorSpace: 'rgb',
      toleranceMode: 'simple',
    },
  },
  {
    id: 'black-background',
    name: '黑色背景',
    description: '去除黑色背景',
    settings: {
      enabled: true,
      keyColor: { r: 0, g: 0, b: 0 },
      similarity: 0.25,
      blend: 0.05,
      spill: 0,
      spillSuppress: 0,
      edgeSoftness: 0.15,
      edgeFeather: 2,
      maskBlur: 1,
      invertMask: false,
      showMask: false,
      colorSpace: 'rgb',
      toleranceMode: 'simple',
    },
  },
];

export const useChromaKeyStore = create<ChromaKeyStore>()(
  immer((set, get) => ({
    settings: [],
    presets: BUILTIN_PRESETS,
    selectedClipId: null,
    colorSamples: [],
    isProcessing: false,
    previewMask: false,

    setSettings: (clipId, updates) =>
      set((state) => {
        let settings = state.settings.find((s) => s.clipId === clipId);
        if (!settings) {
          settings = {
            ...DEFAULT_CHROMA_KEY_SETTINGS,
            id: `chroma-${Date.now()}`,
            clipId,
          };
          state.settings.push(settings);
        }
        Object.assign(settings, updates);
      }),

    getSettings: (clipId) => {
      const state = get();
      return state.settings.find((s) => s.clipId === clipId);
    },

    enableChromaKey: (clipId) =>
      set((state) => {
        let settings = state.settings.find((s) => s.clipId === clipId);
        if (!settings) {
          settings = {
            ...DEFAULT_CHROMA_KEY_SETTINGS,
            id: `chroma-${Date.now()}`,
            clipId,
            enabled: true,
          };
          state.settings.push(settings);
        } else {
          settings.enabled = true;
        }
      }),

    disableChromaKey: (clipId) =>
      set((state) => {
        const settings = state.settings.find((s) => s.clipId === clipId);
        if (settings) {
          settings.enabled = false;
        }
      }),

    resetSettings: (clipId) =>
      set((state) => {
        const settings = state.settings.find((s) => s.clipId === clipId);
        if (settings) {
          Object.assign(settings, DEFAULT_CHROMA_KEY_SETTINGS);
        }
      }),

    addColorSample: (sample) =>
      set((state) => {
        state.colorSamples.push(sample);
      }),

    removeColorSample: (index) =>
      set((state) => {
        state.colorSamples.splice(index, 1);
      }),

    clearColorSamples: () =>
      set((state) => {
        state.colorSamples = [];
      }),

    pickColorFromSamples: () => {
      const state = get();
      if (state.colorSamples.length === 0) return null;

      const avgColor = state.colorSamples.reduce(
        (acc, sample) => ({
          r: acc.r + sample.color.r,
          g: acc.g + sample.color.g,
          b: acc.b + sample.color.b,
        }),
        { r: 0, g: 0, b: 0 }
      );

      return {
        r: Math.round(avgColor.r / state.colorSamples.length),
        g: Math.round(avgColor.g / state.colorSamples.length),
        b: Math.round(avgColor.b / state.colorSamples.length),
      };
    },

    applyPreset: (clipId, presetId) =>
      set((state) => {
        const preset = state.presets.find((p) => p.id === presetId);
        if (!preset) return;

        let settings = state.settings.find((s) => s.clipId === clipId);
        if (!settings) {
          settings = {
            ...preset.settings,
            id: `chroma-${Date.now()}`,
            clipId,
          };
          state.settings.push(settings);
        } else {
          Object.assign(settings, preset.settings);
        }
      }),

    saveAsPreset: (name, description, settings) =>
      set((state) => {
        const newPreset: ChromaKeyPreset = {
          id: `preset-${Date.now()}`,
          name,
          description,
          settings: {
            enabled: settings.enabled,
            keyColor: settings.keyColor,
            similarity: settings.similarity,
            blend: settings.blend,
            spill: settings.spill,
            spillSuppress: settings.spillSuppress,
            edgeSoftness: settings.edgeSoftness,
            edgeFeather: settings.edgeFeather,
            maskBlur: settings.maskBlur,
            invertMask: settings.invertMask,
            showMask: settings.showMask,
            colorSpace: settings.colorSpace,
            toleranceMode: settings.toleranceMode,
          },
        };
        state.presets.push(newPreset);
      }),

    removePreset: (presetId) =>
      set((state) => {
        state.presets = state.presets.filter((p) => p.id !== presetId);
      }),

    setSelectedClipId: (clipId) =>
      set((state) => {
        state.selectedClipId = clipId;
      }),

    setIsProcessing: (isProcessing) =>
      set((state) => {
        state.isProcessing = isProcessing;
      }),

    setPreviewMask: (preview) =>
      set((state) => {
        state.previewMask = preview;
      }),
  }))
);

export class ChromaKeyService {
  private static instance: ChromaKeyService;

  static getInstance(): ChromaKeyService {
    if (!ChromaKeyService.instance) {
      ChromaKeyService.instance = new ChromaKeyService();
    }
    return ChromaKeyService.instance;
  }

  rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, v: v * 100 };
  }

  colorDistance(
    r1: number, g1: number, b1: number,
    r2: number, g2: number, b2: number,
    colorSpace: 'rgb' | 'hsv' | 'lab' = 'hsv'
  ): number {
    if (colorSpace === 'rgb') {
      return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / Math.sqrt(255 ** 2 * 3);
    }

    if (colorSpace === 'hsv') {
      const hsv1 = this.rgbToHsv(r1, g1, b1);
      const hsv2 = this.rgbToHsv(r2, g2, b2);

      const hDiff = Math.min(Math.abs(hsv1.h - hsv2.h), 360 - Math.abs(hsv1.h - hsv2.h)) / 180;
      const sDiff = Math.abs(hsv1.s - hsv2.s) / 100;
      const vDiff = Math.abs(hsv1.v - hsv2.v) / 100;

      return (hDiff * 0.7 + sDiff * 0.2 + vDiff * 0.1);
    }

    if (colorSpace === 'lab') {
      const lab1 = this.rgbToLab(r1, g1, b1);
      const lab2 = this.rgbToLab(r2, g2, b2);

      return Math.sqrt(
        (lab1.L - lab2.L) ** 2 +
        (lab1.a - lab2.a) ** 2 +
        (lab1.b - lab2.b) ** 2
      ) / 100;
    }

    return 0;
  }

  rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
    let rNorm = r / 255;
    let gNorm = g / 255;
    let bNorm = b / 255;

    rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
    gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
    bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

    const x = (rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805) / 0.95047;
    const y = (rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722) / 1.0;
    const z = (rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505) / 1.08883;

    const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

    return {
      L: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  }

  calculateAlpha(
    pixelR: number, pixelG: number, pixelB: number,
    keyR: number, keyG: number, keyB: number,
    settings: ChromaKeySettings
  ): number {
    const distance = this.colorDistance(
      pixelR, pixelG, pixelB,
      keyR, keyG, keyB,
      settings.colorSpace
    );

    if (distance < settings.similarity) {
      return 0;
    }

    if (distance < settings.similarity + settings.blend) {
      return (distance - settings.similarity) / settings.blend;
    }

    return 1;
  }

  removeSpill(
    r: number, g: number, b: number,
    keyR: number, keyG: number, keyB: number,
    spill: number, spillSuppress: number
  ): { r: number; g: number; b: number } {
    const keyHsv = this.rgbToHsv(keyR, keyG, keyB);
    const pixelHsv = this.rgbToHsv(r, g, b);

    const isGreenKey = keyHsv.h >= 60 && keyHsv.h <= 180;
    const isBlueKey = keyHsv.h >= 180 && keyHsv.h <= 270;

    if (isGreenKey && pixelHsv.h >= 60 && pixelHsv.h <= 180) {
      const spillAmount = Math.max(0, pixelHsv.s - spillSuppress * 100) / 100 * spill;
      const newG = g * (1 - spillAmount);
      return { r, g: Math.round(newG), b };
    }

    if (isBlueKey && pixelHsv.h >= 180 && pixelHsv.h <= 270) {
      const spillAmount = Math.max(0, pixelHsv.s - spillSuppress * 100) / 100 * spill;
      const newB = b * (1 - spillAmount);
      return { r, g, b: Math.round(newB) };
    }

    return { r, g, b };
  }

  async processFrame(
    imageData: ImageData,
    settings: ChromaKeySettings
  ): Promise<ImageData> {
    const { data, width, height } = imageData;
    const outputData = new Uint8ClampedArray(data.length);

    const { keyColor, spill, spillSuppress, invertMask } = settings;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      let alpha = this.calculateAlpha(
        r, g, b,
        keyColor.r, keyColor.g, keyColor.b,
        settings
      );

      if (invertMask) {
        alpha = 1 - alpha;
      }

      const { r: newR, g: newG, b: newB } = this.removeSpill(
        r, g, b,
        keyColor.r, keyColor.g, keyColor.b,
        spill, spillSuppress
      );

      outputData[i] = newR;
      outputData[i + 1] = newG;
      outputData[i + 2] = newB;
      outputData[i + 3] = Math.round(a * alpha);
    }

    return new ImageData(outputData, width, height);
  }

  generateFFmpegFilter(settings: ChromaKeySettings): string {
    const { keyColor, similarity, blend, spill, edgeFeather } = settings;
    const colorHex = `${keyColor.r.toString(16).padStart(2, '0')}${keyColor.g.toString(16).padStart(2, '0')}${keyColor.b.toString(16).padStart(2, '0')}`;

    return `chromakey=0x${colorHex}:${similarity.toFixed(2)}:${blend.toFixed(2)}:spill:${spill.toFixed(2)}:feather:${edgeFeather}`;
  }

  getCommonColors(): { name: string; color: { r: number; g: number; b: number } }[] {
    return [
      { name: '纯绿', color: { r: 0, g: 255, b: 0 } },
      { name: '亮绿', color: { r: 50, g: 255, b: 50 } },
      { name: '暗绿', color: { r: 0, g: 180, b: 0 } },
      { name: '纯蓝', color: { r: 0, g: 0, b: 255 } },
      { name: '亮蓝', color: { r: 50, g: 50, b: 255 } },
      { name: '暗蓝', color: { r: 0, g: 0, b: 180 } },
      { name: '白色', color: { r: 255, g: 255, b: 255 } },
      { name: '黑色', color: { r: 0, g: 0, b: 0 } },
      { name: '红色', color: { r: 255, g: 0, b: 0 } },
      { name: '黄色', color: { r: 255, g: 255, b: 0 } },
    ];
  }
}

export const chromaKeyService = ChromaKeyService.getInstance();
