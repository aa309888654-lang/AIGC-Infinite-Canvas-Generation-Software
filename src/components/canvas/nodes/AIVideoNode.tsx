import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { NodeProps, type Edge, type Node } from '@xyflow/react';
import {
  ChevronDown,
  Clapperboard,
  Film,
  Languages,
  Loader2,
  Maximize2,
  Pause,
  Play,
  SlidersHorizontal,
  Upload,
  Wand2,
  X,
  Zap,
  Settings2,
} from 'lucide-react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { AICGNodeTopCornerActions } from './AICGNodeShell';
import AicgProVideoSliders from './AicgProVideoSliders';
import { NodePointsBadge } from './NodePointsBadge';
import { resolveVideoNodePoints, resolveVideoNodePointsPerSecond } from './video-node-points';
import CharacterLibraryPanel, {
  type CharacterLibraryItem,
} from '@/components/panels/CharacterLibraryPanel';
import { pointsConfigService } from '@/services/membership/points-config-service';
import { useMembershipStore } from '@/store/useMembershipStore';
import AICGNodePromptBar from './AICGNodePromptBar';
import { calculateVideoPointsPerSecond } from '@/lib/pricing-rules';
import { getConfiguredVideoRate } from '@/lib/video-pricing-table';
import {
  CANVAS_NODE_BASE_WIDTH,
  CANVAS_NODE_HORIZONTAL_GAP,
  CANVAS_NODE_VERTICAL_GAP,
  getCanvasNodeDimensions,
  withCanvasNodeDefaultSize,
} from '@/lib/canvas-node-dimensions';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { useShallow } from 'zustand/react/shallow';
import { cn, generateId } from '@/lib/utils';
import { toast } from 'sonner';
import { promptOptimizerService, classifyPromptAgent } from '@/services/prompt-optimizer-api';
import { matchPromptTemplates } from '@/lib/prompt-template-matcher';
import { checkQuotaOrFail } from '@/lib/quota-helper';
import { usePermission } from '@/hooks/usePermission';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { normalizeMediaUrl } from '@/lib/media-url';
import { persistImportedCanvasFile } from '@/services/canvas-asset-actions';
import {
  appendPromptSegment,
  getCharacterAssetPayloadFromNodeData,
  resolveCharacterReferenceFromNodeData,
} from './character-payload';
import { parseStoryboardPayload, resolveStoryboardSelection } from './storyboard-payload';
import { translatePromptToEnglish } from '@/lib/prompt-auto-translation';
import {
  OFFICIAL_VIDEO_MODE_FIELDS,
  OFFICIAL_VIDEO_MODE_HELP,
  OFFICIAL_VIDEO_MODE_LABELS,
  OFFICIAL_VIDEO_MODEL_CAPABILITIES,
  clampOfficialVideoParams,
  getDurationsForResolution,
  getOfficialVideoModelCapabilityByAlias,
  normalizeOfficialVideoMode,
  type OfficialVideoField,
  type OfficialVideoMode,
  type OfficialVideoModelCapability,
} from '@/config/video-model-capabilities';
import {
  getVideoControllerCanonicalModelId,
  getVideoControllerModelPresets,
  resolveVideoControllerRouteId,
} from '@/config/video-controller-model-families';
import { sanitizeProviderDisplayText } from '@/lib/provider-display';
import { getModelIconConfig } from '@/config/model-icons';
import { useNodeModels } from '@/hooks/useNodeModels';
import { useAppPanelStore } from '@/store/useAppPanelStore';
import type { UnifiedModelConfig } from '@/services/unified-api-model-service';
import { getDefaultWatermarkEnabled, resolveWatermarkSetting } from '@/lib/watermark-policy';

const AI_VIDEO_PREVIEW_HEIGHT = Math.round((CANVAS_NODE_BASE_WIDTH * 9) / 16);

type VideoMode = OfficialVideoMode;
type VideoField = OfficialVideoField;
type AIVideoModelPreset = OfficialVideoModelCapability & {
  isCustomModel?: boolean;
  isBuiltIn?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
  isConfigured?: boolean;
  isAvailable?: boolean;
  providerModel?: string;
};

interface AIVideoNodeData {
  type?: 'aiVideo';
  label?: string;
  prompt?: string;
  modelId?: string;
  params?: Record<string, unknown>;
  videoUrl?: string;
  thumbnailUrl?: string;
  resultUrl?: string;
  resultUrls?: string[];
  history?: Array<{
    id?: string;
    createdAt?: string;
    prompt?: string;
    modelId?: string;
    provider?: string;
    resultUrl?: string;
    resultUrls?: string[];
    durationMs?: number;
    recovered?: boolean;
  }>;
  task?: {
    status?: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    resultUrl?: string;
    resultUrls?: string[];
    error?: string;
  };
}

type AIVideoParams = Record<string, unknown> & {
  generationMode: VideoMode;
  prompt: string;
  modelId: string;
  modelProvider: string;
  provider: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  clipCount?: 1 | 2 | 4;
  generateAudio?: boolean;
  referenceImage?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  startImage?: string;
  endImage?: string;
  videoUrl?: string;
  negativePrompt?: string;
  videoPreset?: string;
  promptReferences?: PromptReferenceItem[];
  edgeRoleMap?: Record<string, 'start' | 'end' | 'reference'>;
  storyboardInputMode?: 'selected' | 'sequence';
  storyboardFrames?: unknown[];
  autoValidateMaterial?: boolean;
  proVideo?: {
    lightIntensity?: number;
    cameraPitch?: number;
    cameraYaw?: number;
    dollySpeed?: number;
  };
};

interface VideoInputState {
  hasPrompt: boolean;
  hasImage: boolean;
  hasReferenceImages: boolean;
  hasVideo: boolean;
  hasFirstFrame: boolean;
  hasLastFrame: boolean;
}

interface PromptReferenceItem {
  id: string;
  label: string;
  url: string;
  source: string;
  token: string;
  origin: 'canvas' | 'library';
  previewUrl?: string;
  role: 'character' | 'start' | 'end';
}

const VIDEO_MODE_LABELS = OFFICIAL_VIDEO_MODE_LABELS;
const VIDEO_MODE_HELP = OFFICIAL_VIDEO_MODE_HELP;
const VIDEO_MODE_FIELDS = OFFICIAL_VIDEO_MODE_FIELDS;
const VIDEO_MODEL_PRESETS: AIVideoModelPreset[] = getVideoControllerModelPresets().map((model) => ({
  ...model,
  isBuiltIn: true,
  isPopular: true,
  isFeatured: true,
  isConfigured: false,
  isAvailable: false,
}));
const DEFAULT_VIDEO_MODEL = VIDEO_MODEL_PRESETS[0];

function getMembershipHiddenVideoModelIds(
  membershipLevel: string,
  models: AIVideoModelPreset[]
): Set<string> {
  const normalizedLevel = membershipLevel.toLowerCase();
  const lightOrAbove = new Set([
    'light',
    'basic',
    'vip',
    'pro',
    'premium',
    'professional',
    'local',
    'enterprise',
    'admin',
  ]).has(normalizedLevel);

  if (lightOrAbove) return new Set();

  return new Set(
    models
      .filter(
        (model) =>
          ['doubao'].includes(model.provider)
      )
      .map((model) => model.id)
  );
}

const fieldLabels: Record<VideoField, string> = {
  aspectRatio: '比例',
  resolution: '清晰度',
  duration: '时长',
  fps: '帧率',
  motionStrength: '运动强度',
  cameraMovement: '运镜',
  styleStrength: '风格强度',
  characterConsistency: '角色一致',
  promptEnhancer: '提示词增强',
  generateAudio: '同步音频',
  style: '画面风格',
  motionAmplitude: '运动幅度',
  bgm: '背景音乐',
  offPeak: '错峰生成',
  watermark: '水印',
  wmPosition: '水印位置',
  wmUrl: '水印图片',
  metaData: '元数据',
  callbackUrl: '回调地址',
  payload: '透传参数',
  returnLastFrame: '返回尾帧',
  webSearch: '联网增强',
  keepOriginalSound: '保留原声',
  referenceType: '参考类型',
  videoPreset: '风格预设',
  templateMode: '模板模式',
  templateStory: '故事模板',
  templateName: '特效模板',
  templateArea: '区域参数',
  templateBeast: '主体参数',
  templateBgm: '模板配乐',
  seed: '种子',
  videoUrl: '视频地址',
  audioUrl: '音频地址',
  templateId: '模板ID',
};

const VIDEO_CLIP_COUNT_OPTIONS = [1, 2, 4] as const;
const VIDEO_RESOLUTION_DISPLAY_GROUPS = [
  { label: '480P', values: ['480p', '854x480', '480x854'] },
  { label: '720P', values: ['720p', '1280x720', '720x1280', 'small', 'std'] },
  { label: '1080P', values: ['1080p', '1920x1080', '1080x1920', 'large', 'pro'] },
] as const;

const VIDEO_STYLE_PRESETS = [
  {
    value: 'cinematic',
    label: '电影感',
    prompt: '电影级画面，专业运镜，戏剧性光影，宽画幅构图，胶片质感',
  },
  {
    value: 'anime',
    label: '动漫风',
    prompt: '日式动漫风格，赛璐璐上色，鲜艳色彩，动态姿势，速度线',
  },
  {
    value: 'commercial',
    label: '广告片',
    prompt: '商业广告风格，精致灯光，产品特写，高端质感，柔焦背景',
  },
  {
    value: 'documentary',
    label: '纪录片',
    prompt: '纪录片风格，自然光线，手持摄影，真实场景，纪实感',
  },
  {
    value: 'music-video',
    label: 'MV风格',
    prompt: '音乐录影带风格，快速剪辑，霓虹灯光，节奏感，视觉冲击',
  },
] as const;

const AI_VIDEO_MODE_TABS = [
  { id: 'text_to_video', label: '文生视频', generationMode: 'text_to_video' },
  {
    id: 'reference_all',
    label: '全能参考',
    generationMode: 'reference_to_video',
    referenceType: 'feature',
  },
  { id: 'image_to_video', label: '图生视频', generationMode: 'image_to_video' },
  { id: 'first_last_frame', label: '首尾帧', generationMode: 'first_last_frame' },
  {
    id: 'image_ref',
    label: '图片参考',
    generationMode: 'reference_to_video',
    referenceType: 'base',
  },
] as const;

type AIVideoModeTab = (typeof AI_VIDEO_MODE_TABS)[number];

const DEFAULT_VIDEO_NEGATIVE_PROMPT =
  '多手，手指不清晰，手部畸形，多余手指，缺失手指，融合手指，多余肢体，肢体畸形，人体结构错误，脸部变形，五官扭曲，低清晰度，模糊，噪点，画面撕裂，画面闪烁，闪烁抖动，变形，穿帮，水印，文字，logo，字幕，压缩痕迹, extra fingers, missing fingers, malformed hands, bad anatomy, distorted face, low quality, blurry, noisy, tearing, flickering, watermark, text, logo';

const INLINE_PARAM_FIELDS = new Set<VideoField>([
  'aspectRatio',
  'resolution',
  'duration',
  'generateAudio',
  'bgm',
]);
const HIDDEN_ADVANCED_FIELDS = new Set<VideoField>([
  'watermark',
  'wmPosition',
  'wmUrl',
  'callbackUrl',
]);
const booleanVideoFields = new Set<VideoField>([
  'promptEnhancer',
  'generateAudio',
  'bgm',
  'offPeak',
  'watermark',
  'returnLastFrame',
  'webSearch',
  'keepOriginalSound',
  'templateBgm',
]);
const textVideoFields = new Set<VideoField>([
  'wmUrl',
  'metaData',
  'callbackUrl',
  'payload',
  'templateStory',
  'templateName',
  'templateArea',
  'templateBeast',
  'videoUrl',
  'audioUrl',
]);
const shouldShowVideoField = (field: VideoField, params: Record<string, unknown>): boolean => {
  const templateMode = String(params.templateMode || 'standard');
  if (field === 'templateStory') return templateMode === 'template-story';
  if (
    field === 'templateName' ||
    field === 'templateArea' ||
    field === 'templateBeast' ||
    field === 'templateBgm'
  ) {
    return templateMode === 'template';
  }
  return true;
};
const IMAGE_SOURCE_NODE_TYPES = new Set([
  'aiImage',
  'imageInput',
  'imageGen',
  'unifiedImageStudio',
  'aicgImageGen',
  'gridDirector',
  'director3D',
  'scriptStoryboard',
  'gridSplitter',
  'imageCollage',
  'localMatting',
  'characterLibrary',
  'characterConsistency',
]);
const VIDEO_SOURCE_NODE_TYPES = new Set([
  'aiVideo',
  'videoInput',
  'videoGen',
  'advancedVideoGen',
  'aicgVideoGen',
  'videoCompose',
]);
const PROMPT_SOURCE_NODE_TYPES = new Set([
  'prompt',
  'aiGenText',
  'textInput',
  'script',
  'storyboardMaker',
  'gridDirector',
  'director3D',
]);

function asDataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function hasStringValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasStringArrayValue(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => hasStringValue(item));
}

function areShallowValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }
  return false;
}

function normalizeReferenceLabel(value: string): string {
  return (
    value
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .slice(0, 24) || '参考图'
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function appendReferenceImageParams(
  params: AIVideoParams,
  url: string,
  mode: VideoMode
): Partial<AIVideoParams> {
  if (mode === 'first_last_frame') {
    if (!hasStringValue(params.startImage)) {
      return { startImage: url, referenceImage: url };
    }
    if (!hasStringValue(params.endImage)) {
      return { endImage: url };
    }
  }

  const currentImages = Array.isArray(params.referenceImages)
    ? params.referenceImages.filter(hasStringValue)
    : [];
  const nextImages = Array.from(new Set([url, ...currentImages])).slice(0, 6);

  return {
    referenceImage: url,
    referenceImages: nextImages,
    ...(mode === 'text_to_video' ? { generationMode: 'reference_to_video' as VideoMode } : {}),
  };
}

function appendPromptReference(prompt: string, label: string): string {
  const token = `@${normalizeReferenceLabel(label)}`;
  return prompt.includes(token) ? prompt : `${prompt} ${token}`.trim();
}

function isPrimaryInputHandle(handle?: string | null): boolean {
  return !handle || handle === 'input' || handle === '';
}

function getConnectedImageUrl(
  edge: { source: string; sourceHandle?: string | null },
  nodes: Node<Record<string, unknown>>[]
): string {
  const sourceNode = nodes.find((node) => node.id === edge.source);
  if (!sourceNode) return '';
  const sourceData = asDataRecord(sourceNode.data);
  const task = asDataRecord(sourceData.task);
  return (
    resolveCharacterReferenceFromNodeData(sourceData, edge.sourceHandle || undefined) ||
    (hasStringValue(sourceData.outputImageUrl) ? String(sourceData.outputImageUrl) : '') ||
    (hasStringValue(sourceData.output) ? String(sourceData.output) : '') ||
    (hasStringValue(sourceData.gridImageUrl) ? String(sourceData.gridImageUrl) : '') ||
    (hasStringValue(sourceData.panoramaImageUrl) ? String(sourceData.panoramaImageUrl) : '') ||
    (hasStringValue(sourceData.imageUrl) ? String(sourceData.imageUrl) : '') ||
    (hasStringValue(sourceData.resultUrl) ? String(sourceData.resultUrl) : '') ||
    (hasStringValue(task.resultUrl) ? String(task.resultUrl) : '') ||
    ''
  );
}

function buildConnectedPromptReference(
  edge: { source: string; sourceHandle?: string | null },
  nodes: Node<Record<string, unknown>>[],
  role: PromptReferenceItem['role']
): PromptReferenceItem | null {
  const sourceNode = nodes.find((node) => node.id === edge.source);
  if (!sourceNode) return null;
  const sourceData = asDataRecord(sourceNode.data);
  const url = getConnectedImageUrl(edge, nodes);
  if (!url) return null;
  const baseLabel =
    String(sourceData.fileName || '') ||
    String(sourceData.label || '') ||
    String(sourceData.title || '') ||
    `素材-${sourceNode.id.slice(0, 6)}`;
  const normalizedLabel = normalizeReferenceLabel(baseLabel);
  return {
    id: `${sourceNode.id}-${role}`,
    label: normalizedLabel,
    url,
    source: baseLabel,
    token: `@${normalizedLabel}`,
    origin: 'canvas',
    previewUrl: url,
    role,
  };
}

function dedupeReferenceItems(items: PromptReferenceItem[]): PromptReferenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(`${item.role}:${item.url}`)) return false;
    seen.add(`${item.role}:${item.url}`);
    return true;
  });
}

function deriveReferencePatch(items: PromptReferenceItem[]): Partial<AIVideoParams> {
  const normalizedItems = dedupeReferenceItems(items);
  const characterRefs = normalizedItems
    .filter((item) => item.role === 'character')
    .map((item) => item.url);
  const startFrame = normalizedItems.find((item) => item.role === 'start')?.url;
  const endFrame = normalizedItems.find((item) => item.role === 'end')?.url;
  return {
    promptReferences: normalizedItems,
    referenceImages: characterRefs,
    referenceImage: characterRefs[0] || startFrame || '',
    startImage: startFrame,
    endImage: endFrame,
  };
}

function collectVideoResultUrls(data: AIVideoNodeData): string[] {
  const urls = [
    data.resultUrl,
    data.videoUrl,
    data.task?.resultUrl,
    ...(Array.isArray(data.resultUrls) ? data.resultUrls : []),
    ...(Array.isArray(data.task?.resultUrls) ? data.task.resultUrls : []),
  ].filter(hasStringValue) as string[];
  return Array.from(new Set(urls));
}

function normalizeVideoMode(mode: unknown): VideoMode {
  return normalizeOfficialVideoMode(mode);
}

/** 按模型能力呈现 480P / 720P / 1080P，并传递各渠道所需的精确枚举值。 */
function getDisplayedVideoResolutionOptions(model: AIVideoModelPreset) {
  return VIDEO_RESOLUTION_DISPLAY_GROUPS.flatMap((group) => {
    const value = group.values.find((candidate) => model.resolutions.includes(candidate));
    return value ? [{ value, label: group.label }] : [];
  });
}

function getVisibleVideoModel(modelId?: string): AIVideoModelPreset {
  if (!modelId) return DEFAULT_VIDEO_MODEL;
  const canonicalModelId = getVideoControllerCanonicalModelId(modelId);
  const directMatch = VIDEO_MODEL_PRESETS.find((item) => item.id === canonicalModelId);
  if (directMatch) return directMatch;

  const aliasMatch = getOfficialVideoModelCapabilityByAlias(modelId);
  if (!aliasMatch) return DEFAULT_VIDEO_MODEL;

  return VIDEO_MODEL_PRESETS.find((item) => item.id === aliasMatch.id) || DEFAULT_VIDEO_MODEL;
}

function isCustomUnifiedVideoModel(model: UnifiedModelConfig): boolean {
  return (
    model.modelInfo?.isCustomModel === true ||
    model.provider.toLowerCase().startsWith('custom-video-')
  );
}

function buildDynamicVideoModelPreset(model: UnifiedModelConfig): AIVideoModelPreset {
  const official = getOfficialVideoModelCapabilityByAlias(
    model.modelInfo?.providerModel || model.modelId
  );
  const isCustomModel = isCustomUnifiedVideoModel(model);
  // 运营后台可能只提供简化的动态模型描述。对已定义的官方能力合同，
  // 必须复用其比例、清晰度和时长列表，不能以通用的 5 秒默认值覆盖。
  if (official) {
    if (isCustomModel) {
      return {
        ...official,
        id: model.modelId,
        providerModel: model.modelInfo?.providerModel || model.modelId,
        provider: model.provider,
        label: model.modelInfo.name || official.label,
        badge: '自定义 · 已连接',
        isCustomModel: true,
        isBuiltIn: false,
        isPopular: model.modelInfo?.isPopular === true,
        isFeatured: false,
        isConfigured: model.isConfigured,
        isAvailable: model.isAvailable,
      };
    }
    return {
      ...official,
      providerModel: model.modelInfo?.providerModel || model.modelId,
      isBuiltIn: true,
      isPopular: model.modelInfo?.isPopular !== false,
      isFeatured: model.modelInfo?.tags?.some((tag) => /旗舰|推荐|热门/i.test(tag)) === true,
      isConfigured: model.isConfigured,
      isAvailable: model.isAvailable,
    };
  }
  const capabilities = (model.modelInfo?.capabilities || []).map((item) => item.toLowerCase());
  const supportsImage = capabilities.some(
    (item) => item.includes('image-to-video') || item.includes('image_to_video')
  );
  const modes: VideoMode[] = supportsImage
    ? ['text_to_video', 'image_to_video']
    : ['text_to_video'];
  const aspectRatios = model.modelInfo?.supportedAspectRatios?.length
    ? model.modelInfo.supportedAspectRatios
    : ['16:9', '9:16', '1:1'];
  const defaults = model.modelInfo?.defaultParams || {};
  return {
    id: model.modelId,
    provider: model.provider,
    label: model.modelInfo?.name || model.modelId,
    badge: isCustomModel ? '自定义 · 已连接' : '已连接',
    isCustomModel,
    modes,
    fields: ['aspectRatio', 'resolution', 'duration', 'promptEnhancer', 'watermark'],
    aspectRatios,
    resolutions: ['720p', '1080p'],
    durations: [5],
    defaults: {
      aspectRatio: aspectRatios[0] || '16:9',
      resolution: typeof defaults.resolution === 'string' ? defaults.resolution : '720p',
      duration: typeof defaults.duration === 'number' ? defaults.duration : 5,
      promptEnhancer: true,
    },
  };
}

function getCanonicalVideoModelId(modelId: string): string {
  const officialId = getOfficialVideoModelCapabilityByAlias(modelId)?.id || modelId;
  return getVideoControllerCanonicalModelId(officialId);
}

// 其他模型分组中无额度/密钥的模型暂时隐藏，保留接口以后启用。
const AI_VIDEO_HIDDEN_MODEL_IDS = new Set<string>([
  // 国产模型已配置 API 密钥，全部可见
  // kling 系列暂未在 ai-video.json 的 allowedProviders 中开启
]);

function groupVideoModelsByProvider(
  models: AIVideoModelPreset[]
): Array<{ label: string; options: AIVideoModelPreset[] }> {
  const groups = new Map<string, AIVideoModelPreset[]>();
  for (const model of models) {
    // 用户在 API 设置中添加的模型始终优先显示，避免被归入末尾的“其他模型”。
      const label =
      model.isCustomModel === true
        ? '自定义模型'
        : model.isBuiltIn === true
          ? '内置模型'
          : '其他模型';
    groups.set(label, [...(groups.get(label) || []), model]);
  }
  const order = ['自定义模型', '内置模型', '其他模型'];
  return Array.from(groups.entries())
    .map(([label, options]) => ({ label, options }))
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}
function getVideoModelShortLabel(model: AIVideoModelPreset): string {
  if (model.isCustomModel) return sanitizeProviderDisplayText(model.label);
  const baseLabel =
    model.id === 'doubao-seedance-1-5-pro'
      ? 'Seedance 1.5'
      : model.id === 'video_seedance'
        ? 'Seedance 2.0'
        : model.id === 'google_omni'
          ? 'Google Omni'
          : model.label.replace(/\s*[⭐💪🎯💰💡🎬].*$/u, '').trim();
  return sanitizeProviderDisplayText(baseLabel);
}

function getVideoModelMenuDescription(model: AIVideoModelPreset): string {
  const modeLabels = Array.from(new Set(model.modes.map((mode) => VIDEO_MODE_LABELS[mode])));
  return modeLabels.join(' · ') || sanitizeProviderDisplayText(model.label);
}

function getVideoModelMenuLabel(model: AIVideoModelPreset): string {
  const label = getVideoModelShortLabel(model)
    .replace(/\s*[（(]小天\d*[）)]\s*$/u, '')
    .trim();
  return /^V1\b/u.test(label) ? 'Seedance ' + label : label;
}

function getVideoModelMenuIdBadge(modelId: string): string {
  return getVideoModelIdBadge(modelId).replace(/^小天\d*[-_]/u, '');
}

const MODEL_ID_BADGE_MAP: Record<string, string> = {};

function getVideoModelIdBadge(modelId: string): string {
  return sanitizeProviderDisplayText(MODEL_ID_BADGE_MAP[modelId] || modelId);
}

function VideoModelIcon({ modelId, size = 20 }: { modelId: string; size?: number }) {
  const icon = getModelIconConfig(modelId);
  const isImageIcon = icon.icon.startsWith('/');
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08]"
      style={{
        width: size + 8,
        height: size + 8,
        backgroundColor: icon.bgColor,
        color: icon.color,
      }}
    >
      {isImageIcon ? (
        <img src={icon.icon} alt="" draggable={false} className="h-[70%] w-[70%] object-contain" />
      ) : (
        <span className="text-sm">{icon.icon}</span>
      )}
    </span>
  );
}

