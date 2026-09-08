import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  FileDown,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ContentManagement from './ContentManagement';
import {
  adminGovernanceService,
  type AlertsSummary,
  type CostAnalysis,
  type ExportMetadata,
  type ModelHealthDaily,
} from '@/services/admin/admin-governance-service';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminMetric,
  AdminSection,
} from './shared/AdminSurface';

type TabId = 'templates' | 'exports' | 'alerts' | 'cost' | 'health';

const providerHealthStatusMeta = {
  ready: { label: '可调用', className: 'bg-emerald-500/10 text-emerald-300' },
  no_key: { label: '无可用密钥', className: 'bg-amber-500/10 text-amber-300' },
  invalid_key: { label: '密钥无法解密', className: 'bg-red-500/10 text-red-300' },
  inactive: { label: '未启用', className: 'bg-white/[0.06] text-gray-300' },
} as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}

export default function OperationsCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('alerts');
  const [exportsMeta, setExportsMeta] = useState<ExportMetadata | null>(null);
  const [alerts, setAlerts] = useState<AlertsSummary | null>(null);
  const [cost, setCost] = useState<CostAnalysis | null>(null);
  const [health, setHealth] = useState<ModelHealthDaily | null>(null);
  const [exportsError, setExportsError] = useState('');
  const [alertsError, setAlertsError] = useState('');
  const [costError, setCostError] = useState('');
  const [healthError, setHealthError] = useState('');
  const [exportsLoading, setExportsLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [costLoading, setCostLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedExportType, setSelectedExportType] = useState('users');
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [costDays, setCostDays] = useState(30);

  const loadExports = useCallback(async () => {
    setExportsLoading(true);
    setExportsError('');
    try {
      const res = await adminGovernanceService.getExportMetadata();
      if (!res.success) {
        setExportsError('导出元数据加载失败');
        return;
      }
      setExportsMeta(res.data);
      setSelectedExportType(res.data.types[0]?.type || 'users');
      setSelectedFormat(res.data.formats[0]?.format || 'csv');
    } catch (error) {
      setExportsError(error instanceof Error ? error.message : '导出元数据加载失败');
    } finally {
      setExportsLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const res = await adminGovernanceService.getAlerts();
      if (!res.success) {
        setAlertsError('告警中心加载失败');
        return;
      }
      setAlerts(res.data);
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : '告警中心加载失败');
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const loadCost = useCallback(async () => {
    setCostLoading(true);
    setCostError('');
    try {
      const res = await adminGovernanceService.getCostAnalysis(costDays);
      if (!res.success) {
        setCostError('成本分析加载失败');
        return;
      }
      setCost(res.data);
    } catch (error) {
      setCostError(error instanceof Error ? error.message : '成本分析加载失败');
    } finally {
      setCostLoading(false);
    }
  }, [costDays]);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const res = await adminGovernanceService.getModelHealthDaily();
      if (!res.success) {
        setHealthError('模型健康日报加载失败');
        return;
      }
      setHealth(res.data);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : '模型健康日报加载失败');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExports();
    void loadAlerts();
    void loadCost();
    void loadHealth();
  }, [loadExports, loadAlerts, loadCost, loadHealth]);

  const severitySummary = useMemo(() => {
    const summary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const alert of alerts?.alerts ?? []) {
      summary[alert.severity] = (summary[alert.severity] || 0) + 1;
    }
    return summary;
  }, [alerts]);

  const handleDownload = async () => {
    setDownloading(true);
    setExportsError('');
    try {
      const blob = await adminGovernanceService.downloadExport({
        type: selectedExportType,
        format: selectedFormat,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedExportType}-${new Date().toISOString().slice(0, 10)}.${selectedFormat === 'excel' ? 'xlsx' : selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportsError(error instanceof Error ? error.message : '导出失败');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">运营增强</h2>
          <p className="mt-1 text-sm text-gray-400">模板、导出、告警、成本和模型日报集中查看。</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-[#111114] p-1">
          {[
            { id: 'templates', label: '模板管理', icon: Sparkles },
            { id: 'exports', label: '数据导出', icon: FileDown },
            { id: 'alerts', label: '告警中心', icon: ShieldAlert },
            { id: 'cost', label: '成本分析', icon: BarChart3 },
            { id: 'health', label: '模型日报', icon: Stethoscope },
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabId)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  selected ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'templates' && <ContentManagement />}

      {activeTab === 'exports' && (
        <div className="space-y-5">
          {exportsLoading ? (
            <AdminLoadingState />
          ) : exportsError ? (
            <AdminErrorState message={exportsError} onRetry={loadExports} />
          ) : exportsMeta ? (
            <AdminSection
              title="数据导出"
              description="导出用户、任务、支付、日志和配额数据，用于运营对账和问题追踪。"
            >
              <div className="grid gap-4 lg:grid-cols-5">
                <label className="space-y-1 text-xs text-gray-400">
                  类型
                  <select
                    value={selectedExportType}
                    onChange={(event) => setSelectedExportType(event.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-sm text-white outline-none"
                  >
                    {exportsMeta.types.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-400">
                  格式
                  <select
                    value={selectedFormat}
                    onChange={(event) => setSelectedFormat(event.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-sm text-white outline-none"
                  >
                    {exportsMeta.formats.map((item) => (
                      <option key={item.format} value={item.format}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-400">
                  开始日期
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-400">
                  结束日期
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 disabled:opacity-50"
                  >
                    {downloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    导出
                  </button>
                </div>
              </div>
            </AdminSection>
          ) : (
            <AdminEmptyState title="暂无导出配置" />
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-5">
          {alertsLoading ? (
            <AdminLoadingState />
          ) : alertsError ? (
            <AdminErrorState message={alertsError} onRetry={loadAlerts} />
          ) : alerts ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <AdminMetric label="严重" value={severitySummary.critical} accentClassName="text-red-300" />
                <AdminMetric label="高危" value={severitySummary.high} accentClassName="text-orange-300" />
                <AdminMetric label="中危" value={severitySummary.medium} accentClassName="text-amber-300" />
                <AdminMetric label="总告警" value={alerts.total} />
              </div>
              <AdminSection
                title="告警列表"
                action={
                  <button
                    type="button"
                    onClick={loadAlerts}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-gray-300 hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    刷新
                  </button>
                }
              >
                {alerts.alerts.length === 0 ? (
                  <AdminEmptyState title="暂无告警" description="当前 Provider、任务、短信和审计状态未触发运营告警。" />
                ) : (
                  <div className="space-y-3">
                    {alerts.alerts.map((alert) => (
                      <div key={alert.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-300" />
                              <p className="text-sm font-medium text-white">{alert.title}</p>
                              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-gray-300">
                                {alert.category}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">{alert.detail}</p>
                          </div>
                          <span
                            className={cn(
                              'rounded-full px-2 py-1 text-xs font-medium',
                              alert.severity === 'critical'
                                ? 'bg-red-500/10 text-red-300'
                                : alert.severity === 'high'
                                  ? 'bg-orange-500/10 text-orange-300'
                                  : 'bg-amber-500/10 text-amber-300'
                            )}
                          >
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AdminSection>
            </>
          ) : (
            <AdminEmptyState title="暂无告警数据" />
          )}
        </div>
      )}

      {activeTab === 'cost' && (
        <div className="space-y-5">
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-[#111114] p-1 w-fit">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setCostDays(days)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  costDays === days ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                )}
              >
                {days} 天
              </button>
            ))}
          </div>
          {costLoading ? (
            <AdminLoadingState />
          ) : costError ? (
            <AdminErrorState message={costError} onRetry={loadCost} />
          ) : cost ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <AdminMetric label="API 调用" value={formatNumber(cost.summary.apiCalls)} />
                <AdminMetric label="总费用" value={formatCost(cost.summary.totalCost)} />
                <AdminMetric label="积分消耗" value={formatNumber(cost.summary.pointsCost + cost.summary.taskCredits)} />
                <AdminMetric label="Token" value={formatNumber(cost.summary.inputTokens + cost.summary.outputTokens)} />
              </div>
              <AdminSection title="Provider 成本排行">
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">调用</th>
                        <th className="px-4 py-3">Token</th>
                        <th className="px-4 py-3">积分</th>
                        <th className="px-4 py-3">费用</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {cost.providers.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-gray-400" colSpan={5}>
                            暂无成本记录
                          </td>
                        </tr>
                      ) : (
                        cost.providers.map((provider) => (
                          <tr key={provider.provider} className="bg-[#111114]">
                            <td className="px-4 py-3 text-white">{provider.provider}</td>
                            <td className="px-4 py-3 text-gray-300">{formatNumber(provider.apiCalls)}</td>
                            <td className="px-4 py-3 text-gray-300">{formatNumber(provider.tokens)}</td>
                            <td className="px-4 py-3 text-gray-300">{formatNumber(provider.pointsCost)}</td>
                            <td className="px-4 py-3 text-cyan-300">{formatCost(provider.totalCost)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </AdminSection>
            </>
          ) : (
            <AdminEmptyState title="暂无成本数据" />
          )}
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-5">
          {healthLoading ? (
            <AdminLoadingState />
          ) : healthError ? (
            <AdminErrorState message={healthError} onRetry={loadHealth} />
          ) : health ? (
            <>
              <div className="grid gap-3 md:grid-cols-6">
                <AdminMetric label="Provider 总数" value={health.summary.totalProviders} />
                <AdminMetric label="已激活" value={health.summary.activeProviders} />
                <AdminMetric label="可调用" value={health.summary.readyProviders} />
                <AdminMetric label="无密钥" value={health.summary.noKeyProviders} accentClassName="text-amber-300" />
                <AdminMetric label="无法解密" value={health.summary.invalidKeys} accentClassName="text-red-300" />
                <AdminMetric label="耗尽密钥" value={health.summary.exhaustedKeys} accentClassName="text-red-300" />
              </div>
              <AdminSection
                title="模型健康日报"
                description={`生成时间：${formatDate(health.generatedAt)}`}
                action={
                  <button
                    type="button"
                    onClick={loadHealth}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-gray-300 hover:text-white"
                  >
                    <CalendarDays className="h-4 w-4" />
                    刷新日报
                  </button>
                }
              >
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">状态</th>
                        <th className="px-4 py-3">可用/配置密钥</th>
                        <th className="px-4 py-3">耗尽</th>
                        <th className="px-4 py-3">更新时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {health.providers.map((provider) => {
                        const statusMeta = providerHealthStatusMeta[provider.status];
                        return (
                          <tr key={provider.provider} className="bg-[#111114]">
                            <td className="px-4 py-3">
                              <div className="text-white">{provider.displayName}</div>
                              <div className="text-xs text-gray-500">{provider.provider}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn('rounded-full px-2 py-1 text-xs font-medium', statusMeta.className)}>
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {provider.usableKeys}/{provider.activeKeys}
                            </td>
                            <td className="px-4 py-3 text-gray-300">{provider.exhaustedKeys}</td>
                            <td className="px-4 py-3 text-gray-400">{formatDate(provider.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AdminSection>
            </>
          ) : (
            <AdminEmptyState title="暂无模型健康日报" />
          )}
        </div>
      )}
    </div>
  );
}
