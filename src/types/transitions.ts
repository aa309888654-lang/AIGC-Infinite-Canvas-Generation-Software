export type TransitionType =
  | 'cut'
  | 'fade'
  | 'dissolve'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'blur'
  | 'pixelate'
  | 'cross-zoom'
  | 'flash'
  | 'dip-to-black'
  | 'dip-to-white'
  | 'smooth-cut';

export interface TransitionParameter {
  name: string;
  type: 'number' | 'select' | 'color' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: string[];
}

export interface TransitionDefinition {
  type: TransitionType;
  name: string;
  description: string;
  icon: string;
  category: 'basic' | 'wipe' | 'slide' | 'zoom' | 'effect' | 'advanced';
  parameters: TransitionParameter[];
  duration: {
    min: number;
    max: number;
    default: number;
  };
}

export const TRANSITIONS: Record<TransitionType, TransitionDefinition> = {
  cut: {
    type: 'cut',
    name: '直接切换',
    description: '瞬间切换，无过渡效果',
    icon: '✂️',
    category: 'basic',
    parameters: [],
    duration: { min: 0, max: 0, default: 0 },
  },
  fade: {
    type: 'fade',
    name: '淡入淡出',
    description: '渐变透明度实现柔和过渡',
    icon: '🌫️',
    category: 'basic',
    parameters: [
      {
        name: 'easing',
        type: 'select',
        default: 'ease-in-out',
        options: ['linear', 'ease-in', 'ease-out', 'ease-in-out'],
      },
    ],
    duration: { min: 0.1, max: 3, default: 0.5 },
  },
  dissolve: {
    type: 'dissolve',
    name: '溶解',
    description: '模拟电影胶片的溶解效果',
    icon: '💫',
    category: 'basic',
    parameters: [
      {
        name: 'pattern',
        type: 'select',
        default: 'random',
        options: ['random', 'radial', 'horizontal', 'vertical'],
      },
    ],
    duration: { min: 0.2, max: 3, default: 1 },
  },
  'wipe-left': {
    type: 'wipe-left',
    name: '向左擦除',
    description: '从右向左擦拭过渡',
    icon: '◀️',
    category: 'wipe',
    parameters: [
      {
        name: 'softness',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
        default: 0,
      },
    ],
    duration: { min: 0.2, max: 3, default: 0.5 },
  },
  'wipe-right': {
    type: 'wipe-right',
    name: '向右擦除',
    description: '从左向右擦拭过渡',
    icon: '▶️',
    category: 'wipe',
    parameters: [
      {
        name: 'softness',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
        default: 0,
      },
    ],
    duration: { min: 0.2, max: 3, default: 0.5 },
  },
  'wipe-up': {
    type: 'wipe-up',
    name: '向上擦除',
    description: '从下向上擦拭过渡',
    icon: '🔼',
    category: 'wipe',
    parameters: [
      {
        name: 'softness',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
        default: 0,
      },
    ],
    duration: { min: 0.2, max: 3, default: 0.5 },
  },
  'wipe-down': {
    type: 'wipe-down',
    name: '向下擦除',
    description: '从上向下擦拭过渡',
    icon: '🔽',
    category: 'wipe',
    parameters: [
      {
        name: 'softness',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
        default: 0,
      },
    ],
    duration: { min: 0.2, max: 3, default: 0.5 },
  },
  'slide-left': {
    type: 'slide-left',
    name: '向左滑入',
    description: '前一个场景向左滑出，后一个滑入',
    icon: '⬅️',
    category: 'slide',
    parameters: [
      {
        name: 'bounce',
        type: 'boolean',
        default: false,
      },
    ],
    duration: { min: 0.2, max: 2, default: 0.5 },
  },
  'slide-right': {
    type: 'slide-right',
    name: '向右滑入',
    description: '前一个场景向右滑出，后一个滑入',
    icon: '➡️',
    category: 'slide',
    parameters: [
      {
        name: 'bounce',
        type: 'boolean',
        default: false,
      },
    ],
    duration: { min: 0.2, max: 2, default: 0.5 },
  },
  'zoom-in': {
    type: 'zoom-in',
    name: '放大过渡',
    description: '放大前一个场景，后一个缩小出现',
    icon: '🔍+',
    category: 'zoom',
    parameters: [
      {
        name: 'zoomLevel',
        type: 'number',
        min: 1.2,
        max: 3,
        step: 0.1,
        default: 2,
      },
    ],
    duration: { min: 0.3, max: 2, default: 0.6 },
  },
  'zoom-out': {
    type: 'zoom-out',
    name: '缩小过渡',
    description: '缩小前一个场景，后一个放大出现',
    icon: '🔍-',
    category: 'zoom',
    parameters: [
      {
        name: 'zoomLevel',
        type: 'number',
        min: 0.3,
        max: 0.8,
        step: 0.1,
        default: 0.5,
      },
    ],
    duration: { min: 0.3, max: 2, default: 0.6 },
  },
  blur: {
    type: 'blur',
    name: '模糊过渡',
    description: '模糊过渡效果',
    icon: '🌫️',
    category: 'effect',
    parameters: [
      {
        name: 'blurAmount',
        type: 'number',
        min: 0,
        max: 20,
        step: 1,
        default: 10,
      },
    ],
    duration: { min: 0.3, max: 3, default: 0.8 },
  },
  pixelate: {
    type: 'pixelate',
    name: '像素化过渡',
    description: '像素化马赛克效果',
    icon: '🟦',
    category: 'effect',
    parameters: [
      {
        name: 'pixelSize',
        type: 'number',
        min: 5,
        max: 50,
        step: 1,
        default: 20,
      },
    ],
    duration: { min: 0.3, max: 3, default: 0.8 },
  },
  'cross-zoom': {
    type: 'cross-zoom',
    name: '交叉缩放',
    description: 'Premiere Pro 经典效果',
    icon: '🔄',
    category: 'advanced',
    parameters: [
      {
        name: 'zoomLevel',
        type: 'number',
        min: 1.2,
        max: 3,
        step: 0.1,
        default: 1.5,
      },
      {
        name: 'blurAmount',
        type: 'number',
        min: 0,
        max: 10,
        step: 1,
        default: 5,
      },
    ],
    duration: { min: 0.3, max: 2, default: 0.6 },
  },
  flash: {
    type: 'flash',
    name: '闪光过渡',
    description: '白色闪光效果',
    icon: '⚡',
    category: 'advanced',
    parameters: [
      {
        name: 'flashColor',
        type: 'color',
        default: '#ffffff',
      },
      {
        name: 'flashCount',
        type: 'number',
        min: 1,
        max: 5,
        step: 1,
        default: 1,
      },
    ],
    duration: { min: 0.1, max: 1, default: 0.3 },
  },
  'dip-to-black': {
    type: 'dip-to-black',
    name: '闪黑过渡',
    description: '过渡到黑色再出现',
    icon: '⬛',
    category: 'advanced',
    parameters: [],
    duration: { min: 0.2, max: 2, default: 0.5 },
  },
  'dip-to-white': {
    type: 'dip-to-white',
    name: '闪白过渡',
    description: '过渡到白色再出现',
    icon: '⬜',
    category: 'advanced',
    parameters: [],
    duration: { min: 0.2, max: 2, default: 0.5 },
  },
  'smooth-cut': {
    type: 'smooth-cut',
    name: '平滑切换',
    description: '快速淡入淡出模拟平滑切换',
    icon: '🎬',
    category: 'advanced',
    parameters: [
      {
        name: 'fadeDuration',
        type: 'number',
        min: 0.05,
        max: 0.3,
        step: 0.01,
        default: 0.1,
      },
    ],
    duration: { min: 0, max: 0, default: 0 },
  },
};

export const TRANSITION_CATEGORIES = [
  { id: 'basic', name: '基础转场', icon: '🎯' },
  { id: 'wipe', name: '擦除转场', icon: '🧹' },
  { id: 'slide', name: '滑动转场', icon: '↔️' },
  { id: 'zoom', name: '缩放转场', icon: '🔍' },
  { id: 'effect', name: '特效转场', icon: '✨' },
  { id: 'advanced', name: '高级转场', icon: '🚀' },
];

export function getTransitionsByCategory(category: string): TransitionDefinition[] {
  return Object.values(TRANSITIONS).filter(t => t.category === category);
}

export function getTransitionByType(type: TransitionType): TransitionDefinition | undefined {
  return TRANSITIONS[type];
}
