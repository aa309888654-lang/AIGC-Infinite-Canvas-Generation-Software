import {
  runMagicStoryboardExecution,
  type MagicStoryboardExecutionResult,
} from './magic-storyboard-execution';
import {
  runPhotoGridExecution,
  type PhotoGridExecutionCell,
} from './photo-grid-execution';
import {
  buildStoryboardPlanFromPrompt,
  buildStoryboardCellsFromPlan,
  getStoryboardLayoutDimensions,
  normalizeStoryboardReferences,
  shouldAbortStoryboardRun,
} from './storyboard-grid-core';
import { buildStoryboardPayload } from './storyboard-payload';
import type {
  DoubaoSeedreamBackground,
  DoubaoSeedreamOutputFormat,
  DoubaoSeedreamQuality,
  DoubaoSeedreamSize,
  ProviderExtensionParams,
  StoryboardPlanV2,
  StoryboardShot,
} from './storyboard-plan-v2';

export type GridDirectorMode = 'grid' | 'storyboard' | 'hybrid' | 'split';

export interface GridDirectorParams {
  mode: GridDirectorMode;
  rows: number;
  cols: number;
  preset: string;
  layout: string;
  prompt: string;
  negativePrompt: string;
  shotStrategy: 'auto' | 'story' | 'portrait' | 'cinematic';
  consistencyStrength: number;
  characterLock: boolean;
  outfitLock: boolean;
  environmentLock: boolean;
  generateSingleFrames: boolean;
  composeGridImage: boolean;
  processingMode: 'selected' | 'sequence';
  selectedFrameIndex: number;
  modelId: string;
  modelProvider: string;
  size: DoubaoSeedreamSize;
  quality: DoubaoSeedreamQuality;
  gptOutputFormat: DoubaoSeedreamOutputFormat;
  gptOutputCompression?: number;
  gptBackground: DoubaoSeedreamBackground;
  moderation: 'auto' | 'low';
  useMultiImageReferences: boolean;
  maxReferenceImages: number;
  maxReferenceFileSizeMB: number;
  useEditEndpointWhenReferenceExists: boolean;
  maxConcurrentFrames: number;
  providerExtensions?: ProviderExtensionParams;
  reference?: string;
  characterRef?: string;
  outfitRef?: string;
  environmentRef?: string;
  fallbackToReference?: boolean;
  gap?: number;
  splitBackgroundColor?: string;
}

export const DEFAULT_GRID_DIRECTOR_PARAMS: GridDirectorParams = {
  mode: 'grid',
  rows: 3,
  cols: 3,
  preset: 'character_turnaround',
  layout: '3x3',
  prompt: '',
  negativePrompt: '',
  shotStrategy: 'auto',
  consistencyStrength: 0.85,
  characterLock: true,
  outfitLock: true,
  environmentLock: true,
  generateSingleFrames: true,
  composeGridImage: true,
  processingMode: 'selected',
  selectedFrameIndex: 0,
  modelId: 'doubao-seedream-5-0-pro',
  modelProvider: 'doubao',
  size: 'auto',
  quality: 'medium',
  gptOutputFormat: 'png',
  gptBackground: 'opaque',
  moderation: 'auto',
  useMultiImageReferences: true,
  maxReferenceImages: 4,
  maxReferenceFileSizeMB: 1.5,
  useEditEndpointWhenReferenceExists: true,
  maxConcurrentFrames: 2,
  fallbackToReference: true,
  gap: 4,
  splitBackgroundColor: '#1a1a2e',
};

export interface GridDirectorFrameResult {
  cellIndex: number;
  rowIndex: number;
  colIndex: number;
  imageUrl: string;
  prompt: string;
  label?: string;
  shot?: StoryboardShot;
  providerWarnings?: string[];
  status: 'succeeded' | 'failed';
  error?: string;
}

export interface GridDirectorRunResult {
  frameResults: GridDirectorFrameResult[];
  gridImageUrl: string;
  coverImageUrl: string;
  storyboardPayload: string;
  storyboardPlan?: StoryboardPlanV2;
}

export type GridDirectorRunError = Error & {
  partialResult?: GridDirectorRunResult;
};

export interface GridDirectorReferenceInputs {
  reference?: string;
  characterRef?: string;
  outfitRef?: string;
  environmentRef?: string;
}

