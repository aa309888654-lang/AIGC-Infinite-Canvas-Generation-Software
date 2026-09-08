import prisma from '../lib/prisma';

export const CONTENT_REVIEW_CONFIG_KEY = 'content_review_gate_enabled';
const REVIEWABLE_TYPES = new Set(['image', 'video']);

export interface ReviewableTaskResult {
  id: string;
  userId: string;
  type: string;
  status: string;
  reviewStatus: string;
  result: string | null;
  outputUrl: string | null;
  cosUrl: string | null;
  thumbnailUrl: string | null;
}

export interface UserVisibleTaskResult extends ReviewableTaskResult {
  resultAvailable: boolean;
}

export async function isContentReviewEnabled(): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: CONTENT_REVIEW_CONFIG_KEY },
    select: { value: true },
  });
  return config?.value === 'true';
}

export function isTaskAwaitingReview(
  task: Pick<ReviewableTaskResult, 'type' | 'status' | 'reviewStatus'>,
  enabled: boolean,
): boolean {
  return enabled
    && REVIEWABLE_TYPES.has(task.type)
    && task.status === 'completed'
    && task.reviewStatus !== 'approved';
}

export function toUserVisibleTask<T extends ReviewableTaskResult>(task: T, enabled: boolean): T & UserVisibleTaskResult {
  if (!isTaskAwaitingReview(task, enabled)) {
    return { ...task, resultAvailable: true };
  }

  return {
    ...task,
    result: null,
    outputUrl: null,
    cosUrl: null,
    thumbnailUrl: null,
    resultAvailable: false,
  };
}

export async function updateContentReviewSetting(enabled: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (enabled) {
      await tx.task.updateMany({
        where: {
          type: { in: ['image', 'video'] },
          status: 'completed',
          reviewStatus: 'pending',
        },
        data: {
          reviewStatus: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'system:migration',
          reviewNote: '启用审核前的历史内容自动通过',
        },
      });
    }

    await tx.systemConfig.upsert({
      where: { key: CONTENT_REVIEW_CONFIG_KEY },
      create: {
        key: CONTENT_REVIEW_CONFIG_KEY,
        value: String(enabled),
        description: '图片与视频生成结果需管理员审核通过后才向用户展示',
      },
      update: { value: String(enabled) },
    });
  });
}
