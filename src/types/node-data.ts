/**
 * node-data.ts - 节点数据类型安全
 * 为所有节点类型定义完整的 TypeScript 接口
 */
import { TaskStatus } from './ai-models';
import type { StoryboardOutputMode } from './storyboard-output-mode';

// ========== 基础类型 ==========

/** 任务状态类型 */
export type NodeTaskStatus = TaskStatus;

/** 基础任务接口 */
export interface BaseTask {
  id: string;
  status: NodeTaskStatus;
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: Date;
}

/** 图像任务（带多个结果） */
export interface ImageTask extends BaseTask {
  type: 'image';
  resultUrls?: string[];
  seed?: number;
  generationTime?: number;
}

/** 视频任务 */
export interface VideoTask extends BaseTask {
  type: 'video';
  duration?: number;
}

/** 统一任务类型 */
export type NodeTask = ImageTask | VideoTask;

// ========== 节点数据接口 ==========

/** 节点展开状态接口 */
export interface ExpandableNodeData {
  isExpanded?: boolean;
}

/** 基础节点数据接口 */
export interface BaseNodeData extends ExpandableNodeData {
  type: string;
  label?: string;
}

// ========== 图像生成节点 ==========
export interface ImageGenParams {
  modelProvider: string;
  generationMode: 'text_to_image' | 'image_to_image' | 'reference';
  resolution: string;
  pixelResolution: string;
  quality: string;
  style: string;
  prompt?: string;
  negativePrompt?: string;
  referenceImage?: string;
  startImage?: string;
  endImage?: string;
  cfgScale: number;
  steps: number;
  seed: number;
  aspectRatio: string;
}

export interface ImageGenNodeData extends BaseNodeData {
  type: 'imageGen';
  params: ImageGenParams;
  task?: ImageTask;
  connectedImages?: string[];
  imageUrl?: string;
  resultUrl?: string;
  resultUrls?: string[];
}

// ========== 视频生成节点 ==========
export type VideoGenerationMode = 'text_to_video' | 'image_to_video' | 'first_last_frame' | 'video_to_video';
export type VideoQuality = 'standard' | 'high' | 'ultra';
export type VideoResolution = '16:9' | '9:16' | '1:1' | '4:3' | '21:9' | '4:5';
export type VideoPixelResolution = '720p' | '1080p' | '2K' | '4K';
export type CameraControl = 'fixed' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'rotate_cw' | 'rotate_ccw' | 'dolly' | 'orbit';

export interface VideoGenParams {
  modelProvider: string;
  generationMode: VideoGenerationMode;
  resolution: VideoResolution;
  pixelResolution: VideoPixelResolution;
  duration: number;
  fps: number;
  quality: VideoQuality;
  prompt?: string;
  negativePrompt?: string;
  referenceImage?: string;
  startImage?: string;
  endImage?: string;
  videoInput?: string;
  motionStrength: number;
  cameraControl: CameraControl;
  cameraIntensity: number;
  cfgScale: number;
  steps: number;
  seed: number;
}

export interface VideoGenNodeData extends BaseNodeData {
  type: 'videoGen';
  params: VideoGenParams;
  task?: VideoTask;
}

// ========== 统一 AI 图片/视频入口节点 ==========
export interface AIImageNodeData extends BaseNodeData {
  type: 'aiImage';
  prompt?: string;
  modelId?: string;
  params?: Record<string, unknown>;
  task?: ImageTask | {
    status?: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  };
  imageUrl?: string;
  resultUrl?: string;
  resultUrls?: string[];
}

export interface AIVideoNodeData extends BaseNodeData {
  type: 'aiVideo';
  prompt?: string;
  modelId?: string;
  params?: Record<string, unknown>;
  task?: VideoTask | {
    status?: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  };
  videoUrl?: string;
  thumbnailUrl?: string;
  resultUrl?: string;
}