type GridDirectorExecutionArgs = {
  nodeId: string;
  params: GridDirectorParams;
  references?: GridDirectorReferenceInputs;
  getAuthToken: () => string | null;
  apiBaseUrl: string;
  loadImageElements?: (urls: string[]) => Promise<Array<HTMLImageElement | null>>;
  existingFrameResults?: GridDirectorFrameResult[];
  onlyCellIndexes?: number[];
  waitWhilePaused?: () => Promise<void>;
  shouldCancel?: () => boolean;
  shouldAbortFrame?: () => boolean;
  onFrameResultsChange?: (frameResults: GridDirectorFrameResult[]) => void;
};

function parseLayoutDimensions(layout: string | undefined) {
  const match = typeof layout === 'string' ? layout.match(/^(\d+)x(\d+)$/) : null;
  if (!match) {
    return null;
  }

  return {
    cols: Math.max(1, Number(match[1]) || 1),
    rows: Math.max(1, Number(match[2]) || 1),
  };
}

function resolveGridDimensions(params: GridDirectorParams) {
  const parsedLayout = parseLayoutDimensions(params.layout);
  const rows = Math.max(1, Math.floor(params.rows || parsedLayout?.rows || 1));
  const cols = Math.max(1, Math.floor(params.cols || parsedLayout?.cols || 1));
  return { rows, cols };
}

