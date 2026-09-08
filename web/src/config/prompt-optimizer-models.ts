export const PROMPT_OPTIMIZER_MODELS = [
  {
    id: 'auto',
    name: '智能路由',
    model: '自动',
    displayModel: '自动选择高质量文本模型',
    desc: '按质量、速度与稳定性自动选择最合适的推理模型',
    color: 'red',
    credits: 20,
  },
  {
    id: 'deepseek-v4-pro',
    name: '结构',
    model: 'DeepSeek V4 Pro',
    displayModel: '结构推理 · 逻辑拆解',
    desc: '结构严谨，逻辑和镜头拆解强',
    color: 'cyan',
    credits: 30,
  },
  {
    id: 'deepseek-v4-flash',
    name: '快速',
    model: 'DeepSeek V4 Flash',
    displayModel: '快速推理 · 轻量增强',
    desc: '快速补位，适合轻量增强',
    color: 'blue',
    credits: 20,
  },
  {
    id: 'sensenova-6.7-flash-lite',
    name: 'Flash Lite',
    model: 'sensenova-6.7-flash-lite',
    displayModel: '轻量快速 · 256K 上下文',
    desc: '轻量快速，中文理解强，适合长文本提示词整理',
    color: 'amber',
    credits: 20,
  },
  {
    id: 'step-3.7-flash',
    name: 'MoE 推理',
    model: 'step-3.7-flash',
    displayModel: '198B MoE · 256K 上下文',
    desc: '大规模 MoE 推理能力，适合复杂需求拆解与长上下文任务',
    color: 'orange',
    credits: 28,
  },
  {
    id: 'step-3.5-flash',
    name: 'Agent 优化',
    model: 'step-3.5-flash',
    displayModel: 'Agent 任务 · 256K 上下文',
    desc: '适合工具调用、任务规划和长上下文提示词优化',
    color: 'yellow',
    credits: 25,
  },
  {
    id: 'nvidia-deepseek-v4-pro',
    name: '兜底',
    model: 'NVIDIA DeepSeek V4 Pro',
    displayModel: '稳定补位 · 结构推理',
    desc: '稳定补位通道',
    color: 'green',
    credits: 40,
  },
] as const;

export type PromptOptimizerModelId = typeof PROMPT_OPTIMIZER_MODELS[number]['id'];

export const DEFAULT_PROMPT_TEXT_MODEL_ID: PromptOptimizerModelId = 'deepseek-v4-pro';
export const POSTER_PROMPT_TEXT_MODEL_ID: PromptOptimizerModelId = 'auto';
export const POSTER_PROMPT_TEXT_MODEL_NAME = 'DeepSeek V4 Pro / 智能路由';
export const POSTER_IMAGE_MODEL_ID = 'doubao-seedream-5-0-pro';
export const POSTER_IMAGE_MODEL_NAME = '豆包 Seedream 5.0 Pro';

export const PROMPT_TEXT_MODEL_GROUPS = [
  {
    label: '轻量快速',
    models: ['sensenova-6.7-flash-lite', 'deepseek-v4-flash'],
  },
  {
    label: '长上下文与多模态',
    models: ['step-3.7-flash', 'step-3.5-flash'],
  },
  {
    label: '稳定链路',
    // 移除已废弃的 glm-5.1 (provider: zhipu)
    models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'nvidia-deepseek-v4-pro'],
  },
] as const;

export const PROMPT_TEXT_MODEL_LABELS: Record<PromptOptimizerModelId, string> =
  PROMPT_OPTIMIZER_MODELS.reduce((acc, model) => {
    acc[model.id] = model.id === 'auto' ? '智能路由' : `${model.name} · ${model.displayModel}`;
    return acc;
  }, {} as Record<PromptOptimizerModelId, string>);
