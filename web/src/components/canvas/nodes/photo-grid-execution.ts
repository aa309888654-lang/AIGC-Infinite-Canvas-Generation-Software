import { composeStoryboardGridImage } from './storyboard-grid-core';
import { extractImageUrl } from '@/lib/subtitle-utils';
import type {
  DoubaoSeedreamBackground,
  DoubaoSeedreamOutputFormat,
  DoubaoSeedreamQuality,
  DoubaoSeedreamSize,
  ProviderExtensionParams,
} from './storyboard-plan-v2';

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

export type PhotoGridShotType =
  | 'extreme_closeup'
  | 'closeup'
  | 'medium_close'
  | 'medium'
  | 'full'
  | 'long'
  | 'extreme_long';

export type PhotoGridCameraAngle =
  | 'front'
  | 'front_right45'
  | 'right90'
  | 'back_right45'
  | 'back'
  | 'back_left45'
  | 'left90'
  | 'front_left45'
  | 'top_down'
  | 'bottom_up'
  | 'bird_eye'
  | 'dutch_angle';

export type PhotoGridLightingStyle =
  | 'studio_soft'
  | 'dramatic_rim'
  | 'natural_sun'
  | 'golden_hour'
  | 'neon_noir'
  | 'cool_shadow'
  | 'even_three_point'
  | 'split_lighting';

export interface PhotoGridExecutionCell {
  row: number;
  col: number;
  angle: PhotoGridCameraAngle;
  shot: PhotoGridShotType;
  lightingOverride?: PhotoGridLightingStyle;
  label: string;
}

export interface PhotoGridExecutionParams {
  prompt: string;
  negativePrompt: string;
  lighting: PhotoGridLightingStyle;
  aspectRatio: string;
  quality: string | DoubaoSeedreamQuality;
  size?: DoubaoSeedreamSize;
  gptOutputFormat?: DoubaoSeedreamOutputFormat;
  gptOutputCompression?: number;
  gptBackground?: DoubaoSeedreamBackground;
  moderation?: 'auto' | 'low';
  useMultiImageReferences?: boolean;
  maxReferenceImages?: number;
  useEditEndpointWhenReferenceExists?: boolean;
  providerExtensions?: ProviderExtensionParams;
  seed: number;
  cfgScale: number;
  characterConsistency: number;
}

export interface PhotoGridExecutionModel {
  value: string;
  provider: string;
}

export interface PhotoGridExecutionResult {
  gridImageUrl: string;
  coverImageUrl: string;
  frameResults: Array<{
    cellIndex: number;
    rowIndex: number;
    colIndex: number;
    imageUrl: string;
    prompt: string;
    status: 'succeeded' | 'failed';
    error?: string;
  }>;
}

type PhotoGridFrameResult = PhotoGridExecutionResult['frameResults'][number];

const STRICT_REFERENCE_BINDING_PROMPT =
  'Use the reference image as the single source of truth for identity, costume, hairstyle, facial features, body proportions, background, lighting, color palette, and art style. Do not redesign, restyle, or reinterpret the reference. Only adjust framing and camera angle as requested.';

const ANGLE_PROMPT_HINTS: Record<PhotoGridCameraAngle, string> = {
  front: 'front-facing, looking directly at camera',
  front_right45: '3/4 view from front-right, slightly turned',
  right90: 'perfect side profile, facing right',
  back_right45: '3/4 view from back-right, looking over shoulder',
  back: 'shot from behind, back view',
  back_left45: '3/4 view from back-left',
  left90: 'perfect side profile, facing left',
  front_left45: '3/4 view from front-left',
  top_down: 'high angle, shot from above looking down',
  bottom_up: 'low angle, shot from below looking up, heroic perspective',
  bird_eye: 'bird eye view, directly overhead',
  dutch_angle: 'Dutch tilt, canted frame, dynamic diagonal composition',
};

