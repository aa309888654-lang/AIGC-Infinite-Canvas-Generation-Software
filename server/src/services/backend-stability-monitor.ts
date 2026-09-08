import { EventEmitter } from 'events';
import os from 'os';
import prisma from '../lib/prisma';
import { redisService } from './redis-service';
import { minioService } from './minio-service';
import { loggingService } from './logging-service';

export interface StabilityMetrics {
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    usagePercent: number;
  };
  cpu: {
    loadavg: number[];
    usage: number;
  };
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
    external: ServiceHealth[];
  };
  requests: {
    total: number;
    success: number;
    errors: number;
    avgResponseTime: number;
  };
  timestamp: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  error?: string;
  lastCheck: string;
}

export interface AlertConfig {
  memoryThreshold: number;
  cpuThreshold: number;
  errorRateThreshold: number;
  responseTimeThreshold: number;
}

export interface Alert {
  type: 'warning' | 'critical';
  service: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: string;
}

class BackendStabilityMonitor extends EventEmitter {
  private isMonitoring = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private metricsHistory: StabilityMetrics[] = [];
  private requestCounts = { total: 0, success: 0, errors: 0 };
  private responseTimes: number[] = [];
  private alertConfig: AlertConfig = {
    memoryThreshold: 85,
    cpuThreshold: 80,
    errorRateThreshold: 5,
    responseTimeThreshold: 5000,
  };

  constructor() {
    super();
    this.startMetricsCollection();
  }

