import {
  PROMPT_OPTIMIZER_MODELS,
  PROMPT_TEXT_MODEL_GROUPS,
} from '@/config/prompt-optimizer-models';
import type { UnifiedModelConfig } from '@/services/unified-api-model-service';
import type { NodeModelPolicy } from './types/node-manifest';

export function buildTextModelsForPolicy(policy: NodeModelPolicy): UnifiedModelConfig[] {
  const allowedProviders = new Set((policy.allowedProviders || []).map((provider) => provider.toLowerCase()));
  const fallbackProviders = new Map(
    (policy.fallbackModels || []).map((fallback) => [fallback.modelId, fallback.provider]),
  );
  const groupedModelIds = new Set(PROMPT_TEXT_MODEL_GROUPS.flatMap((group) => [...group.models]));
  const allowedModelIds = new Set(policy.allowedModelIds || []);
  const orderedModelIds = [
    ...(policy.defaultModelId ? [policy.defaultModelId] : []),
    ...(policy.fallbackModels || []).map((fallback) => fallback.modelId),
    ...Array.from(groupedModelIds),
  ];
  const uniqueModelIds = Array.from(new Set(orderedModelIds));

  return uniqueModelIds
    .map((modelId) => {
      const modelMeta = PROMPT_OPTIMIZER_MODELS.find((model) => model.id === modelId);
      if (!modelMeta) return null;

      const provider = fallbackProviders.get(modelId) || modelMeta.provider || modelId.split('-')[0] || 'unknown';
      if (allowedProviders.size > 0 && provider !== 'auto' && !allowedProviders.has(provider.toLowerCase())) {
        return null;
      }
      if (allowedModelIds.size > 0 && !allowedModelIds.has(modelId)) {
        return null;
      }

      return {
        modelId,
        provider: provider as UnifiedModelConfig['provider'],
        modelInfo: {
          id: modelId,
          modelId,
          name: `${modelMeta.name} · ${modelMeta.model}`,
          provider: provider as UnifiedModelConfig['provider'],
          type: 'text',
          description: modelMeta.desc,
          capabilities: ['text-generation', 'prompt-optimization', 'copywriting'],
          isActive: true,
          tags: ['文本', '提示词', modelMeta.name],
        },
        authConfig: null,
        isConfigured: true,
        isAvailable: true,
      } as UnifiedModelConfig;
    })
    .filter((model): model is UnifiedModelConfig => Boolean(model));
}
