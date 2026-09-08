/**
 * 图片输入节点顶栏 — 创建下游工具节点并同步当前图片
 */

import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { buildDefaultNodeData, getDefaultTargetHandle } from '@/services/node-handle-adjacency';
import {
  spawnOrFocusSatelliteNode,
  isSatelliteNodeType,
} from '@/services/aicg-satellite-node-service';
import { persistGeneratedCanvasUrl } from '@/services/canvas-asset-actions';
import { birefnetMattingService } from '@/services/birefnet-matting-service';
import { toast } from 'sonner';

const SPAWN_GAP_X = 520;
const SPAWN_GAP_Y = 48;

export interface SpawnImageToolOptions {
  initialData?: Record<string, unknown>;
  sourceHandle?: string;
  targetHandle?: string;
  offsetY?: number;
  label?: string;
}

function buildMatchedNodeData(
  nodeType: string,
  label: string | undefined,
  initialData?: Record<string, unknown>
) {
  const data = buildDefaultNodeData(nodeType, initialData);
  if (!label) return data;
  return {
    ...data,
    label,
    title: label,
    toolLabel: label,
  };
}

/** 从图片输入节点向右新建并连线，立即同步 imageUrl */
export function spawnImageInputToolNode(
  sourceNodeId: string,
  nodeType: string,
  options: SpawnImageToolOptions = {}
): string | null {
  const source = canvasStoreApi.getNodes().find((n) => n.id === sourceNodeId);
  if (!source) return null;

  const sourceData = (source.data || {}) as Record<string, unknown>;
  const sourceType = source.type || String(sourceData.type || 'imageInput');
  if (!sourceData.imageUrl) {
    toast.error('请先上传图片');
    return null;
  }

  if (isSatelliteNodeType(nodeType)) {
    return spawnOrFocusSatelliteNode(sourceNodeId, nodeType as 'gridSplitter' | 'imageCollage', {
      ...options,
      sourceHandle: options.sourceHandle || 'imageOutput',
    });
  }

  const newNodeId = generateId();
  const stackIndex = canvasStoreApi.getEdges().filter((e) => e.source === sourceNodeId).length;

  canvasStoreApi.addNode({
    id: newNodeId,
    type: nodeType,
    position: {
      x: source.position.x + SPAWN_GAP_X,
      y: source.position.y + (options.offsetY ?? stackIndex * SPAWN_GAP_Y),
    },
    data: buildMatchedNodeData(nodeType, options.label, {
      spawnedFrom: sourceNodeId,
      spawnedFromType: sourceType,
      _toolbarBoundTo: sourceNodeId,
      sourceImageNodeId: sourceNodeId,
      sourceImageNodeType: sourceType,
      imageUrl: sourceData.imageUrl,
      receivedImageUrl: sourceData.imageUrl,
      referenceImage: sourceData.imageUrl,
      originalImageUrl: sourceData.imageUrl,
      sourceImageUrl: sourceData.imageUrl,
      mediaType: 'image',
      ...options.initialData,
    }),
  } as never);

  window.setTimeout(() => {
    canvasStoreApi.addEdge({
      id: `edge-${sourceNodeId}-${newNodeId}-${Date.now()}`,
      source: sourceNodeId,
      sourceHandle: options.sourceHandle || 'imageOutput',
      target: newNodeId,
      targetHandle: options.targetHandle || getDefaultTargetHandle(nodeType, sourceType),
      animated: true,
      type: 'comfyui',
    });
    syncDownstreamFromNode(sourceNodeId);
  }, 250);

  toast.success(options.label ? `已创建「${options.label}」并连接` : '已创建下游节点');
  return newNodeId;
}

export function spawnGridSplitter(
  sourceNodeId: string,
  rows: number,
  cols: number,
  label: string
): string | null {
  const source = canvasStoreApi.getNodes().find((n) => n.id === sourceNodeId);
  if (!source) return null;
  const sourceData = (source.data || {}) as Record<string, unknown>;
  if (!sourceData.imageUrl) {
    toast.error('请先上传图片');
    return null;
  }
  return spawnOrFocusSatelliteNode(sourceNodeId, 'gridSplitter', {
    label,
    targetHandle: 'input',
    sourceHandle: 'imageOutput',
    forceNew: true,
    initialData: {
      label,
      title: label,
      toolLabel: label,
      layout: `${rows}x${cols}`,
      rows,
      cols,
      sourceImage: sourceData.imageUrl,
      imageUrl: sourceData.imageUrl,
      receivedImageUrl: sourceData.imageUrl,
      referenceImage: sourceData.imageUrl,
      selectedCells: [],
      gridCells: [],
      autoSplit: true,
      splitRequestedAt: Date.now(),
      params: { rows, cols, layout: `${rows}x${cols}`, autoSplit: true },
    },
  });
}

