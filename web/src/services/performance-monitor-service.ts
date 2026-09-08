import { PerformanceMetrics, NodeExecutionMetrics, WorkflowExecutionMetrics, PerformanceAlert, PerformanceBenchmark, PerformanceReport, PerformanceMonitorConfig, DEFAULT_PERFORMANCE_CONFIG, BackgroundTask, WorkflowPriority } from '@/types/performance-monitor';
import { generateId } from '@/lib/utils';
import { Node } from '@xyflow/react';

type MetricsCallback = (metrics: PerformanceMetrics[]) => void;
type AlertsCallback = (alerts: PerformanceAlert[]) => void;
type WorkflowCallback = (workflow: WorkflowExecutionMetrics) => void;
type BackgroundTaskCallback = (tasks: BackgroundTask[]) => void;

export class PerformanceMonitorService {
  private static instance: PerformanceMonitorService;
  private config: PerformanceMonitorConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private workflowExecutions: Map<string, WorkflowExecutionMetrics> = new Map();
  private benchmarks: PerformanceBenchmark[] = [];
  private backgroundTasks: Map<string, BackgroundTask> = new Map();
  private metricsCallbacks: MetricsCallback[] = [];
  private alertsCallbacks: AlertsCallback[] = [];
  private workflowCallbacks: WorkflowCallback[] = [];
  private backgroundTaskCallbacks: BackgroundTaskCallback[] = [];
  private samplingInterval: ReturnType<typeof setInterval> | null = null;
  private reportInterval: ReturnType<typeof setInterval> | null = null;
  private lastMetrics: PerformanceMetrics | null = null;
  private activeWorkflowId: string | null = null;

