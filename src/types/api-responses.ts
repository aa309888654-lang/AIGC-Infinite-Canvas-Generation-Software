/**
 * 统一的API响应类型定义
 * 消除多个适配器中重复的类型定义
 */

// ==================== 通用响应类型 ====================

/**
 * 基础API响应
 */
export interface BaseAPIResponse {
  id?: string;
  request_id?: string;
  status?: string;
  error?: APIError;
}

/**
 * API错误
 */
export interface APIError {
  code: string;
  message: string;
  param?: string;
  type?: string;
}

/**
 * 任务状态
 */
export type TaskStatusType = 'pending' | 'processing' | 'completed' | 'failed' | 'unknown';

/**
 * 生成结果
 */
export interface BaseGenerationResult {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output?: unknown;
  error?: string;
  progress?: number;
}

// ==================== 图片生成响应 ====================

/**
 * 图片生成响应（豆包/通用）
 */
export interface ImageGenerationResponse extends BaseAPIResponse {
  id: string;
  output?: {
    task_id?: string;
    image_url?: string;
    image_urls?: string[];
    revision_id?: string;
  };
}

/**
 * 图片列表响应
 */
export interface ImageListResponse extends BaseAPIResponse {
  images: Array<{
    id: string;
    url: string;
    width?: number;
    height?: number;
  }>;
}

// ==================== 视频生成响应 ====================

/**
 * 视频生成响应（豆包/通用）
 */
export interface VideoGenerationResponse extends BaseAPIResponse {
  id: string;
  output?: {
    task_id?: string;
    video_url?: string;
    cover_image_url?: string;
    revision_id?: string;
  };
}

/**
 * 视频列表响应
 */
export interface VideoListResponse extends BaseAPIResponse {
  videos: Array<{
    id: string;
    url: string;
    cover_url?: string;
    duration?: number;
    width?: number;
    height?: number;
  }>;
}

// ==================== 任务状态响应 ====================

/**
 * 任务状态响应
 */
export interface TaskStatusResponse extends BaseAPIResponse {
  id: string;
  status: TaskStatusType;
  output?: {
    task_id?: string;
    status?: TaskStatusType;
    progress?: number;
    image_url?: string;
    video_url?: string;
    error?: string;
  };
  progress?: number;
  error?: APIError;
}

// ==================== 工厂函数 ====================

/**
 * 创建失败的生成结果
 */
export function createFailedResult(error: unknown, defaultTaskId: string = ''): BaseGenerationResult {
  return {
    taskId: defaultTaskId,
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  };
}

/**
 * 创建进行中的生成结果
 */
export function createPendingResult(taskId: string): BaseGenerationResult {
  return {
    taskId,
    status: 'pending',
  };
}

/**
 * 从响应中提取任务ID
 */
export function extractTaskId(response: ImageGenerationResponse | VideoGenerationResponse): string {
  return response.id || response.output?.task_id || '';
}

/**
 * 从状态响应中提取任务状态
 */
export function extractTaskStatus(response: TaskStatusResponse): TaskStatusType {
  const status = response.status || response.output?.status || 'unknown';
  
  switch (status.toLowerCase()) {
    case 'pending':
    case 'queued':
    case 'wait':
      return 'pending';
    case 'processing':
    case 'running':
    case 'doing':
      return 'processing';
    case 'succeed':
    case 'completed':
    case 'done':
    case 'success':
      return 'completed';
    case 'failed':
    case 'fail':
    case 'error':
      return 'failed';
    default:
      return 'unknown';
  }
}
