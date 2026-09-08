import { apiClient } from '@/lib/api-client';

export interface AccessControlSettings {
  autoProtectionEnabled: boolean;
  ipRequestsPerSecond: number;
  userRequestsPerSecond: number;
  cooldownSeconds: number;
  retentionHours: number;
}

export interface AccessControlRule {
  id: string;
  targetType: 'ip' | 'user';
  targetValue: string;
  targetLabel?: string;
  reason: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface AccessControlEvent {
  id: string;
  targetType: 'ip' | 'user';
  targetValue: string;
  userId?: string;
  ip?: string;
  path: string;
  method: string;
  action: 'manual_block' | 'rate_limited';
  reason: string;
  occurredAt: string;
}

export interface AccessTrafficItem {
  targetValue: string;
  requestCount: number;
  lastSeenAt: string | null;
  lastIp?: string | null;
}

export interface AccessUserTrafficItem extends AccessTrafficItem {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
  } | null;
}

export interface AccessControlDashboard {
  generatedAt: string;
  enforcementStatus: 'active' | 'degraded';
  settings: AccessControlSettings;
  summary: {
    currentRps: number;
    minuteRequests: number;
    blockedIpCount: number;
    blockedUserCount: number;
    blockedHits: number;
    redisAvailable: boolean;
  };
  rules: AccessControlRule[];
  topIps: AccessTrafficItem[];
  topUsers: AccessUserTrafficItem[];
  events: AccessControlEvent[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const accessControlService = {
  getDashboard(): Promise<ApiResponse<AccessControlDashboard>> {
    return apiClient.get('/admin/access-control/dashboard');
  },

  saveSettings(settings: AccessControlSettings): Promise<ApiResponse<AccessControlSettings>> {
    return apiClient.put('/admin/access-control/settings', settings);
  },

  block(input: {
    targetType: 'ip' | 'user';
    targetValue: string;
    reason: string;
    durationMinutes: number | null;
  }): Promise<ApiResponse<AccessControlRule>> {
    return apiClient.post('/admin/access-control/blocks', input);
  },

  unblock(ruleId: string): Promise<ApiResponse<unknown>> {
    return apiClient.delete(`/admin/access-control/blocks/${encodeURIComponent(ruleId)}`);
  },
};

