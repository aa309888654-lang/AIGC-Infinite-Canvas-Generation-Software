/**
 * 预设模板数据
 * 包含12个专业视频编辑模板 — 国际水准预设体系
 */

export interface Transition {
  type: string;
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface ColorAdjustment {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  hue?: number;
  exposure?: number;
  highlights?: number;
  shadows?: number;
  fade?: number;
}

export interface VisualEffect {
  type: string;
  intensity: number;
  parameters?: Record<string, number>;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: boolean;
  gradient?: boolean;
}

export interface TemplateSettings {
  transitions: Transition[];
  filter?: string;
  filterIntensity?: number;
  colorAdjustment: ColorAdjustment;
  visualEffects: VisualEffect[];
  textStyles: TextStyle;
  speedCurve: string;
  speed: number;
  audio?: {
    bgmPreset?: string;
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
  };
}

export interface TemplatePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  settings: TemplateSettings;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  relatedIds?: string[];
}

const tx = (type: string, duration: number, direction?: 'left' | 'right' | 'up' | 'down'): Transition => ({
  type, duration, direction,
});

const ca = (overrides: ColorAdjustment = {}): ColorAdjustment => ({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  ...overrides,
});

const vfx = (type: string, intensity: number, parameters?: Record<string, number>): VisualEffect => ({
  type, intensity, parameters,
});

const ts = (overrides: Partial<TextStyle> = {}): TextStyle => ({
  fontFamily: 'Inter',
  fontSize: 48,
  fontWeight: 700,
  color: '#FFFFFF',
  ...overrides,
});

