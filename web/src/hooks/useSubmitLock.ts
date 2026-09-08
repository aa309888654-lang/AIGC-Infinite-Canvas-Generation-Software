/**
 * 统一防重复提交锁
 *
 * 解决问题：P0-8 节点 isSubmitting 竞态导致重复提交
 * 原实现：setTimeout(() => setIsSubmitting(false), 3000) — 3 秒固定时器
 * 问题：task.status 延迟更新（>3s）时锁提前释放，用户连点会触发重复提交
 *
 * 改进：
 * 1. 基于 task.status 判断是否仍在运行，而非定时器兜底
 * 2. 30 秒兜底超时（防止 task.status 永不到达终态）
 * 3. 注册到 nodeTaskRegistry，节点删除时自动释放锁
 *
 * 用法：
 *   const { isSubmitting, acquireLock, releaseLock, isTaskRunning } = useSubmitLock(nodeData);
 *
 *   const handleExecute = () => {
 *     if (!acquireLock()) return;  // 获取锁失败 = 已有任务在跑
 *     // ... 触发执行
 *   };
 *
 *   // task.status 变为终态时释放锁（在 useEffect 中处理）
 *   useEffect(() => {
 *     const status = nodeData.task?.status;
 *     if (status === 'completed' || status === 'failed' || status === 'cancelled') {
 *       releaseLock();
 *     }
 *   }, [nodeData.task?.status, releaseLock]);
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { nodeTaskRegistry } from '@/services/node-task-registry';

export interface UseSubmitLockOptions {
  /** 节点 ID（用于注册到 nodeTaskRegistry，节点删除时自动释放锁） */
  nodeId?: string;
  /** 兜底超时（毫秒），默认 30 秒 */
  timeoutMs?: number;
  /** task 状态字段路径，默认读 nodeData.task?.status */
  taskStatusGetter?: () => string | undefined;
}

export interface UseSubmitLockReturn {
  /** 是否正在提交中（true 时禁止再次提交） */
  isSubmitting: boolean;
  /** 获取锁，返回 true 表示获锁成功可继续执行；false 表示已有任务在跑 */
  acquireLock: () => boolean;
  /** 释放锁（任务终态时调用） */
  releaseLock: () => void;
  /** 当前 task 是否仍在运行（pending/processing） */
  isTaskRunning: () => boolean;
}

const RUNNING_STATUSES = new Set(['pending', 'processing', 'queued', 'running']);

export function useSubmitLock(
  nodeData: { task?: { status?: string } } | undefined,
  options: UseSubmitLockOptions = {},
): UseSubmitLockReturn {
  const { nodeId, timeoutMs = 30000, taskStatusGetter } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getTaskStatus = useCallback((): string | undefined => {
    if (taskStatusGetter) return taskStatusGetter();
    return nodeData?.task?.status;
  }, [nodeData?.task?.status, taskStatusGetter]);

  const isTaskRunning = useCallback((): boolean => {
    const status = getTaskStatus();
    return !!status && RUNNING_STATUSES.has(status);
  }, [getTaskStatus]);

  const releaseLock = useCallback((): void => {
    submittingRef.current = false;
    setIsSubmitting(false);
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
  }, []);

  const acquireLock = useCallback((): boolean => {
    // task 已在运行，不允许提交
    if (isTaskRunning()) {
      return false;
    }
    // isSubmitting 锁定中，不允许提交；ref 可同步拦截同一轮事件循环内的极快连点
    if (isSubmitting || submittingRef.current) {
      return false;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    // 兜底超时：30s 后自动释放（防止 task.status 永不到达终态导致按钮永久禁用）
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
    }
    lockTimeoutRef.current = setTimeout(() => {
      submittingRef.current = false;
      setIsSubmitting(false);
      lockTimeoutRef.current = null;
      console.warn('[useSubmitLock] 锁超时自动释放（' + timeoutMs + 'ms）');
    }, timeoutMs);
    return true;
  }, [isSubmitting, isTaskRunning, timeoutMs]);

  // 注册到 nodeTaskRegistry：节点删除时自动释放锁
  useEffect(() => {
    if (!nodeId) return;
    const cancelFn = () => {
      submittingRef.current = false;
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
        lockTimeoutRef.current = null;
      }
      setIsSubmitting(false);
    };
    nodeTaskRegistry.register(nodeId, cancelFn);
    return () => {
      nodeTaskRegistry.unregister(nodeId, cancelFn);
    };
  }, [nodeId]);

  // ✅ task.status 变为终态时自动释放锁（核心修复）
  // 解决原 setTimeout(3000) 竞态：task.status 延迟更新 > 3s 时锁提前释放
  useEffect(() => {
    const status = getTaskStatus();
    if (
      status &&
      status !== 'pending' &&
      status !== 'processing' &&
      status !== 'queued' &&
      status !== 'running' &&
      status !== 'idle'
    ) {
      // 终态（completed/failed/cancelled/payment_pending 等）→ 释放锁
      if (isSubmitting) {
        releaseLock();
      }
    }
  }, [getTaskStatus, isSubmitting, releaseLock]);

  // 安全网：isSubmitting=true 但 15s 内未检测到 task.status 时自动释放锁
  // 防止 executeSingleNode 提前返回（未登录/权限不足/参数校验失败等）且未设置 failed task 时锁卡死
  useEffect(() => {
    if (!isSubmitting) return;
    const watchdogTimer = setTimeout(() => {
      const currentStatus = getTaskStatus();
      if (!currentStatus) {
        console.warn('[useSubmitLock] 15s 内未检测到 task.status，自动释放锁');
        releaseLock();
      }
    }, 15000);
    return () => clearTimeout(watchdogTimer);
  }, [isSubmitting, getTaskStatus, releaseLock]);

  // 组件 unmount 时清理超时
  useEffect(() => {
    return () => {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
        lockTimeoutRef.current = null;
      }
    };
  }, []);

  return { isSubmitting, acquireLock, releaseLock, isTaskRunning };
}
