/**
 * 真实API执行器 - 增强版
 * 角色：资深技术选型专家 + 开源软件顾问
 *
 * 集成 OmniRoute 网关 + 智能路由器
 * 支持多提供商故障转移和自动选择
 */
import type { Edge, Node } from '@xyflow/react';
import { toast } from 'sonner';
import { GenerationTask, GenerationSubTask } from '@/types/ai-models';
import { useCanvasStore } from './useCanvasStore';
import { useTaskStore } from './useTaskStore';
import { useFileStore } from './useFileStore';
import useUnifiedAPIConfigStore from './useUnifiedAPIConfigStore';
import { getAuthToken } from '@/lib/auth-check';
import {
  ImageGenerationParams,
  VideoGenerationParams,
  AudioGenerationParams,
} from '@/types/ai-models';
import { validateNodeBinding } from '@/lib/node-binding-utils';
import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';
import { useMembershipStore } from './useMembershipStore';
import { nodeModelMatcher } from '@/core/node-model-matcher';
import { unifiedAPIModelService } from '@/services/unified-api-model-service';
import { permissionService } from '@/services/permission-service';
import { generateId, getProxiedImageUrl, extractOriginalUrl } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api-config';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { normalizeMediaUrl } from '@/lib/media-url';
import { savePendingTask, removePendingTask } from '@/services/video-task-persistence';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { applyAicgProVideoToPrompt } from '@/services/video-gen-node-service';
import { nodeTaskRegistry } from '@/services/node-task-registry';
import { extractResultUrl, extractAllResultUrls } from '@/types/node-output';
import {
  parseStoryboardPayload,
  resolveStoryboardSelection,
} from '@/components/canvas/nodes/storyboard-payload';
import {
  getCharacterAssetPayloadFromNodeData,
  resolveCharacterReferenceFromNodeData,
  resolveOutfitReferenceFromNodeData,
} from '@/components/canvas/nodes/character-payload';
import {
  DEFAULT_GRID_DIRECTOR_PARAMS,
  runGridDirectorMode,
} from '@/components/canvas/nodes/grid-director-core';
import {
  buildMockNodeGenerationResultForNode,
  isMockGenerationEnabled,
} from '@/services/mock-node-generation';
import { isTextExecutionNodeType } from './node-execution-classifiers';
import {
  buildExecutionPayload,
  buildVideoClipRequestNodeId,
  resolveVideoExecutionInputRole,
} from '@/services/node-execution-payload-builder';

const DEBUG = false;
const VIDEO_MAX_POLLING_MS = 24 * 60 * 60 * 1000;
const VIDEO_POLL_INTERVAL_MS = 10 * 1000;

const debugLog = (...args: any[]) => {
  if (DEBUG) console.log(...args); // eslint-disable-line no-console
};

function isStoryboardMakerImageController(
  nodeData: Record<string, any> | undefined,
  params: Record<string, any>
): boolean {
  const controllerActionId = String(
    nodeData?._controllerActionId || params._controllerActionId || params.controllerActionId || ''
  );
  const nodeType = String(nodeData?.type || params.type || '');
  return (
    controllerActionId.startsWith('storyboard-maker-') ||
    nodeType === 'storyboardMaker' ||
    Boolean(nodeData?.storyboardMode || params.storyboardMode) ||
    Array.isArray(nodeData?.storyboardScenes) ||
    Array.isArray(params.storyboardScenes)
  );
}

function normalizeStoryboardImageParams(
  imageParams: ImageGenerationParams,
  _hasReferenceImages: boolean
): void {
  imageParams.modelId = 'doubao-seedream-5-0-pro';
  imageParams.modelProvider = 'agnes' as any;
  (imageParams as any).model = 'doubao-seedream-5-0-pro';
  (imageParams as any).provider = 'agnes';
}

const DISABLED_HAILUO_VIDEO_MODELS = new Set([
  'hailuo-video-2.3',
  'hailuo-2.3-fast-768p-6s',
  'hailuo-2.3-768p-6s',
  'minimax-hailuo-2.3',
  'minimax-hailuo-2.3-fast',
]);

function isDisabledHailuoVideoModel(modelId?: unknown, provider?: unknown): boolean {
  const normalizedModel = String(modelId || '')
    .trim()
    .toLowerCase();
  const normalizedProvider = String(provider || '')
    .trim()
    .toLowerCase();
  return (
    normalizedProvider === 'hailuo' ||
    (normalizedProvider === 'minimax' && normalizedModel.includes('hailuo')) ||
    DISABLED_HAILUO_VIDEO_MODELS.has(normalizedModel) ||
    normalizedModel.startsWith('hailuo-')
  );
}

function inferVideoProvider(modelId?: unknown, provider?: unknown): string {
  const explicitProvider = String(provider || '').trim();
  if (explicitProvider) return explicitProvider;

  const normalizedModel = String(modelId || '')
    .trim()
    .toLowerCase();
  if (!normalizedModel) return 'agnes';
  if (normalizedModel.startsWith('vidu')) return 'vidu';
  if (normalizedModel.startsWith('doubao-seedance')) return 'doubao';
  if (normalizedModel === 'agnes-video-v2.0' || normalizedModel === 'agnes_video_v2') {
    return 'agnes';
  }

  return 'agnes';
}

function sanitizeVideoGenerationParams<T extends Record<string, any>>(params: T): T {
  if (
    !isDisabledHailuoVideoModel(
      params.modelId || params.model,
      params.modelProvider || params.provider
    )
  ) {
    return params;
  }

  const next = {
    ...params,
    modelProvider: 'agnes',
    provider: 'agnes',
    modelId: 'agnes-video-v2.0',
    model: 'agnes-video-v2.0',
    resolution: params.resolution || '720p',
    duration: params.duration || 10,
  };

  delete next.minimaxMotionLevel;
  delete next.apiModelName;
  delete next.pixelResolution;
  return next;
}

async function commitMockSingleNodeExecution({
  node,
  prompt,
  nodes,
  edges,
  updateNodeData,
  addTask,
  updateTask,
}: {
  node: Node<Record<string, any>>;
  prompt?: string;
  nodes?: Node<Record<string, any>>[];
  edges?: Edge[];
  updateNodeData: (nodeId: string, data: Partial<Record<string, unknown>>) => void;
  addTask: (task: GenerationTask) => void;
  updateTask: (taskId: string, task: GenerationTask) => void;
}) {
  const connectedReferenceImage = collectConnectedImageUrls(
    String(node.id),
    nodes || [],
    edges || []
  )[0];
  const mockNode = connectedReferenceImage
    ? {
        ...node,
        data: {
          ...(node.data || {}),
          referenceImage: connectedReferenceImage,
          receivedImageUrl: connectedReferenceImage,
          params: {
            ...((node.data?.params || {}) as Record<string, any>),
            referenceImage: connectedReferenceImage,
            referenceImages: [connectedReferenceImage],
          },
        },
      }
    : node;
  const result = buildMockNodeGenerationResultForNode(mockNode, prompt);
  const timestamp = Date.now();
  const taskNodeType: GenerationTask['nodeType'] =
    result.kind === 'video'
      ? 'video'
      : result.kind === 'audio'
        ? 'audio'
        : result.kind === 'text'
          ? 'text'
          : 'image';
  const task: GenerationTask = {
    id: `mock-task-${timestamp}`,
    nodeId: String(node.id),
    type: taskNodeType,
    nodeType: taskNodeType,
    status: 'processing',
    priority: 'normal',
    progress: 0,
    createdAt: new Date(timestamp).toISOString(),
    updatedAt: new Date(timestamp).toISOString(),
    ...(result.kind === 'video' ? { startedAt: new Date(timestamp).toISOString() } : {}),
  };
  const completedTask: GenerationTask = {
    ...task,
    status: 'completed',
    progress: 100,
    resultUrl: result.resultUrl,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  addTask(task);
  updateTask(task.id, completedTask);

  updateNodeData(String(node.id), {
    task: completedTask,
    mockGeneration: true,
    mockGeneratedAt: timestamp,
    mockMetadata: result.metadata,
    ...(result.outputText ? { outputText: result.outputText, text: result.outputText } : {}),
    ...(result.resultUrl ? { resultUrl: result.resultUrl } : {}),
    ...(result.resultUrls ? { resultUrls: result.resultUrls } : {}),
    ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
    ...(result.videoUrl ? { videoUrl: result.videoUrl } : {}),
    ...(result.audioUrl ? { audioUrl: result.audioUrl } : {}),
    ...(result.gridImageUrl ? { gridImageUrl: result.gridImageUrl } : {}),
    ...(result.coverImageUrl ? { coverImageUrl: result.coverImageUrl } : {}),
    ...(result.panoramaImageUrl ? { panoramaImageUrl: result.panoramaImageUrl } : {}),
    ...(result.frameResults ? { frameResults: result.frameResults } : {}),
    ...(result.storyboardPayload ? { storyboardPayload: result.storyboardPayload } : {}),
  });

  const synced = syncDownstreamFromNode(String(node.id));
  nodeEventBus.emitNodeExecuted(String(node.id), true);

  if (result.resultUrl && result.kind !== 'audio') {
    await useFileStore.getState().registerGeneratedFile({
      name: `${result.kind}_${timestamp}.${result.kind === 'video' ? 'mp4' : 'png'}`,
      type: result.kind === 'video' ? 'video' : 'image',
      url: result.resultUrl,
      thumbnailUrl: result.imageUrl,
      size: 0,
      source: 'generated',
      metadata: result.metadata,
    });
  }

  toast.success('Mock 生成完成', {
    description: synced > 0 ? `已同步 ${synced} 个下游节点` : '已写入本地测试结果',
  });
}

function collectConnectedImageUrls(
  nodeId: string,
  nodes: Node<Record<string, any>>[],
  edges: Edge[]
): string[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => {
      const sourceNode = nodes.find((candidate) => candidate.id === edge.source);
      if (!sourceNode) return '';
      return extractOriginalUrl(
        resolveNodeImageUrl((sourceNode.data || {}) as Record<string, any>, edge.sourceHandle)
      );
    })
    .filter((url): url is string => Boolean(url));
}

const VIDEO_SOURCE_NODE_TYPES = new Set([
  'aiVideo',
  'videoInput',
  'videoGen',
  'advancedVideoGen',
  'aicgVideoGen',
]);

function resolveNodeVideoUrl(
  sourceData: Record<string, any>,
  sourceHandle?: string | null
): string {
  const toStr = (v: any): string => (typeof v === 'string' ? v : '');
  const task = (
    sourceData?.task && typeof sourceData.task === 'object' ? sourceData.task : null
  ) as Record<string, any> | null;
  const taskFirstResultUrl = Array.isArray(task?.resultUrls)
    ? toStr((task!.resultUrls as any[])[0])
    : toStr(task?.resultUrl);

  return (
    toStr(sourceData?.videoUrl) ||
    toStr(sourceData?.receivedVideoUrl) ||
    toStr(sourceData?.videoReference) ||
    taskFirstResultUrl ||
    toStr(sourceData?.resultUrl) ||
    (Array.isArray(sourceData?.resultUrls) ? toStr((sourceData.resultUrls as any[])[0]) : '') ||
    ''
  );
}

function collectConnectedVideoUrls(
  nodeId: string,
  nodes: Node<Record<string, any>>[],
  edges: Edge[]
): string[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => {
      const sourceNode = nodes.find((candidate) => candidate.id === edge.source);
      if (!sourceNode) return '';
      const sourceType = String(
        sourceNode.type || (sourceNode.data as Record<string, any>)?.type || ''
      );
      if (!VIDEO_SOURCE_NODE_TYPES.has(sourceType)) return '';
      return extractOriginalUrl(
        resolveNodeVideoUrl((sourceNode.data || {}) as Record<string, any>, edge.sourceHandle)
      );
    })
    .filter((url): url is string => Boolean(url));
}

function resolveNodeAudioUrl(sourceData: Record<string, any>): string {
  const toStr = (v: any): string => (typeof v === 'string' ? v : '');
  const task = (
    sourceData?.task && typeof sourceData.task === 'object' ? sourceData.task : null
  ) as Record<string, any> | null;
  return (
    toStr(sourceData?.audioUrl) ||
    toStr(sourceData?.resultUrl) ||
    toStr(task?.resultUrl) ||
    (Array.isArray(task?.resultUrls) ? toStr((task!.resultUrls as any[])[0]) : '') ||
    ''
  );
}

function collectConnectedAudioUrls(
  nodeId: string,
  nodes: Node<Record<string, any>>[],
  edges: Edge[]
): string[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => {
      const sourceNode = nodes.find((candidate) => candidate.id === edge.source);
      if (!sourceNode) return '';
      const sourceType = String(
        sourceNode.type || (sourceNode.data as Record<string, any>)?.type || ''
      );
      if (
        sourceType !== 'audioGen' &&
        sourceType !== 'audioInput' &&
        sourceType !== 'audioController'
      )
        return '';
      return extractOriginalUrl(
        resolveNodeAudioUrl((sourceNode.data || {}) as Record<string, any>)
      );
    })
    .filter((url): url is string => Boolean(url));
}

const VIDU_ERROR_TRANSLATIONS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /TaskPromptPolicyViolation/i, message: '提示词触发内容安全限制，请修改后重试' },
  { pattern: /AuditSubmitIllegal/i, message: '当前内容触发平台审核限制，请调整素材或提示词后重试' },
  { pattern: /ImageFormatInvalid/i, message: '参考图片格式不符合要求，请使用 PNG、JPG 或 WebP' },
  { pattern: /ImageDownloadFailure/i, message: '参考图片下载失败，请检查图片链接或重新上传' },
  { pattern: /ImageCheckFaceFailed/i, message: '参考图片人脸检测失败，请更换清晰、正向的人脸图片' },
  { pattern: /NoFaceDetected/i, message: '未检测到清晰人脸，请更换包含单人正脸的图片' },
  { pattern: /MultiFaceDetected/i, message: '检测到多张人脸，请使用仅包含一个主体的图片' },
  { pattern: /Unauthorized/i, message: '视频接口密钥无效或已过期，请检查配置' },
  { pattern: /TooManyRequests/i, message: '请求过于频繁，请稍后重试' },
  { pattern: /QuotaExceeded/i, message: '当前并发额度已满，请稍后重试' },
  { pattern: /ModelUnavailable/i, message: '当前模型暂时不可用，请稍后再试或切换模型' },
  { pattern: /CreditInsufficient/i, message: '积分不足，请充值后重试' },
  {
    pattern: /InternalServiceFailure|ServiceUnavailable|InternalError/i,
    message: '视频服务暂时繁忙，请稍后重试',
  },
];

function translateViduErrorMessage(rawError?: string | null) {
  if (!rawError) return undefined;
  const message = String(rawError)
    .trim()
    .replace(/^Error:\s*/i, '');
  if (!message) return undefined;

  const matched = VIDU_ERROR_TRANSLATIONS.find((item) => item.pattern.test(message));
  if (matched) return matched.message;

  if (message === 'Failed to get task status' || /query|查询/i.test(message)) {
    return '查询任务状态失败，请稍后重试';
  }

  return message;
}

type ViduValidationContext = {
  hasImage: boolean;
  hasEndImage: boolean;
  hasReferenceImages: boolean;
};

type VideoParamComboRules = Record<string, Record<string, { supported: boolean; hint?: string }>>;

const DOUBAO_MODEL_MODE_RULES: VideoParamComboRules = {
  'doubao-seedance-2-0': {
    text_to_video: { supported: true },
    image_to_video: { supported: true },
    first_last_frame: { supported: true },
    reference_to_video: { supported: true },
    video_to_video: { supported: true },
  },
  'doubao-seedance-2-0-fast': {
    text_to_video: { supported: true },
    image_to_video: { supported: true },
    first_last_frame: { supported: true },
    reference_to_video: { supported: true },
    video_to_video: { supported: true },
  },
  'doubao-seedance-1-5-pro': {
    text_to_video: { supported: true },
    image_to_video: { supported: true },
    first_last_frame: { supported: false, hint: 'Seedance 1.5 Pro 仅支持文生视频和图生视频' },
    reference_to_video: { supported: false, hint: 'Seedance 1.5 Pro 仅支持文生视频和图生视频' },
    video_to_video: { supported: false, hint: 'Seedance 1.5 Pro 仅支持文生视频和图生视频' },
  },
};

const HAILUO_MODEL_MODE_RULES: VideoParamComboRules = {
  'hailuo-video-2.3': {
    text_to_video: { supported: true },
    image_to_video: { supported: true },
    first_last_frame: { supported: false, hint: 'Hailuo Video-2.3 仅支持文生视频和图生视频' },
    reference_to_video: { supported: false, hint: 'Hailuo Video-2.3 仅支持文生视频和图生视频' },
    video_to_video: { supported: false, hint: 'Hailuo Video-2.3 仅支持文生视频和图生视频' },
  },
  'hailuo-2.3-fast-768p-6s': {
    text_to_video: { supported: true },
    image_to_video: { supported: true },
    first_last_frame: { supported: true },
    reference_to_video: { supported: false, hint: 'Hailuo 2.3 Fast 不支持多模态参考' },
    video_to_video: { supported: true },
  },
  'hailuo-2.3-768p-6s': {
    text_to_video: { supported: true },
    image_to_video: { supported: true },
    first_last_frame: { supported: true },
    reference_to_video: { supported: false, hint: 'Hailuo 2.3 768P 不支持多模态参考' },
    video_to_video: { supported: true },
  },
};

const KLING_MODEL_MODE_RULES: VideoParamComboRules = {
  'kling-3.0-turbo': {
    text_to_video: { supported: false, hint: 'Kling 3.0 Turbo 仅支持图生视频' },
    image_to_video: { supported: true },
    first_last_frame: {
      supported: false,
      hint: 'Kling 3.0 Turbo 不支持尾帧，请改用 Kling 3.0 / 3.0 Omni',
    },
    reference_to_video: { supported: false, hint: 'Kling 3.0 Turbo 不支持多模态参考' },
    video_to_video: { supported: false, hint: 'Kling 3.0 Turbo 不支持视频重绘' },
  },
  'kling-3.0': {
    text_to_video: { supported: false, hint: 'Kling 3.0 / 3.0 Omni 当前接入为图生视频接口' },
    image_to_video: { supported: true },
    first_last_frame: { supported: true },
    reference_to_video: {
      supported: false,
      hint: 'Kling 3.0 / 3.0 Omni 的元素参考尚未在此节点开放',
    },
    video_to_video: { supported: false, hint: 'Kling 3.0 / 3.0 Omni 不支持视频重绘' },
  },
};

