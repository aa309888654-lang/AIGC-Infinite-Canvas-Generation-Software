import { getAuthToken } from '@/lib/auth-check';
/**
 * 提示词优化 API 服务
 * 前端仅负责调用后端 API，所有 system prompt 由后端 buildSystemPrompt 统一管理
 */

import { logger } from '@/lib/logger';
import { API_BASE_URL } from '@/lib/api-config';
import { normalizeOptimizedPrompt } from '@/lib/final-prompt';

export type OptimizationScenario = 'video' | 'image' | 'text';

export type ProfessionalCategory =
  | '3d-render'
  | 'fighting'
  | 'sports'
  | 'animation'
  | 'cinematic'
  | 'cinema-director'
  | 'product'
  | 'music-video'
  | 'film-director'
  | 'portrait'
  | 'landscape'
  | 'food-photography'
  | 'sci-fi'
  | 'horror'
  | 'chinese-style'
  | 'fashion'
  | 'architecture'
  | 'pet-animal'
  | 'macro-photography'
  | 'timelapse'
  | 'wildlife'
  | 'underwater'
  | 'automotive'
  | 'space-astronomy'
  | 'fantasy'
  | 'documentary'
  | 'street-photography'
  | 'urban-night';

export const professionalCategories = [
  { value: '3d-render', label: '3D渲染动画', icon: '🎨', desc: '3D建模与渲染，逼真的三维视觉体验' },
  { value: 'fighting', label: '打斗视频', icon: '⚔️', desc: '专业打斗编排，紧张刺激的战斗场面' },
  { value: 'sports', label: '运动视频', icon: '🏃', desc: '体育运动动态捕捉，精彩竞技瞬间' },
  { value: 'animation', label: '动画制作', icon: '🎬', desc: '动漫与卡通风格，想象力跃然屏幕' },
  { value: 'cinematic', label: '电影镜头', icon: '🎥', desc: '电影级镜头语言，大片质感叙事' },
  { value: 'cinema-director', label: '漫剧导演', icon: '🎭', desc: '分镜叙事与剧情编排，导演视角' },
  { value: 'product', label: '产品动画', icon: '📦', desc: '产品展示与商业广告，突出质感' },
  { value: 'music-video', label: '音乐视频', icon: '🎵', desc: '音乐与视觉融合，节奏感MV创作' },
  {
    value: 'film-director',
    label: '综合型影视创作',
    icon: '🎬',
    desc: '从剧本到画面的完整影视创作',
  },
  { value: 'portrait', label: '人物摄影', icon: '👤', desc: '人物肖像与写真，突出面部与情绪' },
  { value: 'landscape', label: '自然风景', icon: '🏞️', desc: '自然风光与壮丽景色，山川湖海' },
  {
    value: 'food-photography',
    label: '美食摄影',
    icon: '🍜',
    desc: '美食视觉呈现，诱人食欲的质感',
  },
  { value: 'sci-fi', label: '科幻场景', icon: '🚀', desc: '未来科技与科幻世界，未知宇宙探索' },
  { value: 'horror', label: '恐怖氛围', icon: '👻', desc: '恐怖悬疑氛围，惊悚视觉冲击' },
  {
    value: 'chinese-style',
    label: '国风美术',
    icon: '🏯',
    desc: '东方美学与传统文化，水墨诗意表达',
  },
  { value: 'fashion', label: '时尚大片', icon: '👗', desc: '时尚潮流与服饰，高级感视觉大片' },
  {
    value: 'architecture',
    label: '建筑摄影',
    icon: '🏛️',
    desc: '建筑美学与空间设计，结构力量之美',
  },
  { value: 'pet-animal', label: '动物宠物', icon: '🐾', desc: '可爱动物与宠物，治愈系萌宠摄影' },
  {
    value: 'macro-photography',
    label: '微距特写',
    icon: '🔬',
    desc: '微观世界探索，细微之处的精致美感',
  },
  { value: 'timelapse', label: '延时摄影', icon: '⏱️', desc: '时光流转的延时画面，日夜交替之美' },
  { value: 'wildlife', label: '野生动物', icon: '🦁', desc: '自然界生灵之美，野生动物生态摄影' },
  { value: 'underwater', label: '水下摄影', icon: '🐠', desc: '神秘水下世界，海洋生物梦幻交织' },
  { value: 'automotive', label: '汽车载具', icon: '🚗', desc: '汽车设计与工业美学，速度力量诠释' },
  {
    value: 'space-astronomy',
    label: '太空天文',
    icon: '🌌',
    desc: '浩瀚宇宙与星空，天文学视觉呈现',
  },
  { value: 'fantasy', label: '奇幻魔幻', icon: '🐉', desc: '奇幻世界无限想象，魔法传说视觉化' },
  { value: 'documentary', label: '纪录片', icon: '📹', desc: '真实记录与纪实风格，动人故事' },
  {
    value: 'street-photography',
    label: '街头摄影',
    icon: '🌃',
    desc: '城市街角真实瞬间，人文温度记录',
  },
  { value: 'urban-night', label: '城市夜景', icon: '🌆', desc: '夜幕下的城市光影，霓虹与建筑交织' },
] as const;