// ========== 提示词节点 ==========
export interface PromptNodeData extends BaseNodeData {
  type: 'prompt';
  prompt: string;
  negativePrompt?: string;
  optimized?: boolean;
}

// ========== 图像输入节点 ==========
export interface ImageInputNodeData extends BaseNodeData {
  type: 'imageInput';
  imageAssetId?: string;
  thumbnailAssetId?: string;
  imageUrl?: string;
  fileName?: string;
  width?: number;
  height?: number;
  processingMode?: 'none' | 'remove-background' | 'remove-person' | 'extract-subject';
  customBackground?: string;
  edgeFeathering?: number;
  edgeSmoothing?: number;
  originalImageUrl?: string;
  isProcessed?: boolean;
  flipHorizontal?: boolean;
  imageError?: boolean;
}

// ========== 本地智能抠图节点 ==========
export interface LocalMattingNodeData extends BaseNodeData {
  type: 'localMatting';
  imageUrl?: string;
  fileName?: string;
  originalImageUrl?: string;
  resultUrl?: string;
  resultAssetId?: string;
  maskUrl?: string;
  processingMode?: string;
  customBackground?: string;
  edgeFeathering?: number;
  edgeSmoothing?: number;
  isProcessed?: boolean;
  executeRequestedAt?: number;
  autoExecute?: boolean;
  task?: {
    status: 'idle' | 'processing' | 'done' | 'error';
    progress?: number;
    resultUrl?: string;
    error?: string;
  };
}

// ========== 视频超分节点（提升清晰度）==========
export interface VideoUpscaleNodeData extends BaseNodeData {
  type: 'videoUpscale';
  videoUrl?: string;
  receivedVideoUrl?: string;
  resultUrl?: string;
  resultAssetId?: string;
  fileName?: string;
  originalWidth?: number;
  originalHeight?: number;
  targetWidth?: number;
  targetHeight?: number;
  isProcessed?: boolean;
  autoExecute?: boolean;
  task?: {
    status: 'idle' | 'processing' | 'done' | 'error';
    progress?: number;
    resultUrl?: string;
    error?: string;
  };
}

// ========== 视频输入节点 ==========
export interface VideoInputNodeData extends BaseNodeData {
  type: 'videoInput';
  videoAssetId?: string;
  thumbnailAssetId?: string;
  videoUrl?: string;
  fileName?: string;
  startFrame?: number;
  endFrame?: number;
  width?: number;
  height?: number;
  duration?: number;
  isControllerCollapsed?: boolean;
}

// ========== 音频输入节点 ==========
export interface AudioInputNodeData extends BaseNodeData {
  type: 'audioInput';
  audioAssetId?: string;
  audioUrl?: string;
  fileName?: string;
  duration?: number;
  volume?: number;
  playbackRate?: number;
  loop?: boolean;
  waveformData?: number[];
}

// ========== 输出节点 ==========
export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  label?: string;
}

// ========== TextInput 节点 ==========
export interface TextInputNodeData extends BaseNodeData {
  type: 'textInput';
  text: string;
  model?: string;
  variableName?: string;
  task?: {
    status: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  };
}

// ========== AI生成文本节点 ==========
export interface AIGenTextNodeData extends BaseNodeData {
  type: 'aiGenText';
  prompt: string;
  outputText?: string;
  model?: string;
  systemPrompt?: string;
  enableThinking?: boolean;
  variableName?: string;
  task?: {
    status: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  };
}

// ========== 高级函数节点 ==========
export type FunctionType = 'expression' | 'condition' | 'transform' | 'batch';
export type TransformType = 'map' | 'filter' | 'reduce' | 'sort' | 'unique' | 'flatten';
export type OutputFormat = 'auto' | 'string' | 'number' | 'boolean' | 'array' | 'object';
export type ErrorHandling = 'default' | 'throw' | 'fallback';
export type AdvancedStoryboardPanelCount = 9 | 12;

