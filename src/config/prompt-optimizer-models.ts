export const PROMPT_OPTIMIZER_MODELS = [
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek',
    model: 'DeepSeek V4 Flash',
    displayModel: '快速推理 · 轻量增强',
    desc: '快速文本生成与提示词优化',
    group: 'DeepSeek',
    protocol: 'openai',
    provider: 'prompt-optimizer-deepseek',
    color: 'blue',
    credits: 20,
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek',
    model: 'DeepSeek V4 Pro',
    displayModel: '结构推理 · 复杂拆解',
    desc: '结构严谨，适合复杂提示词优化',
    group: 'DeepSeek',
    protocol: 'openai',
    provider: 'prompt-optimizer-deepseek',
    color: 'cyan',
    credits: 30,
  },
  {
    id: 'gpt-5.5',
    name: 'GPT',
    model: 'GPT-5.5',
    displayModel: '通用创作 · 稳定输出',
    desc: '通用文本生成与提示词优化',
    group: 'GPT',
    protocol: 'openai',
    provider: 'prompt-optimizer-gpt',
    color: 'green',
    credits: 30,
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT',
    model: 'GPT-5.6 Terra',
    displayModel: '专业推理 · 高质量创作',
    desc: '适合复杂创意和高质量提示词优化',
    group: 'GPT',
    protocol: 'openai',
    provider: 'prompt-optimizer-gpt',
    color: 'emerald',
    credits: 35,
  },
  {
    id: 'gpt-5.6-sol',
    name: 'GPT',
    model: 'GPT-5.6 Sol',
    displayModel: '快速响应 · 轻量创作',
    desc: '适合短需求和快速提示词整理',
    group: 'GPT',
    protocol: 'openai',
    provider: 'prompt-optimizer-gpt',
    color: 'teal',
    credits: 25,
  },
  {
    id: 'claude-fable-5',
    name: 'Claude',
    model: 'Claude Fable 5',
    displayModel: '叙事创作 · 风格表达',
    desc: '适合叙事、风格与长文本提示词优化',
    group: 'Claude',
    protocol: 'anthropic',
    provider: 'prompt-optimizer-claude',
    color: 'amber',
    credits: 35,
  },
  {
    id: 'claude-opus-5',
    name: 'Claude',
    model: 'Claude Opus 5',
    displayModel: '深度推理 · 高质量创作',
    desc: '适合复杂语义和高质量提示词优化',
    group: 'Claude',
    protocol: 'anthropic',
    provider: 'prompt-optimizer-claude',
    color: 'orange',
    credits: 40,
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude',
    model: 'Claude Opus 4.8',
    displayModel: '稳定推理 · 长文本整理',
    desc: '适合长文本和专业提示词整理',
    group: 'Claude',
    protocol: 'anthropic',
    provider: 'prompt-optimizer-claude',
    color: 'yellow',
    credits: 35,
  },
  {
    id: 'sensenova-6.8-flash-lite',
    name: 'SenseNova',
    model: 'SenseNova 6.8 Flash Lite',
    displayModel: '高速对话 · 轻量推理',
    desc: 'SenseNova 轻量多模态文本模型，适合图片提示词优化',
    group: 'SenseNova',
    protocol: 'openai',
    provider: 'prompt-optimizer-sensenova',
    color: 'violet',
    credits: 15,
  },
] as const;

export type PromptOptimizerModelId = typeof PROMPT_OPTIMIZER_MODELS[number]['id'];

export const DEFAULT_PROMPT_TEXT_MODEL_ID: PromptOptimizerModelId = 'deepseek-v4-pro';
export const POSTER_PROMPT_TEXT_MODEL_ID: PromptOptimizerModelId = 'deepseek-v4-pro';
export const POSTER_PROMPT_TEXT_MODEL_NAME = 'DeepSeek V4 Pro';
export const POSTER_IMAGE_MODEL_ID = 'doubao-seedream-5-0-pro';
export const POSTER_IMAGE_MODEL_NAME = '豆包 Seedream 5.0 Pro';

export const PROMPT_TEXT_MODEL_GROUPS = [
  {
    label: 'DeepSeek',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  },
  {
    label: 'GPT',
    models: ['gpt-5.5', 'gpt-5.6-terra', 'gpt-5.6-sol'],
  },
  {
    label: 'Claude',
    models: ['claude-fable-5', 'claude-opus-5', 'claude-opus-4-8'],
  },
  {
    label: 'SenseNova',
    models: ['sensenova-6.8-flash-lite'],
  },
] as const;

export const PROMPT_TEXT_MODEL_LABELS: Record<PromptOptimizerModelId, string> =
  PROMPT_OPTIMIZER_MODELS.reduce((acc, model) => {
    acc[model.id] = `${model.name} · ${model.model}`;
    return acc;
  }, {} as Record<PromptOptimizerModelId, string>);
