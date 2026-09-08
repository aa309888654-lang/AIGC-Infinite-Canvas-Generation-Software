export interface PromptQualityReport {
  overallScore: number;
  scores: Record<string, number>;
  issues: string[];
  selfRepaired: boolean;
  threshold: number;
}

export interface PromptModelProfile {
  id: string;
  label: string;
  scenario: 'image' | 'video';
  instructions: string[];
}

export interface ProfessionalOptimizationResponse {
  optimizedPrompt: string;
  qualityReport?: PromptQualityReport;
  modelProfile: string;
}

const QUALITY_THRESHOLD = 88;

const normalizeScenario = (scenario?: string): 'image' | 'video' =>
  scenario === 'video' ? 'video' : 'image';

export function resolvePromptModelProfile(
  scenarioInput?: string,
  models: string[] = []
): PromptModelProfile {
  const scenario = normalizeScenario(scenarioInput);
  const modelText = models.join(' ').toLowerCase();
  const id = models[0] || `${scenario}-generic`;

  if (scenario === 'image') {
    if (/gpt[-_ ]?image/.test(modelText)) {
      return {
        id,
        label: '豆包 Seedream 专业图片配置',
        scenario,
        instructions: [
          '使用清晰自然语言描述主体、空间关系、材质、光影和构图，不使用无效权重语法或模型参数堆砌。',
          '涉及海报、标识或画面文字时，明确文字内容、层级、位置和可读性；未要求文字时不要擅自添加。',
          '复杂场景要明确前景、中景、背景及主体之间的位置关系，减少空间歧义。',
        ],
      };
    }
    if (/seedream|doubao|即梦/.test(modelText)) {
      return {
        id,
        label: 'Seedream 专业图片配置',
        scenario,
        instructions: [
          '强化中文语义中的主体特征、镜头视角、构图、光影、色调和材质细节。',
          '使用可执行的视觉描述，避免同义形容词重复和抽象质量词堆砌。',
        ],
      };
    }
    if (/seedream.*edit|doubao.*edit/.test(modelText)) {
      return {
        id,
        label: '参考图编辑专业配置',
        scenario,
        instructions: [
          '优先明确必须保持的主体身份、外观、构图和参考图关系，再描述允许修改的区域与目标效果。',
          '局部编辑使用最小改动原则，禁止无关区域漂移。',
        ],
      };
    }
    if (/flux/.test(modelText)) {
      return {
        id,
        label: 'FLUX 专业图片配置',
        scenario,
        instructions: [
          '突出主体、构图、摄影语言、材质和光线，保持描述紧凑且关键词语义明确。',
          '避免复杂排版文字要求和互相冲突的风格标签。',
        ],
      };
    }
    return {
      id,
      label: '通用专业图片配置',
      scenario,
      instructions: [
        '以主体、场景环境、情绪目标、视觉风格为核心，保留原有构图、光影、色调、镜头、材质和细节优化。',
        '最终内容必须适用于单张静态图片，不混入视频时间轴、转场或帧间连续性结构。',
      ],
    };
  }

  if (/seedance|doubao.*video/.test(modelText)) {
    return {
      id,
      label: 'Seedance 专业视频配置',
      scenario,
      instructions: [
        '按目标时长组织动作起点、发展和结束状态，镜头运动与角色动作必须同步。',
        '强调角色连续性、物理运动合理性、景别变化和节奏，不堆砌无法在时长内完成的事件。',
      ],
    };
  }
  if (/vidu/.test(modelText)) {
    return {
      id,
      label: 'Vidu 专业视频配置',
      scenario,
      instructions: [
        '明确首帧状态、核心动作、运动幅度、运镜方向和结束状态，保持主体身份与参考图一致。',
        '限制同时发生的复杂动作，优先保证动作可执行和画面稳定。',
      ],
    };
  }
  if (/hailuo|minimax|海螺/.test(modelText)) {
    return {
      id,
      label: 'Hailuo 专业视频配置',
      scenario,
      instructions: [
        '强化人物表演、微表情、镜头调度、电影光影和情绪递进。',
        '动作描述要有前后因果，避免瞬移、肢体突变和无动机转场。',
      ],
    };
  }
  if (/kling|可灵/.test(modelText)) {
    return {
      id,
      label: 'Kling 专业视频配置',
      scenario,
      instructions: [
        '强化复杂运动、镜头轨迹、空间关系和物理反馈，同时保持角色与场景连续。',
        '把长动作拆成清晰连续的阶段，避免互相冲突的运动指令。',
      ],
    };
  }
  return {
    id,
    label: '通用专业视频配置',
    scenario,
    instructions: [
      '围绕主体连续动作、场景变化、镜头景别、时间节奏、光影情绪、视觉风格和连续性组织提示词。',
      '最终内容必须适用于视频生成，不得退化成静态图片关键词清单。',
    ],
  };
}

