/**
 * 系统监控服务 - 监控资源使用情况
 */

import { generateId } from '@/lib/utils';

// 系统信息类型
export interface SystemInfo {
  os: string;
  platform: string;
  arch: string;
  cpuCount: number;
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  uptime: number;
}

// 资源监控数据
export interface ResourceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  process: {
    memory: number;
    cpu: number;
  };
}

// 性能告警配置
export interface AlertThreshold {
  cpu: number;
  memory: number;
  processMemory: number;
}

// 告警级别
export type AlertLevel = 'info' | 'warning' | 'critical';

// 告警事件
export interface AlertEvent {
  id: string;
  type: 'cpu' | 'memory' | 'process';
  level: AlertLevel;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

// 监控回调
export type MetricsCallback = (metrics: ResourceMetrics) => void;
export type AlertCallback = (alert: AlertEvent) => void;

// 默认告警阈值
export const DEFAULT_ALERT_THRESHOLD: AlertThreshold = {
  cpu: 80,
  memory: 85,
  processMemory: 500, // MB
};

class SystemMonitor {
  private static instance: SystemMonitor;
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private metricsHistory: ResourceMetrics[] = [];
  private maxHistorySize = 60; // 保留60条记录
  private metricsCallbacks: Set<MetricsCallback> = new Set();
  private alertCallbacks: Set<AlertCallback> = new Set();
  private alertThresholds: AlertThreshold = { ...DEFAULT_ALERT_THRESHOLD };
  private cooldownPeriod = 30000; // 告警冷却期 30秒
  private lastAlertTime: Record<string, number> = {};
  private systemInfo: SystemInfo | null = null;
  
  private constructor() { /* noop */ }
  
  static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }
  
  // 初始化系统信息
  async init(): Promise<SystemInfo> {
    if (this.systemInfo) {
      return this.systemInfo;
    }
    
    try {
      // 从Tauri获取系统信息
      const { invoke } = await import('@tauri-apps/api/core');
      const info = await invoke<SystemInfo>('get_system_info');
      this.systemInfo = info;
      return info;
    } catch (e) {
      // 如果Tauri API不可用，使用默认值
      this.systemInfo = {
        os: navigator.platform,
        platform: navigator.userAgent.includes('Win') ? 'windows' : 'unknown',
        arch: navigator.userAgent.includes('x64') ? 'x64' : 'x86',
        cpuCount: navigator.hardwareConcurrency || 4,
        memory: {
          total: 16 * 1024 * 1024 * 1024, // 假设16GB
          free: 8 * 1024 * 1024 * 1024,
          used: 8 * 1024 * 1024 * 1024,
          usedPercent: 50,
        },
        uptime: performance.now(),
      };
      return this.systemInfo;
    }
  }
  
  // 获取系统信息
  getSystemInfo(): SystemInfo | null {
    return this.systemInfo;
  }
  
