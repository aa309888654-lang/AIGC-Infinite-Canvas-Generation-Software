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

export const IMAGE_GENERATION_MODELS: ImageGenerationModel[] = [
  {
    id: 'doubao-seedream-5-0-pro',
    name: '豆包 Seedream 5.0 Pro',
    provider: 'doubao',
    displayName: '豆包 Seedream 5.0 Pro',
    description: '豆包 Seedream 5.0 Pro 默认图片生成模型，支持首页生图、参考图创作与海报背景生成',
    points: 30,
    features: ['高质量生图', '海报生成', '参考图创作'],
    strengths: ['默认生图通道', '适合商业视觉', '适合首页快速创作'],
    limitations: ['高峰期可能需要排队或切换备用模型'],
    bestFor: ['首页生图', '海报生成', '商业视觉'],
    official: true,
    textRenderingScore: 3,
    layoutDesignScore: 3,
    artisticQualityScore: 3,
    speedScore: 3,
    recommendedFor: 'poster',
  },
  {
    id: 'sensenova-u1-fast',
    name: 'SenseNova U1 Fast',
    provider: 'sensenova',
    displayName: 'SenseNova U1 Fast',
    description: '轻量信息图生成模型，快速且成本低',
    points: 5,
    features: ['快速生成', '低成本'],
    strengths: ['生成速度快', '成本最低', '信息图优化'],
    bestFor: ['快速原型', '预算有限', '信息图'],
    official: true,
    textRenderingScore: 2,
    layoutDesignScore: 3,
    artisticQualityScore: 3,
    speedScore: 5,
    recommendedFor: 'budget',
  },
  {
    id: 'step-image-edit-2',
    name: 'Step Image Edit 2',
    provider: 'stepfun',
    displayName: 'StepFun 图像编辑',
    description: '高质量图像生成与编辑模型',
    points: 5,
    features: ['图像编辑', '低成本'],
    strengths: ['图像编辑能力', '成本低'],
    bestFor: ['图像编辑', '修图'],
    official: true,
    textRenderingScore: 2,
    layoutDesignScore: 3,
    artisticQualityScore: 3,
    speedScore: 4,
  },
  {
    id: 'agnes-image-2.1-flash',
    name: 'Agnes Image 2.1 Flash',
    provider: 'agnes',
    displayName: 'Agnes Image 2.1 Flash',
    description: 'Agnes Image 2.1 Flash 图像生成模型，支持文生图与图生图，高信息密度优化，最高 4K 输出',
    points: 20,
    features: ['快速生成', '低成本', '4K', '图生图', '高信息密度', '构图保持'],
    strengths: ['生成速度快', '成本低', '支持4K', '文生图+图生图', '高信息密度优化'],
    bestFor: ['快速原型', '批量处理', '高密度视觉', '图片转换', '产品视觉'],
    official: true,
    textRenderingScore: 3,
    layoutDesignScore: 4,
    artisticQualityScore: 4,
    speedScore: 5,
    recommendedFor: 'fast',
  },
];

/**
 * 获取推荐的海报生成模型
 */
export function getRecommendedPosterModel(): ImageGenerationModel {
  return IMAGE_GENERATION_MODELS.find(m => m.id === 'doubao-seedream-5-0-pro')!;
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
  to: 'doubao-seedream-5-0-pro',
  title: '当前默认使用豆包 Seedream 5.0 Pro',
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
