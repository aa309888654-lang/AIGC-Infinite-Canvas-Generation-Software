import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { X, PlayCircle as Play, Pause, RotateCcw, Trash2, AlertCircle, CheckCircle2, Clock, Zap, Layers, Settings2, Search, Plus, Activity, Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useEnhancedTaskStore,
  createTestTasks,
} from '@/store/useEnhancedTaskStore';
import {
  EnhancedTask,
  EnhancedTaskStatus,
  EnhancedTaskPriority,
} from '@/types/enhanced-task-scheduler';
import { cn } from '@/lib/utils';

interface EnhancedTaskQueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const getStatusColor = (status: EnhancedTaskStatus): string => {
  switch (status) {
    case 'running':
      return '#9CA3AF';
    case 'completed':
      return '#10B981';
    case 'failed':
      return '#EF4444';
    case 'cancelled':
      return '#6B7280';
    case 'paused':
      return '#00E5FF';
    case 'preempted':
      return '#00E5FF';
    case 'retrying':
      return '#F97316';
    default:
      return '#9CA3AF';
  }
};

const getPriorityColor = (priority: EnhancedTaskPriority): string => {
  switch (priority) {
    case 'urgent':
      return '#EF4444';
    case 'high':
      return '#00E5FF';
    case 'medium':
      return '#9CA3AF';
    case 'low':
      return '#10B981';
    case 'background':
      return '#6B7280';
    default:
      return '#9CA3AF';
  }
};

const getStatusLabel = (status: EnhancedTaskStatus): string => {
  const labels: Record<EnhancedTaskStatus, string> = {
    idle: '空闲',
    queued: '队列中',
    scheduled: '已调度',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    preempted: '已抢占',
    retrying: '重试中',
  };
  return labels[status] || status;
};

const getPriorityLabel = (priority: EnhancedTaskPriority): string => {
  const labels: Record<EnhancedTaskPriority, string> = {
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
    background: '后台',
  };
  return labels[priority] || priority;
};

