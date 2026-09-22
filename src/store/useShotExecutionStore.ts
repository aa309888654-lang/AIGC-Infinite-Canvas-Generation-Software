import { create } from 'zustand';
import type { Shot } from '@/types/shot-system';

export type ShotExecutionItemStatus = 'queued' | 'running' | 'done' | 'failed' | 'skipped';
export type ShotExecutionQueueStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface ShotExecutionQueueItem {
  shotId: string;
  title: string;
  index: number;
  status: ShotExecutionItemStatus;
  executedCount: number;
  failedCount: number;
  error?: string;
}

interface ShotExecutionState {
  status: ShotExecutionQueueStatus;
  items: ShotExecutionQueueItem[];
  currentShotId: string | null;
  startedAt?: string;
  completedAt?: string;
  startQueue: (shots: Shot[]) => void;
  markRunning: (shotId: string) => void;
  markDone: (shotId: string, executedCount: number) => void;
  markFailed: (shotId: string, error?: string, failedCount?: number) => void;
  markSkipped: (shotId: string, reason?: string) => void;
  finishQueue: () => void;
  resetQueue: () => void;
}

function summarizeStatus(items: ShotExecutionQueueItem[]): ShotExecutionQueueStatus {
  if (items.length === 0) return 'idle';
  if (items.some((item) => item.status === 'running' || item.status === 'queued')) return 'running';
  return items.some((item) => item.status === 'failed') ? 'failed' : 'completed';
}

export const useShotExecutionStore = create<ShotExecutionState>()((set) => ({
  status: 'idle',
  items: [],
  currentShotId: null,

  startQueue: (shots) =>
    set({
      status: shots.length > 0 ? 'running' : 'idle',
      items: shots.map((shot) => ({
        shotId: shot.id,
        title: shot.title,
        index: shot.index,
        status: 'queued',
        executedCount: 0,
        failedCount: 0,
      })),
      currentShotId: null,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
    }),

  markRunning: (shotId) =>
    set((state) => ({
      status: 'running',
      currentShotId: shotId,
      items: state.items.map((item) =>
        item.shotId === shotId ? { ...item, status: 'running', error: undefined } : item
      ),
    })),

  markDone: (shotId, executedCount) =>
    set((state) => {
      const items = state.items.map((item) =>
        item.shotId === shotId
          ? { ...item, status: 'done' as const, executedCount, failedCount: 0, error: undefined }
          : item
      );

      return {
        items,
        currentShotId: null,
        status: summarizeStatus(items),
      };
    }),

  markFailed: (shotId, error, failedCount = 1) =>
    set((state) => {
      const items = state.items.map((item) =>
        item.shotId === shotId
          ? { ...item, status: 'failed' as const, failedCount, error: error || '执行失败' }
          : item
      );

      return {
        items,
        currentShotId: null,
        status: summarizeStatus(items),
      };
    }),

  markSkipped: (shotId, reason) =>
    set((state) => {
      const items = state.items.map((item) =>
        item.shotId === shotId
          ? { ...item, status: 'skipped' as const, error: reason || '已跳过' }
          : item
      );

      return {
        items,
        currentShotId: null,
        status: summarizeStatus(items),
      };
    }),

  finishQueue: () =>
    set((state) => ({
      status: state.items.some((item) => item.status === 'failed') ? 'failed' : 'completed',
      currentShotId: null,
      completedAt: new Date().toISOString(),
    })),

  resetQueue: () =>
    set({
      status: 'idle',
      items: [],
      currentShotId: null,
      startedAt: undefined,
      completedAt: undefined,
    }),
}));
