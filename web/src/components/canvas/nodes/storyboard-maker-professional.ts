import type { ScriptScene } from '@/types/node-data';
import {
  buildStoryboardPlanFromPrompt,
  type StoryboardFormat,
  type StoryboardPlanV2,
  type StoryboardShot,
} from './storyboard-plan-v2';
import { compileShotPromptForDoubaoSeedream } from './storyboard-prompt-compiler';
import {
  resolveStoryboardOutputMode,
  type StoryboardOutputMode,
  type StoryboardPanelCount,
} from '@/types/storyboard-output-mode';

export interface StoryboardPromptInput {
  premise: string;
  aspectRatio: string;
  targetDuration: number;
  format: string;
  tone: string;
  outputMode?: StoryboardOutputMode;
  panelCount?: StoryboardPanelCount;
  visualReferenceCount?: number;
  characterReferenceCount?: number;
}

export interface StoryboardNormalizeInput {
  premise: string;
  aspectRatio: string;
  targetDuration: number;
  format: string;
  tone: string;
}

const STORYBOARD_FILL_BEATS = [
  '建立故事环境与时空背景',
  '引入核心角色与当前目标',
  '展示角色关系与行动方向',
  '出现推动剧情的异常线索',
  '角色接近关键地点或对象',
  '冲突升级并改变原有计划',
  '关键人物作出明确选择',
  '揭示重要信息或隐藏关系',
  '行动受阻并承受后果',
  '危机达到高潮',
  '角色完成决定性行动',
  '收束事件并留下余韵',
];

export interface StoryboardPlanConversionInput {
  scenes: ScriptScene[];
  premise: string;
  aspectRatio: string;
  targetDuration: number;
  format: string;
  modelId: string;
  provider: string;
  referenceImageUrls?: string[];
}

export interface StoryboardRhythmSummary {
  shotCount: number;
  totalDuration: number;
  averageDuration: number;
  shotTypeVariety: number;
  repeatedShotRun: number;
  label: string;
}

const SHOT_TYPES = ['wide', 'medium', 'medium_close', 'closeup', 'insert'] as const;
const CAMERA_ANGLES = ['eye_level', 'low_angle', 'high_angle', 'over_shoulder', 'pov'] as const;
const CAMERA_MOVES = ['static', 'push_in', 'pan', 'track', 'pull_out'] as const;
const DEFAULT_NEGATIVE_PROMPT =
  '水印，Logo，随机文字，畸形肢体，多余手指，角色变脸，服装漂移，道具消失，光源方向突变';

export function shouldAutoGenerateFramesAfterPlanning(_requested: boolean): boolean {
  return false;
}

