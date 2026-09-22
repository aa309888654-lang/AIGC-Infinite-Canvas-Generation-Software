import {
  clipIntelligenceService,
  type ClipIntelligenceReport,
} from './clip-intelligence-service';
import {
  creativeToolRegistry,
  type CreativeToolName,
} from './creative-tool-registry';
import {
  styleSkillsLibrary,
  type StyleSkill,
  type StyleSkillToolCall,
} from './style-skills-library';
import {
  creativeReflectionService,
  type CreativeReflectionResult,
} from './creative-reflection-service';
import type { CreativeMood, TimelinePlan } from './timeline-plan-service';

export interface CreativeDirectorRequest {
  prompt: string;
  skillId?: string;
  maxToolCalls?: number;
}

export interface CreativeDirectorStep {
  id: string;
  title: string;
  detail: string;
  toolName?: CreativeToolName;
}

export interface CreativeDirectorResult {
  id: string;
  prompt: string;
  report: ClipIntelligenceReport;
  mood: CreativeMood;
  skill?: StyleSkill;
  toolCalls: StyleSkillToolCall[];
  plans: TimelinePlan[];
  reflection: CreativeReflectionResult;
  steps: CreativeDirectorStep[];
  summary: string;
}

const createRunId = () => `creative_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function inferMood(prompt: string, report: ClipIntelligenceReport): CreativeMood {
  const text = prompt.toLowerCase();
  if (/cyber|赛博|霓虹|neon/.test(text)) return 'cyberpunk';
  if (/product|产品|商业|卖点|展示/.test(text)) return 'product';
  if (/clean|清透|干净|教学|教程|口播/.test(text)) return 'clean';
  if (/warm|暖|日落|golden/.test(text)) return 'warm';
  if (/cinematic|电影|vlog|故事|旅行/.test(text)) return 'cinematic';
  if (/dynamic|动感|节奏|快|爆|短剧|反转/.test(text)) return 'dynamic';
  if (/calm|安静|舒缓|慢/.test(text)) return 'calm';
  return (report.summary.dominantMood as CreativeMood) || 'neutral';
}

function inferTitle(prompt: string, mood: CreativeMood): string {
  const titleMatch = prompt.match(/(?:标题|片头|title)[:：]\s*([^\n，,。]+)/i);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim().slice(0, 24);

  switch (mood) {
    case 'cyberpunk':
      return 'NEON CUT';
    case 'product':
      return '核心亮点';
    case 'clean':
      return '重点速览';
    case 'cinematic':
      return 'Cinematic Story';
    case 'dynamic':
      return '剧情高光';
    default:
      return '今日重点';
  }
}

function includesAny(prompt: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(prompt));
}

function dedupeToolCalls(toolCalls: StyleSkillToolCall[]): StyleSkillToolCall[] {
  const seen = new Set<CreativeToolName>();
  return toolCalls.filter((call) => {
    if (seen.has(call.name)) return false;
    seen.add(call.name);
    return true;
  });
}

function createDefaultToolCalls(
  prompt: string,
  report: ClipIntelligenceReport,
  mood: CreativeMood
): StyleSkillToolCall[] {
  const calls: StyleSkillToolCall[] = [];
  const wantsAudio = includesAny(prompt, [/音频|声音|降噪|清理|口播|audio/i]);
  const wantsTransition = includesAny(prompt, [/转场|衔接|节奏|transition/i]);
  const wantsVisualOnly = includesAny(prompt, [/调色|lut|特效|贴纸|花字|包装|赛博|电影|产品/i]);

  if (report.visualItems.length > 0) {
    calls.push({ name: 'apply_lut_chain', params: { mood, style: prompt, intensity: 0.86 } });
    calls.push({ name: 'apply_effect_stack', params: { mood, style: prompt, maxClips: 8 } });
    calls.push({
      name: 'apply_text_overlay',
      params: { mood, style: prompt, title: inferTitle(prompt, mood), maxCallouts: 3 },
    });
    calls.push({ name: 'apply_sticker', params: { mood, style: prompt, maxStickers: 3 } });
  }

  if ((wantsTransition || !wantsVisualOnly) && report.visualItems.length >= 2) {
    calls.push({ name: 'apply_transition', params: { transitionType: mood === 'product' ? 'push' : mood === 'dynamic' ? 'wipe' : 'dissolve' } });
  }

  if ((wantsAudio || mood === 'clean') && report.audioItems.length > 0) {
    calls.push({ name: 'apply_audio_cleanup', params: {} });
  }

  if (report.visualItems.length > 0 && includesAny(prompt, [/防抖|稳定|stabil/i])) {
    calls.push({ name: 'apply_stabilization', params: {} });
  }

  return dedupeToolCalls(calls);
}

function buildSteps(
  report: ClipIntelligenceReport,
  toolCalls: StyleSkillToolCall[],
  reflection: CreativeReflectionResult
): CreativeDirectorStep[] {
  return [
    {
      id: 'analyze',
      title: '分析时间线',
      detail: `${report.summary.totalClips} 个片段，${report.summary.visualClips} 个视觉，${report.summary.audioClips} 个音频。`,
    },
    ...toolCalls.map((call, index) => ({
      id: `tool_${index}`,
      title: creativeToolRegistry.get(call.name)?.description ?? call.name,
      detail: JSON.stringify(call.params),
      toolName: call.name,
    })),
    {
      id: 'reflect',
      title: '规则反思',
      detail: reflection.remainingIssues.length > 0
        ? `发现 ${reflection.remainingIssues.length} 个提醒。`
        : '草案动作通过基础校验。',
    },
  ];
}

export class CreativeDirectorAgent {
  async createDraft(request: CreativeDirectorRequest): Promise<CreativeDirectorResult> {
    const report = clipIntelligenceService.analyzeCurrentTimeline();
    if (!report) {
      throw new Error('当前没有可分析的时间线序列。');
    }

    const prompt = request.prompt.trim() || '根据当前时间线生成完整智能包装';
    const selectedSkill =
      (request.skillId ? styleSkillsLibrary.get(request.skillId) : undefined) ??
      styleSkillsLibrary.matchPrompt(prompt);
    const mood = selectedSkill?.mood ?? inferMood(prompt, report);
    const toolCalls = dedupeToolCalls(
      selectedSkill
        ? selectedSkill.toolCalls
        : createDefaultToolCalls(prompt, report, mood)
    ).slice(0, request.maxToolCalls ?? 8);

    const plans: TimelinePlan[] = [];
    for (const call of toolCalls) {
      const tool = creativeToolRegistry.get(call.name);
      if (!tool) continue;
      const plan = await tool.handler(call.params, { report });
      plans.push(plan);
    }

    const reflection = creativeReflectionService.reflectPlans(plans, report);
    const usablePlans = reflection.plans.filter((plan) => plan.actions.length > 0);
    const totalActions = usablePlans.reduce((sum, plan) => sum + plan.actions.length, 0);

    return {
      id: createRunId(),
      prompt,
      report,
      mood,
      skill: selectedSkill,
      toolCalls,
      plans: usablePlans,
      reflection: {
        ...reflection,
        plans: usablePlans,
      },
      steps: buildSteps(report, toolCalls, reflection),
      summary: `生成 ${usablePlans.length} 个可执行草案，共 ${totalActions} 个动作。`,
    };
  }
}

export const creativeDirectorAgent = new CreativeDirectorAgent();
