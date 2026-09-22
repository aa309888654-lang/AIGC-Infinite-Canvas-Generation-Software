/**
 * 配置预设Hook
 * 支持保存和加载自定义配置预设
 */

import { useState, useCallback } from 'react';
import type { DetectorType } from '@/lib/ai-video-sdk';

export interface ClipPreset {
  id: string;
  name: string;
  description?: string;
  detectorType: DetectorType;
  threshold: number;
  minClipDuration: number;
  maxClipDuration: number;
  gpuEnabled: boolean;
  createdAt: number;
  updatedAt: number;
  isBuiltIn: boolean;
}

export interface ExportPreset {
  id: string;
  name: string;
  description?: string;
  format: 'mp4' | 'webm' | 'avi' | 'mkv';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution?: {
    width: number;
    height: number;
  };
  fps?: number;
  codec?: string;
  bitrate?: number;
  createdAt: number;
  updatedAt: number;
  isBuiltIn: boolean;
}

const BUILT_IN_CLIP_PRESETS: ClipPreset[] = [
  {
    id: 'default',
    name: '默认配置',
    description: '适用于大多数视频的通用配置',
    detectorType: 'audio',
    threshold: 0.4,
    minClipDuration: 1.0,
    maxClipDuration: 60,
    gpuEnabled: false,
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'aggressive',
    name: '激进剪辑',
    description: '高灵敏度，保留更多细节片段',
    detectorType: 'motion',
    threshold: 0.2,
    minClipDuration: 0.5,
    maxClipDuration: 30,
    gpuEnabled: true,
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'conservative',
    name: '保守剪辑',
    description: '低灵敏度，只保留高质量片段',
    detectorType: 'scene',
    threshold: 0.7,
    minClipDuration: 3.0,
    maxClipDuration: 120,
    gpuEnabled: false,
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'speech',
    name: '语音剪辑',
    description: '专门针对语音内容的检测',
    detectorType: 'audio',
    threshold: 0.3,
    minClipDuration: 2.0,
    maxClipDuration: 90,
    gpuEnabled: false,
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
];

const BUILT_IN_EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'default',
    name: '标准MP4',
    description: '通用MP4格式，适合大多数场景',
    format: 'mp4',
    quality: 'high',
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'web-optimized',
    name: '网页优化',
    description: '针对网页播放优化的配置',
    format: 'mp4',
    quality: 'medium',
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'high-quality',
    name: '高质量',
    description: '最高质量输出',
    format: 'mp4',
    quality: 'ultra',
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'social-media',
    name: '社交媒体',
    description: '适合抖音、快手等平台',
    format: 'mp4',
    quality: 'high',
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
];

export function usePresets() {
  const [clipPresets, setClipPresets] = useState<ClipPreset[]>(BUILT_IN_CLIP_PRESETS);
  const [exportPresets, setExportPresets] = useState<ExportPreset[]>(BUILT_IN_EXPORT_PRESETS);

  const addClipPreset = useCallback((preset: Omit<ClipPreset, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => {
    const newPreset: ClipPreset = {
      ...preset,
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltIn: false,
    };

    setClipPresets(prev => [...prev, newPreset]);
    return newPreset.id;
  }, []);

  const updateClipPreset = useCallback((id: string, updates: Partial<ClipPreset>) => {
    setClipPresets(prev =>
      prev.map(p =>
        p.id === id && !p.isBuiltIn
          ? { ...p, ...updates, updatedAt: Date.now() }
          : p
      )
    );
  }, []);

  const removeClipPreset = useCallback((id: string) => {
    setClipPresets(prev => prev.filter(p => p.id !== id && !p.isBuiltIn));
  }, []);

  const addExportPreset = useCallback((preset: Omit<ExportPreset, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => {
    const newPreset: ExportPreset = {
      ...preset,
      id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltIn: false,
    };

    setExportPresets(prev => [...prev, newPreset]);
    return newPreset.id;
  }, []);

  const updateExportPreset = useCallback((id: string, updates: Partial<ExportPreset>) => {
    setExportPresets(prev =>
      prev.map(p =>
        p.id === id && !p.isBuiltIn
          ? { ...p, ...updates, updatedAt: Date.now() }
          : p
      )
    );
  }, []);

  const removeExportPreset = useCallback((id: string) => {
    setExportPresets(prev => prev.filter(p => p.id !== id && !p.isBuiltIn));
  }, []);

  const getPresetById = useCallback((id: string) => {
    return clipPresets.find(p => p.id === id) || null;
  }, [clipPresets]);

  const getExportPresetById = useCallback((id: string) => {
    return exportPresets.find(p => p.id === id) || null;
  }, [exportPresets]);

  return {
    clipPresets,
    exportPresets,
    addClipPreset,
    updateClipPreset,
    removeClipPreset,
    addExportPreset,
    updateExportPreset,
    removeExportPreset,
    getPresetById,
    getExportPresetById,
  };
}
