import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { cn } from '@/lib/utils';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { toast } from 'sonner';
import {
  persistGeneratedCanvasUrl,
  persistImportedCanvasFile,
} from '@/services/canvas-asset-actions';
import { resolveAssetUrl } from '@/services/canvas-asset-url-resolver';
import { Scene3DBridge } from './scene3d-bridge';
import {
  type Director3DParams,
  DEFAULT_DIRECTOR3D_PARAMS,
  DEFAULT_PANORAMA_VIEW,
  PANORAMA_SCENE_DEFAULT_SIZE,
  PANORAMA_SCENE_COLLAPSED_MAX_SIZE,
  TOOLBAR_THEME,
  clampPanoramaPitch,
  clampPanoramaFov,
  panoramaToPrompt,
  PANORAMA_EXTRACT_ANGLES,
  type PanoramaExtractAngle,
} from './director3d-core';
import { resolvePanoramaImageFromIncomingEdge } from './panorama-scene-utils';
import { spawnControllerToolNode } from '@/services/node-controller-action-service';

async function persistPanoramaImageFile(nodeId: string, file: File, fallbackUrl: string) {
  const persisted = await persistImportedCanvasFile({
    nodeId,
    kind: 'image',
    file,
    role: 'source',
    source: 'imported',
  });
  const runtimeUrl = persisted.runtimeUrl ?? (await resolveAssetUrl(persisted.asset.id));
  return {
    assetId: persisted.asset.id,
    url: runtimeUrl || fallbackUrl,
  };
}

const SVG = {
  close: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),
  edit: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
  upload: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  ),
  fullscreen: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  collapse: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <path d="m6 15 6-6 6 6" />
    </svg>
  ),
  autoRotate: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <path d="M21 3v9h-9" />
    </svg>
  ),
};

