import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  FileText,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  adminGovernanceService,
  type AuditSummary,
  type GovernanceSetting,
  type PermissionsSummary,
  type SystemConfigSummary,
} from '@/services/admin/admin-governance-service';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminMetric,
  AdminSection,
} from './shared/AdminSurface';

type TabId = 'system' | 'permissions' | 'audit';

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

function isChanged(a: GovernanceSetting['value'], b: GovernanceSetting['value']): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export default function GovernanceCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('system');
  const [systemConfig, setSystemConfig] = useState<SystemConfigSummary | null>(null);
  const [permissions, setPermissions] = useState<PermissionsSummary | null>(null);
  const [audit, setAudit] = useState<AuditSummary | null>(null);
  const [systemError, setSystemError] = useState('');
  const [permissionsError, setPermissionsError] = useState('');
  const [auditError, setAuditError] = useState('');
  const [systemLoading, setSystemLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditDays, setAuditDays] = useState(7);
  const [draftValues, setDraftValues] = useState<Record<string, GovernanceSetting['value']>>({});
  const [saveMessage, setSaveMessage] = useState('');

  const loadSystem = useCallback(async () => {
    setSystemLoading(true);
    setSystemError('');
    try {
      const res = await adminGovernanceService.getSystemConfig();
      if (!res.success) {
        setSystemError('系统配置加载失败');
        return;
      }
      setSystemConfig(res.data);
      setDraftValues(
        Object.fromEntries(res.data.settings.map((setting) => [setting.key, setting.value]))
      );
    } catch (error) {
      setSystemError(error instanceof Error ? error.message : '系统配置加载失败');
    } finally {
      setSystemLoading(false);
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    setPermissionsError('');
    try {
      const res = await adminGovernanceService.getPermissions();
      if (!res.success) {
        setPermissionsError('权限中心加载失败');
        return;
      }
      setPermissions(res.data);
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : '权限中心加载失败');
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const res = await adminGovernanceService.getAuditSummary(auditDays);
      if (!res.success) {
        setAuditError('审计中心加载失败');
        return;
      }
      setAudit(res.data);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : '审计中心加载失败');
    } finally {
      setAuditLoading(false);
    }
  }, [auditDays]);

  useEffect(() => {
    void loadSystem();
    void loadPermissions();
    void loadAudit();
  }, [loadSystem, loadPermissions, loadAudit]);

  const groupedSettings = useMemo(() => {
    const groups: Record<string, GovernanceSetting[]> = {};
    for (const setting of systemConfig?.settings ?? []) {
      if (!groups[setting.group]) groups[setting.group] = [];
      groups[setting.group].push(setting);
    }
    return groups;
  }, [systemConfig]);

  const hasChanges = useMemo(
    () => (systemConfig?.settings ?? []).some((setting) => isChanged(draftValues[setting.key], setting.value)),
    [draftValues, systemConfig]
  );

  const handleSystemValueChange = (key: string, value: GovernanceSetting['value']) => {
    setDraftValues((prev) => ({ ...prev, [key]: value }));
    setSaveMessage('');
  };

  const handleSaveSystem = async () => {
    if (!systemConfig) return;

    const settings = systemConfig.settings
      .filter((setting) => isChanged(draftValues[setting.key], setting.value))
      .map((setting) => ({ key: setting.key, value: draftValues[setting.key] ?? setting.value }));

    if (settings.length === 0) {
      setSaveMessage('没有检测到配置变更');
      return;
    }

    setSaving(true);
    try {
      const res = await adminGovernanceService.saveSystemConfig(settings);
      if (!res.success) {
        setSaveMessage(res.error || '保存失败');
        return;
      }
      setSaveMessage(res.message || `已保存 ${settings.length} 项配置`);
      await loadSystem();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const renderSettingEditor = (setting: GovernanceSetting) => {
    const value = draftValues[setting.key] ?? setting.value;

    if (setting.type === 'boolean') {
      const enabled = Boolean(value);
      return (
        <button
          type="button"
          onClick={() => handleSystemValueChange(setting.key, !enabled)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            enabled
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-white/[0.08] bg-white/[0.03] text-gray-400 hover:text-white'
          )}
        >
          {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {enabled ? '启用' : '关闭'}
        </button>
      );
    }

    if (setting.type === 'number') {
      return (
        <input
          type="number"
          value={Number(value)}
          onChange={(event) => handleSystemValueChange(setting.key, Number(event.target.value))}
          className="w-32 rounded-lg border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
        />
      );
    }

    return (
      <input
        type="text"
        value={typeof value === 'string' ? value : JSON.stringify(value)}
        onChange={(event) => handleSystemValueChange(setting.key, event.target.value)}
        className="w-full rounded-lg border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
      />
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">治理中心</h2>
          <p className="mt-1 text-sm text-gray-400">系统配置、权限中心和审计日志统一收口。</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-[#111114] p-1">
          {[
            { id: 'system', label: '系统配置', icon: SlidersHorizontal },
            { id: 'permissions', label: '权限中心', icon: ShieldCheck },
            { id: 'audit', label: '审计中心', icon: FileText },
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

      {activeTab === 'system' && (
        <div className="space-y-5">
          {systemLoading ? (
            <AdminLoadingState />
          ) : systemError ? (
            <AdminErrorState message={systemError} onRetry={loadSystem} />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <AdminMetric
                  label="支付配置项"
                  value={systemConfig?.summaries?.payment?.configCount ?? 0}
                  subLabel={`最后更新：${formatDate(systemConfig?.summaries?.payment?.latestUpdatedAt)}`}
                />
                <AdminMetric
                  label="积分配置键"
                  value={systemConfig?.summaries?.points?.configKey || '未配置'}
                  subLabel={`最后更新：${formatDate(systemConfig?.summaries?.points?.latestUpdatedAt)}`}
                />
                <AdminMetric
                  label="短信运行态"
                  value={systemConfig?.summaries?.sms?.provider || 'mock'}
                  subLabel={
                    systemConfig?.summaries?.sms?.isMockInProduction
                      ? '生产环境仍是模拟短信'
                      : `最后更新：${formatDate(systemConfig?.summaries?.sms?.latestUpdatedAt)}`
                  }
                />
              </div>

              <AdminSection
                title="系统配置项"
                description="这些配置会直接影响前端开关、消息策略和审计保留。"
                action={
                  <button
                    type="button"
                    onClick={handleSaveSystem}
                    disabled={saving || !hasChanges}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    保存配置
                  </button>
                }
              >
                <div className="space-y-4">
                  {Object.entries(groupedSettings).map(([group, settings]) => (
                    <div key={group} className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{group}</div>
                      <div className="space-y-3">
                        {settings.map((setting) => (
                          <div
                            key={setting.key}
                            className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-white">{setting.label}</p>
                                  <span
                                    className={cn(
                                      'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                                      setting.riskLevel === 'high'
                                        ? 'bg-red-500/10 text-red-300'
                                        : setting.riskLevel === 'medium'
                                          ? 'bg-amber-500/10 text-amber-300'
                                          : 'bg-white/[0.04] text-gray-300'
                                    )}
                                  >
                                    {setting.riskLevel}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">{setting.description}</p>
                              </div>
                              <div className="flex items-center gap-3">{renderSettingEditor(setting)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AdminSection>

              {saveMessage && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-gray-200">
                  <Check className="mr-2 inline-block h-4 w-4 text-emerald-400" />
                  {saveMessage}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="space-y-5">
          {permissionsLoading ? (
            <AdminLoadingState />
          ) : permissionsError ? (
            <AdminErrorState message={permissionsError} onRetry={loadPermissions} />
          ) : permissions ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <AdminMetric label="活跃用户" value={permissions.summary.activeUsers} />
                <AdminMetric label="服务商数量" value={permissions.summary.providerCount} />
                <AdminMetric label="活跃服务商" value={permissions.summary.activeProviderCount} />
                <AdminMetric label="用户 API Key" value={permissions.summary.userApiKeyCount} />
              </div>

              <AdminSection
                title="角色视图"
                description="当前权限先按角色做总览，后续可继续拆成更细的 ACL/菜单权限。"
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {permissions.roles.map((role) => (
                    <div key={role.role} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{role.role}</p>
                          <p className="mt-1 text-xs text-gray-400">{role.scope}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-gray-300">
                          {role.userCount} 人
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                        <Users className="h-3.5 w-3.5" />
                        {role.highRiskAccess ? '可操作高风险功能' : '限制高风险功能'}
                      </div>
                    </div>
                  ))}
                </div>
              </AdminSection>

              <AdminSection title="模块清单" description="高风险模块会在治理中心统一展示。">
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-3">模块</th>
                        <th className="px-4 py-3">路由</th>
                        <th className="px-4 py-3">风险</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {permissions.modules.map((module) => (
                        <tr key={module.key} className="bg-[#111114]">
                          <td className="px-4 py-3 text-white">{module.label}</td>
                          <td className="px-4 py-3 text-gray-400">{module.route}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'rounded-full px-2 py-1 text-xs font-medium',
                                module.riskLevel === 'high'
                                  ? 'bg-red-500/10 text-red-300'
                                  : 'bg-amber-500/10 text-amber-300'
                              )}
                            >
                              {module.riskLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AdminSection>
            </>
          ) : (
            <AdminEmptyState title="暂无权限数据" />
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-[#111114] p-1">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setAuditDays(days)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    auditDays === days
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                  )}
                >
                  {days} 天
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadAudit}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#111114] px-3 py-2 text-sm font-medium text-gray-300 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              刷新审计
            </button>
          </div>

          {auditLoading ? (
            <AdminLoadingState />
          ) : auditError ? (
            <AdminErrorState message={auditError} onRetry={loadAudit} />
          ) : audit ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <AdminMetric label="总操作数" value={audit.total} />
                <AdminMetric label="失败操作" value={audit.failed} />
                <AdminMetric label="高风险操作" value={audit.highRisk} />
                <AdminMetric label="成功率" value={`${audit.successRate.toFixed(1)}%`} />
              </div>

              <AdminSection title="高频动作">
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-3">动作</th>
                        <th className="px-4 py-3">次数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {audit.byAction.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-gray-400" colSpan={2}>
                            暂无动作数据
                          </td>
                        </tr>
                      ) : (
                        audit.byAction.map((item) => (
                          <tr key={item.action} className="bg-[#111114]">
                            <td className="px-4 py-3 text-white">{item.action}</td>
                            <td className="px-4 py-3 text-gray-300">{item.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </AdminSection>

              <AdminSection title="最近高风险审计">
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-3">操作者</th>
                        <th className="px-4 py-3">动作</th>
                        <th className="px-4 py-3">对象</th>
                        <th className="px-4 py-3">状态</th>
                        <th className="px-4 py-3">时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {audit.recentHighRisk.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-gray-400" colSpan={5}>
                            暂无高风险审计记录
                          </td>
                        </tr>
                      ) : (
                        audit.recentHighRisk.map((item) => (
                          <tr key={item.id} className="bg-[#111114]">
                            <td className="px-4 py-3 text-white">{item.adminUsername}</td>
                            <td className="px-4 py-3 text-gray-300">{item.action}</td>
                            <td className="px-4 py-3 text-gray-300">
                              {item.targetName || item.targetType || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  'rounded-full px-2 py-1 text-xs font-medium',
                                  /success/i.test(item.status)
                                    ? 'bg-emerald-500/10 text-emerald-300'
                                    : 'bg-red-500/10 text-red-300'
                                )}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400">{formatDate(item.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </AdminSection>
            </>
          ) : (
            <AdminEmptyState
              title="暂无审计数据"
              description="系统还没有可展示的高风险后台操作。"
            />
          )}
        </div>
      )}
    </div>
  );
}
