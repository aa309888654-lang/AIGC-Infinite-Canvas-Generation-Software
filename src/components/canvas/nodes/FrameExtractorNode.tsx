import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps, useStore } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Download,
  Film,
  Images,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Scissors,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { aicgGlass } from './aicg-node-glass';
import { cn } from '@/lib/utils';
import { normalizeMediaUrl } from '@/lib/media-url';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { nodeTaskRegistry } from '@/services/node-task-registry';
import { extractResultUrl, inferMediaType } from '@/types/node-output';
import { useBlobUrlManager } from '@/hooks/useBlobUrlManager';
import { CANVAS_NODE_BASE_WIDTH } from '@/lib/canvas-node-dimensions';
import {
  computeFrameTimes,
  type ExtractedVideoFrame,
  type FrameExtractionMode,
  type FrameOutputFormat,
  type FrameQuality,
  normalizeFrameExtractorParams,
} from './frame-extractor-core';

export interface FrameExtractorNodeData {
  type: 'frameExtractor';
  label?: string;
  sourceVideoUrl?: string;
  videoUrl?: string;
  fileName?: string;
  frameCount?: number;
  intervalSeconds?: number;
  extractionMode?: FrameExtractionMode;
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: 'standard' | 'high';
  frames?: ExtractedVideoFrame[];
  selectedFrameIndex?: number;
  resultUrl?: string;
  resultUrls?: string[];
  imageUrl?: string;
  mediaType?: 'image';
  frameRole?: 'first' | 'key' | 'last';
  frameTime?: number;
  task?: {
    status?: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  };
}

const VIDEO_SOURCE_TYPES = new Set([
  'videoInput',
  'videoGen',
  'advancedVideoGen',
  'aicgVideoGen',
  'aiVideo',
  'videoCompose',
  'output',
]);

const EXTRACTION_MODE_OPTIONS: Array<{
  value: FrameExtractionMode;
  label: string;
}> = [
  { value: 'last', label: '尾帧' },
  { value: 'even', label: '均匀' },
  { value: 'interval', label: '按间隔' },
];

const OUTPUT_FORMAT_OPTIONS: Array<{
  value: FrameOutputFormat;
  label: string;
}> = [
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
];

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readFrameArray(value: unknown): ExtractedVideoFrame[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (frame): frame is ExtractedVideoFrame =>
      typeof frame === 'object' &&
      frame !== null &&
      typeof (frame as ExtractedVideoFrame).dataUrl === 'string' &&
      typeof (frame as ExtractedVideoFrame).time === 'number'
  );
}

function getVideoUrlFromNode(
  node: { type?: string | null; data?: unknown } | undefined
): string | null {
  if (!node || !node.data || typeof node.data !== 'object') return null;
  const data = node.data as Record<string, unknown>;
  const nodeType = asString(data.type) || asString(node.type) || '';
  const mediaType = inferMediaType(data);
  const resultUrl = extractResultUrl(data);
  const videoUrl = asString(data.videoUrl) || resultUrl;

  if (!videoUrl) return null;
  if (VIDEO_SOURCE_TYPES.has(nodeType) || mediaType === 'video') return videoUrl;
  return null;
}

function loadVideoMetadata(video: HTMLVideoElement, sourceUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('视频元数据加载超时'));
    }, 30000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onerror = null;
    };

    video.onloadedmetadata = () => {
      cleanup();
      resolve();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('视频加载失败'));
    };

    video.src = sourceUrl;
    video.load();
  });
}

function waitForCurrentVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('视频帧读取超时'));
    }, 15000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      requestAnimationFrame(() => resolve());
    };
    const onError = () => {
      cleanup();
      reject(new Error('视频帧读取失败'));
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onError);
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.05)));
  if (Math.abs(video.currentTime - target) < 0.01) return waitForCurrentVideoFrame(video);

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`跳转到 ${target.toFixed(2)}s 超时`));
    }, 15000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      requestAnimationFrame(() => resolve());
    };
    const onError = () => {
      cleanup();
      reject(new Error('视频 seek 失败'));
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = target;
  });
}

