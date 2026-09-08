// @ts-nocheck
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Key,
  Shield,
  Image,
  Video,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { aiProviderService, type CustomModelDiagnostic } from '@/services/admin/ai-provider-service';
import { userModelCredentialService } from '@/services/user-model-credential-service';
import { modelRegistry } from '@/services/model-registry';
import { DEFAULT_RESOLUTIONS, getModelSupportedResolutions } from '@/config/model-resolutions';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { DEFAULT_CUSTOM_MODEL_ENDPOINT } from './apiDefaults';
import {
  applyDomesticOfficialModelPreset,
  getDomesticOfficialModelPreset,
  getDomesticOfficialModelPresets,
} from '@/config/domestic-official-model-presets';

interface ProviderInput {
  accessKey: string;
  secretKey: string;
  apiKey: string;
}

type CustomMediaType = 'image' | 'video';

interface NewCustomModelState {
  presetId: string;
  mediaType: CustomMediaType;
  connectionMode: 'proxy' | 'official';
  displayName: string;
  upstreamModel: string;
  endpoint: string;
  apiKey: string;
  enableReferenceInput: boolean;
}

const createEmptyCustomModel = (mediaType: CustomMediaType = 'image'): NewCustomModelState => ({
  presetId: 'custom',
  mediaType,
  connectionMode: 'proxy',
  displayName: '自定义模型',
  upstreamModel: '',
  endpoint: '',
  apiKey: '',
  enableReferenceInput: true,
});

