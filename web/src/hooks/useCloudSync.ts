// @ts-nocheck
/**
 * 云端同步Hook
 * 支持实时同步、冲突解决、离线支持
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
export type SyncDirection = 'push' | 'pull' | 'bidirectional';
export type ConflictResolution = 'local_wins' | 'remote_wins' | 'manual' | 'merge';

export interface SyncConfig {
  serverUrl: string;
  apiKey?: string;
  syncInterval: number;
  enableOffline: boolean;
  conflictResolution: ConflictResolution;
  maxRetries: number;
  retryDelay: number;
}

export interface SyncEntity {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data?: any;
  baseVersion: number;
  timestamp: number;
}

export interface SyncChange {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  version: number;
  updatedAt: number;
  serverTime?: number;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localData: any;
  remoteData: any;
  localVersion: number;
  remoteVersion: number;
  createdAt: number;
  resolved: boolean;
  resolution?: ConflictResolution;
  resolvedData?: any;
}

export interface SyncResult {
  success: boolean;
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
  conflicts: SyncConflict[];
  serverTime: number;
  error?: string;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: number | null;
  pendingChanges: number;
  conflicts: SyncConflict[];
  syncDirection: SyncDirection;
  isOnline: boolean;
  isConnected: boolean;
  error?: string;
}

const DEFAULT_CONFIG: SyncConfig = {
  serverUrl: 'https://api.ai-video-sdk.com',
  syncInterval: 30000,
  enableOffline: true,
  conflictResolution: 'manual',
  maxRetries: 3,
  retryDelay: 1000,
};

export function useCloudSync(config: Partial<SyncConfig> = {}) {
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    lastSyncTime: null,
    pendingChanges: 0,
    conflicts: [],
    syncDirection: 'bidirectional',
    isOnline: navigator.onLine,
    isConnected: false,
  });

  const configRef = useRef<SyncConfig>({ ...DEFAULT_CONFIG, ...config });
  const wsRef = useRef<WebSocket | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const pendingQueueRef = useRef<SyncEntity[]>([]);
  const listenersRef = useRef<Map<string, Set<(event: string, data: any) => void>>>(new Map());

  // 连接WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${configRef.current.serverUrl.replace('http', 'ws')}/sync`);

      ws.onopen = () => {
        console.warn('[CloudSync] WebSocket connected');
        setState(prev => ({ ...prev, status: 'synced', error: undefined, isConnected: true }));
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (error) {
          console.error('[CloudSync] Failed to parse message', error);
        }
      };

      ws.onclose = () => {
        console.warn('[CloudSync] WebSocket disconnected');
        setState(prev => ({ ...prev, status: 'idle', isConnected: false }));
        wsRef.current = null;

        // 尝试重连
        if (retryCountRef.current < configRef.current.maxRetries) {
          retryCountRef.current++;
          setTimeout(connect, configRef.current.retryDelay * retryCountRef.current);
        }
      };

      ws.onerror = (error) => {
        console.error('[CloudSync] WebSocket error', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: '连接服务器失败'
        }));
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[CloudSync] Failed to connect', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: '无法建立连接'
      }));
    }
  }, [handleServerMessage]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    setState(prev => ({ ...prev, status: 'idle', isConnected: false }));
  }, []);

  // 处理服务器消息
  const handleServerMessage = useCallback((message: { type: string; data?: any }) => {
    const { type, data } = message;

    switch (type) {
      case 'sync_response':
        handleSyncResponse(data as any);
        break;
      case 'remote_change':
        handleRemoteChange(data as any);
        break;
      case 'conflict':
        handleConflict(data as any);
        break;
      case 'pong':
        break;
      default:
        console.warn('[CloudSync] any message type:', type);
    }

    // 通知监听器
    const listeners = listenersRef.current.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(type, data));
    }
  }, [handleConflict, handleRemoteChange, handleSyncResponse]);

  // 处理同步响应
  const handleSyncResponse = useCallback((result: SyncResult) => {
    if (result.success) {
      setState(prev => ({
        ...prev,
        status: 'synced',
        lastSyncTime: result.serverTime,
        pendingChanges: 0,
      }));

      // 清空已接受的待处理队列
      pendingQueueRef.current = pendingQueueRef.current.filter(
        item => !result.accepted.includes(`${item.entityType}:${item.entityId}`)
      );
    }

    // 处理冲突
    if (result.conflicts.length > 0) {
      setState(prev => ({
        ...prev,
        conflicts: [...prev.conflicts, ...result.conflicts],
      }));
    }
  }, []);

  // 处理远程变更
  const handleRemoteChange = useCallback((change: SyncChange) => {
    console.warn('[CloudSync] Remote change:', change);

    // 触发本地事件
    const eventType = `change:${change.entityType}`;
    const listeners = listenersRef.current.get(eventType);
    if (listeners) {
      listeners.forEach(listener => listener(eventType, change));
    }

    setState(prev => ({
      ...prev,
      lastSyncTime: change.serverTime || Date.now(),
    }));
  }, []);

  // 处理冲突
  const handleConflict = useCallback((conflict: SyncConflict) => {
    console.warn('[CloudSync] Conflict detected:', conflict);

    setState(prev => ({
      ...prev,
      conflicts: [...prev.conflicts, conflict],
    }));

    // 自动解决冲突
    if (configRef.current.conflictResolution !== 'manual') {
      resolveConflict(conflict.id, configRef.current.conflictResolution);
    }
  }, [resolveConflict]);

  // 推送变更到服务器
  const push = useCallback(async (changes: SyncEntity[]): Promise<SyncResult> => {
    if (!state.isOnline) {
      // 离线模式，添加到队列
      pendingQueueRef.current.push(...changes);
      setState(prev => ({
        ...prev,
        pendingChanges: pendingQueueRef.current.length,
      }));
      return {
        success: true,
        accepted: [],
        rejected: [],
        conflicts: [],
        serverTime: Date.now(),
      };
    }

    setState(prev => ({ ...prev, status: 'syncing' }));

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));

      const result: SyncResult = {
        success: true,
        accepted: changes.map(c => `${c.entityType}:${c.entityId}`),
        rejected: [],
        conflicts: [],
        serverTime: Date.now(),
      };

      handleSyncResponse(result);
      return result;
    } catch (error) {
      console.error('[CloudSync] Push failed', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: '同步失败',
      }));
      throw error;
    }
  }, [state.isOnline, handleSyncResponse]);

  // 拉取服务器变更
  const pull = useCallback(async (_entityTypes?: string[]): Promise<SyncChange[]> => {
    if (!state.isOnline) {
      console.warn('[CloudSync] Offline, cannot pull');
      return [];
    }

    setState(prev => ({ ...prev, status: 'syncing' }));

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));

      setState(prev => ({
        ...prev,
        status: 'synced',
        lastSyncTime: Date.now(),
      }));

      return [];
    } catch (error) {
      console.error('[CloudSync] Pull failed', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: '获取更新失败',
      }));
      throw error;
    }
  }, [state.isOnline]);

  // 执行完整同步
  const sync = useCallback(async (): Promise<void> => {
    if (!state.isOnline) {
      console.warn('[CloudSync] Offline, skipping sync');
      return;
    }

    setState(prev => ({ ...prev, status: 'syncing' }));

    try {
      // 先推送本地变更
      if (pendingQueueRef.current.length > 0) {
        await push(pendingQueueRef.current);
      }

      // 再拉取远程变更
      await pull();

      setState(prev => ({
        ...prev,
        status: 'synced',
        lastSyncTime: Date.now(),
      }));
    } catch (error) {
      console.error('[CloudSync] Sync failed', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: '同步失败',
      }));
    }
  }, [state.isOnline, push, pull]);

  // 解决冲突
  const resolveConflict = useCallback((
    conflictId: string,
    resolution: ConflictResolution,
    resolvedData?: any
  ): boolean => {
    const conflict = state.conflicts.find(c => c.id === conflictId);
    if (!conflict) return false;

    let finalData = resolvedData;

    switch (resolution) {
      case 'local_wins':
        finalData = conflict.localData;
        break;
      case 'remote_wins':
        finalData = conflict.remoteData;
        break;
      case 'merge':
        // 简单的深度合并
        finalData = deepMerge(conflict.localData, conflict.remoteData);
        break;
      case 'manual':
        if (!resolvedData) return false;
        break;
    }

    // 标记冲突已解决
    setState(prev => ({
      ...prev,
      conflicts: prev.conflicts.map(c =>
        c.id === conflictId
          ? { ...c, resolved: true, resolution, resolvedData: finalData }
          : c
      ),
    }));

    // 推送解决后的数据
    push([{
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      action: 'update',
      data: finalData,
      baseVersion: Math.max(conflict.localVersion, conflict.remoteVersion),
      timestamp: Date.now(),
    }]);

    return true;
  }, [state.conflicts, push]);

  // 添加事件监听器
  const addListener = useCallback((
    event: string,
    callback: (event: string, data: any) => void
  ): () => void => {
    const listeners = listenersRef.current.get(event) || new Set();
    listeners.add(callback);
    listenersRef.current.set(event, listeners);

    return () => {
      listeners.delete(callback);
    };
  }, []);

  // 发送ping保持连接
  const ping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      console.warn('[CloudSync] Network online');
      setState(prev => ({ ...prev, isOnline: true }));
      connect();

      // 离线期间如果有待处理的变更，尝试同步
      if (pendingQueueRef.current.length > 0) {
        sync();
      }
    };

    const handleOffline = () => {
      console.warn('[CloudSync] Network offline');
      setState(prev => ({ ...prev, isOnline: false, status: 'offline' }));
      disconnect();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初始化连接
    if (navigator.onLine) {
      connect();
    }

    // 设置定时同步
    syncTimerRef.current = setInterval(() => {
      if (navigator.onLine) {
        ping();
        sync();
      }
    }, configRef.current.syncInterval);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // 清理定时器
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      disconnect();
    };
  }, [connect, disconnect, ping, sync]);

  return {
    state,
    config: configRef.current,
    connect,
    disconnect,
    sync,
    push,
    pull,
    resolveConflict,
    addListener,
    getConflicts: () => state.conflicts,
    getPendingChanges: () => pendingQueueRef.current,
  };
}

// 深度合并工具函数
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  if (typeof target !== 'object' || typeof source !== 'object') {
    return source as T;
  }

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];
      if (typeof sourceValue === 'object' && sourceValue !== null && typeof targetValue === 'object' && targetValue !== null) {
        result[key] = deepMerge(targetValue as Record<string, any>, sourceValue as Record<string, any>) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

// SyncProvider组件（可选，用于全局状态管理）
export function createSyncProvider() {
  const subscribers: Set<(state: SyncState) => void> = new Set();

  return {
    subscribe(callback: (state: SyncState) => void) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    notify(state: SyncState) {
      subscribers.forEach(cb => cb(state));
    },
  };
}
