/**
 * 画布节点句柄关联表 — AICG 工作流
 *
 * 快速新建仅保留 AICG 主链节点；经典 studio 节点通过 CLASSIC_NODE_REDIRECT 重定向
 */

import { NODE_TYPES, type NodeTypeDefinition } from '@/types/node-system';
import { nodeModelMatcher } from '@/core/node-model-matcher';
import { withCanvasNodeDefaultSize } from '@/lib/canvas-node-dimensions';

const SATELLITE_NODE_DEFINITIONS: NodeTypeDefinition[] = [
  {
    id: 'imageCollage',
    name: '图片拼接',
    category: 'image',
    description: '多图拼接/拼贴布局工具节点',
    icon: '🧩',
    color: '#8B5CF6',
    inputPorts: [{ id: 'input', name: '图片输入', type: 'image', optional: true, multiple: true }],
    outputPorts: [{ id: 'output', name: '拼图输出', type: 'image' }],
    defaultParams: {},
  },
  {
    id: 'gridSplitter',
    name: '宫格切分',
    category: 'image',
    description: '将输入图片切分为 2×2 / 3×3 / 4×4 / 5×5 宫格',
    icon: '▦',
    color: '#06B6D4',
    inputPorts: [{ id: 'input', name: '图片输入', type: 'image', optional: true }],
    outputPorts: [{ id: 'output', name: '选中格子输出', type: 'image' }],
    defaultParams: { layout: '3x3', rows: 3, cols: 3, selectedCells: [] },
  },
];

const QUICK_ADD_NODE_DEFINITIONS = [...NODE_TYPES, ...SATELLITE_NODE_DEFINITIONS];

export interface HandleQuickAddOption {
  nodeType: string;
  label: string;
  description?: string;
  workflowTag?: string;
  targetHandle?: string;
  sourceHandle?: string;
  initialData?: Record<string, unknown>;
  offsetX?: number;
  offsetY?: number;
}

/** 经典节点 → AICG 节点（Step 4 兼容层） */
export const CLASSIC_NODE_REDIRECT: Record<string, string> = {
  unifiedImageStudio: 'aiImage',
  aicgImageGen: 'aiImage',
  advancedVideoGen: 'aiVideo',
  videoGen: 'aiVideo',
  aicgVideoGen: 'aiVideo',
  imageGen: 'aiImage',
  imageAnalysis: 'aiImage',
  inpainting: 'aiImage',
  outpainting: 'aiImage',
  photoGrid: 'gridDirector',
  magicStoryboard: 'gridDirector',
};

export function resolveQuickAddNodeType(nodeType: string): string {
  return CLASSIC_NODE_REDIRECT[nodeType] || nodeType;
}

/** 新建节点时的默认 target 端口 */
export function getDefaultTargetHandle(nodeType: string, sourceNodeType?: string): string {
  const canonical = resolveQuickAddNodeType(nodeType);
  const canonicalSource = sourceNodeType ? resolveQuickAddNodeType(sourceNodeType) : '';
  const sourceIsImage =
    canonicalSource === 'imageInput' ||
    canonicalSource === 'aiImage' ||
    canonicalSource === 'unifiedImageStudio' ||
    canonicalSource === 'localMatting' ||
    canonicalSource === 'gridDirector' ||
    canonicalSource === 'scriptStoryboard' ||
    canonicalSource === 'frameExtractor' ||
    canonicalSource === 'characterLibrary' ||
    canonicalSource === 'sceneLibrary' ||
    canonicalSource === 'propLibrary';
  const explicit: Record<string, string> = {
    aiImage: 'input',
    aiVideo: 'input',
    aicgVideoGen: 'input',
    adCopyText: 'input',
    brandCopyText: 'input',
    storyboardEdit: 'scriptInput',
    localMatting: 'image',
    gridDirector:
      sourceNodeType === 'aiGenText' || sourceNodeType === 'script' ? 'scriptInput' : 'imageInput',
    scriptStoryboard: 'scriptInput',
    storyboardMaker: sourceIsImage ? 'imageInput' : 'input',
    aiGenText: 'promptInput',
    prompt: 'input',
    script: 'input',
    characterConsistency: 'characterImage',
    batchProcess: 'input',
    director3D: 'input',
    multiAngle: 'input',
    panorama360: 'input',
    videoUpscale: 'video',
    output:
      sourceNodeType === 'aicgVideoGen' ||
      sourceNodeType === 'aiVideo' ||
      sourceNodeType === 'videoInput' ||
      sourceNodeType === 'videoCompose'
        ? 'video'
        : sourceNodeType === 'audioGen' || sourceNodeType === 'audioInput'
          ? 'audio'
          : 'image',
  };
  if (explicit[canonical]) return explicit[canonical];
  const def = QUICK_ADD_NODE_DEFINITIONS.find((n) => n.id === canonical);
  return def?.inputPorts[0]?.id || 'input';
}

