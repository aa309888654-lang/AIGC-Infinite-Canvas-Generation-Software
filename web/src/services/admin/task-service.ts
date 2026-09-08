import { apiClient } from '@/lib/api-client';

export interface Task {
  id: string;
  userId: string;
  username?: string;
  email?: string;
  avatar?: string;
  type: string;
  provider: string;
  model: string;
  status: string;
  prompt?: string;
  resultUrl?: string;
  thumbnailUrl?: string;
  cosUrl?: string;
  outputUrl?: string;
  error?: string;
  credits?: number;
  progress?: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  images: number;
  videos: number;
  audio: number;
  music: number;
  pendingReview: number;
  approvedReview: number;
  rejectedReview: number;
}

export interface GeneratedCleanupSourceStat {
  source: string;
  images: number;
  videos: number;
  bytes: number;
}

export interface GeneratedCleanupPreview {
  images: number;
  videos: number;
  totalFiles: number;
  estimatedBytes: number;
  tasks: number;
  olderThanDays: number;
  mediaTypes: Array<'image' | 'video'>;
  includeTasks: boolean;
  bySource: GeneratedCleanupSourceStat[];
}

export interface GeneratedCleanupResult {
  deletedImages: number;
  deletedVideos: number;
  deletedTasks: number;
  releasedBytes: number;
  failedCount: number;
  failedFiles: Array<{ id: string; path: string; error: string }>;
}

interface TasksResponse {
  success: boolean;
  data?: Task[];
  tasks?: Task[];
  pagination?: {
    total?: number;
    totalPages?: number;
    page?: number;
    pageSize?: number;
  };
  meta?: unknown;
}

interface TaskStatsResponse {
  success: boolean;
  data: TaskStats;
}

interface GeneratedCleanupPreviewResponse {
  success: boolean;
  data: GeneratedCleanupPreview;
}

interface GeneratedCleanupExecuteResponse {
  success: boolean;
  data: GeneratedCleanupResult;
}

export const taskService = {
  async getTasks(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
    search?: string;
    reviewStatus?: string;
  }): Promise<TasksResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    if (params?.reviewStatus) query.set('reviewStatus', params.reviewStatus);
    const res = await apiClient.get<TasksResponse>(`/admin/tasks?${query.toString()}`);
    return res;
  },

  async getTaskStats(): Promise<TaskStatsResponse> {
    const res = await apiClient.get<TaskStatsResponse>('/admin/tasks/stats');
    return res;
  },

  async cancelTask(taskId: string): Promise<{ success: boolean }> {
    const res = await apiClient.post<{ success: boolean }>(`/admin/tasks/${taskId}/cancel`);
    return res;
  },

  async retryTask(taskId: string): Promise<{ success: boolean }> {
    const res = await apiClient.post<{ success: boolean }>(`/admin/tasks/${taskId}/retry`);
    return res;
  },

  async deleteTask(taskId: string): Promise<{ success: boolean }> {
    const res = await apiClient.delete<{ success: boolean }>(`/admin/tasks/${taskId}`);
    return res;
  },

  async restoreTask(taskId: string): Promise<{ success: boolean }> {
    const res = await apiClient.post<{ success: boolean }>(`/admin/tasks/${taskId}/restore`);
    return res;
  },

  async batchDeleteTasks(taskIds: string[]): Promise<{ success: boolean; data: { deletedCount: number; requestedCount: number }; message: string }> {
    return apiClient.post<{ success: boolean; data: { deletedCount: number; requestedCount: number }; message: string }>('/admin/tasks/batch-delete', { taskIds });
  },

  async getReviewSettings(): Promise<{ success: boolean; data: { enabled: boolean } }> {
    return apiClient.get('/admin/tasks/review-settings');
  },

  async updateReviewSettings(enabled: boolean): Promise<{ success: boolean; data: { enabled: boolean } }> {
    return apiClient.put('/admin/tasks/review-settings', { enabled });
  },

  async reviewTask(taskId: string, status: 'approved' | 'rejected', note?: string): Promise<{ success: boolean }> {
    return apiClient.post(`/admin/tasks/${taskId}/review`, { status, note });
  },

  async batchReviewTasks(taskIds: string[], status: 'approved' | 'rejected', note?: string): Promise<{ success: boolean; data: { reviewedCount: number } }> {
    return apiClient.post('/admin/tasks/batch-review', { taskIds, status, note });
  },

  async previewGeneratedCleanup(params: {
    mediaTypes: Array<'image' | 'video'>;
    includeTasks: boolean;
    olderThanDays: number;
  }): Promise<GeneratedCleanupPreviewResponse> {
    const query = new URLSearchParams();
    query.set('mediaTypes', params.mediaTypes.join(','));
    query.set('includeTasks', String(params.includeTasks));
    query.set('olderThanDays', String(params.olderThanDays));
    return apiClient.get<GeneratedCleanupPreviewResponse>(`/admin/generated-cleanup/preview?${query.toString()}`);
  },

  async executeGeneratedCleanup(payload: {
    mediaTypes: Array<'image' | 'video'>;
    includeTasks: boolean;
    olderThanDays: number;
    confirmText: string;
  }): Promise<GeneratedCleanupExecuteResponse> {
    return apiClient.post<GeneratedCleanupExecuteResponse>('/admin/generated-cleanup/execute', payload);
  },
};
