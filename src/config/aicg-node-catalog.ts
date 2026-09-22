export type AICGTaskSectionId =
  | 'text'
  | 'image'
  | 'video'
  | 'compose'
  | 'director'
  | 'audio'
  | 'script'
  | 'storyboard'
  | 'character'
  | 'toolbox'
  | 'assets';

export type AICGTaskIcon =
  | 'text'
  | 'image'
  | 'video'
  | 'compose'
  | 'director'
  | 'audio'
  | 'script'
  | 'storyboard'
  | 'character'
  | 'toolbox'
  | 'assets'
  | 'upload'
  | 'history'
  | 'grid'
  | 'vr'
  | 'output';

export type AICGTaskAction = 'openToolbox' | 'openAssets';

export interface AICGTaskItem {
  id: string;
  title: string;
  description: string;
  icon?: AICGTaskIcon;
  nodeIds?: string[];
  action?: AICGTaskAction;
  badge?: 'NEW' | 'Beta';
}

export interface AICGTaskSection {
  id: AICGTaskSectionId;
  title: string;
  description: string;
  icon: AICGTaskIcon;
  items: AICGTaskItem[];
}

export const AICG_CORE_PALETTE_NODE_IDS = new Set([
  'aiGenText',
  'aiImage',
  'aiVideo',
  'audioGen',
  'script',
  'storyboardMaker',
  'cameraPath',
  'imageInput',
  'videoInput',
  'output',
]);

export const AICG_COLLAPSED_TOOL_NODE_IDS = new Set([
  'adCopyText',
  'brandCopyText',
  'storyboardEdit',
  'localMatting',
  'gridDirector',
  'scriptStoryboard',
  'batchProcess',
  'characterConsistency',
  'director3D',
  'multiAngle',
  'panorama360',
  'audioInput',
  'imageCollage',
  'gridSplitter',
  'textInput',
  'videoGen',
  'imageAnalysis',
  'inpainting',
  'outpainting',
  'photoGrid',
  'magicStoryboard',
]);

export function isCollapsedAICGPaletteNode(nodeId: string): boolean {
  return AICG_COLLAPSED_TOOL_NODE_IDS.has(nodeId);
}

export function isPrimaryAICGPaletteNode(nodeId: string): boolean {
  return AICG_CORE_PALETTE_NODE_IDS.has(nodeId);
}