export type ShotSize = 'extreme_long_shot' | 'long_shot' | 'medium_long_shot' | 'medium_shot' | 'medium_close_up' | 'close_up' | 'extreme_close_up';
export type CameraAngle = 'eye_level' | 'low_angle' | 'high_angle' | 'bird_eye' | 'worm_eye' | 'dutch_angle' | 'over_shoulder' | 'aerial';

export const SHOT_SIZE_OPTIONS: { value: ShotSize; label: string }[] = [
  { value: 'extreme_long_shot', label: '大远景' },
  { value: 'long_shot', label: '远景' },
  { value: 'medium_long_shot', label: '中远景' },
  { value: 'medium_shot', label: '中景' },
  { value: 'medium_close_up', label: '中近景' },
  { value: 'close_up', label: '特写' },
  { value: 'extreme_close_up', label: '大特写' },
];

export const CAMERA_ANGLE_OPTIONS: { value: CameraAngle; label: string }[] = [
  { value: 'eye_level', label: '平视' },
  { value: 'low_angle', label: '仰视' },
  { value: 'high_angle', label: '俯视' },
  { value: 'bird_eye', label: '鸟瞰' },
  { value: 'worm_eye', label: '虫视' },
  { value: 'dutch_angle', label: '荷兰角' },
  { value: 'over_shoulder', label: '过肩' },
  { value: 'aerial', label: '航拍' },
];

export interface SceneConfig {
  name: string;
  shotSize?: ShotSize;
  cameraAngle?: CameraAngle;
}

export interface AdvancedFunctionParams {
  functionType: FunctionType;
  expression: string;
  conditionExpression: string;
  trueBranch: string;
  falseBranch: string;
  transformType: TransformType;
  batchExpression: string;
  inputMapping: Record<string, string>;
  outputFormat: OutputFormat;
  errorHandling: ErrorHandling;
  defaultValue: string;
  maxRetries: number;
  cacheResult: boolean;
  cacheTTL: number;
  panelCount?: AdvancedStoryboardPanelCount;
  gridStyle?: string;
  storyTemplate?: string;
  customScenes?: string[];
  sceneConfigs?: SceneConfig[];
  extraPrompt?: string;
  shotTemplate?: string;
  imageModel?: string;
  storyboardRatio?: string;
}

export interface AdvancedFunctionNodeData extends BaseNodeData {
  type: 'advancedFunction';
  params: AdvancedFunctionParams;
  lastResult?: string;
  lastError?: string;
  executionTime?: number;
  imageUrl?: string;
  videoUrl?: string;
  characterLockImageUrl?: string;
  characterLockSourceUrl?: string;
  generatedPrompts?: string[];
  generatedImages?: string[];
}

// ========== 脚本节点 ==========
export interface ScriptScene {
  id: string;
  description: string;
  duration: number;
  shotType: string;
  /** 镜头承担的剧情节拍与叙事目的 */
  beat?: string;
  /** 情绪节拍 */
  emotionalBeat?: string;
  /** 机位角度 */
  cameraAngle?: string;
  cameraMovement: string;
  transition: string;
  /** 主体在镜头中的可执行动作 */
  subjectAction?: string;
  /** 场景与空间关系 */
  environment?: string;
  /** 专业生成提示词 - 包含完整的电影级描述，可直接用于图片/视频生成 */
  professionalPrompt?: string;
  /** 灯光设定 */
  lightingSetup?: string;
  /** 氛围情绪 */
  moodAtmosphere?: string;
  /** 构图指导 */
  compositionGuide?: string;
  /** 色调方案 */
  colorGrading?: string;
  /** 景别深度 */
  depthOfField?: string;
  /** 图像生成负面约束 */
  negativePrompt?: string;
  /** 跨镜头连续性约束 */
  continuity?: {
    screenDirection?: string;
    characterPositions?: Record<string, 'left' | 'center' | 'right' | 'foreground' | 'background'>;
    requiredProps?: string[];
    preserveFromPrevious?: string[];
  };
  /** 角色调度 */
  characterDirection?: string;
  dialogue?: string;
  narration?: string;
  imageAssetId?: string;
  videoAssetId?: string;
  imageUrl?: string;
  videoUrl?: string;
  status?: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
}

