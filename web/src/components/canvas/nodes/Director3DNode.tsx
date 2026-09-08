import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import NodeControllerV2Panel from './NodeControllerV2Panel';
import type { NodeControllerAction } from './NodeControllerCapabilityPanel';
import { cn } from '@/lib/utils';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { toast } from 'sonner';
import { persistGeneratedCanvasUrl, persistImportedCanvasFile } from '@/services/canvas-asset-actions';
import { resolveAssetUrl } from '@/services/canvas-asset-url-resolver';
import { Scene3DBridge } from './scene3d-bridge';
import {
  type Director3DParams,
  type Scene3DTool,
  type MannequinGender,
  type MannequinColorKey,
  type CaptureAspect,
  type Camera3D,
  type CameraPreset,
  type EnvironmentMode,
  type SceneObject3D,
  type ObjectTransform,
  type SceneView,
  type SceneHistoryEntry,
  type AlignMode,
  type Scene3DExport,
  type AnimationState,
  type KeyframeTrack,
  type Keyframe,
  type EasingType,
  type KeyframeProperty,
  type CompositionGuide,
  type LightingPreset,
  type RenderQuality,
  type SceneDiagnostics,
  DEFAULT_DIRECTOR3D_PARAMS,
  DEFAULT_SCENE_VIEW,
  DEFAULT_PANORAMA_VIEW,
  PANORAMA_SCENE_CAMERA_LIMIT,
  PANORAMA_SCENE_DEFAULT_SIZE,
  PANORAMA_SCENE_COLLAPSED_MAX_SIZE,
  CAPTURE_ASPECTS,
  MANNEQUIN_COLORS,
  LIGHTING_PRESETS,
  RENDER_CONSTRAINTS,
  VIEWPORT_OVERLAY,
  TOOLBAR_THEME,
  cameraToPrompt,
  clampSceneFocalLength,
  clampSceneOrbitPitch,
  clampSceneOrbitDistance,
  createDefaultCamera,
  createMannequin,
  createCube,
  createModelObject,
} from './director3d-core';
import { resolvePanoramaImageFromIncomingEdge } from './panorama-scene-utils';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { getNodeControllerPreset } from '@/services/node-controller-capability-registry';
import {
  spawnControllerToolNode,
  withControllerActionConnection,
} from '@/services/node-controller-action-service';

const SVG = {
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  navigate: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="m5 3 10 8-6 1 2 7-3 1-2-7-4 3z"/></svg>,
  move: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M12 3v18M3 12h18"/><path d="m7 8 5-5 5 5"/><path d="m7 16 5 5 5-5"/><path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/></svg>,
  scale: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M4 20h16"/><path d="M4 20V4"/><path d="m9 9 6 6"/><path d="M15 9H9v6"/></svg>,
  rotate: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M20 11a8 8 0 1 1-2.34-5.66"/><path d="M20 4v7h-7"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/></svg>,
  fullscreen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>,
  collapse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="m6 15 6-6 6 6"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4"/></svg>,
  cube: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18M15 3v18M3 15h18"/></svg>,
  mannequin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><circle cx="12" cy="5" r="2.5"/><path d="M12 8v7"/><path d="M8.5 12.5 12 9l3.5 3.5"/><path d="M9 21l3-6 3 6"/></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="m12 2 8 4.5v11L12 22 4 17.5v-11L12 2Z"/><path d="M12 22V11.5"/><path d="M20 6.5 12 11.5 4 6.5"/></svg>,
  capture: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M4 8h3l2-2h6l2 2h3v10H4z"/><circle cx="12" cy="13" r="3.5"/></svg>,
  camera: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M4 7h12a2 2 0 0 1 2 2v8H4z"/><path d="m16 11 4-2v8l-4-2"/><circle cx="10" cy="13" r="2.5"/></svg>,
  focus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M12 4v3"/><path d="M12 17v3"/><path d="M4 12h3"/><path d="M17 12h3"/><circle cx="12" cy="12" r="4"/></svg>,
  reset: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>,
  male: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><circle cx="10" cy="14" r="5"/><path d="M14.5 9.5 21 3"/><path d="M16 3h5v5"/></svg>,
  female: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><circle cx="12" cy="8" r="5"/><path d="M12 13v8"/><path d="M9 18h6"/></svg>,
  delete: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={10} height={10}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  undo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M3 10h10a5 5 0 0 1 0 10H9"/><path d="M3 10l4-4"/><path d="M3 10l4 4"/></svg>,
  redo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M21 10H11a5 5 0 0 0 0 10h4"/><path d="M21 10l-4-4"/><path d="M21 10l-4 4"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M12 4v12"/><path d="m8 12 4 4 4-4"/><path d="M4 20h16"/></svg>,
  fileImport: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>,
  play: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><polygon points="5,3 19,12 5,21"/></svg>,
  pause: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  keyframe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><path d="M12 2l3 7h-6l3-7z"/><path d="M12 9v13"/></svg>,
  timeline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="M3 12h18"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/><path d="M7 10V6"/><path d="M17 10V6"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  unlock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  alignLeft: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><line x1="4" y1="2" x2="4" y2="22"/><rect x="8" y="4" width="12" height="4" rx="1"/><rect x="8" y="10" width="8" height="4" rx="1"/><rect x="8" y="16" width="10" height="4" rx="1"/></svg>,
  alignRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><line x1="20" y1="2" x2="20" y2="22"/><rect x="4" y="4" width="12" height="4" rx="1"/><rect x="8" y="10" width="8" height="4" rx="1"/><rect x="6" y="16" width="10" height="4" rx="1"/></svg>,
  alignTop: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><line x1="2" y1="4" x2="22" y2="4"/><rect x="4" y="8" width="4" height="12" rx="1"/><rect x="10" y="8" width="4" height="8" rx="1"/><rect x="16" y="8" width="4" height="10" rx="1"/></svg>,
  alignBottom: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><line x1="2" y1="20" x2="22" y2="20"/><rect x="4" y="4" width="4" height="12" rx="1"/><rect x="10" y="8" width="4" height="8" rx="1"/><rect x="16" y="6" width="4" height="10" rx="1"/></svg>,
  distributeH: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><line x1="3" y1="2" x2="3" y2="22"/><line x1="21" y1="2" x2="21" y2="22"/><rect x="8" y="8" width="3" height="8" rx="1"/><rect x="13" y="8" width="3" height="8" rx="1"/></svg>,
  distributeV: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><line x1="2" y1="3" x2="22" y2="3"/><line x1="2" y1="21" x2="22" y2="21"/><rect x="8" y="8" width="8" height="3" rx="1"/><rect x="8" y="13" width="8" height="3" rx="1"/></svg>,
  groundSnap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><line x1="2" y1="20" x2="22" y2="20"/><path d="M12 4v12"/><polyline points="8 12 12 16 16 12"/><rect x="6" y="2" width="4" height="2" rx="0.5"/><rect x="14" y="2" width="4" height="2" rx="0.5"/></svg>,
  hdr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  model3d: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><path d="m12 2 8 4.5v11L12 22 4 17.5v-11L12 2Z"/><path d="M12 22V11.5"/><path d="M20 6.5 12 11.5 4 6.5"/><path d="M16 4l-4 2.5L8 4"/></svg>,
  cameraLab: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 4v5M19 12h-5M12 20v-5M5 12h5"/></svg>,
};

const MANNEQUIN_QUICK_COLORS: MannequinColorKey[] = ['red', 'green', 'blue', 'yellow', 'purple', 'cyan', 'black', 'white'];

async function persistSceneImageFile(nodeId: string, file: File, fallbackUrl: string) {
  const persisted = await persistImportedCanvasFile({
    nodeId,
    kind: 'image',
    file,
    role: 'source',
    source: 'imported',
  });
  const runtimeUrl = persisted.runtimeUrl ?? await resolveAssetUrl(persisted.asset.id);
  return {
    assetId: persisted.asset.id,
    url: runtimeUrl || fallbackUrl,
  };
}

function compactMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function Director3DNode({ id, data, selected }: NodeProps) {
  // ✅ P3-1：用 nodeIndex O(1) 查找替代 find O(n)
  const liveData = useCanvasStore(
    useCallback((state) => {
      const idx = state.nodeIndex.get(id);
      return idx !== undefined ? state.nodes[idx]?.data : undefined;
    }, [id]),
  );
  const nodeData = (liveData ?? data) as Record<string, unknown> | undefined;
  const rawParams: Partial<Director3DParams> = (nodeData?.params as Partial<Director3DParams>) ?? {};
  const params: Director3DParams = {
    ...DEFAULT_DIRECTOR3D_PARAMS, ...rawParams,
    view: { ...DEFAULT_SCENE_VIEW, ...(rawParams.view ?? {}) },
    panoramaView: { ...DEFAULT_PANORAMA_VIEW, ...(rawParams.panoramaView ?? {}) },
    objects: rawParams.objects ?? [],
    cameras: rawParams.cameras ?? [],
    cameraPresets: rawParams.cameraPresets ?? [],
  };

  const updateNodeData = useCallback((patch: Partial<Director3DParams> & Record<string, unknown>) => {
    useCanvasStore.setState((state) => {
      const targetIndex = state.nodeIndex.get(id);
      if (targetIndex === undefined) return state;

      const targetNode = state.nodes[targetIndex];
      const currentData = ((targetNode.data as Record<string, unknown> | undefined) ?? {});
      const currentParams = ((currentData.params as Partial<Director3DParams> | undefined) ?? DEFAULT_DIRECTOR3D_PARAMS);
      const exposedPatch: Record<string, unknown> = {};
      for (const key of ['resultUrl', 'imageUrl', 'output', 'prompt', 'panoramaImageUrl', 'panoramaAssetId', 'resultAssetId']) {
        if (key in patch) exposedPatch[key] = patch[key];
      }
      const nextNodes = [...state.nodes];
      nextNodes[targetIndex] = {
        ...targetNode,
        data: {
          ...currentData,
          ...exposedPatch,
          params: {
            ...currentParams,
            ...patch,
          },
        },
      };

      return { nodes: nextNodes };
    });
  }, [id]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<Scene3DBridge | null>(null);
  const objectsRef = useRef<SceneObject3D[]>(params.objects);
  const [isEditing, setIsEditing] = useState(false);
  const [showMannequinMenu, setShowMannequinMenu] = useState(false);
  const [showCameraDock, setShowCameraDock] = useState(false);
  const [showCaptureMenu, setShowCaptureMenu] = useState(false);
  const [showFocusMenu, setShowFocusMenu] = useState(false);
  const [showGridPanel, setShowGridPanel] = useState(false);
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(3);
  const [selectedGender, setSelectedGender] = useState<MannequinGender>('male');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetMenuSlot, setPresetMenuSlot] = useState<number | null>(null);
  const [presetMenuPos, setPresetMenuPos] = useState({ x: 0, y: 0 });
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const historyRef = useRef<SceneHistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const skipHistoryRef = useRef(false);
  const prevSnapshotRef = useRef('');
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [animation, setAnimation] = useState<AnimationState>({ tracks: [], duration: 5, currentTime: 0, isPlaying: false, fps: 30 });
  const [showTimeline, setShowTimeline] = useState(false);
  const animationRef = useRef<AnimationState>(animation);
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [watermarkCapture, setWatermarkCapture] = useState(false);
  const [showHDRPanel, setShowHDRPanel] = useState(false);
  const [showCameraLab, setShowCameraLab] = useState(false);
  const [hdrIntensity, setHdrIntensity] = useState(params.environmentHDRIntensity ?? 1);
  const [diagnostics, setDiagnostics] = useState<SceneDiagnostics | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const resolvedModelAssetIdsRef = useRef<Set<string>>(new Set());
  const resolvedSceneAssetIdsRef = useRef<Set<string>>(new Set());

  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const viewRef = useRef({ ...DEFAULT_SCENE_VIEW });
  const dragModeRef = useRef<'navigate' | 'gizmo' | 'object'>('navigate');
  const hoveredGizmoAxisRef = useRef<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushHistory = useCallback((description: string) => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    const entry: SceneHistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      description,
      objects: JSON.parse(JSON.stringify(params.objects)),
      view: { ...params.view, target: { ...params.view.target } },
    };
    const current = historyRef.current;
    const idx = historyIndexRef.current;
    const trimmed = current.slice(0, idx + 1);
    const next = [...trimmed, entry].slice(-50);
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
  }, [params.objects, params.view]);

  const handleUndo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const newIndex = idx - 1;
    const entry = historyRef.current[newIndex];
    historyIndexRef.current = newIndex;
    skipHistoryRef.current = true;
    viewRef.current = { ...entry.view, target: { ...entry.view.target } };
    bridgeRef.current?.applySceneView(viewRef.current);
    updateNodeData({ objects: JSON.parse(JSON.stringify(entry.objects)), view: { ...entry.view, target: { ...entry.view.target } } });
  }, [updateNodeData]);

  const handleRedo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    const newIndex = idx + 1;
    const entry = historyRef.current[newIndex];
    historyIndexRef.current = newIndex;
    skipHistoryRef.current = true;
    viewRef.current = { ...entry.view, target: { ...entry.view.target } };
    bridgeRef.current?.applySceneView(viewRef.current);
    updateNodeData({ objects: JSON.parse(JSON.stringify(entry.objects)), view: { ...entry.view, target: { ...entry.view.target } } });
  }, [updateNodeData]);

  const sceneSnapshot = JSON.stringify({ o: params.objects, v: params.view });

  useEffect(() => {
    if (!isEditing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedo();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, handleUndo, handleRedo]);

  useEffect(() => {
    if (!isEditing) {
      prevSnapshotRef.current = '';
      return;
    }
    if (prevSnapshotRef.current === '') {
      prevSnapshotRef.current = sceneSnapshot;
      if (historyRef.current.length === 0) {
        pushHistory('初始状态');
      }
      return;
    }
    if (sceneSnapshot === prevSnapshotRef.current) return;
    prevSnapshotRef.current = sceneSnapshot;
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushHistory('场景变更');
    }, 200);
    return () => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
    };
  }, [sceneSnapshot, isEditing, pushHistory]);

  useEffect(() => { viewRef.current = { ...params.view }; }, [params.view]);
  useEffect(() => { objectsRef.current = params.objects; }, [params.objects]);

  useEffect(() => {
    const modelObjectsNeedingUrl = params.objects.filter(
      (object) =>
        object.type === 'model' &&
        object.modelAssetId &&
        (!object.modelUrl || object.modelUrl.startsWith('blob:')) &&
        !resolvedModelAssetIdsRef.current.has(object.modelAssetId),
    );
    if (modelObjectsNeedingUrl.length === 0) return;

    let cancelled = false;
    void (async () => {
      const resolvedByAssetId = new Map<string, string>();
      for (const object of modelObjectsNeedingUrl) {
        if (!object.modelAssetId) continue;
        resolvedModelAssetIdsRef.current.add(object.modelAssetId);
        const resolved = await resolveAssetUrl(object.modelAssetId).catch(() => null);
        if (resolved) resolvedByAssetId.set(object.modelAssetId, resolved);
      }
      if (cancelled || resolvedByAssetId.size === 0) return;

      const nextObjects = params.objects.map((object) => {
        if (object.type !== 'model' || !object.modelAssetId) return object;
        const modelUrl = resolvedByAssetId.get(object.modelAssetId);
        return modelUrl ? { ...object, modelUrl } : object;
      });
      updateNodeData({ objects: nextObjects });
      bridgeRef.current?.syncObjects(nextObjects);
    })();

    return () => { cancelled = true; };
  }, [params.objects, updateNodeData]);

  useEffect(() => {
    const assetId = params.panoramaAssetId;
    if (!assetId || resolvedSceneAssetIdsRef.current.has(`panorama:${assetId}`)) return;
    if (params.panoramaImageUrl && !params.panoramaImageUrl.startsWith('blob:')) return;

    let cancelled = false;
    resolvedSceneAssetIdsRef.current.add(`panorama:${assetId}`);
    void resolveAssetUrl(assetId)
      .then((resolved) => {
        if (cancelled || !resolved) return;
        updateNodeData({ panoramaImageUrl: resolved });
        bridgeRef.current?.loadPanoramaImage(resolved);
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, [params.panoramaAssetId, params.panoramaImageUrl, updateNodeData]);

  useEffect(() => {
    const assetId = params.environmentHDRAssetId;
    if (!assetId || resolvedSceneAssetIdsRef.current.has(`hdr:${assetId}`)) return;
    if (params.environmentHDRUrl && !params.environmentHDRUrl.startsWith('blob:')) return;

    let cancelled = false;
    resolvedSceneAssetIdsRef.current.add(`hdr:${assetId}`);
    void resolveAssetUrl(assetId)
      .then((resolved) => {
        if (cancelled || !resolved) return;
        updateNodeData({ environmentHDRUrl: resolved });
        bridgeRef.current?.loadEnvironmentHDR(resolved);
        bridgeRef.current?.setEnvironmentIntensity(params.environmentHDRIntensity ?? 1);
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, [params.environmentHDRAssetId, params.environmentHDRIntensity, params.environmentHDRUrl, updateNodeData]);

  useEffect(() => {
    if (!viewportRef.current) return;
    if (bridgeRef.current) bridgeRef.current.dispose();
    const bridge = new Scene3DBridge(viewportRef.current);
    bridgeRef.current = bridge;
    bridge.setMode('scene');
    bridge.applySceneView(params.view);
    bridge.applyEnvironment(params.environment);
    bridge.setShowGrid(params.showGrid);
    bridge.syncObjects(params.objects);
    bridge.setSelectedObject(params.selectedObjectId ?? null);
    bridge.setTool(params.tool);
    bridge.setLightingPreset(params.lightingPreset);
    bridge.setExposure(params.exposure);
    bridge.setRenderQuality(params.renderQuality);
    bridge.setTransformChangeCallback((objectId: string, transform: ObjectTransform) => {
      const node = useCanvasStore.getState().nodes.find((entry) => entry.id === id);
      const currentObjects =
        ((node?.data as Record<string, unknown> | undefined)?.params as Director3DParams | undefined)?.objects
        ?? objectsRef.current;
      const newObjects = currentObjects.map((o) => {
        if (o.id !== objectId) return o;
        return { ...o, position: transform.position, rotation: transform.rotation, scale: transform.scale };
      });
      updateNodeData({ objects: newObjects });
    });
    return () => { bridge.dispose(); bridgeRef.current = null; };
  }, [id, updateNodeData]);

  // 组件卸载时清理所有定时器，避免内存泄漏和卸载后报错
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
  }, []);

  // 容器尺寸变化时同步 resize WebGL renderer
  useEffect(() => {
    const viewport = viewportRef.current;
    const bridge = bridgeRef.current;
    if (!viewport || !bridge) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && bridgeRef.current) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          bridgeRef.current.resize(width, height);
        }
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { bridgeRef.current?.applyEnvironment(params.environment); }, [params.environment]);
  useEffect(() => { bridgeRef.current?.setShowGrid(params.showGrid); }, [params.showGrid]);
  useEffect(() => { bridgeRef.current?.syncObjects(params.objects); }, [params.objects]);
  useEffect(() => { bridgeRef.current?.setSelectedObject(params.selectedObjectId ?? null); }, [params.selectedObjectId]);
  useEffect(() => { bridgeRef.current?.setTool(params.tool); }, [params.tool]);
  useEffect(() => { bridgeRef.current?.setLightingPreset(params.lightingPreset); }, [params.lightingPreset]);
  useEffect(() => { bridgeRef.current?.setExposure(params.exposure); }, [params.exposure]);
  useEffect(() => { bridgeRef.current?.setRenderQuality(params.renderQuality); }, [params.renderQuality]);
  useEffect(() => { bridgeRef.current?.applySceneView(viewRef.current); }, [params.view.orbitYaw, params.view.orbitPitch, params.view.orbitDistance, params.view.focalLength]);

  useEffect(() => {
    if (!params.showDiagnostics && !showCameraLab) {
      setDiagnostics(null);
      return;
    }
    const refresh = () => setDiagnostics(bridgeRef.current?.getDiagnostics() ?? null);
    refresh();
    const timer = window.setInterval(refresh, 750);
    return () => window.clearInterval(timer);
  }, [params.showDiagnostics, showCameraLab]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (params.environmentHDRUrl) {
      bridge.loadEnvironmentHDR(params.environmentHDRUrl);
      bridge.setEnvironmentIntensity(params.environmentHDRIntensity ?? 1);
    }
  }, [params.environmentHDRUrl]);

  const edges = useCanvasStore((s) => s.edges);
  const canvasNodes = useCanvasStore((s) => s.nodes);

  useEffect(() => {
    const imageUrl = resolvePanoramaImageFromIncomingEdge(id as string, 'input');
    if (!imageUrl || imageUrl === params.panoramaImageUrl) return;
    updateNodeData({ panoramaImageUrl: imageUrl });
    bridgeRef.current?.loadPanoramaImage(imageUrl);
  }, [id, edges, canvasNodes, params.panoramaImageUrl, updateNodeData]);

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (isEditing && params.tool !== 'navigate') {
      const gizmoAxis = bridge.pickGizmoAxis(e.clientX, e.clientY);
      if (gizmoAxis && params.selectedObjectId) {
        dragModeRef.current = 'gizmo';
        bridge.startGizmoDrag(gizmoAxis, e.clientX, e.clientY);
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const pickedId = bridge.pickObjectAt(e.clientX, e.clientY);
      if (pickedId) {
        if (params.selectedObjectId !== pickedId) {
          updateNodeData({ selectedObjectId: pickedId });
          bridge.setSelectedObject(pickedId);
        }
        dragModeRef.current = 'object';
        bridge.startObjectDrag(e.clientX, e.clientY);
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (params.selectedObjectId) {
        updateNodeData({ selectedObjectId: null });
        bridge.setSelectedObject(null);
      }
      return;
    }
    dragModeRef.current = 'navigate';
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, [isEditing, params.tool, params.selectedObjectId, updateNodeData]);

  const handleViewportMouseMove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (!isDragging.current) {
      if (isEditing && params.tool !== 'navigate') {
        const gizmoAxis = bridge.pickGizmoAxis(e.clientX, e.clientY);
        hoveredGizmoAxisRef.current = gizmoAxis;
      }
      return;
    }
    if (dragModeRef.current === 'gizmo') {
      bridge.updateGizmoDrag(e.clientX, e.clientY);
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (dragModeRef.current === 'object') {
      bridge.updateObjectDrag(e.clientX, e.clientY);
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    const v = viewRef.current;
    const newYaw = v.orbitYaw - dx * 0.005;
    const newPitch = clampSceneOrbitPitch(v.orbitPitch + dy * 0.005);
    const newView = { ...v, orbitYaw: newYaw, orbitPitch: newPitch };
    viewRef.current = newView;
    bridge.applySceneView(newView);
    updateNodeData({ view: newView });
  }, [isEditing, params.tool, updateNodeData]);

  const handleViewportMouseUp = useCallback(() => {
    const bridge = bridgeRef.current;
    const shouldSnap = params.tool === 'move';
    if (dragModeRef.current === 'gizmo') {
      bridge?.endGizmoDrag();
      if (shouldSnap && params.selectedObjectId) {
        bridge?.snapToGround(params.selectedObjectId);
      }
    } else if (dragModeRef.current === 'object') {
      bridge?.endObjectDrag();
      if (shouldSnap && params.selectedObjectId) {
        bridge?.snapToGround(params.selectedObjectId);
      }
    }
    isDragging.current = false;
    dragModeRef.current = 'navigate';
  }, [params.selectedObjectId, params.tool]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const v = viewRef.current;
    const delta = e.deltaY > 0 ? 1.08 : 0.92;
    const newDist = clampSceneOrbitDistance(v.orbitDistance * delta);
    const newView = { ...v, orbitDistance: newDist };
    viewRef.current = newView;
    bridgeRef.current?.applySceneView(newView);
    updateNodeData({ view: newView });
  }, [updateNodeData]);

  const handleEnterEdit = useCallback(() => { setIsEditing(true); }, []);
  const handleExitEdit = useCallback(() => {
    setIsEditing(false);
    setShowMannequinMenu(false);
    setShowCameraDock(false);
    setShowCaptureMenu(false);
    setShowFocusMenu(false);
    setShowGridPanel(false);
    setShowLayerPanel(false);
    setShowTimeline(false);
    setShowHDRPanel(false);
    setShowCameraLab(false);
    setSelectedObjectIds([]);
  }, []);

  const handleToolChange = useCallback((tool: Scene3DTool) => {
    updateNodeData({ tool });
    bridgeRef.current?.setTool(tool);
  }, [updateNodeData]);

  const handleEnvToggle = useCallback(() => {
    const newEnv: EnvironmentMode = params.environment === 'day' ? 'night' : 'day';
    updateNodeData({ environment: newEnv });
  }, [params.environment, updateNodeData]);

  const handleMannequinColorClick = useCallback((colorKey: MannequinColorKey) => {
    const count = params.objects.filter((o) => o.type === 'mannequin').length;
    const obj = createMannequin(selectedGender, colorKey, count);
    updateNodeData({ objects: [...params.objects, obj], selectedObjectId: obj.id });
    setShowMannequinMenu(false);
  }, [params.objects, selectedGender, updateNodeData]);

  const handleAddCube = useCallback(() => {
    const count = params.objects.filter((o) => o.type === 'cube').length;
    const obj = createCube(count);
    updateNodeData({ objects: [...params.objects, obj], selectedObjectId: obj.id, selectedObjectIds: [obj.id] });
    setSelectedObjectIds([obj.id]);
  }, [params.objects, updateNodeData]);

  const handleCreateStarterScene = useCallback(() => {
    const baseIndex = params.objects.filter((o) => o.type === 'mannequin').length;
    const lead = createMannequin('female', 'gray', baseIndex);
    const support = createMannequin('female', 'gray', baseIndex + 1);
    const prop = createCube(params.objects.filter((o) => o.type === 'cube').length);
    lead.position = { x: -0.8, y: 0, z: 0 };
    support.position = { x: 0.9, y: 0, z: 0.25 };
    prop.position = { x: 0.1, y: 0.45, z: -0.9 };
    prop.scale = { x: 0.7, y: 0.7, z: 0.7 };
    const starterCamera = createDefaultCamera(params.cameras.length);
    const nextObjects = [...params.objects, lead, support, prop];
    updateNodeData({
      objects: nextObjects,
      cameras: params.cameras.length < PANORAMA_SCENE_CAMERA_LIMIT ? [...params.cameras, starterCamera] : params.cameras,
      selectedObjectId: lead.id,
      selectedObjectIds: [lead.id],
    });
    setSelectedObjectIds([lead.id]);
    setIsEditing(true);
    setShowLayerPanel(true);
  }, [params.objects, params.cameras, updateNodeData]);

  const handleUploadHDR = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.hdr,.exr,.jpg,.jpeg,.png,.webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // 释放旧的 blob URL
      if (params.environmentHDRUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(params.environmentHDRUrl);
      }
      let url = URL.createObjectURL(file);
      let environmentHDRAssetId: string | undefined;
      updateNodeData({ environmentHDRUrl: url, environmentHDRAssetId: undefined, environmentHDRIntensity: hdrIntensity });
      bridgeRef.current?.loadEnvironmentHDR(url);
      bridgeRef.current?.setEnvironmentIntensity(hdrIntensity);
      try {
        const persisted = await persistSceneImageFile(id as string, file, url);
        environmentHDRAssetId = persisted.assetId;
        if (persisted.url !== url && url.startsWith('blob:')) URL.revokeObjectURL(url);
        url = persisted.url;
        toast.success('HDR/环境图已保存到资产仓库');
      } catch (error) {
        console.warn('[Director3DNode] HDR/环境图持久化失败，已使用临时 URL:', error);
        toast.warning('HDR/环境图暂未持久化，本次会话可用');
      }
      updateNodeData({ environmentHDRUrl: url, environmentHDRAssetId, environmentHDRIntensity: hdrIntensity });
      bridgeRef.current?.loadEnvironmentHDR(url);
      bridgeRef.current?.setEnvironmentIntensity(hdrIntensity);
    };
    input.click();
  }, [hdrIntensity, id, params.environmentHDRUrl, updateNodeData]);

  const handleHDRIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, Math.min(2, Number(e.target.value)));
    setHdrIntensity(val);
    updateNodeData({ environmentHDRIntensity: val });
    bridgeRef.current?.setEnvironmentIntensity(val);
  }, [updateNodeData]);

  const handleRemoveHDR = useCallback(() => {
    // 释放 blob URL
    if (params.environmentHDRUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(params.environmentHDRUrl);
    }
    updateNodeData({ environmentHDRUrl: undefined, environmentHDRAssetId: undefined, environmentHDRIntensity: undefined });
    setHdrIntensity(1);
    bridgeRef.current?.removeEnvironmentHDR();
    setShowHDRPanel(false);
    setShowCameraLab(false);
  }, [params.environmentHDRUrl, updateNodeData]);

  const handleImportModel = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gltf,.glb';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      let url = URL.createObjectURL(file);
      let modelAssetId: string | undefined;
      try {
        const persisted = await persistImportedCanvasFile({
          nodeId: id as string,
          kind: 'model',
          file,
          role: 'source',
          source: 'imported',
        });
        modelAssetId = persisted.asset.id;
        resolvedModelAssetIdsRef.current.add(modelAssetId);
        if (persisted.runtimeUrl) {
          URL.revokeObjectURL(url);
          url = persisted.runtimeUrl;
        }
        toast.success('3D 模型已保存到资产仓库');
      } catch (error) {
        console.warn('[Director3DNode] 模型持久化失败，已使用临时 URL:', error);
        toast.warning('模型暂未持久化，本次会话可用');
      }
      const name = file.name.replace(/\.(gltf|glb)$/i, '');
      const obj = {
        ...createModelObject(url, name, params.objects.filter((o) => o.type === 'model').length),
        modelAssetId,
      };
      updateNodeData({ objects: [...params.objects, obj], selectedObjectId: obj.id });
    };
    input.click();
  }, [id, params.objects, updateNodeData]);

  const handleSavePreset = useCallback((slot: number, name?: string) => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const preset = bridge.saveCameraPreset(viewRef.current, slot, name);
    const existing = params.cameraPresets.find((p) => p.slot === slot);
    const newPresets = existing
      ? params.cameraPresets.map((p) => (p.slot === slot ? preset : p))
      : [...params.cameraPresets, preset];
    updateNodeData({ cameraPresets: newPresets });
  }, [params.cameraPresets, updateNodeData]);

  const handleLoadPreset = useCallback((preset: CameraPreset) => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    bridge.loadCameraPreset(preset.view);
    const newView = { ...preset.view, target: { ...preset.view.target } };
    viewRef.current = newView;
    updateNodeData({ view: newView });
  }, [updateNodeData]);

  const handleDeletePreset = useCallback((presetId: string) => {
    updateNodeData({ cameraPresets: params.cameraPresets.filter((p) => p.id !== presetId) });
  }, [params.cameraPresets, updateNodeData]);

  const handleRenamePreset = useCallback((presetId: string, name: string) => {
    updateNodeData({
      cameraPresets: params.cameraPresets.map((p) => (p.id === presetId ? { ...p, name: name.trim() || p.name } : p)),
    });
    setRenamingPresetId(null);
    setRenameValue('');
  }, [params.cameraPresets, updateNodeData]);

  const handleSlotClick = useCallback((slot: number) => {
    const preset = params.cameraPresets.find((p) => p.slot === slot);
    if (preset) {
      handleLoadPreset(preset);
    } else {
      handleSavePreset(slot);
    }
  }, [params.cameraPresets, handleLoadPreset, handleSavePreset]);

  const handleSlotContextMenu = useCallback((e: React.MouseEvent, slot: number) => {
    e.preventDefault();
    const preset = params.cameraPresets.find((p) => p.slot === slot);
    if (!preset) return;
    setPresetMenuSlot(slot);
    setPresetMenuPos({ x: e.clientX, y: e.clientY });
    setShowPresetMenu(true);
  }, [params.cameraPresets]);

  const handleSlotMouseDown = useCallback((e: React.MouseEvent, slot: number) => {
    const preset = params.cameraPresets.find((p) => p.slot === slot);
    if (!preset) return;
    longPressTimer.current = setTimeout(() => {
      setPresetMenuSlot(slot);
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setPresetMenuPos({ x: rect.left + rect.width / 2, y: rect.top });
      setShowPresetMenu(true);
    }, 600);
  }, [params.cameraPresets]);

  const handleSlotMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleAddCamera = useCallback(() => {
    if (params.cameras.length >= PANORAMA_SCENE_CAMERA_LIMIT) return;
    const cam = createDefaultCamera(params.cameras.length);
    const v = viewRef.current;
    cam.yaw = v.orbitYaw;
    cam.pitch = v.orbitPitch;
    cam.distance = v.orbitDistance;
    cam.focalLength = v.focalLength;
    updateNodeData({ cameras: [...params.cameras, cam] });
    setShowCameraDock(true);
  }, [params.cameras, updateNodeData]);

  const handleDeleteCamera = useCallback((camId: string) => {
    updateNodeData({ cameras: params.cameras.filter((c) => c.id !== camId) });
  }, [params.cameras, updateNodeData]);

  const handleJumpToCamera = useCallback((cam: Camera3D) => {
    const newView = { ...DEFAULT_SCENE_VIEW, orbitYaw: cam.yaw, orbitPitch: cam.pitch, orbitDistance: cam.distance, focalLength: cam.focalLength };
    viewRef.current = newView;
    bridgeRef.current?.startDampedViewTransition(newView);
    updateNodeData({ view: newView });
  }, [updateNodeData]);

  const handleDeleteSelected = useCallback(() => {
    if (!params.selectedObjectId) return;
    const deletedId = params.selectedObjectId;
    setSelectedObjectIds((prev) => prev.filter((sid) => sid !== deletedId));
    updateNodeData({
      objects: params.objects.filter((o) => o.id !== deletedId),
      selectedObjectId: null,
      selectedObjectIds: selectedObjectIds.filter((sid) => sid !== deletedId),
    });
  }, [params.objects, params.selectedObjectId, selectedObjectIds, updateNodeData]);

  const handleResetView = useCallback(() => {
    const newView = { ...DEFAULT_SCENE_VIEW };
    viewRef.current = newView;
    bridgeRef.current?.startDampedViewTransition(newView);
    updateNodeData({ view: newView });
  }, [updateNodeData]);

  useEffect(() => {
    if (!isEditing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case 'q':
          e.preventDefault();
          handleToolChange('navigate');
          break;
        case 'w':
          e.preventDefault();
          handleToolChange('move');
          break;
        case 'e':
          e.preventDefault();
          handleToolChange('rotate');
          break;
        case 'r':
          e.preventDefault();
          handleToolChange('scale');
          break;
        case 'f':
          e.preventDefault();
          if (params.selectedObjectId && bridgeRef.current) {
            const obj = params.objects.find((o) => o.id === params.selectedObjectId);
            if (obj) {
              const newView = { ...viewRef.current, target: { ...obj.position } };
              viewRef.current = newView;
              bridgeRef.current.startDampedViewTransition(newView);
              updateNodeData({ view: newView });
            }
          }
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          handleDeleteSelected();
          break;
        case 'escape':
          e.preventDefault();
          if (params.selectedObjectId) {
            updateNodeData({ selectedObjectId: null });
            bridgeRef.current?.setSelectedObject(null);
          } else {
            handleExitEdit();
          }
          break;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const nextSlot = Array.from({ length: 10 }, (_, i) => i + 1).find((slot) => !params.cameraPresets.some((p) => p.slot === slot));
        if (nextSlot) handleSavePreset(nextSlot);
      }
      if (/^[0-9]$/.test(e.key)) {
        const slot = e.key === '0' ? 10 : parseInt(e.key);
        const preset = params.cameraPresets.find((p) => p.slot === slot);
        if (preset) handleLoadPreset(preset);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, params.selectedObjectId, params.objects, params.cameraPresets, handleToolChange, handleDeleteSelected, handleExitEdit, handleSavePreset, handleLoadPreset, updateNodeData]);

  const [transparentCapture, setTransparentCapture] = useState(false);

  const handleCapture = useCallback((aspect: CaptureAspect) => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const aspectInfo = CAPTURE_ASPECTS.find((a) => a.key === aspect) ?? CAPTURE_ASPECTS[0];
    const watermarkInfo = watermarkCapture ? {
      focalLength: Math.round(viewRef.current.focalLength),
      pitchDeg: (viewRef.current.orbitPitch * 180) / Math.PI,
      yawDeg: (viewRef.current.orbitYaw * 180) / Math.PI,
    } : undefined;
    const dataUrl = bridge.captureViewport(aspectInfo, transparentCapture, watermarkCapture, watermarkInfo);
    if (dataUrl) {
      updateNodeData({
        resultUrl: dataUrl,
        imageUrl: dataUrl,
        output: dataUrl,
        prompt: cameraToPrompt(viewRef.current),
      } as Partial<Director3DParams> & Record<string, unknown>);
      window.setTimeout(() => syncDownstreamFromNode(id as string), 0);
      void persistGeneratedCanvasUrl({
        nodeId: id as string,
        kind: 'image',
        url: dataUrl,
        fileName: `3d-capture-${Date.now()}.png`,
        role: 'primary',
      })
        .then(async ({ asset }) => {
          const resolved = await resolveAssetUrl(asset.id).catch(() => null);
          updateNodeData({
            resultUrl: resolved || dataUrl,
            imageUrl: resolved || dataUrl,
            output: resolved || dataUrl,
            resultAssetId: asset.id,
          } as Partial<Director3DParams> & Record<string, unknown>);
          window.setTimeout(() => syncDownstreamFromNode(id as string), 0);
        })
        .catch((error) => {
          console.warn('[Director3DNode] 截图持久化失败，已保留 data URL:', error);
        });
      const link = document.createElement('a');
      link.download = `3d-capture-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
    setShowCaptureMenu(false);
  }, [id, transparentCapture, updateNodeData, watermarkCapture]);

  const handleUploadPanorama = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // 释放旧的 blob URL
      if (params.panoramaImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(params.panoramaImageUrl);
      }
      let url = URL.createObjectURL(file);
      let panoramaAssetId: string | undefined;
      updateNodeData({ panoramaImageUrl: url, panoramaAssetId: undefined });
      bridgeRef.current?.loadPanoramaImage(url);
      try {
        const persisted = await persistSceneImageFile(id as string, file, url);
        panoramaAssetId = persisted.assetId;
        if (persisted.url !== url && url.startsWith('blob:')) URL.revokeObjectURL(url);
        url = persisted.url;
        toast.success('全景图已保存到资产仓库');
      } catch (error) {
        console.warn('[Director3DNode] 全景图持久化失败，已使用临时 URL:', error);
        toast.warning('全景图暂未持久化，本次会话可用');
      }
      updateNodeData({ panoramaImageUrl: url, panoramaAssetId });
      bridgeRef.current?.loadPanoramaImage(url);
    };
    input.click();
  }, [id, params.panoramaImageUrl, updateNodeData]);

  const handleFocalLengthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = clampSceneFocalLength(Number(e.target.value));
    const newView = { ...viewRef.current, focalLength: fl };
    viewRef.current = newView;
    bridgeRef.current?.applySceneView(newView);
    updateNodeData({ view: newView });
  }, [updateNodeData]);

  const handleToggleGrid = useCallback(() => { setShowGridPanel((p) => !p); }, []);
  const handleApplyGrid = useCallback(() => {
    const newObjects: SceneObject3D[] = [];
    const existingMannequins = params.objects.filter((o) => o.type === 'mannequin').length;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const idx = existingMannequins + newObjects.length;
        const obj = createMannequin(selectedGender, 'gray', idx);
        obj.position = { x: (c - (gridCols - 1) / 2) * 1.5, y: 0, z: (r - (gridRows - 1) / 2) * 1.5 };
        newObjects.push(obj);
      }
    }
    updateNodeData({ objects: [...params.objects, ...newObjects] });
    setShowGridPanel(false);
  }, [gridRows, gridCols, selectedGender, params.objects, updateNodeData]);
  const handleToggleFullscreen = useCallback(() => { setIsFullscreen((p) => !p); }, []);
  const handleToggleExpanded = useCallback(() => { setIsExpanded((p) => !p); }, []);
  const handleToggleCollapse = useCallback(() => { setIsCollapsed((p) => !p); }, []);

  const handleToggleObjectSelect = useCallback((objId: string, additive: boolean) => {
    if (additive) {
      setSelectedObjectIds((prev) => {
        const next = prev.includes(objId) ? prev.filter((id) => id !== objId) : [...prev, objId];
        if (next.length === 1) {
          updateNodeData({ selectedObjectId: next[0], selectedObjectIds: next });
          bridgeRef.current?.setSelectedObject(next[0]);
        } else if (next.length === 0) {
          updateNodeData({ selectedObjectId: null, selectedObjectIds: next });
          bridgeRef.current?.setSelectedObject(null);
        } else {
          updateNodeData({ selectedObjectIds: next });
        }
        return next;
      });
    } else {
      setSelectedObjectIds([objId]);
      updateNodeData({ selectedObjectId: objId, selectedObjectIds: [objId] });
      bridgeRef.current?.setSelectedObject(objId);
    }
  }, [updateNodeData]);

  const handleAlign = useCallback((mode: AlignMode) => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const ids = selectedObjectIds.length >= 2 ? selectedObjectIds : (params.selectedObjectId ? [params.selectedObjectId] : []);
    if (ids.length < 2) return;
    bridge.alignObjects(ids, mode);
    // 从 bridge 读取对齐后的最新变换，再同步回节点数据
    const alignedObjects = bridge.getObjectsState();
    if (alignedObjects) {
      updateNodeData({ objects: alignedObjects });
      bridge.syncObjects(alignedObjects);
    } else {
      bridge.syncObjects(params.objects);
    }
  }, [selectedObjectIds, params.selectedObjectId, params.objects, updateNodeData]);

  const handleToggleObjectVisibility = useCallback((objId: string) => {
    const obj = params.objects.find((o) => o.id === objId);
    if (!obj) return;
    const newVisible = !(obj.visible !== false);
    const newObjects = params.objects.map((o) => o.id === objId ? { ...o, visible: newVisible } : o);
    updateNodeData({ objects: newObjects });
    bridgeRef.current?.setObjectVisibility(objId, newVisible);
  }, [params.objects, updateNodeData]);

  const handleToggleObjectLocked = useCallback((objId: string) => {
    const obj = params.objects.find((o) => o.id === objId);
    if (!obj) return;
    const newLocked = !obj.locked;
    const newObjects = params.objects.map((o) => o.id === objId ? { ...o, locked: newLocked } : o);
    updateNodeData({ objects: newObjects });
    bridgeRef.current?.setObjectLocked(objId, newLocked);
  }, [params.objects, updateNodeData]);

  const handleShowAllObjects = useCallback(() => {
    const newObjects = params.objects.map((o) => ({ ...o, visible: true }));
    updateNodeData({ objects: newObjects });
    for (const obj of newObjects) {
      bridgeRef.current?.setObjectVisibility(obj.id, true);
    }
  }, [params.objects, updateNodeData]);

  const handleHideAllObjects = useCallback(() => {
    const newObjects = params.objects.map((o) => ({ ...o, visible: false }));
    updateNodeData({ objects: newObjects });
    for (const obj of newObjects) {
      bridgeRef.current?.setObjectVisibility(obj.id, false);
    }
  }, [params.objects, updateNodeData]);

  useEffect(() => {
    if (!isEditing || !minimapCanvasRef.current) return;
    const canvas = minimapCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawMinimap = () => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      const data = bridge.getMinimapData(40);
      const w = canvas.width;
      const h = canvas.height;
      const half = data.worldExtent / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 6);
      ctx.fill();

      const worldToMinimap = (wx: number, wz: number) => ({
        x: ((wx + half) / data.worldExtent) * w,
        y: ((wz + half) / data.worldExtent) * h,
      });

      for (const obj of data.objects) {
        const { x, y } = worldToMinimap(obj.x2d, obj.z2d);
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const camPos = worldToMinimap(data.cameraX, data.cameraZ);
      const triSize = 7;
      ctx.save();
      ctx.translate(camPos.x, camPos.y);
      ctx.rotate(-data.cameraYaw);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(0, -triSize);
      ctx.lineTo(-triSize * 0.6, triSize * 0.5);
      ctx.lineTo(triSize * 0.6, triSize * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawMinimap();
    const interval = setInterval(drawMinimap, 200);
    return () => clearInterval(interval);
  }, [isEditing, params.objects]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapCanvasRef.current;
    const bridge = bridgeRef.current;
    if (!canvas || !bridge) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldExtent = 40;
    const half = worldExtent / 2;
    const worldX = (x / canvas.width) * worldExtent - half;
    const worldZ = (y / canvas.height) * worldExtent - half;
    const newView = {
      ...viewRef.current,
      target: { x: worldX, y: viewRef.current.target.y, z: worldZ },
    };
    viewRef.current = newView;
    bridge.startDampedViewTransition(newView);
    updateNodeData({ view: newView });
  }, [updateNodeData]);

  const closeAllPopovers = useCallback(() => {
    setShowMannequinMenu(false);
    setShowCameraDock(false);
    setShowCaptureMenu(false);
    setShowFocusMenu(false);
    setShowGridPanel(false);
    setShowLayerPanel(false);
    setShowHDRPanel(false);
    setShowTimeline(false);
  }, []);

  const handleExportScene = useCallback(() => {
    const exportData: Scene3DExport = {
      version: '2.0',
      name: `3D场景-${new Date().toLocaleDateString()}`,
      objects: params.objects,
      cameras: params.cameras,
      cameraPresets: params.cameraPresets,
      view: params.view,
      environment: params.environment,
      compositionGuide: params.compositionGuide,
      lightingPreset: params.lightingPreset,
      exposure: params.exposure,
      renderQuality: params.renderQuality,
      createdAt: Date.now(),
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `scene3d-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [params.objects, params.cameras, params.cameraPresets, params.view, params.environment, params.compositionGuide, params.lightingPreset, params.exposure, params.renderQuality]);

  const handleImportScene = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as Scene3DExport;
          if (!data.objects || !data.view) return;
          viewRef.current = { ...data.view, target: { ...data.view.target } };
          bridgeRef.current?.applySceneView(viewRef.current);
          bridgeRef.current?.syncObjects(data.objects);
          if (data.environment) bridgeRef.current?.applyEnvironment(data.environment);
          if (data.lightingPreset) bridgeRef.current?.setLightingPreset(data.lightingPreset);
          if (typeof data.exposure === 'number') bridgeRef.current?.setExposure(data.exposure);
          if (data.renderQuality) bridgeRef.current?.setRenderQuality(data.renderQuality);
          updateNodeData({
            objects: data.objects,
            cameras: data.cameras ?? [],
            cameraPresets: data.cameraPresets ?? [],
            view: { ...data.view, target: { ...data.view.target } },
            environment: data.environment ?? 'day',
            compositionGuide: data.compositionGuide ?? DEFAULT_DIRECTOR3D_PARAMS.compositionGuide,
            lightingPreset: data.lightingPreset ?? DEFAULT_DIRECTOR3D_PARAMS.lightingPreset,
            exposure: data.exposure ?? DEFAULT_DIRECTOR3D_PARAMS.exposure,
            renderQuality: data.renderQuality ?? DEFAULT_DIRECTOR3D_PARAMS.renderQuality,
          });
        } catch { /* ignore parse errors */ }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [updateNodeData]);

  const handleToggleTimeline = useCallback(() => { setShowTimeline((p) => !p); }, []);

  const handleAddKeyframe = useCallback(() => {
    const curTime = animationRef.current.currentTime;
    const targetId = params.selectedObjectId ?? 'camera';
    let values: { property: KeyframeProperty; value: number[] }[] = [];

    if (targetId === 'camera') {
      const v = viewRef.current;
      values = [{ property: 'view', value: [v.orbitYaw, v.orbitPitch, v.orbitDistance, v.focalLength, v.target.x, v.target.y, v.target.z] }];
    } else {
      const obj = params.objects.find((o) => o.id === targetId);
      if (obj) {
        values = [
          { property: 'position', value: [obj.position.x, obj.position.y, obj.position.z] },
          { property: 'rotation', value: [obj.rotation.x, obj.rotation.y, obj.rotation.z] },
          { property: 'scale', value: [obj.scale.x, obj.scale.y, obj.scale.z] },
        ];
      }
    }

    setAnimation((prev) => {
      const newTracks = [...prev.tracks];
      for (const v of values) {
        let track = newTracks.find((t) => t.objectId === targetId && t.property === v.property);
        if (!track) {
          track = { id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, objectId: targetId, property: v.property, keyframes: [] };
          newTracks.push(track);
        }
        const existingIdx = track.keyframes.findIndex((kf) => Math.abs(kf.time - curTime) < 0.01);
        const kf: Keyframe = { id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: curTime, value: v.value, easing: 'linear' };
        if (existingIdx >= 0) {
          track.keyframes[existingIdx] = kf;
        } else {
          track.keyframes.push(kf);
          track.keyframes.sort((a, b) => a.time - b.time);
        }
      }
      const updated = { ...prev, tracks: newTracks };
      animationRef.current = updated;
      return updated;
    });
  }, [params.selectedObjectId, params.objects]);

  const handleTogglePlay = useCallback(() => {
    setAnimation((prev) => {
      if (prev.tracks.length === 0) return prev;
      const willPlay = !prev.isPlaying;
      if (willPlay) {
        const startFrom = prev.currentTime >= prev.duration ? 0 : prev.currentTime;
        const updated = { ...prev, isPlaying: true, currentTime: startFrom };
        animationRef.current = updated;

        const intervalMs = 1000 / prev.fps;
        if (animationTimerRef.current) clearInterval(animationTimerRef.current);
        animationTimerRef.current = setInterval(() => {
          const state = animationRef.current;
          if (!state.isPlaying) return;
          let nextTime = state.currentTime + intervalMs / 1000;
          if (nextTime > state.duration) {
            nextTime = state.duration;
            animationRef.current = { ...state, isPlaying: false, currentTime: nextTime };
            setAnimation((a) => ({ ...a, isPlaying: false, currentTime: nextTime }));
            if (animationTimerRef.current) { clearInterval(animationTimerRef.current); animationTimerRef.current = null; }
            return;
          }

          for (const track of state.tracks) {
            if (track.keyframes.length < 2) continue;
            let prevKf = track.keyframes[0];
            let nextKf = track.keyframes[track.keyframes.length - 1];
            for (let i = 0; i < track.keyframes.length - 1; i++) {
              if (nextTime >= track.keyframes[i].time && nextTime <= track.keyframes[i + 1].time) {
                prevKf = track.keyframes[i];
                nextKf = track.keyframes[i + 1];
                break;
              }
            }
            if (nextTime < prevKf.time) { prevKf = nextKf; }
            if (nextTime > nextKf.time) { prevKf = nextKf; }

            const segDuration = Math.max(nextKf.time - prevKf.time, 0.001);
            const rawT = Math.max(0, Math.min(1, (nextTime - prevKf.time) / segDuration));
            let t = rawT;
            if (prevKf.easing === 'ease-in') t = rawT * rawT;
            else if (prevKf.easing === 'ease-out') t = rawT * (2 - rawT);
            else if (prevKf.easing === 'ease-in-out') t = rawT < 0.5 ? 2 * rawT * rawT : -1 + (4 - 2 * rawT) * rawT;

            const len = Math.min(prevKf.value.length, nextKf.value.length);
            const interpolated: number[] = [];
            for (let i = 0; i < len; i++) {
              interpolated.push(prevKf.value[i] + (nextKf.value[i] - prevKf.value[i]) * t);
            }

            if (track.objectId === 'camera' && track.property === 'view' && interpolated.length >= 7) {
              const newView: SceneView = {
                orbitYaw: interpolated[0], orbitPitch: interpolated[1], orbitDistance: interpolated[2],
                focalLength: interpolated[3], target: { x: interpolated[4], y: interpolated[5], z: interpolated[6] },
              };
              viewRef.current = newView;
              bridgeRef.current?.applySceneView(newView);
            } else if (track.objectId !== 'camera') {
              const bridge = bridgeRef.current;
              if (!bridge) continue;
              // 使用最新节点数据，避免 stale 闭包
              const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
              const currentObjects =
                ((currentNode?.data as Record<string, unknown> | undefined)?.params as Director3DParams | undefined)?.objects
                ?? objectsRef.current;
              const syncData = currentObjects.map((o) => {
                if (o.id !== track.objectId) return o;
                if (track.property === 'position' && interpolated.length >= 3) return { ...o, position: { x: interpolated[0], y: interpolated[1], z: interpolated[2] } };
                if (track.property === 'rotation' && interpolated.length >= 3) return { ...o, rotation: { x: interpolated[0], y: interpolated[1], z: interpolated[2] } };
                if (track.property === 'scale' && interpolated.length >= 3) return { ...o, scale: { x: interpolated[0], y: interpolated[1], z: interpolated[2] } };
                return o;
              });
              bridge.syncObjects(syncData);
            }
          }

          animationRef.current = { ...state, currentTime: nextTime };
          setAnimation((a) => ({ ...a, currentTime: nextTime }));
        }, intervalMs);

        return updated;
      } else {
        if (animationTimerRef.current) { clearInterval(animationTimerRef.current); animationTimerRef.current = null; }
        const updated = { ...prev, isPlaying: false };
        animationRef.current = updated;
        return updated;
      }
    });
  }, [id]);

  const handleTimelineSeek = useCallback((time: number) => {
    setAnimation((prev) => {
      const updated = { ...prev, currentTime: time };
      animationRef.current = updated;
      return updated;
    });
  }, []);

  const handleDeleteKeyframe = useCallback((trackId: string, keyframeId: string) => {
    setAnimation((prev) => {
      const newTracks = prev.tracks.map((track) => {
        if (track.id !== trackId) return track;
        const filtered = track.keyframes.filter((kf) => kf.id !== keyframeId);
        if (filtered.length === 0) return null;
        return { ...track, keyframes: filtered };
      }).filter((t): t is KeyframeTrack => t !== null);
      const updated = { ...prev, tracks: newTracks };
      animationRef.current = updated;
      return updated;
    });
  }, []);

  const handleDurationChange = useCallback((newDuration: number) => {
    setAnimation((prev) => {
      const updated = { ...prev, duration: Math.max(0.5, newDuration) };
      animationRef.current = updated;
      return updated;
    });
  }, []);

  const handleKeyframeEasingChange = useCallback((trackId: string, keyframeId: string, easing: EasingType) => {
    setAnimation((prev) => {
      const newTracks = prev.tracks.map((track) => {
        if (track.id !== trackId) return track;
        return {
          ...track,
          keyframes: track.keyframes.map((kf) =>
            kf.id === keyframeId ? { ...kf, easing } : kf
          ),
        };
      });
      const updated = { ...prev, tracks: newTracks };
      animationRef.current = updated;
      return updated;
    });
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  const visibleObjectCount = params.objects.filter((o) => o.visible !== false).length;
  const lockedObjectCount = params.objects.filter((o) => o.locked === true).length;
  const sceneReadiness = params.objects.length === 0 ? '空场景' : isEditing ? '编辑中' : '预览中';
  const sceneControllerPreset = getNodeControllerPreset('scene3d');
  const captureSceneForDownstream = useCallback(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return '';
    const aspectInfo = CAPTURE_ASPECTS.find((a) => a.key === '16:9') ?? CAPTURE_ASPECTS[0];
    const dataUrl = bridge.captureViewport(aspectInfo, transparentCapture, false);
    if (dataUrl) {
      updateNodeData({
        resultUrl: dataUrl,
        imageUrl: dataUrl,
        output: dataUrl,
        prompt: cameraToPrompt(viewRef.current),
      } as Partial<Director3DParams> & Record<string, unknown>);
    }
    return dataUrl || '';
  }, [transparentCapture, updateNodeData]);
  const runSceneDownstreamAction = useCallback(
    (actionId: string, replaceExisting = false) => {
      const prompt = cameraToPrompt(viewRef.current);
      const sceneImageUrl = captureSceneForDownstream();

      if (actionId === 'scene-to-image') {
        spawnControllerToolNode(id as string, 'aiImage', {
          controllerActionId: actionId,
          replaceExisting,
          label: '3D 截图生图',
          toastLabel: '3D 截图生图',
          sourceHandle: 'output',
          targetHandle: 'input',
          initialData: {
            imageUrl: sceneImageUrl,
            prompt,
            params: {
              mode: sceneImageUrl ? 'image_to_image' : 'generate',
              prompt,
            },
          },
        });
        return;
      }

      if (actionId === 'scene-to-video') {
        spawnControllerToolNode(id as string, 'aiVideo', {
          controllerActionId: actionId,
          replaceExisting,
          label: '3D 镜头生视频',
          toastLabel: '3D 镜头生视频',
          sourceHandle: 'output',
          targetHandle: 'input',
          initialData: {
            imageUrl: sceneImageUrl,
            params: {
              generationMode: sceneImageUrl ? 'image_to_video' : 'text_to_video',
              startImage: sceneImageUrl,
              prompt,
            },
          },
        });
        return;
      }

      if (actionId === 'scene-to-panorama') {
        spawnControllerToolNode(id as string, 'panorama360', {
          controllerActionId: actionId,
          replaceExisting,
          label: '3D 全景预览',
          toastLabel: '3D 全景预览',
          sourceHandle: 'output',
          targetHandle: 'input',
          initialData: {
            params: {
              panoramaImageUrl: params.panoramaImageUrl || sceneImageUrl,
              prompt,
              autoRotate: true,
            },
          },
        });
        return;
      }

      if (actionId === 'scene-prompt') {
        updateNodeData({ prompt } as Partial<Director3DParams> & Record<string, unknown>);
        spawnControllerToolNode(id as string, 'prompt', {
          controllerActionId: actionId,
          replaceExisting,
          label: '3D 镜头提示词',
          toastLabel: '3D 镜头提示词',
          sourceHandle: 'prompt',
          targetHandle: 'input',
          initialData: {
            prompt,
            text: prompt,
            content: prompt,
          },
        });
      }
    },
    [captureSceneForDownstream, id, params.panoramaImageUrl, updateNodeData],
  );
  const sceneDownstreamActions = useMemo<NodeControllerAction[]>(
    () => [
      ...[
        { id: 'scene-to-image', label: '截图生图', icon: 'image' as const, nodeType: 'aiImage' },
        { id: 'scene-to-video', label: '镜头视频', icon: 'video' as const, nodeType: 'aiVideo' },
        { id: 'scene-to-panorama', label: '全景预览', icon: 'panorama' as const, nodeType: 'panorama360' },
        { id: 'scene-prompt', label: '提示词', icon: 'sparkles' as const, nodeType: 'prompt' },
      ].map((entry) => withControllerActionConnection({
        sourceNodeId: id as string,
        action: {
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          disabled: params.objects.length === 0 && entry.id !== 'scene-prompt',
          onClick: () => runSceneDownstreamAction(entry.id),
        },
        binding: {
          actionId: entry.id,
          nodeType: entry.nodeType,
          onReplace: () => runSceneDownstreamAction(entry.id, true),
        },
      })),
    ],
    [id, params.objects.length, runSceneDownstreamAction],
  );
  const sceneActions: NodeControllerAction[] = [
    {
      id: 'starter-scene',
      label: '快速搭景',
      icon: 'sparkles',
      tone: 'primary',
      onClick: handleCreateStarterScene,
      title: '创建基础 3D 场景',
    },
    {
      id: 'capture',
      label: '截图',
      icon: 'camera',
      onClick: () => handleCapture('16:9'),
      title: '按 16:9 截取当前视角',
    },
    {
      id: 'import-model',
      label: '导入模型',
      icon: 'model3d',
      onClick: handleImportModel,
      title: '导入 GLB/GLTF/OBJ 模型',
    },
    {
      id: 'export-scene',
      label: '导出场景',
      icon: 'export',
      disabled: params.objects.length === 0,
      onClick: handleExportScene,
      title: '导出当前 3D 场景 JSON',
    },
    {
      id: 'panorama',
      label: '全景输入',
      icon: 'panorama',
      onClick: handleUploadPanorama,
      state: params.panoramaImageUrl ? 'connected' : 'idle',
      connectedLabel: params.panoramaImageUrl ? '已载入' : undefined,
      title: '上传全景参考图',
    },
    {
      id: 'timeline',
      label: '时间线',
      icon: 'video',
      onClick: handleToggleTimeline,
      state: showTimeline ? 'ready' : 'idle',
      title: '打开或收起 3D 时间线',
    },
  ];

  const env = params.environment;
  const isNight = env === 'night';
  const theme = isNight ? TOOLBAR_THEME.night : TOOLBAR_THEME.day;
  const editTheme = TOOLBAR_THEME.editMode;
  const overlay = isNight ? VIEWPORT_OVERLAY.night : VIEWPORT_OVERLAY.day;

  const nodeWidth = isCollapsed ? PANORAMA_SCENE_COLLAPSED_MAX_SIZE : isExpanded ? 1020 : PANORAMA_SCENE_DEFAULT_SIZE.width;
  const nodeHeight = isCollapsed ? 160 : isExpanded ? 574 : PANORAMA_SCENE_DEFAULT_SIZE.height;

  const topBtnBase = 'ftb-btn w-[40px] min-w-[40px] h-[40px] flex items-center justify-center border-none bg-transparent cursor-pointer';
  const topBtnOpacity = 'opacity-78 hover:opacity-100 transition-[opacity] duration-[0.16s] ease';
  const bottomBtnBase = 'w-[40px] min-w-[40px] h-[40px] flex items-center justify-center border-none bg-transparent cursor-pointer';
  const bottomBtnOpacity = 'opacity-78 hover:opacity-100 transition-[opacity,background,color] duration-[0.16s] ease';

  return (
    <div
      className={cn('group relative', isFullscreen && 'fixed inset-3 z-[6000] rounded-[18px] shadow-2xl')}
      style={{ width: nodeWidth }}
      data-testid="director3d-node"
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="director3D"
        inputTip="参考图/全景图"
        outputTip="输出"
        extraOutputs={['prompt']}
      />

      <AICGNodeShell
        aicgType="tool"
        title="3D 导演"
        selected={selected}
        width={nodeWidth}
        onDelete={() => canvasStoreApi.deleteNode(id as string)}
        bodyClassName="p-0 relative overflow-hidden"
      >
      <div
        className="relative overflow-hidden"
        style={{ width: '100%', height: nodeHeight, transition: 'height 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ background: isNight ? 'linear-gradient(180deg, #575c64 0%, #4b5058 24%, #3f4349 60%, #32353a 100%)' : 'linear-gradient(180deg, #e6ebf2 0%, #d9dfe7 24%, #c7cdd6 60%, #b9bfc8 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: isNight ? 'inset 0 0 0 1px rgba(255,255,255,0.05)' : overlay.shadow }}
        >
        <div
          ref={viewportRef}
          className="absolute inset-0"
          data-testid="director3d-viewport"
          onMouseDown={handleViewportMouseDown}
          onMouseMove={handleViewportMouseMove}
          onMouseUp={handleViewportMouseUp}
          onMouseLeave={handleViewportMouseUp}
          onWheel={handleWheel}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isCollapsed) handleEnterEdit();
          }}
          style={{ cursor: isDragging.current ? 'grabbing' : 'grab', zIndex: 1 }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlay.overlay, zIndex: 0 }}
        />
        </div>

        {params.compositionGuide !== 'off' && !isCollapsed && (
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            data-testid={`director3d-guide-${params.compositionGuide}`}
            style={{ color: '#fff', mixBlendMode: 'difference', opacity: 0.52 }}
          >
            {params.compositionGuide === 'thirds' && (
              <>
                {[33.333, 66.666].map((position) => (
                  <div key={`v-${position}`} className="absolute top-0 bottom-0 w-px bg-current" style={{ left: `${position}%` }} />
                ))}
                {[33.333, 66.666].map((position) => (
                  <div key={`h-${position}`} className="absolute left-0 right-0 h-px bg-current" style={{ top: `${position}%` }} />
                ))}
              </>
            )}
            {params.compositionGuide === 'safe' && (
              <>
                <div className="absolute border border-current" style={{ inset: '5%' }} />
                <div className="absolute border border-current" style={{ inset: '10%', opacity: 0.72 }} />
              </>
            )}
            {params.compositionGuide === 'center' && (
              <>
                <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-current" />
                <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-current" />
                <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-current" />
              </>
            )}
          </div>
        )}

      {isCollapsed && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 rounded-[18px] cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.34)' }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleToggleCollapse();
          }}
        >
          <div className="flex flex-col items-center gap-1 text-white">
            <span className="text-sm font-semibold">3D 导演台</span>
            <span className="text-[10px] opacity-60">{params.objects.length} 个物体 · 双击展开</span>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <>
          {!isEditing ? (
            <div
              className="nodrag nowheel absolute top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-[14px] z-20"
              style={{ background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow, color: theme.fg, transition: 'opacity 0.18s ease' }}
            >
              <button className={cn(topBtnBase, topBtnOpacity)} onClick={handleEnterEdit} title="编辑">{SVG.edit}</button>
              <button className={cn(topBtnBase, topBtnOpacity)} onClick={handleToggleExpanded} title={isExpanded ? '还原尺寸' : '扩大画布'}>{SVG.fullscreen}</button>
              <button className={cn(topBtnBase, topBtnOpacity)} onClick={handleToggleFullscreen} title="全屏显示">{SVG.fullscreen}</button>
              <button className={cn(topBtnBase, topBtnOpacity, 'ml-0.5')} onClick={handleToggleCollapse} title="折叠">
                <span style={{ transition: 'transform 0.26s cubic-bezier(0.34,1.56,0.64,1)', display: 'inline-flex', transform: isCollapsed ? 'rotate(180deg)' : undefined }}>{SVG.collapse}</span>
              </button>
            </div>
          ) : (
            <div
              className="nodrag nowheel absolute top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-[14px] z-20"
              style={{ background: editTheme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${editTheme.border}`, boxShadow: editTheme.shadow, color: editTheme.weakFg, transition: 'opacity 0.18s ease' }}
            >
              <button className={cn(topBtnBase)} onClick={handleExitEdit} title="关闭编辑" style={{ color: '#ef4444' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,100,100,0.5)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >{SVG.close}</button>
              <div className="w-px h-6 mx-0.5" style={{ background: editTheme.border }} />
              {(['navigate', 'move', 'scale', 'rotate'] as Scene3DTool[]).map((tool) => (
                <button
                  key={tool}
                  className={cn(topBtnBase, params.tool === tool ? 'opacity-100' : 'opacity-78 hover:opacity-100', 'transition-[opacity] duration-[0.16s] ease')}
                  style={params.tool === tool ? { color: editTheme.fg } : undefined}
                  onClick={() => handleToolChange(tool)}
                  title={{ navigate: '选择/环视 (A / Q)', move: '移动 (G / W)', scale: '缩放 (S)', rotate: '旋转 (R / E)' }[tool]}
                >
                  {{ navigate: SVG.navigate, move: SVG.move, scale: SVG.scale, rotate: SVG.rotate }[tool]}
                </button>
              ))}
              <div className="w-px h-6 mx-0.5" style={{ background: editTheme.border }} />
              <button className={cn(topBtnBase, topBtnOpacity)} onClick={handleToggleExpanded} title={isExpanded ? '还原尺寸' : '扩大画布'}>{SVG.fullscreen}</button>
              <button className={cn(topBtnBase, topBtnOpacity)} onClick={handleToggleFullscreen} title="全屏显示">{SVG.fullscreen}</button>
              <button className={cn(topBtnBase, topBtnOpacity, 'ml-0.5')} onClick={handleToggleCollapse} title="折叠">
                <span style={{ transition: 'transform 0.26s cubic-bezier(0.34,1.56,0.64,1)', display: 'inline-flex', transform: isCollapsed ? 'rotate(180deg)' : undefined }}>{SVG.collapse}</span>
              </button>
            </div>
          )}

          <div
            className="nodrag nowheel absolute top-3.5 right-3.5 z-20 rounded-[12px] p-1 flex flex-col gap-0.5"
            style={{ background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow, color: theme.fg }}
          >
            <button
              className={cn(topBtnBase, topBtnOpacity, isNight && 'opacity-100')}
              onClick={handleEnvToggle}
              title={isNight ? '切换到日景' : '切换到夜景'}
            >
              {SVG.moon}
            </button>
            {isEditing && (
              <>
                <button
                  className={cn(topBtnBase, topBtnOpacity, showHDRPanel && 'opacity-100')}
                  onClick={() => { setShowHDRPanel((p) => !p); setShowCameraLab(false); }}
                  title="环境HDR"
                >
                  {SVG.hdr}
                </button>
                <button
                  className={cn(topBtnBase, topBtnOpacity, showCameraLab && 'opacity-100')}
                  onClick={() => { setShowCameraLab((p) => !p); setShowHDRPanel(false); }}
                  title="摄影控制"
                  data-testid="director3d-camera-lab-toggle"
                >
                  {SVG.cameraLab}
                </button>
              </>
            )}
          </div>

          <div className="nodrag nowheel absolute left-3.5 top-3.5 z-20 flex flex-col gap-1" style={{ color: theme.fg }}>
            <div
              className="flex items-center gap-1.5 rounded-[12px] px-2.5 py-1.5"
              style={{ background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: isEditing ? '#22c55e' : '#94a3b8' }} />
              <span className="text-[10px] font-semibold">{sceneReadiness}</span>
              <span className="text-[10px] opacity-50">{visibleObjectCount}/{params.objects.length} 可见</span>
            </div>
            {isEditing && params.objects.length > 0 && (
              <div
                className="flex items-center gap-1 rounded-[12px] px-2.5 py-1 text-[10px]"
                style={{ background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}
              >
                <span className="opacity-55">机位 {params.cameras.length}/{PANORAMA_SCENE_CAMERA_LIMIT}</span>
                <span className="opacity-35">·</span>
                <span className="opacity-55">锁定 {lockedObjectCount}</span>
              </div>
            )}
            {isEditing && params.showDiagnostics && diagnostics && (
              <div
                className="grid grid-cols-4 gap-x-2 rounded-[12px] px-2.5 py-1.5 text-[9px] tabular-nums"
                style={{ background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}
                data-testid="director3d-diagnostics"
              >
                <span title="Draw calls">DC {diagnostics.drawCalls}</span>
                <span title="Triangles">TRI {compactMetric(diagnostics.triangles)}</span>
                <span title="Textures">TEX {diagnostics.textures}</span>
                <span title="Device pixel ratio">DPR {diagnostics.pixelRatio.toFixed(1)}</span>
              </div>
            )}
          </div>

          {params.objects.length === 0 && !isCollapsed && (
            <div className="nodrag nowheel absolute inset-x-8 top-1/2 z-20 -translate-y-1/2 rounded-[22px] p-4 text-white" style={{ background: 'rgba(18,19,22,0.92)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 18px 48px rgba(0,0,0,0.35)', backdropFilter: 'blur(16px)' }}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold">搭建你的第一个 3D 镜头</div>
                  <div className="mt-1 text-[10px] leading-4 text-white/55">推荐先创建角色与道具，再保存机位、生成提示词或导出分镜截图。</div>
                </div>
                <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 text-[10px] text-white/70">Studio</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" data-testid="director3d-starter-scene" onClick={handleCreateStarterScene} className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-left text-[11px] transition hover:bg-white/[0.13]">
                  <span className="block font-semibold">快速搭景</span>
                  <span className="mt-0.5 block text-[10px] text-white/50">自动放入双人场景与机位</span>
                </button>
                <button type="button" onClick={() => { setIsEditing(true); setShowMannequinMenu(true); }} className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-left text-[11px] transition hover:bg-white/[0.13]">
                  <span className="block font-semibold">添加角色</span>
                  <span className="mt-0.5 block text-[10px] text-white/50">选择性别与颜色</span>
                </button>
                <button type="button" onClick={handleImportModel} className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-left text-[11px] transition hover:bg-white/[0.13]">
                  <span className="block font-semibold">导入模型</span>
                  <span className="mt-0.5 block text-[10px] text-white/50">支持 GLB / GLTF</span>
                </button>
                <button type="button" onClick={() => { setIsEditing(true); setShowGridPanel(true); }} className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-left text-[11px] transition hover:bg-white/[0.13]">
                  <span className="block font-semibold">矩阵排布</span>
                  <span className="mt-0.5 block text-[10px] text-white/50">批量创建站位</span>
                </button>
              </div>
            </div>
          )}

          {isEditing && showHDRPanel && (
            <div
              className="absolute right-3.5 z-30"
              style={{ top: '110px', background: theme.menuBg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, borderRadius: 16, boxShadow: theme.shadow, color: theme.fg, width: 200, padding: 10, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, opacity: 1, transition: 'opacity 0.18s ease' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>环境HDR贴图</div>
              <button
                onClick={handleUploadHDR}
                style={{ width: '100%', height: 30, borderRadius: 10, border: 'none', background: 'rgba(59,130,246,0.15)', color: 'inherit', fontSize: 11, cursor: 'pointer', opacity: 0.76, transition: 'opacity 0.16s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.76'; }}
              >
                上传HDR/图片文件
              </button>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
                  <span style={{ opacity: 0.6 }}>强度</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.78 }}>{hdrIntensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={hdrIntensity}
                  onChange={handleHDRIntensityChange}
                  className="w-full h-1 accent-white"
                />
              </div>
              {params.environmentHDRUrl && (
                <button
                  onClick={handleRemoveHDR}
                  style={{ width: '100%', height: 28, borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, cursor: 'pointer', opacity: 0.76, transition: 'opacity 0.16s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.76'; }}
                >
                  移除HDR
                </button>
              )}
            </div>
          )}

          {isEditing && showCameraLab && (
            <div
              className="nodrag nowheel absolute right-3.5 z-30 flex flex-col overflow-hidden rounded-[14px]"
              data-testid="director3d-camera-lab"
              style={{
                top: 158,
                width: 252,
                maxHeight: Math.max(300, nodeHeight - 176),
                background: theme.menuBg,
                backdropFilter: 'blur(12px)',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
                color: theme.fg,
              }}
            >
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <div>
                  <div className="text-[11px] font-semibold">摄影控制</div>
                  <div className="mt-0.5 text-[9px] opacity-50">ACES · 三点布光 · 按需渲染</div>
                </div>
                <button
                  className="flex h-6 w-6 items-center justify-center border-none bg-transparent opacity-60 hover:opacity-100"
                  style={{ color: 'inherit' }}
                  onClick={() => setShowCameraLab(false)}
                  title="关闭"
                >
                  {SVG.close}
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2.5">
                <div>
                  <div className="mb-1.5 text-[9px] font-semibold opacity-55">构图辅助</div>
                  <div className="grid grid-cols-4 gap-1">
                    {([
                      ['off', '关闭'],
                      ['thirds', '三分'],
                      ['safe', '安全框'],
                      ['center', '中心'],
                    ] as [CompositionGuide, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        className="h-7 rounded-[6px] border text-[9px] transition-colors"
                        style={{
                          color: 'inherit',
                          borderColor: params.compositionGuide === value ? 'rgba(59,130,246,0.68)' : theme.border,
                          background: params.compositionGuide === value ? 'rgba(59,130,246,0.18)' : 'transparent',
                        }}
                        onClick={() => updateNodeData({ compositionGuide: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold">
                    <span className="opacity-55">曝光</span>
                    <span className="tabular-nums opacity-75">{params.exposure.toFixed(2)} EV</span>
                  </div>
                  <input
                    type="range"
                    min={RENDER_CONSTRAINTS.exposure.min}
                    max={RENDER_CONSTRAINTS.exposure.max}
                    step={0.05}
                    value={params.exposure}
                    onChange={(e) => updateNodeData({ exposure: Number(e.target.value) })}
                    className="h-1 w-full accent-blue-500"
                    aria-label="曝光"
                  />
                </div>

                <div>
                  <div className="mb-1.5 text-[9px] font-semibold opacity-55">三点布光</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(Object.entries(LIGHTING_PRESETS) as [LightingPreset, (typeof LIGHTING_PRESETS)[LightingPreset]][]).map(([value, preset]) => (
                      <button
                        key={value}
                        className="h-7 rounded-[6px] border text-[9px] transition-colors"
                        style={{
                          color: 'inherit',
                          borderColor: params.lightingPreset === value ? 'rgba(245,158,11,0.72)' : theme.border,
                          background: params.lightingPreset === value ? 'rgba(245,158,11,0.16)' : 'transparent',
                        }}
                        onClick={() => updateNodeData({ lightingPreset: value })}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[9px] font-semibold opacity-55">渲染质量</div>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ['auto', '自动'],
                      ['performance', '流畅'],
                      ['quality', '精细'],
                    ] as [RenderQuality, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        className="h-7 rounded-[6px] border text-[9px] transition-colors"
                        style={{
                          color: 'inherit',
                          borderColor: params.renderQuality === value ? 'rgba(34,197,94,0.68)' : theme.border,
                          background: params.renderQuality === value ? 'rgba(34,197,94,0.15)' : 'transparent',
                        }}
                        onClick={() => updateNodeData({ renderQuality: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between border-t pt-2 text-[9px]" style={{ borderColor: theme.border }}>
                  <span>
                    <span className="block font-semibold">场景诊断</span>
                    <span className="mt-0.5 block opacity-45">
                      {diagnostics ? `${diagnostics.drawCalls} DC · ${compactMetric(diagnostics.triangles)} TRI · DPR ${diagnostics.pixelRatio.toFixed(1)}` : '读取渲染统计'}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={params.showDiagnostics}
                    onChange={(e) => updateNodeData({ showDiagnostics: e.target.checked })}
                    className="accent-blue-500"
                  />
                </label>
              </div>
            </div>
          )}

          {isEditing && showTimeline && (
            <div
              className="absolute left-1/2 -translate-x-1/2 z-30 rounded-[14px] flex flex-col"
              style={{ bottom: 60, background: editTheme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${editTheme.border}`, boxShadow: editTheme.shadow, color: editTheme.fg, width: Math.min(480, nodeWidth - 32), maxHeight: 220, overflow: 'hidden' }}
            >
              <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: `1px solid ${editTheme.border}` }}>
                <button
                  className="w-[28px] h-[28px] flex items-center justify-center border-none bg-transparent cursor-pointer rounded-[6px] transition-[background,opacity] duration-[0.16s] ease opacity-80 hover:opacity-100"
                  style={{ color: 'inherit', background: animation.isPlaying ? 'rgba(59,130,246,0.2)' : 'transparent' }}
                  onClick={handleTogglePlay}
                  title={animation.isPlaying ? '暂停' : '播放'}
                >
                  {animation.isPlaying ? SVG.pause : SVG.play}
                </button>
                <button
                  className="w-[28px] h-[28px] flex items-center justify-center border-none bg-transparent cursor-pointer rounded-[6px] transition-[background,opacity] duration-[0.16s] ease opacity-80 hover:opacity-100"
                  style={{ color: 'inherit' }}
                  onClick={handleAddKeyframe}
                  title="添加关键帧"
                >
                  {SVG.keyframe}
                </button>
                <div className="flex-1 flex items-center gap-2 px-1">
                  <input
                    type="range"
                    min={0}
                    max={animation.duration}
                    step={0.01}
                    value={animation.currentTime}
                    onChange={(e) => handleTimelineSeek(Number(e.target.value))}
                    className="flex-1 h-1 accent-white"
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <span className="text-[10px] tabular-nums opacity-70 whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'center' }}>
                  {animation.currentTime.toFixed(1)}s / {animation.duration.toFixed(1)}s
                </span>
                <div className="flex items-center gap-1" style={{ fontSize: 10 }}>
                  <span className="opacity-50">时长</span>
                  <input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={animation.duration}
                    onChange={(e) => handleDurationChange(Number(e.target.value))}
                    className="w-[36px] h-[20px] rounded-[4px] border px-1 text-[10px] text-center outline-none"
                    style={{ borderColor: editTheme.border, background: 'transparent', color: 'inherit' }}
                  />
                  <span className="opacity-50">s</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-1.5" style={{ maxHeight: 160 }}>
                {animation.tracks.length === 0 && (
                  <div className="text-[10px] opacity-40 text-center py-3">
                    暂无关键帧 — 选中物体后点击添加关键帧按钮
                  </div>
                )}
                {animation.tracks.map((track) => (
                  <div key={track.id} className="mb-1.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] opacity-50">
                        {track.objectId === 'camera' ? '📷 相机' : (params.objects.find((o) => o.id === track.objectId)?.name ?? track.objectId)}
                      </span>
                      <span className="text-[9px] opacity-40">
                        · {track.property === 'position' ? '位置' : track.property === 'rotation' ? '旋转' : track.property === 'scale' ? '缩放' : '视角'}
                      </span>
                    </div>
                    <div className="relative h-[18px] rounded-[4px]" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      {track.keyframes.map((kf) => {
                        const leftPct = (kf.time / animation.duration) * 100;
                        return (
                          <div
                            key={kf.id}
                            className="absolute top-0 h-full flex items-center group"
                            style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
                          >
                            <div
                              className="w-[8px] h-[8px] rotate-45 rounded-[1px] cursor-pointer transition-[transform,background] duration-[0.12s] ease"
                              style={{ background: '#3b82f6', transform: 'rotate(45deg) scale(1)', boxShadow: '0 0 4px rgba(59,130,246,0.4)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(45deg) scale(1.3)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotate(45deg) scale(1)'; }}
                              onClick={() => handleTimelineSeek(kf.time)}
                              title={`${kf.time.toFixed(2)}s · ${kf.easing}`}
                            />
                            <div
                              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:flex flex-col gap-0.5 rounded-[6px] p-1.5 z-10"
                              style={{ background: editTheme.menuBg, border: `1px solid ${editTheme.border}`, boxShadow: editTheme.shadow, minWidth: 80, fontSize: 9 }}
                            >
                              <span className="opacity-60 text-center">{kf.time.toFixed(2)}s</span>
                              <select
                                value={kf.easing}
                                onChange={(e) => handleKeyframeEasingChange(track.id, kf.id, e.target.value as EasingType)}
                                className="h-[18px] rounded-[3px] border px-1 text-[9px] outline-none"
                                style={{ borderColor: editTheme.border, background: 'transparent', color: 'inherit' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="linear">线性</option>
                                <option value="ease-in">缓入</option>
                                <option value="ease-out">缓出</option>
                                <option value="ease-in-out">缓入缓出</option>
                              </select>
                              <button
                                className="h-[18px] rounded-[3px] border-none cursor-pointer text-[9px] hover:bg-red-500/20 transition-[background] duration-[0.12s] ease"
                                style={{ color: '#ef4444' }}
                                onClick={(e) => { e.stopPropagation(); handleDeleteKeyframe(track.id, kf.id); }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div
                        className="absolute top-0 h-full w-[1px]"
                        style={{ left: `${(animation.currentTime / animation.duration) * 100}%`, background: '#f59e0b', opacity: 0.8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEditing && (
            <div className="nodrag nowheel absolute left-1/2 bottom-3.5 -translate-x-1/2 z-20" style={{ pointerEvents: 'none' }}>
              <div
                className="flex items-center gap-1 px-1 py-1 rounded-[16px]"
                style={{ background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow, color: theme.fg, pointerEvents: 'auto', transition: 'opacity 0.18s ease' }}
              >
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleCreateStarterScene} title="快速搭景">{SVG.keyframe}</button>
                <div className="w-px h-6" style={{ background: theme.border }} />
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleUndo} title="撤销 (Ctrl+Z)" style={{ opacity: canUndo ? undefined : 0.3, pointerEvents: canUndo ? undefined : 'none' }}>{SVG.undo}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleRedo} title="重做 (Ctrl+Shift+Z)" style={{ opacity: canRedo ? undefined : 0.3, pointerEvents: canRedo ? undefined : 'none' }}>{SVG.redo}</button>
                <div className="w-px h-6" style={{ background: theme.border }} />
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleResetView} title="重置视角">{SVG.reset}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity, showMannequinMenu && 'opacity-100')} onClick={() => { setShowMannequinMenu(!showMannequinMenu); setShowCameraDock(false); setShowCaptureMenu(false); setShowFocusMenu(false); setShowGridPanel(false); }} title="人偶">{SVG.mannequin}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity, showGridPanel && 'opacity-100')} onClick={() => { setShowGridPanel(!showGridPanel); setShowMannequinMenu(false); setShowCameraDock(false); setShowCaptureMenu(false); setShowFocusMenu(false); }} title="矩形排列">{SVG.grid}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity, showCaptureMenu && 'opacity-100')} onClick={() => { setShowCaptureMenu(!showCaptureMenu); setShowMannequinMenu(false); setShowCameraDock(false); setShowFocusMenu(false); setShowGridPanel(false); }} title="截图">{SVG.capture}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity, params.cameras.length >= PANORAMA_SCENE_CAMERA_LIMIT && 'opacity-32 pointer-events-none')} onClick={handleAddCamera} title="创建机位书签">{SVG.camera}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity, showFocusMenu && 'opacity-100')} onClick={() => { closeAllPopovers(); setShowFocusMenu(!showFocusMenu); }} title="焦距">{SVG.focus}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleAddCube} title="创建方块">{SVG.cube}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleImportModel} title="导入模型">{SVG.model3d}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity, showLayerPanel && 'opacity-100')} onClick={() => { closeAllPopovers(); setShowLayerPanel(!showLayerPanel); }} title="层级管理">{SVG.layers}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity, showTimeline && 'opacity-100')} onClick={handleToggleTimeline} title="时间线">{SVG.timeline}</button>
                <div className="w-px h-6" style={{ background: theme.border }} />
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleExportScene} title="导出场景">{SVG.download}</button>
                <button className={cn(bottomBtnBase, bottomBtnOpacity)} onClick={handleImportScene} title="导入场景">{SVG.fileImport}</button>
              </div>
            </div>
          )}

          {isEditing && showMannequinMenu && (
            <div
              className="absolute left-1/2 z-30"
              style={{ bottom: '60px', transform: 'translateX(-50%)', background: theme.menuBg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, borderRadius: 16, boxShadow: theme.shadow, color: theme.fg, width: 320, height: 66, padding: 10, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', opacity: 1, transition: 'opacity 0.18s ease' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flex: '0 0 auto' }}>创建人偶</span>
              <div className="flex items-center gap-1.5" style={{ flex: '0 0 auto' }}>
                <button
                  className={cn('w-[26px] h-[26px] rounded-full border-none bg-transparent flex items-center justify-center cursor-pointer transition-[opacity,filter] duration-[0.16s] ease', selectedGender === 'male' ? 'opacity-100' : 'opacity-42 hover:opacity-72')}
                  style={selectedGender === 'male' ? { filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.2))' } : undefined}
                  onClick={() => setSelectedGender('male')}
                  title="设置男性人偶"
                >
                  {SVG.male}
                </button>
                <button
                  className={cn('w-[26px] h-[26px] rounded-full border-none bg-transparent flex items-center justify-center cursor-pointer transition-[opacity,filter] duration-[0.16s] ease', selectedGender === 'female' ? 'opacity-100' : 'opacity-42 hover:opacity-72')}
                  style={selectedGender === 'female' ? { filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.2))' } : undefined}
                  onClick={() => setSelectedGender('female')}
                  title="设置女性人偶"
                >
                  {SVG.female}
                </button>
              </div>
              <div className="flex items-center gap-1.5" style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', flexWrap: 'nowrap' }}>
                {MANNEQUIN_QUICK_COLORS.map((ck) => (
                  <button
                    key={ck}
                    className="w-[26px] h-[26px] rounded-full border-none bg-transparent relative outline-none cursor-pointer opacity-52 hover:opacity-82 transition-[opacity,filter] duration-[0.16s] ease"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.15))' }}
                    onClick={() => handleMannequinColorClick(ck)}
                    title={`创建${MANNEQUIN_COLORS[ck].name}人偶`}
                  >
                    <span className="absolute rounded-full" style={{ inset: 4, background: ck === 'yellow' ? 'gold' : MANNEQUIN_COLORS[ck].hex }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEditing && showCameraDock && params.cameras.length > 0 && (
            <div
              className="absolute left-1/2 z-30"
              style={{ bottom: '96px', transform: 'translateX(-50%)', background: theme.menuBg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, borderRadius: 14, boxShadow: theme.shadow, color: theme.fg, display: 'flex', alignItems: 'center', gap: 6, padding: 6, width: 'max-content', height: 46, boxSizing: 'border-box', overflowX: 'auto', opacity: 1, transition: 'opacity 0.18s ease' }}
            >
              {params.cameras.map((cam, idx) => (
                <div key={cam.id} className="group relative w-[34px] h-[34px] rounded-full flex items-center justify-center opacity-72 hover:opacity-100 cursor-pointer transition-[opacity,filter] duration-[0.16s] ease" style={{ fontSize: 13, fontWeight: 600 }}>
                  <button className="w-full h-full rounded-full border-none bg-transparent cursor-pointer" style={{ color: 'inherit' }} onClick={() => handleJumpToCamera(cam)} title={cam.name}>
                    <span className="panorama-camera-dock__number">{idx < 9 ? idx + 1 : ''}</span>
                  </button>
                  <button
                    className="absolute top-0 right-0 w-[14px] h-[14px] rounded-full border-none bg-transparent cursor-pointer opacity-78 hover:opacity-100 transition-[opacity] duration-[0.16s] ease"
                    style={{ fontSize: 11, lineHeight: '12px', transform: 'translate(20%, -20%)', color: 'inherit' }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteCamera(cam.id); }}
                    title="删除机位书签"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {showPresetMenu && presetMenuSlot !== null && (
            <div
              className="fixed z-[9999] rounded-[12px] py-1"
              style={{
                left: presetMenuPos.x,
                top: presetMenuPos.y,
                transform: 'translate(-50%, -100%)',
                background: theme.menuBg,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
                color: theme.fg,
                minWidth: 120,
              }}
            >
              {(() => {
                const preset = params.cameraPresets.find((p) => p.slot === presetMenuSlot);
                if (!preset) return null;
                return (
                  <>
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs border-none bg-transparent cursor-pointer hover:bg-black/10 transition-[background] duration-[0.16s] ease"
                      style={{ color: 'inherit' }}
                      onClick={() => {
                        setRenamingPresetId(preset.id);
                        setRenameValue(preset.name);
                        setShowPresetMenu(false);
                      }}
                    >
                      重命名
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs border-none bg-transparent cursor-pointer hover:bg-black/10 transition-[background] duration-[0.16s] ease"
                      style={{ color: 'inherit' }}
                      onClick={() => {
                        handleSavePreset(preset.slot, preset.name);
                        setShowPresetMenu(false);
                      }}
                    >
                      覆盖
                    </button>
                    <div className="mx-2 my-1" style={{ height: 1, background: theme.border }} />
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs border-none bg-transparent cursor-pointer hover:bg-red-500/15 transition-[background] duration-[0.16s] ease"
                      style={{ color: '#ef4444' }}
                      onClick={() => {
                        handleDeletePreset(preset.id);
                        setShowPresetMenu(false);
                      }}
                    >
                      删除
                    </button>
                  </>
                );
              })()}
            </div>
          )}

          {renamingPresetId && (
            <div
              className="fixed z-[9999] rounded-[12px] p-3"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: theme.menuBg,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
                color: theme.fg,
                width: 220,
              }}
            >
              <div className="text-xs font-semibold mb-2">重命名机位预设</div>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenamePreset(renamingPresetId, renameValue);
                  } else if (e.key === 'Escape') {
                    setRenamingPresetId(null);
                    setRenameValue('');
                  }
                }}
                autoFocus
                className="w-full h-8 rounded-[10px] border px-2 text-xs outline-none"
                style={{ borderColor: theme.border, background: 'transparent', color: 'inherit' }}
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  className="px-3 py-1 rounded-[8px] text-xs border-none bg-transparent cursor-pointer hover:bg-black/10 transition-[background] duration-[0.16s] ease"
                  style={{ color: 'inherit' }}
                  onClick={() => { setRenamingPresetId(null); setRenameValue(''); }}
                >
                  取消
                </button>
                <button
                  className="px-3 py-1 rounded-[8px] text-xs border-none cursor-pointer hover:opacity-90 transition-[opacity] duration-[0.16s] ease"
                  style={{ background: '#3b82f6', color: '#fff' }}
                  onClick={() => handleRenamePreset(renamingPresetId, renameValue)}
                >
                  确认
                </button>
              </div>
            </div>
          )}

          {isEditing && showCaptureMenu && (
            <div
              className="absolute left-1/2 z-30"
              style={{ bottom: '60px', transform: 'translateX(-50%)', background: theme.menuBg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, borderRadius: 16, boxShadow: theme.shadow, color: theme.fg, width: 224, padding: 10, boxSizing: 'border-box', opacity: 1, transition: 'opacity 0.18s ease' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {CAPTURE_ASPECTS.map((a) => (
                  <button
                    key={a.key}
                    className="flex flex-col items-center gap-1 border border-transparent rounded-[12px] bg-transparent cursor-pointer opacity-78 hover:opacity-100 transition-[opacity,border-color,background,filter] duration-[0.16s] ease"
                    style={{ padding: '6px 4px', color: 'inherit' }}
                    onClick={() => handleCapture(a.key)}
                  >
                    <span className="inline-flex items-center justify-center" style={{ width: 28, height: 20 }}>
                      <span style={{
                        width: a.key === '9:16' ? 11 : a.key === '2.35:1' ? 24 : a.key === 'free' ? 24 : 22,
                        height: a.key === '9:16' ? 18 : a.key === '2.35:1' ? 10 : 16,
                        border: `1px solid currentColor${a.key === 'free' ? ' dashed' : ''}`,
                        borderRadius: 4,
                        boxSizing: 'border-box',
                      }} />
                    </span>
                    <span style={{ fontSize: 11, lineHeight: 1, whiteSpace: 'nowrap' }}>{a.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${theme.border}` }}>
                <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={transparentCapture}
                    onChange={(e) => setTransparentCapture(e.target.checked)}
                    className="accent-white"
                  />
                  <span>透明背景（仅物体）</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-1.5" style={{ fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={watermarkCapture}
                    onChange={(e) => setWatermarkCapture(e.target.checked)}
                    className="accent-white"
                  />
                  <span>添加水印（焦距/视角/日期）</span>
                </label>
              </div>
            </div>
          )}

          {isEditing && showFocusMenu && (
            <div
              className="absolute left-1/2 z-30"
              style={{ bottom: '60px', transform: 'translateX(-50%)', background: theme.menuBg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, borderRadius: 16, boxShadow: theme.shadow, color: theme.fg, width: 148, padding: 8, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 6, opacity: 1, transition: 'opacity 0.18s ease' }}
            >
              <div className="flex items-center justify-between gap-2" style={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>
                <span>焦距</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.78 }}>{viewRef.current.focalLength.toFixed(0)}mm</span>
              </div>
              <input
                type="range"
                min={16}
                max={135}
                value={viewRef.current.focalLength}
                onChange={handleFocalLengthChange}
                className="w-full h-1 accent-white"
              />
            </div>
          )}

          {isEditing && showGridPanel && (
            <div
              className="absolute left-1/2 z-30"
              style={{ bottom: '60px', transform: 'translateX(-50%)', background: theme.menuBg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, borderRadius: 16, boxShadow: theme.shadow, color: theme.fg, width: 332, padding: 8, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 6, opacity: 1, transition: 'opacity 0.18s ease' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>矩形排列</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>行数</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={gridRows}
                    onChange={(e) => setGridRows(Math.max(1, Math.min(10, Number(e.target.value))))}
                    style={{ height: 28, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', padding: '0 6px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12, background: 'transparent', color: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>列数</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={gridCols}
                    onChange={(e) => setGridCols(Math.max(1, Math.min(10, Number(e.target.value))))}
                    style={{ height: 28, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', padding: '0 6px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12, background: 'transparent', color: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <button
                onClick={handleApplyGrid}
                style={{ width: '100%', height: 30, borderRadius: 10, border: 'none', background: 'rgba(59,130,246,0.15)', color: 'inherit', fontSize: 12, cursor: 'pointer', opacity: 0.76, marginTop: 2, transition: 'opacity 0.16s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.76'; }}
              >
                应用
              </button>
            </div>
          )}

          {isEditing && selectedObjectIds.length >= 2 && (
            <div
              className="absolute top-14 left-1/2 -translate-x-1/2 z-25 flex items-center gap-0.5 px-1 py-0.5 rounded-[12px]"
              style={{ background: editTheme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${editTheme.border}`, boxShadow: editTheme.shadow, color: editTheme.fg }}
            >
              <span className="text-[10px] opacity-60 px-1.5" style={{ whiteSpace: 'nowrap' }}>对齐</span>
              <div className="w-px h-5 mx-0.5" style={{ background: editTheme.border }} />
              {([
                { mode: 'left' as AlignMode, icon: SVG.alignLeft, tip: '左对齐' },
                { mode: 'right' as AlignMode, icon: SVG.alignRight, tip: '右对齐' },
                { mode: 'top' as AlignMode, icon: SVG.alignTop, tip: '顶对齐' },
                { mode: 'bottom' as AlignMode, icon: SVG.alignBottom, tip: '底对齐' },
                { mode: 'distributeH' as AlignMode, icon: SVG.distributeH, tip: '等距水平' },
                { mode: 'distributeV' as AlignMode, icon: SVG.distributeV, tip: '等距垂直' },
                { mode: 'groundSnap' as AlignMode, icon: SVG.groundSnap, tip: '地面贴合' },
              ]).map((item) => (
                <button
                  key={item.mode}
                  className={cn('w-[28px] h-[28px] flex items-center justify-center border-none bg-transparent cursor-pointer opacity-70 hover:opacity-100 transition-[opacity] duration-[0.16s] ease rounded-[6px]')}
                  style={{ color: 'inherit' }}
                  onClick={() => handleAlign(item.mode)}
                  title={item.tip}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          )}

          {isEditing && showLayerPanel && (
            <div
              className="absolute left-3.5 z-20 rounded-[14px] flex flex-col"
              style={{ top: params.showDiagnostics ? 112 : 82, background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow, color: theme.fg, width: 180, maxHeight: 280, overflow: 'hidden' }}
            >
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
                <span className="text-[11px] font-semibold" style={{ opacity: 0.8 }}>层级管理</span>
                <div className="flex gap-1">
                  <button
                    className="w-[22px] h-[22px] flex items-center justify-center border-none bg-transparent cursor-pointer opacity-60 hover:opacity-100 transition-[opacity] duration-[0.16s] ease rounded-[4px]"
                    style={{ color: 'inherit' }}
                    onClick={handleShowAllObjects}
                    title="全部显示"
                  >
                    {SVG.eye}
                  </button>
                  <button
                    className="w-[22px] h-[22px] flex items-center justify-center border-none bg-transparent cursor-pointer opacity-60 hover:opacity-100 transition-[opacity] duration-[0.16s] ease rounded-[4px]"
                    style={{ color: 'inherit' }}
                    onClick={handleHideAllObjects}
                    title="全部隐藏"
                  >
                    {SVG.eyeOff}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 230 }}>
                {params.objects.length === 0 && (
                  <div className="px-3 py-3 text-[10px] opacity-40 text-center">暂无物体</div>
                )}
                {params.objects.map((obj) => {
                  const isSelected = selectedObjectIds.includes(obj.id) || params.selectedObjectId === obj.id;
                  const isVisible = obj.visible !== false;
                  const isLocked = obj.locked === true;
                  return (
                    <div
                      key={obj.id}
                      className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-[background] duration-[0.12s] ease"
                      style={{
                        background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                        borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                      }}
                      onClick={(e) => handleToggleObjectSelect(obj.id, e.ctrlKey || e.metaKey)}
                    >
                      <span className="flex-shrink-0" style={{ opacity: 0.6 }}>
                        {obj.type === 'mannequin' ? SVG.mannequin : SVG.cube}
                      </span>
                      <span
                        className="flex-1 text-[11px] truncate"
                        style={{ opacity: isVisible ? 1 : 0.35, textDecoration: isLocked ? 'none' : 'none' }}
                      >
                        {obj.name}
                      </span>
                      <button
                        className="flex-shrink-0 w-[20px] h-[20px] flex items-center justify-center border-none bg-transparent cursor-pointer opacity-50 hover:opacity-100 transition-[opacity] duration-[0.12s] ease"
                        style={{ color: 'inherit' }}
                        onClick={(e) => { e.stopPropagation(); handleToggleObjectVisibility(obj.id); }}
                        title={isVisible ? '隐藏' : '显示'}
                      >
                        {isVisible ? SVG.eye : SVG.eyeOff}
                      </button>
                      <button
                        className="flex-shrink-0 w-[20px] h-[20px] flex items-center justify-center border-none bg-transparent cursor-pointer opacity-50 hover:opacity-100 transition-[opacity] duration-[0.12s] ease"
                        style={{ color: 'inherit' }}
                        onClick={(e) => { e.stopPropagation(); handleToggleObjectLocked(obj.id); }}
                        title={isLocked ? '解锁' : '锁定'}
                      >
                        {isLocked ? SVG.lock : SVG.unlock}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isEditing && (
            <canvas
              ref={minimapCanvasRef}
              width={120}
              height={80}
              className="absolute z-20 cursor-pointer"
              style={{ bottom: 80, right: 14, borderRadius: 8, border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}
              onClick={handleMinimapClick}
              title="点击跳转相机位置"
            />
          )}

          <div className="absolute top-3.5 left-3.5 z-20" style={{ color: theme.fg }}>
            {params.selectedObjectId && isEditing && (
              <button
                className="text-[10px] px-2 py-1 rounded-[10px] border-none bg-transparent cursor-pointer hover:bg-red-500/20 transition-[background] duration-[0.16s] ease"
                style={{ color: theme.fg, background: theme.bg, backdropFilter: 'blur(10px)' }}
                onClick={handleDeleteSelected}
                title="删除选中"
              >
                删除
              </button>
            )}
          </div>

          {isEditing && params.selectedObjectId && !showCameraLab && !showHDRPanel && (() => {
            const obj = params.objects.find((o) => o.id === params.selectedObjectId);
            if (!obj) return null;
            return (
              <div
                className="absolute right-3.5 top-[158px] z-20 rounded-[14px] p-3 flex flex-col gap-2"
                style={{ background: theme.bg, backdropFilter: 'blur(10px)', border: `1px solid ${theme.border}`, boxShadow: theme.shadow, color: theme.fg, width: 168 }}
              >
                <div className="text-[11px] font-semibold" style={{ opacity: 0.8 }}>属性</div>
                <input
                  type="text"
                  value={obj.name}
                  onChange={(e) => {
                    const newObjects = params.objects.map((o) => o.id === obj.id ? { ...o, name: e.target.value } : o);
                    updateNodeData({ objects: newObjects });
                  }}
                  className="w-full h-6 rounded-[8px] border px-2 text-[10px] outline-none"
                  style={{ borderColor: theme.border, background: 'transparent', color: 'inherit' }}
                />
                {['position', 'rotation', 'scale'].map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-[9px] opacity-60">{key === 'position' ? '位置' : key === 'rotation' ? '旋转' : '缩放'}</span>
                    <div className="flex gap-1">
                      {['x', 'y', 'z'].map((axis) => (
                        <div key={axis} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[8px] opacity-50" style={{ color: axis === 'x' ? '#ef4444' : axis === 'y' ? '#22c55e' : '#3b82f6' }}>{axis.toUpperCase()}</span>
                          <input
                            type="number"
                            step={key === 'scale' ? 0.1 : key === 'rotation' ? 0.1 : 0.1}
                            value={key === 'rotation' ? (obj[key as keyof SceneObject3D] as any)[axis] * (180 / Math.PI) : (obj[key as keyof SceneObject3D] as any)[axis]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const newVal = key === 'rotation' ? val * (Math.PI / 180) : val;
                              const newObjects = params.objects.map((o) => {
                                if (o.id !== obj.id) return o;
                                const transformKey = key as 'position' | 'rotation' | 'scale';
                                return { ...o, [transformKey]: { ...o[transformKey], [axis]: newVal } };
                              });
                              updateNodeData({ objects: newObjects });
                              bridgeRef.current?.syncObjects(newObjects);
                            }}
                            className="w-full h-5 rounded-[6px] border px-1 text-[9px] outline-none text-center"
                            style={{ borderColor: theme.border, background: 'transparent', color: 'inherit' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] opacity-60">颜色</span>
                  <div className="flex gap-1 flex-wrap">
                    {MANNEQUIN_QUICK_COLORS.map((ck) => (
                      <button
                        key={ck}
                        className="w-5 h-5 rounded-full border-none cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                        style={{ background: ck === 'yellow' ? 'gold' : MANNEQUIN_COLORS[ck].hex, outline: obj.colorKey === ck ? `2px solid ${MANNEQUIN_COLORS[ck].hex}` : 'none' }}
                        onClick={() => {
                          const newObjects = params.objects.map((o) => o.id === obj.id ? { ...o, colorKey: ck } : o);
                          updateNodeData({ objects: newObjects });
                          bridgeRef.current?.syncObjects(newObjects);
                        }}
                        title={MANNEQUIN_COLORS[ck].name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="absolute bottom-3.5 left-3.5 z-20 flex flex-col gap-1" style={{ color: theme.fg }}>
            <button
              className="text-[10px] px-2 py-1 rounded-[10px] border-none bg-transparent cursor-pointer hover:bg-white/[0.08] transition-[background] duration-[0.16s] ease"
              style={{ background: theme.bg, backdropFilter: 'blur(10px)' }}
              onClick={() => {
                const prompt = cameraToPrompt(viewRef.current);
                updateNodeData({ prompt });
              }}
              title="生成AI提示词"
            >
              ✨ 提示词
            </button>
          </div>

          {isFullscreen && (
            <button
              className="absolute top-3 right-14 z-30 px-2.5 py-1.5 rounded-[10px] text-xs font-medium border cursor-pointer"
              style={{ background: 'var(--bg-panel-card, rgba(30,30,36,0.9))', color: '#fff', borderColor: 'rgba(255,255,255,0.08)', height: 32, padding: '0 10px' }}
              onClick={handleToggleFullscreen}
            >
              退出全屏
            </button>
          )}
        </>
      )}
      </div>
      </AICGNodeShell>
      {!isCollapsed ? (
        <NodeControllerV2Panel
          title={sceneControllerPreset.v2.title}
          subtitle={sceneControllerPreset.v2.subtitle}
          status={params.objects.length > 0 ? 'done' : 'idle'}
          onClose={() => setIsCollapsed(true)}
          sections={[
            { id: 'result', label: sceneControllerPreset.v2.sections.result || '场景动作', actions: sceneActions },
            { id: 'downstream', label: sceneControllerPreset.v2.sections.downstream || '下游工具', actions: sceneDownstreamActions },
          ]}
          summary={[
            { id: 'state', label: sceneReadiness, title: '场景状态' },
            { id: 'objects', label: `${visibleObjectCount}/${params.objects.length} 可见`, title: '物体数量' },
            { id: 'cameras', label: `${params.cameras.length} 机位`, title: '机位数量' },
          ]}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}

export default memo(Director3DNode);
