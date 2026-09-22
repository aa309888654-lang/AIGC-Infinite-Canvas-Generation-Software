export type MaterialWorkflowType = 'image' | 'reference-pair' | 'intro';

export interface CanvasMaterialPreset {
  id: string;
  marketplaceId: string;
  aicgWorkflowId: string;
  name: string;
  description: string;
  marketplaceCategory: string;
  workflowCategory: 'image' | 'video' | 'tool';
  scene: string;
  tags: string[];
  coverTone: 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose' | 'blue';
  workflowType: MaterialWorkflowType;
  inputCount: 1 | 2;
  resourcePackageId: string;
  resourceDir: string;
  publicResourceUrl: string;
  sourceFolder: string;
  workflowFiles: string[];
  loraFiles: string[];
  customNodeDirs?: string[];
  thumbnailUrl?: string;
  promptTemplate: string;
  promptOptions?: string[];
  defaultParams: {
    modelId: string;
    modelProvider: string;
    generationMode: string;
    imageSize?: string;
    aspectRatio?: string;
    resolution?: string;
    duration?: number;
    cameraMovement?: string;
  };
  notes?: string[];
}

const MATERIAL_BASE_URL = '/workflow-marketplace/canvas-materials';
const MARKET_CATEGORY = '官方素材预设';

const lightDirections = [
  '前方',
  '左前方',
  '左方',
  '左后方',
  '后方',
  '右后方',
  '右方',
  '右前方',
  '上方',
  '下方',
] as const;

const cameraTransforms = [
  '将镜头向前移动',
  '将镜头向左移动',
  '将镜头向右移动',
  '将镜头向下移动',
  '将镜头向左旋转45度',
  '将镜头向右旋转45度',
  '将镜头转为俯视',
  '将镜头转为广角镜头',
  '将镜头转为特写镜头',
] as const;

const qwenImageDefaults = {
  modelId: 'qwen-edit-2509',
  modelProvider: 'comfyui',
  generationMode: 'image_to_image',
  imageSize: '2K',
  aspectRatio: 'auto',
};

const qwenIntroDefaults = {
  modelId: 'qwen-edit-2509',
  modelProvider: 'comfyui',
  generationMode: 'image_to_video',
  imageSize: '2K',
  aspectRatio: '16:9',
  resolution: '1080p',
  duration: 4,
  cameraMovement: 'auto',
};

const packageUrl = (packageId: string) => `${MATERIAL_BASE_URL}/${packageId}`;