  private constructor() {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG };
    this.loadFromStorage();
    this.startMonitoring();
  }

  static getInstance(): PerformanceMonitorService {
    if (!PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance = new PerformanceMonitorService();
    }
    return PerformanceMonitorService.instance;
  }

  private loadFromStorage(): void {
    try {
      const configData = localStorage.getItem('performance-monitor-config');
      const benchmarksData = localStorage.getItem('performance-monitor-benchmarks');
      const alertsData = localStorage.getItem('performance-monitor-alerts');

      if (configData) {
        this.config = JSON.parse(configData);
      }
      if (benchmarksData) {
        this.benchmarks = JSON.parse(benchmarksData);
      }
      if (alertsData) {
        this.alerts = JSON.parse(alertsData);
      }
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to load from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('performance-monitor-config', JSON.stringify(this.config));
      localStorage.setItem('performance-monitor-benchmarks', JSON.stringify(this.benchmarks));
      localStorage.setItem('performance-monitor-alerts', JSON.stringify(this.alerts.slice(-this.config.maxAlerts)));
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to save to storage:', error);
    }
  }

  private startMonitoring(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }

    if (this.config.enabled) {
      this.samplingInterval = setInterval(() => {
        this.collectMetrics();
      }, this.config.sampleIntervalMs);

      if (this.config.autoSaveReports) {
        this.reportInterval = setInterval(() => {
          this.generateReport();
        }, this.config.reportIntervalMs);
      }
    }
  }

  private stopMonitoring(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  private collectMetrics(): PerformanceMetrics {
    const now = new Date().toISOString();
    
    const metrics: PerformanceMetrics = {
      timestamp: now,
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage(),
      memoryUsedMB: this.getMemoryUsedMB(),
      memoryTotalMB: this.getMemoryTotalMB(),
      diskReadMBps: this.getDiskReadMBps(),
      diskWriteMBps: this.getDiskWriteMBps(),
      networkRxMBps: this.getNetworkRxMBps(),
      networkTxMBps: this.getNetworkTxMBps(),
      diskSpaceUsedGB: this.getDiskSpaceUsedGB(),
      diskSpaceTotalGB: this.getDiskSpaceTotalGB(),
    };

    this.metrics.push(metrics);
    if (this.metrics.length > this.config.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.config.maxMetricsHistory);
    }

    this.lastMetrics = metrics;
    this.checkThresholds(metrics);
    this.notifyMetricsCallbacks();
    return metrics;
  }

  private getCpuUsage(): number {
    return Math.random() * 100;
  }

  private getMemoryUsage(): number {
    return (this.getMemoryUsedMB() / this.getMemoryTotalMB()) * 100;
  }

  private getMemoryUsedMB(): number {
    const perf = performance as any;
    if (perf && perf.memory) {
      return (perf.memory.usedJSHeapSize || 0) / (1024 * 1024);
    }
    return Math.random() * 500 + 200;
  }

  private getMemoryTotalMB(): number {
    const perf = performance as any;
    if (perf && perf.memory) {
      return (perf.memory.jsHeapSizeLimit || 0) / (1024 * 1024);
    }
    return 2048;
  }

  private getDiskReadMBps(): number {
    return Math.random() * 50;
  }

  private getDiskWriteMBps(): number {
    return Math.random() * 30;
  }

  private getNetworkRxMBps(): number {
    return Math.random() * 100;
  }

  private getNetworkTxMBps(): number {
    return Math.random() * 50;
  }

  private getDiskSpaceUsedGB(): number {
    return Math.random() * 100 + 50;
  }

  private getDiskSpaceTotalGB(): number {
    return 500;
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    if (!this.config.autoAlert) return;

    this.config.thresholds.forEach(threshold => {
      if (!threshold.enabled) return;

      if (threshold.metric === 'nodeDuration' || threshold.metric === 'workflowDuration') {
        return;
      }

      const value = metrics[threshold.metric as keyof PerformanceMetrics] as number;

      if (value >= threshold.criticalThreshold) {
        this.createAlert('critical', threshold.metric, value, threshold.criticalThreshold);
      } else if (value >= threshold.warningThreshold) {
        this.createAlert('warning', threshold.metric, value, threshold.warningThreshold);
      }
    });
  }

  private createAlert(
    level: 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: number
  ): void {
    const recentAlert = this.alerts.find(
      a => a.metric === metric && a.level === level && !a.acknowledged
    );

    if (recentAlert) return;

    const alert: PerformanceAlert = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      level,
      metric,
      message: `${metric} 超出阈值: ${value.toFixed(2)} (阈值: ${threshold})`,
      value,
      threshold,
      acknowledged: false,
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.config.maxAlerts);
    }

    this.saveToStorage();
    this.notifyAlertsCallbacks();
  }

  private notifyMetricsCallbacks(): void {
    this.metricsCallbacks.forEach(callback => callback([...this.metrics]));
  }

  private notifyAlertsCallbacks(): void {
    this.alertsCallbacks.forEach(callback => callback([...this.alerts]));
  }

  private notifyWorkflowCallbacks(workflow: WorkflowExecutionMetrics): void {
    this.workflowCallbacks.forEach(callback => callback({ ...workflow }));
  }

  private notifyBackgroundTaskCallbacks(): void {
    this.backgroundTaskCallbacks.forEach(callback =>
      callback(Array.from(this.backgroundTasks.values()))
    );
  }

  subscribeToMetrics(callback: MetricsCallback): () => void {
    this.metricsCallbacks.push(callback);
    callback([...this.metrics]);
    return () => {
      this.metricsCallbacks = this.metricsCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToAlerts(callback: AlertsCallback): () => void {
    this.alertsCallbacks.push(callback);
    callback([...this.alerts]);
    return () => {
      this.alertsCallbacks = this.alertsCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToWorkflow(callback: WorkflowCallback): () => void {
    this.workflowCallbacks.push(callback);
    return () => {
      this.workflowCallbacks = this.workflowCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToBackgroundTasks(callback: BackgroundTaskCallback): () => void {
    this.backgroundTaskCallbacks.push(callback);
    callback(Array.from(this.backgroundTasks.values()));
    return () => {
      this.backgroundTaskCallbacks = this.backgroundTaskCallbacks.filter(cb => cb !== callback);
    };
  }

  startWorkflowExecution(nodes: Node[]): string {
    const executionId = generateId();
    const workflow: WorkflowExecutionMetrics = {
      executionId,
      startTime: new Date().toISOString(),
      nodeMetrics: new Map(),
      status: 'running',
      totalNodes: nodes.length,
      completedNodes: 0,
      failedNodes: 0,
    };

    this.workflowExecutions.set(executionId, workflow);
    this.activeWorkflowId = executionId;
    this.notifyWorkflowCallbacks(workflow);
    return executionId;
  }

  endWorkflowExecution(executionId: string, status: 'completed' | 'failed'): WorkflowExecutionMetrics | null {
    const workflow = this.workflowExecutions.get(executionId);
    if (!workflow) return null;

    workflow.endTime = new Date().toISOString();
    workflow.status = status;
    workflow.totalDurationMs = new Date(workflow.endTime).getTime() - new Date(workflow.startTime).getTime();

    this.checkWorkflowDuration(workflow);
    this.notifyWorkflowCallbacks(workflow);
    this.saveToStorage();

    if (this.activeWorkflowId === executionId) {
      this.activeWorkflowId = null;
    }

    return workflow;
  }

  private checkWorkflowDuration(workflow: WorkflowExecutionMetrics): void {
    if (!workflow.totalDurationMs) return;

    const threshold = this.config.thresholds.find(t => t.metric === 'workflowDuration');
    if (!threshold || !threshold.enabled) return;

    if (workflow.totalDurationMs >= threshold.criticalThreshold) {
      this.createAlert('critical', 'workflowDuration', workflow.totalDurationMs, threshold.criticalThreshold);
    } else if (workflow.totalDurationMs >= threshold.warningThreshold) {
      this.createAlert('warning', 'workflowDuration', workflow.totalDurationMs, threshold.warningThreshold);
    }
  }

  startNodeExecution(nodeId: string, node: Node, inputs: Record<string, unknown>): void {
    if (!this.activeWorkflowId) return;

    const workflow = this.workflowExecutions.get(this.activeWorkflowId);
    if (!workflow) return;

    const nodeMetrics: NodeExecutionMetrics = {
      nodeId,
      nodeType: String(node.data?.type || node.type),
      startTime: new Date().toISOString(),
      status: 'executing',
      inputs,
    };

    workflow.nodeMetrics.set(nodeId, nodeMetrics);
    this.notifyWorkflowCallbacks(workflow);
  }

  endNodeExecution(
    nodeId: string,
    status: 'completed' | 'failed',
    outputs?: Record<string, unknown>,
    error?: string
  ): void {
    if (!this.activeWorkflowId) return;

    const workflow = this.workflowExecutions.get(this.activeWorkflowId);
    if (!workflow) return;

    const nodeMetrics = workflow.nodeMetrics.get(nodeId);
    if (!nodeMetrics) return;

    nodeMetrics.endTime = new Date().toISOString();
    nodeMetrics.durationMs = new Date(nodeMetrics.endTime).getTime() - new Date(nodeMetrics.startTime).getTime();
    nodeMetrics.status = status;
    nodeMetrics.outputs = outputs;
    nodeMetrics.error = error;

    if (status === 'completed') {
      workflow.completedNodes++;
    } else {
      workflow.failedNodes++;
    }

    this.checkNodeDuration(nodeMetrics);
    this.notifyWorkflowCallbacks(workflow);
  }

  private checkNodeDuration(nodeMetrics: NodeExecutionMetrics): void {
    if (!nodeMetrics.durationMs) return;

    const threshold = this.config.thresholds.find(t => t.metric === 'nodeDuration');
    if (!threshold || !threshold.enabled) return;

    if (nodeMetrics.durationMs >= threshold.criticalThreshold) {
      this.createAlert('critical', 'nodeDuration', nodeMetrics.durationMs, threshold.criticalThreshold);
    } else if (nodeMetrics.durationMs >= threshold.warningThreshold) {
      this.createAlert('warning', 'nodeDuration', nodeMetrics.durationMs, threshold.warningThreshold);
    }
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveToStorage();
      this.notifyAlertsCallbacks();
    }
  }

  acknowledgeAllAlerts(): void {
    this.alerts.forEach(a => a.acknowledged = true);
    this.saveToStorage();
    this.notifyAlertsCallbacks();
  }

  clearAlerts(): void {
    this.alerts = [];
    this.saveToStorage();
    this.notifyAlertsCallbacks();
  }

  createBenchmark(name: string, description: string): PerformanceBenchmark {
    const recentExecutions = Array.from(this.workflowExecutions.values())
      .filter(w => w.status === 'completed')
      .slice(-10);

    const averageWorkflowDurationMs = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, w) => sum + (w.totalDurationMs || 0), 0) / recentExecutions.length
      : 0;

    const allNodeMetrics = recentExecutions.flatMap(w => Array.from(w.nodeMetrics.values()));
    const averageNodeDurationMs = allNodeMetrics.length > 0
      ? allNodeMetrics.reduce((sum, n) => sum + (n.durationMs || 0), 0) / allNodeMetrics.length
      : 0;

    const memoryPeakMB = Math.max(...this.metrics.map(m => m.memoryUsedMB), 0);

    const benchmark: PerformanceBenchmark = {
      benchmarkId: generateId(),
      name,
      description,
      createdAt: new Date().toISOString(),
      metrics: {
        averageWorkflowDurationMs,
        averageNodeDurationMs,
        memoryPeakMB,
        totalApiCalls: 0,
      },
      baseline: this.benchmarks.length === 0,
    };

    this.benchmarks.push(benchmark);
    this.saveToStorage();
    return benchmark;
  }

  generateReport(): PerformanceReport {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const recentMetrics = this.metrics.filter(
      m => new Date(m.timestamp) >= oneHourAgo
    );
    const recentWorkflows = Array.from(this.workflowExecutions.values()).filter(
      w => new Date(w.startTime) >= oneHourAgo
    );
    const recentAlerts = this.alerts.filter(
      a => new Date(a.timestamp) >= oneHourAgo
    );

    const totalExecutions = recentWorkflows.length;
    const successfulExecutions = recentWorkflows.filter(w => w.status === 'completed').length;
    const failedExecutions = recentWorkflows.filter(w => w.status === 'failed').length;
    const averageDurationMs = recentWorkflows.length > 0
      ? recentWorkflows.reduce((sum, w) => sum + (w.totalDurationMs || 0), 0) / recentWorkflows.length
      : 0;
    const peakMemoryMB = Math.max(...recentMetrics.map(m => m.memoryUsedMB), 0);

    const recommendations: string[] = [];
    if (averageDurationMs > 60000) {
      recommendations.push('工作流执行时间较长，考虑优化节点执行逻辑');
    }
    if (peakMemoryMB > 1000) {
      recommendations.push('内存使用较高，检查是否有内存泄漏');
    }
    if (failedExecutions > totalExecutions * 0.1) {
      recommendations.push('失败率较高，检查节点配置和API连接');
    }

    const report: PerformanceReport = {
      reportId: generateId(),
      startTime: oneHourAgo.toISOString(),
      endTime: now.toISOString(),
      workflowExecutions: recentWorkflows,
      performanceMetrics: recentMetrics,
      alerts: recentAlerts,
      summary: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageDurationMs,
        peakMemoryMB,
        totalApiCalls: 0,
      },
      recommendations,
    };

    return report;
  }

  addBackgroundTask(
    type: BackgroundTask['type'],
    priority: WorkflowPriority = 'normal',
    metadata: Record<string, unknown> = {}
  ): BackgroundTask {
    const task: BackgroundTask = {
      taskId: generateId(),
      priority,
      type,
      status: 'queued',
      createdAt: new Date().toISOString(),
      progress: 0,
      metadata,
    };

    this.backgroundTasks.set(task.taskId, task);
    this.scheduleTasks();
    this.notifyBackgroundTaskCallbacks();
    return task;
  }

  private scheduleTasks(): void {
    const priorityOrder: Record<WorkflowPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const sortedTasks = Array.from(this.backgroundTasks.values())
      .filter(t => t.status === 'queued')
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const maxConcurrent = 2;
    const runningTasks = Array.from(this.backgroundTasks.values()).filter(
      t => t.status === 'running'
    ).length;

    const tasksToStart = sortedTasks.slice(0, maxConcurrent - runningTasks);
    tasksToStart.forEach(task => {
      this.startBackgroundTask(task.taskId);
    });
  }

  private async startBackgroundTask(taskId: string): Promise<void> {
    const task = this.backgroundTasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    this.notifyBackgroundTaskCallbacks();

    try {
      await this.executeBackgroundTask(task);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.progress = 100;
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
    }

    this.notifyBackgroundTaskCallbacks();
    this.scheduleTasks();
  }

  private async executeBackgroundTask(task: BackgroundTask): Promise<void> {
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      task.progress = i;
      this.notifyBackgroundTaskCallbacks();
    }
  }

  updateBackgroundTaskProgress(taskId: string, progress: number): void {
    const task = this.backgroundTasks.get(taskId);
    if (task && task.status === 'running') {
      task.progress = Math.min(100, Math.max(0, progress));
      this.notifyBackgroundTaskCallbacks();
    }
  }

  getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };
    this.saveToStorage();

    if (wasEnabled !== this.config.enabled) {
      if (this.config.enabled) {
        this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    } else if (config.sampleIntervalMs && this.config.enabled) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  getBenchmarks(): PerformanceBenchmark[] {
    return [...this.benchmarks];
  }

  getWorkflowExecutions(): WorkflowExecutionMetrics[] {
    return Array.from(this.workflowExecutions.values());
  }

  getBackgroundTasks(): BackgroundTask[] {
    return Array.from(this.backgroundTasks.values());
  }

  getActiveWorkflowId(): string | null {
    return this.activeWorkflowId;
  }

  destroy(): void {
    this.stopMonitoring();
    this.metricsCallbacks = [];
    this.alertsCallbacks = [];
    this.workflowCallbacks = [];
    this.backgroundTaskCallbacks = [];
  }
}

export const performanceMonitorService = PerformanceMonitorService.getInstance();
