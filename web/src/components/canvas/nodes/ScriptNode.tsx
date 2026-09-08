import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import AICGNodeShell from './AICGNodeShell';
import AICGNodePromptBar from './AICGNodePromptBar';
import AICGSlashMenu from '../AICGSlashMenu';
import NodeControllerV2Panel from './NodeControllerV2Panel';
import type { NodeControllerAction } from './NodeControllerCapabilityPanel';
import { useAICGSlashConnect } from '@/hooks/useAICGSlashConnect';
import { syncDownstreamFromNode } from '@/services/aicg-downstream-sync';
import { getNodeControllerPreset } from '@/services/node-controller-capability-registry';
import { spawnScriptWorkflowChain } from '@/services/script-workflow-chain-service';
import {
  spawnControllerToolNode,
  withControllerActionConnection,
} from '@/services/node-controller-action-service';
import { SafeStyle } from '@/components/ui/SafeStyle';
import { cn, extractOriginalUrl, generateId } from '@/lib/utils';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';
import { getAuthToken } from '@/lib/auth-check';
import { API_BASE_URL } from '@/lib/api-config';
import { analyzeVideoForScript } from '@/services/video-understanding-service';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Upload,
  X as CloseIcon,
  GripVertical,
  Wand2,
  RotateCcw,
  Mic,
  Save,
  FolderOpen,
  Package,
  Settings2,
  Lightbulb,
  Palette,
  Eye,
  Camera,
  LayoutGrid,
  Clock,
  ArrowUp,
} from 'lucide-react';
import type { ScriptScene } from '@/types/node-data';
import { useNodeModels } from '@/hooks/useNodeModels';
import { nodeModelMatcher } from '@/core/node-model-matcher';
import { NodePointsBadge } from './NodePointsBadge';
import StoryboardMakerWorkbench from './StoryboardMakerWorkbench';
import {
  buildProfessionalStoryboardPrompt,
  ensureStoryboardSceneCount,
  normalizeProfessionalScenes,
  parseProfessionalStoryboardResponse,
  shouldAutoGenerateFramesAfterPlanning,
  scenesToStoryboardPlan,
} from './storyboard-maker-professional';
import { buildStoryboardCellsFromPlan } from './storyboard-grid-core';
import type { GridDirectorFrameResult } from './grid-director-core';
import {
  buildStoryboardPayload,
  parseStoryboardPayload,
  resolveStoryboardSelection,
} from './storyboard-payload';
import {
  buildSingleStoryboardSheetPrompt,
  runSingleStoryboardSheetExecution,
  STORYBOARD_DOUBAO_SEEDREAM_OPTIONS,
  type StoryboardDoubaoSeedreamProvider,
} from './storyboard-sheet-execution';
import {
  startStoryboardQueueTask,
  updateStoryboardQueueTask,
} from './storyboard-task-queue';
import { validateStoryboardPlanContinuity } from '@/services/storyboard-continuity-validator';
import { promptOptimizerService } from '@/services/prompt-optimizer-api';
import {
  resolveStoryboardPanelCount,
  resolveStoryboardOutputMode,
  type StoryboardOutputMode,
  type StoryboardPanelCount,
} from '@/types/storyboard-output-mode';

/** 剧本解析节点内部使用的景别选项（与 inferShotType 输出匹配） */
const SCRIPT_SHOT_TYPE_OPTIONS = [
  { value: 'wide', label: '全景' },
  { value: 'medium', label: '中景' },
  { value: 'closeup', label: '特写' },
  { value: 'detail', label: '细节' },
  { value: 'pov', label: '主观' },
  { value: 'tracking', label: '跟随' },
  { value: 'aerial', label: '航拍' },
];
import {
  saveTemplate,
  loadTemplate,
  listTemplates,
  deleteTemplate,
  downloadTemplateFile,
  importTemplateFromFile,
  embedSceneMedia,
  type ScriptTemplate,
  type ScriptTemplateScene,
  type ScriptTemplateSummary,
} from '@/services/script-template-service';

export type Scene = ScriptScene;

export interface ScriptNodeData extends Record<string, unknown> {
  script: string;
  scenes: Scene[];
  style?: string;
  model?: string;
  label?: string;
  scriptType?: string;
  tone?: string;
  /** AICG 三种分镜入口 */
  scriptSourceMode?: 'text' | 'video_reference' | 'character_reference' | 'image_reference';
  storyboardImageModelId?: string;
  storyboardImageModelProvider?: string;
  referenceVideoUrl?: string;
  referenceVideoUrls?: string[];
  referenceCharacterNote?: string;
  referenceImageUrls?: string[];
  characterReferenceUrls?: string[];
  isControllerCollapsed?: boolean;
  isPropertiesOpen?: boolean;
  storyboardOutputMode?: StoryboardOutputMode;
  storyboardPanelCount?: StoryboardPanelCount;
  storyboardImageProvider?: StoryboardDoubaoSeedreamProvider;
  storyboardOutputSize?: string;
  frameResults?: GridDirectorFrameResult[];
  gridImageUrl?: string;
  coverImageUrl?: string;
  storyboardPayload?: string;
  task?: {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
    resultUrl?: string;
  };
}

const SCRIPT_TYPES = [
  { value: 'cinematic', label: '电影感', desc: '专业运镜，戏剧性光影' },
  { value: 'vlog', label: 'Vlog', desc: '自然记录，生活化' },
  { value: 'commercial', label: '广告片', desc: '产品展示，高端质感' },
  { value: 'documentary', label: '纪录片', desc: '真实叙事，纪实风格' },
  { value: 'tutorial', label: '教程', desc: '步骤演示，清晰讲解' },
  { value: 'story', label: '故事短片', desc: '叙事驱动，角色塑造' },
  { value: 'custom', label: '自定义', desc: '自由创作' },
];

const TONE_OPTIONS = [
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '轻松' },
  { value: 'humorous', label: '幽默' },
  { value: 'inspirational', label: '励志' },
  { value: 'suspense', label: '悬疑' },
];

const SCRIPT_SOURCE_COMPACT_OPTIONS = [
  { value: 'text', label: '剧本拆镜' },
  { value: 'image_reference', label: '图片参考' },
  { value: 'video_reference', label: '视频参考' },
  { value: 'character_reference', label: '角色参考' },
];

const SCRIPT_MODE_MODEL_MAP: Record<string, string[]> = {
  // 移除已废弃的 glm-5.1 (provider: zhipu)
  text: ['deepseek-v4-pro', 'apipaths-gpt-5.5', 'apipaths'],
  image_reference: ['deepseek-v4-pro', 'apipaths-gpt-5.5'],
  video_reference: ['deepseek-v4-pro', 'apipaths-gpt-5.5'],
  character_reference: ['deepseek-v4-pro', 'apipaths-gpt-5.5'],
};

const CAMERA_MOVEMENTS = [
  { value: 'static', label: '固定' },
  { value: 'pan', label: '横摇' },
  { value: 'tilt', label: '俯仰' },
  { value: 'dolly', label: '推拉' },
  { value: 'crane', label: '摇臂' },
  { value: 'handheld', label: '手持' },
  { value: 'orbit', label: '环绕' },
];

const TRANSITIONS = [
  { value: 'cut', label: '硬切' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'dissolve', label: '叠化' },
  { value: 'wipe', label: '划变' },
  { value: 'zoom', label: '缩放' },
  { value: 'match', label: '匹配剪辑' },
];

// 模型到积分消耗的映射表
const MODEL_POINTS_MAP: Record<string, number> = {
  'deepseek-v4-flash': 20,
  apipaths: 20,
  'apipaths-gpt-5.5': 25,
  'deepseek-v4-pro': 30,
};

function getPointsForModel(model?: string): number {
  if (!model) return 20;
  return MODEL_POINTS_MAP[model] ?? 20;
}

const STORYBOARD_PLANNING_POINTS = 60;
function resolveStoryboardImageModelConfig(_value: unknown) {
  const provider: StoryboardDoubaoSeedreamProvider = 'doubao';
  return STORYBOARD_DOUBAO_SEEDREAM_OPTIONS.find((option) => option.provider === provider)!;
}

type StoryboardReferenceBundle = {
  visual: string[];
  character: string[];
  video: string[];
  text: string[];
  all: string[];
  primary: string;
};

const STORYBOARD_IMAGE_REFERENCE_SOURCE_TYPES = new Set([
  'imageInput',
  'aiImage',
  'imageGen',
  'aicgImageGen',
  'unifiedImageStudio',
  'imageAnalysis',
  'localMatting',
  'gridDirector',
  'scriptStoryboard',
  'magicStoryboard',
  'photoGrid',
  'frameExtractor',
  'characterLibrary',
  'sceneLibrary',
  'propLibrary',
  'characterConsistency',
  'director3D',
  'multiAngle',
  'panorama360',
]);

const STORYBOARD_VIDEO_REFERENCE_SOURCE_TYPES = new Set([
  'videoInput',
  'videoGen',
  'aicgVideoGen',
  'advancedVideoGen',
  'imageToVideo',
  'videoUpscale',
  'videoCompose',
  'frameExtractor',
]);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function readFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function resolveStoryboardReferenceImages(
  sourceData: Record<string, unknown>,
  sourceHandle?: string | null
): string[] {
  const storyboardPayload = parseStoryboardPayload(sourceData.storyboardPayload);
  if (!storyboardPayload) return [];

  const resolved = resolveStoryboardSelection(storyboardPayload);
  if (
    sourceHandle === 'frames' ||
    sourceHandle === 'output' ||
    storyboardPayload.processingMode === 'sequence'
  ) {
    return resolved.sequenceFrames
      .map((frame) => frame.imageUrl)
      .filter((url): url is string => Boolean(url));
  }

  return uniqueStrings([
    resolved.selectedFrame?.imageUrl,
    sourceData.coverImageUrl as string | undefined,
    storyboardPayload.coverImageUrl,
    storyboardPayload.gridImageUrl,
  ]);
}

function resolveNodeVisualReferenceUrls(
  sourceData: Record<string, unknown>,
  sourceHandle?: string | null
): string[] {
  const storyboardImages = resolveStoryboardReferenceImages(sourceData, sourceHandle);
  if (storyboardImages.length > 0) return storyboardImages.map((url) => extractOriginalUrl(url));

  const task =
    sourceData.task && typeof sourceData.task === 'object'
      ? (sourceData.task as Record<string, unknown>)
      : {};

  return uniqueStrings([
    ...asStringArray(task.resultUrls),
    ...asStringArray(sourceData.resultUrls),
    ...asStringArray(sourceData.imageUrls),
    ...asStringArray(sourceData.referenceImages),
    typeof sourceHandle === 'string' && typeof sourceData[sourceHandle] === 'string'
      ? (sourceData[sourceHandle] as string)
      : '',
    readFirstString(
      sourceHandle === 'outfitRef' ? sourceData.outfitRef : undefined,
      sourceHandle === 'characterRef' ? sourceData.characterRef : undefined,
      task.resultUrl,
      sourceData.outputImageUrl,
      sourceData.coverImageUrl,
      sourceData.gridImageUrl,
      sourceData.panoramaImageUrl,
      sourceData.imageUrl,
      sourceData.url,
      sourceData.resultUrl,
      sourceData.output,
      sourceData.primaryImage
    ),
  ]).map((url) => extractOriginalUrl(url));
}

function resolveNodeTextReferences(
  sourceData: Record<string, unknown>,
  sourceHandle?: string | null
): string[] {
  const outputForHandle = sourceHandle ? sourceData[sourceHandle] : undefined;
  const candidates = [
    outputForHandle,
    sourceData.text,
    sourceData.content,
    sourceData.script,
    sourceData.prompt,
    sourceData.outputText,
    sourceData.generatedText,
    sourceData.result,
    sourceData.output,
  ];
  return uniqueStrings(
    candidates.flatMap((value) =>
      Array.isArray(value) ? asStringArray(value) : [typeof value === 'string' ? value : '']
    )
  );
}

function resolveNodeVideoReferences(
  sourceData: Record<string, unknown>,
  sourceHandle?: string | null
): string[] {
  const task =
    sourceData.task && typeof sourceData.task === 'object'
      ? (sourceData.task as Record<string, unknown>)
      : {};
  const outputForHandle = sourceHandle ? sourceData[sourceHandle] : undefined;
  return uniqueStrings([
    ...asStringArray(sourceData.referenceVideoUrls),
    ...asStringArray(sourceData.referenceVideos),
    ...asStringArray(sourceData.videoUrls),
    ...asStringArray(sourceData.resultUrls),
    ...asStringArray(task.resultUrls),
    typeof outputForHandle === 'string' ? outputForHandle : '',
    readFirstString(
      sourceData.videoUrl,
      sourceData.videoReference,
      sourceData.resultUrl,
      sourceData.outputUrl,
      sourceData.output,
      task.resultUrl,
      task.videoUrl
    ),
  ]);
}

function collectConnectedStoryboardReferences(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): StoryboardReferenceBundle {
  const visual: string[] = [];
  const character: string[] = [];
  const video: string[] = [];
  const text: string[] = [];

  edges
    .filter((edge) => edge.target === nodeId)
    .forEach((edge) => {
      const sourceNode = nodes.find((candidate) => candidate.id === edge.source);
      if (!sourceNode) return;

      const sourceData = (sourceNode.data || {}) as Record<string, unknown>;
      const targetHandle = edge.targetHandle || 'input';
      const sourceType = String(sourceData.type || sourceNode.type || '');
      const isImageSource =
        sourceData.mediaType === 'image' || STORYBOARD_IMAGE_REFERENCE_SOURCE_TYPES.has(sourceType);
      const isVideoSource =
        sourceData.mediaType === 'video' || STORYBOARD_VIDEO_REFERENCE_SOURCE_TYPES.has(sourceType);

      if (targetHandle === 'videoReference' || (targetHandle === 'input' && isVideoSource)) {
        video.push(...resolveNodeVideoReferences(sourceData, edge.sourceHandle));
        return;
      }

      if (targetHandle === 'scriptInput' || (targetHandle === 'input' && !isImageSource)) {
        text.push(...resolveNodeTextReferences(sourceData, edge.sourceHandle));
        return;
      }

      const storyboardImages = resolveStoryboardReferenceImages(sourceData, edge.sourceHandle);
      const resolvedUrls =
        storyboardImages.length > 0
          ? storyboardImages.map((url) => extractOriginalUrl(url))
          : resolveNodeVisualReferenceUrls(sourceData, edge.sourceHandle);

      const cleaned = resolvedUrls.filter((url) => url && url.trim());
      if (cleaned.length === 0) return;

      if (targetHandle === 'characterReference') {
        character.push(...cleaned);
      } else if (targetHandle === 'imageInput' || targetHandle === 'input') {
        visual.push(...cleaned);
      }
    });

  const dedupedVisual = uniqueStrings(visual);
  const dedupedCharacter = uniqueStrings(character);
  const dedupedVideo = uniqueStrings(video);
  const dedupedText = uniqueStrings(text);
  const all = uniqueStrings([...dedupedCharacter, ...dedupedVisual]);
  return {
    visual: dedupedVisual,
    character: dedupedCharacter,
    video: dedupedVideo,
    text: dedupedText,
    all,
    primary: all[0] || '',
  };
}

function buildStoredStoryboardReferences(data: Record<string, unknown>): StoryboardReferenceBundle {
  const visual = uniqueStrings([
    ...asStringArray(data.referenceImageUrls),
    ...asStringArray(data.visualReferenceImages),
    readFirstString(data.referenceImage, data.receivedImageUrl, data.imageUrl, data.resultUrl),
    ...asStringArray(data.referenceImages),
  ]);
  const character = uniqueStrings([
    ...asStringArray(data.characterReferenceUrls),
    ...asStringArray(data.characterReferenceImages),
    readFirstString(data.characterRef, data.characterImageUrl),
  ]);
  const video = uniqueStrings([
    ...asStringArray(data.referenceVideoUrls),
    ...asStringArray(data.referenceVideos),
    ...asStringArray(data.videoUrls),
    readFirstString(data.referenceVideoUrl, data.videoReference, data.videoUrl),
  ]);
  const text = uniqueStrings(asStringArray(data.connectedTextInputs));
  const all = uniqueStrings([...character, ...visual]);
  return { visual, character, video, text, all, primary: all[0] || '' };
}

function mergeStoryboardReferences(
  ...bundles: StoryboardReferenceBundle[]
): StoryboardReferenceBundle {
  const visual = uniqueStrings(bundles.flatMap((bundle) => bundle.visual));
  const character = uniqueStrings(bundles.flatMap((bundle) => bundle.character));
  const video = uniqueStrings(bundles.flatMap((bundle) => bundle.video));
  const text = uniqueStrings(bundles.flatMap((bundle) => bundle.text));
  const all = uniqueStrings([...character, ...visual]);
  return { visual, character, video, text, all, primary: all[0] || '' };
}