function opt(
  nodeType: string,
  label: string,
  workflowTag: string,
  extra?: Partial<HandleQuickAddOption>
): HandleQuickAddOption {
  return { nodeType: resolveQuickAddNodeType(nodeType), label, workflowTag, ...extra };
}

const IMAGE_PIPELINE: HandleQuickAddOption[] = [
  opt('aiImage', 'AI图片', '生图', { description: '多模型 AI 生图 / 图生图' }),
  opt('aiVideo', 'AI视频', '视频', { description: '多模型图生视频 / 文生视频' }),
  opt('aiImage', '图片生成', '生图', { description: 'AI 生图 / 图生图' }),
  opt('storyboardMaker', '制作故事版', '故事版', {
    targetHandle: 'imageInput',
    description: '用图片/分镜表拆成故事版',
  }),
  opt('localMatting', '智能抠图', '—', { description: '本地 ONNX 抠图', targetHandle: 'image' }),
  opt('gridDirector', '分镜导演', '分镜', {
    description: '图片参考分镜编排',
    targetHandle: 'imageInput',
  }),
  opt('aicgVideoGen', '视频生成', '视频', { description: '图生视频 / 文生视频' }),
];

const TEXT_PIPELINE: HandleQuickAddOption[] = [
  opt('adCopyText', '广告词', '文案', { description: '卖点/口播/CTA 轻节点' }),
  opt('brandCopyText', '品牌文案', '文案', { description: '品牌主张/海报标题轻节点' }),
  opt('aiImage', 'AI图片', '生图', { targetHandle: 'prompt' }),
  opt('aiVideo', 'AI视频', '视频', { targetHandle: 'prompt' }),
  opt('aiImage', '图片生成', '生图', { targetHandle: 'input' }),
  opt('aicgVideoGen', '视频生成', '视频', { targetHandle: 'input' }),
  opt('storyboardMaker', '制作故事版', '故事版', {
    targetHandle: 'input',
    description: '创意转故事版 / 视频提示词',
  }),
  opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'scriptInput' }),
  opt('storyboardEdit', '分镜编辑', '分镜', {
    targetHandle: 'scriptInput',
    description: '镜头重排 / 宫格裁剪',
  }),
  opt('prompt', '提示词', '镜头', { targetHandle: 'input' }),
];

const VIDEO_OUTPUT: HandleQuickAddOption[] = [
  opt('videoUpscale', '提升清晰度', '高清', {
    targetHandle: 'video',
    description: '视频超分至 1080P，增强分辨率与画面细节',
  }),
  opt('frameExtractor', '视频抽帧', '抽帧', {
    targetHandle: 'input',
    description: '从视频抽取图片帧',
  }),
  opt('output', '导出节点', '—', { targetHandle: 'video', description: '汇总导出成片' }),
];

const MATTED_IMAGE: HandleQuickAddOption[] = [
  opt('aiVideo', '图生视频', '视频', {
    targetHandle: 'firstFrame',
    initialData: { params: { generationMode: 'image_to_video' } },
    description: '作为 AI 视频图生视频参考图',
  }),
  opt('aiVideo', '作为尾帧', '尾帧', {
    targetHandle: 'lastFrame',
    initialData: { params: { generationMode: 'first_last_frame' } },
    description: '连接到 AI 视频首尾帧的尾帧输入',
  }),
  opt('storyboardMaker', '制作故事版', '故事版', {
    targetHandle: 'imageInput',
    description: '用抠图/参考图生成故事版',
  }),
  opt('aiImage', 'AI图片', '生图'),
  opt('aiImage', '图片生成', '生图'),
  opt('aicgVideoGen', '视频生成', '视频'),
  opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'imageInput' }),
  opt('output', '导出节点', '—', { targetHandle: 'image' }),
];

