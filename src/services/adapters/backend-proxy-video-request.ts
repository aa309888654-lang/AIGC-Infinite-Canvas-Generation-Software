import type { VideoParams } from '@/types/adapter';

export function buildVideoSubmissionIdentity(params: VideoParams): {
  nodeId?: string;
  idempotencyKey?: string;
} {
  return {
    nodeId: params.nodeId,
    idempotencyKey: params.idempotencyKey,
  };
}