async function extractFramesFromVideo(params: {
  sourceUrl: string;
  frameCount: number;
  intervalSeconds: number;
  extractionMode: 'even' | 'interval' | 'last';
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  jpegQuality: number;
  onProgress?: (progress: number) => void;
  isCancelled?: () => boolean;
}): Promise<{
  frames: ExtractedVideoFrame[];
  duration: number;
  width: number;
  height: number;
}> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    await loadVideoMetadata(video, normalizeMediaUrl(params.sourceUrl));
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 初始化失败');

    const times = computeFrameTimes({
      duration: video.duration,
      frameCount: params.frameCount,
      extractionMode: params.extractionMode,
      intervalSeconds: params.intervalSeconds,
    });
    const frames: ExtractedVideoFrame[] = [];

    for (let index = 0; index < times.length; index += 1) {
      if (params.isCancelled?.()) {
        throw new DOMException('抽帧已取消', 'AbortError');
      }
      await seekVideo(video, times[index]);
      context.drawImage(video, 0, 0, width, height);
      frames.push({
        index,
        time: times[index],
        dataUrl: canvas.toDataURL(params.outputFormat, params.jpegQuality),
      });
      params.onProgress?.(Math.round(((index + 1) / times.length) * 100));
    }

    return {
      frames,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      width,
      height,
    };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

const FrameExtractorNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeId = id as string;
  const nodeData = (data || {}) as Partial<FrameExtractorNodeData>;
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const { createBlobUrl, revokeAllBlobUrls } = useBlobUrlManager();

  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<ExtractedVideoFrame[]>(() =>
    readFrameArray(nodeData.frames)
  );
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(nodeData.selectedFrameIndex ?? 0);
  const [progress, setProgress] = useState(nodeData.task?.progress ?? 0);
  const [parametersExpanded, setParametersExpanded] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [videoMeta, setVideoMeta] = useState<{
    duration?: number;
    width?: number;
    height?: number;
  }>({});

  const incomingVideoUrl = useMemo(() => {
    const incomingEdge = edges.find(
      (edge) => edge.target === nodeId && (!edge.targetHandle || edge.targetHandle === 'input')
    );
    if (!incomingEdge) return null;
    return getVideoUrlFromNode(nodes.find((node) => node.id === incomingEdge.source));
  }, [edges, nodeId, nodes]);

  const sourceVideoUrl =
    localVideoUrl ||
    incomingVideoUrl ||
    asString(nodeData.sourceVideoUrl) ||
    asString(nodeData.videoUrl);

  const normalizedParams = useMemo(
    () =>
      normalizeFrameExtractorParams({
        extractionMode: nodeData.extractionMode,
        frameCount: nodeData.frameCount,
        intervalSeconds: nodeData.intervalSeconds,
        outputFormat: nodeData.outputFormat,
        quality: nodeData.quality,
      }),
    [
      nodeData.extractionMode,
      nodeData.frameCount,
      nodeData.intervalSeconds,
      nodeData.outputFormat,
      nodeData.quality,
    ]
  );

  const taskStatus = nodeData.task?.status ?? 'idle';
  const isProcessing = taskStatus === 'processing';
  const selectedFrame = frames[selectedFrameIndex] || frames[0];

  useEffect(() => {
    if (!incomingVideoUrl || incomingVideoUrl === nodeData.sourceVideoUrl) return;
    setFrames([]);
    setSelectedFrameIndex(0);
    setProgress(0);
    setVideoMeta({});
    canvasStoreApi.updateNodeData(nodeId, {
      sourceVideoUrl: incomingVideoUrl,
      frames: [],
      selectedFrameIndex: 0,
      resultUrl: undefined,
      resultUrls: [],
      imageUrl: undefined,
      frameRole: undefined,
      frameTime: undefined,
      task: { status: 'idle', progress: 0 },
    });
  }, [incomingVideoUrl, nodeData.sourceVideoUrl, nodeId]);

  const updateParams = useCallback(
    (updates: Partial<FrameExtractorNodeData>) => {
      canvasStoreApi.updateNodeData(nodeId, updates as Record<string, unknown>);
    },
    [nodeId]
  );

  const publishFrame = useCallback(
    (nextFrames: ExtractedVideoFrame[], index: number) => {
      const frame = nextFrames[index] || nextFrames[0];
      if (!frame) return;
      const resultUrls = nextFrames.map((item) => item.dataUrl);
      const isLastFrame = index === nextFrames.length - 1;
      updateParams({
        frames: nextFrames,
        selectedFrameIndex: frame.index,
        resultUrl: frame.dataUrl,
        resultUrls,
        imageUrl: frame.dataUrl,
        mediaType: 'image',
        frameRole: isLastFrame ? 'last' : index === 0 ? 'first' : 'key',
        frameTime: frame.time,
        sourceVideoUrl: sourceVideoUrl || undefined,
        task: { status: 'completed', progress: 100 },
      });
      syncDownstreamFromNode(nodeId);
      nodeEventBus.emitNodeExecuted(nodeId, true);
    },
    [nodeId, sourceVideoUrl, updateParams]
  );

  const handleSelectFrame = useCallback(
    (index: number) => {
      setSelectedFrameIndex(index);
      publishFrame(frames, index);
    },
    [frames, publishFrame]
  );

  const handleExtract = useCallback(async () => {
    if (!sourceVideoUrl) {
      toast.warning('请先连接或上传视频');
      return;
    }

    const cancelToken = { cancelled: false };
    const cancelFn = () => {
      cancelToken.cancelled = true;
    };

    nodeTaskRegistry.register(nodeId, cancelFn);
    setProgress(0);
    updateParams({ task: { status: 'processing', progress: 0 }, sourceVideoUrl });

    try {
      const result = await extractFramesFromVideo({
        sourceUrl: sourceVideoUrl,
        frameCount: normalizedParams.frameCount,
        intervalSeconds: normalizedParams.intervalSeconds,
        extractionMode: normalizedParams.extractionMode,
        outputFormat: normalizedParams.outputFormat,
        jpegQuality: normalizedParams.jpegQuality,
        isCancelled: () => cancelToken.cancelled,
        onProgress: (nextProgress) => {
          setProgress(nextProgress);
          updateParams({ task: { status: 'processing', progress: nextProgress } });
        },
      });

      if (cancelToken.cancelled) return;

      const publishIndex = Math.max(0, result.frames.length - 1);
      setFrames(result.frames);
      setSelectedFrameIndex(publishIndex);
      setVideoMeta({ duration: result.duration, width: result.width, height: result.height });
      publishFrame(result.frames, publishIndex);
      toast.success(
        normalizedParams.extractionMode === 'last'
          ? '已截取尾帧'
          : `已抽取 ${result.frames.length} 帧，默认输出尾帧`
      );
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        console.error('[FrameExtractorNode] 抽帧失败:', error);
        toast.error('视频抽帧失败');
      }
      updateParams({
        task: {
          status: 'failed',
          progress: 0,
          error: isAbort ? '抽帧已取消' : '抽帧失败，请检查视频源或跨域权限',
        },
      });
      nodeEventBus.emitNodeExecuted(nodeId, false);
    } finally {
      nodeTaskRegistry.unregister(nodeId, cancelFn);
    }
  }, [nodeId, normalizedParams, publishFrame, sourceVideoUrl, updateParams]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      revokeAllBlobUrls();
      const objectUrl = createBlobUrl(file);
      setLocalVideoUrl(objectUrl);
      setFrames([]);
      setSelectedFrameIndex(0);
      setProgress(0);
      setVideoMeta({});
      updateParams({
        fileName: file.name,
        sourceVideoUrl: objectUrl,
        videoUrl: objectUrl,
        frames: [],
        selectedFrameIndex: 0,
        resultUrl: undefined,
        resultUrls: [],
        imageUrl: undefined,
        frameRole: undefined,
        frameTime: undefined,
        task: { status: 'idle', progress: 0 },
      });
    },
    [createBlobUrl, revokeAllBlobUrls, updateParams]
  );

  const handleDownloadSelected = useCallback(() => {
    if (!selectedFrame) {
      toast.warning('请先抽取视频帧');
      return;
    }
    const link = document.createElement('a');
    const suffix =
      normalizedParams.outputFormat === 'image/png'
        ? 'png'
        : normalizedParams.outputFormat === 'image/webp'
          ? 'webp'
          : 'jpg';
    link.href = selectedFrame.dataUrl;
    link.download = `frame-${selectedFrame.index + 1}-${selectedFrame.time.toFixed(2)}s.${suffix}`;
    link.click();
  }, [normalizedParams.outputFormat, selectedFrame]);

  const handlePreviewPlayback = useCallback(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setIsPreviewPlaying(false));
      return;
    }
    video.pause();
  }, []);

  const handleReset = useCallback(() => {
    setFrames([]);
    setSelectedFrameIndex(0);
    setProgress(0);
    setVideoMeta({});
    updateParams({
      frames: [],
      selectedFrameIndex: 0,
      resultUrl: undefined,
      resultUrls: [],
      imageUrl: undefined,
      frameRole: undefined,
      frameTime: undefined,
      task: { status: 'idle', progress: 0 },
    });
  }, [updateParams]);

  const stopFlowPointer = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  const sourceLabel =
    nodeData.fileName || (incomingVideoUrl ? '上游视频' : sourceVideoUrl ? '本地视频' : '等待视频');
  const extractionActionLabel =
    normalizedParams.extractionMode === 'last'
      ? '截取尾帧'
      : `抽取 ${normalizedParams.frameCount} 帧`;
  const statusLabel =
    taskStatus === 'processing'
      ? `${progress}%`
      : taskStatus === 'completed'
        ? '已完成'
        : taskStatus === 'failed'
          ? '异常'
          : sourceVideoUrl
            ? '可执行'
            : '待输入';

  return (
    <div
      className="relative frame-extractor-node-wrapper"
      style={{ width: CANVAS_NODE_BASE_WIDTH }}
    >
      <AICGUnifiedIOHandles
        nodeId={nodeId}
        nodeType="frameExtractor"
        inputId="input"
        outputId="output"
        inputTip="视频输入"
        outputTip="图片帧输出"
        menuTop="44%"
      />

      <AICGNodeShell
        aicgType="tool"
        title="视频抽帧"
        subtitle={
          frames.length > 0
            ? `${frames.length} 帧 · 当前 ${formatTime(selectedFrame?.time ?? 0)}${nodeData.frameRole === 'last' ? ' · 尾帧' : ''}`
            : sourceVideoUrl
              ? '视频已就绪'
              : '等待视频'
        }
        selected={selected}
        width="100%"
        variant="glass-modern"
        onDelete={() => canvasStoreApi.deleteNode(nodeId)}
        status={
          <div
            className={cn(
              'mr-7 inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[9px] font-medium',
              taskStatus === 'failed'
                ? 'border-red-500/20 bg-red-500/[0.08] text-red-200/90'
                : 'border-white/12 bg-white/[0.035] text-white/60'
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : taskStatus === 'completed' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : taskStatus === 'failed' ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <CircleDashed className="h-3 w-3" />
            )}
            <span>{statusLabel}</span>
          </div>
        }
        preview={
          <div className={cn(aicgGlass.previewMedia, 'relative aspect-video w-full')}>
            {selectedFrame ? (
              <img
                src={selectedFrame.dataUrl}
                alt={`抽帧 ${selectedFrame.index + 1}`}
                className="h-full w-full object-contain"
                draggable={false}
              />
            ) : sourceVideoUrl ? (
              <video
                ref={previewVideoRef}
                src={normalizeMediaUrl(sourceVideoUrl)}
                className="nodrag nowheel h-full w-full cursor-pointer object-contain"
                muted
                onPointerDown={stopFlowPointer}
                onMouseDown={stopFlowPointer}
                onClick={(event) => {
                  stopFlowPointer(event);
                  handlePreviewPlayback();
                }}
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  setVideoMeta({
                    duration: Number.isFinite(video.duration) ? video.duration : 0,
                    width: video.videoWidth,
                    height: video.videoHeight,
                  });
                }}
                onPlay={() => setIsPreviewPlaying(true)}
                onPause={() => setIsPreviewPlaying(false)}
                onEnded={() => setIsPreviewPlaying(false)}
              />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  stopFlowPointer(event);
                  handleUploadClick();
                }}
                className="nodrag nowheel flex h-full w-full flex-col items-center justify-center gap-2.5 text-white/38 transition-colors hover:bg-white/[0.025] hover:text-white/62"
                title="上传视频"
              >
                <Film className="h-11 w-11" strokeWidth={1.4} />
                <span className="text-[11px]">连接视频或上传素材</span>
              </button>
            )}

            <div className="pointer-events-none absolute left-2.5 top-2.5 max-w-[62%] truncate rounded-md border border-white/10 bg-black/55 px-2 py-1 text-[9px] text-white/68 backdrop-blur-sm">
              {sourceLabel}
            </div>

            {selectedFrame ? (
              <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[9px] text-white/78 backdrop-blur-sm">
                <Clock3 className="h-3 w-3" />
                <span>{formatTime(selectedFrame.time)}</span>
                <span className="text-white/35">·</span>
                <span>
                  第 {selectedFrame.index + 1}/{frames.length} 帧
                </span>
              </div>
            ) : null}

            {sourceVideoUrl && !selectedFrame && !isProcessing ? (
              <div className="nodrag nowheel absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 p-1 text-[9px] text-white/72 backdrop-blur-sm">
                {videoMeta.duration ? (
                  <span className="px-1 font-mono">{formatTime(videoMeta.duration)}</span>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    stopFlowPointer(event);
                    handlePreviewPlayback();
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-[5px] text-white/78 transition-colors hover:bg-white/10 hover:text-white"
                  title={isPreviewPlaying ? '暂停预览' : '播放预览'}
                  aria-label={isPreviewPlaying ? '暂停预览' : '播放预览'}
                >
                  {isPreviewPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                </button>
              </div>
            ) : null}

            {isProcessing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/62 backdrop-blur-sm">
                <Loader2 className="h-7 w-7 animate-spin text-white/80" />
                <span className="font-mono text-[11px] text-white/72">正在抽帧 · {progress}%</span>
                <div className="h-1 w-32 overflow-hidden rounded-full bg-white/12">
                  <div
                    className="h-full rounded-full bg-white/75 transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        }
        controls={
          <div
            className="nodrag nowheel nopan flex flex-col gap-2.5"
            onPointerDownCapture={stopFlowPointer}
            onMouseDownCapture={stopFlowPointer}
            onClick={stopFlowPointer}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex min-w-0 items-center gap-2">
              <span className="w-14 shrink-0 text-[10px] font-medium text-white/48">抽帧模式</span>
              <div className="grid min-w-0 flex-1 grid-cols-3 rounded-[9px] border border-white/10 bg-black/22 p-0.5">
                {EXTRACTION_MODE_OPTIONS.map((option) => {
                  const isActive = normalizedParams.extractionMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => updateParams({ extractionMode: option.value })}
                      className={cn(
                        'h-7 rounded-[7px] px-2 text-[10px] font-medium transition-colors',
                        isActive
                          ? 'border border-white/18 bg-white/[0.09] text-white shadow-sm'
                          : 'text-white/42 hover:bg-white/[0.035] hover:text-white/72'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-12 items-end gap-2 border-b border-white/[0.08] pb-2.5">
              {normalizedParams.extractionMode === 'last' ? (
                <div className="flex h-8 flex-1 items-center justify-between rounded-[9px] border border-white/[0.08] bg-white/[0.025] px-2.5 text-[10px] text-white/45">
                  <span>输出位置</span>
                  <span className="font-mono text-white/70">视频末尾</span>
                </div>
              ) : (
                <label className="min-w-0 flex-1 space-y-1">
                  <span className="text-[9px] text-white/38">帧数量</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={normalizedParams.frameCount}
                    onChange={(event) => updateParams({ frameCount: Number(event.target.value) })}
                    className={cn(aicgGlass.input, 'h-8 py-1.5 font-mono')}
                  />
                </label>
              )}
              {normalizedParams.extractionMode === 'interval' ? (
                <label className="min-w-0 flex-1 space-y-1">
                  <span className="text-[9px] text-white/38">时间间隔（秒）</span>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={normalizedParams.intervalSeconds}
                    onChange={(event) =>
                      updateParams({ intervalSeconds: Number(event.target.value) })
                    }
                    className={cn(aicgGlass.input, 'h-8 py-1.5 font-mono')}
                  />
                </label>
              ) : (
                <div className="flex h-8 min-w-24 items-center justify-end gap-1 self-end text-[9px] text-white/36">
                  <Clock3 className="h-3 w-3" />
                  <span>{videoMeta.duration ? formatTime(videoMeta.duration) : '时长待识别'}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUploadClick}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-white/12 bg-white/[0.035] text-white/55 transition-colors hover:border-white/22 hover:bg-white/[0.07] hover:text-white"
                title={sourceVideoUrl ? '替换视频' : '上传视频'}
                aria-label={sourceVideoUrl ? '替换视频' : '上传视频'}
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleExtract()}
                disabled={isProcessing || !sourceVideoUrl}
                className={cn(
                  'flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] border px-3 text-[11px] font-medium transition-colors',
                  sourceVideoUrl && !isProcessing
                    ? 'border-white/24 bg-white/[0.1] text-white hover:border-white/34 hover:bg-white/[0.14]'
                    : 'cursor-not-allowed border-white/[0.06] bg-white/[0.025] text-white/28'
                )}
                title={extractionActionLabel}
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Scissors className="h-3.5 w-3.5" />
                )}
                <span className="truncate">
                  {isProcessing ? `处理中 ${progress}%` : extractionActionLabel}
                </span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSelected}
                disabled={!selectedFrame}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-white/12 bg-white/[0.035] text-white/55 transition-colors hover:border-white/22 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="下载当前输出帧"
                aria-label="下载当前输出帧"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 border-t border-white/[0.08] pt-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/52">
                  <Images className="h-3.5 w-3.5" />
                  <span>输出帧</span>
                </div>
                <span className="text-[9px] text-white/34">
                  {selectedFrame ? `当前输出 · ${formatTime(selectedFrame.time)}` : '尚未生成'}
                </span>
              </div>
              {frames.length > 0 ? (
                <div className="flex min-h-[64px] gap-1.5 overflow-x-auto pb-1">
                  {frames.map((frame) => {
                    const isActive = (selectedFrame?.index ?? 0) === frame.index;
                    return (
                      <button
                        key={`${frame.index}-${frame.time}`}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => handleSelectFrame(frame.index)}
                        className={cn(
                          'relative aspect-video h-[58px] shrink-0 overflow-hidden rounded-[7px] border bg-[#151515] transition-colors',
                          isActive
                            ? 'border-white/62 ring-1 ring-white/24'
                            : 'border-white/10 opacity-72 hover:border-white/32 hover:opacity-100'
                        )}
                        title={`${frame.index === frames.length - 1 ? '尾帧' : `第 ${frame.index + 1} 帧`} · ${formatTime(frame.time)}`}
                      >
                        <img
                          src={frame.dataUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-black/68 px-1 py-0.5 text-left font-mono text-[8px] text-white/78">
                          {frame.index === frames.length - 1 ? '尾帧' : formatTime(frame.time)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-[52px] items-center justify-center gap-1.5 text-[10px] text-white/26">
                  <Images className="h-3.5 w-3.5" />
                  <span>暂无输出</span>
                </div>
              )}
            </div>

            {nodeData.task?.error ? (
              <div className={cn(aicgGlass.errorBar, 'mt-0')}>
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{nodeData.task.error}</span>
              </div>
            ) : null}
          </div>
        }
        parameters={
          <div
            className="nodrag nowheel grid grid-cols-2 gap-3"
            onPointerDownCapture={stopFlowPointer}
            onMouseDownCapture={stopFlowPointer}
            onClick={stopFlowPointer}
          >
            <div className="min-w-0 space-y-1.5">
              <span className="text-[9px] font-medium text-white/38">输出格式</span>
              <div className="grid grid-cols-3 rounded-[8px] border border-white/10 bg-black/20 p-0.5">
                {OUTPUT_FORMAT_OPTIONS.map((option) => {
                  const isActive = normalizedParams.outputFormat === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => updateParams({ outputFormat: option.value })}
                      className={cn(
                        'h-7 rounded-[6px] text-[9px] transition-colors',
                        isActive
                          ? 'bg-white/[0.09] text-white'
                          : 'text-white/38 hover:text-white/68'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <span className="text-[9px] font-medium text-white/38">编码画质</span>
              <div className="grid grid-cols-2 rounded-[8px] border border-white/10 bg-black/20 p-0.5">
                {(
                  [
                    { value: 'standard', label: '标准' },
                    { value: 'high', label: '高质量' },
                  ] as Array<{ value: FrameQuality; label: string }>
                ).map((option) => {
                  const isActive = normalizedParams.quality === option.value;
                  const isDisabled = normalizedParams.outputFormat === 'image/png';
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      disabled={isDisabled}
                      onClick={() => updateParams({ quality: option.value })}
                      className={cn(
                        'h-7 rounded-[6px] text-[9px] transition-colors',
                        isActive
                          ? 'bg-white/[0.09] text-white'
                          : 'text-white/38 hover:text-white/68',
                        isDisabled && 'cursor-not-allowed opacity-30'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        }
        parametersExpanded={parametersExpanded}
        onParametersToggle={() => setParametersExpanded((value) => !value)}
        footer={
          <div className="flex min-w-0 items-center justify-between gap-2 px-1 text-[9px] text-white/34">
            <span className="truncate">{sourceLabel}</span>
            <div className="flex shrink-0 items-center gap-2">
              {videoMeta.width && videoMeta.height ? (
                <span className="font-mono">
                  {videoMeta.width}×{videoMeta.height}
                </span>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  stopFlowPointer(event);
                  handleReset();
                }}
                disabled={frames.length === 0 && !nodeData.task?.error}
                className="nodrag nowheel flex h-6 w-6 items-center justify-center rounded-md text-white/38 transition-colors hover:bg-white/[0.06] hover:text-white/76 disabled:cursor-not-allowed disabled:opacity-25"
                title="清空抽帧结果"
                aria-label="清空抽帧结果"
              >
                <RefreshCcw className="h-3 w-3" />
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
});

FrameExtractorNode.displayName = 'FrameExtractorNode';

export default FrameExtractorNode;
