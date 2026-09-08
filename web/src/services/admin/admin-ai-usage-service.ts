import { apiClient } from '@/lib/api-client';

export interface OverviewData {
  days: number;
  since: string;
  tasks: {
    total: number;
    images: number;
    videos: number;
    audio: number;
    music: number;
    totalCredits: number;
  };
  apiCalls: {
    total: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    pointsCost: number;
  };
}

export interface ProviderStat {
  provider: string;
  taskCount: number;
  imageCount: number;
  videoCount: number;
  audioCount: number;
  musicCount: number;
  credits: number;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  pointsCost: number;
  models: string[];
  modelCount: number;
}

export interface TopUser {
  userId: string;
  username: string;
  email: string;
  role: string;
  membershipLevel: string;
  pointsBalance: number;
  totalTasks: number;
  totalCredits: number;
  images: number;
  videos: number;
  audio: number;
  music: number;
}

export interface DailyTrend {
  date: string;
  images: number;
  videos: number;
  audio: number;
  music: number;
  completed: number;
  failed: number;
  credits: number;
}

export interface UsageRecord {
  id: string;
  userId: string;
  username: string;
  email: string;
  membershipLevel: string;
  type: string;
  status: string;
  progress: number;
  provider: string;
  model: string;
  prompt: string;
  outputUrl: string;
  thumbnailUrl: string;
  credits: number;
  error: string;
  createdAt: string;
  duration: number;
}

export interface UsageRecordsResponse {
  records: UsageRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

class AdminAiUsageService {
  getOverview(days: number): Promise<{ success: boolean; data: OverviewData }> {
    return apiClient.get(`/admin/ai-usage/overview?days=${days}`);
  }

  getByProvider(days: number): Promise<{ success: boolean; data: ProviderStat[] }> {
    return apiClient.get(`/admin/ai-usage/by-provider?days=${days}`);
  }

  getTopUsers(days: number, limit = 20): Promise<{ success: boolean; data: TopUser[] }> {
    return apiClient.get(`/admin/ai-usage/top-users?days=${days}&limit=${limit}`);
  }

  getDailyTrend(days: number): Promise<{ success: boolean; data: DailyTrend[] }> {
    return apiClient.get(`/admin/ai-usage/daily-trend?days=${days}`);
  }

  getRecords(params: {
    page: number;
    pageSize: number;
    type?: string;
    provider?: string;
    status?: string;
    search?: string;
  }): Promise<{ success: boolean; data: UsageRecordsResponse }> {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('pageSize', String(params.pageSize));
    if (params.type) query.set('type', params.type);
    if (params.provider) query.set('provider', params.provider);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    return apiClient.get(`/admin/ai-usage/records?${query.toString()}`);
  }

  // 清除 AI 使用统计记录
  // before: ISO 日期字符串，删除 createdAt < before 的记录
  // scope: 'all' | 'tasks' | 'api_calls'
  clearRecords(params: {
    before?: string;
    scope?: 'all' | 'tasks' | 'api_calls';
  }): Promise<{
    success: boolean;
    message?: string;
    data?: {
      before: string;
      scope: string;
      deletedTasks: number;
      deletedApiCalls: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.before) query.set('before', params.before);
    if (params.scope) query.set('scope', params.scope);
    return apiClient.delete(`/admin/ai-usage/clear-records?${query.toString()}`);
  }
}

export const adminAiUsageService = new AdminAiUsageService();
