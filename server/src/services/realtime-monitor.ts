import type { ProviderType } from './smart-router';
import { smartKeyManager } from './smart-key-manager';
import { creditManager } from './credit-manager';
import { fallbackChain } from './fallback-chain';
import { logger } from '../utils/logger';

export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface ProviderMetrics {
  provider: ProviderType;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeKeys: number;
  exhaustedKeys: number;
  estimatedCredits: number;
  requestsPerMinute: number;
  errorsPerMinute: number;
}

export interface SystemMetrics {
  timestamp: number;
  providers: Record<ProviderType, ProviderMetrics>;
  totalRequests: number;
  totalSuccessRate: number;
  totalActiveKeys: number;
  totalExhaustedKeys: number;
  fallbackEvents: number;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  provider: ProviderType;
  message: string;
  timestamp: number;
  resolved: boolean;
}

interface RequestLog {
  timestamp: number;
  provider: ProviderType;
  success: boolean;
  responseTime: number;
  error?: string;
  keyLabel?: string;
  model?: string;
}

export class RealtimeMonitor {
  private requestLogs: RequestLog[] = [];
  private alerts: Alert[] = [];
  private fallbackEventCount = 0;
  private readonly MAX_LOG_SIZE = 10000;
  private readonly ALERT_RETENTION_MS = 3600000;
  private metricsCache: SystemMetrics | null = null;
  private metricsCacheTime = 0;
  private readonly METRICS_CACHE_TTL = 10000;

  recordRequest(log: Omit<RequestLog, 'timestamp'>): void {
    this.requestLogs.push({ ...log, timestamp: Date.now() });

    if (this.requestLogs.length > this.MAX_LOG_SIZE) {
      this.requestLogs = this.requestLogs.slice(-this.MAX_LOG_SIZE / 2);
    }

    this.invalidateCache();
  }

  recordFallbackEvent(fromProvider: ProviderType, toProvider: ProviderType, reason: string): void {
    this.fallbackEventCount++;

    this.addAlert({
      level: 'warning',
      provider: fromProvider,
      message: `Fallback: ${fromProvider} → ${toProvider}, 原因: ${reason}`,
    });
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const now = Date.now();
    if (this.metricsCache && now - this.metricsCacheTime < this.METRICS_CACHE_TTL) {
      return this.metricsCache;
    }

    const providers: ProviderType[] = ['vidu', 'doubao'];
    const providerMetrics: Record<string, ProviderMetrics> = {};
    let totalRequests = 0;
    let totalSuccess = 0;
    let totalActiveKeys = 0;
    let totalExhaustedKeys = 0;

    for (const provider of providers) {
      const metrics = await this.calculateProviderMetrics(provider);
      providerMetrics[provider] = metrics;

      totalRequests += metrics.totalRequests;
      totalSuccess += metrics.successCount;
      totalActiveKeys += metrics.activeKeys;
      totalExhaustedKeys += metrics.exhaustedKeys;

      if (metrics.estimatedCredits < 100) {
        this.addAlert({
          level: 'critical',
          provider,
          message: `${provider} 积分严重不足: ${metrics.estimatedCredits}`,
        });
      } else if (metrics.estimatedCredits < 300) {
        this.addAlert({
          level: 'warning',
          provider,
          message: `${provider} 积分偏低: ${metrics.estimatedCredits}`,
        });
      }

      if (metrics.successRate < 0.5 && metrics.totalRequests > 5) {
        this.addAlert({
          level: 'critical',
          provider,
          message: `${provider} 成功率过低: ${(metrics.successRate * 100).toFixed(1)}%`,
        });
      }
    }

    const systemMetrics: SystemMetrics = {
      timestamp: now,
      providers: providerMetrics as Record<ProviderType, ProviderMetrics>,
      totalRequests,
      totalSuccessRate: totalRequests > 0 ? totalSuccess / totalRequests : 1,
      totalActiveKeys,
      totalExhaustedKeys,
      fallbackEvents: this.fallbackEventCount,
      alerts: this.getActiveAlerts(),
    };

    this.metricsCache = systemMetrics;
    this.metricsCacheTime = now;

    return systemMetrics;
  }

  private async calculateProviderMetrics(provider: ProviderType): Promise<ProviderMetrics> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const fiveMinutesAgo = now - 300000;

    const providerLogs = this.requestLogs.filter(l => l.provider === provider);
    const recentLogs = providerLogs.filter(l => l.timestamp >= fiveMinutesAgo);
    const oneMinuteLogs = providerLogs.filter(l => l.timestamp >= oneMinuteAgo);

    const totalRequests = recentLogs.length;
    const successCount = recentLogs.filter(l => l.success).length;
    const failureCount = totalRequests - successCount;
    const successRate = totalRequests > 0 ? successCount / totalRequests : 1;

    const responseTimes = recentLogs.filter(l => l.success).map(l => l.responseTime).sort((a, b) => a - b);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    const p95ResponseTime = this.percentile(responseTimes, 95);
    const p99ResponseTime = this.percentile(responseTimes, 99);

    const keys = await smartKeyManager.getActiveKeys(provider);
    const allKeyStats = smartKeyManager.getAllStats(provider);

    let exhaustedKeys = 0;
    for (const [, stats] of Object.entries(allKeyStats)) {
      if (stats.failureCount >= 5 && stats.successRate < 0.5) {
        exhaustedKeys++;
      }
    }

    const creditStatus = await creditManager.getCreditStatus(provider);

    return {
      provider,
      totalRequests,
      successCount,
      failureCount,
      successRate,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      activeKeys: keys.length,
      exhaustedKeys,
      estimatedCredits: creditStatus.estimatedCredits,
      requestsPerMinute: oneMinuteLogs.length,
      errorsPerMinute: oneMinuteLogs.filter(l => !l.success).length,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const now = Date.now();

    const duplicate = this.alerts.find(
      a => a.provider === alert.provider
        && a.level === alert.level
        && a.message === alert.message
        && !a.resolved
        && now - a.timestamp < 300000
    );

    if (duplicate) return;

    this.alerts.push({
      ...alert,
      id: `alert_${now}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: now,
      resolved: false,
    });

    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }

    if (alert.level === 'critical') {
      logger.error(`[Monitor] 🚨 CRITICAL: ${alert.message}`);
    } else if (alert.level === 'warning') {
      logger.warn(`[Monitor] ⚠️ WARNING: ${alert.message}`);
    }
  }

  private getActiveAlerts(): Alert[] {
    const now = Date.now();
    return this.alerts.filter(a => !a.resolved && now - a.timestamp < this.ALERT_RETENTION_MS);
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  getRecentRequests(count: number = 50): RequestLog[] {
    return this.requestLogs.slice(-count);
  }

  getAlerts(level?: 'info' | 'warning' | 'critical'): Alert[] {
    const active = this.getActiveAlerts();
    if (level) {
      return active.filter(a => a.level === level);
    }
    return active;
  }

  private invalidateCache(): void {
    this.metricsCache = null;
  }
}

export const realtimeMonitor = new RealtimeMonitor();
