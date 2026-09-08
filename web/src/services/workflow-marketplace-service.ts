import { Node, Edge } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { CANVAS_MATERIAL_PRESETS } from '@/config/material-presets';
import {
  AICG_WORKFLOW_TEMPLATES,
  instantiateAICGWorkflow,
} from '@/services/aicg-workflow-service';
import { completeMarketplaceTemplate } from '@/services/workflow-marketplace-completeness';

/** 官方市场模板 → AICG 工作流模板 ID */
const OFFICIAL_AICG_TEMPLATE_MAP: Record<string, string> = {
  'official-story-pipeline': 'aicg-story-pipeline',
  'official-ecommerce': 'aicg-ecommerce-product-showcase',
  'official-character': 'aicg-character-pipeline',
  'official-text-image-video': 'aicg-text-image-video',
  'official-ad-copy-media': 'xt-ad-copy-media',
  'official-brand-campaign': 'xt-brand-campaign',
  'official-storyboard-edit': 'xt-storyboard-edit-pipeline',
  'official-character-angle': 'xt-character-angle-pipeline',
  'official-matting-collage': 'aicg-matting-collage',
  'official-image-upscale': 'aicg-image-upscale-pipeline',
  'official-video-frame-extract': 'aicg-video-frame-extract',
  'official-audio-video': 'aicg-audio-video',
  'official-3d-panorama': 'aicg-3d-panorama',
  'official-batch-output': 'aicg-batch-output',
  'official-vr360-video': 'xt-vr360-video-pipeline',
  'official-script-director': 'aicg-script-director',
  'official-portrait-studio': 'aicg-portrait-studio',
  'official-old-photo-restore': 'aicg-old-photo-restore',
  'official-anime-character': 'aicg-anime-character-design',
  'official-product-main-image': 'aicg-product-main-image',
  'official-educational-shorts': 'aicg-educational-shorts',
  'official-qwen-edit-2509': 'aicg-qwen-image-edit',
  'official-wan22-animate': 'aicg-wan22-animate',
  'official-wan22-i2v': 'aicg-wan22-i2v',
  'official-multiangle-stack': 'aicg-multiangle-stack',
  'official-coherent-scenes': 'aicg-coherent-scenes',
};

for (const preset of CANVAS_MATERIAL_PRESETS) {
  OFFICIAL_AICG_TEMPLATE_MAP[preset.marketplaceId] = preset.aicgWorkflowId;
}

function hydrateOfficialTemplate(template: WorkflowTemplate): WorkflowTemplate {
  const aicgId = OFFICIAL_AICG_TEMPLATE_MAP[template.id];
  if (!aicgId) return completeMarketplaceTemplate(template);
  const aicgTpl = AICG_WORKFLOW_TEMPLATES.find((t) => t.id === aicgId);
  if (!aicgTpl) return completeMarketplaceTemplate(template);
  const { nodes, edges } = instantiateAICGWorkflow(aicgTpl, { x: 80, y: 80 });
  return completeMarketplaceTemplate({ ...template, nodes, edges });
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  authorId?: string;
  nodes: Node[];
  edges: Edge[];
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  tags: string[];
  downloads: number;
  likes: number;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  isOfficial: boolean;
  isFeatured: boolean;
  price?: number;
  isFree: boolean;
  sourceFolder?: string;
  resourceUrl?: string;
  workflowFiles?: string[];
  loraFiles?: string[];
  promptTemplate?: string;
  promptOptions?: string[];
  defaultParams?: Record<string, unknown>;
  mediaAssets?: string[];
}

export interface WorkflowMarketplaceFilter {
  category?: string;
  search?: string;
  tags?: string[];
  isFree?: boolean;
  isOfficial?: boolean;
  sortBy?: 'popular' | 'newest' | 'rating' | 'downloads';
}

