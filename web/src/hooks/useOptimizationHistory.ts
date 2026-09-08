/**
 * 优化历史管理Hook
 * 提供撤销/重做功能
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  HistoryAction,
  HistoryActionType,
  OptimizationSnapshot,
  HistoryConfig,
} from '@/types/optimization-history-manager';
import { DEFAULT_HISTORY_CONFIG } from '@/types/optimization-history-manager';

interface UseOptimizationHistoryReturn {
  /** 当前状态 */
  currentSnapshot: OptimizationSnapshot | null;
  /** 是否可以撤销 */
  canUndo: boolean;
  /** 是否可以重做 */
  canRedo: boolean;
  /** 撤销历史 */
  undoHistory: HistoryAction[];
  /** 重做历史 */
  redoHistory: HistoryAction[];
  /** 总历史数量 */
  totalHistoryCount: number;
  /** 记录动作 */
  recordAction: (
    type: HistoryActionType,
    beforeState: OptimizationSnapshot,
    afterState: OptimizationSnapshot,
    description?: string,
    options?: Partial<{ mode: string; tags: string[]; versionId: string }>
  ) => string;
  /** 执行撤销 */
  undo: () => OptimizationSnapshot | null;
  /** 执行重做 */
  redo: () => OptimizationSnapshot | null;
  /** 获取历史 */
  getHistory: () => HistoryAction[];
  /** 跳转到指定历史 */
  jumpToHistory: (actionId: string) => OptimizationSnapshot | null;
  /** 清空历史 */
  clearHistory: () => void;
  /** 获取指定历史的快照 */
  getSnapshot: (actionId: string, position: 'before' | 'after') => OptimizationSnapshot | null;
}

const STORAGE_KEY = 'optimization_history_v2';

export function useOptimizationHistory(
  initialConfig?: Partial<HistoryConfig>
): UseOptimizationHistoryReturn {
  const config = { ...DEFAULT_HISTORY_CONFIG, ...initialConfig };
  
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<OptimizationSnapshot | null>(null);
  
  const lastSnapshotTimeRef = useRef<number>(0);
  const initializedRef = useRef(false);

  // 从localStorage恢复
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setUndoStack(data.undoStack || []);
        setRedoStack(data.redoStack || []);
        setCurrentSnapshot(data.currentSnapshot || null);
      }
    } catch (error) {
      console.error('[History] 恢复历史失败:', error);
    }
  }, []);

  // 保存到localStorage
  useEffect(() => {
    if (!initializedRef.current) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        undoStack,
        redoStack,
        currentSnapshot,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      console.error('[History] 保存历史失败:', error);
      // 如果存储满了，清理旧数据
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        setUndoStack(prev => prev.slice(-Math.floor(config.maxHistorySize / 2)));
      }
    }
  }, [undoStack, redoStack, currentSnapshot, config.maxHistorySize]);

  // 生成唯一ID
  const generateId = useCallback(() => {
    return `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // 检查是否应该忽略动作
  const shouldIgnoreAction = useCallback((type: HistoryActionType) => {
    return config.ignoredActions?.includes(type) ?? false;
  }, [config.ignoredActions]);

  // 记录动作
  const recordAction = useCallback((
    type: HistoryActionType,
    beforeState: OptimizationSnapshot,
    afterState: OptimizationSnapshot,
    description?: string,
    options?: { mode?: string; tags?: string[]; versionId?: string }
  ): string => {
    // 检查是否应该忽略
    if (shouldIgnoreAction(type)) {
      return '';
    }

    // 节流检查
    const now = Date.now();
    if (config.autoSaveSnapshot && 
        now - lastSnapshotTimeRef.current < config.snapshotThrottle) {
      return '';
    }
    lastSnapshotTimeRef.current = now;

    const actionId = generateId();
    
    const action: HistoryAction = {
      id: actionId,
      type,
      timestamp: now,
      description: description || getDefaultDescription(type, options?.mode),
      mode: options?.mode as any,
      beforeState,
      afterState,
      canUndo: true,
      canRedo: false,
      tags: options?.tags,
      versionId: options?.versionId,
    };

    setUndoStack(prev => {
      const newStack = [...prev, action];
      // 限制历史数量
      if (newStack.length > config.maxHistorySize) {
        return newStack.slice(-config.maxHistorySize);
      }
      return newStack;
    });

    // 清空重做栈
    setRedoStack([]);
    
    // 更新当前快照
    setCurrentSnapshot(afterState);

    return actionId;
  }, [config, generateId, shouldIgnoreAction]);

  // 获取默认描述
  const getDefaultDescription = (type: HistoryActionType, mode?: string): string => {
    const modeText = mode ? ` (${mode})` : '';
    switch (type) {
      case 'optimize':
        return `优化操作${modeText}`;
      case 'template_apply':
        return '应用模板';
      case 'template_merge':
        return '合并模板';
      case 'quality_analyze':
        return '质量分析';
      case 'version_restore':
        return '版本恢复';
      case 'batch_operate':
        return '批量操作';
      default:
        return '未知操作';
    }
  };

  // 执行撤销
  const undo = useCallback((): OptimizationSnapshot | null => {
    if (undoStack.length === 0) return null;

    const lastAction = undoStack[undoStack.length - 1];
    
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, { ...lastAction, canUndo: false, canRedo: true }]);
    setCurrentSnapshot(lastAction.beforeState);

    return lastAction.beforeState;
  }, [undoStack]);

  // 执行重做
  const redo = useCallback((): OptimizationSnapshot | null => {
    if (redoStack.length === 0) return null;

    const lastAction = redoStack[redoStack.length - 1];
    
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, { ...lastAction, canUndo: true, canRedo: false }]);
    setCurrentSnapshot(lastAction.afterState);

    return lastAction.afterState;
  }, [redoStack]);

  // 获取历史
  const getHistory = useCallback((): HistoryAction[] => {
    return [...undoStack].reverse();
  }, [undoStack]);

  // 跳转到指定历史
  const jumpToHistory = useCallback((actionId: string): OptimizationSnapshot | null => {
    const actionIndex = undoStack.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return null;

    const action = undoStack[actionIndex];
    
    // 将该操作之后的历史移到重做栈
    const actionsToMove = undoStack.slice(actionIndex + 1);
    const actionsToKeep = undoStack.slice(0, actionIndex);
    
    setUndoStack(actionsToKeep);
    setRedoStack(prev => [
      ...prev,
      ...actionsToMove.map(a => ({ ...a, canUndo: false, canRedo: true })).reverse(),
    ]);
    
    setCurrentSnapshot(action.afterState);

    return action.afterState;
  }, [undoStack]);

  // 清空历史
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // 获取指定历史的快照
  const getSnapshot = useCallback((
    actionId: string,
    position: 'before' | 'after'
  ): OptimizationSnapshot | null => {
    const action = undoStack.find(a => a.id === actionId);
    if (!action) return null;
    
    return position === 'before' ? action.beforeState : action.afterState;
  }, [undoStack]);

  return {
    currentSnapshot,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoHistory: undoStack,
    redoHistory: redoStack,
    totalHistoryCount: undoStack.length + redoStack.length,
    recordAction,
    undo,
    redo,
    getHistory,
    jumpToHistory,
    clearHistory,
    getSnapshot,
  };
}