function defaultGenerateAudioForModel(model: AIVideoModelPreset): boolean {
  if (!model.fields.includes('generateAudio')) return false;
  const id = model.id.toLowerCase();
  const hasAudioSurcharge = id.includes('seedance-1-5-pro') || id.includes('seedance-1.5-pro') || id.includes('kling-3-0') || id.includes('kling-3.0');
  return !hasAudioSurcharge;
}
function normalizeParams(data: AIVideoNodeData, model: AIVideoModelPreset): AIVideoParams {
  const rawMode = data.params?.generationMode;
  const requestedModelId = String(data.modelId || data.params?.modelId || model.id);
  const incomingModelId = AI_VIDEO_HIDDEN_MODEL_IDS.has(requestedModelId)
    ? model.id
    : requestedModelId;
  const matchedModel = getVisibleVideoModel(incomingModelId);
  const provider = matchedModel.provider;
  const normalized = clampOfficialVideoParams(
    {
      ...matchedModel.defaults,
      ...(data.params || {}),
      generationMode: normalizeVideoMode(rawMode),
      prompt: String(data.prompt || data.params?.prompt || ''),
      negativePrompt: String(data.params?.negativePrompt || DEFAULT_VIDEO_NEGATIVE_PROMPT),
      generateAudio:
        typeof data.params?.generateAudio === 'boolean'
          ? data.params.generateAudio
          : defaultGenerateAudioForModel(matchedModel),
      audioGeneration:
        typeof data.params?.audioGeneration === 'string'
          ? data.params.audioGeneration
          : defaultGenerateAudioForModel(matchedModel)
            ? 'music'
            : 'none',
      modelId: matchedModel.id,
      modelProvider: provider,
      provider,
    },
    matchedModel
  );
  const displayedResolutions = getDisplayedVideoResolutionOptions(matchedModel);
  if (
    displayedResolutions.length > 0 &&
    !displayedResolutions.some((option) => option.value === normalized.resolution)
  ) {
    normalized.resolution = displayedResolutions[0].value;
  }

  return clampOfficialVideoParams(normalized, matchedModel) as AIVideoParams;
}

function getVideoReadinessIssue(
  mode: VideoMode,
  model: AIVideoModelPreset,
  params: AIVideoParams,
  inputState: VideoInputState
): string | null {
  if (!model.modes.includes(mode)) {
    return `${model.label} 不支持「${VIDEO_MODE_LABELS[mode]}」，请切换模型或生成模式`;
  }

  if (mode === 'text_to_video' && !String(params.prompt || '').trim() && !inputState.hasPrompt) {
    return '请先输入视频生成提示词';
  }

  if (mode === 'image_to_video' && !inputState.hasImage) {
    return '图生视频需要连接图片节点、首帧或参考图';
  }

  if (mode === 'first_last_frame' && !inputState.hasFirstFrame && !inputState.hasImage) {
    return '首尾帧模式需要连接首帧图片';
  }

  if (
    mode === 'reference_to_video' &&
    !inputState.hasReferenceImages &&
    !inputState.hasImage &&
    !inputState.hasVideo
  ) {
    return '全能参考需要连接图片或视频参考素材';
  }

  if (mode === 'video_to_video' && !inputState.hasVideo) {
    return '视频参考模式需要连接视频输入节点';
  }

  if (mode === 'digital_human' && !String(params.videoUrl || '').trim() && !inputState.hasVideo) {
    return '对口型模式需要输入人物视频地址（≥10秒）';
  }

  if (mode === 'subtitle' && !String(params.videoUrl || '').trim() && !inputState.hasVideo) {
    return '口播包装模式需要输入视频地址';
  }

  return null;
}

