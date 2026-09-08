import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Position, type NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { aicgGlass } from './aicg-node-glass';
import { cn } from '@/lib/utils';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';
import { NodePointsBadge } from './NodePointsBadge';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { toast } from 'sonner';
import {
  buildGridCellOutputPatch,
  getGridCellCrop,
  getGridSplitterLayoutDimensions,
  GRID_SPLITTER_LAYOUT_OPTIONS,
} from './grid-splitter-layout';
import {
  X as CloseIcon,
  Grid3x3 as GridIcon,
  Scissors,
  Loader2 as LoaderIcon,
  Send,
  Download,
  Image as ImageIcon,
  Plus,
  RotateCcw,
} from 'lucide-react';

export interface GridCell {
  index: number;
  dataUrl: string;
  row: number;
  col: number;
  selected: boolean;
  bounds: { x: number; y: number; w: number; h: number };
}

export interface GridSplitterNodeData {
  sourceImage?: string;
  gridCells?: GridCell[];
  cols?: number;
  rows?: number;
  selectedCells?: number[];
  layout?: string;
  gap?: number;
  splitBackgroundColor?: string;
  autoSplit?: boolean;
  splitRequestedAt?: number;
  outputCellIndex?: number;
  imageUrl?: string;
  resultUrl?: string;
  outputImageUrl?: string;
  resultUrls?: string[];
  task?: {
    status?: string;
    progress?: number;
    error?: string;
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<string> {
  return Promise.resolve(canvas.toDataURL(type, quality));
}

async function splitImageToGrid(
  imageUrl: string,
  cols: number,
  rows: number,
  outputAspectRatio?: number,
): Promise<GridCell[]> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = imageUrl;
  });

  const cells: GridCell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const crop = getGridCellCrop({
        imageWidth: img.width,
        imageHeight: img.height,
        cols,
        rows,
        col: c,
        row: r,
        outputAspectRatio,
      });
      const cellCanvas = document.createElement('canvas');
      cellCanvas.width = crop.width;
      cellCanvas.height = crop.height;
      const ctx = cellCanvas.getContext('2d');
      if (!ctx) continue;

      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

      const dataUrl = await canvasToBlob(cellCanvas, 'image/jpeg', 0.92);
      cells.push({
        index: r * cols + c,
        dataUrl,
        row: r,
        col: c,
        selected: false,
        bounds: { x: crop.x, y: crop.y, w: crop.width, h: crop.height },
      });
    }
  }

  return cells;
}

const GridSplitterNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = (data || {}) as GridSplitterNodeData & { embeddedInAicgImage?: boolean };
  const embeddedInAicgImage = Boolean(nodeData.embeddedInAicgImage);
  const params = useMemo(
    () => ({
      cols: nodeData.cols ?? 3,
      rows: nodeData.rows ?? 3,
      layout: nodeData.layout ?? '3x3',
      gap: nodeData.gap ?? 2,
      splitBackgroundColor: nodeData.splitBackgroundColor ?? '#0a0a0a',
      selectedCells: nodeData.selectedCells ?? [],
    }),
    [nodeData.cols, nodeData.rows, nodeData.layout, nodeData.gap, nodeData.splitBackgroundColor, nodeData.selectedCells],
  );

  const [isExpanded, setIsExpanded] = useState(true);
  const [isGridEditMode, setIsGridEditMode] = useState(false);
  const [gridCells, setGridCells] = useState<GridCell[]>(nodeData.gridCells || []);
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set(params.selectedCells));
  const [isSplitting, setIsSplitting] = useState(false);
  const [inputImageUrl, setInputImageUrl] = useState<string | null>(nodeData.sourceImage || null);
  const [lastShiftIndex, setLastShiftIndex] = useState<number | null>(null);
  const [outputCellIndex, setOutputCellIndex] = useState<number | null>(
    nodeData.outputCellIndex ?? null,
  );
  const autoSplitKeyRef = useRef<string | null>(null);

  const storeNodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);

  const currentNode = useMemo(() => storeNodes.find((n) => n.id === id), [storeNodes, id]);
  const currentNodeData = (currentNode?.data || {}) as GridSplitterNodeData;

  const incomingImageUrl = useMemo(() => {
    const incomingEdge = edges.find((e) => e.target === id);
    if (!incomingEdge) return null;
    const sourceNode = storeNodes.find((n) => n.id === incomingEdge.source);
    if (!sourceNode) return null;
    const sourceData = sourceNode.data as Record<string, unknown>;
    const candidates = [
      sourceData.imageUrl,
      sourceData.resultUrl,
      Array.isArray(sourceData.resultUrls) ? sourceData.resultUrls[0] : null,
      sourceData.gridImageUrl,
      sourceData.url,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return null;
  }, [edges, id, storeNodes]);

  useEffect(() => {
    if (incomingImageUrl && incomingImageUrl !== inputImageUrl) {
      setInputImageUrl(incomingImageUrl);
      canvasStoreApi.updateNodeData(id as string, { sourceImage: incomingImageUrl });
    }
  }, [incomingImageUrl, id, inputImageUrl]);

  const updateParams = useCallback(
    (updates: Partial<GridSplitterNodeData>) => {
      canvasStoreApi.updateNodeData(id as string, updates);
    },
    [id],
  );

  const handleSplit = useCallback(async (options?: { silent?: boolean }) => {
    if (!inputImageUrl) {
      if (!options?.silent) toast.error('请先连接图片节点');
      return;
    }
    setIsSplitting(true);
    updateParams({ task: { status: 'processing', progress: 0 } });
    try {
      const outputAspectRatio = params.cols === 4 && params.rows === 3 ? 16 / 9 : undefined;
      const cells = await splitImageToGrid(inputImageUrl, params.cols, params.rows, outputAspectRatio);
      setGridCells(cells);
      setSelectedCells(new Set());
      setLastShiftIndex(null);
      setOutputCellIndex(null);
      setIsGridEditMode(true);
      updateParams({
        gridCells: cells,
        selectedCells: [],
        outputCellIndex: undefined,
        imageUrl: undefined,
        resultUrl: undefined,
        outputImageUrl: undefined,
        resultUrls: undefined,
        autoSplit: false,
        task: { status: 'completed', progress: 100 },
      });
      if (!options?.silent) toast.success(`图片分割完成！${cells.length} 宫格`);
      syncDownstreamFromNode(id as string);
    } catch (error) {
      toast.error('图片分割失败');
      updateParams({ task: { status: 'failed', error: '分割失败' } });
    } finally {
      setIsSplitting(false);
    }
  }, [inputImageUrl, params.cols, params.rows, updateParams, id]);

  useEffect(() => {
    const onSplitGridNode = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      if (detail?.nodeId !== id) return;
      void handleSplit({ silent: true });
    };
    window.addEventListener('split-grid-node', onSplitGridNode);
    return () => window.removeEventListener('split-grid-node', onSplitGridNode);
  }, [handleSplit, id]);

  useEffect(() => {
    if (!nodeData.autoSplit || !inputImageUrl || isSplitting) return;
    const key = `${nodeData.splitRequestedAt || 'initial'}:${inputImageUrl}:${params.rows}x${params.cols}`;
    if (autoSplitKeyRef.current === key) return;
    autoSplitKeyRef.current = key;
    const timer = window.setTimeout(() => {
      void handleSplit({ silent: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [handleSplit, inputImageUrl, isSplitting, nodeData.autoSplit, nodeData.splitRequestedAt, params.cols, params.rows]);

  const handleCellClick = useCallback(
    (index: number, event: React.MouseEvent) => {
      const outputCell = gridCells.find((cell) => cell.index === index);
      if (!outputCell) return;
      const newSelected = new Set(selectedCells);
      if (event.shiftKey && lastShiftIndex !== null) {
        const start = Math.min(lastShiftIndex, index);
        const end = Math.max(lastShiftIndex, index);
        for (let i = start; i <= end; i++) {
          newSelected.add(i);
        }
      } else {
        if (newSelected.has(index)) {
          newSelected.delete(index);
        } else {
          newSelected.add(index);
        }
        setLastShiftIndex(index);
      }
      newSelected.add(index);
      setSelectedCells(newSelected);
      setOutputCellIndex(index);
      updateParams({ selectedCells: Array.from(newSelected), ...buildGridCellOutputPatch(outputCell) });
      syncDownstreamFromNode(id as string);
    },
    [gridCells, selectedCells, lastShiftIndex, updateParams, id],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setLastShiftIndex(null);
    updateParams({ selectedCells: [] });
  }, [updateParams]);

  // 九宫格 AI 生成提示词
  const NINE_GRID_POSITIVE_PROMPT = 'A multi-camera angle reference sheet in 3x3 grid layout, showing [主体] from 9 different perspectives simultaneously: top-left front view, top-center 3/4 front view, top-right side profile, middle-left low angle, middle-center eye-level straight-on, middle-right high angle, bottom-left back view, bottom-center 3/4 back view, bottom-right top-down overhead view. [主体详细描述]. Consistent lighting across all 9 frames, uniform light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, professional studio photography, clean grid layout with thin white dividers between frames, character consistency maintained across all angles, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image';

  const NINE_GRID_NEGATIVE_PROMPT = 'numbers, text, letters, labels, frame numbers, corner marks, annotations, captions, watermarks, signatures, logos, readable text, font, typography, grid numbers, sequence markers, page numbers, index, hard edge, glowing edge, white halo, light bleed, overexposed edge, cutout look, pasted on background, floating subject, disconnected shadow, pure white background, stark white, cold gray, bad anatomy, distorted face, extra fingers, deformed hands, inconsistent character design, lighting mismatch between frames, blurry, low quality, cropped, out of frame';

  const handleSelectAll = useCallback(() => {
    const all = new Set(gridCells.map((c) => c.index));
    setSelectedCells(all);
    updateParams({ selectedCells: Array.from(all) });
  }, [gridCells, updateParams]);

  const handleLayoutChange = useCallback(
    (layoutId: string) => {
      const dims = getGridSplitterLayoutDimensions(layoutId);
      updateParams({
        layout: layoutId, cols: dims.cols, rows: dims.rows,
        outputCellIndex: undefined, imageUrl: undefined, resultUrl: undefined,
        outputImageUrl: undefined, resultUrls: undefined,
      });
      setGridCells([]);
      setSelectedCells(new Set());
      setLastShiftIndex(null);
      setOutputCellIndex(null);
      setIsGridEditMode(false);
    },
    [updateParams],
  );

  // 点击九宫格：触发豆包 Seedream 生成 → 自动切割成9宫格
  // 注意：split 模式（handleSplit）是纯本地切割，不调用后端 API，因此不扣减积分，符合预期。
  const handleGenerateNineGrid = useCallback(() => {
    if (params.layout !== '3x3') {
      handleLayoutChange('3x3');
    }
    // 设置生成参数到节点数据，让 executeSingleNode 能读取并调用豆包 Seedream
    canvasStoreApi.updateNodeData(id as string, {
      params: {
        ...params,
        prompt: NINE_GRID_POSITIVE_PROMPT,
        negativePrompt: NINE_GRID_NEGATIVE_PROMPT,
        modelId: 'doubao-seedream-5-0-pro',
        provider: 'doubao',
      },
    });
    // P2 修复：使用 requestAnimationFrame 确保 store 更新后再触发 execute-node，
    // 避免 real-api-executor 读取到更新前的 params 快照（race condition）
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('execute-node', {
          detail: { nodeId: id },
        }),
      );
    });
  }, [params, handleLayoutChange, id]);

  const handleGridDoubleClick = useCallback(() => {
    if (gridCells.length === 0) return;
    setIsGridEditMode(true);
  }, [gridCells.length]);

  const currentLayout = GRID_SPLITTER_LAYOUT_OPTIONS.find((l) => l.id === params.layout) || GRID_SPLITTER_LAYOUT_OPTIONS[2];
  const totalCells = params.cols * params.rows;
  const selectedCount = selectedCells.size;

  const nodePosition = currentNode?.position || { x: 0, y: 0 };

  const handleRegenerateCell = useCallback(
    async (cellIndex: number) => {
      if (!inputImageUrl) {
        toast.error('缺少源图');
        return;
      }
      try {
        const outputAspectRatio = params.cols === 4 && params.rows === 3 ? 16 / 9 : undefined;
        const cells = await splitImageToGrid(inputImageUrl, params.cols, params.rows, outputAspectRatio);
        const fresh = cells.find((c) => c.index === cellIndex);
        if (!fresh) return;
        const next = gridCells.map((c) => (c.index === cellIndex ? fresh : c));
        setGridCells(next);
        updateParams({ gridCells: next });
        syncDownstreamFromNode(id as string);
        toast.success(`格 ${cellIndex + 1} 已重生并同步下游`);
      } catch (err) {
        console.error('[GridSplitterNode] 单格重生失败:', err);
        toast.error('单格重生失败');
      }
    },
    [gridCells, id, inputImageUrl, params.cols, params.rows, updateParams],
  );

  const handleBatchGenerate = useCallback(
    (targetType: 'imageGen' | 'videoGen') => {
      if (selectedCount === 0) {
        toast.error('请先选中至少一个格子');
        return;
      }
      const indices = Array.from(selectedCells).sort((a, b) => a - b);
      indices.forEach((idx, i) => {
        const cell = gridCells.find((c) => c.index === idx);
        if (!cell) return;
        const targetId = `${targetType}-grid-${id}-${Date.now()}-${i}`;
        const posX = nodePosition.x + 420 + (i % 3) * 60;
        const posY = nodePosition.y + Math.floor(i / 3) * 160;
        canvasStoreApi.addNode({
          id: targetId,
          type: targetType,
          position: { x: posX, y: posY },
          data: {
            type: targetType,
            imageUrl: cell.dataUrl,
            sourceGridCell: {
              gridNodeId: id,
              cellIndex: idx,
              row: cell.row,
              col: cell.col,
            },
          },
        } as never);
        canvasStoreApi.addEdge({
          id: `edge-${id}-${targetId}`,
          source: id as string,
          target: targetId,
          sourceHandle: 'output',
          targetHandle: 'input',
        });
      });
      toast.success(`已创建 ${indices.length} 个${targetType === 'videoGen' ? '视频' : '图片'}节点`);
    },
    [selectedCount, selectedCells, gridCells, id, nodePosition],
  );

  const handleDownloadSelected = useCallback(() => {
    if (selectedCount === 0) {
      toast.error('请先选中至少一个格子');
      return;
    }
    selectedCells.forEach((idx) => {
      const cell = gridCells.find((c) => c.index === idx);
      if (!cell?.dataUrl) return;
      const a = document.createElement('a');
      a.href = cell.dataUrl;
      a.download = `grid-cell-${idx + 1}.jpg`;
      a.click();
    });
    toast.success(`已下载 ${selectedCount} 个子图`);
  }, [selectedCount, selectedCells, gridCells]);

  const taskStatus = currentNodeData.task?.status;
  const isRunning = taskStatus === 'processing';
  const isCompleted = taskStatus === 'completed';

  const stopFlowPointer = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  const hasResult = gridCells.length > 0;

  return (
    <div className="group relative grid-node-wrapper" style={embeddedInAicgImage ? undefined : { width: 480 }}>
      {!embeddedInAicgImage && (
        <AICGUnifiedIOHandles
          nodeId={id as string}
          nodeType="gridSplitter"
          inputTip="输入图片"
          outputTip={outputCellIndex === null ? '点击格子选择输出' : `输出第 ${outputCellIndex + 1} 格`}
          menuTop="45%"
        />
      )}

      <AICGNodeShell
        aicgType="tool"
        title={`${currentLayout.label} 宫格`}
        subtitle={
          hasResult && selectedCount > 0
            ? `输出第 ${(outputCellIndex ?? 0) + 1} 格 · 已选 ${selectedCount} 格`
            : '3 / 6 / 9 / 12 格 · 连接图片后拆分'
        }
        selected={selected}
        width="100%"
        chromeless={embeddedInAicgImage}
        hideControlHeader
        onDelete={embeddedInAicgImage ? undefined : () => canvasStoreApi.deleteNode(id as string)}
      >
      <div
        className={cn(
          'grid-node-card overflow-hidden transition-shadow',
          aicgGlass.previewMedia,
          isGridEditMode && 'ring-2 ring-white/30',
        )}
      >
        {isExpanded && (
          <div
            className="nodrag nowheel nopan p-2 space-y-2"
            style={{ pointerEvents: 'auto' }}
            onPointerDownCapture={stopFlowPointer}
            onMouseDownCapture={stopFlowPointer}
            onClick={stopFlowPointer}
          >
            {/* 紧凑工具栏 */}
            <div className="flex items-center gap-1 flex-wrap">
              {GRID_SPLITTER_LAYOUT_OPTIONS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onPointerDown={stopFlowPointer}
                  onMouseDown={stopFlowPointer}
                  onClick={(e) => {
                    stopFlowPointer(e);
                    handleLayoutChange(l.id);
                  }}
                  className={cn(
                    'nodrag px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer',
                    l.id === params.layout
                      ? 'bg-white/[0.08] text-white border border-white/24'
                      : 'bg-white/[0.04] text-white/40 border border-transparent hover:text-white/60',
                  )}
                >
                  {l.label}
                </button>
              ))}
              <div className="flex-1" />
              <span
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded pointer-events-none',
                  inputImageUrl ? 'text-white/70 bg-white/[0.06]' : 'text-white/30 bg-white/[0.04]',
                )}
              >
                {inputImageUrl ? '已连接' : '未连接'}
              </span>
              <NodePointsBadge points={1} />
              <button
                type="button"
                onPointerDown={stopFlowPointer}
                onMouseDown={stopFlowPointer}
                onClick={(e) => {
                  stopFlowPointer(e);
                  void handleSplit();
                }}
                disabled={isSplitting || !inputImageUrl}
                className={cn(
                  'nodrag flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer',
                  isSplitting || !inputImageUrl
                    ? 'bg-white/[0.04] text-white/25 cursor-not-allowed'
                    : 'bg-white/[0.08] text-white hover:bg-white/[0.12]',
                )}
              >
                {isSplitting ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                {isSplitting ? '分割中' : '分割'}
              </button>
            </div>

            {/* 输入预览（未分割时） */}
            {!hasResult && inputImageUrl && (
              <div className="rounded-lg overflow-hidden border border-white/[0.06] max-h-[80px]">
                <img src={getSafeRenderableMediaUrl(inputImageUrl)} alt="输入" className="w-full h-full object-contain bg-black/40" />
              </div>
            )}

            {/* 宫格主体 — 对齐 AICG grid-container */}
            <div
              className="grid-container nodrag rounded-md overflow-hidden bg-white/[0.08]"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${params.cols}, 1fr)`,
                gap: 1,
              }}
              onDoubleClick={(e) => {
                stopFlowPointer(e);
                handleGridDoubleClick();
              }}
            >
              {hasResult
                ? gridCells.map((cell) => {
                    const isSelected = selectedCells.has(cell.index);
                    const isOutput = outputCellIndex === cell.index;
                    const canSelect = isGridEditMode;
                    return (
                      <div
                        key={cell.index}
                        role={canSelect ? 'button' : undefined}
                        tabIndex={canSelect ? 0 : undefined}
                        onPointerDown={canSelect ? stopFlowPointer : undefined}
                        onMouseDown={canSelect ? stopFlowPointer : undefined}
                        onClick={
                          canSelect
                            ? (e) => {
                                stopFlowPointer(e);
                                handleCellClick(cell.index, e);
                              }
                            : undefined
                        }
                        onKeyDown={
                          canSelect
                            ? (event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleCellClick(cell.index, event as any as React.MouseEvent);
                                }
                              }
                            : undefined
                        }
                        className={cn(
                          'grid-cell group/cell relative aspect-square overflow-hidden cursor-default bg-[#1e1e1e] transition-all',
                          canSelect && 'cursor-pointer',
                          canSelect && 'hover:shadow-[inset_0_0_0_2px_rgba(59,130,246,0.45)] hover:z-[1]',
                          isSelected && 'shadow-[inset_0_0_0_2px_rgba(255,255,255,0.72)] z-[2]',
                          isOutput && 'shadow-[inset_0_0_0_3px_rgba(251,191,36,0.92)] z-[3]',
                          cell.dataUrl && 'bg-[#101012]',
                        )}
                        style={{ aspectRatio: `${cell.bounds.w}/${cell.bounds.h}` }}
                      >
                        {cell.dataUrl ? (
                          <img
                            src={cell.dataUrl}
                            alt={`格 ${cell.index + 1}`}
                            className="cell-image w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <div className="cell-empty w-full h-full flex items-center justify-center text-white/20">
                            <Plus className="w-3 h-3" strokeWidth={2} />
                          </div>
                        )}
                        <span
                          className={cn(
                            'cell-index absolute top-1 left-1.5 text-[9px] font-semibold pointer-events-none leading-none',
                            cell.dataUrl ? 'text-white/70 drop-shadow-sm' : 'text-white/25',
                          )}
                        >
                          {cell.index + 1}
                        </span>
                        {isOutput ? (
                          <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-amber-300 px-1 py-0.5 text-[8px] font-bold text-black">
                            输出
                          </span>
                        ) : null}
                        {cell.dataUrl && isGridEditMode && (
                          <button
                            type="button"
                            title="单格重生"
                            className="absolute bottom-1 right-1 rounded bg-black/50 p-0.5 text-white/70 opacity-0 hover:text-white group-hover/cell:opacity-100"
                            onClick={(e) => {
                              stopFlowPointer(e);
                              void handleRegenerateCell(cell.index);
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                : Array.from({ length: totalCells }, (_, i) => (
                    <div
                      key={i}
                      className="grid-cell relative aspect-square overflow-hidden bg-[#1e1e1e] flex items-center justify-center"
                    >
                      <span className="cell-index absolute top-1 left-1.5 text-[9px] font-semibold text-white/25 pointer-events-none leading-none">
                        {i + 1}
                      </span>
                      <div className="cell-empty text-white/15">
                        <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </div>
                    </div>
                  ))}
            </div>

            {/* 底部提示 / 编辑工具栏 */}
            {!hasResult ? (
              <p className="grid-hint text-center text-[11px] text-white/30">
                连接图片后点击「分割」，将大图切分为 {totalCells} 宫格
              </p>
            ) : !isGridEditMode ? (
              <button
                type="button"
                className="grid-hint nodrag w-full text-center text-[11px] text-white/35 hover:text-white/55 transition-colors cursor-pointer py-0.5"
                onPointerDown={stopFlowPointer}
                onMouseDown={stopFlowPointer}
                onClick={(e) => {
                  stopFlowPointer(e);
                  setIsGridEditMode(true);
                }}
              >
                双击以进入分镜编辑排序
              </button>
            ) : (
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onPointerDown={stopFlowPointer}
                    onMouseDown={stopFlowPointer}
                    onClick={(e) => { stopFlowPointer(e); handleSelectAll(); }}
                    className="nodrag px-2 py-1 rounded text-[10px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopFlowPointer}
                    onMouseDown={stopFlowPointer}
                    onClick={(e) => { stopFlowPointer(e); handleClearSelection(); }}
                    className="nodrag px-2 py-1 rounded text-[10px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopFlowPointer}
                    onMouseDown={stopFlowPointer}
                    onClick={(e) => { stopFlowPointer(e); setIsGridEditMode(false); }}
                    className="nodrag px-2 py-1 rounded text-[10px] text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    完成
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onPointerDown={stopFlowPointer}
                    onMouseDown={stopFlowPointer}
                    onClick={(e) => { stopFlowPointer(e); handleBatchGenerate('imageGen'); }}
                    disabled={selectedCount === 0}
                    className={cn(
                      'nodrag flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer',
                      selectedCount > 0
                        ? 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
                        : 'bg-white/[0.03] text-white/25 cursor-not-allowed',
                    )}
                  >
                    <Send className="w-3 h-3" />
                    图片
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopFlowPointer}
                    onMouseDown={stopFlowPointer}
                    onClick={(e) => { stopFlowPointer(e); handleBatchGenerate('videoGen'); }}
                    disabled={selectedCount === 0}
                    className={cn(
                      'nodrag flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer',
                      selectedCount > 0
                        ? 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
                        : 'bg-white/[0.03] text-white/25 cursor-not-allowed',
                    )}
                  >
                    <Send className="w-3 h-3" />
                    视频
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopFlowPointer}
                    onMouseDown={stopFlowPointer}
                    onClick={(e) => { stopFlowPointer(e); handleDownloadSelected(); }}
                    disabled={selectedCount === 0}
                    className={cn(
                      'nodrag flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer',
                      selectedCount > 0
                        ? 'bg-white/10 text-white/70 hover:bg-white/15'
                        : 'bg-white/[0.03] text-white/25 cursor-not-allowed',
                    )}
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {!hasResult && !inputImageUrl && (
              <div className="flex flex-col items-center justify-center py-3 border border-dashed border-white/[0.08] rounded-lg">
                <ImageIcon className="w-4 h-4 text-white/15 mb-1" />
                <span className="text-[10px] text-white/30">将图片节点连到左侧端口</span>
              </div>
            )}

            {(isRunning || isCompleted) && (
              <div className="flex items-center justify-end">
                <span
                  className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded',
                    isRunning ? 'text-white/70 bg-white/[0.06]' : 'text-white/70 bg-white/[0.06]',
                  )}
                >
                  {isRunning ? '执行中' : '已完成'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      </AICGNodeShell>
    </div>
  );
});

GridSplitterNode.displayName = 'GridSplitterNode';

export default GridSplitterNode;