export interface WorkflowReview {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

function createMaterialMarketplaceTemplate(
  preset: (typeof CANVAS_MATERIAL_PRESETS)[number],
): WorkflowTemplate {
  return completeMarketplaceTemplate({
    id: preset.marketplaceId,
    name: preset.name,
    description: preset.description,
    category: preset.marketplaceCategory,
    author: '小天 AICG',
    nodes: [],
    edges: [],
    thumbnailUrl: preset.thumbnailUrl,
    tags: preset.tags,
    downloads: 0,
    likes: 0,
    rating: 5,
    ratingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    isOfficial: true,
    isFeatured: preset.workflowType === 'intro' || preset.workflowType === 'reference-pair',
    isFree: true,
    sourceFolder: preset.sourceFolder,
    resourceUrl: preset.publicResourceUrl,
    workflowFiles: preset.workflowFiles,
    loraFiles: preset.loraFiles,
    promptTemplate: preset.promptTemplate,
    promptOptions: preset.promptOptions,
    defaultParams: {
      ...preset.defaultParams,
      prompt: preset.promptTemplate,
      materialPresetId: preset.id,
      sourceFolder: preset.sourceFolder,
      resourceDir: preset.resourceDir,
      publicResourceUrl: preset.publicResourceUrl,
    },
    mediaAssets: [
      preset.thumbnailUrl || '',
      preset.publicResourceUrl,
      ...preset.workflowFiles.map((file) => `${preset.publicResourceUrl}/${file}`),
      ...preset.loraFiles.map((file) => `${preset.publicResourceUrl}/${file}`),
    ].filter(Boolean),
  });
}

class WorkflowMarketplaceService {
  private static instance: WorkflowMarketplaceService;
  private templates: Map<string, WorkflowTemplate> = new Map();
  private reviews: Map<string, WorkflowReview[]> = new Map();
  private userDownloads: Map<string, Set<string>> = new Map();
  private userLikes: Map<string, Set<string>> = new Map();
  private readonly TEMPLATES_KEY = 'workflow-marketplace-templates';
  private readonly REVIEWS_KEY = 'workflow-marketplace-reviews';

  public static getInstance(): WorkflowMarketplaceService {
    if (!WorkflowMarketplaceService.instance) {
      WorkflowMarketplaceService.instance = new WorkflowMarketplaceService();
    }
    return WorkflowMarketplaceService.instance;
  }

