import { useEffect, useMemo, useState } from 'react';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { useMembershipStore } from '@/store/useMembershipStore';
import { nodeModelMatcher, type CompactSelectOptionGroup } from '@/core/node-model-matcher';
import type { UnifiedModelConfig } from '@/services/unified-api-model-service';
import { modelRegistry } from '@/services/model-registry';

export interface UseNodeModelsResult {
  models: UnifiedModelConfig[];
  groupedOptions: CompactSelectOptionGroup[];
  defaultModel: UnifiedModelConfig | null;
  isModelAllowed: (modelId: string) => boolean;
  resolveModelOnCreate: () => { modelId: string; provider: string; model?: UnifiedModelConfig } | null;
}

let nodeModelRegistrySyncPromise: Promise<void> | null = null;
let lastNodeModelRegistrySyncSignature = '';

function ensureNodeModelRegistrySync(signature: string): Promise<void> {
  if (signature === lastNodeModelRegistrySyncSignature) {
    return nodeModelRegistrySyncPromise || Promise.resolve();
  }

  if (!nodeModelRegistrySyncPromise) {
    nodeModelRegistrySyncPromise = modelRegistry
      .refreshFromBackend()
      .then(() => {
        lastNodeModelRegistrySyncSignature = signature;
      })
      .finally(() => {
        nodeModelRegistrySyncPromise = null;
      });
  }
  return nodeModelRegistrySyncPromise;
}

export function useNodeModels(nodeType: string): UseNodeModelsResult {
  const configs = useUnifiedAPIConfigStore((s) => s.configs);
  const providerConfigs = useUnifiedAPIConfigStore((s) => s.providerConfigs);
  const isLoadingConfigs = useUnifiedAPIConfigStore((s) => s.isLoadingConfigs);
  const fetchProviderConfigs = useUnifiedAPIConfigStore((s) => s.fetchProviderConfigs);
  const membership = useMembershipStore((s) => s.membership);
  const [modelRegistryRevision, setModelRegistryRevision] = useState(0);
  const providerConfigSignature = useMemo(
    () => Object.keys(providerConfigs).sort().join('|') || 'empty',
    [providerConfigs],
  );

  useEffect(() => {
    let cancelled = false;

    async function syncNodeModels() {
      if (!isLoadingConfigs && Object.keys(providerConfigs).length === 0) {
        await fetchProviderConfigs();
      }
      await ensureNodeModelRegistrySync(providerConfigSignature);
      if (!cancelled) {
        setModelRegistryRevision((revision) => revision + 1);
      }
    }

    syncNodeModels().catch((error) => {
      console.warn('[useNodeModels] 同步后端模型契约失败:', error);
    });

    // 订阅 modelRegistry 变更：后端模型 CRUD 广播 app_config_updated 后，
    // App.tsx 会调用 modelRegistry.refreshFromBackend()，此处 listener 被触发，
    // 递增 revision 让下方 useMemo 重新计算节点模型列表。
    const unsubscribe = modelRegistry.subscribe(() => {
      if (!cancelled) {
        setModelRegistryRevision((revision) => revision + 1);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchProviderConfigs, isLoadingConfigs, providerConfigs, providerConfigSignature]);

  // providerConfigs 变化时也要重算，因为 isProviderConfigured 依赖它
const models = useMemo(() => {
    const builtIn = nodeModelMatcher.getModelsForNode(nodeType);
    const mediaType = nodeType === 'aiVideo' ? 'video' : nodeType === 'aiImage' ? 'image' : undefined;
    if (!mediaType) return builtIn;

    const custom = Object.entries(providerConfigs).flatMap(([provider, definition]) => {
      if (!definition.isCustomModel || definition.mediaType !== mediaType) return [];
      return definition.models
        .filter((model) => model.type === mediaType && model.isActive !== false)
        .map((model) => ({
          modelId: model.id,
          provider: provider as any,
          authConfig: null,
          isConfigured: true,
          isAvailable: true,
          modelInfo: {
            id: model.id,
            modelId: model.id,
            providerModel: model.providerModel || model.id,
            name: model.name,
            provider,
            type: mediaType,
            description: model.description || '',
            capabilities: model.capabilities || model.supportedModes || (mediaType === 'video' ? ['text-to-video', 'image-to-video'] : ['text-to-image']),
            isActive: true,
            isCustomModel: true,
            mediaType,
            compatibilityMode: mediaType === 'video' ? 'openai-video' : 'openai-image',
            supportedAspectRatios: model.supportedAspectRatios,
            supportedModes: model.supportedModes as any,
            defaultParams: model.defaultParams,
          },
        } as UnifiedModelConfig));
    });
    const customIds = new Set(custom.map((model) => `${model.provider}:${model.modelId}`));
    return [...custom, ...builtIn.filter((model) => !customIds.has(`${model.provider}:${model.modelId}`))];
  }, [nodeType, configs, providerConfigs, membership, modelRegistryRevision]);

  const groupedOptions = useMemo(() => nodeModelMatcher.groupModelsByProvider(models), [models]);

  const defaultModel = useMemo(() => nodeModelMatcher.getDefaultModelForNode(nodeType), [nodeType, configs, providerConfigs, membership, modelRegistryRevision]);

  const isModelAllowed = useMemo(
    () => (modelId: string) => nodeModelMatcher.isModelAllowedForNode(nodeType, modelId),
    [nodeType, configs, providerConfigs, membership, modelRegistryRevision],
  );

  const resolveModelOnCreate = useMemo(
    () => () => nodeModelMatcher.resolveModelOnNodeCreate(nodeType),
    [nodeType, configs, providerConfigs, membership, modelRegistryRevision],
  );

  return { models, groupedOptions, defaultModel, isModelAllowed, resolveModelOnCreate };
}
