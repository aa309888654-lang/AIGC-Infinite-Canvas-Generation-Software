/**
 * 节点执行统一 Payload 构建器
 *
 * 取代 real-api-executor.ts 中散落的 collectConnectedImageUrls /
 * collectConnectedVideoUrls / 内联 edge 过滤逻辑。
 *
 * 设计目标：
 * 1. 通过 node-system.ts 的端口映射（getPortType / isMultiplePort）动态发现输入端口
 * 2. 按 targetHandle 名称推断角色（firstFrame/lastFrame/referenceImage/input/prompt 等）
 * 3. 多输入句柄聚合为数组，不再只取首条
 * 4. 复用 extractNodeOutput 提取上游节点输出，保证节点兼容性
 */

import type { Edge, Node } from '@xyflow/react';
import { extractOriginalUrl } from '@/lib/utils';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';
import {
  getPortType,
  isMultiplePort,
  type PortType,
} from '@/types/node-system';
import {
  extractNodeOutput,
  type NodeOutputSnapshot,
} from '@/services/aicg-downstream-sync';
import { edgeIndexApi } from '@/store/useEdgeIndexStore';

/** 单个上游输入项 */
export interface NodeExecutionInput {
  url?: string;
  content?: string;
  role: string;
  sourceNodeId: string;
  sourceHandle?: string;
  sourceNodeType: string;
  mediaType: 'image' | 'video' | 'audio' | 'text' | 'unknown';
}

/** 节点执行统一 Payload */
export interface NodeExecutionPayload {
  nodeId: string;
  nodeType: string;
  prompt: string;
  systemPrompt?: string;
  negativePrompt?: string;
  /** 所有图片输入（按 role 分组聚合） */
  images: Array<{ url: string; role: string; sourceNodeId: string; sourceHandle?: string }>;
  /** 所有视频输入 */
  videos: Array<{ url: string; role: string; sourceNodeId: string; sourceHandle?: string }>;
  /** 所有音频输入 */
  audio: Array<{ url: string; role: string; sourceNodeId: string }>;
  /** 所有文本输入 */
  texts: Array<{ content: string; role: string; sourceNodeId: string }>;
  /** 节点原始参数（params 对象） */
  params: Record<string, unknown>;
  /** 模型信息 */
  model: { id: string; provider: string };
  /** 元信息用于可观测性 */
  metadata: {
    sourceCount: number;
    edgeCount: number;
    buildVersion: 'v1';
    builtAt: number;
  };
}

/** 按句柄分组的连接映射 */
export interface GroupedInputConnections {
  [targetHandle: string]: Array<{
    edgeId: string;
    source: string;
    sourceHandle?: string;
    sourceNode: Node;
  }>;
}

type VideoEdgeRole = 'start' | 'end' | 'reference';

function normalizeVideoEdgeRole(role?: unknown): string | undefined {
  if (role === 'start') return 'firstFrame';
  if (role === 'end') return 'lastFrame';
  if (role === 'reference') return 'referenceImage';
  return undefined;
}

/** 推断 targetHandle 对应的角色名，并兼容旧工作流保存的 edgeRoleMap。 */
export function resolveExecutionInputRole(
  targetHandle: string
): string {
  if (!targetHandle || targetHandle === 'input') return 'input';
  if (targetHandle === 'prompt' || targetHandle === 'promptInput') return 'prompt';
  if (targetHandle === 'text' || targetHandle === 'script' || targetHandle === 'scriptInput') return 'text';
  if (targetHandle === 'image') return 'referenceImage';
  return targetHandle; // firstFrame / lastFrame / referenceImage / referenceImage1-6 / characterImage / targetImage / viewData / outfitRef ...
}

export function resolveVideoExecutionInputRole(
  targetHandle: string,
  edgeId?: string,
  edgeRoleMap?: Record<string, VideoEdgeRole>
): string {
  const explicitRole = resolveExecutionInputRole(targetHandle);
  if (explicitRole !== 'input') return explicitRole;
  return normalizeVideoEdgeRole(edgeId ? edgeRoleMap?.[edgeId] : undefined) || explicitRole;
}

/** 后端按 nodeId 做幂等与并发拦截，多片段必须使用稳定且互不相同的请求身份。 */
export function buildVideoClipRequestNodeId(
  nodeId: string,
  clipIndex: number,
  clipCount: number
): string {
  return clipCount > 1 ? `${nodeId}_clip${clipIndex}` : nodeId;
}

