import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { NodeProps } from '@xyflow/react';
import {
  ImagePlus,
  MapPin,
  Move,
  Pause,
  PencilLine,
  Redo2,
  Play,
  RotateCcw,
  Route,
  Sparkles,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { persistImportedCanvasFile } from '@/services/canvas-asset-actions';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { useNodeModels } from '@/hooks/useNodeModels';
import { cn } from '@/lib/utils';
import {
  appendCameraPathHistory,
  appendCameraPathPointCapped,
  buildCameraPathDocument,
  cameraPathToSvgPoints,
  commitCameraWaypointMove,
  sampleCameraPathAtProgress,
  type CameraPathDocument,
  type CameraPathMode,
  type CameraPathPoint,
  type CameraPathSemantics,
} from './camera-path-core';

interface CameraPathNodeData extends Record<string, unknown> {
  type?: 'cameraPath';
  imageUrl?: string;
  imageAssetId?: string;
  imageWidth?: number;
  imageHeight?: number;
  fileName?: string;
  mode?: CameraPathMode;
  semantics?: CameraPathSemantics;
  durationSec?: number;
  cameraPath?: CameraPathDocument;
  cameraPathJson?: string;
  prompt?: string;
  outputPrompt?: string;
  preferredModelId?: string;
  preferredModelProvider?: string;
  lineWidth?: number;
  cameraPathHistory?: Array<CameraPathDocument | null>;
  cameraPathHistoryIndex?: number;
}

type CameraPathEditTool = 'draw' | 'move';

const ACCEPT_IMAGE = 'image/png,image/jpeg,image/webp,image/avif';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const DURATION_OPTIONS = [4, 5, 6, 8, 10, 15];
const MAX_DRAW_POINTS = 600;
const MAX_HISTORY_ENTRIES = 20;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function readImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1920, height: image.naturalHeight || 1080 });
    image.onerror = () => reject(new Error('图片尺寸读取失败'));
    image.src = src;
  });
}

function eventToNormalizedPoint(event: ReactPointerEvent<SVGSVGElement>): CameraPathPoint {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
  };
}