export interface ScriptNodeData extends BaseNodeData {
  type: 'script' | 'storyboardMaker';
  script: string;
  scenes: ScriptScene[];
  style?: string;
  model?: string;
  scriptType?: string;
  tone?: string;
  scriptSourceMode?: 'text' | 'video_reference' | 'character_reference' | 'image_reference';
  referenceVideoUrl?: string;
  referenceVideoUrls?: string[];
  referenceCharacterNote?: string;
  referenceImageUrls?: string[];
  characterReferenceUrls?: string[];
  isControllerCollapsed?: boolean;
  isPropertiesOpen?: boolean;
  storyboardMode?: string;
  /** 故事版交付形态：分镜表、角色设定表或关系氛围板 */
  storyboardOutputMode?: StoryboardOutputMode;
  /** 单张分镜图内的镜头格数，仅用于手绘分镜和真实分镜模式。 */
  storyboardPanelCount?: 3 | 6 | 9 | 12;
  /** 交付图的模型实际尺寸 */
  storyboardOutputSize?: string;
  aspectRatio?: string;
  targetDuration?: number;
}

// ========== 联合类型 ==========
export type NodeData =
  | ImageGenNodeData
  | VideoGenNodeData
  | AIImageNodeData
  | AIVideoNodeData
  | PromptNodeData
  | ImageInputNodeData
  | LocalMattingNodeData
  | VideoUpscaleNodeData
  | VideoInputNodeData
  | AudioInputNodeData
  | OutputNodeData
  | TextInputNodeData
  | AdvancedFunctionNodeData
  | ScriptNodeData;

// ========== 类型守卫函数 ==========
export type ExecutableNodeType = 'videoGen' | 'imageGen' | 'unifiedImageStudio' | 'doubaoVideoGen' | 'imageToVideo';
export type InputNodeType = 'imageInput' | 'videoInput' | 'audioInput';

export const isExecutableNode = (type: string): type is ExecutableNodeType => {
  return ['videoGen', 'imageGen', 'unifiedImageStudio', 'doubaoVideoGen', 'imageToVideo'].includes(type);
};

export const isInputNode = (type: string): type is InputNodeType => {
  return ['imageInput', 'videoInput', 'audioInput'].includes(type);
};

export const isImageGenNode = (data: BaseNodeData): data is ImageGenNodeData => {
  return data.type === 'imageGen';
};

export const isVideoGenNode = (data: BaseNodeData): data is VideoGenNodeData => {
  return data.type === 'videoGen';
};

export const isAIImageNode = (data: BaseNodeData): data is AIImageNodeData => {
  return data.type === 'aiImage';
};

export const isAIVideoNode = (data: BaseNodeData): data is AIVideoNodeData => {
  return data.type === 'aiVideo';
};

export const isImageInputNode = (data: BaseNodeData): data is ImageInputNodeData => {
  return data.type === 'imageInput';
};

export const isLocalMattingNode = (data: BaseNodeData): data is LocalMattingNodeData => {
  return data.type === 'localMatting';
};

export const isVideoUpscaleNode = (data: BaseNodeData): data is VideoUpscaleNodeData => {
  return data.type === 'videoUpscale';
};

export const isVideoInputNode = (data: BaseNodeData): data is VideoInputNodeData => {
  return data.type === 'videoInput';
};

export const isAudioInputNode = (data: BaseNodeData): data is AudioInputNodeData => {
  return data.type === 'audioInput';
};

export const isPromptNode = (data: BaseNodeData): data is PromptNodeData => {
  return data.type === 'prompt';
};

export const isOutputNode = (data: BaseNodeData): data is OutputNodeData => {
  return data.type === 'output';
};

export const isTextInputNode = (data: BaseNodeData): data is TextInputNodeData => {
  return data.type === 'textInput';
};

