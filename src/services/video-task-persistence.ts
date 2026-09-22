/**
 * 视频任务持久化 — 页面刷新后恢复进行中的轮询
 */

import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';
import { nodeTaskRegistry } from '@/services/node-task-registry';
import { useCanvasStore } from '@/store/useCanvasStore';

const STORAGE_KEY = 'xiaotian-pending-video-tasks';

export interface PendingVideoTask {
  nodeId: string;
  taskId: string;
  modelId: string;
  submittedAt: number;
  provider: string;
  /** 多片段生成时的片段序号（从 0 开始） */
  clipIndex?: number;
  /** 多片段生成时的总片段数 */
  totalClips?: number;
  /** 提交时的提示词快照 */
  prompt?: string;
}

/** 保存进行中的任务 */
export function savePendingTask(task: PendingVideoTask) {
  const tasks = loadPendingTasks();
  // 去重：同 nodeId + taskId 不重复存
  const exists = tasks.some((t) => t.taskId === task.taskId);
  if (!exists) {
    tasks.push(task);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }
}

/** 移除已完成/失败的任务 */
export function removePendingTask(taskId: string) {
  const tasks = loadPendingTasks().filter((t) => t.taskId !== taskId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/** 读取所有待恢复的任务 */
export function loadPendingTasks(): PendingVideoTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const tasks = JSON.parse(raw) as PendingVideoTask[];
    // 过滤超过 15 分钟的任务（已超时）
    const MAX_AGE_MS = 15 * 60 * 1000;
    const now = Date.now();
    return tasks.filter((t) => now - t.submittedAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

/** 清空所有持久化任务 */
export function clearPendingTasks() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 恢复一个 pending 任务的轮询
 * 返回最终结果（completed/failed）
 *
 * ✅ P0-6：注册到 nodeTaskRegistry，节点删除时自动取消
 */
export async function resumeTaskPolling(
  pendingTask: PendingVideoTask,
  callbacks?: {
    onProgress?: (progress: number) => void;
    onCompleted?: (result: { resultUrl: string; resultUrls: string[]; thumbnailUrl?: string }) => void;
    onFailed?: (error: string) => void;
  },
) {
  const MAX_POLLING_MS = 15 * 60 * 1000; // ✅ 延长到 15 分钟，与 savePendingTask 的 MAX_AGE 对齐
  const pollStartTime = Date.now();
  let consecutiveFailures = 0;

  // ✅ P0-6：注册取消函数，节点删除时自动中断轮询
  const cancelToken = { cancelled: false };
  const cancelFn = () => {
    cancelToken.cancelled = true;
  };
  nodeTaskRegistry.register(pendingTask.nodeId, cancelFn);

  try {
    while (!cancelToken.cancelled && Date.now() - pollStartTime <= MAX_POLLING_MS) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // ✅ 检查取消标志
      if (cancelToken.cancelled) {
        console.log(`[resumeTaskPolling] 节点 ${pendingTask.nodeId} 已取消，停止轮询`);
        return { success: false, error: 'cancelled' };
      }

      // ✅ P0-6：检查节点是否仍存在（节点可能已删除）
      const { nodes } = useCanvasStore.getState();
      if (!nodes.find((n) => n.id === pendingTask.nodeId)) {
        console.log(`[resumeTaskPolling] 节点 ${pendingTask.nodeId} 已删除，停止轮询`);
        removePendingTask(pendingTask.taskId);
        return { success: false, error: 'node_deleted' };
      }

      try {
        const statusResult = await backendProxyAdapter.getTaskStatus({
          taskId: pendingTask.taskId,
        });

        if (statusResult.progress !== undefined) {
          callbacks?.onProgress?.(statusResult.progress);
        }

        if (statusResult.status === 'completed') {
          removePendingTask(pendingTask.taskId);
          const resultUrl = statusResult.resultUrl || '';
          const resultUrls = statusResult.resultUrls || (resultUrl ? [resultUrl] : []);
          callbacks?.onCompleted?.({
            resultUrl,
            resultUrls,
            thumbnailUrl: statusResult.thumbnailUrl,
          });
          return { success: true, resultUrl, resultUrls, thumbnailUrl: statusResult.thumbnailUrl };
        }

        if (statusResult.status === 'failed') {
          removePendingTask(pendingTask.taskId);
          const error = statusResult.error || '视频生成失败';
          callbacks?.onFailed?.(error);
          return { success: false, error };
        }

        // pending / processing — 继续轮询
        consecutiveFailures = 0;
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 5) {
          removePendingTask(pendingTask.taskId);
          callbacks?.onFailed?.('视频任务状态查询失败');
          return { success: false, error: '视频任务状态查询失败' };
        }
      }
    }
  } finally {
    // ✅ 任务正常结束，注销取消函数
    nodeTaskRegistry.unregister(pendingTask.nodeId, cancelFn);
  }

  removePendingTask(pendingTask.taskId);
  callbacks?.onFailed?.('视频生成超时');
  return { success: false, error: '视频生成超时' };
}
