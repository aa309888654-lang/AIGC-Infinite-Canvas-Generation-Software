import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  totalPageViews: number;
  totalEvents: number;
  totalErrors: number;
  errorRate: string;
  recentErrors: ErrorInfo[];
  topPages: { pageUrl: string; views: number }[];
  deviceBreakdown: { deviceType: string; count: number }[];
  browserBreakdown: { browserName: string; count: number }[];
}

interface ErrorInfo {
  id: string;
  message: string;
  errorMessage?: string;
  stack?: string;
  stackTrace?: string;
  timestamp: string;
  level?: string;
  errorType?: string;
}

interface PerformanceMetrics {
  metricName: string;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  count: number;
}

interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: { errorType: string; count: number; percentage: string }[];
  recentErrors: ErrorInfo[];
  criticalErrors: ErrorInfo[];
}

interface RealtimeStats {
  activeSessionsLastHour: number;
  activeSessionsLast5Min: number;
  errorsLastHour: number;
  errorsLast5Min: number;
  pageViewsLastHour: number;
  pageViewsLast5Min: number;
  timestamp: string;
}

const COLORS = ['#9CA3AF', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const FrontendMonitoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'errors' | 'sessions'>('overview');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics[]>([]);
  const [errorAnalytics, setErrorAnalytics] = useState<ErrorAnalytics | null>(null);
  const [realtime, setRealtime] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (startDate?: Date, endDate?: Date) => {
    try {
      setLoading(true);
      setError(null);
      setStats(null);
      setPerformance([]);
      setErrorAnalytics(null);
      setRealtime(null);

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      const query = params.toString();
      const suffix = query ? `?${query}` : '';

      const [statsRes, performanceRes, errorRes, realtimeRes] = await Promise.allSettled([
        apiClient.get<{ success: boolean; data: DashboardStats }>(`/admin/frontend-monitoring/dashboard-stats${suffix}`),
        apiClient.get<{ success: boolean; data: PerformanceMetrics[] }>(`/admin/frontend-monitoring/performance${suffix}`),
        apiClient.get<{ success: boolean; data: ErrorAnalytics }>(`/admin/frontend-monitoring/errors/analytics${suffix}`),
        apiClient.get<{ success: boolean; data: RealtimeStats }>('/admin/frontend-monitoring/realtime'),
      ]);

      let successCount = 0;

      if (statsRes.status === 'fulfilled' && statsRes.value.success) {
        setStats(statsRes.value.data);
        successCount += 1;
      }

      if (performanceRes.status === 'fulfilled' && performanceRes.value.success) {
        setPerformance(performanceRes.value.data);
        successCount += 1;
      }

      if (errorRes.status === 'fulfilled' && errorRes.value.success) {
        setErrorAnalytics(errorRes.value.data);
        successCount += 1;
      }

      if (realtimeRes.status === 'fulfilled' && realtimeRes.value.success) {
        setRealtime(realtimeRes.value.data);
        successCount += 1;
      }

      if (successCount === 0) {
        setError('获取监控数据失败');
      }
    } catch (err) {
      setError('获取监控数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    let startDate: Date | undefined;

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    fetchStats(startDate);

    const realtimeInterval = setInterval(async () => {
      try {
        const data = await apiClient.get<{ success: boolean; data: RealtimeStats }>('/admin/frontend-monitoring/realtime');
        if (data.success) setRealtime(data.data);
      } catch (err) {
        console.error('Failed to fetch realtime stats:', err);
      }
    }, 30000);

    return () => clearInterval(realtimeInterval);
  }, [dateRange, fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">前端监控</h1>
        <div className="flex gap-2">
          {(['today', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === 'today' ? '今天' : range === '7d' ? '最近7天' : '最近30天'}
            </button>
          ))}
        </div>
      </div>

      {realtime && (
        <div className="bg-gradient-to-r from-gray-500 to-purple-600 rounded-xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-4">实时数据</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm opacity-80">活跃会话(5分钟)</div>
              <div className="text-2xl font-bold">{realtime.activeSessionsLast5Min}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm opacity-80">活跃会话(1小时)</div>
              <div className="text-2xl font-bold">{realtime.activeSessionsLastHour}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm opacity-80">页面浏览(5分钟)</div>
              <div className="text-2xl font-bold">{realtime.pageViewsLast5Min}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm opacity-80">页面浏览(1小时)</div>
              <div className="text-2xl font-bold">{realtime.pageViewsLastHour}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm opacity-80">错误(5分钟)</div>
              <div className="text-2xl font-bold text-red-200">{realtime.errorsLast5Min}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm opacity-80">错误(1小时)</div>
              <div className="text-2xl font-bold text-red-200">{realtime.errorsLastHour}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {(['overview', 'performance', 'errors', 'sessions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-gray-600 text-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'overview' ? '概览' : tab === 'performance' ? '性能' : tab === 'errors' ? '错误' : '会话'}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                  <div className="text-sm font-medium text-gray-600 mb-1">总会话数</div>
                  <div className="text-3xl font-bold text-gray-900">{stats.totalSessions.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                  <div className="text-sm font-medium text-green-600 mb-1">当前活跃</div>
                  <div className="text-3xl font-bold text-green-900">{stats.activeSessions}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
                  <div className="text-sm font-medium text-purple-600 mb-1">页面浏览</div>
                  <div className="text-3xl font-bold text-purple-900">{stats.totalPageViews.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6">
                  <div className="text-sm font-medium text-red-600 mb-1">错误率</div>
                  <div className="text-3xl font-bold text-red-900">{stats.errorRate}%</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">热门页面</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.topPages.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="pageUrl" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="views" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">设备分布</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.deviceBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {stats.deviceBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">浏览器分布</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.browserBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="browserName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">性能指标详情</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">指标</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">平均</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最小</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最大</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P50</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P90</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P95</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P99</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {performance.map((metric, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{metric.metricName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.avg}{metric.metricName === 'CLS' ? '' : 'ms'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.min}{metric.metricName === 'CLS' ? '' : 'ms'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.max}{metric.metricName === 'CLS' ? '' : 'ms'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.p50}{metric.metricName === 'CLS' ? '' : 'ms'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.p90}{metric.metricName === 'CLS' ? '' : 'ms'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.p95}{metric.metricName === 'CLS' ? '' : 'ms'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.p99}{metric.metricName === 'CLS' ? '' : 'ms'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'errors' && errorAnalytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 rounded-xl p-6">
                  <div className="text-sm font-medium text-red-600 mb-1">总错误数</div>
                  <div className="text-3xl font-bold text-red-900">{errorAnalytics.totalErrors.toLocaleString()}</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-6 col-span-2">
                  <h3 className="text-sm font-medium text-orange-600 mb-2">错误类型分布</h3>
                  <div className="space-y-2">
                    {errorAnalytics.errorsByType.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{err.errorType}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500"
                              style={{ width: `${err.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500">{err.count} ({err.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">最近错误</h3>
                <div className="space-y-3">
                  {errorAnalytics.recentErrors.map((err, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">{err.errorType}</span>
                            <span className="text-xs text-gray-500">{new Date(err.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 mb-1">{err.errorMessage}</div>
                          {err.stackTrace && (
                            <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
                              {err.stackTrace}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">会话列表</h3>
                <p className="text-sm text-gray-500">查看详细的用户会话信息，包括页面浏览、事件追踪和错误记录。</p>
                <div className="mt-4 flex gap-3">
                  <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                    导出CSV
                  </button>
                  <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                    刷新数据
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FrontendMonitoring;
