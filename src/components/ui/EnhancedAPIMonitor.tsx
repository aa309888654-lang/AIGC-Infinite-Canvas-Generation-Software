import React, { useEffect, useState, useCallback } from 'react';
import { Activity, CheckCircle, XCircle, Clock, Download, Trash2, Search, TrendingUp, BarChart3, FileJson, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { apiAnalyzer, APIAnalysisEntry, AnalysisFilter} from '@/services/api-analyzer';
import { cn } from '@/lib/utils';

export const EnhancedAPIMonitor: React.FC = () => {
  const [entries, setEntries] = useState<APIAnalysisEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<APIAnalysisEntry | null>(null);
  const [filter, setFilter] = useState<AnalysisFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'timeline'>('list');

  const stats = apiAnalyzer.getStats(filter);

  useEffect(() => {
    const unsubscribe = apiAnalyzer.subscribe((newEntries) => {
      setEntries(newEntries);
    });

    setEntries(apiAnalyzer.getEntries());

    return () => unsubscribe();
  }, []);

  const handleFilterChange = useCallback(() => {
    const newFilter: AnalysisFilter = {
      status: statusFilter === 'all' ? undefined : statusFilter as APIAnalysisEntry['status'],
      searchQuery: searchQuery || undefined,
    };
    setFilter(newFilter);
    setEntries(apiAnalyzer.getEntries(newFilter));
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    handleFilterChange();
  }, [handleFilterChange]);

  const handleClear = useCallback(() => {
    if (confirm('确定要清空所有 API 记录吗？')) {
      apiAnalyzer.clear();
      setEntries([]);
      setSelectedEntry(null);
    }
  }, []);

  const handleExportJSON = useCallback(() => {
    const data = apiAnalyzer.exportToJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, []);

  const handleExportCSV = useCallback(() => {
    const data = apiAnalyzer.exportToCSV();
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, []);

  const formatDuration = (ms?: number) => {
    if (ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    } as Intl.DateTimeFormatOptions);
  };

  const getStatusIcon = (status?: APIAnalysisEntry['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending':
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#007AFF]" />
            <h2 className="text-lg font-semibold text-white">API 调用分析器</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl z-50 min-w-[140px]">
                  <button
                    onClick={handleExportJSON}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-white/10 flex items-center gap-2 text-white"
                  >
                    <FileJson className="w-4 h-4" />
                    JSON 格式
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-white/10 flex items-center gap-2 text-white"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    CSV 格式
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清空
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 URL、方法、错误信息..."
              className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#007AFF]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#007AFF]"
          >
            <option value="all">全部状态</option>
            <option value="success">成功</option>
            <option value="error">失败</option>
            <option value="pending">进行中</option>
          </select>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'list', label: '列表', icon: Activity },
            { id: 'stats', label: '统计', icon: BarChart3 },
            { id: 'timeline', label: '时间线', icon: Clock },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors',
                activeTab === id
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {activeTab === 'list' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Activity className="w-12 h-12 mb-4 opacity-50" />
                  <p>暂无 API 调用记录</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={cn(
                        'px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors',
                        selectedEntry?.id === entry.id && 'bg-[#007AFF]/10'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(entry.status)}
                          <span className="px-2 py-0.5 bg-[#007AFF]/20 text-[#007AFF] text-xs rounded font-mono">
                            {entry.request.method}
                          </span>
                          {entry.request.provider && (
                            <span className="text-xs text-gray-500">
                              {entry.request.provider}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{formatTime(entry.request.timestamp)}</span>
                          <span className="font-mono">{formatDuration(entry.totalDuration)}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-300 truncate font-mono text-xs">
                        {entry.request.url}
                      </div>
                      {entry.error && (
                        <div className="mt-2 text-xs text-red-400 truncate">
                          {entry.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedEntry && (
              <div className="border-t border-white/10 p-4 bg-[#1e1e1e] max-h-[40%] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white">详情</h3>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-gray-400">URL:</span>
                    <div className="mt-1 p-2 bg-black/20 rounded text-gray-300 font-mono break-all">
                      {selectedEntry.request.url}
                    </div>
                  </div>
                  {selectedEntry.request.body && (
                    <div>
                      <span className="text-gray-400">请求体:</span>
                      <div className="mt-1 p-2 bg-black/20 rounded text-gray-300 font-mono max-h-32 overflow-y-auto">
                        <pre>{JSON.stringify(selectedEntry.request.body, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                  {selectedEntry.response?.data && (
                    <div>
                      <span className="text-gray-400">响应:</span>
                      <div className="mt-1 p-2 bg-black/20 rounded text-gray-300 font-mono max-h-32 overflow-y-auto">
                        <pre>{JSON.stringify(selectedEntry.response.data, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <Activity className="w-4 h-4" />
                  总请求数
                </div>
                <div className="text-2xl font-bold text-white">{stats.totalRequests}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <TrendingUp className="w-4 h-4" />
                  平均响应时间
                </div>
                <div className="text-2xl font-bold text-white">{formatDuration(stats.averageResponseTime)}</div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
                  <CheckCircle className="w-4 h-4" />
                  成功
                </div>
                <div className="text-2xl font-bold text-green-400">{stats.successfulRequests}</div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400 text-xs mb-2">
                  <XCircle className="w-4 h-4" />
                  失败
                </div>
                <div className="text-2xl font-bold text-red-400">{stats.failedRequests}</div>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">最常用接口</h4>
              <div className="space-y-2">
                {Array.from(stats.mostUsedEndpoints.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([url, count]) => (
                    <div key={url} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 truncate flex-1 mr-2">{url}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-2">
              {apiAnalyzer.getTimeline(filter).map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        item.type === 'request' ? 'bg-gray-400' : 'bg-green-400'
                      )}
                    />
                    {index < apiAnalyzer.getTimeline(filter).length - 1 && (
                      <div className="w-px h-8 bg-white/10" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded',
                          item.type === 'request'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-green-500/20 text-green-400'
                        )}
                      >
                        {item.type === 'request' ? '请求' : '响应'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(item.time)}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {item.entry.request.method}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400 truncate">
                      {item.entry.request.url}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-500">
        <span>共 {entries.length} 条记录</span>
        <span>
          成功率{' '}
          {stats.totalRequests > 0
            ? Math.round((stats.successfulRequests / stats.totalRequests) * 100)
            : 0}
          %
        </span>
      </div>
    </div>
  );
};

export default EnhancedAPIMonitor;
