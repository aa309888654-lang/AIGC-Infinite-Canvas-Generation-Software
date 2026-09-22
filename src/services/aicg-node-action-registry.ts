import {
  spawnControllerToolNode,
  type SpawnControllerToolNodeOptions,
} from '@/services/node-controller-action-service';

export type AICGNodeActionId =
  | 'text-to-image'
  | 'text-to-video'
  | 'text-to-audio'
  | 'text-to-storyboard'
  | 'text-to-ad-copy'
  | 'text-to-brand-copy'
  | 'image-to-image'
  | 'image-to-video'
  | 'image-to-grid'
  | 'image-to-matting'
  | 'image-to-panorama'
  | 'audio-to-video'
  | 'script-to-storyboard'
  | 'script-to-storyboard-edit'
  | 'storyboard-to-image'
  | 'storyboard-to-video';

export interface AICGNodeActionDefinition {
  id: AICGNodeActionId;
  label: string;
  targetType: string;
  sourceHandle?: string;
  targetHandle?: string;
  description?: string;
  initialData?: Record<string, unknown>;
}

export const AICG_NODE_ACTIONS: Record<AICGNodeActionId, AICGNodeActionDefinition> = {
  'text-to-image': {
    id: 'text-to-image',
    label: '生成图片',
    targetType: 'aiImage',
    sourceHandle: 'textOutput',
    targetHandle: 'prompt',
    initialData: { params: { mode: 'text_to_image' } },
  },
  'text-to-video': {
    id: 'text-to-video',
    label: '生成视频',
    targetType: 'aiVideo',
    sourceHandle: 'textOutput',
    targetHandle: 'prompt',
    initialData: { params: { generationMode: 'text_to_video' } },
  },
  'text-to-audio': {
    id: 'text-to-audio',
    label: '生成配音',
    targetType: 'audioGen',
    sourceHandle: 'textOutput',
    targetHandle: 'prompt',
    initialData: { params: { mode: 'tts' } },
  },
  'text-to-storyboard': {
    id: 'text-to-storyboard',
    label: '生成分镜',
    targetType: 'scriptStoryboard',
    sourceHandle: 'scenes',
    targetHandle: 'scriptInput',
  },
  'text-to-ad-copy': {
    id: 'text-to-ad-copy',
    label: '广告词',
    targetType: 'adCopyText',
    sourceHandle: 'textOutput',
    targetHandle: 'input',
  },
  'text-to-brand-copy': {
    id: 'text-to-brand-copy',
    label: '品牌文案',
    targetType: 'brandCopyText',
    sourceHandle: 'textOutput',
    targetHandle: 'input',
  },
  'image-to-image': {
    id: 'image-to-image',
    label: '图生图',
    targetType: 'aiImage',
    sourceHandle: 'imageOutput',
    targetHandle: 'input',
    initialData: { params: { mode: 'image_to_image' } },
  },
  'image-to-video': {
    id: 'image-to-video',
    label: '转为视频',
    targetType: 'aiVideo',
    sourceHandle: 'imageOutput',
    targetHandle: 'input',
    initialData: { params: { generationMode: 'image_to_video' } },
  },
  'image-to-grid': {
    id: 'image-to-grid',
    label: '宫格切分',
    targetType: 'gridSplitter',
    sourceHandle: 'imageOutput',
    targetHandle: 'input',
    initialData: {
      rows: 3,
      cols: 3,
      autoSplit: true,
      params: { rows: 3, cols: 3, layout: '3x3', autoSplit: true },
    },
  },
  'image-to-matting': {
    id: 'image-to-matting',
    label: '智能抠图',
    targetType: 'localMatting',
    sourceHandle: 'imageOutput',
    targetHandle: 'image',
  },
  'image-to-panorama': {
    id: 'image-to-panorama',
    label: '360全景',
    targetType: 'panorama360',
    sourceHandle: 'imageOutput',
    targetHandle: 'input',
  },
  'audio-to-video': {
    id: 'audio-to-video',
    label: '音频生视频',
    targetType: 'aiVideo',
    sourceHandle: 'audioOutput',
    targetHandle: 'input',
    initialData: { params: { generationMode: 'reference_to_video' } },
  },
  'script-to-storyboard': {
    id: 'script-to-storyboard',
    label: '生成分镜',
    targetType: 'scriptStoryboard',
    sourceHandle: 'scenes',
    targetHandle: 'scriptInput',
  },
  'script-to-storyboard-edit': {
    id: 'script-to-storyboard-edit',
    label: '分镜编辑',
    targetType: 'storyboardEdit',
    sourceHandle: 'scenes',
    targetHandle: 'scriptInput',
  },
  'storyboard-to-image': {
    id: 'storyboard-to-image',
    label: '批量生图',
    targetType: 'aiImage',
    sourceHandle: 'output',
    targetHandle: 'input',
  },
  'storyboard-to-video': {
    id: 'storyboard-to-video',
    label: '批量生视频',
    targetType: 'aiVideo',
    sourceHandle: 'output',
    targetHandle: 'input',
  },
};

export function runAICGNodeAction(
  sourceNodeId: string,
  actionId: AICGNodeActionId,
  options: Partial<SpawnControllerToolNodeOptions> = {}
): string | null {
  const action = AICG_NODE_ACTIONS[actionId];
  const actionInitialData = action.initialData || {};
  const optionInitialData = options.initialData || {};
  const initialData = {
    ...actionInitialData,
    ...optionInitialData,
    params: {
      ...((actionInitialData.params as Record<string, unknown> | undefined) || {}),
      ...((optionInitialData.params as Record<string, unknown> | undefined) || {}),
    },
  };

  return spawnControllerToolNode(sourceNodeId, action.targetType, {
    controllerActionId: action.id,
    label: action.label,
    toastLabel: action.label,
    sourceHandle: action.sourceHandle,
    targetHandle: action.targetHandle,
    ...options,
    initialData,
  });
}

export function getAICGNodeAction(actionId: AICGNodeActionId): AICGNodeActionDefinition {
  return AICG_NODE_ACTIONS[actionId];
}
