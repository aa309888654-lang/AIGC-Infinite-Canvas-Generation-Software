import type {
  NodeControllerAction,
  NodeControllerSummaryItem,
} from '@/components/canvas/nodes/NodeControllerCapabilityPanel';

export type ControllerNodeKind =
  | 'image'
  | 'video'
  | 'text'
  | 'script'
  | 'audio'
  | 'character'
  | 'matting'
  | 'scene3d'
  | 'panorama'
  | 'videoInput'
  | 'characterConsistency'
  | 'output'
  | 'batch'
  | 'multiAngle'
  | 'gridSplitter'
  | 'group';

export interface NodeControllerV2Descriptor {
  title: string;
  subtitle: string;
  sections: {
    try?: string;
    result?: string;
    downstream?: string;
  };
}

export interface NodeControllerCapabilityPreset {
  kind: ControllerNodeKind;
  tryActions: NodeControllerAction[];
  resultActions: NodeControllerAction[];
  summary: NodeControllerSummaryItem[];
  v2: NodeControllerV2Descriptor;
}

const baseImageTryActions: NodeControllerAction[] = [
  { id: 'image-to-image', label: '图生图', icon: 'image' },
  { id: 'image-upscale', label: '图片高清', icon: 'upscale' },
];

const baseImageResultActions: NodeControllerAction[] = [
  { id: 'panorama', label: '全景', icon: 'panorama', title: '生成全景扩展节点' },
  { id: 'multi-angle', label: '多角度', icon: 'multiAngle', title: '生成多角度参考' },
  { id: 'relight', label: '打光', icon: 'relight', title: '进入灯光/背景处理' },
  { id: 'grid', label: '九宫格', icon: 'grid', title: '创建九宫格分镜参考' },
  { id: 'upscale', label: '高清', icon: 'upscale', title: '切换到高清放大模式' },
  { id: 'grid-split', label: '宫格切分', icon: 'split', title: '创建宫格切分节点' },
];

const baseVideoTryActions: NodeControllerAction[] = [
  { id: 'first-last-video', label: '首尾帧生成视频', icon: 'video' },
  { id: 'first-frame-video', label: '首帧生成视频', icon: 'sparkles' },
];

const baseVideoResultActions: NodeControllerAction[] = [
  { id: 'send-to-clip', label: 'AI剪辑', icon: 'split', tone: 'primary' },
  { id: 'download', label: '下载', icon: 'download' },
  { id: 'preview', label: '预览', icon: 'expand' },
];

const baseTextTryActions: NodeControllerAction[] = [
  { id: 'write', label: '自己编写内容', icon: 'sparkles' },
  { id: 'text-to-video', label: '文生视频', icon: 'video' },
  { id: 'image-to-prompt', label: '图片反推提示词', icon: 'image' },
  { id: 'text-to-music', label: '文生配音', icon: 'music' },
];

const baseScriptTryActions: NodeControllerAction[] = [
  { id: 'text', label: '剧本拆镜', icon: 'split', tone: 'primary' },
  { id: 'image_reference', label: '图片参考', icon: 'image' },
  { id: 'video_reference', label: '视频参考', icon: 'video' },
  { id: 'character_reference', label: '角色参考', icon: 'character' },
];

const baseScriptResultActions: NodeControllerAction[] = [
  { id: 'generate-scenes', label: 'AI拆镜', icon: 'sparkles', tone: 'primary' },
  { id: 'add-scene', label: '添加镜头', icon: 'send' },
  { id: 'enhance-scenes', label: '专业增强', icon: 'upscale' },
  { id: 'export-script', label: '导出', icon: 'export' },
  { id: 'save-template', label: '保存模板', icon: 'save' },
  { id: 'load-template', label: '加载模板', icon: 'import' },
];

const baseAudioTryActions: NodeControllerAction[] = [
  { id: 'text-to-music', label: '文生配音', icon: 'music' },
  { id: 'voiceover', label: 'AI配音', icon: 'music' },
  { id: 'upload-music', label: '上传音乐', icon: 'upload' },
];

const baseCharacterResultActions: NodeControllerAction[] = [
  {
    id: 'character-consistency',
    label: '角色一致性',
    icon: 'character',
    title: '连接角色一致性节点',
  },
  { id: 'storyboard', label: '分镜引用', icon: 'split', title: '发送角色设定到分镜导演' },
  { id: 'sync', label: '同步下游', icon: 'send', title: '刷新所有下游节点' },
];

const baseMattingResultActions: NodeControllerAction[] = [
  { id: 'auto-matting', label: '智能抠图', icon: 'sparkles', tone: 'primary' },
  { id: 'sam-matting', label: '交互分割', icon: 'split' },
  { id: 'download', label: '下载', icon: 'download' },
  { id: 'reset', label: '恢复原图', icon: 'reset' },
];

