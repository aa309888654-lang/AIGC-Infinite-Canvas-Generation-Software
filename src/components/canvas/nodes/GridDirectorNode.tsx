import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { AICGNodeTopCornerActions } from './AICGNodeShell';
import NodeModelSelect from './NodeModelSelect';
import { useNodeModels } from '@/hooks/useNodeModels';
import { useMembershipStore } from '@/store/useMembershipStore';
import {
  getModelDisplayShortLabel,
  groupImageModelsByProvider,
  mergeImageModelPresets,
} from './AIImageNode';
import { cn, getProxiedImageUrl } from '@/lib/utils';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { unifiedAPIModelService } from '@/services/unified-api-model-service';
import { getModelSupportedResolutions } from '@/config/model-resolutions';
import { toast } from 'sonner';
import {
  Loader2 as LoaderIcon,
  Image as ImageIcon,
  Grid3x3 as GridIcon,
  Film as FilmIcon,
  Layers as LayersIcon,
  Sparkles as SparklesIcon,
  Link2,
  User,
  Package,
  Building2,
  Scissors,
  Download,
  Upload,
  FileText,
  Pause,
  Play,
  RefreshCw,
  Maximize2,
  Minimize2,
  LockKeyhole,
  Settings2,
  AlertTriangle,
} from 'lucide-react';
import {
  DEFAULT_GRID_DIRECTOR_PARAMS,
  type GridDirectorMode,
  type GridDirectorFrameResult,
} from './grid-director-core';
import { buildStoryboardPlanFromPrompt } from './storyboard-plan-v2';
import { estimateGridDirectorGeneration } from './generation-estimates';
import {
  resolveCharacterReferenceFromNodeData,
  resolveOutfitReferenceFromNodeData,
} from './character-payload';
import { buildStoryboardPayload } from './storyboard-payload';
import { normalizeMediaUrl } from '@/lib/media-url';
import { validateStoryboardPlanContinuity } from '@/services/storyboard-continuity-validator';

type LightingStyle =
  | 'studio_soft'
  | 'dramatic_rim'
  | 'natural_sun'
  | 'golden_hour'
  | 'neon_noir'
  | 'cool_shadow'
  | 'even_three_point'
  | 'split_lighting';
type DirectorTab = 'plan' | 'reference' | 'generation';

interface SplitCellResult {
  cellIndex: number;
  imageUrl: string;
  status?: 'pending' | 'done' | 'failed';
  error?: string;
}

function getSplitLayoutDimensions(layout: string): { cols: number; rows: number } {
  switch (layout) {
    case '2x2':
      return { cols: 2, rows: 2 };
    case '2x3':
      return { cols: 2, rows: 3 };
    case '3x3':
      return { cols: 3, rows: 3 };
    case '3x4':
      return { cols: 3, rows: 4 };
    case '4x3':
      return { cols: 4, rows: 3 };
    case '4x6':
      return { cols: 4, rows: 6 };
    case '6x4':
      return { cols: 6, rows: 4 };
    default:
      return { cols: 3, rows: 3 };
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality = 0.92,
  tracker?: Set<string>
): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          tracker?.add(url);
          resolve(url);
        } else {
          resolve(canvas.toDataURL(type, quality));
        }
      },
      type,
      quality
    );
  });
}

async function splitImageToGrid(
  imageUrl: string,
  layout: string,
  gap: number,
  backgroundColor: string,
  blobTracker?: Set<string>
): Promise<{ cells: SplitCellResult[]; gridUrl: string }> {
  const { cols, rows } = getSplitLayoutDimensions(layout);

  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageUrl;
  });

  const cellWidth = Math.floor(img.width / cols);
  const cellHeight = Math.floor(img.height / rows);

  const cells: SplitCellResult[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellCanvas = document.createElement('canvas');
      cellCanvas.width = cellWidth;
      cellCanvas.height = cellHeight;
      const ctx = cellCanvas.getContext('2d');
      if (!ctx) {
        cells.push({
          cellIndex: r * cols + c,
          imageUrl: '',
          status: 'failed',
          error: 'Canvas context unavailable',
        });
        continue;
      }

      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, cellWidth, cellHeight);
      }

      const sx = c * cellWidth;
      const sy = r * cellHeight;
      ctx.drawImage(img, sx, sy, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);

      const cellUrl = await canvasToBlob(cellCanvas, undefined, undefined, blobTracker);
      cells.push({
        cellIndex: r * cols + c,
        imageUrl: cellUrl,
        status: 'done',
      });
    }
  }

  const gridCanvas = document.createElement('canvas');
  const totalW = cols * cellWidth + (cols + 1) * gap;
  const totalH = rows * cellHeight + (rows + 1) * gap;
  gridCanvas.width = totalW;
  gridCanvas.height = totalH;
  const gridCtx = gridCanvas.getContext('2d');
  if (!gridCtx) throw new Error('Canvas 2D context unavailable');

  gridCtx.fillStyle = backgroundColor;
  gridCtx.fillRect(0, 0, totalW, totalH);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellIndex = r * cols + c;
      const cell = cells[cellIndex];
      if (!cell || !cell.imageUrl) continue;

      const cellImg = new Image();
      await new Promise<void>((resolve) => {
        cellImg.onload = () => resolve();
        cellImg.onerror = () => resolve();
        cellImg.src = cell.imageUrl;
      });

      const x = c * cellWidth + (c + 1) * gap;
      const y = r * cellHeight + (r + 1) * gap;
      gridCtx.drawImage(cellImg, 0, 0, cellWidth, cellHeight, x, y, cellWidth, cellHeight);
    }
  }

  const gridUrl = await canvasToBlob(gridCanvas, undefined, undefined, blobTracker);

  return { cells, gridUrl };
}

const MODE_OPTIONS: Array<{
  id: GridDirectorMode;
  label: string;
  icon: React.ReactNode;
  summary: string;
}> = [
  {
    id: 'grid',
    label: '批量宫格',
    icon: <GridIcon className="w-3 h-3" />,
    summary: '一次生成多张独立画面并组成宫格',
  },
  {
    id: 'storyboard',
    label: '连续分镜',
    icon: <FilmIcon className="w-3 h-3" />,
    summary: '按叙事顺序批量生成连续镜头',
  },
  {
    id: 'hybrid',
    label: '混合编排',
    icon: <LayersIcon className="w-3 h-3" />,
    summary: '先生成宫格，再扩展选中镜头',
  },
  {
    id: 'split',
    label: '本地分割',
    icon: <Scissors className="w-3 h-3" />,
    summary: '将已有宫格拆成多张独立图片',
  },
];

const PRESET_OPTIONS = [
  { id: 'character_turnaround', label: '角色转身', desc: '多角度角色展示', icon: User },
  { id: 'product_showcase', label: '产品展示', desc: '商品多视角拍摄', icon: Package },
  { id: 'architecture', label: '建筑展示', desc: '建筑日景/黄昏/夜景', icon: Building2 },
  { id: 'character_fullset', label: '角色全设定', desc: '12格角色全套展示', icon: FilmIcon },
  { id: 'storyboard_full', label: '完整故事板', desc: '24格连续叙事分镜', icon: FilmIcon },
  { id: 'product_360', label: '产品360°', desc: '24格全方位产品展示', icon: Package },
];

const PRESET_RECOMMENDED_LAYOUT: Record<string, string[]> = {
  character_turnaround: ['3x3'],
  product_showcase: ['3x3'],
  architecture: ['3x3'],
  character_fullset: ['3x4', '4x3'],
  storyboard_full: ['4x6', '6x4'],
  product_360: ['4x6', '6x4'],
};