export function buildGridMatrix(params: GridDirectorParams, rows: number, cols: number): PhotoGridExecutionCell[] {
  const total = rows * cols;
  const preset = params.preset || 'character_turnaround';
  const matrix: PhotoGridExecutionCell[] = [];
  const pushSpec = (
    spec: Array<Omit<PhotoGridExecutionCell, 'row' | 'col'>>,
  ) => {
    for (let index = 0; index < total; index += 1) {
      const cell = spec[index] || spec[spec.length - 1];
      matrix.push({
        row: Math.floor(index / cols),
        col: index % cols,
        ...cell,
      });
    }
  };

  if (preset === 'product_showcase') {
    pushSpec([
      { angle: 'front', shot: 'medium', label: '正面·中景' },
      { angle: 'front_right45', shot: 'medium', label: '右前45°·中景' },
      { angle: 'top_down', shot: 'medium', label: '俯拍·中景' },
      { angle: 'front_left45', shot: 'medium', label: '左前45°·中景' },
      { angle: 'front_right45', shot: 'extreme_closeup', label: '右侧·细节特写' },
      { angle: 'front_left45', shot: 'extreme_closeup', label: '左侧·材质特写' },
      { angle: 'back', shot: 'medium', label: '背面·中景' },
      { angle: 'bottom_up', shot: 'medium', label: '仰拍·中景' },
      { angle: 'front', shot: 'full', label: '正面·场景全景' },
    ]);
    return matrix;
  }

  if (preset === 'architecture') {
    pushSpec([
      { angle: 'front', shot: 'full', label: '正面·全景·白天', lightingOverride: 'natural_sun' },
      { angle: 'front_right45', shot: 'medium', label: '右前45°·中景·白天', lightingOverride: 'natural_sun' },
      { angle: 'bird_eye', shot: 'long', label: '鸟瞰·远景·白天', lightingOverride: 'natural_sun' },
      { angle: 'front', shot: 'full', label: '正面·全景·黄昏', lightingOverride: 'golden_hour' },
      { angle: 'front_left45', shot: 'medium', label: '左前45°·中景·黄昏', lightingOverride: 'golden_hour' },
      { angle: 'bottom_up', shot: 'medium', label: '仰拍·中景·黄昏', lightingOverride: 'golden_hour' },
      { angle: 'front', shot: 'full', label: '正面·全景·夜景', lightingOverride: 'neon_noir' },
      { angle: 'front_right45', shot: 'closeup', label: '右前·入口特写·夜景', lightingOverride: 'neon_noir' },
      { angle: 'top_down', shot: 'full', label: '俯拍·全景·夜景', lightingOverride: 'neon_noir' },
    ]);
    return matrix;
  }

  if (preset === 'character_fullset') {
    pushSpec([
      { angle: 'front', shot: 'medium', label: '正面·中景' },
      { angle: 'front_right45', shot: 'medium', label: '右前45°·中景' },
      { angle: 'right90', shot: 'medium', label: '右侧·中景' },
      { angle: 'front_left45', shot: 'medium', label: '左前45°·中景' },
      { angle: 'back', shot: 'medium', label: '背面·中景' },
      { angle: 'top_down', shot: 'medium', label: '俯拍·中景' },
      { angle: 'bottom_up', shot: 'full', label: '仰拍·全身' },
      { angle: 'front', shot: 'closeup', label: '正面·面部特写' },
      { angle: 'bird_eye', shot: 'full', label: '鸟瞰·全身' },
      { angle: 'front_right45', shot: 'full', label: '右前45°·全身' },
      { angle: 'dutch_angle', shot: 'medium', label: '斜角·动感构图' },
      { angle: 'front_right45', shot: 'closeup', label: '右前·表情特写' },
    ]);
    return matrix;
  }

  if (preset === 'storyboard_full') {
    pushSpec([
      { angle: 'front', shot: 'full', label: '开场·全景' },
      { angle: 'front', shot: 'medium', label: '主角·中景' },
      { angle: 'front', shot: 'closeup', label: '表情·特写' },
      { angle: 'front_right45', shot: 'medium', label: '对话·右前' },
      { angle: 'front_left45', shot: 'medium', label: '对话·左前' },
      { angle: 'right90', shot: 'full', label: '侧面·全身' },
      { angle: 'back_right45', shot: 'medium', label: '转身·右后' },
      { angle: 'back', shot: 'full', label: '背影·全身' },
      { angle: 'top_down', shot: 'full', label: '俯拍·全景' },
      { angle: 'bottom_up', shot: 'full', label: '仰拍·气势' },
      { angle: 'dutch_angle', shot: 'medium', label: '紧张·斜角' },
      { angle: 'front', shot: 'extreme_closeup', label: '细节·极致特写' },
      { angle: 'front_right45', shot: 'long', label: '远望·右前远景' },
      { angle: 'bird_eye', shot: 'full', label: '鸟瞰·大场景' },
      { angle: 'front', shot: 'medium_close', label: '情感·近景' },
      { angle: 'front_left45', shot: 'closeup', label: '回忆·左前特写' },
      { angle: 'right90', shot: 'medium', label: '行走·侧面' },
      { angle: 'back_left45', shot: 'medium', label: '离去·左后' },
      { angle: 'front', shot: 'full', label: '对峙·全景' },
      { angle: 'front_right45', shot: 'closeup', label: '决心·右前特写' },
      { angle: 'top_down', shot: 'medium', label: '俯视·中景' },
      { angle: 'front', shot: 'long', label: '结局·远景' },
      { angle: 'front', shot: 'closeup', label: '终幕·特写' },
      { angle: 'bird_eye', shot: 'long', label: '收尾·鸟瞰远景' },
    ]);
    return matrix;
  }

  if (preset === 'product_360') {
    pushSpec([
      { angle: 'front', shot: 'medium', label: '正面·中景' },
      { angle: 'front', shot: 'closeup', label: '正面·细节特写' },
      { angle: 'front_right45', shot: 'medium', label: '右前45°·中景' },
      { angle: 'front_right45', shot: 'closeup', label: '右前45°·细节' },
      { angle: 'right90', shot: 'medium', label: '右侧90°·中景' },
      { angle: 'right90', shot: 'closeup', label: '右侧90°·细节' },
      { angle: 'back_right45', shot: 'medium', label: '右后45°·中景' },
      { angle: 'back_right45', shot: 'closeup', label: '右后45°·细节' },
      { angle: 'back', shot: 'medium', label: '背面·中景' },
      { angle: 'back', shot: 'closeup', label: '背面·细节' },
      { angle: 'back_left45', shot: 'medium', label: '左后45°·中景' },
      { angle: 'back_left45', shot: 'closeup', label: '左后45°·细节' },
      { angle: 'left90', shot: 'medium', label: '左侧90°·中景' },
      { angle: 'left90', shot: 'closeup', label: '左侧90°·细节' },
      { angle: 'front_left45', shot: 'medium', label: '左前45°·中景' },
      { angle: 'front_left45', shot: 'closeup', label: '左前45°·细节' },
      { angle: 'top_down', shot: 'medium', label: '俯拍·中景' },
      { angle: 'top_down', shot: 'closeup', label: '俯拍·细节' },
      { angle: 'bottom_up', shot: 'medium', label: '仰拍·中景' },
      { angle: 'bottom_up', shot: 'closeup', label: '仰拍·细节' },
      { angle: 'bird_eye', shot: 'full', label: '鸟瞰·全景' },
      { angle: 'front', shot: 'extreme_closeup', label: '正面·材质极致特写' },
      { angle: 'front_right45', shot: 'extreme_closeup', label: '右侧·纹理极致特写' },
      { angle: 'front', shot: 'full', label: '正面·场景全景' },
    ]);
    return matrix;
  }

  pushSpec([
    { angle: 'front', shot: 'medium', label: '正面·中景' },
    { angle: 'front_right45', shot: 'medium', label: '右前45°·中景' },
    { angle: 'right90', shot: 'medium', label: '右侧·中景' },
    { angle: 'front_left45', shot: 'medium', label: '左前45°·中景' },
    { angle: 'back', shot: 'medium', label: '背面·中景' },
    { angle: 'top_down', shot: 'medium', label: '俯拍·中景' },
    { angle: 'bottom_up', shot: 'full', label: '仰拍·全身' },
    { angle: 'front', shot: 'closeup', label: '正面·特写' },
    { angle: 'front_right45', shot: 'full', label: '右前45°·全身' },
  ]);
  return matrix;
}

