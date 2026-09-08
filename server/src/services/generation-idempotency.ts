import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

const IDEMPOTENCY_PREFIX = 'idem:';
const FALLBACK_WINDOW_MS = 5 * 60 * 1000;

type TaskCreateData = {
  userId: string;
  type: string;
  prompt: string;
  provider?: string | null;
  model?: string | null;
  status?: string;
  params?: string | null;
  progress?: number;
};

type IdempotentTaskResult = {
  task: any;
  reused: boolean;
  key: string;
};

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return Object.keys(objectValue)
      .filter((key) => !['timestamp', 'createdAt', 'updatedAt'].includes(key))
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeValue(objectValue[key]);
        return acc;
      }, {});
  }
  return value;
}

function hashPayload(payload: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizeValue(payload)))
    .digest('hex')
    .slice(0, 32);
}

export function isLocalIdempotencyTaskId(taskId?: string | null): boolean {
  return typeof taskId === 'string' && taskId.startsWith(IDEMPOTENCY_PREFIX);
}

export function buildGenerationIdempotencyKey(options: {
  userId: string;
  route: string;
  body: Record<string, unknown>;
  nodeId?: string | null;
  clientRequestId?: string | null;
}): string {
  const explicitClientKey =
    options.clientRequestId ||
    (typeof options.body.idempotencyKey === 'string' ? options.body.idempotencyKey : null) ||
    (typeof options.body.requestId === 'string' ? options.body.requestId : null) ||
    (typeof options.body.clientRequestId === 'string' ? options.body.clientRequestId : null);

  // An explicit key identifies one intentional submission. nodeId is only a
  // fallback for older clients; using it first would make a node single-use.
  const scope = explicitClientKey
    ? `client:${explicitClientKey}`
    : options.nodeId
      ? `node:${options.nodeId}`
      : `window:${Math.floor(Date.now() / FALLBACK_WINDOW_MS)}:${hashPayload(options.body)}`;

  return `${IDEMPOTENCY_PREFIX}${hashPayload({
    userId: options.userId,
    route: options.route,
    scope,
  })}`;
}

export async function createIdempotentGenerationTask(
  key: string,
  data: TaskCreateData
): Promise<IdempotentTaskResult> {
  try {
    const task = await prisma.task.create({
      data: {
        ...data,
        status: data.status || 'pending',
        progress: data.progress ?? 0,
        taskId: key,
      },
    });
    return { task, reused: false, key };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existingTask = await prisma.task.findUnique({ where: { taskId: key } });
      if (existingTask) {
        // 同一幂等键始终指向同一账单任务，包括成功和失败终态。
        // 用户主动重试必须创建新键，HTTP 重试或刷新恢复不得再次扣费。
        return { task: existingTask, reused: true, key };
      }
    }
    throw error;
  }
}

export function buildReusedGenerationResponse(task: any): Record<string, unknown> {
  let result: Record<string, unknown> = {};
  if (task?.result) {
    try {
      const parsed = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
      if (parsed && typeof parsed === 'object') result = parsed;
    } catch {
      result = {};
    }
  }

  return {
    taskId: task.id,
    status: task.status,
    progress: task.progress ?? 0,
    provider: task.provider,
    model: task.model,
    error: task.error,
    resultUrl: task.outputUrl || result.url || result.imageUrl || result.audioUrl || result.videoUrl,
    audioUrl: result.audioUrl,
    videoUrl: result.videoUrl,
    imageUrl: result.imageUrl || result.url,
    minimaxTaskId: result.minimaxTaskId,
    providerTaskId: result.apiTaskId,
    reused: true,
  };
}
