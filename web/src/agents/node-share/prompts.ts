/**
 * 节点分享 Agent 提示词模板
 */

export interface SharePromptTemplate {
  id: string;
  category: string;
  title: string;
  prompt: string;
  useCase: string;
}

export const SHARE_PROMPTS: SharePromptTemplate[] = [
  // 分享节点
  {
    id: 'share-video-gen-node',
    category: '分享节点',
    title: '分享视频生成节点',
    prompt: '帮我分享这个视频生成节点到社区，包含以下信息：节点名称、描述、标签和分类',
    useCase: '分享自己开发的节点给其他用户',
  },
  {
    id: 'share-template-workflow',
    category: '分享模板',
    title: '分享工作流模板',
    prompt: '将当前工作流保存为模板并分享到社区，包含模板名称、描述和使用说明',
    useCase: '分享完整的工作流模板',
  },

  // 导入节点
  {
    id: 'import-from-clipboard',
    category: '导入节点',
    title: '从剪贴板导入',
    prompt: '从剪贴板导入节点数据，并验证格式是否正确',
    useCase: '快速导入复制的节点代码',
  },
  {
    id: 'import-from-url',
    category: '导入节点',
    title: '从URL导入',
    prompt: '从指定URL导入节点数据，可以是GitHub、Gist或其他节点分享平台',
    useCase: '从外部平台导入节点',
  },
  {
    id: 'import-from-file',
    category: '导入节点',
    title: '从文件导入',
    prompt: '从本地文件导入节点数据，支持JSON格式',
    useCase: '导入本地保存的节点文件',
  },

  // 浏览社区
  {
    id: 'browse-video-nodes',
    category: '浏览社区',
    title: '浏览视频生成节点',
    prompt: '浏览社区中评分最高的视频生成节点，按下载量排序',
    useCase: '发现优质视频节点',
  },
  {
    id: 'browse-templates',
    category: '浏览社区',
    title: '浏览工作流模板',
    prompt: '浏览社区中热门的工作流模板，找到漫剧制作相关的模板',
    useCase: '发现优秀工作流模板',
  },

  // 搜索节点
  {
    id: 'search-specific-node',
    category: '搜索节点',
    title: '搜索特定节点',
    prompt: '搜索支持Seedance 2.0的视频生成节点，筛选评分4星以上',
    useCase: '找特定功能的节点',
  },
  {
    id: 'search-by-author',
    category: '搜索节点',
    title: '按作者搜索',
    prompt: '搜索某个作者分享的所有节点和模板',
    useCase: '关注特定开发者',
  },

  // 模板操作
  {
    id: 'fork-popular-template',
    category: '模板操作',
    title: 'Fork热门模板',
    prompt: 'Fork一个热门的工作流模板到我的工作区，并修改部分参数',
    useCase: '基于模板创建自己的版本',
  },
  {
    id: 'create-from-scratch',
    category: '模板操作',
    title: '创建空白模板',
    prompt: '创建一个空白的工作流模板，准备填充节点',
    useCase: '从头开始创建模板',
  },

  // 评分反馈
  {
    id: 'rate-good-node',
    category: '评分反馈',
    title: '评分好节点',
    prompt: '给这个节点五星好评，并留下使用评价',
    useCase: '回馈优质节点作者',
  },
  {
    id: 'report-issue',
    category: '评分反馈',
    title: '反馈问题',
    prompt: '报告这个节点存在的问题，提供详细的问题描述',
    useCase: '帮助作者改进节点',
  },

  // 版本管理
  {
    id: 'check-version',
    category: '版本管理',
    title: '检查版本',
    prompt: '检查这个节点是否有新版本，查看版本更新历史',
    useCase: '保持节点更新',
  },
  {
    id: 'compare-versions',
    category: '版本管理',
    title: '版本对比',
    prompt: '对比当前版本和最新版本的功能差异',
    useCase: '决定是否更新',
  },
];

