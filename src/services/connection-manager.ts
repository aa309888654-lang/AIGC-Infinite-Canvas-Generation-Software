/**
 * 连接管理器
 * 管理API连接状态，支持监听器模式
 *
 * 使用 @/types/core 中的统一类型定义
 */

import type { UnifiedAPIProvider, UnifiedConnectionStatus, AIModelProvider } from '@/types/core';
import { toUnifiedProvider as convertToUnified } from '@/types/core';

// 连接状态管理器 - 单例模式
export class ConnectionManager {
  private static instance: ConnectionManager;
  private connectionStatuses: Record<UnifiedAPIProvider, UnifiedConnectionStatus> = {} as Record<UnifiedAPIProvider, UnifiedConnectionStatus>;
  private listeners: Array<(statuses: Record<UnifiedAPIProvider, UnifiedConnectionStatus>) => void> = [];

  private constructor() {
    this.initializeConnectionStatuses();
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  private initializeConnectionStatuses(): void {
    const providers: UnifiedAPIProvider[] = [
      'jimeng', 'doubao', 'doubao-video', 'bytedance',
      'stabilityAI', 'haiper',
      'minimax', 'minimaxVideo', 'adobe', 'adobeFirefly',
      'leonardoAI', 'ideogram', 'recraftAI', 'seedream',
      'flux', 'huawei', 'huaweiVideo',
      'vidu', 'aliyun-wan', 'hailuo'
    ];

    providers.forEach(provider => {
      this.connectionStatuses[provider] = {
        provider,
        status: 'disconnected',
        lastChecked: new Date(),
      };
    });
  }

  /**
   * 使用 UnifiedAPIProvider 更新连接状态
   */
  updateConnectionStatus(provider: UnifiedAPIProvider, status: Partial<UnifiedConnectionStatus>): void {
    this.connectionStatuses[provider] = {
      ...this.connectionStatuses[provider],
      ...status,
      lastChecked: new Date(),
    };
    this.notifyListeners();
  }

  /**
   * 使用 AIModelProvider 更新连接状态（向后兼容）
   * @deprecated 请使用 updateConnectionStatus
   */
  updateConnectionStatusLegacy(provider: AIModelProvider, status: Partial<UnifiedConnectionStatus>): void {
    const unifiedProvider = convertToUnified(provider);
    this.updateConnectionStatus(unifiedProvider, status);
  }

  /**
   * 使用 UnifiedAPIProvider 获取连接状态
   */
  getConnectionStatus(provider: UnifiedAPIProvider): UnifiedConnectionStatus {
    return this.connectionStatuses[provider];
  }

  /**
   * 使用 AIModelProvider 获取连接状态（向后兼容）
   * @deprecated 请使用 getConnectionStatus
   */
  getConnectionStatusLegacy(provider: AIModelProvider): UnifiedConnectionStatus {
    const unifiedProvider = convertToUnified(provider);
    return this.getConnectionStatus(unifiedProvider);
  }

  getAllConnectionStatuses(): Record<UnifiedAPIProvider, UnifiedConnectionStatus> {
    return { ...this.connectionStatuses };
  }

  addListener(listener: (statuses: Record<UnifiedAPIProvider, UnifiedConnectionStatus>) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (statuses: Record<UnifiedAPIProvider, UnifiedConnectionStatus>) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    const statuses = this.getAllConnectionStatuses();
    this.listeners.forEach(listener => listener(statuses));
  }
}

// 导出单例
export const connectionManager = ConnectionManager.getInstance();

// 向后兼容类型导出
export type ConnectionStatus = UnifiedConnectionStatus;
