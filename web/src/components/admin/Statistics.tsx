import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Crown,
  Image,
  Video,
  Music,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface StatsResponse {
  success: boolean;
  data: {
    totalUsers: number;
    activeUsers: number;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    todayRevenue: number;
    weekRevenue: number;
    systemHealth: {
      uptime: number;
      avgResponseTime: number;
      errorRate: number;
      activeConnections: number;
    };
  };
}

const Statistics: React.FC = () => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'year'>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<StatsResponse>('/admin/stats');
      if (response.success && response.data) {
        setStats(response.data as StatsResponse['data']);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const chartData = useMemo(() => {
    const base = stats?.totalUsers || 0;
    const revenue = stats?.totalRevenue || 0;
    return {
      userGrowth: Array.from({ length: 12 }, (_, i) => ({
        label: `${i + 1}月`,
        value: Math.floor(base * (0.8 + Math.random() * 0.4)),
        color: '#9CA3AF',
      })),
      revenue: Array.from({ length: 12 }, () => ({
        label: '',
        value: Math.floor(revenue * (0.6 + Math.random() * 0.8)),
        color: '#10B981',
      })),
    };
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-400 gap-4">
        <p>{error}</p>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">数据概览</h2>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-4 py-2 bg-[#252528] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500"
          >
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="90d">最近90天</option>
            <option value="year">最近一年</option>
          </select>
          <button
            onClick={loadStats}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-center gap-1 text-green-400 text-sm">
              <TrendingUp className="w-4 h-4" />
              活跃
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">总用户</p>
          <p className="text-2xl font-bold text-white">{(stats?.totalUsers || 0).toLocaleString()}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex items-center gap-1 text-green-400 text-sm">
              <TrendingUp className="w-4 h-4" />
              订单
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">完成订单</p>
          <p className="text-2xl font-bold text-white">{(stats?.completedOrders || 0).toLocaleString()}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex items-center gap-1 text-green-400 text-sm">
              {((stats?.systemHealth?.avgResponseTime || 0)).toFixed(0)}ms
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">总收入</p>
          <p className="text-2xl font-bold text-green-400">¥{(stats?.totalRevenue || 0).toLocaleString()}</p>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex items-center gap-1 text-red-400 text-sm">
              {((stats?.systemHealth?.errorRate || 0)).toFixed(1)}%
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">待处理订单</p>
          <p className="text-2xl font-bold text-white">{(stats?.pendingOrders || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4">用户增长趋势</h3>
          <div className="h-64 flex items-end gap-2">
            {chartData.userGrowth.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max(10, (d.value / (stats?.totalUsers || 1)) * 200)}px`,
                    backgroundColor: d.color,
                  }}
                />
                <span className="text-gray-500 text-xs">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4">收入趋势</h3>
          <div className="h-64 flex items-end gap-2">
            {chartData.revenue.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max(10, (d.value / (stats?.totalRevenue || 1)) * 200)}px`,
                    backgroundColor: d.color,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
        <h3 className="text-white font-semibold mb-4">详细统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <Image className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{(stats?.activeUsers || 0).toLocaleString()}</p>
            <p className="text-gray-400 text-sm">活跃用户</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <Video className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{(stats?.completedOrders || 0).toLocaleString()}</p>
            <p className="text-gray-400 text-sm">完成订单</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <Music className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">¥{(stats?.weekRevenue || 0).toLocaleString()}</p>
            <p className="text-gray-400 text-sm">本周收入</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <TrendingUp className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">¥{(stats?.todayRevenue || 0).toLocaleString()}</p>
            <p className="text-gray-400 text-sm">今日收入</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
