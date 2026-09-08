import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ default: {} }));

import { isTaskAwaitingReview, toUserVisibleTask } from './content-review-service';

const task = {
  id: 'task-1',
  userId: 'user-1',
  type: 'image',
  status: 'completed',
  reviewStatus: 'pending',
  result: JSON.stringify({ url: '/uploads/result.png' }),
  outputUrl: '/uploads/result.png',
  cosUrl: 'https://storage.example/result.png',
  thumbnailUrl: '/uploads/thumb.png',
};

describe('content review visibility gate', () => {
  it('does not gate results while the global setting is disabled', () => {
    expect(isTaskAwaitingReview(task, false)).toBe(false);
    expect(toUserVisibleTask(task, false)).toMatchObject({
      resultAvailable: true,
      outputUrl: '/uploads/result.png',
    });
  });

  it('removes every media address from an unapproved result', () => {
    expect(toUserVisibleTask(task, true)).toMatchObject({
      resultAvailable: false,
      result: null,
      outputUrl: null,
      cosUrl: null,
      thumbnailUrl: null,
    });
  });

  it('restores visibility after approval and never gates non-media tasks', () => {
    expect(toUserVisibleTask({ ...task, reviewStatus: 'approved' }, true).resultAvailable).toBe(true);
    expect(toUserVisibleTask({ ...task, type: 'audio' }, true).resultAvailable).toBe(true);
  });
});
