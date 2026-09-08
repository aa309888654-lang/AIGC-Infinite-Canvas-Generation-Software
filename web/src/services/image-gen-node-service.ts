/**
 * AICG 图片节点 — 快速切换模式 / 创建参考素材节点
 */

import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { buildDefaultNodeData } from '@/services/node-handle-adjacency';
import {
  findSatelliteNode,
  spawnOrFocusSatelliteNode,
} from '@/services/aicg-satellite-node-service';
import { toast } from 'sonner';

const SPAWN_GAP_X = 480;

export type ImageTryAction = 'image_to_image' | 'upscale';

export function applyImageTryMode(nodeId: string, action: ImageTryAction) {
  const node = canvasStoreApi.getNodes().find((n) => n.id === nodeId);
  if (!node) return;

  const data = (node.data || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;

  if (action === 'image_to_image') {
    canvasStoreApi.updateNodeData(nodeId, {
      params: { ...params, mode: 'generate', generationMode: 'image_to_image' },
    });
    spawnReferenceImageNode(nodeId);
    toast.success('已切换图生图，请上传或连接参考图');
  } else {
    canvasStoreApi.updateNodeData(nodeId, {
      params: { ...params, mode: 'upscale' },
    });
    if (!data.resultUrl && !data.imageUrl) {
      spawnReferenceImageNode(nodeId);
    }
    toast.success('已切换图片高清模式，请连接待放大图片');
  }
}

function spawnReferenceImageNode(targetNodeId: string) {
  const target = canvasStoreApi.getNodes().find((n) => n.id === targetNodeId);
  if (!target) return;

  const newNodeId = generateId();
  canvasStoreApi.addNode({
    id: newNodeId,
    type: 'imageInput',
    position: {
      x: target.position.x - SPAWN_GAP_X,
      y: target.position.y,
    },
    data: buildDefaultNodeData('imageInput'),
  } as never);

  canvasStoreApi.addEdge({
    id: `edge-${newNodeId}-${targetNodeId}-${Date.now()}`,
    source: newNodeId,
    sourceHandle: 'imageOutput',
    target: targetNodeId,
    targetHandle: 'input',
    animated: true,
    type: 'comfyui',
  });
}

export const AICG_IMAGE_WORKSPACE_TABS = [
  { id: 'studio', label: '生成' },
  { id: 'collage', label: '拼图' },
  { id: 'gridSplit', label: '宫格切分' },
] as const;

export type AICGImageWorkspace = (typeof AICG_IMAGE_WORKSPACE_TABS)[number]['id'];

export function selectAICGImageWorkspace(nodeId: string, workspace: AICGImageWorkspace) {
  const node = canvasStoreApi.getNodes().find((n) => n.id === nodeId);
  if (!node) return;
  const data = (node.data || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;
  canvasStoreApi.updateNodeData(nodeId, {
    params: { ...params, workspace: 'studio' },
  });
}

/** 主节点内 Tab：生成留在本节点；拼图/宫格切分 → 独立连线卫星节点 */
export function activateAICGImageWorkspaceTab(nodeId: string, workspace: AICGImageWorkspace) {
  if (workspace === 'studio') {
    selectAICGImageWorkspace(nodeId, 'studio');
    return;
  }
  if (workspace === 'collage') {
    spawnOrFocusSatelliteNode(nodeId, 'imageCollage', { label: '拼图' });
    return;
  }
  if (workspace === 'gridSplit') {
    spawnOrFocusSatelliteNode(nodeId, 'gridSplitter', { label: '宫格切分' });
  }
}

export function hasAICGImageSatellite(nodeId: string, workspace: 'collage' | 'gridSplit'): boolean {
  const type = workspace === 'collage' ? 'imageCollage' : 'gridSplitter';
  return Boolean(findSatelliteNode(nodeId, type));
}

export const AICG_IMAGE_MODE_TABS = [
  { id: 'text_to_image', label: '文生图', mode: 'generate' as const, generationMode: 'text_to_image' as const },
  { id: 'image_to_image', label: '图生图', mode: 'generate' as const, generationMode: 'image_to_image' as const },
  { id: 'reference', label: '图片参考', mode: 'generate' as const, generationMode: 'reference' as const },
  { id: 'character', label: '人物参考', mode: 'generate' as const, generationMode: 'character_reference' as const },
  { id: 'upscale', label: '图片高清', mode: 'upscale' as const },
] as const;

export function selectAicgImageMode(
  nodeId: string,
  tab: (typeof AICG_IMAGE_MODE_TABS)[number],
) {
  const node = canvasStoreApi.getNodes().find((n) => n.id === nodeId);
  if (!node) return;
  const data = (node.data || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;
  canvasStoreApi.updateNodeData(nodeId, {
    params: {
      ...params,
      mode: tab.mode,
      ...('generationMode' in tab && tab.generationMode
        ? { generationMode: tab.generationMode }
        : {}),
    },
  });
}
