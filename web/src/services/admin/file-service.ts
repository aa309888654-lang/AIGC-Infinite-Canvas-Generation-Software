import { apiClient } from '@/lib/api-client';

export interface FileRecord {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  folder: string;
  url: string;
  createdAt: string;
}

interface FilesResponse {
  success: boolean;
  files: FileRecord[];
  pagination: unknown;
}

export const fileService = {
  async getFiles(params?: {
    page?: number;
    pageSize?: number;
    folder?: string;
    type?: string;
    userId?: string;
  }): Promise<FilesResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.folder) query.set('folder', params.folder);
    if (params?.type) query.set('type', params.type);
    const res = await apiClient.get<FilesResponse>(`/files/list?${query.toString()}`);
    return res;
  },

  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    const res = await apiClient.delete<{ success: boolean }>(`/files/${fileId}`);
    return res;
  }
};
