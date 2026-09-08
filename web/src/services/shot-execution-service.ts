import type { Node } from '@xyflow/react';
import { toast } from 'sonner';
import { executeSingleNode } from '@/store/real-api-executor';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useShotStore } from '@/store/useShotStore';
import { useShotExecutionStore } from '@/store/useShotExecutionStore';
import { syncShotResultFromNode } from '@/services/shot-result-sync-service';
import type { Shot } from '@/types/shot-system';

export interface ShotExecutionOptions {
  includeImage?: boolean;
  includeVideo?: boolean;
  trackQueue?: boolean;
}

export interface ShotExecutionSummary {
  executedCount: number;
  failedCount: number;
}

function findNode(nodeId?: string): Node<Record<string, unknown>> | undefined {
  if (!nodeId) return undefined;
  return useCanvasStore.getState().nodes.find((node) => node.id === nodeId) as Node<Record<string, unknown>> | undefined;
}

function ensureShotNodes(shot: Shot) {
  const imageNode = findNode(shot.nodeLinks?.imageNodeId);
  const videoNode = findNode(shot.nodeLinks?.videoNodeId);
  return { imageNode, videoNode };
}

async function executeNodeAndSync(node: Node<Record<string, unknown>>) {
  await executeSingleNode(node.id);
  const latestNode = findNode(node.id);
  syncShotResultFromNode(latestNode, true);
}

export async function executeShot(
  shot: Shot,
  options: ShotExecutionOptions = {}
): Promise<ShotExecutionSummary> {
  const { includeImage = true, includeVideo = true, trackQueue = true } = options;
  const { imageNode, videoNode } = ensureShotNodes(shot);
  const shotStore = useShotStore.getState();
  const queueStore = useShotExecutionStore.getState();
  let executedCount = 0;
  let failedCount = 0;

  if (trackQueue) {
    queueStore.startQueue([shot]);
    queueStore.markRunning(shot.id);
  }

  if (!imageNode && !videoNode) {
    if (trackQueue) {
      queueStore.markSkipped(shot.id, '没有节点组');
      queueStore.finishQueue();
    }
    toast.warning(`「${shot.title}」还没有节点组`);
    return { executedCount, failedCount: 1 };
  }

  try {
    if (includeImage && imageNode) {
      shotStore.updateShot(shot.id, { status: 'image_generating' });
      await executeNodeAndSync(imageNode);
      executedCount += 1;
    }

    if (includeVideo && videoNode) {
      shotStore.updateShot(shot.id, { status: 'video_generating' });
      await executeNodeAndSync(videoNode);
      executedCount += 1;
    }
  } catch (error) {
    failedCount += 1;
    shotStore.updateShot(shot.id, { status: 'failed' });
    const message = error instanceof Error ? error.message : '镜头执行失败';
    if (trackQueue) {
      queueStore.markFailed(shot.id, message, failedCount);
      queueStore.finishQueue();
    }
    toast.error(`「${shot.title}」执行失败`, { description: message });
    return { executedCount, failedCount };
  }

  if (trackQueue) {
    queueStore.markDone(shot.id, executedCount);
    queueStore.finishQueue();
  }

  return { executedCount, failedCount };
}

export async function executeShots(
  shots: Shot[],
  options: ShotExecutionOptions = {}
): Promise<ShotExecutionSummary> {
  let executedCount = 0;
  let failedCount = 0;
  const runnable = shots.filter((shot) => shot.nodeLinks?.imageNodeId || shot.nodeLinks?.videoNodeId);
  const queueStore = useShotExecutionStore.getState();

  if (runnable.length === 0) {
    toast.info('请先为镜头创建节点组');
    return { executedCount, failedCount };
  }

  queueStore.startQueue(runnable);
  toast.info(`开始执行 ${runnable.length} 个镜头`);

  for (const shot of runnable) {
    queueStore.markRunning(shot.id);
    const summary = await executeShot(shot, { ...options, trackQueue: false });
    executedCount += summary.executedCount;
    failedCount += summary.failedCount;

    if (summary.failedCount > 0) {
      queueStore.markFailed(shot.id, undefined, summary.failedCount);
    } else {
      queueStore.markDone(shot.id, summary.executedCount);
    }
  }

  queueStore.finishQueue();

  if (failedCount > 0) {
    toast.error(`分镜执行完成，${failedCount} 个镜头失败`);
  } else {
    toast.success(`分镜执行完成，已执行 ${executedCount} 个节点`);
  }

  return { executedCount, failedCount };
}
