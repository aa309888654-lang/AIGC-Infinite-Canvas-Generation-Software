/**
 * frontend-sync-service — 前端数据同步服务（存根）
 *
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

export interface SyncProgress {
  phase: string;
  progress: number;
  message?: string;
}

class FrontendDataSyncService {
  getLastSyncTime(): string | null {
    return null;
  }

  async autoSync(_options?: { includeSensitive?: boolean }): Promise<void> {
    // no-op: 同步服务已移除
  }

  async manualSync(): Promise<void> {
    // no-op: 同步服务已移除
  }

  onProgress(_callback: (progress: SyncProgress) => void): () => void {
    return () => {};
  }
}

export const frontendDataSyncService = new FrontendDataSyncService();