/** 根据 PortType 与输出快照判断 mediaType */
function classifyOutputMediaType(
  portType: PortType | null,
  output: NodeOutputSnapshot
): 'image' | 'video' | 'audio' | 'text' | 'unknown' {
  if (output.mediaType === 'image' || output.mediaType === 'video' || output.mediaType === 'audio' || output.mediaType === 'text') {
    return output.mediaType;
  }
  if (portType === 'image') return 'image';
  if (portType === 'video') return 'video';
  if (portType === 'audio') return 'audio';
  if (portType === 'prompt' || portType === 'string') return 'text';
  return 'unknown';
}

/** 从 NodeOutputSnapshot 提取 URL */
function extractOutputUrl(output: NodeOutputSnapshot): string | undefined {
  return (
    output.resultUrl ||
    output.imageUrl ||
    output.videoUrl ||
    output.audioUrl ||
    output.gridImageUrl ||
    output.coverImageUrl ||
    undefined
  );
}

/** 从 NodeOutputSnapshot 提取文本内容 */
function extractOutputText(output: NodeOutputSnapshot): string | undefined {
  const text = (output.text || output.prompt || '').trim();
  return text || undefined;
}

/**
 * 解析节点所有入边，按 targetHandle 分组。
 * 保留 source 元信息以支持单独断开（P2-3）与 UI 展示（P1-2）。
 */
export function resolveInputConnections(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): GroupedInputConnections {
  const grouped: GroupedInputConnections = {};

  // ✅ P1-4：优先使用边索引缓存（50 边以上启用）
  const incomingEdges = edgeIndexApi.getIncomingEdges(nodeId, edges);

  for (const edge of incomingEdges) {
    const handle = edge.targetHandle || 'input';
    if (!grouped[handle]) grouped[handle] = [];

    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;

    grouped[handle].push({
      edgeId: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle || undefined,
      sourceNode,
    });
  }

  return grouped;
}

/** 提取节点类型（data.type 优先于 node.type） */
function getNodeType(node?: Node | null): string {
  if (!node) return '';
  const dataType = (node.data as { type?: string } | undefined)?.type;
  return dataType || (node.type as string) || '';
}

/**
 * 构建节点执行统一 Payload。
 *
 * 使用方式：
 * ```ts
 * const { nodes, edges } = useCanvasStore.getState();
 * const payload = buildExecutionPayload(nodeId, nodes, edges);
 * // payload.images / payload.videos / payload.texts 已按角色聚合
 * ```
 *
 * 兼容性：当 targetHandle 为空或未在 PORT_TYPE_MAP 注册时，
 * 通过 extractNodeOutput 的 mediaType 兜底分类。
 */