// 分类提示词
export const CATEGORY_PROMPTS = {
  'video-generation': {
    name: '视频生成',
    searchTerms: ['视频生成', 'video generation', 'AI视频', '视频AI'],
    relatedTags: ['ai-video', 'text-to-video', 'image-to-video', 'seedance', 'vidu'],
  },
  'image-generation': {
    name: '图片生成',
    searchTerms: ['图片生成', 'image generation', 'AI绘图', '文生图'],
    relatedTags: ['ai-image', 'text-to-image', 'stable-diffusion', 'dall-e', 'flux'],
  },
  audio: {
    name: '音频处理',
    searchTerms: ['音频', 'audio', '语音合成', 'TTS'],
    relatedTags: ['tts', 'voice', 'music', 'sound', '配音'],
  },
  editing: {
    name: '视频剪辑',
    searchTerms: ['视频剪辑', 'video editing', '剪辑', '编辑'],
    relatedTags: ['cut', 'trim', 'transition', 'subtitle', '字幕'],
  },
  effects: {
    name: '特效处理',
    searchTerms: ['特效', 'effects', '视觉特效', 'VFX'],
    relatedTags: ['vfx', 'filter', 'glow', 'glitch', 'particle'],
  },
  template: {
    name: '模板流程',
    searchTerms: ['模板', 'template', '工作流', 'workflow'],
    relatedTags: ['workflow', 'automation', 'pipeline', '流程'],
  },
  utility: {
    name: '工具节点',
    searchTerms: ['工具', 'utility', '辅助', 'helper'],
    relatedTags: ['helper', 'debug', 'utils', 'tools'],
  },
  experimental: {
    name: '实验性',
    searchTerms: ['实验', 'experimental', '测试', 'beta'],
    relatedTags: ['beta', 'test', 'new', 'experimental'],
  },
};

// 分享描述模板
export const SHARE_DESCRIPTION_TEMPLATES = {
  videoGeneration: [
    '基于{provider}的AI视频生成节点，支持{features}',
    '专业级视频生成工作流，集成{features}',
    '高效的AI视频制作工具，包含{features}',
  ],
  imageGeneration: [
    '强大的AI图片生成节点，支持{features}',
    '创意图片生成工具，包含{features}',
    '高质量图像生成工作流，集成{features}',
  ],
  workflow: [
    '完整的{topic}工作流模板，开箱即用',
    '专业的{topic}流程设计，适用于{useCase}',
    '高效的{topic}解决方案，省时省力',
  ],
};

// 节点描述占位符
export const DESCRIPTION_VARIABLES = {
  features: '详细的功能描述',
  provider: 'AI服务提供商',
  topic: '主题或领域',
  useCase: '使用场景',
  author: '作者名称',
  version: '版本号',
};

// 评分评论模板
export const RATING_TEMPLATES = {
  positive: [
    '非常好用的节点！{comment}',
    '功能强大，强烈推荐！{comment}',
    '质量很高，满足了我的需求。{comment}',
    '作者很用心，期待更多作品！{comment}',
  ],
  neutral: [
    '节点基本可用，{comment}',
    '功能还行，有些地方可以改进。{comment}',
    '整体不错，{comment}',
  ],
  negative: [
    '存在问题：{issue}',
    '建议改进：{suggestion}',
    '无法正常使用：{problem}',
  ],
};

// 节点名称模板
export const NODE_NAME_TEMPLATES = {
  videoGen: [
    '{provider}视频生成器',
    'AI视频生成-{provider}',
    '{provider}专业版',
    '{model}视频节点',
  ],
  imageGen: [
    '{model}图片生成器',
    'AI绘图-{style}',
    '{model}专业版',
  ],
  workflow: [
    '{topic}工作流模板',
    '{topic}完整流程',
    '专业{topic}解决方案',
  ],
};

export default {
  SHARE_PROMPTS,
  CATEGORY_PROMPTS,
  SHARE_DESCRIPTION_TEMPLATES,
  DESCRIPTION_VARIABLES,
  RATING_TEMPLATES,
  NODE_NAME_TEMPLATES,
};