const SHOT_PROMPT_HINTS: Record<PhotoGridShotType, string> = {
  extreme_closeup: 'extreme close-up, macro detail, texture focus, very tight framing',
  closeup: 'close-up portrait, face filling frame, intimate',
  medium_close: 'medium close-up, head and shoulders, bust shot',
  medium: 'medium shot, waist up, standard portrait framing',
  full: 'full body shot, head to toe, complete figure',
  long: 'long shot, full figure small in frame, environment visible',
  extreme_long: 'extreme long shot, tiny figure, vast environment, establishing shot',
};

const LIGHTING_PROMPT_HINTS: Record<PhotoGridLightingStyle, string> = {
  studio_soft: 'soft diffused studio lighting, clean white background, product photography',
  dramatic_rim: 'dramatic rim lighting, strong backlight, silhouette edge glow, moody',
  natural_sun: 'natural sunlight, outdoor, golden hour warmth',
  golden_hour: 'golden hour, warm sunset backlight, lens flare, dreamy atmosphere',
  neon_noir: 'neon noir, cyberpunk lighting, colored gels, rain-slicked streets',
  cool_shadow: 'cool shadows, moody atmosphere, misty, blue hour',
  even_three_point: 'three-point lighting, even exposure, professional studio',
  split_lighting: 'split lighting, half face illuminated half in shadow, dramatic contrast',
};


