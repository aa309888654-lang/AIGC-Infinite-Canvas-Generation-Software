export type StoryboardFormat =
  | 'short_video'
  | 'ad'
  | 'film'
  | 'comic'
  | 'product'
  | 'custom';

export type DoubaoSeedreamQuality = 'auto' | 'low' | 'medium' | 'high';
export type DoubaoSeedreamOutputFormat = 'png' | 'jpeg' | 'webp';
export type DoubaoSeedreamBackground = 'auto' | 'opaque';
export type DoubaoSeedreamSize = 'auto' | `${number}x${number}`;

export interface StoryboardPlanV2 {
  version: 2;
  project: {
    title?: string;
    format: StoryboardFormat;
    aspectRatio: string;
    size: DoubaoSeedreamSize;
    targetDurationSec?: number;
    visualStyle: string;
    colorPalette?: string;
  };
  elements: StoryboardElement[];
  shots: StoryboardShot[];
  generation: StoryboardGenerationSettings;
}

export interface StoryboardElement {
  id: string;
  type: 'character' | 'outfit' | 'prop' | 'location' | 'style';
  name: string;
  canonicalDescription: string;
  visualAnchors: string[];
  driftWatchList: string[];
  referenceImageUrl?: string;
  referenceAngles?: {
    front?: string;
    threeQuarter?: string;
    profile?: string;
  };
  locked: boolean;
  lockedAt?: string;
  sceneVariations?: Record<string, string>;
}

export interface StoryboardShot {
  id: string;
  index: number;
  sceneId?: string;
  durationSec?: number;
  beat: string;
  emotionalBeat: string;
  shotType:
    | 'extreme_wide'
    | 'wide'
    | 'full'
    | 'medium'
    | 'medium_close'
    | 'closeup'
    | 'extreme_closeup'
    | 'insert';
  cameraAngle:
    | 'eye_level'
    | 'low_angle'
    | 'high_angle'
    | 'top_down'
    | 'dutch'
    | 'over_shoulder'
    | 'pov';
  cameraMove?: 'static' | 'push_in' | 'pull_out' | 'pan' | 'tilt' | 'track' | 'handheld' | 'orbit';
  subjectAction: string;
  environment: string;
  lighting: string;
  composition: string;
  continuity: {
    screenDirection?: string;
    characterPositions?: Record<string, 'left' | 'center' | 'right' | 'foreground' | 'background'>;
    requiredProps?: string[];
    preserveFromPrevious?: string[];
  };
  references: {
    characterIds?: string[];
    outfitIds?: string[];
    propIds?: string[];
    locationIds?: string[];
    styleIds?: string[];
  };
  prompt?: string;
  negativePrompt?: string;
}

export interface StoryboardGenerationSettings {
  modelId: string;
  provider: string;
  size: DoubaoSeedreamSize;
  quality: DoubaoSeedreamQuality;
  outputFormat: DoubaoSeedreamOutputFormat;
  outputCompression?: number;
  background: DoubaoSeedreamBackground;
  n: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  moderation: 'auto' | 'low';
  useMultiImageReferences: boolean;
  useEditEndpointWhenReferenceExists: boolean;
  maxReferenceImages: number;
  maxReferenceFileSizeMB: number;
  maxConcurrentFrames: number;
  retryFailedFrames: boolean;
  providerExtensions?: ProviderExtensionParams;
}

export interface ProviderExtensionParams {
  seed?: number;
  thinking?: 'off' | 'low' | 'medium' | 'high';
  providerRaw?: Record<string, unknown>;
}

export interface StoryboardPlanBuildInput {
  rows: number;
  cols: number;
  prompt: string;
  shotStrategy: 'auto' | 'story' | 'portrait' | 'cinematic';
  size?: DoubaoSeedreamSize;
  modelId?: string;
  provider?: string;
  quality?: DoubaoSeedreamQuality;
  outputFormat?: DoubaoSeedreamOutputFormat;
  outputCompression?: number;
  background?: DoubaoSeedreamBackground;
  moderation?: 'auto' | 'low';
  useMultiImageReferences?: boolean;
  useEditEndpointWhenReferenceExists?: boolean;
  maxReferenceImages?: number;
  maxReferenceFileSizeMB?: number;
  maxConcurrentFrames?: number;
  retryFailedFrames?: boolean;
  providerExtensions?: ProviderExtensionParams;
}