export const AICG_NODE_CATALOG_SECTIONS: AICGTaskSection[] = [
  {
    id: 'text',
    title: '文本',
    description: '文案、提示词、脚本与多模态创作入口',
    icon: 'text',
    items: [
      {
        id: 'text-main',
        title: '文本节点',
        description: '文案、提示词、广告词、品牌文案和分镜入口',
        nodeIds: ['aiGenText'],
        icon: 'text',
      },
      {
        id: 'text-to-image',
        title: '文生图',
        description: '先建文本节点，点击文字动作展开图片节点',
        nodeIds: ['aiGenText'],
        icon: 'image',
      },
      {
        id: 'text-to-video',
        title: '文生视频',
        description: '先建文本节点，点击文字动作展开视频节点',
        nodeIds: ['aiGenText'],
        icon: 'video',
      },
      {
        id: 'text-to-music',
        title: '文生配音',
        description: '先建文本节点，点击文字动作展开音频节点',
        nodeIds: ['aiGenText'],
        icon: 'audio',
      },
    ],
  },
  {
    id: 'image',
    title: '图片',
    description: '上传、生成、增强、分镜和发送剪辑',
    icon: 'image',
    items: [
      {
        id: 'image-upload',
        title: '上传图片',
        description: '从本地或素材库输入图片',
        nodeIds: ['imageInput'],
        icon: 'upload',
      },
      {
        id: 'image-generate',
        title: 'AI图片',
        description: '生成、图生图、高清、重绘和扩图统一入口',
        nodeIds: ['aiImage'],
        icon: 'image',
      },
    ],
  },
  {
    id: 'video',
    title: '视频',
    description: '文生视频、图生视频、首尾帧、多参考和运镜',
    icon: 'video',
    items: [
      {
        id: 'video-upload',
        title: '上传视频',
        description: '输入视频参考或剪辑素材',
        nodeIds: ['videoInput'],
        icon: 'upload',
      },
      {
        id: 'video-main',
        title: 'AI视频',
        description: '文生视频、图生视频、首尾帧和多参考统一入口',
        nodeIds: ['aiVideo'],
        icon: 'video',
      },
      {
        id: 'video-frame-extractor',
        title: '视频抽帧',
        description: '从视频中提取关键帧，继续接生图、分镜或导出',
        nodeIds: ['frameExtractor'],
        icon: 'grid',
      },
      {
        id: 'video-upscale',
        title: '提升清晰度',
        description: '视频超分至1080P，提升分辨率与画面细节',
        nodeIds: ['videoUpscale'],
        icon: 'video',
      },
    ],
  },
  {
    id: 'compose',
    title: '视频合成',
    description: '片段、字幕、配乐、转场和成片导出',
    icon: 'compose',
    items: [
      {
        id: 'compose-output',
        title: '输出节点',
        description: '连接图片、视频或音频结果后发送剪辑或导出',
        nodeIds: ['output'],
        icon: 'output',
      },
    ],
  },
  {
    id: 'director',
    title: '导演台',
    description: '3D 构图、分镜导演、多角度和全景预览',
    icon: 'director',
    items: [
      {
        id: 'director-script',
        title: '脚本节点',
        description: '从剧本进入分镜、导演、全景与 VR 预览链路',
        nodeIds: ['script'],
        icon: 'script',
      },
      {
        id: 'director-image',
        title: 'AI图片',
        description: '图片结果上点击文字动作展开全景、分镜和参考工具',
        nodeIds: ['aiImage'],
        icon: 'image',
      },
    ],
  },
  {
    id: 'audio',
    title: '音频',
    description: '上传、配音、音乐、音频生视频和剪辑素材',
    icon: 'audio',
    items: [
      {
        id: 'audio-upload',
        title: '上传音频',
        description: '输入配乐、旁白或音效',
        nodeIds: ['audioGen', 'audioInput'],
        icon: 'upload',
      },
      {
        id: 'audio-tts',
        title: '文本配音',
        description: '文本生成语音，可调音色与语速',
        nodeIds: ['audioGen'],
        icon: 'audio',
      },
      {
        id: 'audio-music',
        title: '文字生音乐',
        description: '歌词或氛围描述生成音乐',
        nodeIds: ['audioGen'],
        icon: 'audio',
      },
      {
        id: 'audio-to-video',
        title: '音频生视频',
        description: '音频作为视频生成或剪辑参考',
        nodeIds: ['aiVideo'],
        icon: 'video',
      },
    ],
  },
  {
    id: 'script',
    title: '脚本分镜',
    description: '剧本、参考视频、角色参考和分镜编辑',
    icon: 'script',
    items: [
      {
        id: 'script-main',
        title: '剧本节点',
        description: '输入或生成剧本内容',
        nodeIds: ['script', 'aiGenText'],
        icon: 'script',
      },
      {
        id: 'script-storyboard',
        title: '分镜链路',
        description: '在剧本节点内点击文字动作展开分镜编辑和批量处理',
        nodeIds: ['script'],
        icon: 'script',
      },
    ],
  },
  {
    id: 'storyboard',
    title: '制作故事版',
    description: '创意输入、节拍拆分、分镜表、角色风格锁定和视频提示词',
    icon: 'storyboard',
    items: [
      {
        id: 'storyboard-maker',
        title: '制作故事版',
        description: '从一句话创意生成可执行故事版，输出分镜表与视频提示词',
        nodeIds: ['storyboardMaker'],
        icon: 'storyboard',
        badge: 'NEW',
      },
      {
        id: 'camera-path',
        title: '镜头路径',
        description: '在图片上绘制镜头起点、关键点和终点，绑定 AI 视频运镜',
        nodeIds: ['cameraPath'],
        icon: 'storyboard',
        badge: 'NEW',
      },
      {
        id: 'storyboard-to-video',
        title: '故事版转视频',
        description: '故事版输出可继续连接 AI 视频或批量处理',
        nodeIds: ['storyboardMaker', 'aiVideo'],
        icon: 'video',
      },
    ],
  },
  {
    id: 'character',
    title: '角色主体',
    description: '角色库、主体库、多角度和一致性',
    icon: 'character',
    items: [
      {
        id: 'character-library',
        title: '角色库',
        description: '角色头像、三视图和设定管理',
        nodeIds: ['characterLibrary'],
        icon: 'character',
      },
      {
        id: 'scene-library',
        title: '场景库',
        description: '场景环境、光照和氛围管理',
        nodeIds: ['sceneLibrary'],
        icon: 'character',
      },
      {
        id: 'prop-library',
        title: '道具库',
        description: '道具材质、标签和设定管理',
        nodeIds: ['propLibrary'],
        icon: 'character',
      },
    ],
  },
  {
    id: 'toolbox',
    title: '工具箱',
    description: '预设工作流、我的工具箱和常用组合',
    icon: 'toolbox',
    items: [
      {
        id: 'toolbox-open',
        title: '打开工具箱',
        description: '查看预设工作流和我的模板',
        action: 'openToolbox',
        icon: 'toolbox',
        badge: 'NEW',
      },
    ],
  },
  {
    id: 'assets',
    title: '素材历史',
    description: '项目素材、生成历史、收藏和回收站',
    icon: 'assets',
    items: [
      {
        id: 'assets-open',
        title: '打开素材库',
        description: '从项目素材和生成历史复用内容',
        action: 'openAssets',
        icon: 'assets',
      },
      {
        id: 'assets-image',
        title: '图片历史',
        description: '复用生成图片或上传图片',
        action: 'openAssets',
        icon: 'history',
      },
      {
        id: 'assets-video',
        title: '视频历史',
        description: '复用生成视频或上传视频',
        action: 'openAssets',
        icon: 'history',
      },
    ],
  },
];

export function flattenAICGNodeCatalogItems(): AICGTaskItem[] {
  return AICG_NODE_CATALOG_SECTIONS.flatMap((section) => section.items);
}

export function getCatalogItemNodeIds(item: AICGTaskItem): string[] {
  return item.nodeIds ?? [];
}