const TaskItem = memo(({ 
  task, 
  isSelected, 
  onClick 
}: { 
  task: EnhancedTask;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const {
    cancelTask,
    retryTask,
    pauseTask,
    resumeTask,
  } = useEnhancedTaskStore();

  const handleAction = useCallback((e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    switch (action) {
      case 'cancel':
        cancelTask(task.id);
        break;
      case 'retry':
        retryTask(task.id);
        break;
      case 'pause':
        pauseTask(task.id);
        break;
      case 'resume':
        resumeTask(task.id);
        break;
    }
  }, [task.id, cancelTask, retryTask, pauseTask, resumeTask]);

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg cursor-pointer transition-all border',
        isSelected
          ? 'bg-[#6610F2]/20 border-[#6610F2]/50'
          : 'bg-[#252528] border-transparent hover:border-[#4A4A4E]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStatusColor(task.status) }}
            />
            <span className="text-sm font-medium text-white truncate">
              {task.name}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${getPriorityColor(task.priority)}20`,
                color: getPriorityColor(task.priority),
              }}
            >
              {getPriorityLabel(task.priority)}
            </span>
          </div>
          
          {task.description && (
            <p className="text-xs text-white/60 mb-2 line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getStatusLabel(task.status)}
            </span>
            {task.progress > 0 && task.status === 'running' && (
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {task.progress}%
              </span>
            )}
            {task.metrics.totalTime > 0 && (
              <span>
                {(task.metrics.totalTime / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {task.status === 'running' && (
            <button
              onClick={(e) => handleAction(e, 'pause')}
              className="p-1.5 hover:bg-white/10 rounded"
              title="暂停"
            >
              <Pause className="w-4 h-4 text-white/60" />
            </button>
          )}
          {task.status === 'paused' && (
            <button
              onClick={(e) => handleAction(e, 'resume')}
              className="p-1.5 hover:bg-white/10 rounded"
              title="继续"
            >
              <Play className="w-4 h-4 text-white/60" />
            </button>
          )}
          {task.status === 'failed' && (
            <button
              onClick={(e) => handleAction(e, 'retry')}
              className="p-1.5 hover:bg-white/10 rounded"
              title="重试"
            >
              <RotateCcw className="w-4 h-4 text-white/60" />
            </button>
          )}
          {['idle', 'queued', 'running', 'paused'].includes(task.status) && (
            <button
              onClick={(e) => handleAction(e, 'cancel')}
              className="p-1.5 hover:bg-red-500/20 rounded"
              title="取消"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

TaskItem.displayName = 'TaskItem';

const StatsPanel = memo(() => {
  const { stats } = useEnhancedTaskStore();

  return (
    <div className="grid grid-cols-2 gap-3 p-3 bg-[#252528] rounded-lg">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            总任务
          </span>
          <span className="text-white font-medium">{stats.totalTasks}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60 flex items-center gap-1">
            <Play className="w-3 h-3" />
            运行中
          </span>
          <span className="text-gray-400 font-medium">{stats.runningTasks}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            已完成
          </span>
          <span className="text-green-400 font-medium">{stats.completedTasks}</span>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            失败
          </span>
          <span className="text-red-400 font-medium">{stats.failedTasks}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60 flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            成功率
          </span>
          <span className="text-white font-medium">{stats.successRate.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            吞吐量
          </span>
          <span className="text-white font-medium">{stats.throughput.toFixed(2)}/min</span>
        </div>
      </div>
    </div>
  );
});

StatsPanel.displayName = 'StatsPanel';

const EnhancedTaskQueuePanel = memo(({
  isOpen,
  onClose,
}: EnhancedTaskQueuePanelProps) => {
  const {
    selectedTaskId,
    filterStatus,
    filterPriority,
    searchQuery,
    refreshTasks,
    setSelectedTaskId,
    setFilterStatus,
    setFilterPriority,
    setSearchQuery,
    clearCompletedTasks,
    getFilteredTasks,
  } = useEnhancedTaskStore();

  const [showStats, setShowStats] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const filteredTasks = useMemo(() => getFilteredTasks(), [getFilteredTasks]);

  useEffect(() => {
    if (isOpen) {
      refreshTasks();
    }
  }, [isOpen, refreshTasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshTasks();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshTasks]);

  const handleAddTestTasks = useCallback(() => {
    createTestTasks(10);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative overflow-hidden rounded-2xl border flex flex-col"
        style={{
          width: '600px',
          maxHeight: '80vh',
          backgroundColor: '#1A1A1E',
          borderColor: '#3D3D42',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #6610F2 0%, #00E5FF 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">增强任务调度器</span>
              <span className="text-xs text-white/70">智能优先级任务管理</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="关闭"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#252528] border border-[#3D3D42] rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#6610F2]"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as EnhancedTaskStatus | "all")}
              className="px-3 py-2 bg-[#252528] border border-[#3D3D42] rounded-lg text-sm text-white focus:outline-none focus:border-[#6610F2]"
            >
              <option value="all">全部状态</option>
              <option value="idle">空闲</option>
              <option value="queued">队列中</option>
              <option value="running">运行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="cancelled">已取消</option>
            </select>
            
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as EnhancedTaskPriority | "all")}
              className="px-3 py-2 bg-[#252528] border border-[#3D3D42] rounded-lg text-sm text-white focus:outline-none focus:border-[#6610F2]"
            >
              <option value="all">全部优先级</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
              <option value="background">后台</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddTestTasks}
              className="px-3 py-2 bg-[#6610F2] hover:bg-[#7C3AED] rounded-lg text-sm text-white flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加测试任务
            </button>
            
            <button
              onClick={clearCompletedTasks}
              className="px-3 py-2 bg-[#252528] hover:bg-[#2A2A2D] rounded-lg text-sm text-white/70 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清理已完成
            </button>
            
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-2 bg-[#252528] hover:bg-[#2A2A2D] rounded-lg text-sm text-white/70 flex items-center gap-2 transition-colors"
            >
              <Gauge className="w-4 h-4" />
              统计
              {showStats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-2 bg-[#252528] hover:bg-[#2A2A2D] rounded-lg text-sm text-white/70 flex items-center gap-2 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              设置
              {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showStats && <StatsPanel />}

          {showConfig && (
            <div className="p-3 bg-[#252528] rounded-lg">
              <h4 className="text-sm font-semibold text-white mb-3">调度器配置</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">最大并发数</label>
                  <input
                    type="number"
                    value={useEnhancedTaskStore.getState().config.maxConcurrent}
                    onChange={(e) => useEnhancedTaskStore.getState().setConfig({ maxConcurrent: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#1A1A1E] border border-[#4A4A4E] rounded-lg text-sm text-white"
                    min={1}
                    max={20}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/50 text-sm">暂无任务</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  onClick={() => setSelectedTaskId(selectedTaskId === task.id ? null : task.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

EnhancedTaskQueuePanel.displayName = 'EnhancedTaskQueuePanel';

export default EnhancedTaskQueuePanel;
