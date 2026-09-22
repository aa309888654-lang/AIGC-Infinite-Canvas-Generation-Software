/**
 * 页面挂载时恢复进行中的视频生成任务
 */

import { useEffect } from 'react';
import { loadPendingTasks, resumeTaskPolling } from '@/services/video-task-persistence';
import { useCanvasStore } from '@/store/useCanvasStore';
import { toast } from 'sonner';

export function useResumeVideoTasks() {
  useEffect(() => {
    const pending = loadPendingTasks();
    if (pending.length === 0) return;

    toast.info(`正在恢复 ${pending.length} 个视频生成任务...`);

    for (const task of pending) {
      resumeTaskPolling(task, {
        onProgress: (progress) => {
          const store = useCanvasStore.getState();
          const node = store.nodes.find((n) => n.id === task.nodeId);
          if (node) {
            store.updateNodeData(task.nodeId, {
              task: {
                ...(node.data as any)?.task,
                progress,
                status: 'processing',
                updatedAt: new Date().toISOString(),
              },
            });
          }
        },
        onCompleted: (result) => {
          const store = useCanvasStore.getState();
          const node = store.nodes.find((n) => n.id === task.nodeId);
          const nodeData = (node?.data || {}) as any;
          const existingUrls = Array.isArray(nodeData.resultUrls) ? nodeData.resultUrls : [];
          const resultUrls = Array.from(new Set([...existingUrls, ...result.resultUrls]));
          const existingHistory = Array.isArray(nodeData.history) ? nodeData.history : [];
          store.updateNodeData(task.nodeId, {
            resultUrl: resultUrls[0] || result.resultUrl,
            resultUrls,
            history: [
              {
                id: `video-history-${Date.now()}`,
                createdAt: new Date().toISOString(),
                prompt: task.prompt || '',
                modelId: task.modelId,
                provider: task.provider,
                resultUrl: result.resultUrl,
                resultUrls: result.resultUrls,
                recovered: true,
              },
              ...existingHistory,
            ].slice(0, 20),
            task: {
              ...nodeData.task,
              status: 'completed',
              progress: 100,
              resultUrl: resultUrls[0] || result.resultUrl,
              resultUrls,
              updatedAt: new Date().toISOString(),
            },
          });
          toast.success('视频生成完成（已恢复）', {
            description: `节点 ${task.nodeId.slice(0, 8)}...`,
          });
        },
        onFailed: (error) => {
          const store = useCanvasStore.getState();
          store.updateNodeData(task.nodeId, {
            task: {
              status: 'failed',
              error,
              updatedAt: new Date().toISOString(),
            },
          });
          toast.error('视频生成失败（已恢复）', {
            description: error,
          });
        },
      });
    }
  }, []);
}
