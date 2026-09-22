import { persistGeneratedCanvasUrl } from '@/services/canvas-asset-actions';
import { composeStoryboardGridImage, shouldAbortStoryboardRun } from './storyboard-grid-core';
import { buildStoryboardPayload } from './storyboard-payload';
import { extractImageUrl } from '@/lib/subtitle-utils';
import type {
  DoubaoSeedreamBackground,
  DoubaoSeedreamOutputFormat,
  DoubaoSeedreamQuality,
  DoubaoSeedreamSize,
  ProviderExtensionParams,
  StoryboardPlanV2,
  StoryboardShot,
} from './storyboard-plan-v2';

export type MagicStoryboardShotStrategy = 'auto' | 'story' | 'portrait' | 'cinematic';

export interface MagicStoryboardExecutionParams {
  rows: number;
  cols: number;
  layoutMode: string;
  prompt: string;
  negativePrompt: string;
  shotStrategy: MagicStoryboardShotStrategy;
  reference?: string;
  characterRef?: string;
  outfitRef?: string;
  environmentRef?: string;
  consistencyStrength: number;
  characterLock: boolean;
  outfitLock: boolean;
  environmentLock: boolean;
  fallbackToReference: boolean;
  generateSingleFrames: boolean;
  composeGridImage: boolean;
  stopOnSystemError: boolean;
  continueOnCellFailure: boolean;
  modelId: string;
  modelProvider: string;
  size?: DoubaoSeedreamSize;
  quality?: DoubaoSeedreamQuality;
  gptOutputFormat?: DoubaoSeedreamOutputFormat;
  gptOutputCompression?: number;
  gptBackground?: DoubaoSeedreamBackground;
  moderation?: 'auto' | 'low';
  useMultiImageReferences?: boolean;
  maxReferenceImages?: number;
  maxReferenceFileSizeMB?: number;
  useEditEndpointWhenReferenceExists?: boolean;
  maxConcurrentFrames?: number;
  providerExtensions?: ProviderExtensionParams;
  processingMode?: 'selected' | 'sequence';
  selectedFrameIndex?: number;
}

export interface MagicStoryboardExecutionCell {
  cellIndex: number;
  row: number;
  col: number;
  label: string;
  shotPrompt: string;
  shot?: StoryboardShot;
}

export interface MagicStoryboardExecutionReferences {
  masterReference: string | null;
  characterReference: string | null;
  outfitReference: string | null;
  environmentReference: string | null;
}

export interface MagicStoryboardExecutionResult {
  frameResults: Array<{
    cellIndex: number;
    imageUrl: string;
    error?: string;
    status: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
    imageAssetId?: string;
    providerWarnings?: string[];
  }>;
  gridImageUrl: string;
  coverImageUrl: string;
  storyboardPayload: string;
  cellErrors: Record<number, string>;
  gridImageAssetId?: string;
}

type MagicStoryboardFrameResult = MagicStoryboardExecutionResult['frameResults'][number];

