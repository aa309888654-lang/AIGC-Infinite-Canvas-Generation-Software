/**
 * AICG 节点内 / 指令 — 快速创建并连接专业工具节点
 */

import type { HandleQuickAddOption } from '@/services/node-handle-adjacency';
import { getQuickAddOptions } from '@/services/node-handle-adjacency';

export interface AICGSlashCommand {
  id: string;
  slash: string;
  label: string;
  description: string;
  nodeType: string;
  targetHandle?: string;
  sourceHandle?: string;
  initialData?: Record<string, unknown>;
  /** 适用的源节点类型 */
  forNodeTypes?: string[];
}

export const AICG_SLASH_COMMANDS: AICGSlashCommand[] = [
  {
    id: 'grid',
    slash: '/宫格',
    label: '九宫格切分',
    description: '9/25 宫格分镜',
    nodeType: 'aiImage',
    initialData: { params: { workspace: 'gridSplit' } },
    forNodeTypes: ['imageInput', 'unifiedImageStudio', 'aicgImageGen', 'aiImage', 'localMatting'],
  },
  {
    id: 'matting',
    slash: '/抠图',
    label: '智能抠图',
    description: '本地 ONNX 去背景',
    nodeType: 'localMatting',
    targetHandle: 'image',
  },
  {
    id: 'director',
    slash: '/分镜',
    label: '分镜导演',
    description: '连贯分镜编排',
    nodeType: 'gridDirector',
  },
  {
    id: 'collage',
    slash: '/拼图',
    label: '图片拼图',
    description: '多图排版合成',
    nodeType: 'aiImage',
    initialData: { params: { workspace: 'collage' } },
  },
  {
    id: 'character',
    slash: '/角色',
    label: '角色库',
    description: '三视图 / 角色参考',
    nodeType: 'characterLibrary',
  },
  {
    id: 'consistency',
    slash: '/一致性',
    label: '角色一致性',
    description: '保持角色外观',
    nodeType: 'characterConsistency',
    targetHandle: 'characterImage',
  },
  {
    id: 'video',
    slash: '/视频',
    label: 'AI 视频',
    description: '图生视频 / 文生视频',
    nodeType: 'aiVideo',
  },
  {
    id: 'image',
    slash: '/生图',
    label: 'AI 图片',
    description: 'AI 文生图 / 图生图',
    nodeType: 'aiImage',
  },
  {
    id: 'output',
    slash: '/导出',
    label: '成片导出',
    description: '汇总导出结果',
    nodeType: 'output',
    targetHandle: 'image',
  },
  {
    id: 'batch',
    slash: '/批量',
    label: '批量处理',
    description: '整组批量执行',
    nodeType: 'batchProcess',
  },
  {
    id: 'frame-extractor',
    slash: '/抽帧',
    label: '视频抽帧',
    description: '提取关键帧作为图片继续创作',
    nodeType: 'frameExtractor',
    targetHandle: 'input',
    forNodeTypes: ['videoInput', 'aiVideo', 'advancedVideoGen'],
  },
  {
    id: 'prompt',
    slash: '/提示词',
    label: '提示词',
    description: '结构化提示词节点',
    nodeType: 'prompt',
    forNodeTypes: ['aiGenText', 'script'],
  },
  {
    id: 'script',
    slash: '/剧本',
    label: '剧本解析',
    description: '剧本 → 分镜',
    nodeType: 'aiGenText',
    initialData: { textWorkspace: 'script' },
  },
  { id: 'audio', slash: '/音频', label: '音频', description: '配音 / BGM', nodeType: 'audioGen' },
  { id: '3d', slash: '/3d', label: '3D 导演', description: '多机位预演', nodeType: 'director3D' },
  {
    id: 'panorama',
    slash: '/全景',
    label: '全景预览',
    description: '360° 预览',
    nodeType: 'panorama360',
  },
];

export function filterSlashCommands(
  query: string,
  nodeType: string,
  handleId?: string
): AICGSlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q.startsWith('/')) return [];

  const fromAdjacency = handleId
    ? getQuickAddOptions(nodeType, handleId).map((o) => slashFromQuickAdd(o))
    : [];

  const merged = [...AICG_SLASH_COMMANDS];
  for (const adj of fromAdjacency) {
    if (!merged.some((m) => m.nodeType === adj.nodeType)) merged.push(adj);
  }

  return merged.filter((cmd) => {
    if (cmd.forNodeTypes && !cmd.forNodeTypes.includes(nodeType)) return false;
    if (q === '/') return true;
    return cmd.slash.toLowerCase().includes(q) || cmd.label.toLowerCase().includes(q.slice(1));
  });
}

function slashFromQuickAdd(opt: HandleQuickAddOption): AICGSlashCommand {
  return {
    id: opt.nodeType,
    slash: `/${opt.label}`,
    label: opt.label,
    description: opt.description || opt.label,
    nodeType: opt.nodeType,
    targetHandle: opt.targetHandle,
    sourceHandle: opt.sourceHandle,
    initialData: opt.initialData,
  };
}

export function slashCommandToQuickAdd(cmd: AICGSlashCommand): HandleQuickAddOption {
  return {
    nodeType: cmd.nodeType,
    label: cmd.label,
    description: cmd.description,
    targetHandle: cmd.targetHandle,
    sourceHandle: cmd.sourceHandle,
    initialData: cmd.initialData,
  };
}
