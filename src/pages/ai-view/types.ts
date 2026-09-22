import type { ProfessionalCategory } from '@/services/prompt-optimizer-api';

export type SectionId = 'creation' | 'ai-poster' | 'poster' | 'queue' | 'gallery';

export interface InspirationItem {
  id: string;
  src: string;
  title: string;
  prompt: string;
}

export interface GenerationItem {
  id: string;
  type: 'video' | 'image';
  prompt: string;
  status: 'idle' | 'generating' | 'done' | 'failed';
  resultUrl?: string;
  thumbnail?: string;
  createdAt: Date;
  error?: string;
}

export interface StoredGenerationItem {
  id: string;
  type: 'video' | 'image';
  prompt: string;
  status: 'idle' | 'generating' | 'done' | 'failed';
  resultUrl?: string;
  thumbnail?: string;
  createdAt: string;
  error?: string;
}

export type PromptOptimizationStrategy = {
  category?: ProfessionalCategory;
  useStructuredBuilder: boolean;
  buttonLabel: string;
  helperText: string;
};

export type ImageStyleParams = {
  artStyle: string | null;
  lighting: string | null;
  composition: string | null;
  medium: string | null;
  colorMood: string | null;
  cameraSetting: string;
  dof: string;
  detailLevel: string;
  customKeywords: string;
};

export const DEFAULT_IMAGE_STYLE_PARAMS: ImageStyleParams = {
  artStyle: null,
  lighting: null,
  composition: null,
  medium: null,
  colorMood: null,
  cameraSetting: 'auto',
  dof: 'auto',
  detailLevel: 'standard',
  customKeywords: '',
};

export type UnifiedParams = {
  aspectRatio: string;
  resolution: string;
  duration: number;
  generationMode: string;
  motionStrength: number;
  motionAmplitude: 'auto' | 'small' | 'medium' | 'large';
  cfgScale: number;
  seed: number;
  webSearch: boolean;
  returnLastFrame: boolean;
  audioGeneration: 'none' | 'music' | 'sfx' | 'ambient';
  cameraMovement: string;
  multiShot: boolean;
  viduStyle: 'general' | 'anime';
  filmEmulation: boolean;
  grainSize: number;
  creativeStyle: string;
  characterConsistency: number;
  referenceImages: string[];
  referenceVideos: string[];
  referenceAudios: string[];
  imageCount: number;
  promptEnhancer: boolean;
  promptOptimizer: boolean;
  hdMode: boolean;
  watermark: boolean;
  style: string;
  strength: number;
  frameInterpolation: boolean;
  loopToggle: boolean;
  minimaxMotionLevel: number;
  gptImageStyle: 'vivid' | 'natural' | string;
  gptImageQuality: 'auto' | 'low' | 'medium' | 'high' | string;
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high' | string;
  imageSize: '1K' | '2K' | '4K' | string;
  fluxFormat: 'jpeg' | 'png' | string;
  fluxSafety: number;
  seedreamResolutionTier: string;
};
