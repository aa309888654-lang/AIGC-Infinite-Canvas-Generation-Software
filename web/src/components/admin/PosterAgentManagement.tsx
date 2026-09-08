import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Brain,
  CheckCircle2,
  Database,
  GitBranch,
  Loader2,
  RefreshCw,
  Route,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  adminPosterAgentService,
  type PosterAgentHealth,
  type PosterAgentOverview,
} from '@/services/admin/admin-poster-agent-service';

function PosterAgentManagement() {
  const [overview, setOverview] = useState<PosterAgentOverview | null>(null);
  const [health, setHealth] = useState<PosterAgentHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const [overviewRes, healthRes] = await Promise.all([
        adminPosterAgentService.getOverview(),
        adminPosterAgentService.getHealth(),
      ]);
      setOverview(overviewRes.data);
      setHealth(healthRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载海报智能体管理数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const modelNameMap = useMemo(() => {
    const map = new Map<string, string>();
    overview?.models.forEach((model) => map.set(model.id, model.name));
    return map;
  }, [overview]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-[#111114]">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span>正在加载海报智能体管理数据...</span>
        </div>
      </div>
    );
  }

  if (error || !overview || !health) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="flex items-center gap-3 text-red-200">
          <ShieldCheck className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">海报智能体管理数据加载失败</h3>
            <p className="mt-1 text-sm text-red-200/70">{error || '未获取到有效数据'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100 hover:bg-red-500/25"
        >
          <RefreshCw className="h-4 w-4" />
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-[#111114] to-cyan-500/10 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white">海报智能体 API</h3>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-200">
                已接入管理后台
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              统一管理 PosterGen AI 的模型路由、提示词优化、知识库和后端接口状态。
            </p>
            <p className="mt-2 font-mono text-xs text-emerald-200/80">{overview.runtime.apiBasePath}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white transition-colors hover:bg-white/[0.1] disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          刷新状态
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Activity} label="运行状态" value={health.status === 'online' ? '在线' : health.status} tone="green" />
        <StatCard icon={Sparkles} label="推理模型" value={`${health.modelCount} 个`} tone="cyan" />
        <StatCard icon={Zap} label="默认模型" value={health.defaultModelId} tone="amber" compact />
        <StatCard icon={Database} label="知识库模板" value={overview.knowledge.totalTemplates.toLocaleString()} tone="purple" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-white/10 bg-[#111114] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-base font-semibold text-white">后端智能体模型</h4>
              <p className="mt-1 text-xs text-gray-500">推理模型全部绑定到后端智能体，由后端执行路由和降级。</p>
            </div>
            <Server className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">模型</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {overview.models.map((model) => (
                  <tr key={model.id} className="text-gray-300">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{model.name}</span>
                        {model.isDefault && (
                          <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-300">默认</span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-gray-500">{model.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-cyan-200">{model.resolvedProvider}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{model.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111114] p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-cyan-300" />
            <h4 className="text-base font-semibold text-white">智能路由样例</h4>
          </div>
          <div className="space-y-3">
            {overview.routingSamples.map((sample) => (
              <div key={sample.text} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm text-gray-300">{sample.text}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Route className="h-3.5 w-3.5 text-cyan-300" />
                  <span>路由到</span>
                  <span className="font-medium text-cyan-200">{modelNameMap.get(sample.modelId) || sample.modelId}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#111114] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-300" />
            <h4 className="text-base font-semibold text-white">知识库概览</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBlock label="高质量模板" value={overview.knowledge.highQualityTemplates.toLocaleString()} />
            <InfoBlock label="设计类型" value={`${overview.knowledge.designTypes.length} 类`} />
            <InfoBlock label="行业覆盖" value={`${overview.knowledge.industries.length} 类`} />
            <InfoBlock label="主要布局" value="居中 47.5%" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {overview.knowledge.industries.map((item) => (
              <span key={item} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-gray-300">{item}</span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111114] p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <h4 className="text-base font-semibold text-white">接口清单</h4>
          </div>
          <div className="space-y-2">
            {overview.endpoints.map((endpoint) => (
              <div key={`${endpoint.method}-${endpoint.path}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">{endpoint.method}</span>
                    <span className="text-sm text-white">{endpoint.name}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-gray-500">{endpoint.path}</p>
                </div>
                {endpoint.auth && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">知识库来源</p>
            <p className="mt-1 break-all font-mono text-xs text-gray-300">{overview.runtime.knowledgeSource}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'green' | 'cyan' | 'amber' | 'purple';
  compact?: boolean;
}

function StatCard({ icon: Icon, label, value, tone, compact }: StatCardProps) {
  const toneClass = {
    green: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
    amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
    purple: 'text-purple-300 bg-purple-400/10 border-purple-400/20',
  }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111114] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={cn('mt-2 font-semibold text-white', compact ? 'text-sm' : 'text-xl')}>{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export default PosterAgentManagement;