function cleanText(value: unknown, fallback = ''): string {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  const text = cleanText(value);
  return text
    ? text
        .split(/[、,，;；]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function normalizeShotType(value: unknown, index: number): string {
  const raw = cleanText(value).toLowerCase();
  const aliases: Record<string, string> = {
    extreme_wide: 'wide',
    full: 'wide',
    detail: 'insert',
    extreme_closeup: 'closeup',
    close_up: 'closeup',
    tracking: 'medium',
    aerial: 'wide',
  };
  const normalized = aliases[raw] || raw;
  return SHOT_TYPES.includes(normalized as (typeof SHOT_TYPES)[number])
    ? normalized
    : SHOT_TYPES[index % SHOT_TYPES.length];
}

function normalizeCameraAngle(value: unknown, index: number): string {
  const raw = cleanText(value).toLowerCase();
  const aliases: Record<string, string> = {
    eye: 'eye_level',
    eyelevel: 'eye_level',
    low: 'low_angle',
    high: 'high_angle',
    ots: 'over_shoulder',
    top_down: 'high_angle',
    dutch: 'low_angle',
  };
  const normalized = aliases[raw] || raw;
  return CAMERA_ANGLES.includes(normalized as (typeof CAMERA_ANGLES)[number])
    ? normalized
    : CAMERA_ANGLES[index % CAMERA_ANGLES.length];
}

function normalizeCameraMove(value: unknown, index: number): string {
  const raw = cleanText(value).toLowerCase();
  const aliases: Record<string, string> = {
    dolly: 'push_in',
    crane: 'track',
    handheld: 'track',
    orbit: 'track',
    tracking: 'track',
    tilt: 'pan',
  };
  const normalized = aliases[raw] || raw;
  return CAMERA_MOVES.includes(normalized as (typeof CAMERA_MOVES)[number])
    ? normalized
    : CAMERA_MOVES[index % CAMERA_MOVES.length];
}

function allocateDurations(rawDurations: number[], targetDuration: number): number[] {
  const count = Math.max(1, rawDurations.length);
  const target = Math.max(count * 2, Math.round(Number(targetDuration) || count * 4));
  const weights = rawDurations.map((duration) => Math.max(2, Math.min(12, Number(duration) || 4)));
  const weightTotal = weights.reduce((sum, duration) => sum + duration, 0) || count;
  const durations = weights.map((weight) =>
    Math.max(2, Math.floor((weight / weightTotal) * target))
  );
  let remainder = target - durations.reduce((sum, duration) => sum + duration, 0);
  let cursor = 0;
  while (remainder !== 0 && cursor < count * 20) {
    const index = cursor % count;
    if (remainder > 0) {
      durations[index] += 1;
      remainder -= 1;
    } else if (durations[index] > 2) {
      durations[index] -= 1;
      remainder += 1;
    }
    cursor += 1;
  }
  return durations;
}

function extractSceneArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const record = asRecord(raw);
  if (Array.isArray(record.shots)) return record.shots;
  if (Array.isArray(record.scenes)) return record.scenes;
  return [];
}

function inferEnvironment(description: string, premise: string): string {
  const source = description || premise;
  if (/雨|夜/.test(source)) return '保持雨夜环境、湿润地面反光与统一的冷色环境光，空间方向连续';
  if (/室内|房间|走廊|公寓/.test(source)) return '保持室内空间结构、出入口位置与主光方向连续';
  return '保持故事发生地的空间结构、时间状态与光源方向在相邻镜头中连续';
}

function inferComposition(index: number, shotType: string): string {
  if (index === 0 || shotType === 'wide') return '建立清晰空间地理，让主体与环境关系一眼可读';
  if (shotType === 'closeup' || shotType === 'insert')
    return '收紧视觉焦点，用前后景层次强调关键情绪或动作细节';
  return '延续上一镜轴线，以清晰主次关系组织主体动作和视线方向';
}

function buildScenePrompt(input: {
  premise: string;
  description: string;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  subjectAction: string;
  environment: string;
  composition: string;
  lighting: string;
  continuity: ScriptScene['continuity'];
}): string {
  return [
    `故事前提：${input.premise}`,
    `画面：${input.description}`,
    `镜头：${input.shotType}，${input.cameraAngle}，${input.cameraMovement}`,
    `主体动作：${input.subjectAction}`,
    `环境：${input.environment}`,
    `构图：${input.composition}`,
    `光线：${input.lighting}`,
    `连续性：保持${(input.continuity?.preserveFromPrevious || []).join('、')}；轴线${input.continuity?.screenDirection || '保持一致'}`,
  ].join('。');
}

export function buildProfessionalStoryboardPrompt(input: StoryboardPromptInput): string {
  const premise = cleanText(input.premise, '根据已连接素材规划完整故事');
  const target = Math.max(4, Math.round(Number(input.targetDuration) || 30));
  const outputMode = resolveStoryboardOutputMode(input.outputMode, input.panelCount);
  const shotCountInstruction = outputMode.requiredShotCount
    ? `- 方案必须严格包含 ${outputMode.requiredShotCount} 个镜头，JSON 数组必须恰好有 ${outputMode.requiredShotCount} 项，不得多也不得少。`
    : '';
  return `你是电影工业流程中的导演、分镜师和剪辑指导。请把创意规划为可拍摄、可编辑、可直接进入图像生成的专业故事版。

项目约束：
- 故事前提：${premise}
- 片型：${input.format}；语气：${input.tone}
- 画幅：${input.aspectRatio}；目标总时长：${target} 秒
- 交付模式：${outputMode.label}；交付尺寸：${outputMode.imageSize.replace('x', '×')}
- 已连接视觉参考 ${input.visualReferenceCount || 0} 张，角色参考 ${input.characterReferenceCount || 0} 张；把参考素材明确用作身份、服装、场景或风格锚点。

交付约束：
- ${outputMode.promptContract}
${shotCountInstruction}

规划规则：
1. 先规划开场、推进、转折、高潮、收束的剧情节拍，再决定镜头数量；不要机械按句号拆分。
2. 每镜说明叙事目的，交替使用建立、动作、反应和细节镜头，避免连续重复同一景别。
3. 遵守 180 度轴线、视线与运动方向，持续追踪角色外观、服装、关键道具、场景时间和光源方向。
4. description 和 professionalPrompt 必须描述主体、动作、空间、镜头、构图与光线，避免空泛质量词堆叠。
5. 总时长接近 ${target} 秒，单镜通常 2-8 秒；对白、旁白和声音建议只在需要时填写。

只返回严格 JSON 数组，不要 Markdown，不要解释。每项字段：
{
  "description": "可执行画面描述",
  "beat": "剧情节拍与镜头存在的理由",
  "duration": 4,
  "shotType": "wide|medium|medium_close|closeup|insert",
  "cameraAngle": "eye_level|low_angle|high_angle|over_shoulder|pov",
  "cameraMovement": "static|push_in|pull_out|pan|track",
  "subjectAction": "主体动作与表演",
  "environment": "场景、时间和空间关系",
  "composition": "构图、焦点和景深",
  "lighting": "光源、方向、质感和色温",
  "emotionalBeat": "情绪变化",
  "dialogue": "对白",
  "narration": "旁白或声音建议",
  "transition": "cut|fade|dissolve|match",
  "continuity": {
    "screenDirection": "left-to-right|right-to-left|maintain-axis",
    "characterPositions": { "main-subject": "left|center|right|foreground|background" },
    "requiredProps": [],
    "preserveFromPrevious": ["主体身份", "服装", "场景", "光源方向"]
  },
  "professionalPrompt": "可直接用于分镜图生成的完整提示词",
  "negativePrompt": "水印、随机文字、身份漂移等负面约束"
}`;
}

export function ensureStoryboardSceneCount(
  scenes: ScriptScene[],
  input: StoryboardNormalizeInput,
  requiredCount: number
): ScriptScene[] {
  const count = Math.max(1, Math.floor(requiredCount));
  const fitted = scenes.slice(0, count).map((scene) => ({ ...scene }));
  while (fitted.length < count) {
    const index = fitted.length;
    const beat = STORYBOARD_FILL_BEATS[index % STORYBOARD_FILL_BEATS.length];
    fitted.push({
      id: `storyboard-shot-${index + 1}`,
      description: `${input.premise}，${beat}`,
      beat,
      subjectAction: beat,
      duration: 4,
      shotType: SHOT_TYPES[index % SHOT_TYPES.length],
      cameraAngle: CAMERA_ANGLES[index % CAMERA_ANGLES.length],
      cameraMovement: CAMERA_MOVES[index % CAMERA_MOVES.length],
      transition: index === count - 1 ? 'fade' : 'cut',
      emotionalBeat: index < 3 ? '建立' : index < 9 ? '推进' : '收束',
      status: 'pending',
    });
  }
  return normalizeProfessionalScenes(fitted, {
    ...input,
    targetDuration: Math.max(count * 2, input.targetDuration),
  });
}

export function normalizeProfessionalScenes(
  raw: unknown,
  input: StoryboardNormalizeInput
): ScriptScene[] {
  const source = extractSceneArray(raw);
  if (source.length === 0) return [];
  const durations = allocateDurations(
    source.map((item) => Number(asRecord(item).duration || asRecord(item).durationSec || 4)),
    input.targetDuration
  );

  return source.map((item, index) => {
    const record = asRecord(item);
    const continuityRecord = asRecord(record.continuity);
    const description = cleanText(
      record.description ?? record.desc ?? record.content ?? record.subjectAction ?? record.action,
      `${input.premise}，镜头 ${index + 1}`
    );
    const shotType = normalizeShotType(record.shotType ?? record.shot_size, index);
    const cameraAngle = normalizeCameraAngle(record.cameraAngle ?? record.camera_angle, index);
    const cameraMovement = normalizeCameraMove(
      record.cameraMovement ?? record.camera_movement,
      index
    );
    const beat = cleanText(
      record.beat ?? record.purpose,
      index === 0 ? '建立人物、环境与叙事问题' : `推进第 ${index + 1} 个剧情节拍`
    );
    const subjectAction = cleanText(record.subjectAction ?? record.action, description);
    const environment = cleanText(record.environment, inferEnvironment(description, input.premise));
    const composition = cleanText(
      record.composition ?? record.compositionGuide,
      inferComposition(index, shotType)
    );
    const lighting = cleanText(
      record.lighting ?? record.lightingSetup,
      /夜|雨/.test(description + input.premise)
        ? '有动机的冷色夜景主光，保留湿润反光，人物面部有稳定轮廓光'
        : '使用有明确来源的电影照明，保持色温、方向与反差连续'
    );
    const continuity: NonNullable<ScriptScene['continuity']> = {
      screenDirection: cleanText(
        continuityRecord.screenDirection,
        index === 0 ? 'left-to-right' : 'maintain-axis'
      ),
      characterPositions: asRecord(continuityRecord.characterPositions) as NonNullable<
        ScriptScene['continuity']
      >['characterPositions'],
      requiredProps: asStringList(continuityRecord.requiredProps ?? record.requiredProps),
      preserveFromPrevious:
        asStringList(continuityRecord.preserveFromPrevious).length > 0
          ? asStringList(continuityRecord.preserveFromPrevious)
          : ['主体身份', '服装', '关键道具', '场景', '光源方向'],
    };
    const professionalPrompt =
      cleanText(record.professionalPrompt ?? record.prompt) ||
      buildScenePrompt({
        premise: input.premise,
        description,
        shotType,
        cameraAngle,
        cameraMovement,
        subjectAction,
        environment,
        composition,
        lighting,
        continuity,
      });

    return {
      ...record,
      id: cleanText(record.id, `storyboard-shot-${index + 1}`),
      description,
      beat,
      emotionalBeat: cleanText(
        record.emotionalBeat ?? record.emotion,
        index === 0 ? '好奇与建立' : '张力推进'
      ),
      duration: durations[index],
      shotType,
      cameraAngle,
      cameraMovement,
      transition: cleanText(record.transition, index === 0 ? 'cut' : 'match'),
      subjectAction,
      environment,
      compositionGuide: composition,
      lightingSetup: lighting,
      moodAtmosphere: cleanText(
        record.moodAtmosphere ?? record.emotionalBeat ?? record.emotion,
        input.tone
      ),
      dialogue: cleanText(record.dialogue) || undefined,
      narration: cleanText(record.narration ?? record.audio) || undefined,
      continuity,
      professionalPrompt,
      negativePrompt: cleanText(record.negativePrompt, DEFAULT_NEGATIVE_PROMPT),
      status: (record.status as ScriptScene['status']) || 'pending',
    } as ScriptScene;
  });
}

export function parseProfessionalStoryboardResponse(
  text: string,
  input: StoryboardNormalizeInput
): ScriptScene[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    return normalizeProfessionalScenes(JSON.parse(text.slice(start, end + 1)), input);
  } catch {
    return [];
  }
}