const baseSceneResultActions: NodeControllerAction[] = [
  { id: 'starter-scene', label: '快速搭景', icon: 'sparkles', tone: 'primary' },
  { id: 'capture', label: '截图', icon: 'camera' },
  { id: 'import-model', label: '导入模型', icon: 'model3d' },
  { id: 'export-scene', label: '导出场景', icon: 'export' },
  { id: 'panorama', label: '全景输入', icon: 'panorama' },
];

const basePanoramaResultActions: NodeControllerAction[] = [
  { id: 'upload-panorama', label: '上传全景', icon: 'upload', tone: 'primary' },
  { id: 'auto-rotate', label: '环视', icon: 'panorama' },
  { id: 'prompt', label: '提示词', icon: 'sparkles' },
  { id: 'reset-view', label: '重置视角', icon: 'reset' },
  { id: 'fullscreen', label: '全屏', icon: 'expand' },
];

const baseVideoInputResultActions: NodeControllerAction[] = [
  { id: 'send-to-clip', label: 'AI剪辑', icon: 'split', tone: 'primary' },
  { id: 'enhance', label: '高清', icon: 'upscale' },
  { id: 'analyze', label: '解析', icon: 'analyze' },
  { id: 'subtitle', label: '字幕', icon: 'subtitle' },
  { id: 'audio-separate', label: '音频分离', icon: 'music' },
  { id: 'save', label: '保存', icon: 'save' },
  { id: 'download', label: '下载', icon: 'download' },
  { id: 'remove', label: '移除', icon: 'trash' },
];

const baseCharacterConsistencyResultActions: NodeControllerAction[] = [
  { id: 'process', label: '保持一致性', icon: 'character', tone: 'primary' },
  { id: 'quick-mode', label: '快速模式', icon: 'upscale' },
  { id: 'ai-mode', label: 'AI模式', icon: 'sparkles' },
  { id: 'download', label: '下载', icon: 'download' },
];

const baseOutputResultActions: NodeControllerAction[] = [
  { id: 'send-to-clip', label: 'AI剪辑', icon: 'split', tone: 'primary' },
  { id: 'download', label: '下载', icon: 'download' },
  { id: 'preview', label: '预览', icon: 'expand' },
  { id: 'send-downstream', label: '发送下游', icon: 'send' },
];

const baseBatchTryActions: NodeControllerAction[] = [
  { id: 'execute-group', label: '编组执行', icon: 'sparkles', tone: 'primary' },
  { id: 'start-batch', label: '开始批量处理', icon: 'send' },
  { id: 'advanced', label: '高级选项', icon: 'settings' },
];

const baseBatchResultActions: NodeControllerAction[] = [
  { id: 'stop-batch', label: '停止处理', icon: 'reset' },
  { id: 'clear-items', label: '清空任务', icon: 'trash' },
];

const baseMultiAngleTryActions: NodeControllerAction[] = [
  { id: 'front', label: '正面', icon: 'camera' },
  { id: 'side', label: '侧面', icon: 'multiAngle' },
  { id: 'back', label: '背面', icon: 'camera' },
  { id: 'detail', label: '细节', icon: 'analyze' },
  { id: 'hero', label: '主视觉', icon: 'sparkles' },
];

const baseMultiAngleResultActions: NodeControllerAction[] = [
  { id: 'apply-prompt', label: '应用提示词', icon: 'send', tone: 'primary' },
  { id: 'sync-downstream', label: '同步下游', icon: 'send' },
];

const baseGridSplitterTryActions: NodeControllerAction[] = [
  { id: 'layout-2x2', label: '2×2', icon: 'grid' },
  { id: 'layout-3x3', label: '3×3', icon: 'grid' },
  { id: 'layout-4x4', label: '4×4', icon: 'grid' },
  { id: 'layout-5x5', label: '5×5', icon: 'grid' },
];

const baseGridSplitterResultActions: NodeControllerAction[] = [
  { id: 'split', label: '分割', icon: 'split', tone: 'primary' },
  { id: 'select-all', label: '全选', icon: 'grid' },
  { id: 'clear-selection', label: '取消选择', icon: 'reset' },
  { id: 'download-selected', label: '下载', icon: 'download' },
];

