import { useState, useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '@/store/useTaskStore';
import { GenerationTask, GenerationSubTask } from '@/types/ai-models';
import { PlayCircle as Play, Clock, CheckCircle, XCircle, Loader2, Download, RotateCcw, ChevronUp, ChevronDown, Image as ImageIcon, Film, AlertCircle, GripVertical, Maximize2, Minimize2, Pause, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transformLocalhostUrl } from '@/lib/api-config';
import { getModelShortLabel } from '@/lib/model-short-labels';
import { backendProxyAdapter } from '@/services/adapters/backend-proxy-adapter';

interface TaskQueuePanelProps {
  isOpen?: boolean;
}

interface TaskCardProps {
  task: GenerationTask;
  onRetry: (id: string) => void;
  onDownload: (url: string, filename?: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}

const SubTaskRow = ({ subTask }: { subTask: GenerationSubTask }) => {
  const config = subTask.status === 'completed'
    ? { icon: CheckCircle, color: 'text-emerald-400', bar: 'bg-emerald-500' }
    : subTask.status === 'processing'
    ? { icon: Loader2, color: 'text-cyan-400', bar: 'bg-gradient-to-r from-cyan-500 to-blue-500' }
    : subTask.status === 'failed'
    ? { icon: XCircle, color: 'text-red-400', bar: 'bg-red-500' }
    : { icon: Clock, color: 'text-yellow-400', bar: 'bg-yellow-500' };
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-3 w-3 shrink-0', subTask.status === 'processing' && 'animate-spin', config.color)} />
      <span className="w-6 shrink-0 text-[9px] font-bold tabular-nums text-white/40">#{subTask.index + 1}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', config.bar)}
          style={{ width: `${subTask.progress || 0}%` }}
        />
      </div>
      <span className={cn('w-8 shrink-0 text-right text-[9px] font-medium tabular-nums', config.color)}>
        {subTask.status === 'completed' ? '100' : subTask.status === 'pending' ? '—' : `${subTask.progress || 0}%`}
      </span>
    </div>
  );
};

const TaskCard = ({ task, onRetry, onDownload, onPause, onResume, onRemove }: TaskCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false);
  
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          label: '等待中',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          progressColor: 'bg-yellow-500'
        };
      case 'processing':
        return {
          icon: Loader2,
          label: '生成中',
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          progressColor: 'bg-gradient-to-r from-gray-500 to-cyan-500'
        };
      case 'completed':
        return {
          icon: CheckCircle,
          label: '已完成',
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          progressColor: 'bg-emerald-500'
        };
      case 'failed':
        return {
          icon: XCircle,
          label: '失败',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          progressColor: 'bg-red-500'
        };
      case 'cancelled':
        return {
          icon: XCircle,
          label: '已停止',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          progressColor: 'bg-red-500'
        };
      default:
        return {
          icon: Clock,
          label: status,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          progressColor: 'bg-gray-500'
        };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;
  const isVideo = task.nodeType === 'video';
  const timeAgo = getTimeAgo(task.createdAt);
  const resolvedResultUrl = isVideo
    ? (task.cosUrl ? transformLocalhostUrl(task.cosUrl) : (task.resultUrl ? transformLocalhostUrl(task.resultUrl) : undefined))
    : (task.cosUrl ? transformLocalhostUrl(task.cosUrl) : (task.resultUrl ? transformLocalhostUrl(task.resultUrl) : undefined));

  useEffect(() => {
    setMediaLoadFailed(false);
  }, [resolvedResultUrl]);

  return (
    <div 
      className={cn(
        "relative bg-[#1E1E22] rounded-xl border transition-all duration-300 overflow-hidden",
        "hover:shadow-lg hover:shadow-black/20",
        task.status === 'processing' && "ring-1 ring-gray-500/30",
        task.status === 'failed' && "ring-1 ring-red-500/30"
      )}
      style={{ borderColor: statusConfig.borderColor }}
    >
      <div className={cn("h-1", statusConfig.progressColor)} />
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isVideo ? "bg-purple-500/20" : "bg-gray-500/20"
            )}>
              {isVideo ? (
                <Film className="w-5 h-5 text-purple-400" />
              ) : (
                <ImageIcon className="w-5 h-5 text-gray-400" />
              )}
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-white">
                {isVideo ? '视频生成' : '图片生成'}
              </h3>
              <p className="text-xs text-gray-500">
                {timeAgo}
              </p>
            </div>
          </div>
          
          <div className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5",
            statusConfig.bgColor,
            statusConfig.color
          )}>
            <StatusIcon className={cn("w-3 h-3", task.status === 'processing' && "animate-spin")} />
            {statusConfig.label}
          </div>
        </div>

        {task.status === 'processing' && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400">生成进度</span>
              <span className={cn("font-medium", statusConfig.color)}>{task.progress || 0}%</span>
            </div>
            <div className="h-2 bg-[#2A2A2E] rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  statusConfig.progressColor
                )}
                style={{ width: `${task.progress || 0}%` }}
              />
            </div>
          </div>
        )}

        {task.subTasks && task.subTasks.length > 1 && (
          <div className="mb-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                批量生成 · {task.subTasks.length} 张
              </span>
              <span className="text-[10px] tabular-nums text-white/50">
                {task.subTasks.filter(st => st.status === 'completed').length}/{task.subTasks.length} 完成
              </span>
            </div>
            <div className="space-y-1.5">
              {task.subTasks.map((st) => (
                <SubTaskRow key={st.index} subTask={st} />
              ))}
            </div>
          </div>
        )}

        {task.status === 'completed' && task.subTasks && task.subTasks.length > 1 && task.subTasks.some(st => st.resultUrl) && (
          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {task.subTasks.filter(st => st.resultUrl).slice(0, 4).map((st) => (
              <div key={st.index} className="relative aspect-square overflow-hidden rounded-md border border-white/[0.06] bg-[#2A2A2E]">
                <img
                  src={transformLocalhostUrl(st.resultUrl!)}
                  alt={`结果 ${st.index + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                  <span className="text-[8px] font-medium text-white/80">#{st.index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {(task.modelId || task.promptPreview) && (task.status === 'processing' || task.status === 'completed') && (
          <div className="mb-3 rounded-md bg-black/15 px-2.5 py-1.5">
            {task.modelId && (
              <div className="flex items-center gap-1.5 text-[9px] text-white/40">
                {task.modelName ? (
                  <span className="font-medium text-white/55 truncate">{getModelShortLabel(task.modelId, task.modelName)}</span>
                ) : (
                  <>
                    <span className="font-mono">{task.modelProvider || 'unknown'}</span>
                    <span className="text-white/20">/</span>
                    <span className="font-mono truncate">{task.modelId}</span>
                  </>
                )}
              </div>
            )}
            {task.promptPreview && (
              <p className="mt-0.5 line-clamp-1 text-[9px] text-white/30">{task.promptPreview}</p>
            )}
          </div>
        )}

        {task.status === 'completed' && resolvedResultUrl && !mediaLoadFailed && (
          <div 
            className="relative mb-3 rounded-lg overflow-hidden bg-[#2A2A2E] cursor-pointer group"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isVideo ? (
              <video 
                src={resolvedResultUrl} 
                className="w-full h-32 object-cover"
                muted
                preload="metadata"
                onError={() => setMediaLoadFailed(true)}
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
            ) : (
              <img 
                src={resolvedResultUrl} 
                alt="生成结果" 
                className="w-full h-32 object-cover"
                onError={() => setMediaLoadFailed(true)}
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {task.status === 'completed' && resolvedResultUrl && mediaLoadFailed && (
          <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300 leading-relaxed">
                结果文件暂时无法访问，可能是本地上传文件已丢失或云端存储未同步。请重新生成或检查上传目录配置。
              </p>
            </div>
          </div>
        )}

        {task.status === 'failed' && task.error && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-400 leading-relaxed">
                {task.error}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {task.status === 'processing' && (
            <>
              <button
                onClick={() => onPause(task.id)}
                className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pause className="w-2.5 h-2.5" />
                停止
              </button>
              <button
                onClick={() => onRemove(task.id)}
                className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                删除
              </button>
            </>
          )}

          {task.status === 'paused' && (
            <>
              <button
                onClick={() => onResume(task.id)}
                className="py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-2.5 h-2.5" />
                继续
              </button>
              <button
                onClick={() => onRemove(task.id)}
                className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                删除
              </button>
            </>
          )}

          {task.status === 'pending' && (
            <>
              <button
                onClick={() => onRemove(task.id)}
                className="col-span-2 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                删除
              </button>
            </>
          )}

          {task.status === 'failed' && (
            <>
              <button
                onClick={() => onRetry(task.id)}
                className="py-2 px-3 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                重试
              </button>
              <button
                onClick={() => onRemove(task.id)}
                className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                删除
              </button>
            </>
          )}

          {task.status === 'completed' && (
            <>
              {resolvedResultUrl && (
                <button
                  onClick={() => onDownload(resolvedResultUrl, `生成结果_${task.id.slice(0, 8)}`)}
                  className="py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-2.5 h-2.5" />
                  下载
                </button>
              )}
              <button
                onClick={() => onRemove(task.id)}
                className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                删除
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function getTimeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return past.toLocaleDateString('zh-CN');
}

export default function TaskQueuePanel({ isOpen = true }: TaskQueuePanelProps) {
  const { tasks, updateTask, removeTask, cancelTask, resumeTask } = useTaskStore();
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'processing' | 'completed' | 'failed'>('all');
  const [isFullSize, setIsFullSize] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // 调节大小相关状态
  const [panelWidth, setPanelWidth] = useState(360);
  const [panelHeight, setPanelHeight] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'horizontal' | 'vertical' | 'corner' | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });

  const taskList = Object.values(tasks).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredTasks = taskList.filter(task => {
    if (activeTab === 'all') return true;
    if (activeTab === 'processing') return task.status === 'processing' || task.status === 'pending';
    if (activeTab === 'completed') return task.status === 'completed';
    if (activeTab === 'failed') return task.status === 'failed';
    return true;
  });

  const stats = {
    total: taskList.length,
    processing: taskList.filter(t => t.status === 'processing').length,
    pending: taskList.filter(t => t.status === 'pending').length,
    completed: taskList.filter(t => t.status === 'completed').length,
    failed: taskList.filter(t => t.status === 'failed').length,
  };
  const activeTask = taskList.find(task => task.status === 'processing');
  const activeProgress = activeTask
    ? Math.max(0, Math.min(99, Math.round(Number(activeTask.progress || 0))))
    : 0;

  const retryTask = useCallback(async (taskId: string) => {
    const task = tasks[taskId];
    if (!task) return;
    if (task.status !== 'failed' && task.status !== 'completed' && task.status !== 'cancelled') {
      return;
    }

    // 本地先重置为 pending，让 UI 立即反馈
    updateTask(taskId, { status: 'pending', progress: 0, error: undefined });

    const backendTaskId = task.backendTaskId;
    if (!backendTaskId) {
      // 无后端任务 ID（可能是本地草稿任务），仅本地重置
      return;
    }

    try {
      const result = await backendProxyAdapter.retryTask(backendTaskId);
      if (result.success && result.newTaskId && result.newTaskId !== backendTaskId) {
        // 后端已创建新 Task 记录，更新 backendTaskId 以便 WS 桥接器匹配后续进度
        updateTask(taskId, { backendTaskId: result.newTaskId });
      } else if (!result.success) {
        // 后端重试失败：还原为 failed 状态并提示
        updateTask(taskId, { status: 'failed', error: '重试失败，请稍后再试' });
      }
    } catch (error) {
      console.warn('[TaskQueuePanel] 重试远端任务失败:', error);
      updateTask(taskId, { status: 'failed', error: '重试失败，请稍后再试' });
    }
  }, [tasks, updateTask]);

  const handleDownload = useCallback((url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'result';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const clearCompleted = useCallback(() => {
    Object.keys(tasks).forEach(id => {
      if (tasks[id].status === 'completed' || tasks[id].status === 'failed') {
        removeTask(id);
      }
    });
  }, [tasks, removeTask]);

  const cancelRemoteTask = useCallback(async (taskId: string) => {
    const backendTaskId = tasks[taskId]?.backendTaskId;
    if (!backendTaskId) {
      return true;
    }

    try {
      return await backendProxyAdapter.cancelTask(backendTaskId);
    } catch (error) {
      console.warn('[TaskQueuePanel] 取消远端任务失败:', error);
      return false;
    }
  }, [tasks]);

  const stopTask = useCallback(async (taskId: string) => {
    await cancelRemoteTask(taskId);
    cancelTask(taskId);
  }, [cancelRemoteTask, cancelTask]);

  const handleRemoveTask = useCallback(async (taskId: string) => {
    await cancelRemoteTask(taskId);
    removeTask(taskId);
  }, [cancelRemoteTask, removeTask]);

  // 调节大小处理
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'horizontal' | 'vertical' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startSizeRef.current = { width: panelWidth, height: panelHeight };
    document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : direction === 'vertical' ? 'ns-resize' : 'nwse-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth, panelHeight]);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;

      if (resizeDirection === 'horizontal' || resizeDirection === 'corner') {
        const newWidth = Math.max(280, Math.min(500, startSizeRef.current.width + deltaX));
        setPanelWidth(newWidth);
      }
      
      if (resizeDirection === 'vertical' || resizeDirection === 'corner') {
        const newHeight = Math.max(300, Math.min(700, startSizeRef.current.height + deltaY));
        setPanelHeight(newHeight);
      }
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      setResizeDirection(null);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, resizeDirection]);

  const toggleFullSize = useCallback(() => {
    if (isFullSize) {
      setPanelWidth(360);
      setPanelHeight(480);
    } else {
      setPanelWidth(Math.min(window.innerWidth - 64, 480));
      setPanelHeight(Math.min(window.innerHeight - 100, 600));
    }
    setIsFullSize(!isFullSize);
  }, [isFullSize]);

  if (!isOpen) return null;

  const currentWidth = isFullSize ? Math.min(window.innerWidth - 64, 480) : panelWidth;
  const currentHeight = isFullSize ? Math.min(window.innerHeight - 100, 600) : panelHeight;

  return (
    <div
      ref={panelRef}
      className="fixed z-[9999] bg-[#1A1A1E] border border-[#2A2A2E] rounded-2xl overflow-hidden flex flex-col transition-all duration-300"
      style={{
        right: '16px',
        bottom: 'auto',
        top: '50%',
        transform: 'translateY(-50%)',
        width: collapsed ? 'auto' : `${currentWidth}px`,
      }}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-3 px-4 py-3 bg-[#252528] hover:bg-[#2D2D2D] rounded-xl transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            {stats.processing > 0 && (
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{stats.processing}</span>
              </div>
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-white">生成队列</p>
              <p className="text-[10px] tabular-nums text-gray-400">
                {activeTask
                  ? `生成中 ${activeProgress}%`
                  : stats.total > 0
                    ? `${stats.total} 个任务`
                    : '暂无任务'}
              </p>
              {activeTask && (
                <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
                    style={{ width: `${activeProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors -rotate-90" />
        </button>
      ) : (
        <div className="flex flex-col" style={{ height: `${currentHeight}px` }}>
          {/* 左侧调节手柄 */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group"
            onMouseDown={(e) => handleResizeStart(e, 'horizontal')}
          >
            <div className={cn(
              "absolute inset-y-0 left-0 w-1 group-hover:w-1.5 transition-all flex items-center justify-center",
              isResizing && resizeDirection === 'horizontal' ? 'w-1.5 bg-gray-500' : 'bg-transparent hover:bg-gray-500/30'
            )}>
              <GripVertical className="w-2 h-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 底部调节手柄 */}
          <div
            className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize z-10 group"
            onMouseDown={(e) => handleResizeStart(e, 'vertical')}
          >
            <div className={cn(
              "absolute inset-x-0 bottom-0 h-1 group-hover:h-1.5 transition-all flex items-center justify-center",
              isResizing && resizeDirection === 'vertical' ? 'h-1.5 bg-gray-500' : 'bg-transparent hover:bg-gray-500/30'
            )}>
              <GripVertical className="w-2 h-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity rotate-90" />
            </div>
          </div>

          {/* 右下角调节手柄 */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10 group"
            onMouseDown={(e) => handleResizeStart(e, 'corner')}
          >
            <div className={cn(
              "absolute bottom-0 right-0 transition-all",
              isResizing && resizeDirection === 'corner' ? 'w-4 h-4 bg-gray-500/50' : 'w-3 h-3 bg-transparent group-hover:bg-gray-500/30 rounded-tr-lg'
            )}>
              <GripVertical className="w-2 h-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity rotate-45 absolute bottom-0 right-0" />
            </div>
          </div>

          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#252528] border-b border-[#2A2A2E] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xs font-semibold text-white">生成队列</h2>
                <p className="text-[10px] text-gray-400">
                  {stats.processing > 0 
                    ? `${stats.processing} 正在生成中`
                    : stats.total > 0 
                      ? `${stats.total} 个任务`
                      : '暂无任务'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={toggleFullSize}
                className="p-1.5 rounded-md bg-[#2A2A2E] hover:bg-[#3A3A3E] text-gray-400 hover:text-white transition-colors"
                title={isFullSize ? "还原大小" : "最大化"}
            >
                {isFullSize ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
              
              <button 
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-md bg-[#2A2A2E] hover:bg-[#3A3A3E] text-gray-400 hover:text-white transition-colors"
                title="收起"
            >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="px-4 py-2 bg-[#1E1E22] border-b border-[#2A2A2E] flex-shrink-0">
            <div className="grid grid-cols-4 gap-1.5">
              <div className="text-center p-1.5 rounded-md bg-gray-500/10">
                <p className="text-sm font-bold text-gray-400">{stats.processing}</p>
                <p className="text-[9px] text-gray-400">进行中</p>
              </div>
              <div className="text-center p-1.5 rounded-md bg-yellow-500/10">
                <p className="text-sm font-bold text-yellow-400">{stats.pending}</p>
                <p className="text-[9px] text-gray-400">等待</p>
              </div>
              <div className="text-center p-1.5 rounded-md bg-emerald-500/10">
                <p className="text-sm font-bold text-emerald-400">{stats.completed}</p>
                <p className="text-[9px] text-gray-400">完成</p>
              </div>
              <div className="text-center p-1.5 rounded-md bg-red-500/10">
                <p className="text-sm font-bold text-red-400">{stats.failed}</p>
                <p className="text-[9px] text-gray-400">失败</p>
              </div>
            </div>
          </div>

          {/* 标签页 */}
          <div className="px-4 py-1.5 bg-[#1E1E22] border-b border-[#2A2A2E] flex items-center gap-1 flex-shrink-0">
            {(['all', 'processing', 'completed', 'failed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                  activeTab === tab
                    ? "bg-gray-500/20 text-gray-400"
                    : "text-gray-400 hover:text-white hover:bg-[#2A2A2E]"
                )}
              >
                {tab === 'all' && `全部 (${stats.total})`}
                {tab === 'processing' && `进行中 (${stats.processing + stats.pending})`}
                {tab === 'completed' && `完成 (${stats.completed})`}
                {tab === 'failed' && `失败 (${stats.failed})`}
              </button>
            ))}
            
            <div className="flex-1" />
            
            {(stats.completed > 0 || stats.failed > 0) && (
              <button 
                onClick={clearCompleted}
                className="px-2 py-1 text-[10px] text-gray-400 hover:text-red-400 transition-colors"
              >
                清空
              </button>
            )}
          </div>

          {/* 任务列表 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-[#2A2A2E] rounded-full flex items-center justify-center mb-3">
                  <Film className="w-6 h-6 text-gray-500" />
                </div>
                <p className="text-xs text-gray-400 mb-1">
                  {activeTab === 'all' ? '暂无生成任务' : '没有符合条件的任务'}
                </p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onRetry={retryTask}
                  onDownload={handleDownload}
                  onPause={stopTask}
                  onResume={resumeTask}
                  onRemove={handleRemoveTask}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
