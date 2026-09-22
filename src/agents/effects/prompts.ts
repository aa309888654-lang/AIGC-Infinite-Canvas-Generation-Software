/**
 * AI特效 Agent 提示词模板
 */

export interface EffectPromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  input: {
    effectType: string;
    effectName: string;
    parameters: Record<string, unknown>;
  };
  expectedOutput: string;
  tips?: string[];
}

export const EFFECT_PROMPTS: EffectPromptTemplate[] = [
  // 粒子特效
  {
    id: 'particle-fire-place',
    name: '壁炉火焰效果',
    category: '粒子特效',
    description: '创建一个温暖的壁炉火焰效果',
    input: {
      effectType: 'particle',
      effectName: 'fire',
      parameters: {
        count: 150,
        colors: ['#ff4400', '#ff6600', '#ffaa00'],
        intensity: 0.8,
        speed: 2.5,
        gravity: -0.3,
      },
    },
    expectedOutput: '带有上升火焰和火星的壁炉效果',
    tips: ['调整 gravity 可以控制火焰上升速度', '增加 count 会让火焰更密集'],
  },
  {
    id: 'particle-rain',
    name: '电影级雨滴',
    category: '粒子特效',
    description: '创建电影感的雨天效果',
    input: {
      effectType: 'particle',
      effectName: 'rain',
      parameters: {
        count: 300,
        speed: 8,
        angle: 15,
        splash: true,
        intensity: 0.9,
      },
    },
    expectedOutput: '带有飞溅效果的倾盆大雨',
    tips: ['调整 angle 可以模拟风向', '开启 splash 增加真实感'],
  },
  {
    id: 'particle-magic',
    name: '魔法粒子特效',
    category: '粒子特效',
    description: '创建梦幻的魔法粒子效果',
    input: {
      effectType: 'particle',
      effectName: 'magic',
      parameters: {
        count: 100,
        colors: ['#ffffff', '#ffd700', '#ff69b4'],
        turbulence: 1.0,
        size: { min: 1, max: 4 },
      },
    },
    expectedOutput: '闪闪发光的魔法粒子',
    tips: ['增加 turbulence 让粒子轨迹更随机', '使用金色和粉色增加梦幻感'],
  },

  // 滤镜特效
  {
    id: 'filter-cinematic',
    name: '电影色调滤镜',
    category: '滤镜',
    description: '应用青橙色调电影效果',
    input: {
      effectType: 'filter',
      effectName: 'cinematic',
      parameters: {
        shadowsColor: '#0088aa',
        highlightsColor: '#ff8844',
        contrast: 0.15,
        vibrance: 0.1,
        grain: 0.05,
      },
    },
    expectedOutput: '专业电影调色效果',
    tips: ['青橙色调适合大多数场景', '轻微的 grain 增加胶片感'],
  },
  {
    id: 'filter-vintage',
    name: '复古胶片滤镜',
    category: '滤镜',
    description: '模拟经典胶片相机的效果',
    input: {
      effectType: 'filter',
      effectName: 'vintage',
      parameters: {
        intensity: 0.8,
        grain: 0.3,
        vignette: 0.4,
        sepia: 0.2,
        fade: 0.1,
        scratches: 0.15,
      },
    },
    expectedOutput: '带有划痕和漏光的复古胶片效果',
    tips: ['增加 scratches 模拟老电影', 'vignette 不要超过 0.5 避免太暗'],
  },
  {
    id: 'filter-noir',
    name: '黑白电影滤镜',
    category: '滤镜',
    description: '经典好莱坞黑白电影风格',
    input: {
      effectType: 'filter',
      effectName: 'noir',
      parameters: {
        contrast: 0.4,
        grain: 0.4,
        vignette: 0.5,
        brightness: -0.1,
      },
    },
    expectedOutput: '高对比度黑白电影效果',
    tips: ['适当降低 brightness 增加神秘感', '强烈的 vignette 聚焦视线'],
  },

  // 故障特效
  {
    id: 'glitch-digital',
    name: '数字故障效果',
    category: '故障特效',
    description: '赛博朋克风格的数字故障',
    input: {
      effectType: 'glitch',
      effectName: 'digital',
      parameters: {
        intensity: 0.7,
        rgbSplit: 10,
        scanlines: 0.4,
        noise: 0.3,
        blockGlitch: true,
      },
    },
    expectedOutput: '带有RGB分离的数字故障效果',
    tips: ['增加 rgbSplit 会让色彩分离更明显', 'blockGlitch 模拟数据损坏'],
  },
  {
    id: 'glitch-datamosh',
    name: '视频损坏效果',
    category: '故障特效',
    description: '模拟视频压缩损坏的效果',
    input: {
      effectType: 'glitch',
      effectName: 'datamosh',
      parameters: {
        intensity: 0.6,
        blockSize: 25,
        blockGlitch: true,
        colorShift: 0.2,
      },
    },
    expectedOutput: '类似视频压缩损坏的艺术效果',
    tips: ['增加 blockSize 让色块更大', '适合故障艺术风格的作品'],
  },

  // 发光特效
  {
    id: 'glow-neon',
    name: '霓虹发光效果',
    category: '发光特效',
    description: '创建霓虹灯光发光效果',
    input: {
      effectType: 'glow',
      effectName: 'neon',
      parameters: {
        color: '#ff00ff',
        intensity: 1.5,
        radius: 12,
        threshold: 0.5,
      },
    },
    expectedOutput: '明亮的霓虹发光效果',
    tips: ['调整 threshold 控制发光范围', '鲜艳的颜色效果更好'],
  },
  {
    id: 'glow-hologram',
    name: '全息投影效果',
    category: '发光特效',
    description: '科幻全息投影效果',
    input: {
      effectType: 'glow',
      effectName: 'holographic',
      parameters: {
        color: '#00ffff',
        intensity: 1.2,
        scanlines: 0.3,
        flicker: 0.2,
      },
    },
    expectedOutput: '带有扫描线的全息效果',
    tips: ['flicker 增加不稳定性', '青色配合深色背景效果最佳'],
  },

  // 转场特效
  {
    id: 'transition-warp',
    name: '时空扭曲转场',
    category: '转场特效',
    description: '时空穿越感的转场效果',
    input: {
      effectType: 'transition',
      effectName: 'warp',
      parameters: {
        direction: 'center',
        distortion: 0.7,
        duration: 0.8,
      },
    },
    expectedOutput: '中心向外扭曲的转场',
    tips: ['增加 distortion 效果更夸张', '适合科幻和奇幻题材'],
  },
  {
    id: 'transition-glitch',
    name: '故障转场',
    category: '转场特效',
    description: '数字故障风格的转场',
    input: {
      effectType: 'transition',
      effectName: 'glitch',
      parameters: {
        intensity: 0.8,
        duration: 0.5,
        glitchType: 'digital',
      },
    },
    expectedOutput: '带有故障元素的转场',
    tips: ['较短的 duration 更干净利落', '适合科技感强的内容'],
  },

  // 复合特效
  {
    id: 'composite-cinematic',
    name: '电影感复合效果',
    category: '复合特效',
    description: '结合多种效果创造电影感',
    input: {
      effectType: 'composite',
      effectName: 'cinematic-look',
      parameters: {
        steps: [
          { effect: 'color-grade', params: { preset: 'teal-orange', intensity: 0.8 } },
          { effect: 'vignette', params: { intensity: 0.4 } },
          { effect: 'grain', params: { intensity: 0.1 } },
          { effect: 'letterbox', params: { ratio: '2.39:1' } },
        ],
      },
    },
    expectedOutput: '完整的电影级调色和构图',
    tips: ['按顺序应用效果', '注意每个效果的 intensity 不要太高'],
  },
  {
    id: 'composite-sci-fi',
    name: '科幻复合效果',
    category: '复合特效',
    description: '赛博朋克风格的复合效果',
    input: {
      effectType: 'composite',
      effectName: 'cyberpunk',
      parameters: {
        steps: [
          { effect: 'color-grade', params: { saturation: 1.3, contrast: 0.2 } },
          { effect: 'glitch', params: { type: 'rgb', intensity: 0.4 } },
          { effect: 'glow', params: { color: '#ff00ff', intensity: 1.0 } },
          { effect: 'scanlines', params: { intensity: 0.15 } },
        ],
      },
    },
    expectedOutput: '赛博朋克风格的处理结果',
    tips: ['霓虹颜色选择粉色和青色', 'glow 和 glitch 配合使用效果佳'],
  },
];