const AICG_IMAGE_OUT: HandleQuickAddOption[] = [
  opt('aicgVideoGen', 'AI视频节点', '视频', { description: '图生视频 / 文生视频' }),
  opt('aiVideo', 'AI视频', '视频', { description: '多模型图生视频 / 文生视频' }),
  opt('storyboardMaker', '制作故事版', '故事版', {
    description: '用图片/分镜表拆成故事版',
    targetHandle: 'imageInput',
  }),
  opt('gridDirector', '分镜导演', '分镜', {
    description: '图片参考分镜编排',
    targetHandle: 'imageInput',
  }),
  opt('localMatting', '智能抠图', '—', { targetHandle: 'image', description: '本地 ONNX 抠图' }),
  opt('aiImage', '画布扩展', '生图', {
    initialData: {
      params: {
        mode: 'outpaint',
        expandDirection: 'all',
        expandPixels: 256,
        fillMode: 'ai_generate',
      },
    },
    description: '向外扩展画布',
  }),
  opt('output', '导出节点', '—', { targetHandle: 'image' }),
];

/** nodeType → handleId → 可快速新建的下游节点 */
export const NODE_HANDLE_ADJACENCY: Record<string, Record<string, HandleQuickAddOption[]>> = {
  imageInput: {
    imageOutput: [...IMAGE_PIPELINE, opt('output', '导出节点', '—', { targetHandle: 'image' })],
  },
  aiImage: {
    output: AICG_IMAGE_OUT,
  },
  unifiedImageStudio: {
    output: AICG_IMAGE_OUT,
  },
  localMatting: {
    output: MATTED_IMAGE,
    mask: [
      opt('aiImage', '局部重绘', '生图', {
        initialData: { params: { mode: 'inpaint' } },
        targetHandle: 'input',
        description: '用遮罩做 inpaint',
      }),
    ],
  },
  gridDirector: {
    output: [
      opt('storyboardEdit', '分镜编辑', '分镜', {
        targetHandle: 'scriptInput',
        description: '镜头重排 / 宫格裁剪',
      }),
      opt('aicgVideoGen', '视频生成', '视频'),
      opt('aiImage', '图片生成', '生图'),
      opt('batchProcess', '批量处理', '批量', { targetHandle: 'input' }),
      opt('output', '导出节点', '—', { targetHandle: 'image' }),
    ],
  },
  scriptStoryboard: {
    output: [
      opt('storyboardEdit', '分镜编辑', '分镜', {
        targetHandle: 'scriptInput',
        description: '镜头重排 / 宫格裁剪',
      }),
      opt('aicgVideoGen', '视频生成', '视频', { targetHandle: 'input' }),
      opt('aiImage', '图片生成', '生图', { targetHandle: 'input' }),
      opt('batchProcess', '批量处理', '批量', { targetHandle: 'input' }),
    ],
    scenes: [
      opt('storyboardEdit', '分镜编辑', '分镜', { targetHandle: 'scriptInput' }),
      opt('aiVideo', 'AI视频', '视频', { targetHandle: 'prompt' }),
    ],
  },
  aiGenText: {
    textOutput: TEXT_PIPELINE,
    scenes: [
      opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'scriptInput' }),
      opt('aiImage', 'AI图片', '批量生图', { targetHandle: 'prompt' }),
      opt('aiVideo', 'AI视频', '批量生视频', { targetHandle: 'prompt' }),
      opt('aiImage', '批量生图', '生图', { targetHandle: 'prompt' }),
      opt('aicgVideoGen', '批量生视频', '视频', { targetHandle: 'prompt' }),
    ],
    script: [
      opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'scriptInput' }),
      opt('audioGen', '配音 / BGM', '音频', { targetHandle: 'prompt' }),
    ],
  },
  prompt: {
    promptOutput: TEXT_PIPELINE,
  },
  script: {
    scenes: [
      opt('storyboardMaker', '制作故事版', '故事版', {
        targetHandle: 'input',
        description: '整理为完整故事版',
      }),
      opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'scriptInput' }),
      opt('aiImage', 'AI图片', '批量生图', { targetHandle: 'prompt' }),
      opt('aiVideo', 'AI视频', '批量生视频', { targetHandle: 'prompt' }),
      opt('aiImage', '批量生图', '生图', { targetHandle: 'prompt' }),
      opt('aicgVideoGen', '批量生视频', '视频', { targetHandle: 'prompt' }),
    ],
    script: [
      opt('storyboardMaker', '制作故事版', '故事版', { targetHandle: 'input' }),
      opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'scriptInput' }),
      opt('audioGen', '配音 / BGM', '音频', { targetHandle: 'prompt' }),
    ],
  },
  storyboardMaker: {
    scenes: [
      opt('storyboardEdit', '分镜编辑', '分镜', { targetHandle: 'scriptInput' }),
      opt('aiVideo', 'AI视频', '视频', { targetHandle: 'prompt' }),
      opt('batchProcess', '批量处理', '批量', { targetHandle: 'input' }),
    ],
    prompt: [
      opt('aiVideo', 'AI视频', '视频', { targetHandle: 'prompt' }),
      opt('aiImage', '关键帧生图', '生图', { targetHandle: 'prompt' }),
    ],
    script: [opt('audioGen', '配音 / BGM', '音频', { targetHandle: 'prompt' })],
  },
  cameraPath: {
    output: [
      opt('aiVideo', '绑定 AI 视频', '运镜', {
        targetHandle: 'prompt',
        description: '使用当前选择的 Seedance、可灵或其他最新视频模型',
      }),
    ],
    prompt: [
      opt('aiVideo', 'Seedance 2.0 视频', '运镜', {
        targetHandle: 'prompt',
        description: '将镜头路径作为 Seedance 视频运镜控制',
      }),
    ],
    image: [
      opt('aiVideo', 'Seedance 2.0 图生视频', '首帧', {
        targetHandle: 'firstFrame',
        initialData: {
          params: {
            modelId: 'doubao-seedance-2-0',
            modelProvider: 'doubao',
            provider: 'doubao',
            generationMode: 'image_to_video',
          },
        },
      }),
    ],
  },
  aicgVideoGen: {
    output: VIDEO_OUTPUT,
  },
  aiVideo: {
    output: VIDEO_OUTPUT,
  },
  gridSplitter: {
    output: MATTED_IMAGE,
  },
  frameExtractor: {
    output: MATTED_IMAGE,
  },
  videoInput: {
    videoOutput: VIDEO_OUTPUT,
  },
  characterLibrary: {
    characterRef: [
      opt('aiImage', '角色生图', '生图'),
      opt('aicgVideoGen', '角色视频', '视频'),
      opt('characterConsistency', '角色一致性', '角色', { targetHandle: 'characterImage' }),
    ],
    outfitRef: [
      opt('aiImage', '服装参考生图', '生图'),
      opt('characterConsistency', '角色一致性', '角色', { targetHandle: 'targetImage' }),
    ],
    payload: [
      opt('aiGenText', '角色描述文本', '文本', { targetHandle: 'promptInput' }),
      opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'scriptInput' }),
    ],
  },
  characterConsistency: {
    output: [
      opt('multiAngle', '多角度', '多角度', { description: '角色多视角拆分' }),
      opt('aiImage', '图片生成', '生图'),
      opt('aicgVideoGen', '视频生成', '视频'),
      opt('output', '导出节点', '—', { targetHandle: 'image' }),
    ],
  },
  multiAngle: {
    output: [
      opt('characterConsistency', '角色一致性', '角色', { targetHandle: 'targetImage' }),
      opt('aiImage', '图片生成', '生图'),
      opt('aicgVideoGen', '视频生成', '视频'),
      opt('storyboardEdit', '分镜编辑', '分镜', { targetHandle: 'imageInput' }),
      opt('output', '导出节点', '—', { targetHandle: 'image' }),
    ],
    prompt: [opt('aiImage', '多角度生图', '生图'), opt('aicgVideoGen', '多角度生视频', '视频')],
  },
  adCopyText: {
    output: TEXT_PIPELINE,
    prompt: [
      opt('aiImage', 'AI图片', '生图', { targetHandle: 'prompt' }),
      opt('aiVideo', 'AI视频', '视频', { targetHandle: 'prompt' }),
      opt('audioGen', 'AI配音', '音频', { targetHandle: 'prompt' }),
    ],
  },
  brandCopyText: {
    output: [opt('adCopyText', '广告词', '文案'), ...TEXT_PIPELINE],
    prompt: [
      opt('aiImage', 'AI图片', '生图', { targetHandle: 'prompt' }),
      opt('aiImage', '图片生成', '生图'),
    ],
  },
  storyboardEdit: {
    output: [
      opt('aiImage', '批量生图', '生图', { targetHandle: 'prompt' }),
      opt('aicgVideoGen', '批量生视频', '视频', { targetHandle: 'prompt' }),
      opt('batchProcess', '批量处理', '批量', { targetHandle: 'input' }),
    ],
    scenes: [opt('batchProcess', '批量处理', '批量', { targetHandle: 'input' })],
  },
  director3D: {
    output: [
      opt('aiImage', '3D 截图生图', '生图', { targetHandle: 'input' }),
      opt('aiVideo', 'AI视频', '视频', { targetHandle: 'input' }),
      opt('panorama360', '全景预览', '全景', { targetHandle: 'input' }),
    ],
    prompt: [
      opt('aiVideo', 'AI视频', '视频', { targetHandle: 'prompt' }),
      opt('prompt', '提示词', '镜头', { targetHandle: 'input' }),
      opt('aiImage', '图片生成', '生图', { targetHandle: 'input' }),
    ],
  },
  panorama360: {
    imageOutput: [
      opt('aiImage', '全景生图', '生图', { targetHandle: 'input' }),
      opt('aicgVideoGen', '视频生成', '视频', { targetHandle: 'input' }),
      opt('output', '导出节点', '—', { targetHandle: 'image' }),
    ],
    prompt: [opt('aicgVideoGen', '视频生成', '视频', { targetHandle: 'input' })],
  },
  audioGen: {
    audioOutput: [
      opt('aicgVideoGen', '视频生成', '视频', { description: '配乐 / 配音视频' }),
      opt('output', '导出节点', '—', { targetHandle: 'audio' }),
    ],
  },
  audioInput: {
    audioOutput: [
      opt('aicgVideoGen', '视频生成', '视频', { description: '配乐 / 配音视频' }),
      opt('output', '导出节点', '—', { targetHandle: 'audio' }),
    ],
  },
  imageCollage: {
    output: [
      opt('aiImage', '图片生成', '生图'),
      opt('aicgVideoGen', '视频生成', '视频'),
      opt('gridDirector', '分镜导演', '分镜', { targetHandle: 'imageInput' }),
      opt('output', '导出节点', '—', { targetHandle: 'image' }),
    ],
  },
  batchProcess: {
    results: [],
  },
};

