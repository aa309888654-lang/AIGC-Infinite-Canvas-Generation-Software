/**
 * 特效预览Hook
 * 支持实时特效预览和调整
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type EffectCategory = 'color' | 'filters' | 'transitions' | 'text' | 'speed' | 'advanced';

export interface VideoEffect {
  id: string;
  name: string;
  category: EffectCategory;
  icon: string;
  enabled: boolean;
  settings: Record<string, number | string | boolean>;
  defaultSettings: Record<string, number | string | boolean>;
}

export interface ColorCorrection {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  exposure: number;
  gamma: number;
  temperature: number;
  tint: number;
  grayscale: number;
  sepia: number;
  blur: number;
}

export interface Filter {
  id: string;
  name: string;
  intensity: number;
  preview: string;
}

export interface Transition {
  id: string;
  name: string;
  duration: number;
  easing: string;
}

export interface TextOverlay {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  position: { x: number; y: number };
  opacity: number;
  animation: 'none' | 'fade_in' | 'slide_in' | 'typewriter';
  startTime: number;
  duration: number;
}

export interface SpeedSettings {
  speed: number;
  pitchCorrection: boolean;
  maintainDuration: boolean;
}

export interface EffectsPreset {
  id: string;
  name: string;
  description: string;
  effects: VideoEffect[];
  colorCorrection: ColorCorrection;
  filters: Filter[];
  icon: string;
  isBuiltIn: boolean;
}

export const BUILT_IN_FILTERS: Filter[] = [
  { id: 'vintage', name: '复古', intensity: 50, preview: 'sepia' },
  { id: 'noir', name: '黑白电影', intensity: 50, preview: 'grayscale' },
  { id: 'warm', name: '暖色调', intensity: 50, preview: 'warm' },
  { id: 'cool', name: '冷色调', intensity: 50, preview: 'cool' },
  { id: 'vivid', name: '鲜艳', intensity: 50, preview: 'saturate' },
  { id: 'fade', name: '褪色', intensity: 50, preview: 'contrast' },
  { id: 'cinema', name: '电影感', intensity: 50, preview: 'cinema' },
  { id: 'portrait', name: '人像', intensity: 50, preview: 'portrait' },
];

export const TRANSITIONS: Transition[] = [
  { id: 'fade', name: '淡入淡出', duration: 1, easing: 'ease-in-out' },
  { id: 'dissolve', name: '溶解', duration: 1, easing: 'ease' },
  { id: 'wipe', name: '擦除', duration: 0.8, easing: 'linear' },
  { id: 'slide', name: '滑动', duration: 0.8, easing: 'ease-out' },
  { id: 'zoom', name: '缩放', duration: 0.6, easing: 'ease-in-out' },
  { id: 'blur', name: '模糊', duration: 1, easing: 'ease' },
];

export const EFFECTS_PRESETS: EffectsPreset[] = [
  {
    id: 'cinema',
    name: '电影风格',
    description: '高对比度、冷色调、电影感',
    effects: [],
    colorCorrection: {
      brightness: 5,
      contrast: 15,
      saturation: -10,
      hue: 0,
      exposure: 0,
      gamma: 1.1,
      temperature: -5,
      tint: 0,
      grayscale: 0,
      sepia: 0,
      blur: 0,
    },
    filters: [],
    icon: '🎬',
    isBuiltIn: true,
  },
  {
    id: 'warm_vintage',
    name: '温暖复古',
    description: '暖色调、褪色效果',
    effects: [],
    colorCorrection: {
      brightness: 10,
      contrast: -5,
      saturation: 20,
      hue: 10,
      exposure: 0.1,
      gamma: 1,
      temperature: 20,
      tint: 5,
      grayscale: 0,
      sepia: 0,
      blur: 0,
    },
    filters: [{ id: 'vintage', name: '复古', intensity: 60, preview: 'sepia' }],
    icon: '📷',
    isBuiltIn: true,
  },
  {
    id: 'vivid_pop',
    name: '生动流行',
    description: '高饱和度、鲜艳色彩',
    effects: [],
    colorCorrection: {
      brightness: 10,
      contrast: 20,
      saturation: 40,
      hue: 0,
      exposure: 0.1,
      gamma: 1,
      temperature: 0,
      tint: 0,
      grayscale: 0,
      sepia: 0,
      blur: 0,
    },
    filters: [{ id: 'vivid', name: '鲜艳', intensity: 40, preview: 'saturate' }],
    icon: '🎨',
    isBuiltIn: true,
  },
  {
    id: 'dramatic',
    name: '戏剧效果',
    description: '高对比度、暗角效果',
    effects: [],
    colorCorrection: {
      brightness: -10,
      contrast: 40,
      saturation: -20,
      hue: 0,
      exposure: -0.1,
      gamma: 1.2,
      temperature: -10,
      tint: 0,
      grayscale: 0,
      sepia: 0,
      blur: 0,
    },
    filters: [],
    icon: '🎭',
    isBuiltIn: true,
  },
];

export function useEffectsPreview() {
  const [colorCorrection, setColorCorrection] = useState<ColorCorrection>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    exposure: 0,
    gamma: 1,
    temperature: 0,
    tint: 0,
    grayscale: 0,
    sepia: 0,
    blur: 0,
  });

  const [filters, setFilters] = useState<Filter[]>([]);
  const [activeEffects, setActiveEffects] = useState<VideoEffect[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [speedSettings, setSpeedSettings] = useState<SpeedSettings>({
    speed: 1,
    pitchCorrection: true,
    maintainDuration: false,
  });

  const [currentPreset, setCurrentPreset] = useState<EffectsPreset | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [totalDuration, _setTotalDuration] = useState(0);
  const [customPresets, setCustomPresets] = useState<EffectsPreset[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const updateColorCorrection = useCallback((updates: Partial<ColorCorrection>) => {
    setColorCorrection(prev => ({ ...prev, ...updates }));
    setCurrentPreset(null);
  }, []);

  const applyFilter = useCallback((filter: Filter) => {
    setFilters(prev => {
      const exists = prev.find(f => f.id === filter.id);
      if (exists) {
        return prev.filter(f => f.id !== filter.id);
      }
      return [...prev, filter];
    });
    setCurrentPreset(null);
  }, []);

  const updateFilterIntensity = useCallback((filterId: string, intensity: number) => {
    setFilters(prev => prev.map(f =>
      f.id === filterId ? { ...f, intensity } : f
    ));
    setCurrentPreset(null);
  }, []);

  const addTextOverlay = useCallback((overlay: Omit<TextOverlay, 'id'>) => {
    const newOverlay: TextOverlay = {
      ...overlay,
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setTextOverlays(prev => [...prev, newOverlay]);
    return newOverlay.id;
  }, []);

  const updateTextOverlay = useCallback((id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(o =>
      o.id === id ? { ...o, ...updates } : o
    ));
  }, []);

  const removeTextOverlay = useCallback((id: string) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
  }, []);

  const applySpeedChange = useCallback((speed: number) => {
    setSpeedSettings(prev => ({ ...prev, speed }));
    setCurrentPreset(null);
  }, []);

  const applyPreset = useCallback((preset: EffectsPreset) => {
    setColorCorrection(preset.colorCorrection);
    setFilters(preset.filters);
    setCurrentPreset(preset);
  }, []);

  const saveAsPreset = useCallback((name: string, description: string) => {
    const newPreset: EffectsPreset = {
      id: `custom_${Date.now()}`,
      name,
      description,
      effects: activeEffects,
      colorCorrection,
      filters,
      icon: '✨',
      isBuiltIn: false,
    };
    setCustomPresets(prev => [...prev, newPreset]);
    return newPreset.id;
  }, [activeEffects, colorCorrection, filters]);

  const removePreset = useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== presetId));
  }, []);

  const resetAll = useCallback(() => {
    setColorCorrection({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      exposure: 0,
      gamma: 1,
      temperature: 0,
      tint: 0,
      grayscale: 0,
      sepia: 0,
      blur: 0,
    });
    setFilters([]);
    setActiveEffects([]);
    setTextOverlays([]);
    setSpeedSettings({
      speed: 1,
      pitchCorrection: true,
      maintainDuration: false,
    });
    setCurrentPreset(null);
  }, []);

  const getCssFilter = useCallback(() => {
    const filters: string[] = [];

    if (colorCorrection.brightness !== 0) {
      filters.push(`brightness(${1 + colorCorrection.brightness / 100})`);
    }
    if (colorCorrection.contrast !== 0) {
      filters.push(`contrast(${1 + colorCorrection.contrast / 100})`);
    }
    if (colorCorrection.saturation !== 0) {
      filters.push(`saturate(${1 + colorCorrection.saturation / 100})`);
    }
    if (colorCorrection.hue !== 0) {
      filters.push(`hue-rotate(${colorCorrection.hue}deg)`);
    }
    if (colorCorrection.grayscale) {
      filters.push(`grayscale(${colorCorrection.grayscale}%)`);
    }
    if (colorCorrection.sepia) {
      filters.push(`sepia(${colorCorrection.sepia}%)`);
    }
    if (colorCorrection.blur) {
      filters.push(`blur(${colorCorrection.blur}px)`);
    }

    return filters.join(' ');
  }, [colorCorrection]);

  const startPreview = useCallback(() => {
    setIsPreviewPlaying(true);
    if (videoRef.current) {
      videoRef.current.play();
    }
  }, []);

  const pausePreview = useCallback(() => {
    setIsPreviewPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const seekPreview = useCallback((time: number) => {
    setPreviewTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const exportWithEffects = useCallback(async (
    inputPath: string,
    outputPath: string,
    _format: 'mp4' | 'webm' = 'mp4'
  ) => {
    return outputPath;
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    colorCorrection,
    filters,
    activeEffects,
    textOverlays,
    speedSettings,
    currentPreset,
    isPreviewPlaying,
    previewTime,
    totalDuration,
    customPresets,
    videoRef,
    canvasRef,
    updateColorCorrection,
    applyFilter,
    updateFilterIntensity,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    applySpeedChange,
    applyPreset,
    saveAsPreset,
    removePreset,
    resetAll,
    getCssFilter,
    startPreview,
    pausePreview,
    seekPreview,
    exportWithEffects,
  };
}
