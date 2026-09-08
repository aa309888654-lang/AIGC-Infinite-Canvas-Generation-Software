import { apiClient } from '@/lib/api-client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface GovernanceSetting {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string' | 'json';
  defaultValue: boolean | number | string | string[];
  group: string;
  riskLevel: 'low' | 'medium' | 'high';
  value: boolean | number | string | string[];
  isDefault: boolean;
}

export interface SystemConfigSummary {
  settings: GovernanceSetting[];
  summaries: {
    payment: {
      configCount: number;
      latestUpdatedAt: string | null;
      yungouosConfigured: boolean;
    };
    points: {
      configKey: string | null;
      latestUpdatedAt: string | null;
    };
    sms: {
      provider: string;
      isMockInProduction: boolean;
      latestUpdatedAt: string | null;
    };
  };
}

export interface PermissionModule {
  key: string;
  label: string;
  riskLevel: 'medium' | 'high';
  route: string;
}

export interface RolePermission {
  role: string;
  userCount: number;
  scope: string;
  highRiskAccess: boolean;
  modules: string[];
}

export interface PermissionsSummary {
  roles: RolePermission[];
  modules: PermissionModule[];
  summary: {
    activeUsers: number;
    providerCount: number;
    activeProviderCount: number;
    userApiKeyCount: number;
    highRiskModuleCount: number;
  };
}

export interface AuditActionStat {
  action: string;
  count: number;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
}

export interface AuditSummary {
  days: number;
  total: number;
  failed: number;
  highRisk: number;
  successRate: number;
  byAction: AuditActionStat[];
  recentHighRisk: AuditLogEntry[];
}

export interface GovernanceAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  target: string;
}

export interface AlertsSummary {
  alerts: GovernanceAlert[];
  total: number;
}

export interface CostAnalysis {
  days: number;
  summary: {
    apiCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    pointsCost: number;
    taskCount: number;
    taskCredits: number;
  };
  providers: Array<{
    provider: string;
    apiCalls: number;
    totalCost: number;
    pointsCost: number;
    tokens: number;
  }>;
  daily: Array<{
    date: string;
    totalCost: number;
    pointsCost: number;
    apiCalls: number;
  }>;
}

export interface ModelHealthDaily {
  generatedAt: string;
  summary: {
    totalProviders: number;
    activeProviders: number;
    readyProviders: number;
    noKeyProviders: number;
    invalidKeyProviders: number;
    invalidKeys: number;
    exhaustedKeys: number;
  };
  providers: Array<{
    provider: string;
    displayName: string;
    isActive: boolean;
    totalKeys: number;
    activeKeys: number;
    usableKeys: number;
    invalidKeys: number;
    exhaustedKeys: number;
    status: 'inactive' | 'ready' | 'no_key' | 'invalid_key';
    updatedAt: string;
  }>;
}

export interface ExportMetadata {
  types: Array<{ type: string; label: string; endpoint: string }>;
  formats: Array<{ format: string; label: string }>;
}

export const adminGovernanceService = {
  getSystemConfig(): Promise<ApiResponse<SystemConfigSummary>> {
    return apiClient.get('/admin/governance/system-config');
  },

  saveSystemConfig(settings: Array<{ key: string; value: GovernanceSetting['value'] }>): Promise<ApiResponse<unknown>> {
    return apiClient.post('/admin/governance/system-config', { settings });
  },

  getPermissions(): Promise<ApiResponse<PermissionsSummary>> {
    return apiClient.get('/admin/governance/permissions');
  },

  getAuditSummary(days = 7): Promise<ApiResponse<AuditSummary>> {
    return apiClient.get(`/admin/governance/audit-summary?days=${days}`);
  },

  getAlerts(): Promise<ApiResponse<AlertsSummary>> {
    return apiClient.get('/admin/governance/alerts');
  },

  getCostAnalysis(days = 30): Promise<ApiResponse<CostAnalysis>> {
    return apiClient.get(`/admin/governance/cost-analysis?days=${days}`);
  },

  getModelHealthDaily(): Promise<ApiResponse<ModelHealthDaily>> {
    return apiClient.get('/admin/governance/model-health-daily');
  },

  getExportMetadata(): Promise<ApiResponse<ExportMetadata>> {
    return apiClient.get('/admin/governance/exports');
  },

  downloadExport(params: {
    type: string;
    format: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const query = new URLSearchParams({ format: params.format });
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    return apiClient.get<Blob>(`/export/${params.type}/all?${query.toString()}`, {
      responseType: 'blob',
      timeout: 60000,
      maxRetries: 0,
    });
  },
};