function buildGridPayload(args: {
  params: GridDirectorParams;
  frameResults: GridDirectorFrameResult[];
  gridImageUrl: string;
  coverImageUrl: string;
  references: ReturnType<typeof normalizeStoryboardReferences>;
}): string {
  return buildStoryboardPayload({
    sourceNodeType: 'gridDirector',
    gridImageUrl: args.gridImageUrl || undefined,
    coverImageUrl: args.coverImageUrl || undefined,
    selectedFrameIndex: args.params.selectedFrameIndex,
    processingMode: args.params.processingMode,
    frames: args.frameResults.map((frame) => ({
      cellIndex: frame.cellIndex,
      rowIndex: frame.rowIndex,
      colIndex: frame.colIndex,
      imageUrl: frame.imageUrl,
      prompt: frame.prompt,
      status: frame.status,
      error: frame.error,
      characterRef: args.references.characterReference || undefined,
      outfitRef: args.references.outfitReference || undefined,
      environmentRef: args.references.environmentReference || undefined,
    })),
  });
}

async function buildGridModeResult(args: GridDirectorExecutionArgs): Promise<GridDirectorRunResult> {
  const { rows, cols } = resolveGridDimensions(args.params);
  const references = normalizeStoryboardReferences({
    reference: args.references?.reference || args.params.reference,
    characterRef: args.references?.characterRef || args.params.characterRef,
    outfitRef: args.references?.outfitRef || args.params.outfitRef,
    environmentRef: args.references?.environmentRef || args.params.environmentRef,
    fallbackToReference: args.params.fallbackToReference ?? true,
  });
  const executionResult = await runPhotoGridExecution({
    nodeId: args.nodeId,
    params: {
      prompt: args.params.prompt,
      negativePrompt: args.params.negativePrompt,
      lighting: 'studio_soft',
      aspectRatio: '1:1',
      quality: args.params.quality,
      size: args.params.size,
      gptOutputFormat: args.params.gptOutputFormat,
      gptOutputCompression: args.params.gptOutputCompression,
      gptBackground: args.params.gptBackground,
      moderation: args.params.moderation,
      useMultiImageReferences: args.params.useMultiImageReferences,
      maxReferenceImages: args.params.maxReferenceImages,
      useEditEndpointWhenReferenceExists: args.params.useEditEndpointWhenReferenceExists,
      providerExtensions: args.params.providerExtensions,
      seed: -1,
      cfgScale: 7.5,
      characterConsistency: args.params.consistencyStrength,
    },
    gridMatrix: buildGridMatrix(args.params, rows, cols),
    gridRows: rows,
    gridCols: cols,
    effectivePrompt: args.params.prompt,
    effectiveReferenceImage: references.characterReference || references.masterReference || '',
    effectiveOutfitReference: references.outfitReference || '',
    effectiveEnvironmentReference: references.environmentReference || '',
    requestedModel: {
      value: args.params.modelId,
      provider: args.params.modelProvider,
    },
    getAuthToken: args.getAuthToken,
    apiBaseUrl: args.apiBaseUrl,
    shouldAbortRun: shouldAbortStoryboardRun,
    loadImageElements: args.loadImageElements,
    existingFrameResults: args.existingFrameResults,
    onlyCellIndexes: args.onlyCellIndexes,
    waitWhilePaused: args.waitWhilePaused,
    shouldCancel: args.shouldCancel,
    shouldAbortFrame: args.shouldAbortFrame,
    onFrameResultsChange: args.onFrameResultsChange,
  });
  const frameResults: GridDirectorFrameResult[] = executionResult.frameResults.map((frame) => ({
    cellIndex: frame.cellIndex,
    rowIndex: frame.rowIndex,
    colIndex: frame.colIndex,
    imageUrl: frame.imageUrl,
    prompt: frame.prompt,
    status: frame.status,
    error: frame.error,
  }));
  const coverImageUrl =
    frameResults.find((frame) => frame.cellIndex === args.params.selectedFrameIndex && frame.imageUrl)?.imageUrl ||
    executionResult.coverImageUrl ||
    frameResults.find((frame) => frame.imageUrl)?.imageUrl ||
    executionResult.gridImageUrl ||
    '';

  return {
    frameResults,
    coverImageUrl,
    gridImageUrl: executionResult.gridImageUrl,
    storyboardPayload: buildGridPayload({
      params: args.params,
      frameResults,
      gridImageUrl: executionResult.gridImageUrl,
      coverImageUrl,
      references,
    }),
  };
}