export const EnhancedAPIConfigPanel: React.FC = () => {
  const {
    configs,
    providerConfigs,
    isLoadingConfigs,
    configLoadError,
    fetchProviderConfigs,
    fetchUserCredentialConfigs,
    userCredentialConfigs,
    userCredentialStorage,
    setConfig,
    setProviderEnabled,
    hasValidConfig,
    setConnectionStatus,
    setLastTested,
    clearConfig
  } = useUnifiedAPIConfigStore();

  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'image' | 'video'>('all');
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [localInputs, setLocalInputs] = useState<Record<string, ProviderInput>>({});
  const [addingModel, setAddingModel] = useState(false);
  const [addModelError, setAddModelError] = useState('');
  const [newModel, setNewModel] = useState<NewCustomModelState>(() => createEmptyCustomModel());
  const [addDiagnostic, setAddDiagnostic] = useState<CustomModelDiagnostic | null>(null);
  const [providerDiagnostics, setProviderDiagnostics] = useState<Record<string, CustomModelDiagnostic>>({});
  const selectedOfficialPreset = getDomesticOfficialModelPreset(newModel.presetId);

  useEffect(() => {
    fetchProviderConfigs();
  }, [fetchProviderConfigs]);

  const isAKSKAuth = useCallback((authType?: string) => {
    return authType === 'aksk' || authType === 'ak-sk';
  }, []);

  const getLocalInput = useCallback((providerId: string): ProviderInput => {
    return localInputs[providerId] || { accessKey: '', secretKey: '', apiKey: '' };
  }, [localInputs]);

  const updateLocalInput = useCallback((providerId: string, updates: Partial<ProviderInput>) => {
    setLocalInputs(prev => ({
      ...prev,
      [providerId]: { ...(prev[providerId] || { accessKey: '', secretKey: '', apiKey: '' }), ...updates }
    }));
  }, []);

  const filteredProviders = useMemo(() => {
    return Object.entries(providerConfigs).filter(([_, config]) => {
      // 用户仅可配置管理员建立的自定义模型；内置服务商不会显示或编辑。
      if (config.isCustomModel !== true) return false;
      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'image') return config.mediaType === 'image';
      if (selectedCategory === 'video') return config.mediaType === 'video';
      return true;
    });
  }, [selectedCategory, providerConfigs]);

  const toggleProviderExpansion = useCallback((providerId: string) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev);
      newSet.has(providerId) ? newSet.delete(providerId) : newSet.add(providerId);
      return newSet;
    });
  }, []);

  const toggleKeyVisibility = useCallback((providerId: string, keyType: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      const key = `${providerId}-${keyType}`;
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      return newSet;
    });
  }, []);

  const handleSaveConfig = useCallback(async (providerId: string) => {
    setSavingProvider(providerId);
    try {
      const localInput = localInputs[providerId];
      const officialConfig = providerConfigs[providerId];
      if (!officialConfig) throw new Error('配置不存在');

      if (isAKSKAuth(officialConfig.authType)) {
        if (!localInput?.accessKey || !localInput?.secretKey) {
          throw new Error('ACCESS KEY 或 SECRET KEY 未填写');
        }
      } else if (!localInput?.apiKey) {
        throw new Error('API Key 未填写');
      }

      await userModelCredentialService.save(providerId, {
        enabled: true,
        apiKey: isAKSKAuth(officialConfig.authType) ? undefined : localInput?.apiKey,
        accessKey: isAKSKAuth(officialConfig.authType) ? localInput?.accessKey : undefined,
        secretKey: isAKSKAuth(officialConfig.authType) ? localInput?.secretKey : undefined,
      });
      // 密钥留在后端；前端只保存模型偏好和连接状态。
      setConfig(providerId as any, { ...(configs[providerId] || {}), model: configs[providerId]?.model });
      setLocalInputs(prev => ({
        ...prev,
        [providerId]: { accessKey: '', secretKey: '', apiKey: '' },
      }));
      setProviderEnabled(providerId, true);
      await fetchUserCredentialConfigs();
      await fetchProviderConfigs({ force: true });
      logger.info(`[EnhancedAPIConfig] 用户云端密钥已保存: ${providerId}`);

      logger.info(`[EnhancedAPIConfig] 配置已保存: ${providerId}`);
    } catch (error) {
      logger.error(`[EnhancedAPIConfig] 保存配置失败: ${providerId}`, error);
      toast.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    } finally {
      setSavingProvider(null);
    }
  }, [localInputs, providerConfigs, isAKSKAuth, setProviderEnabled, fetchUserCredentialConfigs, fetchProviderConfigs, setConfig, configs]);

  const testConnection = useCallback(async (providerId: string) => {
    setTestingProvider(providerId);
    setConnectionStatus(providerId, 'testing');
    try {
      const localInput = localInputs[providerId];
      const officialConfig = providerConfigs[providerId];
      if (!officialConfig) throw new Error('配置不存在');

      if (isAKSKAuth(officialConfig.authType)) {
        if (!localInput?.accessKey || !localInput?.secretKey) {
          throw new Error('ACCESS KEY 或 SECRET KEY 未填写');
        }
      } else {
        if (!localInput?.apiKey) throw new Error('API Key 未填写');
      }

      const statusResponse = await aiProviderService.testCustomModelProvider(
        providerId,
        String(localInput?.apiKey || '').trim()
      );
      if (!statusResponse.success || !statusResponse.data.online) {
        throw new Error(statusResponse.data?.message || 'API Key 验证失败');
      }
      setProviderDiagnostics((previous) => ({ ...previous, [providerId]: statusResponse.data }));
      await handleSaveConfig(providerId);
      setConnectionStatus(providerId, 'connected');
      setLastTested(providerId, new Date());
      toast.success('API Key 验证成功，配置已保存');
    } catch (error) {
      setConnectionStatus(providerId, 'error');
      logger.error(`[EnhancedAPIConfig] ${providerId} 连接测试失败`, error);
      const message = error instanceof Error ? error.message : 'API Key 验证失败，请检查后重试';
      toast.error(`API Key 验证失败：${message}`);
    } finally {
      setTestingProvider(null);
    }
  }, [localInputs, providerConfigs, handleSaveConfig, setConnectionStatus, setLastTested, isAKSKAuth]);

  const handleClearConfig = useCallback((providerId: string) => {
    if (confirm('确定要清除此配置吗？')) {
      clearConfig(providerId);
      const unifiedStore = useUnifiedAPIConfigStore.getState();
      unifiedStore.clearConfig(providerId as any);
      setLocalInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[providerId];
        return newInputs;
      });
    }
  }, [clearConfig]);

  const handleDeleteCustomModel = useCallback(async (providerId: string) => {
    if (!confirm('确定删除此自定义模型吗？模型定义与云端 Key 将一并删除，且无法恢复。')) return;
    setDeletingProvider(providerId);
    try {
      await aiProviderService.deleteCustomModelProvider(providerId);
      setConfig(providerId as any, {});
      setLocalInputs((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      setExpandedProviders((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
      await fetchUserCredentialConfigs();
      await fetchProviderConfigs({ force: true });
      await modelRegistry.refreshFromBackend();
      toast.success('自定义模型已删除');
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败，请重试';
      toast.error(`删除失败：${message}`);
    } finally {
      setDeletingProvider(null);
    }
  }, [fetchProviderConfigs, fetchUserCredentialConfigs, setConfig]);

  const handleImportFromBackend = async () => {
    try {
      const response = await aiProviderService.getExportFrontendConfig();
      if (response.success && response.data) {
        const configs = Object.values(response.data);
        for (const config of configs) {
          if (config.hasApiKey) {
            setProviderEnabled(config.providerId, true);
          }
        }
        toast.success(`已同步 ${configs.length} 个后端 Provider 状态`);
      }
    } catch (error) {
      console.error('导入失败:', error);
      toast.error('导入失败，请检查后端服务');
    }
  };

  const handleAddCustomModel = async () => {
    const officialPreset = newModel.connectionMode === 'official'
      ? getDomesticOfficialModelPreset(newModel.presetId)
      : undefined;
    if (newModel.connectionMode === 'official' && !officialPreset) {
      const message = '请先选择一个软件官方图片或视频模型';
      setAddModelError(message);
      toast.error(message);
      return;
    }
    if (!newModel.apiKey.trim() || !newModel.upstreamModel.trim() || !newModel.endpoint.trim() || (!officialPreset && !newModel.displayName.trim())) {
      const message = '请填写模型名称、上游模型名称、接口地址和 API Key';
      setAddModelError(message);
      toast.error(message);
      return;
    }
    setAddModelError('');
    setAddDiagnostic(null);
    setAddingModel(true);
    let createdCustomProvider: string | null = null;
    try {
      if (officialPreset) {
        await userModelCredentialService.save(officialPreset.provider, {
          enabled: true,
          displayName: officialPreset.displayName,
          selectedModel: newModel.upstreamModel.trim(),
          baseUrl: newModel.endpoint.trim().replace(/\/+$/, ''),
          apiKey: newModel.apiKey.trim(),
        });
        toast.success('国内官方模型 Key 已保存到独立通道');
        setNewModel(createEmptyCustomModel(newModel.mediaType));
        await fetchUserCredentialConfigs();
        return;
      }
      const slug = newModel.displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `model-${Date.now()}`;
      const mediaType = newModel.mediaType === 'video' ? 'video' : 'image';
      const uniqueSuffix = globalThis.crypto?.randomUUID?.().slice(0, 8) || Date.now().toString(36);
      const provider = `custom-${mediaType}-${slug}-${uniqueSuffix}`;
      const modes = mediaType === 'image'
        ? ['text_to_image', ...(newModel.enableReferenceInput ? ['image_to_image'] : [])]
        : ['text_to_video', ...(newModel.enableReferenceInput ? ['image_to_video'] : [])];
      const capabilities = modes.map((mode) => mode.replace(/_/g, '-'));
      const detectedResolutions = getModelSupportedResolutions(newModel.upstreamModel.trim());
      // Unknown upstream APIs have no reliable shared dimensions endpoint.
      // Store `auto` instead of guessing a fixed size; the backend will then
      // only transmit the declared capability contract for every request.
      const imageResolutions = detectedResolutions === DEFAULT_RESOLUTIONS
        ? (mediaType === 'image' ? [{ value: 'auto', label: '自动尺寸', aspectRatio: 'auto' }] : [])
        : detectedResolutions;
      const supportedResolutions = Array.from(
        new Set(imageResolutions.map((resolution) => resolution.value))
      );
      const supportedAspectRatios = Array.from(
        new Set(imageResolutions.map((resolution) => resolution.aspectRatio).filter((ratio) => ratio !== 'auto'))
      );
      const defaultAspectRatio = supportedAspectRatios.includes('16:9')
        ? '16:9'
        : supportedAspectRatios[0] || '1:1';
      const defaultImageSize =
        imageResolutions.find((resolution) => resolution.aspectRatio === defaultAspectRatio)?.value ||
        supportedResolutions[0];
      await aiProviderService.createCustomModelProvider({
        provider,
        name: '自定义模型组',
        displayName: newModel.displayName.trim(),
        description: `自定义${mediaType === 'image' ? '图片' : '视频'}模型`,
        endpoint: newModel.endpoint.trim().replace(/\/+$/, ''),
        isActive: true,
        supportedModes: modes,
        models: [{
          id: `${provider}-model`,
          name: newModel.displayName.trim(),
          providerModel: newModel.upstreamModel.trim(),
          type: mediaType,
          modelCategory: 'generation',
          capabilities,
          supportedModes: modes,
          ...(mediaType === 'image'
            ? {
                supportedResolutions,
                supportedAspectRatios,
                defaultParams: { aspectRatio: defaultAspectRatio, imageSize: defaultImageSize, imageCount: 1 },
              }
            : supportedResolutions.length > 0
              ? {
                  supportedResolutions,
                  supportedAspectRatios,
                  defaultParams: { aspectRatio: defaultAspectRatio, resolution: defaultImageSize, duration: 5 },
                }
              : { defaultParams: { duration: 5 } }),
          isActive: true,
        }],
        config: {
          isCustomModel: true,
          mediaType,
          compatibilityMode: `openai-${mediaType}`,
          protocolVersion: 'openai-generation-v1',
          channelScope: 'personal-custom',
          credentialScope: 'user-only',
          disablePublicFallback: true,
          customModel: { pointsPerSuccess: 1, sortPriority: 0 },
          supportedModes: modes,
        },
      } as any);
      createdCustomProvider = provider;
      const diagnosticResponse = await aiProviderService.testCustomModelProvider(provider, newModel.apiKey.trim());
      if (!diagnosticResponse.success || !diagnosticResponse.data.online) {
        throw new Error(diagnosticResponse.data?.message || '接口兼容性检测失败');
      }
      setAddDiagnostic(diagnosticResponse.data);
      await userModelCredentialService.save(provider, { enabled: true, apiKey: newModel.apiKey.trim(), baseUrl: newModel.endpoint.trim().replace(/\/+$/, ''), selectedModel: `${provider}-model` });
      toast.success(diagnosticResponse.data.resolvedModel ? '接口检测通过，模型与 Key 已保存' : '接口可连接，模型与 Key 已保存');
      setNewModel(createEmptyCustomModel());
      await fetchProviderConfigs({ force: true });
      await fetchUserCredentialConfigs();
      await modelRegistry.refreshFromBackend();
    } catch (error) {
      if (createdCustomProvider) {
        try {
          await aiProviderService.deleteCustomModelProvider(createdCustomProvider);
        } catch (rollbackError) {
          logger.error(
            `[EnhancedAPIConfig] 回滚未完成: ${createdCustomProvider}`,
            rollbackError
          );
        }
      }
      const message = error instanceof Error ? error.message : '保存失败，请修改后重试';
      setAddModelError(message);
      toast.error(`添加失败: ${message}`);
    } finally {
      setAddingModel(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">API 密钥配置</h2>
            <p className="text-gray-400 text-sm">
              自定义模型与国内官方模型分通道配置；个人 Key 加密保存在本机，浏览器不会保存或回显密钥明文。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleImportFromBackend}
              disabled={isLoadingConfigs}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-green-600 hover:bg-green-700 text-white"
            >
              <Key className="w-4 h-4" />
              同步后端状态
            </button>
            <button
              onClick={() => fetchProviderConfigs({ force: true })}
              disabled={isLoadingConfigs}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                isLoadingConfigs
                  ? 'bg-gray-700 text-gray-500 cursor-wait'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', isLoadingConfigs && 'animate-spin')} />
              刷新
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-cyan-300">
          <Shield className="w-4 h-4" />
          凭据加密空间：{(userCredentialStorage.usedBytes / 1024).toFixed(1)} KB / {(userCredentialStorage.limitBytes / 1024 / 1024).toFixed(0)} MB
        </div>
        <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white"><Plus className="h-4 w-4 text-cyan-300" />添加图片或视频模型 API</div>
            <p className="mb-3 text-xs text-gray-400">仅接入图片与视频生成模型。自定义接口需兼容 OpenAI 图片或视频生成协议；API Key 仅加密保存在本机空间。</p>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={newModel.mediaType} onChange={(e) => setNewModel({ ...createEmptyCustomModel(e.target.value as CustomMediaType), connectionMode: newModel.connectionMode })} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"><option value="image">AI 图片模型</option><option value="video">AI 视频模型</option></select>
              <select value={newModel.connectionMode} onChange={(e) => setNewModel({ ...newModel, presetId: 'custom', connectionMode: e.target.value as NewCustomModelState['connectionMode'], displayName: '自定义模型', upstreamModel: '', endpoint: '' })} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"><option value="proxy">个人自定义独立通道</option><option value="official">软件官方模型通道</option></select>
              {newModel.connectionMode === 'official' ? <select value={newModel.presetId} onChange={(e) => { const applied = applyDomesticOfficialModelPreset(e.target.value); if (applied) setNewModel({ ...newModel, ...applied }); }} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"><option value="custom">选择国内官方模型</option>{getDomesticOfficialModelPresets(newModel.mediaType === 'video' ? 'video' : 'image').map((preset) => <option key={preset.id} value={preset.id}>{preset.displayName}</option>)}</select> : <input value={newModel.displayName} onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })} placeholder="自定义模型" className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white" />}
              <div className="min-w-0">
                <input value={newModel.upstreamModel} onChange={(e) => setNewModel({ ...newModel, upstreamModel: e.target.value })} list={selectedOfficialPreset?.modelOptions?.length ? 'domestic-official-model-options' : undefined} placeholder="模型名称（输入Vidu自动补全）" className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white" />
                {selectedOfficialPreset?.modelOptions?.length ? (
                  <datalist id="domestic-official-model-options">
                    {selectedOfficialPreset.modelOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </datalist>
                ) : null}
              </div>
              <input value={newModel.endpoint} onChange={(e) => setNewModel({ ...newModel, endpoint: e.target.value })} placeholder={DEFAULT_CUSTOM_MODEL_ENDPOINT} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white" />
              <input type="password" value={newModel.apiKey} onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })} placeholder="API Key（加密保存，不回显）" className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white" autoComplete="off" />
            </div>
            {newModel.connectionMode === 'proxy' ? (
              <div className="mt-3 grid gap-3 rounded-lg border border-gray-700 bg-gray-900/60 p-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-400">请求协议</p>
                  <p className="mt-1 text-sm text-white">{newModel.mediaType === 'image' ? 'OpenAI 图片生成' : 'OpenAI 异步视频生成'}</p>
                  <p className="mt-1 break-all text-xs text-cyan-300">{newModel.mediaType === 'image' ? 'POST /images/generations' : 'POST /videos/generations + GET /videos/generations/{taskId}'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">模型能力</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-white">
                    <label className="flex items-center gap-2"><input type="checkbox" checked readOnly />{newModel.mediaType === 'image' ? '文生图' : '文生视频'}</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={newModel.enableReferenceInput} onChange={(event) => setNewModel((previous) => ({ ...previous, enableReferenceInput: event.target.checked }))} />{newModel.mediaType === 'image' ? '图生图' : '图生视频'}</label>
                  </div>
                </div>
              </div>
            ) : null}
            {newModel.connectionMode === 'official' && <p className="mt-2 text-xs text-amber-300">国内官方模型与用户自定义模型使用独立通道；选择模型后默认模型 ID 与官方端点自动填写，两项均可按需修改，只需输入 Key。</p>}
            {addModelError && <p role="alert" className="mt-2 text-xs text-red-300">保存失败：{addModelError}。输入内容已保留，可修改后再次提交。</p>}
            {addDiagnostic ? (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3" aria-live="polite">
                <div className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />{addDiagnostic.message}</div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {addDiagnostic.checks.map((check) => <div key={check.id} className="rounded border border-white/10 bg-black/20 p-2"><p className={cn('text-xs font-medium', check.status === 'warning' ? 'text-amber-300' : 'text-emerald-300')}>{check.label}</p><p className="mt-1 text-xs text-gray-300">{check.message}</p></div>)}
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex justify-end"><button onClick={handleAddCustomModel} disabled={addingModel} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{addingModel ? '添加中…' : newModel.connectionMode === 'official' ? '保存官方模型 Key' : '添加接口并保存 Key'}</button></div>
          </div>
      </div>

      <div className="flex gap-2 p-4 border-b border-gray-700">
        <button
          onClick={() => setSelectedCategory('all')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            selectedCategory === 'all'
              ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          )}
        >
          全部自定义模型
        </button>
        <button
          onClick={() => setSelectedCategory('image')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            selectedCategory === 'image'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          )}
        >
          <Image className="w-4 h-4" />
          图片生成
        </button>
        <button
          onClick={() => setSelectedCategory('video')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            selectedCategory === 'video'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          )}
        >
          <Video className="w-4 h-4" />
          视频生成
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoadingConfigs && filteredProviders.length === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            正在加载Provider配置...
          </div>
        )}

        {configLoadError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span>加载Provider配置失败</span>
            </div>
            <p className="text-xs opacity-70">{configLoadError}</p>
            <button
              onClick={() => fetchProviderConfigs({ force: true })}
              className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
            >
              重试
            </button>
          </div>
        )}

        {filteredProviders.map(([providerId, officialConfig]) => {
          const config = configs[providerId];
          const isEnabled = config?.enabled || false;
          const isExpanded = expandedProviders.has(providerId);
          const isTesting = testingProvider === providerId;
          const isSaving = savingProvider === providerId;
          const isConnected = config?.connectionStatus === 'connected';
          const hasValid = hasValidConfig(providerId);
          const localInput = getLocalInput(providerId);
          const customModelTypes = new Set(officialConfig.models.map((model) => model.type));

          return (
            <div
              key={providerId}
              className={cn(
                'rounded-lg border transition-all overflow-hidden',
                isEnabled
                  ? 'border-gray-500/50 bg-gray-500/5'
                  : 'border-gray-700 bg-gray-800/50'
              )}
            >
              <div
                className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleProviderExpansion(providerId)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setProviderEnabled(providerId, !isEnabled);
                      }}
                      className={cn(
                        'relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0',
                        isEnabled ? 'bg-gray-500' : 'bg-gray-600'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow',
                          isEnabled && 'translate-x-6'
                        )}
                      />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-white truncate">
                          {officialConfig.name}
                        </span>
                        {isConnected && (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                        {hasValid && !isConnected && (
                          <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                            已配置
                          </span>
                        )}
                        {officialConfig.hasApiKey && !hasValid && (
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400">
                            后端已配置
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {officialConfig.models[0]?.providerModel || officialConfig.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex gap-1">
                      {(officialConfig.features?.imageGeneration || customModelTypes.has('image')) && (
                        <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400">
                          <Image className="w-3 h-3 inline mr-1" />
                          图片
                        </span>
                      )}
                      {(officialConfig.features?.videoGeneration || customModelTypes.has('video')) && (
                        <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">
                          <Video className="w-3 h-3 inline mr-1" />
                          视频
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {officialConfig.models.length} 个模型
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                  <div className="mb-4 p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Shield className="w-4 h-4" />
                      <span>认证方式: {
                        isAKSKAuth(officialConfig.authType) ? 'ACCESS KEY / SECRET KEY' :
                        officialConfig.authType === 'bearer' ? 'Bearer Token (API Key)' : 'API Key'
                      }</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      模型列表: {officialConfig.models.map(m => m.name).join('、')}
                    </div>
                    {officialConfig.officialDocsUrl && (
                      <a
                        href={officialConfig.officialDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        查看官方文档
                      </a>
                    )}
                  </div>

                  {isAKSKAuth(officialConfig.authType) ? (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          <Key className="w-4 h-4 inline mr-1" />
                          ACCESS KEY
                        </label>
                        <div className="relative">
                          <input
                            type={visibleKeys.has(`${providerId}-access`) ? 'text' : 'password'}
                            value={localInput.accessKey}
                            onChange={(e) => updateLocalInput(providerId, { accessKey: e.target.value })}
                            placeholder="输入 ACCESS KEY"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 pr-12"
                            autoComplete="off"
                            spellCheck="false"
                          />
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(providerId, 'access')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            {visibleKeys.has(`${providerId}-access`) ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          <Shield className="w-4 h-4 inline mr-1" />
                          SECRET KEY
                        </label>
                        <div className="relative">
                          <input
                            type={visibleKeys.has(`${providerId}-secret`) ? 'text' : 'password'}
                            value={localInput.secretKey}
                            onChange={(e) => updateLocalInput(providerId, { secretKey: e.target.value })}
                            placeholder="输入 SECRET KEY"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 pr-12"
                            autoComplete="off"
                            spellCheck="false"
                          />
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(providerId, 'secret')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            {visibleKeys.has(`${providerId}-secret`) ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Key className="w-4 h-4 inline mr-1" />
                        {officialConfig.authType === 'bearer' ? 'API Key (Bearer Token)' : 'API Key'}
                      </label>
                      <div className="relative">
                        <input
                          type={visibleKeys.has(`${providerId}-api`) ? 'text' : 'password'}
                          value={localInput.apiKey}
                          onChange={(e) => updateLocalInput(providerId, { apiKey: e.target.value })}
                          placeholder={userCredentialConfigs[providerId]?.maskedApiKey ? `已保存：${userCredentialConfigs[providerId].maskedApiKey}` : '输入 API Key'}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 pr-12"
                          autoComplete="off"
                          spellCheck="false"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(providerId, 'api')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {visibleKeys.has(`${providerId}-api`) ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      {userCredentialConfigs[providerId]?.maskedApiKey && !localInput.apiKey ? (
                        <p className="mt-2 text-xs text-cyan-300">
                          已保存 Key：{userCredentialConfigs[providerId].maskedApiKey}（输入新 Key 可替换）
                        </p>
                      ) : null}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => testConnection(providerId)}
                      disabled={!isEnabled || isTesting || isSaving}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
                        !isEnabled
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : isTesting
                          ? 'bg-gray-500/50 text-white cursor-wait'
                          : 'bg-gray-500 hover:bg-gray-600 text-white'
                      )}
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          测试中...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          测试并保存
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteCustomModel(providerId)}
                      disabled={deletingProvider === providerId}
                      title="删除自定义模型"
                      className="px-4 py-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:cursor-wait disabled:opacity-60"
                    >
                      {deletingProvider === providerId ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </button>
                  </div>

                  {config?.connectionStatus && (
                    <div className={cn(
                      'mt-4 p-3 rounded-lg text-sm',
                      config.connectionStatus === 'connected' && 'bg-green-500/10 text-green-400 border border-green-500/20',
                      config.connectionStatus === 'error' && 'bg-red-500/10 text-red-400 border border-red-500/20',
                      config.connectionStatus === 'testing' && 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    )}>
                      {config.connectionStatus === 'connected' && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>连接成功</span>
                          {config.lastTested && (
                            <span className="text-xs opacity-70">
                              ({new Date(config.lastTested).toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}
                      {config.connectionStatus === 'error' && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>连接失败，请检查密钥是否正确</span>
                        </div>
                      )}
                      {config.connectionStatus === 'testing' && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>正在测试连接...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {providerDiagnostics[providerId] ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2" aria-label="接口兼容性检测结果">
                      {providerDiagnostics[providerId].checks.map((check) => (
                        <div key={check.id} className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                          <div className={cn('flex items-center gap-2 text-xs font-medium', check.status === 'warning' ? 'text-amber-300' : 'text-emerald-300')}>
                            {check.status === 'warning' ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{check.label}
                          </div>
                          <p className="mt-1 text-xs text-gray-300">{check.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isEnabled && (() => {
                    const li = localInputs[providerId];
                    const hasKeys = isAKSKAuth(officialConfig.authType)
                      ? (li?.accessKey && li?.secretKey)
                      : !!li?.apiKey;
                    const hasCloudCredential = userCredentialConfigs[providerId]?.hasCredentials;
                    return !hasKeys && !hasCloudCredential ? (
                      <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex items-center gap-2 text-yellow-400 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          <span>请填写{isAKSKAuth(officialConfig.authType) ? 'ACCESS KEY 和 SECRET KEY' : 'API Key'}后再点击测试</span>
                        </div>
                      </div>
                    ) : hasCloudCredential ? (
                      <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-sm">
                        此模型已匹配到你的 Key。编辑后保存即可替换，密钥不会回显。
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {!isLoadingConfigs && filteredProviders.length === 0 && !configLoadError && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 py-12 text-gray-400">
            <Key className="w-8 h-8 mb-3 text-cyan-300" />
            <p className="text-white">暂未添加自定义大模型接口</p>
            <p className="mt-2 text-sm">管理员在“自定义模型组”添加图片或视频模型后，用户即可在这里绑定自己的 Key。</p>
            <button
              onClick={() => fetchProviderConfigs({ force: true })}
              className="mt-3 text-sm text-gray-400 hover:text-gray-300 underline"
            >
              重新加载
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAPIConfigPanel;