// 特效链模板
export interface EffectChainTemplate {
  id: string;
  name: string;
  description: string;
  chain: {
    effectType: string;
    effectId: string;
    params: Record<string, unknown>;
  }[];
}

export const EFFECT_CHAIN_TEMPLATES: EffectChainTemplate[] = [
  {
    id: 'film-look',
    name: '胶片质感',
    description: '经典胶片电影的视觉风格',
    chain: [
      { effectType: 'filter', effectId: 'vintage', params: { intensity: 0.7, grain: 0.25, vignette: 0.35 } },
      { effectType: 'color', effectId: 'teal-orange', params: { shadowsColor: '#006688', highlightsColor: '#ff8844', intensity: 0.5 } },
    ],
  },
  {
    id: 'cyberpunk-look',
    name: '赛博朋克',
    description: '霓虹灯光的赛博朋克风格',
    chain: [
      { effectType: 'filter', effectId: 'vaporwave', params: { saturation: 1.4, contrast: 0.25, colorShift: 0.3 } },
      { effectType: 'glitch', effectId: 'digital', params: { intensity: 0.3, rgbSplit: 8, scanlines: 0.2 } },
      { effectType: 'glow', effectId: 'neon', params: { color: '#ff00ff', intensity: 0.8, radius: 8 } },
    ],
  },
  {
    id: 'dramatic-look',
    name: '戏剧光影',
    description: '强烈对比的戏剧性画面',
    chain: [
      { effectType: 'color', effectId: 'dramatic', params: { contrast: 0.4, highlights: -0.2, shadows: 0.1 } },
      { effectType: 'glow', effectId: 'inner-glow', params: { intensity: 0.3, color: '#ffffff' } },
      { effectType: 'filter', effectId: 'vignette', params: { intensity: 0.5 } },
    ],
  },
  {
    id: 'ethereal-look',
    name: '梦幻飘逸',
    description: '柔和梦幻的视觉效果',
    chain: [
      { effectType: 'filter', effectId: 'soft', params: { blur: 0.1, brightness: 0.1, saturation: 0.9 } },
      { effectType: 'glow', effectId: 'ethereal', params: { color: '#ffeedd', intensity: 0.5, radius: 15 } },
      { effectType: 'color', effectId: 'warm', params: { temperature: 0.15, tint: 0.05 } },
    ],
  },
];

// 常用参数组合
export const PARAMETER_PRESETS = {
  particle: {
    subtle: { intensity: 0.3, count: 50, speed: 1 },
    moderate: { intensity: 0.6, count: 150, speed: 3 },
    intense: { intensity: 1.0, count: 300, speed: 6 },
  },
  glitch: {
    subtle: { intensity: 0.2, rgbSplit: 3, scanlines: 0.1 },
    moderate: { intensity: 0.5, rgbSplit: 8, scanlines: 0.3 },
    intense: { intensity: 0.9, rgbSplit: 15, scanlines: 0.6 },
  },
  glow: {
    subtle: { intensity: 0.5, radius: 5, threshold: 0.7 },
    moderate: { intensity: 1.0, radius: 10, threshold: 0.5 },
    intense: { intensity: 2.0, radius: 20, threshold: 0.3 },
  },
};

export default {
  EFFECT_PROMPTS,
  EFFECT_CHAIN_TEMPLATES,
  PARAMETER_PRESETS,
};