const AGENT_KEYWORD_MAP: Record<ProfessionalCategory, { keywords: string[]; weight: number }> = {
  '3d-render': {
    keywords: [
      '3d',
      '三维',
      '建模',
      '渲染',
      'cg',
      'cgi',
      'blender',
      'maya',
      '虚幻',
      'ue5',
      'unity',
      '次世代',
      'pbr',
      '材质',
      '模型',
      '数字人',
      '虚拟',
    ],
    weight: 1.0,
  },
  fighting: {
    keywords: [
      '打斗',
      '战斗',
      '武术',
      '功夫',
      '格斗',
      '拳',
      '搏击',
      '对战',
      '打架',
      '对决',
      '剑',
      '刀',
      '武器',
      '厮杀',
      '战场',
      '决斗',
      '击杀',
      '战斗场面',
      '对抗',
      '激战',
    ],
    weight: 1.0,
  },
  sports: {
    keywords: [
      '运动',
      '体育',
      '跑步',
      '篮球',
      '足球',
      '游泳',
      '健身',
      '瑜伽',
      '滑雪',
      '滑板',
      '骑行',
      '马拉松',
      '比赛',
      '赛场',
      '训练',
      '冲刺',
      '跳',
      '体操',
      '举重',
    ],
    weight: 1.0,
  },
  animation: {
    keywords: [
      '动画',
      '卡通',
      '二次元',
      '动漫',
      '日漫',
      '赛璐璐',
      '手绘',
      '帧动画',
      '定格',
      '粘土',
      '皮克斯',
      '吉卜力',
      '宫崎骏',
      '卡通渲染',
      'toon',
      'cel shading',
    ],
    weight: 1.0,
  },
  cinematic: {
    keywords: [
      '电影镜头',
      '大片',
      '镜头感',
      '摄影',
      '广角',
      '特写',
      '景深',
      '光圈',
      '焦段',
      '电影感',
      '胶片',
      '变形宽银幕',
      '斯坦尼康',
      '推轨',
      '摇臂',
      '航拍',
      'imax',
    ],
    weight: 1.0,
  },
  'cinema-director': {
    keywords: [
      '漫剧',
      '漫画',
      '剧集',
      '连续剧',
      '分镜',
      '故事板',
      '叙事',
      '剧情',
      '章节',
      '话',
      '集',
      '连载',
      '条漫',
      'webtoon',
      '脚本',
    ],
    weight: 1.0,
  },
  product: {
    keywords: [
      '产品',
      '广告',
      '商业',
      '展示',
      '宣传',
      '促销',
      '品牌',
      'logo',
      '包装',
      '电商',
      '商品',
      '营销',
      '推广',
      '开箱',
      '测评',
      '广告片',
    ],
    weight: 1.0,
  },
  'music-video': {
    keywords: [
      'mv',
      '音乐',
      '舞蹈',
      '节奏',
      '演唱会',
      '舞台',
      '歌手',
      '乐队',
      'dj',
      '蹦迪',
      '夜店',
      '霓虹',
      '舞曲',
      '编舞',
      '唱',
      'rap',
      'hip-hop',
      'hiphop',
    ],
    weight: 1.0,
  },
  'film-director': {
    keywords: [
      '电影',
      '影视',
      '导演',
      '短片',
      '微电影',
      '纪录片',
      '预告片',
      '正片',
      '剪辑',
      '蒙太奇',
      '转场',
      '编剧',
      '制片',
      '拍摄',
      '剧组',
    ],
    weight: 1.0,
  },
  portrait: {
    keywords: [
      '人物',
      '肖像',
      '写真',
      '人像',
      '自拍',
      '面部',
      '妆容',
      '发型',
      '穿搭',
      '时尚',
      '模特',
      '证件照',
      '头像',
      '半身像',
      '特写人脸',
      '表情',
    ],
    weight: 1.0,
  },
  landscape: {
    keywords: [
      '风景',
      '自然',
      '山水',
      '风光',
      '日落',
      '大海',
      '森林',
      '山脉',
      '湖泊',
      '天空',
      '云',
      '极光',
      '星空',
      '沙漠',
      '草原',
      '雪景',
      '城市',
      '夜景',
      '建筑',
      '街景',
    ],
    weight: 1.0,
  },
  'food-photography': {
    keywords: [
      '美食',
      '食物',
      '料理',
      '烹饪',
      '菜品',
      '甜点',
      '蛋糕',
      '面包',
      '咖啡',
      '茶',
      '饮品',
      '火锅',
      '烧烤',
      '寿司',
      '面条',
      '水果',
      '蔬菜',
      '摆盘',
      '餐具',
      '餐厅',
    ],
    weight: 1.0,
  },
  'sci-fi': {
    keywords: [
      '科幻',
      '未来',
      '太空',
      '宇宙',
      '飞船',
      '机甲',
      '外星',
      '赛博',
      'ai',
      '机器人',
      '星际',
      '虫洞',
      '量子',
      '克隆',
      '虚拟现实',
      '末日',
      '废土',
      '变异',
      '异形',
      '时空',
    ],
    weight: 1.0,
  },
  horror: {
    keywords: [
      '恐怖',
      '惊悚',
      '鬼',
      '灵异',
      '诡异',
      '黑暗',
      '阴森',
      '血',
      '丧尸',
      '诅咒',
      '噩梦',
      '幽灵',
      '怪物',
      '诡异',
      '恐怖片',
      '惊吓',
      '悬疑',
      '灵堂',
      '废弃',
      '闹鬼',
    ],
    weight: 1.0,
  },
  'chinese-style': {
    keywords: [
      '国风',
      '古风',
      '水墨',
      '汉服',
      '旗袍',
      '仙侠',
      '武侠',
      '宫廷',
      '龙',
      '凤',
      '竹林',
      '荷花',
      '亭台',
      '楼阁',
      '祥云',
      '青绿',
      '敦煌',
      '写意',
      '山水画',
      '中国',
      '中式',
      '华夏',
      '东方',
      '传统',
      '古典',
      '古韵',
      '国粹',
      '建筑',
      '宫殿',
      '庙宇',
      '寺庙',
      '园林',
      '苏州',
      '江南',
      '徽派',
      '四合院',
      '土楼',
      '人物',
      '美女',
      '女子',
      '男子',
      '侠客',
      '书生',
      '仕女',
      '仙女',
      '道士',
      '僧人',
      '长城',
      '故宫',
      '天坛',
      '颐和园',
      '圆明园',
      '避暑山庄',
      '布达拉宫',
      '黄山',
      '泰山',
      '华山',
      '庐山',
      '桂林',
      '张家界',
      '九寨沟',
      '牡丹',
      '梅花',
      '兰花',
      '竹子',
      '菊花',
      '荷花',
      '桃花',
      '樱花',
      '书法',
      '篆刻',
      '剪纸',
      '刺绣',
      '丝绸',
      '瓷器',
      '景泰蓝',
      '漆器',
      '京剧',
      '昆曲',
      '越剧',
      '黄梅戏',
      '评剧',
      '豫剧',
      '春节',
      '元宵',
      '端午',
      '中秋',
      '重阳',
      '清明',
      '熊猫',
      '仙鹤',
      '麒麟',
      '貔貅',
      '凤凰',
      '龙',
      '茶道',
      '功夫',
      '太极',
      '武术',
      '棋艺',
      '琴艺',
      '儒家',
      '道家',
      '佛家',
      '禅意',
      '易经',
      '风水',
    ],
    weight: 1.2,
  },
  fashion: {
    keywords: [
      '时尚',
      '时装',
      '模特',
      '走秀',
      '穿搭',
      '潮流',
      '奢侈品',
      '品牌',
      '街拍',
      '杂志',
      '封面',
      '造型',
      '高定',
      '潮牌',
      '秀场',
      '时装周',
      '搭配',
      '风格',
      '设计感',
      '前卫',
    ],
    weight: 1.0,
  },
  architecture: {
    keywords: [
      '建筑',
      '楼房',
      '大厦',
      '桥梁',
      '教堂',
      '寺庙',
      '城堡',
      '别墅',
      '室内',
      '空间',
      '结构',
      '几何',
      '混凝土',
      '玻璃幕墙',
      '天际线',
      '城市规划',
      '景观',
      '园林',
      '庭院',
      '地标',
    ],
    weight: 1.0,
  },
  'pet-animal': {
    keywords: [
      '猫',
      '狗',
      '宠物',
      '动物',
      '小狗',
      '小猫',
      '兔子',
      '鸟',
      '鱼',
      '马',
      '鹿',
      '虎',
      '狮',
      '熊猫',
      '海豚',
      '蝴蝶',
      '鹰',
      '狼',
      '狐狸',
      '企鹅',
    ],
    weight: 1.0,
  },
  'macro-photography': {
    keywords: [
      '微距',
      '特写',
      '微观',
      '放大',
      '近摄',
      '微距镜头',
      'macro',
      '花瓣',
      '露珠',
      '水珠',
      '昆虫',
      '花蕊',
      '晶体',
      '纤维',
      '纹理细节',
      '细胞',
      '菌类',
    ],
    weight: 1.0,
  },
  timelapse: {
    keywords: [
      '延时',
      '加速',
      '缩时',
      '日转星移',
      '流云',
      '昼夜',
      '快速',
      '花开',
      '城市变化',
      '光轨',
      '星轨',
      '潮汐',
      '日出日落',
      'hyperlapse',
      'timestack',
      '车流光轨',
    ],
    weight: 1.0,
  },
  wildlife: {
    keywords: [
      '野生',
      '动物世界',
      '非洲',
      '草原',
      '捕猎',
      '迁徙',
      '狮群',
      '角马',
      '猎豹',
      '鲸鱼',
      '海豹',
      '鹰隼',
      '纪录片动物',
      '生态',
      '栖息地',
      '丛林',
      '雨林',
    ],
    weight: 1.0,
  },
  underwater: {
    keywords: [
      '水下',
      '潜水',
      '海洋',
      '海底',
      '珊瑚',
      '深海',
      '美人鱼',
      '水母',
      '鲨鱼',
      '潜水员',
      '浮潜',
      '海龟',
      '水族',
      '蓝洞',
      '海浪',
      '波塞冬',
      '亚特兰蒂斯',
    ],
    weight: 1.0,
  },
  automotive: {
    keywords: [
      '汽车',
      '跑车',
      '赛车',
      '越野',
      '摩托',
      '飞机',
      '直升机',
      '游艇',
      '列车',
      '漂移',
      '引擎',
      '驾驶',
      '公路',
      '赛道',
      '超跑',
      'suv',
      '特斯拉',
      '法拉利',
      '兰博基尼',
    ],
    weight: 1.0,
  },
  'space-astronomy': {
    keywords: [
      '太空',
      '宇宙',
      '星云',
      '银河',
      '黑洞',
      '行星',
      '恒星',
      '望远镜',
      '天文',
      '太阳系',
      '月球',
      '火星',
      '星系',
      '暗物质',
      '超新星',
      '流星',
      '彗星',
      '天宫',
      '空间站',
    ],
    weight: 1.0,
  },
  fantasy: {
    keywords: [
      '奇幻',
      '魔幻',
      '魔法',
      '精灵',
      '龙',
      '矮人',
      '巫师',
      '法师',
      '城堡',
      '中世纪',
      '剑与魔法',
      '魔法阵',
      '传送门',
      '异世界',
      '哥特',
      '史诗',
      '魔戒',
      '指环王',
      '巫师',
    ],
    weight: 1.0,
  },
  documentary: {
    keywords: [
      '纪录片',
      '纪实',
      '真实',
      '访谈',
      '调查',
      '报道',
      '人文',
      '社会',
      '历史',
      '传记',
      '探索',
      '揭秘',
      '专题',
      '深度报道',
      '田野',
      '观察',
      '口述',
    ],
    weight: 1.0,
  },
  'street-photography': {
    keywords: [
      '街头',
      '巷弄',
      '街拍',
      '市井',
      '烟火气',
      '菜市场',
      '胡同',
      '弄堂',
      '行人',
      '路人',
      '街角',
      '路灯',
      '雨天',
      '雾气',
      '斑驳',
      '老旧',
      '纪实人',
      '扫街',
    ],
    weight: 1.0,
  },
  'urban-night': {
    keywords: [
      '夜景',
      '霓虹',
      '灯红酒绿',
      '城市夜',
      '天际线',
      '深夜',
      '酒吧街',
      '霓虹灯',
      '车灯',
      '夜市',
      '灯火通明',
      '夜幕',
      '月色',
      '光污染',
      '星空城市',
      '天桥',
      '立交桥',
    ],
    weight: 1.0,
  },
};

