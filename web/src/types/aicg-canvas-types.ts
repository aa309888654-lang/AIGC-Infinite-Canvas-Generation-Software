/**
 * AICG 画布节点体系
 *
 * AICG 五大基础节点：文本 / 图片 / 视频 / 音频 / 脚本
 * 专业工具（宫格分镜、抠图等）通过节点内 "/" 指令或句柄快速新建接入
 */

import type { NodeTypeDefinition } from '@/types/node-system';
import { NODE_TYPES } from '@/types/node-system';
import { isCollapsedAICGPaletteNode, isPrimaryAICGPaletteNode } from '@/config/aicg-node-catalog';

export type AICGBaseType = 'text' | 'image' | 'video' | 'audio' | 'script';

export type AICGToolType =
  | 'matting'
  | 'grid'
  | 'frameExtract'
  | 'director'
  | 'collage'
  | 'character'
  | 'output'
  | 'batch'
  | 'panorama'
  | 'director3d'
  | 'copywriting'
  | 'storyboardEdit'
  | 'vr360';

export const AICG_BASE_TYPE_LABELS: Record<AICGBaseType, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  script: '脚本',
};

/** AICG 五大基础节点 → 小天 node id（新 AI 入口优先，旧生图/生视频节点保留为备选） */
export const AICG_BASE_NODE_MAP: Record<
  AICGBaseType,
  { primary: string; alternates?: string[]; description: string }
> = {
  text: {
    primary: 'aiGenText',
    alternates: ['prompt'],
    description: 'AI 生成文本 / 提示词',
  },
  image: {
    primary: 'aiImage',
    alternates: ['imageInput', 'unifiedImageStudio'],
    description: 'AI 图片生成 / 上传图片 / 参考图',
  },
  video: {
    primary: 'aiVideo',
    alternates: ['videoInput'],
    description: 'AI 视频生成 / 上传视频 / 多模型视频',
  },
  audio: {
    primary: 'audioGen',
    description: '上传/生成音频、配音与 BGM',
  },
  script: {
    primary: 'script',
    description: '剧本解析 → 智能分镜（视频/角色参考）',
  },
};

/** 小天扩展工具节点 → AICG 能力对照 */
export const AICG_TOOL_NODE_MAP: Record<
  string,
  { aicgTool: string; aicgName: string; canMimic: boolean }
> = {
  localMatting: {
    aicgTool: 'matting',
    aicgName: '抠图/去背景（AICG 通过 / 指令）',
    canMimic: true,
  },
  adCopyText: { aicgTool: 'copywriting', aicgName: '广告词 / 短视频口播', canMimic: true },
  brandCopyText: { aicgTool: 'copywriting', aicgName: '品牌文案 / 海报标题', canMimic: true },
  gridSplitter: { aicgTool: 'grid', aicgName: '9/25 宫格分镜', canMimic: true },
  frameExtractor: { aicgTool: 'frameExtract', aicgName: '视频抽帧 / 关键帧提取', canMimic: true },
  gridDirector: { aicgTool: 'director', aicgName: '分镜导演 / 连贯分镜', canMimic: true },
  scriptStoryboard: { aicgTool: 'director', aicgName: '剧本分镜 / 剧本拆镜', canMimic: true },
  storyboardMaker: {
    aicgTool: 'storyboardEdit',
    aicgName: '制作故事版 / 分镜蓝图 / 视频提示词',
    canMimic: true,
  },
  storyboardEdit: { aicgTool: 'storyboardEdit', aicgName: '分镜编辑 / 宫格裁剪', canMimic: true },
  imageCollage: { aicgTool: 'collage', aicgName: '多图排版', canMimic: true },
  characterLibrary: { aicgTool: 'character', aicgName: '角色三视图 / 角色库', canMimic: true },
  characterConsistency: { aicgTool: 'character', aicgName: '角色一致性', canMimic: true },
  output: { aicgTool: 'export', aicgName: '成片导出（AI 剪辑时间线已接入）', canMimic: true },
  batchProcess: { aicgTool: 'batch', aicgName: '整组执行', canMimic: true },
  director3D: { aicgTool: 'camera', aicgName: '多机位 / 3D 预演', canMimic: true },
  panorama360: { aicgTool: 'panorama', aicgName: '全景预览', canMimic: true },
  aiImage: { aicgTool: 'imageGen', aicgName: 'AI 图片统一入口', canMimic: true },
  aiVideo: { aicgTool: 'videoGen', aicgName: 'AI 视频统一入口', canMimic: true },
  unifiedImageStudio: { aicgTool: 'imageGen', aicgName: '图片模型生成（经典）', canMimic: true },
};

