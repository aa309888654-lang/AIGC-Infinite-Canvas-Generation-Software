export interface MangaTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  scenes: TemplateScene[];
  style: 'anime' | 'comic' | 'realistic' | 'mixed';
  duration: number;
  popularity: number;
  isNew?: boolean;
  isHot?: boolean;
  tags: string[];
  preview: string;
}

export interface TemplateScene {
  id: string;
  name: string;
  type: 'opening' | 'dialogue' | 'action' | 'emotional' | 'narration' | 'ending';
  duration: number;
  elements: SceneElement[];
  effects: string[];
}

export interface SceneElement {
  type: 'panel' | 'text' | 'effect' | 'transition';
  content: string;
  position: 'top' | 'center' | 'bottom' | 'left' | 'right';
  style?: string;
}

export const MANGA_TEMPLATES: MangaTemplate[] = [
  {
    id: 'manga-hook-15s',
    name: '15秒强钩子预告',
    description: '适合短剧、漫剧开场，用高冲突开头快速抓住注意力。',
    category: 'short-drama',
    icon: '🎬',
    style: 'comic',
    duration: 15,
    popularity: 96,
    isHot: true,
    tags: ['短剧', '开场', '强冲突'],
    preview: 'linear-gradient(135deg, rgba(248,113,113,0.35), rgba(249,115,22,0.16))',
    scenes: [
      {
        id: 'hook-1',
        name: '冲突开场',
        type: 'opening',
        duration: 4,
        effects: ['闪白', '快速推近'],
        elements: [{ type: 'text', content: '三秒进入核心冲突', position: 'center', style: 'bold' }],
      },
      {
        id: 'hook-2',
        name: '人物反应',
        type: 'dialogue',
        duration: 5,
        effects: ['轻微震动', '字幕强调'],
        elements: [{ type: 'text', content: '保留关键对白和表情反应', position: 'bottom' }],
      },
      {
        id: 'hook-3',
        name: '悬念收尾',
        type: 'ending',
        duration: 6,
        effects: ['暗场', '节拍点'],
        elements: [{ type: 'text', content: '留下悬念，推动继续观看', position: 'center' }],
      },
    ],
  },
  {
    id: 'manga-product-30s',
    name: '30秒产品漫剪',
    description: '产品展示、功能介绍和卖点字幕的紧凑剪辑节奏。',
    category: 'product',
    icon: '📦',
    style: 'mixed',
    duration: 30,
    popularity: 91,
    isNew: true,
    tags: ['产品', '卖点', '口播'],
    preview: 'linear-gradient(135deg, rgba(56,189,248,0.32), rgba(16,185,129,0.14))',
    scenes: [
      {
        id: 'product-1',
        name: '痛点引入',
        type: 'opening',
        duration: 6,
        effects: ['文字弹入', '低频冲击'],
        elements: [{ type: 'text', content: '先提出用户痛点', position: 'top' }],
      },
      {
        id: 'product-2',
        name: '功能展示',
        type: 'narration',
        duration: 14,
        effects: ['分屏', '重点描边'],
        elements: [{ type: 'text', content: '展示三个核心功能', position: 'bottom' }],
      },
      {
        id: 'product-3',
        name: '行动号召',
        type: 'ending',
        duration: 10,
        effects: ['LOGO定格', '字幕高亮'],
        elements: [{ type: 'text', content: '收束卖点并引导行动', position: 'center' }],
      },
    ],
  },
  {
    id: 'manga-action-45s',
    name: '45秒动作高燃',
    description: '适合战斗、追逐、转折类素材，突出节拍点和镜头动势。',
    category: 'action',
    icon: '⚡',
    style: 'anime',
    duration: 45,
    popularity: 94,
    isHot: true,
    tags: ['动作', '高燃', '节拍'],
    preview: 'linear-gradient(135deg, rgba(168,85,247,0.34), rgba(59,130,246,0.16))',
    scenes: [
      {
        id: 'action-1',
        name: '蓄力铺垫',
        type: 'emotional',
        duration: 10,
        effects: ['慢放', '暗角'],
        elements: [{ type: 'text', content: '先制造压迫感', position: 'bottom' }],
      },
      {
        id: 'action-2',
        name: '爆发段落',
        type: 'action',
        duration: 20,
        effects: ['速度拉伸', '闪白转场'],
        elements: [{ type: 'effect', content: '对齐音乐重拍切镜', position: 'center' }],
      },
      {
        id: 'action-3',
        name: '情绪定格',
        type: 'ending',
        duration: 15,
        effects: ['定格', '粒子'],
        elements: [{ type: 'text', content: '用一句台词收尾', position: 'center' }],
      },
    ],
  },
];

export const MANGA_CATEGORIES: { id: string; name: string }[] = [
  { id: 'all', name: '全部' },
  { id: 'short-drama', name: '短剧' },
  { id: 'product', name: '产品' },
  { id: 'action', name: '动作' },
];

export const SCENE_ICONS: Record<string, string> = {
  opening: '🎬',
  dialogue: '💬',
  action: '⚡',
  emotional: '💗',
  narration: '📖',
  ending: '🎯',
};
