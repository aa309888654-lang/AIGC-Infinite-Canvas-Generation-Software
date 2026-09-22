import { APIProvider, DEFAULT_PROVIDER_CONFIGS, APIAuthConfig } from '@/types/api-controller';
import { API_BASE_URL } from '@/lib/api-config';
import { logger } from '@/lib/logger';

export interface APIStatus {
  provider: APIProvider;
  status: 'any' | 'available' | 'unavailable' | 'error';
  lastChecked: Date | null;
  lastSuccess: Date | null;
  lastError: Date | null;
  latency?: number;
  errorMessage?: string;
  successCount: number;
  errorCount: number;
  quotaUsed?: number;
  quotaLimit?: number;
}

export interface APIStatusMonitorConfig {
  checkInterval: number;
  maxHistorySize: number;
  timeout: number;
}

const DEFAULT_CONFIG: APIStatusMonitorConfig = {
  checkInterval: 60000,
  maxHistorySize: 100,
  timeout: 10000
};

class APIStatusMonitor {
  private static instance: APIStatusMonitor;
  private statuses: Map<APIProvider, APIStatus> = new Map();
  private config: APIStatusMonitorConfig;
  private checkTimer: any = null;
  private listeners: Set<(statuses: APIStatus[]) => void> = new Set();
  private history: Array<{
    provider: APIProvider;
    timestamp: Date;
    status: 'success' | 'error';
    latency?: number;
    error?: string;
  }> = [];

  private constructor(config: Partial<APIStatusMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeStatuses();
    this.loadFromStorage();
  }

  public static getInstance(config?: Partial<APIStatusMonitorConfig>): APIStatusMonitor {
    if (!APIStatusMonitor.instance) {
      APIStatusMonitor.instance = new APIStatusMonitor(config);
    }
    return APIStatusMonitor.instance;
  }

  private initializeStatuses() {
    DEFAULT_PROVIDER_CONFIGS.forEach(provider => {
      if (!this.statuses.has(provider.id)) {
        this.statuses.set(provider.id, {
          provider: provider.id,
          status: 'any',
          lastChecked: null,
          lastSuccess: null,
          lastError: null,
          successCount: 0,
          errorCount: 0
        });
      }
    });
  }

  private saveToStorage() {
    try {
      const data = {
        statuses: Object.fromEntries(this.statuses),
        history: this.history
      };
      localStorage.setItem('api-status-monitor', JSON.stringify(data));
    } catch (error) {
      logger.error('保存API状态失败:', error);
    }
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('api-status-monitor');
      if (saved) {
        const data = JSON.parse(saved);
        Object.entries(data.statuses || {}).forEach(([provider, status]) => {
          const s = status as any;
          this.statuses.set(provider as APIProvider, {
            ...(s as APIStatus),
            lastChecked: s.lastChecked ? new Date(s.lastChecked) : null,
            lastSuccess: s.lastSuccess ? new Date(s.lastSuccess) : null,
            lastError: s.lastError ? new Date(s.lastError) : null
          });
        });
        this.history = (data.history || []).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    } catch (error) {
      logger.error('加载API状态失败:', error);
    }
  }

  private notifyListeners() {
    const statusArray = Array.from(this.statuses.values());
    this.listeners.forEach(listener => listener(statusArray));
    this.saveToStorage();
  }