export function getNodeDefinition(id: string): NodeTypeDefinition | undefined {
  return NODE_TYPES.find((n) => n.id === id);
}

export function getAICGBaseNodes(): NodeTypeDefinition[] {
  return (Object.values(AICG_BASE_NODE_MAP) as Array<{ primary: string }>)
    .map((m) => getNodeDefinition(m.primary))
    .filter(Boolean) as NodeTypeDefinition[];
}

export function getAICGToolNodes(): NodeTypeDefinition[] {
  const toolIds = Object.keys(AICG_TOOL_NODE_MAP).filter(
    (id) =>
      !isPrimaryAICGPaletteNode(id) &&
      !isCollapsedAICGPaletteNode(id) &&
      id !== 'unifiedImageStudio' &&
      id !== 'aiImage' &&
      id !== 'aiVideo' &&
      id !== 'gridSplitter' &&
      id !== 'imageCollage'
  );
  return toolIds
    .map((id) => getNodeDefinition(id))
    .filter((node): node is NodeTypeDefinition => Boolean(node && !node.deprecated));
}

/** AICG 有而小天尚未实现的能力（第 6 点暂缓） */
export const AICG_MISSING_FEATURES = [
  { id: 'compliance-check', name: '真人素材合规校验 / 人像授权', priority: 'low' },
] as const;

/** 已实现 AICG 对齐项（供 UI 展示） */
export const AICG_IMPLEMENTED_FEATURES = [
  { id: 'five-base-nodes', name: '五大基础节点 + 节点库分区' },
  { id: 'pane-double-click', name: '双击画布快速新建（含流水线模板）' },
  { id: 'handle-quick-add', name: '句柄点击快速新建' },
  { id: 'left-plus-quick-add', name: '节点左侧 + 快速新建（AICG）' },
  { id: 'node-shell-ui', name: 'AICG 统一节点外壳（glass-stack）' },
  { id: 'group-execute', name: 'Ctrl+G 打组 + 编组 overlay + 整组执行' },
  { id: 'slash-tools', name: '/ 指令（含 /合成）' },
  { id: 'global-mention', name: '全局 @ 引用组件（AICGNodePromptBar）' },
  { id: 'downstream-sync', name: '抠图 / 切格 / 分镜 / 剧本 → 下游自动同步' },
  { id: 'workflow-template', name: '我的工具箱 + 8 条预设流水线' },
  { id: 'context-menu', name: '画布右键：打组 / 执行 / 工具箱' },
  { id: 'output-to-clip', name: 'OutputNode → AI 剪辑板块' },
  { id: 'video-compose', name: '多视频连线 → 合成节点' },
  { id: 'video-frame-extractor', name: '视频抽帧节点 → 图片链路' },
  { id: 'script-modes', name: '脚本：剧本 / 视频参考 / 角色参考' },
  { id: 'multi-canvas-tab', name: '同项目多画布 Tab' },
  { id: 'mini-timeline', name: '输出节点迷你时间轴 I/O' },
  { id: 'grid-cell-regen', name: '宫格单格重生 + 下游同步' },
  { id: 'video-pro-sliders', name: '视频节点光影/运镜滑块' },
  { id: 'agent-skill-api', name: 'Agent Skill HTTP API (/api/v1/aicg-skills)' },
  { id: 'marketplace-official', name: '工作流市场官方 AICG 模板包' },
] as const;
