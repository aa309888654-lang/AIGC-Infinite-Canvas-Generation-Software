import { apiClient } from '@/lib/api-client';

export interface Backup {
  id: string;
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  createdAtFormatted: string;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  totalSizeFormatted: string;
  oldestBackup: string | null;
  newestBackup: string | null;
}

export interface BackupListResponse {
  success: boolean;
  backups: Backup[];
  stats: BackupStats;
}

export interface CreateBackupResponse {
  success: boolean;
  message: string;
  backup?: Backup;
}

export interface RestoreBackupResponse {
  success: boolean;
  message: string;
}

export const backupService = {
  async getList(): Promise<BackupListResponse> {
    return apiClient.get('/admin/backup/list');
  },

  async createBackup(): Promise<CreateBackupResponse> {
    return apiClient.post('/admin/backup/create');
  },

  async restoreBackup(filename: string): Promise<RestoreBackupResponse> {
    return apiClient.post(`/admin/backup/restore/${filename}`);
  },

  async deleteBackup(filename: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/admin/backup/${filename}`);
  },

  async downloadBackup(filename: string): Promise<Blob> {
    return apiClient.get(`/admin/backup/download/${filename}`, { responseType: 'blob' });
  },
};