const SHOT_TYPES: StoryboardShot['shotType'][] = [
  'wide',
  'medium',
  'closeup',
  'medium_close',
  'full',
  'insert',
  'wide',
  'closeup',
];

const CINEMATIC_SHOT_TYPES: StoryboardShot['shotType'][] = [
  'extreme_wide',
  'wide',
  'medium',
  'closeup',
  'insert',
];

const CAMERA_ANGLES: StoryboardShot['cameraAngle'][] = [
  'eye_level',
  'low_angle',
  'high_angle',
  'over_shoulder',
  'pov',
  'top_down',
  'dutch',
];

const CAMERA_MOVES: NonNullable<StoryboardShot['cameraMove']>[] = [
  'static',
  'push_in',
  'pan',
  'track',
  'pull_out',
  'handheld',
  'tilt',
  'orbit',
];

function normalizePrompt(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitPromptBeats(prompt: string): string[] {
  const normalized = normalizePrompt(prompt);
  if (!normalized) return ['Establish the story world and introduce the main subject.'];

  const lineParts = prompt
    .split(/\r?\n+/)
    .map((part) => normalizePrompt(part))
    .filter(Boolean);
  if (lineParts.length >= 2) return lineParts;

  const sentenceParts = normalized
    .split(/(?<=[。！？.!?；;])\s*/)
    .map((part) => part.replace(/[。！？.!?；;]+$/u, '').trim())
    .filter(Boolean);
  if (sentenceParts.length >= 2) return sentenceParts;

  return [normalized];
}

function inferAspectRatio(size: DoubaoSeedreamSize | undefined): string {
  if (!size || size === 'auto') return 'auto';
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return 'auto';
  const width = Number(match[1]);
  const height = Number(match[2]);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  return `${width / divisor}:${height / divisor}`;
}

function inferFormat(prompt: string): StoryboardFormat {
  const lower = prompt.toLowerCase();
  if (/广告|ad|commercial|campaign/.test(lower)) return 'ad';
  if (/漫画|comic|manga|webtoon/.test(lower)) return 'comic';
  if (/产品|商品|product/.test(lower)) return 'product';
  if (/电影|film|cinematic|movie/.test(lower)) return 'film';
  if (/短视频|short video|reel|tiktok|抖音/.test(lower)) return 'short_video';
  return 'custom';
}

function visualStyleForStrategy(strategy: StoryboardPlanBuildInput['shotStrategy']): string {
  if (strategy === 'portrait') return 'identity-locked portrait storyboard, stable face and outfit';
  if (strategy === 'cinematic') return 'cinematic storyboard, clear lens language, controlled lighting and atmosphere';
  if (strategy === 'story') return 'sequential story progression, readable continuity and action beats';
  return 'balanced production storyboard, consistent style, clear readable composition';
}

function beatForIndex(beats: string[], index: number, total: number): string {
  if (beats.length === total) return beats[index] || beats[beats.length - 1] || '';
  if (beats.length > 1) {
    const sourceIndex = Math.min(beats.length - 1, Math.floor((index / Math.max(1, total)) * beats.length));
    return beats[sourceIndex] || beats[0];
  }

  const base = beats[0] || 'Storyboard sequence';
  if (total <= 1) return base;
  if (index === 0) return `${base} Opening establishing moment.`;
  if (index === total - 1) return `${base} Closing resolution moment.`;
  return `${base} Story beat ${index + 1} advances the action.`;
}

function emotionalBeatForIndex(index: number, total: number): string {
  if (total <= 3) return ['curiosity', 'tension', 'release'][index] || 'focused';
  const t = index / Math.max(1, total - 1);
  if (t < 0.18) return 'intrigue and orientation';
  if (t < 0.42) return 'rising tension';
  if (t < 0.68) return 'decision and movement';
  if (t < 0.88) return 'peak emotion';
  return 'resolution and visual closure';
}

function subjectActionFromBeat(beat: string, index: number): string {
  const clean = normalizePrompt(beat);
  if (!clean) return `Main subject performs the key action of shot ${index + 1}.`;
  return clean.length > 150 ? `${clean.slice(0, 147)}...` : clean;
}

export function buildStoryboardPlanFromPrompt(input: StoryboardPlanBuildInput): StoryboardPlanV2 {
  const rows = Math.max(1, Math.floor(input.rows || 1));
  const cols = Math.max(1, Math.floor(input.cols || 1));
  const total = rows * cols;
  const size = input.size || 'auto';
  const beats = splitPromptBeats(input.prompt);
  const visualStyle = visualStyleForStrategy(input.shotStrategy);
  const shotTypePool = input.shotStrategy === 'cinematic' ? CINEMATIC_SHOT_TYPES : SHOT_TYPES;

  const elements: StoryboardElement[] = [
    {
      id: 'main-subject',
      type: 'character',
      name: 'Main subject',
      canonicalDescription: normalizePrompt(input.prompt).slice(0, 260) || 'Primary subject described by the user prompt.',
      visualAnchors: ['face identity', 'body proportions', 'silhouette', 'signature color accents'],
      driftWatchList: ['face drift', 'outfit redesign', 'age change', 'style mismatch'],
      locked: false,
    },
    {
      id: 'story-style',
      type: 'style',
      name: 'Visual style',
      canonicalDescription: visualStyle,
      visualAnchors: ['lens language', 'lighting mood', 'palette consistency', 'composition rhythm'],
      driftWatchList: ['random logo/text', 'lighting drift', 'palette drift', 'inconsistent rendering style'],
      locked: false,
    },
  ];

  const shots: StoryboardShot[] = Array.from({ length: total }, (_, index) => {
    const beat = beatForIndex(beats, index, total);
    const shotType = shotTypePool[index % shotTypePool.length] || 'medium';
    const cameraAngle = CAMERA_ANGLES[index % CAMERA_ANGLES.length] || 'eye_level';
    const cameraMove = CAMERA_MOVES[index % CAMERA_MOVES.length] || 'static';
    const row = Math.floor(index / cols);
    const col = index % cols;

    return {
      id: `shot-${String(index + 1).padStart(2, '0')}`,
      index,
      sceneId: `scene-${String(row + 1).padStart(2, '0')}`,
      durationSec: Math.max(2, Math.round(36 / Math.max(1, total))),
      beat,
      emotionalBeat: emotionalBeatForIndex(index, total),
      shotType,
      cameraAngle,
      cameraMove,
      subjectAction: subjectActionFromBeat(beat, index),
      environment: 'Preserve the user-described world and keep location logic consistent across adjacent frames.',
      lighting:
        input.shotStrategy === 'cinematic'
          ? 'cinematic motivated light with consistent contrast and color temperature'
          : 'consistent production lighting that supports the story beat',
      composition:
        index === 0
          ? 'clear establishing composition with readable subject and environment relationship'
          : col === 0
            ? 'reset spatial geography while preserving screen direction'
            : 'continue the previous shot rhythm with a clean focal hierarchy',
      continuity: {
        screenDirection: index % 2 === 0 ? 'left-to-right' : 'maintain previous axis',
        characterPositions: {
          'main-subject': col === 0 ? 'left' : col === cols - 1 ? 'right' : 'center',
        },
        requiredProps: [],
        preserveFromPrevious: index === 0
          ? ['main subject identity', 'visual style']
          : ['main subject identity', 'outfit', 'key props', 'environment mood', 'screen direction'],
      },
      references: {
        characterIds: ['main-subject'],
        styleIds: ['story-style'],
      },
    };
  });

  return {
    version: 2,
    project: {
      format: inferFormat(input.prompt),
      aspectRatio: inferAspectRatio(size),
      size,
      targetDurationSec: shots.reduce((sum, shot) => sum + (shot.durationSec || 0), 0),
      visualStyle,
    },
    elements,
    shots,
    generation: {
      modelId: input.modelId || 'doubao-seedream-5-0-pro',
      provider: input.provider || 'doubao',
      size,
      quality: input.quality || 'medium',
      outputFormat: input.outputFormat || 'png',
      outputCompression: input.outputCompression,
      background: input.background || 'opaque',
      n: 1,
      moderation: input.moderation || 'auto',
      useMultiImageReferences: input.useMultiImageReferences ?? true,
      useEditEndpointWhenReferenceExists: input.useEditEndpointWhenReferenceExists ?? true,
      maxReferenceImages: Math.max(1, Math.floor(input.maxReferenceImages || 4)),
      maxReferenceFileSizeMB: Math.max(0.5, Number(input.maxReferenceFileSizeMB || 1.5)),
      maxConcurrentFrames: Math.max(1, Math.floor(input.maxConcurrentFrames || 2)),
      retryFailedFrames: input.retryFailedFrames ?? true,
      providerExtensions: input.providerExtensions,
    },
  };
}