async function buildStoryboardModeResult(
  args: GridDirectorExecutionArgs,
  referenceOverrides?: GridDirectorReferenceInputs,
): Promise<GridDirectorRunResult> {
  const dimensions = getStoryboardLayoutDimensions(resolveGridDimensions(args.params));
  const storyboardPlan = buildStoryboardPlanFromPrompt({
    rows: dimensions.rows,
    cols: dimensions.cols,
    prompt: args.params.prompt,
    shotStrategy: args.params.shotStrategy,
    size: args.params.size,
    modelId: args.params.modelId,
    provider: args.params.modelProvider,
    quality: args.params.quality,
    outputFormat: args.params.gptOutputFormat,
    outputCompression: args.params.gptOutputCompression,
    background: args.params.gptBackground,
    moderation: args.params.moderation,
    useMultiImageReferences: args.params.useMultiImageReferences,
    useEditEndpointWhenReferenceExists: args.params.useEditEndpointWhenReferenceExists,
    maxReferenceImages: args.params.maxReferenceImages,
    maxReferenceFileSizeMB: args.params.maxReferenceFileSizeMB,
    maxConcurrentFrames: args.params.maxConcurrentFrames,
    providerExtensions: args.params.providerExtensions,
  });
  const storyboardCells = buildStoryboardCellsFromPlan({
    plan: storyboardPlan,
    rows: dimensions.rows,
    cols: dimensions.cols,
    basePrompt: args.params.prompt,
    negativePrompt: args.params.negativePrompt,
  });
  const references = normalizeStoryboardReferences({
    reference: referenceOverrides?.reference || args.references?.reference || args.params.reference,
    characterRef:
      referenceOverrides?.characterRef || args.references?.characterRef || args.params.characterRef,
    outfitRef: referenceOverrides?.outfitRef || args.references?.outfitRef || args.params.outfitRef,
    environmentRef:
      referenceOverrides?.environmentRef ||
      args.references?.environmentRef ||
      args.params.environmentRef,
    fallbackToReference: args.params.fallbackToReference ?? true,
  });
  const executionResult: MagicStoryboardExecutionResult = await runMagicStoryboardExecution({
    nodeId: args.nodeId,
    params: {
      rows: dimensions.rows,
      cols: dimensions.cols,
      layoutMode: 'custom',
      prompt: args.params.prompt,
      negativePrompt: args.params.negativePrompt,
      shotStrategy: args.params.shotStrategy,
      consistencyStrength: args.params.consistencyStrength,
      characterLock: args.params.characterLock,
      outfitLock: args.params.outfitLock,
      environmentLock: args.params.environmentLock,
      fallbackToReference: args.params.fallbackToReference ?? true,
      generateSingleFrames: args.params.generateSingleFrames,
      composeGridImage: args.params.composeGridImage,
      stopOnSystemError: true,
      continueOnCellFailure: true,
      modelId: args.params.modelId,
      modelProvider: args.params.modelProvider,
      size: args.params.size,
      quality: args.params.quality,
      gptOutputFormat: args.params.gptOutputFormat,
      gptOutputCompression: args.params.gptOutputCompression,
      gptBackground: args.params.gptBackground,
      moderation: args.params.moderation,
      useMultiImageReferences: args.params.useMultiImageReferences,
      maxReferenceImages: args.params.maxReferenceImages,
      maxReferenceFileSizeMB: args.params.maxReferenceFileSizeMB,
      useEditEndpointWhenReferenceExists: args.params.useEditEndpointWhenReferenceExists,
      maxConcurrentFrames: args.params.maxConcurrentFrames,
      providerExtensions: args.params.providerExtensions,
      processingMode: args.params.processingMode,
      selectedFrameIndex: args.params.selectedFrameIndex,
    },
    cells: storyboardCells.map((cell) => ({
      cellIndex: cell.cellIndex,
      row: cell.rowIndex,
      col: cell.colIndex,
      label: cell.label,
      shotPrompt: cell.shotPrompt,
      shot: cell.shot,
    })),
    dimensions,
    selectedFrameIndex: args.params.selectedFrameIndex,
    processingMode: args.params.processingMode,
    references: {
      masterReference: references.masterReference || null,
      characterReference: references.characterReference || null,
      outfitReference: references.outfitReference || null,
      environmentReference: references.environmentReference || null,
    },
    getAuthToken: args.getAuthToken,
    apiBaseUrl: args.apiBaseUrl,
    loadImageElements: args.loadImageElements,
    existingFrameResults: args.existingFrameResults,
    onlyCellIndexes: args.onlyCellIndexes,
    waitWhilePaused: args.waitWhilePaused,
    shouldCancel: args.shouldCancel,
    shouldAbortFrame: args.shouldAbortFrame,
    plan: storyboardPlan,
    onFrameResultsChange: (frames) => {
      args.onFrameResultsChange?.(frames.map((frame) => {
        const cellIndex = frame.cellIndex;
        return {
          cellIndex,
          rowIndex: Math.floor(cellIndex / dimensions.cols),
          colIndex: cellIndex % dimensions.cols,
          imageUrl: frame.imageUrl,
          prompt: storyboardCells.find((cell) => cell.cellIndex === cellIndex)?.shotPrompt || '',
          label: storyboardCells.find((cell) => cell.cellIndex === cellIndex)?.label,
          shot: storyboardCells.find((cell) => cell.cellIndex === cellIndex)?.shot,
          providerWarnings: frame.providerWarnings,
          status: (frame.status === 'failed' ? 'failed' : 'succeeded') as 'succeeded' | 'failed',
          error: frame.error,
        };
      }));
    },
  });
  const frameResults = executionResult.frameResults.map((frame, index) => ({
    cellIndex: frame.cellIndex,
    rowIndex: Math.floor(frame.cellIndex / dimensions.cols),
    colIndex: frame.cellIndex % dimensions.cols,
    imageUrl: frame.imageUrl,
    prompt:
      storyboardCells.find((cell) => cell.cellIndex === frame.cellIndex)?.shotPrompt ||
      storyboardCells[index]?.shotPrompt ||
      '',
    label:
      storyboardCells.find((cell) => cell.cellIndex === frame.cellIndex)?.label ||
      storyboardCells[index]?.label,
    shot:
      storyboardCells.find((cell) => cell.cellIndex === frame.cellIndex)?.shot ||
      storyboardCells[index]?.shot,
    providerWarnings: frame.providerWarnings,
    status: (frame.status === 'failed' ? 'failed' : 'succeeded') as 'succeeded' | 'failed',
    error: frame.error,
  }));

  return {
    frameResults,
    gridImageUrl: executionResult.gridImageUrl,
    coverImageUrl: executionResult.coverImageUrl,
    storyboardPayload: executionResult.storyboardPayload,
    storyboardPlan,
  };
}