export async function runPhotoGridExecution(args: {
  nodeId: string;
  params: PhotoGridExecutionParams;
  gridMatrix: PhotoGridExecutionCell[];
  gridRows: number;
  gridCols: number;
  effectivePrompt: string;
  effectiveReferenceImage: string;
  effectiveOutfitReference?: string;
  effectiveEnvironmentReference?: string;
  requestedModel: PhotoGridExecutionModel;
  getAuthToken: () => string | null;
  apiBaseUrl: string;
  shouldAbortRun: (status?: number) => boolean;
  loadImageElements?: (urls: string[]) => Promise<Array<HTMLImageElement | null>>;
  existingFrameResults?: PhotoGridFrameResult[];
  onlyCellIndexes?: number[];
  waitWhilePaused?: () => Promise<void>;
  shouldCancel?: () => boolean;
  shouldAbortFrame?: () => boolean;
  onFrameResultsChange?: (frameResults: PhotoGridFrameResult[]) => void;
}): Promise<PhotoGridExecutionResult> {
  const frameResults: PhotoGridExecutionResult['frameResults'] = [];
  const existingByCellIndex = new Map(
    (args.existingFrameResults || []).map((frame) => [frame.cellIndex, frame]),
  );
  const onlyCellIndexes = Array.isArray(args.onlyCellIndexes)
    ? new Set(args.onlyCellIndexes.map((value) => Math.max(0, Math.floor(value))))
    : null;
  const pushFrameResult = (frame: PhotoGridFrameResult) => {
    frameResults.push(frame);
    args.onFrameResultsChange?.([...frameResults]);
  };

  const effectiveReferenceImage = await normalizeReferenceUrl(args.effectiveReferenceImage);
  const effectiveOutfitReference = args.effectiveOutfitReference ? await normalizeReferenceUrl(args.effectiveOutfitReference) : '';
  const effectiveEnvironmentReference = args.effectiveEnvironmentReference ? await normalizeReferenceUrl(args.effectiveEnvironmentReference) : '';
  const effectivePrompt = args.effectivePrompt;

  for (let index = 0; index < args.gridMatrix.length; index += 1) {
    const cell = args.gridMatrix[index];
    if (args.shouldCancel?.()) break;
    if (onlyCellIndexes && !onlyCellIndexes.has(index)) {
      const existing = existingByCellIndex.get(index);
      pushFrameResult(existing || {
        cellIndex: index,
        rowIndex: cell.row,
        colIndex: cell.col,
        imageUrl: '',
        prompt: '',
        status: 'failed',
        error: '未选择重试',
      });
      continue;
    }
    await args.waitWhilePaused?.();

    const lighting = cell.lightingOverride || args.params.lighting;
    const lightingPrompt = effectiveReferenceImage
      ? 'Preserve the original environment background and lighting from the reference image exactly.'
      : LIGHTING_PROMPT_HINTS[lighting];

    const cellPromptParts: string[] = [];
    if (effectiveReferenceImage) {
      cellPromptParts.push(STRICT_REFERENCE_BINDING_PROMPT);
    }
    if (effectiveOutfitReference) {
      cellPromptParts.push('Keep outfit design, colors, patterns, accessories, and silhouette exactly consistent with the outfit reference image. Do not change or redesign any clothing details.');
    }
    if (effectiveEnvironmentReference) {
      cellPromptParts.push('Preserve the environment style, background structure, lighting atmosphere, and color palette from the environment reference image exactly. Do not alter the setting or scenery.');
    }
    if (effectivePrompt) {
      cellPromptParts.push(effectivePrompt);
    }
    cellPromptParts.push(ANGLE_PROMPT_HINTS[cell.angle]);
    cellPromptParts.push(SHOT_PROMPT_HINTS[cell.shot]);
    if (effectiveReferenceImage) {
      cellPromptParts.push('Maintain absolute character identity consistency with the reference.');
    }
    if (effectiveOutfitReference) {
      cellPromptParts.push('Maintain absolute outfit consistency with the outfit reference.');
    }
    if (effectiveEnvironmentReference) {
      cellPromptParts.push('Maintain absolute environment consistency with the environment reference.');
    }
    if (!effectiveReferenceImage && !effectiveEnvironmentReference) {
      cellPromptParts.push(lightingPrompt);
    }
    if (args.params.negativePrompt) {
      cellPromptParts.push(`avoid: ${args.params.negativePrompt}`);
    }
    const cellPrompt = cellPromptParts.join(', ');

    const imageParams = {
      model: args.requestedModel.value,
      provider: args.requestedModel.provider,
      prompt: cellPrompt,
      negativePrompt: args.params.negativePrompt || '',
      generationMode: effectiveReferenceImage ? 'character_reference' : 'text_to_image',
      aspectRatio: args.params.aspectRatio || '1:1',
      quality: args.params.quality || 'hd',
      gptQuality: args.params.quality || 'medium',
      size: args.params.size || 'auto',
      gptOutputFormat: args.params.gptOutputFormat || 'png',
      gptOutputCompression: args.params.gptOutputCompression,
      gptCompression: args.params.gptOutputCompression,
      gptBackground: args.params.gptBackground || 'opaque',
      moderation: args.params.moderation || 'auto',
      seed: args.params.seed === -1 ? Math.floor(Math.random() * 999999) : args.params.seed + index,
      cfgScale: args.params.cfgScale,
      referenceImage: effectiveReferenceImage || undefined,
      referenceImages: (
        args.params.useMultiImageReferences === false
          ? [effectiveReferenceImage]
          : [effectiveReferenceImage, effectiveOutfitReference, effectiveEnvironmentReference]
      )
        .filter(Boolean)
        .slice(0, Math.max(1, Math.floor(args.params.maxReferenceImages || 4))),
      characterConsistency: effectiveReferenceImage
        ? Math.max(args.params.characterConsistency, 0.95)
        : args.params.characterConsistency,
      style: 'none',
      strength: effectiveReferenceImage ? 0.85 : undefined,
      source: 'grid-director',
      useEditEndpointWhenReferenceExists: args.params.useEditEndpointWhenReferenceExists ?? true,
      providerExtensions: args.params.providerExtensions,
    };

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
          ...(args.getAuthToken() ? { Authorization: `Bearer ${args.getAuthToken()}` } : {}),
        },
        body: JSON.stringify(imageParams),
        signal: frameAbortController.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const httpError = new Error(String(errBody.error || errBody.message || `HTTP ${response.status}`));
        (httpError as Error & { status?: number }).status = response.status;
        console.error(`[photo-grid] Frame ${index + 1}/${args.gridMatrix.length} HTTP error:`, response.status, httpError.message);
        if (args.shouldAbortRun(response.status)) {
          throw httpError;
        }

        pushFrameResult({
          cellIndex: index,
          rowIndex: cell.row,
          colIndex: cell.col,
          imageUrl: '',
          prompt: cellPrompt,
          status: 'failed',
          error: httpError.message,
        });
        continue;
      }

      const result = (await response.json()) as Record<string, unknown>;
      if (!result.success) {
        const message = String(result.error || (result.data as Record<string, unknown> | undefined)?.error || '生成失败');
        console.error(`[photo-grid] Frame ${index + 1}/${args.gridMatrix.length} API error:`, message);
        pushFrameResult({
          cellIndex: index,
          rowIndex: cell.row,
          colIndex: cell.col,
          imageUrl: '',
          prompt: cellPrompt,
          status: 'failed',
          error: message,
        });
        continue;
      }

      const data = (result.data ?? {}) as Record<string, unknown>;
      const dataStatus = String(data.status || '');
      if (dataStatus === 'failed' || dataStatus === 'error') {
        const dataError = String(data.error || '后端生成失败');
        console.error(`[photo-grid] Frame ${index + 1}/${args.gridMatrix.length} backend failed:`, dataError, 'taskId:', data.taskId);
        pushFrameResult({
          cellIndex: index,
          rowIndex: cell.row,
          colIndex: cell.col,
          imageUrl: '',
          prompt: cellPrompt,
          status: 'failed',
          error: dataError,
        });
        continue;
      }

      const imageUrl = extractImageUrl(result);
      if (!imageUrl) {
        console.error(`[photo-grid] Frame ${index + 1}/${args.gridMatrix.length} no image URL in response:`, JSON.stringify(result).substring(0, 300));
        pushFrameResult({
          cellIndex: index,
          rowIndex: cell.row,
          colIndex: cell.col,
          imageUrl: '',
          prompt: cellPrompt,
          status: 'failed',
          error: 'No image URL in response',
        });
        continue;
      }

      console.log(`[photo-grid] Frame ${index + 1}/${args.gridMatrix.length} succeeded:`, imageUrl.substring(0, 80));
      pushFrameResult({
        cellIndex: index,
        rowIndex: cell.row,
        colIndex: cell.col,
        imageUrl,
        prompt: cellPrompt,
        status: 'succeeded',
      });
    } catch (frameError) {
      // ✅ P1-3：暂停触发的 abort，标记为 failed 并等待恢复
      const isAbort = (frameError as Error)?.name === 'AbortError';
      if (isAbort) {
        console.log(`[photo-grid] Frame ${index + 1}/${args.gridMatrix.length} aborted by pause`);
        pushFrameResult({
          cellIndex: index,
          rowIndex: cell.row,
          colIndex: cell.col,
          imageUrl: '',
          prompt: cellPrompt,
          status: 'failed',
          error: '已暂停，可重试该帧',
        });
        await args.waitWhilePaused?.();
      } else {
        console.error(`[photo-grid] Frame ${index + 1}/${args.gridMatrix.length} unexpected error:`, frameError);
        pushFrameResult({
          cellIndex: index,
          rowIndex: cell.row,
          colIndex: cell.col,
          imageUrl: '',
          prompt: cellPrompt,
          status: 'failed',
          error: (frameError as Error)?.message || '未知错误',
        });
      }
    } finally {
      if (frameAbortWatcher) clearInterval(frameAbortWatcher);
    }
  }

  const loadImageElements =
    args.loadImageElements ||
    (async (urls: string[]) =>
      Promise.all(
        urls.map(async (url) => {
          if (!url) return null;
          return new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
          });
        }),
      ));
  const imageElements = await loadImageElements(frameResults.map((frame) => frame.imageUrl));
  const gridImageUrl = frameResults.some((frame) => frame.imageUrl)
    ? await composeStoryboardGridImage(imageElements, { rows: args.gridRows, cols: args.gridCols })
    : '';

  return {
    gridImageUrl,
    coverImageUrl: frameResults.find((frame) => frame.imageUrl)?.imageUrl || gridImageUrl,
    frameResults,
  };
}