  public subscribe(listener: (statuses: APIStatus[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getStatus(provider: APIProvider): APIStatus | undefined {
    return this.statuses.get(provider);
  }

  public getAllStatuses(): APIStatus[] {
    return Array.from(this.statuses.values());
  }

  public async checkProvider(provider: APIProvider, config: APIAuthConfig): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    const providerInfo = DEFAULT_PROVIDER_CONFIGS.find(p => p.id === provider);

    try {
      if (!providerInfo) {
        return { success: false, error: '未知的API提供商' };
      }

      const hasRequiredFields = providerInfo.authFields.every(field =>
        !field.required || (config[field.key as keyof APIAuthConfig] && String(config[field.key as keyof APIAuthConfig]!).length > 0)
      );

      if (!hasRequiredFields) {
        this.updateStatus(provider, {
          status: 'unavailable',
          lastChecked: new Date(),
          errorMessage: '未配置认证信息'
        });
        return { success: true, latency: Date.now() - startTime, error: undefined };
      }

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/ai-providers/test-connection`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ providerId: provider, config }),
        signal: AbortSignal.timeout(20000),
      });

      const latency = Date.now() - startTime;
      const data = await res.json().catch(() => ({ success: false }));

      if (res.ok && data.success && data.data) {
        const online = data.data.success !== false;
        this.updateStatus(provider, {
          status: online ? 'available' : 'error',
          lastChecked: new Date(),
          lastSuccess: online ? new Date() : undefined,
          lastError: !online ? new Date() : undefined,
          latency: data.data.latency || latency,
          errorMessage: data.data.message,
          successCount: online ? 1 : 0,
          errorCount: online ? 0 : 1
        });
        this.addToHistory(provider, online ? 'success' : 'error', latency, data.data.message);
        return { success: online, latency, error: online ? undefined : data.data.message };
      }

      const errorMsg = data.error || data.data?.message || `HTTP ${res.status}`;
      this.updateStatus(provider, {
        status: 'error',
        lastChecked: new Date(),
        lastError: new Date(),
        latency,
        errorMessage: errorMsg,
        errorCount: 1
      });
      this.addToHistory(provider, 'error', latency, errorMsg);
      return { success: false, latency, error: errorMsg };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '连接测试失败';

      this.updateStatus(provider, {
        status: 'error',
        lastChecked: new Date(),
        lastError: new Date(),
        latency,
        errorMessage,
        errorCount: 1
      });

      this.addToHistory(provider, 'error', latency, errorMessage);
      return { success: false, latency, error: errorMessage };
    }
  }

  private updateStatus(provider: APIProvider, updates: Partial<APIStatus>) {
    const current = this.statuses.get(provider);
    if (current) {
      this.statuses.set(provider, {
        ...current,
        ...updates,
        successCount: current.successCount + (updates.successCount || 0),
        errorCount: current.errorCount + (updates.errorCount || 0)
      });
      this.notifyListeners();
    }
  }

  private addToHistory(provider: APIProvider, status: 'success' | 'error', latency?: number, error?: string) {
    this.history.unshift({
      provider,
      timestamp: new Date(),
      status,
      latency,
      error
    });
    this.history = this.history.slice(0, this.config.maxHistorySize);
  }

  public async checkAllProviders(configs: Record<APIProvider, APIAuthConfig>): Promise<Map<APIProvider, { success: boolean; latency?: number; error?: string }>> {
    const results = new Map<APIProvider, { success: boolean; latency?: number; error?: string }>();
    
    for (const provider of DEFAULT_PROVIDER_CONFIGS) {
      const config = configs[provider.id];
      const result = await this.checkProvider(provider.id, config);
      results.set(provider.id, result);
    }

    return results;
  }

  public startPeriodicCheck(configs: Record<APIProvider, APIAuthConfig>) {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(() => {
      this.checkAllProviders(configs);
    }, this.config.checkInterval);

    logger.info('API状态监控已启动');
  }

  public stopPeriodicCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      logger.info('API状态监控已停止');
    }
  }

  public getHistory(provider?: APIProvider) {
    if (provider) {
      return this.history.filter(h => h.provider === provider);
    }
    return this.history;
  }

  public clearHistory() {
    this.history = [];
    this.saveToStorage();
  }

  public getStats() {
    const statuses = this.getAllStatuses();
    return {
      total: statuses.length,
      available: statuses.filter(s => s.status === 'available').length,
      unavailable: statuses.filter(s => s.status === 'unavailable').length,
      error: statuses.filter(s => s.status === 'error').length,
      any: statuses.filter(s => s.status === 'any').length,
      totalSuccesses: statuses.reduce((sum, s) => sum + s.successCount, 0),
      totalErrors: statuses.reduce((sum, s) => sum + s.errorCount, 0)
    };
  }

  public updateQuota(provider: APIProvider, used: number, limit?: number) {
    const current = this.statuses.get(provider);
    if (current) {
      this.statuses.set(provider, {
        ...current,
        quotaUsed: used,
        quotaLimit: limit
      });
      this.notifyListeners();
    }
  }

  public setConfig(config: Partial<APIStatusMonitorConfig>) {
    this.config = { ...this.config, ...config };
    logger.info('API状态监控配置已更新');
  }

  public getConfig(): APIStatusMonitorConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.stopPeriodicCheck();
    this.listeners.clear();
    this.history = [];
  }
}

export const apiStatusMonitor = APIStatusMonitor.getInstance();
export default APIStatusMonitor;