function validateViduParamCombo(
  modelId: string,
  mode: string,
  ctx: ViduValidationContext
): string | null {
  const VIDU_MODEL_MODE_RULES: VideoParamComboRules = {
    'viduq3-pro': {
      text_to_video: { supported: true },
      image_to_video: { supported: true },
      first_last_frame: { supported: true },
      reference_to_video: { supported: true, hint: '后端自动映射为 viduq3' },
      video_to_video: { supported: false, hint: 'viduq3-pro 不支持视频重绘' },
    },
    'viduq3-turbo': {
      text_to_video: { supported: true },
      image_to_video: { supported: true },
      first_last_frame: { supported: true },
      reference_to_video: { supported: true, hint: '后端自动映射为 viduq3' },
      video_to_video: { supported: false, hint: 'viduq3-turbo 不支持视频重绘' },
    },
    'viduq3-pro-fast': {
      text_to_video: { supported: false, hint: 'viduq3-pro-fast 仅支持图生视频' },
      image_to_video: { supported: true },
      first_last_frame: { supported: false, hint: 'viduq3-pro-fast 仅支持图生视频' },
      reference_to_video: { supported: false, hint: 'viduq3-pro-fast 仅支持图生视频' },
      video_to_video: { supported: false, hint: 'viduq3-pro-fast 仅支持图生视频' },
    },
    'viduq2-pro': {
      text_to_video: { supported: true, hint: '后端自动映射为 viduq2' },
      image_to_video: { supported: true },
      first_last_frame: { supported: true },
      reference_to_video: { supported: true, hint: '支持视频/图片/文字主体参考' },
      video_to_video: { supported: false, hint: 'viduq2-pro 不支持视频重绘' },
    },
    'viduq2-turbo': {
      text_to_video: { supported: true, hint: '后端自动映射为 viduq2' },
      image_to_video: { supported: true },
      first_last_frame: { supported: true },
      reference_to_video: { supported: true, hint: '后端自动映射为 viduq2' },
      video_to_video: { supported: false, hint: 'viduq2-turbo 不支持视频重绘' },
    },
    'viduq2-pro-fast': {
      text_to_video: { supported: false, hint: 'viduq2-pro-fast 仅支持图生视频和首尾帧' },
      image_to_video: { supported: true },
      first_last_frame: { supported: true },
      reference_to_video: { supported: false, hint: 'viduq2-pro-fast 不支持多模态参考' },
      video_to_video: { supported: false, hint: 'viduq2-pro-fast 不支持视频重绘' },
    },
    viduq2: {
      text_to_video: { supported: true },
      image_to_video: {
        supported: false,
        hint: 'viduq2 不支持图生视频，请使用 viduq2-pro 或 viduq2-turbo',
      },
      first_last_frame: {
        supported: false,
        hint: 'viduq2 不支持首尾帧，请使用 viduq2-pro 或 viduq2-turbo',
      },
      reference_to_video: { supported: true },
      video_to_video: { supported: false, hint: 'viduq2 不支持视频重绘' },
    },
  };

  const rules = VIDU_MODEL_MODE_RULES[modelId];
  if (!rules) return null;

  const rule = rules[mode];
  if (!rule) return null;

  if (!rule.supported) {
    return `模型 ${modelId} 不支持「${mode === 'text_to_video' ? '文生视频' : mode === 'image_to_video' ? '图生视频' : mode === 'first_last_frame' ? '首尾帧' : mode === 'reference_to_video' ? '多模态参考' : mode === 'video_to_video' ? '视频重绘' : mode}」模式。${rule.hint || '请切换模型或生成模式'}`;
  }

  if (mode === 'text_to_video' && ctx.hasImage) {
    return null;
  }

  if (mode === 'image_to_video' && !ctx.hasImage) {
    return `图生视频模式需要输入参考图片`;
  }

  if (mode === 'first_last_frame') {
    if (!ctx.hasImage && !ctx.hasEndImage) {
      return `首尾帧模式需要输入首帧图片`;
    }
  }

  return null;
}

type GeneralValidationContext = {
  hasImage: boolean;
  hasEndImage: boolean;
  hasReferenceImages: boolean;
  hasVideo: boolean;
};

function getProviderRules(provider: string): VideoParamComboRules | null {
  switch (provider) {
    case 'vidu':
      return null;
    case 'doubao':
      return DOUBAO_MODEL_MODE_RULES;
    case 'hailuo':
    case 'minimax':
      return HAILUO_MODEL_MODE_RULES;
    case 'kling':
      return KLING_MODEL_MODE_RULES;
    default:
      return null;
  }
}

function validateGeneralVideoParamCombo(
  modelId: string,
  mode: string,
  provider: string,
  ctx: GeneralValidationContext
): string | null {
  const rules = getProviderRules(provider);
  if (rules) {
    const modelRules = rules[modelId];
    if (modelRules) {
      const rule = modelRules[mode];
      if (rule && !rule.supported) {
        const modeLabels: Record<string, string> = {
          text_to_video: '文生视频',
          image_to_video: '图生视频',
          first_last_frame: '首尾帧',
          reference_to_video: '多模态参考',
          video_to_video: '视频重绘',
        };
        return `模型 ${modelId} 不支持「${modeLabels[mode] || mode}」模式。${rule.hint || '请切换模型或生成模式'}`;
      }
    }
  }

  if (mode === 'image_to_video' && !ctx.hasImage) {
    return '图生视频模式需要输入参考图片，请连接图片节点或上传参考图';
  }

  if (mode === 'first_last_frame' && !ctx.hasImage && !ctx.hasEndImage) {
    return '首尾帧模式需要输入首帧图片，请连接图片节点或上传首帧';
  }

  if (mode === 'reference_to_video' && !ctx.hasReferenceImages && !ctx.hasVideo) {
    return '多模态参考模式需要输入参考素材，请连接图片/视频节点或通过 @ 引用素材';
  }

  if (mode === 'video_to_video' && !ctx.hasVideo) {
    return '视频重绘模式需要连接视频输入节点';
  }

  if (mode === 'text_to_video' && !ctx.hasImage && !ctx.hasVideo) {
    return null;
  }

  return null;
}

// Blob URL 转 Base64 辅助函数
async function convertBlobUrlToBase64(blobUrl: string): Promise<string> {
  try {
    debugLog('[convertBlobUrlToBase64] 开始转换 Blob URL:', blobUrl.substring(0, 50) + '...');

    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]; // 移除 data:image/xxx;base64, 前缀
        const mimeType = blob.type || 'image/png';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        debugLog('[convertBlobUrlToBase64] 转换成功，Base64长度:', dataUrl.length);
        resolve(dataUrl);
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[convertBlobUrlToBase64] 转换失败:', error);
    throw error;
  }
}

// 判断是否为 Blob URL
function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}

async function inlineReferenceAssetToDataUrl(url: string): Promise<string> {
  if (isDataUrl(url)) return url;
  return isBlobUrl(url)
    ? await convertBlobUrlToBase64(url)
    : await convertReferenceAssetToDataUrl(url);
}

async function convertReferenceAssetToDataUrl(url: string): Promise<string> {
  const fetchUrl = isBlobUrl(url) ? url : getProxiedImageUrl(url);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch reference asset: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read reference asset'));
    reader.readAsDataURL(blob);
  });
}

function shouldInlineReferenceAsset(url: string): boolean {
  if (isBlobUrl(url)) return true;
  if (isLocalhostUrl(url)) return true;
  // 项目文件常以相对路径保存，第三方图片 API 无法解析当前站点的相对 URL。
  if (url.startsWith('/')) return true;
  return false;
}

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function resolveNodeImageUrl(
  sourceData: Record<string, any>,
  sourceHandle?: string | null
): string {
  const storyboardPayload = parseStoryboardPayload(sourceData?.storyboardPayload);
  const characterPayload = getCharacterAssetPayloadFromNodeData(sourceData);

  if (storyboardPayload) {
    const resolvedStoryboard = resolveStoryboardSelection(storyboardPayload);
    if (
      sourceHandle === 'frames' ||
      (sourceHandle === 'output' && storyboardPayload.processingMode === 'sequence')
    ) {
      return (
        resolvedStoryboard.sequenceFrames[0]?.imageUrl ||
        resolvedStoryboard.selectedFrame?.imageUrl ||
        String(
          sourceData?.coverImageUrl ||
            storyboardPayload.coverImageUrl ||
            storyboardPayload.gridImageUrl ||
            ''
        )
      );
    }

    return (
      resolvedStoryboard.selectedFrame?.imageUrl ||
      String(
        sourceData?.coverImageUrl ||
          storyboardPayload.coverImageUrl ||
          storyboardPayload.gridImageUrl ||
          ''
      )
    );
  }

  const toStr = (v: any): string => (typeof v === 'string' ? v : '');
  const task = (
    sourceData?.task && typeof sourceData.task === 'object' ? sourceData.task : null
  ) as Record<string, any> | null;
  const taskFirstResultUrl = Array.isArray(task?.resultUrls)
    ? toStr((task!.resultUrls as any[])[0])
    : toStr(task?.resultUrl);

  return (
    (sourceHandle === 'outfitRef'
      ? resolveOutfitReferenceFromNodeData(sourceData)
      : resolveCharacterReferenceFromNodeData(sourceData, sourceHandle || undefined)) ||
    taskFirstResultUrl ||
    toStr(sourceData?.outputImageUrl) ||
    toStr(sourceData?.coverImageUrl) ||
    toStr(sourceData?.gridImageUrl) ||
    toStr(sourceData?.panoramaImageUrl) ||
    toStr(sourceData?.imageUrl) ||
    toStr(sourceData?.url) ||
    toStr(sourceData?.resultUrl) ||
    toStr(sourceData?.output) ||
    (Array.isArray(sourceData?.resultUrls) ? toStr((sourceData.resultUrls as any[])[0]) : '') ||
    characterPayload?.primaryImage ||
    ''
  );
}

async function normalizeGridDirectorReference(url: string): Promise<string> {
  if (!url) {
    return '';
  }

  if (!shouldInlineReferenceAsset(url)) {
    return url;
  }

  try {
    return isBlobUrl(url)
      ? await convertBlobUrlToBase64(url)
      : await convertReferenceAssetToDataUrl(url);
  } catch (error) {
    console.error('[executeSingleNode] gridDirector 参考图转换失败:', error);
    return '';
  }
}

async function collectGridDirectorReferences(args: {
  nodeId: string;
  nodes: Node<Record<string, any>>[];
  edges: Edge[];
  params: Record<string, any>;
}) {
  const references = {
    reference: String(args.params.reference || ''),
    characterRef: String(args.params.characterRef || ''),
    outfitRef: String(args.params.outfitRef || ''),
    environmentRef: String(args.params.environmentRef || ''),
  };

  args.edges
    .filter((edge) => edge.target === args.nodeId)
    .forEach((edge) => {
      const sourceNode = args.nodes.find((candidate) => candidate.id === edge.source);
      if (!sourceNode) {
        return;
      }

      const sourceData = (sourceNode.data || {}) as Record<string, any>;
      const resolvedUrl = resolveNodeImageUrl(sourceData, edge.sourceHandle);
      if (!resolvedUrl) {
        return;
      }

      const sourceType = (sourceData as { type?: string })?.type || sourceNode.type || '';
      const sourceHandle = edge.sourceHandle || undefined;

      if (edge.targetHandle === 'characterRef' && !references.characterRef) {
        references.characterRef = resolvedUrl;
        return;
      }
      if (edge.targetHandle === 'outfitRef' && !references.outfitRef) {
        references.outfitRef = resolvedUrl;
        return;
      }
      if (edge.targetHandle === 'environmentRef' && !references.environmentRef) {
        references.environmentRef = resolvedUrl;
        return;
      }
      if (
        (edge.targetHandle === 'reference' ||
          edge.targetHandle === 'image' ||
          !edge.targetHandle) &&
        !references.reference
      ) {
        references.reference = resolvedUrl;
        return;
      }
      if (edge.targetHandle === 'input') {
        if (sourceType === 'characterLibrary') {
          if (sourceHandle === 'outfitRef' && !references.outfitRef) {
            references.outfitRef = resolvedUrl;
          } else if (!references.characterRef) {
            references.characterRef = resolvedUrl;
          }
        } else if (!references.reference) {
          references.reference = resolvedUrl;
        }
      }
    });

  return {
    reference: await normalizeGridDirectorReference(references.reference),
    characterRef: await normalizeGridDirectorReference(references.characterRef),
    outfitRef: await normalizeGridDirectorReference(references.outfitRef),
    environmentRef: await normalizeGridDirectorReference(references.environmentRef),
  };
}

function convertConfigKeys(configs: Record<string, any>) {
  const keyMap: Record<string, string> = {
    stableDiffusion: 'stable_diffusion',
    minimaxVideo: 'minimax',
    adobeFirefly: 'adobe_firefly',
    bytedance: 'doubao',
    'doubao-video': 'doubao-video',
    huawei: 'huawei',
    huaweiVideo: 'huawei',
    'huawei-video': 'huawei_video',
    huawei_video: 'huawei_video',
  };

  const converted: Record<string, any> = {};
  Object.entries(configs).forEach(([key, value]) => {
    const newKey = keyMap[key] || key;
    converted[newKey] = value;
  });

  if (converted['doubao'] && !converted['doubao-video']) {
    converted['doubao-video'] = { ...(converted['doubao'] as Record<string, any>) };
  }
  if (converted['doubao-video'] && !converted['doubao']) {
    converted['doubao'] = { ...(converted['doubao-video'] as Record<string, any>) };
  }

  return converted;
}

function normalizeImageSizeValue(value?: unknown): string | undefined {
  const explicit = String(value || '').trim();
  if (!explicit) return undefined;
  if (/^(1K|2K|4K)$/i.test(explicit)) return explicit.toUpperCase();
  if (/^(720p|1080p)$/i.test(explicit)) return explicit.toLowerCase();
  if (/^\d{3,5}x\d{3,5}$/i.test(explicit)) return explicit.toLowerCase();
  return undefined;
}

function resolveImageSizeValue(
  explicitSize?: unknown,
  fallbackResolution?: unknown
): string | undefined {
  const explicit = normalizeImageSizeValue(explicitSize);
  if (explicit) return explicit;

  const match = String(fallbackResolution || '')
    .trim()
    .match(/^(\d{3,5})x(\d{3,5})$/);
  if (!match) return undefined;
  const maxSide = Math.max(Number(match[1]), Number(match[2]));
  if (maxSide >= 3840) return '4K';
  if (maxSide >= 2048) return '2K';
  return '1K';
}

function normalizeRequestedVideoCount(...values: any[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.min(4, Math.round(parsed)));
    }
  }
  return 1;
}

function collectGenerationResultUrls(result: any): string[] {
  const candidates = [
    result?.resultUrl,
    result?.url,
    ...(Array.isArray(result?.resultUrls) ? result.resultUrls : []),
  ];
  return Array.from(
    new Set(
      candidates.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    )
  );
}

