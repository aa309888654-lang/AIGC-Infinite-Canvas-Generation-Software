export type FrameExtractionMode = 'even' | 'interval' | 'last';
export type FrameOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';
export type FrameQuality = 'standard' | 'high';

export interface FrameExtractorParams {
  frameCount?: unknown;
  intervalSeconds?: unknown;
  extractionMode?: unknown;
  outputFormat?: unknown;
  quality?: unknown;
}

export interface NormalizedFrameExtractorParams {
  frameCount: number;
  intervalSeconds: number;
  extractionMode: FrameExtractionMode;
  outputFormat: FrameOutputFormat;
  quality: FrameQuality;
  jpegQuality: number;
}

export interface ExtractedVideoFrame {
  index: number;
  time: number;
  dataUrl: string;
}

const MIN_FRAME_COUNT = 1;
const MAX_FRAME_COUNT = 50;
const DEFAULT_FRAME_COUNT = 10;
const DEFAULT_INTERVAL_SECONDS = 1;
const SEEK_EDGE_GUARD_SECONDS = 0.05;

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampFrameCount(value: unknown): number {
  return Math.max(
    MIN_FRAME_COUNT,
    Math.min(MAX_FRAME_COUNT, Math.round(toFiniteNumber(value, DEFAULT_FRAME_COUNT)))
  );
}

export function normalizeFrameExtractorParams(
  params: FrameExtractorParams = {}
): NormalizedFrameExtractorParams {
  const extractionMode: FrameExtractionMode =
    params.extractionMode === 'last'
      ? 'last'
      : params.extractionMode === 'interval'
        ? 'interval'
        : 'even';
  const outputFormat: FrameOutputFormat =
    params.outputFormat === 'image/png' || params.outputFormat === 'image/webp'
      ? params.outputFormat
      : 'image/jpeg';
  const quality: FrameQuality = params.quality === 'standard' ? 'standard' : 'high';

  return {
    frameCount: clampFrameCount(params.frameCount),
    intervalSeconds: Math.max(
      0.1,
      toFiniteNumber(params.intervalSeconds, DEFAULT_INTERVAL_SECONDS)
    ),
    extractionMode,
    outputFormat,
    quality,
    jpegQuality: quality === 'high' ? 0.94 : 0.86,
  };
}

function getSafeDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, duration - SEEK_EDGE_GUARD_SECONDS);
}

function roundTime(value: number): number {
  return Math.max(0, Number(value.toFixed(3)));
}

export function computeFrameTimes(params: {
  duration: number;
  frameCount: number;
  extractionMode?: FrameExtractionMode;
  intervalSeconds?: number;
}): number[] {
  const frameCount = clampFrameCount(params.frameCount);
  const safeDuration = getSafeDuration(params.duration);

  if (safeDuration === 0) return [0];
  if (params.extractionMode === 'last') return [roundTime(safeDuration)];
  if (frameCount === 1) return [0];

  if (params.extractionMode === 'interval') {
    const intervalSeconds = Math.max(0.1, params.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS);
    const times: number[] = [];
    for (let time = 0; time <= safeDuration && times.length < frameCount; time += intervalSeconds) {
      times.push(roundTime(time));
    }
    if (times.length === 0) return [0];
    return times;
  }

  const step = safeDuration / (frameCount - 1);
  return Array.from({ length: frameCount }, (_, index) => roundTime(index * step));
}
