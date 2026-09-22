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

  /** 本地数据概览（同步系统已移除，返回空摘要以维持 UI 兼容） */
  getDataSummary() {
    return {
      hasUserProfile: false,
      generationRecordsCount: 0,
      apiConfigsCount: 0,
      tasksCount: 0,
      workflowsCount: 0,
      nodeFilesCount: 0,
      estimatedSize: '0 B',
    };
  }

  getSyncCount(): number {
    return 0;
  }

  getIsSyncing(): boolean {
    return false;
  }

  /** 云端存储信息（后端已移除，返回失败以跳过存储区块渲染） */
  async getStorageInfo() {
    return { success: false as const };
  }

  /** 同步到后端（后端已移除，直接返回未启用） */
  async syncToBackend(_options?: {
    onProgress?: (progress: SyncProgress) => void;
    includeSensitive?: boolean;
  }) {
    return { success: false as const, error: '同步服务未启用' };
  }
}

export const frontendDataSyncService = new FrontendDataSyncService();