function Panorama360Node({ id, data, selected }: NodeProps) {
  const rawParams: Partial<Director3DParams> = (data?.params as Partial<Director3DParams>) ?? {};
  const params: Director3DParams = {
    ...DEFAULT_DIRECTOR3D_PARAMS,
    ...rawParams,
    view: { ...DEFAULT_DIRECTOR3D_PARAMS.view, ...(rawParams.view ?? {}) },
    panoramaView: { ...DEFAULT_PANORAMA_VIEW, ...(rawParams.panoramaView ?? {}) },
    objects: rawParams.objects ?? [],
    cameras: rawParams.cameras ?? [],
  };

  const updateNodeData = useCallback(
    (patch: Partial<Director3DParams> & Record<string, unknown>) => {
      const node = useCanvasStore.getState().nodes.find((n: any) => n.id === id);
      if (node) {
        const exposedPatch: Record<string, unknown> = {};
        for (const key of ['panoramaImageUrl', 'panoramaAssetId', 'prompt', 'output', 'viewData']) {
          if (key in patch) exposedPatch[key] = patch[key];
        }
        canvasStoreApi.updateNodeData(id, {
          ...exposedPatch,
          params: { ...((node.data as any)?.params ?? DEFAULT_DIRECTOR3D_PARAMS), ...patch },
        });
      }
    },
    [id]
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<Scene3DBridge | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoRotate, setAutoRotate] = useState(params.autoRotate);
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(params.autoRotateSpeed ?? 0.001);
  const [showFovSlider, setShowFovSlider] = useState(false);

  const [showExtractPanel, setShowExtractPanel] = useState(false);
  const [extractedAngles, setExtractedAngles] = useState<Record<string, string>>({});
  const [isExtracting, setIsExtracting] = useState(false);

  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const pvRef = useRef({ ...DEFAULT_PANORAMA_VIEW });
  const updateNodeDataRef = useRef(updateNodeData);
  const resolvedPanoramaAssetIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pvRef.current = { ...params.panoramaView };
  }, [params.panoramaView]);
  useEffect(() => {
    updateNodeDataRef.current = updateNodeData;
  }, [updateNodeData]);
  useEffect(() => {
    if (params.extractedAngleUrls && typeof params.extractedAngleUrls === 'object') {
      setExtractedAngles(params.extractedAngleUrls);
    }
  }, [params.extractedAngleUrls]);

  const edges = useCanvasStore((s) => s.edges);
  const canvasNodes = useCanvasStore((s) => s.nodes);

  useEffect(() => {
    if (!viewportRef.current) return;
    if (bridgeRef.current) bridgeRef.current.dispose();
    const bridge = new Scene3DBridge(viewportRef.current);
    bridgeRef.current = bridge;
    bridge.setMode('panorama360');
    // 使用 ref 中的最新视角，避免初始化时使用 stale 的 params
    bridge.applyPanoramaView(pvRef.current);
    bridge.setPanoramaViewChangeCallback((nextView) => {
      pvRef.current = nextView;
      updateNodeDataRef.current({ panoramaView: nextView });
    });
    bridge.setAutoRotate(autoRotate, autoRotateSpeed);
    if (params.panoramaImageUrl) bridge.loadPanoramaImage(params.panoramaImageUrl);
    return () => {
      bridge.dispose();
      bridgeRef.current = null;
    };
    // 仅在挂载时初始化，后续通过独立 useEffect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bridgeRef.current?.applyPanoramaView(pvRef.current);
  }, [params.panoramaView.yaw, params.panoramaView.pitch, params.panoramaView.fov]);

  useEffect(() => {
    const imageUrl = resolvePanoramaImageFromIncomingEdge(id as string, 'input');
    if (!imageUrl || imageUrl === params.panoramaImageUrl) return;
    updateNodeData({ panoramaImageUrl: imageUrl });
    bridgeRef.current?.loadPanoramaImage(imageUrl);
  }, [id, edges, canvasNodes, params.panoramaImageUrl, updateNodeData]);

  useEffect(() => {
    const assetId = params.panoramaAssetId;
    if (!assetId || resolvedPanoramaAssetIdsRef.current.has(assetId)) return;
    if (params.panoramaImageUrl && !params.panoramaImageUrl.startsWith('blob:')) return;

    let cancelled = false;
    resolvedPanoramaAssetIdsRef.current.add(assetId);
    void resolveAssetUrl(assetId)
      .then((resolved) => {
        if (cancelled || !resolved) return;
        updateNodeData({ panoramaImageUrl: resolved });
        bridgeRef.current?.loadPanoramaImage(resolved);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [params.panoramaAssetId, params.panoramaImageUrl, updateNodeData]);

  const handleEnterEdit = useCallback(() => {
    setIsEditing(true);
    if (isCollapsed) setIsCollapsed(false);
  }, [isCollapsed]);

  const handleExitEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleViewportMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      const pv = pvRef.current;
      const newYaw = pv.yaw - dx * 0.003;
      const newPitch = clampPanoramaPitch(pv.pitch + dy * 0.003);
      const newPv = { ...pv, yaw: newYaw, pitch: newPitch };
      pvRef.current = newPv;
      bridgeRef.current?.applyPanoramaView(newPv);
      updateNodeData({ panoramaView: newPv });
    },
    [updateNodeData]
  );

  const handleViewportMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation();
      const pv = pvRef.current;
      const delta = e.deltaY > 0 ? 2 : -2;
      const newFov = clampPanoramaFov(pv.fov + delta);
      const newPv = { ...pv, fov: newFov };
      pvRef.current = newPv;
      bridgeRef.current?.applyPanoramaView(newPv);
      updateNodeData({ panoramaView: newPv });
    },
    [updateNodeData]
  );

  const handleUploadPanorama = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件');
        return;
      }
      // 释放旧的 blob URL
      if (params.panoramaImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(params.panoramaImageUrl);
      }
      let url = URL.createObjectURL(file);
      let panoramaAssetId: string | undefined;
      updateNodeData({ panoramaImageUrl: url, panoramaAssetId: undefined });
      bridgeRef.current?.loadPanoramaImage(url);
      try {
        const persisted = await persistPanoramaImageFile(id as string, file, url);
        panoramaAssetId = persisted.assetId;
        if (persisted.url !== url && url.startsWith('blob:')) URL.revokeObjectURL(url);
        url = persisted.url;
        toast.success('全景图已保存到资产仓库');
      } catch (error) {
        console.warn('[Panorama360Node] 全景图持久化失败，已使用临时 URL:', error);
        toast.warning('全景图暂未持久化，本次会话可用');
      }
      updateNodeData({ panoramaImageUrl: url, panoramaAssetId });
      bridgeRef.current?.loadPanoramaImage(url);
      setIsEditing(true);
      setShowFovSlider(false);
    };
    input.click();
  }, [id, params.panoramaImageUrl, updateNodeData]);

  const handleToggleAutoRotate = useCallback(() => {
    const newVal = !autoRotate;
    setAutoRotate(newVal);
    bridgeRef.current?.setAutoRotate(newVal, autoRotateSpeed);
    updateNodeData({ autoRotate: newVal });
  }, [autoRotate, autoRotateSpeed, updateNodeData]);

  const handleAutoRotateSpeedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const speed = Number(e.target.value);
      setAutoRotateSpeed(speed);
      bridgeRef.current?.setAutoRotate(autoRotate, speed);
      updateNodeData({ autoRotateSpeed: speed });
    },
    [autoRotate, updateNodeData]
  );

  const handleFovChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fov = clampPanoramaFov(Number(e.target.value));
      const pv = { ...pvRef.current, fov };
      pvRef.current = pv;
      bridgeRef.current?.applyPanoramaView(pv);
      updateNodeData({ panoramaView: pv });
    },
    [updateNodeData]
  );

  const handleSetFov = useCallback(
    (fov: number) => {
      const nextView = { ...pvRef.current, fov: clampPanoramaFov(fov) };
      pvRef.current = nextView;
      bridgeRef.current?.applyPanoramaView(nextView);
      updateNodeData({ panoramaView: nextView });
    },
    [updateNodeData]
  );

  const handleResetPanoramaView = useCallback(() => {
    const nextView = { ...DEFAULT_PANORAMA_VIEW };
    pvRef.current = nextView;
    bridgeRef.current?.applyPanoramaView(nextView);
    updateNodeData({ panoramaView: nextView });
  }, [updateNodeData]);

  const handleDropPanorama = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = Array.from(e.dataTransfer.files).find((item) => item.type.startsWith('image/'));
      if (!file) return;
      // 释放旧的 blob URL
      if (params.panoramaImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(params.panoramaImageUrl);
      }
      let url = URL.createObjectURL(file);
      updateNodeData({ panoramaImageUrl: url, panoramaAssetId: undefined });
      bridgeRef.current?.loadPanoramaImage(url);
      void persistPanoramaImageFile(id as string, file, url)
        .then((persisted) => {
          if (persisted.url !== url && url.startsWith('blob:')) URL.revokeObjectURL(url);
          url = persisted.url;
          updateNodeData({ panoramaImageUrl: url, panoramaAssetId: persisted.assetId });
          bridgeRef.current?.loadPanoramaImage(url);
          toast.success('全景图已保存到资产仓库');
        })
        .catch((error) => {
          console.warn('[Panorama360Node] 拖拽全景图持久化失败，已使用临时 URL:', error);
          updateNodeData({ panoramaImageUrl: url, panoramaAssetId: undefined });
          bridgeRef.current?.loadPanoramaImage(url);
          toast.warning('全景图暂未持久化，本次会话可用');
        });
      setIsEditing(true);
    },
    [id, params.panoramaImageUrl, updateNodeData]
  );

  const handleGeneratePrompt = useCallback(() => {
    const prompt = panoramaToPrompt(pvRef.current);
    const viewData = JSON.stringify({ kind: 'panoramaView', ...pvRef.current, prompt });
    updateNodeData({ prompt, output: viewData, viewData });
  }, [updateNodeData]);

  const handleExtractAngles = useCallback(
    async (angles: PanoramaExtractAngle[]) => {
      if (!bridgeRef.current || !params.panoramaImageUrl) {
        toast.warning('请先上传或连接全景图');
        return;
      }

      setIsExtracting(true);
      try {
        const results: Record<string, string> = {};
        const assetIds: Record<string, string> = { ...(params.extractedAngleAssetIds ?? {}) };
        for (const angle of angles) {
          // 每次循环重新检查 bridge 是否仍然有效（组件可能已卸载）
          if (!bridgeRef.current) break;
          const dataUrl = bridgeRef.current.capturePanoramaViewAsDataURL({
            yaw: angle.yaw,
            pitch: angle.pitch,
            fov: angle.fov,
          });
          if (dataUrl) {
            let outputUrl = dataUrl;
            try {
              const persisted = await persistGeneratedCanvasUrl({
                nodeId: id as string,
                kind: 'image',
                url: dataUrl,
                fileName: `panorama-${angle.id}-${Date.now()}.png`,
                role: 'source',
              });
              assetIds[angle.id] = persisted.asset.id;
              outputUrl = (await resolveAssetUrl(persisted.asset.id).catch(() => null)) || dataUrl;
            } catch (error) {
              console.warn(
                `[Panorama360Node] ${angle.label}视角持久化失败，已保留 data URL:`,
                error
              );
            }
            results[angle.id] = outputUrl;
          }
        }
        setExtractedAngles(results);
        updateNodeData({ extractedAngleUrls: results, extractedAngleAssetIds: assetIds });
        toast.success(`已提取 ${Object.keys(results).length} 个视角`);
      } catch (error) {
        console.error('[Panorama360Node] 提取视角失败:', error);
        toast.error('提取视角失败，请重试');
      } finally {
        setIsExtracting(false);
      }
    },
    [id, params.extractedAngleAssetIds, params.panoramaImageUrl, updateNodeData]
  );

  const handleSendExtractedToDownstream = useCallback(
    (angleId: string) => {
      const dataUrl = extractedAngles[angleId];
      if (!dataUrl) return;
      const angle = PANORAMA_EXTRACT_ANGLES.find((a) => a.id === angleId);
      if (!angle) return;

      spawnControllerToolNode(id as string, 'aiImage', {
        controllerActionId: `panorama-extract-${angleId}`,
        replaceExisting: false,
        label: `${angle.label}视角`,
        toastLabel: `${angle.label}视角`,
        sourceHandle: 'output',
        targetHandle: 'input',
        initialData: {
          imageUrl: dataUrl,
          prompt: `Extracted from 360 panorama, ${angle.label} view, ${panoramaToPrompt({ yaw: angle.yaw, pitch: angle.pitch, fov: angle.fov })}`,
        },
      });
    },
    [extractedAngles, id]
  );

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((p) => !p);
  }, []);
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((p) => !p);
  }, []);

  // 全屏模式下按 Escape 退出
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // 容器尺寸变化时同步 resize WebGL renderer
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
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

  const visibleObjectCount = params.objects.filter((o) => o.visible !== false).length;
  const autoRotateLabel = autoRotate ? '自动旋转中' : '静止预览';
  const panoramaPromptReady = params.panoramaImageUrl ? '已载入全景图' : '等待上传全景图';

  const theme = TOOLBAR_THEME.night;
  const editTheme = TOOLBAR_THEME.editMode;

  const nodeWidth = isCollapsed
    ? PANORAMA_SCENE_COLLAPSED_MAX_SIZE
    : PANORAMA_SCENE_DEFAULT_SIZE.width;
  const nodeHeight = isCollapsed ? 160 : PANORAMA_SCENE_DEFAULT_SIZE.height;

  const topBtnBase =
    'ftb-btn w-[40px] min-w-[40px] h-[40px] flex items-center justify-center border-none bg-transparent cursor-pointer';
  const topBtnOpacity = 'opacity-78 hover:opacity-100 transition-[opacity] duration-[0.16s] ease';

  return (
    <div
      className={cn(
        'group relative',
        isFullscreen && 'fixed inset-3 z-[6000] rounded-[18px] shadow-2xl'
      )}
      style={{ width: nodeWidth }}
      data-testid="panorama360-node"
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="panorama360"
        outputId="imageOutput"
        inputTip="全景图输入"
        outputTip="全景图输出"
        extraOutputs={['output', 'viewData', 'prompt']}
      />

      <AICGNodeShell
        aicgType="tool"
        title="全景预览"
        selected={selected}
        width={nodeWidth}
        onDelete={() => canvasStoreApi.deleteNode(id as string)}
        bodyClassName="p-0 relative overflow-hidden"
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: '100%',
            height: nodeHeight,
            transition: 'height 0.32s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={handleDropPanorama}
        >
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              background: 'var(--surface-node, #1e1e24)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            <div
              ref={viewportRef}
              className="absolute inset-0"
              data-testid="panorama360-viewport"
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
          </div>

          {isCollapsed && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 rounded-[18px] cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.36)' }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleToggleCollapse();
              }}
            >
              <div className="flex flex-col items-center gap-1 text-white">
                <span className="text-sm font-semibold">360° 全景预览</span>
                <span className="text-[10px] opacity-60">
                  FOV {pvRef.current.fov.toFixed(0)}° · 双击展开
                </span>
              </div>
            </div>
          )}

          {!isCollapsed && (
            <>
              <div
                className="nodrag nowheel absolute left-3.5 top-3.5 z-20 flex flex-col gap-1"
                style={{ color: theme.fg }}
              >
                <div
                  className="flex items-center gap-1.5 rounded-[12px] px-2.5 py-1.5"
                  style={{
                    background: theme.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: params.panoramaImageUrl ? '#22c55e' : '#f59e0b' }}
                  />
                  <span className="text-[10px] font-semibold">{panoramaPromptReady}</span>
                </div>
                <div
                  className="flex items-center gap-1 rounded-[12px] px-2.5 py-1 text-[10px]"
                  style={{
                    background: theme.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                  }}
                >
                  <span className="opacity-55">{autoRotateLabel}</span>
                  <span className="opacity-35">·</span>
                  <span className="opacity-55">FOV {pvRef.current.fov.toFixed(0)}°</span>
                  {visibleObjectCount > 0 && (
                    <span className="opacity-55">· 物体 {visibleObjectCount}</span>
                  )}
                </div>
              </div>

              {!params.panoramaImageUrl && !isCollapsed && (
                <div
                  className="nodrag nowheel absolute inset-x-8 top-1/2 z-20 -translate-y-1/2 rounded-[22px] p-4 text-white"
                  style={{
                    background: 'rgba(18,19,22,0.92)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold">载入 360° 全景图</div>
                      <div className="mt-1 text-[10px] leading-4 text-white/55">
                        拖入图片或点击上传，随后可调视角、FOV、自动旋转并生成镜头提示词。
                      </div>
                    </div>
                    <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 text-[10px] text-white/70">
                      Panorama
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleUploadPanorama}
                      className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-left text-[11px] transition hover:bg-white/[0.13]"
                    >
                      <span className="block font-semibold">上传全景图</span>
                      <span className="mt-0.5 block text-[10px] text-white/50">支持图片文件</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        handleToggleAutoRotate();
                      }}
                      className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-left text-[11px] transition hover:bg-white/[0.13]"
                    >
                      <span className="block font-semibold">开启环视</span>
                      <span className="mt-0.5 block text-[10px] text-white/50">自动旋转预览</span>
                    </button>
                  </div>
                </div>
              )}

              {!isEditing ? (
                <div
                  className="nodrag nowheel absolute top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-[14px] z-20"
                  style={{
                    background: theme.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                    color: theme.fg,
                    transition: 'opacity 0.18s ease',
                  }}
                >
                  <button
                    className={cn(topBtnBase, topBtnOpacity)}
                    onClick={handleEnterEdit}
                    title="编辑"
                  >
                    {SVG.edit}
                  </button>
                  <button
                    className={cn(topBtnBase, topBtnOpacity)}
                    onClick={handleUploadPanorama}
                    title="上传全景图"
                  >
                    {SVG.upload}
                  </button>
                  <button
                    className={cn(topBtnBase, topBtnOpacity)}
                    onClick={handleToggleFullscreen}
                    title="全屏显示"
                  >
                    {SVG.fullscreen}
                  </button>
                  <button
                    className={cn(topBtnBase, topBtnOpacity, 'ml-0.5')}
                    onClick={handleToggleCollapse}
                    title="折叠"
                  >
                    <span
                      style={{
                        transition: 'transform 0.26s cubic-bezier(0.34,1.56,0.64,1)',
                        display: 'inline-flex',
                        transform: isCollapsed ? 'rotate(180deg)' : undefined,
                      }}
                    >
                      {SVG.collapse}
                    </span>
                  </button>
                </div>
              ) : (
                <div
                  className="nodrag nowheel absolute top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-[14px] z-20"
                  style={{
                    background: editTheme.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${editTheme.border}`,
                    boxShadow: editTheme.shadow,
                    color: editTheme.weakFg,
                    transition: 'opacity 0.18s ease',
                  }}
                >
                  <button
                    className={cn(topBtnBase)}
                    onClick={handleExitEdit}
                    title="关闭编辑"
                    style={{ color: '#ef4444' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                      e.currentTarget.style.borderColor = 'rgba(255,100,100,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    {SVG.close}
                  </button>
                  <div className="w-px h-6 mx-0.5" style={{ background: editTheme.border }} />
                  <button
                    className={cn(topBtnBase, topBtnOpacity)}
                    onClick={handleUploadPanorama}
                    title="上传全景图"
                  >
                    {SVG.upload}
                  </button>
                  <button
                    className={cn(topBtnBase, topBtnOpacity, autoRotate && 'opacity-100')}
                    onClick={handleToggleAutoRotate}
                    title={autoRotate ? '停止自动旋转' : '自动旋转'}
                    style={autoRotate ? { color: '#3b82f6' } : undefined}
                  >
                    {SVG.autoRotate}
                  </button>
                  <button
                    className={cn(topBtnBase, topBtnOpacity)}
                    onClick={handleToggleFullscreen}
                    title="全屏显示"
                  >
                    {SVG.fullscreen}
                  </button>
                  <button
                    className={cn(topBtnBase, topBtnOpacity, 'ml-0.5')}
                    onClick={handleToggleCollapse}
                    title="折叠"
                  >
                    <span
                      style={{
                        transition: 'transform 0.26s cubic-bezier(0.34,1.56,0.64,1)',
                        display: 'inline-flex',
                        transform: isCollapsed ? 'rotate(180deg)' : undefined,
                      }}
                    >
                      {SVG.collapse}
                    </span>
                  </button>
                </div>
              )}

              <div
                className="absolute bottom-3.5 left-3.5 z-20 flex flex-col gap-1"
                style={{ color: theme.fg }}
              >
                <button
                  className="text-[10px] px-2 py-1 rounded-[10px] border-none bg-transparent cursor-pointer hover:bg-white/[0.08] transition-[background] duration-[0.16s] ease"
                  style={{ background: theme.bg, backdropFilter: 'blur(10px)' }}
                  onClick={handleGeneratePrompt}
                  title="生成AI提示词"
                >
                  ✨ 提示词
                </button>
                <button
                  className="text-[10px] px-2 py-1 rounded-[10px] border-none bg-transparent cursor-pointer hover:bg-white/[0.08] transition-[background] duration-[0.16s] ease"
                  style={{ background: theme.bg, backdropFilter: 'blur(10px)' }}
                  onClick={() => setShowFovSlider((p) => !p)}
                  title="FOV控制"
                >
                  🔍 FOV {pvRef.current.fov.toFixed(0)}°
                </button>
                <button
                  className="text-[10px] px-2 py-1 rounded-[10px] border-none bg-transparent cursor-pointer hover:bg-white/[0.08] transition-[background] duration-[0.16s] ease"
                  style={{ background: theme.bg, backdropFilter: 'blur(10px)' }}
                  onClick={handleResetPanoramaView}
                  title="重置视角"
                >
                  ↺ 重置
                </button>
              </div>

              {showFovSlider && (
                <div
                  className="absolute left-3.5 z-30 rounded-[12px] p-2"
                  style={{
                    bottom: '106px',
                    background: theme.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                    color: theme.fg,
                    width: 190,
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-2"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    <span>FOV</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.78 }}>
                      {pvRef.current.fov.toFixed(0)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={35}
                    max={80}
                    value={pvRef.current.fov}
                    onChange={handleFovChange}
                    className="w-full h-1 accent-white mt-1"
                  />
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {[40, 55, 70].map((fov) => (
                      <button
                        key={fov}
                        type="button"
                        onClick={() => handleSetFov(fov)}
                        className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[10px] transition hover:bg-white/[0.12]"
                        style={{ color: 'inherit' }}
                      >
                        {fov}°
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showExtractPanel && (
                <div
                  className="absolute left-3.5 z-30 rounded-[12px] p-3"
                  data-testid="panorama360-extract-panel"
                  style={{
                    bottom: '106px',
                    background: theme.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                    color: theme.fg,
                    width: 280,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span style={{ fontSize: 12, fontWeight: 600 }}>全景多角度提取</span>
                    <button
                      type="button"
                      onClick={() => setShowExtractPanel(false)}
                      className="text-[10px] opacity-60 hover:opacity-100"
                      style={{ color: 'inherit' }}
                    >
                      ✕
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExtractAngles(PANORAMA_EXTRACT_ANGLES)}
                    disabled={isExtracting}
                    data-testid="panorama360-extract-all"
                    className="w-full mb-2 rounded-md border border-white/18 bg-white/[0.08] px-2 py-1.5 text-[10px] font-medium transition hover:bg-white/[0.12] disabled:opacity-50"
                    style={{ color: 'inherit' }}
                  >
                    {isExtracting ? '提取中...' : '提取全部 8 个视角'}
                  </button>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PANORAMA_EXTRACT_ANGLES.map((angle) => {
                      const extracted = extractedAngles[angle.id];
                      return (
                        <div key={angle.id} className="flex flex-col items-center gap-1">
                          <div
                            className="relative h-12 w-full rounded-md border border-white/10 overflow-hidden"
                            data-testid={extracted ? 'panorama360-extracted-angle' : undefined}
                            style={{ background: 'rgba(0,0,0,0.3)' }}
                          >
                            {extracted ? (
                              <img
                                src={getSafeRenderableMediaUrl(extracted)}
                                alt={angle.label}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[8px] opacity-40">
                                {angle.label}
                              </div>
                            )}
                          </div>
                          <span className="text-[8px] opacity-70">{angle.label}</span>
                          {extracted && (
                            <button
                              type="button"
                              onClick={() => handleSendExtractedToDownstream(angle.id)}
                              className="text-[8px] text-white/55 hover:text-white/80"
                            >
                              发送↓
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {autoRotate && (
                <div
                  className="absolute right-3.5 z-20 rounded-[12px] p-2"
                  style={{
                    bottom: '52px',
                    background: theme.bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                    color: theme.fg,
                    width: 140,
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-2"
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    <span>旋转速度</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.78 }}>
                      {(autoRotateSpeed * 1000).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.0001}
                    max={0.01}
                    step={0.0001}
                    value={autoRotateSpeed}
                    onChange={handleAutoRotateSpeedChange}
                    className="w-full h-1 accent-white mt-1"
                  />
                </div>
              )}

              {isFullscreen && (
                <button
                  className="absolute top-3 right-14 z-30 px-2.5 py-1.5 rounded-[10px] text-xs font-medium border cursor-pointer"
                  style={{
                    background: 'var(--bg-panel-card, rgba(30,30,36,0.9))',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.08)',
                    height: 32,
                    padding: '0 10px',
                  }}
                  onClick={handleToggleFullscreen}
                >
                  退出全屏
                </button>
              )}
            </>
          )}
        </div>
      </AICGNodeShell>
    </div>
  );
}

export default memo(Panorama360Node);
