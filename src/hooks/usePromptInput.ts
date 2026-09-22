/**
 * 提示词输入状态管理 Hook
 * 实现乐观更新和批量同步机制，优化性能
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePromptInputOptions {
  /** 初始值 */
  initialValue?: string;
  /** 防抖延迟（毫秒） */
  debounceMs?: number;
  /** 是否立即同步到全局状态 */
  immediate?: boolean;
  /** 值变化回调 */
  onChange?: (value: string) => void;
}

interface UsePromptInputReturn {
  /** 当前值 */
  value: string;
  /** 是否正在同步到全局状态 */
  isPending: boolean;
  /** 是否值已改变但尚未同步 */
  isDirty: boolean;
  /** 设置值（触发防抖同步） */
  setValue: (newValue: string) => void;
  /** 强制立即同步 */
  flush: () => void;
  /** 重置为初始值 */
  reset: () => void;
}

export function usePromptInput(options: UsePromptInputOptions = {}): UsePromptInputReturn {
  const {
    initialValue = '',
    debounceMs = 150,
    immediate = false,
    onChange,
  } = options;

  const [value, setValueInternal] = useState(initialValue);
  const [isPending, setIsPending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  const lastSyncedValueRef = useRef<string>(initialValue);
  const isMountedRef = useRef(true);

  // 清理函数
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 执行同步回调
  const executeSync = useCallback((valueToSync: string) => {
    if (onChange && valueToSync !== lastSyncedValueRef.current) {
      try {
        onChange(valueToSync);
        lastSyncedValueRef.current = valueToSync;
      } catch (error) {
        console.error('[usePromptInput] Sync failed:', error);
      } finally {
        if (isMountedRef.current) {
          setIsPending(false);
        }
      }
    } else {
      if (isMountedRef.current) {
        setIsPending(false);
      }
    }
  }, [onChange]);

  // 设置值
  const setValue = useCallback((newValue: string) => {
    // 乐观更新：立即更新本地状态
    setValueInternal(newValue);
    
    // 检查是否有变化
    const hasChanged = newValue !== lastSyncedValueRef.current;
    setIsDirty(hasChanged);
    
    if (!hasChanged) {
      return;
    }

    // 如果是立即模式，立即同步
    if (immediate) {
      setIsPending(true);
      executeSync(newValue);
      return;
    }

    // 防抖同步
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    pendingValueRef.current = newValue;
    setIsPending(true);

    debounceTimerRef.current = setTimeout(() => {
      if (pendingValueRef.current !== null && isMountedRef.current) {
        executeSync(pendingValueRef.current);
        setIsDirty(false);
      }
    }, debounceMs);
  }, [debounceMs, immediate, executeSync]);

  // 强制立即同步
  const flush = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    if (pendingValueRef.current !== null && pendingValueRef.current !== lastSyncedValueRef.current) {
      setIsPending(true);
      executeSync(pendingValueRef.current);
      setIsDirty(false);
    }
  }, [executeSync]);

  // 重置
  const reset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    setValueInternal(initialValue);
    setIsDirty(false);
    setIsPending(false);
    pendingValueRef.current = null;
    lastSyncedValueRef.current = initialValue;
  }, [initialValue]);

  return {
    value,
    isPending,
    isDirty,
    setValue,
    flush,
    reset,
  };
}
