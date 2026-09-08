import { nodeRegistry } from './node-registry';
import {
  unifiedAPIModelService,
  type UnifiedModelConfig,
} from '@/services/unified-api-model-service';
import type { NodeModelPolicy, NodeManifestFile } from './types/node-manifest';
import { buildTextModelsForPolicy } from './text-model-policy';
import gridDirectorManifest from '@/config/nodes/grid-director.json';
import aiGenTextManifest from '@/config/nodes/ai-gen-text.json';
import batchProcessManifest from '@/config/nodes/batch-process.json';
import localMattingManifest from '@/config/nodes/local-matting.json';
import audioGenManifest from '@/config/nodes/audio-gen.json';
import director3DManifest from '@/config/nodes/director3d.json';
import characterLibraryManifest from '@/config/nodes/character-library.json';
import aiVideoManifest from '@/config/nodes/ai-video.json';
import scriptManifest from '@/config/nodes/script.json';
import adCopyTextManifest from '@/config/nodes/ad-copy-text.json';
import brandCopyTextManifest from '@/config/nodes/brand-copy-text.json';
import aiImageManifest from '@/config/nodes/ai-image.json';
import scriptStoryboardManifest from '@/config/nodes/script-storyboard.json';
import storyboardMakerManifest from '@/config/nodes/storyboard-maker.json';
import storyboardEditManifest from '@/config/nodes/storyboard-edit.json';
import characterConsistencyManifest from '@/config/nodes/character-consistency.json';
import multiAngleManifest from '@/config/nodes/multi-angle.json';

const manifestFiles = [
  gridDirectorManifest,
  aiGenTextManifest,
  batchProcessManifest,
  localMattingManifest,
  audioGenManifest,
  director3DManifest,
  characterLibraryManifest,
  aiVideoManifest,
  scriptManifest,
  adCopyTextManifest,
  brandCopyTextManifest,
  aiImageManifest,
  scriptStoryboardManifest,
  storyboardMakerManifest,
  storyboardEditManifest,
  characterConsistencyManifest,
  multiAngleManifest,
] as NodeManifestFile[];

function getManifestPolicies(): Array<{ id: string; models?: NodeModelPolicy }> {
  return manifestFiles.filter((file): file is NodeManifestFile => !!file?.id);
}

export interface CompactSelectOption {
  value: string | number;
  label: string;
  description?: string;
  provider?: string;
  badge?: string;
}

export interface CompactSelectOptionGroup {
  label: string;
  options: CompactSelectOption[];
}

const IMAGE_GENERATION_NODE_TYPES = new Set(['aiImage']);
const VIDEO_GENERATION_NODE_TYPES = new Set(['aiVideo', 'aicgVideoGen']);

function isDisabledModel(model: UnifiedModelConfig): boolean {
  return !!model.modelInfo?.disabledReason || model.modelInfo?.isActive === false;
}

function isActionModel(model: UnifiedModelConfig): boolean {
  return model.modelInfo?.modelCategory === 'action';
}

class NodeModelMatcher {
  private policyCache = new Map<string, NodeModelPolicy | null>();

  init(): void {
    for (const file of getManifestPolicies()) {
      if (file.models) {
        this.policyCache.set(file.id, file.models);
      }
    }
  }

  getModelPolicy(nodeType: string): NodeModelPolicy | null {
    if (this.policyCache.size === 0) this.init();

    const cached = this.policyCache.get(nodeType);
    if (cached !== undefined) return cached;

    const manifest = nodeRegistry.get(nodeType);
    if (manifest?.models) {
      this.policyCache.set(nodeType, manifest.models);
      return manifest.models;
    }

    this.policyCache.set(nodeType, null);
    return null;
  }

  getModelsForNode(nodeType: string): UnifiedModelConfig[] {
    const policy = this.getModelPolicy(nodeType);
    if (!policy) {
      // 未知节点类型不应默认返回 image 模型，避免 UI 下拉框显示错误模型
      return [];
    }
    if (policy.mediaType === 'none') {
      return [];
    }

    if (policy.useTextModelGroups) {
      return this.getTextModelsForNode(policy);
    }

    const apiType = policy.mediaType === 'text' ? 'image' : policy.mediaType;
    let models = unifiedAPIModelService.getModelsByType(apiType);
    models = models.filter((model) => !isDisabledModel(model));

    if (policy.allowedProviders?.length) {
      const allowed = new Set(policy.allowedProviders.map((p) => p.toLowerCase()));
      models = models.filter(
        (m) =>
          allowed.has(m.provider.toLowerCase()) ||
          (m.modelInfo?.isCustomModel === true && m.modelInfo?.mediaType === policy.mediaType)
      );
    }

    if (policy.allowedModelIds?.length) {
      const allowed = new Set(policy.allowedModelIds);
      models = models.filter((m) => allowed.has(m.modelId));
    }

    if (policy.excludedModelIds?.length) {
      const excluded = new Set(policy.excludedModelIds);
      models = models.filter((m) => !excluded.has(m.modelId));
    }

    if (policy.excludeIdPatterns?.length) {
      models = models.filter((m) => {
        const id = m.modelId.toLowerCase();
        const name = (m.modelInfo?.name || '').toLowerCase();
        return !policy.excludeIdPatterns!.some(
          (pattern) => id.includes(pattern.toLowerCase()) || name.includes(pattern.toLowerCase())
        );
      });
    }

    if (
      (policy.mediaType === 'image' && IMAGE_GENERATION_NODE_TYPES.has(nodeType)) ||
      (policy.mediaType === 'video' && VIDEO_GENERATION_NODE_TYPES.has(nodeType))
    ) {
      models = models.filter((model) => !isActionModel(model));
    }

    if (policy.requireCapabilities?.length) {
      models = models.filter((m) => {
        const caps = (m.modelInfo?.capabilities || []).map((c: string) =>
          c.toLowerCase().replace(/_/g, '-')
        );
        return policy.requireCapabilities!.some((req) =>
          caps.includes(req.toLowerCase().replace(/_/g, '-'))
        );
      });
    }

    return models;
  }