function mapFormat(format: string): StoryboardFormat {
  const value = cleanText(format).toLowerCase();
  if (value === 'commercial' || value === 'ad') return 'ad';
  if (value === 'comic') return 'comic';
  if (value === 'product') return 'product';
  if (value === 'short_video' || value === 'vlog') return 'short_video';
  if (value === 'cinematic' || value === 'film' || value === 'story') return 'film';
  return 'custom';
}

function toPlanShotType(value: string): StoryboardShot['shotType'] {
  const map: Record<string, StoryboardShot['shotType']> = {
    detail: 'insert',
    aerial: 'wide',
    tracking: 'medium',
    pov: 'medium_close',
  };
  const normalized = map[value] || value;
  const allowed: StoryboardShot['shotType'][] = [
    'extreme_wide',
    'wide',
    'full',
    'medium',
    'medium_close',
    'closeup',
    'extreme_closeup',
    'insert',
  ];
  return allowed.includes(normalized as StoryboardShot['shotType'])
    ? (normalized as StoryboardShot['shotType'])
    : 'medium';
}

function toPlanCameraMove(value: string): StoryboardShot['cameraMove'] {
  const map: Record<string, StoryboardShot['cameraMove']> = {
    dolly: 'push_in',
    crane: 'track',
    tracking: 'track',
    orbit: 'orbit',
    handheld: 'handheld',
    tilt: 'tilt',
  };
  const normalized = map[value] || value;
  const allowed: Array<StoryboardShot['cameraMove']> = [
    'static',
    'push_in',
    'pull_out',
    'pan',
    'tilt',
    'track',
    'handheld',
    'orbit',
  ];
  return allowed.includes(normalized as StoryboardShot['cameraMove'])
    ? (normalized as StoryboardShot['cameraMove'])
    : 'static';
}

