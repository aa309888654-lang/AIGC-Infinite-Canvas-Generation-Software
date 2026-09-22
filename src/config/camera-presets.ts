/**
 * 运镜控制预设配置
 * 参考 Liblib TV 无限画布的运镜预设
 */

export interface CameraPreset {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  prompt: string;
  icon?: string;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  // ========== 基础运镜 ==========
  {
    id: 'push-in',
    name: '推镜头',
    nameEn: 'Push In',
    description: '特写推进',
    prompt: 'slow push-in, zooming towards subject',
  },
  {
    id: 'pull-out',
    name: '拉镜头',
    nameEn: 'Pull Out',
    description: '快速拉远',
    prompt: 'fast pull-out, revealing surroundings',
  },
  {
    id: 'pan-left',
    name: '左摇',
    nameEn: 'Pan Left',
    description: '向左摇镜',
    prompt: 'pan left, scanning left side',
  },
  {
    id: 'pan-right',
    name: '右摇',
    nameEn: 'Pan Right',
    description: '向右摇镜',
    prompt: 'pan right, scanning right side',
  },
  {
    id: 'tilt-up',
    name: '上摇',
    nameEn: 'Tilt Up',
    description: '向上倾斜',
    prompt: 'tilt up, looking up',
  },
  {
    id: 'tilt-down',
    name: '下摇',
    nameEn: 'Tilt Down',
    description: '向下倾斜',
    prompt: 'tilt down, looking down',
  },

  // ========== 高级运镜 ==========
  {
    id: 'dolly-zoom',
    name: '希区柯克变焦',
    nameEn: 'Dolly Zoom',
    description: '背景扭曲效果',
    prompt: 'dolly zoom, Vertigo effect, background warping',
  },
  {
    id: 'orbit-360',
    name: '360度环绕',
    nameEn: '360 Orbit',
    description: '全方位旋转',
    prompt: '360-degree orbit, seamless rotation around subject',
  },
  {
    id: 'low-angle',
    name: '低角度跟拍',
    nameEn: 'Low Angle',
    description: '仰视视角',
    prompt: 'low angle tracking shot, ground level movement',
  },
  {
    id: 'high-angle',
    name: '鸟瞰视角',
    nameEn: 'High Angle',
    description: '俯视全景',
    prompt: "bird's eye view, top-down perspective",
  },
  {
    id: 'pov',
    name: '主观视点',
    nameEn: 'POV',
    description: '第一人称',
    prompt: 'first person perspective, POV shot',
  },
  {
    id: 'dutch-angle',
    name: '荷兰式倾斜',
    nameEn: 'Dutch Angle',
    description: '倾斜构图',
    prompt: 'Dutch angle, tilted horizon, dramatic',
  },

  // ========== 动态运镜 ==========
  {
    id: 'fly-through',
    name: '穿梭镜头',
    nameEn: 'Fly Through',
    description: '穿越狭窄空间',
    prompt: 'fly-through, passing through narrow spaces',
  },
  {
    id: 'crane-up',
    name: '摇臂俯拍',
    nameEn: 'Crane Up',
    description: '上升俯视',
    prompt: 'jib crane shot, sweeping motion from above',
  },
  {
    id: 'crane-down',
    name: '摇臂仰拍',
    nameEn: 'Crane Down',
    description: '下降仰视',
    prompt: 'crane down shot, rising from ground',
  },
  {
    id: 'spiral-up',
    name: '螺旋上升',
    nameEn: 'Spiral Up',
    description: '旋转上升',
    prompt: 'spiral upward movement, dizzying perspective',
  },
  {
    id: 'diving-shot',
    name: '俯冲追击',
    nameEn: 'Diving Shot',
    description: '高速俯冲',
    prompt: 'diving chase shot, high speed descent',
  },

  // ========== 特效运镜 ==========
  {
    id: 'bullet-time',
    name: '子弹时间',
    nameEn: 'Bullet Time',
    description: '时间凝固',
    prompt: 'bullet time orbit, frozen moment, slow motion',
  },
  {
    id: 'hyperlapse',
    name: '延时动感',
    nameEn: 'Hyperlapse',
    description: '快节奏穿越',
    prompt: 'hyper-lapse movement, fast forward through time',
  },
  {
    id: 'rack-focus',
    name: '焦点变换',
    nameEn: 'Rack Focus',
    description: '焦点切换',
    prompt: 'rack focus, shifting attention between subjects',
  },
  {
    id: 'zoom-in-fast',
    name: '快速推镜头',
    nameEn: 'Fast Zoom In',
    description: '快速聚焦',
    prompt: 'fast push-in, dramatic focus on subject',
  },
  {
    id: 'zoom-out-fast',
    name: '快速拉远',
    nameEn: 'Fast Zoom Out',
    description: '快速展开',
    prompt: 'fast pull-out, revealing the environment quickly',
  },
  {
    id: 'slow-pan',
    name: '慢速平移',
    nameEn: 'Slow Pan',
    description: '缓慢扫视',
    prompt: 'slow cinematic pan, scanning the scene',
  },
  {
    id: 'dynamic-zoom',
    name: '动态变焦',
    nameEn: 'Dynamic Zoom',
    description: '持续缩放',
    prompt: 'dynamic zoom, changing focal length during movement',
  },
  {
    id: 'tracking-shot',
    name: '追踪镜头',
    nameEn: 'Tracking Shot',
    description: '跟拍主体',
    prompt: 'dynamic tracking, matching subject speed',
  },
  {
    id: 'aerial-flyover',
    name: '航拍掠过',
    nameEn: 'Aerial Flyover',
    description: '高空掠过',
    prompt: 'aerial flyover, drone perspective sweeping across landscape',
  },
  {
    id: 'macro-movement',
    name: '微观穿梭',
    nameEn: 'Macro Movement',
    description: '微距移动',
    prompt: 'macro fly-through, moving through tiny details',
  },
];

// 按类别分组
export const CAMERA_PRESET_CATEGORIES = {
  basic: {
    name: '基础运镜',
    presets: ['push-in', 'pull-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down'],
  },
  advanced: {
    name: '高级运镜',
    presets: ['dolly-zoom', 'orbit-360', 'low-angle', 'high-angle', 'pov', 'dutch-angle'],
  },
  dynamic: {
    name: '动态运镜',
    presets: ['fly-through', 'crane-up', 'crane-down', 'spiral-up', 'diving-shot'],
  },
  effects: {
    name: '特效运镜',
    presets: ['bullet-time', 'hyperlapse', 'rack-focus', 'zoom-in-fast', 'zoom-out-fast', 'slow-pan', 'dynamic-zoom', 'tracking-shot', 'aerial-flyover', 'macro-movement'],
  },
};

// 获取预设提示词
export const getCameraPrompt = (presetId: string): string => {
  const preset = CAMERA_PRESETS.find(p => p.id === presetId);
  return preset?.prompt || '';
};

// 获取所有预设名称（用于搜索）
export const getCameraPresetNames = (): { id: string; name: string }[] => {
  return CAMERA_PRESETS.map(p => ({ id: p.id, name: p.name }));
};