  private constructor() {
    this.loadFromStorage();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: WorkflowTemplate[] = [
      {
        id: 'official-story-pipeline',
        name: 'AICG 短剧流水线',
        description: '完整短剧生产链：剧本 → 分镜 → AI生图 → AI生视频 → 合成 → 导出。内置雨夜邂逅剧本和电影感提示词。',
        category: '短剧',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinematic%20rainy%20night%20city%20overpass%20neon%20lights%20young%20woman%20with%20umbrella%20man%20walking%20away%20cyberpunk%20blue%20tone%20movie%20still&image_size=landscape_16_9',
        tags: ['短剧', '分镜', '成片', '剧本'],
        downloads: 0,
        likes: 0,
        rating: 5.0,
        ratingCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '【第一集·雨夜邂逅】场景：深夜，城市天桥下。女主林小雨加班后遇暴雨，男主陆深递伞离去。',
      },
      {
        id: 'official-ecommerce',
        name: '电商产品种草流水线',
        description: '产品图 → 智能抠图 → 场景生图 → 视频合成 → 导出，适配小红书/抖音带货。内置护肤品广告提示词。',
        category: '电商',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=premium%20skincare%20product%20on%20marble%20countertop%20warm%20bathroom%20morning%20light%20steam%20commercial%20photography%208K&image_size=portrait_4_3',
        tags: ['电商', '种草', '抠图', '视频', '产品展示'],
        downloads: 0,
        likes: 0,
        rating: 4.9,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '产品放置在大理石台面上，背景是柔和的暖色调浴室场景，晨光从左侧窗户洒入，水蒸气缭绕，高端护肤品广告摄影风格',
      },
      {
        id: 'official-character',
        name: '角色一致性生图',
        description: '角色库 → 角色一致性 → AI生图，保持角色外观。内置女性角色「林小雨」设定。',
        category: '角色',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=25%20year%20old%20asian%20woman%20shoulder%20length%20black%20hair%20beige%20trench%20coat%20cherry%20blossom%20trees%20petals%20falling%20soft%20backlight%20japanese%20fresh%20style%20portrait%208K&image_size=portrait_4_3',
        tags: ['角色', '一致性', '生图', '人物设计'],
        downloads: 0,
        likes: 0,
        rating: 4.8,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '25岁亚洲女性，齐肩黑色短发，圆脸大眼，穿着米白色风衣，站在樱花树下，花瓣飘落，柔和逆光，日系清新风格',
      },
      {
        id: 'official-text-image-video',
        name: '文本 → 生图 → 生视频',
        description: '提示词驱动完整生产链：文本描述 → AI生图 → AI生视频。内置橘猫厨师萌宠提示词。',
        category: '视频',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=orange%20cat%20wearing%20mini%20white%20chef%20hat%20on%20wooden%20kitchen%20counter%20pawing%20strawberry%20sunlight%20window%20fluffy%20fur%20cute%20bokeh%208K&image_size=square',
        tags: ['文本', '图片', '视频', '萌宠'],
        downloads: 0,
        likes: 0,
        rating: 4.7,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '一只橘色猫咪戴着迷你白色厨师帽，站在木质厨房台面上，前爪拨弄一颗鲜红草莓，阳光从左侧窗户洒入',
      },
      {
        id: 'official-ad-copy-media',
        name: '广告词 → 图片 → 视频',
        description: '广告文案生成 → AI主视觉 → 视频生成 → 配音合成 → 视频合成。内置便携咖啡机广告词模板。',
        category: '电商',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=portable%20capsule%20coffee%20machine%20on%20camping%20wooden%20table%20mountain%20forest%20background%20morning%20light%20metal%20texture%20commercial%20photography%208K&image_size=landscape_16_9',
        tags: ['广告词', '商品', '配音', '电商'],
        downloads: 0,
        likes: 0,
        rating: 4.8,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '请为「便携式胶囊咖啡机」生成3条短视频广告词，包含开场钩子、核心卖点、行动号召',
      },
      {
        id: 'official-brand-campaign',
        name: '品牌文案 → 广告词 → 生图',
        description: '品牌主张 → 广告口播 → 海报视觉生成。内置新中式茶饮品牌文案模板。',
        category: '电商',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=chinese%20ink%20painting%20style%20white%20porcelain%20tea%20cup%20on%20wooden%20tea%20table%20ink%20mountains%20background%20golden%20tea%20steam%20oriental%20aesthetic%208K&image_size=portrait_4_3',
        tags: ['品牌', '文案', '海报', '新中式'],
        downloads: 0,
        likes: 0,
        rating: 4.9,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '新中式茶饮海报，水墨风格，白瓷茶杯置于原木茶席上，背景淡墨山水，茶汤金色透亮',
      },
      {
        id: 'official-storyboard-edit',
        name: '剧本分镜 → 分镜编辑 → 视频',
        description: '剧本拆镜 → 分镜编辑 → 批量生图 → 生视频 → 合成。内置产品宣传片4镜头脚本。',
        category: '短剧',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=product%20panorama%20pure%20black%20background%20spotlight%20product%20floating%20center%20metal%20texture%20sharp%20reflection%20high-end%20commercial%20photography%208K&image_size=landscape_16_9',
        tags: ['剧本', '分镜编辑', '视频', '宣传片'],
        downloads: 0,
        likes: 0,
        rating: 4.7,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '【产品宣传片脚本】镜头1：产品全景旋转；镜头2：特写细节；镜头3：使用场景；镜头4：品牌Logo+Slogan',
      },
      {
        id: 'official-character-angle',
        name: '角色多角度 → 一致性 → 视频',
        description: '角色库 → 多角度生成 → 角色一致性 → 生图 → 生视频。内置男性角色「陆深」设定。',
        category: '角色',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=28%20year%20old%20asian%20man%20short%20hair%20sharp%20jawline%20dark%20gray%20long%20coat%20city%20rooftop%20sunset%20sky%20wind%20blowing%20coat%20side%20profile%20cinematic%208K&image_size=portrait_4_3',
        tags: ['角色', '多角度', '一致性', '人物设计'],
        downloads: 0,
        likes: 0,
        rating: 4.8,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '28岁亚洲男性，短碎发，棱角分明的脸庞，穿深灰色长款大衣，站在城市天台上，黄昏天空',
      },
      {
        id: 'official-matting-collage',
        name: '抠图 → 场景合成 → 导出',
        description: '图片上传 → 本地抠图 → AI场景合成 → 导出。电商白底图风格，适合产品换背景。',
        category: '图片处理',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=product%20on%20minimalist%20white%20pedestal%20soft%20gradient%20gray%20background%20green%20leaf%20shadow%20natural%20lighting%20e-commerce%20white%20background%20style%208K&image_size=square',
        tags: ['抠图', '图片', '导出', '电商白底'],
        downloads: 0,
        likes: 0,
        rating: 4.6,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '产品置于极简白色台面上，背景为柔和渐变灰色，左上角悬浮一片绿叶投影，光影自然',
      },
      {
        id: 'official-image-upscale',
        name: '图片高清放大 → 导出',
        description: '低清图片通过 AI 超分放大到 4K 后导出。适合老照片修复、低清素材增强。',
        category: '图片处理',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20image%20upscaling%20comparison%20before%20after%20low%20resolution%20to%204K%20ultra%20HD%20detail%20enhancement&image_size=landscape_16_9',
        tags: ['高清', '超分', '4K', '图片增强'],
        downloads: 0,
        likes: 0,
        rating: 4.7,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '提升画质细节，保持原图构图和色彩，超分辨率增强，4K',
      },
      {
        id: 'official-script-director',
        name: '剧本 → 分镜导演',
        description: '脚本解析后进入连贯分镜编排。内置东京雨夜少女场景提示词。',
        category: '短剧',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=girl%20with%20transparent%20umbrella%20tokyo%20rainy%20night%20neon%20lights%20reflection%20puddle%20melancholy%20eyes%20cinematic%204K&image_size=landscape_16_9',
        tags: ['剧本', '分镜', '导演'],
        downloads: 0,
        likes: 0,
        rating: 4.5,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '一个少女在雨夜的东京街头撑着透明伞，霓虹灯倒映在水洼中，她转头看向镜头，眼中带着淡淡的忧伤',
      },
      {
        id: 'official-video-frame-extract',
        name: '视频 → 抽帧 → 导出',
        description: '上传视频后提取关键帧，作为图片继续创作或导出。适合视频素材二次创作。',
        category: '图片处理',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=video%20frame%20extraction%20film%20strip%20keyframes%20timeline%20video%20editing%20concept&image_size=landscape_16_9',
        tags: ['视频', '抽帧', '关键帧', '素材处理'],
        downloads: 0,
        likes: 0,
        rating: 4.4,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
      },
      {
        id: 'official-audio-video',
        name: '音频 → 视频 → 导出',
        description: '视频素材 + AI背景音乐 + 视频增强 → 导出成片。适合配乐视频制作。',
        category: '音乐',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=music%20video%20production%20audio%20waveform%20video%20timeline%20editing%20concept%20purple%20tone&image_size=landscape_16_9',
        tags: ['音频', '视频', '导出', '配乐'],
        downloads: 0,
        likes: 0,
        rating: 4.5,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '轻柔钢琴曲，适合产品展示，节奏舒缓，30秒',
      },
      {
        id: 'official-3d-panorama',
        name: '3D导演 → 全景 → 生图',
        description: '多机位预演 → 360全景 → AI生图。内置现代客厅全景提示词。',
        category: '空间',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20minimalist%20living%20room%20panorama%20floor%20to%20ceiling%20windows%20city%20skyline%20sunset%20warm%20light%20marble%20floor%20architecture%20photography%208K&image_size=landscape_16_9',
        tags: ['3D', '全景', '生图', '空间设计'],
        downloads: 0,
        likes: 0,
        rating: 4.6,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '现代简约客厅全景，落地窗外是城市天际线，黄昏暖光洒入，家具线条简洁，大理石地面反光',
      },
      {
        id: 'official-batch-output',
        name: '批量文案 → 导出',
        description: '批量任务收集 → AI文本生成 → 统一导出。内置智能台灯5风格文案模板。',
        category: '图片处理',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=batch%20content%20generation%20multiple%20document%20variations%20AI%20writing%20concept%20clean%20ui&image_size=landscape_16_9',
        tags: ['批量', '导出', '文案', '营销'],
        downloads: 0,
        likes: 0,
        rating: 4.3,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '请为智能护眼台灯批量生成5条不同风格的营销文案：文艺风、专业风、活泼风、简约风、奢华风',
      },
      {
        id: 'official-vr360-video',
        name: '360全景 → VR预览 → 视频',
        description: '全景图 → VR视角规划 → AI视频生成。适合沉浸式空间展示。',
        category: '空间',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=360%20panorama%20VR%20preview%20immersive%20space%20virtual%20reality%20concept%20blue%20tone&image_size=landscape_16_9',
        tags: ['全景', 'VR', '视频', '沉浸式'],
        downloads: 0,
        likes: 0,
        rating: 4.4,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: false,
        isFree: true,
        promptTemplate: '全景视角缓缓移动，空间沉浸感，光影随视角变化',
      },
      {
        id: 'official-portrait-studio',
        name: '人像写真工作室',
        description: '人物参考图 → AI风格写真 → 高清精修 → 导出。内置电影感胶片风格提示词。',
        category: '人像',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=young%20woman%20portrait%20soft%20window%20light%20film%20grain%20cinematic%20tone%20shallow%20depth%20of%20field%208K&image_size=portrait_4_3',
        tags: ['人像', '写真', '精修', '风格迁移'],
        downloads: 0,
        likes: 0,
        rating: 4.9,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '年轻女性肖像，柔和的窗边自然光，皮肤通透有光泽，发丝轻盈，眼神温柔，浅景深，胶片质感，电影感色调',
      },
      {
        id: 'official-old-photo-restore',
        name: '老照片修复上色',
        description: '老照片 → AI修复去划痕 → 智能上色 → 4K高清放大 → 导出。家庭老照片一键焕新。',
        category: '图片处理',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=old%20photo%20restoration%20before%20after%20comparison%20black%20and%20white%20to%20color%20vintage%20portrait%20enhancement&image_size=landscape_16_9',
        tags: ['老照片', '修复', '上色', '高清', '4K'],
        downloads: 0,
        likes: 0,
        rating: 4.8,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '修复老照片，去除划痕斑点折痕，恢复面部细节，自然上色，超分辨率4K高清',
      },
      {
        id: 'official-anime-character',
        name: '动漫角色设计流水线',
        description: '角色设定 → 正面立绘 → 三视图 → 表情设定 → 导出。OC角色一键生成全套设计稿。',
        category: '角色',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20girl%20character%20design%20sheet%20pink%20twin%20tails%20blue%20eyes%20sailor%20uniform%20multiple%20views%20expression%20sheet%20white%20background&image_size=landscape_16_9',
        tags: ['动漫', '角色设计', '三视图', '表情', 'OC'],
        downloads: 0,
        likes: 0,
        rating: 4.9,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '动漫风格少女角色立绘，粉色双马尾长发，蓝色大眼睛，白色水手服配红色蝴蝶结，正面站姿，全身像，角色设计稿风格',
      },
      {
        id: 'official-product-main-image',
        name: '产品主图一键生成',
        description: '产品文案 → 科技风主图 + 生活场景图 + 白底图 → 三风格一键导出。电商主图效率翻倍。',
        category: '电商',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=wireless%20earbuds%20product%20photography%20ecommerce%20main%20image%20dark%20tech%20background%20floating%20product%20metal%20texture%208K&image_size=square',
        tags: ['电商', '主图', '文案', '多风格', '产品图'],
        downloads: 0,
        likes: 0,
        rating: 4.8,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '蓝牙无线耳机产品图，科技风、生活场景、白底图三风格，电商主图标准，专业商业摄影',
      },
      {
        id: 'official-educational-shorts',
        name: '知识科普短视频',
        description: '选题文案 → 分镜脚本 → 分镜生图 → 视频合成 → AI配音 → 导出。60秒科普视频一键生成。',
        category: '教育',
        author: '小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=educational%20science%20video%20blue%20sky%20clouds%20sunlight%20knowledge%20learning%20concept%20cinematic&image_size=landscape_16_9',
        tags: ['科普', '知识', '短视频', '配音', '教育'],
        downloads: 0,
        likes: 0,
        rating: 4.7,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        promptTemplate: '为什么天空是蓝色的？科普短视频脚本，60秒，瑞利散射原理通俗讲解，开头钩子+结尾互动',
      },
      {
        id: 'official-qwen-edit-2509',
        name: 'Qwen-Edit 2509 · 智能图像编辑',
        description: '基于 Comfy-Org 官方工作流，支持多图编辑、角色一致性、文字编辑、局部重绘。包含 Qwen-Image-Edit 2509 + Qwen 2.5-VL + Lightning LoRA 完整素材链。',
        category: '图片处理',
        author: 'Comfy-Org / 小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20image%20editing%20tool%20interface%20multiple%20image%20inputs%20advanced%20editing%20controls%20dark%20theme%20professional&image_size=landscape_16_9',
        tags: ['Qwen-Edit', '图像编辑', '多图编辑', '角色一致性', '文字编辑', 'Lightning'],
        downloads: 0,
        likes: 0,
        rating: 5.0,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        resourceUrl: 'https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI',
        workflowFiles: ['image_qwen_image_edit_2509.json'],
        loraFiles: ['Qwen-Image-Lightning-4steps-V1.0.safetensors'],
        promptTemplate: '参考图2的结构和色调，对图1进行定向编辑，保持主体一致性',
        defaultParams: {
          modelId: 'qwen-edit-2509',
          modelProvider: 'comfyui',
          generationMode: 'image_to_image',
          imageSize: '2K',
          aspectRatio: 'auto',
          steps: 28,
          cfgScale: 7,
        },
        mediaAssets: [
          'https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI',
          'https://huggingface.co/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Lightning-4steps-V1.0.safetensors',
        ],
      },
      {
        id: 'official-wan22-animate',
        name: 'Wan 2.2 Animate · 角色动画',
        description: '基于 Comfy-Org 官方工作流，支持角色替换和动作迁移。包含 Wan 2.2 Animate 14B + Relight LoRA + DWPose 完整素材链，支持 Mix/Move 双模式。',
        category: '视频',
        author: 'Comfy-Org / 小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20character%20animation%20studio%20motion%20capture%20video%20production%20cinematic%20lighting%20professional&image_size=landscape_16_9',
        tags: ['Wan2.2', '角色动画', '动作迁移', '角色替换', 'Animate', 'DWPose'],
        downloads: 0,
        likes: 0,
        rating: 5.0,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        resourceUrl: 'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged',
        workflowFiles: ['video_wan2_2_14B_animate.json'],
        loraFiles: ['WanAnimate_relight_lora_fp16.safetensors', 'lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors'],
        promptTemplate: '角色保持参考图风格，跟随输入视频动作和表情，自然环境融合',
        defaultParams: {
          modelId: 'wan2.2-animate-14b',
          modelProvider: 'comfyui',
          generationMode: 'image_to_video',
          resolution: '1080p',
          duration: 5,
          cameraMovement: 'auto',
        },
        mediaAssets: [
          'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged',
          'https://huggingface.co/alibaba-pai/Wan2.2-Animate-14B',
        ],
      },
      {
        id: 'official-wan22-i2v',
        name: 'Wan 2.2 I2V · 图生视频',
        description: '基于 Comfy-Org 官方工作流，采用 MoE 架构，支持 480P/720P 高清输出。包含高噪声+低噪声双专家模型 + Wan 2.1 VAE + LightX2V LoRA 完整素材链。',
        category: '视频',
        author: 'Comfy-Org / 小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20video%20generation%20from%20image%20cinematic%20motion%20smooth%20transitions%20professional%20studio%20dark%20theme&image_size=landscape_16_9',
        tags: ['Wan2.2', '图生视频', 'I2V', 'MoE', '高清视频', 'LightX2V'],
        downloads: 0,
        likes: 0,
        rating: 4.9,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        resourceUrl: 'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged',
        workflowFiles: ['video_wan2_2_14B_i2v.json'],
        loraFiles: ['lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors'],
        promptTemplate: '缓慢推镜头，主体保持稳定，背景有自然动态，电影级画质',
        defaultParams: {
          modelId: 'wan2.2-i2v-14b',
          modelProvider: 'comfyui',
          generationMode: 'image_to_video',
          resolution: '720p',
          duration: 4,
          cameraMovement: 'slow_pan',
        },
        mediaAssets: [
          'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged',
          'https://huggingface.co/alibaba-pai/Wan2.2-I2V-14B',
        ],
      },
      {
        id: 'official-multiangle-stack',
        name: '多角度拆分堆栈 · 5视角视频',
        description: '基于 ComfyUI 社区热门工作流，单图输入生成5个角度静态图，再用 Wan 2.2 动画化并堆叠为 9:16 竖屏视频。包含 Qwen-Image-Edit 2511 + Multiple-Angles LoRA + RIFE 帧插值完整素材链。',
        category: '视频',
        author: 'ComfyUI Community / 小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=multi%20angle%20video%20split%20screen%20five%20perspectives%20character%20turnaround%203D%20style%20professional&image_size=portrait_4_3',
        tags: ['多角度', '拆分堆栈', '9:16', 'Qwen-Edit', 'Wan2.2', 'RIFE', '竖屏'],
        downloads: 0,
        likes: 0,
        rating: 4.8,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        resourceUrl: 'https://comfy.org/workflows/template_rob_split_stack_qwen_multi_wan22-91ec966e3abb/',
        workflowFiles: ['split_stack_qwen_multi_wan22.json'],
        loraFiles: ['Qwen-Image-Edit-2511-Multiple-Angles-LoRA.safetensors', 'Qwen-Image-Edit-2511-Lightning.safetensors'],
        promptTemplate: '从5个角度展示主体：正面、左侧、右侧、俯视、仰视，保持角色一致性',
        defaultParams: {
          modelId: 'qwen-edit-2511',
          modelProvider: 'comfyui',
          generationMode: 'multi_angle',
          resolution: '1080p',
          duration: 5,
          outputRatio: '9:16',
        },
        mediaAssets: [
          'https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA',
          'https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning',
          'https://github.com/hzwer/Practical-RIFE',
        ],
      },
      {
        id: 'official-coherent-scenes',
        name: '连贯场景 · 故事叙事',
        description: '基于 RunComfy 专业工作流，Qwen-Image-Edit 生成连贯关键帧 → Wan 2.2 动画化 → RIFE 帧插值 → HunyuanVideo-Foley 音效合成。适合叙事艺术、动画预览、概念分镜。',
        category: '短剧',
        author: 'RunComfy / 小天 AICG',
        nodes: [],
        edges: [],
        thumbnailUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=storytelling%20scene%20sequence%20cinematic%20storyboard%20multiple%20shots%20consistent%20characters%20dramatic%20lighting&image_size=landscape_16_9',
        tags: ['连贯场景', '叙事', '故事板', 'Qwen-Edit', 'Wan2.2', 'RIFE', 'Foley'],
        downloads: 0,
        likes: 0,
        rating: 4.9,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfficial: true,
        isFeatured: true,
        isFree: true,
        resourceUrl: 'https://www.runcomfy.com/comfyui-workflows/create-coherent-scenes-qwen-image-edit-wan-2-2-in-comfyui-cinematic-coherence-workflow',
        workflowFiles: ['create_coherent_scenes.json'],
        loraFiles: ['Qwen-Image-Lightning-4steps-V1.0.safetensors'],
        promptTemplate: '场景1：建立镜头，全景展示环境；场景2：中景，角色进入；场景3：特写，情感表达；保持光线和色调一致',
        defaultParams: {
          modelId: 'qwen-edit-2509',
          modelProvider: 'comfyui',
          generationMode: 'coherent_story',
          resolution: '1080p',
          duration: 8,
          sceneCount: 3,
        },
        mediaAssets: [
          'https://huggingface.co/phazei/HunyuanVideo-Foley',
          'https://github.com/hzwer/Practical-RIFE',
          'https://huggingface.co/Comfy-Org/FLUX.1-Krea-dev_ComfyUI',
        ],
      },
      ...CANVAS_MATERIAL_PRESETS.map(createMaterialMarketplaceTemplate),
    ];

    let changed = false;
    for (const template of defaultTemplates) {
      const existing = this.templates.get(template.id);
      const hydrated = hydrateOfficialTemplate({
        ...template,
        downloads: existing?.downloads ?? template.downloads,
        likes: existing?.likes ?? template.likes,
        rating: existing?.rating ?? template.rating,
        ratingCount: existing?.ratingCount ?? template.ratingCount,
        createdAt: existing?.createdAt ?? template.createdAt,
      });

      if (!existing) {
        this.templates.set(template.id, hydrated);
        changed = true;
        continue;
      }

      if (template.isOfficial) {
        this.templates.set(template.id, hydrated);
        changed = true;
      }
    }

    if (changed) {
      this.saveToStorage();
      logger.info('初始化默认工作流模板完成');
    }
  }

