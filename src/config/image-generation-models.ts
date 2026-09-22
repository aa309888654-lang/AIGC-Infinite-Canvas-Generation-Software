/**
 * AI 图像生成模型配置
 *
 * 包含所有支持的图像生成模型及其特性、定价、适用场景
 */

export interface ImageGenerationModel {
  id: string;
  name: string;
  provider: string;
  displayName: string;
  description: string;
  points: number; // 积分消耗
  features: string[];
  strengths: string[];
  limitations?: string[];
  bestFor: string[];
  official: boolean; // 是否官方 API
  textRenderingScore: 1 | 2 | 3 | 4 | 5; // 文字渲染能力评分
  layoutDesignScore: 1 | 2 | 3 | 4 | 5; // 排版设计能力评分
  artisticQualityScore: 1 | 2 | 3 | 4 | 5; // 艺术质感评分
  speedScore: 1 | 2 | 3 | 4 | 5; // 生成速度评分
  recommendedFor?: 'poster' | 'creative' | 'fast' | 'budget';
}

/**
 * AI 图像生成模型配置
 *
 * 包含所有支持的图像生成模型及其特性、定价、适用场景
 */

export interface ImageGenerationModel {
  id: string;
  name: string;
  provider: string;
  displayName: string;
  description: string;
  points: number;
  features: string[];
  strengths: string[];
  limitations?: string[];
  bestFor: string[];
  official: boolean;
  textRenderingScore: 1 | 2 | 3 | 4 | 5;
  layoutDesignScore: 1 | 2 | 3 | 4 | 5;
  artisticQualityScore: 1 | 2 | 3 | 4 | 5;
  speedScore: 1 | 2 | 3 | 4 | 5;
  recommendedFor?: 'poster' | 'creative' | 'fast' | 'budget';
  icon?: string;
}

export const IMAGE_GENERATION_MODELS: ImageGenerationModel[] = [
  {
    id: 'doubao-seedream-5-0-lite',
    name: '豆包 Seedream 5.0 Lite',
    provider: 'doubao',
    displayName: '豆包 Seedream 5.0 Lite',
    description: '字节跳动最新官方生图模型，速度快、质量高',
    points: 30,
    features: ['高质量生图', '海报生成', '参考图创作'],
    strengths: ['速度快', '兼容性强', '官方渠道'],
    limitations: ['部分功能受限'],
    bestFor: ['首页生图', '海报生成'],
    official: true,
    textRenderingScore: 4,
    layoutDesignScore: 4,
    artisticQualityScore: 4,
    speedScore: 5,
    recommendedFor: 'fast',
    icon: 'sparkles',
  },
  {
    id: 'kling-k2',
    name: '可灵 K2',
    provider: 'kling',
    displayName: '可灵 K2',
    description: '可灵最新视频/图片生成模型',
    points: 0,
    features: ['高清图片', '视频生成'],
    strengths: ['画面质量优秀', '动态效果强'],
    bestFor: ['创意生成'],
    official: true,
    textRenderingScore: 3,
    layoutDesignScore: 3,
    artisticQualityScore: 5,
    speedScore: 3,
    recommendedFor: 'creative',
    icon: 'wand',
  },
  {
    id: 'minimax-01',
    name: 'MiniMax 01',
    provider: 'minimax',
    displayName: 'MiniMax 01',
    description: 'MiniMax 最新官方图片模型',
    points: 0,
    features: ['高品质图片'],
    strengths: ['细节丰富'],
    bestFor: ['产品图'],
    official: true,
    textRenderingScore: 3,
    layoutDesignScore: 4,
    artisticQualityScore: 4,
    speedScore: 4,
    recommendedFor: 'creative',
    icon: 'palette',
  },
  {
    id: 'custom-model',
    name: '模型自定义',
    provider: 'custom',
    displayName: '模型自定义',
    description: '输入任意兼容 OpenAI 的模型 Base URL + API Key',
    features: ['完全自定义'],
    strengths: ['灵活性最高'],
    limitations: ['需自行配置 Base URL'],
    bestFor: ['所有场景'],
    official: false,
    points: 0,
    textRenderingScore: 3,
    layoutDesignScore: 3,
    artisticQualityScore: 3,
    speedScore: 3,
    recommendedFor: 'budget',
  },
];

export function getAllImageModels(): ImageGenerationModel[] {
  return IMAGE_GENERATION_MODELS;
}

export function getOfficialImageModels(): ImageGenerationModel[] {
  return IMAGE_GENERATION_MODELS.filter(m => m.official);
}

export function getModelById(modelId: string): ImageGenerationModel | undefined {
  return IMAGE_GENERATION_MODELS.find(m => m.id === modelId);
}

/**
 * 获取模型信息
 */
export function getModelInfo(modelId: string): ImageGenerationModel | undefined {
  return IMAGE_GENERATION_MODELS.find(m => m.id === modelId);
}

/**
 * 按场景推荐模型
 */
export function getModelsByScenario(scenario: 'poster' | 'creative' | 'fast' | 'budget'): ImageGenerationModel[] {
  return IMAGE_GENERATION_MODELS.filter(m => m.recommendedFor === scenario);
}

/**
 * 模型对比数据（用于 UI 展示）
 */
export const MODEL_COMPARISON_MATRIX = {
  headers: ['模型', '文字渲染', '排版设计', '艺术质感', '生成速度', '积分消耗', '官方 API'],
  rows: IMAGE_GENERATION_MODELS.map(model => ({
    model: model.displayName,
    textRendering: model.textRenderingScore,
    layoutDesign: model.layoutDesignScore,
    artisticQuality: model.artisticQualityScore,
    speed: model.speedScore,
    points: model.points,
    official: model.official,
  })),
};

/**
 * 模型切换提示信息
 */
export const MODEL_MIGRATION_NOTICE = {
  from: 'ideogram',
  to: 'doubao-seedream-5-0-lite',
  title: '当前默认使用豆包 Seedream 5.0 Lite',
  message: `
    当前海报生图默认使用豆包 Seedream 5.0 Pro：

    ✅ 使用豆包默认生图通道
    ✅ 无需 Ideogram 账号或 API Key
    ✅ 支持首页生图与海报生成
  `,
  benefits: [
    '无需新增账号配置',
    '使用豆包生图链路',
    '兼容历史海报生成流程',
  ],
};
