/**
 * 统一的节点类型定义
 * 整合所有节点类型到一个集中的位置
 */

import { TaskStatus } from './ai-models';

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

/** 节点展开状态接口 */
export interface ExpandableNodeData {
  isExpanded?: boolean;
}

/** 基础节点数据接口 */
export interface BaseNodeData extends ExpandableNodeData {
  type: string;
}

export interface ImageInputNodeData extends BaseNodeData {
  type: 'imageInput';
  imageUrl?: string;
  fileName?: string;
  width?: number;
  height?: number;
}

export interface VideoInputNodeData extends BaseNodeData {
  type: 'videoInput';
  videoUrl?: string;
  fileName?: string;
  startFrame?: number;
  endFrame?: number;
  duration?: number;
}

export interface ImageGenNodeData extends BaseNodeData {
  type: 'imageGen';
  params: {
    modelProvider: string;
    aspectRatio: string;
    prompt?: string;
    negativePrompt?: string;
    referenceImage?: string;
    seed?: number;
  };
  task?: ImageTask;
}

export interface VideoGenNodeData extends BaseNodeData {
  type: 'videoGen';
  params: {
    modelProvider: string;
    resolution: string;
    duration: number;
    prompt?: string;
    negativePrompt?: string;
    startImage?: string;
    endImage?: string;
    referenceImage?: string;
    motionStrength?: number;
  };
  task?: VideoTask;
}

export type AllNodeData = 
  | ImageInputNodeData 
  | VideoInputNodeData 
  | ImageGenNodeData 
  | VideoGenNodeData 
  | PromptNodeData;

export type ExecutableNodeType = 'videoGen' | 'imageGen' | 'unifiedImageStudio';

export type InputNodeType = 'imageInput' | 'videoInput';

export const isExecutableNode = (type: string): type is ExecutableNodeType => {
  return ['videoGen', 'imageGen', 'unifiedImageStudio'].includes(type);
};

export const isInputNode = (type: string): type is InputNodeType => {
  return ['imageInput', 'videoInput'].includes(type);
};

export const isImageGenNode = (data: BaseNodeData): data is ImageGenNodeData => {
  return data.type === 'imageGen';
};

export const isVideoGenNode = (data: BaseNodeData): data is VideoGenNodeData => {
  return data.type === 'videoGen';
};

export const isImageInputNode = (data: BaseNodeData): data is ImageInputNodeData => {
  return data.type === 'imageInput';
};

export const isVideoInputNode = (data: BaseNodeData): data is VideoInputNodeData => {
  return data.type === 'videoInput';
};

export interface PromptNodeData extends BaseNodeData {
  type: 'prompt';
  prompt: string;
  negativePrompt?: string;
}

export const isPromptNode = (data: BaseNodeData): data is PromptNodeData => {
  return data.type === 'prompt';
};
