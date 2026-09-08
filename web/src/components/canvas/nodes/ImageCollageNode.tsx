import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Position, type NodeProps, useStore } from '@xyflow/react';
import { toast } from 'sonner';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { cn } from '@/lib/utils';
import { NodePointsBadge } from './NodePointsBadge';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { normalizeMediaUrl, getSafeRenderableMediaUrl } from '@/lib/media-url';
import { persistImportedCanvasFile, persistGeneratedCanvasUrl } from '@/services/canvas-asset-actions';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import {
  X as CloseIcon,
  Loader2,
  Image as ImageIcon,
  Download,
  ChevronDown,
  ChevronUp,
  Plus,
  Grid2x2,
  Rows2,
  Columns2,
  LayoutGrid,
  Puzzle,
  Maximize2,
  Settings2,
  Type,
  Trash2,
  Move,
  Save,
  FolderOpen,
  Sun,
  Contrast,
  Droplets,
  Palette,
  Aperture,
  Sparkles,
  GripHorizontal,
  MousePointer2,
  AlignCenter,
  AlignLeft,
  AlignRight,
  FlipHorizontal,
  FlipVertical,
  Grid3x3,
  Layers,
  Droplet,
} from 'lucide-react';
import {
  COLLAGE_DEFAULT_PARAMS,
  COLLAGE_LAYOUT_PRESETS,
  COLLAGE_ASPECT_RATIO_OPTIONS,
  COLLAGE_EXPORT_RESOLUTION_OPTIONS,
  COLLAGE_FIT_MODE_OPTIONS,
  COLLAGE_TEMPLATE_STORAGE_KEY,
  type CollageLayoutParams,
  type CollageLayoutPresetId,
  type CollageItem,
  type CollageAspectRatio,
  type CollageExportResolution,
  type CollageFitMode,
  type CollageFilters,
  type CollageTextOverlay,
  type CollageTemplate,
  generateCollageItemId,
  generateCollageTextOverlayId,
  generateCollageTemplateId,
  getLayoutPreset,
  resolveCollagePreviewLayout,
  renderCollageToBlob,
  resolveCollageExportSize,
  saveTemplate,
  loadTemplates,
  deleteTemplate,
} from './image-collage-core';

const PRESET_ICONS: Record<string, React.ReactNode> = {
  'horizontal-2': <Rows2 className="w-3.5 h-3.5" />,
  'vertical-2': <Columns2 className="w-3.5 h-3.5" />,
  'grid-2x2': <Grid2x2 className="w-3.5 h-3.5" />,
  'grid-2x3': <LayoutGrid className="w-3.5 h-3.5" />,
  'grid-3x2': <LayoutGrid className="w-3.5 h-3.5" />,
  'grid-3x3': <LayoutGrid className="w-3.5 h-3.5" />,
  'puzzle-2-rows': <Puzzle className="w-3.5 h-3.5" />,
  'puzzle-2-cols': <Puzzle className="w-3.5 h-3.5" />,
  'puzzle-3-rows': <Puzzle className="w-3.5 h-3.5" />,
  'puzzle-3-cols': <Puzzle className="w-3.5 h-3.5" />,
  'one-big-right': <LayoutGrid className="w-3.5 h-3.5" />,
  'one-big-bottom': <LayoutGrid className="w-3.5 h-3.5" />,
  'one-big-left': <LayoutGrid className="w-3.5 h-3.5" />,
  'one-big-top': <LayoutGrid className="w-3.5 h-3.5" />,
};

const ACCEPT_FORMATS = '.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.ico,.tiff,.tif,.avif,.apng';

interface ImageCollageNodeData {
  type: 'imageCollage';
  label?: string;
  isExpanded?: boolean;
  params: CollageLayoutParams;
  resultUrl?: string;
  isProcessing?: boolean;
}

function normalizeCollageParams(value?: Partial<CollageLayoutParams> | null): CollageLayoutParams {
  return {
    ...COLLAGE_DEFAULT_PARAMS,
    ...(value || {}),
    presetId: value?.presetId ?? COLLAGE_DEFAULT_PARAMS.presetId,
    aspectRatio: value?.aspectRatio ?? COLLAGE_DEFAULT_PARAMS.aspectRatio,
    exportResolution: value?.exportResolution ?? COLLAGE_DEFAULT_PARAMS.exportResolution,
    items: Array.isArray(value?.items) ? value.items : [],
    textOverlays: Array.isArray(value?.textOverlays) ? value.textOverlays : [],
  };
}

const ImageCollageNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as any as ImageCollageNodeData & {
    embeddedInAicgImage?: boolean;
    collageParams?: CollageLayoutParams;
    collageResultUrl?: string;
  };
  const embeddedInAicgImage = Boolean(nodeData.embeddedInAicgImage);
  const updateNodeData = canvasStoreApi.updateNodeData;
  const deleteNode = canvasStoreApi.deleteNode;

  const readCollageParams = (): CollageLayoutParams =>
    normalizeCollageParams(embeddedInAicgImage ? nodeData.collageParams : nodeData.params);

  const readCollageResultUrl = (): string =>
    (embeddedInAicgImage ? nodeData.collageResultUrl : nodeData.resultUrl) ?? '';

  const patchCollageNodeData = useCallback(
    (patch: Record<string, unknown>) => {
      if (!embeddedInAicgImage) {
        updateNodeData(id as string, patch);
        return;
      }
      const mapped: Record<string, unknown> = { ...patch };
      if ('params' in mapped) {
        mapped.collageParams = mapped.params;
        delete mapped.params;
      }
      if ('resultUrl' in mapped) {
        mapped.collageResultUrl = mapped.resultUrl;
      }
      updateNodeData(id as string, mapped);
    },
    [embeddedInAicgImage, id, updateNodeData],
  );

  const [params, setParams] = useState<CollageLayoutParams>(readCollageParams());
  const [resultUrl, setResultUrl] = useState<string>(readCollageResultUrl());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showTextPanel, setShowTextPanel] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showDetailPanels, setShowDetailPanels] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeSlotForText, setActiveSlotForText] = useState<number | undefined>(undefined);
  const [activeSlotForFilters, setActiveSlotForFilters] = useState<number>(0);
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [templates, setTemplates] = useState<CollageTemplate[]>([]);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [uniformRadius, setUniformRadius] = useState(true);
  const [isControllerCollapsed, setIsControllerCollapsed] = useState(false);
  const [shiftDragging, setShiftDragging] = useState<{ slotIndex: number; startX: number; startY: number; origOffsetX: number; origOffsetY: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(320);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storeEdges = useStore((s) => s.edges);
  const storeNodes = useStore((s) => s.nodes);

  useEffect(() => {
    if (previewContainerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setPreviewWidth(entry.contentRect.width);
        }
      });
      observer.observe(previewContainerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    setParams(readCollageParams());
    setResultUrl(readCollageResultUrl());
  }, [nodeData.params, nodeData.collageParams, nodeData.resultUrl, nodeData.collageResultUrl, embeddedInAicgImage]);

  useEffect(() => {
    const incomingEdges = storeEdges.filter((e) => e.target === id);
    if (incomingEdges.length === 0) return;

    const newUrls: string[] = [];
    for (const edge of incomingEdges) {
      const sourceNode = storeNodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;
      const srcData = sourceNode.data as Record<string, unknown>;
      const url = (srcData.imageUrl as string) || (srcData.resultUrl as string);
      if (url) newUrls.push(url);
    }

    if (newUrls.length === 0) return;

    setParams((prev) => {
      const preset = getLayoutPreset(prev.presetId);
      const items = [...prev.items];
      let changed = false;
      for (let i = 0; i < newUrls.length; i++) {
        const slotIndex = items.findIndex((it, idx) => !it.imageUrl && idx < preset.maxImages);
        const targetIndex = slotIndex >= 0 ? slotIndex : items.length;
        if (targetIndex >= preset.maxImages) break;
        while (items.length <= targetIndex) {
          items.push({ id: generateCollageItemId(), imageUrl: '' });
        }
        if (!items[targetIndex].imageUrl) {
          items[targetIndex] = { ...items[targetIndex], imageUrl: newUrls[i] };
          changed = true;
        }
      }
      if (!changed) return prev;
      const next = { ...prev, items };
      patchCollageNodeData({ params: next } as any as Record<string, unknown>);
      return next;
    });
  }, [storeEdges, storeNodes, id]);

  const updateParams = useCallback(
    (updates: Partial<CollageLayoutParams>) => {
      setParams((prev) => {
        const next = { ...prev, ...updates };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id, updateNodeData],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteNode(id as string);
    },
    [id, deleteNode],
  );

  const handleAddImage = useCallback(
    (slotIndex: number, file?: File) => {
      const processFile = async (f: File) => {
        try {
          const base64Url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(f);
          });

          let imageAssetId: string | undefined;
          let finalUrl = base64Url;

          try {
            const persisted = await persistImportedCanvasFile({
              nodeId: id as string,
              kind: 'image',
              file: f,
              role: 'primary',
              source: 'imported',
            });
            imageAssetId = persisted.asset.id;
            if (persisted.runtimeUrl && !persisted.runtimeUrl.startsWith('blob:')) {
              finalUrl = persisted.runtimeUrl;
            }
          } catch {
            // fallback to base64
          }

          const newItem: CollageItem = {
            id: generateCollageItemId(),
            imageUrl: finalUrl,
            imageAssetId,
          };

          setParams((prev) => {
            const items = [...prev.items];
            while (items.length <= slotIndex) {
              items.push({ id: generateCollageItemId(), imageUrl: '' });
            }
            items[slotIndex] = newItem;
            const next = { ...prev, items };
            patchCollageNodeData({ params: next } as any as Record<string, unknown>);
            return next;
          });
        } catch (err) {
          console.error('[ImageCollageNode] 加载图片失败:', err);
          toast.error('图片加载失败');
        }
      };

      if (file) {
        void processFile(file);
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT_FORMATS;
      input.onchange = async (e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) await processFile(f);
      };
      input.click();
    },
    [id],
  );

  const handleBatchImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_FORMATS;
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      const preset = getLayoutPreset(params.presetId);
      let slotIndex = 0;
      for (const file of files) {
        while (slotIndex < params.items.length && params.items[slotIndex]?.imageUrl) {
          slotIndex++;
        }
        if (slotIndex >= preset.maxImages) break;
        await handleAddImage(slotIndex, file);
        slotIndex++;
      }
    };
    input.click();
  }, [params.presetId, params.items, handleAddImage]);

  const handleRemoveImage = useCallback(
    (slotIndex: number) => {
      setParams((prev) => {
        const items = [...prev.items];
        if (items[slotIndex]) {
          items[slotIndex] = { id: items[slotIndex].id, imageUrl: '' };
        }
        const next = { ...prev, items };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const handleSwapImages = useCallback(
    (fromIndex: number, toIndex: number) => {
      setParams((prev) => {
        const items = [...prev.items];
        const temp = items[fromIndex];
        items[fromIndex] = items[toIndex] ?? { id: generateCollageItemId(), imageUrl: '' };
        items[toIndex] = temp ?? { id: generateCollageItemId(), imageUrl: '' };
        const next = { ...prev, items };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const handleDragStart = useCallback((e: React.DragEvent, slotIndex: number) => {
    e.dataTransfer.setData('text/plain', String(slotIndex));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSlotIndex(slotIndex);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = Number(e.dataTransfer.getData('text/plain'));
      if (!Number.isNaN(fromIndex) && fromIndex !== toIndex) {
        handleSwapImages(fromIndex, toIndex);
      }
      setDraggedSlotIndex(null);
    },
    [handleSwapImages],
  );

  const handleSlotWheel = useCallback(
    (e: React.WheelEvent, slotIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setParams((prev) => {
        const items = [...prev.items];
        if (!items[slotIndex]) return prev;
        const newScale = Math.max(0.5, Math.min(3, (items[slotIndex].scale ?? 1) + delta));
        items[slotIndex] = { ...items[slotIndex], scale: newScale };
        const next = { ...prev, items };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const handleSlotMouseDown = useCallback(
    (e: React.MouseEvent, slotIndex: number) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      const item = params.items[slotIndex];
      if (!item?.imageUrl) return;
      setShiftDragging({
        slotIndex,
        startX: e.clientX,
        startY: e.clientY,
        origOffsetX: item.offsetX ?? 0,
        origOffsetY: item.offsetY ?? 0,
      });
    },
    [params.items],
  );

  useEffect(() => {
    if (!shiftDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setShiftDragging((prev) => {
        if (!prev) return null;
        const dx = e.clientX - prev.startX;
        const dy = e.clientY - prev.startY;
        setParams((p) => {
          const items = [...p.items];
          if (!items[prev.slotIndex]) return p;
          items[prev.slotIndex] = {
            ...items[prev.slotIndex],
            offsetX: prev.origOffsetX + dx,
            offsetY: prev.origOffsetY + dy,
          };
          const next = { ...p, items };
          patchCollageNodeData({ params: next } as any as Record<string, unknown>);
          return next;
        });
        return prev;
      });
    };
    const handleMouseUp = () => setShiftDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [shiftDragging, id]);

  const handleExport = useCallback(async () => {
    const preset = getLayoutPreset(params.presetId);
    const filledCount = params.items.filter((item) => item.imageUrl).length;
    if (filledCount < preset.minImages) {
      toast.error(`至少需要 ${preset.minImages} 张图片`);
      return;
    }

    setIsProcessing(true);
    try {
      const blobUrl = await renderCollageToBlob(params);

      // 先将 blob URL 转换为 data URL 作为兜底（刷新后仍然可用）
      let finalUrl = blobUrl;
      if (blobUrl.startsWith('blob:')) {
        try {
          const resp = await fetch(blobUrl);
          const blob = await resp.blob();
          finalUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(blob);
          });
        } catch {
          // 转换失败时保留原 blob URL
          finalUrl = blobUrl;
        }
      }

      // 上传到后端获取持久化 URL（刷新后仍然可用）
      try {
        const persisted = await persistGeneratedCanvasUrl({
          nodeId: id as string,
          kind: 'image',
          url: blobUrl,
          fileName: `collage_${params.presetId}_${Date.now()}.png`,
          role: 'primary',
        });
        if (persisted.runtimeUrl && !persisted.runtimeUrl.startsWith('blob:')) {
          finalUrl = persisted.runtimeUrl;
        }
      } catch (err) {
        console.warn('[ImageCollageNode] 持久化失败，使用 data URL 兜底:', err);
      }

      setResultUrl(finalUrl);
      patchCollageNodeData({
        resultUrl: finalUrl,
        isProcessing: false,
      } as any as Record<string, unknown>);

      // 同步下游节点
      syncDownstreamFromNode(id as string);

      toast.success('拼图导出成功');
    } catch (err) {
      console.error('[ImageCollageNode] 导出失败:', err);
      toast.error('拼图导出失败');
    } finally {
      setIsProcessing(false);
    }
  }, [params, id, patchCollageNodeData]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (resultUrl) {
        const link = document.createElement('a');
        link.href = resultUrl;
        link.download = `collage_${params.presetId}_${Date.now()}.png`;
        link.click();
      }
    },
    [resultUrl, params.presetId],
  );

  const handleLayoutChange = useCallback(
    (presetId: CollageLayoutPresetId) => {
      const preset = getLayoutPreset(presetId);
      setParams((prev) => {
        const items = [...prev.items];
        while (items.length < preset.minImages) {
          items.push({ id: generateCollageItemId(), imageUrl: '' });
        }
        const next = { ...prev, presetId, items };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
      setShowPresetPicker(false);
    },
    [id],
  );

  const updateItemFitMode = useCallback(
    (slotIndex: number, fitMode: CollageFitMode) => {
      setParams((prev) => {
        const items = [...prev.items];
        if (!items[slotIndex]) return prev;
        items[slotIndex] = { ...items[slotIndex], fitMode };
        const next = { ...prev, items };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const updateItemFilters = useCallback(
    (slotIndex: number, filters: CollageFilters) => {
      setParams((prev) => {
        const items = [...prev.items];
        if (!items[slotIndex]) return prev;
        items[slotIndex] = { ...items[slotIndex], filters };
        const next = { ...prev, items };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const addTextOverlay = useCallback(
    (overlay: Omit<CollageTextOverlay, 'id'>) => {
      setParams((prev) => {
        const textOverlays = [...(prev.textOverlays || [])];
        textOverlays.push({ ...overlay, id: generateCollageTextOverlayId() });
        const next = { ...prev, textOverlays };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const updateTextOverlay = useCallback(
    (textId: string, updates: Partial<CollageTextOverlay>) => {
      setParams((prev) => {
        const textOverlays = (prev.textOverlays || []).map((t) =>
          t.id === textId ? { ...t, ...updates } : t,
        );
        const next = { ...prev, textOverlays };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const removeTextOverlay = useCallback(
    (textId: string) => {
      setParams((prev) => {
        const textOverlays = (prev.textOverlays || []).filter((t) => t.id !== textId);
        const next = { ...prev, textOverlays };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
    },
    [id],
  );

  const handleSaveTemplate = useCallback(() => {
    if (!templateNameInput.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    saveTemplate(templateNameInput.trim(), params);
    setTemplates(loadTemplates());
    setTemplateNameInput('');
    toast.success('模板已保存');
  }, [templateNameInput, params]);

  const handleLoadTemplate = useCallback(
    (tpl: CollageTemplate) => {
      setParams((prev) => {
        const next = { ...tpl.params };
        patchCollageNodeData({ params: next } as any as Record<string, unknown>);
        return next;
      });
      setShowTemplateManager(false);
      toast.success(`已加载模板: ${tpl.name}`);
    },
    [id],
  );

  const handleDeleteTemplate = useCallback((tplId: string) => {
    deleteTemplate(tplId);
    setTemplates(loadTemplates());
  }, []);

  useEffect(() => {
    if (showTemplateManager) {
      setTemplates(loadTemplates());
    }
  }, [showTemplateManager]);

  const previewLayout = useMemo(
    () => resolveCollagePreviewLayout(params, previewWidth),
    [params, previewWidth],
  );

  const currentPreset = getLayoutPreset(params.presetId);
  const aspectLabel =
    COLLAGE_ASPECT_RATIO_OPTIONS.find((o) => o.value === params.aspectRatio)?.label ??
    params.aspectRatio;

  const getImageStyle = (item?: CollageItem) => {
    if (!item?.imageUrl) return {};
    const filters = item.filters;
    const filterParts: string[] = [];
    if (filters?.brightness !== undefined) filterParts.push(`brightness(${filters.brightness}%)`);
    if (filters?.contrast !== undefined) filterParts.push(`contrast(${filters.contrast}%)`);
    if (filters?.saturation !== undefined) filterParts.push(`saturate(${filters.saturation}%)`);
    if (filters?.blur !== undefined) filterParts.push(`blur(${filters.blur}px)`);
    if (filters?.grayscale !== undefined) filterParts.push(`grayscale(${filters.grayscale}%)`);
    if (filters?.sepia !== undefined) filterParts.push(`sepia(${filters.sepia}%)`);

    const fitMode = item.fitMode || 'cover';
    let objectFit: 'cover' | 'contain' | 'fill' = 'cover';
    if (fitMode === 'contain') objectFit = 'contain';
    if (fitMode === 'fill') objectFit = 'fill';

    return {
      objectFit,
      filter: filterParts.join(' ') || undefined,
      transform: `translate(${item.offsetX ?? 0}px, ${item.offsetY ?? 0}px) scale(${item.scale ?? 1})`,
      transformOrigin: 'center center',
    } as React.CSSProperties;
  };

  const toolbarBtnClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70';

  return (
    <div
      className="group relative flex flex-col overflow-visible select-none border-0 outline-none"
      style={embeddedInAicgImage ? undefined : { width: 400, minHeight: 360 }}
    >
      {!embeddedInAicgImage && (
        <AICGUnifiedIOHandles
          nodeId={id as string}
          nodeType="imageCollage"
          inputTip="图片输入"
          outputTip="拼图输出"
          menuTop="45%"
        />
      )}

      <AICGNodeShell
        aicgType="tool"
        title="图片拼图"
        subtitle={`${currentPreset.label} · ${aspectLabel}`}
        selected={selected}
        width={embeddedInAicgImage ? '100%' : 400}
        chromeless={embeddedInAicgImage}
        onDelete={embeddedInAicgImage ? undefined : () => deleteNode(id as string)}
        onControllerCollapse={embeddedInAicgImage ? undefined : () => setIsControllerCollapsed(true)}
        controlsCollapsed={isControllerCollapsed}
        bodyClassName="p-0"
      >
      {/* 主展示区 — 半透明 */}
      <div
        className={cn(
          'relative flex min-h-[220px] flex-1 flex-col transition-colors',
          selected && 'bg-white/[0.015]',
        )}
      >
        <div className="p-3">
          <div
            ref={previewContainerRef}
            className="relative w-full overflow-hidden rounded-[12px] border border-white/10 bg-black/20"
            style={{
              height: previewLayout.containerHeight,
              background:
                params.background === 'transparent'
                  ? 'repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%) 50% / 10px 10px'
                  : params.background,
            }}
          >
          {previewLayout.slots.map((slot, i) => {
            const item = params.items[i];
            const hasImage = item?.imageUrl;
            const slotRadius = params.slotBorderRadius?.[i] ?? params.borderRadius;

            return (
              <div
                key={`slot-${i}`}
                className={cn(
                  'absolute overflow-hidden group/slot',
                  draggedSlotIndex === i && 'opacity-50',
                )}
                style={{
                  left: slot.x,
                  top: slot.y,
                  width: slot.width,
                  height: slot.height,
                  borderRadius: Math.max(2, slotRadius * 0.35),
                  boxShadow:
                    params.shadowBlur && params.shadowBlur > 0
                      ? `${params.shadowOffsetX || 0}px ${params.shadowOffsetY || 0}px ${params.shadowBlur}px ${params.shadowColor || 'rgba(0,0,0,0.3)'}`
                      : undefined,
                }}
                draggable={!!hasImage}
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, i)}
                onWheel={(e) => handleSlotWheel(e, i)}
                onMouseDown={(e) => handleSlotMouseDown(e, i)}
              >
                {hasImage ? (
                  <>
                    <img
                      src={getSafeRenderableMediaUrl(item.imageUrl)}
                      alt={`slot-${i}`}
                      className="w-full h-full pointer-events-none"
                      draggable={false}
                      style={getImageStyle(item)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/slot:bg-black/40 transition-colors">
                      <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover/slot:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddImage(i);
                          }}
                          className="p-1 rounded-full bg-black/50 hover:bg-white/20 text-white text-[9px]"
                          title="替换"
                        >
                          <ImageIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(i);
                          }}
                          className="p-1 rounded-full bg-black/50 hover:bg-red-500/50 text-white text-[9px]"
                          title="移除"
                        >
                          <CloseIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSlotForFilters(i);
                            setShowFiltersPanel(true);
                          }}
                          className="p-1 rounded-full bg-black/50 hover:bg-white/20 text-white text-[9px]"
                          title="滤镜"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {/* Fit mode badge */}
                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/50 text-[8px] text-white/70 opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-events-none">
                      {item.fitMode || 'cover'}
                    </div>
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddImage(i);
                    }}
                    className="h-full w-full border border-dashed border-white/25 bg-transparent transition-colors hover:border-white/40 hover:bg-white/[0.03]"
                    style={{ borderRadius: Math.max(2, slotRadius * 0.35) }}
                    aria-label="添加图片"
                  />
                )}
              </div>
            );
          })}

          {isProcessing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
              <span className="text-[10px] text-white">渲染中...</span>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* 底部控制器 — 半透明，与生成文本节点一致 */}
      {!isControllerCollapsed ? (
      <div
        className={cn(
          'nodrag nowheel relative mt-3 rounded-[14px] border border-white/[0.08] bg-[#141418]/80 backdrop-blur-xl',
          'shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className="flex items-center gap-2 px-2.5 py-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPresetPicker(!showPresetPicker);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/75',
              showPresetPicker && 'bg-white/10 text-white/80',
            )}
          >
            <Grid2x2 className="h-3.5 w-3.5" />
            <span>{currentPreset.label}</span>
          </button>

          <div className="mx-1 h-4 w-px shrink-0 bg-white/10" />

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              className={cn(toolbarBtnClass, showSettings && 'bg-white/10 text-white/70')}
              title="设置"
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
                setShowDetailPanels(true);
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={toolbarBtnClass}
              title="模板"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailPanels(true);
                setShowSettings(true);
                setShowTemplateManager(!showTemplateManager);
              }}
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={toolbarBtnClass}
              title="文字"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailPanels(true);
                setShowSettings(true);
                setShowTextPanel(!showTextPanel);
              }}
            >
              <Type className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={toolbarBtnClass}
              title="批量导入"
              onClick={(e) => {
                e.stopPropagation();
                handleBatchImport();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={toolbarBtnClass}
              title="生成拼图"
              disabled={isProcessing}
              onClick={(e) => {
                e.stopPropagation();
                handleExport();
              }}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
              )}
            </button>
            <button
              type="button"
              className={cn(toolbarBtnClass, showDetailPanels && 'bg-white/10 text-white/70')}
              title={showDetailPanels ? '收起' : '更多'}
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailPanels(!showDetailPanels);
              }}
            >
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', showDetailPanels && 'rotate-180')}
              />
            </button>
          </div>
        </div>

        {showPresetPicker && (
          <div className="mx-2.5 mb-2 grid max-h-[160px] grid-cols-3 gap-1 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5">
            {COLLAGE_LAYOUT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLayoutChange(preset.id);
                }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                  params.presetId === preset.id
                    ? 'border-white/20 bg-white/10 text-white/85'
                    : 'border-transparent text-white/50 hover:bg-white/[0.06]',
                )}
              >
                {PRESET_ICONS[preset.id] ?? <Grid2x2 className="h-3 w-3" />}
                <span className="w-full truncate text-center">{preset.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Settings Panel */}
        {showDetailPanels && showSettings && (
          <div className="max-h-[360px] space-y-3 overflow-y-auto border-t border-white/[0.06] px-2.5 py-2">
            {/* Batch Import */}
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBatchImport();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[11px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                批量导入
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTextPanel(!showTextPanel);
                }}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors',
                  showTextPanel ? 'bg-white/[0.08] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10',
                )}
              >
                <Type className="w-3.5 h-3.5" />
                文字
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTemplateManager(!showTemplateManager);
                }}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors',
                  showTemplateManager ? 'bg-white/[0.08] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10',
                )}
              >
                <Save className="w-3.5 h-3.5" />
                模板
              </button>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1">
              <label className="text-[10px] text-white/40">画幅比例</label>
              <div className="flex flex-wrap gap-1">
                {COLLAGE_ASPECT_RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateParams({ aspectRatio: opt.value as CollageAspectRatio });
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded text-[9px] transition-colors',
                      params.aspectRatio === opt.value
                        ? 'bg-white/[0.08] text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background */}
            <div className="space-y-1">
              <label className="text-[10px] text-white/40">背景颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={params.background === 'transparent' ? '#00000000' : params.background}
                  onChange={(e) => {
                    updateParams({ background: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <div className="flex gap-1">
                  {['transparent', '#000000', '#1a1a2e', '#ffffff', '#f5f5f5', '#ff6b6b', '#4ecdc4', '#ffe66d'].map(
                    (color) => (
                      <button
                        key={color}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateParams({ background: color });
                        }}
                        className={cn(
                          'w-6 h-6 rounded border-2 transition-colors',
                          params.background === color ? 'border-white/70' : 'border-white/10 hover:border-white/30',
                        )}
                        style={{
                          background:
                            color === 'transparent'
                              ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px'
                              : color,
                        }}
                        title={color}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* Gap X / Gap Y */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-white/40">横向间距</label>
                  <span className="text-[9px] text-white/30 font-mono">{params.gapX ?? params.gap}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={64}
                  step={2}
                  value={params.gapX ?? params.gap}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateParams({ gapX: Number(e.target.value) });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-white/40">纵向间距</label>
                  <span className="text-[9px] text-white/30 font-mono">{params.gapY ?? params.gap}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={64}
                  step={2}
                  value={params.gapY ?? params.gap}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateParams({ gapY: Number(e.target.value) });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>

            {/* Padding */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/40">内边距</label>
                <span className="text-[9px] text-white/30 font-mono">{params.padding}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={48}
                step={4}
                value={params.padding}
                onChange={(e) => {
                  e.stopPropagation();
                  updateParams({ padding: Number(e.target.value) });
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Border Radius */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/40">圆角</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUniformRadius(!uniformRadius);
                    }}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded transition-colors',
                      uniformRadius ? 'bg-white/[0.08] text-white' : 'bg-white/5 text-white/40',
                    )}
                  >
                    {uniformRadius ? '统一' : '独立'}
                  </button>
                  <span className="text-[9px] text-white/30 font-mono">{params.borderRadius}px</span>
                </div>
              </div>
              {uniformRadius ? (
                <input
                  type="range"
                  min={0}
                  max={64}
                  step={2}
                  value={params.borderRadius}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateParams({ borderRadius: Number(e.target.value) });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: currentPreset.maxImages }, (_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-[8px] text-white/30">{i + 1}</span>
                      <input
                        type="range"
                        min={0}
                        max={64}
                        step={2}
                        value={params.slotBorderRadius?.[i] ?? params.borderRadius}
                        onChange={(e) => {
                          e.stopPropagation();
                          const arr = [...(params.slotBorderRadius || Array(currentPreset.maxImages).fill(params.borderRadius))];
                          arr[i] = Number(e.target.value);
                          updateParams({ slotBorderRadius: arr });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Border & Shadow */}
            <div className="space-y-2 border border-white/5 rounded-lg p-2">
              <label className="text-[10px] text-white/40">边框与阴影</label>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/30">边框宽度</span>
                  <span className="text-[9px] text-white/30 font-mono">{params.borderWidth ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={params.borderWidth ?? 0}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateParams({ borderWidth: Number(e.target.value) });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/30">边框颜色</span>
                <input
                  type="color"
                  value={params.borderColor || '#ffffff'}
                  onChange={(e) => updateParams({ borderColor: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/30">阴影模糊</span>
                  <span className="text-[9px] text-white/30 font-mono">{params.shadowBlur ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={48}
                  step={2}
                  value={params.shadowBlur ?? 0}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateParams({ shadowBlur: Number(e.target.value) });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/30">阴影颜色</span>
                <input
                  type="color"
                  value={params.shadowColor || 'rgba(0,0,0,0.3)'}
                  onChange={(e) => updateParams({ shadowColor: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] text-white/30">阴影X偏移</span>
                  <input
                    type="number"
                    value={params.shadowOffsetX ?? 0}
                    onChange={(e) => updateParams({ shadowOffsetX: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 rounded bg-white/5 text-white/70 text-[10px] border border-white/10"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-white/30">阴影Y偏移</span>
                  <input
                    type="number"
                    value={params.shadowOffsetY ?? 0}
                    onChange={(e) => updateParams({ shadowOffsetY: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 rounded bg-white/5 text-white/70 text-[10px] border border-white/10"
                  />
                </div>
              </div>
            </div>

            {/* Export Resolution */}
            <div className="space-y-1">
              <label className="text-[10px] text-white/40">导出分辨率</label>
              <div className="flex gap-1">
                {COLLAGE_EXPORT_RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateParams({ exportResolution: opt.value as CollageExportResolution });
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded text-[9px] transition-colors',
                      params.exportResolution === opt.value
                        ? 'bg-white/[0.08] text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Animate */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-white/40">导出动画</label>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateParams({ animate: !params.animate });
                }}
                className={cn(
                  'px-2 py-0.5 rounded text-[9px] transition-colors',
                  params.animate ? 'bg-white/[0.08] text-white' : 'bg-white/5 text-white/50',
                )}
              >
                {params.animate ? '启用' : '关闭'}
              </button>
            </div>

            {/* Template Manager Panel */}
            {showTemplateManager && (
              <div className="border border-white/5 rounded-lg p-2 space-y-2">
                <label className="text-[10px] text-white/40">模板管理</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="模板名称"
                    value={templateNameInput}
                    onChange={(e) => {
                      e.stopPropagation();
                      setTemplateNameInput(e.target.value);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    onInput={(e) => e.stopPropagation()}
                    onBeforeInput={(e) => e.stopPropagation()}
                    onCompositionStart={(e) => e.stopPropagation()}
                    onCompositionEnd={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                    className="nodrag nowheel flex-1 px-2 py-1 rounded bg-white/5 text-white/70 text-[10px] border border-white/10 placeholder:text-white/20 select-text"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveTemplate();
                    }}
                    className="px-2 py-1 rounded bg-white/[0.08] text-white/72 text-[10px] hover:bg-white/[0.12]"
                  >
                    保存
                  </button>
                </div>
                <div className="max-h-[120px] overflow-y-auto space-y-1">
                  {templates.length === 0 && (
                    <div className="text-[10px] text-white/20 text-center py-2">暂无保存的模板</div>
                  )}
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex items-center justify-between px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <span className="text-[10px] text-white/60 truncate">{tpl.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadTemplate(tpl);
                          }}
                          className="p-0.5 rounded hover:bg-white/10 text-white/40"
                          title="加载"
                        >
                          <FolderOpen className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(tpl.id);
                          }}
                          className="p-0.5 rounded hover:bg-red-500/20 text-white/40"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text Overlay Panel */}
            {showTextPanel && (
              <div className="border border-white/5 rounded-lg p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-white/40">文字叠加层</label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addTextOverlay({
                        text: '新文字',
                        fontSize: 24,
                        fontColor: '#ffffff',
                        x: 50,
                        y: 50,
                        align: 'left',
                        slotIndex: activeSlotForText,
                      });
                    }}
                    className="px-2 py-0.5 rounded bg-white/[0.08] text-white/72 text-[10px] hover:bg-white/[0.12]"
                  >
                    添加文字
                  </button>
                </div>
                <div className="space-y-1">
                  {(params.textOverlays || []).map((overlay) => (
                    <div key={overlay.id} className="space-y-1 border border-white/5 rounded p-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={overlay.text}
                          onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1 rounded bg-white/5 text-white/70 text-[10px] border border-white/10"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTextOverlay(overlay.id);
                          }}
                          className="p-0.5 rounded hover:bg-red-500/20 text-white/40"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-white/30">字号</span>
                          <input
                            type="number"
                            value={overlay.fontSize ?? 24}
                            onChange={(e) => updateTextOverlay(overlay.id, { fontSize: Number(e.target.value) })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-14 px-1 py-0.5 rounded bg-white/5 text-white/70 text-[9px] border border-white/10"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-white/30">颜色</span>
                          <input
                            type="color"
                            value={overlay.fontColor || '#ffffff'}
                            onChange={(e) => updateTextOverlay(overlay.id, { fontColor: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-white/30">X</span>
                          <input
                            type="number"
                            value={overlay.x}
                            onChange={(e) => updateTextOverlay(overlay.id, { x: Number(e.target.value) })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-14 px-1 py-0.5 rounded bg-white/5 text-white/70 text-[9px] border border-white/10"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-white/30">Y</span>
                          <input
                            type="number"
                            value={overlay.y}
                            onChange={(e) => updateTextOverlay(overlay.id, { y: Number(e.target.value) })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-14 px-1 py-0.5 rounded bg-white/5 text-white/70 text-[9px] border border-white/10"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTextOverlay(overlay.id, { align });
                            }}
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[8px] transition-colors',
                              overlay.align === align
                                ? 'bg-white/[0.08] text-white'
                                : 'bg-white/5 text-white/40 hover:bg-white/10',
                            )}
                          >
                            {align === 'left' && <AlignLeft className="w-2.5 h-2.5" />}
                            {align === 'center' && <AlignCenter className="w-2.5 h-2.5" />}
                            {align === 'right' && <AlignRight className="w-2.5 h-2.5" />}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-white/30">槽位</span>
                        <select
                          value={overlay.slotIndex ?? ''}
                          onChange={(e) =>
                            updateTextOverlay(overlay.id, {
                              slotIndex: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="px-1 py-0.5 rounded bg-white/5 text-white/70 text-[9px] border border-white/10"
                        >
                          <option value="">全局</option>
                          {Array.from({ length: currentPreset.maxImages }, (_, i) => (
                            <option key={i} value={i}>
                              槽位 {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters Panel */}
        {showDetailPanels && showFiltersPanel && (
          <div className="space-y-2 border-t border-white/[0.06] px-2.5 py-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-white/40">
                槽位 {activeSlotForFilters + 1} 滤镜
              </label>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFiltersPanel(false);
                }}
                className="p-0.5 rounded hover:bg-white/10 text-white/40"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            </div>
            {(() => {
              const item = params.items[activeSlotForFilters];
              const filters = item?.filters || {};
              const setFilter = (key: keyof CollageFilters, value: number) => {
                updateItemFilters(activeSlotForFilters, { ...filters, [key]: value });
              };
              return (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'brightness' as const, label: '亮度', icon: Sun, min: 0, max: 200, default: 100 },
                    { key: 'contrast' as const, label: '对比度', icon: Contrast, min: 0, max: 200, default: 100 },
                    { key: 'saturation' as const, label: '饱和度', icon: Droplets, min: 0, max: 200, default: 100 },
                    { key: 'blur' as const, label: '模糊', icon: Droplet, min: 0, max: 20, default: 0 },
                    { key: 'grayscale' as const, label: '灰度', icon: Palette, min: 0, max: 100, default: 0 },
                    { key: 'sepia' as const, label: '复古', icon: Aperture, min: 0, max: 100, default: 0 },
                  ].map(({ key, label, icon: Icon, min, max, default: def }) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Icon className="w-3 h-3 text-white/30" />
                          <span className="text-[9px] text-white/30">{label}</span>
                        </div>
                        <span className="text-[9px] text-white/30 font-mono">{filters[key] ?? def}</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={key === 'blur' ? 0.5 : 1}
                        value={filters[key] ?? def}
                        onChange={(e) => setFilter(key, Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  ))}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateItemFilters(activeSlotForFilters, {});
                    }}
                    className="col-span-2 px-2 py-1 rounded bg-white/5 text-white/50 text-[10px] hover:bg-white/10 transition-colors"
                  >
                    重置滤镜
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Fit Mode Selector for each slot */}
        {showDetailPanels && (
        <div className="border-t border-white/[0.06] px-2.5 py-2">
          <div className="flex flex-wrap gap-1">
            {params.items.map((item, i) =>
              item.imageUrl ? (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[8px] text-white/30">{i + 1}</span>
                  <select
                    value={item.fitMode || 'cover'}
                    onChange={(e) => updateItemFitMode(i, e.target.value as CollageFitMode)}
                    onClick={(e) => e.stopPropagation()}
                    className="px-1 py-0.5 rounded bg-white/5 text-white/60 text-[9px] border border-white/10"
                  >
                    {COLLAGE_FIT_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null,
            )}
          </div>
        </div>
        )}

        {/* Action Bar */}
        {showDetailPanels && (
        <div className="flex items-center gap-2 border-t border-white/[0.06] px-2.5 py-2">
          <NodePointsBadge points={1} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExport();
            }}
            disabled={isProcessing}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              isProcessing
                ? 'bg-white/[0.04] text-white/35 cursor-not-allowed'
                : 'bg-white/[0.08] text-white hover:bg-white/[0.12] active:scale-[0.98]',
            )}
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Grid2x2 className="w-3.5 h-3.5" />
            )}
            {isProcessing ? '渲染中...' : '生成拼图'}
          </button>

          {resultUrl && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(true);
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                title="预览"
              >
                <Maximize2 className="w-3.5 h-3.5 text-white/50" />
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                title="下载"
              >
                <Download className="w-3.5 h-3.5 text-white/50" />
              </button>
            </>
          )}
        </div>
        )}

        {/* Result Preview Thumbnail */}
        {showDetailPanels && resultUrl && !showPreview && (
          <div className="px-2.5 pb-2">
            <div
              className="relative rounded-lg overflow-hidden border border-white/10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(true);
              }}
            >
              <img
                src={normalizeMediaUrl(resultUrl)}
                alt="拼图结果"
                className="w-full h-auto max-h-[200px] object-contain bg-black/30"
              />
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px] text-white/60">
                点击预览
              </div>
            </div>
          </div>
        )}
      </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsControllerCollapsed(false);
          }}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[11px] text-white/60 hover:bg-white/[0.08] hover:text-white/80"
        >
          展开控制面板
        </button>
      )}
      </AICGNodeShell>

      {showPreview && resultUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black backdrop-blur-xl animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(false);
            }}
          >
            <div className="relative w-screen h-screen flex items-center justify-center">
              <img
                src={normalizeMediaUrl(resultUrl)}
                alt="拼图预览"
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(false);
                }}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 z-50"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
              <button
                onClick={handleDownload}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-black/50 hover:bg-black/70 text-white text-sm font-medium flex items-center gap-2 transition-all hover:scale-105 active:scale-95 backdrop-blur-md z-50"
              >
                <Download className="w-4 h-4" />
                下载拼图
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});

ImageCollageNode.displayName = 'ImageCollageNode';

export default ImageCollageNode;