export function classifyPromptAgent(
  prompt: string,
  scenario: OptimizationScenario = 'image'
): ProfessionalCategory | undefined {
  if (!prompt.trim()) return 'chinese-style';

  const lowerPrompt = prompt.toLowerCase();
  const scores: { category: ProfessionalCategory; score: number }[] = [];

  for (const [category, config] of Object.entries(AGENT_KEYWORD_MAP)) {
    let score = 0;
    for (const keyword of config.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      let count = 0;
      let pos = lowerPrompt.indexOf(lowerKeyword);
      while (pos !== -1) {
        count++;
        pos = lowerPrompt.indexOf(lowerKeyword, pos + 1);
      }
      if (count > 0) {
        const keywordWeight = keyword.length >= 3 ? 2.0 : 1.0;
        score += count * keywordWeight * config.weight;
      }
    }
    if (score > 0) {
      scores.push({ category: category as ProfessionalCategory, score });
    }
  }

  if (scores.length === 0) return 'chinese-style';

  scores.sort((a, b) => b.score - a.score);

  const top = scores[0];
  if (top.score < 1) return 'chinese-style';

  if (scores.length > 1 && top.score < scores[1].score * 1.3) {
    if (scenario === 'video') return 'film-director';
    return 'chinese-style';
  }

  return top.category;
}