function AIVideoNode({ data, id, selected }: NodeProps) {
  const nodeData = data as AIVideoNodeData;
  // ✅ P3-1：仅订阅与本节点相关的边与节点，避免全量 nodes/edges 变更触发重渲染
  const canvasEdges = useCanvasStore(
    useShallow((state) => state.edges.filter((e) => e.target === id || e.source === id))
  );
  const canvasNodes = useCanvasStore(
    useShallow((state) => {
      const connectedIds = new Set<string>();
      for (const e of state.edges) {
        if (e.target === id) connectedIds.add(e.source);
        if (e.source === id) connectedIds.add(e.target);
      }
      return state.nodes.filter((n) => connectedIds.has(n.id));
    })
  );
  const { permissions } = usePermission();
  const membershipLevel = useMembershipStore((s) => s.membership?.membershipLevel || 'trial');
  const { models: unifiedVideoModels } = useNodeModels('aiVideo');
  const videoModels = useMemo(() => {
    // 官方模型限制在已开放渠道；用户自定义视频模型始终按独立 provider/model 保留。
    // 动态接口有时以别名重复返回官方模型，自定义模型则使用自己的唯一 ID，不参与官方去重。
    const allowedProviders = new Set(VIDEO_MODEL_PRESETS.map((item) => item.provider));
    const dynamic = unifiedVideoModels
      .filter((item) => {
        const provider = String(item.provider).toLowerCase();
        const isCustomModel = isCustomUnifiedVideoModel(item);
        return (
          (allowedProviders.has(provider) || isCustomModel) &&
          (isCustomModel ||
            Boolean(
              getOfficialVideoModelCapabilityByAlias(item.modelInfo?.providerModel || item.modelId)
            ))
        );
      })
      .map(buildDynamicVideoModelPreset);
    const knownIds = new Set(dynamic.map((item) => getCanonicalVideoModelId(item.id)));
    const fallback = VIDEO_MODEL_PRESETS.filter(
      (item) => !knownIds.has(getCanonicalVideoModelId(item.id))
    );
    const seen = new Set<string>();
    return [...dynamic, ...fallback]
      .filter((item) => {
        const canonicalId = getCanonicalVideoModelId(item.id);
        if (AI_VIDEO_HIDDEN_MODEL_IDS.has(canonicalId) || AI_VIDEO_HIDDEN_MODEL_IDS.has(item.id))
          return false;
        if (seen.has(canonicalId)) return false;
        seen.add(canonicalId);
        return true;
      })
      .sort((a, b) =>
        a.isCustomModel === true
          ? -1
          : b.isCustomModel === true
            ? 1
            : 0
      );
  }, [unifiedVideoModels]);
  const filteredVideoModels = useMemo(
    () =>
      videoModels.filter(
        (item) =>
          !getMembershipHiddenVideoModelIds(membershipLevel, videoModels).has(item.id)
      ),
    [membershipLevel, videoModels]
  );
  const groupedVideoModels = useMemo(
    () => groupVideoModelsByProvider(filteredVideoModels),
    [filteredVideoModels]
  );
  const requestedModelId = String(
    nodeData.modelId || nodeData.params?.modelId || 'doubao-seedance-2-0'
  );
  const canonicalRequestedModelId = getCanonicalVideoModelId(requestedModelId);
  const model =
    filteredVideoModels.find((item) => item.id === canonicalRequestedModelId) ||
    filteredVideoModels[0] ||
    getVisibleVideoModel('doubao-seedance-2-0');
  const params = useMemo(() => {
    const normalized = normalizeParams(nodeData, model);
    return {
      ...normalized,
      watermark: resolveWatermarkSetting(nodeData.params?.watermark, membershipLevel),
    } as AIVideoParams;
  }, [membershipLevel, model, nodeData]);
  const mode = (params.generationMode as VideoMode) || 'text_to_video';
  const [localPrompt, setLocalPrompt] = useState(String(params.prompt || ''));
  const visibleFields = model.fields.filter((field) => VIDEO_MODE_FIELDS[mode]?.includes(field));
  const advancedFields = visibleFields.filter(
    (field) =>
      !INLINE_PARAM_FIELDS.has(field) &&
      !HIDDEN_ADVANCED_FIELDS.has(field) &&
      shouldShowVideoField(field, params)
  );
  const ratioOptions = model.aspectRatios.map((value) => ({ value, label: value }));
  const resolutionOptions = getDisplayedVideoResolutionOptions(model);
  // 时长选项需根据当前分辨率过滤（XT 模型 1080p 仅支持 ≤10s）
  const allowedDurationsForCurrentResolution = getDurationsForResolution(
    model,
    String(params.resolution || '720p')
  );
  // 时长是渠道硬限制，不能为压缩界面而省略合法选项；全部按能力合同原样展示。
  const durationOptions = allowedDurationsForCurrentResolution.map((value) => ({
    value,
    label: `${value}s`,
  }));
  const showGenerateAudioToggle = visibleFields.includes('generateAudio');
  const showBgmToggle = visibleFields.includes('bgm');
  const isProcessing =
    nodeData.task?.status === 'pending' || nodeData.task?.status === 'processing';
  // 视频生成走云端长任务，最长允许跟踪 24 小时；终态或节点删除时自动释放
  const { isSubmitting, acquireLock, releaseLock } = useSubmitLock(nodeData, {
    nodeId: id as string,
    timeoutMs: 24 * 60 * 60 * 1000,
  });
  const [showModelPanel, setShowModelPanel] = useState(false);
  const [showParamPanel, setShowParamPanel] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [showCountPanel, setShowCountPanel] = useState(false);
  const [showReferencePanel, setShowReferencePanel] = useState(false);
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showCharacterLibrary, setShowCharacterLibrary] = useState(false);
  const [isOptionsCollapsed, setIsOptionsCollapsed] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [isTranslatingPrompt, setIsTranslatingPrompt] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const optimizeRequestVersionRef = useRef(0);
  const currentClipCount = params.clipCount ?? 1;
  const controllerModeTabs = useMemo(
    () => AI_VIDEO_MODE_TABS.filter((tab) => model.modes.includes(tab.generationMode as VideoMode)),
    [model]
  );
  const isCustomVideoModel =
    model.isCustomModel === true || model.provider.toLowerCase().startsWith('custom-video-');
  const openApiSettings = useCallback((provider?: string, modelId?: string) => {
    useAppPanelStore.getState().setSettingsOpen(true, 'api-config', {
      provider,
      model: modelId,
    });
  }, []);
  const resultUrls = useMemo(() => collectVideoResultUrls(nodeData), [nodeData]);
  const resultUrl = resultUrls[0] || '';
  const taskProgress = Math.min(100, Math.max(0, Math.round(Number(nodeData.task?.progress || 0))));
  const taskBackendId = (nodeData.task as { backendTaskId?: string } | undefined)?.backendTaskId;
  const progressStageLabel = !taskBackendId
    ? '提交任务到云端…'
    : taskProgress < 15
      ? '云端排队中，正在查询…'
      : taskProgress < 90
        ? '云端生成中，持续查询…'
        : '云端合成保存中…';
  const progressMilestones = [
    { label: '提交', threshold: 3 },
    { label: '排队', threshold: 15 },
    { label: '渲染', threshold: 55 },
    { label: '合成', threshold: 90 },
  ];
  const progressRingDegrees = Math.max(4, taskProgress * 3.6);
  const videoParamLabel = `${params.aspectRatio === 'adaptive' ? 'Auto' : params.aspectRatio || '16:9'} · ${String(params.resolution || '1080p').toUpperCase()} · ${params.duration || 5}s${params.generateAudio ? ' · 音频' : ''}`;

  useEffect(() => {
    setLocalPrompt(String(params.prompt || ''));
  }, [params.prompt]);

  const inputState = useMemo<VideoInputState>(() => {
    const incomingEdges = canvasEdges.filter((edge) => edge.target === id);
    let imageCount = 0;
    let videoCount = 0;
    let promptCount = 0;
    let hasFirstFrame = hasStringValue(params.startImage);
    let hasLastFrame = hasStringValue(params.endImage);
    let hasReferenceImages =
      hasStringValue(params.referenceImage) || hasStringArrayValue(params.referenceImages);

    incomingEdges.forEach((edge) => {
      const sourceNode = canvasNodes.find((node) => node.id === edge.source);
      const sourceData = asDataRecord(sourceNode?.data);
      const sourceType = String(sourceNode?.type || sourceData.type || '');
      const targetHandle = String(edge.targetHandle || '');

      const sourceHasImage =
        IMAGE_SOURCE_NODE_TYPES.has(sourceType) ||
        hasStringValue(sourceData.outputImageUrl) ||
        hasStringValue(sourceData.imageUrl) ||
        hasStringValue(sourceData.resultUrl) ||
        hasStringValue(sourceData.gridImageUrl) ||
        hasStringValue(sourceData.panoramaImageUrl) ||
        hasStringValue(sourceData.coverImageUrl) ||
        hasStringArrayValue(sourceData.resultUrls);
      const sourceHasVideo =
        VIDEO_SOURCE_NODE_TYPES.has(sourceType) ||
        hasStringValue(sourceData.videoUrl) ||
        hasStringValue(sourceData.resultUrl) ||
        hasStringArrayValue(sourceData.resultUrls);
      const sourceHasPrompt =
        PROMPT_SOURCE_NODE_TYPES.has(sourceType) ||
        hasStringValue(sourceData.prompt) ||
        hasStringValue(sourceData.outputText);

      if (targetHandle === 'prompt' || sourceHasPrompt) promptCount += 1;
      if (targetHandle === 'firstFrame') hasFirstFrame = true;
      if (targetHandle === 'lastFrame') hasLastFrame = true;
      if (targetHandle === 'referenceImage') hasReferenceImages = true;
      if (targetHandle === 'video' || sourceHasVideo) videoCount += 1;
      if (
        targetHandle === 'firstFrame' ||
        targetHandle === 'lastFrame' ||
        targetHandle === 'referenceImage' ||
        sourceHasImage
      ) {
        imageCount += 1;
      }
    });

    const hasVideo =
      videoCount > 0 ||
      hasStringValue(params.videoUrl) ||
      hasStringValue(params.videoReference) ||
      hasStringArrayValue(params.referenceVideos);
    const hasImage = imageCount > 0 || hasFirstFrame || hasLastFrame || hasReferenceImages;

    return {
      hasPrompt: promptCount > 0 || localPrompt.trim().length > 0,
      hasImage,
      hasReferenceImages: hasReferenceImages || imageCount > 1,
      hasVideo,
      hasFirstFrame: hasFirstFrame || imageCount > 0,
      hasLastFrame,
    };
  }, [
    canvasEdges,
    canvasNodes,
    id,
    localPrompt,
    params.endImage,
    params.referenceImage,
    params.referenceImages,
    params.referenceVideos,
    params.startImage,
    params.videoReference,
    params.videoUrl,
  ]);
  const pointsPerSecond = useMemo(
    () =>
      resolveVideoNodePointsPerSecond(
        getConfiguredVideoRate(model.id, String(params.resolution || '720p'), {
          hasVideoInput: inputState.hasVideo,
          generateAudio: Boolean(params.generateAudio) || (typeof params.audioGeneration === 'string' && params.audioGeneration !== 'none'),
          generationMode: mode,
        }) ?? calculateVideoPointsPerSecond(model.id, String(params.resolution || '720p')),
        isCustomVideoModel
      ),
    [inputState.hasVideo, isCustomVideoModel, mode, model.id, params.audioGeneration, params.generateAudio, params.resolution]
  );
  const expectedPoints = useMemo(
    () =>
      resolveVideoNodePoints(
        Math.ceil(
          (getConfiguredVideoRate(model.id, String(params.resolution || '720p'), {
            hasVideoInput: inputState.hasVideo,
            generateAudio:
              Boolean(params.generateAudio) ||
              (typeof params.audioGeneration === 'string' && params.audioGeneration !== 'none'),
            generationMode: mode,
          }) ?? calculateVideoPointsPerSecond(model.id, String(params.resolution || '720p'))) *
            Number(params.duration || 5)
        ),
        Number(params.duration || 5),
        isCustomVideoModel
      ) * currentClipCount,
    [
      currentClipCount,
      inputState.hasVideo,
      isCustomVideoModel,
      mode,
      model.id,
      params.audioGeneration,
      params.duration,
      params.generateAudio,
      params.resolution,
    ]
  );
  const paramsWithLocalPrompt = useMemo(
    () => ({ ...params, prompt: localPrompt }),
    [localPrompt, params]
  );
  const readinessIssue = useMemo(
    () => getVideoReadinessIssue(mode, model, paramsWithLocalPrompt, inputState),
    [inputState, mode, model, paramsWithLocalPrompt]
  );
  const isGenerationBlocked = params.autoValidateMaterial !== false && Boolean(readinessIssue);
  const referenceSummary = useMemo(() => {
    const parts: string[] = [];
    const referenceImageCount = Array.isArray(params.referenceImages)
      ? params.referenceImages.filter(hasStringValue).length
      : hasStringValue(params.referenceImage)
        ? 1
        : 0;
    const referenceVideoCount = Array.isArray(params.referenceVideos)
      ? params.referenceVideos.filter(hasStringValue).length
      : hasStringValue(params.videoUrl)
        ? 1
        : 0;

    if (inputState.hasFirstFrame) parts.push('首帧');
    if (inputState.hasLastFrame) parts.push('尾帧');
    if (referenceImageCount > 0) parts.push(`参考图 ${referenceImageCount}`);
    if (referenceVideoCount > 0 || inputState.hasVideo)
      parts.push(`视频参考 ${Math.max(referenceVideoCount, inputState.hasVideo ? 1 : 0)}`);
    return parts.length > 0 ? parts.join(' · ') : '暂无参考素材';
  }, [
    inputState.hasFirstFrame,
    inputState.hasLastFrame,
    inputState.hasVideo,
    params.referenceImage,
    params.referenceImages,
    params.referenceVideos,
    params.videoUrl,
  ]);

  const patchParams = useCallback(
    (patch: Record<string, unknown>, targetModel = model) => {
      const nextParams = clampOfficialVideoParams(
        { ...params, prompt: localPrompt, ...patch },
        targetModel
      );
      const hasParamChange = Object.keys(nextParams).some(
        (key) => !areShallowValuesEqual(nextParams[key], params[key])
      );
      const hasNodeChange =
        !Object.is(nextParams.modelId, nodeData.modelId) ||
        !Object.is(nextParams.prompt, nodeData.prompt);
      if (!hasParamChange && !hasNodeChange) return;

      canvasStoreApi.updateNodeData(id as string, {
        modelId: nextParams.modelId,
        prompt: nextParams.prompt,
        params: nextParams,
      });
    },
    [id, localPrompt, model, nodeData.modelId, nodeData.prompt, params]
  );

  const allInputImageEdges = useMemo(() => {
    const imageTargetHandles = new Set([
      'input',
      'referenceImage',
      'referenceImage1',
      'referenceImage2',
      'referenceImage3',
      'referenceImage4',
      'referenceImage5',
      'referenceImage6',
      'firstFrame',
      'lastFrame',
    ]);

    return canvasEdges
      .filter(
        (edge) => edge.target === id && imageTargetHandles.has(String(edge.targetHandle || 'input'))
      )
      .filter((edge) => {
        const sourceNode = canvasNodes.find((node) => node.id === edge.source);
        if (!sourceNode) return false;
        const sourceData = asDataRecord(sourceNode.data);
        const sourceType = String(sourceNode.type || sourceData.type || '');
        return (
          IMAGE_SOURCE_NODE_TYPES.has(sourceType) ||
          hasStringValue(sourceData.outputImageUrl) ||
          hasStringValue(sourceData.imageUrl) ||
          hasStringValue(sourceData.resultUrl) ||
          hasStringValue(sourceData.gridImageUrl) ||
          hasStringValue(sourceData.panoramaImageUrl) ||
          hasStringValue(sourceData.coverImageUrl) ||
          hasStringArrayValue(sourceData.resultUrls)
        );
      });
  }, [canvasEdges, canvasNodes, id]);

  const getEdgeRole = useCallback(
    (edge: Edge, index: number): 'start' | 'end' | 'reference' => {
      if (edge.targetHandle === 'firstFrame') return 'start';
      if (edge.targetHandle === 'lastFrame') return 'end';
      if (edge.targetHandle?.startsWith('referenceImage')) return 'reference';
      const userRole = params.edgeRoleMap?.[edge.id];
      if (userRole) return userRole;
      if (index === 0) return 'start';
      if (index === 1) return 'end';
      return 'reference';
    },
    [params.edgeRoleMap]
  );

  const connectedStoryboardPayload = useMemo(() => {
    const inputEdge = canvasEdges.find(
      (edge) => edge.target === id && isPrimaryInputHandle(edge.targetHandle)
    );
    if (!inputEdge) return null;
    const sourceNode = canvasNodes.find((node) => node.id === inputEdge.source);
    if (!sourceNode) return null;
    return parseStoryboardPayload(asDataRecord(sourceNode.data).storyboardPayload);
  }, [canvasEdges, canvasNodes, id]);

  const connectedCharacterPayload = useMemo(() => {
    const candidateEdge = canvasEdges.find(
      (edge) =>
        edge.target === id &&
        (isPrimaryInputHandle(edge.targetHandle) ||
          edge.targetHandle === 'referenceImage' ||
          edge.targetHandle === 'firstFrame' ||
          edge.targetHandle === 'lastFrame' ||
          edge.targetHandle === 'prompt')
    );
    if (!candidateEdge) return null;
    const sourceNode = canvasNodes.find((node) => node.id === candidateEdge.source);
    if (!sourceNode) return null;
    return getCharacterAssetPayloadFromNodeData(asDataRecord(sourceNode.data));
  }, [canvasEdges, canvasNodes, id]);

  const lastSyncedReferenceKey = useRef('');
  useEffect(() => {
    if (allInputImageEdges.length === 0) return;

    const connectedRefs = allInputImageEdges
      .map((edge, index) => {
        const role = getEdgeRole(edge, index);
        return buildConnectedPromptReference(
          edge,
          canvasNodes,
          role === 'reference' ? 'character' : role
        );
      })
      .filter(Boolean) as PromptReferenceItem[];

    if (connectedRefs.length === 0) return;
    const existingRefs = params.promptReferences ?? [];
    const mergedRefs = dedupeReferenceItems([
      ...existingRefs.filter(
        (item) => !connectedRefs.some((ref) => ref.role === item.role && ref.id === item.id)
      ),
      ...connectedRefs,
    ]);
    const syncKey = mergedRefs.map((item) => `${item.role}:${item.url}`).join('|');
    if (lastSyncedReferenceKey.current === syncKey) return;
    lastSyncedReferenceKey.current = syncKey;
    patchParams(deriveReferencePatch(mergedRefs));
  }, [allInputImageEdges, canvasNodes, getEdgeRole, params.promptReferences, patchParams]);

  useEffect(() => {
    if (!connectedStoryboardPayload) return;
    const resolved = resolveStoryboardSelection(connectedStoryboardPayload);
    const sequenceFrameUrls = resolved.sequenceFrames
      .map((frame) => frame.imageUrl)
      .filter(hasStringValue);
    const referenceImage =
      resolved.selectedFrame?.imageUrl ||
      connectedStoryboardPayload.coverImageUrl ||
      connectedStoryboardPayload.gridImageUrl ||
      '';
    patchParams({
      storyboardInputMode: resolved.mode,
      storyboardFrames: resolved.sequenceFrames,
      referenceImage,
      referenceImages: sequenceFrameUrls,
      startImage: sequenceFrameUrls[0] || referenceImage,
      endImage: sequenceFrameUrls[sequenceFrameUrls.length - 1] || '',
      generationMode: sequenceFrameUrls.length > 1 ? 'first_last_frame' : mode,
    });
  }, [connectedStoryboardPayload, mode, patchParams]);

  useEffect(() => {
    if (!connectedCharacterPayload) return;
    const nextPrompt = appendPromptSegment(localPrompt, connectedCharacterPayload.prompt);
    const nextNegativePrompt = appendPromptSegment(
      params.negativePrompt || '',
      connectedCharacterPayload.negativePrompt
    );
    if (nextPrompt !== localPrompt) setLocalPrompt(nextPrompt);
    patchParams({
      prompt: nextPrompt,
      negativePrompt: nextNegativePrompt,
      referenceImage: connectedCharacterPayload.primaryImage || params.referenceImage,
      referenceImages: Array.from(
        new Set(
          [connectedCharacterPayload.primaryImage, ...(params.referenceImages || [])].filter(
            hasStringValue
          )
        )
      ),
    });
  }, [
    connectedCharacterPayload,
    localPrompt,
    params.negativePrompt,
    params.referenceImage,
    params.referenceImages,
    patchParams,
  ]);

  const ensureImageInputsForMode = useCallback(
    (nextMode: VideoMode) => {
      const targetHandles =
        nextMode === 'first_last_frame' ? ['firstFrame', 'lastFrame'] : ['firstFrame'];
      const store = {
        nodes: canvasStoreApi.getNodes(),
        edges: canvasStoreApi.getEdges(),
      };
      const currentNode = store.nodes.find((node) => node.id === id);
      if (!currentNode) return;

      const existingTargetHandles = new Set(
        store.edges
          .filter(
            (edge) => edge.target === id && targetHandles.includes(String(edge.targetHandle || ''))
          )
          .map((edge) => String(edge.targetHandle || ''))
      );

      const missingHandles = targetHandles.filter((handle) => !existingTargetHandles.has(handle));
      if (missingHandles.length === 0) return;

      const imageDimensions = getCanvasNodeDimensions('aiImage');
      const startY =
        currentNode.position.y -
        ((missingHandles.length - 1) * (imageDimensions.height + CANVAS_NODE_VERTICAL_GAP)) / 2;
      const createdNodes: Node<Record<string, unknown>>[] = [];
      const createdEdges: Edge[] = [];

      missingHandles.forEach((targetHandle, index) => {
        const imageNodeId = generateId();
        const label = targetHandle === 'lastFrame' ? '尾帧图片' : '首帧图片';
        const imageNode: Node<Record<string, unknown>> = {
          id: imageNodeId,
          type: 'aiImage',
          position: {
            x: currentNode.position.x - imageDimensions.width - CANVAS_NODE_HORIZONTAL_GAP,
            y: startY + index * (imageDimensions.height + CANVAS_NODE_VERTICAL_GAP),
          },
          data: withCanvasNodeDefaultSize('aiImage', {
            type: 'aiImage',
            label,
            prompt: localPrompt,
            params: {
              prompt: localPrompt,
              mode: 'generate',
            },
          }),
        };
        createdNodes.push(imageNode);
        createdEdges.push({
          id: `edge-${imageNodeId}-${id}-${targetHandle}`,
          source: imageNodeId,
          target: id as string,
          sourceHandle: 'output',
          targetHandle,
          type: 'default',
        });
      });

      canvasStoreApi.setNodes([...store.nodes, ...createdNodes]);
      canvasStoreApi.setEdges([...store.edges, ...createdEdges]);
      toast.success(`已自动绑定 ${createdNodes.length} 个 AI 图片节点`);
    },
    [id, localPrompt]
  );

  const handleVideoModeShortcut = useCallback(
    (nextMode: VideoMode) => {
      patchParams({ generationMode: nextMode });
      if (nextMode !== 'text_to_video' && nextMode !== 'video_to_video') {
        ensureImageInputsForMode(nextMode);
      }
    },
    [ensureImageInputsForMode, patchParams]
  );

  const handleVideoModeTabShortcut = useCallback(
    (tab: AIVideoModeTab) => {
      const nextMode = tab.generationMode as VideoMode;
      patchParams({
        generationMode: nextMode,
        ...('referenceType' in tab && tab.referenceType
          ? { referenceType: tab.referenceType }
          : {}),
      });
      setShowParamPanel(false);
      setShowAdvancedPanel(false);
      setShowCountPanel(false);
      setShowReferencePanel(false);
    },
    [patchParams]
  );

  const isVideoModeTabActive = useCallback(
    (tab: AIVideoModeTab) => {
      if (tab.id === 'image_ref') {
        return mode === 'reference_to_video' && params.referenceType === 'base';
      }
      if (tab.id === 'reference_all') {
        return mode === 'reference_to_video' && params.referenceType !== 'base';
      }
      return mode === tab.generationMode;
    },
    [mode, params.referenceType]
  );

  const handleUpdatePromptReferenceRole = useCallback(
    (referenceId: string, role: PromptReferenceItem['role']) => {
      const nextReferences = (params.promptReferences ?? []).map((item) =>
        item.id === referenceId ? { ...item, role } : item
      );
      patchParams(deriveReferencePatch(nextReferences));
    },
    [params.promptReferences, patchParams]
  );

  const handleRemovePromptReference = useCallback(
    (reference: PromptReferenceItem) => {
      const nextReferences = (params.promptReferences ?? []).filter(
        (item) => item.url !== reference.url
      );
      const nextPrompt = localPrompt
        .replace(new RegExp(`${escapeRegExp(reference.token)}\\s*`, 'g'), '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      setLocalPrompt(nextPrompt);
      patchParams({
        prompt: nextPrompt,
        ...deriveReferencePatch(nextReferences),
      });
    },
    [localPrompt, params.promptReferences, patchParams]
  );

  const handleModelChange = (modelId: string) => {
    const nextModel =
      filteredVideoModels.find((item) => item.id === modelId) || filteredVideoModels[0];
    const nextMode = nextModel.modes.includes(mode) ? mode : nextModel.modes[0];
    patchParams(
      {
        ...nextModel.defaults,
        generateAudio: defaultGenerateAudioForModel(nextModel),
        audioGeneration: defaultGenerateAudioForModel(nextModel) ? 'music' : 'none',
        modelId: nextModel.id,
        modelProvider: nextModel.provider,
        provider: nextModel.provider,
        modelName: nextModel.label,
        generationMode: nextMode,
      },
      nextModel
    );
  };

  const handleOptimizePrompt = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const promptText = localPrompt.trim();
      if (!promptText || isOptimizingPrompt) return;

      const requestVersion = ++optimizeRequestVersionRef.current;
      setOptimizeError(null);
      setIsOptimizingPrompt(true);
      try {
        const quota = await checkQuotaOrFail('prompt', permissions);
        if (!quota.allowed) {
          toast.error(quota.message);
          return;
        }

        const agentCategory = classifyPromptAgent(promptText, 'video');
        const templateMatch = matchPromptTemplates(promptText, {
          modality: 'video',
          maxTemplates: 8,
        });
        const optimizationContext = [
          `目标视频模型：${model.label || model.id}（${model.id}）。请针对该模型的视频生成能力优化，不要改写成图片模型或其他视频模型的专属参数。`,
          `当前任务参数：生成模式 ${mode}，时长 ${Number(params.duration || 5)} 秒，画幅 ${String(params.aspectRatio || '16:9')}，分辨率 ${String(params.resolution || '720p')}。`,
          '这是 AI 视频生成专用优化。完整保留原有分类模板和专业优化能力，重点补全主体与动作、场景与环境变化、镜头与景别、时间顺序与节奏、光影与色调、情绪目标、视觉风格、角色和画面连续性。必须描述可随时间发生的动作、运镜或环境变化，不能输出只适用于单张静态图片的提示词结构。',
          templateMatch.context,
          '默认采用中国人物、建筑与场景语境；用户明确指定其他国家、文化或地域时，以用户要求为最高优先级。',
          '严禁输出“工笔画”“工笔”“水墨工笔”“宣纸肌理”等工笔画风格描述词。如需东方韵味，使用服饰、场景、色彩、布景、光影、构图和镜头语言表达。',
          '只输出一段可直接用于视频生成的最终中文提示词，不解释优化过程，不复述这些内部规则。',
        ]
          .filter(Boolean)
          .join('\n\n');
        const result = await promptOptimizerService.optimizePrompt(
          promptText,
          'video',
          agentCategory,
          [model.id],
          undefined,
          optimizationContext
        );
        if (requestVersion !== optimizeRequestVersionRef.current) {
          toast.info('视频提示词已修改，已忽略过期的优化结果');
          return;
        }
        if (!result.success || !result.optimizedPrompt) {
          throw new Error(result.error || '优化失败');
        }

        const optimizedPrompt = result.optimizedPrompt.trim();
        setLocalPrompt(optimizedPrompt);
        patchParams({ prompt: optimizedPrompt });
        const qualitySuffix = result.qualityReport?.overallScore
          ? ` · 质量 ${result.qualityReport.overallScore}分${result.qualityReport.selfRepaired ? ' · 已自检修复' : ''}`
          : '';
        toast.success(`视频提示词优化成功${qualitySuffix}`);
      } catch (error) {
        const msg = (error as Error).message || '优化服务异常';
        setOptimizeError(msg);
        toast.error(msg);
      } finally {
        setIsOptimizingPrompt(false);
      }
    },
    [
      isOptimizingPrompt,
      localPrompt,
      mode,
      model.id,
      model.label,
      params.aspectRatio,
      params.duration,
      params.resolution,
      patchParams,
      permissions,
    ]
  );

  const handleTranslatePrompt = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const text = localPrompt.trim();
      if (!text || isTranslatingPrompt) return;

      setIsTranslatingPrompt(true);
      try {
        const translated = await translatePromptToEnglish(text);
        setLocalPrompt(translated);
        patchParams({ prompt: translated });
        toast.success('已翻译为英文');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '翻译失败');
      } finally {
        setIsTranslatingPrompt(false);
      }
    },
    [isTranslatingPrompt, localPrompt, patchParams]
  );

  const handleUploadReference = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const isVideo = file.type.startsWith('video/');
        const persisted = await persistImportedCanvasFile({
          nodeId: id as string,
          kind: isVideo ? 'video' : 'image',
          file,
          role: 'source',
          source: 'imported',
        }).catch((error) => {
          console.warn('[AIVideoNode] 素材持久化失败，将使用运行时引用:', error);
          return null;
        });

        const runtimeUrl =
          persisted?.runtimeUrl ||
          (isVideo ? URL.createObjectURL(file) : await fileToDataUrl(file));

        if (!runtimeUrl) {
          toast.error('上传失败');
          return;
        }

        if (isVideo) {
          const referenceVideos = Array.from(
            new Set([
              runtimeUrl,
              ...(Array.isArray(params.referenceVideos)
                ? params.referenceVideos.filter(hasStringValue)
                : []),
            ])
          ).slice(0, 4);
          patchParams({
            videoUrl: runtimeUrl,
            referenceVideos,
            generationMode: mode === 'text_to_video' ? 'video_to_video' : mode,
          });
          toast.success('视频参考已添加');
          return;
        }

        const label = file.name.replace(/\.[^.]+$/, '') || '参考图';
        const nextPrompt = appendPromptReference(localPrompt, label);
        setLocalPrompt(nextPrompt);
        patchParams({
          ...appendReferenceImageParams(params, runtimeUrl, mode),
          prompt: nextPrompt,
        });
        toast.success('参考图已添加');
      } catch (error) {
        console.error('[AIVideoNode] 上传参考失败:', error);
        toast.error(error instanceof Error ? error.message : '上传失败');
      }
    };
    input.click();
  }, [id, localPrompt, mode, params, patchParams]);

  const handleSelectCharacterReference = useCallback(
    (character: CharacterLibraryItem) => {
      const referenceUrl = character.imageUrl || character.thumbnailUrl || character.outfitImageUrl;
      if (!referenceUrl) {
        toast.warning('这个角色没有可用参考图');
        return;
      }

      const label = character.name || '角色参考';
      const nextPrompt = appendPromptReference(localPrompt, label);
      setLocalPrompt(nextPrompt);
      patchParams({
        ...appendReferenceImageParams(params, referenceUrl, mode),
        prompt: nextPrompt,
        negativePrompt: params.negativePrompt || character.negativePrompt || '',
      });
      setShowCharacterLibrary(false);
      toast.success('角色参考已添加');
    },
    [localPrompt, mode, params, patchParams]
  );

  const handleExecuteVideo = useCallback(
    async (options?: { mockGeneration?: boolean }) => {
      if (isProcessing) return;
    if (model.isAvailable === false) {
      toast.warning('当前模型未配置密钥，请前往系统设置 → API配置匹配密钥');
      openApiSettings(model.provider, model.providerModel || model.id);
      return;
    }
      // 同一视频节点生成中不允许重复提交，最长 24 小时跟踪云端任务
      if (!acquireLock()) return;
      const prompt = localPrompt.trim();
      const executeParams = { ...params, prompt };
      const issue = getVideoReadinessIssue(mode, model, executeParams, inputState);
      if (issue && params.autoValidateMaterial !== false) {
        toast.warning(issue);
        releaseLock();
        return;
      }
      const generationRequestId = `video:${id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      const executionModelId = resolveVideoControllerRouteId(model.id, mode);
      canvasStoreApi.updateNodeData(id as string, {
        modelId: executionModelId,
        prompt,
        task: undefined,
        error: undefined,
        params: {
          ...params,
          prompt,
          ...(options?.mockGeneration ? { mockGeneration: true } : {}),
          idempotencyKey: generationRequestId,
          modelId: executionModelId,
          modelProvider: model.provider,
          provider: model.provider,
          modelName: model.label,
          generationMode: mode,
          preparedAt: new Date().toISOString(),
        },
      });
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id } }));
      }, 0);
      // ✅ 锁会在 task.status 变为终态时由 useSubmitLock 内部逻辑自动释放
      // useSubmitLock 也会在节点删除时通过 nodeTaskRegistry 自动释放
    },
    [id, inputState, isProcessing, localPrompt, mode, model, params, acquireLock, releaseLock, openApiSettings]
  );

  const handlePromptKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing || event.key === 'Process') return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        event.currentTarget.select();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleExecuteVideo();
      }
    },
    [handleExecuteVideo]
  );

  const handlePreviewPlayToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const handlePreviewFullscreen = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await video.requestFullscreen();
      }
    } catch {
      toast.error('当前浏览器无法放大视频预览');
    }
  }, []);

  return (
    <div
      className="group relative select-none"
      style={{ width: CANVAS_NODE_BASE_WIDTH }}
      data-mimomi-node-id={id as string}
      data-mimomi-node-type="aiVideo"
      data-mimomi-panel="ai-video-node"
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="aiVideo"
        inputId="input"
        outputId="output"
        extraInputs={[
          'prompt',
          'firstFrame',
          'lastFrame',
          'referenceImage',
          'referenceImage1',
          'referenceImage2',
          'referenceImage3',
          'referenceImage4',
          'referenceImage5',
          'referenceImage6',
          'video',
        ]}
        extraOutputs={['video']}
        inputTip="提示词 / 图片 / 视频参考"
        outputTip="视频输出"
      />

      <AICGNodeTopCornerActions onDelete={() => canvasStoreApi.deleteNode(id as string)} />

      <div
        className={cn(
          'drag-handle relative cursor-grab overflow-hidden rounded-[10px] border bg-[#101012] active:cursor-grabbing',
          selected
            ? 'border-white/58 shadow-[0_18px_46px_rgba(0,0,0,0.46)]'
            : 'border-white/35 shadow-[0_14px_34px_rgba(0,0,0,0.32)]'
        )}
        style={{ height: AI_VIDEO_PREVIEW_HEIGHT }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setIsOptionsCollapsed((value) => !value);
          setShowParamPanel(false);
          setShowAdvancedPanel(false);
          setShowCountPanel(false);
          setShowReferencePanel(false);
          setShowNegativePrompt(false);
        }}
        title="双击隐藏/显示下方选项"
      >
        {!resultUrl ? (
          <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 text-[11px] font-semibold text-white/72">
            <Clapperboard className="h-3.5 w-3.5" />
            <span>{nodeData.label || 'AI视频'}</span>
          </div>
        ) : null}
        {resultUrl ? (
          <video
            ref={videoRef}
            src={normalizeMediaUrl(resultUrl)}
            poster={normalizeMediaUrl(nodeData.thumbnailUrl)}
            className="h-full w-full object-contain"
            onClick={handlePreviewPlayToggle}
            onPlay={() => setIsPreviewPlaying(true)}
            onPause={() => setIsPreviewPlaying(false)}
            onEnded={() => setIsPreviewPlaying(false)}
            playsInline
          />
        ) : null}
        {resultUrl && !isProcessing ? (
          <>
            <button
              type="button"
              className="nodrag nowheel absolute bottom-3 left-1/2 z-30 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-[0_8px_24px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handlePreviewPlayToggle();
              }}
              aria-label={isPreviewPlaying ? '暂停视频' : '播放视频'}
              title={isPreviewPlaying ? '暂停' : '播放'}
            >
              {isPreviewPlaying ? (
                <Pause className="h-[18px] w-[18px] fill-current" />
              ) : (
                <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />
              )}
            </button>
            <button
              type="button"
              className="nodrag nowheel absolute bottom-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-black/65 text-white/90 shadow-[0_8px_20px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:bg-black/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={handlePreviewFullscreen}
              aria-label="放大视频"
              title="全屏预览"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </>
        ) : null}
        {isProcessing ? (
          <div className="absolute inset-0 z-20 overflow-hidden bg-[#07070d]/82 backdrop-blur-md">
            <div className="absolute -left-14 -top-16 h-40 w-40 rounded-full bg-white/[0.08] blur-3xl animate-pulse" />
            <div className="absolute -right-12 top-7 h-36 w-36 rounded-full bg-white/[0.06] blur-3xl animate-pulse [animation-delay:450ms]" />
            <div className="absolute bottom-[-54px] left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-white/[0.05] blur-3xl animate-pulse [animation-delay:900ms]" />
            <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <div
                className="relative mb-4 flex h-24 w-24 items-center justify-center rounded-full shadow-[0_0_40px_rgba(255,255,255,0.12)]"
                style={{
                  background: `conic-gradient(from 210deg, rgba(255,255,255,0.86) 0deg, rgba(255,255,255,0.72) ${Math.min(progressRingDegrees, 180)}deg, rgba(255,255,255,0.5) ${progressRingDegrees}deg, rgba(255,255,255,0.12) ${progressRingDegrees}deg 360deg)`,
                }}
              >
                <div className="absolute inset-1 rounded-full bg-black/45 blur-[1px]" />
                <div className="absolute h-[76px] w-[76px] rounded-full bg-[#101018]/92 shadow-[inset_0_0_22px_rgba(255,255,255,0.08)]" />
                <div className="absolute inset-0 rounded-full border border-white/18" />
                <div className="relative flex flex-col items-center leading-none">
                  <span className="text-[26px] font-black tracking-tight text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.18)]">
                    {taskProgress}
                  </span>
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/44">
                    percent
                  </span>
                </div>
              </div>

              <div className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[12px] font-semibold text-white/86 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                {progressStageLabel}
              </div>

              <div className="mt-4 w-full max-w-[260px]">
                <div className="relative h-3 overflow-hidden rounded-full border border-white/12 bg-black/45 shadow-[inset_0_0_12px_rgba(0,0,0,0.45)]">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.22)_0,transparent_38%,rgba(255,255,255,0.18)_66%,transparent_100%)] bg-[length:46px_100%] animate-[ai-video-progress-shimmer_1.1s_linear_infinite]" />
                  <div
                    className="relative h-full rounded-full shadow-[0_0_22px_rgba(255,255,255,0.18)] transition-all duration-700 ease-out"
                    style={{
                      width: `${taskProgress}%`,
                      background:
                        'linear-gradient(90deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.88) 54%, rgba(255,255,255,0.62) 100%)',
                    }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {progressMilestones.map((item) => {
                    const active = taskProgress >= item.threshold;
                    return (
                      <div key={item.label} className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            'h-1.5 w-full rounded-full transition-all duration-500',
                            active
                              ? 'bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.18)]'
                              : 'bg-white/12'
                          )}
                        />
                        <span
                          className={cn(
                            'text-[9px] transition-colors',
                            active ? 'text-white/76' : 'text-white/28'
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {(() => {
                const startedAt = (
                  nodeData.task as { startedAt?: string | number | Date } | undefined
                )?.startedAt;
                if (!startedAt) return null;
                const elapsedSec = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
                const progress = nodeData.task?.progress || 0;
                if (progress < 5 || elapsedSec < 3) return null;
                const estimatedTotal = Math.round(elapsedSec / (progress / 100));
                const remaining = Math.max(0, estimatedTotal - elapsedSec);
                if (remaining < 1) return null;
                const min = Math.floor(remaining / 60);
                const sec = remaining % 60;
                return (
                  <div className="mt-1 text-[9px] text-white/30">
                    预计剩余 {min > 0 ? `${min}分${sec}秒` : `${sec}秒`}
                  </div>
                );
              })()}
              {resultUrls.length > 0 && (
                <div className="mt-2 text-[9px] text-white/25">
                  已完成 {resultUrls.length} 个片段
                </div>
              )}
            </div>
          </div>
        ) : null}
        {!resultUrl ? (
          <div className="absolute left-7 top-[50%] -translate-y-[18%] space-y-3 text-[12px] text-white/72">
            <div className="text-white/42">尝试:</div>
            <button
              type="button"
              className="nodrag nowheel flex items-center gap-2 font-semibold text-white/84 transition-colors hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                handleVideoModeShortcut('first_last_frame');
              }}
            >
              <Film className="h-4 w-4" />
              首尾帧生成视频
            </button>
            <button
              type="button"
              className="nodrag nowheel flex items-center gap-2 font-semibold text-white/84 transition-colors hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                handleVideoModeShortcut('image_to_video');
              }}
            >
              <Upload className="h-4 w-4" />
              首帧生成视频
            </button>
            <button
              type="button"
              className="nodrag nowheel flex items-center gap-2 font-semibold text-white/84 transition-colors hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                handleUploadReference();
              }}
            >
              <Upload className="h-4 w-4" />
              上传参考
            </button>
          </div>
        ) : null}
      </div>

      {!isOptionsCollapsed ? (
        <>
          <div className="mt-3 rounded-[10px] border border-white/16 bg-[#101012] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.34)]">
            <div className="mb-3 flex flex-wrap gap-1.5 border-b border-white/[0.08] pb-2">
              {controllerModeTabs.map((tab) => (
                <Fragment key={tab.id}>
                  <button
                    type="button"
                    className={cn(
                      'nodrag nowheel rounded-md border px-2.5 py-1 text-[12px] transition-colors',
                      isVideoModeTabActive(tab)
                        ? 'border-white/[0.45] bg-white/10 text-white'
                        : 'border-white/[0.16] text-white/50 hover:border-white/[0.32] hover:text-white/80'
                    )}
                    title={VIDEO_MODE_HELP[tab.generationMode as VideoMode]}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleVideoModeTabShortcut(tab);
                    }}
                  >
                    {tab.label}
                  </button>
                </Fragment>
              ))}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowNegativePrompt((value) => !value);
                }}
                className={cn(
                  'nodrag nowheel flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-colors',
                  showNegativePrompt || String(params.negativePrompt || '').trim()
                    ? 'border-white/30 bg-white/[0.08] text-white/82'
                    : 'border-white/[0.12] bg-white/[0.03] text-white/46 hover:border-white/24 hover:text-white/72'
                )}
                title="展开反向提示词"
              >
                <X className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">反向</span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-white/40 transition-transform',
                    showNegativePrompt && 'rotate-180'
                  )}
                />
              </button>
            </div>

            {readinessIssue ? (
              <div className="mb-2 rounded-lg border border-white/14 bg-[#151515] px-2.5 py-1.5 text-[10px] leading-4 text-white/72">
                {readinessIssue}
                {params.autoValidateMaterial === false ? (
                  <span className="ml-1 text-white/45">已允许尝试生成</span>
                ) : null}
              </div>
            ) : null}

            {(mode === 'digital_human' || mode === 'subtitle') && (
              <div className="nodrag nowheel mb-2 space-y-2 rounded-lg border border-white/[0.08] bg-[#151515] px-2.5 py-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] text-white/45">视频地址（必填）</span>
                  <input
                    value={String(params.videoUrl ?? '')}
                    onChange={(event) => patchParams({ videoUrl: event.target.value })}
                    placeholder="https://...mp4"
                    className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
                  />
                </label>
                {mode === 'digital_human' && (
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-white/45">
                      音频地址（可选，与视频二选一）
                    </span>
                    <input
                      value={String(params.audioUrl ?? '')}
                      onChange={(event) => patchParams({ audioUrl: event.target.value })}
                      placeholder="https://...mp3"
                      className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
                    />
                  </label>
                )}
                {mode === 'subtitle' && (
                  <label className="block">
                    <span className="mb-1 block text-[10px] text-white/45">模板ID（1-30）</span>
                    <select
                      value={String(params.templateId ?? 1)}
                      onChange={(event) => patchParams({ templateId: Number(event.target.value) })}
                      className="w-full bg-transparent text-[12px] text-white outline-none"
                    >
                      {Array.from({ length: 30 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          模板 {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            <div className="relative mb-2 flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#151515] px-2.5 py-1.5 text-[10px]">
              <span className="min-w-0 truncate text-white/48">参考素材：{referenceSummary}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowReferencePanel((value) => !value);
                    setShowParamPanel(false);
                    setShowAdvancedPanel(false);
                    setShowCountPanel(false);
                  }}
                  className={cn(
                    'nodrag nowheel rounded-md border px-2 py-0.5 transition-all',
                    showReferencePanel
                      ? 'border-white/30 bg-white/[0.08] text-white/82'
                      : 'border-white/[0.12] bg-white/[0.03] text-white/52 hover:border-white/24 hover:text-white/76'
                  )}
                  title="管理连线素材角色与提示词引用"
                >
                  引用
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    patchParams({ autoValidateMaterial: params.autoValidateMaterial === false });
                  }}
                  className={cn(
                    'nodrag nowheel rounded-md border px-2 py-0.5 transition-all',
                    params.autoValidateMaterial !== false
                      ? 'border-white/24 bg-white/[0.08] text-white/82'
                      : 'border-white/16 bg-[#151515] text-white/58'
                  )}
                  title={
                    params.autoValidateMaterial !== false
                      ? '当前会阻断缺素材生成'
                      : '当前允许缺素材时仍尝试生成'
                  }
                >
                  {params.autoValidateMaterial !== false ? '素材校验' : '允许尝试'}
                </button>
              </div>
              {showReferencePanel ? (
                <div
                  className="nodrag nowheel absolute right-0 top-[calc(100%+6px)] z-30 w-[300px] rounded-xl border border-white/10 bg-[#151515] p-3 text-[10px] shadow-2xl"
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onWheelCapture={(event) => event.stopPropagation()}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-white/80">引用素材</span>
                    <span className="text-white/35">{allInputImageEdges.length} 条连线</span>
                  </div>

                  {allInputImageEdges.length > 0 ? (
                    <div className="mb-2 space-y-1.5">
                      {allInputImageEdges.map((edge, index) => {
                        const role = getEdgeRole(edge, index);
                        const sourceNode = canvasNodes.find((node) => node.id === edge.source);
                        const sourceData = asDataRecord(sourceNode?.data);
                        const url = getConnectedImageUrl(edge, canvasNodes);
                        const label = String(
                          sourceData.label ||
                            sourceData.title ||
                            sourceNode?.id?.slice(0, 6) ||
                            '素材'
                        );
                        return (
                          <div
                            key={edge.id}
                            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5"
                          >
                            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                              {url ? (
                                <img
                                  src={normalizeMediaUrl(url)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-white/62">{label}</span>
                            <select
                              value={role}
                              onChange={(event) => {
                                const nextRole = event.target.value as
                                  | 'start'
                                  | 'end'
                                  | 'reference';
                                const nextTargetHandle =
                                  nextRole === 'start'
                                    ? 'firstFrame'
                                    : nextRole === 'end'
                                      ? 'lastFrame'
                                      : 'referenceImage';
                                canvasStoreApi.setEdges(
                                  canvasStoreApi
                                    .getEdges()
                                    .map((candidate) =>
                                      candidate.id === edge.id
                                        ? { ...candidate, targetHandle: nextTargetHandle }
                                        : candidate
                                    )
                                );
                                patchParams({
                                  edgeRoleMap: {
                                    ...(params.edgeRoleMap || {}),
                                    [edge.id]: nextRole,
                                  },
                                });
                              }}
                              className="h-7 rounded-md border border-white/10 bg-[#101010] px-1.5 text-[9px] text-white/78 outline-none"
                            >
                              <option value="start">首帧</option>
                              <option value="end">尾帧</option>
                              <option value="reference">参考图</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mb-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-white/42">
                      暂无图片连线，可先连接图片节点或上传参考。
                    </div>
                  )}

                  {(params.promptReferences?.length ?? 0) > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-white/42">提示词引用</div>
                      {(params.promptReferences ?? []).map((reference) => (
                        <div
                          key={reference.id}
                          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5"
                        >
                          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
                            {reference.previewUrl || reference.url ? (
                              <img
                                src={normalizeMediaUrl(reference.previewUrl || reference.url)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-white/64">
                            {reference.label}
                          </span>
                          <select
                            value={reference.role}
                            onChange={(event) =>
                              handleUpdatePromptReferenceRole(
                                reference.id,
                                event.target.value as PromptReferenceItem['role']
                              )
                            }
                            className="h-7 rounded-md border border-white/10 bg-[#101010] px-1.5 text-[9px] text-white/78 outline-none"
                          >
                            <option value="start">首帧</option>
                            <option value="end">尾帧</option>
                            <option value="character">参考</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemovePromptReference(reference)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-red-500/15 hover:text-red-300"
                            title="移除引用"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <AICGNodePromptBar
              nodeId={id as string}
              value={localPrompt}
              rows={4}
              onChange={(value) => {
                optimizeRequestVersionRef.current += 1;
                setOptimizeError(null);
                setLocalPrompt(value);
              }}
              onBlur={(event) => {
                event.stopPropagation();
                patchParams({ prompt: localPrompt });
              }}
              onKeyDownCapture={handlePromptKeyDown}
              onKeyDown={(event) => event.stopPropagation()}
              onKeyUp={(event) => event.stopPropagation()}
              onCopyCapture={(event) => event.stopPropagation()}
              onCutCapture={(event) => event.stopPropagation()}
              onPasteCapture={(event) => event.stopPropagation()}
              onPaste={(event) => event.stopPropagation()}
              onInput={(event) => event.stopPropagation()}
              onBeforeInput={(event) => event.stopPropagation()}
              onCompositionStart={() => undefined}
              onCompositionEnd={(event) => event.stopPropagation()}
              disabled={isProcessing || isSubmitting}
              placeholder="描述镜头、主体动作、运镜、光线与情绪，输入 @ 引用画布素材"
              className="nodrag nowheel mb-2"
              textareaClassName="min-h-[104px] text-[13px] leading-6 placeholder:text-white/38 pb-10"
              inputOverlay={
                <>
                  <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-[9px] text-white/34">
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                        @ 引用素材
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                        镜头 / 动作 / 光线
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <NodePointsBadge
                        points={resolveVideoNodePoints(
                          pointsConfigService.getVideoPoints(
                            model.id,
                            Number(params.duration || 5),
                            String(params.resolution || '720p')
                          ),
                          Number(params.duration || 5),
                          isCustomVideoModel
                        )}
                        className="pointer-events-none"
                      />
                      <button
                        type="button"
                        onClick={handleTranslatePrompt}
                        onMouseDown={(event) => event.stopPropagation()}
                        disabled={isTranslatingPrompt || !localPrompt.trim()}
                        title="翻译为英文"
                        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/50 transition-colors backdrop-blur-md hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {isTranslatingPrompt ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Languages className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleOptimizePrompt}
                        onMouseDown={(event) => event.stopPropagation()}
                        disabled={isOptimizingPrompt || !localPrompt.trim()}
                        title={
                          optimizeError ||
                          '视频专用优化：主体动作、场景变化、运镜景别、时间节奏、光影情绪与连续性'
                        }
                        aria-label={
                          isOptimizingPrompt
                            ? '正在优化视频提示词'
                            : optimizeError
                              ? `视频提示词优化失败：${optimizeError}，点击重试`
                              : '视频专用提示词优化'
                        }
                        className={cn(
                          'pointer-events-auto flex h-7 min-w-[90px] items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors backdrop-blur-md',
                          isOptimizingPrompt || !localPrompt.trim()
                            ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/35'
                            : optimizeError
                              ? 'border-red-300/40 bg-red-500/80 text-white hover:bg-red-400'
                              : 'border-white/18 bg-white/[0.08] text-white hover:border-white/30 hover:bg-white/[0.12]'
                        )}
                      >
                        {isOptimizingPrompt ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="h-3.5 w-3.5" />
                        )}
                        <span>{isOptimizingPrompt ? '优化中' : '视频优化'}</span>
                      </button>
                    </div>
                  </div>
                </>
              }
            />

            {showNegativePrompt ? (
              <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2">
                <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/46">
                  <span>不想出现的画面元素</span>
                  {String(params.negativePrompt || '').trim() ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        patchParams({ negativePrompt: '' });
                      }}
                      className="nodrag nowheel rounded-md p-0.5 text-white/35 hover:bg-white/[0.06] hover:text-white/70"
                      title="清空反向提示词"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={String(params.negativePrompt || DEFAULT_VIDEO_NEGATIVE_PROMPT)}
                  onChange={(event) => {
                    event.stopPropagation();
                    patchParams({ negativePrompt: event.target.value });
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  onKeyUp={(event) => event.stopPropagation()}
                  onInput={(event) => event.stopPropagation()}
                  onBeforeInput={(event) => event.stopPropagation()}
                  onCompositionStart={(event) => event.stopPropagation()}
                  onCompositionEnd={(event) => event.stopPropagation()}
                  onPointerDownCapture={(event) => event.stopPropagation()}
                  onMouseDownCapture={(event) => event.stopPropagation()}
                  placeholder="例如：低清晰度、畸形、闪烁、文字水印"
                  className="nodrag nowheel h-14 w-full resize-none bg-transparent text-[12px] leading-5 text-white/82 outline-none placeholder:text-white/28 select-text"
                />
              </div>
            ) : null}

            <div className="flex flex-nowrap items-center gap-1.5 border-t border-white/[0.08] pt-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    title={model.label}
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowModelPanel((value) => !value);
                      setShowParamPanel(false);
                      setShowAdvancedPanel(false);
                      setShowCountPanel(false);
                    }}
                    className={cn(
                      'nodrag nowheel flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border px-2 text-left transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.18)]',
                      showModelPanel
                        ? 'border-white/24 bg-white/[0.1]'
                        : 'border-white/14 bg-white/[0.055] hover:border-white/24 hover:bg-white/[0.09]'
                    )}
                  >
                    <VideoModelIcon modelId={model.id} size={18} />
                    <span className="min-w-0 flex flex-1 flex-col leading-none">
                      <span className="truncate text-[11px] font-bold text-white/90">
                        {getVideoModelShortLabel(model)}
                      </span>
                      <span className="mt-0.5 truncate text-[8px] text-white/45">
                        {getVideoModelIdBadge(model.id)}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-white/55 transition-transform',
                        showModelPanel && 'rotate-180'
                      )}
                    />
                  </button>

                  {showModelPanel ? (
                    <div
                      className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-[300px] overflow-hidden rounded-2xl border border-white/12 bg-[#101012] p-1.5 shadow-2xl"
                      onWheelCapture={(event) => event.stopPropagation()}
                      onPointerDownCapture={(event) => event.stopPropagation()}
                    >
                      <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/42">
                        视频模型
                      </div>
                      <div className="max-h-[286px] space-y-1 overflow-y-auto nowheel">
                        {groupedVideoModels.map((group) => (
                          <div key={group.label} className="space-y-1.5">
                            <div className="px-2 pt-1 text-[10px] font-semibold text-white/45">
                              {group.label}
                            </div>
                            {group.options.map((item) => {
                              const configured = item.isAvailable === true;
                              const statusLabel = configured ? '已配置' : '未配置密钥';
                              const active = model.id === item.id && model.provider === item.provider;
                              return (
                              <div
                                key={`${item.provider}:${item.id}`}
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleModelChange(item.id);
                                  setShowModelPanel(false);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleModelChange(item.id);
                                    setShowModelPanel(false);
                                  }
                                }}
                                className={cn(
                                  'nodrag nowheel flex w-full items-center gap-2.5 rounded-xl bg-white/[0.045] px-2.5 py-2 text-left transition-all hover:bg-white/[0.1]',
                                  active &&
                                    'bg-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
                                )}
                              >
                                <VideoModelIcon modelId={item.id} size={20} />
                                <span className="min-w-0 flex flex-1 flex-col leading-none">
                                  <span className="truncate text-[11px] font-bold text-white/92">
                                    {getVideoModelMenuLabel(item)}
                                  </span>
                                  <span className="mt-1 truncate text-[9px] text-white/55">
                                    {getVideoModelMenuDescription(item)}
                                  </span>
                                  <span className="mt-0.5 truncate text-[8px] text-white/35">
                                    {getVideoModelMenuIdBadge(item.id)}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1">
                                  <span className={cn(
                                    'rounded px-1 py-0.5 text-[8px]',
                                    configured ? 'bg-emerald-300/10 text-emerald-200/80' : 'bg-amber-300/10 text-amber-200/90'
                                  )}>
                                    {statusLabel}
                                  </span>
                                  {!configured ? (
                                    <button
                                      type="button"
                                      className="rounded p-0.5 text-amber-200/80 hover:bg-white/10 hover:text-white"
                                      title="前往系统设置 → API配置匹配密钥"
                                      aria-label={`为${getVideoModelMenuLabel(item)}匹配密钥`}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openApiSettings(item.provider, item.providerModel || item.id);
                                      }}
                                    >
                                      <Settings2 className="h-3 w-3" />
                                    </button>
                                  ) : null}
                                  {active ? (
                                    <span className="h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.75)]" />
                                  ) : null}
                                </span>
                              </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative min-w-[120px] flex-1">
                  <button
                    type="button"
                    title="视频参数"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowParamPanel((value) => !value);
                      setShowAdvancedPanel(false);
                      setShowCountPanel(false);
                    }}
                    className={cn(
                      'nodrag nowheel flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-[10px] text-white/80 transition-all hover:border-white/20 hover:bg-white/[0.07]',
                      showParamPanel && 'bg-white/10 text-white'
                    )}
                  >
                    <span className="truncate">{videoParamLabel}</span>
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 shrink-0', showParamPanel && 'rotate-180')}
                    />
                  </button>

                  {showParamPanel ? (
                    <div
                      className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-[292px] rounded-xl border border-white/10 bg-[#161616] p-3 shadow-2xl"
                      onWheelCapture={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-white/80">视频参数</span>
                        <span className="text-[9px] text-white/35">比例 · 清晰度 · 时长</span>
                      </div>
                      <div className="mt-3 space-y-3">
                        <div>
                          <div className="mb-1.5 text-[9px] text-white/45">比例</div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {ratioOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => patchParams({ aspectRatio: option.value })}
                                className={cn(
                                  'nodrag nowheel h-7 rounded-md border px-2 text-[9px] transition-all',
                                  params.aspectRatio === option.value
                                    ? 'border-white/[0.45] bg-white/[0.12] text-white'
                                    : 'border-white/10 bg-white/[0.03] text-white/[0.58] hover:border-white/20 hover:text-white'
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 text-[9px] text-white/45">清晰度</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {resolutionOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => patchParams({ resolution: option.value })}
                                className={cn(
                                  'nodrag nowheel h-7 rounded-md border px-2 text-[9px] transition-all',
                                  params.resolution === option.value
                                    ? 'border-white/[0.45] bg-white/[0.12] text-white'
                                    : 'border-white/10 bg-white/[0.03] text-white/[0.58] hover:border-white/20 hover:text-white'
                                )}
                                title={option.label}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 text-[9px] text-white/45">时长</div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {durationOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => patchParams({ duration: option.value })}
                                className={cn(
                                  'nodrag nowheel h-7 rounded-md border px-2 text-[9px] transition-all',
                                  params.duration === option.value
                                    ? 'border-white/[0.45] bg-white/[0.12] text-white'
                                    : 'border-white/10 bg-white/[0.03] text-white/[0.58] hover:border-white/20 hover:text-white'
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {showGenerateAudioToggle ? (
                          <InlineSwitch
                            title="原生音频"
                            description="生成配乐 / 音效 / 环境声"
                            checked={Boolean(params.generateAudio)}
                            onChange={(checked) =>
                              patchParams({
                                generateAudio: checked,
                                audioGeneration: checked ? 'music' : 'none',
                              })
                            }
                          />
                        ) : null}

                        {showBgmToggle ? (
                          <InlineSwitch
                            title="背景音乐"
                            description="由模型自动匹配 BGM"
                            checked={Boolean(params.bgm)}
                            onChange={(checked) => patchParams({ bgm: checked })}
                          />
                        ) : null}

                        <div>
                          <div className="mb-1.5 text-[9px] text-white/45">风格预设</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => patchParams({ videoPreset: undefined })}
                              className={cn(
                                'nodrag nowheel h-7 rounded-md border px-2 text-[9px] transition-all',
                                !params.videoPreset
                                  ? 'border-white/[0.45] bg-white/[0.12] text-white'
                                  : 'border-white/10 bg-white/[0.03] text-white/[0.58] hover:border-white/20 hover:text-white'
                              )}
                            >
                              无
                            </button>
                            {VIDEO_STYLE_PRESETS.map((preset) => (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => {
                                  const currentPrompt = localPrompt.trim();
                                  const nextPrompt = currentPrompt.includes(preset.prompt)
                                    ? currentPrompt
                                    : `${currentPrompt}${currentPrompt ? '，' : ''}${preset.prompt}`;
                                  setLocalPrompt(nextPrompt);
                                  patchParams({ prompt: nextPrompt, videoPreset: preset.value });
                                }}
                                className={cn(
                                  'nodrag nowheel h-7 rounded-md border px-2 text-[9px] transition-all',
                                  params.videoPreset === preset.value
                                    ? 'border-white/[0.45] bg-white/[0.12] text-white'
                                    : 'border-white/10 bg-white/[0.03] text-white/[0.58] hover:border-white/20 hover:text-white'
                                )}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <div className="relative">
                  <button
                    type="button"
                    title="高级参数"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAdvancedPanel((value) => !value);
                      setShowParamPanel(false);
                      setShowCountPanel(false);
                    }}
                    className={cn(
                      'nodrag nowheel flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-all hover:bg-white/[0.08] hover:text-white/75',
                      showAdvancedPanel && 'bg-white/10 text-white'
                    )}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>

                  {showAdvancedPanel ? (
                    <div
                      className="absolute bottom-[calc(100%+6px)] right-0 z-30 w-[300px] rounded-xl border border-white/10 bg-[#151515] p-3 shadow-2xl"
                      onWheelCapture={(event) => event.stopPropagation()}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-white/80">高级参数</span>
                        <span className="text-[9px] text-white/35">{model.label}</span>
                      </div>
                      <div className="nodrag nowheel mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-white/78">品牌水印</div>
                          <div className="mt-0.5 text-[9px] text-white/38">
                            右下角 · 20%透明度 ·{' '}
                            {getDefaultWatermarkEnabled(membershipLevel)
                              ? '体验版默认开启'
                              : '当前会员默认关闭'}
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(params.watermark)}
                          aria-label="品牌水印"
                          onClick={(event) => {
                            event.stopPropagation();
                            patchParams({ watermark: !params.watermark });
                          }}
                          className={cn(
                            'relative h-5 w-9 shrink-0 rounded-full border border-white/16 p-0.5 transition-colors',
                            params.watermark ? 'bg-white/[0.18]' : 'bg-black/35'
                          )}
                        >
                          <span
                            className={cn(
                              'block h-3.5 w-3.5 rounded-full transition-transform',
                              params.watermark ? 'translate-x-4 bg-white' : 'bg-white/48'
                            )}
                          />
                        </button>
                      </div>
                      {advancedFields.length > 0 ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {advancedFields.map((field) => (
                              <label
                                key={field}
                                className="nodrag nowheel min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5"
                              >
                                <span className="mb-1 block text-[10px] text-white/45">
                                  {fieldLabels[field]}
                                </span>
                                {booleanVideoFields.has(field) ? (
                                  <select
                                    value={String(Boolean(params[field]))}
                                    onChange={(event) =>
                                      patchParams({ [field]: event.target.value === 'true' })
                                    }
                                    className="w-full bg-transparent text-[12px] text-white outline-none"
                                  >
                                    <option value="true">开启</option>
                                    <option value="false">关闭</option>
                                  </select>
                                ) : textVideoFields.has(field) ? (
                                  <input
                                    value={String(params[field] ?? '')}
                                    onChange={(event) =>
                                      patchParams({ [field]: event.target.value })
                                    }
                                    placeholder={getVideoFieldPlaceholder(field)}
                                    className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
                                  />
                                ) : (
                                  <select
                                    value={String(params[field] ?? '')}
                                    onChange={(event) => {
                                      const nextValue = numericVideoFields.has(field)
                                        ? Number(event.target.value)
                                        : event.target.value;
                                      patchParams({ [field]: nextValue });
                                    }}
                                    className="w-full bg-transparent text-[12px] text-white outline-none"
                                  >
                                    {getVideoFieldOptions(field, model).map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </label>
                            ))}
                          </div>
                          <AicgProVideoSliders
                            nodeId={id as string}
                            proVideo={params.proVideo}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2"
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/45">
                            当前模型暂无额外高级参数。
                          </div>
                          <AicgProVideoSliders
                            nodeId={id as string}
                            proVideo={params.proVideo}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2"
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  title="上传参考"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleUploadReference();
                  }}
                  className="nodrag nowheel flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-all hover:bg-white/[0.08] hover:text-white/75"
                >
                  <Upload className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  title="角色库"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowCharacterLibrary(true);
                    setShowParamPanel(false);
                    setShowAdvancedPanel(false);
                    setShowCountPanel(false);
                  }}
                  className="nodrag nowheel flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-all hover:bg-white/[0.08] hover:text-white/75"
                >
                  <Clapperboard className="h-4 w-4" />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    title="生成数量"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowCountPanel((value) => !value);
                      setShowParamPanel(false);
                      setShowAdvancedPanel(false);
                    }}
                    className={cn(
                      'nodrag nowheel flex h-8 items-center rounded-lg px-2 text-[10px] text-white/45 transition-all hover:bg-white/[0.08] hover:text-white/75',
                      showCountPanel && 'bg-white/10 text-white'
                    )}
                  >
                    {currentClipCount}个
                  </button>

                  {showCountPanel ? (
                    <div className="absolute bottom-[calc(100%+6px)] right-0 z-30 w-44 rounded-xl border border-white/10 bg-[#151515] p-2 shadow-2xl">
                      <div className="mb-1.5 text-[9px] leading-4 text-white/36">
                        多数量会提交多个后端任务，结果统一进入 AI 剪辑。
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {VIDEO_CLIP_COUNT_OPTIONS.map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              patchParams({ clipCount: count });
                              setShowCountPanel(false);
                            }}
                            className={cn(
                              'nodrag nowheel flex h-8 w-full items-center justify-center rounded-lg text-[10px] transition-all',
                              currentClipCount === count
                                ? 'bg-white/[0.12] text-white'
                                : 'text-white/[0.55] hover:bg-white/[0.06] hover:text-white'
                            )}
                          >
                            {count}个
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <span
                  className="flex h-8 items-center gap-1 rounded-lg border border-white/16 bg-[#151515] px-2 text-[10px] text-white/70"
                  title={`预计消耗 ${expectedPoints} 积分，每秒 ${pointsPerSecond} 积分`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{expectedPoints}</span>
                  <span className="text-white/38">· {pointsPerSecond}/s</span>
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecuteVideo({ mockGeneration: e.altKey });
                  }}
                  disabled={isGenerationBlocked || isProcessing || isSubmitting}
                  className="nodrag nowheel ml-1 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.1] px-3 text-[11px] font-semibold text-white transition-all hover:border-white/32 hover:bg-white/[0.14] disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    isSubmitting || isProcessing
                      ? '当前节点正在生成，请勿重复点击'
                      : isGenerationBlocked
                        ? readinessIssue || '请补充素材'
                        : '生成视频（Alt+点击为模拟生成，不调用真实接口）'
                  }
                >
                  <Zap className="h-3.5 w-3.5" />
                  {isProcessing || isSubmitting ? '生成中...' : '生成'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <CharacterLibraryPanel
        isOpen={showCharacterLibrary}
        onClose={() => setShowCharacterLibrary(false)}
        onSelectCharacter={handleSelectCharacterReference}
      />
    </div>
  );
}

const numericVideoFields = new Set<VideoField>([
  'duration',
  'fps',
  'motionStrength',
  'styleStrength',
  'characterConsistency',
  'wmPosition',
  'seed',
  'templateId',
]);

function getCompactDurationOptions(durations: number[], preferred = 5): number[] {
  const sorted = Array.from(new Set(durations)).sort((a, b) => a - b);
  if (sorted.length <= 5) return sorted;

  const anchors = [preferred, 4, 5, 8, 10, 15].filter((value) => sorted.includes(value));
  const result: number[] = [];
  for (const value of anchors) {
    if (!result.includes(value)) result.push(value);
    if (result.length >= 5) return result.sort((a, b) => a - b);
  }

  const first = sorted[0];
  const middle = sorted[Math.floor(sorted.length / 2)];
  const last = sorted[sorted.length - 1];
  for (const value of [first, middle, last]) {
    if (!result.includes(value)) result.push(value);
  }

  return result.slice(0, 5).sort((a, b) => a - b);
}

function getVideoFieldOptions(
  field: VideoField,
  model?: AIVideoModelPreset
): Array<{ value: string | number; label: string }> {
  switch (field) {
    case 'aspectRatio':
      return (model?.aspectRatios || ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']).map(
        (value) => ({ value, label: value })
      );
    case 'resolution':
      return (model?.resolutions || ['720p', '1080p']).map((value) => ({
        value,
        label: value.toUpperCase(),
      }));
    case 'duration':
      return (model?.durations || [4, 5, 6, 8, 10]).map((value) => ({
        value,
        label: `${value}s`,
      }));
    case 'fps':
      return [24, 25, 30, 60].map((value) => ({ value, label: `${value}` }));
    case 'templateId':
      return Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: `模板 ${i + 1}` }));
    case 'style':
      return [
        { value: 'general', label: '写实' },
        { value: 'anime', label: '动漫' },
      ];
    case 'motionAmplitude':
      return [
        { value: 'auto', label: '自动' },
        { value: 'small', label: '小' },
        { value: 'medium', label: '中' },
        { value: 'large', label: '大' },
      ];
    case 'motionStrength':
    case 'styleStrength':
    case 'characterConsistency':
      return [1, 3, 5, 7, 9].map((value) => ({ value, label: `${value}` }));
    case 'cameraMovement':
      return [
        { value: 'auto', label: '智能' },
        { value: 'fixed', label: '固定' },
        { value: 'push_in', label: '推进' },
        { value: 'pull_out', label: '拉远' },
        { value: 'pan_left', label: '左摇' },
        { value: 'pan_right', label: '右摇' },
        { value: 'orbit', label: '环绕' },
      ];
    case 'referenceType':
      return [
        { value: 'feature', label: '特征参考' },
        { value: 'base', label: '图片参考' },
        { value: 'video', label: '视频参考' },
      ];
    case 'videoPreset':
      return [
        { value: 'none', label: '无预设' },
        { value: 'cinematic', label: '电影感' },
        { value: 'anime', label: '动漫风' },
        { value: 'commercial', label: '广告片' },
        { value: 'documentary', label: '纪录片' },
      ];
    case 'templateMode':
      return [
        { value: 'standard', label: '普通生成' },
        { value: 'template-story', label: '故事模板' },
        { value: 'template', label: '特效模板' },
        { value: 'one-click', label: '一键成片' },
      ];
    case 'wmPosition':
      return [
        { value: 1, label: '左上' },
        { value: 2, label: '右上' },
        { value: 3, label: '右下' },
        { value: 4, label: '左下' },
      ];
    case 'seed':
      return [-1, 0, 42, 1024].map((value) => ({
        value,
        label: value === -1 ? '随机' : `${value}`,
      }));
    default:
      return [];
  }
}

function getVideoFieldPlaceholder(field: VideoField): string {
  switch (field) {
    case 'wmUrl':
      return '水印图片 URL';
    case 'metaData':
      return 'JSON 元数据';
    case 'callbackUrl':
      return 'https://...';
    case 'payload':
      return '透传给官方接口';
    case 'templateStory':
      return '故事模板 ID / JSON';
    case 'templateName':
      return '特效模板名称';
    case 'templateArea':
      return '区域参数';
    case 'templateBeast':
      return '主体参数';
    case 'videoUrl':
      return 'https://...mp4';
    case 'audioUrl':
      return 'https://...mp3';
    default:
      return '';
  }
}

function InlineSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
      <div>
        <div className="text-[10px] text-white/75">{title}</div>
        <div className="text-[9px] text-white/35">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'nodrag nowheel h-6 w-11 rounded-full border p-0.5 transition-all',
          checked ? 'border-white/[0.35] bg-white/[0.18]' : 'border-white/10 bg-black/35'
        )}
        title={checked ? `关闭${title}` : `开启${title}`}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full bg-white/70 transition-transform',
            checked && 'translate-x-5 bg-white'
          )}
        />
      </button>
    </div>
  );
}

export default memo(AIVideoNode);