  public publishTemplate(
    name: string,
    description: string,
    category: string,
    author: string,
    nodes: Node[],
    edges: Edge[],
    tags: string[] = [],
    thumbnailUrl?: string,
    isFree: boolean = true,
    price?: number
  ): WorkflowTemplate {
    const template: WorkflowTemplate = completeMarketplaceTemplate({
      id: generateId(),
      name,
      description,
      category,
      author,
      nodes,
      edges,
      thumbnailUrl,
      tags,
      downloads: 0,
      likes: 0,
      rating: 0,
      ratingCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isOfficial: false,
      isFeatured: false,
      isFree,
      price,
    });

    this.templates.set(template.id, template);
    this.saveToStorage();
    logger.info(`发布工作流模板: ${name}`);
    return template;
  }

  public getTemplate(id: string): WorkflowTemplate | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;
    return completeMarketplaceTemplate(template);
  }

  public getAllTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values()).map((template) => completeMarketplaceTemplate(template));
  }

  public getTemplates(filter?: WorkflowMarketplaceFilter): WorkflowTemplate[] {
    let templates = this.getAllTemplates();

    if (filter) {
      if (filter.category) {
        templates = templates.filter(t => t.category === filter.category);
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      if (filter.tags && filter.tags.length > 0) {
        templates = templates.filter(t =>
          filter.tags!.some(tag => t.tags.includes(tag))
        );
      }

      if (filter.isFree !== undefined) {
        templates = templates.filter(t => t.isFree === filter.isFree);
      }

      if (filter.isOfficial !== undefined) {
        templates = templates.filter(t => t.isOfficial === filter.isOfficial);
      }

      if (filter.sortBy) {
        switch (filter.sortBy) {
          case 'popular':
            templates.sort((a, b) => (b.likes + b.downloads * 2) - (a.likes + a.downloads * 2));
            break;
          case 'newest':
            templates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            break;
          case 'rating':
            templates.sort((a, b) => b.rating - a.rating);
            break;
          case 'downloads':
            templates.sort((a, b) => b.downloads - a.downloads);
            break;
        }
      }
    }

    return templates;
  }

  public getFeaturedTemplates(): WorkflowTemplate[] {
    return this.getAllTemplates().filter(t => t.isFeatured);
  }

  public getCategories(): string[] {
    const categories = new Set<string>();
    this.getAllTemplates().forEach(t => categories.add(t.category));
    return Array.from(categories).sort();
  }

  public getAllTags(): string[] {
    const tags = new Set<string>();
    this.getAllTemplates().forEach(t => t.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }

  public downloadTemplate(templateId: string, userId: string = 'anonymous'): WorkflowTemplate | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    const hydrated = hydrateOfficialTemplate(template);
    if (hydrated !== template) {
      this.templates.set(templateId, hydrated);
    }

    hydrated.downloads++;

    if (!this.userDownloads.has(userId)) {
      this.userDownloads.set(userId, new Set());
    }
    this.userDownloads.get(userId)!.add(templateId);

    this.saveToStorage();
    logger.info(`下载模板: ${hydrated.name} (${templateId})`);
    return hydrated;
  }

  public likeTemplate(templateId: string, userId: string = 'anonymous'): WorkflowTemplate | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    if (!this.userLikes.has(userId)) {
      this.userLikes.set(userId, new Set());
    }

    const userLikes = this.userLikes.get(userId)!;
    if (userLikes.has(templateId)) {
      userLikes.delete(templateId);
      template.likes--;
    } else {
      userLikes.add(templateId);
      template.likes++;
    }

    this.saveToStorage();
    return template;
  }

  public hasLiked(templateId: string, userId: string = 'anonymous'): boolean {
    return this.userLikes.get(userId)?.has(templateId) || false;
  }

  public hasDownloaded(templateId: string, userId: string = 'anonymous'): boolean {
    return this.userDownloads.get(userId)?.has(templateId) || false;
  }

  public addReview(
    templateId: string,
    userId: string,
    userName: string,
    rating: number,
    comment: string
  ): WorkflowReview | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    const review: WorkflowReview = {
      id: generateId(),
      templateId,
      userId,
      userName,
      rating,
      comment,
      createdAt: new Date(),
    };

    if (!this.reviews.has(templateId)) {
      this.reviews.set(templateId, []);
    }

    const templateReviews = this.reviews.get(templateId)!;
    const existingReviewIndex = templateReviews.findIndex(r => r.userId === userId);

    if (existingReviewIndex >= 0) {
      templateReviews[existingReviewIndex] = review;
    } else {
      templateReviews.push(review);
    }

    const allRatings = templateReviews.map(r => r.rating);
    template.rating = allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;
    template.ratingCount = allRatings.length;

    this.saveToStorage();
    logger.info(`添加评论: ${template.name} - ${rating}星`);
    return review;
  }

  public getReviews(templateId: string): WorkflowReview[] {
    return this.reviews.get(templateId) || [];
  }

  public deleteTemplate(id: string): boolean {
    const success = this.templates.delete(id);
    if (success) {
      this.reviews.delete(id);
      this.saveToStorage();
      logger.info(`删除模板: ${id}`);
    }
    return success;
  }

  public updateTemplate(id: string, updates: Partial<Omit<WorkflowTemplate, 'id' | 'createdAt'>>): WorkflowTemplate | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;

    const updatedTemplate: WorkflowTemplate = completeMarketplaceTemplate({
      ...template,
      ...updates,
      updatedAt: new Date(),
    });

    this.templates.set(id, updatedTemplate);
    this.saveToStorage();
    return updatedTemplate;
  }

  private loadFromStorage(): void {
    try {
      const templatesData = localStorage.getItem(this.TEMPLATES_KEY);
      const reviewsData = localStorage.getItem(this.REVIEWS_KEY);

      if (templatesData) {
        const parsed = JSON.parse(templatesData) as WorkflowTemplate[];
        parsed.forEach((t) => {
          const hydrated = hydrateOfficialTemplate({
            ...t,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          });
          this.templates.set(hydrated.id, hydrated);
        });
      }

      if (reviewsData) {
        const parsed = JSON.parse(reviewsData) as Record<string, WorkflowReview[]>;
        Object.entries(parsed).forEach(([templateId, reviews]) => {
          this.reviews.set(
            templateId,
            reviews.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
            })),
          );
        });
      }

      logger.info('工作流市场服务数据加载完成');
    } catch (error) {
      logger.warn('加载工作流市场数据失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(Array.from(this.templates.values())));

      const reviewsObj: Record<string, WorkflowReview[]> = {};
      this.reviews.forEach((reviews, templateId) => {
        reviewsObj[templateId] = reviews;
      });
      localStorage.setItem(this.REVIEWS_KEY, JSON.stringify(reviewsObj));
    } catch (error) {
      logger.warn('保存工作流市场数据失败:', error);
    }
  }

  public clearAllData(): void {
    this.templates.clear();
    this.reviews.clear();
    this.userDownloads.clear();
    this.userLikes.clear();
    localStorage.removeItem(this.TEMPLATES_KEY);
    localStorage.removeItem(this.REVIEWS_KEY);
    this.initializeDefaultTemplates();
    logger.info('工作流市场服务数据已清空');
  }
}

export const workflowMarketplaceService = WorkflowMarketplaceService.getInstance();
export default WorkflowMarketplaceService;
