import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  ListTodo,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Video,
  Image,
  Music,
  Mic,
  RefreshCw,
  Trash2,
  Download,
  Eye,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  FilterX,
  User,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { taskService, Task, TaskStats } from '@/services/admin/task-service';
import { useToast } from './shared/AdminToast';
import Pagination from './shared/Pagination';
import { webSocketService } from '@/lib/api-core/websocket-service';

type CategoryTab = 'all' | 'image' | 'video' | 'audio' | 'music';

const categoryConfig: Record<CategoryTab, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  all: { label: '全部任务', icon: ListTodo, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' },
  image: { label: 'AI图片', icon: Image, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-500/30' },
  video: { label: 'AI视频', icon: Video, color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/30' },
  audio: { label: 'AI音频', icon: Mic, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/30' },
  music: { label: 'AI音乐', icon: Music, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' },
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: '等待中', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  processing: { label: '处理中', color: 'bg-blue-500/20 text-blue-400', icon: Loader2 },
  completed: { label: '已完成', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  failed: { label: '失败', color: 'bg-red-500/20 text-red-400', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-gray-500/20 text-gray-400', icon: XCircle },
  deleted: { label: '已删除', color: 'bg-gray-500/20 text-gray-500', icon: Trash2 },
  payment_pending: { label: '待支付', color: 'bg-amber-500/20 text-amber-400', icon: Clock },
};

const reviewConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-amber-500/20 text-amber-300 border-amber-500/20' },
  approved: { label: '已通过', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' },
  rejected: { label: '已拒绝', color: 'bg-red-500/20 text-red-300 border-red-500/20' },
};

const TaskManagement: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewSettingLoading, setReviewSettingLoading] = useState(false);
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [batchCancelling, setBatchCancelling] = useState(false);
  const [batchReviewing, setBatchReviewing] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 16;
  const { showToast } = useToast();

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchInput]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTask) setSelectedTask(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTask]);

  const fetchData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);

      const typeParam = activeCategory === 'all' ? undefined : activeCategory;
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;

      const [tasksRes, statsRes] = await Promise.all([
        taskService.getTasks({
          page: currentPage,
          pageSize,
          status: statusParam,
          type: typeParam,
          search: searchQuery || undefined,
          reviewStatus: reviewFilter === 'all' ? undefined : reviewFilter,
        }),
        taskService.getTaskStats(),
      ]);

      setTasks(tasksRes.tasks || tasksRes.data || []);
      const statsData = (statsRes.data || statsRes) as any as TaskStats;
      setStats(statsData);
      const pg = tasksRes.pagination;
      const totalItems = pg?.total || 0;
      setTotalPages(Math.ceil(totalItems / pageSize) || 1);
      setTotal(totalItems);
    } catch (err: unknown) {
      showToast('加载任务失败', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, activeCategory, statusFilter, reviewFilter, searchQuery, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    taskService.getReviewSettings()
      .then((response) => setReviewEnabled(Boolean(response.data?.enabled)))
      .catch(() => showToast('读取内容审核设置失败', 'error'));
  }, [showToast]);

  useEffect(() => {
    const unsubscribe = webSocketService.subscribe('admin:task:updated', () => fetchData(false));
    return unsubscribe;
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeCategory, statusFilter, reviewFilter, searchQuery]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage]);

  const handleRefresh = () => fetchData(false);

  const clearFilters = () => {
    setStatusFilter('all');
    setReviewFilter('all');
    setSearchInput('');
    setSearchQuery('');
    setActiveCategory('all');
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const handleToggleReview = async () => {
    const nextEnabled = !reviewEnabled;
    if (nextEnabled && !confirm('开启后，新生成的图片和视频必须审核通过，用户才能看到。确定开启吗？')) return;
    setReviewSettingLoading(true);
    try {
      const response = await taskService.updateReviewSettings(nextEnabled);
      setReviewEnabled(response.data.enabled);
      showToast(nextEnabled ? '内容审核已开启' : '内容审核已关闭', 'success');
      fetchData(false);
    } catch {
      showToast('更新内容审核设置失败', 'error');
    } finally {
      setReviewSettingLoading(false);
    }
  };

  const handleReviewTask = async (task: Task, status: 'approved' | 'rejected') => {
    const note = status === 'rejected' ? prompt('请输入拒绝原因（用户不会看到内部链接）：')?.trim() : undefined;
    if (status === 'rejected' && note === undefined) return;
    setReviewingIds((previous) => new Set(previous).add(task.id));
    try {
      await taskService.reviewTask(task.id, status, note);
      showToast(status === 'approved' ? '内容已通过并向用户开放' : '内容已拒绝', 'success');
      setSelectedTask(null);
      fetchData(false);
    } catch {
      showToast('审核操作失败', 'error');
    } finally {
      setReviewingIds((previous) => {
        const next = new Set(previous);
        next.delete(task.id);
        return next;
      });
    }
  };

  const handleRetryTask = async (taskId: string) => {
    try {
      await taskService.retryTask(taskId);
      showToast('任务已重新启动', 'success');
      fetchData();
    } catch (err: unknown) {
      showToast('重试失败', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm('确定要删除此任务吗？')) return;
    setDeletingIds(prev => new Set(prev).add(taskId));
    try {
      await taskService.deleteTask(taskId);
      showToast('任务已删除', 'success');
      fetchData();
    } catch (err: unknown) {
      showToast('删除失败', 'error');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    setDeletingIds(prev => new Set(prev).add(taskId));
    try {
      await taskService.restoreTask(taskId);
      showToast('任务已恢复', 'success');
      fetchData();
    } catch (err: unknown) {
      showToast('恢复失败', 'error');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await taskService.cancelTask(taskId);
      showToast('任务已取消', 'success');
      fetchData();
    } catch (err: unknown) {
      showToast('取消失败', 'error');
    }
  };

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const allPageIds = tasks.map(t => t.id);
      const allSelected = allPageIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allPageIds.forEach(id => next.delete(id));
        return next;
      }
      return new Set([...prev, ...allPageIds]);
    });
  }, [tasks]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`确定要删除选中的 ${ids.length} 个任务吗？`)) return;
    setBatchDeleting(true);
    try {
      const res = await taskService.batchDeleteTasks(ids);
      const deletedCount = res.data?.deletedCount ?? ids.length;
      // B2: 部分未命中时给出明确提示，避免误显示
      if (deletedCount < ids.length) {
        showToast(`已删除 ${deletedCount} 个任务，其中 ${ids.length - deletedCount} 个未找到或已删除`, 'success');
      } else {
        showToast(`已删除 ${deletedCount} 个任务`, 'success');
      }
      setSelectedIds(new Set());
      // 删除后若当前页超出新末页，回退到新末页（currentPage 变化会触发 useEffect 自动 fetchData）
      const newTotal = Math.max(0, total - deletedCount);
      const newLastPage = Math.max(1, Math.ceil(newTotal / pageSize));
      if (currentPage > newLastPage) {
        setCurrentPage(newLastPage);
      } else {
        fetchData();
      }
    } catch (err: unknown) {
      showToast('批量删除失败', 'error');
    } finally {
      setBatchDeleting(false);
    }
  };

  const selectedFailedIds = useMemo(
    () => Array.from(selectedIds).filter(id => tasks.find(t => t.id === id)?.status === 'failed'),
    [selectedIds, tasks]
  );
  const selectedActiveIds = useMemo(
    () => Array.from(selectedIds).filter(id => {
      const s = tasks.find(t => t.id === id)?.status;
      return s === 'pending' || s === 'processing';
    }),
    [selectedIds, tasks]
  );
  const selectedReviewIds = useMemo(
    () => Array.from(selectedIds).filter((id) => {
      const task = tasks.find((item) => item.id === id);
      return task?.status === 'completed'
        && (task.type === 'image' || task.type === 'video')
        && task.reviewStatus === 'pending';
    }),
    [selectedIds, tasks]
  );

  const handleBatchApprove = async () => {
    if (selectedReviewIds.length === 0) return;
    setBatchReviewing(true);
    try {
      const response = await taskService.batchReviewTasks(selectedReviewIds, 'approved');
      showToast(`已通过 ${response.data.reviewedCount} 条内容`, 'success');
      setSelectedIds(new Set());
      fetchData(false);
    } catch {
      showToast('批量审核失败', 'error');
    } finally {
      setBatchReviewing(false);
    }
  };

  const handleBatchRetry = async () => {
    if (selectedFailedIds.length === 0) return;
    setBatchRetrying(true);
    try {
      let succeeded = 0, failed = 0;
      for (const id of selectedFailedIds) {
        try { await taskService.retryTask(id); succeeded++; } catch { failed++; }
      }
      if (failed === 0) showToast(`已重试 ${succeeded} 个失败任务`, 'success');
      else showToast(`重试完成：成功 ${succeeded}，失败 ${failed}`, failed > succeeded ? 'error' : 'success');
      setSelectedIds(new Set());
      fetchData();
    } finally {
      setBatchRetrying(false);
    }
  };

  const handleBatchCancel = async () => {
    if (selectedActiveIds.length === 0) return;
    if (!confirm(`确定要取消选中的 ${selectedActiveIds.length} 个进行中任务吗？`)) return;
    setBatchCancelling(true);
    try {
      let succeeded = 0, failed = 0;
      for (const id of selectedActiveIds) {
        try { await taskService.cancelTask(id); succeeded++; } catch { failed++; }
      }
      if (failed === 0) showToast(`已取消 ${succeeded} 个任务`, 'success');
      else showToast(`取消完成：成功 ${succeeded}，失败 ${failed}`, failed > succeeded ? 'error' : 'success');
      setSelectedIds(new Set());
      fetchData();
    } finally {
      setBatchCancelling(false);
    }
  };

  const handleStatCardClick = (type?: CategoryTab, status?: string) => {
    if (type !== undefined) setActiveCategory(type);
    if (status !== undefined) setStatusFilter(status);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const getCategoryCount = (cat: CategoryTab): number => {
    if (!stats) return 0;
    switch (cat) {
      case 'all': return stats.total;
      case 'image': return stats.images;
      case 'video': return stats.videos;
      case 'audio': return stats.audio;
      case 'music': return stats.music;
    }
  };

  const getPreviewUrl = (task: Task): string | null => {
    if (task.thumbnailUrl) return task.thumbnailUrl;
    if (task.resultUrl) return task.resultUrl;
    if (task.outputUrl) return task.outputUrl;
    if (task.cosUrl) return task.cosUrl;
    return null;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return d.toLocaleDateString('zh-CN');
  };

  const handleCopyId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      showToast('ID 已复制', 'success');
      setTimeout(() => setCopiedId(prev => prev === id ? null : prev), 2000);
    } catch {
      showToast('复制失败', 'error');
    }
  }, [showToast]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const isMediaTask = useMemo(() => {
    return activeCategory === 'all' || activeCategory === 'image' || activeCategory === 'video';
  }, [activeCategory]);

  const renderMediaCard = (task: Task) => {
    const previewUrl = getPreviewUrl(task);
    const status = statusConfig[task.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const catConfig = categoryConfig[task.type as CategoryTab] || categoryConfig.all;
    const CatIcon = catConfig.icon;
    const isDeleting = deletingIds.has(task.id);
    const isExpanded = expandedId === task.id;
    const isCopied = copiedId === task.id;

    const isSelected = selectedIds.has(task.id);

    return (
      <div
        key={task.id}
        className={cn(
          'bg-[#1A1A1E] rounded-xl border overflow-hidden hover:border-white/20 transition-all group relative',
          isSelected ? 'border-violet-500/50 ring-1 ring-violet-500/20 bg-violet-500/[0.02]' : 'border-white/10'
        )}
      >
        <div className="aspect-video relative overflow-hidden bg-black/40">
          {previewUrl && task.status === 'completed' ? (
            task.type === 'video' ? (
              <video
                src={task.resultUrl || task.outputUrl || previewUrl}
                poster={task.thumbnailUrl || undefined}
                controls
                muted
                preload="metadata"
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <img
                src={previewUrl}
                alt={task.prompt || '图片'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )
          ) : task.type === 'audio' || task.type === 'music' ? (
            <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${task.type === 'music' ? '#8B5CF6' : '#06B6D4'}22, ${task.type === 'music' ? '#8B5CF6' : '#06B6D4'}08)` }}>
              <CatIcon className={cn('w-12 h-12', catConfig.color)} />
            </div>
          ) : task.status === 'processing' ? (
            <div className="w-full h-full flex items-center justify-center bg-blue-500/5">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            </div>
          ) : task.status === 'failed' ? (
            <div className="w-full h-full flex items-center justify-center bg-red-500/5">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-500/5">
              <CatIcon className={cn('w-10 h-10', catConfig.color, 'opacity-50')} />
            </div>
          )}

          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <label
              className="w-6 h-6 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(task.id)}
                className="w-3.5 h-3.5 rounded border-white/40 bg-black/50 text-violet-500 focus:ring-violet-500/30 focus:ring-offset-0 cursor-pointer"
              />
            </label>
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm', status.color)}>
              <StatusIcon className={cn('w-3 h-3', task.status === 'processing' && 'animate-spin')} />
              {status.label}
            </span>
          </div>

          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm', catConfig.bgColor, catConfig.color)}>
              <CatIcon className="w-3 h-3" />
              {catConfig.label}
            </span>
            {(task.type === 'image' || task.type === 'video') && reviewConfig[task.reviewStatus] && (
              <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm', reviewConfig[task.reviewStatus].color)}>
                {reviewConfig[task.reviewStatus].label}
              </span>
            )}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity flex items-end justify-center p-3 gap-2">
            <button
              onClick={() => setSelectedTask(task)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white text-xs font-medium transition-colors"
              title="查看详情"
            >
              <Eye className="w-3.5 h-3.5" /> 详情
            </button>
            {task.resultUrl && task.status === 'completed' && (
              <a
                href={task.resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white text-xs font-medium transition-colors"
                title="打开文件"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </a>
            )}
          </div>
        </div>

        <div className="p-3 space-y-2">
          <p className="text-white text-sm line-clamp-2 min-h-[2.5rem] leading-snug">
            {task.prompt || '无提示词'}
          </p>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-gray-500 truncate">
              {task.avatar ? (
                <img src={task.avatar} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
              ) : (
                <User className="w-3 h-3 text-gray-600 flex-shrink-0" />
              )}
              <span className="text-gray-400 truncate max-w-[70px]" title={task.email || ''}>{task.username || task.userId.slice(0, 8)}</span>
              <span className="text-gray-700">·</span>
              <span className="truncate max-w-[70px]">{task.provider || '-'}</span>
              {task.model && <><span className="text-gray-700">·</span><span className="truncate max-w-[50px]">{task.model}</span></>}
            </div>
            <span className="text-gray-600 shrink-0 ml-2">{formatTime(task.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2 text-xs">
              {(task.credits ?? 0) > 0 && (
                <span className="text-amber-400 font-medium">{task.credits} 积分</span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {task.status === 'completed' && task.reviewStatus === 'pending' && (task.type === 'image' || task.type === 'video') && (
                <>
                  <button
                    onClick={() => handleReviewTask(task, 'approved')}
                    disabled={reviewingIds.has(task.id)}
                    className="p-1.5 hover:bg-emerald-500/20 rounded-md transition-colors text-emerald-400"
                    title="审核通过并向用户展示"
                  >
                    {reviewingIds.has(task.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleReviewTask(task, 'rejected')}
                    disabled={reviewingIds.has(task.id)}
                    className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors text-red-400"
                    title="拒绝内容"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedTask(task)}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-500 hover:text-white"
                title="查看详情"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              {task.status === 'failed' && (
                <button
                  onClick={() => handleRetryTask(task.id)}
                  className="p-1.5 hover:bg-blue-500/20 rounded-md transition-colors text-gray-400 hover:text-blue-400"
                  title="重试任务"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              {(task.status === 'pending' || task.status === 'processing') && (
                <button
                  onClick={() => handleCancelTask(task.id)}
                  className="p-1.5 hover:bg-yellow-500/20 rounded-md transition-colors text-gray-400 hover:text-yellow-400"
                  title="取消任务"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {task.status === 'deleted' ? (
                <button
                  onClick={() => handleRestoreTask(task.id)}
                  className="p-1.5 hover:bg-green-500/20 rounded-md transition-colors text-gray-400 hover:text-green-400"
                  title="恢复任务"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors text-gray-400 hover:text-red-400"
                  title="删除任务"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => toggleExpand(task.id)}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-400 text-[11px] transition-colors w-full pt-0.5"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>ID: {task.id.slice(0, 8)}...</span>
            <span className="ml-auto">{isCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 opacity-50" />}</span>
          </button>
          {isExpanded && (
            <div className="flex items-center gap-1.5 bg-black/30 rounded-md px-2 py-1.5">
              <span className="text-gray-400 text-[11px] font-mono truncate flex-1">{task.id}</span>
              <button
                onClick={() => handleCopyId(task.id)}
                className="shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                title="复制ID"
              >
                {isCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500 hover:text-gray-300" />}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderListItem = (task: Task) => {
    const status = statusConfig[task.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const catConfig = categoryConfig[task.type as CategoryTab] || categoryConfig.all;
    const CatIcon = catConfig.icon;
    const isDeleting = deletingIds.has(task.id);
    const isCopied = copiedId === task.id;

    return (
      <tr key={task.id} className={cn('border-b border-white/5 hover:bg-white/[0.03] transition-colors group', selectedIds.has(task.id) && 'bg-violet-500/[0.04]')}>
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selectedIds.has(task.id)}
            onChange={() => toggleSelect(task.id)}
            className="w-4 h-4 rounded border-white/20 bg-black/30 text-violet-500 focus:ring-violet-500/30 focus:ring-offset-0 cursor-pointer"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <CatIcon className={cn('w-4 h-4', catConfig.color)} />
            <span className="text-white text-sm">{catConfig.label}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-xs font-mono">{task.id.slice(0, 8)}...</span>
            <button
              onClick={() => handleCopyId(task.id)}
              className="p-0.5 hover:bg-white/10 rounded transition-colors"
              title="复制完整ID"
            >
              {isCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-600 hover:text-gray-300" />}
            </button>
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => setSelectedTask(task)}
            className="text-gray-300 text-sm max-w-[240px] truncate hover:text-white transition-colors text-left"
            title="点击查看详情"
          >
            {task.prompt || '-'}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5" title={task.email || ''}>
            {task.avatar ? (
              <img src={task.avatar} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3 text-violet-400" />
              </div>
            )}
            <span className="text-gray-300 text-sm truncate max-w-[80px]">{task.username || task.userId.slice(0, 8)}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-400 text-sm">{task.provider || '-'}</td>
        <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-[100px]">{task.model || '-'}</td>
        <td className="px-4 py-3">
          <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', status.color)}>
            <StatusIcon className={cn('w-3 h-3', task.status === 'processing' && 'animate-spin')} />
            {status.label}
          </span>
        </td>
        <td className="px-4 py-3 text-amber-400 text-sm tabular-nums">{task.credits || 0}</td>
        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">{formatTime(task.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-0.5">
            {task.status === 'completed' && task.reviewStatus === 'pending' && (task.type === 'image' || task.type === 'video') && (
              <>
                <button
                  onClick={() => handleReviewTask(task, 'approved')}
                  disabled={reviewingIds.has(task.id)}
                  className="p-1.5 hover:bg-emerald-500/20 rounded-md transition-colors text-emerald-400"
                  title="审核通过"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleReviewTask(task, 'rejected')}
                  disabled={reviewingIds.has(task.id)}
                  className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors text-red-400"
                  title="拒绝内容"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedTask(task)}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-500 hover:text-white"
              title="查看详情"
            >
              <Eye className="w-4 h-4" />
            </button>
            {task.status === 'failed' && (
              <button
                onClick={() => handleRetryTask(task.id)}
                className="p-1.5 hover:bg-blue-500/20 rounded-md transition-colors text-gray-400 hover:text-blue-400"
                title="重试任务"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {(task.status === 'pending' || task.status === 'processing') && (
              <button
                onClick={() => handleCancelTask(task.id)}
                className="p-1.5 hover:bg-yellow-500/20 rounded-md transition-colors text-gray-400 hover:text-yellow-400"
                title="取消任务"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {task.status === 'deleted' ? (
              <button
                onClick={() => handleRestoreTask(task.id)}
                className="p-1.5 hover:bg-green-500/20 rounded-md transition-colors text-gray-400 hover:text-green-400"
                title="恢复任务"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              </button>
            ) : (
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors text-gray-400 hover:text-red-400"
                title="删除任务"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">任务管理</h1>
          <p className="text-gray-500 text-sm mt-0.5">查看和处理图片、视频、音频、音乐等生成任务</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleReview}
            disabled={reviewSettingLoading}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
              reviewEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            )}
            title="控制新生成的图片和视频是否必须审核后才向用户展示"
          >
            {reviewSettingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            先审后展示
            <span className={cn('h-2 w-2 rounded-full', reviewEnabled ? 'bg-emerald-400' : 'bg-gray-600')} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 text-sm transition-colors disabled:opacity-50"
            title="刷新数据"
          >
            <RefreshCw className={cn('w-4 h-4', (refreshing || loading) && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {reviewEnabled && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-200">内容审核正在运行</p>
              <p className="text-xs text-gray-400">新图片和视频只有审核通过后，结果链接才会发送给用户。</p>
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-amber-500/10 px-2.5 py-1 text-sm font-semibold text-amber-300">
            待审核 {stats?.pendingReview || 0}
          </span>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <button
            onClick={() => handleStatCardClick('all', 'all')}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-white/20 hover:bg-white/5 cursor-pointer',
              activeCategory === 'all' && statusFilter === 'all' ? 'border-violet-500/50 ring-1 ring-violet-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-500/20 rounded-lg">
                <ListTodo className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-gray-400 text-xs">总任务</span>
            </div>
            <p className="text-white text-lg font-bold mt-1.5">{stats.total}</p>
          </button>
          <button
            onClick={() => handleStatCardClick(undefined, 'pending')}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-yellow-500/30 hover:bg-yellow-500/5 cursor-pointer',
              statusFilter === 'pending' ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                <Clock className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-gray-400 text-xs">等待中</span>
            </div>
            <p className="text-yellow-400 text-lg font-bold mt-1.5">{stats.pending}</p>
          </button>
          <button
            onClick={() => handleStatCardClick(undefined, 'processing')}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-blue-500/30 hover:bg-blue-500/5 cursor-pointer',
              statusFilter === 'processing' ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                <Loader2 className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-gray-400 text-xs">处理中</span>
            </div>
            <p className="text-blue-400 text-lg font-bold mt-1.5">{stats.processing}</p>
          </button>
          <button
            onClick={() => handleStatCardClick(undefined, 'completed')}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer',
              statusFilter === 'completed' ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-gray-400 text-xs">已完成</span>
            </div>
            <p className="text-emerald-400 text-lg font-bold mt-1.5">{stats.completed}</p>
          </button>
          <button
            onClick={() => handleStatCardClick(undefined, 'failed')}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-red-500/30 hover:bg-red-500/5 cursor-pointer',
              statusFilter === 'failed' ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-500/20 rounded-lg">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-gray-400 text-xs">失败</span>
            </div>
            <p className="text-red-400 text-lg font-bold mt-1.5">{stats.failed}</p>
          </button>
          <button
            onClick={() => handleStatCardClick('image')}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer',
              activeCategory === 'image' ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                <Image className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-gray-400 text-xs">图片</span>
            </div>
            <p className="text-emerald-400 text-lg font-bold mt-1.5">{stats.images}</p>
          </button>
          <button
            onClick={() => handleStatCardClick('video')}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-orange-500/30 hover:bg-orange-500/5 cursor-pointer',
              activeCategory === 'video' ? 'border-orange-500/50 ring-1 ring-orange-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-500/20 rounded-lg">
                <Video className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-gray-400 text-xs">视频</span>
            </div>
            <p className="text-orange-400 text-lg font-bold mt-1.5">{stats.videos}</p>
          </button>
          <button
            onClick={() => { setReviewFilter('pending'); setStatusFilter('completed'); setCurrentPage(1); }}
            className={cn(
              'bg-[#1A1A1E] rounded-xl border p-3 text-left transition-all hover:border-amber-500/30 hover:bg-amber-500/5 cursor-pointer',
              reviewFilter === 'pending' ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-white/10'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 rounded-lg"><ShieldCheck className="w-4 h-4 text-amber-400" /></div>
              <span className="text-gray-400 text-xs">待审核</span>
            </div>
            <p className="text-amber-400 text-lg font-bold mt-1.5">{stats.pendingReview || 0}</p>
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(Object.keys(categoryConfig) as CategoryTab[]).map((cat) => {
            const config = categoryConfig[cat];
            const CatIcon = config.icon;
            const count = getCategoryCount(cat);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border shrink-0',
                  isActive
                    ? `${config.bgColor} ${config.color} ${config.borderColor} shadow-sm`
                    : 'bg-[#1A1A1E] text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-300'
                )}
              >
                <CatIcon className="w-4 h-4" />
                {config.label}
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs tabular-nums',
                  isActive ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="搜索提示词、用户、ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-colors"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
                title="清除搜索"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-colors cursor-pointer"
          >
            <option value="all">全部状态</option>
            <option value="pending">等待中</option>
            <option value="processing">处理中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
            <option value="deleted">已删除</option>
          </select>
          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
            className="px-4 py-2.5 bg-[#0B0B0E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-colors cursor-pointer"
          >
            <option value="all">全部审核状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          {(statusFilter !== 'all' || reviewFilter !== 'all' || searchQuery || activeCategory !== 'all') && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white text-sm transition-colors whitespace-nowrap"
              title="清除所有筛选"
            >
              <FilterX className="w-4 h-4" />
              清除筛选
            </button>
          )}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex items-center justify-between bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-white text-sm font-medium">已选 <span className="text-violet-400">{selectedIds.size}</span> 项</span>
            {selectedFailedIds.length > 0 && (
              <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                {selectedFailedIds.length} 个失败
              </span>
            )}
            {selectedActiveIds.length > 0 && (
              <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {selectedActiveIds.length} 个进行中
              </span>
            )}
            {selectedReviewIds.length > 0 && (
              <span className="text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {selectedReviewIds.length} 个待审核
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedReviewIds.length > 0 && (
              <button
                onClick={handleBatchApprove}
                disabled={batchReviewing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {batchReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                批量通过 ({selectedReviewIds.length})
              </button>
            )}
            {selectedFailedIds.length > 0 && (
              <button
                onClick={handleBatchRetry}
                disabled={batchRetrying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {batchRetrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                重试失败 ({selectedFailedIds.length})
              </button>
            )}
            {selectedActiveIds.length > 0 && (
              <button
                onClick={handleBatchCancel}
                disabled={batchCancelling}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {batchCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                取消进行中 ({selectedActiveIds.length})
              </button>
            )}
            <button
              onClick={handleBatchDelete}
              disabled={batchDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {batchDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              批量删除
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
            >
              取消选择
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tasks.length > 0 && tasks.every(t => selectedIds.has(t.id))}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-white/20 bg-black/30 text-violet-500 focus:ring-violet-500/30 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-gray-400 text-sm">全选本页</span>
          </label>
          <p className="text-gray-400 text-sm">
            共 <span className="text-white font-medium tabular-nums">{total}</span> 条记录
          </p>
        </div>
      )}

      {loading && tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          <p className="text-gray-400 text-sm">加载任务中...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <ListTodo className="w-12 h-12 text-gray-600" />
          <p className="text-gray-500 text-sm">{(statusFilter !== 'all' || searchQuery || activeCategory !== 'all') ? '没有符合筛选条件的任务' : '暂无任务数据'}</p>
          {(statusFilter !== 'all' || searchQuery || activeCategory !== 'all') && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-sm font-medium transition-colors"
            >
              <FilterX className="w-4 h-4" /> 清除筛选
            </button>
          )}
        </div>
      ) : isMediaTask ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tasks.map(renderMediaCard)}
          </div>
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      ) : (
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium w-10">
                    <input
                      type="checkbox"
                      checked={tasks.length > 0 && tasks.every(t => selectedIds.has(t.id))}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-white/20 bg-black/30 text-violet-500 focus:ring-violet-500/30 focus:ring-offset-0 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">类型</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">ID</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">提示词</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">用户</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">服务商</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">模型</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">状态</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">积分</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">时间</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(renderListItem)}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {selectedTask && (() => {
        const stCat = categoryConfig[selectedTask.type as CategoryTab] || categoryConfig.all;
        const StCatIcon = stCat.icon;
        const stStatus = statusConfig[selectedTask.status] || statusConfig.pending;
        const StStatusIcon = stStatus.icon;
        const stPreview = getPreviewUrl(selectedTask);
        const stResultUrl = selectedTask.resultUrl || selectedTask.outputUrl || selectedTask.cosUrl;
        const stIsDeleting = deletingIds.has(selectedTask.id);

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
            <div className="bg-[#1A1A1E] rounded-2xl w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('p-2 rounded-lg shrink-0', stCat.bgColor)}>
                    <StCatIcon className={cn('w-5 h-5', stCat.color)} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      任务详情
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', stStatus.color)}>
                        <StStatusIcon className={cn('w-3 h-3', selectedTask.status === 'processing' && 'animate-spin')} />
                        {stStatus.label}
                      </span>
                      {(selectedTask.type === 'image' || selectedTask.type === 'video') && reviewConfig[selectedTask.reviewStatus] && (
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', reviewConfig[selectedTask.reviewStatus].color)}>
                          {reviewConfig[selectedTask.reviewStatus].label}
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-gray-500 text-xs font-mono truncate">{selectedTask.id}</span>
                      <button
                        onClick={() => handleCopyId(selectedTask.id)}
                        className="p-0.5 hover:bg-white/10 rounded transition-colors shrink-0"
                        title="复制ID"
                      >
                        {copiedId === selectedTask.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-600 hover:text-gray-300" />}
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0" title="关闭 (Esc)">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {stPreview && selectedTask.status === 'completed' ? (
                  <div className="rounded-xl overflow-hidden bg-black/40">
                    {selectedTask.type === 'video' ? (
                      <video src={stResultUrl} poster={stPreview} controls className="w-full max-h-[320px] object-contain bg-black" />
                    ) : selectedTask.type === 'image' ? (
                      <img src={stPreview} alt="" className="w-full max-h-[320px] object-contain bg-black" />
                    ) : (
                      <audio src={stResultUrl} controls className="w-full m-3" style={{ width: 'calc(100% - 24px)' }} />
                    )}
                  </div>
                ) : selectedTask.status === 'processing' ? (
                  <div className="h-40 flex flex-col items-center justify-center bg-blue-500/5 rounded-xl">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                    <p className="text-blue-400 text-sm">任务处理中...</p>
                  </div>
                ) : selectedTask.status === 'failed' ? (
                  <div className="h-40 flex flex-col items-center justify-center bg-red-500/5 rounded-xl">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                    <p className="text-red-400 text-sm">任务执行失败</p>
                  </div>
                ) : selectedTask.status === 'deleted' ? (
                  <div className="h-40 flex flex-col items-center justify-center bg-gray-500/5 rounded-xl">
                    <Trash2 className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-gray-500 text-sm">任务已删除（可恢复）</p>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-500 text-[11px] mb-0.5">类型</p>
                    <p className="text-white text-sm font-medium">{stCat.label}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-500 text-[11px] mb-0.5">服务商</p>
                    <p className="text-white text-sm font-medium truncate">{selectedTask.provider || '-'}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-500 text-[11px] mb-0.5">模型</p>
                    <p className="text-white text-sm font-medium truncate">{selectedTask.model || '-'}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-500 text-[11px] mb-0.5">消耗积分</p>
                    <p className="text-amber-400 text-sm font-medium tabular-nums">{selectedTask.credits || 0}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-500 text-[11px] mb-0.5">创建时间</p>
                    <p className="text-white text-sm font-medium">{new Date(selectedTask.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-500 text-[11px] mb-0.5">更新时间</p>
                    <p className="text-white text-sm font-medium">{new Date(selectedTask.updatedAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>

                {selectedTask.prompt && (
                  <div className="p-3 bg-white/5 rounded-lg group/prompt">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-gray-500 text-[11px]">提示词</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(selectedTask.prompt!); showToast('提示词已复制', 'success'); }}
                        className="opacity-0 group-hover/prompt:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                        title="复制提示词"
                      >
                        <Copy className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                      </button>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words">{selectedTask.prompt}</p>
                  </div>
                )}

                {selectedTask.error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg group/error">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-red-400 text-[11px] font-medium">错误信息</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(selectedTask.error!); showToast('错误信息已复制', 'success'); }}
                        className="opacity-0 group-hover/error:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                        title="复制错误信息"
                      >
                        <Copy className="w-3 h-3 text-red-400 hover:text-red-300" />
                      </button>
                    </div>
                    <p className="text-red-300 text-sm break-words">{selectedTask.error}</p>
                  </div>
                )}

                {stResultUrl && selectedTask.status === 'completed' && (
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-gray-500 text-[11px] mb-2">文件链接</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.resultUrl && (
                        <a href={selectedTask.resultUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-blue-400 rounded-lg text-sm transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> 打开结果
                        </a>
                      )}
                      {selectedTask.outputUrl && selectedTask.outputUrl !== selectedTask.resultUrl && (
                        <a href={selectedTask.outputUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-blue-400 rounded-lg text-sm transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> 输出文件
                        </a>
                      )}
                      {selectedTask.cosUrl && (
                        <a href={selectedTask.cosUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-blue-400 rounded-lg text-sm transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> COS存储
                        </a>
                      )}
                      {stResultUrl && (
                        <a href={stResultUrl} download className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition-colors">
                          <Download className="w-3.5 h-3.5" /> 下载
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

                <div className="p-4 border-t border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5">
                    {selectedTask.status === 'completed' && selectedTask.reviewStatus === 'pending' && (selectedTask.type === 'image' || selectedTask.type === 'video') && (
                      <>
                        <button
                          onClick={() => handleReviewTask(selectedTask, 'approved')}
                          disabled={reviewingIds.has(selectedTask.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {reviewingIds.has(selectedTask.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 通过并展示
                        </button>
                        <button
                          onClick={() => handleReviewTask(selectedTask, 'rejected')}
                          disabled={reviewingIds.has(selectedTask.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" /> 拒绝
                        </button>
                      </>
                    )}
                  {selectedTask.status === 'failed' && (
                    <button
                      onClick={() => { handleRetryTask(selectedTask.id); setSelectedTask(null); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" /> 重试任务
                    </button>
                  )}
                  {(selectedTask.status === 'pending' || selectedTask.status === 'processing') && (
                    <button
                      onClick={() => { handleCancelTask(selectedTask.id); setSelectedTask(null); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      <X className="w-4 h-4" /> 取消任务
                    </button>
                  )}
                  {selectedTask.status === 'deleted' ? (
                    <button
                      onClick={() => { handleRestoreTask(selectedTask.id); setSelectedTask(null); }}
                      disabled={stIsDeleting}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {stIsDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} 恢复任务
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm('确定要删除此任务吗？')) {
                          setSelectedTask(null);
                          handleDeleteTask(selectedTask.id, true);
                        }
                      }}
                      disabled={stIsDeleting}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {stIsDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} 删除任务
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  关闭 <span className="text-gray-500 ml-1 text-xs">Esc</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TaskManagement;
