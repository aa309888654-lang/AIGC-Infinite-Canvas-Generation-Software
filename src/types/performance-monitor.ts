export interface PerformanceMetrics {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  diskReadMBps: number;
  diskWriteMBps: number;
  networkRxMBps: number;
  networkTxMBps: number;
  diskSpaceUsedGB: number;
  diskSpaceTotalGB: number;
}

export interface NodeExecutionMetrics {
  nodeId: string;
  nodeType: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  memoryPeakMB?: number;
  apiCallCount?: number;
  apiLatencyMs?: number;
}

export interface WorkflowExecutionMetrics {
  executionId: string;
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  nodeMetrics: Map<string, NodeExecutionMetrics>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  totalMemoryPeakMB?: number;
  totalApiCalls?: number;
}

export interface PerformanceThreshold {
  metric: keyof PerformanceMetrics | 'nodeDuration' | 'workflowDuration';
  warningThreshold: number;
  criticalThreshold: number;
  enabled: boolean;
}

export const DEFAULT_THRESHOLDS: PerformanceThreshold[] = [
  { metric: 'cpuUsage', warningThreshold: 70, criticalThreshold: 90, enabled: true },
  { metric: 'memoryUsage', warningThreshold: 80, criticalThreshold: 95, enabled: true },
  { metric: 'diskSpaceUsedGB', warningThreshold: 80, criticalThreshold: 95, enabled: true },
  { metric: 'nodeDuration', warningThreshold: 30000, criticalThreshold: 60000, enabled: true },
  { metric: 'workflowDuration', warningThreshold: 300000, criticalThreshold: 600000, enabled: true },
];

export interface PerformanceAlert {
  id: string;
  timestamp: string;
  level: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

export interface PerformanceBenchmark {
  benchmarkId: string;
  name: string;
  description: string;
  createdAt: string;
  metrics: {
    averageWorkflowDurationMs: number;
    averageNodeDurationMs: number;
    memoryPeakMB: number;
    totalApiCalls: number;
  };
  baseline: boolean;
}

export interface PerformanceReport {
  reportId: string;
  startTime: string;
  endTime: string;
  workflowExecutions: WorkflowExecutionMetrics[];
  performanceMetrics: PerformanceMetrics[];
  alerts: PerformanceAlert[];
  summary: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDurationMs: number;
    peakMemoryMB: number;
    totalApiCalls: number;
  };
  recommendations: string[];
}

export interface PerformanceMonitorConfig {
  enabled: boolean;
  sampleIntervalMs: number;
  maxMetricsHistory: number;
  maxAlerts: number;
  thresholds: PerformanceThreshold[];
  autoAlert: boolean;
  autoSaveReports: boolean;
  reportIntervalMs: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  sampleIntervalMs: 1000,
  maxMetricsHistory: 3600,
  maxAlerts: 100,
  thresholds: DEFAULT_THRESHOLDS,
  autoAlert: true,
  autoSaveReports: true,
  reportIntervalMs: 3600000,
};

export type WorkflowPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface BackgroundTask {
  taskId: string;
  priority: WorkflowPriority;
  type: 'workflow' | 'node' | 'api' | 'other';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  metadata: Record<string, unknown>;
}
