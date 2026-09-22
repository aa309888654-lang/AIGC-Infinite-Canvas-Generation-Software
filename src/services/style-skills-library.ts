import type { CreativeMood } from './timeline-plan-service';
import type { CreativeToolName } from './creative-tool-registry';

export interface StyleSkillToolCall {
  name: CreativeToolName;
  params: Record<string, unknown>;
}

export interface StyleSkill {
  id: string;
  name: string;
  description: string;
  mood: CreativeMood;
  promptHints: string[];
  toolCalls: StyleSkillToolCall[];
}

const STYLE_SKILLS: StyleSkill[] = [
  {
    id: 'cinematic-vlog',
    name: '电影感Vlog',
    description: '电影调色、轻柔特效、片头标题和少量点缀。',
    mood: 'cinematic',
    promptHints: ['电影', 'cinematic', 'vlog', '旅行', '故事'],
    toolCalls: [
      { name: 'apply_lut_chain', params: { mood: 'cinematic', style: '电影感Vlog', intensity: 0.9 } },
      { name: 'apply_effect_stack', params: { mood: 'cinematic', style: '电影感Vlog', maxClips: 8 } },
      { name: 'apply_text_overlay', params: { mood: 'cinematic', style: '电影感Vlog', title: 'Cinematic Story' } },
      { name: 'apply_sticker', params: { mood: 'cinematic', style: '电影感Vlog', maxStickers: 2 } },
      { name: 'apply_transition', params: { transitionType: 'dissolve' } },
    ],
  },
  {
    id: 'talking-head',
    name: '口播教学',
    description: '清透调色、重点花字和音频整理；字幕请使用真实 ASR 入口生成。',
    mood: 'clean',
    promptHints: ['口播', '教学', '知识', '教程', '字幕'],
    toolCalls: [
      { name: 'apply_lut_chain', params: { mood: 'clean', style: '口播教学', intensity: 0.75 } },
      { name: 'apply_text_overlay', params: { mood: 'clean', style: '口播教学', title: '重点速览', maxCallouts: 4 } },
      { name: 'apply_audio_cleanup', params: {} },
    ],
  },
  {
    id: 'product-demo',
    name: '产品介绍',
    description: '干净高对比、产品亮点标题、箭头贴纸和稳定转场。',
    mood: 'product',
    promptHints: ['产品', '商业', '卖点', '介绍', '展示'],
    toolCalls: [
      { name: 'apply_lut_chain', params: { mood: 'product', style: '产品介绍', intensity: 0.82 } },
      { name: 'apply_effect_stack', params: { mood: 'product', style: '产品介绍', maxClips: 6 } },
      { name: 'apply_text_overlay', params: { mood: 'product', style: '产品介绍', title: '核心亮点', maxCallouts: 4 } },
      { name: 'apply_sticker', params: { mood: 'product', style: '产品介绍', maxStickers: 3 } },
      { name: 'apply_transition', params: { transitionType: 'push' } },
    ],
  },
  {
    id: 'short-drama',
    name: '短剧叙事',
    description: '情绪化调色、对白花字、节奏转场和少量视觉强调。',
    mood: 'dynamic',
    promptHints: ['短剧', '剧情', '反转', '对白', '情绪'],
    toolCalls: [
      { name: 'apply_lut_chain', params: { mood: 'dynamic', style: '短剧叙事', intensity: 0.88 } },
      { name: 'apply_effect_stack', params: { mood: 'dynamic', style: '短剧叙事', maxClips: 8 } },
      { name: 'apply_text_overlay', params: { mood: 'dynamic', style: '短剧叙事', title: '剧情高光', maxCallouts: 4 } },
      { name: 'apply_sticker', params: { mood: 'dynamic', style: '短剧叙事', maxStickers: 3 } },
      { name: 'apply_transition', params: { transitionType: 'wipe' } },
    ],
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    description: '霓虹高饱和、故障特效、赛博标题和闪光贴纸。',
    mood: 'cyberpunk',
    promptHints: ['赛博', 'cyber', '霓虹', 'neon', '故障'],
    toolCalls: [
      { name: 'apply_lut_chain', params: { mood: 'cyberpunk', style: '赛博朋克', intensity: 0.95 } },
      { name: 'apply_effect_stack', params: { mood: 'cyberpunk', style: '赛博朋克', maxClips: 10 } },
      { name: 'apply_text_overlay', params: { mood: 'cyberpunk', style: '赛博朋克', title: 'NEON CUT', maxCallouts: 3 } },
      { name: 'apply_sticker', params: { mood: 'cyberpunk', style: '赛博朋克', maxStickers: 3 } },
    ],
  },
];

export class StyleSkillsLibrary {
  list(): StyleSkill[] {
    return STYLE_SKILLS;
  }

  get(id: string): StyleSkill | undefined {
    return STYLE_SKILLS.find((skill) => skill.id === id);
  }

  matchPrompt(prompt: string): StyleSkill | undefined {
    const normalized = prompt.toLowerCase();
    return STYLE_SKILLS.find((skill) =>
      skill.promptHints.some((hint) => normalized.includes(hint.toLowerCase()))
    );
  }
}

export const styleSkillsLibrary = new StyleSkillsLibrary();
