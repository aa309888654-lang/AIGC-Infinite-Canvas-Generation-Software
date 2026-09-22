import type { GenerationTask } from '@/types/ai-models';
import { useTaskStore } from '@/store/useTaskStore';

interface StartStoryboardQueueTaskOptions {
  nodeId: string;
  modelId: string;
  modelProvider: string;
  modelName: string;
  promptPreview: string;
}

export function startStoryboardQueueTask(
  options: StartStoryboardQueueTaskOptions,
): GenerationTask | null {
  const activeStoryboardTask = Object.values(useTaskStore.getState().tasks).find(
    (task) =>
      String(task.id).startsWith('storyboard-') &&
      (task.status === 'pending' || task.status === 'processing')
  );
  if (activeStoryboardTask) return null;
  const createdAt = new Date().toISOString();
  const id = `storyboard-${options.nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const task: GenerationTask = {
    id,
    nodeId: options.nodeId,
    type: 'image',
    nodeType: 'image',
    status: 'processing',
    priority: 'normal',
    progress: 0,
    createdAt,
    updatedAt: createdAt,
    modelId: options.modelId,
    modelProvider: options.modelProvider,
    modelName: options.modelName,
    promptPreview: options.promptPreview,
  };

  useTaskStore.getState().addTask(task);
  return useTaskStore.getState().tasks[id] || task;
}

export function updateStoryboardQueueTask(
  taskId: string,
  updates: Partial<GenerationTask>,
): GenerationTask | undefined {
  const store = useTaskStore.getState();
  const existing = store.tasks[taskId];
  if (!existing) return undefined;

  const updatedAt = new Date().toISOString();
  const nextUpdates: Partial<GenerationTask> = {
    ...updates,
    updatedAt,
    ...(['completed', 'failed', 'cancelled'].includes(String(updates.status))
      ? { completedAt: updatedAt }
      : {}),
  };
  store.updateTask(taskId, nextUpdates);
  return { ...existing, ...nextUpdates };
}