  private startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, 30000);
  }

  async startMonitoring(intervalMs: number = 60000) {
    if (this.isMonitoring) {
      console.log('[StabilityMonitor] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('[StabilityMonitor] Started monitoring with interval:', intervalMs);

    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    await this.performHealthCheck();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
    console.log('[StabilityMonitor] Stopped monitoring');
  }

  async performHealthCheck(): Promise<StabilityMetrics> {
    const metrics = await this.collectMetrics();
    
    const alerts = this.checkThresholds(metrics);
    
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        console.warn(`[StabilityMonitor] Alert: ${alert.type.toUpperCase()} - ${alert.message}`);
        this.emit('alert', alert);
      });
    }

    this.emit('metrics', metrics);
    
    return metrics;
  }

  private async collectMetrics(): Promise<StabilityMetrics> {
    const os = await import('os');
    
    const databaseHealth = await this.checkDatabase();
    const redisHealth = await this.checkRedis();
    const storageHealth = await this.checkStorage();
    const externalServices = await this.checkExternalServices();

    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const metrics: StabilityMetrics = {
      uptime: process.uptime(),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        usagePercent: (usedMemory / totalMemory) * 100,
      },
      cpu: {
        loadavg: os.loadavg(),
        usage: this.calculateCpuUsage(),
      },
      services: {
        database: databaseHealth,
        redis: redisHealth,
        storage: storageHealth,
        external: externalServices,
      },
      requests: {
        total: this.requestCounts.total,
        success: this.requestCounts.success,
        errors: this.requestCounts.errors,
        avgResponseTime: this.calculateAvgResponseTime(),
      },
      timestamp: new Date().toISOString(),
    };

    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    return metrics;
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        name: 'PostgreSQL',
        status: 'healthy',
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: 'PostgreSQL',
        status: 'down',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const isConnected = redisService.isConnected && redisService.isConnected();
      if (isConnected) {
        return {
          name: 'Redis',
          status: 'healthy',
          latency: Date.now() - start,
          lastCheck: new Date().toISOString(),
        };
      }
      return {
        name: 'Redis',
        status: 'down',
        latency: Date.now() - start,
        error: 'Redis not connected',
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: 'Redis',
        status: 'down',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis check failed',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkStorage(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const isAvailable = minioService.isAvailable();
      return {
        name: 'MinIO',
        status: isAvailable ? 'healthy' : 'down',
        latency: Date.now() - start,
        error: isAvailable ? undefined : 'MinIO not available',
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: 'MinIO',
        status: 'down',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Storage check failed',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkExternalServices(): Promise<ServiceHealth[]> {
    const services: ServiceHealth[] = [];

    const externalChecks = [
      { name: 'Loki', url: process.env.LOKI_HOST || 'localhost:3100', path: '/ready' },
      { name: 'Webhook', url: process.env.WEBHOOK_URL, path: '' },
    ];

    for (const service of externalChecks) {
      if (!service.url) {
        services.push({
          name: service.name,
          status: 'degraded',
          error: 'Not configured',
          lastCheck: new Date().toISOString(),
        });
        continue;
      }

      const start = Date.now();
      try {
        const response = await fetch(`http://${service.url}${service.path}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        services.push({
          name: service.name,
          status: response.ok ? 'healthy' : 'degraded',
          latency: Date.now() - start,
          error: response.ok ? undefined : `HTTP ${response.status}`,
          lastCheck: new Date().toISOString(),
        });
      } catch (error) {
        services.push({
          name: service.name,
          status: 'down',
          latency: Date.now() - start,
          error: error instanceof Error ? error.message : 'Service unreachable',
          lastCheck: new Date().toISOString(),
        });
      }
    }

    return services;
  }

  private checkThresholds(metrics: StabilityMetrics): Alert[] {
    const alerts: Alert[] = [];

    if (metrics.memory.usagePercent > this.alertConfig.memoryThreshold) {
      alerts.push({
        type: metrics.memory.usagePercent > 95 ? 'critical' : 'warning',
        service: 'Memory',
        message: `Memory usage is at ${metrics.memory.usagePercent.toFixed(2)}%`,
        metric: 'memory.usagePercent',
        value: metrics.memory.usagePercent,
        threshold: this.alertConfig.memoryThreshold,
        timestamp: new Date().toISOString(),
      });
    }

    if (metrics.cpu.loadavg[0] > this.alertConfig.cpuThreshold) {
      alerts.push({
        type: 'warning',
        service: 'CPU',
        message: `CPU load is high: ${metrics.cpu.loadavg[0].toFixed(2)}`,
        metric: 'cpu.loadavg',
        value: metrics.cpu.loadavg[0],
        threshold: this.alertConfig.cpuThreshold,
        timestamp: new Date().toISOString(),
      });
    }

    if (metrics.requests.total > 0) {
      const errorRate = (metrics.requests.errors / metrics.requests.total) * 100;
      if (errorRate > this.alertConfig.errorRateThreshold) {
        alerts.push({
          type: 'critical',
          service: 'API',
          message: `Error rate is at ${errorRate.toFixed(2)}%`,
          metric: 'requests.errorRate',
          value: errorRate,
          threshold: this.alertConfig.errorRateThreshold,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (metrics.requests.avgResponseTime > this.alertConfig.responseTimeThreshold) {
      alerts.push({
        type: 'warning',
        service: 'API',
        message: `Average response time is ${metrics.requests.avgResponseTime.toFixed(2)}ms`,
        metric: 'requests.avgResponseTime',
        value: metrics.requests.avgResponseTime,
        threshold: this.alertConfig.responseTimeThreshold,
        timestamp: new Date().toISOString(),
      });
    }

    if (metrics.services.database.status === 'down') {
      alerts.push({
        type: 'critical',
        service: 'Database',
        message: 'Database is down',
        timestamp: new Date().toISOString(),
      });
    }

    if (metrics.services.redis.status === 'down') {
      alerts.push({
        type: 'critical',
        service: 'Redis',
        message: 'Redis is down',
        timestamp: new Date().toISOString(),
      });
    }

    return alerts;
  }

  private calculateCpuUsage(): number {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    }
    
    return ((1 - idle / total) * 100);
  }

  private calculateAvgResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.responseTimes.length;
  }

  recordRequest(success: boolean, responseTime: number) {
    this.requestCounts.total++;
    if (success) {
      this.requestCounts.success++;
    } else {
      this.requestCounts.errors++;
    }
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  getMetrics(): StabilityMetrics {
    return this.metricsHistory[this.metricsHistory.length - 1] || {} as StabilityMetrics;
  }

  getMetricsHistory(limit: number = 100): StabilityMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  getServiceStatus(): { service: string; status: string; latency?: number }[] {
    const latest = this.getMetrics();
    const statuses: { service: string; status: string; latency?: number }[] = [];

    if (latest.services) {
      statuses.push({
        service: latest.services.database.name,
        status: latest.services.database.status,
        latency: latest.services.database.latency,
      });
      statuses.push({
        service: latest.services.redis.name,
        status: latest.services.redis.status,
        latency: latest.services.redis.latency,
      });
      statuses.push({
        service: latest.services.storage.name,
        status: latest.services.storage.status,
        latency: latest.services.storage.latency,
      });
    }

    return statuses;
  }

  updateAlertConfig(config: Partial<AlertConfig>) {
    this.alertConfig = { ...this.alertConfig, ...config };
    console.log('[StabilityMonitor] Updated alert config:', this.alertConfig);
  }

  async getSystemReport(): Promise<string> {
    const metrics = this.getMetrics();
    const statuses = this.getServiceStatus();
    
    let report = `=== Backend Stability Report ===\n`;
    report += `Time: ${metrics.timestamp}\n`;
    report += `Uptime: ${Math.floor(metrics.uptime / 60)} minutes\n\n`;
    
    report += `--- Services Status ---\n`;
    statuses.forEach(s => {
      const icon = s.status === 'healthy' ? '✅' : s.status === 'degraded' ? '⚠️' : '❌';
      report += `${icon} ${s.service}: ${s.status}`;
      if (s.latency) report += ` (${s.latency}ms)`;
      report += '\n';
    });
    
    report += `\n--- Resource Usage ---\n`;
    report += `Memory: ${metrics.memory.usagePercent.toFixed(2)}%\n`;
    report += `CPU Load: ${metrics.cpu.loadavg[0].toFixed(2)}\n`;
    
    report += `\n--- Request Stats ---\n`;
    report += `Total: ${metrics.requests.total}\n`;
    report += `Success: ${metrics.requests.success}\n`;
    report += `Errors: ${metrics.requests.errors}\n`;
    report += `Avg Response: ${metrics.requests.avgResponseTime.toFixed(2)}ms\n`;
    
    return report;
  }

  async saveMetricsToDatabase() {
    try {
      const metrics = this.getMetrics();
      
      await prisma.systemConfig.upsert({
        where: { key: 'last_stability_check' },
        update: { value: JSON.stringify(metrics) },
        create: { key: 'last_stability_check', value: JSON.stringify(metrics) },
      });
      
      console.log('[StabilityMonitor] Metrics saved to database');
    } catch (error) {
      console.error('[StabilityMonitor] Failed to save metrics:', error);
    }
  }
}

export const backendStabilityMonitor = new BackendStabilityMonitor();
export default backendStabilityMonitor;