async function buildHybridModeResult(args: GridDirectorExecutionArgs): Promise<GridDirectorRunResult> {
  const gridResult = await buildGridModeResult(args);
  const selectedGridFrame =
    gridResult.frameResults.find(
      (frame) => frame.cellIndex === args.params.selectedFrameIndex && !!frame.imageUrl,
    ) || gridResult.frameResults.find((frame) => !!frame.imageUrl);

  if (!selectedGridFrame) {
    return gridResult;
  }

  try {
    return await buildStoryboardModeResult(args, {
      ...args.references,
      reference: selectedGridFrame.imageUrl,
      characterRef: selectedGridFrame.imageUrl,
    });
  } catch (error) {
    const failure =
      error instanceof Error ? error : new Error('Hybrid storyboard stage failed');
    throw Object.assign(failure, {
      partialResult: gridResult,
    } satisfies Pick<GridDirectorRunError, 'partialResult'>);
  }
}

export async function runGridDirectorMode(
  args: GridDirectorExecutionArgs,
): Promise<GridDirectorRunResult> {
  if (args.params.mode === 'split') {
    return {
      frameResults: [],
      gridImageUrl: '',
      coverImageUrl: '',
      storyboardPayload: '',
    };
  }
  if (args.params.mode === 'storyboard') {
    return buildStoryboardModeResult(args);
  }
  if (args.params.mode === 'hybrid') {
    return buildHybridModeResult(args);
  }
  return buildGridModeResult(args);
}