async function submitAndPollBackendVideo(
  params: VideoGenerationParams,
  options: {
    isStopped?: () => boolean;
    onSubmitted?: (result: any) => void;
    onProgress?: (progress: number) => void;
    allowAutoRetry?: boolean;
    maxPollingMs?: number;
    nodeId?: string;
    clipIndex?: number;
    totalClips?: number;
  } = {}
) {
  // 防重复提交：将 nodeId 注入 params，使后端幂等性检查生效
  // 后端会基于 `"nodeId":"xxx"` 在 params 字段做 JSON 精确匹配，
  // 同一 nodeId 的 pending/processing 任务会被拦截，避免重复扣费
  if (options.nodeId) {
    (params as any).nodeId = options.nodeId;
  }
  let execResult = await backendProxyAdapter.generateVideo(params);
  options.onSubmitted?.(execResult);

  const shouldPoll =
    execResult?.success &&
    execResult?.taskId &&
    (execResult.status === 'pending' ||
      execResult.status === 'processing' ||
      (execResult.status === 'completed' && collectGenerationResultUrls(execResult).length === 0));

  if (!shouldPoll) {
    const urls = collectGenerationResultUrls(execResult);
    return urls.length > 0
      ? {
          ...execResult,
          success: true,
          status: 'completed',
          resultUrl: urls[0],
          url: urls[0],
          resultUrls: urls,
          provider: execResult.provider || 'backend-proxy',
        }
      : execResult;
  }

  // 持久化进行中的任务，供页面刷新后恢复轮询
  if (options.nodeId && execResult.taskId) {
    savePendingTask({
      nodeId: options.nodeId,
      taskId: execResult.taskId,
      modelId: String((params as any).model || (params as any).modelId || ''),
      submittedAt: Date.now(),
      provider: execResult.provider || 'backend-proxy',
      clipIndex: options.clipIndex,
      totalClips: options.totalClips,
      prompt: String((params as any).prompt || ''),
    });
  }

  // ✅ 架构 2.2 / P0-1：注册到 nodeTaskRegistry，节点删除时自动取消轮询
  // 外部传入的 isStopped 仍生效，二者叠加（任一触发即停止）
  const externalIsStopped = options.isStopped;
  const registryCancelToken = { cancelled: false };
  const registryCancelFn = () => {
    registryCancelToken.cancelled = true;
  };
  if (options.nodeId) {
    nodeTaskRegistry.register(options.nodeId, registryCancelFn);
  }
  const combinedIsStopped = () =>
    registryCancelToken.cancelled || (externalIsStopped ? externalIsStopped() : false);

  let polling = true;
  const maxPollingMs = options.maxPollingMs || VIDEO_MAX_POLLING_MS;
  let pollStartTime = Date.now();
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 60;
  let autoRetryCount = 0;
  const maxAutoRetries = options.allowAutoRetry === false ? 0 : 2;

  try {
    while (polling) {
      if (combinedIsStopped()) {
        // ✅ P1-9：用户取消时通知后端释放密钥租约（fire-and-forget）
        if (execResult.taskId) {
          backendProxyAdapter.cancelVideoTask(execResult.taskId).catch(() => {});
        }
        return {
          success: false,
          taskId: execResult.taskId || '',
          status: 'failed',
          cancelled: true,
          error: '视频任务已取消',
          provider: 'backend-proxy',
        };
      }

      if (Date.now() - pollStartTime > maxPollingMs) {
        // ✅ P1-9：超时时通知后端取消任务、释放密钥租约（fire-and-forget）
        if (execResult.taskId) {
          backendProxyAdapter.cancelVideoTask(execResult.taskId).catch(() => {});
        }
        return {
          success: false,
          taskId: execResult.taskId || '',
          status: 'failed',
          error: '视频生成超时',
          provider: 'backend-proxy',
        };
      }

      await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

      if (combinedIsStopped()) {
        // ✅ P1-9：用户取消时通知后端释放密钥租约
        if (execResult.taskId) {
          backendProxyAdapter.cancelVideoTask(execResult.taskId).catch(() => {});
        }
        return {
          success: false,
          taskId: execResult.taskId || '',
          status: 'failed',
          cancelled: true,
          error: '视频任务已取消',
          provider: 'backend-proxy',
        };
      }

      const statusResult = await backendProxyAdapter.getTaskStatus({
        taskId: execResult.taskId,
      });
      debugLog('[realAPIExecutor] 视频任务轮询状态:', statusResult.status, statusResult.progress);

      if (statusResult.progress !== undefined) {
        options.onProgress?.(statusResult.progress);
      }

      if (statusResult.status === 'completed') {
        const urls = collectGenerationResultUrls(statusResult);
        execResult = {
          success: true,
          taskId: execResult.taskId || '',
          status: 'completed',
          resultUrl: urls[0] || statusResult.resultUrl,
          url: urls[0] || statusResult.resultUrl,
          resultUrls: urls.length > 0 ? urls : statusResult.resultUrls,
          cosUrl: statusResult.cosUrl,
          thumbnailUrl: statusResult.thumbnailUrl || undefined,
          provider: 'backend-proxy',
        };
        removePendingTask(execResult.taskId);
        polling = false;
      } else if (statusResult.status === 'payment_pending') {
        execResult = {
          success: false,
          taskId: execResult.taskId || '',
          status: 'failed',
          error: '积分不足，请充值后重试',
          provider: 'backend-proxy',
        };
        removePendingTask(execResult.taskId);
        polling = false;
      } else if (statusResult.status === 'failed') {
        const isServiceError =
          statusResult.error?.includes('InternalServiceFailure') ||
          statusResult.error?.includes('ServiceUnavailable') ||
          statusResult.error?.includes('InternalError');

        if (isServiceError && autoRetryCount < maxAutoRetries) {
          autoRetryCount += 1;
          // ✅ P1-14：指数退避（3s → 6s → 12s → 24s → 30s cap）
          const baseDelay = 3000;
          const maxDelay = 30000;
          const backoffDelay = Math.min(baseDelay * Math.pow(2, autoRetryCount - 1), maxDelay);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          const retryResult = await backendProxyAdapter.generateVideo(params);
          if (retryResult.success && retryResult.taskId) {
            execResult = retryResult;
            options.onSubmitted?.(retryResult);
            pollStartTime = Date.now();
            consecutiveFailures = 0;
            debugLog('[realAPIExecutor] 视频任务自动重试成功，新任务ID:', retryResult.taskId);
            continue;
          }
        }

        if (
          statusResult.error === 'Failed to get task status' ||
          statusResult.error?.includes('query') ||
          statusResult.error?.includes('查询')
        ) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            execResult = {
              success: false,
              taskId: execResult.taskId || '',
              status: 'failed',
              error: `连续${maxConsecutiveFailures}次查询任务状态失败`,
              provider: 'backend-proxy',
            };
            removePendingTask(execResult.taskId);
            polling = false;
          }
        } else {
          execResult = {
            success: false,
            taskId: execResult.taskId || '',
            status: 'failed',
            error: statusResult.error,
            provider: 'backend-proxy',
          };
          removePendingTask(execResult.taskId);
          polling = false;
        }
      } else {
        consecutiveFailures = 0;
      }
    }
  } finally {
    // ✅ 架构 2.2：轮询结束（正常/取消/超时/失败）注销取消函数
    if (options.nodeId) {
      nodeTaskRegistry.unregister(options.nodeId, registryCancelFn);
    }
  }

  return execResult;
}

