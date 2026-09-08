import React, { useState, useEffect, useMemo } from 'react';
import {
  PlayCircle as Play,
  Pause,
  X,
  RotateCcw,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  BarChart3,
  Settings,
  MoreVertical
} from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';
import { GenerationTask, TaskStatus, TaskPriority } from '@/types/ai-models';

interface EnhancedGenerationTask extends GenerationTask {
  startedAt?: string;
  completedAt?: string;
  estimatedTime?: number;
  provider?: string;
}

interface GenerationTaskCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const GenerationTaskCenter: React.FC<GenerationTaskCenterProps> = ({ isOpen, onClose }) => {
  const [tasks, setTasks] = useState<EnhancedGenerationTask[]>([]);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'createdAt' | 'status'>('priority');
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(3);

  const { tasks: storeTasks } = useTaskStore();

  useEffect(() => {
    const enhancedTasks: EnhancedGenerationTask[] = Object.values(storeTasks).map(task => ({
      ...task,
      estimatedTime: 30000
    }));
    setTasks(enhancedTasks);
  }, [storeTasks]);

  const filteredTasks = useMemo(() => {
    const filtered = filter === 'all' 
      ? tasks 
      : tasks.filter(t => t.status === filter);

    const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const statusOrder: Record<string, number> = { pending: 0, processing: 1, paused: 2, completed: 3, failed: 4 };

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'status':
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        default:
          return 0;
      }
    });
  }, [tasks, filter, sortBy]);

  const stats = useMemo(() => {
    const counts = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      total: tasks.length
    };
    tasks.forEach(t => counts[t.status]++);
    return counts;
  }, [tasks]);

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'processing': return <Zap className="w-4 h-4 text-gray-400 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'normal': return 'bg-gray-500/20 text-gray-400';
      case 'low': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}分${seconds % 60}秒`;
    return `${seconds}秒`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] flex items-center justify-center">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">生成任务中心</h2>
              <p className="text-xs text-gray-400">管理和监控所有AI生成任务</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="p-4 border-b border-[#2D2D2D] bg-[#252528]">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-300">最大并发任务:</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxConcurrent}
                  onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-[#1A1A1D] border border-[#2D2D2D] rounded text-white text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 p-4 border-b border-[#2D2D2D] bg-[#252528]/50">
          <div className="bg-[#252528] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-400">等待中</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          </div>
          <div className="bg-[#252528] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">生成中</span>
            </div>
            <p className="text-2xl font-bold text-gray-400">{stats.running}</p>
          </div>
          <div className="bg-[#252528] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">已完成</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
          </div>
          <div className="bg-[#252528] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-gray-400">失败</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-[#252528] border border-[#2D2D2D] rounded-lg text-sm text-white"
            >
              <option value="all">全部任务</option>
              <option value="pending">等待中</option>
              <option value="running">生成中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-[#252528] border border-[#2D2D2D] rounded-lg text-sm text-white"
            >
              <option value="priority">按优先级</option>
              <option value="createdAt">按时间</option>
              <option value="status">按状态</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
              <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
              <p>暂无任务</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2D2D2D]">
              {filteredTasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-[#252528] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <GripVertical className="w-4 h-4 text-gray-500 cursor-grab" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(task.status)}
                          <span className="font-medium text-white truncate">
                            {task.id.substring(0, 8)}...
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getPriorityColor(task.priority)}`}>
                            {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : task.priority === 'normal' ? '普通' : '低'}
                          </span>
                          {task.provider && (
                            <span className="text-xs text-gray-400">
                              {task.provider}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {task.status === 'pending' && (
                            <button className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white">
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {task.status === 'processing' && (
                            <button className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white">
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {task.status === 'failed' && (
                            <button className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white">
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="space-y-2">
                          {task.status === 'processing' && (
                            <div>
                              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                <span>进度</span>
                                <span>{task.progress}%</span>
                              </div>
                              <div className="w-full h-2 bg-[#2D2D2D] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#007AFF] to-[#10B981] transition-all"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>创建: {new Date(task.createdAt).toLocaleTimeString('zh-CN')}</span>
                            {task.startedAt && (
                              <span>开始: {new Date(task.startedAt).toLocaleTimeString('zh-CN')}</span>
                            )}
                            {task.completedAt && (
                              <span>耗时: {formatDuration(new Date(task.completedAt).getTime() - new Date(task.startedAt!).getTime())}</span>
                            )}
                            {task.estimatedTime && task.status === 'processing' && (
                              <span>预计: {formatDuration(task.estimatedTime)}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#2D2D2D]">
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#2D2D2D] hover:bg-[#353538] rounded-lg text-white text-sm font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerationTaskCenter;
