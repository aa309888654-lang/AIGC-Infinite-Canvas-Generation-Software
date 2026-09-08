import prisma from '../lib/prisma';
import {
  type MembershipLevel,
  normalizeMembershipLevel,
  isProviderAllowedForMembership,
  isModelAllowedForMembership,
} from '../routes/ai-provider-membership';
import { getModelChannels, type ModelChannel, type ModelMediaType } from './model-channel-registry';
import {
  CONFIG_DEFINITIONS,
  DEFAULT_VALUES,
  getInviteConfig,
  getPointsConfig,
  savePointsConfig,
  invalidatePointsConfigCache,
} from './points-config-service';
import {
  DEFAULT_RECHARGE_PACKAGES,
  RechargePackage,
  getRechargePackages,
  saveRechargePackages,
} from './points-packages-service';
import { invalidatePricingCache, PricingRule } from './pricing-rules-service';

const APP_SECTIONS_CONFIG_KEY = 'app_sections_config';
const MODEL_PARAMETER_SCHEMA_CONFIG_KEY = 'model_parameter_schema_config';
const FEATURE_FLAGS_CONFIG_KEY = 'frontend_feature_flags_config';
const APP_CONFIG_VERSION_KEY = 'app_config_version';
const APP_CONFIG_SNAPSHOTS_KEY = 'app_config_snapshots';
const PRICING_RULES_PROVIDER = '__system_points_pricing__';

export type ModelType = 'image' | 'video' | 'audio' | 'text' | 'music' | 'both';

export interface AppSectionConfig {
  id: string;
  name: string;
  area: 'home' | 'workspace' | 'canvas' | 'membership' | 'admin' | 'navigation';
  route?: string;
  description?: string;
  enabled: boolean;
  order: number;
  requiredRole?: 'guest' | 'user' | 'admin';
  featureFlag?: string;
}

export interface ModelParameterField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'image' | 'file' | 'slider';
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number | boolean }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  helpText?: string;
}

export interface ModelParameterSchema {
  version: string;
  fields: ModelParameterField[];
}

export interface AppModelConfig {
  id: string;
  modelId: string;
  providerModel: string;
  provider: string;
  configuredProvider: string;
  routeProvider: string;
  providerDisplayName: string;
  name: string;
  description?: string;
  type?: ModelType;
  capabilities: string[];
  supportedModes: string[];
  supportedAspectRatios?: string[];
  supportedDurations?: number[];
  requiredInputs: string[];
  modelCategory?: 'generation' | 'edit' | 'action';
  maxResolution?: string;
  maxDuration?: number;
  defaultParams?: Record<string, unknown>;
  parameterSchema: ModelParameterSchema;
  pricing?: PricingRule | null;
  isActive: boolean;
  disabledReason?: string;
  fallbackProvider?: string;
  fallbackModelId?: string;
  keyScope?: string;
}

export interface AppBootstrapConfig {
  configVersion: string;
  generatedAt: string;
  sections: AppSectionConfig[];
  featureFlags: Record<string, boolean>;
  providers: Array<{
    id: string;
    name: string;
    displayName: string;
    supportedModes: string[];
    modelCount: number;
    activeModelCount: number;
  }>;
  models: AppModelConfig[];
  pointsPolicy: Record<string, number>;
  pointsDefinitions: typeof CONFIG_DEFINITIONS;
  pointsDefaults: typeof DEFAULT_VALUES;
  inviteRewardPolicy: Awaited<ReturnType<typeof getInviteConfig>>;
  rechargePackages: RechargePackage[];
  pricingRules: PricingRule[];
}

interface ProviderRow {
  provider: string;
  name: string;
  displayName: string | null;
  endpoint?: string | null;
  isActive: boolean;
  config: string | null;
}

const TEXT_CAPABILITIES = ['chat', 'text', 'text-generation', 'prompt-optimization'];
const AUDIO_TTS_CAPABILITIES = ['text-to-audio', 'audio-generation', 'tts'];