export const isAIGenTextNode = (data: BaseNodeData): data is AIGenTextNodeData => {
  return data.type === 'aiGenText';
};

export const isAdvancedFunctionNode = (data: BaseNodeData): data is AdvancedFunctionNodeData => {
  return data.type === 'advancedFunction';
};

export const isScriptNode = (data: BaseNodeData): data is ScriptNodeData => {
  return data.type === 'script';
};

export const isInpaintingNode = (data: BaseNodeData): data is BaseNodeData & { type: 'inpainting' } => {
  return data.type === 'inpainting';
};

export const isOutpaintingNode = (data: BaseNodeData): data is BaseNodeData & { type: 'outpainting' } => {
  return data.type === 'outpainting';
};

export const isUnifiedImageStudioNode = (data: BaseNodeData): data is BaseNodeData & { type: 'unifiedImageStudio' } => {
  return data.type === 'unifiedImageStudio';
};



// ========== 兼容性别名（向后兼容） ==========
export type AllNodeData = NodeData;

// ========== 节点默认参数工厂 ==========
export function createDefaultImageGenParams(): ImageGenParams {
  return {
    modelProvider: 'doubao-image',
    generationMode: 'text_to_image',
    resolution: '1:1',
    pixelResolution: '1024',
    quality: 'hd',
    style: 'none',
    prompt: '',
    negativePrompt: '',
    cfgScale: 7.5,
    steps: 30,
    seed: -1,
    aspectRatio: '1:1',
  };
}

export function createDefaultVideoGenParams(): VideoGenParams {
  return {
    modelProvider: 'doubao',
    generationMode: 'text_to_video',
    resolution: '16:9',
    pixelResolution: '1080p',
    duration: 6,
    fps: 24,
    quality: 'standard',
    prompt: '',
    negativePrompt: '',
    motionStrength: 50,
    cameraControl: 'fixed',
    cameraIntensity: 50,
    cfgScale: 7,
    steps: 30,
    seed: -1,
  };
}

export function createDefaultPromptData(): PromptNodeData {
  return {
    type: 'prompt',
    prompt: '',
    isExpanded: true,
  };
}

export function createDefaultImageInputData(): ImageInputNodeData {
  return {
    type: 'imageInput',
    isExpanded: true,
  };
}

export function createDefaultVideoInputData(): VideoInputNodeData {
  return {
    type: 'videoInput',
    isExpanded: true,
  };
}

export function createDefaultAudioInputData(): AudioInputNodeData {
  return {
    type: 'audioInput',
    volume: 100,
    playbackRate: 1,
    loop: false,
    isExpanded: true,
  };
}

export function createDefaultOutputData(): OutputNodeData {
  return {
    type: 'output',
    label: '输出',
    isExpanded: true,
  };
}

export function createDefaultAdvancedFunctionParams(): AdvancedFunctionParams {
  return {
    functionType: 'expression',
    expression: '',
    conditionExpression: '',
    trueBranch: '',
    falseBranch: '',
    transformType: 'map',
    batchExpression: '',
    inputMapping: { input1: '', input2: '', input3: '', input4: '' },
    outputFormat: 'auto',
    errorHandling: 'default',
    defaultValue: '',
    maxRetries: 0,
    cacheResult: false,
    cacheTTL: 300,
    panelCount: 9,
    gridStyle: 'comic',
    storyTemplate: 'action',
    customScenes: ['平静开场', '角色亮相', '目标出现', '阻碍降临', '矛盾升级', '情绪爆点', '关键反击', '结果显现', '余韵收尾'],
    extraPrompt: '',
    shotTemplate: 'narrative-flow',
    imageModel: 'doubao-seedream-5-0-lite',
    storyboardRatio: '16:9',
  };
}

export function createDefaultAdvancedFunctionData(): AdvancedFunctionNodeData {
  return {
    type: 'advancedFunction',
    params: createDefaultAdvancedFunctionParams(),
    isExpanded: true,
  };
}
