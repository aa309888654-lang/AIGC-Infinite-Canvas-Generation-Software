export const CANONICAL_TASK_STATUSES = [
  'created',
  'queued',
  'prechecking',
  'charging',
  'submitted',
  'pending',
  'processing',
  'polling',
  'paused',
  'completed',
  'failed',
  'timeout',
  'cancelled',
  'refunding',
  'refunded',
] as const;

export type CanonicalTaskStatus = (typeof CANONICAL_TASK_STATUSES)[number];

const taskStatuses = new Set<string>(CANONICAL_TASK_STATUSES);

const terminalStatuses = new Set<CanonicalTaskStatus>([
  'completed',
  'failed',
  'timeout',
  'cancelled',
  'refunded',
]);

const allowedTransitions: Record<CanonicalTaskStatus, readonly CanonicalTaskStatus[]> = {
  created: ['queued', 'prechecking', 'pending', 'cancelled', 'failed'],
  queued: ['prechecking', 'charging', 'submitted', 'pending', 'cancelled', 'failed'],
  prechecking: ['charging', 'submitted', 'pending', 'cancelled', 'failed'],
  charging: ['submitted', 'pending', 'processing', 'refunding', 'failed', 'cancelled'],
  submitted: ['pending', 'processing', 'polling', 'completed', 'failed', 'cancelled'],
  pending: ['submitted', 'processing', 'polling', 'completed', 'failed', 'timeout', 'cancelled'],
  processing: ['polling', 'paused', 'completed', 'failed', 'timeout', 'cancelled'],
  polling: ['processing', 'completed', 'failed', 'timeout', 'cancelled'],
  paused: ['processing', 'cancelled', 'failed'],
  completed: ['refunding'],
  failed: ['refunding'],
  timeout: ['refunding'],
  cancelled: ['refunding'],
  refunding: ['refunded', 'failed'],
  refunded: [],
};

export class TaskStatusTransitionError extends Error {
  code = 'INVALID_TASK_STATUS_TRANSITION';

  constructor(
    public readonly fromStatus: string,
    public readonly toStatus: string,
  ) {
    super(`Invalid task status transition: ${fromStatus} -> ${toStatus}`);
  }
}

export function isCanonicalTaskStatus(status: string | null | undefined): status is CanonicalTaskStatus {
  return typeof status === 'string' && taskStatuses.has(status);
}

export function isTerminalTaskStatus(status: string | null | undefined): boolean {
  return isCanonicalTaskStatus(status) && terminalStatuses.has(status);
}

export function canTransitionTaskStatus(
  fromStatus: string | null | undefined,
  toStatus: string | null | undefined,
): boolean {
  if (!isCanonicalTaskStatus(fromStatus) || !isCanonicalTaskStatus(toStatus)) {
    return false;
  }

  if (fromStatus === toStatus) {
    return true;
  }

  return allowedTransitions[fromStatus].includes(toStatus);
}

export function assertTaskStatusTransition(
  fromStatus: string | null | undefined,
  toStatus: string | null | undefined,
): asserts toStatus is CanonicalTaskStatus {
  if (canTransitionTaskStatus(fromStatus, toStatus)) {
    return;
  }

  throw new TaskStatusTransitionError(String(fromStatus), String(toStatus));
}