export function buildExecutionPayload(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): NodeExecutionPayload {
  const targetNode = nodes.find((n) => n.id === nodeId);
  const nodeType = getNodeType(targetNode);
  const data = (targetNode?.data || {}) as Record<string, unknown>;
  const params = (data.params && typeof data.params === 'object' && !Array.isArray(data.params)
    ? data.params
    : {}) as Record<string, unknown>;
  const edgeRoleMap =
    nodeType === 'aiVideo' && params.edgeRoleMap && typeof params.edgeRoleMap === 'object'
      ? (params.edgeRoleMap as Record<string, VideoEdgeRole>)
      : undefined;

  const grouped = resolveInputConnections(nodeId, nodes, edges);

  const images: NodeExecutionPayload['images'] = [];
  const videos: NodeExecutionPayload['videos'] = [];
  const audio: NodeExecutionPayload['audio'] = [];
  const texts: NodeExecutionPayload['texts'] = [];

  let promptText = '';
  let systemPrompt: string | undefined;
  let negativePrompt: string | undefined;

  // 从节点自身数据读取 prompt（params.prompt / data.prompt / data.text 等）
  promptText = String(
    (typeof params.prompt === 'string' && params.prompt) ||
    (typeof data.prompt === 'string' && data.prompt) ||
    (typeof data.script === 'string' && data.script) ||
    (typeof data.text === 'string' && data.text) ||
    (typeof data.content === 'string' && data.content) ||
    ''
  );

  if (typeof params.negativePrompt === 'string' && params.negativePrompt) {
    negativePrompt = params.negativePrompt;
  }
  if (typeof data.systemPrompt === 'string' && data.systemPrompt) {
    systemPrompt = data.systemPrompt;
  } else if (typeof params.systemPrompt === 'string' && params.systemPrompt) {
    systemPrompt = params.systemPrompt;
  }

  // 遍历每个 targetHandle 的连接，按角色聚合
  for (const handle of Object.keys(grouped)) {
    const portType = getPortType(nodeType, handle, 'target');
    const isMultiple = isMultiplePort(nodeType, handle, 'target');

    const connections = grouped[handle];
    // 单输入句柄只取第一条（保持向后兼容），多输入句柄聚合全部
    const effectiveConnections = isMultiple ? connections : connections.slice(0, 1);

    for (const conn of effectiveConnections) {
      const role =
        nodeType === 'aiVideo'
          ? resolveVideoExecutionInputRole(handle, conn.edgeId, edgeRoleMap)
          : resolveExecutionInputRole(handle);
      const sourceOutput = extractNodeOutput(conn.sourceNode);
      const sourceNodeType = getNodeType(conn.sourceNode);
      const mediaType = classifyOutputMediaType(portType, sourceOutput);

      // 文本类角色写入 prompt（保留首个非空，多文本聚合用 \n 拼接）
      if (mediaType === 'text') {
        const text = extractOutputText(sourceOutput);
        if (text) {
          texts.push({ content: text, role, sourceNodeId: conn.source });
          if (role === 'prompt' || role === 'text' || role === 'input') {
            promptText = promptText
              ? (promptText.includes(text) ? promptText : `${promptText}\n${text}`)
              : text;
          }
        }
        continue;
      }

      // 媒体类提取 URL
      const rawUrl = extractOutputUrl(sourceOutput);
      if (!rawUrl) continue;

      // 清洗 URL：过滤 blob: 失效引用，规范化代理路径
      const safeUrl = getSafeRenderableMediaUrl(rawUrl);
      if (!safeUrl) continue;

      const cleanUrl = extractOriginalUrl(safeUrl);
      if (!cleanUrl) continue;

      if (mediaType === 'image') {
        images.push({ url: cleanUrl, role, sourceNodeId: conn.source, sourceHandle: conn.sourceHandle });
      } else if (mediaType === 'video') {
        videos.push({ url: cleanUrl, role, sourceNodeId: conn.source, sourceHandle: conn.sourceHandle });
      } else if (mediaType === 'audio') {
        audio.push({ url: cleanUrl, role, sourceNodeId: conn.source });
      }
    }
  }

  // 模型信息（从 params 或 data 读取）
  const modelId = String(params.modelId || params.model || data.modelId || data.model || '').trim();
  const modelProvider = String(params.modelProvider || params.provider || data.modelProvider || data.provider || '').trim();

  const sourceCount = images.length + videos.length + audio.length + texts.length;

  return {
    nodeId,
    nodeType,
    prompt: promptText,
    systemPrompt,
    negativePrompt,
    images,
    videos,
    audio,
    texts,
    params,
    model: { id: modelId, provider: modelProvider },
    metadata: {
      sourceCount,
      edgeCount: edgeIndexApi.getIncomingEdges(nodeId, edges).length,
      buildVersion: 'v1',
      builtAt: Date.now(),
    },
  };
}

/**
 * 从 Payload 提取按角色筛选的 URL 数组（供 backend 调用便捷使用）。
 *
 * @example
 * const refImages = extractImagesByRole(payload, 'referenceImage');
 */
export function extractImagesByRole(
  payload: NodeExecutionPayload,
  role: string
): string[] {
  return payload.images
    .filter((img) => img.role === role)
    .map((img) => img.url);
}

/** 从 Payload 提取首个匹配角色的 URL（单输入场景） */
export function extractFirstImageByRole(
  payload: NodeExecutionPayload,
  role: string
): string | undefined {
  return payload.images.find((img) => img.role === role)?.url;
}

/** 从 Payload 提取所有图片 URL（按 role 顺序：firstFrame, lastFrame, referenceImage, input） */
export function extractAllImageUrls(payload: NodeExecutionPayload): string[] {
  const roleOrder = ['firstFrame', 'lastFrame', 'referenceImage', 'referenceImage1', 'referenceImage2', 'referenceImage3', 'referenceImage4', 'referenceImage5', 'referenceImage6', 'image', 'input', 'characterImage', 'targetImage'];
  const sorted = [...payload.images].sort((a, b) => {
    const ai = roleOrder.indexOf(a.role);
    const bi = roleOrder.indexOf(b.role);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });
  return sorted.map((img) => img.url);
}
