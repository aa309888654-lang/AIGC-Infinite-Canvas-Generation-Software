/**
 * 节点执行状态 Store
 *
 * 取代 real-api-executor.ts 中模块级 `executingNodeIds` Set：
 * 1. HMR 安全 — zustand store 在模块重新加载后仍保留
 * 2. 熔断器 — 连续失败 3 次开熔断 60s
 * 3. 锁超时 — 30s 自动释放，避免永久锁定
 * 4. 可观测性 — failureCount/circuitOpen 可被 UI 订阅
 */

import { create } from 'zustand';

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_DURATION_MS = 60_000;
const LOCK_TIMEOUT_MS = 30_000;
const LOCK_CLEANUP_INTERVAL_MS = 5_000;

interface LockEntry {
  nodeId: string;
  acquiredAt: number;
}

interface NodeExecutionState {
  /** 当前持有锁的节点（带获取时间，用于超时清理） */
  locks: Map<string, LockEntry>;
  /** 节点失败次数（连续） */
  failureCount: Record<string, number>;
  /** 节点最近失败时间戳 */
  lastFailureAt: Record<string, number>;
  /** 熔断状态：nodeId → 熔断到期时间戳 */
  circuitOpenUntil: Record<string, number>;

  /** 尝试获取节点执行锁，成功返回 true */
  acquireLock: (nodeId: string) => boolean;
  /** 释放节点执行锁 */
  releaseLock: (nodeId: string) => void;
  /** 记录节点执行失败（用于熔断判定） */
  recordFailure: (nodeId: string) => void;
  /** 记录节点执行成功（清零失败计数） */
  recordSuccess: (nodeId: string) => void;
  /** 判断节点是否处于熔断状态 */
  isCircuitOpen: (nodeId: string) => boolean;
  /** 查询节点是否持有锁 */
  isExecuting: (nodeId: string) => boolean;
  /** 获取当前执行中的节点 ID 列表（兼容旧 API） */
  getExecutingNodeIds: () => string[];
  /** 清理超时锁（定时调用） */
  cleanupStaleLocks: () => void;
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer !== null) return;
  if (typeof window === 'undefined') return;
  cleanupTimer = setInterval(() => {
    useNodeExecutionStore.getState().cleanupStaleLocks();
  }, LOCK_CLEANUP_INTERVAL_MS);
}

export const useNodeExecutionStore = create<NodeExecutionState>((set, get) => ({
  locks: new Map(),
  failureCount: {},
  lastFailureAt: {},
  circuitOpenUntil: {},

  acquireLock: (nodeId: string): boolean => {
    const state = get();
    if (state.locks.has(nodeId)) {
      const entry = state.locks.get(nodeId)!;
      // 锁超时自动释放
      if (Date.now() - entry.acquiredAt > LOCK_TIMEOUT_MS) {
        // fallthrough to acquire
      } else {
        return false;
      }
    }
    if (state.isCircuitOpen(nodeId)) {
      return false;
    }
    const newLocks = new Map(state.locks);
    newLocks.set(nodeId, { nodeId, acquiredAt: Date.now() });
    set({ locks: newLocks });
    ensureCleanupTimer();
    return true;
  },

  releaseLock: (nodeId: string): void => {
    const state = get();
    if (!state.locks.has(nodeId)) return;
    const newLocks = new Map(state.locks);
    newLocks.delete(nodeId);
    set({ locks: newLocks });
  },

  recordFailure: (nodeId: string): void => {
    const state = get();
    const count = (state.failureCount[nodeId] || 0) + 1;
    const now = Date.now();
    const newFailureCount = { ...state.failureCount, [nodeId]: count };
    const newLastFailureAt = { ...state.lastFailureAt, [nodeId]: now };
    const newCircuitOpenUntil = { ...state.circuitOpenUntil };

    if (count >= CIRCUIT_FAILURE_THRESHOLD) {
      newCircuitOpenUntil[nodeId] = now + CIRCUIT_OPEN_DURATION_MS;
    }

    set({
      failureCount: newFailureCount,
      lastFailureAt: newLastFailureAt,
      circuitOpenUntil: newCircuitOpenUntil,
    });
  },

  recordSuccess: (nodeId: string): void => {
    const state = get();
    if (state.failureCount[nodeId] === undefined) return;
    const newFailureCount = { ...state.failureCount };
    delete newFailureCount[nodeId];
    const newCircuitOpenUntil = { ...state.circuitOpenUntil };
    delete newCircuitOpenUntil[nodeId];
    set({ failureCount: newFailureCount, circuitOpenUntil: newCircuitOpenUntil });
  },

  isCircuitOpen: (nodeId: string): boolean => {
    const state = get();
    const until = state.circuitOpenUntil[nodeId];
    if (!until) return false;
    if (Date.now() >= until) {
      // 熔断到期，自动清除
      const newCircuitOpenUntil = { ...state.circuitOpenUntil };
      delete newCircuitOpenUntil[nodeId];
      const newFailureCount = { ...state.failureCount };
      delete newFailureCount[nodeId];
      set({ circuitOpenUntil: newCircuitOpenUntil, failureCount: newFailureCount });
      return false;
    }
    return true;
  },

  isExecuting: (nodeId: string): boolean => {
    return get().locks.has(nodeId);
  },

  getExecutingNodeIds: (): string[] => {
    return Array.from(get().locks.keys());
  },

  cleanupStaleLocks: (): void => {
    const state = get();
    const now = Date.now();
    let changed = false;
    const newLocks = new Map(state.locks);
    for (const [nodeId, entry] of newLocks) {
      if (now - entry.acquiredAt > LOCK_TIMEOUT_MS) {
        newLocks.delete(nodeId);
        changed = true;
        console.warn(
          `[useNodeExecutionStore] 节点 ${nodeId} 锁超时自动释放（${LOCK_TIMEOUT_MS / 1000}s）`
        );
      }
    }
    if (changed) set({ locks: newLocks });
  },
}));

/** 兼容旧 API：模块级 Set 替代品 */
export const nodeExecutionLockApi = {
  has: (nodeId: string) => useNodeExecutionStore.getState().isExecuting(nodeId),
  add: (nodeId: string) => {
    useNodeExecutionStore.getState().acquireLock(nodeId);
  },
  delete: (nodeId: string) => {
    useNodeExecutionStore.getState().releaseLock(nodeId);
  },
  size: 0, // 兼容读取，实际值通过 getExecutingNodeIds().length 获取
};
