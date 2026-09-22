import type { ClipIntelligenceReport } from './clip-intelligence-service';
import {
  timelinePlanService,
  type CreativeEffectPlanOptions,
  type CreativeLUTPlanOptions,
  type CreativeStickerPlanOptions,
  type CreativeTextPlanOptions,
  type TimelinePlan,
} from './timeline-plan-service';

export type CreativeToolName =
  | 'apply_lut_chain'
  | 'apply_effect_stack'
  | 'apply_sticker'
  | 'apply_text_overlay'
  | 'apply_transition'
  | 'apply_subtitle'
  | 'apply_audio_cleanup'
  | 'apply_stabilization';

export interface CreativeJSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface CreativeToolContext {
  report: ClipIntelligenceReport;
}

export interface CreativeToolDescriptor {
  name: CreativeToolName;
  description: string;
  parameters: CreativeJSONSchema;
  handler: (params: Record<string, unknown>, context: CreativeToolContext) => Promise<TimelinePlan>;
}

export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: CreativeJSONSchema;
}

export class CreativeToolRegistry {
  private tools = new Map<CreativeToolName, CreativeToolDescriptor>();

  register(tool: CreativeToolDescriptor): void {
    this.tools.set(tool.name, tool);
  }

  get(name: CreativeToolName): CreativeToolDescriptor | undefined {
    return this.tools.get(name);
  }

  list(): CreativeToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  toMCPFormat(): MCPToolSchema[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    }));
  }
}

const moodSchema = {
  type: 'string',
  enum: ['calm', 'dynamic', 'cinematic', 'neutral', 'cyberpunk', 'warm', 'clean', 'product'],
};

export function createDefaultCreativeToolRegistry(): CreativeToolRegistry {
  const registry = new CreativeToolRegistry();

  registry.register({
    name: 'apply_lut_chain',
    description: '为当前时间线视觉片段应用参数驱动调色方案。',
    parameters: {
      type: 'object',
      properties: {
        mood: moodSchema,
        style: { type: 'string' },
        intensity: { type: 'number', minimum: 0, maximum: 1 },
      },
      additionalProperties: false,
    },
    handler: async (params, context) =>
      timelinePlanService.createLUTPlan(context.report, params as CreativeLUTPlanOptions),
  });

  registry.register({
    name: 'apply_effect_stack',
    description: '为视觉片段应用轻量画面特效栈。',
    parameters: {
      type: 'object',
      properties: {
        mood: moodSchema,
        style: { type: 'string' },
        maxClips: { type: 'number', minimum: 1, maximum: 12 },
      },
      additionalProperties: false,
    },
    handler: async (params, context) =>
      timelinePlanService.createEffectPlan(context.report, params as CreativeEffectPlanOptions),
  });

  registry.register({
    name: 'apply_sticker',
    description: '在关键片段上添加智能贴纸。',
    parameters: {
      type: 'object',
      properties: {
        mood: moodSchema,
        style: { type: 'string' },
        maxStickers: { type: 'number', minimum: 1, maximum: 5 },
      },
      additionalProperties: false,
    },
    handler: async (params, context) =>
      timelinePlanService.createStickerPlan(context.report, params as CreativeStickerPlanOptions),
  });

  registry.register({
    name: 'apply_text_overlay',
    description: '创建片头标题和重点花字。',
    parameters: {
      type: 'object',
      properties: {
        mood: moodSchema,
        style: { type: 'string' },
        title: { type: 'string' },
        maxCallouts: { type: 'number', minimum: 0, maximum: 6 },
      },
      additionalProperties: false,
    },
    handler: async (params, context) =>
      timelinePlanService.createTextPlan(context.report, params as CreativeTextPlanOptions),
  });

  registry.register({
    name: 'apply_transition',
    description: '为相邻视觉片段生成智能转场。',
    parameters: {
      type: 'object',
      properties: {
        transitionType: { type: 'string', enum: ['dissolve', 'wipe', 'push'] },
      },
      additionalProperties: false,
    },
    handler: async (params, context) =>
      timelinePlanService.createTransitionPlan(
        context.report,
        typeof params.transitionType === 'string' ? params.transitionType : undefined
      ),
  });

  registry.register({
    name: 'apply_subtitle',
    description: '字幕需通过真实 ASR 字幕入口生成；该工具不再返回草稿字幕计划。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_params, context) => ({
      id: `timeline_plan_subtitle_disabled_${Date.now()}`,
      title: 'AI字幕需真实识别',
      description: '为避免写入假字幕，创意 Agent 不再生成占位字幕；请使用 AI字幕识别入口。',
      createdAt: new Date().toISOString(),
      source: 'ai-subtitle',
      confidence: 0,
      reportSummary: context.report.summary,
      actions: [],
      duration: 0,
      mood: 'neutral' as const,
      scenes: [],
    }),
  });

  registry.register({
    name: 'apply_audio_cleanup',
    description: '为音频片段生成音量整理和清理建议。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_params, context) => timelinePlanService.createAudioCleanupPlan(context.report),
  });

  registry.register({
    name: 'apply_stabilization',
    description: '为视频片段生成防抖标记方案。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_params, context) => timelinePlanService.createStabilizationPlan(context.report),
  });

  return registry;
}

export const creativeToolRegistry = createDefaultCreativeToolRegistry();
