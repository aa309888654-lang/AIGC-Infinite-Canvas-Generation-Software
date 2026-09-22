import type { StoryboardPlanV2, StoryboardShot } from './storyboard-plan-v2';

export type StoryboardFrameStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export interface StoryboardPayloadFrame {
  cellIndex: number;
  rowIndex: number;
  colIndex: number;
  imageUrl: string;
  prompt: string;
  status: StoryboardFrameStatus;
  error?: string;
  characterRef?: string;
  outfitRef?: string;
  environmentRef?: string;
}

export interface StoryboardPayloadV1 {
  version: 1;
  sourceNodeType: 'gridDirector';
  gridImageUrl?: string;
  coverImageUrl?: string;
  selectedFrameIndex: number;
  processingMode: 'selected' | 'sequence';
  frames: StoryboardPayloadFrame[];
}

export interface StoryboardFrameV2 extends StoryboardPayloadFrame {
  shotId?: string;
  label?: string;
  beat?: string;
  emotionalBeat?: string;
  shotType?: StoryboardShot['shotType'];
  cameraAngle?: StoryboardShot['cameraAngle'];
  cameraMove?: StoryboardShot['cameraMove'];
  continuity?: StoryboardShot['continuity'];
  referenceImageCount?: number;
  providerWarnings?: string[];
}

export interface StoryboardLockedAsset {
  id: string;
  type: 'character' | 'outfit' | 'prop' | 'location' | 'style' | 'frame';
  name: string;
  imageUrl?: string;
  locked: boolean;
  sourceFrameIndex?: number;
}

export interface StoryboardProviderTrace {
  frameIndex?: number;
  provider: string;
  model: string;
  endpoint?: 'generations' | 'edits' | 'provider-specific';
  size?: string;
  quality?: string;
  outputFormat?: string;
  warnings?: string[];
  requestId?: string;
}

export interface StoryboardCostEstimate {
  frameCount: number;
  quality: string;
  size: string;
  riskLevel: 'low' | 'medium' | 'high';
  notes: string[];
}

export interface StoryboardContinuityWarning {
  frameIndex?: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface StoryboardPayloadV2 {
  version: 2;
  sourceNodeType: 'gridDirector' | 'storyboardMaker';
  plan?: StoryboardPlanV2;
  frames: StoryboardFrameV2[];
  assets: StoryboardLockedAsset[];
  providerTrace: StoryboardProviderTrace[];
  costEstimate?: StoryboardCostEstimate;
  continuityWarnings: StoryboardContinuityWarning[];
  gridImageUrl?: string;
  coverImageUrl?: string;
  selectedFrameIndex: number;
  processingMode: 'selected' | 'sequence';
}

export type StoryboardPayload = StoryboardPayloadV1 | StoryboardPayloadV2;

type BuildStoryboardPayloadInput = {
  sourceNodeType?: StoryboardPayloadV2['sourceNodeType'];
  gridImageUrl?: string;
  coverImageUrl?: string;
  selectedFrameIndex: number;
  processingMode: 'selected' | 'sequence';
  frames: Array<StoryboardPayloadFrame | StoryboardFrameV2>;
  plan?: StoryboardPlanV2;
  assets?: StoryboardLockedAsset[];
  providerTrace?: StoryboardProviderTrace[];
  costEstimate?: StoryboardCostEstimate;
  continuityWarnings?: StoryboardContinuityWarning[];
};

export function buildStoryboardPayload(
  input: BuildStoryboardPayloadInput,
): string {
  const { sourceNodeType = 'gridDirector', ...rest } = input;
  if (rest.plan) {
    return JSON.stringify({
      version: 2,
      sourceNodeType,
      assets: [],
      providerTrace: [],
      continuityWarnings: [],
      ...rest,
    } satisfies StoryboardPayloadV2);
  }

  return JSON.stringify({
    version: 1,
    sourceNodeType: 'gridDirector',
    gridImageUrl: rest.gridImageUrl,
    coverImageUrl: rest.coverImageUrl,
    selectedFrameIndex: rest.selectedFrameIndex,
    processingMode: rest.processingMode,
    frames: rest.frames,
  } satisfies StoryboardPayloadV1);
}

export function parseStoryboardPayload(raw: unknown): StoryboardPayload | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoryboardPayload;
    if (
      (parsed?.version !== 1 && parsed?.version !== 2) ||
      !Array.isArray(parsed.frames)
    ) {
      return null;
    }

    if (parsed.version === 1 && parsed.sourceNodeType !== 'gridDirector') {
      return null;
    }

    if (
      parsed.version === 2 &&
      parsed.sourceNodeType !== 'gridDirector' &&
      parsed.sourceNodeType !== 'storyboardMaker'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function resolveStoryboardSelection(payload: StoryboardPayload | null) {
  if (!payload) {
    return {
      mode: 'selected' as const,
      selectedFrame: null,
      sequenceFrames: [] as StoryboardPayloadFrame[],
    };
  }

  const successfulFrames = payload.frames.filter(
    (frame) => frame.status === 'succeeded' && !!frame.imageUrl,
  );
  const selectedFrame =
    successfulFrames.find((frame) => frame.cellIndex === payload.selectedFrameIndex) ??
    successfulFrames[0] ??
    null;

  return {
    mode: payload.processingMode,
    selectedFrame,
    sequenceFrames: payload.processingMode === 'sequence' ? successfulFrames : [],
  };
}