export async function autoMattingToImageInputNode(sourceNodeId: string): Promise<string | null> {
  const source = canvasStoreApi.getNodes().find((n) => n.id === sourceNodeId);
  if (!source) return null;

  const sourceData = (source.data || {}) as Record<string, unknown>;
  const imageUrl = sourceData.imageUrl as string | undefined;
  if (!imageUrl) {
    toast.error('请先上传图片');
    return null;
  }

  const fileName = (sourceData.fileName as string | undefined) || 'image.png';
  const toastId = toast.loading('BiRefNet FP16 自动抠图中...');
  const usedModel = 'BiRefNet FP16';

  try {
    toast.loading('BiRefNet FP16 自动抠图中...', { id: toastId });
    const available = await birefnetMattingService.isAvailable();
    if (!available) {
      toast.error('智能抠图失败：BiRefNet FP16 模型不可用', { id: toastId });
      return null;
    }
    await birefnetMattingService.preload((progress, message) =>
      toast.loading(`${message || '加载 BiRefNet FP16'} ${Math.round(progress)}%`, { id: toastId })
    );
    const result = await birefnetMattingService.removeBackground(
      imageUrl,
      {
        backgroundColor: 'transparent',
      },
      (progress, message) =>
        toast.loading(`${message || '智能抠图中'} ${Math.round(progress)}%`, { id: toastId })
    );

    if (!result.success || !result.imageUrl) {
      toast.error(`智能抠图失败：${result.error || 'BiRefNet FP16 未返回结果'}`, { id: toastId });
      return null;
    }

    const newNodeId = generateId();
    const fileBaseName = fileName.replace(/\.[^.]+$/, '');
    const resultFileName = `${fileBaseName}-抠图结果.png`;
    let persisted: Awaited<ReturnType<typeof persistGeneratedCanvasUrl>> | null = null;
    try {
      persisted = await persistGeneratedCanvasUrl({
        nodeId: newNodeId,
        kind: 'image',
        url: result.imageUrl,
        fileName: resultFileName,
      });
    } catch (error) {
      console.warn(
        '[image-input-toolbar-service] persist matting result failed, using runtime url',
        error
      );
    }
    const resultUrl = persisted?.runtimeUrl || result.imageUrl;
    const stackIndex = canvasStoreApi.getEdges().filter((e) => e.source === sourceNodeId).length;
    const resultPosition = {
      x: source.position.x + SPAWN_GAP_X + 120,
      y: source.position.y + 96 + stackIndex * 96,
    };

    canvasStoreApi.addNode({
      id: newNodeId,
      type: 'imageInput',
      position: resultPosition,
      data: {
        type: 'imageInput',
        label: '抠图结果',
        title: '抠图结果',
        toolLabel: '抠图结果',
        spawnedFrom: sourceNodeId,
        spawnedFromType: source.type || sourceData.type || 'imageInput',
        _toolbarBoundTo: sourceNodeId,
        sourceImageNodeId: sourceNodeId,
        sourceImageNodeType: source.type || sourceData.type || 'imageInput',
        sourceImageUrl: imageUrl,
        receivedImageUrl: imageUrl,
        referenceImage: imageUrl,
        ...(persisted?.asset?.id ? { imageAssetId: persisted.asset.id } : {}),
        imageUrl: resultUrl,
        fileName: resultFileName,
        originalImageUrl: imageUrl,
        isProcessed: true,
        processingMode: 'remove-background',
        mattingModel: usedModel,
        mattingStrategy: usedModel,
        maskUrl: result.maskUrl,
      },
    } as never);

    canvasStoreApi.addEdge({
      id: `edge-${sourceNodeId}-${newNodeId}-${Date.now()}`,
      source: sourceNodeId,
      sourceHandle: 'imageOutput',
      target: newNodeId,
      targetHandle: 'input',
      animated: true,
      type: 'comfyui',
    });

    canvasStoreApi.updateNodeData(sourceNodeId, {
      isProcessed: true,
      originalImageUrl: imageUrl,
      processingMode: 'remove-background',
    });
    syncDownstreamFromNode(sourceNodeId);
    syncDownstreamFromNode(newNodeId);
    canvasStoreApi.setSelectedNodeIds([newNodeId]);
    canvasStoreApi.setSelectedNodeId(newNodeId);
    toast.success(`智能抠图完成，已生成新的图片输入节点（${usedModel}）`, { id: toastId });
    return newNodeId;
  } catch (error) {
    const message = (error as Error).message || '执行异常';
    console.error('[image-input-toolbar-service] auto matting failed', error);
    toast.error(`智能抠图失败：${message}`, { id: toastId });
    return null;
  }
}

export function spawnUpscaleStudio(sourceNodeId: string, factor: 2 | 4) {
  return spawnImageInputToolNode(sourceNodeId, 'aiImage', {
    label: `高清 ${factor}×`,
    targetHandle: 'input',
    initialData: {
      params: {
        mode: 'upscale',
        upscaleFactor: factor,
        upscaleEngine: 'realesrgan',
        modelProvider: 'upscale',
      },
    },
  });
}