export async function executeSingleNode(nodeId: string): Promise<void> {
  debugLog('========== executeSingleNode 开始, nodeId:', nodeId, '==========');

  const canvasStore = useCanvasStore.getState();
  const taskStore = useTaskStore.getState();
  const fileStore = useFileStore.getState();
  const apiStore = useUnifiedAPIConfigStore.getState();
  const membershipStore = useMembershipStore.getState();

  const { nodes, edges, updateNodeData } = canvasStore;
  const { addTask, updateTask } = taskStore;

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    console.error('[executeSingleNode] 未找到节点:', nodeId);
    return;
  }

  // ✅ P0-2：batchProcess 节点有自己的执行逻辑（handleStartBatch 由 UI 按钮触发）
  // DAG 调度（Ctrl+G 打组执行）时不应通过 executeSingleNode 触发，避免误判为图片节点
  if (node.type === 'batchProcess' || node.data?.type === 'batchProcess') {
    debugLog('[executeSingleNode] batchProcess 节点跳过（由 UI 按钮触发执行）');
    return;
  }

  const isGridDirectorNode =
    node.type === 'gridDirector' ||
    node.type === 'scriptStoryboard' ||
    (node.data as Record<string, any> | undefined)?.type === 'gridDirector' ||
    (node.data as Record<string, any> | undefined)?.type === 'scriptStoryboard';
  const isTextNode = !isGridDirectorNode && isTextExecutionNodeType(node.type, node.data?.type);
  const isVideo =
    node.type === 'aiVideo' ||
    node.type === 'videoGen' ||
    node.type === 'advancedVideoGen' ||
    node.type === 'aicgVideoGen' ||
    node.data?.type === 'aiVideo' ||
    node.data?.type === 'videoGen' ||
    node.data?.type === 'advancedVideoGen' ||
    node.data?.type === 'aicgVideoGen';
  const isLocalMattingNode = node.type === 'localMatting' || node.data?.type === 'localMatting';
  const isVideoUpscaleNode = node.type === 'videoUpscale' || node.data?.type === 'videoUpscale';
  const isMultiAngleNode =
    node.type === 'multiAngle' ||
    (node.data as Record<string, any> | undefined)?.type === 'multiAngle';
  const feature = isLocalMattingNode ? null : isTextNode ? 'prompt' : isVideo ? 'video' : 'image';
  let execResult: any = null; // 在这里定义，确保整个函数作用域可用
  let params = (node.data?.params as Record<string, any>) || {};
  if (isVideo) {
    const sanitizedParams = sanitizeVideoGenerationParams(params);
    if (sanitizedParams !== params) {
      params = sanitizedParams;
      updateNodeData(nodeId, {
        modelId:
          sanitizedParams.modelId || params.modelId || (node.data as Record<string, any>)?.modelId,
        params: { ...sanitizedParams },
      });
    }
  }

  if (isMockGenerationEnabled(params)) {
    await commitMockSingleNodeExecution({
      node: node as Node<Record<string, any>>,
      nodes: nodes as Node<Record<string, any>>[],
      edges,
      updateNodeData,
      addTask,
      updateTask,
    });
    return;
  }

  // P2 修复：本地操作（gridDirector split 模式、localMatting、videoUpscale）不需要登录
  // videoUpscale 节点有自己的 handleExecute 直接调用 /api/v1/video/upscale，不走统一执行链路
  const isLocalOnlyOperation =
    isLocalMattingNode ||
    isVideoUpscaleNode ||
    (isGridDirectorNode && (params as Record<string, any>)?.mode === 'split');

  // 在提前返回时设置 failed task，确保 useSubmitLock 能检测到终态并释放锁
  const setEarlyFailTask = (errorMsg: string) => {
    const taskType = feature === 'video' ? 'video' : feature === 'prompt' ? 'text' : 'image';
    updateNodeData(nodeId, {
      task: {
        id: `task-fail-${Date.now()}`,
        nodeId,
        type: taskType,
        nodeType: taskType,
        status: 'failed' as const,
        priority: 'normal',
        progress: 100,
        error: errorMsg,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      error: errorMsg,
    });
  };

  if (!isTextNode && !isLocalOnlyOperation && !membershipStore.membership?.isLoggedIn) {
    setEarlyFailTask('请先登录后再使用此功能');
    toast.warning('请先登录后再使用此功能');
    membershipStore.openLoginModal(isVideo ? 'AI 视频生成' : feature ? 'AI 生成' : undefined);
    return;
  }

  if (feature && (!isTextNode || membershipStore.membership?.isLoggedIn)) {
    const permOptions: {
      provider?: string;
      model?: string;
      resolution?: string;
      durationSeconds?: number;
    } = {};
    if (isVideo) {
      permOptions.model = params.modelId || params.model;
      permOptions.provider = params.modelProvider || params.provider;
      permOptions.resolution = params.resolution;
      const dur = Number(params.duration);
      if (Number.isFinite(dur) && dur > 0) permOptions.durationSeconds = dur;
    } else if (feature === 'image') {
      permOptions.model = params.modelId || params.model;
      permOptions.provider = params.modelProvider || params.provider;
    } else if (feature === 'prompt') {
      // 文本节点：传递 model 参数用于权限检查
      permOptions.model =
        (node.data as Record<string, any>)?.model || params.modelId || params.model;
      permOptions.provider = params.modelProvider || params.provider;
    }
    try {
      const remoteCheck = await permissionService.checkPermission(feature, 1, permOptions);
      if (!remoteCheck.allowed) {
        const permMsg = remoteCheck.message || '额度不足，请升级会员或充值积分';
        setEarlyFailTask(permMsg);
        toast.error(permMsg);
        return;
      }
    } catch (err) {
      console.warn('[executeSingleNode] 配额检查失败，已阻止执行:', err);
      setEarlyFailTask('权限检查失败，请稍后重试');
      toast.error('权限检查失败，请稍后重试');
      return;
    }
  }

  // 类型宽容别名：海报/视频生成参数包含动态字段，使用 any 视图避免对每处访问做类型收窄
  // 注意：原 params 仍保留 Record<string, any> 语义；此处显式标注为局部变量，仅在本函数内使用
  const paramsView = params as any as Record<string, any>;
  const executionPayload = isVideo ? buildExecutionPayload(nodeId, nodes, edges) : null;

  const nodeType = node.type || ((node.data as Record<string, any>)?.type as string);
  // 仅在 modelId 为空时填充默认模型；不为空时保留用户选择，由后端做最终校验
  // 避免 isModelAllowedForNode 因动态列表加载延迟误判，强制覆盖用户已选模型
  if (nodeType && !paramsView.modelId) {
    const defaultModel = nodeModelMatcher.getDefaultModelForNode(nodeType);
    if (defaultModel) {
      paramsView.modelId = defaultModel.modelId;
      paramsView.provider = defaultModel.provider;
      updateNodeData(nodeId, { params: { ...paramsView } });
    }
  }

  let prompt: string =
    executionPayload?.prompt ||
    (typeof params.prompt === 'string' ? params.prompt : '') ||
    (typeof node.data?.prompt === 'string' ? node.data.prompt : '') ||
    (typeof node.data?.script === 'string' ? node.data.script : '') ||
    (typeof node.data?.text === 'string' ? node.data.text : '') ||
    (typeof node.data?.content === 'string' ? node.data.content : '') ||
    '';

  // 优先使用 generationPayload.prompt（含 cameraPrompt 拼接）
  const generationPayload = (params as any).generationPayload;
  if (
    generationPayload &&
    typeof generationPayload.prompt === 'string' &&
    generationPayload.prompt.trim()
  ) {
    prompt = generationPayload.prompt;
    debugLog('[executeSingleNode] 使用 generationPayload.prompt（含相机参数）');
  }

  try {
    const bindingStatus = validateNodeBinding(nodeId, nodes || [], edges || []);
    if (bindingStatus.hasValidBinding && bindingStatus.boundPromptContent) {
      prompt = bindingStatus.boundPromptContent;
      debugLog('[executeSingleNode] 使用绑定的提示词:', prompt);
    }
  } catch (error) {
    console.error('[executeSingleNode] 验证绑定状态时出错:', error);
  }

  debugLog('[executeSingleNode] 节点提示词:', prompt);

  if (isVideo) {
    prompt = applyAicgProVideoToPrompt(
      String(prompt || ''),
      params.proVideo as Record<string, any>
    );
  }

  if (isTextNode) {
    const promptText = String(prompt || '').trim();
    if (!promptText) {
      toast.warning('文本节点需要内容才能执行', {
        description: '请连接提示词节点、剧本文本或在节点中输入文字',
      });
      return;
    }

    const task: GenerationTask = {
      id: `task-${Date.now()}`,
      nodeId,
      type: 'text',
      nodeType: 'text',
      status: 'processing',
      priority: 'normal',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addTask(task);
    updateNodeData(nodeId, { task, outputText: '', text: '' });

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const nodeData = (node.data || {}) as Record<string, any>;
      const selectedTextModel =
        (typeof nodeData.model === 'string' && nodeData.model.trim()) ||
        (typeof paramsView.model === 'string' && paramsView.model.trim()) ||
        (typeof paramsView.modelId === 'string' && paramsView.modelId.trim()) ||
        'apipaths';

      const response = await fetch(`${API_BASE_URL}/public/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: promptText,
          systemPrompt:
            (typeof nodeData.systemPrompt === 'string' && nodeData.systemPrompt.trim()) ||
            (typeof paramsView.systemPrompt === 'string' && paramsView.systemPrompt.trim()) ||
            undefined,
          enableThinking: nodeData.enableThinking ?? paramsView.enableThinking ?? false,
          model: selectedTextModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '文本处理失败' }));
        throw new Error(errData.error || `文本处理失败 (${response.status})`);
      }

      const res = await response.json();
      const outputText = String(res.content || '').trim();
      if (!outputText) {
        throw new Error(res.error || '文本模型未返回内容');
      }

      const completedTask: GenerationTask = {
        ...task,
        status: 'completed',
        progress: 100,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      // 保存历史记录，保留最近 10 条
      const existingHistory = Array.isArray(nodeData.history) ? nodeData.history : [];
      const history = [
        ...existingHistory,
        {
          id: `text-${Date.now()}`,
          prompt: promptText.substring(0, 100),
          result: outputText,
          model: selectedTextModel,
          timestamp: Date.now(),
        },
      ].slice(-10);

      updateTask(task.id, completedTask);
      updateNodeData(nodeId, {
        outputText,
        text: outputText,
        model: selectedTextModel,
        task: completedTask,
        params: { ...paramsView },
        history,
      });

      await fileStore.registerGeneratedFile({
        name: `文本生成_${Date.now()}.txt`,
        type: 'text',
        url: '',
        size: outputText.length,
        textContent: outputText,
        textTitle: String(node.data?.label || 'AI文本'),
        source: 'generated',
        metadata: {
          model: selectedTextModel,
          prompt: promptText,
          category: 'text-generation',
        },
      });

      const synced = syncDownstreamFromNode(nodeId);
      if (synced > 0) {
        debugLog(`[executeSingleNode] 文本节点下游同步 ${synced} 个节点`);
      }
      nodeEventBus.emitNodeExecuted(nodeId, true);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '文本处理失败';
      const failedTask: GenerationTask = {
        ...task,
        status: 'failed',
        progress: 100,
        error: errorMessage,
        updatedAt: new Date().toISOString(),
      };

      updateTask(task.id, failedTask);
      updateNodeData(nodeId, { task: failedTask, error: errorMessage });
      nodeEventBus.emitNodeExecuted(nodeId, false);
      toast.error(errorMessage);
      return;
    }
  }

  // 获取输入图片 - 支持图生视频和图生图模式
  let inputImages: string[] = [];
  let startImage: string | undefined; // 首帧图片（首尾帧模式）
  let endImage: string | undefined; // 尾帧图片（首尾帧模式）

  // 获取所有连接到当前节点的图片边（包括video和image类型）
  // 🔑 关键修复：与 VideoGenNode 保持一致，支持 'image'、'referenceImage'、'firstFrame'、'lastFrame'、空端口
  const imageEdges = edges.filter(
    (e) =>
      e.target === nodeId &&
      (e.targetHandle === 'input' ||
        e.targetHandle === 'prompt' ||
        e.targetHandle === 'image' ||
        e.targetHandle === 'referenceImage' ||
        e.targetHandle === 'referenceImage1' ||
        e.targetHandle === 'referenceImage2' ||
        e.targetHandle === 'referenceImage3' ||
        e.targetHandle === 'referenceImage4' ||
        e.targetHandle === 'referenceImage5' ||
        e.targetHandle === 'referenceImage6' ||
        e.targetHandle === 'firstFrame' ||
        e.targetHandle === 'lastFrame' ||
        !e.targetHandle ||
        e.targetHandle === '')
  );

  const imageTypeEdges = imageEdges.filter((e) => {
    const src = nodes.find((n) => n.id === e.source);
    const srcType = src?.type as string;
    const dataType = (src?.data as Record<string, any>)?.type as string;
    return (
      src &&
      (srcType === 'aiImage' ||
        srcType === 'imageGen' ||
        srcType === 'unifiedImageStudio' ||
        srcType === 'aicgImageGen' ||
        srcType === 'imageAnalysis' ||
        srcType === 'inpainting' ||
        srcType === 'outpainting' ||
        srcType === 'photoGrid' ||
        srcType === 'imageInput' ||
        srcType === 'seedream' ||
        srcType === 'borderlessImageGen' ||
        srcType === 'doubaoSeedream' ||
        srcType === 'imageToVideo' ||
        srcType === 'aiVideo' ||
        srcType === 'advancedVideoGen' || // ✅ 补充支持 advancedVideoGen
        srcType === 'aicgVideoGen' ||
        srcType === 'advancedImageGen' || // ✅ 补充支持 advancedImageGen
        srcType === 'magicStoryboard' || // ✅ 补充支持 magicStoryboard
        srcType === 'gridDirector' || // ✅ 补充支持 gridDirector
        srcType === 'director3D' || // ✅ 补充支持 3D导演台截图输出
        srcType === 'multiAngle' || // ✅ 补充支持 multiAngle
        dataType === 'aiImage' ||
        dataType === 'imageGen' ||
        dataType === 'unifiedImageStudio' ||
        dataType === 'aicgImageGen' ||
        dataType === 'imageAnalysis' ||
        dataType === 'inpainting' ||
        dataType === 'outpainting' ||
        dataType === 'photoGrid' ||
        dataType === 'imageInput' ||
        dataType === 'aiVideo' ||
        dataType === 'magicStoryboard' ||
        dataType === 'gridDirector' ||
        dataType === 'director3D' ||
        dataType === 'multiAngle' || // ✅ 补充支持 multiAngle
        dataType === 'scriptStoryboard')
    );
  });

  // 统一按真实 targetHandle 或旧工作流 edgeRoleMap 解析角色。
  const edgeRoleMap = (
    paramsView.edgeRoleMap && typeof paramsView.edgeRoleMap === 'object'
      ? paramsView.edgeRoleMap
      : undefined
  ) as Record<string, 'start' | 'end' | 'reference'> | undefined;
  const getImageEdgeRole = (edge: Edge) =>
    resolveVideoExecutionInputRole(String(edge.targetHandle || 'input'), edge.id, edgeRoleMap);
  const hasSemanticImageAssignments = imageTypeEdges.some(
    (edge) => getImageEdgeRole(edge) !== 'input'
  );
  let firstFrameEdge =
    imageTypeEdges.find((edge) => getImageEdgeRole(edge) === 'firstFrame') || null;
  let lastFrameEdge = imageTypeEdges.find((edge) => getImageEdgeRole(edge) === 'lastFrame') || null;
  let referenceImageEdge =
    imageTypeEdges.find((edge) => getImageEdgeRole(edge).startsWith('referenceImage')) || null;
  const unassignedImageEdges = imageTypeEdges.filter((edge) => getImageEdgeRole(edge) === 'input');

  // 如果没有显式指定句柄，则使用基于顺序的启发式逻辑（向前兼容）
  if (!hasSemanticImageAssignments) {
    firstFrameEdge = imageTypeEdges[0] || null;
    lastFrameEdge = imageTypeEdges[1] || null;
    referenceImageEdge = imageTypeEdges[2] || null;
  } else {
    if (!firstFrameEdge) {
      firstFrameEdge = unassignedImageEdges[0] || null;
    }
    if (!lastFrameEdge) {
      lastFrameEdge = unassignedImageEdges.find((edge) => edge.id !== firstFrameEdge?.id) || null;
    }
    if (!referenceImageEdge) {
      referenceImageEdge =
        unassignedImageEdges.find(
          (edge) => edge.id !== firstFrameEdge?.id && edge.id !== lastFrameEdge?.id
        ) || null;
    }
  }

  let referenceImage = '';
  // 提取参考图片（从referenceImage handle）
  if (referenceImageEdge) {
    const refNode = nodes.find((n) => n.id === referenceImageEdge.source);
    if (refNode) {
      const refData = refNode.data as Record<string, any>;
      referenceImage = extractOriginalUrl(
        resolveNodeImageUrl(refData, referenceImageEdge.sourceHandle)
      );
    }
  }

  debugLog('[executeSingleNode] 🔍 查找图片连接...');
  debugLog('[executeSingleNode] 找到图片边数量:', imageEdges.length);
  debugLog('[executeSingleNode] 首尾帧连接状态:', {
    hasFirstFrame: !!firstFrameEdge,
    hasLastFrame: !!lastFrameEdge,
    hasReferenceImage: !!referenceImageEdge,
    firstFrameEdge: firstFrameEdge
      ? { source: firstFrameEdge.source, handle: firstFrameEdge.sourceHandle }
      : null,
    lastFrameEdge: lastFrameEdge
      ? { source: lastFrameEdge.source, handle: lastFrameEdge.sourceHandle }
      : null,
    referenceImageEdge: referenceImageEdge
      ? { source: referenceImageEdge.source, handle: referenceImageEdge.sourceHandle }
      : null,
  });
  debugLog(
    '[executeSingleNode] 详细边信息:',
    imageEdges.map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }))
  );

  // 提取首帧图片（从firstFrame handle）
  if (firstFrameEdge) {
    const firstFrameNode = nodes.find((n) => n.id === firstFrameEdge.source);
    if (firstFrameNode) {
      const firstFrameData = firstFrameNode.data as Record<string, any>;
      startImage = extractOriginalUrl(
        resolveNodeImageUrl(firstFrameData, firstFrameEdge.sourceHandle)
      );
      if (startImage) {
        debugLog('[executeSingleNode] ✅ 提取到首帧图片:', startImage.substring(0, 60) + '...');
      }
    }
  }

  // 提取尾帧图片（从lastFrame handle）
  if (lastFrameEdge) {
    const lastFrameNode = nodes.find((n) => n.id === lastFrameEdge.source);
    if (lastFrameNode) {
      const lastFrameData = lastFrameNode.data as Record<string, any>;
      endImage = extractOriginalUrl(resolveNodeImageUrl(lastFrameData, lastFrameEdge.sourceHandle));
      if (endImage) {
        debugLog('[executeSingleNode] ✅ 提取到尾帧图片:', endImage.substring(0, 60) + '...');
      }
    }
  }

  if (imageEdges.length === 0) {
    debugLog('[executeSingleNode] ⚠️ 没有检测到图片连接，将使用文生图模式');
  }

  // 先收集原始URL
  const rawImageUrls: string[] = [];

  imageTypeEdges.forEach((edge, index) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) {
      console.warn(`[executeSingleNode] ❌ 边 ${index}: 找不到源节点 ${edge.source}`);
      return;
    }

    debugLog(
      `[executeSingleNode] 📎 边 ${index}: 源节点类型=`,
      sourceNode.type,
      `ID=${edge.source}`
    );

    // 尝试多种方式获取源节点的输出图片
    const sourceData = sourceNode.data as {
      task?: { resultUrl?: string; resultUrls?: string[] };
      imageUrl?: string;
      outputImageUrl?: string;
      output?: string;
      url?: string;
      resultUrl?: string;
      resultUrls?: string[];
      gridImageUrl?: string;
      coverImageUrl?: string;
      panoramaImageUrl?: string;
      storyboardPayload?: string;
      payload?: string;
      characterRef?: string;
      outfitRef?: string;
      connectedImages?: string[];
      fileName?: string;
    };
    const storyboardPayload = parseStoryboardPayload(sourceData?.storyboardPayload);

    if (storyboardPayload) {
      const resolvedStoryboard = resolveStoryboardSelection(storyboardPayload);
      const storyboardUrls =
        edge.sourceHandle === 'frames' ||
        edge.sourceHandle === 'output' ||
        storyboardPayload.processingMode === 'sequence'
          ? resolvedStoryboard.sequenceFrames.map((frame) => frame.imageUrl).filter(Boolean)
          : [
              resolvedStoryboard.selectedFrame?.imageUrl ||
                sourceData?.coverImageUrl ||
                storyboardPayload.coverImageUrl ||
                storyboardPayload.gridImageUrl ||
                '',
            ].filter(Boolean);

      if (storyboardUrls.length > 0) {
        debugLog(
          `[executeSingleNode] ✅ 边 ${index}: 从分镜 payload 解析到 ${storyboardUrls.length} 张参考图`
        );
        rawImageUrls.push(...storyboardUrls);
        return;
      }
    }

    const imageUrl = resolveNodeImageUrl(
      sourceData as any as Record<string, any>,
      edge.sourceHandle
    );

    if (imageUrl) {
      const originalUrl = extractOriginalUrl(imageUrl);
      debugLog(`[executeSingleNode] ✅ 边 ${index}: 获取到图片URL`);
      debugLog(`[executeSingleNode]    URL类型: ${originalUrl.substring(0, 20)}...`);
      debugLog(`[executeSingleNode]    文件名: ${sourceData.fileName || '未知'}`);
      debugLog(`[executeSingleNode]    是否Blob URL: ${isBlobUrl(originalUrl)}`);
      rawImageUrls.push(originalUrl);
    } else {
      console.warn(`[executeSingleNode] ❌ 边 ${index}: 未找到图片URL`);
      debugLog(`[executeSingleNode]    源节点数据:`, Object.keys(sourceData));
    }
  });

  debugLog('[executeSingleNode] 📋 原始图片URL列表:');
  rawImageUrls.forEach((url, index) => {
    debugLog(`  [${index}] ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
    debugLog(`       类型: ${isBlobUrl(url) ? '⚠️ BLOB_URL (需要转换)' : '✅ 正常URL'}`);
  });

  // 转换 Blob URL 为 Base64 Data URL
  if (rawImageUrls.length > 0) {
    debugLog('[executeSingleNode] 🔄 开始处理图片格式...');

    const conversionPromises = rawImageUrls.map(async (url, index) => {
      debugLog(`[executeSingleNode] 🖼️ 处理图片 [${index}]...`);

      if (shouldInlineReferenceAsset(url)) {
        debugLog('[executeSingleNode] ⚠️ 检测到需内联的参考图，准备转换为 Data URL');
        debugLog(`[executeSingleNode]    原始URL: ${url.substring(0, 60)}...`);

        try {
          const base64DataUrl = await inlineReferenceAssetToDataUrl(url);
          debugLog(`[executeSingleNode] ✅ 图片 [${index}] 转换成功！`);
          debugLog(`[executeSingleNode]    Base64长度: ${base64DataUrl.length}`);
          return base64DataUrl;
        } catch (error) {
          console.error(`[executeSingleNode] ❌ 图片 [${index}] 转换失败:`, error);
          toast.error(`图片 ${index + 1} 格式转换失败`, {
            description: '可能原因：图片数据已过期或浏览器内存已释放，请重新上传图片',
          });
          return '';
        }
      } else {
        debugLog(`[executeSingleNode] ✅ 图片 [${index}] 已经是标准格式，无需转换`);
        return url;
      }
    });

    debugLog('[executeSingleNode] ⏳ 等待所有图片转换完成...');
    inputImages = await Promise.all(conversionPromises);
    inputImages = inputImages.filter((url) => url && url.trim() !== ''); // 过滤掉空值

    // BUG-7 修复：若所有参考图都转换失败，中断流程，避免静默降级为文生视频
    if (rawImageUrls.length > 0 && inputImages.length === 0) {
      console.error('[executeSingleNode] ❌ 所有参考图转换失败，中止生成');
      toast.error('参考图全部失效，无法继续生成', {
        description: '可能原因：图片数据已过期或浏览器内存已释放，请重新上传图片后再试',
      });
      // 标记节点失败状态（task 尚未创建，仅更新节点 error 字段）
      updateNodeData(nodeId, { error: '参考图全部失效，请重新上传图片' });
      nodeEventBus.emitNodeExecuted(nodeId, false);
      return;
    }

    debugLog('[executeSingleNode] 📊 转换结果统计:');
    debugLog(`    总数: ${rawImageUrls.length} 张`);
    debugLog(`    成功: ${inputImages.length} 张`);
    debugLog(`    失败: ${rawImageUrls.length - inputImages.length} 张`);
  } else {
    debugLog('[executeSingleNode] ℹ️ 没有需要处理的图片');
  }

  if (startImage && shouldInlineReferenceAsset(startImage)) {
    try {
      startImage = isBlobUrl(startImage)
        ? await convertBlobUrlToBase64(startImage)
        : await convertReferenceAssetToDataUrl(startImage);
      debugLog('[executeSingleNode] ✅ 首帧图片已转换为 Data URL');
    } catch (error) {
      console.error('[executeSingleNode] ❌ 首帧图片转换失败:', error);
      startImage = undefined;
    }
  }

  if (endImage && shouldInlineReferenceAsset(endImage)) {
    try {
      endImage = await inlineReferenceAssetToDataUrl(endImage);
      debugLog('[executeSingleNode] ✅ 尾帧图片已转换为 Data URL');
    } catch (error) {
      console.error('[executeSingleNode] ❌ 尾帧图片转换失败:', error);
      endImage = undefined;
    }
  }

  debugLog('[executeSingleNode] 🎯 最终输入图片:');
  if (inputImages.length > 0) {
    inputImages.forEach((img, index) => {
      debugLog(`  [${index}] 类型: ${img.startsWith('data:') ? 'Base64 Data URL' : 'HTTP URL'}`);
      debugLog(`       预览: ${img.substring(0, 60)}...`);
    });
  } else {
    debugLog('  (空 - 将使用文生图模式)');
  }

  debugLog(
    `[executeSingleNode] 🎨 节点模式: ${isVideo ? '视频生成' : inputImages.length > 0 ? '图生图' : '文生图'}`
  );

  // 对于视频生成节点且有参考图的情况，允许提示词为空（使用默认提示词）
  if (!prompt || prompt.trim() === '') {
    if (isVideo && inputImages.length > 0) {
      // 图生视频模式：使用默认提示词
      prompt = '由参考图生成的视频';
      debugLog('[executeSingleNode] ⚠️ 图生视频模式：提示词为空，使用默认提示词');
    } else if (inputImages.length > 0) {
      // 图生图模式：也需要提示词，但可以给出提示
      console.warn('[executeSingleNode] ⚠️ 图生图模式但提示词为空');
      prompt = '由参考图生成的图像';
    } else {
      // 纯文生图/视频模式：必须要有提示词
      setEarlyFailTask('节点需要提示词才能生成');
      toast.warning('节点需要提示词才能生成', {
        description: '请连接提示词节点或在节点中输入提示词',
      });
      return;
    }
  }

  const allConfigs = apiStore.getAllConfigs();
  debugLog('[executeSingleNode] 📋 所有API配置:', Object.keys(allConfigs));
  debugLog(
    '[executeSingleNode] 📋 详细配置:',
    JSON.stringify(
      allConfigs,
      (key, value) => {
        if (key === 'apiKey' || key === 'accessKey' || key === 'secretKey') {
          return value ? `***${value.substring(0, 10)}...` : undefined;
        }
        return value;
      },
      2
    )
  );

  const apiConfigs = convertConfigKeys(allConfigs);
  debugLog('[executeSingleNode] 📋 转换后配置:', Object.keys(apiConfigs));
  const _hasApiKey = Object.values(apiConfigs).some(
    (c: any) => c?.apiKey || c?.accessKey || c?.secretKey
  );

  const refreshedConfigs = convertConfigKeys(apiStore.getAllConfigs());
  const finalHasApiKey = Object.values(refreshedConfigs).some(
    (c: any) => c?.apiKey || c?.accessKey || c?.secretKey
  );

  if (!finalHasApiKey) {
    console.warn('[executeSingleNode] ⚠️ 警告：未检测到任何可用的API密钥！生成可能会失败。');
  }

  for (const [providerId, config] of Object.entries(apiStore.getAllConfigs())) {
    const c = config as any;
    if (c && (c.apiKey || c.accessKey) && !c.enabled) {
      apiStore.setProviderEnabled(providerId, true);
    }
  }

  const task: GenerationTask = {
    id: `task-${Date.now()}`,
    nodeId,
    type: isVideo ? 'video' : 'image',
    nodeType: isVideo ? 'video' : 'image',
    status: 'processing',
    priority: 'normal',
    progress: isVideo ? 0 : 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    modelId: String((params as any).modelId || ''),
    modelProvider: String((params as any).modelProvider || (params as any).provider || ''),
    modelName: (params as any).modelName || undefined,
    ...(isVideo ? { startedAt: new Date().toISOString() } : {}),
  };

  const getLatestTask = (): GenerationTask => useTaskStore.getState().tasks[task.id] || task;
  const isTaskStopped = (): boolean => {
    const latestTask = useTaskStore.getState().tasks[task.id];
    return !latestTask || latestTask.status === 'cancelled';
  };

  debugLog('[executeSingleNode] 开始生成:', isVideo ? '视频' : '图片', '提示词:', prompt);

  const connectedVideoUrls =
    executionPayload && executionPayload.videos.length > 0
      ? executionPayload.videos.map((item) => item.url)
      : collectConnectedVideoUrls(nodeId, nodes as Node<Record<string, any>>[], edges);
  const connectedAudioUrls =
    executionPayload && executionPayload.audio.length > 0
      ? executionPayload.audio.map((item) => item.url)
      : collectConnectedAudioUrls(nodeId, nodes as Node<Record<string, any>>[], edges);

  if (isVideo) {
    const provider = (params.modelProvider ||
      (params as Record<string, any>).provider ||
      'agnes') as string;
    const modelId = (params.modelId as string) || 'agnes-video-v2.0';
    let mode = (params.generationMode as string) || 'text_to_video';
    const derivedStartImage = startImage || (inputImages.length > 0 ? inputImages[0] : undefined);
    const derivedEndImage =
      endImage || (inputImages.length > 1 ? inputImages[inputImages.length - 1] : undefined);

    const hasImage = inputImages.length > 0 || !!params.referenceImage || !!derivedStartImage;
    const hasExplicitEndImage = !!endImage;
    const hasDerivedEndImage = !!derivedEndImage;
    const hasRefImages =
      inputImages.length > 1 || ((params.referenceImages as any[])?.length ?? 0) > 0;
    const hasVideoInput =
      !!params.videoUrl ||
      !!params.videoReference ||
      connectedVideoUrls.length > 0 ||
      edges.some(
        (e) =>
          e.target === nodeId &&
          nodes.some(
            (n) =>
              n.id === e.source &&
              (n.type === 'videoInput' ||
                n.type === 'aiVideo' ||
                n.type === 'videoGen' ||
                n.type === 'advancedVideoGen' ||
                n.type === 'aicgVideoGen' ||
                (n.data as Record<string, any>)?.type === 'videoInput' ||
                (n.data as Record<string, any>)?.type === 'aiVideo' ||
                (n.data as Record<string, any>)?.type === 'videoGen')
          )
      );

    // 如果有输入图片但模式是纯文本，自动切换模式
    if (hasImage && mode === 'text_to_video') {
      if (hasExplicitEndImage) {
        mode = 'first_last_frame';
        debugLog('[executeSingleNode] 检测到首尾帧图片，自动切换为首尾帧模式');
      } else if (hasRefImages) {
        mode = 'reference_to_video';
        debugLog('[executeSingleNode] 检测到多张参考帧，自动切换为多参考视频模式');
      } else {
        mode = 'image_to_video';
        debugLog('[executeSingleNode] 检测到输入图片，自动切换为图生视频模式');
      }
      params.generationMode = mode;
      // BUG-3 修复：持久化切换后的模式到节点 data，避免下次执行又重复切换
      // 同时保持 UI 显示与实际执行模式一致
      updateNodeData(nodeId, {
        params: { ...params, generationMode: mode },
      });
    }

    // 如果有视频输入但模式是纯文本，自动切换为视频参考模式
    if (!hasImage && hasVideoInput && mode === 'text_to_video') {
      mode = 'video_to_video';
      debugLog('[executeSingleNode] 检测到视频输入，自动切换为视频参考模式');
      params.generationMode = mode;
      updateNodeData(nodeId, {
        params: { ...params, generationMode: mode },
      });
    }

    if (provider === 'vidu') {
      const validationError = validateViduParamCombo(modelId, mode, {
        hasImage,
        hasEndImage: hasExplicitEndImage || hasDerivedEndImage,
        hasReferenceImages: hasRefImages,
      });
      if (validationError) {
        setEarlyFailTask(validationError);
        toast.error('参数配置错误', { description: validationError });
        return;
      }
    } else {
      const validationError = validateGeneralVideoParamCombo(modelId, mode, provider, {
        hasImage,
        hasEndImage: hasExplicitEndImage || hasDerivedEndImage,
        hasReferenceImages: hasRefImages,
        hasVideo: hasVideoInput,
      });
      if (validationError) {
        setEarlyFailTask(validationError);
        toast.error('参数配置错误', { description: validationError });
        return;
      }
    }
  }

  addTask(task);
  updateNodeData(nodeId, { task });

  if (isGridDirectorNode) {
    const gridDirectorParams = {
      ...DEFAULT_GRID_DIRECTOR_PARAMS,
      ...(params as Partial<typeof DEFAULT_GRID_DIRECTOR_PARAMS>),
    };
    // split 模式由前端本地处理，跳过 API 执行
    if (gridDirectorParams.mode === 'split') {
      debugLog('[executeSingleNode] GridDirector split 模式，跳过 API 执行');
      const cancelledTask: GenerationTask = {
        ...task,
        status: 'completed',
        progress: 100,
        updatedAt: new Date().toISOString(),
      };
      updateTask(task.id, cancelledTask);
      updateNodeData(nodeId, { task: cancelledTask });
      return;
    }
    const gridDirectorReferences = await collectGridDirectorReferences({
      nodeId,
      nodes: nodes as Node<Record<string, any>>[],
      edges,
      params,
    });
    const existingFrameResults = Array.isArray((node.data as Record<string, any>)?.frameResults)
      ? ((node.data as Record<string, any>).frameResults as any[])
      : undefined;
    const retryFrameIndexes = Array.isArray((node.data as Record<string, any>)?.retryFrameIndexes)
      ? ((node.data as Record<string, any>).retryFrameIndexes as any[])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : undefined;
    const totalGridFrames = Math.max(
      1,
      Number(gridDirectorParams.rows || 1) * Number(gridDirectorParams.cols || 1)
    );
    const waitWhilePaused = async () => {
      for (;;) {
        const liveNode = useCanvasStore
          .getState()
          .nodes.find((candidate) => candidate.id === nodeId);
        if (!(liveNode?.data as Record<string, any> | undefined)?.generationPaused) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    };
    const onFrameResultsChange = (frameResults: any[]) => {
      const settledFrames = frameResults.filter(
        (frame) => frame.status === 'succeeded' || frame.status === 'failed'
      ).length;
      updateNodeData(nodeId, {
        frameResults,
        task: {
          ...task,
          status: 'processing',
          progress: Math.min(99, Math.max(1, Math.round((settledFrames / totalGridFrames) * 100))),
          updatedAt: new Date().toISOString(),
        },
      });
    };

    try {
      const result = await runGridDirectorMode({
        nodeId,
        params: gridDirectorParams,
        references: gridDirectorReferences,
        getAuthToken,
        apiBaseUrl: API_BASE_URL,
        existingFrameResults,
        onlyCellIndexes:
          retryFrameIndexes && retryFrameIndexes.length > 0 ? retryFrameIndexes : undefined,
        waitWhilePaused,
        shouldAbortFrame: () => {
          // ✅ P1-3：暂停时中止当前帧的 fetch
          const liveNode = useCanvasStore
            .getState()
            .nodes.find((candidate) => candidate.id === nodeId);
          return (liveNode?.data as Record<string, any> | undefined)?.generationPaused === true;
        },
        onFrameResultsChange,
      });
      const completedTask: GenerationTask = {
        ...task,
        status: 'completed',
        progress: 100,
        resultUrl: result.coverImageUrl || result.gridImageUrl || '',
        updatedAt: new Date().toISOString(),
      };

      updateTask(task.id, completedTask);

      console.log('[executeSingleNode] 🎬 GridDirector result:', {
        frameCount: result.frameResults?.length,
        frameImageUrls: result.frameResults?.map((f: any) => ({
          cellIndex: f.cellIndex,
          imageUrl: f.imageUrl?.substring(0, 80),
          status: f.status,
        })),
        gridImageUrl: result.gridImageUrl?.substring(0, 80),
        coverImageUrl: result.coverImageUrl?.substring(0, 80),
      });

      updateNodeData(nodeId, {
        frameResults: result.frameResults,
        gridImageUrl: result.gridImageUrl,
        coverImageUrl: result.coverImageUrl,
        storyboardPayload: result.storyboardPayload,
        generationPaused: false,
        retryFrameIndexes: undefined,
        task: completedTask,
      });
      const synced = syncDownstreamFromNode(nodeId);
      if (synced > 0) {
        debugLog(`[executeSingleNode] GridDirector 下游同步 ${synced} 个节点`);
      }
      nodeEventBus.emitNodeExecuted(nodeId, true);

      const verifyNode = canvasStore.nodes.find((n) => n.id === nodeId);
      console.log(
        '[executeSingleNode] 🎬 After updateNodeData, node.data.frameResults:',
        (verifyNode?.data as any)?.frameResults?.length,
        'gridImageUrl:',
        (verifyNode?.data as any)?.gridImageUrl?.substring(0, 80)
      );

      const successfulFrames =
        result.frameResults?.filter((f: any) => f.status === 'succeeded' && f.imageUrl) || [];
      const failedFrames = result.frameResults?.filter((f: any) => f.status === 'failed') || [];

      if (failedFrames.length > 0) {
        console.warn('[executeSingleNode] 🎬 GridDirector had failures:', {
          total: result.frameResults?.length,
          succeeded: successfulFrames.length,
          failed: failedFrames.length,
          errors: failedFrames.map((f: any) => ({ cellIndex: f.cellIndex, error: f.error })),
        });
      }

      await Promise.all(
        successfulFrames.map((frame: any, index: number) =>
          fileStore.registerGeneratedFile({
            name: `故事版_镜头${Number(frame.cellIndex ?? index) + 1}_${Date.now()}.png`,
            type: 'image',
            url: frame.imageUrl,
            thumbnailUrl: frame.imageUrl,
            size: 0,
            source: 'generated',
            metadata: {
              prompt: String(frame.prompt || ''),
              generationId: nodeId,
              category: 'storyboard',
            },
          })
        )
      );

      await Promise.all(
        [
          { url: result.gridImageUrl, label: '九宫格' },
          { url: result.coverImageUrl, label: '封面' },
        ]
          .filter((asset): asset is { url: string; label: string } => Boolean(asset.url))
          .map((asset) =>
            fileStore.registerGeneratedFile({
              name: `故事版_${asset.label}_${Date.now()}.png`,
              type: 'image',
              url: asset.url,
              thumbnailUrl: asset.url,
              size: 0,
              source: 'generated',
              metadata: {
                generationId: nodeId,
                category: 'storyboard',
              },
            })
          )
      );

      if (successfulFrames.length === 0) {
        const firstError = failedFrames[0]?.error || '所有帧生成失败';
        toast.error('分镜生成失败', { description: firstError });
        console.error('[executeSingleNode] 🎬 All frames failed, skipping image node creation');
      } else {
        try {
          const { useCanvasStore: _useCanvasStore } = await import('./useCanvasStore');
          const canvasApi = _useCanvasStore.getState();
          const sourceNode = canvasApi.nodes.find((n) => n.id === nodeId);
          const sourceX = sourceNode?.position?.x ?? 0;
          const sourceY = sourceNode?.position?.y ?? 0;

          const COLS = 3;
          const NODE_GAP_X = 280;
          const NODE_GAP_Y = 420;
          const baseTimestamp = Date.now();

          // 清理之前可能创建的旧 auto-imagegen 节点
          const oldImageNodes = canvasApi.edges
            .filter(
              (e) =>
                e.source === nodeId &&
                (e.target?.startsWith('auto-imagegen-') || e.target?.startsWith('auto-aiimage-'))
            )
            .map((e) => e.target);
          oldImageNodes.forEach((oldId) => {
            canvasApi.deleteNode(oldId);
          });

          // 收集参考图信息，传递给每个子节点
          const sharedRefs = {
            characterRef:
              gridDirectorReferences?.characterRef ||
              (params as Record<string, any>)?.characterRef ||
              '',
            outfitRef:
              gridDirectorReferences?.outfitRef || (params as Record<string, any>)?.outfitRef || '',
            environmentRef:
              gridDirectorReferences?.environmentRef ||
              (params as Record<string, any>)?.environmentRef ||
              '',
            reference:
              gridDirectorReferences?.reference || (params as Record<string, any>)?.reference || '',
          };

          // 为每个成功的帧创建独立的 AI 图片节点
          successfulFrames.forEach((frame: any, index: number) => {
            const col = index % COLS;
            const row = Math.floor(index / COLS);
            const nx = sourceX + 520 + col * NODE_GAP_X;
            const ny = sourceY + row * NODE_GAP_Y;
            const imageNodeId = `auto-aiimage-${nodeId}-f${frame.cellIndex}-${baseTimestamp + index}`;

            // 构建帧的专属数据和提示词
            const frameLabel =
              frame.cellIndex !== undefined ? `帧${frame.cellIndex + 1}` : `帧${index + 1}`;
            const gridCell = (result.frameResults?.[frame.cellIndex ?? index] as any) || {};
            const frameAngle = gridCell?.angle || gridCell?.col || '';
            const frameShot = gridCell?.shot || gridCell?.row || '';

            canvasApi.addNode({
              id: imageNodeId,
              type: 'aiImage',
              position: { x: nx, y: ny },
              data: {
                type: 'aiImage',
                label: `${frameLabel} ${frameAngle}${frameShot ? '·' + frameShot : ''}`.trim(),
                prompt: frame.prompt || (params as Record<string, any>).prompt || '',
                imageUrl: frame.imageUrl,
                resultUrl: frame.imageUrl,
                thumbnailUrl: frame.imageUrl,
                task: { ...completedTask, resultUrl: frame.imageUrl },
                cellIndex: frame.cellIndex ?? index,
                rowIndex: frame.rowIndex ?? Math.floor((frame.cellIndex ?? index) / COLS),
                colIndex: frame.colIndex ?? (frame.cellIndex ?? index) % COLS,
                storyboardPayload: result.storyboardPayload,
                gridImageUrl: result.gridImageUrl,
                coverImageUrl: result.coverImageUrl,
                sourceGridDirectorId: nodeId,
                referenceImageUrl: sharedRefs.reference || sharedRefs.characterRef || '',
                characterRef: sharedRefs.characterRef || '',
                outfitRef: sharedRefs.outfitRef || '',
                environmentRef: sharedRefs.environmentRef || '',
              },
            } as never);

            canvasApi.addEdge({
              id: `edge-${nodeId}-${imageNodeId}-${baseTimestamp + index}`,
              source: nodeId as string,
              target: imageNodeId,
              sourceHandle: 'output',
              targetHandle: 'input',
            });

            console.log(
              `[executeSingleNode] ✅ 创建帧节点 [${index}]: ${imageNodeId} cellIndex=${frame.cellIndex}`
            );
          });

          toast.success(`已创建 ${successfulFrames.length} 个图片节点`, {
            description: `成功${successfulFrames.length}帧 / 失败${failedFrames.length}帧`,
          });
          console.log(`[executeSingleNode] ✅ 批量创建 ${successfulFrames.length} 个图片节点`);
        } catch (autoNodeErr) {
          console.warn('[executeSingleNode] 自动创建图片节点失败（不影响主流程）:', autoNodeErr);
        }
      }
    } catch (error) {
      const partialResult =
        typeof error === 'object' && error && 'partialResult' in error
          ? (
              error as {
                partialResult?: {
                  frameResults?: any[];
                  gridImageUrl?: string;
                  coverImageUrl?: string;
                  storyboardPayload?: string;
                };
              }
            ).partialResult
          : undefined;
      const failedTask: GenerationTask = {
        ...task,
        status: 'failed',
        progress: 100,
        resultUrl: partialResult?.coverImageUrl || partialResult?.gridImageUrl || '',
        error: error instanceof Error ? error.message : '生成失败',
        updatedAt: new Date().toISOString(),
      };

      updateTask(task.id, failedTask);
      updateNodeData(nodeId, {
        ...(partialResult?.frameResults ? { frameResults: partialResult.frameResults } : {}),
        ...(partialResult?.gridImageUrl ? { gridImageUrl: partialResult.gridImageUrl } : {}),
        ...(partialResult?.coverImageUrl ? { coverImageUrl: partialResult.coverImageUrl } : {}),
        ...(partialResult?.storyboardPayload !== undefined
          ? { storyboardPayload: partialResult.storyboardPayload }
          : {}),
        generationPaused: false,
        retryFrameIndexes: undefined,
        task: failedTask,
        error: failedTask.error,
      });
      if (
        partialResult?.storyboardPayload ||
        partialResult?.gridImageUrl ||
        partialResult?.coverImageUrl
      ) {
        syncDownstreamFromNode(nodeId);
      }
      nodeEventBus.emitNodeExecuted(nodeId, false);
    }
    return;
  }

  // === MultiAngle 节点专用处理：按视角循环生成多张图片 ===
  if (isMultiAngleNode) {
    const MULTI_ANGLE_PRESETS = [
      { id: 'front', label: '正面', prompt: '主体正面视角，结构清晰，保持原图主体一致' },
      { id: 'left', label: '左侧', prompt: '主体左侧 45 度视角，保持造型、材质和比例一致' },
      { id: 'right', label: '右侧', prompt: '主体右侧 45 度视角，保持造型、材质和比例一致' },
      { id: 'back', label: '背面', prompt: '主体背面视角，补全背部结构和细节，风格一致' },
      { id: 'top', label: '俯视', prompt: '轻微俯视角度，展示顶部结构和整体轮廓' },
      { id: 'low', label: '仰视', prompt: '低机位仰视角度，增强体积感和空间感' },
      { id: 'detail', label: '细节', prompt: '局部细节特写，突出材质、纹理和关键结构' },
      { id: 'hero', label: '主视觉', prompt: '电影感主视觉构图，高级光影，适合封面展示' },
    ];
    const selectedAngles: string[] =
      Array.isArray(params.selectedAngles) && params.selectedAngles.length > 0
        ? params.selectedAngles.map(String)
        : MULTI_ANGLE_PRESETS.slice(0, 6).map((p) => p.id);
    const basePrompt = String(
      params.prompt ||
        node.data?.prompt ||
        '基于输入图片生成多角度视图，保持主体一致、结构一致、材质一致。'
    );
    const referenceImage = inputImages[0] || params.referenceImage || params.sourceImage || '';
    const modelId = String(params.modelId || params.model || 'doubao-seedream-5-0-pro');
    const modelProvider = String(params.modelProvider || params.provider || '');

    const angleResults: string[] = [];
    const angleErrors: string[] = [];
    let angleIndex = 0;
    for (const angleId of selectedAngles) {
      if (isTaskStopped()) {
        debugLog('[executeSingleNode] MultiAngle 任务已被停止');
        break;
      }
      const preset = MULTI_ANGLE_PRESETS.find((p) => p.id === angleId);
      const anglePrompt = `${basePrompt}\n${preset?.label || angleId}: ${preset?.prompt || ''}`;
      angleIndex += 1;
      updateTask(task.id, {
        ...getLatestTask(),
        progress: Math.round((angleIndex / selectedAngles.length) * 100),
        updatedAt: new Date().toISOString(),
      });

      try {
        const imgToken = getAuthToken();
        if (imgToken) backendProxyAdapter.setToken(imgToken);
        const angleResult = await backendProxyAdapter.generateImage({
          prompt: anglePrompt,
          modelId,
          modelProvider,
          referenceImage,
          referenceImages: referenceImage ? [referenceImage] : [],
          aspectRatio: params.aspectRatio || '1:1',
        } as any);

        // 轮询等待结果
        let angleUrl = '';
        if (angleResult.success && angleResult.taskId && angleResult.status !== 'completed') {
          const pollStart = Date.now();
          const pollTimeout = 5 * 60 * 1000;
          while (Date.now() - pollStart < pollTimeout) {
            if (isTaskStopped()) break;
            await new Promise((r) => setTimeout(r, 2000));
            const statusResult = await backendProxyAdapter.getTaskStatus({
              taskId: angleResult.taskId,
            });
            if (statusResult.status === 'completed' || statusResult.resultUrl) {
              angleUrl = statusResult.resultUrl || '';
              break;
            }
            if (statusResult.status === 'failed') break;
          }
        } else if (angleResult.resultUrl) {
          angleUrl = angleResult.resultUrl;
        }

        if (angleUrl) {
          angleResults.push(getProxiedImageUrl(angleUrl));
        } else {
          angleErrors.push(`${preset?.label || angleId}: 生成失败`);
        }
      } catch (err) {
        angleErrors.push(
          `${preset?.label || angleId}: ${err instanceof Error ? err.message : '未知错误'}`
        );
      }
    }

    const completedTask: GenerationTask = {
      ...getLatestTask(),
      status: angleResults.length > 0 ? 'completed' : 'failed',
      progress: 100,
      resultUrl: angleResults[0] || '',
      resultUrls: angleResults,
      error: angleResults.length > 0 ? undefined : angleErrors.join('; ') || '多角度生成失败',
      updatedAt: new Date().toISOString(),
    };
    updateTask(task.id, completedTask);
    // 注意：不覆盖 imageUrl，保留原始参考图，避免多次重新生成导致参考图退化
    updateNodeData(nodeId, {
      task: completedTask,
      resultUrls: angleResults,
      ...(angleResults[0] ? { resultUrl: angleResults[0] } : {}),
    });

    await Promise.all(
      angleResults.map((url, index) =>
        fileStore.registerGeneratedFile({
          name: `多角度_${index + 1}_${Date.now()}.png`,
          type: 'image',
          url,
          thumbnailUrl: url,
          size: 0,
          source: 'generated',
          metadata: {
            prompt: basePrompt,
            generationId: nodeId,
            category: 'multi-angle',
          },
        })
      )
    );

    if (angleResults.length > 0) {
      const synced = syncDownstreamFromNode(nodeId);
      if (synced > 0) {
        debugLog(`[executeSingleNode] MultiAngle 下游同步 ${synced} 个节点`);
      }
      toast.success(`多角度生成完成（${angleResults.length}/${selectedAngles.length}）`);
      nodeEventBus.emitNodeExecuted(nodeId, true);
    } else {
      toast.error('多角度生成失败', { description: angleErrors[0] || '请重试' });
      nodeEventBus.emitNodeExecuted(nodeId, false);
    }
    return;
  }

  try {
    let resultUrl = '';
    let extraResultUrls: string[] = [];
    let imageGenError = '';
    const derivedVideoStartImage =
      startImage ||
      paramsView.startImage ||
      (!hasSemanticImageAssignments && inputImages.length > 0 ? inputImages[0] : undefined);
    const derivedVideoEndImage =
      endImage ||
      paramsView.endImage ||
      (!hasSemanticImageAssignments && inputImages.length > 1
        ? inputImages[inputImages.length - 1]
        : undefined);

    if (isVideo) {
      const resolvedVideoModelId = String(
        paramsView.modelId || paramsView.model || 'agnes-video-v2.0'
      );
      const mergedReferenceVideos = Array.from(
        new Set(
          [
            ...connectedVideoUrls,
            ...(Array.isArray(paramsView.referenceVideos) ? paramsView.referenceVideos : []),
          ].filter(Boolean)
        )
      );
      const videoParams: VideoGenerationParams = sanitizeVideoGenerationParams({
        ...paramsView,
        modelProvider: inferVideoProvider(
          resolvedVideoModelId,
          paramsView.modelProvider || paramsView.provider
        ),
        modelId: resolvedVideoModelId,
        prompt,
        negativePrompt: paramsView.negativePrompt || '',
        referenceImage:
          referenceImage || (inputImages.length > 0 ? inputImages[0] : paramsView.referenceImage),
        referenceImages:
          inputImages.length > 0
            ? inputImages.slice(0, 6)
            : Array.isArray(paramsView.referenceImages)
              ? paramsView.referenceImages.slice(0, 6)
              : paramsView.referenceImages,
        referenceVideos: mergedReferenceVideos,
        referenceAudios: paramsView.referenceAudios || [],
        generateAudio:
          paramsView.audioGeneration !== undefined
            ? paramsView.audioGeneration !== 'none'
            : !!paramsView.generateAudio,
        // BUG-6 修复：保留 audioGeneration 原字段，供后端 doubao-provider fallback 使用
        audioGeneration: paramsView.audioGeneration,
        returnLastFrame: paramsView.returnLastFrame || false,
        enableWebSearch: paramsView.webSearch || paramsView.enableWebSearch || false,
        startImage: derivedVideoStartImage || paramsView.startImage,
        endImage: derivedVideoEndImage || paramsView.endImage,
        seed: paramsView.seed,
        cfgScale: paramsView.cfgScale,
        cameraMovement: paramsView.cameraMovement,
        motionStrength: paramsView.motionStrength,
        style: paramsView.style,
        viduStyle: paramsView.viduStyle,
        creativeStyle: paramsView.creativeStyle,
        motionAmplitude: paramsView.motionAmplitude,
        minimaxMotionLevel: paramsView.minimaxMotionLevel,
        filmEmulation: paramsView.filmEmulation,
        grainSize: paramsView.grainSize,
        promptEnhancer: paramsView.promptEnhancer,
        aspectRatio: paramsView.aspectRatio,
        multiShot: paramsView.multiShot,
        referenceType: paramsView.referenceType,
        characterConsistency: paramsView.characterConsistency,
        styleStrength: paramsView.styleStrength,
        keepOriginalSound: paramsView.keepOriginalSound,
        videoPreset: paramsView.videoPreset,
        bgm: paramsView.bgm,
        offPeak: paramsView.offPeak,
        watermark: paramsView.watermark,
        wmPosition: paramsView.wmPosition,
        wmUrl: paramsView.wmUrl,
        metaData: paramsView.metaData,
        callbackUrl: paramsView.callbackUrl,
        payload: paramsView.payload,
        templateMode: paramsView.templateMode,
        templateStory: paramsView.templateStory,
        templateName: paramsView.templateName,
        templateArea: paramsView.templateArea,
        templateBeast: paramsView.templateBeast,
        templateBgm: paramsView.templateBgm,
        clipCount: Number(paramsView.clipCount || paramsView.videoCount || 1),
        videoCount: Number(paramsView.videoCount || paramsView.clipCount || 1),
        videoUrl:
          paramsView.videoUrl ||
          ((paramsView.generationMode === 'digital_human' ||
            paramsView.generationMode === 'subtitle') &&
          connectedVideoUrls.length > 0
            ? connectedVideoUrls[0]
            : paramsView.videoUrl),
        audioUrl:
          paramsView.audioUrl ||
          (paramsView.generationMode === 'digital_human' && connectedAudioUrls.length > 0
            ? connectedAudioUrls[0]
            : paramsView.audioUrl),
        templateId:
          typeof paramsView.templateId === 'number'
            ? paramsView.templateId
            : paramsView.templateId
              ? Number(paramsView.templateId)
              : undefined,
        videoName: paramsView.videoName,
      } as VideoGenerationParams);

      debugLog(
        '[executeSingleNode] 🎬 视频生成参数:',
        JSON.stringify(
          {
            ...videoParams,
            generationMode: videoParams.generationMode,
            hasStartImage: !!videoParams.startImage,
            hasEndImage: !!videoParams.endImage,
            hasReferenceImage: !!videoParams.referenceImage,
            referenceImagePreview: videoParams.referenceImage
              ? videoParams.referenceImage.substring(0, 60) + '...'
              : undefined,
            referenceImagesCount: videoParams.referenceImages?.length || 0,
            inputImagesCount: inputImages.length,
          },
          null,
          2
        )
      );

      // 调试：确认referenceImage是否正确设置
      if (!videoParams.referenceImage && inputImages.length > 0) {
        console.error('[executeSingleNode] ❌ 严重错误：inputImages有数据但referenceImage为空！', {
          inputImages: inputImages.map((img) => img.substring(0, 60)),
          paramsReferenceImage: paramsView.referenceImage,
        });
      } else if (videoParams.referenceImage) {
        debugLog(
          '[executeSingleNode] ✅ referenceImage已正确设置:',
          videoParams.referenceImage.substring(0, 80)
        );
      }

      // 从统一配置存储中提取专属秘钥
      const providerConfig = (apiConfigs as Record<string, any>)[
        videoParams.modelProvider as string
      ];
      let customApiKey = undefined;
      if (providerConfig && providerConfig.apiKey && typeof providerConfig.apiKey === 'string') {
        customApiKey = providerConfig.apiKey;
      } else if (providerConfig && providerConfig.accessKey) {
        customApiKey = `aksk:${providerConfig.accessKey}:${providerConfig.secretKey || ''}`;
      }

      if (customApiKey) {
        (videoParams as any).apiKey = customApiKey;
      }

      debugLog('[executeSingleNode] 使用智能路由器进行视频生成...');

      debugLog('[executeSingleNode] 使用后端代理服务生成视频...');
      const token = getAuthToken();
      if (token) {
        backendProxyAdapter.setToken(token);
      }
      const requestedVideoCount = normalizeRequestedVideoCount(
        videoParams.clipCount,
        videoParams.videoCount
      );
      const completedVideoResults: any[] = [];
      const failedVideoResults: any[] = [];

      if (isTaskStopped()) {
        debugLog('[executeSingleNode] 视频任务已被停止，结束生成');
        return;
      }

      // 并行提交所有片段
      const clipProgressMap = new Map<number, number>();
      const clipPromises = Array.from({ length: requestedVideoCount }, (_, clipIndex) => {
        const indexedVideoParams: VideoGenerationParams = {
          ...videoParams,
          clipCount: 1,
          videoCount: 1,
          seed:
            requestedVideoCount > 1 && Number(videoParams.seed) > 0
              ? Number(videoParams.seed) + clipIndex
              : videoParams.seed,
        };

        return submitAndPollBackendVideo(indexedVideoParams, {
          isStopped: isTaskStopped,
          nodeId: buildVideoClipRequestNodeId(nodeId, clipIndex, requestedVideoCount),
          clipIndex,
          totalClips: requestedVideoCount,
          onSubmitted: (submitted) => {
            if (!submitted?.taskId) return;
            const submittedTask = {
              ...getLatestTask(),
              backendTaskId: submitted.taskId,
              status: 'processing' as const,
              progress: Math.max(5, Number(getLatestTask().progress || 0)),
              updatedAt: new Date().toISOString(),
            };
            updateTask(task.id, submittedTask);
            updateNodeData(nodeId, { task: submittedTask });
          },
          onProgress: (progress) => {
            clipProgressMap.set(clipIndex, progress || 0);
            // 汇总所有片段进度取平均
            let totalProgress = 0;
            for (const p of clipProgressMap.values()) totalProgress += p;
            const avgProgress = Math.min(99, Math.round(totalProgress / requestedVideoCount));
            const progressTask = {
              ...getLatestTask(),
              progress: avgProgress,
              updatedAt: new Date().toISOString(),
            };
            updateTask(task.id, progressTask);
            updateNodeData(nodeId, { task: progressTask });
          },
        });
      });

      const clipSettled = await Promise.allSettled(clipPromises);
      for (const settled of clipSettled) {
        if (settled.status === 'rejected') {
          failedVideoResults.push({
            success: false,
            error: settled.reason?.message || '片段生成异常',
          });
          continue;
        }
        const clipResult = settled.value;
        const clipUrls = collectGenerationResultUrls(clipResult);
        if (clipResult?.success && clipUrls.length > 0) {
          completedVideoResults.push({
            ...clipResult,
            resultUrl: clipUrls[0],
            url: clipUrls[0],
            resultUrls: clipUrls,
          });
        } else {
          failedVideoResults.push(clipResult);
        }
      }

      if (completedVideoResults.length > 0) {
        const aggregatedUrls = Array.from(
          new Set(completedVideoResults.flatMap((result) => collectGenerationResultUrls(result)))
        );
        execResult = {
          ...completedVideoResults[0],
          success: true,
          status: 'completed' as const,
          taskId: completedVideoResults
            .map((result) => result.taskId)
            .filter(Boolean)
            .join(','),
          resultUrl: aggregatedUrls[0],
          url: aggregatedUrls[0],
          resultUrls: aggregatedUrls,
          provider: 'backend-proxy',
        };
        if (failedVideoResults.length > 0) {
          toast.warning(`已生成 ${completedVideoResults.length}/${requestedVideoCount} 个视频`, {
            description:
              translateViduErrorMessage(failedVideoResults[0]?.error) || '部分视频任务失败',
          });
        }
      } else {
        execResult = failedVideoResults[0] || {
          success: false,
          status: 'failed' as const,
          error: '视频生成失败',
          provider: 'backend-proxy',
        };
      }

      if (execResult.taskId) {
        const taskWithRemoteId: GenerationTask = {
          ...getLatestTask(),
          backendTaskId: execResult.taskId,
          updatedAt: new Date().toISOString(),
        };
        updateTask(task.id, taskWithRemoteId);
        updateNodeData(nodeId, { task: taskWithRemoteId });
      }

      debugLog(
        '[executeSingleNode] 视频生成响应:',
        JSON.stringify({
          success: execResult.success,
          status: execResult.status,
          taskId: execResult.taskId,
          error: execResult.error,
          url: execResult.url ? execResult.url.substring(0, 60) : undefined,
        })
      );

      const videoResultUrls = collectGenerationResultUrls(execResult);
      if (execResult.success && videoResultUrls.length > 0) {
        execResult = {
          ...execResult,
          success: true,
          taskId: execResult.taskId || '',
          status: 'completed' as const,
          resultUrl: videoResultUrls[0],
          url: videoResultUrls[0],
          resultUrls: videoResultUrls,
          provider: execResult.provider || 'backend-proxy',
        };
      }

      if (execResult.success && execResult.url) {
        debugLog('[executeSingleNode] ✅ 后端代理视频生成成功!', {
          provider: execResult.provider,
          url: execResult.url?.substring(0, 60),
        });
        resultUrl = execResult.url;
        if (execResult.resultUrls && execResult.resultUrls.length > 1) {
          extraResultUrls = execResult.resultUrls.filter((u: string) => u && u !== resultUrl);
        }
        try {
          const { refreshMembership } = useMembershipStore.getState();
          await refreshMembership();
        } catch {
          /* ignored */
        }
      } else {
        const errMsg =
          translateViduErrorMessage(
            execResult.error || (execResult.success ? '视频生成超时，请重试' : '视频生成失败')
          ) || '视频生成失败';
        console.warn('[executeSingleNode] ⚠️ 后端代理视频生成失败:', errMsg);
        resultUrl = execResult.url || '';
        if (!resultUrl) {
          imageGenError = errMsg;
          const failedTask = {
            ...getLatestTask(),
            status: 'failed' as const,
            error: errMsg,
            updatedAt: new Date().toISOString(),
          };
          updateTask(task.id, failedTask);
          updateNodeData(nodeId, { task: failedTask, error: errMsg });
        }
      }
    } else {
      // 构建图片生成参数 - 支持多种生成模式
      const resolvedImageModel = unifiedAPIModelService.getModelConfig(
        String(paramsView.modelId || '')
      );
      // provider 兼容性迁移：liblib 已下线，请求转发到 sensenova
      const rawModelProvider = paramsView.modelProvider || 'doubao';
      const migratedModelProvider = rawModelProvider === 'liblib' ? 'sensenova' : rawModelProvider;
      const resolvedImageSize = resolveImageSizeValue(
        paramsView.imageSize || paramsView.pixelResolution,
        paramsView.resolution
      );

      // 收集 UI references（style/character/structure/remix/mask）中的图片 URL
      const uiReferenceEntries: Array<{ url: string; role: string }> = [];
      const refs = (paramsView as any).references;
      if (refs && typeof refs === 'object') {
        const referenceRoles: Record<string, string> = {
          style: '风格参考',
          color: '校色参考',
          character: '角色与主体参考',
          structure: '构图与结构参考',
          remix: '原图内容参考',
          mask: '局部编辑标记',
        };
        for (const key of ['style', 'color', 'character', 'structure', 'remix', 'mask']) {
          const arr = refs[key];
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item && typeof item === 'object' && typeof item.url === 'string' && item.url) {
                uiReferenceEntries.push({ url: item.url, role: referenceRoles[key] });
              } else if (typeof item === 'string' && item) {
                uiReferenceEntries.push({ url: item, role: referenceRoles[key] });
              }
            }
          }
        }
      }

      // 分类参考图可能仍是 localhost/blob URL；与连线输入图使用同一套上传前内联逻辑。
      const normalizedUiReferenceEntries = (
        await Promise.all(
          uiReferenceEntries.map(async (entry) => {
            if (!shouldInlineReferenceAsset(entry.url)) return { ...entry, sourceUrl: entry.url };
            try {
              return {
                ...entry,
                sourceUrl: entry.url,
                url: await inlineReferenceAssetToDataUrl(entry.url),
              };
            } catch (error) {
              console.warn('[executeSingleNode] 分类参考图内联失败:', error);
              return null;
            }
          })
        )
      ).filter((entry): entry is { url: string; role: string; sourceUrl: string } =>
        Boolean(entry?.url)
      );

      // 分类参考图优先排列，保证提示词中的“参考图 N”与请求图片顺序一致。
      const allReferenceImages = Array.from(
        new Set(
          [...normalizedUiReferenceEntries.map((entry) => entry.url), ...inputImages].filter(
            Boolean
          )
        )
      );
      const roleByUrl = new Map(
        normalizedUiReferenceEntries.map((entry) => [entry.url, entry.role])
      );
      const imageNumberBySourceUrl = new Map(
        normalizedUiReferenceEntries.map((entry) => [
          entry.sourceUrl,
          allReferenceImages.indexOf(entry.url) + 1,
        ])
      );
      const roleDirectives = allReferenceImages
        .map((url, index) => {
          const role = roleByUrl.get(url);
          return role ? `参考图${index + 1}用于${role}` : '';
        })
        .filter(Boolean);
      const baseImagePrompt =
        roleDirectives.length > 0
          ? `${prompt}\n参考图用途：${roleDirectives.join('；')}。严格按照每张图片的指定用途生成，不要混淆人物、色彩、风格和构图。`
          : prompt;
      const seedreamAnnotations = Array.isArray(paramsView.seedreamAnnotations)
        ? paramsView.seedreamAnnotations
        : [];
      const annotationDirectives = seedreamAnnotations
        .map((annotation: any) => {
          const imageNumber = imageNumberBySourceUrl.get(String(annotation?.imageUrl || ''));
          const coordinates = Array.isArray(annotation?.coordinates)
            ? annotation.coordinates.map((value: unknown) =>
                Math.max(0, Math.min(999, Math.round(Number(value))))
              )
            : [];
          if (!imageNumber || coordinates.some((value: number) => !Number.isFinite(value)))
            return '';
          if (annotation?.kind === 'point' && coordinates.length === 2) {
            return `图 ${imageNumber}<point>${coordinates[0]} ${coordinates[1]}</point>`;
          }
          if (annotation?.kind === 'bbox' && coordinates.length === 4) {
            return `图 ${imageNumber}<bbox>${coordinates.join(' ')}</bbox>`;
          }
          return '';
        })
        .filter(Boolean);
      const imagePrompt =
        annotationDirectives.length > 0
          ? `${baseImagePrompt}\n交互编辑定位：${annotationDirectives.join('；')}。严格按上述定位执行编辑，仅修改用户指定的对象或区域，其他内容保持不变。`
          : baseImagePrompt;

      const imageParams: ImageGenerationParams = {
        ...paramsView,
        modelProvider: migratedModelProvider,
        modelId: resolvedImageModel?.modelInfo.modelId || paramsView.modelId,
        aspectRatio: paramsView.aspectRatio || '1:1',
        resolution: paramsView.resolution,
        imageSize: resolvedImageSize,
        pixelResolution: resolvedImageSize,
        prompt: imagePrompt,
        negativePrompt: paramsView.negativePrompt || '',
        // 图生图：传递参考图片（合并 canvas 输入和 UI 参考图）
        referenceImage:
          allReferenceImages.length > 0
            ? allReferenceImages[0]
            : paramsView.referenceImage || undefined,
        referenceImages:
          allReferenceImages.length > 0
            ? allReferenceImages
            : paramsView.referenceImages || undefined,
        // 传递新参数
        promptEnhancement: paramsView.promptEnhancer,
        promptOptimizer: paramsView.promptOptimizer,
        hdMode: paramsView.hdMode,
        watermark: paramsView.watermark,
        characterConsistency:
          paramsView.characterConsistency !== undefined ? paramsView.characterConsistency : 0.8,
        strength: paramsView.strength !== undefined ? paramsView.strength : 0.5,
        style: paramsView.style,
        cfgStrength: paramsView.cfgScale,
        seed: paramsView.seed !== -1 ? paramsView.seed : undefined,
        // 防重复提交幂等键：后端基于此字段拦截同一节点的重复 pending/processing 任务
        nodeId,
      };

      // 如果有输入图片，确保 generationMode 为使用参考图的模式。
      // MiniMax 的参考图能力本质是“人像/角色一致性”，默认应优先落到 character_reference。
      if (inputImages.length > 0) {
        const currentMode = imageParams.generationMode;
        const needsSwitch = !currentMode || currentMode === 'text_to_image';
        const modelProvider = imageParams.modelProvider || 'doubao';

        if (needsSwitch) {
          if (modelProvider === 'minimax') {
            debugLog('[executeSingleNode] 检测到输入图片，MiniMax 默认切换为人物参考模式');
            (imageParams as any as Record<string, any>).generationMode = 'character_reference';
          } else {
            debugLog('[executeSingleNode] 检测到输入图片，自动切换为图生图模式');
            (imageParams as any as Record<string, any>).generationMode = 'image_to_image';
          }
        }

        // 确保 referenceImage 一定被设置
        if (!imageParams.referenceImage && inputImages[0]) {
          imageParams.referenceImage = inputImages[0];
        }
        if (!imageParams.referenceImages || imageParams.referenceImages.length === 0) {
          imageParams.referenceImages = inputImages;
        }

        debugLog(
          '[executeSingleNode] 🖼️ 参考图已设置 - mode:',
          imageParams.generationMode,
          'referenceImage存在:',
          !!imageParams.referenceImage
        );
      }

      const isStoryboardImageController = isStoryboardMakerImageController(
        node.data as Record<string, any>,
        paramsView
      );
      if (isStoryboardImageController) {
        const hasStoryboardReferenceImages = Boolean(
          imageParams.referenceImage ||
          (Array.isArray(imageParams.referenceImages) && imageParams.referenceImages.length > 0)
        );
        normalizeStoryboardImageParams(imageParams, hasStoryboardReferenceImages);
      }

      debugLog('[executeSingleNode] 🖼️ 图片生成参数:', JSON.stringify(imageParams, null, 2));
      debugLog('[executeSingleNode] 参考图片数量:', inputImages.length);
      debugLog('[executeSingleNode] 使用智能路由器进行图片生成...');

      const batchImageCount = Math.max(1, Number(paramsView.imageCount || 1));
      if (batchImageCount > 1) {
        const now = new Date().toISOString();
        const subTasks: GenerationSubTask[] = Array.from({ length: batchImageCount }, (_, i) => ({
          index: i,
          status: 'pending' as const,
          progress: 0,
          startedAt: now,
        }));
        const batchTask: GenerationTask = {
          ...getLatestTask(),
          subTasks,
          batchSize: batchImageCount,
          modelId: String(imageParams.modelId || ''),
          modelProvider: String(imageParams.modelProvider || (imageParams as any).provider || ''),
          modelName:
            (imageParams as any).modelLabel ||
            generationPayload?.modelName ||
            paramsView.modelName ||
            undefined,
          promptPreview: String(prompt || '').slice(0, 120),
        };
        updateTask(task.id, batchTask);
        updateNodeData(nodeId, { task: batchTask });
      } else {
        const singleTask: GenerationTask = {
          ...getLatestTask(),
          batchSize: 1,
          modelId: String(imageParams.modelId || ''),
          modelProvider: String(imageParams.modelProvider || (imageParams as any).provider || ''),
          modelName:
            (imageParams as any).modelLabel ||
            generationPayload?.modelName ||
            paramsView.modelName ||
            undefined,
          promptPreview: String(prompt || '').slice(0, 120),
        };
        updateTask(task.id, singleTask);
        updateNodeData(nodeId, { task: singleTask });
      }

      debugLog('[executeSingleNode] 使用后端代理服务生成图片...');
      const imgToken = getAuthToken();
      if (imgToken) {
        backendProxyAdapter.setToken(imgToken);
      }
      execResult = await backendProxyAdapter.generateImage(imageParams);

      if (execResult.taskId) {
        const taskWithRemoteId: GenerationTask = {
          ...getLatestTask(),
          backendTaskId: execResult.taskId,
          progress: Math.max(10, Number(getLatestTask().progress || 0)),
          updatedAt: new Date().toISOString(),
        };
        updateTask(task.id, taskWithRemoteId);
        updateNodeData(nodeId, { task: taskWithRemoteId });
      }
      debugLog('[executeSingleNode] 📊 后端图片生成响应:', JSON.stringify(execResult, null, 2));

      // Polling loop for BackendProxyAdapter
      if (
        execResult.success &&
        execResult.taskId &&
        (execResult.status === 'pending' ||
          execResult.status === 'processing' ||
          (execResult.status === 'completed' && !execResult.resultUrl))
      ) {
        debugLog('[executeSingleNode] 图片任务已提交至后端，开始轮询...', execResult.taskId);
        let polling = true;
        const imgPollStart = Date.now();
        const imgPollTimeout = 10 * 60 * 1000;
        while (polling) {
          if (isTaskStopped()) {
            debugLog('[executeSingleNode] 图片任务已被停止，结束轮询:', execResult.taskId);
            return;
          }
          if (Date.now() - imgPollStart > imgPollTimeout) {
            execResult = {
              success: false,
              taskId: execResult.taskId || '',
              status: 'failed' as const,
              error: '图片生成超时，请稍后重试',
              provider: 'backend-proxy',
            };
            polling = false;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
          if (isTaskStopped()) {
            debugLog('[executeSingleNode] 图片任务在等待期间被停止，结束轮询:', execResult.taskId);
            return;
          }
          const statusResult = await backendProxyAdapter.getTaskStatus({
            taskId: execResult.taskId,
          });
          debugLog('[executeSingleNode] 轮询状态:', statusResult.status, statusResult.progress);

          if (statusResult.status !== 'completed' && statusResult.status !== 'failed') {
            const latestForProgress = getLatestTask();
            const backendProgress = Number(statusResult.progress || 0);
            const elapsedPolls = Math.floor((Date.now() - imgPollStart) / 2000);
            const estimatedProgress = Math.min(90, 10 + elapsedPolls * 2);
            // Some providers report 0 until completion. Keep the visible queue
            // moving monotonically, while allowing a higher real value to lead.
            const overallProgress = Math.min(
              99,
              Math.max(Number(latestForProgress.progress || 0), backendProgress, estimatedProgress)
            );
            const currentBatchSize = latestForProgress.batchSize || 1;
            let updatedSubTasks = latestForProgress.subTasks;
            if (
              currentBatchSize > 1 &&
              updatedSubTasks &&
              updatedSubTasks.length === currentBatchSize
            ) {
              const completedCount = Math.floor((overallProgress / 100) * currentBatchSize);
              updatedSubTasks = updatedSubTasks.map((st, i) => {
                if (i < completedCount) {
                  return {
                    ...st,
                    status: 'completed' as const,
                    progress: 100,
                    completedAt: st.completedAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                }
                if (i === completedCount && overallProgress < 100) {
                  const partialProgress = Math.round(
                    ((overallProgress / 100) * currentBatchSize - completedCount) * 100
                  );
                  return {
                    ...st,
                    status: 'processing' as const,
                    progress: Math.max(st.progress, Math.min(99, partialProgress)),
                    updatedAt: new Date().toISOString(),
                  };
                }
                return st;
              });
            }
            const progressTask: GenerationTask = {
              ...latestForProgress,
              progress: overallProgress,
              ...(updatedSubTasks ? { subTasks: updatedSubTasks } : {}),
              updatedAt: new Date().toISOString(),
            };
            updateTask(task.id, progressTask);
            updateNodeData(nodeId, { task: progressTask });
          }

          if (statusResult.status === 'completed') {
            execResult = {
              success: true,
              taskId: execResult.taskId || '',
              status: 'completed' as const,
              url: statusResult.resultUrl,
              resultUrls: statusResult.resultUrls,
              cosUrl: statusResult.cosUrl,
              provider: 'backend-proxy',
            };
            polling = false;
          } else if (statusResult.status === 'payment_pending') {
            execResult = {
              success: false,
              taskId: execResult.taskId || '',
              status: 'failed' as const,
              error: '积分不足，请充值后重试',
              provider: 'backend-proxy',
            };
            polling = false;
          } else if (statusResult.status === 'failed') {
            execResult = {
              success: false,
              taskId: execResult.taskId || '',
              status: 'failed' as const,
              error: statusResult.error,
              provider: 'backend-proxy',
            };
            polling = false;
          }
        }
      } else if (execResult.success && execResult.resultUrl) {
        execResult = {
          success: true,
          taskId: execResult.taskId || '',
          status: 'completed' as const,
          url: execResult.resultUrl,
          resultUrls: execResult.resultUrls,
          provider: 'backend-proxy',
        };
      }

      if (execResult.success && execResult.url) {
        debugLog('[executeSingleNode] ✅ 后端代理图片生成成功!', {
          provider: execResult.provider,
          url: execResult.url?.substring(0, 60),
          resultUrlsCount: execResult.resultUrls?.length || 0,
        });
        resultUrl = execResult.url;
        if (execResult.resultUrls && execResult.resultUrls.length > 1) {
          extraResultUrls = execResult.resultUrls.filter((u: string) => u && u !== resultUrl);
        }
        try {
          const { refreshMembership } = useMembershipStore.getState();
          await refreshMembership();
        } catch {
          /* ignored */
        }
      } else {
        const errMsg =
          translateViduErrorMessage(
            execResult.error || (execResult.success ? '图片生成超时，请重试' : '图片生成失败')
          ) || '图片生成失败';
        console.warn('[executeSingleNode] ⚠️ 后端代理图片生成失败:', errMsg);
        resultUrl = execResult.url || '';
        if (!resultUrl) {
          imageGenError = errMsg;
        }
      }
    }

    const preferredResultUrl = resultUrl
      ? normalizeMediaUrl(getProxiedImageUrl(execResult?.cosUrl ? execResult.cosUrl : resultUrl))
      : undefined;
    const normalizedResultUrls =
      extraResultUrls.length > 0 && preferredResultUrl
        ? [
            preferredResultUrl,
            ...extraResultUrls.map((u) => normalizeMediaUrl(getProxiedImageUrl(u))),
          ]
        : undefined;

    const completedTask: GenerationTask = {
      ...getLatestTask(),
      status: resultUrl ? 'completed' : 'failed',
      progress: 100,
      resultUrl: preferredResultUrl,
      ...(execResult?.cosUrl ? { cosUrl: execResult.cosUrl } : {}),
      ...(normalizedResultUrls ? { resultUrls: normalizedResultUrls } : {}),
      error: resultUrl
        ? undefined
        : translateViduErrorMessage(imageGenError || '生成失败') || '生成失败',
      ...(resultUrl && (getLatestTask().subTasks || []).length > 0
        ? {
            subTasks: (getLatestTask().subTasks || []).map((st, i) => {
              const allUrls =
                normalizedResultUrls || (preferredResultUrl ? [preferredResultUrl] : []);
              return {
                ...st,
                status: 'completed' as const,
                progress: 100,
                resultUrl: allUrls[i],
                completedAt: st.completedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            }),
          }
        : {}),
      ...(resultUrl ? { completedAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    };

    updateTask(task.id, completedTask);
    const existingHistory = Array.isArray((node.data as Record<string, any>)?.history)
      ? ((node.data as Record<string, any>).history as any[])
      : [];
    const nextHistory =
      resultUrl && isVideo
        ? [
            {
              id: `video-history-${Date.now()}`,
              createdAt: new Date().toISOString(),
              durationMs: Date.now() - new Date(task.createdAt).getTime(),
              prompt,
              params: { ...paramsView },
              modelId: paramsView.modelId,
              provider: paramsView.modelProvider || (paramsView as any).provider,
              resultUrl: preferredResultUrl,
              resultUrls: normalizedResultUrls || (preferredResultUrl ? [preferredResultUrl] : []),
            },
            ...existingHistory,
          ].slice(0, 20)
        : existingHistory;
    // 单张图片生成完成时强制覆盖 resultUrls，避免旧数组残留导致监视窗口仍显老图
    const finalResultUrls =
      normalizedResultUrls ?? (preferredResultUrl ? [preferredResultUrl] : []);

    updateNodeData(nodeId, {
      task: completedTask,
      ...(preferredResultUrl ? { resultUrl: preferredResultUrl } : {}),
      ...(preferredResultUrl && isVideo
        ? { videoUrl: preferredResultUrl, receivedVideoUrl: preferredResultUrl }
        : {}),
      ...(preferredResultUrl && !isVideo
        ? { imageUrl: preferredResultUrl, receivedImageUrl: preferredResultUrl }
        : {}),
      ...(finalResultUrls.length > 0 ? { resultUrls: finalResultUrls } : {}),
      // ✅ 统一 mediaType 字段（架构 2.1）
      ...(resultUrl ? { mediaType: isVideo ? 'video' : 'image' } : {}),
      ...(isVideo && resultUrl ? { history: nextHistory } : {}),
      ...(execResult?.cosUrl ? { cosUrl: execResult.cosUrl } : {}),
      ...(!resultUrl ? { error: completedTask.error } : {}),
    });

    if (resultUrl) {
      const synced = syncDownstreamFromNode(nodeId);
      if (synced > 0) {
        debugLog(`[executeSingleNode] AICG 下游同步 ${synced} 个节点`);
      }
      nodeEventBus.emitNodeExecuted(nodeId, true);
    } else {
      nodeEventBus.emitNodeExecuted(nodeId, false);
    }

    if (resultUrl) {
      await fileStore.registerGeneratedFile({
        name: `${isVideo ? 'video' : 'image'}_${Date.now()}.${isVideo ? 'mp4' : 'png'}`,
        type: isVideo ? 'video' : 'image',
        url: preferredResultUrl || resultUrl,
        size: 0,
      });
    }

    // 多图生成：为所有生成的图片自动创建新节点并连接
    // 修复：第一张图已经在主节点显示了，所以只为多出来的图创建新节点
    if (!isVideo && extraResultUrls.length > 0) {
      debugLog(
        `[executeSingleNode] 🖼️ 多图生成完成，额外有 ${extraResultUrls.length} 张图片，自动创建新节点...`
      );

      const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      const currentNodeX = currentNode?.position?.x ?? 0;
      const currentNodeY = currentNode?.position?.y ?? 0;
      const NODE_OFFSET_X = 460;
      const NODE_OFFSET_Y = 340;

      for (let i = 0; i < extraResultUrls.length; i++) {
        const imageUrl = extraResultUrls[i];
        const proxiedUrl = getProxiedImageUrl(imageUrl);
        const newNodeId = generateId();
        const col = Math.floor((i + 1) / 3);
        const row = (i + 1) % 3;

        const newNode = {
          id: newNodeId,
          type: 'aiImage',
          position: {
            x: currentNodeX + NODE_OFFSET_X + col * NODE_OFFSET_X,
            y: currentNodeY + row * NODE_OFFSET_Y,
          },
          data: {
            type: 'aiImage',
            imageUrl: proxiedUrl,
            resultUrl: proxiedUrl,
            resultUrls: [proxiedUrl],
            params: {
              ...((node.data.params as Record<string, any>) || {}),
              imageCount: 1,
              generationMode: 'image_to_image',
            },
            label: `生成结果-${i + 2}`,
            isExpanded: true,
          },
        };

        const { addNode, addEdge } = useCanvasStore.getState();
        addNode(newNode);
        nodeEventBus.emitNodeAdded(newNode);

        const newEdge = {
          id: generateId(),
          source: nodeId,
          sourceHandle: 'output',
          target: newNodeId,
          targetHandle: 'input',
        };
        addEdge(newEdge);

        await fileStore.registerGeneratedFile({
          name: `image_${Date.now()}_extra_${i}.png`,
          type: 'image',
          url: imageUrl,
          size: 0,
        });

        debugLog(
          `[executeSingleNode] ✅ 已创建额外图片节点 ${i + 1}/${extraResultUrls.length}: ${newNodeId}`
        );
      }
    }

    debugLog('[executeSingleNode] 生成完成:', resultUrl);
  } catch (error) {
    console.error('[executeSingleNode] 生成失败:', error);

    const failedTask: GenerationTask = {
      ...task,
      status: 'failed',
      error:
        translateViduErrorMessage(error instanceof Error ? error.message : '生成失败') ||
        '生成失败',
      updatedAt: new Date().toISOString(),
    };

    updateTask(task.id, failedTask);
    updateNodeData(nodeId, { task: failedTask, error: failedTask.error });
  }
}

type BatchExecutionContext = {
  workflowPayload?: {
    nodes?: Array<{
      id?: string;
      type?: string;
      data?: Record<string, any>;
    }>;
  };
};

function findBatchExecutableNode(context?: BatchExecutionContext) {
  const nodes = context?.workflowPayload?.nodes || [];
  return nodes.find(
    (node) =>
      node.type === 'aiImage' ||
      node.type === 'imageGen' ||
      node.type === 'unifiedImageStudio' ||
      node.type === 'aicgImageGen' ||
      node.type === 'aiVideo' ||
      node.type === 'videoGen' ||
      node.type === 'advancedVideoGen' ||
      node.type === 'aicgVideoGen' ||
      node.type === 'audioGen' ||
      node.type === 'characterConsistency' ||
      node.type === 'multiAngle' ||
      node.type === 'gridDirector'
  );
}

export async function executeBatchWorkflowItem(
  item: Record<string, any>,
  context?: BatchExecutionContext
) {
  const executableNode = findBatchExecutableNode(context);
  const startedAt = new Date().toISOString();

  if (executableNode) {
    const token = getAuthToken();
    if (token) {
      backendProxyAdapter.setToken(token);
    }

    const templateParams = (executableNode.data?.params as Record<string, any> | undefined) || {};
    const mergedPrompt = String(item.prompt || templateParams.prompt || '');

    if (
      executableNode.type === 'aiVideo' ||
      executableNode.type === 'videoGen' ||
      executableNode.type === 'advancedVideoGen' ||
      executableNode.type === 'aicgVideoGen'
    ) {
      const response = await backendProxyAdapter.generateVideo(
        sanitizeVideoGenerationParams({
          ...(templateParams as any as VideoGenerationParams),
          prompt: mergedPrompt,
        })
      );
      const resultUrl = String(
        (response as any as Record<string, any>)?.resultUrl ||
          (response as any as Record<string, any>)?.url ||
          ''
      );

      return {
        itemId: String(item.itemId || ''),
        status: resultUrl ? 'done' : 'failed',
        resultUrl,
        resultUrls: Array.isArray((response as any as Record<string, any>)?.resultUrls)
          ? ((response as any as Record<string, any>).resultUrls as any[]).map((value) =>
              String(value)
            )
          : [],
        error: resultUrl
          ? ''
          : String((response as any as Record<string, any>)?.error || '批处理视频生成失败'),
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }

    const response = await backendProxyAdapter.generateImage({
      ...(templateParams as any as ImageGenerationParams),
      prompt: mergedPrompt,
    });
    const resultUrl = String(
      (response as any as Record<string, any>)?.resultUrl ||
        (response as any as Record<string, any>)?.url ||
        ''
    );

    return {
      itemId: String(item.itemId || ''),
      status: resultUrl ? 'done' : 'failed',
      resultUrl,
      resultUrls: Array.isArray((response as any as Record<string, any>)?.resultUrls)
        ? ((response as any as Record<string, any>).resultUrls as any[]).map((value) =>
            String(value)
          )
        : [],
      error: resultUrl
        ? ''
        : String((response as any as Record<string, any>)?.error || '批处理图片生成失败'),
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  return {
    itemId: String(item.itemId || ''),
    status: 'failed',
    resultUrl: '',
    resultUrls: [],
    error: '未找到可执行的生成节点',
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

export async function executeImagePostProcess(params: {
  imageUrl: string;
  mode: string;
  brightness: number;
  contrast: number;
  saturation: number;
  backgroundColor: string;
  styleTransfer: string;
}) {
  const token = getAuthToken();
  if (token) {
    backendProxyAdapter.setToken(token);
  }

  const response = await backendProxyAdapter.generateImage({
    modelProvider: 'minimax',
    generationMode: 'image_to_image',
    referenceImage: extractOriginalUrl(params.imageUrl),
    prompt:
      params.mode === 'enhance'
        ? '提升清晰度与细节'
        : params.mode === 'restyle'
          ? `风格化为 ${params.styleTransfer || '自定义风格'}`
          : `替换背景为 ${params.backgroundColor || 'transparent'}`,
  } as ImageGenerationParams);

  const directResultUrl =
    (response as any as Record<string, any>)?.resultUrl ||
    (response as any as Record<string, any>)?.url;
  if (typeof directResultUrl === 'string' && directResultUrl) {
    return {
      resultUrl: directResultUrl,
      error: '',
    };
  }

  const taskId = (response as any as Record<string, any>)?.taskId;
  const status = (response as any as Record<string, any>)?.status;
  if (taskId && (status === 'pending' || status === 'processing' || status === 'completed')) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResult = await backendProxyAdapter.getTaskStatus({ taskId: String(taskId) });
      if (statusResult.status === 'completed' && statusResult.resultUrl) {
        return {
          resultUrl: statusResult.resultUrl,
          error: '',
        };
      }
      if (statusResult.status === 'failed') {
        return {
          resultUrl: '',
          error: statusResult.error || '图像后处理失败',
        };
      }
    }
  }

  return {
    resultUrl: '',
    error: String((response as any as Record<string, any>)?.error || '后端未返回结果'),
  };
}

export async function executeWithRealAPI(): Promise<void> {
  debugLog('========== real-api-executor 批量执行 ==========');

  const canvasStore = useCanvasStore.getState();
  const { nodes } = canvasStore;

  const genNodes = nodes.filter(
    (n) =>
      n.type === 'aiImage' ||
      n.type === 'imageGen' ||
      n.type === 'unifiedImageStudio' ||
      n.type === 'aicgImageGen' ||
      n.type === 'photoGrid' ||
      n.type === 'gridDirector' ||
      n.type === 'aiVideo' ||
      n.type === 'videoGen' ||
      n.type === 'advancedVideoGen' ||
      n.type === 'aicgVideoGen' ||
      n.data?.type === 'aiImage' ||
      n.data?.type === 'imageGen' ||
      n.data?.type === 'unifiedImageStudio' ||
      n.data?.type === 'aicgImageGen' ||
      n.data?.type === 'photoGrid' ||
      n.data?.type === 'gridDirector' ||
      n.data?.type === 'aiVideo' ||
      n.data?.type === 'videoGen' ||
      n.data?.type === 'advancedVideoGen' ||
      n.data?.type === 'aicgVideoGen'
  );

  debugLog('找到生成节点:', genNodes.length);

  if (genNodes.length === 0) {
    toast.warning('请先添加图片生成或视频生成节点！');
    return;
  }

  for (const node of genNodes) {
    await executeSingleNode(node.id);
  }

  debugLog('=== 批量执行完成 ===');
}

/**
 * 将参数对象中的代理 URL 还原为原始 URL
 */
function unproxyParams<T extends Record<string, any>>(params: T): T {
  const newParams: Record<string, any> = { ...params };
  const urlFields = [
    'imageUrl',
    'referenceImage',
    'startImage',
    'endImage',
    'videoUrl',
    'videoReference',
    'firstFrameUrl',
    'lastFrameUrl',
    'audioUrl',
    'audioReference',
  ];

  for (const field of urlFields) {
    if (typeof newParams[field] === 'string') {
      newParams[field] = extractOriginalUrl(newParams[field]);
    }
  }

  if (Array.isArray(newParams.referenceImages)) {
    newParams.referenceImages = newParams.referenceImages.map((url: any) =>
      typeof url === 'string' ? extractOriginalUrl(url) : url
    );
  }

  if (Array.isArray(newParams.referenceVideos)) {
    newParams.referenceVideos = newParams.referenceVideos.map((url: any) =>
      typeof url === 'string' ? extractOriginalUrl(url) : url
    );
  }

  return newParams as T;
}

export const realAPIExecutor = {
  executeSingleNode,
  executeWithRealAPI,

  async executeVideoGen({ id, params }: { id: string; params: VideoGenerationParams }) {
    debugLog('[realAPIExecutor] executeVideoGen:', id, params);
    const paramsRecord = params as unknown as Record<string, unknown>;
    if (isMockGenerationEnabled(paramsRecord)) {
      const result = buildMockNodeGenerationResultForNode(
        {
          id,
          type: 'videoGen',
          position: { x: 0, y: 0 },
          data: { label: '视频生成', params },
        } as Node<Record<string, any>>,
        String(params.prompt || paramsRecord.text || '')
      );
      return {
        status: 'completed',
        resultUrl: result.videoUrl || result.resultUrl,
        resultUrls:
          result.videoUrl || result.resultUrl ? [result.videoUrl || result.resultUrl] : undefined,
        provider: 'local-dev',
        mock: true,
      };
    }

    try {
      const token = getAuthToken();
      if (token) {
        backendProxyAdapter.setToken(token);
      }
      const cleanParams = unproxyParams(params);
      // 兜底 modelId：防止 params.modelId 为 undefined 时后端 Zod 校验失败
      if (!cleanParams.modelId && !(cleanParams as any).model) {
        (cleanParams as any).modelId = 'agnes-video-v2.0';
      }
      const requestedVideoCount = normalizeRequestedVideoCount(
        cleanParams.clipCount,
        cleanParams.videoCount
      );
      const completedVideoResults: any[] = [];
      const failedVideoResults: any[] = [];

      // 并行提交所有片段
      const clipPromises = Array.from({ length: requestedVideoCount }, (_, clipIndex) => {
        const indexedVideoParams: VideoGenerationParams = {
          ...cleanParams,
          clipCount: 1,
          videoCount: 1,
          seed:
            requestedVideoCount > 1 && Number(cleanParams.seed) > 0
              ? Number(cleanParams.seed) + clipIndex
              : cleanParams.seed,
        };
        return submitAndPollBackendVideo(indexedVideoParams, {
          // 多片段时为每个片段生成唯一 nodeId 后缀，避免后端幂等性检查误拦合法并行片段
          nodeId: buildVideoClipRequestNodeId(id, clipIndex, requestedVideoCount),
          clipIndex,
          totalClips: requestedVideoCount,
        });
      });

      const clipSettled = await Promise.allSettled(clipPromises);
      for (const settled of clipSettled) {
        if (settled.status === 'rejected') {
          failedVideoResults.push({
            success: false,
            error: settled.reason?.message || '片段生成异常',
          });
          continue;
        }
        const clipResult = settled.value;
        const clipUrls = collectGenerationResultUrls(clipResult);

        if (clipResult?.success && clipUrls.length > 0) {
          completedVideoResults.push({
            ...clipResult,
            resultUrl: clipUrls[0],
            url: clipUrls[0],
            resultUrls: clipUrls,
          });
        } else {
          failedVideoResults.push(clipResult);
        }
      }

      if (completedVideoResults.length > 0) {
        const resultUrls = Array.from(
          new Set(completedVideoResults.flatMap((result) => collectGenerationResultUrls(result)))
        );
        const thumbnailUrl = completedVideoResults.find(
          (result) => result.thumbnailUrl
        )?.thumbnailUrl;
        return {
          status: 'completed',
          taskId: completedVideoResults
            .map((result) => result.taskId)
            .filter(Boolean)
            .join(','),
          resultUrl: resultUrls[0],
          resultUrls,
          thumbnailUrl,
          provider: 'backend-proxy',
          error:
            failedVideoResults.length > 0
              ? translateViduErrorMessage(failedVideoResults[0]?.error) || '部分视频任务失败'
              : undefined,
        };
      }

      const failedResult = failedVideoResults[0] || {};
      return {
        status: 'failed',
        taskId: failedResult.taskId,
        error:
          translateViduErrorMessage(failedResult.error) || failedResult.error || '视频生成失败',
        thumbnailUrl: undefined,
      };
    } catch (error: any) {
      console.error('[realAPIExecutor] Video generation failed:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败',
        thumbnailUrl: undefined,
      };
    }
  },

  async executeImageGen({ id, params }: { id: string; params: ImageGenerationParams }) {
    debugLog('[realAPIExecutor] executeImageGen:', id, params);
    const paramsRecord = params as unknown as Record<string, unknown>;
    if (isMockGenerationEnabled(paramsRecord)) {
      const result = buildMockNodeGenerationResultForNode(
        {
          id,
          type: 'imageGen',
          position: { x: 0, y: 0 },
          data: { label: '图片生成', params },
        } as Node<Record<string, any>>,
        String(params.prompt || paramsRecord.text || '')
      );
      return {
        status: 'completed',
        resultUrl: result.imageUrl || result.resultUrl,
        resultUrls: result.resultUrls,
        provider: 'local-dev',
        mock: true,
      };
    }

    try {
      const token = getAuthToken();
      if (token) {
        backendProxyAdapter.setToken(token);
      }
      const cleanParams = unproxyParams(params);
      const result = await backendProxyAdapter.generateImage(cleanParams);

      if (result.success && result.resultUrl) {
        return {
          status: 'completed',
          resultUrl: result.resultUrl,
          resultUrls: result.resultUrls,
          provider: 'backend-proxy',
        };
      } else if (
        result.success &&
        result.taskId &&
        (result.status === 'pending' ||
          result.status === 'processing' ||
          (result.status === 'completed' && !result.resultUrl))
      ) {
        let polling = true;
        let finalResult = result;
        let attempts = 0;
        const MAX_POLL_ATTEMPTS = 150;
        while (polling) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempts++;
          if (attempts >= MAX_POLL_ATTEMPTS) {
            polling = false;
            finalResult = {
              success: false,
              error: '图片生成超时，请稍后查看任务状态',
              provider: 'backend-proxy',
            } as any as typeof result;
            break;
          }
          const statusResult = await backendProxyAdapter.getTaskStatus({ taskId: result.taskId });
          if (statusResult.status === 'completed') {
            finalResult = {
              success: true,
              resultUrl: statusResult.resultUrl,
              resultUrls: statusResult.resultUrls,
              provider: 'backend-proxy',
            } as any as typeof result;
            polling = false;
          } else if (statusResult.status === 'failed') {
            finalResult = {
              success: false,
              error: statusResult.error,
              provider: 'backend-proxy',
            } as any as typeof result;
            polling = false;
          }
        }
        return {
          status: finalResult.success ? 'completed' : 'failed',
          resultUrl: finalResult.resultUrl,
          resultUrls: finalResult.resultUrls,
          error: finalResult.error,
        };
      } else {
        return {
          status: 'failed',
          error: result.error || '图片生成失败',
        };
      }
    } catch (error: any) {
      console.error('[realAPIExecutor] Image generation failed:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败',
      };
    }
  },

  async executeAudioGen({ id, params }: { id: string; params: AudioGenerationParams }) {
    debugLog('[realAPIExecutor] executeAudioGen:', id, params);
    const paramsRecord = params as unknown as Record<string, unknown>;
    if (isMockGenerationEnabled(paramsRecord)) {
      const result = buildMockNodeGenerationResultForNode(
        {
          id,
          type: 'audioGen',
          position: { x: 0, y: 0 },
          data: { label: '音频生成', params },
        } as Node<Record<string, any>>,
        String(params.prompt || params.text || params.lyrics || '')
      );
      return {
        status: 'completed',
        resultUrl: result.audioUrl || result.resultUrl,
        provider: 'local-dev',
        mock: true,
      };
    }
    const _apiStore = useUnifiedAPIConfigStore.getState();

    try {
      // 区分音乐生成和普通音频生成，但是我们统一调用后端 /audio/generate 接口，由后端去适配不同的 API
      const isMusic = params.mode === 'music';
      const endpoint = `${API_BASE_URL}/audio/generate`;

      const token = getAuthToken();

      const requestBody: Record<string, any> = {
        ...params,
        provider: params.modelProvider,
        model: params.modelId || (isMusic ? 'music-2.6' : undefined),
        text: params.text || params.prompt,
        lyrics: params.lyrics,
        volume: params.vol,
        audioFormat: params.format,
        timbreWeights: params.timbreWeights?.map((tw) => ({
          voice_id: tw.voiceId,
          weight: tw.weight,
        })),
      };
      delete (requestBody as Record<string, any>).vol;
      delete (requestBody as Record<string, any>).format;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (result.success) {
        try {
          const { refreshMembership } = useMembershipStore.getState();
          await refreshMembership();
        } catch {
          /* ignored */
        }
        return {
          status: result.data.status || 'completed',
          resultUrl: result.data.audioUrl,
          taskId: result.data.taskId,
          provider: result.data.provider || params.modelProvider || 'minimax',
        };
      } else {
        return {
          status: 'failed',
          error: result.error || '生成失败',
        };
      }
    } catch (error: any) {
      console.error('[realAPIExecutor] Audio generation failed:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败',
      };
    }
  },
};

export default realAPIExecutor;