const LAYOUT_OPTIONS = [
  { id: '2x2', label: '2×2', rows: 2, cols: 2 },
  { id: '2x3', label: '2×3', rows: 2, cols: 3 },
  { id: '3x3', label: '3×3', rows: 3, cols: 3 },
  { id: '3x4', label: '3×4', rows: 3, cols: 4 },
  { id: '4x3', label: '4×3', rows: 4, cols: 3 },
  { id: '4x6', label: '4×6', rows: 4, cols: 6 },
  { id: '6x4', label: '6×4', rows: 6, cols: 4 },
];

const DIRECTOR_TAB_OPTIONS: Array<{ id: DirectorTab; label: string; icon: React.ReactNode }> = [
  { id: 'plan', label: '宫格批量', icon: <GridIcon className="h-3.5 w-3.5" /> },
  { id: 'reference', label: '一致性参考', icon: <LockKeyhole className="h-3.5 w-3.5" /> },
  { id: 'generation', label: '输出规格', icon: <Settings2 className="h-3.5 w-3.5" /> },
];

const SHOT_STRATEGY_OPTIONS = [
  { id: 'auto', label: '自动' },
  { id: 'story', label: '叙事' },
  { id: 'portrait', label: '角色' },
  { id: 'cinematic', label: '电影' },
];

const GPT_IMAGE_SIZE_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: '1024x1024', label: '1024' },
  { id: '1536x1024', label: '3:2' },
  { id: '1024x1536', label: '2:3' },
  { id: '2048x2048', label: '2K 方' },
  { id: '2048x1152', label: '2K 横' },
  { id: '3840x2160', label: '4K 横' },
  { id: '2160x3840', label: '4K 竖' },
];

const GPT_QUALITY_OPTIONS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'auto', label: 'Auto' },
];

const GPT_FORMAT_OPTIONS = [
  { id: 'png', label: 'PNG' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'webp', label: 'WebP' },
];

const EXTENDED_DEFAULTS = {
  lighting: 'studio_soft' as LightingStyle,
  aspectRatio: '1:1',
  quality: 'medium',
};

