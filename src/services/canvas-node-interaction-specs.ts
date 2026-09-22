/**
 * 画布节点深度交互 E2E 规格 — 仅包含不触发付费 API 的安全点击
 */
import { getActiveNodeDefinitions } from '@/services/canvas-node-registry-validator';

export type NodePrepareAction = 'none' | 'select' | 'doubleClickPreview' | 'expandHeader';

export interface NodeClickAction {
  /** button: getByRole('button'); title: getByTitle; label: getByLabel; text: getByText; select/checkbox/slider: form elements */
  label: string;
  exact?: boolean;
  matchBy?: 'name' | 'title' | 'label' | 'text' | 'select' | 'checkbox' | 'slider' | 'contains';
}

export interface NodeInteractionSpec {
  nodeType: string;
  name: string;
  prepare?: NodePrepareAction;
  /** 依次点击；元素不存在时跳过（不失败） */
  clicks: NodeClickAction[];
  /** 至少应成功点击的数量（用于断言） */
  minClicksRequired: number;
}

export const NODE_INTERACTION_SPECS: NodeInteractionSpec[] = [
  {
    nodeType: 'prompt',
    name: '提示词',
    prepare: 'select',
    clicks: [{ label: '视频' }, { label: '图片' }, { label: '反向词' }, { label: '模板' }],
    minClicksRequired: 2,
  },
  {
    nodeType: 'aiGenText',
    name: '文本节点',
    prepare: 'select',
    clicks: [
      { label: '自己编写内容' },
      { label: '文生视频' },
      { label: '图片反推提示词' },
      { label: '文生配音' },
      { label: '翻译为英文' },
    ],
    minClicksRequired: 3,
  },
  {
    nodeType: 'imageInput',
    name: '图片输入',
    prepare: 'select',
    clicks: [{ label: '上传图片', matchBy: 'title' }],
    minClicksRequired: 1,
  },
  {
    nodeType: 'videoInput',
    name: '视频输入',
    prepare: 'select',
    clicks: [{ label: '点击上传视频', matchBy: 'text' }],
    minClicksRequired: 1,
  },
  {
    nodeType: 'frameExtractor',
    name: '视频抽帧',
    prepare: 'select',
    clicks: [
      { label: '上传视频', matchBy: 'title' },
      { label: '抽取视频帧', matchBy: 'title' },
      { label: '清空抽帧结果', matchBy: 'title' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'audioGen',
    name: '音频',
    prepare: 'select',
    clicks: [
      { label: '文生配音' },
      { label: 'AI配音' },
      { label: '上传音乐' },
      { label: '展开输入框', matchBy: 'title' },
    ],
    minClicksRequired: 3,
  },
  {
    nodeType: 'audioInput',
    name: '音频输入',
    prepare: 'select',
    clicks: [
      { label: '上传音频' },
      { label: '上传参考音色' },
      { label: '展开输入框', matchBy: 'title' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'aiVideo',
    name: 'AI 视频节点',
    prepare: 'select',
    clicks: [
      { label: '文生视频' },
      { label: '全能参考' },
      { label: '图生视频' },
      { label: '首尾帧' },
      { label: '运镜 / 光源' },
    ],
    minClicksRequired: 3,
  },
  {
    nodeType: 'aiVideo',
    name: 'AI视频',
    prepare: 'select',
    clicks: [
      { label: '文生视频' },
      { label: '多图参考' },
      { label: '首帧生成视频' },
      { label: '首尾帧生成视频' },
    ],
    minClicksRequired: 2,
  },
  {
    nodeType: 'aiImage',
    name: 'AI图片',
    prepare: 'select',
    clicks: [
      { label: '文生图', matchBy: 'text' },
      { label: '图生图', matchBy: 'text' },
      { label: '图片参考', matchBy: 'text' },
      { label: '图片高清', matchBy: 'text' },
    ],
    minClicksRequired: 3,
  },
  {
    nodeType: 'aiImage',
    name: 'AI 图片节点',
    prepare: 'select',
    clicks: [
      { label: '拼图', matchBy: 'text' },
      { label: '宫格切分', matchBy: 'text' },
      { label: '文生图', matchBy: 'text' },
      { label: '图生图', matchBy: 'text' },
      { label: '图片参考', matchBy: 'text' },
      { label: '图片高清', matchBy: 'text' },
      { label: '高级参数', matchBy: 'title' },
      { label: '分析', matchBy: 'contains' },
    ],
    minClicksRequired: 4,
  },
  {
    nodeType: 'adCopyText',
    name: '广告词',
    prepare: 'select',
    clicks: [
      { label: 'AI图片', matchBy: 'text' },
      { label: 'AI视频', matchBy: 'text' },
      { label: '配音', matchBy: 'text' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'brandCopyText',
    name: '品牌文案',
    prepare: 'select',
    clicks: [
      { label: 'AI图片', matchBy: 'text' },
      { label: '广告词', matchBy: 'text' },
      { label: '输出', matchBy: 'text' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'scriptStoryboard',
    name: '剧本分镜',
    prepare: 'select',
    clicks: [
      { label: '导入', matchBy: 'text' },
      { label: '模板', matchBy: 'text' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'script',
    name: '剧本解析',
    prepare: 'select',
    clicks: [
      { label: '属性', matchBy: 'title' },
      { label: '导入剧本', matchBy: 'text' },
      { label: '导出', matchBy: 'text' },
      { label: '保存模板', matchBy: 'text' },
      { label: '加载模板', matchBy: 'text' },
    ],
    minClicksRequired: 2,
  },
  {
    nodeType: 'storyboardEdit',
    name: '分镜编辑',
    prepare: 'select',
    clicks: [
      { label: '批量生图', matchBy: 'text' },
      { label: '批量生视频', matchBy: 'text' },
      { label: '批量处理', matchBy: 'text' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'localMatting',
    name: '智能抠图',
    prepare: 'select',
    clicks: [
      { label: '自动' },
      { label: '点击' },
      { label: '框选' },
      { label: '高级选项' },
      { label: '更换' },
    ],
    minClicksRequired: 3,
  },
  {
    nodeType: 'characterLibrary',
    name: '角色库',
    prepare: 'select',
    clicks: [{ label: '选择角色资产', matchBy: 'select' }],
    minClicksRequired: 1,
  },
  {
    nodeType: 'sceneLibrary',
    name: '场景库',
    prepare: 'select',
    clicks: [{ label: '选择场景资产', matchBy: 'select' }],
    minClicksRequired: 1,
  },
  {
    nodeType: 'propLibrary',
    name: '道具库',
    prepare: 'select',
    clicks: [{ label: '选择道具资产', matchBy: 'select' }],
    minClicksRequired: 1,
  },
  {
    nodeType: 'gridDirector',
    name: '分镜导演',
    prepare: 'select',
    clicks: [
      { label: '角色转身' },
      { label: '产品展示', matchBy: 'contains' },
      { label: '布局', matchBy: 'label' },
    ],
    minClicksRequired: 3,
  },
  {
    nodeType: 'characterConsistency',
    name: '角色一致性',
    prepare: 'select',
    clicks: [
      { label: '快速' },
      { label: 'AI' },
      { label: '一致性强度', matchBy: 'slider' },
      { label: '人脸增强', matchBy: 'checkbox' },
    ],
    minClicksRequired: 3,
  },
  {
    nodeType: 'batchProcess',
    name: '批量处理',
    prepare: 'select',
    clicks: [{ label: '高级选项' }, { label: '添加任务项' }],
    minClicksRequired: 1,
  },
  {
    nodeType: 'director3D',
    name: '3D导演台',
    prepare: 'select',
    clicks: [{ label: '折叠', matchBy: 'title' }],
    minClicksRequired: 1,
  },
  {
    nodeType: 'multiAngle',
    name: '多角度',
    prepare: 'select',
    clicks: [
      { label: '正面', matchBy: 'text' },
      { label: '侧面', matchBy: 'text' },
      { label: '背面', matchBy: 'text' },
      { label: '细节', matchBy: 'text' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'panorama360',
    name: '360°全景图',
    prepare: 'select',
    clicks: [
      { label: '折叠', matchBy: 'title' },
      { label: '上传全景图', matchBy: 'title' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'imageCollage',
    name: '图片拼图',
    prepare: 'select',
    clicks: [
      { label: '模板', matchBy: 'text' },
      { label: '文字', matchBy: 'text' },
      { label: '滤镜', matchBy: 'text' },
      { label: '设置', matchBy: 'title' },
    ],
    minClicksRequired: 1,
  },
  {
    nodeType: 'gridSplitter',
    name: '宫格切分',
    prepare: 'select',
    clicks: [{ label: '2×2' }, { label: '3×3' }, { label: '4×4' }, { label: '5×5' }],
    minClicksRequired: 2,
  },
  {
    nodeType: 'output',
    name: '输出',
    prepare: 'select',
    clicks: [{ label: '−' }, { label: '+' }],
    minClicksRequired: 1,
  },
];

/** 跳过会触发 API 的按钮文案（Playwright 断言用） */
export const API_TRIGGER_LABELS = [
  /^生成$/,
  /^生成视频$/,
  /^开始生成$/,
  /^开始分析$/,
  /^开始智能抠图$/,
  /^AI 解析剧本$/,
  /^编组执行$/,
  /^开始批量处理$/,
  /^增强$/,
  /^智能优化$/,
];

export function validateInteractionSpecCoverage(): string[] {
  const activeIds = new Set(getActiveNodeDefinitions().map((d) => d.id));
  const specIds = new Set(NODE_INTERACTION_SPECS.map((s) => s.nodeType));
  const missing: string[] = [];
  for (const id of activeIds) {
    if (!specIds.has(id)) missing.push(id);
  }
  return missing;
}
