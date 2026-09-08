/**
 * 智能抠图节点
 * 使用 ONNX Runtime Web 进行浏览器端本地推理
 * 支持 SAM、Bria RMBG、RVM 等抠图模型
 */

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, useStore } from '@xyflow/react';
import {
  Upload,
  X as CloseIcon,
  Loader2,
  Maximize2,
  Settings2,
  CheckCircle,
  AlertCircle,
  Wand2,
  RefreshCw,
  Download,
  SlidersHorizontal,
  Layers,
  MousePointer2,
  Scan,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import { aicgGlass } from './aicg-node-glass';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { localMattingService, type MattingResult } from '@/services/local-matting-service';
import { smartMattingEngine } from '@/services/smart-matting-service';
import { rembgWebGPUService } from '@/services/rembg-webgpu-service';
import { aiProcessor } from '@/services/ai-processor';
import { rembgService } from '@/services/rembg-service';
import { birefnetMattingService } from '@/services/birefnet-matting-service';
// 百度API已移除（质量差，仅人像分割，非通用抠图）
// import { baiduAIService } from '@/services/baidu-ai-service';
// import { baiduConfigService } from '@/services/baidu-config';
import { persistGeneratedCanvasUrl } from '@/services/canvas-asset-actions';
import {
  samInteractiveService,
  type SAMPoint,
  type SAMBox,
} from '@/services/sam-interactive-service';
import { normalizeMediaUrl } from '@/lib/media-url';

interface LocalMattingNodeData {
  imageUrl?: string;
  fileName?: string;
  originalImageUrl?: string;
  resultUrl?: string;
  resultAssetId?: string;
  maskUrl?: string;
  processingMode?: string;
  isProcessed?: boolean;
  customBackground?: string;
  edgeFeathering?: number;
  edgeSmoothing?: number;
  executeRequestedAt?: number;
  autoExecute?: boolean;
  width?: number;
  height?: number;
  task?: {
    status: 'idle' | 'processing' | 'done' | 'error';
    progress?: number;
    resultUrl?: string;
    error?: string;
  };
  timing?: {
    preprocess: number;
    inference: number;
    postprocess: number;
    composite: number;
  };
  executionProvider?: string;
}

type EdgeRefinementLevel = 'none' | 'light' | 'medium' | 'strong';
type InteractiveMode = 'none' | 'click' | 'box';

const EDGE_REFINEMENT_LEVELS: { id: EdgeRefinementLevel; name: string }[] = [
  { id: 'none', name: '关闭' },
  { id: 'light', name: '轻微' },
  { id: 'medium', name: '中等' },
  { id: 'strong', name: '强力' },
];

const BACKGROUND_COLORS = [
  { id: 'transparent', color: 'transparent', label: '透明' },
  { id: '#FFFFFF', color: '#FFFFFF', label: '白' },
  { id: '#000000', color: '#000000', label: '黑' },
  { id: '#808080', color: '#808080', label: '灰' },
  { id: '#FF0000', color: '#FF0000', label: '红' },
  { id: '#00FF00', color: '#00FF00', label: '绿' },
  { id: '#0000FF', color: '#0000FF', label: '蓝' },
];

function edgeSmoothingToRefinement(value: number | undefined): EdgeRefinementLevel {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'medium';
  const index = Math.max(0, Math.min(EDGE_REFINEMENT_LEVELS.length - 1, Math.round(value)));
  return EDGE_REFINEMENT_LEVELS[index]?.id || 'medium';
}

function normalizeFeatherRadius(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(8, Math.round(value)));
}

function extractSourceImageUrl(data: Record<string, unknown>): string | null {
  const task = data.task as Record<string, unknown> | undefined;
  const candidates = [
    data.imageUrl,
    data.resultUrl,
    data.receivedImageUrl,
    data.output,
    data.url,
    task?.resultUrl,
    Array.isArray(task?.resultUrls) ? task.resultUrls[0] : null,
    Array.isArray(data.resultUrls) ? data.resultUrls[0] : null,
    data.originalImageUrl,
    data.thumbnailUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

interface MattingCandidate {
  imageUrl: string;
  maskUrl?: string;
  strategyUsed: string;
  confidence: number;
  backgroundApplied?: boolean;
}

interface MattingQualityReport {
  usable: boolean;
  foregroundRatio: number;
  transparentRatio: number;
  opaqueRatio: number;
  alphaRange: number;
  reason?: string;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('结果图像加载失败'));
    img.src = url;
  });
}

async function inspectMattingQuality(imageUrl: string): Promise<MattingQualityReport> {
  try {
    const img = await loadImageElement(imageUrl);
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    const scale = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        usable: true,
        foregroundRatio: 0,
        transparentRatio: 0,
        opaqueRatio: 0,
        alphaRange: 255,
      };
    }

    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    const pixels = width * height;
    let foreground = 0;
    let transparent = 0;
    let opaque = 0;
    let minAlpha = 255;
    let maxAlpha = 0;

    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i];
      if (alpha > 16) foreground += 1;
      if (alpha < 10) transparent += 1;
      if (alpha > 245) opaque += 1;
      minAlpha = Math.min(minAlpha, alpha);
      maxAlpha = Math.max(maxAlpha, alpha);
    }

    const foregroundRatio = foreground / pixels;
    const transparentRatio = transparent / pixels;
    const opaqueRatio = opaque / pixels;
    const alphaRange = maxAlpha - minAlpha;

    if (foregroundRatio < 0.01) {
      return {
        usable: false,
        foregroundRatio,
        transparentRatio,
        opaqueRatio,
        alphaRange,
        reason: '前景面积过小',
      };
    }
    if (transparentRatio > 0.995) {
      return {
        usable: false,
        foregroundRatio,
        transparentRatio,
        opaqueRatio,
        alphaRange,
        reason: '结果几乎全透明',
      };
    }
    if (opaqueRatio > 0.995 && transparentRatio < 0.003 && alphaRange < 12) {
      return {
        usable: false,
        foregroundRatio,
        transparentRatio,
        opaqueRatio,
        alphaRange,
        reason: '结果几乎全不透明，背景未被移除',
      };
    }

    return { usable: true, foregroundRatio, transparentRatio, opaqueRatio, alphaRange };
  } catch (error) {
    logger.warn('[LocalMattingNode] 无法读取结果透明度，跳过质量检测:', error);
    return {
      usable: true,
      foregroundRatio: 0,
      transparentRatio: 0,
      opaqueRatio: 0,
      alphaRange: 255,
    };
  }
}

const LocalMattingNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as unknown as LocalMattingNodeData;
  const updateNodeData = canvasStoreApi.updateNodeData;

  // 从 store 获取连接信息
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);

  // 获取连接的源图片
  const connectedSourceUrl = useMemo(() => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'image');
    if (!edge) return null;
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) return null;
    const sd = src.data as Record<string, unknown>;
    return extractSourceImageUrl(sd);
  }, [edges, nodes, id]);

  const [imageUrl, setImageUrl] = useState(nodeData.imageUrl || '');
  const [fileName, setFileName] = useState(nodeData.fileName || '');
  const [originalImageUrl, setOriginalImageUrl] = useState(nodeData.originalImageUrl || '');
  const [resultUrl, setResultUrl] = useState(nodeData.resultUrl || '');
  const [isProcessing, setIsProcessing] = useState(nodeData.task?.status === 'processing');
  const [isControllerCollapsed, setIsControllerCollapsed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [processingResult, setProcessingResult] = useState<MattingResult | null>(null);
  const mattingProgress = Math.max(0, Math.min(100, Math.round(nodeData.task?.progress ?? 0)));
  const isMattingInProgress = isProcessing || nodeData.task?.status === 'processing';

  // 高级参数状态
  const [edgeRefinement, setEdgeRefinement] = useState<EdgeRefinementLevel>(
    edgeSmoothingToRefinement(nodeData.edgeSmoothing)
  );
  const [featherRadius, setFeatherRadius] = useState(
    normalizeFeatherRadius(nodeData.edgeFeathering)
  );
  const [decontaminateColors, setDecontaminateColors] = useState(true);
  const [outputScale] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState(
    nodeData.customBackground || 'transparent'
  );

  // SAM 交互式分割状态
  const [interactiveMode, setInteractiveMode] = useState<InteractiveMode>('none');
  const [samPoints, setSamPoints] = useState<SAMPoint[]>([]);
  const [samBox, setSamBox] = useState<SAMBox | null>(null);
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawingBoxRef = useRef(false);
  const boxStartRef = useRef<{ x: number; y: number } | null>(null);
  const boxEndRef = useRef<{ x: number; y: number } | null>(null);
  const lastConnectedSourceUrlRef = useRef<string | null>(
    nodeData.isProcessed || nodeData.resultUrl ? connectedSourceUrl : null
  );
  const lastAutoExecuteRequestedAtRef = useRef(0);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const revokeAllBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        logger.warn('[LocalMattingNode] 释放临时图片 URL 失败:', error);
      }
    });
    blobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      revokeAllBlobUrls();
    };
  }, [revokeAllBlobUrls]);

  useEffect(() => {
    if (typeof nodeData.customBackground === 'string' && nodeData.customBackground.trim()) {
      setBackgroundColor((current) =>
        current === nodeData.customBackground ? current : nodeData.customBackground!
      );
    }
    setFeatherRadius((current) => {
      if (typeof nodeData.edgeFeathering !== 'number') return current;
      const next = normalizeFeatherRadius(nodeData.edgeFeathering);
      return current === next ? current : next;
    });
    setEdgeRefinement((current) => {
      if (typeof nodeData.edgeSmoothing !== 'number') return current;
      const next = edgeSmoothingToRefinement(nodeData.edgeSmoothing);
      return current === next ? current : next;
    });
  }, [nodeData.customBackground, nodeData.edgeFeathering, nodeData.edgeSmoothing]);

  // 结果持久化逻辑
  useEffect(() => {
    if (!resultUrl || nodeData.resultAssetId) return;

    // 本地URL直接跳过持久化，避免blob URL刷新后失效
    if (
      resultUrl.startsWith('http://localhost:3200/uploads/') ||
      resultUrl.startsWith('http://localhost:3001/uploads/') ||
      resultUrl.startsWith('/uploads/')
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const persisted = await persistGeneratedCanvasUrl({
          nodeId: id as string,
          kind: 'image',
          url: resultUrl,
          fileName: `local-matting-${id}.png`,
        });
        if (cancelled) return;

        updateNodeData(id as string, {
          resultAssetId: persisted.asset.id,
          resultUrl: persisted.runtimeUrl || resultUrl,
          imageUrl: persisted.runtimeUrl || resultUrl,
        });
        window.setTimeout(() => syncDownstreamFromNode(id as string), 0);
      } catch (error) {
        logger.warn('[LocalMattingNode] 持久化结果失败', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, resultUrl, nodeData.resultAssetId, updateNodeData]);

  useEffect(() => {
    if (!connectedSourceUrl || connectedSourceUrl === lastConnectedSourceUrlRef.current) return;
    lastConnectedSourceUrlRef.current = connectedSourceUrl;
    setImageUrl(connectedSourceUrl);
    setOriginalImageUrl(connectedSourceUrl);
    setResultUrl('');
    setProcessingResult(null);
    setImageLoaded(false);
    setImageError(false);
    setSamPoints([]);
    setSamBox(null);
    setBoxStart(null);
    setBoxEnd(null);
    isDrawingBoxRef.current = false;
    boxStartRef.current = null;
    boxEndRef.current = null;
    updateNodeData(id as string, {
      imageUrl: connectedSourceUrl,
      originalImageUrl: connectedSourceUrl,
      resultUrl: '',
      resultAssetId: undefined,
      maskUrl: undefined,
      isProcessed: false,
      task: { status: 'idle', progress: 0 },
    });
  }, [connectedSourceUrl, id, updateNodeData]);

  useEffect(() => {
    if (!connectedSourceUrl) {
      lastConnectedSourceUrlRef.current = null;
    }
  }, [connectedSourceUrl]);

  const loadImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.warning('请上传图片文件');
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        toast.warning('图片文件过大（最大 30MB）');
        return;
      }

      try {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const url = evt.target?.result as string;
          setImageUrl(url);
          setOriginalImageUrl(url);
          setFileName(file.name);
          setResultUrl('');
          setProcessingResult(null);
          setImageLoaded(false);
          setImageError(false);
          setSamPoints([]);
          setSamBox(null);
          setBoxStart(null);
          setBoxEnd(null);
          isDrawingBoxRef.current = false;
          boxStartRef.current = null;
          boxEndRef.current = null;
          updateNodeData(id as string, {
            imageUrl: url,
            fileName: file.name,
            originalImageUrl: url,
            resultUrl: '',
            resultAssetId: undefined,
            maskUrl: undefined,
            isProcessed: false,
            task: { status: 'idle', progress: 0 },
          });
        };
        reader.readAsDataURL(file);
      } catch (error) {
        logger.error('[LocalMattingNode] 图片加载失败:', error);
        toast.error('图片加载失败');
      }
    },
    [id, updateNodeData]
  );

  const handleImageChange = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDropImage = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = Array.from(e.dataTransfer.files).find((item) => item.type.startsWith('image/'));
      if (!file) {
        toast.warning('请拖入图片文件');
        return;
      }
      loadImageFile(file);
    },
    [loadImageFile]
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
  }, []);

  const handleReset = useCallback(() => {
    if (originalImageUrl) {
      setImageUrl(originalImageUrl);
      setResultUrl('');
      setProcessingResult(null);
      updateNodeData(id as string, {
        imageUrl: originalImageUrl,
        resultUrl: '',
        resultAssetId: undefined,
        maskUrl: undefined,
        isProcessed: false,
        task: { status: 'idle', progress: 0 },
      });
      toast.success('已恢复原图');
    }
  }, [originalImageUrl, id, updateNodeData]);

  const comparisonRef = useRef<HTMLDivElement>(null);

  const handleSliderMove = useCallback((clientX: number) => {
    if (!comparisonRef.current) return;
    const rect = comparisonRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(2, Math.min(98, x)));
  }, []);

  const handleSliderStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      setIsDraggingSlider(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleSliderMove(clientX);
    },
    [handleSliderMove]
  );

  useEffect(() => {
    if (!isDraggingSlider) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleSliderMove(clientX);
    };
    const handleEnd = () => setIsDraggingSlider(false);
    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingSlider, handleSliderMove]);

  // SAM 交互式分割处理函数
  const getNormalizedImagePoint = useCallback((clientX: number, clientY: number) => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const updateBoxEndFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const point = getNormalizedImagePoint(clientX, clientY);
      if (!point) return null;
      boxEndRef.current = point;
      setBoxEnd(point);
      return point;
    },
    [getNormalizedImagePoint]
  );

  const handleSAMClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactiveMode !== 'click') return;
      e.stopPropagation();

      const point = getNormalizedImagePoint(e.clientX, e.clientY);
      if (!point) return;

      // 左键添加前景点，右键添加背景点
      const label: 1 | 0 = e.button === 2 ? 0 : 1;

      setSamPoints((prev) => [...prev, { ...point, label }]);
    },
    [getNormalizedImagePoint, interactiveMode]
  );

  const handleSAMBoxStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactiveMode !== 'box') return;
      e.stopPropagation();
      e.preventDefault();

      const point = getNormalizedImagePoint(e.clientX, e.clientY);
      if (!point) return;

      setIsDrawingBox(true);
      isDrawingBoxRef.current = true;
      setBoxStart(point);
      setBoxEnd(point);
      boxStartRef.current = point;
      boxEndRef.current = point;
      setSamBox(null);
    },
    [getNormalizedImagePoint, interactiveMode]
  );

  const handleSAMBoxMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawingBoxRef.current) return;
      e.stopPropagation();
      updateBoxEndFromClient(e.clientX, e.clientY);
    },
    [updateBoxEndFromClient]
  );

  const handleSAMBoxEnd = useCallback(
    (event?: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
      const start = boxStartRef.current || boxStart;
      if (!isDrawingBoxRef.current || !start) return;

      let end = boxEndRef.current || boxEnd;
      if (event) {
        end = updateBoxEndFromClient(event.clientX, event.clientY) || end;
      }
      if (!end) return;
      setIsDrawingBox(false);
      isDrawingBoxRef.current = false;

      const x1 = Math.min(start.x, end.x);
      const y1 = Math.min(start.y, end.y);
      const x2 = Math.max(start.x, end.x);
      const y2 = Math.max(start.y, end.y);

      if (x2 - x1 > 0.02 && y2 - y1 > 0.02) {
        setSamBox({ x1, y1, x2, y2 });
      }
    },
    [boxEnd, boxStart, updateBoxEndFromClient]
  );

  useEffect(() => {
    if (!isDrawingBox) return;
    const handleGlobalMouseMove = (event: MouseEvent) => {
      updateBoxEndFromClient(event.clientX, event.clientY);
    };
    const handleGlobalMouseUp = (event: MouseEvent) => {
      handleSAMBoxEnd(event);
    };
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDrawingBox, handleSAMBoxEnd, updateBoxEndFromClient]);

  const handleSAMContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (interactiveMode !== 'click' || !imgRef.current) return;

      const rect = imgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      setSamPoints((prev) => [...prev, { x, y, label: 0 }]);
    },
    [interactiveMode]
  );

  const clearSAMInteraction = useCallback(() => {
    setSamPoints([]);
    setSamBox(null);
    setBoxStart(null);
    setBoxEnd(null);
    isDrawingBoxRef.current = false;
    boxStartRef.current = null;
    boxEndRef.current = null;
    samInteractiveService.reset();
  }, []);

  const handleExecuteSAM = useCallback(async () => {
    if (!imageUrl) {
      toast.warning('请先上传图片');
      return;
    }

    if (interactiveMode === 'click' && samPoints.length === 0) {
      toast.warning('请先点击图片选择区域');
      return;
    }

    if (interactiveMode === 'box' && !samBox) {
      toast.warning('请先框选目标区域');
      return;
    }

    setIsProcessing(true);
    setProcessingResult(null);
    updateNodeData(id as string, {
      task: { status: 'processing', progress: 30 },
    });

    try {
      const result = await samInteractiveService.segment(imageUrl, {
        points: interactiveMode === 'click' ? samPoints : undefined,
        box: interactiveMode === 'box' ? samBox : undefined,
        edgeRefinement,
      });

      if (result.success && result.imageUrl) {
        setResultUrl(result.imageUrl);
        setProcessingResult({
          success: true,
          imageUrl: result.imageUrl,
          strategyUsed: 'SAM 交互式分割',
          confidence: 0.95,
        });
        setImageUrl(result.imageUrl);

        updateNodeData(id as string, {
          imageUrl: result.imageUrl,
          resultUrl: result.imageUrl,
          originalImageUrl: originalImageUrl || imageUrl,
          maskUrl: result.maskUrl,
          isProcessed: true,
          processingMode: 'sam-interactive',
          task: { status: 'done', progress: 100, resultUrl: result.imageUrl },
        });

        toast.success(`交互式分割完成 (${Math.round(result.processingTime || 0)}ms)`);
        window.setTimeout(() => syncDownstreamFromNode(id as string), 0);
      } else {
        throw new Error(result.error || '分割失败');
      }
    } catch (error) {
      const msg = (error as Error).message || '分割失败';
      logger.error('[LocalMattingNode] SAM分割失败:', error);
      updateNodeData(id as string, {
        task: { status: 'error', error: msg },
      });
      toast.error('分割失败: ' + msg);
    } finally {
      setIsProcessing(false);
    }
  }, [
    imageUrl,
    interactiveMode,
    samPoints,
    samBox,
    edgeRefinement,
    id,
    updateNodeData,
    originalImageUrl,
  ]);

  const handleExecuteMatting = useCallback(async () => {
    if (!imageUrl) {
      toast.warning('请先上传图片');
      return;
    }

    setIsProcessing(true);
    setProcessingResult(null);
    updateNodeData(id as string, {
      task: { status: 'processing', progress: 0 },
    });

    try {
      let resultImageUrl: string | null = null;
      let resultMaskUrl: string | null = null;
      let strategyUsed = '';
      let confidence = 0;
      let bgAlreadyApplied = false;
      const rejectedStrategies: string[] = [];

      const acceptCandidate = async (candidate: MattingCandidate): Promise<boolean> => {
        const quality = await inspectMattingQuality(candidate.imageUrl);
        if (!quality.usable) {
          const reason = `${candidate.strategyUsed}: ${quality.reason || '结果质量不足'}`;
          rejectedStrategies.push(reason);
          logger.warn('[LocalMattingNode] 抠图结果质量不足，继续尝试下一个引擎:', {
            strategy: candidate.strategyUsed,
            reason: quality.reason,
            foregroundRatio: quality.foregroundRatio,
            transparentRatio: quality.transparentRatio,
            opaqueRatio: quality.opaqueRatio,
            alphaRange: quality.alphaRange,
          });
          return false;
        }

        resultImageUrl = candidate.imageUrl;
        resultMaskUrl = candidate.maskUrl || candidate.imageUrl;
        strategyUsed = candidate.strategyUsed;
        confidence = candidate.confidence;
        bgAlreadyApplied = Boolean(candidate.backgroundApplied);
        return true;
      };

      // ---- Engine 0: BiRefNet ONNX（浏览器端SOTA，本地嵌入模型，质量最佳）----
      try {
        logger.info('[LocalMattingNode] 尝试 BiRefNet ONNX 浏览器推理...');
        updateNodeData(id as string, {
          task: { status: 'processing', progress: 5 },
        });
        const birefnetAvailable = await birefnetMattingService.isAvailable();
        if (birefnetAvailable) {
          await birefnetMattingService.preload((progress) => {
            updateNodeData(id as string, {
              task: { status: 'processing', progress: Math.round(progress) },
            });
          });
          const birefnetResult = await birefnetMattingService.removeBackground(
            imageUrl,
            { backgroundColor: 'transparent' },
            (progress) => {
              updateNodeData(id as string, {
                task: { status: 'processing', progress: Math.round(progress) },
              });
            }
          );
          if (birefnetResult.success && birefnetResult.imageUrl) {
            await acceptCandidate({
              imageUrl: birefnetResult.imageUrl,
              maskUrl: birefnetResult.maskUrl,
              strategyUsed: 'BiRefNet ONNX (本地嵌入)',
              confidence: 0.95,
            });
            if (resultImageUrl) {
              logger.info(
                '[LocalMattingNode] BiRefNet 推理成功, 耗时: ' +
                  birefnetResult.processingTime +
                  'ms'
              );
            }
          }
        } else {
          logger.warn('[LocalMattingNode] BiRefNet 模型不可用，跳过');
        }
      } catch (birefnetError) {
        logger.warn('[LocalMattingNode] BiRefNet ONNX失败:', birefnetError);
      }

      if (!resultImageUrl) {
        const qualityReason = rejectedStrategies[0] ? ` ${rejectedStrategies[0]}` : '';
        throw new Error(
          `本地 BiRefNet ONNX 抠图未完成。请确认本地模型文件可访问后重试。${qualityReason}`
        );
      }

      // ---- Engine 0.5: 本地推理服务 (localMattingService, @imgly封装) ----
      if (!resultImageUrl) {
        try {
          logger.info('[LocalMattingNode] 本地 BiRefNet 未完成，后续级联已禁用');
          const localResult = await localMattingService.removeBackground(
            imageUrl,
            {
              modelType: 'bria',
              inferenceEngine: 'onnx',
              edgeRefinement,
              featherRadius,
              decontaminateColors,
              outputScale,
              backgroundColor: 'transparent',
            },
            (progress) => {
              updateNodeData(id as string, {
                task: { status: 'processing', progress: Math.round(progress) },
              });
            }
          );
          if (localResult.success && localResult.imageUrl) {
            const accepted = await acceptCandidate({
              imageUrl: localResult.imageUrl,
              maskUrl: localResult.maskUrl,
              strategyUsed: localResult.strategyUsed,
              confidence: localResult.confidence || 0.95,
            });
            if (accepted) {
              logger.info(
                '[LocalMattingNode] 本地推理成功: ' +
                  strategyUsed +
                  ', 耗时: ' +
                  localResult.processingTime +
                  'ms'
              );
            }
          }
        } catch (localError) {
          logger.warn('[LocalMattingNode] 本地推理服务失败:', localError);
        }
      }

      // ---- Engine 1: @imgly/background-removal (浏览器端本地AI，仅 ISNet 系列) ----
      const imglyModel = 'isnet_fp16';
      if (!resultImageUrl) {
        try {
          logger.info('[LocalMattingNode] 回退 @imgly/background-removal, model=' + imglyModel);
          const imglyResult = await aiProcessor.removeBackground(imageUrl, {
            model: imglyModel,
            device: 'gpu',
            publicPath: `${globalThis.location?.origin || ''}/ai-models/background-removal/`,
            onProgress: (progress) => {
              updateNodeData(id as string, {
                task: { status: 'processing', progress: Math.round(progress) },
              });
            },
            onLog: (msg) => {
              logger.info('[LocalMattingNode] @imgly:', msg);
            },
          });
          if (imglyResult) {
            await acceptCandidate({
              imageUrl: imglyResult,
              maskUrl: imglyResult,
              strategyUsed: 'ISNet 本地AI (GPU)',
              confidence: 0.9,
            });
          }
        } catch (imglyError) {
          logger.warn('[LocalMattingNode] @imgly GPU模式失败:', imglyError);
          try {
            // CPU 模式自动使用 isnet_quint8（已在 aiProcessor 中处理）
            logger.info('[LocalMattingNode] 回退到 CPU + INT8 模式...');
            const imglyResult = await aiProcessor.removeBackground(imageUrl, {
              model: 'isnet_quint8',
              device: 'cpu',
              publicPath: `${globalThis.location?.origin || ''}/ai-models/background-removal/`,
              onProgress: (progress) => {
                updateNodeData(id as string, {
                  task: { status: 'processing', progress: Math.round(progress) },
                });
              },
            });
            if (imglyResult) {
              await acceptCandidate({
                imageUrl: imglyResult,
                maskUrl: imglyResult,
                strategyUsed: 'ISNet 本地AI (CPU/INT8)',
                confidence: 0.85,
              });
            }
          } catch (cpuError) {
            logger.warn('[LocalMattingNode] @imgly CPU模式也失败:', cpuError);
          }
        }
      }

      // ---- Engine 2: Rembg WebGPU (本地WebGPU推理) ----
      if (!resultImageUrl) {
        try {
          const webgpuAvailable = await rembgWebGPUService.isAvailable();
          if (webgpuAvailable) {
            logger.info('[LocalMattingNode] 尝试 Rembg WebGPU...');
            const webgpuResult = await rembgWebGPUService.removeBackground(imageUrl);
            if (webgpuResult.success && webgpuResult.imageUrl) {
              await acceptCandidate({
                imageUrl: webgpuResult.imageUrl,
                maskUrl: webgpuResult.imageUrl,
                strategyUsed: 'Rembg WebGPU',
                confidence: 0.9,
              });
            }
          }
        } catch (webgpuError) {
          logger.warn('[LocalMattingNode] Rembg WebGPU失败:', webgpuError);
        }
      }

      // ---- Engine 3: Rembg 服务端 ----
      if (!resultImageUrl) {
        try {
          const rembgAvailable = await rembgService.isAvailable();
          if (rembgAvailable) {
            logger.info('[LocalMattingNode] 尝试 Rembg 服务端...');
            const rembgResult = await rembgService.removeBackground(imageUrl, {
              model: 'birefnet-general',
              alphaMatting: edgeRefinement !== 'none',
            });
            if (rembgResult.success && rembgResult.imageUrl) {
              await acceptCandidate({
                imageUrl: rembgResult.imageUrl,
                maskUrl: rembgResult.maskUrl,
                strategyUsed: 'Rembg 服务端 (BiRefNet)',
                confidence: 0.9,
              });
            }
          }
        } catch (rembgError) {
          logger.warn('[LocalMattingNode] Rembg服务端失败:', rembgError);
        }
      }

      // ---- Engine 4: SmartMatting 级联回退 (百度AI → 色彩分割) ----
      if (!resultImageUrl) {
        try {
          logger.info('[LocalMattingNode] 尝试 SmartMatting 级联回退...');
          const smartResult = await smartMattingEngine.removeBackground(imageUrl, {
            strategy: 'auto',
            backgroundColor: 'transparent',
            edgeRefinement: edgeRefinement === 'none' ? 'none' : edgeRefinement,
            featherRadius,
            decontaminateColors,
            outputScale,
          });
          if (smartResult.success && smartResult.imageUrl) {
            await acceptCandidate({
              imageUrl: smartResult.imageUrl,
              maskUrl: smartResult.maskUrl,
              strategyUsed: smartResult.strategyUsed,
              confidence: smartResult.confidence || 0,
            });
          }
        } catch (smartError) {
          logger.warn('[LocalMattingNode] SmartMatting失败:', smartError);
        }
      }

      // ---- 应用背景色 (仅对非 Engine 0 的结果) ----
      if (resultImageUrl && !bgAlreadyApplied && backgroundColor !== 'transparent') {
        try {
          const bgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = resultImageUrl!;
          });

          const canvas = document.createElement('canvas');
          canvas.width = bgImg.naturalWidth || bgImg.width;
          canvas.height = bgImg.naturalHeight || bgImg.height;
          const ctx = canvas.getContext('2d')!;

          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bgImg, 0, 0);

          resultImageUrl = await new Promise<string>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                blobUrlsRef.current.add(url);
                resultMaskUrl = resultMaskUrl || url;
                resolve(url);
              } else {
                const dataUrl = canvas.toDataURL('image/png');
                resultMaskUrl = resultMaskUrl || dataUrl;
                resolve(dataUrl);
              }
            }, 'image/png');
          });
        } catch (bgError) {
          logger.warn('[LocalMattingNode] 背景色合成失败:', bgError);
        }
      }

      if (resultImageUrl) {
        setResultUrl(resultImageUrl);
        setProcessingResult({
          success: true,
          imageUrl: resultImageUrl,
          strategyUsed,
          confidence,
        });
        setImageUrl(resultImageUrl);

        updateNodeData(id as string, {
          imageUrl: resultImageUrl,
          resultUrl: resultImageUrl,
          originalImageUrl: originalImageUrl || imageUrl,
          maskUrl: resultMaskUrl || resultImageUrl,
          isProcessed: true,
          customBackground: backgroundColor,
          edgeFeathering: featherRadius,
          edgeSmoothing:
            edgeRefinement === 'none'
              ? 0
              : EDGE_REFINEMENT_LEVELS.findIndex((item) => item.id === edgeRefinement),
          processingMode: 'local-matting',
          task: { status: 'done', progress: 100, resultUrl: resultImageUrl },
        });

        toast.success(`抠图完成 · ${strategyUsed} (${Math.round(confidence * 100)}%)`);
        window.setTimeout(() => syncDownstreamFromNode(id as string), 0);
      } else {
        const reason =
          rejectedStrategies.length > 0
            ? `已尝试 ${rejectedStrategies.length} 个引擎，但结果质量不足：${rejectedStrategies.slice(0, 2).join('；')}`
            : '所有抠图引擎均不可用，请检查网络或浏览器兼容性';
        updateNodeData(id as string, {
          task: { status: 'error', error: reason },
        });
        toast.error(`抠图失败：${reason}`);
      }
    } catch (error) {
      const msg = (error as Error).message || '抠图失败';
      logger.error('[LocalMattingNode] 抠图失败:', error);
      updateNodeData(id as string, {
        task: { status: 'error', error: msg },
      });
      toast.error('抠图失败: ' + msg);
    } finally {
      setIsProcessing(false);
    }
  }, [
    imageUrl,
    originalImageUrl,
    edgeRefinement,
    featherRadius,
    decontaminateColors,
    outputScale,
    backgroundColor,
    id,
    updateNodeData,
  ]);

  useEffect(() => {
    const requestedAt = nodeData.executeRequestedAt ?? 0;
    if (!nodeData.autoExecute || !requestedAt) return;
    if (requestedAt === lastAutoExecuteRequestedAtRef.current) return;
    if (!imageUrl || isProcessing) return;

    lastAutoExecuteRequestedAtRef.current = requestedAt;
    updateNodeData(id as string, { autoExecute: false });

    // ✅ P3-6：500ms 防抖，避免图片加载完成瞬间触发多次自动执行
    const debounceTimer = window.setTimeout(() => {
      void handleExecuteMatting();
    }, 500);
    return () => window.clearTimeout(debounceTimer);
  }, [
    handleExecuteMatting,
    id,
    imageUrl,
    isProcessing,
    nodeData.autoExecute,
    nodeData.executeRequestedAt,
    updateNodeData,
  ]);

  const handleDownload = useCallback(() => {
    const urlToDownload = resultUrl || imageUrl;
    if (!urlToDownload) return;

    const link = document.createElement('a');
    link.href = urlToDownload;
    link.download = `matting_${fileName || 'result'}.png`;
    link.click();
  }, [resultUrl, imageUrl, fileName]);

  const getImageToDisplay = () => {
    return resultUrl || imageUrl;
  };

  return (
    <div
      className="relative w-[420px] group border-0 outline-none select-none"
      style={{ overflow: 'visible' }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.avif,.apng"
        className="hidden"
        data-testid="local-matting-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadImageFile(file);
          e.target.value = '';
        }}
      />
      {/* 输入 Handle */}
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="localMatting"
        inputId="image"
        outputId="output"
        extraOutputs={['mask']}
        inputTip="图片输入"
        outputTip="图片 / 遮罩输出"
      />

      <div className={selected ? aicgGlass.videoComposeFrameSelected : aicgGlass.videoComposeFrame}>
        <div className={aicgGlass.videoComposeInnerRing} />
        <AICGNodeShell
          variant="glass-stack"
          aicgType="tool"
          title="智能抠图"
          subtitle="自动识别主体并移除背景"
          selected={selected}
          width={420}
          onDelete={() => canvasStoreApi.deleteNode(id as string)}
          onControllerCollapse={() => setIsControllerCollapsed(true)}
          controlsCollapsed={isControllerCollapsed}
          onPreviewDoubleClick={(e) => {
            e.stopPropagation();
            setIsControllerCollapsed((value) => !value);
          }}
          preview={
            <div
              className="drag-handle relative flex cursor-grab items-center justify-center overflow-hidden bg-black/50 active:cursor-grabbing"
              data-testid="local-matting-preview"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleDropImage}
              style={{
                aspectRatio: '16/9',
                minHeight: 140,
                maxHeight: 280,
              }}
            >
              {getImageToDisplay() ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none" />

                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    {!imageLoaded && !imageError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                        <p className="text-[10px] text-white mt-2">加载中...</p>
                      </div>
                    )}

                    {imageError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                        <AlertCircle className="w-8 h-8 text-white mb-2" />
                        <p className="text-[10px] text-white">加载失败</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageChange();
                          }}
                          className="nodrag nowheel mt-3 px-4 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] text-white text-[10px] rounded-lg transition-colors border border-white/18"
                          data-testid="local-matting-reupload"
                        >
                          重新上传
                        </button>
                      </div>
                    )}

                    {/* 对比滑块模式 */}
                    {resultUrl && originalImageUrl && showComparison ? (
                      <div
                        ref={comparisonRef}
                        className="nodrag nowheel relative w-full h-full cursor-ew-resize select-none"
                        data-testid="local-matting-comparison"
                        onMouseDown={handleSliderStart}
                        onTouchStart={handleSliderStart}
                      >
                        {/* 原图层 (右侧) */}
                        <img
                          src={normalizeMediaUrl(originalImageUrl)}
                          alt="原图"
                          className="absolute inset-0 w-full h-full object-contain"
                          crossOrigin="anonymous"
                          draggable={false}
                        />
                        {/* 结果层 (左侧，按滑块裁剪) */}
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                        >
                          <img
                            src={normalizeMediaUrl(resultUrl)}
                            alt="抠图结果"
                            className="absolute inset-0 w-full h-full object-contain"
                            crossOrigin="anonymous"
                            draggable={false}
                          />
                        </div>
                        {/* 滑块线 */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none z-30"
                          style={{
                            left: `${sliderPosition}%`,
                            boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                          }}
                        >
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border-2 border-white shadow-lg flex items-center justify-center pointer-events-none">
                            <SlidersHorizontal className="w-4 h-4 text-black/70" />
                          </div>
                        </div>
                        {/* 标签 */}
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[8px] text-white/70 pointer-events-none z-30">
                          原图
                        </div>
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[8px] text-white/70 pointer-events-none z-30">
                          抠图
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'nodrag nowheel relative w-full h-full group/image',
                          interactiveMode === 'click' && 'cursor-crosshair',
                          interactiveMode === 'box' && 'cursor-crosshair'
                        )}
                        onClick={handleSAMClick}
                        onMouseDown={interactiveMode === 'box' ? handleSAMBoxStart : undefined}
                        onMouseMove={interactiveMode === 'box' ? handleSAMBoxMove : undefined}
                        onMouseUp={interactiveMode === 'box' ? handleSAMBoxEnd : undefined}
                        onContextMenu={handleSAMContextMenu}
                      >
                        <img
                          ref={imgRef}
                          src={normalizeMediaUrl(getImageToDisplay())}
                          alt="待抠图图片"
                          className={cn(
                            'w-full h-full object-contain bg-black/50',
                            imageError ? 'invisible' : 'visible'
                          )}
                          style={{
                            opacity: imageLoaded ? 1 : imageError ? 0 : 0.3,
                            transition: 'opacity 0.2s ease-in-out',
                          }}
                          onLoad={handleImageLoad}
                          onError={handleImageError}
                          crossOrigin="anonymous"
                          draggable={false}
                        />

                        {/* SAM 点标记渲染 */}
                        {interactiveMode === 'click' && samPoints.length > 0 && imageLoaded && (
                          <div className="absolute inset-0 pointer-events-none z-40">
                            {samPoints.map((point, idx) => (
                              <div
                                key={idx}
                                className="absolute w-3 h-3 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 shadow-lg"
                                style={{
                                  left: `${point.x * 100}%`,
                                  top: `${point.y * 100}%`,
                                  backgroundColor:
                                    point.label === 1
                                      ? 'rgba(52, 211, 153, 0.8)'
                                      : 'rgba(239, 68, 68, 0.8)',
                                  borderColor: point.label === 1 ? '#34d399' : '#ef4444',
                                  boxShadow: `0 0 8px ${point.label === 1 ? 'rgba(52, 211, 153, 0.6)' : 'rgba(239, 68, 68, 0.6)'}`,
                                }}
                              />
                            ))}
                          </div>
                        )}

                        {/* SAM 框选渲染 */}
                        {interactiveMode === 'box' &&
                          (samBox || (isDrawingBox && boxStart && boxEnd)) &&
                          imageLoaded && (
                            <div className="absolute inset-0 pointer-events-none z-40">
                              <div
                                className="absolute border-2 border-white/80 bg-white/[0.08]"
                                style={{
                                  left: `${(samBox?.x1 ?? Math.min(boxStart!.x, boxEnd!.x)) * 100}%`,
                                  top: `${(samBox?.y1 ?? Math.min(boxStart!.y, boxEnd!.y)) * 100}%`,
                                  width: `${((samBox?.x2 ?? Math.max(boxStart!.x, boxEnd!.x)) - (samBox?.x1 ?? Math.min(boxStart!.x, boxEnd!.x))) * 100}%`,
                                  height: `${((samBox?.y2 ?? Math.max(boxStart!.y, boxEnd!.y)) - (samBox?.y1 ?? Math.min(boxStart!.y, boxEnd!.y))) * 100}%`,
                                  boxShadow: '0 0 12px rgba(255, 255, 255, 0.22)',
                                }}
                              />
                            </div>
                          )}

                        {/* 交互模式提示 */}
                        {interactiveMode !== 'none' && imageLoaded && (
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/[0.12] backdrop-blur-md border border-white/24 flex items-center gap-1.5 pointer-events-none z-50 animate-pulse">
                            <svg
                              className="w-3 h-3 text-white"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 2L2 7l10 5 10-5-10-5z" />
                              <path d="M2 17l10 5 10-5" />
                              <path d="M2 12l10 5 10-5" />
                            </svg>
                            <span className="text-[9px] text-white font-medium">
                              {interactiveMode === 'click' ? '点击选择区域' : '框选目标物体'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {isMattingInProgress ? (
                      <div className="pointer-events-none absolute inset-x-5 bottom-5 z-40 rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur-md">
                        <div className="flex items-center justify-between text-[10px] font-medium text-white/90">
                          <span>抠图处理中</span>
                          <span className="font-mono">{mattingProgress}%</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
                          <div className="h-full rounded-full bg-[#FF9D2E] transition-[width] duration-200" style={{ width: `${mattingProgress}%` }} />
                        </div>
                      </div>
                    ) : null}

                    {/* 操作按钮 — 放右下角，避开节点右上角的关闭/收起按钮 */}
                    <div className="absolute bottom-2 right-2 flex gap-2 z-50">
                      {resultUrl && originalImageUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowComparison(!showComparison);
                          }}
                          className={cn(
                            'nodrag nowheel',
                            'w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 shadow-lg',
                            showComparison
                              ? 'bg-white/[0.16] text-white'
                              : 'bg-black/40 hover:bg-white/20 text-white'
                          )}
                          title={showComparison ? '关闭对比' : '开启对比'}
                          data-testid="local-matting-toggle-comparison"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPreview(true);
                        }}
                        className="nodrag nowheel w-8 h-8 rounded-full bg-black/40 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 shadow-lg"
                        title="预览图片"
                        data-testid="local-matting-open-preview"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 文件信息标签 */}
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 opacity-0 group-hover/image:opacity-100 transition-opacity">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
                      <span className="text-[10px] text-white font-mono uppercase tracking-wider truncate max-w-[100px]">
                        {fileName || 'local-matting'}
                      </span>
                    </div>

                    {/* 已处理标记 — 放左下角，避开节点右上角的关闭/收起按钮 */}
                    {resultUrl && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-white/[0.12] backdrop-blur-md border border-white/24 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-white" />
                        <span className="text-[9px] text-white font-medium">已抠图</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className="nodrag nowheel absolute inset-0 flex flex-col items-center justify-center hover:bg-white/5 transition-colors group/upload"
                  data-testid="local-matting-upload-zone"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImageChange();
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-white/32 transition-colors group-hover/upload:text-white/55">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                      <Upload className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <span className="text-[11px] font-medium">上传或拖入图片</span>
                    <span className="text-[8px]">JPG · PNG · WebP</span>
                  </div>
                </div>
              )}

              {/* 处理中遮罩 */}
              {isProcessing && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                  <Loader2 className="mb-2 h-6 w-6 animate-spin text-white/85" />
                  <span className="text-[10px] text-white/75">正在识别主体</span>
                </div>
              )}
            </div>
          }
          controls={
            <div className="flex flex-col gap-2.5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-white/58">抠图方式</span>
                <div className="flex items-center gap-1">
                  {nodeData.isProcessed ? (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="nodrag nowheel flex h-7 w-7 items-center justify-center rounded-md text-white/38 transition-colors hover:bg-white/[0.06] hover:text-white/75"
                      title="恢复原图"
                      data-testid="local-matting-reset"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleImageChange}
                    className="nodrag nowheel flex h-7 items-center gap-1 rounded-md px-1.5 text-[9px] text-white/42 transition-colors hover:bg-white/[0.06] hover:text-white/75"
                    data-testid="local-matting-replace"
                  >
                    <Upload className="h-3 w-3" />
                    更换图片
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-[9px] text-white/45">输出背景</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {BACKGROUND_COLORS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setBackgroundColor(bg.id)}
                      className={cn(
                        'nodrag nowheel',
                        'flex h-6 w-6 items-center justify-center rounded-md border transition-all',
                        backgroundColor === bg.id
                          ? 'border-white/70 ring-1 ring-white/25'
                          : 'border-white/10 hover:border-white/30'
                      )}
                      style={{
                        background:
                          bg.id === 'transparent'
                            ? 'repeating-conic-gradient(#333 0% 25%, #666 0% 50%) 50% / 8px 8px'
                            : bg.color,
                      }}
                      title={bg.label}
                      data-testid={`local-matting-bg-${bg.id.replace('#', '')}`}
                    >
                      {bg.id === 'transparent' && (
                        <span className="text-[6px] text-white/80">透明</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/45">选择方式</span>
                  {interactiveMode !== 'none' && (
                    <button
                      onClick={clearSAMInteraction}
                      className="nodrag nowheel text-[8px] text-white/40 hover:text-white/70 transition-colors"
                      data-testid="local-matting-clear-sam"
                    >
                      清除标记
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setInteractiveMode('none');
                      clearSAMInteraction();
                    }}
                    aria-label="自动"
                    className={cn(
                      'nodrag nowheel',
                      'flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-[9px] transition-colors',
                      interactiveMode === 'none'
                        ? 'bg-white/[0.08] text-white border border-white/22'
                        : 'bg-black/30 text-white/70 border border-white/5 hover:border-white/15'
                    )}
                    data-testid="local-matting-mode-auto"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span className="font-medium">自动</span>
                  </button>
                  <button
                    onClick={() => {
                      setSamBox(null);
                      setBoxStart(null);
                      setBoxEnd(null);
                      isDrawingBoxRef.current = false;
                      boxStartRef.current = null;
                      boxEndRef.current = null;
                      setInteractiveMode('click');
                    }}
                    aria-label="点击"
                    className={cn(
                      'nodrag nowheel',
                      'flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-[9px] transition-colors',
                      interactiveMode === 'click'
                        ? 'bg-white/[0.08] text-white border border-white/22'
                        : 'bg-black/30 text-white/70 border border-white/5 hover:border-white/15'
                    )}
                    data-testid="local-matting-mode-click"
                  >
                    <MousePointer2 className="h-3.5 w-3.5" />
                    <span className="font-medium">点击</span>
                  </button>
                  <button
                    onClick={() => {
                      setSamPoints([]);
                      setSamBox(null);
                      setBoxStart(null);
                      setBoxEnd(null);
                      isDrawingBoxRef.current = false;
                      boxStartRef.current = null;
                      boxEndRef.current = null;
                      setInteractiveMode('box');
                    }}
                    aria-label="框选"
                    className={cn(
                      'nodrag nowheel',
                      'flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-[9px] transition-colors',
                      interactiveMode === 'box'
                        ? 'bg-white/[0.08] text-white border border-white/22'
                        : 'bg-black/30 text-white/70 border border-white/5 hover:border-white/15'
                    )}
                    data-testid="local-matting-mode-box"
                  >
                    <Scan className="h-3.5 w-3.5" />
                    <span className="font-medium">框选</span>
                  </button>
                </div>

                {/* 交互提示 */}
                {interactiveMode === 'click' && (
                  <div className="text-[8px] text-white/40 text-center">
                    左键点击 = 前景 · 右键点击 = 背景
                    {samPoints.length > 0 && (
                      <span className="ml-1 text-white/70">({samPoints.length}个标记点)</span>
                    )}
                  </div>
                )}
                {interactiveMode === 'box' && (
                  <div className="text-[8px] text-white/40 text-center">
                    拖拽框选目标物体
                    {samBox && <span className="ml-1 text-white/70">(已框选)</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 border-t border-white/8 pt-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={cn(
                    'nodrag nowheel flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    showAdvanced
                      ? 'border-white/24 bg-white/[0.08] text-white/85'
                      : 'border-white/10 bg-white/[0.02] text-white/40 hover:border-white/18 hover:text-white/70'
                  )}
                  title="边缘设置"
                  aria-label="边缘设置"
                  data-testid="local-matting-advanced-toggle"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                {resultUrl ? (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="nodrag nowheel flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/40 transition-colors hover:border-white/18 hover:text-white/75"
                    title="下载结果"
                    aria-label="下载结果"
                    data-testid="local-matting-download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    interactiveMode === 'none'
                      ? void handleExecuteMatting()
                      : void handleExecuteSAM()
                  }
                  disabled={
                    isProcessing ||
                    !imageUrl ||
                    (interactiveMode === 'click' && samPoints.length === 0) ||
                    (interactiveMode === 'box' && !samBox)
                  }
                  className={cn(
                    'nodrag nowheel flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-all',
                    isProcessing ||
                      !imageUrl ||
                      (interactiveMode === 'click' && samPoints.length === 0) ||
                      (interactiveMode === 'box' && !samBox)
                      ? 'cursor-not-allowed border border-white/8 bg-white/[0.04] text-white/25'
                      : 'border border-[#FFB45A]/45 bg-[#FF8C00] text-white shadow-[0_0_14px_rgba(255,140,0,0.24)] hover:bg-[#F57C00] active:scale-[0.98]'
                  )}
                  data-testid={
                    interactiveMode === 'none'
                      ? 'local-matting-execute'
                      : 'local-matting-sam-execute'
                  }
                >
                  {isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  {isProcessing
                    ? '处理中'
                    : interactiveMode === 'none'
                      ? '一键智能抠图'
                      : interactiveMode === 'click'
                        ? '按标记抠图'
                        : '抠出选区'}
                </button>
              </div>

              {/* 高级选项内容 */}
              {showAdvanced && (
                <div className="space-y-2 p-2 bg-white/[0.035] rounded-lg border border-white/[0.1]">
                  {/* 边缘精化 */}
                  <div>
                    <span className="text-[8px] text-white/50 uppercase tracking-wider">
                      边缘精化
                    </span>
                    <div className="flex gap-1 mt-1">
                      {EDGE_REFINEMENT_LEVELS.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => setEdgeRefinement(level.id)}
                          className={cn(
                            'nodrag nowheel',
                            'flex-1 py-1 rounded-md text-[8px] transition-all',
                            edgeRefinement === level.id
                              ? 'bg-white/[0.08] text-white border border-white/22'
                              : 'bg-black/30 text-white/60 border border-white/5 hover:text-white/90'
                          )}
                          data-testid={`local-matting-edge-${level.id}`}
                        >
                          {level.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 羽化半径 */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-white/50 uppercase tracking-wider">
                        羽化半径
                      </span>
                      <span className="text-[8px] text-white/60">{featherRadius}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.5"
                      value={featherRadius}
                      onChange={(e) => setFeatherRadius(Number(e.target.value))}
                      className="w-full h-1 mt-1 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                      data-testid="local-matting-feather"
                    />
                  </div>

                  {/* 颜色净化 */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={decontaminateColors}
                        onChange={(e) => setDecontaminateColors(e.target.checked)}
                        className="w-3 h-3 rounded accent-white"
                        data-testid="local-matting-decontaminate"
                      />
                      <span className="text-[8px] text-white/70">颜色净化</span>
                    </label>
                  </div>
                </div>
              )}

              {processingResult && processingResult.success && (
                <div
                  className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 py-1.5"
                  data-testid="local-matting-result-info"
                >
                  <CheckCircle className="h-3 w-3 text-emerald-300/80" />
                  <span className="flex-1 text-[9px] text-white/58">抠图完成</span>
                  {processingResult.confidence && (
                    <span className="text-[9px] text-white/35">
                      质量 {Math.round(processingResult.confidence * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* 预览大图模态框 */}
      {showPreview &&
        getImageToDisplay() &&
        createPortal(
          <div
            tabIndex={-1}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-200 outline-none"
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setShowPreview(false);
              }
            }}
            ref={(el) => el?.focus()}
          >
            <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center group/modal">
              <img
                src={normalizeMediaUrl(getImageToDisplay())}
                alt="预览图片"
                className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded-lg border border-white/10"
                onClick={(e) => e.stopPropagation()}
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(false);
                }}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all hover:scale-110"
              >
                <CloseIcon className="w-6 h-6" />
              </button>

              <button
                onClick={handleDownload}
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full border border-white/20 bg-white/[0.12] hover:bg-white/[0.18] text-white text-sm font-medium flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-xl"
              >
                <Download className="w-4 h-4" />
                下载图片
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

LocalMattingNode.displayName = 'LocalMattingNode';

export default LocalMattingNode;
