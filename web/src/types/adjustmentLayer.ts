export type AdjustmentLayerType = 'brightness' | 'contrast' | 'saturation' | 'hue' | 'temperature' | 'tint' | 'exposure' | 'gamma' | 'sharpness' | 'blur' | 'vignette' | 'grain' | 'noise' | 'colorLUT' | 'custom';

// 调整参数值类型
export type AdjustmentValue = number | string | boolean;

export interface AdjustmentParameter {
  id: string;
  name: string;
  type: 'number' | 'color' | 'select' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  default: AdjustmentValue;
  options?: string[];
  unit?: string;
}

export interface AdjustmentEffect {
  id: string;
  type: AdjustmentLayerType;
  enabled: boolean;
  parameters: Record<string, AdjustmentValue>;
  intensity: number;
}

export interface AdjustmentLayerDefinition {
  type: AdjustmentLayerType;
  name: string;
  description: string;
  icon: string;
  category: 'color' | 'blur' | 'stylize' | 'correction';
  parameters: AdjustmentParameter[];
  defaultValues: Record<string, AdjustmentValue>;
}

export const ADJUSTMENT_LAYERS: Record<AdjustmentLayerType, AdjustmentLayerDefinition> = {
  brightness: {
    type: 'brightness',
    name: '亮度',
    description: '调整图像的明亮程度',
    icon: '☀️',
    category: 'color',
    parameters: [
      { id: 'value', name: '亮度', type: 'number', min: -100, max: 100, step: 1, default: 0, unit: '%' },
    ],
    defaultValues: { value: 0 },
  },
  contrast: {
    type: 'contrast',
    name: '对比度',
    description: '调整图像明暗对比',
    icon: '🎨',
    category: 'color',
    parameters: [
      { id: 'value', name: '对比度', type: 'number', min: -100, max: 100, step: 1, default: 0, unit: '%' },
    ],
    defaultValues: { value: 0 },
  },
  saturation: {
    type: 'saturation',
    name: '饱和度',
    description: '调整颜色鲜艳程度',
    icon: '🌈',
    category: 'color',
    parameters: [
      { id: 'value', name: '饱和度', type: 'number', min: -100, max: 100, step: 1, default: 0, unit: '%' },
    ],
    defaultValues: { value: 0 },
  },
  hue: {
    type: 'hue',
    name: '色相',
    description: '调整图像色调',
    icon: '🎨',
    category: 'color',
    parameters: [
      { id: 'value', name: '色相', type: 'number', min: -180, max: 180, step: 1, default: 0, unit: '°' },
    ],
    defaultValues: { value: 0 },
  },
  temperature: {
    type: 'temperature',
    name: '色温',
    description: '调整图像冷暖色调',
    icon: '🌡️',
    category: 'color',
    parameters: [
      { id: 'value', name: '色温', type: 'number', min: -100, max: 100, step: 1, default: 0, unit: 'K' },
    ],
    defaultValues: { value: 0 },
  },
  tint: {
    type: 'tint',
    name: '色调',
    description: '调整绿色/洋红色偏移',
    icon: '🎭',
    category: 'color',
    parameters: [
      { id: 'value', name: '色调', type: 'number', min: -100, max: 100, step: 1, default: 0, unit: '' },
    ],
    defaultValues: { value: 0 },
  },
  exposure: {
    type: 'exposure',
    name: '曝光度',
    description: '模拟相机曝光调整',
    icon: '📷',
    category: 'correction',
    parameters: [
      { id: 'value', name: '曝光', type: 'number', min: -5, max: 5, step: 0.1, default: 0, unit: 'EV' },
    ],
    defaultValues: { value: 0 },
  },
  gamma: {
    type: 'gamma',
    name: '伽马',
    description: '调整中间调亮度',
    icon: '📊',
    category: 'correction',
    parameters: [
      { id: 'value', name: '伽马', type: 'number', min: 0.2, max: 2.5, step: 0.01, default: 1 },
    ],
    defaultValues: { value: 1 },
  },
  sharpness: {
    type: 'sharpness',
    name: '锐化',
    description: '增强图像边缘清晰度',
    icon: '🔪',
    category: 'correction',
    parameters: [
      { id: 'value', name: '锐化', type: 'number', min: 0, max: 100, step: 1, default: 0, unit: '%' },
      { id: 'radius', name: '半径', type: 'number', min: 0.5, max: 3, step: 0.1, default: 1, unit: 'px' },
    ],
    defaultValues: { value: 0, radius: 1 },
  },
  blur: {
    type: 'blur',
    name: '模糊',
    description: '对图像进行模糊处理',
    icon: '🌫️',
    category: 'blur',
    parameters: [
      { id: 'value', name: '模糊', type: 'number', min: 0, max: 100, step: 1, default: 0, unit: 'px' },
      { id: 'type', name: '类型', type: 'select', default: 'gaussian', options: ['gaussian', 'box', 'motion', 'radial'] },
    ],
    defaultValues: { value: 0, type: 'gaussian' },
  },
  vignette: {
    type: 'vignette',
    name: '暗角',
    description: '添加边缘暗化效果',
    icon: '🔘',
    category: 'stylize',
    parameters: [
      { id: 'intensity', name: '强度', type: 'number', min: 0, max: 100, step: 1, default: 0, unit: '%' },
      { id: 'radius', name: '半径', type: 'number', min: 25, max: 100, step: 1, default: 50, unit: '%' },
      { id: 'softness', name: '柔和度', type: 'number', min: 0, max: 100, step: 1, default: 50, unit: '%' },
    ],
    defaultValues: { intensity: 0, radius: 50, softness: 50 },
  },
  grain: {
    type: 'grain',
    name: '颗粒',
    description: '添加胶片颗粒效果',
    icon: '🎞️',
    category: 'stylize',
    parameters: [
      { id: 'amount', name: '数量', type: 'number', min: 0, max: 100, step: 1, default: 0, unit: '%' },
      { id: 'size', name: '大小', type: 'number', min: 1, max: 10, step: 0.5, default: 2, unit: '' },
    ],
    defaultValues: { amount: 0, size: 2 },
  },
  noise: {
    type: 'noise',
    name: '噪点',
    description: '添加数字噪点',
    icon: '📺',
    category: 'stylize',
    parameters: [
      { id: 'amount', name: '噪点量', type: 'number', min: 0, max: 100, step: 1, default: 0, unit: '%' },
      { id: 'monochrome', name: '单色', type: 'boolean', default: false },
    ],
    defaultValues: { amount: 0, monochrome: false },
  },
  colorLUT: {
    type: 'colorLUT',
    name: '颜色查找表',
    description: '应用预设颜色风格',
    icon: '🎬',
    category: 'stylize',
    parameters: [
      { id: 'preset', name: '预设', type: 'select', default: 'none', options: ['none', 'cinema', 'vintage', 'noir', 'warm', 'cool', 'high-contrast', 'fade'] },
    ],
    defaultValues: { preset: 'none' },
  },
  custom: {
    type: 'custom',
    name: '自定义',
    description: '创建自定义调整',
    icon: '⚙️',
    category: 'correction',
    parameters: [],
    defaultValues: {},
  },
};

export const ADJUSTMENT_CATEGORIES = [
  { id: 'color', name: '色彩调整', icon: '🎨' },
  { id: 'correction', name: '校正', icon: '🔧' },
  { id: 'blur', name: '模糊', icon: '🌫️' },
  { id: 'stylize', name: '风格化', icon: '✨' },
];

export function getAdjustmentsByCategory(category: string): AdjustmentLayerDefinition[] {
  return Object.values(ADJUSTMENT_LAYERS).filter(adj => adj.category === category);
}

export function createAdjustmentEffect(type: AdjustmentLayerType): AdjustmentEffect {
  const definition = ADJUSTMENT_LAYERS[type];
  return {
    id: `adjust-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    enabled: true,
    parameters: { ...definition.defaultValues },
    intensity: 100,
  };
}
