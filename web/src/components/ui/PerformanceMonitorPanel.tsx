import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Zap,
  BarChart3,
  Settings,
  Bell,
  PlayCircle,
  AlertCircle,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  PerformanceMetrics,
  PerformanceAlert,
  PerformanceBenchmark,
  WorkflowExecutionMetrics,
  BackgroundTask,
  WorkflowPriority,
} from '@/types/performance-monitor';
import { performanceMonitorService } from '@/services/performance-monitor-service';
import { cn } from '@/lib/utils';

interface PerformanceMonitorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const PerformanceMonitorPanel: React.FC<PerformanceMonitorPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflows' | 'alerts' | 'benchmarks' | 'tasks'>('overview');
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [benchmarks, setBenchmarks] = useState<PerformanceBenchmark[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowExecutionMetrics[]>([]);
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const unsubscribeMetrics = performanceMonitorService.subscribeToMetrics((newMetrics) => {
        setMetrics(newMetrics);
      });

      const unsubscribeAlerts = performanceMonitorService.subscribeToAlerts((newAlerts) => {
        setAlerts(newAlerts);
      });

      const unsubscribeBackgroundTasks = performanceMonitorService.subscribeToBackgroundTasks((newTasks) => {
        setTasks(newTasks);
      });

      setWorkflows(performanceMonitorService.getWorkflowExecutions());
      setBenchmarks(performanceMonitorService.getBenchmarks());
      setIsMonitoring(performanceMonitorService.getConfig().enabled);

      return () => {
        unsubscribeMetrics();
        unsubscribeAlerts();
        unsubscribeBackgroundTasks();
      };
    }
  }, [isOpen]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getCurrentMetrics = useMemo(() => {
    return metrics[metrics.length - 1] || null;
  }, [metrics]);

  const toggleMonitoring = useCallback(() => {
    const newState = !isMonitoring;
    performanceMonitorService.updateConfig({ enabled: newState });
    setIsMonitoring(newState);
  }, [isMonitoring]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    performanceMonitorService.acknowledgeAlert(alertId);
  }, []);

  const acknowledgeAllAlerts = useCallback(() => {
    performanceMonitorService.acknowledgeAllAlerts();
  }, []);

  const clearAlerts = useCallback(() => {
    if (confirm('确定要清除所有告警吗？')) {
      performanceMonitorService.clearAlerts();
    }
  }, []);

  const createBenchmark = useCallback(() => {
    const name = prompt('请输入基准名称:');
    if (name) {
      const description = prompt('请输入基准描述:') || '';
      performanceMonitorService.createBenchmark(name, description);
      setBenchmarks(performanceMonitorService.getBenchmarks());
    }
  }, []);

  const generateReport = useCallback(() => {
    const report = performanceMonitorService.generateReport();
    const reportData = JSON.stringify(report, null, 2);
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/10';
      case 'running': return 'text-gray-400 bg-gray-500/10';
      case 'failed': return 'text-red-400 bg-red-500/10';
      case 'paused': return 'text-yellow-400 bg-yellow-500/10';
      case 'queued': return 'text-gray-400 bg-gray-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  const getPriorityColor = (priority: WorkflowPriority) => {
    switch (priority) {
      case 'urgent': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'normal': return 'text-gray-400';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getPriorityLabel = (priority: WorkflowPriority) => {
    switch (priority) {
      case 'urgent': return '紧急';
      case 'high': return '高';
      case 'normal': return '普通';
      case 'low': return '低';
      default: return '普通';
    }
  };

  const ProgressBar = ({ value, max = 100, color = 'bg-[#FF6B00]' }: { value: number; max?: number; color?: string }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
      <div className="w-full h-2 bg-[#2D2D2D] rounded-full overflow-hidden">
        <div className={cn('h-full transition-all duration-300', color)} style={{ width: `${percentage}%` }} />
      </div>
    );
  };

  const MetricCard = ({ title, value, unit, icon: Icon, color, trend }: any) => (
    <div className="p-4 bg-[#222227] border border-[#2D2D2D] rounded-xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">
              {value}
              <span className="text-sm text-gray-500 font-normal ml-1">{unit}</span>
            </p>
          </div>
        </div>
        {trend && (
          <div className={cn('flex items-center gap-1 text-sm', trend > 0 ? 'text-green-400' : 'text-red-400')}>
            <TrendingUp className={cn('w-4 h-4', trend < 0 && 'rotate-180')} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl h-[85vh] bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-xl shadow-lg hover:shadow-red-500/30 transition-all"
              title="关闭面板"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#FF6B00] to-[#CC5500] rounded-xl">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">性能监控中心</h2>
              <p className="text-xs text-gray-400">
                <span className={cn('flex items-center gap-1', isMonitoring ? 'text-green-400' : 'text-gray-400')}>
                  <span className={cn('w-2 h-2 rounded-full', isMonitoring ? 'bg-green-400 animate-pulse' : 'bg-gray-500')} />
                  {isMonitoring ? '监控中' : '已暂停'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMonitoring}
              className="flex items-center gap-2 px-3 py-2 bg-[#2D2D2D] text-white rounded-lg hover:bg-[#3D3D45] transition-colors text-sm"
            >
              <RefreshCw className={cn('w-4 h-4', isMonitoring && 'animate-spin')} />
              {isMonitoring ? '暂停监控' : '开始监控'}
            </button>
            <button
              onClick={generateReport}
              className="flex items-center gap-2 px-3 py-2 bg-[#2D2D2D] text-white rounded-lg hover:bg-[#3D3D45] transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
          </div>
        </div>

        <div className="flex border-b border-[#2D2D2D]">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'overview'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <BarChart3 className="w-4 h-4" />
            概览
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'workflows'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <PlayCircle className="w-4 h-4" />
            工作流
            {activeTab === 'workflows' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'alerts'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Bell className="w-4 h-4" />
            告警 ({alerts.filter(a => !a.acknowledged).length})
            {activeTab === 'alerts' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'benchmarks'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Zap className="w-4 h-4" />
            基准 ({benchmarks.length})
            {activeTab === 'benchmarks' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'tasks'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Settings className="w-4 h-4" />
            后台任务 ({tasks.length})
            {activeTab === 'tasks' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'overview' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard
                  title="CPU 使用率"
                  value={getCurrentMetrics?.cpuUsage.toFixed(1) || '0'}
                  unit="%"
                  icon={Cpu}
                  color="bg-gray-500"
                />
                <MetricCard
                  title="内存使用"
                  value={getCurrentMetrics?.memoryUsage.toFixed(1) || '0'}
                  unit="%"
                  icon={Activity}
                  color="bg-purple-500"
                />
                <MetricCard
                  title="磁盘读取"
                  value={getCurrentMetrics?.diskReadMBps.toFixed(1) || '0'}
                  unit="MB/s"
                  icon={HardDrive}
                  color="bg-green-500"
                />
                <MetricCard
                  title="网络发送"
                  value={getCurrentMetrics?.networkTxMBps.toFixed(1) || '0'}
                  unit="MB/s"
                  icon={Wifi}
                  color="bg-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#222227] border border-[#2D2D2D] rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">内存详情</h3>
                    <Activity className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">已使用</span>
                        <span className="text-white">{getCurrentMetrics?.memoryUsedMB.toFixed(0) || '0'} MB</span>
                      </div>
                      <ProgressBar
                        value={getCurrentMetrics?.memoryUsedMB || 0}
                        max={getCurrentMetrics?.memoryTotalMB || 2048}
                        color="bg-purple-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">总计</span>
                        <span className="text-gray-400">{getCurrentMetrics?.memoryTotalMB.toFixed(0) || '0'} MB</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#222227] border border-[#2D2D2D] rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">磁盘空间</h3>
                    <HardDrive className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">已使用</span>
                        <span className="text-white">{getCurrentMetrics?.diskSpaceUsedGB.toFixed(0) || '0'} GB</span>
                      </div>
                      <ProgressBar
                        value={getCurrentMetrics?.diskSpaceUsedGB || 0}
                        max={getCurrentMetrics?.diskSpaceTotalGB || 500}
                        color="bg-green-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">总计</span>
                        <span className="text-gray-400">{getCurrentMetrics?.diskSpaceTotalGB.toFixed(0) || '0'} GB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {alerts.filter(a => !a.acknowledged).length > 0 && (
                <div className="mt-6 bg-[#222227] border border-[#2D2D2D] rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      <h3 className="text-sm font-semibold text-white">最新告警</h3>
                    </div>
                    <span className="text-xs text-gray-400">
                      {alerts.filter(a => !a.acknowledged).length} 条未处理
                    </span>
                  </div>
                  <div className="space-y-2">
                    {alerts.filter(a => !a.acknowledged).slice(0, 3).map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          'p-3 rounded-lg border flex items-center justify-between',
                          alert.level === 'critical'
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-yellow-500/10 border-yellow-500/20'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {alert.level === 'critical' ? (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          )}
                          <div>
                            <p className={cn('text-sm font-medium', alert.level === 'critical' ? 'text-red-400' : 'text-yellow-400')}>
                              {alert.message}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(alert.timestamp)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          标记已读
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'workflows' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">工作流执行记录</span>
                <span className="text-xs text-gray-500">共 {workflows.length} 条</span>
              </div>
              {workflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <PlayCircle className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">暂无工作流执行记录</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workflows.map((workflow) => (
                    <div
                      key={workflow.executionId}
                      className="p-4 bg-[#222227] border border-[#2D2D2D] rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={cn('px-2 py-1 text-xs rounded', getStatusColor(workflow.status))}>
                            {workflow.status === 'completed' ? '已完成' :
                             workflow.status === 'running' ? '执行中' :
                             workflow.status === 'failed' ? '失败' :
                             workflow.status === 'paused' ? '已暂停' : '等待中'}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-white">
                              执行 #{workflow.executionId.slice(0, 8)}
                            </p>
                            <p className="text-xs text-gray-500">
                              开始于 {formatDate(workflow.startTime)}
                            </p>
                          </div>
                        </div>
                        {workflow.totalDurationMs && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">
                              {formatDuration(workflow.totalDurationMs)}
                            </p>
                            <p className="text-xs text-gray-500">总耗时</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          <span>{workflow.completedNodes}/{workflow.totalNodes} 节点完成</span>
                        </div>
                        {workflow.failedNodes > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-400" />
                            <span>{workflow.failedNodes} 节点失败</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">告警记录</span>
                <div className="flex items-center gap-2">
                  {alerts.length > 0 && (
                    <>
                      <button
                        onClick={acknowledgeAllAlerts}
                        className="text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-500/10 px-2 py-1 rounded transition-colors"
                      >
                        全部已读
                      </button>
                      <button
                        onClick={clearAlerts}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                      >
                        清除全部
                      </button>
                    </>
                  )}
                </div>
              </div>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Bell className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">暂无告警</p>
                  <p className="text-xs text-gray-600 mt-1">系统运行正常</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all',
                        alert.acknowledged
                          ? 'bg-[#222227]/50 border-[#2D2D2D]/50 opacity-60'
                          : 'bg-[#222227] border-[#2D2D2D]',
                        !alert.acknowledged && alert.level === 'critical'
                          ? 'border-red-500/30'
                          : !alert.acknowledged && alert.level === 'warning'
                          ? 'border-yellow-500/30'
                          : ''
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {alert.level === 'critical' ? (
                            <AlertCircle className={cn('w-5 h-5 mt-0.5', alert.acknowledged ? 'text-gray-500' : 'text-red-400')} />
                          ) : (
                            <AlertTriangle className={cn('w-5 h-5 mt-0.5', alert.acknowledged ? 'text-gray-500' : 'text-yellow-400')} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={cn('text-sm font-medium', alert.acknowledged ? 'text-gray-400' : 'text-white')}>
                                {alert.message}
                              </p>
                              {alert.acknowledged && (
                                <span className="text-xs text-gray-500">(已读)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>阈值: {alert.threshold}</span>
                              <span>当前值: {alert.value.toFixed(2)}</span>
                              <span>{formatDate(alert.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="text-xs text-gray-400 hover:text-gray-300 transition-colors whitespace-nowrap"
                          >
                            标记已读
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'benchmarks' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">性能基准</span>
                <button
                  onClick={createBenchmark}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#FF6B00] text-white text-sm rounded-lg hover:bg-[#CC5500] transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  创建基准
                </button>
              </div>
              {benchmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Zap className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">暂无性能基准</p>
                  <p className="text-xs text-gray-600 mt-1">点击上方按钮创建基准</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {benchmarks.map((benchmark) => (
                    <div
                      key={benchmark.benchmarkId}
                      className="p-4 bg-[#222227] border border-[#2D2D2D] rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center',
                            benchmark.baseline ? 'bg-[#FF6B00]' : 'bg-[#2D2D2D]'
                          )}>
                            <Zap className={cn('w-5 h-5', benchmark.baseline ? 'text-white' : 'text-gray-400')} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{benchmark.name}</p>
                              {benchmark.baseline && (
                                <span className="text-xs px-2 py-0.5 bg-[#FF6B00]/20 text-[#FF6B00] rounded">基准</span>
                              )}
                            </div>
                            {benchmark.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{benchmark.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">{formatDate(benchmark.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#2D2D2D]">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-white">
                            {formatDuration(benchmark.metrics.averageWorkflowDurationMs)}
                          </p>
                          <p className="text-xs text-gray-500">平均工作流耗时</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-white">
                            {formatDuration(benchmark.metrics.averageNodeDurationMs)}
                          </p>
                          <p className="text-xs text-gray-500">平均节点耗时</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-white">
                            {benchmark.metrics.memoryPeakMB.toFixed(0)} MB
                          </p>
                          <p className="text-xs text-gray-500">峰值内存</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">后台任务</span>
                <span className="text-xs text-gray-500">
                  {tasks.filter(t => t.status === 'running').length} 运行中
                </span>
              </div>
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Settings className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">暂无后台任务</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.taskId}
                      className="p-4 bg-[#222227] border border-[#2D2D2D] rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={cn('px-2 py-1 text-xs rounded', getStatusColor(task.status))}>
                            {task.status === 'queued' ? '队列中' :
                             task.status === 'running' ? '运行中' :
                             task.status === 'completed' ? '已完成' :
                             task.status === 'failed' ? '失败' : '已暂停'}
                          </span>
                          <span className={cn('text-xs font-medium', getPriorityColor(task.priority))}>
                            [{getPriorityLabel(task.priority)}]
                          </span>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {task.type === 'workflow' ? '工作流' :
                               task.type === 'node' ? '节点' :
                               task.type === 'api' ? 'API 调用' : '其他'} 任务
                            </p>
                            <p className="text-xs text-gray-500">
                              创建于 {formatDate(task.createdAt)}
                            </p>
                          </div>
                        </div>
                        {task.status === 'running' && (
                          <span className="text-sm font-medium text-[#FF6B00]">
                            {task.progress}%
                          </span>
                        )}
                      </div>
                      {(task.status === 'running' || task.status === 'queued') && (
                        <ProgressBar value={task.progress} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D2D2D] hover:bg-red-500/80 text-white rounded-lg hover:shadow-lg transition-all"
            title="关闭"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">关闭</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitorPanel;