export interface OptimizePromptResponse {
  success: boolean;
  optimizedPrompt?: string;
  qualityReport?: {
    overallScore: number;
    scores: Record<string, number>;
    issues: string[];
    selfRepaired: boolean;
    threshold: number;
  };
  modelProfile?: string;
  suggestions?: string[];
  error?: string;
  isGuest?: boolean;
  trialRemaining?: number;
}

class PromptOptimizerService {
  private static instance: PromptOptimizerService;

  static getInstance(): PromptOptimizerService {
    if (!PromptOptimizerService.instance) {
      PromptOptimizerService.instance = new PromptOptimizerService();
    }
    return PromptOptimizerService.instance;
  }

  async optimizePrompt(
    prompt: string,
    scenario: OptimizationScenario = 'image',
    category?: ProfessionalCategory,
    models?: string[],
    _preferredProvider?: string,
    prePrompt?: string
  ): Promise<OptimizePromptResponse> {
    if (!prompt.trim()) {
      return { success: false, error: '提示词不能为空' };
    }

    try {
      const safeModels = (models || []).filter((model) => typeof model === 'string' && model.length <= 200);
      if (models && (safeModels.length !== models.length || models.length > 8)) {
        return { success: false, error: '目标模型参数格式不正确' };
      }
      logger.info(
        `[PromptOptimizer] 优化请求 → scenario=${scenario}, category=${category || '默认'}, models=[${safeModels.join(', ') || '无'}]`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const token = getAuthToken() || '';
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/ai/optimize-prompt-v3`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            prompt,
            scenario,
            category,
            models: safeModels,
            prePrompt,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || `API 错误: ${response.status}` };
      }

      let data;
      try {
        const text = await response.text();
        if (!text.trim()) {
          return { success: false, error: '服务器返回空响应，请稍后重试' };
        }
        data = JSON.parse(text);
      } catch {
        return { success: false, error: '无法解析服务器响应，请稍后重试' };
      }

      if (!data.success) {
        return { success: false, error: data.error || '优化失败' };
      }

      let optimizedPrompt = data.optimizedPrompt || '';
      if (!optimizedPrompt) {
        return { success: false, error: '无法解析 API 响应' };
      }

      optimizedPrompt = optimizedPrompt.trim().replace(/^["']|["']$/g, '');
      optimizedPrompt = normalizeOptimizedPrompt(
        optimizedPrompt,
        scenario === 'video' ? 'video' : 'image'
      );
      logger.info(
        `[PromptOptimizer] 优化成功 (${data.provider || 'v3'}${data.cached ? ', 缓存' : ''})`
      );

      return {
        success: true,
        optimizedPrompt,
        qualityReport: data.qualityReport,
        modelProfile: data.modelProfile,
      };
    } catch (error: unknown) {
      logger.error(`[PromptOptimizer] 优化失败:`, error);
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          return { success: false, error: '优化超时，请检查网络连接' };
        }
        if (error.message.includes('JSON') || error.message.includes('Unexpected')) {
          return { success: false, error: '服务器响应格式错误，请稍后重试' };
        }
        return { success: false, error: error.message || '优化失败，请检查后端服务是否启动' };
      }
      return { success: false, error: '优化失败，请检查后端服务是否启动' };
    }
  }
}

export const promptOptimizerService = PromptOptimizerService.getInstance();

export async function optimizePrompt(
  prompt: string,
  scenario: OptimizationScenario = 'image',
  category?: ProfessionalCategory,
  models?: string[],
  _preferredProvider?: string,
  prePrompt?: string
): Promise<OptimizePromptResponse> {
  return promptOptimizerService.optimizePrompt(
    prompt,
    scenario,
    category,
    models,
    undefined,
    prePrompt
  );
}
