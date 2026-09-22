/**
 * useTaskHydration - 启动时从后端恢复进行中任务
 *
 * Sprint 3：统一任务队列
 * 页面加载时调用 GET /api/v1/tasks?status=pending 和 status=processing，
 * 将后端 Task 记录同步到 useTaskStore，确保刷新后任务不丢失。
 */
import { useEffect } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { API_BASE_URL } from '../lib/api-config';

interface BackendTask {
  id: string;
  type: string;
  provider?: string;
  model?: string;
  status: string;
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt?: string;
}

export function useTaskHydration(): void {
  useEffect(() => {
    const fetchTasks = async (status: string): Promise<BackendTask[]> => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/tasks?status=${status}&pageSize=50`,
          { headers: {} }
        );
        if (!res.ok) return [];
        const json = await res.json();
        return json?.data?.tasks || [];
      } catch {
        return [];
      }
    };

    Promise.all([fetchTasks('pending'), fetchTasks('processing')])
      .then(([pending, processing]) => {
        const store = useTaskStore.getState();
        const existing = store.tasks;
        const allTasks = [...pending, ...processing];
        for (const task of allTasks) {
          const taskType = (task.type === 'video' || task.type === 'image' || task.type === 'audio' || task.type === 'text')
            ? task.type
            : 'image';
          if (existing[task.id]) {
            store.updateTask(task.id, {
              status: task.status as 'pending' | 'processing',
              progress: task.progress,
              resultUrl: task.outputUrl,
              error: task.error,
              updatedAt: task.updatedAt,
            });
          } else {
            store.addTask({
              id: task.id,
              nodeId: task.id,
              backendTaskId: task.id,
              type: taskType,
              status: task.status as 'pending' | 'processing',
              resultUrl: task.outputUrl,
              error: task.error,
            });
          }
        }
      })
      .catch(() => {});
  }, []);
}
