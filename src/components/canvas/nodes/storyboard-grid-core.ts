import {
  buildStoryboardPlanFromPrompt,
  type DoubaoSeedreamBackground,
  type DoubaoSeedreamOutputFormat,
  type DoubaoSeedreamQuality,
  type DoubaoSeedreamSize,
  type ProviderExtensionParams,
  type StoryboardPlanV2,
  type StoryboardShot,
} from './storyboard-plan-v2';
import { compileShotPromptForDoubaoSeedream } from './storyboard-prompt-compiler';

export interface StoryboardReferenceInput {
  reference?: string;
  characterRef?: string;
  outfitRef?: string;
  environmentRef?: string;
  fallbackToReference?: boolean;
}

export interface StoryboardReferenceBundle {
  masterReference?: string;
  characterReference?: string;
  outfitReference?: string;
  environmentReference?: string;
  hasMasterReference: boolean;
  hasSplitReferences: boolean;
}

export interface StoryboardCell {
  cellIndex: number;
  rowIndex: number;
  colIndex: number;
  label: string;
  shotPrompt: string;
  shot?: StoryboardShot;
  status: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
}

export function getStoryboardLayoutDimensions(input: { rows: number; cols: number }) {
  const rows = Math.max(1, Math.floor(input.rows || 1));
  const cols = Math.max(1, Math.floor(input.cols || 1));
  return { rows, cols, cellCount: rows * cols };
}

export function normalizeStoryboardReferences(
  input: StoryboardReferenceInput,
): StoryboardReferenceBundle {
  const master = input.reference || undefined;
  const withFallback = (value?: string) =>
    value || (input.fallbackToReference ? master : undefined);

  return {
    masterReference: master,
    characterReference: withFallback(input.characterRef),
    outfitReference: withFallback(input.outfitRef),
    environmentReference: withFallback(input.environmentRef),
    hasMasterReference: !!master,
    hasSplitReferences: !!(input.characterRef || input.outfitRef || input.environmentRef),
  };
}

export function shouldAbortStoryboardRun(status?: number): boolean {
  return status === 401 || status === 402 || status === 403;
}

export function buildStoryboardCells(input: {
  rows: number;
  cols: number;
  prompt: string;
  shotStrategy: 'auto' | 'story' | 'portrait' | 'cinematic';
  negativePrompt?: string;
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
  providerExtensions?: ProviderExtensionParams;
}): StoryboardCell[] {
  const plan = buildStoryboardPlanFromPrompt(input);
  return buildStoryboardCellsFromPlan({
    plan,
    rows: input.rows,
    cols: input.cols,
    basePrompt: input.prompt,
    negativePrompt: input.negativePrompt,
  });
}

export function buildStoryboardCellsFromPlan(input: {
  plan: StoryboardPlanV2;
  rows: number;
  cols: number;
  basePrompt?: string;
  negativePrompt?: string;
}): StoryboardCell[] {
  const { cols, cellCount } = getStoryboardLayoutDimensions(input);

  return Array.from({ length: cellCount }, (_, cellIndex) => {
    const rowIndex = Math.floor(cellIndex / cols);
    const colIndex = cellIndex % cols;
    const shot = input.plan.shots[cellIndex];
    const label = shot ? `镜头 ${cellIndex + 1} · ${shot.shotType}/${shot.cameraAngle}` : `镜头 ${cellIndex + 1}`;

    return {
      cellIndex,
      rowIndex,
      colIndex,
      label,
      shot,
      shotPrompt: shot
        ? compileShotPromptForDoubaoSeedream({
            plan: input.plan,
            shot,
            total: cellCount,
            basePrompt: input.basePrompt,
            negativePrompt: input.negativePrompt,
          })
        : `${input.basePrompt || ''}, storyboard frame ${cellIndex + 1} of ${cellCount}`,
      status: 'idle',
    };
  });
}

export { buildStoryboardPlanFromPrompt };

export async function composeStoryboardGridImage(
  images: (HTMLImageElement | null)[],
  layout: { rows: number; cols: number },
  cellSize: number = 0,
  gap: number = 4,
): Promise<string> {
  const { rows, cols } = getStoryboardLayoutDimensions(layout);
  const totalCells = rows * cols;
  const effectiveCellSize = cellSize > 0
    ? cellSize
    : totalCells <= 9
      ? 512
      : totalCells <= 12
        ? 384
        : 256;
  const canvas = document.createElement('canvas');
  canvas.width = cols * effectiveCellSize + (cols + 1) * gap;
  canvas.height = rows * effectiveCellSize + (rows + 1) * gap;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    for (let colIndex = 0; colIndex < cols; colIndex++) {
      const cellIndex = rowIndex * cols + colIndex;
      const image = images[cellIndex];
      const x = colIndex * effectiveCellSize + (colIndex + 1) * gap;
      const y = rowIndex * effectiveCellSize + (rowIndex + 1) * gap;
      if (!image) {
        continue;
      }

      const scale = Math.max(effectiveCellSize / image.width, effectiveCellSize / image.height);
      const sw = effectiveCellSize / scale;
      const sh = effectiveCellSize / scale;
      const sx = (image.width - sw) / 2;
      const sy = (image.height - sh) / 2;
      ctx.drawImage(image, sx, sy, sw, sh, x, y, effectiveCellSize, effectiveCellSize);
    }
  }

  return canvas.toDataURL('image/png');
}
