/**
 * 视频节点 — 快速切换模式 / 创建参考素材节点
 */

import { generateId } from '@/lib/utils';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { buildDefaultNodeData } from '@/services/node-handle-adjacency';
import { toast } from 'sonner';

const SPAWN_GAP_X = 480;
const SPAWN_GAP_Y = 56;

export type VideoTryAction = 'first_last_frame' | 'first_frame';

export function applyVideoTryMode(nodeId: string, action: VideoTryAction) {
  const node = canvasStoreApi.getNodes().find((n) => n.id === nodeId);
  if (!node) return;

  const data = (node.data || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;

  if (action === 'first_last_frame') {
    canvasStoreApi.updateNodeData(nodeId, {
      params: { ...params, generationMode: 'first_last_frame' },
    });
    spawnReferenceImageNode(nodeId, 'firstFrame', 0, '首帧');
    spawnReferenceImageNode(nodeId, 'lastFrame', 1, '尾帧');
    toast.success('已切换首尾帧模式，请上传首帧与尾帧');
  } else {
    canvasStoreApi.updateNodeData(nodeId, {
      params: { ...params, generationMode: 'image_to_video' },
    });
    spawnReferenceImageNode(nodeId, 'input', 0, '首帧参考');
    toast.success('已切换图生视频，请上传或连接首帧图片');
  }
}

function spawnReferenceImageNode(
  targetNodeId: string,
  targetHandle: string,
  stackIndex: number,
  _label: string,
) {
  const target = canvasStoreApi.getNodes().find((n) => n.id === targetNodeId);
  if (!target) return;

  const newNodeId = generateId();
  canvasStoreApi.addNode({
    id: newNodeId,
    type: 'imageInput',
    position: {
      x: target.position.x - SPAWN_GAP_X,
      y: target.position.y + stackIndex * SPAWN_GAP_Y,
    },
    data: buildDefaultNodeData('imageInput'),
  } as never);

  canvasStoreApi.addEdge({
    id: `edge-${newNodeId}-${targetNodeId}-${Date.now()}-${stackIndex}`,
    source: newNodeId,
    sourceHandle: 'imageOutput',
    target: targetNodeId,
    targetHandle,
    animated: true,
    type: 'comfyui',
  });
}

export const AICG_VIDEO_MODE_TABS = [
  { id: 'text_to_video', label: '文生视频', generationMode: 'text_to_video' },
  { id: 'reference_all', label: '全能参考', generationMode: 'reference_to_video', referenceType: 'feature' },
  { id: 'image_to_video', label: '图生视频', generationMode: 'image_to_video' },
  { id: 'first_last_frame', label: '首尾帧', generationMode: 'first_last_frame' },
  { id: 'image_ref', label: '图片参考', generationMode: 'reference_to_video', referenceType: 'base' },
] as const;

// P1 修复（BUG-V8）：检查节点是否已有指定 handle 的图片输入连接，避免重复创建
function checkExistingImageConnection(nodeId: string, targetHandle: string): boolean {
  const edges = canvasStoreApi.getEdges?.() || [];
  return edges.some(
    (e) => e.target === nodeId && e.targetHandle === targetHandle,
  );
}

export function selectAicgVideoMode(
  nodeId: string,
  tab: (typeof AICG_VIDEO_MODE_TABS)[number],
) {
  const node = canvasStoreApi.getNodes().find((n) => n.id === nodeId);
  if (!node) return;
  const data = (node.data || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;

  // P1 修复（BUG-V8）：切换到需要图片的模式时，自动创建图片节点（与 applyVideoTryMode 行为一致）
  const needsFirstFrame =
    tab.generationMode === 'image_to_video' ||
    tab.generationMode === 'first_last_frame' ||
    tab.generationMode === 'reference_to_video';
  const needsLastFrame = tab.generationMode === 'first_last_frame';

  const hasFirstFrameConnection = checkExistingImageConnection(nodeId, 'firstFrame');
  const hasLastFrameConnection = checkExistingImageConnection(nodeId, 'lastFrame');
  const hasInputConnection = checkExistingImageConnection(nodeId, 'input');

  canvasStoreApi.updateNodeData(nodeId, {
    params: {
      ...params,
      generationMode: tab.generationMode,
      ...('referenceType' in tab && tab.referenceType ? { referenceType: tab.referenceType } : {}),
    },
  });

  // 自动创建缺失的图片节点
  if (needsFirstFrame && !hasFirstFrameConnection && !hasInputConnection) {
    spawnReferenceImageNode(nodeId, 'firstFrame', 0, '首帧');
  }
  if (needsLastFrame && !hasLastFrameConnection) {
    spawnReferenceImageNode(nodeId, 'lastFrame', 1, '尾帧');
  }
}

/** AICG 专业运镜 / 光影参数 */
export const AICG_PRO_VIDEO_DEFAULTS = {
  lightIntensity: 70,
  cameraPitch: 0,
  cameraYaw: 0,
  dollySpeed: 50,
} as const;

/** 将 AICG 运镜/光影滑块转为 prompt 后缀 */
export function applyAicgProVideoToPrompt(
  prompt: string,
  proVideo?: Partial<typeof AICG_PRO_VIDEO_DEFAULTS> | Record<string, unknown>,
): string {
  const base = prompt.trim();
  if (!proVideo || typeof proVideo !== 'object') return base;
  const v = { ...AICG_PRO_VIDEO_DEFAULTS, ...proVideo };
  const parts: string[] = [];
  if (v.lightIntensity !== 70) parts.push(`光源强度约 ${v.lightIntensity}%`);
  if (v.cameraPitch !== 0) {
    parts.push(v.cameraPitch > 0 ? `镜头上仰 ${v.cameraPitch} 度` : `镜头下俯 ${Math.abs(v.cameraPitch)} 度`);
  }
  if (v.cameraYaw !== 0) parts.push(`镜头水平旋转 ${v.cameraYaw} 度`);
  if (v.dollySpeed !== 50) {
    parts.push(v.dollySpeed > 60 ? '快推运镜' : v.dollySpeed < 40 ? '慢推运镜' : '匀速运镜');
  }
  if (parts.length === 0) return base;
  return base ? `${base}，${parts.join('，')}` : parts.join('，');
}

export function patchAicgProVideoParams(nodeId: string, patch: Partial<typeof AICG_PRO_VIDEO_DEFAULTS>) {
  const node = canvasStoreApi.getNodes().find((n) => n.id === nodeId);
  if (!node) return;
  const data = (node.data || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;
  const pro = { ...AICG_PRO_VIDEO_DEFAULTS, ...(params.proVideo as object), ...patch };
  canvasStoreApi.updateNodeData(nodeId, {
    params: { ...params, proVideo: pro },
  });
}
