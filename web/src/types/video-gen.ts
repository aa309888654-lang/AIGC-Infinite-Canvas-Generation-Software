// 视频生成模式类型
export type VideoGenMode = 'firstLastFrame' | 'singleFrame' | 'multiReference' | 'videoToVideo';

// 首尾帧参数
export interface FirstLastFrameParams {
  mode: 'firstLastFrame';
  firstFrame: string;      // 首帧图片Base64或URL
  lastFrame: string;       // 尾帧图片Base64或URL
}

// 单帧参数
export interface SingleFrameParams {
  mode: 'singleFrame';
  sourceImage: string;     // 源图片Base64或URL
  prompt: string;         // 文本提示词
  negativePrompt?: string; // 反向提示词
}

// 多图参考参数
export interface MultiReferenceParams {
  mode: 'multiReference';
  referenceImages: string[];  // 参考图片数组（最多5张）
  prompt: string;
  negativePrompt?: string;
  referenceWeights?: number[]; // 参考权重（可选）
}

// 视频生视频参数（新增）
export interface VideoToVideoParams {
  mode: 'videoToVideo';
  sourceVideo: string;     // 源视频URL或Base64
  prompt: string;         // 文本提示词
  negativePrompt?: string; // 反向提示词
  strength?: number;      // 变换强度 0-1
}

// 统一的视频生成参数
export type VideoGenParams = FirstLastFrameParams | SingleFrameParams | MultiReferenceParams | VideoToVideoParams;

// 镜头控制类型
export type CameraControlType = 
  | 'static'      // 固定镜头
  | 'zoom_in'     // 推近
  | 'zoom_out'    // 拉远
  | 'pan_left'    // 左摇
  | 'pan_right'   // 右摇
  | 'pan_up'      // 上摇
  | 'pan_down'    // 下摇
  | 'orbit'       // 环绕
  | 'dolly_in'    // 前移
  | 'dolly_out'   // 后移
  | 'roll';       // 旋转

// 视频生成配置
export interface VideoGenConfig {
  modelProvider: 'doubao' | 'jimeng';
  resolution: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  duration: '5s' | '10s' | '12s' | '15s' | '20s' | '30s' | '60s';
  quality: 'standard' | 'high' | 'premium';
  motionStrength: number;  // 0-100
  fps: 24 | 30 | 60;
  cameraControl?: CameraControlType;  // ✅ 已修复：镜头控制
  cameraIntensity?: number;  // 镜头运动强度 0-100
}

// 基础节点数据接口
export interface BaseNodeData {
  isExpanded?: boolean;
}

// 完整的视频节点数据
export interface DoubaoVideoNodeData extends BaseNodeData {
  type: 'doubaoVideoGen';
  genMode: VideoGenMode;
  params: VideoGenParams;
  config: VideoGenConfig;
  task?: GenerationTask;
}

// 生成任务状态
export interface GenerationTask {
  id: string;
  nodeId: string;
  type: 'video' | 'image';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: Date;
}