  private getTextModelsForNode(policy: NodeModelPolicy): UnifiedModelConfig[] {
    return buildTextModelsForPolicy(policy);
  }

  getDefaultModelForNode(nodeType: string): UnifiedModelConfig | null {
    const policy = this.getModelPolicy(nodeType);
    if (!policy) return null;

    if (policy.defaultModelId) {
      const models = this.getModelsForNode(nodeType);
      const match = models.find((m) => m.modelId === policy.defaultModelId);
      if (match) return match;
    }

    const fallbacks = policy.fallbackModels;
    if (fallbacks?.length) {
      if (policy.useTextModelGroups) {
        const textModels = this.getTextModelsForNode(policy);
        for (const fb of fallbacks) {
          const match = textModels.find((m) => m.modelId === fb.modelId);
          if (match) return match;
        }
      }

      const fbApiType =
        policy.mediaType === 'text' || policy.mediaType === 'none' ? 'image' : policy.mediaType;
      const allModels = unifiedAPIModelService.getModelsByType(fbApiType);
      for (const fb of fallbacks) {
        const match = allModels.find((m) => m.modelId === fb.modelId);
        if (match) return match;
      }
    }

    const models = this.getModelsForNode(nodeType);
    return models[0] ?? null;
  }

  isModelAllowedForNode(nodeType: string, modelId: string): boolean {
    const models = this.getModelsForNode(nodeType);
    // 列表为空（providerConfigs 异步未加载完成）时放行，避免误判导致强制覆盖用户选择
    if (models.length === 0) return true;
    return models.some(
      (m) =>
        m.modelId === modelId || m.modelInfo?.id === modelId || m.modelInfo?.modelId === modelId
    );
  }

  groupModelsByProvider(models: UnifiedModelConfig[]): CompactSelectOptionGroup[] {
    const groups = new Map<string, CompactSelectOptionGroup>();

    for (const model of models) {
      const groupLabel = model.modelInfo?.isCustomModel ? '自定义模型' : this.getProviderLabel(model.provider);
      const existing = groups.get(groupLabel);
      const option: CompactSelectOption = {
        value: model.modelId,
        label:
          (model.modelInfo?.isCustomModel ? model.modelInfo?.providerModel : undefined) ||
          model.modelInfo?.name ||
          model.modelId,
      };

      if (existing) {
        existing.options.push(option);
      } else {
        groups.set(groupLabel, { label: groupLabel, options: [option] });
      }
    }

    // 排序：SenseNova 与小天1/2/3/4 优先，其余按原序
    const groupOrder = ['自定义模型', 'SenseNova', '小天6', '小天4', '小天3', '小天2', '小天1'];
    return Array.from(groups.values()).sort((a, b) => {
      const ai = groupOrder.indexOf(a.label);
      const bi = groupOrder.indexOf(b.label);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
  }

  resolveModelOnNodeCreate(
    nodeType: string
  ): { modelId: string; provider: string; model?: UnifiedModelConfig } | null {
    const defaultModel = this.getDefaultModelForNode(nodeType);
    if (!defaultModel) return null;

    return {
      modelId: defaultModel.modelId,
      provider: defaultModel.provider,
      model: defaultModel,
    };
  }

  private getProviderLabel(provider: string): string {
    const normalized = provider.toLowerCase();
    const labels: Record<string, string> = {
      sensenova: 'SenseNova',
      stepfun: 'StepFun',
      doubao: '豆包',
      minimax: 'MiniMax',
      agnes: '小天',
      apipaths: '小天3',
      vidu: 'Vidu',
      liblib: 'XTT',
      hailuo: '海螺AI',
      kling: '可灵',
    };
    if (labels[normalized]) return labels[normalized];

    const providerInfo = unifiedAPIModelService.getProviderInfo(provider as never);
    if (providerInfo?.name) {
      return providerInfo.name
        .replace(/AI$/u, '')
        .replace(/大模型$/u, '')
        .trim();
    }
    return provider;
  }
}

export const nodeModelMatcher = new NodeModelMatcher();