function getContractSchema(scenario: 'image' | 'video'): string {
  if (scenario === 'video') {
    return `{
  "explicitRequirements": ["用户明确要求"],
  "mustPreserve": ["不可改变的主体、设定或参考关系"],
  "hardConstraints": ["禁止项、时长、画幅等硬约束"],
  "inferredDetails": ["为专业完整性合理补全的内容"],
  "video": {
    "subjectAndAction": "主体及连续动作",
    "sceneEvolution": "场景与环境变化",
    "cameraAndShots": "运镜与景别",
    "timelineAndRhythm": "时间顺序与节奏",
    "lightingAndColor": "光影与色调",
    "emotionGoal": "情绪目标",
    "visualStyle": "视觉风格",
    "continuity": "角色、物理和画面连续性"
  }
}`;
  }

  return `{
  "explicitRequirements": ["用户明确要求"],
  "mustPreserve": ["不可改变的主体、设定或参考关系"],
  "hardConstraints": ["禁止项、画幅等硬约束"],
  "inferredDetails": ["为专业完整性合理补全的内容"],
  "image": {
    "primarySubject": "主要主体",
    "sceneEnvironment": "场景与环境状态",
    "emotionGoal": "情绪目标",
    "visualStyle": "视觉风格",
    "professionalDetails": ["构图、光影、色调、镜头、材质、细节等原有专业优化"]
  }
}`;
}

function getQualitySchema(scenario: 'image' | 'video'): string {
  const scores =
    scenario === 'video'
      ? '"intentFidelity": 0, "actionContinuity": 0, "sceneEvolution": 0, "cameraLanguage": 0, "temporalRhythm": 0, "emotionClarity": 0, "modelFit": 0, "conflictFree": 0'
      : '"intentFidelity": 0, "subjectClarity": 0, "sceneCompleteness": 0, "emotionClarity": 0, "visualStyle": 0, "professionalDetail": 0, "modelFit": 0, "conflictFree": 0';
  return `{"scores": {${scores}}, "overallScore": 0, "issues": ["仍存在的问题"], "selfRepaired": false}`;
}

export function buildProfessionalOptimizationPrompt(options: {
  scenario?: string;
  category?: string;
  models?: string[];
  expansionRules: string;
  qualityRules: string;
}): { systemPrompt: string; modelProfile: PromptModelProfile } {
  const scenario = normalizeScenario(options.scenario);
  const profile = resolvePromptModelProfile(scenario, options.models);
  const modalityName = scenario === 'video' ? 'AI 视频' : 'AI 图片';

  const systemPrompt = `【纯中文】你是${modalityName}提示词总监。一次响应内完成分析、优化和自检，禁止展示思考过程。

执行顺序：
1. 在内部建立创作合同，区分用户明确要求、必须保留内容、硬约束和合理推断；不得改变用户原意。
2. 按目标模型和专业规则生成最终提示词。原有分类模板与专业优化内容必须保留，新增维度只能补全，不能覆盖原需求。
3. 按质量量表评分。若总分低于 ${QUALITY_THRESHOLD}，或原意保真、模型适配、冲突检查任一项低于 85，必须在本次响应内部修复一次，再对修复后的最终版本评分。

【目标模型配置】${profile.label}（${profile.id}）
${profile.instructions.map((item, index) => `${index + 1}. ${item}`).join('\n')}

【专业扩展规则】
${options.expansionRules}

【专业质检规则】
${options.qualityRules}

【内部创作合同结构】
${getContractSchema(scenario)}

【最终输出格式】
只输出一个合法 JSON 对象，不使用 Markdown 代码块，不输出解释：
{
  "intentContract": ${getContractSchema(scenario)},
  "optimizedPrompt": "一段可直接提交给目标模型的完整中文提示词",
  "quality": ${getQualitySchema(scenario)}
}

质量分范围为 0 到 100，必须基于最终 optimizedPrompt 真实评分，不得虚报。issues 只列修复后仍存在的问题，无问题时返回空数组。`;

  return { systemPrompt, modelProfile: profile };
}

function stripModelNoise(raw: string): string {
  return raw
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = stripModelNoise(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clampScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function parseQuality(value: unknown): PromptQualityReport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const rawScores =
    source.scores && typeof source.scores === 'object'
      ? (source.scores as Record<string, unknown>)
      : {};
  const scores = Object.fromEntries(
    Object.entries(rawScores).map(([key, score]) => [key, clampScore(score)])
  );
  const overallScore = clampScore(source.overallScore);
  const issues = Array.isArray(source.issues)
    ? source.issues.filter((item): item is string => typeof item === 'string').slice(0, 6)
    : [];

  if (overallScore === 0 && Object.keys(scores).length === 0) return undefined;
  return {
    overallScore,
    scores,
    issues,
    selfRepaired: Boolean(source.selfRepaired),
    threshold: QUALITY_THRESHOLD,
  };
}

export function parseProfessionalOptimizationResponse(
  raw: string,
  modelProfile: PromptModelProfile
): ProfessionalOptimizationResponse {
  const parsed = extractJson(raw);
  const optimizedPrompt =
    parsed && typeof parsed.optimizedPrompt === 'string'
      ? parsed.optimizedPrompt.trim()
      : stripModelNoise(raw);

  return {
    optimizedPrompt,
    qualityReport: parseQuality(parsed?.quality),
    modelProfile: modelProfile.label,
  };
}
