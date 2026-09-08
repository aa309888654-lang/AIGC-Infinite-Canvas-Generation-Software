/**
 * 任务处理工具函数
 * 提取工作流执行器中的通用逻辑
 */

import { GenerationTask, FileItem } from '@/types/ai-models';
import { taskManager } from './task-manager';
import { generateId } from '@/lib/utils';

/**
 * 任务处理器上下文
 */
export interface TaskHandlerContext {
  nodeId: string;
  taskType: 'video' | 'image';
  updateTask: (taskId: string, updates: Partial<GenerationTask>) => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  addFile: (file: FileItem) => void;
  addError: (error: { type: string; message: string; nodeId?: string }) => void;
}

/**
 * 创建任务进度回调
 */
export function createProgressCallback(context: TaskHandlerContext, task: GenerationTask) {
  return function onProgress(progress: number) {
    context.updateTask(task.id, { progress });
    context.updateNodeData(context.nodeId, {
      task: { ...task, progress },
    });
  };
}

/**
 * 处理任务成功完成
 */
export async function handleTaskSuccess(
  context: TaskHandlerContext,
  task: GenerationTask,
  resultUrl: string,
  fileExtension: string = 'mp4'
): Promise<void> {
  const completedTask = taskManager.createCompletedTask(task, resultUrl);
  context.updateTask(task.id, completedTask);
  context.updateNodeData(context.nodeId, { task: completedTask });

  // 添加到文件列表
  context.addFile({
    id: generateId(),
    name: `${context.taskType}_${Date.now()}.${fileExtension}`,
    type: context.taskType as 'video' | 'image',
    url: resultUrl,
    size: 1024 * 1024,
    createdAt: new Date().toISOString(),
  });
}

/**
 * 处理任务失败
 */
export function handleTaskFailure(
  context: TaskHandlerContext,
  task: GenerationTask,
  errorMessage: string
): void {
  const failedTask = taskManager.createFailedTask(task, errorMessage);
  context.updateTask(task.id, failedTask);
  context.updateNodeData(context.nodeId, { task: failedTask });
  
  context.addError({
    type: 'execution',
    message: errorMessage,
    nodeId: context.nodeId,
  });
}

/**
 * 创建任务处理器
 */
export function createTaskHandler(context: TaskHandlerContext): {
  task: GenerationTask;
  onProgress: (progress: number) => void;
  handleSuccess: (resultUrl: string, fileExtension?: string) => Promise<void>;
  handleFailure: (errorMessage: string) => void;
} {
  const task = taskManager.createProcessingTask(context.nodeId, context.taskType);
  
  return {
    task,
    onProgress: createProgressCallback(context, task),
    handleSuccess: (resultUrl, fileExtension) => handleTaskSuccess(context, task, resultUrl, fileExtension),
    handleFailure: (errorMessage) => handleTaskFailure(context, task, errorMessage),
  };
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(taskType: 'video' | 'image'): string {
  return taskType === 'video' ? 'mp4' : 'png';
}

/**
 * 根据节点类型获取任务类型
 */
export function getTaskTypeFromNodeType(nodeType: string): 'video' | 'image' {
  const imageTypes = ['aiImage', 'imageGen', 'unifiedImageStudio', 'aicgImageGen', 'imageInput'];
  const videoTypes = ['aiVideo', 'advancedVideoGen', 'aicgVideoGen', 'videoGen', 'doubaoVideoGen', 'imageToVideo', 'videoEdit', 'videoInput'];
  
  if (imageTypes.includes(nodeType)) return 'image';
  if (videoTypes.includes(nodeType)) return 'video';
  
  // 默认返回 video
  return 'video';
}
