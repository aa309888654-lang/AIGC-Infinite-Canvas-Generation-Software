export type StoryboardOutputMode =
  | 'director_storyboard_sheet'
  | 'storyboard_sheet'
  | 'character_design_sheet'
  | 'cinematic_relationship_board';

export type StoryboardPanelCount = 3 | 6 | 9 | 12;

export const STORYBOARD_PANEL_OPTIONS: Array<{ value: StoryboardPanelCount; label: string }> = [
  { value: 3, label: '3 格' },
  { value: 6, label: '6 格' },
  { value: 9, label: '9 格' },
  { value: 12, label: '12 格' },
];

export interface StoryboardOutputModeDefinition {
  id: StoryboardOutputMode;
  label: string;
  summary: string;
  aspectRatio: '16:9';
  imageSize: '1672x941';
  format: 'story' | 'cinematic';
  grid: {
    mode: 'storyboard' | 'grid' | 'hybrid';
    layout: string;
    rows: number;
    cols: number;
    preset: 'storyboard_full' | 'character_fullset' | 'character_turnaround';
    processingMode: 'sequence' | 'selected';
  };
  promptContract: string;
  generationStrategy: 'single_composite';
  requiredShotCount?: number;
}

export const STORYBOARD_OUTPUT_MODES: StoryboardOutputModeDefinition[] = [
  {
    id: 'director_storyboard_sheet',
    label: '手绘分镜',
    summary: '黑白手绘镜头与导演批注',
    aspectRatio: '16:9',
    imageSize: '1672x941',
    format: 'story',
    grid: {
      mode: 'storyboard',
      layout: '3x4',
      rows: 3,
      cols: 4,
      preset: 'storyboard_full',
      processingMode: 'selected',
    },
    promptContract:
      '一次只生成一张纯黑白手绘分镜成品图。画面仅允许黑、白、灰三种灰阶，使用铅笔、墨线和灰阶明暗表现，保留清晰分镜框、镜头编号与导演批注；禁止金色及任何彩色、写实照片、彩色渲染、独立图片或第二张图片。',
    generationStrategy: 'single_composite',
    requiredShotCount: 12,
  },
  {
    id: 'storyboard_sheet',
    label: '真实分镜',
    summary: '写实电影照片镜头与字幕参考',
    aspectRatio: '16:9',
    imageSize: '1672x941',
    format: 'story',
    grid: {
      mode: 'storyboard',
      layout: '3x4',
      rows: 3,
      cols: 4,
      preset: 'storyboard_full',
      processingMode: 'selected',
    },
    promptContract:
      '一次只生成一张真实电影分镜参考图。画布严格使用 4 列 × 3 行共 12 格；每格采用写实电影剧照质感，包含两位镜头编号、场景标题和简洁镜头信息。保持人物、服装、场景、光线与色调连续，禁止手绘线稿、漫画草图、缺格、重复格和额外画面。',
    generationStrategy: 'single_composite',
    requiredShotCount: 12,
  },
  {
    id: 'character_design_sheet',
    label: '角色生成',
    summary: '角色多视图、服装材质与色彩统一',
    aspectRatio: '16:9',
    imageSize: '1672x941',
    format: 'cinematic',
    grid: {
      mode: 'grid',
      layout: '3x4',
      rows: 3,
      cols: 4,
      preset: 'character_fullset',
      processingMode: 'selected',
    },
    promptContract:
      '一次只生成一张角色校色设定图：使用干净浅色背景，在同一张图内呈现主全身像、正侧背多视图、动作姿态、表情组、服装材质与局部细节；统一肤色、发色、服装和配饰色彩，禁止输出第二张图片。',
    generationStrategy: 'single_composite',
  },
  {
    id: 'cinematic_relationship_board',
    label: '剧照',
    summary: '电影主视觉、人物关系与局部参考',
    aspectRatio: '16:9',
    imageSize: '1672x941',
    format: 'cinematic',
    grid: {
      mode: 'hybrid',
      layout: '2x2',
      rows: 2,
      cols: 2,
      preset: 'character_turnaround',
      processingMode: 'selected',
    },
    promptContract:
      '一次只生成一张电影感参考图片：以一幅完整叙事主视觉为主体，附带 2-3 个角色表情、关系或关键细节小图；主视觉与局部参考保持人物身份、服装、环境和色调一致，禁止输出第二张图片。',
    generationStrategy: 'single_composite',
  },
];

export const DEFAULT_STORYBOARD_OUTPUT_MODE: StoryboardOutputMode = 'director_storyboard_sheet';

export function resolveStoryboardPanelCount(value: unknown): StoryboardPanelCount {
  const count = Number(value);
  return STORYBOARD_PANEL_OPTIONS.some((option) => option.value === count)
    ? (count as StoryboardPanelCount)
    : 12;
}

export function supportsStoryboardPanelCount(mode: StoryboardOutputMode): boolean {
  return mode === 'director_storyboard_sheet' || mode === 'storyboard_sheet';
}

export function resolveStoryboardOutputMode(
  value: unknown,
  panelCount: StoryboardPanelCount = 12
): StoryboardOutputModeDefinition {
  const mode =
    STORYBOARD_OUTPUT_MODES.find((mode) => mode.id === value) ||
    STORYBOARD_OUTPUT_MODES.find((mode) => mode.id === DEFAULT_STORYBOARD_OUTPUT_MODE)!;
  if (!supportsStoryboardPanelCount(mode.id)) return mode;

  const count = resolveStoryboardPanelCount(panelCount);
  const grid =
    count === 3
      ? { rows: 1, cols: 3 }
      : count === 6
        ? { rows: 2, cols: 3 }
        : count === 9
          ? { rows: 3, cols: 3 }
          : { rows: 3, cols: 4 };
  return {
    ...mode,
    summary: `${count} 格${mode.id === 'director_storyboard_sheet' ? '黑白手绘镜头与导演批注' : '写实电影照片镜头与字幕参考'}`,
    grid: { ...mode.grid, ...grid, layout: `${grid.rows}x${grid.cols}` },
    requiredShotCount: count,
  };
}