function extractImageUrlFromNodeData(sourceData: Record<string, unknown>): string | null {
  const task = sourceData.task as Record<string, unknown> | undefined;
  const candidates = [
    task?.resultUrl,
    Array.isArray(task?.resultUrls) ? task.resultUrls[0] : null,
    sourceData.gridImageUrl,
    sourceData.imageUrl,
    sourceData.resultUrl,
    Array.isArray(sourceData.resultUrls) ? sourceData.resultUrls[0] : null,
    sourceData.url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

function supportsReferenceGeneration(model: {
  modelInfo: { supportedModes?: unknown; capabilities?: string[] };
}): boolean {
  const supportedModes = model.modelInfo.supportedModes;
  if (supportedModes && typeof supportedModes === 'object' && !Array.isArray(supportedModes)) {
    const modes = supportedModes as {
      reference?: boolean;
      characterReference?: boolean;
      imageToImage?: boolean;
    };
    return !!(modes.reference || modes.characterReference || modes.imageToImage);
  }
  if (Array.isArray(supportedModes)) {
    return supportedModes.some((mode) =>
      /reference|character_reference|image_to_image|image-to-image/i.test(String(mode))
    );
  }
  return (model.modelInfo.capabilities || []).some((capability) =>
    /reference|character_reference|image_to_image|image-to-image/i.test(capability)
  );
}

interface ResilientImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  draggable?: boolean;
}

function buildImageCandidates(src: string | null | undefined): string[] {
  if (!src) return [];
  const candidates = [
    src,
    normalizeMediaUrl(src),
    normalizeMediaUrl(getProxiedImageUrl(src)),
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

function ResilientImage({ src, alt, className, draggable = false }: ResilientImageProps) {
  const candidates = useMemo(() => buildImageCandidates(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [src]);

  const currentSrc = candidates[candidateIndex] || '';
  if (!currentSrc) return null;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      draggable={draggable}
      onError={() => {
        setCandidateIndex((prev) => Math.min(prev + 1, candidates.length - 1));
      }}
    />
  );
}

interface GridDirectorNodeData {
  params?: Record<string, unknown>;
  frameResults?: GridDirectorFrameResult[];
  gridImageUrl?: string;
  coverImageUrl?: string;
  generationPaused?: boolean;
  retryFrameIndexes?: number[];
  task?: {
    status?: string;
    progress?: number;
    error?: string;
  };
  [key: string]: unknown;
}

const GridDirectorNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = (data || {}) as GridDirectorNodeData;
  const params = useMemo(
    () => ({ ...DEFAULT_GRID_DIRECTOR_PARAMS, ...EXTENDED_DEFAULTS, ...(nodeData.params || {}) }),
    [nodeData.params]
  );

  const [mode, setMode] = useState<GridDirectorMode>(params.mode as GridDirectorMode);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(
    (params.selectedFrameIndex as number) || 0
  );
  const [processingMode, setProcessingMode] = useState<'selected' | 'sequence'>(
    (params.processingMode as 'selected' | 'sequence') || 'selected'
  );
  const textFileInputRef = useRef<HTMLInputElement | null>(null);

  const [inputImageUrl, setInputImageUrl] = useState<string | null>(() => {
    const directCandidates = [
      nodeData.referenceImageUrl,
      nodeData.referenceImage,
      nodeData.receivedImageUrl,
      nodeData.sourceImageUrl,
      nodeData.sourceImage,
      nodeData.imageUrl,
      nodeData.originalImageUrl,
    ];
    for (const candidate of directCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    return null;
  });
  const [splitCellResults, setSplitCellResults] = useState<SplitCellResult[]>([]);
  const [splitGridImageUrl, setSplitGridImageUrl] = useState<string | null>(null);
  const [isSplitProcessing, setIsSplitProcessing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [activeDirectorTab, setActiveDirectorTab] = useState<DirectorTab>('plan');
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const revokeAllBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore stale object URLs that were already released by the browser.
      }
    });
    blobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      revokeAllBlobUrls();
    };
  }, [revokeAllBlobUrls]);

  const storeNodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);

  const currentNodeData = useMemo(() => {
    const node = storeNodes.find((n) => n.id === id);
    return (node?.data || {}) as GridDirectorNodeData;
  }, [storeNodes, id]);

  const apiConfigs = useUnifiedAPIConfigStore((state) => state.configs);
  const providerConfigs = useUnifiedAPIConfigStore((state) => state.providerConfigs);
  const isLoadingConfigs = useUnifiedAPIConfigStore((state) => state.isLoadingConfigs);
  const fetchProviderConfigs = useUnifiedAPIConfigStore((state) => state.fetchProviderConfigs);
  const hasProviderConfigs = Object.keys(providerConfigs).length > 0;

  const fetchProviderConfigsRef = useRef(fetchProviderConfigs);
  fetchProviderConfigsRef.current = fetchProviderConfigs;

  useEffect(() => {
    if (!hasProviderConfigs && !isLoadingConfigs) {
      fetchProviderConfigsRef.current();
    }
  }, [hasProviderConfigs, isLoadingConfigs]);

  useEffect(() => {
    setMode(params.mode as GridDirectorMode);
  }, [params.mode]);
  useEffect(() => {
    setSelectedFrameIndex((params.selectedFrameIndex as number) || 0);
  }, [params.selectedFrameIndex]);
  useEffect(() => {
    setProcessingMode((params.processingMode as 'selected' | 'sequence') || 'selected');
  }, [params.processingMode]);
  useEffect(() => {
    if (mode === 'split') setActiveDirectorTab('plan');
  }, [mode]);

  const updateParams = useCallback(
    (updates: Record<string, unknown>) => {
      canvasStoreApi.updateNodeData(id as string, {
        params: { ...params, ...updates },
      });
    },
    [id, params]
  );

  // 文字文件上传：支持 .txt / .md / .csv / .json / .log / .docx
  const handleTextFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const allowedExts = ['.txt', '.md', '.csv', '.json', '.log', '.text', '.docx'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExts.includes(ext)) {
        toast.error('仅支持文本文件 (.txt, .md, .csv, .json, .log, .docx)');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('文件过大，请上传小于 5MB 的文件');
        e.target.value = '';
        return;
      }

      const applyText = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) {
          toast.error('文件内容为空');
          return;
        }
        const existingPrompt = String(params.prompt || '').trim();
        const newPrompt = existingPrompt
          ? `${existingPrompt}\n\n--- 来自文件 ${file.name} ---\n${trimmed}`
          : trimmed;
        updateParams({ prompt: newPrompt });
        toast.success(`已导入 ${file.name} (${trimmed.length} 字符)`);
      };

      if (ext === '.docx') {
        // .docx 需使用 mammoth 解析为纯文本
        file
          .arrayBuffer()
          .then((buf) =>
            import('mammoth').then((mammoth) => mammoth.extractRawText({ arrayBuffer: buf }))
          )
          .then((result: { value: string }) => applyText(result.value || ''))
          .catch(() => toast.error('DOCX 解析失败，请尝试另存为 .txt'));
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => applyText(String(ev.target?.result || ''));
        reader.onerror = () => toast.error('文件读取失败');
        reader.readAsText(file, 'utf-8');
      }
      e.target.value = '';
    },
    [params.prompt, updateParams]
  );

  const incomingConnections = useMemo(() => {
    return edges
      .filter((e) => e.target === id)
      .map((edge) => {
        const sourceNode = storeNodes.find((n) => n.id === edge.source);
        if (!sourceNode) return null;
        const sourceData = (sourceNode.data || {}) as Record<string, unknown>;
        const sourceType = (sourceData as { type?: string })?.type || sourceNode.type || '';
        const sourceHandle = edge.sourceHandle || undefined;

        let detectedType = 'reference';
        if (sourceType === 'characterLibrary') {
          detectedType = sourceHandle === 'outfitRef' ? 'outfitRef' : 'characterRef';
        } else if (sourceType === 'prompt') {
          detectedType = 'prompt';
        }

        const sourceName = (sourceData as { label?: string })?.label || sourceType;
        const imageUrl = extractImageUrlFromNodeData(sourceData);
        return { edgeId: edge.id, sourceName, sourceType, detectedType, sourceHandle, imageUrl };
      })
      .filter(Boolean) as Array<{
      edgeId: string;
      sourceName: string;
      sourceType: string;
      detectedType: string;
      sourceHandle?: string;
      imageUrl: string | null;
    }>;
  }, [edges, id, storeNodes]);

  const resolvedReferences = useMemo(() => {
    const result: {
      reference?: string;
      characterRef?: string;
      outfitRef?: string;
      promptPatch?: string;
      referenceImageUrl?: string;
      referenceLabel?: string;
    } = {};
    for (const conn of incomingConnections) {
      const edge = edges.find((e) => e.id === conn.edgeId);
      const sourceNode = edge ? storeNodes.find((n) => n.id === edge.source) : undefined;
      if (!sourceNode) continue;
      const sourceData = (sourceNode.data || {}) as Record<string, unknown>;

      if (conn.detectedType === 'prompt') {
        const promptText = (sourceData as { prompt?: string })?.prompt || '';
        if (promptText && !result.promptPatch) {
          result.promptPatch = promptText;
        }
      } else if (conn.detectedType === 'characterRef' && !result.characterRef) {
        result.characterRef = resolveCharacterReferenceFromNodeData(sourceData, conn.sourceHandle);
        if (conn.imageUrl && !result.referenceImageUrl) {
          result.referenceImageUrl = conn.imageUrl;
          result.referenceLabel = conn.sourceName;
        }
      } else if (conn.detectedType === 'outfitRef' && !result.outfitRef) {
        result.outfitRef =
          resolveOutfitReferenceFromNodeData(sourceData) ||
          resolveCharacterReferenceFromNodeData(sourceData, conn.sourceHandle);
        if (conn.imageUrl && !result.referenceImageUrl) {
          result.referenceImageUrl = conn.imageUrl;
          result.referenceLabel = conn.sourceName;
        }
      } else if (!result.reference) {
        result.reference = resolveCharacterReferenceFromNodeData(sourceData, conn.sourceHandle);
        if (conn.imageUrl && !result.referenceImageUrl) {
          result.referenceImageUrl = conn.imageUrl;
          result.referenceLabel = conn.sourceName;
        }
      }
    }
    return result;
  }, [incomingConnections, edges, storeNodes]);

  const hasReferenceInput = !!(
    resolvedReferences.reference ||
    resolvedReferences.characterRef ||
    resolvedReferences.outfitRef
  );

  useEffect(() => {
    if (mode !== 'split') return;
    const imageConn = incomingConnections.find((c) => c.imageUrl);
    const newUrl = imageConn?.imageUrl || null;
    if (newUrl !== inputImageUrl) {
      setInputImageUrl(newUrl);
      // 切换图片时清空旧的分割结果
      setSplitCellResults([]);
      setSplitGridImageUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, incomingConnections]);

  useEffect(() => {
    const patch: Record<string, unknown> = {};
    const newRef = resolvedReferences.reference || '';
    if (newRef !== (params.reference || '')) patch.reference = newRef;
    const newCharRef = resolvedReferences.characterRef || '';
    if (newCharRef !== (params.characterRef || '')) patch.characterRef = newCharRef;
    const newOutfitRef = resolvedReferences.outfitRef || '';
    if (newOutfitRef !== (params.outfitRef || '')) patch.outfitRef = newOutfitRef;
    if (resolvedReferences.promptPatch && !params.prompt) {
      patch.prompt = resolvedReferences.promptPatch;
    }
    if (Object.keys(patch).length > 0) {
      updateParams(patch);
    }
  }, [
    resolvedReferences.reference,
    resolvedReferences.characterRef,
    resolvedReferences.outfitRef,
    resolvedReferences.promptPatch,
    params.reference,
    params.characterRef,
    params.outfitRef,
    params.prompt,
    updateParams,
  ]);

  const { models: nodeImageModels } = useNodeModels('aiImage');
  const membershipLevel = useMembershipStore((s) => s.membership?.membershipLevel || 'trial');

  const visibleImageModelPresets = useMemo(
    () => mergeImageModelPresets(nodeImageModels, membershipLevel),
    [membershipLevel, nodeImageModels]
  );

  const availableImageModels = useMemo(
    () =>
      visibleImageModelPresets.map((m) => ({
        value: m.id,
        label: getModelDisplayShortLabel(m),
        provider: m.provider,
        description: m.note || m.capabilityTags?.join(' · ') || '',
        badge: m.badge,
        modelInfo: {
          name: getModelDisplayShortLabel(m),
          capabilities: m.modes,
          supportedAspectRatios: m.aspectRatios,
        },
      })),
    [visibleImageModelPresets]
  );

  const referenceCompatibleImageModels = useMemo(
    () => availableImageModels.filter((model) => supportsReferenceGeneration(model)),
    [availableImageModels]
  );

  const groupedModelOptions = useMemo(
    () =>
      groupImageModelsByProvider(visibleImageModelPresets).map((group) => ({
        label: group.label,
        options: group.options.map((model) => ({
          value: model.id,
          label: getModelDisplayShortLabel(model),
          provider: model.provider,
          description: model.note || model.capabilityTags?.join(' · ') || '',
          badge: model.badge,
        })),
      })),
    [visibleImageModelPresets]
  );

  useEffect(() => {
    if (nodeData.lockDefaultModel || params.modelId === 'doubao-seedream-5-0-pro') return;
    if (!hasReferenceInput || referenceCompatibleImageModels.length === 0) return;
    const currentModelSupported = referenceCompatibleImageModels.some(
      (model) => model.value === params.modelId
    );
    if (currentModelSupported) return;
    const fallbackModel = referenceCompatibleImageModels[0];
    updateParams({ modelId: fallbackModel.value, modelProvider: fallbackModel.provider });
  }, [
    hasReferenceInput,
    params.modelId,
    referenceCompatibleImageModels,
    updateParams,
    nodeData.lockDefaultModel,
  ]);

  const modelAspectRatios = useMemo(() => {
    const resolutions = getModelSupportedResolutions(params.modelId as string);
    const aspectRatios = new Set<string>();
    resolutions.forEach((r) => aspectRatios.add(r.aspectRatio));
    return Array.from(aspectRatios).map((v) => ({ value: v, label: v }));
  }, [params.modelId]);

  useEffect(() => {
    const current = params.aspectRatio as string;
    const isSupported = modelAspectRatios.some((r) => r.value === current);
    if (!isSupported && modelAspectRatios.length > 0) {
      updateParams({ aspectRatio: modelAspectRatios[0].value });
    }
  }, [params.aspectRatio, modelAspectRatios, params.modelId, updateParams]);

  const currentModeInfo = MODE_OPTIONS.find((o) => o.id === mode) || MODE_OPTIONS[0];
  const currentPreset = PRESET_OPTIONS.find((p) => p.id === params.preset) || PRESET_OPTIONS[0];
  const currentLayout = LAYOUT_OPTIONS.find((l) => l.id === params.layout) || LAYOUT_OPTIONS[2];

  const frameResults = currentNodeData.frameResults;
  const gridImageUrl = currentNodeData.gridImageUrl;
  const coverImageUrl = currentNodeData.coverImageUrl;
  const taskStatus = currentNodeData.task?.status;
  const taskError = currentNodeData.task?.error;
  const isRunning = taskStatus === 'processing' || taskStatus === 'pending';
  const isCompleted = taskStatus === 'completed';
  const isFailed = taskStatus === 'failed';
  const isPaused = currentNodeData.generationPaused === true;

  const succeededFrames = frameResults?.filter((f) => f.status === 'succeeded' && f.imageUrl) || [];
  const failedFrames = frameResults?.filter((f) => f.status === 'failed') || [];
  const hasSuccessfulFrames = succeededFrames.length > 0;

  const totalFrames = (params.rows as number) * (params.cols as number);
  const storyboardPreviewPlan = useMemo(() => {
    if (mode === 'split') return null;
    return buildStoryboardPlanFromPrompt({
      rows: Number(params.rows || 1),
      cols: Number(params.cols || 1),
      prompt: String(params.prompt || ''),
      shotStrategy: (params.shotStrategy as 'auto' | 'story' | 'portrait' | 'cinematic') || 'auto',
      size: (params.size as any) || 'auto',
      modelId: String(params.modelId || 'doubao-seedream-5-0-pro'),
      provider: String(params.modelProvider || 'doubao'),
      quality: (params.quality as any) || 'medium',
      outputFormat: (params.gptOutputFormat as any) || 'png',
      outputCompression: params.gptOutputCompression as number | undefined,
      background: (params.gptBackground as any) || 'opaque',
      moderation: (params.moderation as any) || 'auto',
      useMultiImageReferences: params.useMultiImageReferences as boolean | undefined,
      useEditEndpointWhenReferenceExists: params.useEditEndpointWhenReferenceExists as
        | boolean
        | undefined,
      maxReferenceImages: Number(params.maxReferenceImages || 4),
      maxReferenceFileSizeMB: Number(params.maxReferenceFileSizeMB || 1.5),
      maxConcurrentFrames: Number(params.maxConcurrentFrames || 2),
      providerExtensions: params.providerExtensions as any,
    });
  }, [
    mode,
    params.rows,
    params.cols,
    params.prompt,
    params.shotStrategy,
    params.size,
    params.modelId,
    params.modelProvider,
    params.quality,
    params.gptOutputFormat,
    params.gptOutputCompression,
    params.gptBackground,
    params.moderation,
    params.useMultiImageReferences,
    params.useEditEndpointWhenReferenceExists,
    params.maxReferenceImages,
    params.maxReferenceFileSizeMB,
    params.maxConcurrentFrames,
    params.providerExtensions,
  ]);
  const continuityWarnings = useMemo(
    () =>
      storyboardPreviewPlan
        ? validateStoryboardPlanContinuity(storyboardPreviewPlan, params as any)
        : [],
    [storyboardPreviewPlan, params]
  );

  const expectedPoints = useMemo(() => {
    let basePerFrame = 40;
    const mid = (params.modelId as string)?.toLowerCase() || '';
    if (mid.includes('flux-2')) basePerFrame = 30;
    else if (mid.includes('flux')) basePerFrame = 20;
    else if (mid.includes('seedream') || mid.includes('doubao')) basePerFrame = 10;
    else if (mid.includes('image-01') || mid.includes('minimax')) basePerFrame = 10;
    return basePerFrame * totalFrames;
  }, [params.modelId, totalFrames]);
  const generationEstimate = useMemo(
    () => estimateGridDirectorGeneration(totalFrames, expectedPoints, mode),
    [expectedPoints, mode, totalFrames]
  );

  // P2 修复：handleSplit 提前定义，供 handleGenerate 在 split 模式调用
  const handleSplit = useCallback(async () => {
    if (!inputImageUrl) {
      toast.error('请先连接图片节点');
      return;
    }
    if (isRunning) {
      toast.error('已有任务正在执行，请等待完成');
      return;
    }
    setIsSplitProcessing(true);
    canvasStoreApi.updateNodeData(id as string, {
      task: { status: 'processing', progress: 0 },
    });
    try {
      revokeAllBlobUrls();
      const { cells, gridUrl } = await splitImageToGrid(
        inputImageUrl,
        params.layout as string,
        (params.gap as number) ?? 4,
        (params.splitBackgroundColor as string) ?? '#1a1a2e',
        blobUrlsRef.current
      );
      setSplitCellResults(cells);
      setSplitGridImageUrl(gridUrl);
      const { cols: splitCols } = getSplitLayoutDimensions(params.layout as string);
      const splitFrameResults = cells.map((c) => ({
        cellIndex: c.cellIndex,
        rowIndex: Math.floor(c.cellIndex / splitCols),
        colIndex: c.cellIndex % splitCols,
        imageUrl: c.imageUrl,
        prompt: '',
        status: c.status === 'done' ? ('succeeded' as const) : ('failed' as const),
        error: c.error,
      }));
      canvasStoreApi.updateNodeData(id as string, {
        gridImageUrl: gridUrl,
        coverImageUrl: cells.find((cell) => cell.imageUrl)?.imageUrl || gridUrl,
        frameResults: splitFrameResults,
        storyboardPayload: buildStoryboardPayload({
          sourceNodeType: 'gridDirector',
          gridImageUrl: gridUrl,
          coverImageUrl: cells.find((cell) => cell.imageUrl)?.imageUrl || gridUrl,
          selectedFrameIndex,
          processingMode,
          frames: splitFrameResults,
        }),
        task: { status: 'completed', progress: 100 },
      });
      toast.success(`图片分割完成！${cells.length} 宫格`);
      syncDownstreamFromNode(id as string);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分割失败';
      toast.error('图片分割失败', { description: errorMessage });
      setSplitCellResults([]);
      setSplitGridImageUrl(null);
      canvasStoreApi.updateNodeData(id as string, {
        task: { status: 'failed', progress: 100, error: errorMessage },
      });
    } finally {
      setIsSplitProcessing(false);
    }
  }, [
    inputImageUrl,
    isRunning,
    params.layout,
    params.gap,
    params.splitBackgroundColor,
    selectedFrameIndex,
    processingMode,
    id,
    revokeAllBlobUrls,
  ]);

  const handleGenerate = useCallback(() => {
    if (isRunning) return; // 防止重复执行
    // P2 修复：split 模式走本地切割路径，避免触发后端生成
    if (mode === 'split') {
      void handleSplit();
      return;
    }
    canvasStoreApi.updateNodeData(id as string, {
      frameResults: [],
      gridImageUrl: undefined,
      coverImageUrl: undefined,
      storyboardPayload: undefined,
      generationPaused: false,
      retryFrameIndexes: undefined,
      task: { status: 'processing', progress: 0 },
    });
    window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id } }));
  }, [id, isRunning, mode, handleSplit]);

  const handlePauseGeneration = useCallback(() => {
    if (!isRunning) return;
    canvasStoreApi.updateNodeData(id as string, { generationPaused: true });
    // ✅ P1-3：暂停即中止当前帧（fetch 被 AbortController 取消，标记为 failed 可重试）
    toast.message('已暂停，当前帧已中止');
  }, [id, isRunning]);

  const handleResumeGeneration = useCallback(() => {
    canvasStoreApi.updateNodeData(id as string, { generationPaused: false });
    toast.success('已恢复生成');
  }, [id]);

  const handleRetryFrames = useCallback(
    (frameIndexes: number[]) => {
      const normalized = Array.from(
        new Set(
          frameIndexes
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.max(0, Math.floor(value)))
        )
      );
      if (normalized.length === 0 || isRunning || mode === 'split') return;
      canvasStoreApi.updateNodeData(id as string, {
        generationPaused: false,
        retryFrameIndexes: normalized,
        task: { status: 'processing', progress: 0 },
        error: undefined,
      });
      window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id } }));
    },
    [id, isRunning, mode]
  );

  const autoExecuteKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!nodeData.autoExecute || mode === 'split' || isRunning) return;
    const key = `${nodeData.executeRequestedAt || 'initial'}:${inputImageUrl || resolvedReferences.referenceImageUrl || ''}:${params.modelId}:${params.layout}`;
    if (autoExecuteKeyRef.current === key) return;
    autoExecuteKeyRef.current = key;
    const timer = window.setTimeout(() => {
      handleGenerate();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    handleGenerate,
    inputImageUrl,
    isRunning,
    mode,
    nodeData.autoExecute,
    nodeData.executeRequestedAt,
    params.layout,
    params.modelId,
    resolvedReferences.referenceImageUrl,
  ]);

  const handleSplitDownload = useCallback(() => {
    if (!splitGridImageUrl) return;
    const a = document.createElement('a');
    a.href = splitGridImageUrl;
    a.download = `grid-split-${Date.now()}.png`;
    a.click();
  }, [splitGridImageUrl]);

  const primaryGenerationButton =
    mode !== 'split' ? (
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isRunning}
        className={cn(
          'nodrag flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-[11px] font-semibold transition active:scale-[0.995]',
          isRunning
            ? 'cursor-not-allowed bg-white/[0.07] text-white/28'
            : 'bg-amber-500 text-black shadow-[0_8px_20px_rgba(245,158,11,0.16)] hover:bg-amber-400'
        )}
      >
        {isRunning ? (
          <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <SparklesIcon className="h-3.5 w-3.5" />
        )}
        <span>
          {isRunning ? `正在生成 ${totalFrames} 张分镜...` : `生成 ${totalFrames} 张分镜`}
        </span>
        <span className="rounded bg-black/10 px-1.5 py-0.5 text-[8px]">{expectedPoints} 积分</span>
        <span className="rounded bg-black/10 px-1.5 py-0.5 text-[8px]">
          {generationEstimate.timeLabel}
        </span>
      </button>
    ) : null;

  return (
    <div
      className="relative group w-[548px] select-none border-0 outline-none transition-all duration-300"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsExpanded((p) => !p);
      }}
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="gridDirector"
        inputId="scriptInput"
        outputId="output"
        extraInputs={['imageInput', 'characterRef', 'input']}
        extraOutputs={['scenes']}
        inputTip="脚本 / 图片 / 角色参考"
        outputTip="输出 (宫格图/封面/分镜数据)"
      />

      <div
        className={cn(
          'relative overflow-hidden rounded-lg border border-white/[0.09] bg-[#0d0f12] shadow-[0_18px_50px_rgba(0,0,0,0.48)] transition-all hover:border-white/[0.16]',
          selected && 'border-amber-300/35 shadow-[0_22px_64px_rgba(0,0,0,0.62)]'
        )}
      >
        <AICGNodeTopCornerActions
          onDelete={() => canvasStoreApi.deleteNode(id as string)}
          onControllerCollapse={() => setIsExpanded(false)}
          showControllerClose={isExpanded}
        />

        <div
          className={cn(
            'group/preview relative flex h-[284px] cursor-pointer items-center justify-center overflow-hidden bg-black transition-all duration-300',
            isExpanded ? 'rounded-t-lg' : 'rounded-lg'
          )}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsExpanded((p) => !p);
          }}
        >
          {coverImageUrl || gridImageUrl ? (
            <ResilientImage
              src={coverImageUrl || gridImageUrl}
              alt="分镜导演预览"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : succeededFrames.length > 0 ? (
            <div className="grid h-full w-full grid-cols-3 gap-1 bg-black p-2">
              {succeededFrames.slice(0, 9).map((frame) => (
                <div
                  key={frame.cellIndex}
                  className="overflow-hidden rounded-md border border-white/10 bg-black"
                >
                  <ResilientImage
                    src={frame.imageUrl}
                    alt={`帧${frame.cellIndex + 1}`}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          ) : inputImageUrl && mode === 'split' ? (
            <div className="relative h-full w-full">
              <ResilientImage
                src={inputImageUrl}
                alt="输入图片"
                className="h-full w-full object-contain opacity-50"
                draggable={false}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white/75 backdrop-blur-sm">
                  等待分割
                </span>
              </div>
            </div>
          ) : (
            <div
              className="grid h-full w-full gap-1 bg-[#070809] p-3 opacity-75"
              style={{ gridTemplateColumns: `repeat(${currentLayout.cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: totalFrames }, (_, index) => (
                <div
                  key={index}
                  className="relative min-h-0 overflow-hidden rounded border border-white/[0.07] bg-white/[0.025]"
                >
                  <span className="absolute left-1.5 top-1 text-[8px] tabular-nums text-white/18">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <GridIcon className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white/[0.06]" />
                </div>
              ))}
            </div>
          )}

          <div className="absolute left-3 top-3 flex items-center gap-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/65 px-2.5 backdrop-blur-md">
              <FilmIcon className="h-3.5 w-3.5 text-amber-200/80" />
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isRunning
                    ? 'animate-pulse bg-amber-300'
                    : isCompleted
                      ? 'bg-emerald-300'
                      : isFailed
                        ? 'bg-red-400'
                        : 'bg-white/35'
                )}
              />
              <span className="text-[10px] font-semibold text-white/88">分镜导演</span>
              <span className="text-[9px] text-white/38">
                {isRunning ? '执行中' : isCompleted ? '已完成' : isFailed ? '失败' : '就绪'}
              </span>
            </div>
          </div>

          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
            <div className="min-w-0 rounded-md border border-white/[0.08] bg-black/60 px-2.5 py-1.5 backdrop-blur-md">
              <div className="truncate text-[10px] font-medium text-white/76">
                {currentPreset.label}
              </div>
              <div className="mt-0.5 text-[8px] text-white/36">
                {currentLayout.label} · {totalFrames} 帧 · {currentModeInfo.label}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-md border border-white/[0.08] bg-black/60 p-1 backdrop-blur-md">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMode(option.id);
                    updateParams({ mode: option.id });
                  }}
                  title={option.summary}
                  className={cn(
                    'nodrag flex h-7 w-8 items-center justify-center rounded text-white/38 transition-colors',
                    mode === option.id
                      ? 'bg-amber-300/16 text-amber-100'
                      : 'hover:bg-white/[0.07] hover:text-white/75'
                  )}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'transition-all duration-300 relative',
            !isExpanded ? 'h-0 overflow-hidden opacity-0' : 'h-auto opacity-100'
          )}
        >
          <div
            className={cn(
              'nodrag nowheel max-h-[540px] space-y-3 overflow-x-hidden overflow-y-auto p-3'
            )}
          >
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/30 p-1">
              {DIRECTOR_TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={mode === 'split' && tab.id !== 'plan'}
                  onClick={() => setActiveDirectorTab(tab.id)}
                  className={cn(
                    'nodrag flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-colors',
                    activeDirectorTab === tab.id
                      ? 'bg-amber-300/12 text-amber-100 shadow-sm'
                      : 'text-white/38 hover:bg-white/[0.05] hover:text-white/72',
                    mode === 'split' &&
                      tab.id !== 'plan' &&
                      'cursor-not-allowed opacity-30 hover:bg-transparent hover:text-white/38'
                  )}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>

            {mode !== 'split' && activeDirectorTab === 'plan' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-semibold text-white/76">批量画面描述</div>
                    <div className="mt-0.5 text-[8px] text-white/30">
                      自动拆成多张独立分镜并组成宫格
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => textFileInputRef.current?.click()}
                      title="上传剧本/文字文件 (.txt, .md, .csv, .json, .log, .docx)"
                      className="nodrag flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white/85"
                    >
                      <Upload className="h-3 w-3" />
                      <span>导入文本</span>
                    </button>
                  </div>
                  <input
                    ref={textFileInputRef}
                    type="file"
                    accept=".txt,.md,.csv,.json,.log,.text,.docx,text/plain,text/markdown,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleTextFileUpload}
                    className="hidden"
                  />
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPromptExpanded((prev) => !prev)}
                    title={isPromptExpanded ? '收起输入框' : '扩大输入框'}
                    className="nodrag nowheel absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/45 text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white/85"
                  >
                    {isPromptExpanded ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <textarea
                    value={params.prompt as string}
                    onChange={(e) => {
                      if (!isComposing) updateParams({ prompt: e.target.value });
                    }}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(e) => {
                      setIsComposing(false);
                      updateParams({ prompt: (e.target as HTMLTextAreaElement).value });
                    }}
                    placeholder="描述场景、角色和镜头变化，或导入剧本批量拆镜..."
                    rows={isPromptExpanded ? 10 : 3}
                    className={cn(
                      'w-full px-2.5 py-1.5 pr-10 bg-black/30 border border-white/10 rounded-lg text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-white/40 resize-none nodrag nowheel transition-[min-height] duration-200',
                      isPromptExpanded ? 'min-h-[260px]' : 'min-h-[76px]'
                    )}
                  />
                </div>
                {params.prompt && (
                  <div className="flex items-center gap-1 text-[9px] text-white/35">
                    <FileText className="h-2.5 w-2.5" />
                    <span>{String(params.prompt).length} 字符</span>
                  </div>
                )}
              </div>
            )}

            {mode !== 'split' && activeDirectorTab === 'reference' && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-white/35" />
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    参考图
                  </span>
                  <span className="truncate text-[10px] text-white/42">
                    {resolvedReferences.referenceImageUrl
                      ? resolvedReferences.referenceLabel || '已绑定参考'
                      : '连接左侧端口后自动识别'}
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px]',
                    hasReferenceInput
                      ? 'border-white/24 bg-white/[0.08] text-white/78'
                      : 'border-white/10 bg-white/5 text-white/40'
                  )}
                >
                  {hasReferenceInput ? '已连接' : '未连接'}
                </span>
              </div>
            )}

            {mode !== 'split' && activeDirectorTab === 'generation' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                  模型
                </label>
                <NodeModelSelect
                  value={params.modelId as string}
                  groupedOptions={groupedModelOptions}
                  onChange={(value) => {
                    const m = availableImageModels.find((x) => x.value === value);
                    if (m) updateParams({ modelId: m.value, modelProvider: m.provider });
                  }}
                  className="w-full"
                />
              </div>
            )}

            {mode !== 'split' && activeDirectorTab === 'plan' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-semibold text-white/58">快速场景</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRESET_OPTIONS.map((preset) => {
                      const Icon = preset.icon;
                      const active = preset.id === params.preset;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const recommended = PRESET_RECOMMENDED_LAYOUT[preset.id];
                            const nextParams: Record<string, unknown> = { preset: preset.id };
                            if (recommended && !recommended.includes(params.layout as string)) {
                              const layoutOption = LAYOUT_OPTIONS.find(
                                (item) => item.id === recommended[0]
                              );
                              if (layoutOption) {
                                nextParams.layout = layoutOption.id;
                                nextParams.rows = layoutOption.rows;
                                nextParams.cols = layoutOption.cols;
                              }
                            }
                            updateParams(nextParams);
                          }}
                          title={preset.desc}
                          className={cn(
                            'nodrag flex h-9 min-w-0 items-center gap-1.5 rounded-md border px-2 text-left text-[9px] transition-colors',
                            active
                              ? 'border-amber-300/25 bg-amber-300/[0.09] text-amber-100'
                              : 'border-white/[0.07] bg-black/20 text-white/45 hover:border-white/[0.14] hover:text-white/72'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                    布局
                  </label>
                  <select
                    value={params.layout as string}
                    onChange={(e) => {
                      const layout =
                        LAYOUT_OPTIONS.find((item) => item.id === e.target.value) ||
                        LAYOUT_OPTIONS[2];
                      updateParams({ layout: layout.id, rows: layout.rows, cols: layout.cols });
                    }}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/40 nodrag nowheel"
                  >
                    {LAYOUT_OPTIONS.map((l) => (
                      <option key={l.id} value={l.id} className="bg-[#101012]">
                        {l.label} · {l.rows * l.cols}帧
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-white/58">批量规模</label>
                  <div className="flex h-8 items-center justify-between rounded-lg border border-white/[0.07] bg-black/25 px-2.5">
                    <span className="text-[10px] text-white/45">独立分镜</span>
                    <span className="text-[11px] font-semibold tabular-nums text-amber-100/80">
                      {totalFrames} 张
                    </span>
                  </div>
                </div>
              </div>
            )}

            {
              <div className="space-y-2 rounded-lg border border-white/[0.07] bg-[#101216] p-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                {activeDirectorTab === 'plan' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          镜头策略
                        </label>
                        <select
                          value={(params.shotStrategy as string) || 'auto'}
                          onChange={(e) => updateParams({ shotStrategy: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        >
                          {SHOT_STRATEGY_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id} className="bg-[#101012]">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          输出方式
                        </label>
                        <div className="grid grid-cols-2 gap-1">
                          {(['selected', 'sequence'] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setProcessingMode(value);
                                updateParams({ processingMode: value });
                              }}
                              className={cn(
                                'nodrag h-8 rounded-md border text-[10px] transition-colors',
                                processingMode === value
                                  ? 'border-white/40 bg-white/14 text-white'
                                  : 'border-white/10 bg-black/20 text-white/48 hover:text-white/75'
                              )}
                            >
                              {value === 'selected' ? '选中帧' : '序列帧'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {storyboardPreviewPlan && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-white/45">
                          <span>
                            {storyboardPreviewPlan.shots.length} 镜头 ·{' '}
                            {storyboardPreviewPlan.project.visualStyle}
                          </span>
                          <span>{storyboardPreviewPlan.project.aspectRatio}</span>
                        </div>
                        <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                          {storyboardPreviewPlan.shots.slice(0, 8).map((shot) => (
                            <div
                              key={shot.id}
                              className="rounded-md border border-white/8 bg-black/20 px-2 py-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="shrink-0 text-[10px] font-semibold text-white/70">
                                  #{shot.index + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[10px] text-white/62">
                                  {shot.beat}
                                </span>
                                <span className="shrink-0 text-[9px] text-white/35">
                                  {shot.shotType}/{shot.cameraAngle}
                                </span>
                              </div>
                              <div className="mt-0.5 truncate text-[9px] text-white/36">
                                {shot.emotionalBeat}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {continuityWarnings.length > 0 && (
                      <div className="space-y-1 rounded-lg border border-amber-300/15 bg-amber-300/5 p-2">
                        {continuityWarnings.slice(0, 3).map((warning) => (
                          <div
                            key={warning.id}
                            className="flex items-start gap-1.5 text-[10px] text-amber-100/72"
                          >
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-200/70" />
                            <span className="min-w-0">{warning.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeDirectorTab === 'reference' && mode !== 'split' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { key: 'characterLock', label: '角色', active: params.characterLock },
                        { key: 'outfitLock', label: '服装', active: params.outfitLock },
                        { key: 'environmentLock', label: '场景', active: params.environmentLock },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => updateParams({ [item.key]: !(item.active as boolean) })}
                          className={cn(
                            'nodrag h-8 rounded-md border text-[10px] transition-colors',
                            item.active
                              ? 'border-white/32 bg-white/12 text-white'
                              : 'border-white/10 bg-black/20 text-white/42 hover:text-white/70'
                          )}
                        >
                          {item.label}
                          {item.active ? '锁定' : '未锁'}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-white/60">
                        <span>多参考图</span>
                        <input
                          type="checkbox"
                          checked={(params.useMultiImageReferences as boolean) ?? true}
                          onChange={(e) =>
                            updateParams({ useMultiImageReferences: e.target.checked })
                          }
                          className="nodrag h-3.5 w-3.5"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-white/60">
                        <span>参考回退</span>
                        <input
                          type="checkbox"
                          checked={(params.fallbackToReference as boolean) ?? true}
                          onChange={(e) => updateParams({ fallbackToReference: e.target.checked })}
                          className="nodrag h-3.5 w-3.5"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      {[
                        {
                          label: '主参考',
                          value: params.reference || resolvedReferences.reference,
                        },
                        {
                          label: '角色',
                          value: params.characterRef || resolvedReferences.characterRef,
                        },
                        { label: '服装', value: params.outfitRef || resolvedReferences.outfitRef },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5"
                        >
                          <div className="text-white/38">{item.label}</div>
                          <div
                            className={cn(
                              'mt-0.5 font-medium',
                              item.value ? 'text-white/72' : 'text-white/28'
                            )}
                          >
                            {item.value ? '已绑定' : '未绑定'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeDirectorTab === 'generation' && mode !== 'split' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          尺寸
                        </label>
                        <select
                          value={(params.size as string) || 'auto'}
                          onChange={(e) => updateParams({ size: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        >
                          {GPT_IMAGE_SIZE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id} className="bg-[#101012]">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          质量
                        </label>
                        <select
                          value={(params.quality as string) || 'medium'}
                          onChange={(e) => updateParams({ quality: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        >
                          {GPT_QUALITY_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id} className="bg-[#101012]">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          格式
                        </label>
                        <select
                          value={(params.gptOutputFormat as string) || 'png'}
                          onChange={(e) => updateParams({ gptOutputFormat: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        >
                          {GPT_FORMAT_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id} className="bg-[#101012]">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          背景
                        </label>
                        <select
                          value={(params.gptBackground as string) || 'opaque'}
                          onChange={(e) => updateParams({ gptBackground: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        >
                          <option value="opaque" className="bg-[#101012]">
                            Opaque
                          </option>
                          <option value="auto" className="bg-[#101012]">
                            Auto
                          </option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          审核
                        </label>
                        <select
                          value={(params.moderation as string) || 'auto'}
                          onChange={(e) => updateParams({ moderation: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        >
                          <option value="auto" className="bg-[#101012]">
                            Auto
                          </option>
                          <option value="low" className="bg-[#101012]">
                            Low
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          压缩
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={(params.gptOutputCompression as number | undefined) ?? ''}
                          onChange={(e) =>
                            updateParams({
                              gptOutputCompression:
                                e.target.value === ''
                                  ? undefined
                                  : Math.max(0, Math.min(100, Number(e.target.value))),
                            })
                          }
                          placeholder="auto"
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none nodrag nowheel"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          参考数
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={(params.maxReferenceImages as number) ?? 4}
                          onChange={(e) =>
                            updateParams({
                              maxReferenceImages: Math.max(
                                1,
                                Math.min(10, Number(e.target.value) || 1)
                              ),
                            })
                          }
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                          并发
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={(params.maxConcurrentFrames as number) ?? 2}
                          onChange={(e) =>
                            updateParams({
                              maxConcurrentFrames: Math.max(
                                1,
                                Math.min(4, Number(e.target.value) || 1)
                              ),
                            })
                          }
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none nodrag nowheel"
                        />
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-white/60">
                      <span>有参考图时优先编辑端点</span>
                      <input
                        type="checkbox"
                        checked={(params.useEditEndpointWhenReferenceExists as boolean) ?? true}
                        onChange={(e) =>
                          updateParams({ useEditEndpointWhenReferenceExists: e.target.checked })
                        }
                        className="nodrag h-3.5 w-3.5"
                      />
                    </label>
                  </div>
                )}
              </div>
            }

            {primaryGenerationButton}

            {mode === 'split' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                  布局
                </label>
                <div className="flex gap-1">
                  {LAYOUT_OPTIONS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        updateParams({ layout: l.id, rows: l.rows, cols: l.cols });
                        // 切换布局时清空旧的分割结果
                        setSplitCellResults([]);
                        setSplitGridImageUrl(null);
                      }}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-colors',
                        l.id === params.layout
                          ? 'border-white/60 bg-white/20 text-white'
                          : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'split' && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-white/50 tracking-wider uppercase">
                      输入图片
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full border',
                        inputImageUrl
                          ? 'text-white/78 border-white/24 bg-white/[0.08]'
                          : 'text-white/40 border-white/10 bg-white/5'
                      )}
                    >
                      {inputImageUrl ? '已连接图片' : '未连接图片'}
                    </span>
                  </div>
                  {inputImageUrl ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10">
                      <ResilientImage
                        src={inputImageUrl}
                        alt="输入图片"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 border border-dashed border-white/10 rounded-lg">
                      <ImageIcon className="w-6 h-6 text-white/20 mb-1" />
                      <span className="text-[10px] text-white/40">将图片节点连到左侧端口</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                      间距
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={(params.gap as number) ?? 4}
                      onChange={(e) => updateParams({ gap: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/40 nodrag nowheel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                      背景色
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={(params.splitBackgroundColor as string) ?? '#1a1a2e'}
                        onChange={(e) => updateParams({ splitBackgroundColor: e.target.value })}
                        className="w-6 h-6 rounded border border-white/10 cursor-pointer nodrag"
                      />
                      <span className="text-[10px] text-white/40 font-mono">
                        {(params.splitBackgroundColor as string) ?? '#1a1a2e'}
                      </span>
                    </div>
                  </div>
                </div>

                {isSplitProcessing && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.12] rounded-lg">
                    <LoaderIcon className="w-4 h-4 text-white/70 animate-spin" />
                    <span className="text-xs text-white/72">正在分割图片...</span>
                  </div>
                )}

                {splitCellResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                      分割结果
                    </div>
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${getSplitLayoutDimensions(params.layout as string).cols}, 1fr)`,
                      }}
                    >
                      {splitCellResults.map((cell) => (
                        <div
                          key={cell.cellIndex}
                          className={cn(
                            'aspect-square rounded-sm overflow-hidden relative',
                            cell.status === 'done' && 'border border-white/22',
                            cell.status === 'failed' && 'border border-red-500/30'
                          )}
                        >
                          {cell.imageUrl ? (
                            <ResilientImage
                              src={cell.imageUrl}
                              alt={`格 ${cell.cellIndex + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <span className="text-[8px] text-white/20">{cell.cellIndex + 1}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {splitGridImageUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                        宫格预览
                      </span>
                      <button
                        type="button"
                        onClick={handleSplitDownload}
                        className="nodrag text-[10px] text-white/50 hover:text-white/70 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        下载
                      </button>
                    </div>
                    <div className="relative rounded-lg overflow-hidden border border-white/10">
                      <ResilientImage
                        src={splitGridImageUrl}
                        alt="宫格"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.12] rounded-lg">
                <LoaderIcon className={cn('w-4 h-4 text-white/70', !isPaused && 'animate-spin')} />
                <span className="text-xs text-white/72">
                  {isPaused ? '已暂停，等待恢复...' : '正在执行中...'}
                </span>
                {currentNodeData.task?.progress != null && (
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden ml-1">
                    <div
                      className="h-full bg-white/70 rounded-full transition-all"
                      style={{ width: `${currentNodeData.task.progress}%` }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={isPaused ? handleResumeGeneration : handlePauseGeneration}
                  className="nodrag inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-2 text-[10px] text-white/70 transition hover:bg-white/[0.12]"
                >
                  {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  <span>{isPaused ? '恢复' : '暂停'}</span>
                </button>
              </div>
            )}

            {isFailed && taskError && (
              <div className="space-y-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="block text-[11px] text-red-300">{taskError}</span>
                {failedFrames.length > 0 && mode !== 'split' && (
                  <button
                    type="button"
                    onClick={() => handleRetryFrames(failedFrames.map((frame) => frame.cellIndex))}
                    disabled={isRunning}
                    className="nodrag inline-flex h-7 items-center gap-1 rounded-md border border-red-300/20 bg-red-400/10 px-2 text-[10px] font-medium text-red-100 transition hover:bg-red-400/18 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    重试失败帧
                  </button>
                )}
              </div>
            )}

            {isCompleted && (gridImageUrl || coverImageUrl || hasSuccessfulFrames) && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-white/50 tracking-wider uppercase">
                  生成结果
                </div>
                {(gridImageUrl || coverImageUrl) && (
                  <div className="flex h-[200px] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/20">
                    <ResilientImage
                      src={coverImageUrl || gridImageUrl}
                      alt="生成结果"
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>
                )}
                {succeededFrames.length > 0 && (
                  <div className="grid grid-cols-3 gap-1">
                    {succeededFrames.slice(0, 9).map((frame) => (
                      <div
                        key={frame.cellIndex}
                        className="overflow-hidden rounded border border-white/10 bg-black"
                      >
                        <ResilientImage
                          src={frame.imageUrl}
                          alt={`帧${frame.cellIndex}`}
                          className="aspect-square w-full object-cover"
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-[10px] text-white/45">
                  <span>✅ {succeededFrames.length} 成功</span>
                  {failedFrames.length > 0 && <span>❌ {failedFrames.length} 失败</span>}
                </div>
                {frameResults && frameResults.length > 0 && mode !== 'split' && (
                  <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.025] p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                        帧级控制
                      </span>
                      <span className="text-[9px] text-white/35">{frameResults.length} 帧</span>
                    </div>
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                      {frameResults.slice(0, 12).map((frame) => (
                        <div
                          key={frame.cellIndex}
                          className={cn(
                            'grid grid-cols-[42px_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5',
                            frame.status === 'failed'
                              ? 'border-red-300/15 bg-red-400/5'
                              : 'border-white/8 bg-black/18'
                          )}
                        >
                          <div className="h-9 w-9 overflow-hidden rounded border border-white/10 bg-black/30">
                            {frame.imageUrl ? (
                              <ResilientImage
                                src={frame.imageUrl}
                                alt={`帧${frame.cellIndex + 1}`}
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-white/30">
                                {frame.cellIndex + 1}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 text-[10px] font-semibold text-white/72">
                                镜头 {frame.cellIndex + 1}
                              </span>
                              <span className="min-w-0 truncate text-[10px] text-white/45">
                                {frame.shot?.beat || frame.label || frame.prompt}
                              </span>
                            </div>
                            <div className="mt-0.5 flex min-w-0 gap-1.5 text-[9px] text-white/35">
                              {frame.shot && (
                                <span>
                                  {frame.shot.shotType}/{frame.shot.cameraAngle}
                                </span>
                              )}
                              {frame.providerWarnings?.length ? (
                                <span className="truncate text-amber-100/65">
                                  {frame.providerWarnings[0]}
                                </span>
                              ) : null}
                              {frame.error ? (
                                <span className="truncate text-red-100/70">{frame.error}</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRetryFrames([frame.cellIndex])}
                            disabled={isRunning}
                            className="nodrag shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/62 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            重试
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {failedFrames.length > 0 && mode !== 'split' && (
                  <div className="space-y-1 rounded-lg border border-red-400/15 bg-red-400/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-red-200/80">失败帧</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRetryFrames(failedFrames.map((frame) => frame.cellIndex))
                        }
                        disabled={isRunning}
                        className="nodrag inline-flex h-6 items-center gap-1 rounded-md border border-red-300/20 bg-red-400/10 px-2 text-[9px] text-red-100 transition hover:bg-red-400/18 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3 w-3" />
                        全部重试
                      </button>
                    </div>
                    {failedFrames.slice(0, 9).map((frame) => (
                      <div
                        key={frame.cellIndex}
                        className="flex items-center justify-between gap-2 rounded-md bg-black/20 px-2 py-1"
                      >
                        <span className="min-w-0 truncate text-[10px] text-red-100/70">
                          帧{frame.cellIndex + 1}
                          {frame.error ? ` · ${frame.error}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRetryFrames([frame.cellIndex])}
                          disabled={isRunning}
                          className="nodrag shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/65 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          重试
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <div className="flex flex-wrap gap-1.5 text-[9px] text-white/35">
                <span>{currentLayout.label}</span>
                {mode !== 'split' && (
                  <>
                    <span>·</span>
                    <span>{currentPreset.label}</span>
                  </>
                )}
                {mode === 'split' && (
                  <>
                    <span>·</span>
                    <span>本地分割</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-white/35">
                <ImageIcon className="w-3 h-3" />
                <span>{totalFrames} 帧</span>
                <span>·</span>
                <span>{generationEstimate.summary}</span>
              </div>
            </div>

            {mode === 'split' && (
              <button
                type="button"
                onClick={handleSplit}
                disabled={isSplitProcessing || !inputImageUrl || isRunning}
                className={cn(
                  'nodrag w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-white shadow-lg transition-all active:scale-[0.98]',
                  isSplitProcessing || !inputImageUrl || isRunning
                    ? 'bg-white/30 cursor-not-allowed'
                    : 'border border-white/20 bg-white/[0.1] hover:border-white/32 hover:bg-white/[0.14] shadow-black/25'
                )}
              >
                {isSplitProcessing ? (
                  <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Scissors className="w-3.5 h-3.5" />
                )}
                <span>{isSplitProcessing ? '分割中...' : '分割图片'}</span>
                <div className="flex items-center gap-0.5 rounded bg-black/25 px-1.5 py-0.5">
                  <span className="text-[9px] text-white/60">免费</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

GridDirectorNode.displayName = 'GridDirectorNode';

export default GridDirectorNode;