// ============ 12个专业预设模板 ============

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ==================== 1. 电影预告片 ====================
  {
    id: 'cinematic-trailer',
    name: '电影预告片',
    icon: '🎬',
    description: '好莱坞级电影预告片风格，史诗配乐、动态转场、电影色调，适用于大片感内容',
    color: '#E8B86D',
    category: 'film',
    difficulty: 'advanced',
    relatedIds: ['action-montage', 'noir-mystery', 'cinematic', 'film-noir', 'hollywood-blockbuster'],
    settings: {
      transitions: [
        tx('fade', 0.6),
        tx('dip_to_black', 0.5),
        tx('push', 0.4, 'right'),
        tx('smooth_cut', 0.0),
      ],
      filter: 'teal_and_orange',
      filterIntensity: 0.65,
      colorAdjustment: ca({ contrast: 15, saturation: -5, highlights: 10, shadows: -8, fade: 5 }),
      visualEffects: [
        vfx('letterbox', 1.0, { ratio: 2.35 }),
        vfx('grain', 0.08, { size: 1.5 }),
        vfx('vignette', 0.25),
      ],
      textStyles: ts({ fontFamily: 'Playfair Display', fontSize: 56, fontWeight: 900, strokeColor: '#000000', strokeWidth: 2 }),
      speedCurve: 'ease-in-out',
      speed: 1.0,
      audio: { bgmPreset: 'epic-orchestral', volume: 0.85, fadeIn: 2.0, fadeOut: 3.0 },
    },
  },

  // ==================== 2. 社交媒体短视频 ====================
  {
    id: 'social-short',
    name: '社媒快剪',
    icon: '📱',
    description: 'TikTok/Reels/Shorts 适配，竖屏节奏卡点，字幕强调，高饱和色彩',
    color: '#FF0050',
    category: 'social',
    difficulty: 'beginner',
    relatedIds: ['music-video', 'travel-vlog', 'neon-cyberpunk'],
    settings: {
      transitions: [
        tx('zoom', 0.2),
        tx('slide', 0.25, 'up'),
        tx('flash', 0.15),
        tx('smooth_cut', 0.0),
      ],
      filter: 'vivid',
      filterIntensity: 0.7,
      colorAdjustment: ca({ saturation: 20, contrast: 10, brightness: 5, highlights: 10, shadows: -5 }),
      visualEffects: [
        vfx('motion_blur', 0.3),
        vfx('chromatic_aberration', 0.05),
      ],
      textStyles: ts({ fontFamily: 'Inter', fontSize: 64, fontWeight: 800, color: '#FFFFFF', strokeColor: '#FF0050', strokeWidth: 3, shadow: true }),
      speedCurve: 'ease-out',
      speed: 1.15,
      audio: { bgmPreset: 'trending-pop', volume: 0.9, fadeIn: 0.2, fadeOut: 0.5 },
    },
  },

  // ==================== 3. 音乐视频卡点 ====================
  {
    id: 'music-video',
    name: '节奏卡点',
    icon: '🎵',
    description: '音乐节拍驱动剪辑，Beat同步转场，闪光效果，霓虹色调',
    color: '#9B59B6',
    category: 'music',
    difficulty: 'intermediate',
    relatedIds: ['social-short', 'action-montage', 'motion-graphics'],
    settings: {
      transitions: [
        tx('flash', 0.12),
        tx('glitch', 0.15),
        tx('zoom', 0.2),
        tx('smooth_cut', 0.0),
      ],
      filter: 'neon',
      filterIntensity: 0.55,
      colorAdjustment: ca({ saturation: 25, contrast: 18, brightness: 8, hue: 15 }),
      visualEffects: [
        vfx('beat_sync_flash', 0.6),
        vfx('chromatic_aberration', 0.1),
        vfx('radial_blur', 0.15),
      ],
      textStyles: ts({ fontFamily: 'Montserrat', fontSize: 42, fontWeight: 800, color: '#00FF88', strokeColor: '#000', strokeWidth: 2, gradient: true }),
      speedCurve: 'cubic-bezier',
      speed: 1.1,
      audio: { bgmPreset: 'electronic-beat', volume: 0.9, fadeIn: 0.3, fadeOut: 1.0 },
    },
  },

  // ==================== 4. 纪录叙事 ====================
  {
    id: 'doc-narrative',
    name: '纪录叙事',
    icon: '🎙️',
    description: '纪录片风格叙事，Ken Burns效果，暖色胶片感，适合访谈/纪实',
    color: '#C08552',
    category: 'documentary',
    difficulty: 'intermediate',
    relatedIds: ['vintage-film', 'travel-vlog', 'natural-documentary', 'film-photography'],
    settings: {
      transitions: [
        tx('crossfade', 1.0),
        tx('dip_to_white', 0.8),
        tx('smooth_cut', 0.0),
      ],
      filter: 'warm_film',
      filterIntensity: 0.6,
      colorAdjustment: ca({ temperature: 15, contrast: 5, saturation: -10, fade: 10, shadows: 5 }),
      visualEffects: [
        vfx('ken_burns', 0.5, { zoom: 1.1, pan_x: 5, pan_y: 3 }),
        vfx('grain', 0.12, { size: 1.0 }),
        vfx('vignette', 0.3),
      ],
      textStyles: ts({ fontFamily: 'Georgia', fontSize: 36, fontWeight: 400, color: '#F5E6D3' }),
      speedCurve: 'linear',
      speed: 0.9,
      audio: { bgmPreset: 'ambient-piano', volume: 0.55, fadeIn: 3.0, fadeOut: 4.0 },
    },
  },

  // ==================== 5. 商业广告 ====================
  {
    id: 'commercial-ad',
    name: '商业广告',
    icon: '💎',
    description: '高端产品广告，干净画面、高端转场、金属/玻璃质感，LUT调色',
    color: '#2C3E50',
    category: 'commercial',
    difficulty: 'advanced',
    relatedIds: ['tech-reveal', 'product-showcase', 'luxury-watch', 'tech-minimal'],
    settings: {
      transitions: [
        tx('smooth_cut', 0.0),
        tx('push', 0.35, 'left'),
        tx('fade', 0.4),
      ],
      filter: 'commercial_clean',
      filterIntensity: 0.5,
      colorAdjustment: ca({ contrast: 20, saturation: 5, brightness: 8, highlights: 15, shadows: -10, fade: 2 }),
      visualEffects: [
        vfx('sharpness', 0.4),
        vfx('denoise', 0.3),
      ],
      textStyles: ts({ fontFamily: 'Helvetica Neue', fontSize: 52, fontWeight: 600, color: '#FFFFFF', shadow: true }),
      speedCurve: 'ease-in-out',
      speed: 1.05,
      audio: { bgmPreset: 'corporate-ambient', volume: 0.6, fadeIn: 1.5, fadeOut: 2.0 },
    },
  },

  // ==================== 6. 旅行Vlog ====================
  {
    id: 'travel-vlog',
    name: '旅行Vlog',
    icon: '✈️',
    description: '旅行日志风格，快速蒙太奇，航拍穿插，日系轻快调色',
    color: '#1D4ED8',
    category: 'lifestyle',
    difficulty: 'beginner',
    relatedIds: ['social-short', 'doc-narrative', 'aerial-drone', 'golden-hour'],
    settings: {
      transitions: [
        tx('swipe', 0.3, 'right'),
        tx('zoom', 0.25),
        tx('fade', 0.5),
        tx('smooth_cut', 0.0),
      ],
      filter: 'japan_light',
      filterIntensity: 0.5,
      colorAdjustment: ca({ saturation: 15, temperature: -5, brightness: 10, highlights: 8, fade: 8 }),
      visualEffects: [
        vfx('speed_ramp', 0.4),
        vfx('film_burn', 0.1),
      ],
      textStyles: ts({ fontFamily: 'Poppins', fontSize: 40, fontWeight: 700, color: '#FFFFFF', shadow: true }),
      speedCurve: 'ease-out',
      speed: 1.1,
      audio: { bgmPreset: 'tropical-house', volume: 0.75, fadeIn: 1.0, fadeOut: 2.0 },
    },
  },

  // ==================== 7. 复古胶片 ====================
  {
    id: 'vintage-film',
    name: '复古胶片',
    icon: '📽️',
    description: '8mm/16mm 胶片美学，模拟胶片颗粒、漏光、抖动、褪色效果',
    color: '#8B4513',
    category: 'film',
    difficulty: 'intermediate',
    relatedIds: ['doc-narrative', 'film-photography', 'film-noir', 'retro-90s-cel'],
    settings: {
      transitions: [
        tx('film_burn', 0.5),
        tx('fade', 0.8),
        tx('smooth_cut', 0.0),
      ],
      filter: 'super8',
      filterIntensity: 0.75,
      colorAdjustment: ca({ saturation: -20, temperature: 12, contrast: -5, fade: 18, shadows: 8 }),
      visualEffects: [
        vfx('grain', 0.25, { size: 2.0 }),
        vfx('light_leak', 0.15),
        vfx('jitter', 0.08),
        vfx('scratches', 0.1),
        vfx('vignette', 0.35),
      ],
      textStyles: ts({ fontFamily: 'Courier New', fontSize: 32, fontWeight: 400, color: '#F5DEB3', backgroundColor: '#000000', shadow: false }),
      speedCurve: 'linear',
      speed: 1.0,
      audio: { bgmPreset: 'vinyl-jazz', volume: 0.5, fadeIn: 2.0, fadeOut: 3.0 },
    },
  },

  // ==================== 8. 动作蒙太奇 ====================
  {
    id: 'action-montage',
    name: '动作蒙太奇',
    icon: '⚡',
    description: '高强度动作序列，快速节奏、冲击转场、运动模糊、高反差',
    color: '#DC143C',
    category: 'action',
    difficulty: 'advanced',
    relatedIds: ['cinematic-trailer', 'music-video', 'fight-scene', 'dynamic-diagonal'],
    settings: {
      transitions: [
        tx('whip_pan', 0.15, 'right'),
        tx('flash', 0.08),
        tx('glitch', 0.12),
        tx('smooth_cut', 0.0),
      ],
      filter: 'action_contrast',
      filterIntensity: 0.7,
      colorAdjustment: ca({ contrast: 25, saturation: 10, brightness: -3, highlights: 15, shadows: -15 }),
      visualEffects: [
        vfx('motion_blur', 0.45),
        vfx('shake', 0.15, { frequency: 8, amplitude: 3 }),
        vfx('chromatic_aberration', 0.12),
      ],
      textStyles: ts({ fontFamily: 'Anton', fontSize: 72, fontWeight: 900, color: '#FF4444', strokeColor: '#000', strokeWidth: 4, shadow: true }),
      speedCurve: 'cubic-bezier',
      speed: 1.3,
      audio: { bgmPreset: 'intense-action', volume: 0.9, fadeIn: 0.3, fadeOut: 0.8 },
    },
  },

  // ==================== 9. 婚礼纪念 ====================
  {
    id: 'wedding-highlights',
    name: '婚礼纪念',
    icon: '💒',
    description: '浪漫婚礼高光集锦，柔和转场、暖调梦幻、人像柔焦、钢琴配乐',
    color: '#FFB6C1',
    category: 'lifestyle',
    difficulty: 'beginner',
    relatedIds: ['doc-narrative', 'travel-vlog', 'golden-hour', 'misty-dreamscape'],
    settings: {
      transitions: [
        tx('crossfade', 1.2),
        tx('fade', 1.0),
        tx('smooth_cut', 0.0),
      ],
      filter: 'soft_dream',
      filterIntensity: 0.55,
      colorAdjustment: ca({ temperature: 8, saturation: -5, brightness: 10, highlights: 5, shadows: 5, fade: 10 }),
      visualEffects: [
        vfx('soft_focus', 0.25),
        vfx('glow', 0.15, { radius: 3 }),
        vfx('vignette', 0.2),
      ],
      textStyles: ts({ fontFamily: 'Playfair Display', fontSize: 52, fontWeight: 300, color: '#FFF5EE', shadow: true }),
      speedCurve: 'ease-in-out',
      speed: 0.95,
      audio: { bgmPreset: 'romantic-piano', volume: 0.65, fadeIn: 3.0, fadeOut: 5.0 },
    },
  },

  // ==================== 10. 科技产品发布 ====================
  {
    id: 'tech-reveal',
    name: '科技发布',
    icon: '🚀',
    description: 'Apple 风格产品发布，流畅动效、极简构图、白背景、信息图表叠加',
    color: '#007AFF',
    category: 'commercial',
    difficulty: 'advanced',
    relatedIds: ['commercial-ad', 'motion-graphics', 'tech-minimal', 'product-photoreal'],
    settings: {
      transitions: [
        tx('smooth_cut', 0.0),
        tx('push', 0.35, 'up'),
        tx('fade', 0.3),
      ],
      filter: 'clean_white',
      filterIntensity: 0.4,
      colorAdjustment: ca({ contrast: 22, brightness: 12, saturation: -15, highlights: 20, shadows: -5 }),
      visualEffects: [
        vfx('sharpness', 0.5),
        vfx('denoise', 0.4),
      ],
      textStyles: ts({ fontFamily: 'SF Pro Display', fontSize: 48, fontWeight: 600, color: '#1D1D1F', backgroundColor: '#FFFFFF', shadow: false }),
      speedCurve: 'ease-in-out',
      speed: 1.0,
      audio: { bgmPreset: 'tech-minimal', volume: 0.5, fadeIn: 1.0, fadeOut: 1.5 },
    },
  },

  // ==================== 11. 动态图形 ====================
  {
    id: 'motion-graphics',
    name: '动态图形',
    icon: '🎨',
    description: 'Motion Graphics 风格，几何图形、文字动效、流体渐变、标题动画',
    color: '#6C5CE7',
    category: 'animation',
    difficulty: 'intermediate',
    relatedIds: ['tech-reveal', 'music-video', 'abstract-fluid', 'minimalist-fine-art'],
    settings: {
      transitions: [
        tx('morph', 0.4),
        tx('push', 0.3, 'down'),
        tx('fade', 0.25),
        tx('smooth_cut', 0.0),
      ],
      filter: 'geometric',
      filterIntensity: 0.45,
      colorAdjustment: ca({ saturation: 30, contrast: 15, brightness: 10 }),
      visualEffects: [
        vfx('gradient_overlay', 0.35, { angle: 45 }),
        vfx('glow', 0.2),
      ],
      textStyles: ts({ fontFamily: 'Futura', fontSize: 56, fontWeight: 800, color: '#FFFFFF', gradient: true }),
      speedCurve: 'elastic',
      speed: 1.05,
      audio: { bgmPreset: 'synthwave', volume: 0.7, fadeIn: 0.5, fadeOut: 1.0 },
    },
  },

  // ==================== 12. 黑色悬疑 ====================
  {
    id: 'noir-mystery',
    name: '黑色悬疑',
    icon: '🕯️',
    description: 'Film Noir 美学，高反差光影、暗调蓝灰、慢节奏悬疑，适合推理/惊悚',
    color: '#1A1A2E',
    category: 'film',
    difficulty: 'advanced',
    relatedIds: ['cinematic-trailer', 'vintage-film', 'film-noir', 'split-face-drama', 'dark-fantasy-gothic'],
    settings: {
      transitions: [
        tx('dip_to_black', 0.8),
        tx('fade', 1.0),
        tx('smooth_cut', 0.0),
      ],
      filter: 'noir_mono',
      filterIntensity: 0.7,
      colorAdjustment: ca({ saturation: -60, contrast: 25, brightness: -15, highlights: -10, shadows: -25, fade: 5 }),
      visualEffects: [
        vfx('vignette', 0.5),
        vfx('grain', 0.18, { size: 1.8 }),
        vfx('letterbox', 1.0, { ratio: 2.35 }),
        vfx('soft_focus', 0.1),
      ],
      textStyles: ts({ fontFamily: 'Baskerville', fontSize: 44, fontWeight: 400, color: '#C0C0D0', strokeColor: '#000', strokeWidth: 1 }),
      speedCurve: 'linear',
      speed: 0.85,
      audio: { bgmPreset: 'dark-ambient', volume: 0.55, fadeIn: 3.0, fadeOut: 5.0 },
    },
  },
];

// ============ 工具函数 ============

export function getTemplateById(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find(template => template.id === id);
}

export function getTemplatesByCategory(category: string): TemplatePreset[] {
  return TEMPLATE_PRESETS.filter(template => template.category === category);
}

export function getTemplatesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): TemplatePreset[] {
  return TEMPLATE_PRESETS.filter(template => template.difficulty === difficulty);
}

export function getRelatedTemplatePresets(id: string): TemplatePreset[] {
  const preset = getTemplateById(id);
  if (!preset?.relatedIds) return [];
  return preset.relatedIds
    .map(rid => getTemplateById(rid))
    .filter((p): p is TemplatePreset => p !== undefined);
}

export function getAllCategories(): string[] {
  const categories = new Set<string>();
  TEMPLATE_PRESETS.forEach(template => {
    if (template.category) {
      categories.add(template.category);
    }
  });
  return Array.from(categories);
}