export function scenesToStoryboardPlan(input: StoryboardPlanConversionInput): StoryboardPlanV2 {
  const scenes = normalizeProfessionalScenes(input.scenes, {
    premise: input.premise,
    aspectRatio: input.aspectRatio,
    targetDuration: input.targetDuration,
    format: input.format,
    tone: '',
  });
  const base = buildStoryboardPlanFromPrompt({
    rows: 1,
    cols: Math.max(1, scenes.length),
    prompt: input.premise,
    shotStrategy: 'cinematic',
    modelId: input.modelId,
    provider: input.provider,
  });
  base.project.format = mapFormat(input.format);
  base.project.aspectRatio = input.aspectRatio;
  base.project.targetDurationSec = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const referenceImage = input.referenceImageUrls?.find(Boolean);
  const characterElement = base.elements.find((element) => element.type === 'character');
  if (characterElement && referenceImage) {
    characterElement.referenceImageUrl = referenceImage;
    characterElement.locked = true;
  }

  base.shots = scenes.map((scene, index) => ({
    id: scene.id || `shot-${String(index + 1).padStart(2, '0')}`,
    index,
    sceneId: `scene-${String(index + 1).padStart(2, '0')}`,
    durationSec: scene.duration,
    beat: scene.beat || scene.description,
    emotionalBeat: scene.emotionalBeat || scene.moodAtmosphere || 'focused',
    shotType: toPlanShotType(scene.shotType),
    cameraAngle: (scene.cameraAngle || 'eye_level') as StoryboardShot['cameraAngle'],
    cameraMove: toPlanCameraMove(scene.cameraMovement),
    subjectAction: scene.subjectAction || scene.description,
    environment: scene.environment || '保持场景连续',
    lighting: scene.lightingSetup || '保持主光方向和色温连续',
    composition: scene.compositionGuide || '清晰主体与环境关系',
    continuity: {
      screenDirection: scene.continuity?.screenDirection,
      characterPositions: scene.continuity?.characterPositions,
      requiredProps: scene.continuity?.requiredProps || [],
      preserveFromPrevious: scene.continuity?.preserveFromPrevious || ['主体身份', '服装', '场景'],
    },
    references: {
      characterIds: ['main-subject'],
      styleIds: ['story-style'],
    },
    negativePrompt: scene.negativePrompt,
  }));

  base.shots = base.shots.map((shot) => ({
    ...shot,
    prompt: compileShotPromptForDoubaoSeedream({
      plan: base,
      shot,
      total: base.shots.length,
      basePrompt: input.premise,
      negativePrompt: scenes[shot.index]?.negativePrompt,
    }),
  }));
  return base;
}

export function getStoryboardRhythmSummary(scenes: ScriptScene[]): StoryboardRhythmSummary {
  const totalDuration = scenes.reduce(
    (sum, scene) => sum + Math.max(0, Number(scene.duration) || 0),
    0
  );
  let repeatedShotRun = scenes.length > 0 ? 1 : 0;
  let currentRun = repeatedShotRun;
  scenes.forEach((scene, index) => {
    if (index === 0) return;
    if (scene.shotType === scenes[index - 1].shotType) currentRun += 1;
    else currentRun = 1;
    repeatedShotRun = Math.max(repeatedShotRun, currentRun);
  });
  const shotTypeVariety = new Set(scenes.map((scene) => scene.shotType).filter(Boolean)).size;
  const averageDuration =
    scenes.length > 0 ? Number((totalDuration / scenes.length).toFixed(1)) : 0;
  const label =
    repeatedShotRun >= 3
      ? '景别重复偏多'
      : shotTypeVariety >= Math.min(3, scenes.length)
        ? '节奏层次清晰'
        : '节奏平稳';
  return {
    shotCount: scenes.length,
    totalDuration,
    averageDuration,
    shotTypeVariety,
    repeatedShotRun,
    label,
  };
}
