import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Check,
  Coins,
  Eye,
  EyeOff,
  Gift,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  adminAppConfigService,
  AppBootstrapConfig,
  AppModelConfig,
  AppModelType,
  AppSectionConfig,
  PricingTaskType,
  RechargePackageConfig,
} from '@/services/app-config-service';

type TabId = 'overview' | 'models' | 'sections' | 'points' | 'recharge' | 'flags';

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: '总览', icon: Activity },
  { id: 'models', label: '模型与参数', icon: Bot },
  { id: 'sections', label: '前端板块', icon: LayoutGrid },
  { id: 'points', label: '积分/邀请', icon: Coins },
  { id: 'recharge', label: '充值赠送', icon: Gift },
  { id: 'flags', label: '功能开关', icon: SlidersHorizontal },
];

const MODEL_TYPES: AppModelType[] = ['image', 'video', 'audio', 'text', 'music', 'both'];

const EMPTY_MODEL_FORM = {
  provider: '',
  modelId: '',
  name: '',
  type: 'image' as AppModelType,
  modelCategory: 'generation' as 'generation' | 'edit' | 'action',
  supportedModes: '',
  capabilities: '',
  requiredInputs: '',
  supportedAspectRatios: '',
  maxDuration: '',
  pointsCost: '',
  isActive: true,
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function taskTypeFromModel(type?: AppModelType): PricingTaskType {
  if (type === 'video' || type === 'audio' || type === 'text' || type === 'music') return type;
  return 'image';
}

function pointsDefinitionKeyToPolicyField(key: string): string {
  const map: Record<string, string> = {
    points_registration_bonus: 'registration_bonus',
    points_registration_bonus_expiry_days: 'registration_bonus_expiry_days',
    points_daily_claim: 'daily_claim',
    points_daily_claim_expiry_days: 'daily_claim_expiry_days',
    points_invite_registration_reward: 'invite_registration_reward',
    points_invite_recharge_reward: 'invite_recharge_reward',
    points_invite_recharge_threshold: 'invite_recharge_threshold',
    points_invite_reward_expiry_days: 'invite_reward_expiry_days',
  };
  return map[key] || key;
}

const AppConfigCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [config, setConfig] = useState<AppBootstrapConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [modelForm, setModelForm] = useState({ ...EMPTY_MODEL_FORM });
  const [editingModel, setEditingModel] = useState<AppModelConfig | null>(null);
  const [selectedModel, setSelectedModel] = useState<AppModelConfig | null>(null);
  const [parameterDraft, setParameterDraft] = useState('');
  const [pricingDraft, setPricingDraft] = useState({ taskType: 'image' as PricingTaskType, pointsCost: '', note: '' });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAppConfigService.getBootstrap();
      if (res.success) {
        setConfig(res.data);
      } else {
        toast.error(res.error || '加载配置失败');
      }
    } catch (error: any) {
      toast.error(error?.message || '加载配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const stats = useMemo(() => {
    const models = config?.models || [];
    return {
      providers: config?.providers.length || 0,
      totalModels: models.length,
      activeModels: models.filter((model) => model.isActive).length,
      disabledModels: models.filter((model) => !model.isActive).length,
      imageModels: models.filter((model) => model.type === 'image' || model.type === 'both').length,
      videoModels: models.filter((model) => model.type === 'video').length,
      sections: config?.sections.filter((section) => section.enabled).length || 0,
      rechargePackages: config?.rechargePackages.filter((pkg) => pkg.isActive).length || 0,
    };
  }, [config]);

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    const models = config?.models || [];
    if (!query) return models;
    return models.filter((model) =>
      [model.name, model.modelId, model.configuredProvider, model.routeProvider, model.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [config?.models, modelSearch]);

  const updateConfig = (patch: Partial<AppBootstrapConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const startEditModel = (model: AppModelConfig) => {
    setEditingModel(model);
    setModelForm({
      provider: model.configuredProvider,
      modelId: model.modelId,
      name: model.name,
      type: model.type || 'image',
      modelCategory: model.modelCategory || 'generation',
      supportedModes: model.supportedModes.join(', '),
      capabilities: model.capabilities.join(', '),
      requiredInputs: model.requiredInputs.join(', '),
      supportedAspectRatios: model.supportedAspectRatios?.join(', ') || '',
      maxDuration: model.maxDuration ? String(model.maxDuration) : '',
      pointsCost: model.pricing?.pointsCost !== undefined ? String(model.pricing.pointsCost) : '',
      isActive: model.isActive,
    });
    setSelectedModel(model);
    setParameterDraft(JSON.stringify(model.parameterSchema, null, 2));
    setPricingDraft({
      taskType: taskTypeFromModel(model.type),
      pointsCost: model.pricing?.pointsCost !== undefined ? String(model.pricing.pointsCost) : '',
      note: model.pricing?.note || '',
    });
  };

  const resetModelForm = () => {
    setEditingModel(null);
    setModelForm({ ...EMPTY_MODEL_FORM });
  };

  const saveModel = async () => {
    if (!modelForm.provider.trim() || !modelForm.modelId.trim()) {
      toast.error('provider 和 modelId 必填');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        provider: modelForm.provider.trim(),
        modelId: modelForm.modelId.trim(),
        name: modelForm.name.trim() || modelForm.modelId.trim(),
        type: modelForm.type,
        modelCategory: modelForm.modelCategory,
        supportedModes: splitCsv(modelForm.supportedModes),
        capabilities: splitCsv(modelForm.capabilities),
        requiredInputs: splitCsv(modelForm.requiredInputs),
        supportedAspectRatios: splitCsv(modelForm.supportedAspectRatios),
        maxDuration: modelForm.maxDuration ? Number(modelForm.maxDuration) : undefined,
        isActive: modelForm.isActive,
      };
      const res = editingModel
        ? await adminAppConfigService.updateModel(editingModel.configuredProvider, editingModel.modelId, payload)
        : await adminAppConfigService.createModel(payload);
      if (!res.success) throw new Error(res.error || '保存模型失败');

      if (modelForm.pointsCost !== '') {
        await adminAppConfigService.updateModelPricing(payload.provider, payload.modelId, {
          taskType: taskTypeFromModel(payload.type),
          pointsCost: Number(modelForm.pointsCost),
          isActive: true,
        });
      }

      toast.success('模型配置已保存');
      resetModelForm();
      await loadConfig();
    } catch (error: any) {
      toast.error(error?.message || '保存模型失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleModel = async (model: AppModelConfig) => {
    setSaving(true);
    try {
      await adminAppConfigService.setModelStatus(
        model.configuredProvider,
        model.modelId,
        !model.isActive,
        model.isActive ? '管理员在应用配置中心禁用' : undefined
      );
      toast.success(model.isActive ? '模型已禁用' : '模型已启用');
      await loadConfig();
    } catch (error: any) {
      toast.error(error?.message || '切换模型状态失败');
    } finally {
      setSaving(false);
    }
  };

  const archiveModel = async (model: AppModelConfig) => {
    setSaving(true);
    try {
      await adminAppConfigService.archiveModel(model.configuredProvider, model.modelId);
      toast.success('模型已下架');
      await loadConfig();
    } catch (error: any) {
      toast.error(error?.message || '下架模型失败');
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedModelParameters = async () => {
    if (!selectedModel) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(parameterDraft);
      await adminAppConfigService.updateModelParameters(selectedModel.configuredProvider, selectedModel.modelId, parsed);
      toast.success('参数 schema 已保存');
      await loadConfig();
    } catch (error: any) {
      toast.error(error?.message || '参数 JSON 不合法');
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedModelPricing = async () => {
    if (!selectedModel) return;
    if (pricingDraft.pointsCost === '' || Number.isNaN(Number(pricingDraft.pointsCost))) {
      toast.error('请输入有效积分');
      return;
    }
    setSaving(true);
    try {
      await adminAppConfigService.updateModelPricing(selectedModel.configuredProvider, selectedModel.modelId, {
        taskType: pricingDraft.taskType,
        pointsCost: Number(pricingDraft.pointsCost),
        isActive: true,
        note: pricingDraft.note,
      });
      toast.success('模型积分定价已保存');
      await loadConfig();
    } catch (error: any) {
      toast.error(error?.message || '保存定价失败');
    } finally {
      setSaving(false);
    }
  };

  const saveSections = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await adminAppConfigService.saveSections(config.sections);
      if (!res.success) throw new Error(res.error || '保存失败');
      updateConfig({ sections: res.data });
      toast.success('前端板块配置已保存');
    } catch (error: any) {
      toast.error(error?.message || '保存板块失败');
    } finally {
      setSaving(false);
    }
  };

  const saveFlags = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await adminAppConfigService.saveFeatureFlags(config.featureFlags);
      updateConfig({ featureFlags: res.data });
      toast.success('功能开关已保存');
    } catch (error: any) {
      toast.error(error?.message || '保存功能开关失败');
    } finally {
      setSaving(false);
    }
  };

  const savePoints = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await adminAppConfigService.savePointsPolicy(config.pointsPolicy);
      updateConfig({ pointsPolicy: res.data });
      toast.success('积分/邀请规则已保存');
    } catch (error: any) {
      toast.error(error?.message || '保存积分规则失败');
    } finally {
      setSaving(false);
    }
  };

  const saveRechargePackages = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await adminAppConfigService.saveRechargePackages(config.rechargePackages);
      updateConfig({ rechargePackages: res.data });
      toast.success('充值套餐已保存');
    } catch (error: any) {
      toast.error(error?.message || '保存充值套餐失败');
    } finally {
      setSaving(false);
    }
  };

  const resetRechargePackages = async () => {
    setSaving(true);
    try {
      const res = await adminAppConfigService.resetRechargePackages();
      updateConfig({ rechargePackages: res.data });
      toast.success('充值套餐已重置');
    } catch (error: any) {
      toast.error(error?.message || '重置失败');
    } finally {
      setSaving(false);
    }
  };

  const publishConfig = async () => {
    setSaving(true);
    try {
      const res = await adminAppConfigService.publish();
      toast.success(`配置已发布：${res.data.version}`);
      await loadConfig();
    } catch (error: any) {
      toast.error(error?.message || '发布失败');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (idx: number, patch: Partial<AppSectionConfig>) => {
    if (!config) return;
    const sections = [...config.sections];
    sections[idx] = { ...sections[idx], ...patch };
    updateConfig({ sections });
  };

  const updateRechargePackage = (idx: number, patch: Partial<RechargePackageConfig>) => {
    if (!config) return;
    const rechargePackages = [...config.rechargePackages];
    rechargePackages[idx] = { ...rechargePackages[idx], ...patch };
    updateConfig({ rechargePackages });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-300">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        加载应用配置中心...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        应用配置加载失败，请刷新后重试。
      </div>
    );
  }

  return (
    <div className="space-y-5 text-gray-100">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">应用配置中心</h2>
          <p className="mt-1 text-sm text-gray-400">
            后端统一控制前端板块、模型目录、节点参数、积分、邀请奖励和充值赠送。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadConfig()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/[0.06]"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <button
            type="button"
            onClick={() => void publishConfig()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            发布配置
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-[#151519] p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                activeTab === tab.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['服务商', stats.providers, '已接入 Provider 数量'],
              ['可见模型', stats.activeModels, `${stats.totalModels} 个模型，${stats.disabledModels} 个禁用`],
              ['前端板块', stats.sections, '当前启用的页面/板块'],
              ['充值套餐', stats.rechargePackages, '当前上架的积分套餐'],
            ].map(([label, value, desc]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-[#151519] p-4">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                <p className="mt-1 text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-white/10 bg-[#151519] p-4">
              <h3 className="text-sm font-semibold text-white">模型分布</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-gray-400">
                    <span>图片模型</span>
                    <span>{stats.imageModels}</span>
                  </div>
                  <div className="h-2 rounded bg-white/10">
                    <div className="h-2 rounded bg-sky-500" style={{ width: `${Math.min(100, (stats.imageModels / Math.max(1, stats.totalModels)) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-gray-400">
                    <span>视频模型</span>
                    <span>{stats.videoModels}</span>
                  </div>
                  <div className="h-2 rounded bg-white/10">
                    <div className="h-2 rounded bg-violet-500" style={{ width: `${Math.min(100, (stats.videoModels / Math.max(1, stats.totalModels)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#151519] p-4">
              <h3 className="text-sm font-semibold text-white">当前配置版本</h3>
              <p className="mt-3 font-mono text-sm text-emerald-300">{config.configVersion}</p>
              <p className="mt-2 text-xs text-gray-500">生成时间：{new Date(config.generatedAt).toLocaleString('zh-CN')}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="搜索模型、provider、类型..."
                className="w-full rounded-lg border border-white/10 bg-[#151519] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60 sm:max-w-sm"
              />
              <button
                type="button"
                onClick={resetModelForm}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
              >
                <Plus className="h-4 w-4" />
                新增模型
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-white/[0.04] text-xs text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left">模型</th>
                    <th className="px-3 py-2 text-left">Provider</th>
                    <th className="px-3 py-2 text-left">类型</th>
                    <th className="px-3 py-2 text-left">积分</th>
                    <th className="px-3 py-2 text-left">状态</th>
                    <th className="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((model) => (
                    <tr key={`${model.configuredProvider}:${model.modelId}`} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <p className="font-medium text-white">{model.name}</p>
                        <p className="font-mono text-xs text-gray-500">{model.modelId}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-gray-200">{model.providerDisplayName}</p>
                        <p className="font-mono text-xs text-gray-500">{model.configuredProvider}{' -> '}{model.routeProvider}</p>
                      </td>
                      <td className="px-3 py-2 text-gray-300">{model.type || 'image'}</td>
                      <td className="px-3 py-2 text-gray-300">{model.pricing?.pointsCost ?? '默认'}</td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded px-2 py-1 text-xs', model.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300')}>
                          {model.isActive ? '可用' : '禁用'}
                        </span>
                        {model.disabledReason && <p className="mt-1 max-w-[220px] truncate text-xs text-red-300">{model.disabledReason}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => startEditModel(model)} className="rounded border border-white/10 px-2 py-1 text-xs text-gray-200 hover:bg-white/10">编辑</button>
                          <button type="button" onClick={() => void toggleModel(model)} className="rounded border border-white/10 px-2 py-1 text-xs text-gray-200 hover:bg-white/10">
                            {model.isActive ? <EyeOff className="inline h-3 w-3" /> : <Eye className="inline h-3 w-3" />}
                          </button>
                          <button type="button" onClick={() => void archiveModel(model)} className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
                            <Trash2 className="inline h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-[#151519] p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Settings2 className="h-4 w-4" />
                {editingModel ? '编辑模型' : '新增模型'}
              </h3>
              <div className="mt-4 grid gap-3">
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="provider，例如 minimax" value={modelForm.provider} onChange={(e) => setModelForm({ ...modelForm, provider: e.target.value })} />
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="modelId" value={modelForm.modelId} onChange={(e) => setModelForm({ ...modelForm, modelId: e.target.value })} disabled={!!editingModel} />
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="模型名称" value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} />
                <select className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" value={modelForm.type} onChange={(e) => setModelForm({ ...modelForm, type: e.target.value as AppModelType })}>
                  {MODEL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="supportedModes，逗号分隔" value={modelForm.supportedModes} onChange={(e) => setModelForm({ ...modelForm, supportedModes: e.target.value })} />
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="capabilities，逗号分隔" value={modelForm.capabilities} onChange={(e) => setModelForm({ ...modelForm, capabilities: e.target.value })} />
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="requiredInputs，逗号分隔" value={modelForm.requiredInputs} onChange={(e) => setModelForm({ ...modelForm, requiredInputs: e.target.value })} />
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="比例，如 1:1, 16:9" value={modelForm.supportedAspectRatios} onChange={(e) => setModelForm({ ...modelForm, supportedAspectRatios: e.target.value })} />
                <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="单次扣除积分，可留空" type="number" min={0} value={modelForm.pointsCost} onChange={(e) => setModelForm({ ...modelForm, pointsCost: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={modelForm.isActive} onChange={(e) => setModelForm({ ...modelForm, isActive: e.target.checked })} />
                  前端可见并允许使用
                </label>
                <button type="button" onClick={() => void saveModel()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存模型
                </button>
              </div>
            </div>

            {selectedModel && (
              <div className="rounded-lg border border-white/10 bg-[#151519] p-4">
                <h3 className="text-sm font-semibold text-white">节点参数与定价</h3>
                <p className="mt-1 text-xs text-gray-500">{selectedModel.name} / {selectedModel.modelId}</p>
                <textarea
                  value={parameterDraft}
                  onChange={(event) => setParameterDraft(event.target.value)}
                  className="mt-3 h-48 w-full rounded border border-white/10 bg-black/30 p-3 font-mono text-xs text-gray-200 outline-none focus:border-emerald-500/60"
                />
                <button type="button" onClick={() => void saveSelectedModelParameters()} disabled={saving} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">
                  <Save className="h-4 w-4" />
                  保存参数 schema
                </button>
                <div className="mt-4 grid grid-cols-[120px_1fr] gap-2">
                  <select className="rounded border border-white/10 bg-black/20 px-2 py-2 text-sm" value={pricingDraft.taskType} onChange={(e) => setPricingDraft({ ...pricingDraft, taskType: e.target.value as PricingTaskType })}>
                    {['image', 'video', 'text', 'audio', 'music'].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <input className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" type="number" min={0} placeholder="扣除积分" value={pricingDraft.pointsCost} onChange={(e) => setPricingDraft({ ...pricingDraft, pointsCost: e.target.value })} />
                  <input className="col-span-2 rounded border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="定价备注" value={pricingDraft.note} onChange={(e) => setPricingDraft({ ...pricingDraft, note: e.target.value })} />
                </div>
                <button type="button" onClick={() => void saveSelectedModelPricing()} disabled={saving} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">
                  <Coins className="h-4 w-4" />
                  保存积分定价
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sections' && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-white/[0.04] text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">启用</th>
                  <th className="px-3 py-2 text-left">板块</th>
                  <th className="px-3 py-2 text-left">区域</th>
                  <th className="px-3 py-2 text-left">路由</th>
                  <th className="px-3 py-2 text-left">排序</th>
                </tr>
              </thead>
              <tbody>
                {config.sections.map((section, idx) => (
                  <tr key={section.id} className="border-t border-white/10">
                    <td className="px-3 py-2"><input type="checkbox" checked={section.enabled} onChange={(e) => updateSection(idx, { enabled: e.target.checked })} /></td>
                    <td className="px-3 py-2"><input className="w-full rounded border border-white/10 bg-black/20 px-2 py-1" value={section.name} onChange={(e) => updateSection(idx, { name: e.target.value })} /></td>
                    <td className="px-3 py-2 text-gray-300">{section.area}</td>
                    <td className="px-3 py-2"><input className="w-full rounded border border-white/10 bg-black/20 px-2 py-1" value={section.route || ''} onChange={(e) => updateSection(idx, { route: e.target.value })} /></td>
                    <td className="px-3 py-2"><input className="w-20 rounded border border-white/10 bg-black/20 px-2 py-1" type="number" value={section.order} onChange={(e) => updateSection(idx, { order: Number(e.target.value) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => void saveSections()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <Save className="h-4 w-4" />
            保存板块配置
          </button>
        </div>
      )}

      {activeTab === 'points' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {config.pointsDefinitions.map((definition) => (
              <label key={definition.key} className="rounded-lg border border-white/10 bg-[#151519] p-4">
                <span className="text-sm font-medium text-white">{definition.label}</span>
                <span className="mt-1 block text-xs text-gray-500">{definition.description}</span>
                <input
                  type="number"
                  min={definition.min}
                  value={config.pointsPolicy[pointsDefinitionKeyToPolicyField(definition.key)] ?? 0}
                  onChange={(event) => {
                    const field = pointsDefinitionKeyToPolicyField(definition.key);
                    updateConfig({ pointsPolicy: { ...config.pointsPolicy, [field]: Number(event.target.value) } });
                  }}
                  className="mt-3 w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => void savePoints()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <Save className="h-4 w-4" />
            保存积分和邀请规则
          </button>
        </div>
      )}

      {activeTab === 'recharge' && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => updateConfig({ rechargePackages: [...config.rechargePackages, { id: `pkg_${Date.now()}`, name: '新套餐', points: 1000, price: 10, bonusPoints: 0, isActive: true }] })} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">
              <Plus className="h-4 w-4" />
              新增套餐
            </button>
            <button type="button" onClick={() => void resetRechargePackages()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">
              重置
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-white/[0.04] text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">上架</th>
                  <th className="px-3 py-2 text-left">名称</th>
                  <th className="px-3 py-2 text-left">金额</th>
                  <th className="px-3 py-2 text-left">基础积分</th>
                  <th className="px-3 py-2 text-left">赠送积分</th>
                  <th className="px-3 py-2 text-left">推荐</th>
                  <th className="px-3 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {config.rechargePackages.map((pkg, idx) => (
                  <tr key={pkg.id} className="border-t border-white/10">
                    <td className="px-3 py-2"><input type="checkbox" checked={pkg.isActive} onChange={(e) => updateRechargePackage(idx, { isActive: e.target.checked })} /></td>
                    <td className="px-3 py-2"><input className="w-full rounded border border-white/10 bg-black/20 px-2 py-1" value={pkg.name} onChange={(e) => updateRechargePackage(idx, { name: e.target.value })} /></td>
                    <td className="px-3 py-2"><input className="w-24 rounded border border-white/10 bg-black/20 px-2 py-1" type="number" min={0.01} value={pkg.price} onChange={(e) => updateRechargePackage(idx, { price: Number(e.target.value) })} /></td>
                    <td className="px-3 py-2"><input className="w-28 rounded border border-white/10 bg-black/20 px-2 py-1" type="number" min={1} value={pkg.points} onChange={(e) => updateRechargePackage(idx, { points: Number(e.target.value) })} /></td>
                    <td className="px-3 py-2"><input className="w-28 rounded border border-white/10 bg-black/20 px-2 py-1" type="number" min={0} value={pkg.bonusPoints || 0} onChange={(e) => updateRechargePackage(idx, { bonusPoints: Number(e.target.value) })} /></td>
                    <td className="px-3 py-2"><input type="checkbox" checked={!!pkg.isPopular} onChange={(e) => updateRechargePackage(idx, { isPopular: e.target.checked })} /></td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => updateConfig({ rechargePackages: config.rechargePackages.filter((_, packageIndex) => packageIndex !== idx) })} className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => void saveRechargePackages()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <Save className="h-4 w-4" />
            保存充值套餐
          </button>
        </div>
      )}

      {activeTab === 'flags' && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(config.featureFlags).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#151519] p-4">
                <span>
                  <span className="block font-mono text-sm text-white">{key}</span>
                  <span className="mt-1 block text-xs text-gray-500">前端启动时读取的功能开关</span>
                </span>
                <input type="checkbox" checked={value} onChange={(e) => updateConfig({ featureFlags: { ...config.featureFlags, [key]: e.target.checked } })} />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => void saveFlags()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <Save className="h-4 w-4" />
            保存功能开关
          </button>
        </div>
      )}
    </div>
  );
};

export default AppConfigCenter;
