const IMAGE_NODE_RETRY_WINDOW_MS = 60_000;

export function getImageNodeTaskRetryCutoff(now = new Date()): Date {
  return new Date(now.getTime() - IMAGE_NODE_RETRY_WINDOW_MS);
}

type TaskUpdateClient = {
  update(args: {
    where: { id: string };
    data: { status: 'failed'; error: string };
  }): Promise<unknown>;
};

export function buildActiveImageNodeTaskFilter(userId: string, nodeId: string, now = new Date()) {
  return {
    userId,
    type: 'image',
    status: { in: ['pending', 'processing'] },
    createdAt: { gte: getImageNodeTaskRetryCutoff(now) },
    params: { contains: `"nodeId":"${nodeId}"` },
  };
}

export async function markImageTaskFailed(
  taskClient: TaskUpdateClient,
  taskId: string | undefined,
  error: unknown,
): Promise<void> {
  if (!taskId) return;
  const message = error instanceof Error ? error.message : String(error || '图片生成失败');
  await taskClient.update({
    where: { id: taskId },
    data: { status: 'failed', error: message },
  });
}