const BUILTIN_PROVIDER_MODELS: Record<string, Array<Record<string, any>>> = {
  apipaths: [
    {
      id: 'apipaths',
      name: '默认快速 · GPT-5.4 Mini',
      description: '文本生成与提示词优化默认快速通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: TEXT_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.7 },
    },
    {
      id: 'apipaths-gpt-5.5',
      name: '专业质量 · GPT-5.5',
      description: '高质量文本生成、脚本拆解与提示词优化通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: [...TEXT_CAPABILITIES, 'reasoning'],
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.65 },
    },
    {
      id: 'apipaths-gpt-5.6-terra',
      name: 'GPT-5.6 Terra',
      description: 'AI 海报默认通用推理与提示词优化通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: [...TEXT_CAPABILITIES, 'reasoning'],
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.65 },
    },
    {
      id: 'apipaths-gpt-5.6-Terra',
      name: 'GPT-5.6 Terra+',
      description: '增强推理与高质量复杂创作通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: [...TEXT_CAPABILITIES, 'reasoning'],
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.65 },
    },
    {
      id: 'apipaths-gpt-5.6-sol',
      name: 'GPT-5.6 Sol',
      description: '短需求与快速提示词整理通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: TEXT_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.7 },
    },
  ],
  deepseek: [
    {
      id: 'deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      description: '结构化文本、剧本拆解与复杂推理通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: [...TEXT_CAPABILITIES, 'reasoning'],
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.55 },
    },
    {
      id: 'deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      description: '快速文本生成与轻量提示词优化通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: TEXT_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.6 },
    },
  ],
  // 已废弃 (2026-07-18): zhipu provider 已下线（GLM-4 Plus / GLM-5.1 文字通道无额度）
  sensenova: [
    {
      id: 'sensenova-6.7-flash-lite',
      name: 'SenseNova 6.7 Flash Lite',
      description: '轻量文本生成与提示词优化通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: TEXT_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.6 },
    },
    {
      id: 'deepseek-v4-flash',
      name: 'DeepSeek V4 Flash · SenseNova',
      description: '通过 SenseNova 配置路由的 DeepSeek Flash 文本通道',
      type: 'text',
      supportedModes: TEXT_CAPABILITIES,
      capabilities: TEXT_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.6 },
    },
  ],
  stepfun: [
    {
      id: 'stepaudio-2.5-tts',
      name: 'StepAudio 2.5 TTS',
      description: 'StepFun 文本转语音默认配音通道',
      type: 'audio',
      supportedModes: ['text-to-audio', 'audio-generation'],
      capabilities: AUDIO_TTS_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { voiceId: 'cixingnansheng', speed: 1, format: 'mp3' },
    },
    {
      id: 'step-tts-mini',
      name: 'Step TTS Mini',
      description: 'StepFun 轻量文本转语音通道',
      type: 'audio',
      supportedModes: ['text-to-audio', 'audio-generation'],
      capabilities: AUDIO_TTS_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { voiceId: 'cixingnansheng', speed: 1, format: 'mp3' },
    },
    {
      id: 'step-tts-2',
      name: 'Step TTS 2',
      description: 'StepFun 高质量文本转语音通道',
      type: 'audio',
      supportedModes: ['text-to-audio', 'audio-generation'],
      capabilities: AUDIO_TTS_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { voiceId: 'cixingnansheng', speed: 1, format: 'mp3' },
    },
    {
      id: 'stepaudio-2.5-chat',
      name: 'StepAudio 2.5 Chat',
      description: 'StepFun 音频与文本对话通道',
      type: 'text',
      supportedModes: ['chat', 'text', 'text-generation', 'audio-chat'],
      capabilities: ['chat', 'text-generation', 'audio-chat'],
      requiredInputs: ['prompt'],
      defaultParams: { temperature: 0.6 },
    },
    {
      id: 'stepaudio-2.5-asr',
      name: 'StepAudio 2.5 ASR',
      description: 'StepFun 语音识别通道',
      type: 'audio',
      modelCategory: 'action',
      supportedModes: ['speech-to-text'],
      capabilities: ['speech-to-text', 'asr'],
      requiredInputs: ['audio'],
    },
  ],
  minimax: [
    {
      id: 'speech-2.8-hd',
      name: 'MiniMax Speech 2.8 HD',
      description: 'MiniMax 高清文本转语音通道',
      type: 'audio',
      supportedModes: ['text-to-audio', 'audio-generation'],
      capabilities: AUDIO_TTS_CAPABILITIES,
      requiredInputs: ['prompt'],
      defaultParams: { speed: 1, format: 'mp3' },
    },
    {
      id: 'music-2.6',
      name: 'MiniMax Music 2.6',
      description: 'MiniMax 音乐生成通道',
      type: 'music',
      supportedModes: ['music-generation'],
      capabilities: ['music-generation'],
      requiredInputs: ['prompt'],
    },
    {
      id: 'lyrics_generation',
      name: 'MiniMax Lyrics Generation',
      description: 'MiniMax 歌词生成通道',
      type: 'music',
      supportedModes: ['lyrics-generation'],
      capabilities: ['lyrics-generation'],
      requiredInputs: ['prompt'],
    },
  ],
  // 已废弃 (2026-07-18): xunfei provider 文字通道 (spark-x2 / spark-x15) 已下线
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function inferModelType(model: Record<string, any>, supportedModes: string[] = []): ModelType {
  if (model.type) return model.type;
  const id = String(model.id || model.modelId || '').toLowerCase();
  const modes = supportedModes.map((mode) => mode.toLowerCase()).join(',');
  if (id.includes('music') || id.includes('lyrics')) return 'music';
  if (id.includes('tts') || id.includes('speech') || id.includes('audio') || id.includes('asr')) return 'audio';
  if (
    id.includes('video') ||
    id.includes('seedance') ||
    id.includes('vidu') ||
    id.includes('sora') ||
    id.includes('veo') ||
    id.includes('kling') ||
    id.includes('wan2.6_video') ||
    modes.includes('video')
  ) {
    return 'video';
  }
  if (modes.includes('text') && !modes.includes('image')) return 'text';
  return 'image';
}