export const CANVAS_MATERIAL_PRESETS: CanvasMaterialPreset[] = [
  {
    id: 'qwen-edit-original-direct',
    marketplaceId: 'official-material-qwen-edit-original-direct',
    aicgWorkflowId: 'material-qwen-edit-original-direct',
    name: 'Qwen-Edit · 原图直出',
    description: '保留原图结构与主体，使用 Qwen-Edit-2509 做稳定图生图直出。',
    marketplaceCategory: MARKET_CATEGORY,
    workflowCategory: 'image',
    scene: '图片直出',
    tags: ['Qwen-Edit', '原图直出', '图生图', '图片节点'],
    coverTone: 'cyan',
    workflowType: 'image',
    inputCount: 1,
    resourcePackageId: 'qwen-4k-direct',
    resourceDir: 'public/workflow-marketplace/canvas-materials/qwen-4k-direct',
    publicResourceUrl: packageUrl('qwen-4k-direct'),
    sourceFolder: 'H:/画布素材/25-12-20-直出4K',
    workflowFiles: ['Qwen-Edit-2509-原图直出.json'],
    loraFiles: [],
    customNodeDirs: [
      'custom_nodes/ComfyUI-Qwen-Image-Integrated-KSampler',
    ],
    thumbnailUrl: `${packageUrl('qwen-4k-direct')}/custom_nodes/ComfyUI-Qwen-Image-Integrated-KSampler/images/1-1.png`,
    promptTemplate: '保持主体、构图和材质一致，对输入图片进行高质量直出增强。',
    defaultParams: {
      ...qwenImageDefaults,
      imageSize: '4K',
    },
    notes: ['依赖 Qwen Image Integrated KSampler 自定义节点。'],
  },
  {
    id: 'qwen-edit-multifunction',
    marketplaceId: 'official-material-qwen-edit-multifunction',
    aicgWorkflowId: 'material-qwen-edit-multifunction',
    name: 'Qwen-Edit · 多功能合集',
    description: '整合参考图、局部处理、透视修正、产品图增强等 Qwen-Edit 常用能力。',
    marketplaceCategory: MARKET_CATEGORY,
    workflowCategory: 'image',
    scene: '多功能图片处理',
    tags: ['Qwen-Edit', '多功能', '参考图', '局部重绘'],
    coverTone: 'violet',
    workflowType: 'reference-pair',
    inputCount: 2,
    resourcePackageId: 'qwen-4k-direct',
    resourceDir: 'public/workflow-marketplace/canvas-materials/qwen-4k-direct',
    publicResourceUrl: packageUrl('qwen-4k-direct'),
    sourceFolder: 'H:/画布素材/25-12-20-直出4K',
    workflowFiles: ['Qwen-Edit-2509-多功能合集 (1).json'],
    loraFiles: [],
    customNodeDirs: [
      'custom_nodes/ComfyUI-Qwen-Image-Integrated-KSampler',
    ],
    thumbnailUrl: `${packageUrl('qwen-4k-direct')}/custom_nodes/ComfyUI-Qwen-Image-Integrated-KSampler/images/2-1.png`,
    promptTemplate: '参考图2的结构、色调或材质信息，对图1进行定向编辑。',
    promptOptions: ['参考图编辑', '局部重绘', '产品透视纠正', '材质合成', '多参考融合'],
    defaultParams: qwenImageDefaults,
  },
  {
    id: 'z-image-4k-direct',
    marketplaceId: 'official-material-z-image-4k-direct',
    aicgWorkflowId: 'material-z-image-4k-direct',
    name: 'Z-Image · 直出4K',
    description: '面向 4K 输出的 Z-Image 直出工作流，适合成片关键帧和高清封面。',
    marketplaceCategory: MARKET_CATEGORY,
    workflowCategory: 'image',
    scene: '4K高清输出',
    tags: ['Z-Image', '4K', '高清', '直出'],
    coverTone: 'blue',
    workflowType: 'image',
    inputCount: 1,
    resourcePackageId: 'qwen-4k-direct',
    resourceDir: 'public/workflow-marketplace/canvas-materials/qwen-4k-direct',
    publicResourceUrl: packageUrl('qwen-4k-direct'),
    sourceFolder: 'H:/画布素材/25-12-20-直出4K',
    workflowFiles: ['Z-Image-直出4K.json'],
    loraFiles: [],
    customNodeDirs: ['custom_nodes/ComfyUI-DyPE'],
    thumbnailUrl: `${packageUrl('qwen-4k-direct')}/custom_nodes/ComfyUI-DyPE/example_workflows/DyPE-ZIT-workflow.webp`,
    promptTemplate: '在保持原始画面主体稳定的基础上，生成 4K 级高清细节。',
    defaultParams: {
      modelId: 'z-image',
      modelProvider: 'comfyui',
      generationMode: 'upscale',
      imageSize: '4K',
      aspectRatio: 'auto',
    },
    notes: ['包含 DyPE 示例工作流和自定义节点。'],
  },
  {
    id: 'qwen-light-transfer',
    marketplaceId: 'official-material-qwen-light-transfer',
    aicgWorkflowId: 'material-qwen-light-transfer',
    name: 'Qwen-Edit · 超强光线迁移',
    description: '移除图1原有光照，并参考图2的光照和色调重新照明。',
    marketplaceCategory: MARKET_CATEGORY,
    workflowCategory: 'image',
    scene: '光影迁移',
    tags: ['光影迁移', '参考色调', '重打光', '图片节点'],
    coverTone: 'amber',
    workflowType: 'reference-pair',
    inputCount: 2,
    resourcePackageId: 'qwen-light-transfer',
    resourceDir: 'public/workflow-marketplace/canvas-materials/qwen-light-transfer',
    publicResourceUrl: packageUrl('qwen-light-transfer'),
    sourceFolder: 'H:/画布素材/25-12-07-Qwen-Edit-2509超强光线迁移',
    workflowFiles: ['拖入comfyui打开工作流.json', 'Qwen-Edit-2509-原图直出.json'],
    loraFiles: ['loras/参考色调.safetensors'],
    thumbnailUrl: `${packageUrl('qwen-light-transfer')}/workflow.webp`,
    promptTemplate: '参考色调，移除图1原有的光照并参考图2的光照和色调对图1重新照明。',
    defaultParams: qwenImageDefaults,
  },
  {
    id: 'qwen-shadow-removal',
    marketplaceId: 'official-material-qwen-shadow-removal',
    aicgWorkflowId: 'material-qwen-shadow-removal',
    name: 'Qwen-Edit · 移除光影',
    description: '去除素材中的强阴影、高光和复杂投影，得到更干净的后续处理底图。',
    marketplaceCategory: MARKET_CATEGORY,
    workflowCategory: 'image',
    scene: '素材归一化',
    tags: ['去光影', '去高光', '素材清理', '图片节点'],
    coverTone: 'emerald',
    workflowType: 'image',
    inputCount: 1,
    resourcePackageId: 'qwen-shadow-removal',
    resourceDir: 'public/workflow-marketplace/canvas-materials/qwen-shadow-removal',
    publicResourceUrl: packageUrl('qwen-shadow-removal'),
    sourceFolder: 'H:/画布素材/251108-Qwen-Edit-2509-移除光影',
    workflowFiles: ['Qwen-Edit-2509-原图直出.json'],
    loraFiles: ['移除光影.safetensors'],
    thumbnailUrl: `${packageUrl('qwen-shadow-removal')}/效果图/1.gif`,
    promptTemplate: '移除原图中的阴影、强反光和不均匀光照，保持主体材质与轮廓自然。',
    defaultParams: qwenImageDefaults,
  },
  ...lightDirections.map((direction): CanvasMaterialPreset => ({
    id: `qwen-multi-angle-lighting-${direction}`,
    marketplaceId: `official-material-qwen-multi-angle-lighting-${direction}`,
    aicgWorkflowId: `material-qwen-multi-angle-lighting-${direction}`,
    name: `Qwen-Edit · 多角度灯光 ${direction}`,
    description: `使用亮度贴图为主体重新布光，光源来自${direction}，适合生成片头扫光关键帧。`,
    marketplaceCategory: MARKET_CATEGORY,
    workflowCategory: 'video',
    scene: 'AI片头灯光',
    tags: ['多角度灯光', '重打光', '片头', direction],
    coverTone: 'rose',
    workflowType: 'intro',
    inputCount: 2,
    resourcePackageId: 'qwen-multi-angle-lighting',
    resourceDir: 'public/workflow-marketplace/canvas-materials/qwen-multi-angle-lighting',
    publicResourceUrl: packageUrl('qwen-multi-angle-lighting'),
    sourceFolder: 'H:/画布素材/251117-Qwen-Edit-2509-多角度灯光',
    workflowFiles: ['Multi-Angle-Lighting.json', 'Qwen-Edit-2509-原图直出.json'],
    loraFiles: [
      '11月21日版/多角度灯光-251121.safetensors',
      '11月16日版/多角度灯光-251116.safetensors',
    ],
    thumbnailUrl: `${packageUrl('qwen-multi-angle-lighting')}/11月21日版/1.gif`,
    promptTemplate: `使用图2的亮度贴图对图1重新照明(光源来自${direction})。`,
    promptOptions: [...lightDirections],
    defaultParams: qwenIntroDefaults,
    notes: ['括号内光源方向可在前方、左前方、左方、左后方、后方、右后方、右方、右前方、上方、下方之间切换。'],
  })),
  ...cameraTransforms.map((movement): CanvasMaterialPreset => ({
    id: `qwen-camera-transform-${movement}`,
    marketplaceId: `official-material-qwen-camera-transform-${movement}`,
    aicgWorkflowId: `material-qwen-camera-transform-${movement}`,
    name: `Qwen-Edit · 镜头转换 ${movement.replace('将镜头', '')}`,
    description: `${movement}，用于从单张图派生片头运镜关键帧。`,
    marketplaceCategory: MARKET_CATEGORY,
    workflowCategory: 'video',
    scene: 'AI片头运镜',
    tags: ['镜头转换', '多视角', '片头', movement],
    coverTone: 'blue',
    workflowType: 'intro',
    inputCount: 1,
    resourcePackageId: 'qwen-camera-transform',
    resourceDir: 'public/workflow-marketplace/canvas-materials/qwen-camera-transform',
    publicResourceUrl: packageUrl('qwen-camera-transform'),
    sourceFolder: 'H:/画布素材/2510310-Qwen-Edit-2509多视角转化Lora',
    workflowFiles: ['Qwen-Edit-2509-原图直出.json', '提示词.txt'],
    loraFiles: ['loras/镜头转换.safetensors'],
    thumbnailUrl: `${packageUrl('qwen-camera-transform')}/效果图.jpg`,
    promptTemplate: movement,
    promptOptions: [...cameraTransforms],
    defaultParams: {
      ...qwenIntroDefaults,
      cameraMovement: movement,
    },
    notes: ['原包说明：PNG 拖入 ComfyUI 可打开工作流。'],
  })),
];

export function getCanvasMaterialPreset(id: string): CanvasMaterialPreset | undefined {
  return CANVAS_MATERIAL_PRESETS.find((preset) => preset.id === id);
}