function summarizeReferenceForPrompt(url: string, index: number): string {
  if (url.startsWith('blob:')) return `参考图${index + 1}：本地上传图片`;
  if (url.startsWith('data:')) return `参考图${index + 1}：内联图片数据`;

  try {
    const parsed = new URL(url);
    const fileName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return `参考图${index + 1}：${fileName || parsed.hostname}`;
  } catch {
    return `参考图${index + 1}：${url.slice(0, 96)}`;
  }
}

function buildStoryboardVisualReferenceInstruction(refs: StoryboardReferenceBundle): string {
  if (refs.all.length === 0 && refs.video.length === 0) return '';

  const visualLines = refs.visual.map(
    (url, index) => `- ${summarizeReferenceForPrompt(url, index)}`
  );
  const characterLines = refs.character.map(
    (url, index) =>
      `- 角色参考${index + 1}：${summarizeReferenceForPrompt(url, index).replace(/^参考图\d+：/, '')}`
  );
  const videoLines = refs.video.map(
    (url, index) => `- 视频参考${index + 1}：${url.startsWith('blob:') ? '本地上传视频' : url}`
  );
  return [
    `多模态参考输入：${refs.all.length} 张图片，${refs.video.length} 个视频。`,
    visualLines.length > 0 ? `分镜/场景/画风参考：\n${visualLines.join('\n')}` : '',
    characterLines.length > 0 ? `角色一致性参考：\n${characterLines.join('\n')}` : '',
    videoLines.length > 0 ? `视频节奏与运镜参考：\n${videoLines.join('\n')}` : '',
    '解析要求：如果参考图是多格分镜表、手绘故事板、动作草图或漫画式镜头表，请按格子顺序提取镜头编号、景别、人物动作、构图、运镜、情绪节奏和可用于图生视频的提示词；如果参考图是角色或场景图，请锁定外观、服装、场景和画风一致性。',
    '输出仍需是可解析的 JSON 分镜数组，并为每个镜头补充 referenceUsage 字段说明使用了哪些视觉参考。',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function getRenderableReferenceUrl(url: string): string {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  return getSafeRenderableMediaUrl(url);
}

// ==================== 专业电影级知识库 ====================

const LIGHTING_LIBRARY: Record<string, string[]> = {
  outdoor_day: [
    '自然日光为主光源，金色时刻暖调侧光，柔光箱补面部阴影',
    '大面积柔光罩模拟阴天散射光，降低反差保留暗部细节',
    '逆光拍摄配合反光板，营造空气感和轮廓光',
  ],
  outdoor_night: [
    '月光蓝调主光源+暖色街灯辅光，冷暖对比营造夜景氛围',
    '霓虹灯管+橱窗灯光混合照明，赛博朋克风格多色光源',
    '车灯轨迹光绘+环境补光，长曝光夜景动态感',
  ],
  indoor_day: [
    '窗户自然光侧入+室内暖色补光，伦勃朗三角光人像',
    '大面积落地窗散射光，高调柔光通透质感',
    '百叶窗条纹光+微尘丁达尔效应，创造光影层次',
  ],
  indoor_night: [
    '单一暖色台灯顶侧光，低调电影感明暗对比',
    '烛光/壁炉火光闪烁动态照明，温暖私密氛围',
    '多灯位三点布光法：主光+辅光+轮廓光，商业级人像',
  ],
  studio: [
    '三点式影棚布光：八角柔光箱主光+长条柔光箱侧光+蜂巢轮廓光',
    '环形闪光灯正面补光+背景渐变染色灯，时尚杂志封面质感',
    '硬光单灯+深黑背景，戏剧性强对比舞台光',
  ],
  special: [
    '镭射激光+烟雾机的丁达尔效应，科幻光束穿透空间',
    '水下散射光+水面焦散投影，蓝绿色调梦幻水下世界',
    '火光/爆炸高温暖光源+冷色调环境，灾难片史诗感',
  ],
};

const MOOD_LIBRARY: Record<string, string[]> = {
  peaceful: ['宁静祥和，时间缓慢流淌', '晨雾轻盈，万物初醒', '微风拂面，岁月静好'],
  dramatic: ['戏剧张力十足，光影强烈对比', '命运转折，暴风雨前夕', '冲突一触即发，空气凝固'],
  romantic: ['柔美浪漫，粉色薄暮', '心跳加速的甜蜜时刻', '烛光摇曳，耳鬓厮磨'],
  suspense: ['紧张悬疑，阴影潜伏', '未知恐惧蔓延，步步惊心', '屏息凝神，每一秒都可能是转折'],
  epic: ['宏大史诗，波澜壮阔', '英雄崛起，万军齐发', '天际线燃烧，末日降临'],
  melancholic: ['忧伤低回，雨打芭蕉', '孤独身影，空荡房间', '回忆如潮，模糊了现实'],
  energetic: ['活力四射，色彩迸发', '节奏强劲，脉搏跳动', '疾风骤雨般的动作连贯'],
  mysterious: ['神秘莫测，雾锁重楼', '未知力量在暗中涌动', '古老符文微微发光'],
};

const COMPOSITION_LIBRARY: Record<string, string[]> = {
  wide: [
    '三分法构图，地平线置于上1/3，广角拉伸空间纵深感',
    '引导线构图，道路/河流从前景延伸到远方的消失点',
    '对称构图，建筑/倒影完美对称，营造庄重仪式感',
  ],
  medium: [
    '黄金分割点放置主体，环境与人物比例和谐',
    '框架构图，利用门/窗/拱门将视线聚焦于被摄体',
    '对角线构图，增加画面动感和张力',
  ],
  closeup: [
    '面部占据画面2/3，眼神置于上1/3黄金点，浅景深虚化背景',
    '极近距离微观视角，展现纹理细节和质感',
    '留白构图，被摄体偏一侧，另一侧留出呼吸空间',
  ],
  tracking: [
    '动态跟随构图，被摄体保持在画面固定位置，背景流动模糊',
    '低角度仰拍跟随，增强主角的威压感和力量感',
  ],
  aerial: ['上帝视角俯拍，图案化地面纹理，几何构成美感', '倾斜航拍角度，展现地形起伏和光影变化'],
};

const COLOR_LIBRARY: Record<string, string[]> = {
  warm: ['琥珀金+焦糖棕暖色主调，高光偏黄阴影偏橙', '日落橙+玫瑰金，整体温暖而富有层次'],
  cool: ['青蓝+银灰冷色主调，高光偏蓝阴影偏紫', '蒂芙尼蓝+冰雪白，清冷高级质感'],
  cinematic: ['橙青互补色经典好莱坞调色，肤色暖橙背景偏青', '去饱和+暗角+微对比，厚重电影质感'],
  pastel: ['低饱和粉彩色调，柔和高调梦幻感', '马卡龙色系+奶油白，轻透甜美'],
  neon: ['紫红+赛博蓝霓虹双色调，高饱和暗部偏紫', '荧光绿+电光紫，未来感赛博朋克'],
  vintage: ['褪色胶片感，黄绿调+颗粒感，80年代怀旧', '棕褐单色调+暖色溢光，复古宝丽来质感'],
  natural: ['真实色彩还原，轻微增强绿色和蓝色饱和度', '中性色调+微暖色温，自然纪录片风格'],
};

const DOF_LIBRARY: Record<string, string[]> = {
  shallow: ['f/1.4超大光圈，奶油般柔美背景虚化，主体如浮出画面'],
  medium: ['f/2.8-f/4中等光圈，背景可辨识但柔和分离'],
  deep: ['f/8-f/16小光圈，全景清晰锐利从前景到无限远'],
  tilt_shift: ['移轴镜头微缩模型效果，选择性焦点带'],
};

// ==================== 专业场景分析引擎 ====================

interface SceneAnalysis {
  lightingCategory: string;
  moodCategory: string;
  compositionCategory: string;
  colorCategory: string;
  dofCategory: string;
  confidence: number;
}

function analyzeSceneCategory(description: string): SceneAnalysis {
  const text = description.toLowerCase();
  const result: SceneAnalysis = {
    lightingCategory: 'studio',
    moodCategory: 'dramatic',
    compositionCategory: 'medium',
    colorCategory: 'cinematic',
    dofCategory: 'medium',
    confidence: 0.5,
  };

  if (
    text.includes('白天') ||
    text.includes('阳光') ||
    text.includes('清晨') ||
    text.includes('午后') ||
    text.includes('日光')
  ) {
    result.lightingCategory =
      text.includes('室内') || text.includes('房间') || text.includes('屋内')
        ? 'indoor_day'
        : 'outdoor_day';
  } else if (
    text.includes('夜晚') ||
    text.includes('黑夜') ||
    text.includes('深夜') ||
    text.includes('月') ||
    text.includes('星空')
  ) {
    result.lightingCategory =
      text.includes('室内') || text.includes('房间') || text.includes('屋内')
        ? 'indoor_night'
        : 'outdoor_night';
  } else if (
    text.includes('影棚') ||
    text.includes('棚拍') ||
    text.includes('背景布') ||
    text.includes('摄影棚')
  ) {
    result.lightingCategory = 'studio';
  } else if (
    text.includes('霓虹') ||
    text.includes('赛博') ||
    text.includes('激光') ||
    text.includes('水下') ||
    text.includes('火焰') ||
    text.includes('爆炸')
  ) {
    result.lightingCategory = 'special';
  }

  if (
    text.includes('宁静') ||
    text.includes('平静') ||
    text.includes('安详') ||
    text.includes('悠闲') ||
    text.includes('放松')
  ) {
    result.moodCategory = 'peaceful';
  } else if (
    text.includes('紧张') ||
    text.includes('悬疑') ||
    text.includes('恐怖') ||
    text.includes('害怕') ||
    text.includes('惊悚')
  ) {
    result.moodCategory = 'suspense';
  } else if (
    text.includes('浪漫') ||
    text.includes('爱情') ||
    text.includes('甜蜜') ||
    text.includes('温柔') ||
    text.includes('亲吻')
  ) {
    result.moodCategory = 'romantic';
  } else if (
    text.includes('宏大') ||
    text.includes('史诗') ||
    text.includes('壮观') ||
    text.includes('战场') ||
    text.includes('英雄')
  ) {
    result.moodCategory = 'epic';
  } else if (
    text.includes('悲伤') ||
    text.includes('忧郁') ||
    text.includes('孤独') ||
    text.includes('哭泣') ||
    text.includes('离别')
  ) {
    result.moodCategory = 'melancholic';
  } else if (
    text.includes('活力') ||
    text.includes('激情') ||
    text.includes('热血') ||
    text.includes('动感') ||
    text.includes('激烈')
  ) {
    result.moodCategory = 'energetic';
  } else if (
    text.includes('神秘') ||
    text.includes('诡异') ||
    text.includes('魔法') ||
    text.includes('奇幻') ||
    text.includes('超自然')
  ) {
    result.moodCategory = 'mysterious';
  } else if (
    text.includes('戏剧') ||
    text.includes('冲突') ||
    text.includes('对决') ||
    text.includes('高潮')
  ) {
    result.moodCategory = 'dramatic';
  }

  if (
    text.includes('全景') ||
    text.includes('远景') ||
    text.includes('广角') ||
    text.includes('航拍') ||
    text.includes('大场景')
  ) {
    result.compositionCategory = 'wide';
  } else if (
    text.includes('特写') ||
    text.includes('近景') ||
    text.includes('细节') ||
    text.includes('面部') ||
    text.includes('表情')
  ) {
    result.compositionCategory = 'closeup';
  } else if (
    text.includes('跟随') ||
    text.includes('追踪') ||
    text.includes('奔跑') ||
    text.includes('追逐')
  ) {
    result.compositionCategory = 'tracking';
  } else if (
    text.includes('俯瞰') ||
    text.includes('俯视') ||
    text.includes('上帝视角') ||
    text.includes('鸟瞰')
  ) {
    result.compositionCategory = 'aerial';
  }

  if (
    text.includes('温暖') ||
    text.includes('阳光') ||
    text.includes('金色') ||
    text.includes('黄昏') ||
    text.includes('烛光')
  ) {
    result.colorCategory = 'warm';
  } else if (
    text.includes('冰冷') ||
    text.includes('寒冷') ||
    text.includes('冰雪') ||
    text.includes('蓝色') ||
    text.includes('冬天')
  ) {
    result.colorCategory = 'cool';
  } else if (
    text.includes('霓虹') ||
    text.includes('赛博') ||
    text.includes('荧光') ||
    text.includes('夜店') ||
    text.includes('灯红酒绿')
  ) {
    result.colorCategory = 'neon';
  } else if (
    text.includes('复古') ||
    text.includes('怀旧') ||
    text.includes('老照片') ||
    text.includes('年代') ||
    text.includes('胶片')
  ) {
    result.colorCategory = 'vintage';
  } else if (
    text.includes('粉彩') ||
    text.includes('梦幻') ||
    text.includes('少女') ||
    text.includes('甜美') ||
    text.includes('柔和色')
  ) {
    result.colorCategory = 'pastel';
  } else if (
    text.includes('自然') ||
    text.includes('真实') ||
    text.includes('纪实') ||
    text.includes('纪录')
  ) {
    result.colorCategory = 'natural';
  }

  if (
    text.includes('特写') ||
    text.includes('细节') ||
    text.includes('微距') ||
    text.includes('虚化') ||
    text.includes('浅景深')
  ) {
    result.dofCategory = 'shallow';
  } else if (
    text.includes('全景') ||
    text.includes('风景') ||
    text.includes('远景') ||
    text.includes('建筑') ||
    text.includes('城市')
  ) {
    result.dofCategory = 'deep';
  } else if (text.includes('移轴') || text.includes('微缩') || text.includes('玩具')) {
    result.dofCategory = 'tilt_shift';
  }

  return result;
}

function pickFromLibrary(
  library: Record<string, string[]>,
  category: string,
  seed?: string
): string {
  const items = library[category];
  if (!items || items.length === 0) return '';
  // 基于 seed 的确定性 hash 选择，保证同一输入产生同一输出
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return items[Math.abs(hash) % items.length];
  }
  return items[Math.floor(Math.random() * items.length)];
}

function buildProfessionalPrompt(scene: Scene, analysis: SceneAnalysis): string {
  const seed = scene.description;
  const lighting = pickFromLibrary(LIGHTING_LIBRARY, analysis.lightingCategory, seed);
  const mood = pickFromLibrary(MOOD_LIBRARY, analysis.moodCategory, seed);
  const composition = pickFromLibrary(COMPOSITION_LIBRARY, analysis.compositionCategory, seed);
  const color = pickFromLibrary(COLOR_LIBRARY, analysis.colorCategory, seed);
  const dof = pickFromLibrary(DOF_LIBRARY, analysis.dofCategory, seed);

  const parts: string[] = [scene.description];
  const techParts: string[] = [];
  if (lighting) techParts.push(lighting);
  if (mood) techParts.push(mood);
  if (composition) techParts.push(composition);
  if (dof) techParts.push(dof);
  if (color) techParts.push(color);
  if (techParts.length > 0) parts.push(techParts.join('，'));
  parts.push('8K超高清画质，电影级调色，大师级构图，商业摄影质感');
  return parts.join('，');
}

function enrichScene(scene: Scene): Scene {
  const analysis = analyzeSceneCategory(scene.description);
  const seed = scene.description;
  return {
    ...scene,
    lightingSetup: pickFromLibrary(LIGHTING_LIBRARY, analysis.lightingCategory, seed),
    moodAtmosphere: pickFromLibrary(MOOD_LIBRARY, analysis.moodCategory, seed),
    compositionGuide: pickFromLibrary(COMPOSITION_LIBRARY, analysis.compositionCategory, seed),
    colorGrading: pickFromLibrary(COLOR_LIBRARY, analysis.colorCategory, seed),
    depthOfField: pickFromLibrary(DOF_LIBRARY, analysis.dofCategory, seed),
    professionalPrompt: buildProfessionalPrompt(scene, analysis),
  };
}

// ==================== AI Prompt Builder ====================

function buildScriptParserPrePrompt(scriptType: string, tone: string): string {
  const toneMap: Record<string, string> = {
    formal: '风格严肃正式，用词精准专业',
    casual: '风格轻松自然，语言生动活泼',
    humorous: '风格幽默风趣，允许夸张表达',
    inspirational: '风格励志激昂，充满正能量',
    suspense: '风格悬疑紧张，营造紧迫感',
  };
  const typeMap: Record<string, string> = {
    cinematic: '电影感短片，注重镜头语言和戏剧张力',
    vlog: 'Vlog风格，自然记录真实感',
    commercial: '广告片，突出产品质感和品牌调性',
    documentary: '纪录片，真实叙事纪实风格',
    tutorial: '教程视频，步骤清晰逻辑分明',
    story: '故事短片，注重叙事和角色塑造',
    custom: '自由创作，风格不限',
  };

  return `你是一位好莱坞级电影导演和资深分镜师。你的任务是将用户输入的任意文本（无论长短）智能解析为专业级分镜。

【创作方向】
${typeMap[scriptType] || '电影感短片'}
${toneMap[tone] || '风格自然流畅'}

【智能解析规则 — 极其重要】
1. **强制多段拆分**：即使输入只有1-2句话，也必须拆分为至少3-5个独立镜头。你需要基于输入内容进行合理的镜头扩展和叙事拆分，构建完整的视觉叙事弧线。

2. **短文本扩展策略**：
   - 如果输入只有一句话 → 想象这句话背后的完整场景，拆分为：建立镜头(定场) → 中景(主体动作) → 特写(关键细节) → 收尾镜头
   - 如果输入只有两句话 → 每句话拆为2-3个镜头，加上转场过渡
   - 如果输入是片段描述 → 补充前因后果，构建完整镜头序列

3. **为每个镜头提供极其详细的视觉描述**，包含：
   - 场景环境和氛围的具体细节
   - 角色/物体的位置、动作、表情、光影关系
   - 光线来源、方向、强度和质感
   - 色调和色彩倾向（冷/暖/互补）
   - 构图方式、镜头焦距和拍摄角度
   - 景深和焦点位置

4. **镜头类型必须有变化**：全景→中景→特写→细节，形成节奏感，不能所有镜头都是同一类型

5. **运镜方式多样化**：固定、推拉、摇臂、跟随、手持、环绕等交替使用

6. **转场设计**：根据叙事节奏设计合理的转场方式

7. **每个镜头给出建议时长**（3-10秒）

【输出格式】
严格返回纯JSON数组（不要markdown代码块标记），每个元素包含：
{
  "description": "极其详细的中文视觉描述，充满画面感和电影质感，可直接作为AI生成视频的提示词",
  "duration": 时长秒数(数字),
  "shotType": "wide|medium|closeup|detail|pov|tracking|aerial",
  "cameraMovement": "static|pan|tilt|dolly|crane|handheld|orbit",
  "transition": "cut|fade|dissolve|wipe|zoom|match",
  "dialogue": "对白内容（可选，如有）",
  "narration": "旁白内容（可选，如有）"
}

【重要提醒】
- description必须极其详细专业，至少50字以上
- 无论如何都必须返回至少3个镜头
- 直接返回JSON数组，不要任何额外说明文字`;
}

function buildStoryboardOutputPrompt(scenes: Scene[], aspectRatio = '9:16'): string {
  if (!scenes.length) return '';
  return [
    `故事版视频生成提示词（${aspectRatio}）`,
    '请按以下分镜顺序生成视频，不要把多镜头混成单一画面。保持角色、服装、道具、场景与色调一致。',
    ...scenes.map((scene, index) => {
      const prompt = scene.professionalPrompt || scene.description;
      const audio = [
        scene.dialogue ? `对白：${scene.dialogue}` : '',
        scene.narration ? `旁白：${scene.narration}` : '',
      ]
        .filter(Boolean)
        .join('；');
      return `${index + 1}. ${scene.duration}s / ${scene.shotType} / ${scene.cameraMovement} / ${scene.transition}\n${prompt}${audio ? `\n${audio}` : ''}`;
    }),
  ].join('\n\n');
}

// ==================== Compact Select ====================

const CompactSelect = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: {
  label?: string;
  value: string;
  options: Array<{ value: string; label: string; desc?: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) => (
  <label className={cn('flex flex-col gap-1 min-w-0', className)}>
    {label && (
      <span className="text-[9px] text-white/60 uppercase tracking-[0.12em] leading-none">
        {label}
      </span>
    )}
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'h-7 w-full appearance-none rounded-lg border border-white/10 bg-black/45 pl-2 pr-6 text-[10px] text-white outline-none transition-all',
          'focus:border-white/35 focus:bg-black/60',
          'hover:border-white/20',
          disabled && 'cursor-not-allowed opacity-45'
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="!bg-[#151515] !text-white">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
    </div>
  </label>
);

// ==================== Main Component ====================

const ScriptNode: React.FC<NodeProps> = ({ id, data, selected: _selected }) => {
  const nodeData = data as ScriptNodeData & {
    embeddedInAicgText?: boolean;
    scriptParams?: ScriptNodeData;
    storyboardMode?: string;
    aspectRatio?: string;
    targetDuration?: number;
  };
  const nodeType = String(
    nodeData.type || (nodeData.storyboardMode ? 'storyboardMaker' : 'script')
  );
  const isStoryboardMaker = nodeType === 'storyboardMaker';
  const embeddedInAicgText = Boolean(nodeData.embeddedInAicgText);
  const deleteNode = canvasStoreApi.deleteNode;

  const scriptSource = useMemo<ScriptNodeData>(() => {
    if (embeddedInAicgText) {
      return {
        script: '',
        scenes: [],
        style: '摄影写真',
        model: 'doubao-seedream-5-0-lite',
        scriptType: 'cinematic',
        tone: 'casual',
        ...(nodeData.scriptParams || {}),
      };
    }
    return nodeData;
  }, [embeddedInAicgText, nodeData]);

  const patchScriptData = useCallback(
    (patch: Record<string, unknown>) => {
      if (!embeddedInAicgText) {
        canvasStoreApi.updateNodeData(id, patch);
        return;
      }
      const latestNode = canvasStoreApi.getNodes().find((node) => node.id === id);
      const latestData = (latestNode?.data || {}) as Record<string, unknown>;
      const prev = (latestData.scriptParams || nodeData.scriptParams || {}) as Record<
        string,
        unknown
      >;
      canvasStoreApi.updateNodeData(id, { ...patch, scriptParams: { ...prev, ...patch } });
    },
    [embeddedInAicgText, id, nodeData.scriptParams]
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingFrames, setIsGeneratingFrames] = useState(false);
  const [localScript, setLocalScript] = useState(scriptSource.script || '');
  const [localScenes, setLocalScenes] = useState<Scene[]>(scriptSource.scenes || []);
  const [scriptType, setScriptType] = useState(scriptSource.scriptType || 'cinematic');
  const [tone, setTone] = useState(scriptSource.tone || 'casual');
  const [scriptSourceMode, setScriptSourceMode] = useState<ScriptNodeData['scriptSourceMode']>(
    scriptSource.scriptSourceMode || 'text'
  );
  const [referenceVideoUrl, setReferenceVideoUrl] = useState(scriptSource.referenceVideoUrl || '');
  const [referenceCharacterNote, setReferenceCharacterNote] = useState(
    scriptSource.referenceCharacterNote || ''
  );
  const [isOptimizingStoryboardPrompt, setIsOptimizingStoryboardPrompt] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(String(nodeData.aspectRatio || '9:16'));
  const [targetDuration, setTargetDuration] = useState(Number(nodeData.targetDuration || 30));
  const [storyboardOutputMode, setStoryboardOutputMode] = useState<StoryboardOutputMode>(
    resolveStoryboardOutputMode(scriptSource.storyboardOutputMode).id
  );
  const [storyboardPanelCount, setStoryboardPanelCount] = useState<StoryboardPanelCount>(() =>
    resolveStoryboardPanelCount(scriptSource.storyboardPanelCount)
  );
  const [storyboardImageProvider, setStoryboardImageProvider] = useState<StoryboardDoubaoSeedreamProvider>(
    () => resolveStoryboardImageModelConfig(scriptSource.storyboardImageProvider).provider
  );
  const storyboardOutputConfig = useMemo(
    () => resolveStoryboardOutputMode(storyboardOutputMode, storyboardPanelCount),
    [storyboardOutputMode, storyboardPanelCount]
  );
  // 基于模式获取可用模型
  const { models: allModels } = useNodeModels('script');
  // 硬编码作为 fallback，优先从 script.json 配置的 fallbackModels 中读取
  const modeModels = useMemo(() => {
    // 优先从 script.json 配置的 fallbackModels 中读取允许的模型列表
    const policy = nodeModelMatcher.getModelPolicy('script');
    const configuredModelIds = policy?.fallbackModels?.map((m) => m.modelId) || [];
    const allowed =
      configuredModelIds.length > 0
        ? configuredModelIds
        : SCRIPT_MODE_MODEL_MAP[scriptSourceMode] || SCRIPT_MODE_MODEL_MAP.text;
    return allModels.filter((m) => allowed.includes(m.modelId));
  }, [allModels, scriptSourceMode]);
  const modelOptions = useMemo(
    () => modeModels.map((m) => ({ value: m.modelId, label: m.modelInfo?.name || m.modelId })),
    [modeModels]
  );
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(Boolean(scriptSource.isPropertiesOpen));
  const [isComposing, setIsComposing] = useState(false);
  const [isScriptFocused, setIsScriptFocused] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState<'save' | 'load' | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<ScriptTemplateSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFileRef = useRef<HTMLInputElement>(null);
  const autoGenerateFramesAfterPlanRef = useRef(false);
  const storeNodes = useCanvasStore((state) => state.nodes);
  const storeEdges = useCanvasStore((state) => state.edges);

  const storyboardReferenceBundle = useMemo(() => {
    const storedRefs = buildStoredStoryboardReferences(scriptSource as Record<string, unknown>);
    const connectedRefs = collectConnectedStoryboardReferences(
      id as string,
      storeNodes,
      storeEdges
    );
    return mergeStoryboardReferences(storedRefs, connectedRefs);
  }, [id, scriptSource, storeEdges, storeNodes]);
  const storyboardInputText = useMemo(
    () => uniqueStrings([localScript, ...storyboardReferenceBundle.text]).join('\n\n'),
    [localScript, storyboardReferenceBundle.text]
  );
  const storyboardVideoReferences = useMemo(
    () => uniqueStrings([referenceVideoUrl, ...storyboardReferenceBundle.video]),
    [referenceVideoUrl, storyboardReferenceBundle.video]
  );
  const storyboardReferenceCount = storyboardReferenceBundle.all.length;
  const storyboardImageModelConfig = useMemo(
    () => resolveStoryboardImageModelConfig(storyboardImageProvider),
    [storyboardImageProvider]
  );

  useEffect(() => {
    if (!isComposing && !isScriptFocused) setLocalScript(scriptSource.script || '');
  }, [scriptSource.script, isComposing, isScriptFocused]);
  useEffect(() => {
    const latestNode = canvasStoreApi.getNodes().find((node) => node.id === id);
    const latestData = (latestNode?.data || {}) as Record<string, unknown>;
    const latestParams = latestData.scriptParams as Record<string, unknown> | undefined;
    const latestScenes = embeddedInAicgText
      ? latestParams?.scenes || latestData.scenes || scriptSource.scenes || []
      : latestData.scenes || scriptSource.scenes || [];
    const incomingScenes = Array.isArray(latestScenes) ? (latestScenes as Scene[]) : [];

    try {
      if (JSON.stringify(incomingScenes) === JSON.stringify(localScenes)) return;
    } catch {
      // Fall through and sync when scene payloads are not serializable.
    }

    if (incomingScenes.length === 0) return;
    setLocalScenes(incomingScenes);
  }, [embeddedInAicgText, id, localScenes, scriptSource.scenes]);

  const totalDuration = useMemo(
    () => localScenes.reduce((sum, s) => sum + s.duration, 0),
    [localScenes]
  );

  const persistScenesToStore = useCallback(
    (scenes: Scene[]) => {
      const latestNode = canvasStoreApi.getNodes().find((node) => node.id === id);
      const latestData = (latestNode?.data || {}) as Record<string, unknown>;

      if (embeddedInAicgText) {
        const prev = (latestData.scriptParams || {}) as Record<string, unknown>;
        canvasStoreApi.updateNodeData(id, { scenes, scriptParams: { ...prev, scenes } });
        return;
      }

      canvasStoreApi.updateNodeData(id, { scenes });
    },
    [embeddedInAicgText, id]
  );

  const setScenes = useCallback(
    (scenes: Scene[]) => {
      setLocalScenes(scenes);
      const outputPrompt = isStoryboardMaker
        ? buildStoryboardOutputPrompt(scenes, aspectRatio)
        : undefined;
      // 仅保留立即持久化 + useEffect 兜底，移除 rAF 和 setTimeout 的冗余调用以避免竞态
      persistScenesToStore(scenes);
      if (outputPrompt) {
        canvasStoreApi.updateNodeData(id, { outputPrompt, prompt: outputPrompt });
      }
      if (scenes.length > 0) {
        syncDownstreamFromNode(id as string);
      }
    },
    [aspectRatio, id, isStoryboardMaker, persistScenesToStore]
  );

  useEffect(() => {
    if (localScenes.length === 0) return;
    persistScenesToStore(localScenes);
  }, [localScenes, persistScenesToStore]);

  // ==================== Parse ====================

  const parseScriptLocally = useCallback((text: string): Scene[] => {
    const inferShotType = (desc: string): string => {
      if (/特写|近景|面部|表情|眼神|微距/.test(desc)) return 'closeup';
      if (/全景|远景|大场景|航拍|俯瞰|鸟瞰|广角/.test(desc))
        return desc.includes('航拍') ? 'aerial' : 'wide';
      if (/跟随|追踪|奔跑|追逐|运动/.test(desc)) return 'tracking';
      if (/主观|第一人称|pov/i.test(desc)) return 'pov';
      if (/细节|纹理|局部/.test(desc)) return 'detail';
      return 'medium';
    };
    const inferCameraMovement = (desc: string): string => {
      if (/推|拉近|推进|dolly/i.test(desc)) return 'dolly';
      if (/摇|横扫|pan/i.test(desc)) return 'pan';
      if (/俯|仰|tilt/i.test(desc)) return 'tilt';
      if (/环绕|旋转|orbit/i.test(desc)) return 'orbit';
      if (/手持|晃动|抖动|handheld/i.test(desc)) return 'handheld';
      if (/摇臂|crane|升降/i.test(desc)) return 'crane';
      return 'static';
    };
    const inferDuration = (desc: string): number => {
      if (desc.length > 100) return 8;
      if (desc.length > 60) return 6;
      if (desc.length < 20) return 3;
      return 5;
    };

    let rawScenes: Scene[] = [];
    const taggedPattern = /【[^】]*】/;

    if (taggedPattern.test(text)) {
      const parts = text
        .split(/(?=【[^】]*】)/g)
        .filter((p) => p.trim())
        .map((p) => p.trim());
      rawScenes = parts.map((part) => {
        const desc = part.replace(/^【[^】]*】\s*/, '').trim();
        return {
          id: generateId(),
          description: desc,
          duration: inferDuration(desc),
          shotType: inferShotType(desc),
          cameraMovement: inferCameraMovement(desc),
          transition: 'cut',
          status: 'pending' as const,
        };
      });
    } else if (/\d+[.、)\]]\s/.test(text)) {
      const parts = text
        .split(/(?=\d+[.、)\]]\s)/g)
        .filter((p) => p.trim())
        .map((p) => p.trim());
      rawScenes = parts.map((part) => {
        const desc = part.replace(/^\d+[.、)\]]\s*/, '').trim();
        return {
          id: generateId(),
          description: desc,
          duration: inferDuration(desc),
          shotType: inferShotType(desc),
          cameraMovement: inferCameraMovement(desc),
          transition: 'cut',
          status: 'pending' as const,
        };
      });
    } else {
      const paragraphs = text
        .split(/\n\n+/)
        .filter((p) => p.trim())
        .map((p) => p.trim());
      if (paragraphs.length >= 2) {
        rawScenes = paragraphs.map((desc) => ({
          id: generateId(),
          description: desc.replace(/^[-•*]\s*/, '').trim(),
          duration: inferDuration(desc),
          shotType: inferShotType(desc),
          cameraMovement: inferCameraMovement(desc),
          transition: 'cut',
          status: 'pending' as const,
        }));
      } else {
        const lines = text
          .split(/\n+/)
          .filter((l) => l.trim())
          .map((l) => l.trim());
        if (lines.length >= 2) {
          rawScenes = lines.map((desc) => ({
            id: generateId(),
            description: desc.replace(/^[-•*]\s*/, '').trim(),
            duration: inferDuration(desc),
            shotType: inferShotType(desc),
            cameraMovement: inferCameraMovement(desc),
            transition: 'cut',
            status: 'pending' as const,
          }));
        } else {
          const sentences = text
            .split(/[。！？；]/)
            .filter((s) => s.trim().length > 5)
            .map((s) => s.trim());
          if (sentences.length >= 2) {
            rawScenes = sentences.map((desc) => ({
              id: generateId(),
              description: desc,
              duration: inferDuration(desc),
              shotType: inferShotType(desc),
              cameraMovement: inferCameraMovement(desc),
              transition: 'cut',
              status: 'pending' as const,
            }));
          } else {
            // 智能拆分：短文本按逗号/分句拆分，至少生成3个镜头
            const clauses = text
              .split(/[，,;；、\n]/)
              .filter((c) => c.trim().length > 2)
              .map((c) => c.trim());
            if (clauses.length >= 3) {
              rawScenes = clauses.map((desc, i) => ({
                id: generateId(),
                description: desc,
                duration: inferDuration(desc),
                shotType: i === 0 ? 'wide' : i === clauses.length - 1 ? 'closeup' : 'medium',
                cameraMovement: i === 0 ? 'static' : 'dolly',
                transition: 'cut',
                status: 'pending' as const,
              }));
            } else if (clauses.length === 2) {
              // 两段话扩展为4个镜头：定场+第一段+第二段+收尾
              const shortText = text.trim();
              const expandedScenes: Scene[] = [
                {
                  id: generateId(),
                  description: `开阔的场景环境，${shortText} — 远景建立镜头，展示完整空间关系和环境氛围`,
                  duration: 5,
                  shotType: 'wide',
                  cameraMovement: 'static',
                  transition: 'cut',
                  status: 'pending' as const,
                },
                {
                  id: generateId(),
                  description: `${clauses[0]} — 中景镜头，柔和自然光，主体清晰可见`,
                  duration: 5,
                  shotType: 'medium',
                  cameraMovement: 'dolly',
                  transition: 'cut',
                  status: 'pending' as const,
                },
                {
                  id: generateId(),
                  description: `${clauses[1]} — 镜头推进，细节逐渐显现`,
                  duration: 5,
                  shotType: 'medium',
                  cameraMovement: 'dolly',
                  transition: 'dissolve',
                  status: 'pending' as const,
                },
                {
                  id: generateId(),
                  description: `${shortText} — 特写收尾镜头，浅景深强调关键元素，电影感光影`,
                  duration: 5,
                  shotType: 'closeup',
                  cameraMovement: 'static',
                  transition: 'fade',
                  status: 'pending' as const,
                },
              ];
              return expandedScenes.map((s) => enrichScene(s));
            } else {
              // 只有一句话，扩展为3个镜头
              const shortText = text.trim();
              const expandedScenes: Scene[] = [
                {
                  id: generateId(),
                  description: `${shortText} — 广角定场镜头，展现完整场景，自然光照明，电影感宽银幕构图`,
                  duration: 5,
                  shotType: 'wide',
                  cameraMovement: 'crane',
                  transition: 'cut',
                  status: 'pending' as const,
                },
                {
                  id: generateId(),
                  description: `${shortText} — 中景推进镜头，聚焦主体细节，柔光环境，浅景深突出层次`,
                  duration: 5,
                  shotType: 'medium',
                  cameraMovement: 'dolly',
                  transition: 'dissolve',
                  status: 'pending' as const,
                },
                {
                  id: generateId(),
                  description: `${shortText} — 特写镜头，极浅景深，戏剧性侧光，细腻纹理和质感`,
                  duration: 5,
                  shotType: 'closeup',
                  cameraMovement: 'static',
                  transition: 'fade',
                  status: 'pending' as const,
                },
              ];
              return expandedScenes.map((s) => enrichScene(s));
            }
          }
        }
      }
    }

    if (rawScenes.length > 0 && rawScenes.length < 3) {
      const sourceText = text.trim();
      const first = rawScenes[0]?.description || sourceText;
      const last = rawScenes[rawScenes.length - 1]?.description || sourceText;
      while (rawScenes.length < 3) {
        const isClosing = rawScenes.length === 2;
        rawScenes.push({
          id: generateId(),
          description: isClosing
            ? `${last} — 特写收尾镜头，浅景深强调关键情绪与视觉细节，形成完整分镜闭环`
            : `${first} — 中景推进镜头，补充主体动作、环境关系与电影感光影层次`,
          duration: 5,
          shotType: isClosing ? 'closeup' : 'medium',
          cameraMovement: isClosing ? 'static' : 'dolly',
          transition: isClosing ? 'fade' : 'dissolve',
          status: 'pending' as const,
        });
      }
    }

    return rawScenes.map((scene, idx) => {
      const enhanced = enrichScene(scene);
      if (idx > 0) {
        if (/时间.*过|之后|接着|然后|随后|later/i.test(scene.description))
          enhanced.transition = 'dissolve';
        else if (/场景.*切换|转到|切换|另一边|同时/i.test(scene.description))
          enhanced.transition = 'cut';
        else if (/回忆|过去|曾经|从前|小时候/i.test(scene.description))
          enhanced.transition = 'fade';
        else if (rawScenes[idx - 1].description.length > 80 && scene.description.length > 80)
          enhanced.transition = 'dissolve';
      }
      return enhanced;
    });
  }, []);

  const handleGeneratedScenes = useCallback(
    (scenes: Scene[]) => {
      if (!isStoryboardMaker) {
        setScenes(scenes);
        return;
      }

      const normalizeInput = {
        premise: storyboardInputText || '根据已连接素材规划故事版',
        aspectRatio,
        targetDuration,
        format: scriptType,
        tone,
      };
      const baseScenes = normalizeProfessionalScenes(scenes, normalizeInput);
      const normalizedScenes = storyboardOutputConfig.requiredShotCount
        ? ensureStoryboardSceneCount(
            baseScenes,
            normalizeInput,
            storyboardOutputConfig.requiredShotCount
          )
        : baseScenes;
      setScenes(normalizedScenes);
      if (normalizedScenes.length === 0) {
        autoGenerateFramesAfterPlanRef.current = false;
        return;
      }

      const imageModelConfig = resolveStoryboardImageModelConfig(storyboardImageProvider);
      const plan = scenesToStoryboardPlan({
        scenes: normalizedScenes,
        premise: localScript.trim() || '根据已连接素材规划故事版',
        aspectRatio,
        targetDuration: normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0),
        format: scriptType,
        modelId: imageModelConfig.modelId,
        provider: imageModelConfig.provider,
        referenceImageUrls: storyboardReferenceBundle.all,
      });
      const warnings = validateStoryboardPlanContinuity(plan, {
        reference: storyboardReferenceBundle.primary,
        characterRef: storyboardReferenceBundle.character[0],
      });
      patchScriptData({
        storyboardPlan: plan,
        storyboardWarnings: warnings,
        storyboardStage: 'plan',
      });
    },
    [
      aspectRatio,
      isStoryboardMaker,
      localScript,
      patchScriptData,
      scriptType,
      setScenes,
      storyboardInputText,
      storyboardOutputConfig.requiredShotCount,
      storyboardReferenceBundle,
      targetDuration,
      tone,
    ]
  );

  const generateScenes = useCallback(
    async (generateFramesAfterPlan = false) => {
      const requestedText = isStoryboardMaker ? storyboardInputText : localScript.trim();
      let mode = scriptSourceMode || 'text';
      if (isStoryboardMaker && mode === 'text' && !requestedText) {
        if (storyboardVideoReferences.length > 0) mode = 'video_reference';
        else if (storyboardReferenceCount > 0) mode = 'image_reference';
        else if (storyboardReferenceBundle.character.length > 0) mode = 'character_reference';
      }
      if (mode === 'text' && !requestedText) return;
      if (mode === 'image_reference' && storyboardReferenceCount === 0 && !requestedText) {
        toast.error('请上传图片参考、连接图片节点，或补充文字说明');
        return;
      }
      if (mode === 'video_reference' && storyboardVideoReferences.length === 0 && !requestedText) {
        toast.error('请上传参考视频或填写视频描述');
        return;
      }
      if (
        mode === 'character_reference' &&
        storyboardReferenceBundle.character.length === 0 &&
        !referenceCharacterNote.trim() &&
        !requestedText
      ) {
        toast.error('请填写角色设定或参考描述');
        return;
      }
      if (isStoryboardMaker) {
        autoGenerateFramesAfterPlanRef.current = shouldAutoGenerateFramesAfterPlanning(
          generateFramesAfterPlan
        );
      }
      setIsGenerating(true);
      setAiError(null);
      const prePrompt = isStoryboardMaker
        ? buildProfessionalStoryboardPrompt({
            premise: requestedText || referenceCharacterNote.trim() || '根据已连接素材规划完整故事',
            aspectRatio,
            targetDuration,
            format: scriptType,
            tone,
            outputMode: storyboardOutputMode,
            panelCount: storyboardPanelCount,
            visualReferenceCount: storyboardReferenceBundle.visual.length,
            characterReferenceCount: storyboardReferenceBundle.character.length,
          })
        : buildScriptParserPrePrompt(scriptType, tone);

      const videoAnalysisBlocks =
        mode === 'video_reference'
          ? await Promise.all(
              storyboardVideoReferences.map(async (videoUrl, index) => {
                if (videoUrl.startsWith('blob:'))
                  return `视频参考 ${index + 1}：本地视频，保留用户文字描述中的节奏与内容。`;
                const analysisResult = await analyzeVideoForScript(videoUrl, requestedText);
                return analysisResult.success && analysisResult.analysis
                  ? `视频参考 ${index + 1} 分析：\n${analysisResult.analysis}`
                  : `视频参考 ${index + 1}：${videoUrl}`;
              })
            )
          : [];
      const videoAnalysisText = videoAnalysisBlocks.join('\n\n');

      let userPrompt = '';
      const visualReferenceInstruction =
        buildStoryboardVisualReferenceInstruction(storyboardReferenceBundle);
      if (mode === 'video_reference') {
        const videoReferenceList = storyboardVideoReferences
          .map((url, index) => `视频 ${index + 1}：${url}`)
          .join('\n');
        userPrompt = videoAnalysisText
          ? `参考以下多个视频分析结果，生成匹配的专业分镜脚本（JSON 数组）：\n${videoAnalysisText}\n\n补充说明：${requestedText || '无'}`
          : videoReferenceList
            ? `参考以下多个视频的节奏与运镜，生成匹配的专业分镜脚本（JSON 数组）：\n${videoReferenceList}\n\n补充说明：${requestedText || '无'}`
            : `根据以下视频风格描述生成分镜脚本：\n${requestedText}`;
        if (visualReferenceInstruction) userPrompt += `\n\n${visualReferenceInstruction}`;
      } else if (mode === 'image_reference') {
        userPrompt = [
          '请基于输入的图片参考生成完整故事版分镜脚本（JSON 数组）。',
          visualReferenceInstruction,
          requestedText
            ? `补充说明：\n${requestedText}`
            : '补充说明：请从参考图的版式、镜头顺序、人物动作和画面节奏中推导可执行分镜。',
          `参数：画幅 ${aspectRatio}，目标总时长 ${targetDuration} 秒，输出分镜表、角色/风格一致性约束、每镜头视频提示词。`,
        ]
          .filter(Boolean)
          .join('\n\n');
      } else if (mode === 'character_reference') {
        userPrompt = `角色设定：\n${referenceCharacterNote.trim()}\n\n剧情梗概：\n${requestedText || '请围绕角色生成 6 个连贯分镜'}`;
        if (visualReferenceInstruction) userPrompt += `\n\n${visualReferenceInstruction}`;
      } else if (isStoryboardMaker) {
        userPrompt = `请按“制作故事版”方案，把以下创意/脚本生成完整故事版。\n\n参数：画幅 ${aspectRatio}，目标总时长 ${targetDuration} 秒，输出分镜表、角色/风格一致性约束、每镜头视频提示词。\n\n内容：\n${requestedText}`;
        if (visualReferenceInstruction) userPrompt += `\n\n${visualReferenceInstruction}`;
      } else {
        userPrompt = `请将以下剧本解析为专业分镜：\n\n${localScript.trim()}`;
        if (visualReferenceInstruction) userPrompt += `\n\n${visualReferenceInstruction}`;
      }
      const fallbackParseText =
        requestedText ||
        (storyboardReferenceCount > 0
          ? '根据输入的图片参考生成故事版：定场镜头、主体动作发展、关键动作特写、情绪反应、收尾镜头'
          : userPrompt);

      try {
        const token = getAuthToken();
        const preferredProvider = (scriptSource.model as string | undefined) || undefined;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        const response = await fetch(`${API_BASE_URL}/ai/optimize-prompt-v3`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            prompt: userPrompt,
            scenario: 'video',
            category:
              scriptType === 'cinematic'
                ? 'film-director'
                : scriptType === 'story'
                  ? 'cinema-director'
                  : 'cinematic',
            prePrompt,
            preferredProvider,
            storyboardPlanning: isStoryboardMaker,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          setAiError('云端AI未响应，已使用本地专业解析引擎');
          const scenes = parseScriptLocally(fallbackParseText);
          handleGeneratedScenes(scenes);
          return;
        }

        const result = await response.json();
        const optimizedText = result.optimizedPrompt || '';
        if (optimizedText) {
          if (isStoryboardMaker) {
            const professionalScenes = parseProfessionalStoryboardResponse(optimizedText, {
              premise: requestedText || referenceCharacterNote.trim() || fallbackParseText,
              aspectRatio,
              targetDuration,
              format: scriptType,
              tone,
            });
            if (professionalScenes.length > 0) {
              handleGeneratedScenes(professionalScenes);
              return;
            }
          }
          const jsonMatch = optimizedText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              const scenesArr = JSON.parse(jsonMatch[0]);
              if (Array.isArray(scenesArr) && scenesArr.length > 0) {
                const scenes: Scene[] = scenesArr.map((s: Record<string, unknown>) => {
                  const baseScene: Scene = {
                    id: generateId(),
                    description: String(s.description || s.desc || s.content || ''),
                    duration: Number(s.duration) || 5,
                    shotType: String(s.shotType || s.shot_size || 'medium'),
                    cameraMovement: String(s.cameraMovement || s.camera_movement || 'static'),
                    transition: String(s.transition || 'cut'),
                    dialogue: s.dialogue ? String(s.dialogue) : undefined,
                    narration: s.narration ? String(s.narration) : undefined,
                    status: 'pending' as const,
                  };
                  return enrichScene(baseScene);
                });
                handleGeneratedScenes(
                  scenes.length >= 3
                    ? scenes
                    : parseScriptLocally(
                        scenes.map((scene) => scene.description).join('\n') || userPrompt
                      )
                );
                return;
              }
            } catch {
              /* fallback to local parse */
            }
          }
          const scenes = parseScriptLocally(optimizedText);
          if (scenes.length > 0) {
            handleGeneratedScenes(scenes);
            setAiError('AI已解析剧本，使用专业模式增强');
            return;
          }
        }

        const scenes = parseScriptLocally(fallbackParseText);
        handleGeneratedScenes(scenes);
      } catch (error) {
        console.error('[ScriptNode] AI优化失败，降级到本地解析:', error);
        const scenes = parseScriptLocally(fallbackParseText);
        handleGeneratedScenes(scenes);
        setAiError('云端AI未响应，已使用本地专业解析引擎');
      } finally {
        setIsGenerating(false);
      }
    },
    [
      aspectRatio,
      handleGeneratedScenes,
      isStoryboardMaker,
      localScript,
      parseScriptLocally,
      referenceCharacterNote,
      scriptSource.model,
      scriptSourceMode,
      scriptType,
      storyboardInputText,
      storyboardOutputMode,
      storyboardReferenceBundle,
      storyboardReferenceCount,
      storyboardVideoReferences,
      targetDuration,
      tone,
    ]
  );

  const optimizeStoryboardInput = useCallback(async () => {
    const source = localScript.trim();
    if (!source || isOptimizingStoryboardPrompt || isGenerating) return;

    setIsOptimizingStoryboardPrompt(true);
    try {
      const result = await promptOptimizerService.optimizePrompt(
        source,
        'video',
        'cinema-director',
        undefined,
        undefined,
        [
          '你是专业故事编辑、编剧与分镜导演助手。',
          '将用户输入的文章、故事梗概、零散想法或提示词整理为可直接用于故事版规划的中文创作输入。',
          `目标交付：${storyboardOutputConfig.label}，${storyboardOutputConfig.promptContract}`,
          `固定画幅：${storyboardOutputConfig.aspectRatio}；目标节奏：${targetDuration} 秒；叙事语气：${tone}。`,
          '保留原文中的人物、关系、事件、世界观、时间地点和明确的视觉要求；补足动机、冲突、转折、情绪和可视化动作。',
          '输出为连贯、精炼的中文故事版创作描述，可包含角色、场景、剧情节拍和视觉氛围；不要输出 JSON、编号、解释、标题或内部规则。',
        ].join('\n')
      );
      if (!result.success || !result.optimizedPrompt) {
        throw new Error(result.error || '输入优化失败');
      }

      const optimized = result.optimizedPrompt.trim();
      setLocalScript(optimized);
      patchScriptData({ script: optimized });
      syncDownstreamFromNode(id as string);
      toast.success('已优化为故事版创作输入');
    } catch (error) {
      toast.error((error as Error).message || '输入优化失败，请稍后重试');
    } finally {
      setIsOptimizingStoryboardPrompt(false);
    }
  }, [
    id,
    isGenerating,
    isOptimizingStoryboardPrompt,
    localScript,
    patchScriptData,
    storyboardOutputConfig,
    targetDuration,
    tone,
  ]);

  // ==================== Scene CRUD ====================

  const addScene = useCallback(() => {
    const newScene: Scene = {
      id: generateId(),
      description: '',
      duration: 5,
      shotType: 'medium',
      cameraMovement: 'static',
      transition: 'cut',
      status: 'pending',
    };
    setScenes([...localScenes, newScene]);
  }, [localScenes, setScenes]);

  const deleteScene = useCallback(
    (sceneId: string) => {
      setScenes(localScenes.filter((s) => s.id !== sceneId));
    },
    [localScenes, setScenes]
  );

  const duplicateScene = useCallback(
    (sceneId: string) => {
      const index = localScenes.findIndex((s) => s.id === sceneId);
      if (index < 0) return;
      const source = localScenes[index];
      const duplicate: Scene = {
        ...source,
        id: generateId(),
        status: 'pending',
        imageUrl: undefined,
        videoUrl: undefined,
      };
      const next = [...localScenes];
      next.splice(index + 1, 0, duplicate);
      setScenes(next);
    },
    [localScenes, setScenes]
  );

  const updateScene = useCallback(
    (sceneId: string, patch: Partial<Scene>) => {
      setScenes(localScenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)));
    },
    [localScenes, setScenes]
  );

  const moveScene = useCallback(
    (sceneId: string, direction: 'up' | 'down') => {
      const index = localScenes.findIndex((s) => s.id === sceneId);
      if (index < 0) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= localScenes.length) return;
      const next = [...localScenes];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      setScenes(next);
    },
    [localScenes, setScenes]
  );

  const enhanceSingleScene = useCallback(
    (sceneId: string) => {
      setScenes(localScenes.map((s) => (s.id === sceneId ? enrichScene(s) : s)));
    },
    [localScenes, setScenes]
  );

  const enhanceAllScenes = useCallback(() => {
    setScenes(localScenes.map((s) => enrichScene(s)));
  }, [localScenes, setScenes]);

  // ==================== Export / Import ====================

  const exportScript = useCallback(() => {
    const exportData = {
      script: localScript,
      scenes: localScenes,
      scriptType,
      tone,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [localScript, localScenes, scriptType, tone]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const file = files[0];
      if (!file) return;

      const videoFiles = files.filter((candidate) => candidate.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        const latestNode = canvasStoreApi.getNodes().find((node) => node.id === id);
        const latestData = (latestNode?.data || {}) as Record<string, unknown>;
        const nextVideoReferences = uniqueStrings([
          ...asStringArray(latestData.referenceVideoUrls),
          readFirstString(latestData.referenceVideoUrl),
          ...videoFiles.map((candidate) => URL.createObjectURL(candidate)),
        ]);
        setScriptSourceMode('video_reference');
        setReferenceVideoUrl(nextVideoReferences[0] || '');
        patchScriptData({
          scriptSourceMode: 'video_reference',
          referenceVideoUrl: nextVideoReferences[0],
          referenceVideoUrls: nextVideoReferences,
        });
        toast.warning(
          `已添加 ${videoFiles.length} 个视频参考；本地视频会使用文字描述和连接素材继续规划`
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const imageFiles = files.filter((candidate) => candidate.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        const latestNode = canvasStoreApi.getNodes().find((node) => node.id === id);
        const latestData = (latestNode?.data || {}) as Record<string, unknown>;
        const nextReferenceImages = uniqueStrings([
          ...asStringArray(latestData.referenceImageUrls),
          ...imageFiles.map((candidate) => URL.createObjectURL(candidate)),
        ]);
        setScriptSourceMode('image_reference');
        patchScriptData({
          scriptSourceMode: 'image_reference',
          referenceImageUrls: nextReferenceImages,
          referenceImage: nextReferenceImages[0],
          referenceImages: nextReferenceImages,
          imageUrl: nextReferenceImages[0],
          receivedImageUrl: nextReferenceImages[0],
          mediaType: 'image',
        });
        toast.success(`已添加 ${imageFiles.length} 张图片参考`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();

      const applyScriptText = (rawText: string) => {
        setLocalScript(rawText);
        patchScriptData({ script: rawText });
        toast.success(`已导入 ${file.name} (${rawText.length} 字符)`);
      };

      // .docx 需使用 mammoth 解析
      if (ext === 'docx') {
        file
          .arrayBuffer()
          .then((buf) =>
            import('mammoth').then((mammoth) => mammoth.extractRawText({ arrayBuffer: buf }))
          )
          .then((result: { value: string }) => {
            if (!result.value?.trim()) {
              setAiError('DOCX 文件内容为空');
              return;
            }
            applyScriptText(result.value);
          })
          .catch(() => setAiError('DOCX 解析失败，请尝试另存为 .txt'));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // 纯文本类格式直接读取
      if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'log') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const rawText = String(e.target?.result || '');
          if (!rawText.trim()) {
            setAiError('文件内容为空');
            return;
          }
          applyScriptText(rawText);
        };
        reader.onerror = () => setAiError('文件读取失败');
        reader.readAsText(file, 'utf-8');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // JSON 格式（结构化导入）
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const rawText = String(e.target?.result || '');
          const imported = JSON.parse(rawText);
          if (imported.script) {
            setLocalScript(imported.script);
            patchScriptData({ script: imported.script });
          }
          if (imported.scenes) setScenes(imported.scenes);
          if (imported.scriptType) {
            setScriptType(imported.scriptType);
            patchScriptData({ scriptType: imported.scriptType });
          }
          if (imported.tone) {
            setTone(imported.tone);
            patchScriptData({ tone: imported.tone });
          }
          if (imported.scriptSourceMode) {
            setScriptSourceMode(imported.scriptSourceMode);
            patchScriptData({ scriptSourceMode: imported.scriptSourceMode });
          }
          if (imported.referenceVideoUrl) {
            setReferenceVideoUrl(imported.referenceVideoUrl);
            patchScriptData({ referenceVideoUrl: imported.referenceVideoUrl });
          }
          if (imported.referenceCharacterNote) {
            setReferenceCharacterNote(imported.referenceCharacterNote);
            patchScriptData({ referenceCharacterNote: imported.referenceCharacterNote });
          }
        } catch (err) {
          console.error('[ScriptNode] 导入剧本失败:', err);
          setAiError('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [id, patchScriptData, setScenes]
  );

  // ==================== Templates ====================

  const refreshTemplates = useCallback(async () => {
    const list = await listTemplates();
    setSavedTemplates(list);
  }, []);

  const handleOpenTemplateDialog = useCallback(
    async (mode: 'save' | 'load') => {
      if (mode === 'load') await refreshTemplates();
      setTemplateName('');
      setTemplateMsg(null);
      setShowTemplateDialog(mode);
    },
    [refreshTemplates]
  );

  const handleSaveTemplate = useCallback(
    async (embedMedia: boolean) => {
      if (!templateName.trim()) {
        setTemplateMsg('请输入模板名称');
        return;
      }
      setIsSaving(true);
      setTemplateMsg(null);
      try {
        let scenesData: ScriptTemplateScene[] = localScenes.map((s, idx) => ({
          index: idx,
          description: s.description,
          duration: s.duration,
          shotType: s.shotType,
          cameraMovement: s.cameraMovement,
          transition: s.transition,
          professionalPrompt: s.professionalPrompt,
          lightingSetup: s.lightingSetup,
          moodAtmosphere: s.moodAtmosphere,
          compositionGuide: s.compositionGuide,
          colorGrading: s.colorGrading,
          depthOfField: s.depthOfField,
          dialogue: s.dialogue,
          narration: s.narration,
          imageUrl: s.imageUrl,
          videoUrl: s.videoUrl,
        }));
        if (embedMedia) {
          setIsEmbedding(true);
          try {
            scenesData = await embedSceneMedia(scenesData);
          } finally {
            setIsEmbedding(false);
          }
        }
        const template: ScriptTemplate = {
          id: `stpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: templateName.trim(),
          description: `${scenesData.length} 个分镜 · ${localScenes.reduce((sum, s) => sum + s.duration, 0)}秒`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          script: localScript,
          scriptType,
          tone,
          model: scriptSource.model as string | undefined,
          style: scriptSource.style as string | undefined,
          scenes: scenesData,
          sceneCount: scenesData.length,
          totalDuration: localScenes.reduce((sum, s) => sum + s.duration, 0),
        };
        const ok = await saveTemplate(template);
        if (ok) {
          setTemplateMsg(`模板"${templateName.trim()}"已保存到本地数据库`);
          setShowTemplateDialog(null);
        } else setTemplateMsg('保存失败，请重试');
      } catch {
        setTemplateMsg('保存失败');
      } finally {
        setIsSaving(false);
      }
    },
    [
      templateName,
      localScript,
      localScenes,
      scriptType,
      tone,
      scriptSource.model,
      scriptSource.style,
    ]
  );

  const handleDownloadTemplate = useCallback(
    async (embedMedia: boolean) => {
      if (!localScenes.length) return;
      setIsSaving(true);
      setTemplateMsg(null);
      try {
        let scenesData: ScriptTemplateScene[] = localScenes.map((s, idx) => ({
          index: idx,
          description: s.description,
          duration: s.duration,
          shotType: s.shotType,
          cameraMovement: s.cameraMovement,
          transition: s.transition,
          professionalPrompt: s.professionalPrompt,
          lightingSetup: s.lightingSetup,
          moodAtmosphere: s.moodAtmosphere,
          compositionGuide: s.compositionGuide,
          colorGrading: s.colorGrading,
          depthOfField: s.depthOfField,
          dialogue: s.dialogue,
          narration: s.narration,
          imageUrl: s.imageUrl,
          videoUrl: s.videoUrl,
        }));
        if (embedMedia) {
          setIsEmbedding(true);
          try {
            scenesData = await embedSceneMedia(scenesData);
          } finally {
            setIsEmbedding(false);
          }
        }
        const template: ScriptTemplate = {
          id: `stpl_${Date.now()}`,
          name: `${scriptSource.label || '剧本解析'}_${new Date().toISOString().slice(0, 10)}`,
          description: `${scenesData.length} 个分镜 · ${localScenes.reduce((sum, s) => sum + s.duration, 0)}秒`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          script: localScript,
          scriptType,
          tone,
          model: scriptSource.model as string | undefined,
          style: scriptSource.style as string | undefined,
          scenes: scenesData,
          sceneCount: scenesData.length,
          totalDuration: localScenes.reduce((sum, s) => sum + s.duration, 0),
        };
        downloadTemplateFile(template);
        setTemplateMsg('模板文件已下载');
      } catch {
        setTemplateMsg('导出失败');
      } finally {
        setIsSaving(false);
      }
    },
    [
      localScript,
      localScenes,
      scriptType,
      tone,
      scriptSource.model,
      scriptSource.style,
      scriptSource.label,
    ]
  );

  const handleLoadTemplate = useCallback(
    async (templateId: string) => {
      const template = await loadTemplate(templateId);
      if (!template) {
        setTemplateMsg('加载失败：模板不存在');
        return;
      }
      setLocalScript(template.script);
      patchScriptData({ script: template.script });
      const restoredScenes: Scene[] = template.scenes.map((s) => ({
        id: generateId(),
        description: s.description,
        duration: s.duration,
        shotType: s.shotType,
        cameraMovement: s.cameraMovement,
        transition: s.transition,
        professionalPrompt: s.professionalPrompt,
        lightingSetup: s.lightingSetup,
        moodAtmosphere: s.moodAtmosphere,
        compositionGuide: s.compositionGuide,
        colorGrading: s.colorGrading,
        depthOfField: s.depthOfField,
        dialogue: s.dialogue,
        narration: s.narration,
        imageUrl: s.imageDataUrl || s.imageUrl,
        videoUrl: s.videoDataUrl || s.videoUrl,
        status: 'pending' as const,
      }));
      setScenes(restoredScenes);
      setScriptType(template.scriptType);
      setTone(template.tone);
      patchScriptData({
        scriptType: template.scriptType,
        tone: template.tone,
        ...(template.model ? { model: template.model } : {}),
        ...(template.style ? { style: template.style } : {}),
      });
      setShowTemplateDialog(null);
      setTemplateMsg(`已加载模板"${template.name}"`);
    },
    [patchScriptData, setScenes]
  );

  const handleImportTemplateFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      importTemplateFromFile(file)
        .then((template) => {
          if (!template) {
            setTemplateMsg('导入失败：无效的模板文件');
            return;
          }
          setLocalScript(template.script);
          patchScriptData({ script: template.script });
          const restoredScenes: Scene[] = template.scenes.map((s) => ({
            id: generateId(),
            description: s.description,
            duration: s.duration,
            shotType: s.shotType,
            cameraMovement: s.cameraMovement,
            transition: s.transition,
            professionalPrompt: s.professionalPrompt,
            lightingSetup: s.lightingSetup,
            moodAtmosphere: s.moodAtmosphere,
            compositionGuide: s.compositionGuide,
            colorGrading: s.colorGrading,
            depthOfField: s.depthOfField,
            dialogue: s.dialogue,
            narration: s.narration,
            imageUrl: s.imageDataUrl || s.imageUrl,
            videoUrl: s.videoDataUrl || s.videoUrl,
            status: 'pending' as const,
          }));
          setScenes(restoredScenes);
          setScriptType(template.scriptType);
          setTone(template.tone);
          patchScriptData({
            scriptType: template.scriptType,
            tone: template.tone,
            ...(template.model ? { model: template.model } : {}),
            ...(template.style ? { style: template.style } : {}),
          });
          setShowTemplateDialog(null);
          setTemplateMsg(`已导入模板"${template.name}"`);
        })
        .catch(() => {
          setTemplateMsg('导入失败：文件读取错误');
        })
        .finally(() => {
          if (templateFileRef.current) templateFileRef.current.value = '';
        });
    },
    [patchScriptData, setScenes]
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      await deleteTemplate(templateId);
      await refreshTemplates();
    },
    [refreshTemplates]
  );

  // ==================== Render ====================

  const currentScriptType = SCRIPT_TYPES.find((t) => t.value === scriptType);
  const hasScenes = localScenes.length > 0;
  const scriptInputRef = useRef<HTMLTextAreaElement>(null);

  const handleModeShortcut = useCallback(
    (mode: NonNullable<ScriptNodeData['scriptSourceMode']>) => {
      setScriptSourceMode(mode);
      patchScriptData({ scriptSourceMode: mode });
      requestAnimationFrame(() => setIsScriptFocused(true));
    },
    [patchScriptData]
  );

  const canGenerateScenes = isStoryboardMaker
    ? Boolean(
        storyboardInputText ||
        storyboardVideoReferences.length > 0 ||
        storyboardReferenceCount > 0 ||
        referenceCharacterNote.trim()
      )
    : scriptSourceMode === 'video_reference'
      ? Boolean(referenceVideoUrl.trim() || localScript.trim())
      : scriptSourceMode === 'image_reference'
        ? Boolean(storyboardReferenceCount > 0 || localScript.trim())
        : scriptSourceMode === 'character_reference'
          ? Boolean(
              storyboardReferenceBundle.character.length > 0 ||
              referenceCharacterNote.trim() ||
              localScript.trim()
            )
          : Boolean(localScript.trim());

  const scriptPlaceholder = isStoryboardMaker
    ? scriptSourceMode === 'image_reference'
      ? '上传或连接故事版图片、分镜表、动作草图，也可以补充剧情说明...'
      : '输入一句话创意、完整脚本、产品广告需求或小说片段，生成可执行故事版...'
    : scriptSourceMode === 'character_reference'
      ? '描述剧情或添加角色参考、视频参考等，为你生成分镜脚本'
      : scriptSourceMode === 'video_reference'
        ? '描述剧情或添加视频参考、节奏参考等，为你生成分镜脚本'
        : scriptSourceMode === 'image_reference'
          ? '上传或连接图片参考，补充剧情说明后生成分镜脚本'
          : '描述剧情或添加角色参考、视频参考等，为你生成分镜脚本';

  const {
    slashOpen,
    slashCommands,
    onTextChange: onSlashTextChange,
    applySlashCommand,
  } = useAICGSlashConnect(id as string, 'script', 'scenes');

  const scriptControllerPreset = useMemo(() => getNodeControllerPreset('script'), []);
  const scriptModeActions = useMemo<NodeControllerAction[]>(
    () =>
      scriptControllerPreset.tryActions.map((action) => ({
        ...action,
        state: action.id === scriptSourceMode ? 'ready' : 'idle',
        onClick: () =>
          handleModeShortcut(action.id as NonNullable<ScriptNodeData['scriptSourceMode']>),
      })),
    [handleModeShortcut, scriptControllerPreset.tryActions, scriptSourceMode]
  );
  const togglePropertiesOpen = useCallback(() => {
    setIsPropertiesOpen((prev) => {
      const next = !prev;
      patchScriptData({ isPropertiesOpen: next });
      return next;
    });
  }, [patchScriptData]);

  const handleBuildScriptWorkflow = useCallback(() => {
    spawnScriptWorkflowChain(id as string, {
      script: localScript,
      scenes: localScenes,
      scriptType,
      tone,
    });
  }, [id, localScenes, localScript, scriptType, tone]);

  const handleOpenStoryboardEdit = useCallback(
    (replaceExisting = false) => {
      const scenesText =
        localScenes.length > 0 ? JSON.stringify(localScenes, null, 2) : localScript;
      spawnControllerToolNode(id as string, 'storyboardEdit', {
        controllerActionId: 'script-to-storyboard-edit',
        replaceExisting,
        label: '分镜编辑',
        toastLabel: '分镜编辑',
        sourceHandle: localScenes.length > 0 ? 'scenes' : 'script',
        targetHandle: 'scriptInput',
        initialData: {
          prompt: scenesText,
          outputText: scenesText,
          outputPrompt: scenesText,
          params: {
            prompt: scenesText,
            editMode: 'shot_reorder',
            preserveContinuity: true,
          },
        },
      });
    },
    [id, localScenes, localScript]
  );

  const handleGenerateStoryboardFrames = useCallback(async () => {
    if (localScenes.length === 0) {
      toast.error('请先生成并确认分镜方案');
      return;
    }
    if (isGeneratingFrames) return;
    const referenceImages = storyboardReferenceBundle.all.slice(0, 6);
    const primaryReferenceImage = storyboardReferenceBundle.primary;
    const imageModelConfig = resolveStoryboardImageModelConfig(storyboardImageProvider);
    const { grid } = storyboardOutputConfig;
    const cols = grid.cols;
    const rows = grid.rows;
    const deliverablePrompt = [
      storyboardInputText,
      buildStoryboardOutputPrompt(localScenes, storyboardOutputConfig.aspectRatio),
      storyboardOutputConfig.promptContract,
      buildStoryboardVisualReferenceInstruction(storyboardReferenceBundle),
    ]
      .filter(Boolean)
      .join('\n\n');
    const plan = scenesToStoryboardPlan({
      scenes: localScenes,
      premise: storyboardInputText || '根据连接素材生成故事版',
      aspectRatio: storyboardOutputConfig.aspectRatio,
      targetDuration: totalDuration || targetDuration,
      format: scriptType,
      modelId: imageModelConfig.modelId,
      provider: imageModelConfig.provider,
      referenceImageUrls: referenceImages,
    });
    const cells = buildStoryboardCellsFromPlan({
      plan,
      rows,
      cols,
      basePrompt: deliverablePrompt,
    });
    const warnings = validateStoryboardPlanContinuity(plan, {
      reference: primaryReferenceImage,
      characterRef: storyboardReferenceBundle.character[0],
    });
    const blockingWarnings = warnings.filter((warning) => warning.severity === 'error');
    if (blockingWarnings.length > 0) {
      toast.error(`请先修正 ${blockingWarnings.length} 个不可执行镜头`);
      patchScriptData({
        storyboardPlan: plan,
        storyboardWarnings: warnings,
        storyboardStage: 'plan',
        storyboardOutputMode,
        storyboardPanelCount,
        storyboardOutputSize: storyboardOutputConfig.imageSize,
      });
      return;
    }
    if (warnings.filter((w) => w.severity === 'warning').length > 0) {
      toast.warning(
        `分镜连续性检查：${warnings.filter((w) => w.severity === 'warning').length} 条建议`
      );
    }
    patchScriptData({
      storyboardPlan: plan,
      storyboardWarnings: warnings,
      storyboardStage: 'confirmed',
      storyboardOutputMode,
      storyboardPanelCount,
      storyboardOutputSize: storyboardOutputConfig.imageSize,
    });

    const queueTask = startStoryboardQueueTask({
      nodeId: id as string,
      modelId: imageModelConfig.modelId,
      modelProvider: imageModelConfig.provider,
      modelName: imageModelConfig.label,
      promptPreview: `${storyboardOutputConfig.label} · ${storyboardInputText || localScenes[0]?.description || '故事版生成'}`.slice(0, 120),
    });
    if (!queueTask) {
      toast.info('已有一个 12 宫格分镜正在生成，请完成后再生成下一段');
      return;
    }
    setIsGeneratingFrames(true);
    patchScriptData({
      frameResults: [],
      gridImageUrl: undefined,
      coverImageUrl: undefined,
      storyboardPayload: undefined,
      storyboardPlan: plan,
      storyboardCells: cells,
      storyboardWarnings: warnings,
      storyboardStage: 'generating',
      task: queueTask,
    });

    try {
      const sheetPrompt = buildSingleStoryboardSheetPrompt({
        premise: storyboardInputText || '根据已确认方案生成完整故事板',
        style: String(scriptSource.style || '电影感写实'),
        scenes: localScenes,
        outputMode: storyboardOutputMode,
        panelCount: storyboardPanelCount,
      });
      const result = await runSingleStoryboardSheetExecution({
        nodeId: id as string,
        prompt: sheetPrompt,
        provider: storyboardImageProvider,
        referenceImages,
        getAuthToken,
        apiBaseUrl: API_BASE_URL,
        onProgress: (progress) => {
          const nextTask = updateStoryboardQueueTask(queueTask.id, {
            status: 'processing',
            progress,
          });
          patchScriptData({ task: nextTask || { ...queueTask, progress } });
        },
      });
      const frameResults: GridDirectorFrameResult[] = [
        {
          cellIndex: 0,
          rowIndex: 0,
          colIndex: 0,
          imageUrl: result.imageUrl,
          status: 'succeeded',
          label: storyboardOutputConfig.label,
          prompt: sheetPrompt,
        },
      ];
      const storyboardPayload = buildStoryboardPayload({
        sourceNodeType: 'storyboardMaker',
        gridImageUrl: result.imageUrl,
        coverImageUrl: result.imageUrl,
        selectedFrameIndex: 0,
        processingMode: 'selected',
        plan,
        frames: [
          {
            cellIndex: 0,
            rowIndex: 0,
            colIndex: 0,
            imageUrl: result.imageUrl,
            prompt: sheetPrompt,
            status: 'succeeded',
            label: storyboardOutputConfig.label,
          },
        ],
        continuityWarnings: warnings,
        providerTrace: [
          {
            frameIndex: 0,
            provider: imageModelConfig.provider,
            model: imageModelConfig.modelId,
            endpoint: referenceImages.length > 0 ? 'edits' : 'generations',
            size: storyboardOutputConfig.imageSize,
            quality: 'medium',
            outputFormat: 'png',
          },
        ],
        costEstimate: {
          frameCount: 1,
          quality: 'medium',
          size: storyboardOutputConfig.imageSize,
          riskLevel: 'low',
          notes: [`单次生成一张${storyboardOutputConfig.label}宫格成品`],
        },
      });
      const completedTask = updateStoryboardQueueTask(queueTask.id, {
        status: 'completed',
        progress: 100,
        resultUrl: result.imageUrl,
      });
      patchScriptData({
        frameResults,
        gridImageUrl: result.imageUrl,
        coverImageUrl: result.imageUrl,
        storyboardPayload,
        storyboardPlan: plan,
        storyboardStage: 'generated',
        task: completedTask || {
          ...queueTask,
          status: 'completed',
          progress: 100,
          resultUrl: result.imageUrl,
        },
      });
      syncDownstreamFromNode(id as string);
      toast.success(`${storyboardOutputConfig.label}生成完成`, {
        description: `已生成一张${storyboardOutputConfig.label}宫格成品`,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : '分镜生成失败';
      const failedTask = updateStoryboardQueueTask(queueTask.id, {
        status: 'failed',
        progress: 100,
        error: message,
      });
      patchScriptData({
        storyboardStage: 'failed',
        task: failedTask || {
          ...queueTask,
          status: 'failed',
          progress: 100,
          error: message,
        },
      });
      toast.error(`${storyboardOutputConfig.label}生成失败`, { description: message });
    } finally {
      setIsGeneratingFrames(false);
    }
  }, [
    id,
    isGeneratingFrames,
    localScenes,
    patchScriptData,
    scriptSource.style,
    scriptType,
    storyboardInputText,
    storyboardOutputConfig,
    storyboardOutputMode,
    storyboardPanelCount,
    storyboardImageProvider,
    storyboardReferenceBundle,
    targetDuration,
    totalDuration,
  ]);

  useEffect(() => {
    if (!autoGenerateFramesAfterPlanRef.current) return;
    if (isGenerating || isGeneratingFrames || localScenes.length === 0) return;
    autoGenerateFramesAfterPlanRef.current = false;
    void handleGenerateStoryboardFrames();
  }, [handleGenerateStoryboardFrames, isGenerating, isGeneratingFrames, localScenes.length]);

  const scriptLauncherActions = useMemo<NodeControllerAction[]>(() => {
    const storyboardEditAction = withControllerActionConnection({
      sourceNodeId: id as string,
      action: {
        id: 'script-to-storyboard-edit',
        label: '分镜编辑',
        icon: 'split',
        title: '展开分镜编辑轻节点',
        disabled: !localScript.trim() && localScenes.length === 0,
        onClick: () => handleOpenStoryboardEdit(),
      },
      binding: {
        actionId: 'script-to-storyboard-edit',
        nodeType: 'storyboardEdit',
        onReplace: () => handleOpenStoryboardEdit(true),
      },
    });

    const generateAction: NodeControllerAction = {
      id: 'generate-scenes',
      label: isStoryboardMaker ? '生成故事版' : 'AI拆镜',
      icon: 'sparkles',
      tone: 'primary',
      disabled: isGenerating || !canGenerateScenes,
      onClick: () => void generateScenes(),
    };

    if (!isStoryboardMaker) return [generateAction];

    return [
      ...scriptModeActions,
      generateAction,
      {
        id: 'build-script-workflow',
        label: '组合拆解',
        icon: 'grid',
        title: '自动生成角色、场景、分镜、图片、视频、合成与成片交付链路',
        onClick: handleBuildScriptWorkflow,
      },
      storyboardEditAction,
    ];
  }, [
    canGenerateScenes,
    generateScenes,
    handleBuildScriptWorkflow,
    handleOpenStoryboardEdit,
    id,
    isGenerating,
    isStoryboardMaker,
    localScenes.length,
    localScript,
    scriptModeActions,
  ]);
  const scriptSummaryItems = useMemo(
    () => [
      { id: 'scenes', label: `${localScenes.length} 镜头`, title: '分镜数量' },
      { id: 'duration', label: `${totalDuration}s`, title: '总时长' },
      { id: 'type', label: currentScriptType?.label || scriptType, title: '剧本类型' },
      {
        id: 'mode',
        label:
          SCRIPT_SOURCE_COMPACT_OPTIONS.find((item) => item.value === scriptSourceMode)?.label ||
          '剧本拆镜',
        title: '拆镜模式',
      },
    ],
    [currentScriptType?.label, localScenes.length, scriptSourceMode, scriptType, totalDuration]
  );

  const storyboardLauncherActions = useMemo(
    () => scriptLauncherActions.filter((action) => action.id !== 'toggle-properties'),
    [scriptLauncherActions]
  );

  const getStoryboardActionIcon = useCallback((action: NodeControllerAction) => {
    if (action.id === 'video_reference') return Camera;
    if (action.id === 'image_reference') return Upload;
    if (action.id === 'character_reference') return Eye;
    if (action.id === 'build-script-workflow') return LayoutGrid;
    if (action.id === 'script-to-storyboard-edit') return Palette;
    return Wand2;
  }, []);

  const storyboardWarnings = useMemo(() => {
    if (!isStoryboardMaker || localScenes.length === 0) return [];
    const imageModelConfig = resolveStoryboardImageModelConfig(storyboardImageProvider);
    const plan = scenesToStoryboardPlan({
      scenes: localScenes,
      premise: localScript || '故事版分镜',
      aspectRatio,
      targetDuration: totalDuration || targetDuration,
      format: scriptType,
      modelId: imageModelConfig.modelId,
      provider: imageModelConfig.provider,
      referenceImageUrls: storyboardReferenceBundle.all,
    });
    return validateStoryboardPlanContinuity(plan, {
      reference: storyboardReferenceBundle.primary,
      characterRef: storyboardReferenceBundle.character[0],
    });
  }, [
    aspectRatio,
    isStoryboardMaker,
    localScenes,
    localScript,
    scriptType,
    storyboardReferenceBundle,
    targetDuration,
    totalDuration,
  ]);

  const storyboardReferencePreviews = useMemo(
    () => ({
      visual: storyboardReferenceBundle.visual.map(getRenderableReferenceUrl).filter(Boolean),
      character: storyboardReferenceBundle.character.map(getRenderableReferenceUrl).filter(Boolean),
      video: storyboardVideoReferences,
      text: storyboardReferenceBundle.text,
    }),
    [storyboardReferenceBundle, storyboardVideoReferences]
  );
  const storyboardGeneratedFrames = Array.isArray(scriptSource.frameResults)
    ? scriptSource.frameResults
    : [];
  const storyboardGenerationProgress = Number(scriptSource.task?.progress || 0);
  const storyboardGeneratedGridImageUrl = getRenderableReferenceUrl(
    String(scriptSource.gridImageUrl || scriptSource.coverImageUrl || '')
  );

  if (isStoryboardMaker) {
    return (
      <div className="group relative min-w-[600px] max-w-[720px]">
        <AICGUnifiedIOHandles
          nodeId={id}
          nodeType={nodeType}
          inputTip="文字 / 多图 / 多视频 / 角色参考"
          outputId="scenes"
          extraInputs={['scriptInput', 'imageInput', 'videoReference', 'characterReference']}
          extraOutputs={['script', 'prompt']}
          outputTip="故事版 / 视频提示词输出"
        />
        <AICGNodeShell
          aicgType="script"
          title="制作故事版"
          subtitle={`${localScenes.length} 镜头 · ${totalDuration}s · ${aspectRatio}`}
          selected={_selected}
          width="100%"
          onDelete={() => deleteNode(id)}
          bodyClassName="p-0"
        >
          <StoryboardMakerWorkbench
            prompt={localScript}
            sourceMode={scriptSourceMode || 'text'}
            outputMode={storyboardOutputMode}
            panelCount={storyboardPanelCount}
            targetDuration={targetDuration}
            tone={tone}
            style={String(scriptSource.style || '电影感写实')}
            scenes={localScenes}
            references={storyboardReferencePreviews}
            imageModelLabel={storyboardImageModelConfig.label}
            imageModelProvider={storyboardImageProvider}
            imageModelOptions={STORYBOARD_DOUBAO_SEEDREAM_OPTIONS}
            planningPoints={STORYBOARD_PLANNING_POINTS}
            warnings={storyboardWarnings}
            isGenerating={isGenerating}
            isGeneratingFrames={isGeneratingFrames}
            generationProgress={storyboardGenerationProgress}
            generatedGridImageUrl={storyboardGeneratedGridImageUrl || undefined}
            generatedFrames={storyboardGeneratedFrames.map((frame) => ({
              cellIndex: frame.cellIndex,
              imageUrl: frame.imageUrl ? getRenderableReferenceUrl(frame.imageUrl) : undefined,
              status: frame.status,
              error: frame.error,
            }))}
            isOptimizingPrompt={isOptimizingStoryboardPrompt}
            error={aiError}
            canGenerate={canGenerateScenes}
            onPromptChange={(value) => {
              setLocalScript(value);
              patchScriptData({ script: value });
              onSlashTextChange(value);
            }}
            onSourceModeChange={handleModeShortcut}
            onOutputModeChange={(value) => {
              const outputConfig = resolveStoryboardOutputMode(value, storyboardPanelCount);
              setStoryboardOutputMode(value);
              setAspectRatio(outputConfig.aspectRatio);
              setScriptType(outputConfig.format);
              patchScriptData({
                storyboardOutputMode: value,
                storyboardPanelCount,
                storyboardOutputSize: outputConfig.imageSize,
                aspectRatio: outputConfig.aspectRatio,
                scriptType: outputConfig.format,
              });
            }}
            onPanelCountChange={(value) => {
              const panelCount = resolveStoryboardPanelCount(value);
              const outputConfig = resolveStoryboardOutputMode(storyboardOutputMode, panelCount);
              setStoryboardPanelCount(panelCount);
              patchScriptData({
                storyboardPanelCount: panelCount,
                storyboardOutputSize: outputConfig.imageSize,
              });
            }}
            onImageModelProviderChange={(provider) => {
              const config = resolveStoryboardImageModelConfig(provider);
              setStoryboardImageProvider(config.provider);
              patchScriptData({ storyboardImageProvider: config.provider });
            }}
            onTargetDurationChange={(value) => {
              setTargetDuration(value);
              patchScriptData({ targetDuration: value });
            }}
            onToneChange={(value) => {
              setTone(value);
              patchScriptData({ tone: value });
            }}
            onStyleChange={(value) => patchScriptData({ style: value })}
            onOptimizePrompt={() => void optimizeStoryboardInput()}
            onImport={() => fileInputRef.current?.click()}
            onGenerate={() => void generateScenes()}
            onConfirm={() => void handleGenerateStoryboardFrames()}
            onAddScene={addScene}
            onUpdateScene={updateScene}
            onMoveScene={moveScene}
            onDuplicateScene={duplicateScene}
            onDeleteScene={deleteScene}
            onBuildWorkflow={handleBuildScriptWorkflow}
            onExport={exportScript}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt,.md,.csv,.log,.docx,image/*,video/*"
            multiple
            onChange={handleImport}
            className="hidden"
          />
        </AICGNodeShell>
        <SafeStyle
          css={`
            .custom-scrollbar::-webkit-scrollbar {
              width: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.07);
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.12);
            }
          `}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative',
        embeddedInAicgText ? 'w-full' : 'min-w-[600px] max-w-[720px]'
      )}
    >
      {!embeddedInAicgText && (
        <>
          <AICGUnifiedIOHandles
            nodeId={id}
            nodeType={nodeType}
            inputTip={isStoryboardMaker ? '文字 / 多图 / 多视频 / 角色参考' : '输入'}
            outputId="scenes"
            extraInputs={
              isStoryboardMaker
                ? ['scriptInput', 'imageInput', 'videoReference', 'characterReference']
                : ['videoReference', 'characterReference']
            }
            extraOutputs={isStoryboardMaker ? ['script', 'prompt'] : ['script']}
            outputTip={isStoryboardMaker ? '故事版 / 视频提示词输出' : '分镜 / 剧本输出'}
          />
        </>
      )}

      <AICGNodeShell
        aicgType="script"
        title={isStoryboardMaker ? '制作故事版' : '剧本解析'}
        subtitle={
          isStoryboardMaker
            ? `${localScenes.length} 镜头 · ${totalDuration}s · ${aspectRatio}`
            : `${localScenes.length} 个镜头 · ${totalDuration}s`
        }
        selected={_selected}
        width="100%"
        chromeless={embeddedInAicgText}
        onDelete={embeddedInAicgText ? undefined : () => deleteNode(id)}
        bodyClassName="p-0"
      >
        {isStoryboardMaker ? (
          <div className="nowheel space-y-4 p-4">
            <div className="drag-handle relative min-h-[430px] cursor-grab overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#101012] px-7 py-6 shadow-[0_18px_46px_rgba(0,0,0,0.42)] active:cursor-grabbing">
              <div className="relative flex items-center gap-2 pr-10 text-[12px] font-semibold text-white">
                <span className="rounded-lg border border-white/16 bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-white/90">
                  故事版
                </span>
                <span className="truncate text-white/88">在下方输入框编写或选择能力</span>
              </div>

              <div className="mt-9 flex flex-col items-center text-center">
                <div className="text-[30px] font-black leading-none tracking-tight text-white drop-shadow-[2px_2px_0_rgba(59,130,246,0.5)]">
                  尝试:
                </div>
                <div className="mt-8 flex w-full max-w-[360px] flex-col gap-4 text-left">
                  {storyboardLauncherActions.map((action) => {
                    const Icon = getStoryboardActionIcon(action);
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick?.();
                        }}
                        disabled={action.disabled}
                        className="nodrag nowheel group/action flex items-center gap-5 rounded-2xl px-3 py-1.5 text-left text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                        title={action.title || action.label}
                      >
                        <Icon
                          className="h-7 w-7 shrink-0 text-white drop-shadow-[2px_2px_0_rgba(59,130,246,0.45)] transition group-hover/action:scale-105"
                          strokeWidth={2.2}
                        />
                        <span className="text-[28px] font-black leading-tight tracking-tight text-white drop-shadow-[2px_2px_0_rgba(59,130,246,0.55)]">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative rounded-[18px] border border-white/[0.08] bg-[#111216]/96 shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
              <AICGNodePromptBar
                nodeId={id as string}
                value={localScript}
                inputRef={scriptInputRef}
                rows={4}
                hideExpandButton
                className="[&_.aicg-text-input-shell]:border-[0.5px] [&_.aicg-text-input-shell]:border-white/[0.05] [&_.aicg-text-input-shell]:bg-transparent [&_.aicg-text-input-shell]:shadow-none [&_.aicg-text-input-shell]:ring-0"
                textareaClassName="min-h-[96px] pb-12 pt-3 text-[13px] leading-6 placeholder:text-white/38"
                inputOverlay={
                  <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-center gap-1.5">
                    <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-1.5">
                      {isStoryboardMaker && (
                        <div
                          className="nodrag nowheel flex h-8 max-w-[168px] shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-white/10 bg-black/20 px-2 text-white"
                          title={`${storyboardImageModelConfig.label}，仅使用豆包 Seedream 5.0 Pro`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[9px] font-black text-black">
                            {storyboardReferenceCount > 0 ? 'REF' : 'G2'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-white/78">
                            {storyboardImageModelConfig.label}
                          </span>
                        </div>
                      )}
                      {isStoryboardMaker && storyboardReferenceCount > 0 && (
                        <div
                          className="nodrag nowheel flex h-8 max-w-[94px] shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] px-2 text-emerald-100"
                          title={`已接入 ${storyboardReferenceCount} 张视觉参考`}
                        >
                          <Upload className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 truncate text-[11px] font-medium">
                            {storyboardReferenceCount} 图
                          </span>
                        </div>
                      )}
                      <CompactSelect
                        label=""
                        value={scriptSourceMode}
                        options={SCRIPT_SOURCE_COMPACT_OPTIONS}
                        onChange={(v) =>
                          handleModeShortcut(v as NonNullable<ScriptNodeData['scriptSourceMode']>)
                        }
                        className="max-w-[150px] [&_select]:!h-8 [&_select]:!border-0 [&_select]:!bg-transparent [&_select]:!text-white/90"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePropertiesOpen();
                      }}
                      className={cn(
                        'pointer-events-auto nodrag nowheel flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] transition-colors hover:bg-white/[0.08] hover:text-white',
                        isPropertiesOpen ? 'text-white/82' : 'text-white/48'
                      )}
                      title={isPropertiesOpen ? '隐藏属性' : '属性'}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      属性
                    </button>
                    <NodePointsBadge points={getPointsForModel(scriptSource.model)} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void generateScenes();
                      }}
                      disabled={isGenerating || !canGenerateScenes}
                      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF8C00] text-white shadow-[0_0_10px_rgba(255,140,0,0.4)] transition-all hover:bg-[#D2691E] active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25 disabled:shadow-none disabled:hover:bg-white/10"
                      title="生成故事版"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                }
                onChange={(val) => {
                  setLocalScript(val);
                  patchScriptData({ script: val });
                  onSlashTextChange(val);
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  const value = (e.target as HTMLTextAreaElement).value;
                  setLocalScript(value);
                  patchScriptData({ script: value });
                }}
                onFocus={() => setIsScriptFocused(true)}
                onBlur={(e) => {
                  setIsScriptFocused(false);
                  const value = e.currentTarget.value;
                  setLocalScript(value);
                  patchScriptData({ script: value });
                }}
                placeholder={scriptPlaceholder}
                slashMenu={
                  slashOpen && slashCommands.length > 0 ? (
                    <AICGSlashMenu
                      commands={slashCommands}
                      className="absolute bottom-full left-2 z-20 mb-1"
                      onSelect={(cmd) => {
                        const next = applySlashCommand(cmd, () => {
                          const line = localScript.split('\n').pop() || '';
                          const idx = line.lastIndexOf('/');
                          const prefix = localScript.slice(0, localScript.length - line.length);
                          return idx >= 0 ? prefix + line.slice(0, idx) : localScript;
                        });
                        if (typeof next === 'string') {
                          setLocalScript(next);
                          patchScriptData({ script: next });
                        }
                      }}
                    />
                  ) : null
                }
                onPointerDownCapture={(e) => e.stopPropagation()}
                onMouseDownCapture={(e) => e.stopPropagation()}
              />
            </div>

            {storyboardReferenceCount > 0 ? (
              <div className="nodrag nowheel flex items-center gap-2 rounded-[12px] border border-emerald-300/15 bg-emerald-300/[0.055] px-2.5 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Upload className="h-4 w-4 shrink-0 text-emerald-200/80" />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium text-emerald-50/90">
                      图片参考已接入
                    </div>
                    <div className="truncate text-[9px] text-emerald-100/50">
                      {storyboardReferenceBundle.visual.length} 张分镜/场景 ·{' '}
                      {storyboardReferenceBundle.character.length} 张角色
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {storyboardReferenceBundle.all.slice(0, 4).map((url, index) => {
                    const previewUrl = getRenderableReferenceUrl(url);
                    return previewUrl ? (
                      <img
                        key={`${url}-${index}`}
                        src={previewUrl}
                        alt={`参考图 ${index + 1}`}
                        className="h-9 w-12 rounded-md border border-white/10 object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div
                        key={`${url}-${index}`}
                        className="flex h-9 w-12 items-center justify-center rounded-md border border-white/10 bg-black/25 text-[9px] text-white/35"
                      >
                        REF
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {isPropertiesOpen ? (
              <div className="grid grid-cols-2 gap-2 rounded-[12px] border border-white/[0.08] bg-[#101012] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.22)]">
                <CompactSelect
                  label="类型"
                  value={scriptType}
                  options={SCRIPT_TYPES}
                  onChange={(v) => {
                    setScriptType(v);
                    patchScriptData({ scriptType: v });
                  }}
                />
                <CompactSelect
                  label="语气"
                  value={tone}
                  options={TONE_OPTIONS}
                  onChange={(v) => {
                    setTone(v);
                    patchScriptData({ tone: v });
                  }}
                />
                <CompactSelect
                  label="画幅"
                  value={aspectRatio}
                  options={[
                    { value: '9:16', label: '9:16 竖屏' },
                    { value: '16:9', label: '16:9 横屏' },
                    { value: '1:1', label: '1:1 方形' },
                    { value: '4:3', label: '4:3' },
                  ]}
                  onChange={(v) => {
                    setAspectRatio(v);
                    patchScriptData({ aspectRatio: v });
                  }}
                />
                <label className="flex flex-col gap-1 min-w-0">
                  <span className="text-[9px] text-white/60 uppercase tracking-[0.12em] leading-none">
                    时长
                  </span>
                  <input
                    type="number"
                    value={targetDuration}
                    min={4}
                    max={120}
                    onChange={(e) => {
                      const next = Number(e.target.value) || 30;
                      setTargetDuration(next);
                      patchScriptData({ targetDuration: next });
                    }}
                    className="nodrag nowheel h-7 rounded-lg border border-white/10 bg-black/45 px-2 text-[10px] text-white outline-none focus:border-white/35"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="nowheel space-y-3 p-3">
            {_selected || isGenerating ? (
              <div className="drag-handle relative cursor-grab overflow-hidden rounded-[18px] border border-white/[0.14] bg-[#101012] px-4 pb-4 pt-4 shadow-[0_12px_30px_rgba(0,0,0,0.28)] active:cursor-grabbing">
                <div className="relative mb-3 flex min-w-0 items-center gap-2">
                  <span className="rounded-md border border-white/12 bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/78">
                    S
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium text-white/85">
                      {isStoryboardMaker ? '故事版控制器' : '拆镜控制器'}
                    </div>
                    <div className="truncate text-[9px] text-white/35">
                      {localScenes.length > 0
                        ? `${localScenes.length} 个镜头 · ${totalDuration}s`
                        : isStoryboardMaker
                          ? '等待输入创意、脚本或参考素材'
                          : '等待输入剧本或参考素材'}
                    </div>
                  </div>
                </div>
                <NodeControllerV2Panel
                  title={scriptControllerPreset.v2.title}
                  subtitle={scriptControllerPreset.v2.subtitle}
                  status={
                    isGenerating
                      ? 'processing'
                      : localScenes.length > 0
                        ? 'done'
                        : canGenerateScenes
                          ? 'ready'
                          : 'idle'
                  }
                  sections={[{ id: 'try', label: '尝试', actions: scriptLauncherActions }]}
                  summary={scriptSummaryItems}
                  actionLayout="launcher-list"
                  compact
                  className="relative"
                />
              </div>
            ) : null}

            <div className="relative rounded-[12px] bg-[#101012] shadow-[0_10px_34px_rgba(0,0,0,0.28)]">
              <AICGNodePromptBar
                nodeId={id as string}
                value={localScript}
                inputRef={scriptInputRef}
                rows={5}
                className="[&_.aicg-text-input-shell]:border-[0.5px] [&_.aicg-text-input-shell]:border-white/[0.03] [&_.aicg-text-input-shell]:bg-transparent [&_.aicg-text-input-shell]:shadow-none [&_.aicg-text-input-shell]:ring-0"
                textareaClassName="min-h-[110px] pb-12 pt-3 text-[13px] leading-6 placeholder:text-white/38"
                inputOverlay={
                  <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-center gap-1.5">
                    <div className="pointer-events-auto min-w-0 flex-1">
                      <CompactSelect
                        label=""
                        value={scriptSourceMode}
                        options={SCRIPT_SOURCE_COMPACT_OPTIONS}
                        onChange={(v) =>
                          handleModeShortcut(v as NonNullable<ScriptNodeData['scriptSourceMode']>)
                        }
                        className="max-w-[168px] [&_select]:!h-8 [&_select]:!border-0 [&_select]:!bg-transparent [&_select]:!text-white/90"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePropertiesOpen();
                      }}
                      className={cn(
                        'pointer-events-auto nodrag nowheel flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] transition-colors hover:bg-white/[0.08] hover:text-white',
                        isPropertiesOpen ? 'text-white/82' : 'text-white/48'
                      )}
                      title={isPropertiesOpen ? '隐藏属性' : '属性'}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      属性
                    </button>
                    <NodePointsBadge points={getPointsForModel(scriptSource.model)} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void generateScenes();
                      }}
                      disabled={isGenerating || !canGenerateScenes}
                      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF8C00] text-white shadow-[0_0_10px_rgba(255,140,0,0.4)] transition-all hover:bg-[#D2691E] active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25 disabled:shadow-none disabled:hover:bg-white/10"
                      title="AI 解析剧本"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                }
                onChange={(val) => {
                  setLocalScript(val);
                  patchScriptData({ script: val });
                  onSlashTextChange(val);
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e) => {
                  setIsComposing(false);
                  const value = (e.target as HTMLTextAreaElement).value;
                  setLocalScript(value);
                  patchScriptData({ script: value });
                }}
                onFocus={() => setIsScriptFocused(true)}
                onBlur={(e) => {
                  setIsScriptFocused(false);
                  const value = e.currentTarget.value;
                  setLocalScript(value);
                  patchScriptData({ script: value });
                }}
                placeholder={scriptPlaceholder}
                slashMenu={
                  slashOpen && slashCommands.length > 0 ? (
                    <AICGSlashMenu
                      commands={slashCommands}
                      className="absolute bottom-full left-2 z-20 mb-1"
                      onSelect={(cmd) => {
                        const next = applySlashCommand(cmd, () => {
                          const line = localScript.split('\n').pop() || '';
                          const idx = line.lastIndexOf('/');
                          const prefix = localScript.slice(0, localScript.length - line.length);
                          return idx >= 0 ? prefix + line.slice(0, idx) : localScript;
                        });
                        if (typeof next === 'string') {
                          setLocalScript(next);
                          patchScriptData({ script: next });
                        }
                      }}
                    />
                  ) : null
                }
                onPointerDownCapture={(e) => e.stopPropagation()}
                onMouseDownCapture={(e) => e.stopPropagation()}
              />
            </div>

            {isPropertiesOpen ? (
              <div className="grid grid-cols-2 gap-2 rounded-[12px] border border-white/[0.08] bg-[#101012] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.22)]">
                <div className="col-span-2 mb-1 flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                    <Settings2 className="h-3 w-3" />
                    属性
                  </div>
                  <button
                    type="button"
                    onClick={togglePropertiesOpen}
                    className="nodrag nowheel flex h-6 w-6 items-center justify-center rounded-md text-white/36 transition hover:bg-white/[0.06] hover:text-white/70"
                    title="隐藏属性"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CompactSelect
                  label="类型"
                  value={scriptType}
                  options={SCRIPT_TYPES}
                  onChange={(v) => {
                    setScriptType(v);
                    patchScriptData({ scriptType: v });
                  }}
                />
                <CompactSelect
                  label="语气"
                  value={tone}
                  options={TONE_OPTIONS}
                  onChange={(v) => {
                    setTone(v);
                    patchScriptData({ tone: v });
                  }}
                />
                <CompactSelect
                  label="模型"
                  value={scriptSource.model || 'deepseek-v4-pro'}
                  options={modelOptions}
                  onChange={(v) => {
                    patchScriptData({ model: v });
                  }}
                />
                {isStoryboardMaker && (
                  <>
                    <CompactSelect
                      label="画幅"
                      value={aspectRatio}
                      options={[
                        { value: '9:16', label: '9:16 竖屏' },
                        { value: '16:9', label: '16:9 横屏' },
                        { value: '1:1', label: '1:1 方形' },
                        { value: '4:3', label: '4:3' },
                      ]}
                      onChange={(v) => {
                        setAspectRatio(v);
                        patchScriptData({ aspectRatio: v });
                      }}
                    />
                    <label className="flex flex-col gap-1 min-w-0">
                      <span className="text-[9px] text-white/60 uppercase tracking-[0.12em] leading-none">
                        时长
                      </span>
                      <input
                        type="number"
                        value={targetDuration}
                        min={4}
                        max={120}
                        onChange={(e) => {
                          const next = Number(e.target.value) || 30;
                          setTargetDuration(next);
                          patchScriptData({ targetDuration: next });
                        }}
                        className="nodrag nowheel h-7 rounded-lg border border-white/10 bg-black/45 px-2 text-[10px] text-white outline-none focus:border-white/35"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        onMouseDownCapture={(e) => e.stopPropagation()}
                      />
                    </label>
                  </>
                )}
                {scriptSourceMode === 'video_reference' && (
                  <input
                    value={referenceVideoUrl}
                    onChange={(e) => {
                      setReferenceVideoUrl(e.target.value);
                      patchScriptData({ referenceVideoUrl: e.target.value });
                    }}
                    placeholder="粘贴参考视频 URL 或输入视频素材说明"
                    className="nodrag nowheel col-span-2 h-8 rounded-lg border border-white/10 bg-black/45 px-2 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-white/35"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                  />
                )}
                {scriptSourceMode === 'character_reference' && (
                  <textarea
                    value={referenceCharacterNote}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (!isComposing) {
                        setReferenceCharacterNote(e.target.value);
                        patchScriptData({ referenceCharacterNote: e.target.value });
                      }
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.nativeEvent.isComposing || e.key === 'Process') return;
                    }}
                    onKeyUp={(e) => e.stopPropagation()}
                    onInput={(e) => e.stopPropagation()}
                    onBeforeInput={(e) => e.stopPropagation()}
                    onCompositionStart={(e) => {
                      e.stopPropagation();
                      setIsComposing(true);
                    }}
                    onCompositionEnd={(e) => {
                      e.stopPropagation();
                      setIsComposing(false);
                      const val = (e.target as HTMLTextAreaElement).value;
                      setReferenceCharacterNote(val);
                      patchScriptData({ referenceCharacterNote: val });
                    }}
                    placeholder="填写角色设定、人物关系、性格、造型或参考描述"
                    className="nodrag nowheel col-span-2 h-16 resize-none rounded-lg border border-white/10 bg-black/45 px-2 py-2 text-[10px] leading-4 text-white outline-none placeholder:text-white/25 focus:border-white/35 select-text"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                  />
                )}
                <div className="col-span-2 flex flex-wrap items-center gap-1.5">
                  {!isStoryboardMaker ? (
                    <>
                      <button
                        type="button"
                        onClick={handleBuildScriptWorkflow}
                        className="nodrag nowheel flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
                      >
                        <LayoutGrid className="h-3 w-3" />
                        组合工作流
                      </button>
                      <button
                        type="button"
                        disabled={!localScript.trim() && localScenes.length === 0}
                        onClick={() => handleOpenStoryboardEdit()}
                        className="nodrag nowheel flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/55 transition-colors hover:border-white/20 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Palette className="h-3 w-3" />
                        分镜编辑
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    title="导入剧本"
                    onClick={() => fileInputRef.current?.click()}
                    className="nodrag nowheel flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px] text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
                  >
                    <Upload className="h-3 w-3" />
                    导入剧本
                  </button>
                  <button
                    type="button"
                    onClick={exportScript}
                    className="nodrag nowheel flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px] text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
                  >
                    <Download className="h-3 w-3" />
                    导出
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenTemplateDialog('save')}
                    className="nodrag nowheel flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px] text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
                  >
                    <Save className="h-3 w-3" />
                    保存模板
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenTemplateDialog('load')}
                    className="nodrag nowheel flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px] text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
                  >
                    <FolderOpen className="h-3 w-3" />
                    加载模板
                  </button>
                  <button
                    type="button"
                    onClick={() => templateFileRef.current?.click()}
                    className="nodrag nowheel flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px] text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
                  >
                    <Package className="h-3 w-3" />
                    模板文件
                  </button>
                  {localScenes.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={enhanceAllScenes}
                        className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
                      >
                        <Wand2 className="h-3 w-3" />
                        专业增强
                      </button>
                      <button
                        type="button"
                        onClick={() => setScenes([])}
                        className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px] text-white/45 transition-colors hover:border-red-500/20 hover:text-red-300/80"
                      >
                        <RotateCcw className="h-3 w-3" />
                        清空
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {showTemplateDialog && (
              <div className="rounded-[12px] border border-white/[0.08] bg-[#101012] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.22)]">
                {showTemplateDialog === 'save' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                        保存模板
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTemplateDialog(null)}
                        className="rounded p-1 text-white/35 hover:bg-white/5 hover:text-white/70"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <input
                      value={templateName}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (!isComposing) setTemplateName(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.nativeEvent.isComposing || e.key === 'Process') return;
                      }}
                      onKeyUp={(e) => e.stopPropagation()}
                      onInput={(e) => e.stopPropagation()}
                      onBeforeInput={(e) => e.stopPropagation()}
                      onCompositionStart={(e) => {
                        e.stopPropagation();
                        setIsComposing(true);
                      }}
                      onCompositionEnd={(e) => {
                        e.stopPropagation();
                        setIsComposing(false);
                        setTemplateName((e.target as HTMLInputElement).value);
                      }}
                      placeholder="模板名称"
                      className="nodrag nowheel h-8 w-full rounded-lg border border-white/10 bg-black/45 px-2 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-white/35 select-text"
                      onPointerDownCapture={(e) => e.stopPropagation()}
                      onMouseDownCapture={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveTemplate(false)}
                        className="rounded-lg border border-white/14 bg-white/[0.07] px-3 py-1.5 text-[10px] text-white/72 transition-colors hover:bg-white/[0.11] disabled:opacity-40"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || !localScenes.length}
                        onClick={() => handleDownloadTemplate(false)}
                        className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[10px] text-white/55 transition-colors hover:text-white disabled:opacity-40"
                      >
                        下载模板
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || isEmbedding || !localScenes.length}
                        onClick={() => handleDownloadTemplate(true)}
                        className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[10px] text-white/55 transition-colors hover:text-white disabled:opacity-40"
                      >
                        含媒体下载
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                        加载模板
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTemplateDialog(null)}
                        className="rounded p-1 text-white/35 hover:bg-white/5 hover:text-white/70"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </div>
                    {savedTemplates.length === 0 ? (
                      <div className="rounded-lg border border-white/[0.04] bg-black/30 px-3 py-3 text-[10px] text-white/35">
                        暂无本地模板，可从模板文件导入。
                      </div>
                    ) : (
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-1 custom-scrollbar nowheel">
                        {savedTemplates.map((t) => (
                          <div
                            key={t.id}
                            className="group flex items-center justify-between rounded-lg border border-white/[0.03] bg-black/40 p-2 transition-all hover:border-white/15"
                          >
                            <button
                              type="button"
                              onClick={() => handleLoadTemplate(t.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="truncate text-[10px] font-medium text-white">
                                {t.name}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[8px] text-white/35">
                                <span>{t.sceneCount} 镜头</span>
                                <span>{t.totalDuration}s</span>
                                {t.hasProPrompts && <span className="text-white/48">专业增强</span>}
                                {t.hasMedia && <span className="text-white/48">含媒体</span>}
                                <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(t.id);
                              }}
                              className="rounded p-0.5 text-white/30 opacity-0 transition-all hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                              title="删除模板"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => templateFileRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[10px] text-white/60 transition-all hover:border-white/15"
                      >
                        <Upload className="h-3 w-3" />
                        从文件导入
                      </button>
                      <button
                        type="button"
                        onClick={refreshTemplates}
                        className="rounded-lg px-3 py-1.5 text-[10px] text-white/40 transition-all hover:bg-white/[0.02]"
                      >
                        刷新列表
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {templateMsg && (
              <div className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[10px] text-white/68">
                <span>{templateMsg}</span>
                <button
                  type="button"
                  onClick={() => setTemplateMsg(null)}
                  className="rounded p-0.5 text-white/40 hover:bg-white/5"
                >
                  <CloseIcon className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {hasScenes && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-3 h-3 text-white/40" />
                    <span className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.1em]">
                      分镜列表
                    </span>
                    <span className="text-[9px] text-white/25 tabular-nums">
                      {localScenes.length} 个镜头 · {totalDuration}s
                    </span>
                  </div>
                  <button
                    onClick={addScene}
                    className="flex items-center gap-1 text-[10px] text-white/45 hover:text-white/80 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    添加镜头
                  </button>
                </div>

                <div className="max-h-[420px] overflow-y-auto nowheel space-y-2 pr-1 custom-scrollbar">
                  {localScenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      className={cn(
                        'p-2.5 bg-black/40 rounded-xl border transition-all group',
                        scene.status === 'error'
                          ? 'border-red-500/15'
                          : scene.status === 'generating'
                            ? 'border-white/12'
                            : scene.status === 'done'
                              ? 'border-white/10'
                              : 'border-white/[0.03] hover:border-white/[0.06]'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-3 h-3 text-white/15 cursor-grab hover:text-white/30" />
                          <span
                            className={cn(
                              'flex-shrink-0 w-5 h-5 rounded text-[9px] flex items-center justify-center font-bold',
                              scene.status === 'done'
                                ? 'bg-white/[0.07] text-white/70'
                                : scene.status === 'generating'
                                  ? 'bg-white/[0.07] text-white/70'
                                  : scene.status === 'error'
                                    ? 'bg-red-500/15 text-red-400'
                                    : 'bg-white/[0.05] text-white/55'
                            )}
                          >
                            {scene.status === 'generating' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              index + 1
                            )}
                          </span>
                        </div>
                        <CompactSelect
                          value={scene.shotType}
                          options={SCRIPT_SHOT_TYPE_OPTIONS}
                          onChange={(v) => updateScene(scene.id, { shotType: v })}
                          className="flex-1"
                        />
                        <CompactSelect
                          value={scene.cameraMovement}
                          options={CAMERA_MOVEMENTS}
                          onChange={(v) => updateScene(scene.id, { cameraMovement: v })}
                          className="flex-1"
                        />
                        <CompactSelect
                          value={scene.transition}
                          options={TRANSITIONS}
                          onChange={(v) => updateScene(scene.id, { transition: v })}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg px-2 h-7 border border-white/[0.04]">
                          <Clock className="w-2.5 h-2.5 text-white/25" />
                          <input
                            type="number"
                            value={scene.duration}
                            onChange={(e) =>
                              updateScene(scene.id, { duration: parseInt(e.target.value) || 5 })
                            }
                            className="w-7 bg-transparent text-[10px] text-white/60 text-center focus:outline-none nodrag tabular-nums"
                            min={1}
                            max={30}
                            onPointerDownCapture={(e) => e.stopPropagation()}
                          />
                          <span className="text-[9px] text-white/25">s</span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveScene(scene.id, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-white/[0.04] text-white/25 hover:text-white/60 disabled:opacity-15 transition-colors"
                            title="上移"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveScene(scene.id, 'down')}
                            disabled={index === localScenes.length - 1}
                            className="p-1 rounded hover:bg-white/[0.04] text-white/25 hover:text-white/60 disabled:opacity-15 transition-colors"
                            title="下移"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => duplicateScene(scene.id)}
                            className="p-1 rounded hover:bg-white/[0.04] text-white/25 hover:text-white/70 transition-colors"
                            title="复制"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteScene(scene.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <textarea
                            value={scene.description}
                            onChange={(e) => {
                              if (!isComposing)
                                updateScene(scene.id, { description: e.target.value });
                            }}
                            onCompositionStart={() => setIsComposing(true)}
                            onCompositionEnd={(e) => {
                              setIsComposing(false);
                              updateScene(scene.id, {
                                description: (e.target as HTMLTextAreaElement).value,
                              });
                            }}
                            className="w-full h-12 px-2.5 py-2 bg-black/30 border border-white/[0.03] rounded-lg text-[10px] leading-relaxed text-white/80 resize-none focus:outline-none focus:border-white/20 nodrag nowheel placeholder:text-white/15"
                            placeholder="镜头描述..."
                            onPointerDownCapture={(e) => e.stopPropagation()}
                            onMouseDownCapture={(e) => e.stopPropagation()}
                            style={{ userSelect: 'text' }}
                          />
                          {scene.dialogue && (
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-white/35">
                              <Mic className="w-2.5 h-2.5" />
                              <span className="truncate">{scene.dialogue}</span>
                            </div>
                          )}
                        </div>
                        {(getSafeRenderableMediaUrl(scene.imageUrl) ||
                          getSafeRenderableMediaUrl(scene.videoUrl)) && (
                          <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/[0.04] bg-black/40">
                            {getSafeRenderableMediaUrl(scene.videoUrl) ? (
                              <video
                                src={getSafeRenderableMediaUrl(scene.videoUrl)}
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <img
                                src={getSafeRenderableMediaUrl(scene.imageUrl)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        )}
                      </div>
                      {scene.professionalPrompt && (
                        <div className="mt-2 p-2 rounded-lg bg-white/[0.025] border border-white/[0.08] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] text-white/45 uppercase tracking-[0.15em] font-semibold">
                              专业提示词
                            </span>
                            <button
                              onClick={() => enhanceSingleScene(scene.id)}
                              className="text-[8px] text-white/35 hover:text-white/70 transition-colors"
                              title="重新生成专业增强"
                            >
                              <Wand2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <p className="text-[9px] text-white/62 leading-relaxed line-clamp-3">
                            {scene.professionalPrompt}
                          </p>
                          <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-white/[0.06]">
                            {scene.lightingSetup && (
                              <div className="flex items-start gap-1">
                                <Lightbulb className="w-2.5 h-2.5 text-white/35 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[7px] text-white/20 block">灯光</span>
                                  <span className="text-[7px] text-white/45 line-clamp-2">
                                    {scene.lightingSetup}
                                  </span>
                                </div>
                              </div>
                            )}
                            {scene.moodAtmosphere && (
                              <div className="flex items-start gap-1">
                                <Eye className="w-2.5 h-2.5 text-white/35 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[7px] text-white/20 block">氛围</span>
                                  <span className="text-[7px] text-white/45 line-clamp-2">
                                    {scene.moodAtmosphere}
                                  </span>
                                </div>
                              </div>
                            )}
                            {scene.compositionGuide && (
                              <div className="flex items-start gap-1">
                                <Camera className="w-2.5 h-2.5 text-white/35 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[7px] text-white/20 block">构图</span>
                                  <span className="text-[7px] text-white/45 line-clamp-2">
                                    {scene.compositionGuide}
                                  </span>
                                </div>
                              </div>
                            )}
                            {scene.colorGrading && (
                              <div className="flex items-start gap-1">
                                <Palette className="w-2.5 h-2.5 text-white/35 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[7px] text-white/20 block">色调</span>
                                  <span className="text-[7px] text-white/45 line-clamp-2">
                                    {scene.colorGrading}
                                  </span>
                                </div>
                              </div>
                            )}
                            {scene.depthOfField && (
                              <div className="flex items-start gap-1">
                                <Eye className="w-2.5 h-2.5 text-white/35 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[7px] text-white/20 block">景深</span>
                                  <span className="text-[7px] text-white/45 line-clamp-2">
                                    {scene.depthOfField}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {!scene.professionalPrompt && scene.status === 'pending' && (
                        <button
                          onClick={() => enhanceSingleScene(scene.id)}
                          className="mt-2 flex items-center gap-1 text-[8px] text-white/20 hover:text-white/60 transition-colors"
                        >
                          <Wand2 className="w-2.5 h-2.5" />
                          专业增强
                        </button>
                      )}
                      {scene.status === 'error' && scene.error && (
                        <div className="mt-1 text-[9px] text-red-400/60 truncate">
                          {scene.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
                  <div className="flex items-center gap-3 text-[9px] text-white/30 tabular-nums">
                    <span>{localScenes.length} 个镜头</span>
                    <span>总时长 {totalDuration}s</span>
                  </div>
                  <button
                    onClick={exportScript}
                    className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    <Download className="w-2.5 h-2.5" />
                    导出
                  </button>
                </div>
              </div>
            )}
            {aiError && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-[10px] text-white/68">
                <span>{aiError}</span>
                <button
                  onClick={() => void generateScenes()}
                  disabled={isGenerating}
                  className="ml-2 px-2 py-0.5 rounded bg-white/[0.07] hover:bg-white/[0.12] text-white/70 hover:text-white transition-colors disabled:opacity-30"
                >
                  重试
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,.md,.csv,.log,.docx,image/*,video/*"
              onChange={handleImport}
              className="hidden"
            />
            <input
              ref={templateFileRef}
              type="file"
              accept=".novascript,.json"
              onChange={handleImportTemplateFile}
              className="hidden"
            />
          </div>
        )}
      </AICGNodeShell>

      <SafeStyle
        css={`
          .custom-scrollbar::-webkit-scrollbar {
            width: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.06);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.1);
          }
        `}
      />
    </div>
  );
};

export default React.memo(ScriptNode);