function normalizeModel(model: string | Record<string, any>): Record<string, any> {
  return typeof model === 'string' ? { id: model, name: model } : { ...model };
}

function mergeProviderModels(providerId: string, configuredModels: any[]): any[] {
  const merged = [...configuredModels];
  const seen = new Set(
    configuredModels
      .map((model) => normalizeModel(model))
      .map((model) => String(model.id || model.modelId || '').trim())
      .filter(Boolean)
  );

  for (const builtin of BUILTIN_PROVIDER_MODELS[providerId] || []) {
    const modelId = String(builtin.id || builtin.modelId || '').trim();
    if (!modelId || seen.has(modelId)) continue;
    merged.push(builtin);
    seen.add(modelId);
  }

  return merged;
}

function getModelKey(provider: string, modelId: string): string {
  return `${provider}:${modelId}`;
}

function normalizeChannelValue(value?: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function getMediaType(value?: unknown): ModelMediaType | undefined {
  return value === 'image' || value === 'video' ? value : undefined;
}

function scoreChannelMatch(channel: ModelChannel, provider: string, modelId: string): number {
  const normalizedProvider = normalizeChannelValue(provider);
  const normalizedModel = normalizeChannelValue(modelId);
  const providerMatches = normalizeChannelValue(channel.provider) === normalizedProvider
    || normalizeChannelValue(channel.id).startsWith(`${normalizedProvider}:`);

  if (!providerMatches || !normalizedModel) return 0;

  if (normalizeChannelValue(channel.modelId) === normalizedModel) return 120;
  if (normalizeChannelValue(channel.providerModel) === normalizedModel) return 100;

  const aliasKeys = (channel.aliases || []).map(normalizeChannelValue);
  if (aliasKeys.includes(normalizedModel)) return 60;

  return 0;
}

function findCatalogChannel(
  provider: string,
  modelId: string,
  preferredMediaType?: ModelMediaType
): ModelChannel | undefined {
  const candidates = getModelChannels(preferredMediaType)
    .map((channel) => ({ channel, score: scoreChannelMatch(channel, provider, modelId) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.channel;
}

function toOption(value: string | number | boolean): { label: string; value: string | number | boolean } {
  return { label: String(value), value };
}

function inferSupportedDurations(model: Record<string, any>): number[] | undefined {
  const explicit = model.supportedDurations;
  if (Array.isArray(explicit)) {
    return explicit.map((duration) => Number(duration)).filter((duration) => Number.isFinite(duration) && duration > 0);
  }

  const duration = Number(model.defaultParams?.duration || model.defaultParams?.durationSeconds);
  const maxDuration = Number(model.maxDuration || duration || 0);
  const base = [3, 5, 8, 10, 15, 30].filter((item) => !maxDuration || item <= maxDuration);
  return base.length ? base : undefined;
}

function deriveParameterSchema(model: AppModelConfig): ModelParameterSchema {
  const fields: ModelParameterField[] = [];
  const requiredInputs = new Set(model.requiredInputs || []);
  const type = model.type || 'image';

  if (requiredInputs.size > 0 && model.modelCategory === 'action') {
    for (const key of requiredInputs) {
      fields.push({
        key,
        label: key,
        type: key.toLowerCase().includes('image') ? 'image' : key.toLowerCase().includes('video') ? 'file' : 'text',
        required: true,
      });
    }
    return { version: '1.0', fields };
  }

  fields.push({
    key: 'prompt',
    label: type === 'audio' ? '文本' : '提示词',
    type: 'textarea',
    required: !requiredInputs.has('image') && !requiredInputs.has('audio'),
    defaultValue: model.defaultParams?.prompt || '',
  });

  if (type === 'text') {
    fields.push({
      key: 'systemPrompt',
      label: '系统提示词',
      type: 'textarea',
      defaultValue: model.defaultParams?.systemPrompt || '',
    });
    fields.push({
      key: 'temperature',
      label: '创造性',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
      defaultValue: model.defaultParams?.temperature ?? 0.7,
    });
    return { version: '1.0', fields };
  }

  if (type === 'audio') {
    if (requiredInputs.has('audio') && !requiredInputs.has('prompt')) {
      return {
        version: '1.0',
        fields: [{
          key: 'audio',
          label: '音频文件',
          type: 'file',
          required: true,
        }],
      };
    }

    fields.push({
      key: 'voiceId',
      label: '音色',
      type: 'text',
      defaultValue: model.defaultParams?.voiceId || 'cixingnansheng',
    });
    fields.push({
      key: 'speed',
      label: '语速',
      type: 'slider',
      min: 0.5,
      max: 2,
      step: 0.1,
      defaultValue: model.defaultParams?.speed ?? 1,
    });
    fields.push({
      key: 'format',
      label: '格式',
      type: 'select',
      defaultValue: model.defaultParams?.format || 'mp3',
      options: ['mp3', 'wav', 'flac', 'opus', 'pcm'].map(toOption),
    });
    return { version: '1.0', fields };
  }

  if (type === 'image' || type === 'both') {
    const aspectRatios = model.supportedAspectRatios?.length ? model.supportedAspectRatios : ['1:1', '3:4', '4:3', '16:9', '9:16'];
    fields.push({
      key: 'aspectRatio',
      label: '图片比例',
      type: 'select',
      required: true,
      defaultValue: model.defaultParams?.aspectRatio || aspectRatios[0],
      options: aspectRatios.map(toOption),
    });
    fields.push({
      key: 'imageCount',
      label: '生成数量',
      type: 'number',
      min: 1,
      max: 8,
      step: 1,
      defaultValue: model.defaultParams?.imageCount || 1,
    });
  }

  if (type === 'video' || type === 'both') {
    const durations = model.supportedDurations?.length ? model.supportedDurations : [5, 10];
    fields.push({
      key: 'duration',
      label: '视频时长',
      type: 'select',
      required: true,
      defaultValue: model.defaultParams?.duration || durations[0],
      options: durations.map((duration) => ({ label: `${duration}秒`, value: duration })),
    });
    const aspectRatios = model.supportedAspectRatios?.length ? model.supportedAspectRatios : ['16:9', '9:16', '1:1'];
    fields.push({
      key: 'aspectRatio',
      label: '视频比例',
      type: 'select',
      defaultValue: model.defaultParams?.aspectRatio || aspectRatios[0],
      options: aspectRatios.map(toOption),
    });
    fields.push({
      key: 'resolution',
      label: '清晰度',
      type: 'select',
      defaultValue: model.defaultParams?.resolution || '720p',
      options: ['720p', '1080p'].map(toOption),
    });
  }

  if (requiredInputs.has('image') || model.supportedModes.some((mode) => mode.includes('image_to'))) {
    fields.push({
      key: 'image',
      label: '参考图',
      type: 'image',
      required: requiredInputs.has('image'),
    });
  }

  return { version: '1.0', fields };
}

async function getSystemJson<T>(key: string, fallback: T): Promise<T> {
  const config = await prisma.systemConfig.findUnique({ where: { key }, select: { value: true } });
  return parseJson<T>(config?.value, fallback);
}

async function saveSystemJson(key: string, value: unknown, description: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: JSON.stringify(value), description },
    create: { key, value: JSON.stringify(value), description },
  });
}

export const DEFAULT_APP_SECTIONS: AppSectionConfig[] = [
  { id: 'home', name: '首页', area: 'home', route: '/', enabled: true, order: 10, requiredRole: 'guest' },
  { id: 'workspace', name: '创作工作台', area: 'workspace', route: '/workspace', enabled: true, order: 20, requiredRole: 'user' },
  { id: 'canvas-nodes', name: '画布节点面板', area: 'canvas', enabled: true, order: 30, requiredRole: 'user' },
  { id: 'models', name: '模型广场', area: 'workspace', route: '/models', enabled: true, order: 40, requiredRole: 'guest' },
  { id: 'membership', name: '会员与充值', area: 'membership', route: '/membership', enabled: true, order: 50, requiredRole: 'guest' },
  { id: 'admin-config', name: '应用配置中心', area: 'admin', route: '/admin', enabled: true, order: 60, requiredRole: 'admin' },
];

export async function getConfigVersion(): Promise<string> {
  const config = await prisma.systemConfig.findUnique({ where: { key: APP_CONFIG_VERSION_KEY }, select: { value: true } });
  return config?.value || 'local-draft-1';
}

export async function bumpConfigVersion(): Promise<string> {
  const version = `cfg_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  await prisma.systemConfig.upsert({
    where: { key: APP_CONFIG_VERSION_KEY },
    update: { value: version, description: '应用配置中心版本号' },
    create: { key: APP_CONFIG_VERSION_KEY, value: version, description: '应用配置中心版本号' },
  });
  return version;
}

export async function getAppSections(): Promise<AppSectionConfig[]> {
  const sections = await getSystemJson<AppSectionConfig[]>(APP_SECTIONS_CONFIG_KEY, DEFAULT_APP_SECTIONS);
  return sections.map((section, index) => ({
    ...section,
    enabled: section.enabled !== false,
    order: Number.isFinite(Number(section.order)) ? Number(section.order) : index * 10,
  })).sort((a, b) => a.order - b.order);
}

export async function saveAppSections(sections: AppSectionConfig[]): Promise<AppSectionConfig[]> {
  const normalized = sections.map((section, index) => ({
    ...section,
    id: section.id.trim(),
    name: section.name.trim(),
    enabled: section.enabled !== false,
    order: Number.isFinite(Number(section.order)) ? Number(section.order) : index * 10,
  }));
  await saveSystemJson(APP_SECTIONS_CONFIG_KEY, normalized, '前端板块显隐、排序和入口配置');
  await bumpConfigVersion();
  return normalized;
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  return getSystemJson<Record<string, boolean>>(FEATURE_FLAGS_CONFIG_KEY, {
    backendDrivenModels: true,
    backendDrivenRechargePackages: true,
    backendDrivenNodeParameters: true,
    hideDisabledModels: true,
  });
}

export async function saveFeatureFlags(flags: Record<string, boolean>): Promise<Record<string, boolean>> {
  const normalized = Object.fromEntries(Object.entries(flags).map(([key, value]) => [key, Boolean(value)]));
  await saveSystemJson(FEATURE_FLAGS_CONFIG_KEY, normalized, '前端功能开关配置');
  await bumpConfigVersion();
  return normalized;
}

async function getStoredParameterSchemas(): Promise<Record<string, ModelParameterSchema>> {
  return getSystemJson<Record<string, ModelParameterSchema>>(MODEL_PARAMETER_SCHEMA_CONFIG_KEY, {});
}

async function saveStoredParameterSchemas(schemas: Record<string, ModelParameterSchema>): Promise<void> {
  await saveSystemJson(MODEL_PARAMETER_SCHEMA_CONFIG_KEY, schemas, '模型参数 schema 配置');
  await bumpConfigVersion();
}

async function getPricingRules(): Promise<PricingRule[]> {
  const providerConfig = await prisma.providerConfig.findUnique({
    where: { provider: PRICING_RULES_PROVIDER },
    select: { config: true },
  });

  const parsed = parseJson<{ pricingRules?: PricingRule[] }>(providerConfig?.config, {});
  return Array.isArray(parsed.pricingRules) ? parsed.pricingRules : [];
}

async function savePricingRules(rules: PricingRule[]): Promise<void> {
  await prisma.providerConfig.upsert({
    where: { provider: PRICING_RULES_PROVIDER },
    update: {
      config: JSON.stringify({ pricingRules: rules }),
      isActive: true,
      name: '系统积分定价规则',
      displayName: '系统积分定价规则',
    },
    create: {
      provider: PRICING_RULES_PROVIDER,
      name: '系统积分定价规则',
      displayName: '系统积分定价规则',
      config: JSON.stringify({ pricingRules: rules }),
      isActive: true,
    },
  });
  invalidatePricingCache();
  await bumpConfigVersion();
}

function findPricingRule(rules: PricingRule[], type: ModelType | undefined, modelId: string, provider: string): PricingRule | null {
  const taskType = type === 'audio' || type === 'music' || type === 'video' || type === 'text' ? type : 'image';
  return rules.find((rule) => rule.taskType === taskType && rule.model === modelId && rule.provider === provider)
    || rules.find((rule) => rule.taskType === taskType && rule.model === modelId && !rule.provider)
    || null;
}

export async function getModelCatalog(options?: {
  includeInactive?: boolean;
  membershipLevel?: string | null;
}): Promise<{ providers: AppBootstrapConfig['providers']; models: AppModelConfig[]; pricingRules: PricingRule[] }> {
  const membershipLevel = normalizeMembershipLevel(options?.membershipLevel) as MembershipLevel;
  const includeInactive = options?.includeInactive === true;
  const where = includeInactive ? { NOT: { provider: PRICING_RULES_PROVIDER } } : { isActive: true, NOT: { provider: PRICING_RULES_PROVIDER } };
  const providers = await prisma.providerConfig.findMany({
    where,
    select: {
      provider: true,
      name: true,
      displayName: true,
      endpoint: true,
      isActive: true,
      config: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  const activeProviderNames = new Set(providers.filter((provider) => provider.isActive).map((provider) => provider.provider));
  const parameterSchemas = await getStoredParameterSchemas();
  const pricingRules = await getPricingRules();
  const models: AppModelConfig[] = [];

  for (const provider of providers as ProviderRow[]) {
    const config = parseJson<Record<string, any>>(provider.config, {});
    const providerSupportedModes = Array.isArray(config.supportedModes) ? config.supportedModes.filter((mode: unknown): mode is string => typeof mode === 'string') : [];
    const configuredModels = Array.isArray(config.models) ? config.models : [];
    const modelList = mergeProviderModels(provider.provider, configuredModels);

    if (!includeInactive && !isProviderAllowedForMembership(provider.provider, membershipLevel)) {
      continue;
    }

    for (const rawModel of modelList) {
      const modelObj = normalizeModel(rawModel);
      const modelId = String(modelObj.id || modelObj.modelId || '').trim();
      if (!modelId) continue;
      const modelActive = modelObj.isActive !== false && provider.isActive;
      if (!includeInactive && !modelActive) continue;
      if (!includeInactive && !isModelAllowedForMembership(modelObj, membershipLevel)) continue;

      const explicitMediaType = getMediaType(modelObj.type);
      const channel = findCatalogChannel(provider.provider, modelId, explicitMediaType);
      const inferredModelType = inferModelType(modelObj, modelObj.supportedModes || providerSupportedModes);
      const modelType = channel?.mediaType || inferredModelType;
      const routeProvider = channel?.provider || modelObj.routeProvider || provider.provider;
      const providerModel = channel?.providerModel || modelObj.providerModel || modelId;
      const routeProviderAvailable = activeProviderNames.has(routeProvider);
      const disabledReason =
        modelObj.disabledReason ||
        channel?.disabledReason ||
        (!routeProviderAvailable ? `AI 服务商 ${routeProvider} 未启用` : undefined);
      const supportedModes = channel?.supportedModes || modelObj.supportedModes || providerSupportedModes || [];
      const capabilities = channel?.capabilities || modelObj.capabilities || supportedModes || [];
      const key = getModelKey(provider.provider, modelId);
      const baseModel: AppModelConfig = {
        id: `${provider.provider}_${modelId}`,
        modelId,
        providerModel,
        provider: routeProvider,
        configuredProvider: provider.provider,
        routeProvider,
        providerDisplayName: provider.displayName || provider.name || provider.provider,
        name: modelObj.name || modelId,
        description: modelObj.description,
        type: channel?.mediaType || modelType,
        capabilities,
        supportedModes,
        supportedAspectRatios: modelObj.supportedAspectRatios,
        supportedDurations: inferSupportedDurations(modelObj),
        requiredInputs: channel?.requiredInputs || modelObj.requiredInputs || [],
        modelCategory: channel?.category || modelObj.modelCategory,
        maxResolution: modelObj.maxResolution,
        maxDuration: modelObj.maxDuration,
        defaultParams: modelObj.defaultParams || {},
        parameterSchema: parameterSchemas[key] || parameterSchemas[modelId] || { version: '1.0', fields: [] },
        pricing: findPricingRule(pricingRules, channel?.mediaType || modelType, modelId, routeProvider),
        isActive: modelActive && channel?.enabled !== false && routeProviderAvailable && !disabledReason,
        disabledReason,
        fallbackProvider: channel?.fallbackProvider || modelObj.fallbackProvider,
        fallbackModelId: channel?.fallbackModelId || modelObj.fallbackModelId,
        keyScope: channel?.keyScope || modelObj.keyScope,
      };
      baseModel.parameterSchema = baseModel.parameterSchema.fields.length > 0 ? baseModel.parameterSchema : deriveParameterSchema(baseModel);
      models.push(baseModel);
    }
  }

  const providerSummaries = providers.map((provider) => {
    const config = parseJson<Record<string, any>>(provider.config, {});
    const providerModels = models.filter((model) => model.configuredProvider === provider.provider);
    const supportedModes = Array.from(new Set([
      ...(Array.isArray(config.supportedModes) ? config.supportedModes : []),
      ...providerModels.flatMap((model) => model.supportedModes || []),
    ].filter((mode): mode is string => typeof mode === 'string' && mode.length > 0)));
    return {
      id: provider.provider,
      name: provider.name,
      displayName: provider.displayName || provider.name || provider.provider,
      supportedModes,
      modelCount: providerModels.length,
      activeModelCount: providerModels.filter((model) => model.isActive).length,
    };
  });

  return { providers: providerSummaries, models, pricingRules };
}

export async function getAppBootstrap(membershipLevel?: string | null): Promise<AppBootstrapConfig> {
  const [configVersion, sections, featureFlags, modelCatalog, pointsPolicy, inviteRewardPolicy, rechargePackages] = await Promise.all([
    getConfigVersion(),
    getAppSections(),
    getFeatureFlags(),
    getModelCatalog({ membershipLevel }),
    getPointsConfig(),
    getInviteConfig(),
    getRechargePackages(),
  ]);

  return {
    configVersion,
    generatedAt: new Date().toISOString(),
    sections,
    featureFlags,
    providers: modelCatalog.providers,
    models: modelCatalog.models,
    pointsPolicy,
    pointsDefinitions: CONFIG_DEFINITIONS,
    pointsDefaults: DEFAULT_VALUES,
    inviteRewardPolicy,
    rechargePackages,
    pricingRules: modelCatalog.pricingRules,
  };
}

export async function upsertModelInProvider(providerId: string, payload: Record<string, any>): Promise<AppModelConfig | null> {
  const modelId = String(payload.modelId || payload.id || '').trim();
  if (!providerId || !modelId) {
    throw new Error('provider 和 modelId 不能为空');
  }

  const provider = await prisma.providerConfig.findUnique({ where: { provider: providerId } });
  const currentConfig = parseJson<Record<string, any>>(provider?.config, {});
  const currentModels = Array.isArray(currentConfig.models) ? currentConfig.models.map(normalizeModel) : [];
  const index = currentModels.findIndex((model) => String(model.id || model.modelId) === modelId);
  const nextModel = {
    ...(index >= 0 ? currentModels[index] : {}),
    ...payload,
    id: modelId,
    modelId: undefined,
    isActive: payload.isActive !== false,
  };
  delete nextModel.modelId;

  if (index >= 0) {
    currentModels[index] = nextModel;
  } else {
    currentModels.push(nextModel);
  }

  const nextConfig = { ...currentConfig, models: currentModels };

  await prisma.providerConfig.upsert({
    where: { provider: providerId },
    update: {
      config: JSON.stringify(nextConfig),
      displayName: payload.providerDisplayName || provider?.displayName || providerId,
      isActive: provider?.isActive ?? false,
    },
    create: {
      provider: providerId,
      name: payload.providerName || providerId,
      displayName: payload.providerDisplayName || providerId,
      description: payload.providerDescription || `Provider: ${providerId}`,
      isActive: false,
      config: JSON.stringify(nextConfig),
    },
  });

  await bumpConfigVersion();
  const catalog = await getModelCatalog({ includeInactive: true, membershipLevel: 'enterprise' });
  return catalog.models.find((model) => model.configuredProvider === providerId && model.modelId === modelId) || null;
}

export async function setModelStatus(providerId: string, modelId: string, isActive: boolean, disabledReason?: string): Promise<AppModelConfig | null> {
  return upsertModelInProvider(providerId, {
    modelId,
    isActive,
    ...(disabledReason !== undefined ? { disabledReason } : {}),
  });
}

export async function archiveModel(providerId: string, modelId: string): Promise<AppModelConfig | null> {
  return upsertModelInProvider(providerId, {
    modelId,
    isActive: false,
    archived: true,
    disabledReason: '已在应用配置中心下架',
  });
}

export async function saveModelParameterSchema(providerId: string, modelId: string, schema: ModelParameterSchema): Promise<ModelParameterSchema> {
  const schemas = await getStoredParameterSchemas();
  const normalized: ModelParameterSchema = {
    version: schema.version || '1.0',
    fields: Array.isArray(schema.fields) ? schema.fields : [],
  };
  schemas[getModelKey(providerId, modelId)] = normalized;
  await saveStoredParameterSchemas(schemas);
  return normalized;
}

export async function updateModelPricing(providerId: string, modelId: string, payload: {
  taskType: PricingRule['taskType'];
  pointsCost: number;
  isActive?: boolean;
  note?: string;
}): Promise<PricingRule> {
  const rules = await getPricingRules();
  const existingIndex = rules.findIndex((rule) => rule.provider === providerId && rule.model === modelId && rule.taskType === payload.taskType);
  const nextRule: PricingRule = {
    id: existingIndex >= 0 ? rules[existingIndex].id : `pricing_${Date.now()}`,
    taskType: payload.taskType,
    provider: providerId,
    model: modelId,
    pointsCost: Math.max(0, Math.floor(payload.pointsCost)),
    isActive: payload.isActive !== false,
    effectiveAt: new Date().toISOString(),
    note: payload.note,
  };
  if (existingIndex >= 0) {
    rules[existingIndex] = nextRule;
  } else {
    rules.push(nextRule);
  }
  await savePricingRules(rules);
  return nextRule;
}

export async function savePointsPolicy(values: Record<string, number>): Promise<Record<string, number>> {
  await savePointsConfig(values);
  invalidatePointsConfigCache();
  await bumpConfigVersion();
  return getPointsConfig();
}

export async function saveRechargePackageList(packages: RechargePackage[]): Promise<RechargePackage[]> {
  await saveRechargePackages(packages);
  await bumpConfigVersion();
  return getRechargePackages();
}

export async function publishSnapshot(adminId: string): Promise<{ version: string; snapshotCount: number }> {
  const snapshot = await getAppBootstrap('enterprise');
  const currentSnapshots = await getSystemJson<Array<Record<string, unknown>>>(APP_CONFIG_SNAPSHOTS_KEY, []);
  const nextSnapshots = [
    { adminId, createdAt: new Date().toISOString(), snapshot },
    ...currentSnapshots,
  ].slice(0, 10);
  await saveSystemJson(APP_CONFIG_SNAPSHOTS_KEY, nextSnapshots, '应用配置发布快照');
  const version = await bumpConfigVersion();
  return { version, snapshotCount: nextSnapshots.length };
}

export async function resetRechargePackages(): Promise<RechargePackage[]> {
  await saveRechargePackages(DEFAULT_RECHARGE_PACKAGES);
  await bumpConfigVersion();
  return DEFAULT_RECHARGE_PACKAGES;
}
