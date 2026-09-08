import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Check, X, Loader2, RefreshCw, Clock, User, Activity, Shield, Eye, Edit, Trash2, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { operationLogService, OperationLog, OperationLogStats, ActionOption } from '@/services/admin';

const OperationLogs: React.FC = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [stats, setStats] = useState<OperationLogStats | null>(null);
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filterAdminId, setFilterAdminId] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  const filterAdminIdRef = useRef(filterAdminId);
  filterAdminIdRef.current = filterAdminId;
  const filterActionRef = useRef(filterAction);
  filterActionRef.current = filterAction;
  const filterTargetTypeRef = useRef(filterTargetType);
  filterTargetTypeRef.current = filterTargetType;
  const filterStatusRef = useRef(filterStatus);
  filterStatusRef.current = filterStatus;
  const filterStartDateRef = useRef(filterStartDate);
  filterStartDateRef.current = filterStartDate;
  const filterEndDateRef = useRef(filterEndDate);
  filterEndDateRef.current = filterEndDate;

  const loadActions = useCallback(async () => {
    try {
      const response = await operationLogService.getActions();
      if (response.success) {
        setActions(response.data || []);
      }
    } catch (err: unknown) {
      console.error('加载操作类型失败:', err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await operationLogService.getStats(undefined, 30);
      if (response.success) {
        setStats(response.data);
      }
    } catch (err: unknown) {
      console.error('加载统计数据失败:', err);
    }
  }, []);

  useEffect(() => {
    loadActions();
    loadStats();
  }, [loadActions, loadStats]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        page: currentPageRef.current,
        pageSize: pageSizeRef.current,
      };

      if (filterAdminIdRef.current) params.adminId = filterAdminIdRef.current;
      if (filterActionRef.current) params.action = filterActionRef.current;
      if (filterTargetTypeRef.current) params.targetType = filterTargetTypeRef.current;
      if (filterStatusRef.current) params.status = filterStatusRef.current;
      if (filterStartDateRef.current) params.startDate = filterStartDateRef.current;
      if (filterEndDateRef.current) params.endDate = filterEndDateRef.current;

      const response = await operationLogService.getLogs(params);
      if (response.success) {
        setLogs(response.data || []);
        setTotalPages(response.meta?.totalPages || 1);
        setTotal(response.meta?.total || 0);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '加载日志失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [currentPage, filterAdminId, filterAction, filterTargetType, filterStatus, filterStartDate, filterEndDate, loadLogs]);

  const handleSearch = () => {
    setCurrentPage(1);
    loadLogs();
    loadStats();
  };

  const handleReset = () => {
    setFilterAdminId('');
    setFilterAction('');
    setFilterTargetType('');
    setFilterStatus('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
    loadLogs();
    loadStats();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Plus className="w-4 h-4 text-green-400" />;
      case 'UPDATE':
      case 'EDIT':
        return <Edit className="w-4 h-4 text-gray-400" />;
      case 'DELETE':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'VIEW':
      case 'READ':
        return <Eye className="w-4 h-4 text-gray-400" />;
      case 'LOGIN':
      case 'LOGOUT':
        return <User className="w-4 h-4 text-purple-400" />;
      case 'CONFIG':
      case 'SETTINGS':
        return <Settings className="w-4 h-4 text-yellow-400" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-500/20 text-green-400';
      case 'UPDATE':
      case 'EDIT':
        return 'bg-gray-500/20 text-gray-400';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400';
      case 'VIEW':
      case 'READ':
        return 'bg-gray-500/20 text-gray-400';
      case 'LOGIN':
      case 'LOGOUT':
        return 'bg-purple-500/20 text-purple-400';
      case 'CONFIG':
      case 'SETTINGS':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-500/20 text-green-400';
      case 'FAILURE':
      case 'FAILED':
        return 'bg-red-500/20 text-red-400';
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return '成功';
      case 'FAILURE':
      case 'FAILED':
        return '失败';
      case 'PENDING':
        return '进行中';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-gray-400 text-sm">总操作数</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-gray-400 text-sm">成功</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{stats?.successCount || 0}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <X className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-gray-400 text-sm">失败</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats?.failedCount || 0}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-gray-400 text-sm">成功率</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {stats?.successRate ? `${stats.successRate.toFixed(1)}%` : '0%'}
          </p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">最近30天</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[150px]">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="管理员ID"
              value={filterAdminId}
              onChange={(e) => setFilterAdminId(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-4 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
          >
            <option value="">全部操作</option>
            {actions.map((action) => (
              <option key={action.value} value={action.value}>{action.label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
          >
            <option value="">全部状态</option>
            <option value="SUCCESS">成功</option>
            <option value="FAILURE">失败</option>
            <option value="PENDING">进行中</option>
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-4 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
            />
            <span className="text-gray-500">至</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-4 py-2 bg-[#0d0d0d] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              搜索
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-[#0d0d0d] border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
            >
              重置
            </button>
            <button
              onClick={loadLogs}
              className="p-2 bg-[#0d0d0d] border border-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">操作类型</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">管理员</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">操作对象</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">对象名称</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">时间</th>
              <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">IP地址</th>
              <th className="px-4 py-3 text-center text-gray-400 text-sm font-medium">详情</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Loader2 className="w-8 h-8 text-gray-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">暂无日志记录</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className={cn('px-2 py-1 rounded text-xs font-medium', getActionColor(log.action))}>
                        {log.action}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-500/20 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3 text-gray-400" />
                      </div>
                      <span className="text-white text-sm">{log.adminUsername || log.adminId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{log.targetType}</td>
                  <td className="px-4 py-3 text-white text-sm max-w-[150px] truncate">
                    {log.targetName || log.targetId || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', getStatusColor(log.status))}>
                      {getStatusLabel(log.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm font-mono">
                    {log.ipAddress || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-3 py-1 bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded text-xs font-medium transition-colors"
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || loading}
            className="p-2 bg-[#1A1A1E] border border-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-gray-400 text-sm">
            第 {currentPage} / {totalPages} 页，共 {total} 条
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || loading}
            className="p-2 bg-[#1A1A1E] border border-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">操作日志详情</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 text-sm mb-1">操作类型</p>
                  <div className="flex items-center gap-2">
                    {getActionIcon(selectedLog.action)}
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', getActionColor(selectedLog.action))}>
                      {selectedLog.action}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-sm mb-1">状态</p>
                  <span className={cn('px-2 py-1 rounded text-xs font-medium', getStatusColor(selectedLog.status))}>
                    {getStatusLabel(selectedLog.status)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 text-sm mb-1">管理员</p>
                  <p className="text-white">{selectedLog.adminUsername || selectedLog.adminId}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm mb-1">操作时间</p>
                  <p className="text-white">{new Date(selectedLog.createdAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 text-sm mb-1">操作对象类型</p>
                  <p className="text-white">{selectedLog.targetType}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm mb-1">操作对象ID</p>
                  <p className="text-white font-mono text-sm">{selectedLog.targetId || '-'}</p>
                </div>
              </div>

              {selectedLog.targetName && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">操作对象名称</p>
                  <p className="text-white">{selectedLog.targetName}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 text-sm mb-1">IP地址</p>
                  <p className="text-white font-mono">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm mb-1">User Agent</p>
                  <p className="text-gray-400 text-xs truncate" title={selectedLog.userAgent || ''}>
                    {selectedLog.userAgent || '-'}
                  </p>
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">错误信息</p>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{selectedLog.errorMessage}</p>
                  </div>
                </div>
              )}

              {selectedLog.beforeValue && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">变更前</p>
                  <pre className="bg-[#0d0d0d] border border-white/10 rounded-lg p-3 text-gray-300 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.beforeValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterValue && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">变更后</p>
                  <pre className="bg-[#0d0d0d] border border-white/10 rounded-lg p-3 text-gray-300 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.afterValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">元数据</p>
                  <pre className="bg-[#0d0d0d] border border-white/10 rounded-lg p-3 text-gray-300 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/10">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-3 bg-[#0d0d0d] border border-white/10 rounded-lg text-gray-400 hover:text-white font-medium transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationLogs;
