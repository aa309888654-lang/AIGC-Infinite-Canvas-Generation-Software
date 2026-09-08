/**
 * 后端 API 类型定义
 * 核心 API 边界类型从 shared 导入，此处仅保留后端特有类型
 */
export type {
  BaseParams,
  VideoParams,
  ImageParams,
  AudioParams,
  CameraControl,
  GenerationResult,
  ApiProviderConfig,
  AspectRatio,
  GenerationMode,
} from '../shared/types';

import { TaskStatus } from '../shared/types';
export { TaskStatus };