export function getNodeControllerPreset(kind: ControllerNodeKind): NodeControllerCapabilityPreset {
  switch (kind) {
    case 'image':
      return {
        kind,
        tryActions: baseImageTryActions,
        resultActions: baseImageResultActions,
        summary: [],
        v2: {
          title: '图像控制器',
          subtitle: '图像生成能力、结果动作与下游工具',
          sections: { try: '尝试能力', result: '结果动作', downstream: '下游工具' },
        },
      };
    case 'video':
      return {
        kind,
        tryActions: baseVideoTryActions,
        resultActions: baseVideoResultActions,
        summary: [],
        v2: {
          title: '视频控制器',
          subtitle: '视频生成能力、成片动作与 AI 剪辑',
          sections: { try: '尝试能力', result: '成片动作', downstream: '下游工具' },
        },
      };
    case 'text':
      return {
        kind,
        tryActions: baseTextTryActions,
        resultActions: [],
        summary: [],
        v2: {
          title: '文本控制器',
          subtitle: '文本生成能力与下游创作入口',
          sections: { try: '尝试能力', result: '文本动作', downstream: '下游工具' },
        },
      };
    case 'script':
      return {
        kind,
        tryActions: baseScriptTryActions,
        resultActions: baseScriptResultActions,
        summary: [],
        v2: {
          title: '拆镜控制器',
          subtitle: '剧本拆镜、参考生成与分镜版本入口',
          sections: { try: '拆镜模式', result: '分镜动作', downstream: '下游工具' },
        },
      };
    case 'audio':
      return {
        kind,
        tryActions: baseAudioTryActions,
        resultActions: baseVideoResultActions,
        summary: [],
        v2: {
          title: '音频控制器',
          subtitle: '音频素材、音乐生成与剪辑交付',
          sections: { try: '尝试能力', result: '音频动作', downstream: '下游工具' },
        },
      };
    case 'character':
      return {
        kind,
        tryActions: [],
        resultActions: baseCharacterResultActions,
        summary: [],
        v2: {
          title: '角色控制器',
          subtitle: '角色资产、服装参考与下游同步',
          sections: { result: '角色动作', downstream: '下游工具' },
        },
      };
    case 'matting':
      return {
        kind,
        tryActions: [],
        resultActions: baseMattingResultActions,
        summary: [],
        v2: {
          title: '抠图控制器',
          subtitle: '抠图结果、遮罩与图像下游处理',
          sections: { result: '结果动作', downstream: '下游工具' },
        },
      };
    case 'scene3d':
      return {
        kind,
        tryActions: [],
        resultActions: baseSceneResultActions,
        summary: [],
        v2: {
          title: '3D 控制器',
          subtitle: '3D 导演预演与视觉生成链路',
          sections: { result: '场景动作', downstream: '下游工具' },
        },
      };
    case 'panorama':
      return {
        kind,
        tryActions: [],
        resultActions: basePanoramaResultActions,
        summary: [],
        v2: {
          title: '全景控制器',
          subtitle: '360 全景预览与图像/视频延展',
          sections: { result: '全景动作', downstream: '下游工具' },
        },
      };
    case 'videoInput':
      return {
        kind,
        tryActions: [],
        resultActions: baseVideoInputResultActions,
        summary: [],
        v2: {
          title: '视频输入控制器',
          subtitle: '视频输入、素材处理与 AI 剪辑',
          sections: { result: '视频动作', downstream: '下游工具' },
        },
      };
    case 'characterConsistency':
      return {
        kind,
        tryActions: [],
        resultActions: baseCharacterConsistencyResultActions,
        summary: [],
        v2: {
          title: '一致性控制器',
          subtitle: '角色参考、目标图与一致性生成',
          sections: { result: '一致性动作', downstream: '下游工具' },
        },
      };
    case 'output':
      return {
        kind,
        tryActions: [],
        resultActions: baseOutputResultActions,
        summary: [],
        v2: {
          title: '输出控制器',
          subtitle: '成片输出、下载、剪辑与交付',
          sections: { result: '交付动作', downstream: '下游工具' },
        },
      };
    case 'batch':
      return {
        kind,
        tryActions: baseBatchTryActions,
        resultActions: baseBatchResultActions,
        summary: [],
        v2: {
          title: '批量控制器',
          subtitle: '批量任务、整组执行与失败重试',
          sections: { try: '批量动作', result: '任务管理', downstream: '下游工具' },
        },
      };
    case 'multiAngle':
      return {
        kind,
        tryActions: baseMultiAngleTryActions,
        resultActions: baseMultiAngleResultActions,
        summary: [],
        v2: {
          title: '多视角控制器',
          subtitle: '多视角提示词与角色/产品参考延展',
          sections: { try: '视角预设', result: '提示词动作', downstream: '下游工具' },
        },
      };
    case 'gridSplitter':
      return {
        kind,
        tryActions: baseGridSplitterTryActions,
        resultActions: baseGridSplitterResultActions,
        summary: [],
        v2: {
          title: '宫格控制器',
          subtitle: '宫格切分、选区管理与批量生成',
          sections: { try: '布局预设', result: '宫格动作', downstream: '下游工具' },
        },
      };
    case 'group':
      return {
        kind,
        tryActions: [
          { id: 'execute-group', label: '整组执行', icon: 'sparkles' },
          { id: 'update-toolbox', label: '更新工具箱', icon: 'send' },
          { id: 'storyboard-group', label: '转分镜组', icon: 'split' },
          { id: 'batch-download', label: '批量下载', icon: 'download' },
        ],
        resultActions: [],
        summary: [],
        v2: {
          title: '分组控制器',
          subtitle: '工作流分组执行与批量操作',
          sections: { try: '分组动作', result: '批量动作', downstream: '下游工具' },
        },
      };
  }
}