export function getQuickAddOptions(nodeType: string, handleId: string): HandleQuickAddOption[] {
  const canonical = resolveQuickAddNodeType(nodeType);
  return NODE_HANDLE_ADJACENCY[canonical]?.[handleId] ?? [];
}

/** 可连到当前节点输入端的上游节点（由搭配表反查） */
export function getUpstreamQuickAddOptions(
  nodeType: string,
  handleId: string
): HandleQuickAddOption[] {
  const canonical = resolveQuickAddNodeType(nodeType);
  const results: HandleQuickAddOption[] = [];
  const seen = new Set<string>();

  for (const [sourceNodeType, handleMap] of Object.entries(NODE_HANDLE_ADJACENCY)) {
    for (const [sourceHandleId, options] of Object.entries(handleMap)) {
      for (const option of options) {
        const targetType = resolveQuickAddNodeType(option.nodeType);
        const targetHandle =
          option.targetHandle || getDefaultTargetHandle(option.nodeType, sourceNodeType);
        if (targetType !== canonical || targetHandle !== handleId) continue;

        const key = `${sourceNodeType}:${sourceHandleId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          nodeType: sourceNodeType,
          label: getNodeTypeLabel(sourceNodeType),
          description: option.description,
          workflowTag: option.workflowTag,
          sourceHandle: sourceHandleId,
          targetHandle: handleId,
          offsetX: -(option.offsetX ?? 480),
          offsetY: option.offsetY,
        });
      }
    }
  }

  return results;
}

export function getNodeTypeLabel(nodeType: string): string {
  const id = resolveQuickAddNodeType(nodeType);
  return QUICK_ADD_NODE_DEFINITIONS.find((n) => n.id === id)?.name || id;
}

export function buildDefaultNodeData(
  nodeType: string,
  initialData?: Record<string, unknown>
): Record<string, unknown> {
  const canonical = resolveQuickAddNodeType(nodeType);
  const def = QUICK_ADD_NODE_DEFINITIONS.find((n) => n.id === canonical);
  const defaultParams = { ...(def?.defaultParams || {}) };

  const resolved = nodeModelMatcher.resolveModelOnNodeCreate(canonical);
  if (resolved && !defaultParams.modelId) {
    defaultParams.modelId = resolved.modelId;
    defaultParams.modelProvider = resolved.provider;
  }

  return withCanvasNodeDefaultSize(canonical, {
    type: canonical,
    label: getNodeTypeLabel(canonical),
    params: { ...defaultParams, ...((initialData?.params as Record<string, unknown>) || {}) },
    ...initialData,
  });
}