  // 开始监控
  start(interval = 1000): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
    }, interval);
    
    // console.log('系统监控已启动');
  }
  
  // 停止监控
  stop(): void {
    if (!this.isMonitoring) return;
    
    if (this.monitoringInterval !== null) {
      window.clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    // console.log('系统监控已停止');
  }
  
  // 收集指标数据
  private async collectMetrics(): Promise<void> {
    try {
      let metrics: ResourceMetrics;
      
      try {
        // 尝试从Tauri获取真实数据
        const { invoke } = await import('@tauri-apps/api/core');
        metrics = await invoke<ResourceMetrics>('get_system_metrics');
      } catch {
        // 使用浏览器API模拟数据
        const memory = (navigator as any).deviceMemory || 8;
        const cores = navigator.hardwareConcurrency || 4;
        
        // 模拟CPU使用率 (在真实环境中应该使用Tauri获取)
        const cpuUsage = Math.random() * 30 + 10;
        
        metrics = {
          timestamp: Date.now(),
          cpu: {
            usage: cpuUsage,
            cores,
          },
          memory: {
            total: memory * 1024 * 1024 * 1024,
            used: (memory * 0.4 + memory * 0.3 * Math.random()) * 1024 * 1024 * 1024,
            free: (memory * 0.3 - memory * 0.1 * Math.random()) * 1024 * 1024 * 1024,
            usagePercent: 40 + 30 * Math.random(),
          },
          process: {
            memory: 200 + Math.random() * 100, // MB
            cpu: Math.random() * 20,
          },
        };
      }
      
      // 保存到历史记录
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }
      
      // 通知回调
      this.metricsCallbacks.forEach(cb => cb(metrics));
      
      // 检查告警
      this.checkAlerts(metrics);
      
    } catch (e) {
      console.error('收集系统指标失败:', e);
    }
  }
  
  // 检查告警
  private checkAlerts(metrics: ResourceMetrics): void {
    const now = Date.now();
    
    // CPU告警
    if (metrics.cpu.usage > this.alertThresholds.cpu) {
      this.triggerAlert({
        type: 'cpu',
        value: metrics.cpu.usage,
        threshold: this.alertThresholds.cpu,
      }, now);
    }
    
    // 内存告警
    if (metrics.memory.usagePercent > this.alertThresholds.memory) {
      this.triggerAlert({
        type: 'memory',
        value: metrics.memory.usagePercent,
        threshold: this.alertThresholds.memory,
      }, now);
    }
    
    // 进程内存告警
    if (metrics.process.memory > this.alertThresholds.processMemory) {
      this.triggerAlert({
        type: 'process',
        value: metrics.process.memory,
        threshold: this.alertThresholds.processMemory,
      }, now);
    }
  }
  
  // 触发告警
  private triggerAlert(
    data: { type: 'cpu' | 'memory' | 'process'; value: number; threshold: number },
    now: number
  ): void {
    const alertKey = `${data.type}-${data.value > data.threshold ? 'high' : 'normal'}`;
    const lastTime = this.lastAlertTime[alertKey] || 0;
    
    // 检查冷却期
    if (now - lastTime < this.cooldownPeriod) return;
    
    this.lastAlertTime[alertKey] = now;
    
    let level: AlertLevel = 'info';
    const ratio = data.value / data.threshold;
    
    if (ratio >= 1.5) {
      level = 'critical';
    } else if (ratio >= 1.2) {
      level = 'warning';
    }
    
    const typeNames = {
      cpu: 'CPU',
      memory: '内存',
      process: '进程内存',
    };
    
    const alert: AlertEvent = {
      id: generateId(),
      type: data.type,
      level,
      message: `${typeNames[data.type]}使用率过高: ${data.value.toFixed(1)}% (阈值: ${data.threshold}%)`,
      value: data.value,
      threshold: data.threshold,
      timestamp: now,
    };
    
    this.alertCallbacks.forEach(cb => cb(alert));
  }
  
  // 获取历史指标
  getHistory(): ResourceMetrics[] {
    return [...this.metricsHistory];
  }
  
  // 获取最新指标
  getLatestMetrics(): ResourceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }
  
  // 注册指标回调
  onMetrics(callback: MetricsCallback): () => void {
    this.metricsCallbacks.add(callback);
    return () => this.metricsCallbacks.delete(callback);
  }
  
  // 注册告警回调
  onAlert(callback: AlertCallback): () => void {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }
  
  // 设置告警阈值
  setAlertThresholds(thresholds: Partial<AlertThreshold>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    // console.log('告警阈值已更新:', this.alertThresholds);
  }
  
  // 获取告警阈值
  getAlertThresholds(): AlertThreshold {
    return { ...this.alertThresholds };
  }
  
  // 重置告警阈值
  resetAlertThresholds(): void {
    this.alertThresholds = { ...DEFAULT_ALERT_THRESHOLD };
    // console.log('告警阈值已重置');
  }
  
  // 清除历史记录
  clearHistory(): void {
    this.metricsHistory = [];
  }
  
  // 获取格式化后的系统信息
  getFormattedInfo(): Record<string, string> {
    if (!this.systemInfo) {
      return { os: '未知', cpu: '未知', memory: '未知' };
    }
    
    return {
      os: this.systemInfo.os,
      cpu: `${this.systemInfo.cpuCount} 核心`,
      memory: `${(this.systemInfo.memory.total / (1024 * 1024 * 1024)).toFixed(1)} GB`,
    };
  }
  
  // 获取内存使用状态
  getMemoryStatus(): 'low' | 'normal' | 'high' | 'critical' {
    const latest = this.getLatestMetrics();
    if (!latest) return 'normal';
    
    const percent = latest.memory.usagePercent;
    if (percent < 50) return 'low';
    if (percent < 75) return 'normal';
    if (percent < 90) return 'high';
    return 'critical';
  }

  public destroy(): void {
    this.stop();
    this.metricsCallbacks.clear();
  }
}

export const systemMonitor = SystemMonitor.getInstance();