function CameraPathNode({ data, id, selected }: NodeProps) {
  const nodeData = data as CameraPathNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftPointsRef = useRef<CameraPathPoint[]>([]);
  const drawFrameRef = useRef<number | null>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const playbackStartedRef = useRef(0);
  const dragWaypointRef = useRef<{ id: string; pointIndex: number } | null>(null);
  const pendingDragPointRef = useRef<CameraPathPoint | null>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [draftPoints, setDraftPoints] = useState<CameraPathPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editTool, setEditTool] = useState<CameraPathEditTool>(nodeData.cameraPath ? 'move' : 'draw');
  const [editorZoom, setEditorZoom] = useState(1);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lineWidthDraft, setLineWidthDraft] = useState(() => Math.min(14, Math.max(3, Number(nodeData.lineWidth) || 7)));
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [workingDocument, setWorkingDocument] = useState<CameraPathDocument | null>(null);
  const { models: videoModels } = useNodeModels('aiVideo');

  const mode = nodeData.mode === 'strict' ? 'strict' : 'smart';
  const semantics: CameraPathSemantics =
    nodeData.semantics === 'camera_translation' || nodeData.semantics === 'flythrough'
      ? nodeData.semantics
      : 'screen_tracking';
  const durationSec = DURATION_OPTIONS.includes(Number(nodeData.durationSec))
    ? Number(nodeData.durationSec)
    : 5;
  const preferredModelId = nodeData.preferredModelId || 'doubao-seedance-2-0';
  const preferredModelProvider = nodeData.preferredModelProvider || 'doubao';
  const modelSelectValue = `${preferredModelProvider}::${preferredModelId}`;
  const lineWidth = Math.min(14, Math.max(3, Number(nodeData.lineWidth) || 7));
  const persistedHistory = Array.isArray(nodeData.cameraPathHistory)
    ? nodeData.cameraPathHistory
    : [nodeData.cameraPath ?? null];
  const historyIndex = Math.min(
    persistedHistory.length - 1,
    Math.max(0, Number(nodeData.cameraPathHistoryIndex) || 0)
  );
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < persistedHistory.length - 1;
  const selectableVideoModels = useMemo(
    () =>
      [...videoModels]
        .filter((model) => model.isAvailable !== false && !model.modelInfo?.disabledReason)
        .sort((a, b) => {
          const aText = `${a.modelInfo?.name || ''} ${a.modelId}`.toLowerCase();
          const bText = `${b.modelInfo?.name || ''} ${b.modelId}`.toLowerCase();
          const rank = (text: string) =>
            text.includes('seedance 2.5') || text.includes('seedance-2-5')
              ? 0
              : text.includes('seedance 2.0') || text.includes('seedance-2-0')
                ? 1
                : text.includes('可灵') || text.includes('kling') || text.includes('video_omni')
                  ? 2
                  : 3;
          return rank(aText) - rank(bText) || aText.localeCompare(bText);
        }),
    [videoModels]
  );
  const persistedDocument = nodeData.cameraPath ?? null;
  const activeDocument = workingDocument ?? persistedDocument;
  const displayPoints = draftPoints.length > 0 ? draftPoints : activeDocument?.points ?? [];
  const hasPath = Boolean(activeDocument && activeDocument.points.length > 1);

  useEffect(() => {
    if (!dragWaypointRef.current && !isDrawing) setWorkingDocument(null);
  }, [isDrawing, nodeData.cameraPath]);

  useEffect(() => setLineWidthDraft(lineWidth), [lineWidth]);

  useEffect(() => {
    if (!selected) {
      setIsSpacePressed(false);
      return;
    }
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return;
      event.preventDefault();
      setIsSpacePressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selected]);

  useEffect(
    () => () => {
      if (drawFrameRef.current !== null) cancelAnimationFrame(drawFrameRef.current);
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      if (playbackFrameRef.current !== null) cancelAnimationFrame(playbackFrameRef.current);
    },
    []
  );

  const saveDocument = useCallback(
    (document: CameraPathDocument | null, previous = persistedDocument) => {
      const nextHistoryState = appendCameraPathHistory(
        nodeData.cameraPathHistory,
        historyIndex,
        previous,
        document,
        MAX_HISTORY_ENTRIES
      );
      const nextHistory = nextHistoryState.entries;
      const patch: Record<string, unknown> = document
        ? {
            cameraPath: document,
            cameraPathJson: JSON.stringify(document),
            prompt: document.promptMotionText,
            outputPrompt: document.promptMotionText,
            mode: document.mode,
            semantics: document.semantics,
            durationSec: document.durationSec,
            params: {
              mode: document.mode,
              semantics: document.semantics,
              durationSec: document.durationSec,
              cameraPath: document,
              prompt: document.promptMotionText,
            },
            cameraPathHistory: nextHistory,
            cameraPathHistoryIndex: nextHistoryState.index,
          }
        : {
            cameraPath: undefined,
            cameraPathJson: '',
            prompt: '',
            outputPrompt: '',
            params: { mode, semantics, durationSec, cameraPath: null, prompt: '' },
            cameraPathHistory: nextHistory,
            cameraPathHistoryIndex: nextHistoryState.index,
          };
      updateNodeData(String(id), patch);
      setWorkingDocument(null);
      setDraftPoints([]);
      syncDownstreamFromNode(String(id));
    },
    [durationSec, historyIndex, id, mode, nodeData.cameraPathHistory, persistedDocument, semantics, updateNodeData]
  );

  const compilePoints = useCallback(
    (points: CameraPathPoint[], overrides?: Partial<{ mode: CameraPathMode; semantics: CameraPathSemantics; durationSec: number }>) =>
      buildCameraPathDocument({
        points,
        mode: overrides?.mode ?? mode,
        semantics: overrides?.semantics ?? semantics,
        durationSec: overrides?.durationSec ?? durationSec,
        intermediateCount: 3,
      }),
    [durationSec, mode, semantics]
  );

  const handleImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error('图片不能超过 20MB');
        return;
      }
      setIsUploading(true);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const dimensions = await readImageSize(dataUrl);
        let imageUrl = dataUrl;
        let imageAssetId: string | undefined;
        try {
          const persisted = await persistImportedCanvasFile({
            nodeId: String(id),
            kind: 'image',
            file,
            role: 'primary',
            source: 'imported',
          });
          imageAssetId = persisted.asset.id;
          if (persisted.runtimeUrl) imageUrl = persisted.runtimeUrl;
        } catch (error) {
          console.warn('[CameraPathNode] 图片持久化失败，使用内嵌图片:', error);
        }
        updateNodeData(String(id), {
          imageUrl,
          resultUrl: imageUrl,
          imageAssetId,
          imageWidth: dimensions.width,
          imageHeight: dimensions.height,
          fileName: file.name,
          cameraPath: undefined,
          cameraPathJson: '',
          prompt: '',
          outputPrompt: '',
          cameraPathHistory: [null],
          cameraPathHistoryIndex: 0,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '图片上传失败');
      } finally {
        setIsUploading(false);
      }
    },
    [id, updateNodeData]
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void handleImageFile(file);
    },
    [handleImageFile]
  );

  const queueDraftRender = useCallback(() => {
    if (drawFrameRef.current !== null) return;
    drawFrameRef.current = requestAnimationFrame(() => {
      drawFrameRef.current = null;
      setDraftPoints([...draftPointsRef.current]);
    });
  }, []);

  const handlePathPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (isSpacePressed && editorZoom > 1) {
        const viewport = previewViewportRef.current;
        if (!viewport) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        panRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
        };
        return;
      }
      if (!nodeData.imageUrl || editTool !== 'draw' || event.button !== 0 || dragWaypointRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      draftPointsRef.current = [eventToNormalizedPoint(event)];
      setDraftPoints(draftPointsRef.current);
      setIsDrawing(true);
      setIsPlaying(false);
    },
    [editTool, editorZoom, isSpacePressed, nodeData.imageUrl]
  );

  const handlePathPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const pan = panRef.current;
      if (pan) {
        const viewport = previewViewportRef.current;
        if (viewport) {
          viewport.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
          viewport.scrollTop = pan.scrollTop - (event.clientY - pan.y);
        }
        return;
      }
      const dragged = dragWaypointRef.current;
      if (dragged && persistedDocument) {
        event.preventDefault();
        event.stopPropagation();
        pendingDragPointRef.current = eventToNormalizedPoint(event);
        if (dragFrameRef.current === null) {
          dragFrameRef.current = requestAnimationFrame(() => {
            dragFrameRef.current = null;
            const point = pendingDragPointRef.current;
            const currentDrag = dragWaypointRef.current;
            if (!point || !currentDrag) return;
            const points = persistedDocument.points.map((item, index) =>
              index === currentDrag.pointIndex ? point : item
            );
            const waypoints = persistedDocument.waypoints.map((item) =>
              item.id === currentDrag.id ? { ...item, ...point } : item
            );
            const previewDocument = { ...persistedDocument, points, waypoints };
            setWorkingDocument(previewDocument);
          });
        }
        return;
      }
      if (!isDrawing) return;
      const point = eventToNormalizedPoint(event);
      const previous = draftPointsRef.current[draftPointsRef.current.length - 1];
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.003) {
        if (draftPointsRef.current.length < MAX_DRAW_POINTS) {
          draftPointsRef.current = appendCameraPathPointCapped(draftPointsRef.current, point, MAX_DRAW_POINTS);
        } else {
          draftPointsRef.current = appendCameraPathPointCapped(draftPointsRef.current, point, MAX_DRAW_POINTS);
        }
        queueDraftRender();
      }
    },
    [isDrawing, persistedDocument, queueDraftRender]
  );

  const finishPointerInteraction = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (panRef.current) {
        panRef.current = null;
        return;
      }
      if (dragWaypointRef.current) {
        event.preventDefault();
        const previous = persistedDocument;
        const dragged = dragWaypointRef.current;
        const finalPoint = pendingDragPointRef.current;
        dragWaypointRef.current = null;
        pendingDragPointRef.current = null;
        if (dragFrameRef.current !== null) {
          cancelAnimationFrame(dragFrameRef.current);
          dragFrameRef.current = null;
        }
        if (previous && finalPoint) {
          saveDocument(commitCameraWaypointMove(previous, dragged.id, finalPoint), previous);
        }
        return;
      }
      if (!isDrawing) return;
      event.preventDefault();
      event.stopPropagation();
      setIsDrawing(false);
      const document = compilePoints(draftPointsRef.current);
      draftPointsRef.current = [];
      if (!document) {
        setDraftPoints([]);
        toast.info('路径过短，请重新绘制');
        return;
      }
      saveDocument(document);
      setEditTool('move');
    },
    [compilePoints, isDrawing, persistedDocument, saveDocument]
  );

  const startWaypointDrag = useCallback(
    (event: ReactPointerEvent<SVGGElement>, waypointId: string, pointIndex: number) => {
      if (editTool !== 'move') return;
      event.preventDefault();
      event.stopPropagation();
      const svg = event.currentTarget.ownerSVGElement;
      svg?.setPointerCapture(event.pointerId);
      dragWaypointRef.current = { id: waypointId, pointIndex };
      pendingDragPointRef.current = { ...persistedDocument!.points[pointIndex] };
      setWorkingDocument(persistedDocument);
      setIsPlaying(false);
    },
    [editTool, persistedDocument]
  );

  const updatePathSettings = useCallback(
    (next: Partial<{ mode: CameraPathMode; semantics: CameraPathSemantics; durationSec: number }>) => {
      const nextMode = next.mode ?? mode;
      const nextSemantics = next.semantics ?? semantics;
      const nextDuration = next.durationSec ?? durationSec;
      if (persistedDocument) {
        const document = compilePoints(persistedDocument.points, {
          mode: nextMode,
          semantics: nextSemantics,
          durationSec: nextDuration,
        });
        if (document) saveDocument(document);
      } else {
        updateNodeData(String(id), {
          mode: nextMode,
          semantics: nextSemantics,
          durationSec: nextDuration,
          params: { mode: nextMode, semantics: nextSemantics, durationSec: nextDuration },
        });
      }
    },
    [compilePoints, durationSec, id, mode, persistedDocument, saveDocument, semantics, updateNodeData]
  );

  const restoreHistoryAt = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= persistedHistory.length) return;
      const document = persistedHistory[nextIndex] ?? null;
      updateNodeData(String(id), document
        ? {
            cameraPath: document,
            cameraPathJson: JSON.stringify(document),
            prompt: document.promptMotionText,
            outputPrompt: document.promptMotionText,
            mode: document.mode,
            semantics: document.semantics,
            durationSec: document.durationSec,
            cameraPathHistory: persistedHistory,
            cameraPathHistoryIndex: nextIndex,
          }
        : {
            cameraPath: undefined,
            cameraPathJson: '',
            prompt: '',
            outputPrompt: '',
            cameraPathHistory: persistedHistory,
            cameraPathHistoryIndex: nextIndex,
          });
      setWorkingDocument(null);
      setDraftPoints([]);
      setEditTool(document ? 'move' : 'draw');
      syncDownstreamFromNode(String(id));
    },
    [id, persistedHistory, updateNodeData]
  );

  const handleUndo = useCallback(() => restoreHistoryAt(historyIndex - 1), [historyIndex, restoreHistoryAt]);
  const handleRedo = useCallback(() => restoreHistoryAt(historyIndex + 1), [historyIndex, restoreHistoryAt]);

  const togglePlayback = useCallback(() => {
    if (!hasPath) return;
    if (isPlaying) {
      if (playbackFrameRef.current !== null) cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
      setIsPlaying(false);
      return;
    }
    playbackStartedRef.current = performance.now() - playbackProgress * durationSec * 1000;
    setIsPlaying(true);
    const tick = (now: number) => {
      const progress = (now - playbackStartedRef.current) / (durationSec * 1000);
      if (progress >= 1) {
        setPlaybackProgress(1);
        setIsPlaying(false);
        playbackFrameRef.current = null;
        return;
      }
      setPlaybackProgress(progress);
      playbackFrameRef.current = requestAnimationFrame(tick);
    };
    playbackFrameRef.current = requestAnimationFrame(tick);
  }, [durationSec, hasPath, isPlaying, playbackProgress]);

  const playbackPoint = useMemo(
    () => sampleCameraPathAtProgress(activeDocument?.points ?? [], playbackProgress),
    [activeDocument?.points, playbackProgress]
  );

  const imageAspectRatio =
    nodeData.imageWidth && nodeData.imageHeight
      ? `${nodeData.imageWidth} / ${nodeData.imageHeight}`
      : '16 / 9';

  const preview = (
    <div
      ref={previewViewportRef}
      className="nodrag nowheel relative overflow-auto bg-[#090b0e]"
      style={{ aspectRatio: imageAspectRatio }}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      {nodeData.imageUrl ? (
        <div
          className="absolute left-0 top-0"
          style={{ width: `${editorZoom * 100}%`, height: `${editorZoom * 100}%` }}
        >
          <img
            src={nodeData.imageUrl}
            alt="镜头路径素材"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
            draggable={false}
          />
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            className={cn(
              'nodrag nowheel absolute inset-0 h-full w-full touch-none',
              isSpacePressed && editorZoom > 1
                ? panRef.current ? 'cursor-grabbing' : 'cursor-grab'
                : editTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
            )}
            onPointerDown={handlePathPointerDown}
            onPointerMove={handlePathPointerMove}
            onPointerUp={finishPointerInteraction}
            onPointerCancel={finishPointerInteraction}
            aria-label="镜头路径绘制区"
          >
            <defs>
              <filter id={`camera-path-shadow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.78" />
              </filter>
              <marker
                id={`camera-path-arrow-${id}`}
                markerWidth="9"
                markerHeight="9"
                refX="7"
                refY="4.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L9,4.5 L0,9 z" fill="#ff584d" />
              </marker>
            </defs>
            {displayPoints.length > 1 ? (
              <>
                <polyline
                  points={cameraPathToSvgPoints(displayPoints)}
                  fill="none"
                  stroke="rgba(0,0,0,0.78)"
                  strokeWidth={lineWidthDraft + 7}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={cameraPathToSvgPoints(displayPoints)}
                  fill="none"
                  stroke="#ff584d"
                  strokeWidth={lineWidthDraft}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={`url(#camera-path-arrow-${id})`}
                />
              </>
            ) : null}
            {activeDocument?.waypoints.map((waypoint) => {
              const isEndpoint = waypoint.kind !== 'waypoint';
              return (
                <g
                  key={waypoint.id}
                  transform={`translate(${waypoint.x * 1000} ${waypoint.y * 1000})`}
                  className={cn(editTool === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair')}
                  filter={`url(#camera-path-shadow-${id})`}
                  onPointerDown={(event) => startWaypointDrag(event, waypoint.id, waypoint.pointIndex)}
                >
                  <circle
                    r={isEndpoint ? 20 : 17}
                    fill={isEndpoint ? '#ffffff' : '#ff584d'}
                    stroke="#151515"
                    strokeWidth="7"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    y={isEndpoint ? -35 : -31}
                    textAnchor="middle"
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.92)"
                    strokeWidth="8"
                    paintOrder="stroke"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none select-none text-[32px] font-bold"
                  >
                    {waypoint.label}
                  </text>
                </g>
              );
            })}
            {playbackPoint && (isPlaying || playbackProgress > 0) ? (
              <g transform={`translate(${playbackPoint.x * 1000} ${playbackPoint.y * 1000})`}>
                <circle r="29" fill="rgba(255,255,255,0.2)" stroke="#ffffff" strokeWidth="6" vectorEffect="non-scaling-stroke" />
                <circle r="11" fill="#ffffff" />
              </g>
            ) : null}
          </svg>
          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-md border border-white/15 bg-black/65 px-2 py-1 text-[10px] font-medium text-white/82 backdrop-blur-md">
            <Route className="h-3 w-3 text-[#ff6b5f]" />
            {hasPath ? `${activeDocument?.waypoints.length ?? 0} 个镜头点` : '绘制路径'}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="nodrag nowheel absolute inset-0 flex w-full flex-col items-center justify-center gap-2 text-white/45 transition-colors hover:bg-white/[0.035] hover:text-white/72"
        >
          {isUploading ? <Sparkles className="h-7 w-7 animate-pulse" /> : <ImagePlus className="h-8 w-8" />}
          <span className="text-[11px] font-medium">选择镜头画面</span>
        </button>
      )}
    </div>
  );

  const controls = (
    <div className="space-y-2.5 p-3">
      <div>
        <span className="mb-1 block text-[9px] font-medium text-white/35">操控</span>
        <div className="grid grid-cols-4 gap-1 rounded-md border border-white/10 bg-black/25 p-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="nodrag nowheel flex h-8 items-center justify-center gap-1.5 rounded-[4px] text-[10px] font-medium text-white/62 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            撤回
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className="nodrag nowheel flex h-8 items-center justify-center gap-1.5 rounded-[4px] text-[10px] font-medium text-white/62 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25"
          >
            <Redo2 className="h-3.5 w-3.5" />
            重做
          </button>
          <button
            type="button"
            onClick={() => setEditTool('move')}
            disabled={!hasPath}
            className={cn(
              'nodrag nowheel flex h-8 items-center justify-center gap-1.5 rounded-[4px] text-[10px] font-medium transition-colors disabled:opacity-25',
              editTool === 'move' ? 'bg-white/12 text-white' : 'text-white/52 hover:bg-white/10 hover:text-white'
            )}
          >
            <Move className="h-3.5 w-3.5" />
            移动镜头
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setPlaybackProgress(0);
              setDraftPoints([]);
              draftPointsRef.current = [];
              setEditTool('draw');
            }}
            disabled={!nodeData.imageUrl}
            className={cn(
              'nodrag nowheel flex h-8 items-center justify-center gap-1.5 rounded-[4px] text-[10px] font-medium transition-colors disabled:opacity-25',
              editTool === 'draw' ? 'bg-[#ff584d]/18 text-[#ff9b94]' : 'text-white/52 hover:bg-white/10 hover:text-white'
            )}
          >
            <PencilLine className="h-3.5 w-3.5" />
            重新绘制
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-[9px] font-medium text-white/35">画面缩放</span>
          <div className="flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/25 px-1">
            <button
              type="button"
              onClick={() => setEditorZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}
              disabled={editorZoom <= 1}
              title="缩小编辑画面"
              aria-label="缩小编辑画面"
              className="nodrag nowheel flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-20"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.25"
              value={editorZoom}
              onChange={(event) => setEditorZoom(Number(event.target.value))}
              aria-label="画面缩放"
              className="nodrag nowheel min-w-0 flex-1 accent-[#ff584d]"
            />
            <button
              type="button"
              onClick={() => setEditorZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
              disabled={editorZoom >= 3}
              title="放大编辑画面"
              aria-label="放大编辑画面"
              className="nodrag nowheel flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-20"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-right font-mono text-[9px] text-white/45">{editorZoom.toFixed(1)}x</span>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-[9px] font-medium text-white/35">线条粗细</span>
          <div className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2">
            <input
              type="range"
              min="3"
              max="14"
              step="1"
              value={lineWidthDraft}
              onChange={(event) => setLineWidthDraft(Number(event.target.value))}
              onPointerUp={() => updateNodeData(String(id), { lineWidth: lineWidthDraft })}
              onKeyUp={() => updateNodeData(String(id), { lineWidth: lineWidthDraft })}
              onBlur={() => updateNodeData(String(id), { lineWidth: lineWidthDraft })}
              className="nodrag nowheel min-w-0 flex-1 accent-[#ff584d]"
            />
            <span className="w-7 text-right font-mono text-[9px] text-white/45">{lineWidthDraft}px</span>
          </div>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 rounded-md border border-white/10 bg-black/25 p-0.5">
          {(['smart', 'strict'] as CameraPathMode[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => updatePathSettings({ mode: option })}
              className={cn(
                'nodrag nowheel h-7 rounded-[4px] text-[10px] font-semibold transition-colors',
                mode === option ? 'bg-white/12 text-white' : 'text-white/38 hover:text-white/68'
              )}
            >
              {option === 'smart' ? '智能遵循' : '严格遵循'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="更换图片"
          aria-label="更换图片"
          className="nodrag nowheel flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/25 text-white/52 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Upload className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_92px] gap-2">
        <label className="col-span-2 block">
          <span className="mb-1 block text-[9px] font-medium text-white/35">视频模型</span>
          <select
            value={modelSelectValue}
            onChange={(event) => {
              const [provider, ...modelParts] = event.target.value.split('::');
              const modelId = modelParts.join('::');
              updateNodeData(String(id), {
                preferredModelId: modelId,
                preferredModelProvider: provider,
                params: {
                  ...(nodeData.params && typeof nodeData.params === 'object'
                    ? (nodeData.params as Record<string, unknown>)
                    : {}),
                  preferredModelId: modelId,
                  preferredModelProvider: provider,
                },
              });
            }}
            className="nodrag nowheel h-8 w-full rounded-md border border-white/10 bg-[#0d0f12] px-2 text-[10px] text-white/78 outline-none focus:border-white/25"
          >
            {!selectableVideoModels.some(
              (model) => model.modelId === preferredModelId && model.provider === preferredModelProvider
            ) ? (
              <option value={modelSelectValue}>{preferredModelId}</option>
            ) : null}
            {selectableVideoModels.map((model) => (
              <option key={`${model.provider}:${model.modelId}`} value={`${model.provider}::${model.modelId}`}>
                {model.modelInfo?.name || model.modelId}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] font-medium text-white/35">路径语义</span>
          <select
            value={semantics}
            onChange={(event) => updatePathSettings({ semantics: event.target.value as CameraPathSemantics })}
            className="nodrag nowheel h-8 w-full rounded-md border border-white/10 bg-[#0d0f12] px-2 text-[10px] text-white/78 outline-none focus:border-white/25"
          >
            <option value="screen_tracking">画面跟踪</option>
            <option value="camera_translation">相机位移</option>
            <option value="flythrough">穿越路径</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] font-medium text-white/35">总时长</span>
          <select
            value={durationSec}
            onChange={(event) => updatePathSettings({ durationSec: Number(event.target.value) })}
            className="nodrag nowheel h-8 w-full rounded-md border border-white/10 bg-[#0d0f12] px-2 text-[10px] text-white/78 outline-none focus:border-white/25"
          >
            {DURATION_OPTIONS.map((duration) => (
              <option key={duration} value={duration}>{duration} 秒</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!hasPath}
          title={isPlaying ? '暂停预览' : '播放路径'}
          aria-label={isPlaying ? '暂停预览' : '播放路径'}
          className="nodrag nowheel flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/62 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#ff584d] transition-[width] duration-75"
            style={{ width: `${playbackProgress * 100}%` }}
          />
          {activeDocument?.waypoints.map((waypoint) => (
            <span
              key={waypoint.id}
              className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-white/75"
              style={{ left: `${waypoint.progress * 100}%` }}
            />
          ))}
        </div>
        <span className="w-12 text-right font-mono text-[9px] text-white/42">
          {(playbackProgress * durationSec).toFixed(1)}s
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.07] pt-2">
        <div className="flex items-center gap-1.5 text-[9px] text-white/38">
          <MapPin className="h-3 w-3" />
          <span>{hasPath ? '路径已编译' : '等待绘制'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => saveDocument(null)}
            disabled={!hasPath}
            title="清空路径"
            aria-label="清空路径"
            className="nodrag nowheel flex h-7 w-7 items-center justify-center rounded-md text-white/42 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="aicg-node-wrapper relative">
      <AICGUnifiedIOHandles
        nodeId={String(id)}
        nodeType="cameraPath"
        inputId="image"
        outputId="output"
        inputTip="输入图片"
        outputTip="镜头路径"
        extraOutputs={['image', 'prompt']}
      />
      <AICGNodeShell
        aicgType="tool"
        title="镜头路径"
        subtitle={mode === 'strict' ? '严格遵循' : '智能遵循'}
        selected={selected}
        width={548}
        variant="glass-stack"
        preview={preview}
        controls={controls}
        onDelete={() => canvasStoreApi.deleteNode(String(id))}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGE}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

export default memo(CameraPathNode);