async function normalizeReferenceUrl(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const isBlob = url.startsWith('blob:');
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
  if (!isBlob && !isLocal) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read error'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function buildReferenceImages(args: {
  references: MagicStoryboardExecutionReferences;
  useMultiImageReferences?: boolean;
  maxReferenceImages?: number;
}): Promise<string[]> {
  const raw = [
    args.references.characterReference || args.references.masterReference || '',
    args.references.outfitReference || '',
    args.references.environmentReference || '',
    args.references.masterReference || '',
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const unique = Array.from(new Set(raw));
  const limited = (args.useMultiImageReferences === false ? unique.slice(0, 1) : unique)
    .slice(0, Math.max(1, Math.floor(args.maxReferenceImages || 4)));
  return Promise.all(limited.map((url) => normalizeReferenceUrl(url)));
}

export async function runMagicStoryboardExecution(args: {
  nodeId: string;
  params: MagicStoryboardExecutionParams;
  cells: MagicStoryboardExecutionCell[];
  dimensions: { rows: number; cols: number };
  selectedFrameIndex: number;
  processingMode: 'selected' | 'sequence';
  references: MagicStoryboardExecutionReferences;
  getAuthToken: () => string | null;
  apiBaseUrl: string;
  loadImageElements?: (urls: string[]) => Promise<Array<HTMLImageElement | null>>;
  existingFrameResults?: Array<{
    cellIndex: number;
    imageUrl: string;
    status: 'succeeded' | 'failed' | 'idle' | 'queued' | 'running';
    error?: string;
  }>;
  onlyCellIndexes?: number[];
  waitWhilePaused?: () => Promise<void>;
  shouldCancel?: () => boolean;
  shouldAbortFrame?: () => boolean;
  onFrameResultsChange?: (frameResults: MagicStoryboardFrameResult[]) => void;
  plan?: StoryboardPlanV2;
}): Promise<MagicStoryboardExecutionResult> {
  const token = args.getAuthToken();
  const frameResults: MagicStoryboardExecutionResult['frameResults'] = [];
  const cellErrors: Record<number, string> = {};
  const existingByCellIndex = new Map(
    (args.existingFrameResults || []).map((frame) => [frame.cellIndex, frame]),
  );
  const onlyCellIndexes = Array.isArray(args.onlyCellIndexes)
    ? new Set(args.onlyCellIndexes.map((value) => Math.max(0, Math.floor(value))))
    : null;
  const pushFrameResult = (frame: MagicStoryboardFrameResult) => {
    frameResults.push(frame);
    args.onFrameResultsChange?.([...frameResults]);
  };
  const referenceImages = await buildReferenceImages({
    references: args.references,
    useMultiImageReferences: args.params.useMultiImageReferences,
    maxReferenceImages: args.params.maxReferenceImages,
  });
  const effectiveCharacterReference = referenceImages[0] || '';
  const referencePrefix = [
    effectiveCharacterReference
      ? 'Use the reference image as the single source of truth for identity, costume, hairstyle, facial features, body proportions, background, lighting, color palette, and art style. Do not redesign, restyle, or reinterpret the reference. Only adjust framing and camera angle as requested. Maintain the same character identity as the reference image.'
      : '',
    args.references.outfitReference
      ? 'Keep outfit design, colors, patterns, accessories, and silhouette exactly consistent with the outfit reference image. Do not change or redesign any clothing details.'
      : '',
    args.references.environmentReference
      ? 'Preserve the environment style, background structure, lighting atmosphere, and color palette from the environment reference image exactly. Do not alter the setting or scenery.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  for (let index = 0; index < args.cells.length; index += 1) {
    const cell = args.cells[index];
    if (args.shouldCancel?.()) break;
    if (onlyCellIndexes && !onlyCellIndexes.has(cell.cellIndex)) {
      const existing = existingByCellIndex.get(cell.cellIndex);
      pushFrameResult(existing ? {
        cellIndex: existing.cellIndex,
        imageUrl: existing.imageUrl,
        status: existing.status === 'failed' ? 'failed' : 'succeeded',
        error: existing.error,
      } : {
        cellIndex: cell.cellIndex,
        imageUrl: '',
        error: '未选择重试',
        status: 'failed',
      });
      continue;
    }
    await args.waitWhilePaused?.();

    // ✅ P1-3：每帧创建 AbortController，暂停时中止当前帧
    const frameAbortController = new AbortController();
    const frameAbortWatcher = args.shouldAbortFrame
      ? setInterval(() => {
          if (args.shouldAbortFrame?.()) frameAbortController.abort();
        }, 250)
      : null;

    try {
      const response = await fetch(`${args.apiBaseUrl}/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: args.params.modelId,
          provider: args.params.modelProvider,
          prompt: [
            referencePrefix,
            cell.shotPrompt,
            args.params.negativePrompt ? `avoid: ${args.params.negativePrompt}` : '',
          ]
            .filter(Boolean)
            .join(', '),
          negativePrompt: args.params.negativePrompt,
          generationMode: referenceImages.length > 0 ? 'reference' : 'text_to_image',
          referenceImage: effectiveCharacterReference || undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          size: args.params.size || 'auto',
          quality: args.params.quality || 'medium',
          gptQuality: args.params.quality || 'medium',
          gptOutputFormat: args.params.gptOutputFormat || 'png',
          gptOutputCompression: args.params.gptOutputCompression,
          gptCompression: args.params.gptOutputCompression,
          gptBackground: args.params.gptBackground || 'opaque',
          moderation: args.params.moderation || 'auto',
          n: 1,
          characterConsistency: args.params.consistencyStrength,
          strength: effectiveCharacterReference ? 0.85 : undefined,
          source: 'storyboard-director',
          useEditEndpointWhenReferenceExists: args.params.useEditEndpointWhenReferenceExists ?? true,
          providerExtensions: args.params.providerExtensions,
        }),
        signal: frameAbortController.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const httpError = new Error(
          String((errBody as { error?: string; message?: string }).error || (errBody as { message?: string }).message || `HTTP ${response.status}`),
        );
        (httpError as Error & { status?: number }).status = response.status;
        console.error(`[magic-storyboard] Frame ${index + 1}/${args.cells.length} HTTP error:`, response.status, httpError.message);
        throw httpError;
      }

      const result = (await response.json()) as Record<string, unknown>;
      const data = (result.data ?? {}) as Record<string, unknown>;
      const providerWarnings = [
        ...((Array.isArray(data.warnings) ? data.warnings : []) as unknown[]),
        ...((Array.isArray((data as { providerWarnings?: unknown[] }).providerWarnings) ? (data as { providerWarnings?: unknown[] }).providerWarnings : []) as unknown[]),
      ]
        .map((warning) => String(warning || '').trim())
        .filter(Boolean);
      const dataStatus = String(data.status || '');
      if (dataStatus === 'failed' || dataStatus === 'error') {
        const dataError = String(data.error || '后端生成失败');
        console.error(`[magic-storyboard] Frame ${index + 1}/${args.cells.length} backend failed:`, dataError, 'taskId:', data.taskId);
        throw new Error(dataError);
      }

      const imageUrl = extractImageUrl(result);
      if (!imageUrl) {
        console.error(`[magic-storyboard] Frame ${index + 1}/${args.cells.length} no image URL in response:`, JSON.stringify(result).substring(0, 300));
        throw new Error('No image URL in response');
      }

      let finalImageUrl = imageUrl;
      try {
        const persisted = await persistGeneratedCanvasUrl({
          nodeId: args.nodeId,
          kind: 'image',
          url: imageUrl,
          fileName: `magic-storyboard-frame-${index + 1}.png`,
        });
        finalImageUrl = persisted.runtimeUrl || imageUrl;
      } catch (persistErr) {
        console.warn(`[magic-storyboard] persistGeneratedCanvasUrl failed for frame ${index + 1}, using original URL:`, persistErr);
      }

      console.log(`[magic-storyboard] Frame ${index + 1}/${args.cells.length} succeeded:`, finalImageUrl.substring(0, 80));
      pushFrameResult({
        cellIndex: cell.cellIndex,
        imageUrl: finalImageUrl,
        status: 'succeeded',
        providerWarnings,
      });
    } catch (error) {
      // ✅ P1-3：暂停触发的 abort，标记为 failed 并等待恢复
      const isAbort = (error as Error)?.name === 'AbortError';
      if (isAbort) {
        console.log(`[magic-storyboard] Frame ${index + 1}/${args.cells.length} aborted by pause`);
        cellErrors[index] = '已暂停，可重试该帧';
        pushFrameResult({
          cellIndex: cell.cellIndex,
          imageUrl: '',
          error: '已暂停，可重试该帧',
          status: 'failed',
        });
        await args.waitWhilePaused?.();
      } else {
        const status =
          typeof error === 'object' && error && 'status' in error
            ? (error as { status?: number }).status
            : undefined;
        const message = error instanceof Error ? error.message : '未知错误';
        console.error(`[magic-storyboard] Frame ${index + 1}/${args.cells.length} failed:`, message);
        cellErrors[index] = message;
        pushFrameResult({
          cellIndex: cell.cellIndex,
          imageUrl: '',
          error: message,
          status: 'failed',
        });

        if (shouldAbortStoryboardRun(status) && !args.params.continueOnCellFailure) {
          if (frameAbortWatcher) clearInterval(frameAbortWatcher);
          break;
        }
      }
    } finally {
      if (frameAbortWatcher) clearInterval(frameAbortWatcher);
    }
  }

  if (!frameResults.some((entry) => entry.imageUrl)) {
    return {
      frameResults,
      gridImageUrl: '',
      coverImageUrl: '',
      storyboardPayload: '',
      cellErrors,
    };
  }

  const loadImageElements =
    args.loadImageElements ||
    (async (urls: string[]) =>
      Promise.all(
        urls.map(async (url) => {
          if (!url) return null;
          return new Promise<HTMLImageElement | null>((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = url;
          });
        }),
      ));
  const imageElements = await loadImageElements(frameResults.map((entry) => entry.imageUrl));
  const rawGridUrl = await composeStoryboardGridImage(imageElements, {
    rows: args.dimensions.rows,
    cols: args.dimensions.cols,
  });
  let finalGridUrl = rawGridUrl;
  let gridImageAssetId: string | undefined;
  try {
    const persistedGrid = await persistGeneratedCanvasUrl({
      nodeId: args.nodeId,
      kind: 'image',
      url: rawGridUrl,
      fileName: `magic-storyboard-grid-${Date.now()}.png`,
    });
    finalGridUrl = persistedGrid.runtimeUrl || rawGridUrl;
    gridImageAssetId = persistedGrid.asset.id;
  } catch (persistErr) {
    console.warn('[magic-storyboard] persistGeneratedCanvasUrl failed for grid image, using original URL:', persistErr);
  }
  const coverImageUrl = frameResults.find((entry) => entry.imageUrl)?.imageUrl || '';
  const cellByIndex = new Map(args.cells.map((cell) => [cell.cellIndex, cell]));
  const storyboardPayload = buildStoryboardPayload({
    gridImageUrl: finalGridUrl,
    coverImageUrl,
    selectedFrameIndex: args.selectedFrameIndex,
    processingMode: args.processingMode,
    plan: args.plan,
    providerTrace: args.plan
      ? frameResults.map((entry) => ({
          frameIndex: entry.cellIndex,
          provider: args.params.modelProvider,
          model: args.params.modelId,
          endpoint: referenceImages.length > 0 && args.params.useEditEndpointWhenReferenceExists ? 'edits' : 'generations',
          size: args.params.size || 'auto',
          quality: args.params.quality || 'medium',
          outputFormat: args.params.gptOutputFormat || 'png',
          warnings: entry.providerWarnings,
        }))
      : undefined,
    costEstimate: args.plan
      ? {
          frameCount: args.plan.shots.length,
          quality: args.params.quality || 'medium',
          size: args.params.size || 'auto',
          riskLevel:
            args.plan.shots.length >= 24 || args.params.quality === 'high'
              ? 'high'
              : args.plan.shots.length >= 12
                ? 'medium'
                : 'low',
          notes: [],
        }
      : undefined,
    frames: frameResults.map((entry) => {
      const sourceCell = cellByIndex.get(entry.cellIndex);
      return {
      cellIndex: entry.cellIndex,
      rowIndex: Math.floor(entry.cellIndex / args.dimensions.cols),
      colIndex: entry.cellIndex % args.dimensions.cols,
      imageUrl: entry.imageUrl,
      prompt: sourceCell?.shotPrompt || '',
      status: entry.status,
      error: entry.error,
      characterRef: args.references.characterReference || undefined,
      outfitRef: args.references.outfitReference || undefined,
      environmentRef: args.references.environmentReference || undefined,
      shotId: sourceCell?.shot?.id,
      label: sourceCell?.label,
      beat: sourceCell?.shot?.beat,
      emotionalBeat: sourceCell?.shot?.emotionalBeat,
      shotType: sourceCell?.shot?.shotType,
      cameraAngle: sourceCell?.shot?.cameraAngle,
      cameraMove: sourceCell?.shot?.cameraMove,
      continuity: sourceCell?.shot?.continuity,
      referenceImageCount: referenceImages.length,
      providerWarnings: entry.providerWarnings,
      };
    }),
  });

  return {
    frameResults,
    gridImageUrl: finalGridUrl,
    gridImageAssetId,
    coverImageUrl,
    storyboardPayload,
    cellErrors,
  };
}
