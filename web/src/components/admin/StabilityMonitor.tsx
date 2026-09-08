import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Server, Clock, CheckCircle, XCircle, Loader2, RefreshCw, MemoryStick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stabilityService, HealthCheck, StabilityStats } from '@/services/admin/stability-service';
import { useToast } from './shared/AdminToast';

const StabilityMonitor: React.FC = () => {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [stats, setStats] = useState<StabilityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [healthRes, statsRes] = await Promise.all([
        stabilityService.getHealthCheck(),
        stabilityService.getStabilityStats()
      ]);

      setHealth(healthRes);
      setStats(((statsRes as any as Record<string, unknown>).data || statsRes) as any as StabilityStats);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to fetch stability data');
      showToast('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  const healthStatus = {
    healthy: { label: 'Healthy', color: 'text-green-400', bg: 'bg-green-500/20' },
    degraded: { label: 'Degraded', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    unhealthy: { label: 'Unhealthy', color: 'text-red-400', bg: 'bg-red-500/20' },
  };

  const currentStatus = healthStatus[health?.status as keyof typeof healthStatus] || healthStatus.unhealthy;

  if (loading && !health) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
        <p className="text-gray-400 text-sm">Loading stability data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full', currentStatus.bg)}>
            {loading ? (
              <Loader2 className={cn('w-4 h-4 animate-spin', currentStatus.color)} />
            ) : (
              <Activity className={cn('w-4 h-4', currentStatus.color)} />
            )}
            <span className={cn('text-sm font-medium', currentStatus.color)}>
              {currentStatus.label}
            </span>
          </div>
          <span className="text-gray-500 text-sm">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1E] border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Uptime</p>
              <p className="text-white text-xl font-bold">{formatUptime(stats?.uptime || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Requests</p>
              <p className="text-white text-xl font-bold">{(stats?.requestCount || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', (stats?.errorRate || 0) < 1 ? 'bg-green-500/20' : 'bg-red-500/20')}>
              <XCircle className={cn('w-5 h-5', (stats?.errorRate || 0) < 1 ? 'text-green-400' : 'text-red-400')} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Error Rate</p>
              <p className={cn('text-xl font-bold', (stats?.errorRate || 0) < 1 ? 'text-green-400' : 'text-red-400')}>
                {(stats?.errorRate || 0).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', (stats?.avgResponseTime || 0) < 500 ? 'bg-green-500/20' : 'bg-yellow-500/20')}>
              <Activity className={cn('w-5 h-5', (stats?.avgResponseTime || 0) < 500 ? 'text-green-400' : 'text-yellow-400')} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Avg Response</p>
              <p className={cn('text-xl font-bold', (stats?.avgResponseTime || 0) < 500 ? 'text-green-400' : 'text-yellow-400')}>
                {(stats?.avgResponseTime || 0).toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-6">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <Server className="w-5 h-5" />
            Service Health
          </h3>
          <div className="space-y-3">
            {health?.checks && Object.entries(health.checks).map(([service, isHealthy]) => {
              const serviceNames: Record<string, { name: string; desc?: string }> = {
                database: { name: 'Database', desc: 'PostgreSQL' },
                redis: { name: 'Redis', desc: 'Cache' },
                minio: { name: 'MinIO', desc: 'Local Storage' },
                loki: { name: 'Loki', desc: 'Log System' },
              };
              const info = serviceNames[service] || { name: service, desc: '' };
              return (
                <div key={service} className="flex items-center justify-between p-3 bg-[#0B0B0E] rounded-lg">
                  <div className="flex items-center gap-3">
                    {isHealthy ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-500" />
                    )}
                    <div>
                      <span className="text-gray-300">{info.name}</span>
                      {info.desc && <span className="text-gray-500 text-xs ml-2">({info.desc})</span>}
                    </div>
                  </div>
                  <span className={cn('text-sm font-medium', isHealthy ? 'text-green-400' : 'text-gray-500')}>
                    {isHealthy ? 'Online' : 'Not Configured'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
            <p className="text-gray-400 text-xs">
              <strong>Note:</strong> System is healthy when Database and Redis are online. 
              MinIO (local storage) and Loki (logging) are optional services.
            </p>
          </div>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-6">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <MemoryStick className="w-5 h-5" />
            Memory Usage
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Heap Used</span>
                <span className="text-white text-sm">
                  {formatBytes(stats?.memoryUsage?.heapUsed || 0)}
                </span>
              </div>
              <div className="h-2 bg-[#0B0B0E] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((stats?.memoryUsage?.heapUsed || 0) / (stats?.memoryUsage?.heapTotal || 1)) * 100)}%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Heap Total</span>
                <span className="text-white text-sm">
                  {formatBytes(stats?.memoryUsage?.heapTotal || 0)}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">RSS</span>
                <span className="text-white text-sm">
                  {formatBytes(stats?.memoryUsage?.rss || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StabilityMonitor;
