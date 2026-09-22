import type { ScriptScene } from '@/types/node-data';
import {
  resolveStoryboardOutputMode,
  type StoryboardOutputMode,
  type StoryboardPanelCount,
} from '@/types/storyboard-output-mode';
import { extractImageUrl } from '@/lib/subtitle-utils';
import { persistGeneratedCanvasUrl } from '@/services/canvas-asset-actions';

// 故事版只允许豆包 Seedream 5.0 Pro；可选项仅代表不同的豆包通道。
export type StoryboardDoubaoSeedreamProvider = 'doubao';

export const STORYBOARD_DOUBAO_SEEDREAM_OPTIONS: ReadonlyArray<{
  provider: StoryboardDoubaoSeedreamProvider;
  modelId: string;
  label: string;
}> = [
  { provider: 'doubao', modelId: 'doubao-seedream-5-0-pro', label: '豆包 Seedream 5.0 Pro' },
];

const STORYBOARD_IMAGE_MODEL_BY_PROVIDER: Record<StoryboardDoubaoSeedreamProvider, string> = {
  doubao: 'doubao-seedream-5-0-pro',
};

function resolveStoryboardDoubaoSeedreamProvider(value: unknown): StoryboardDoubaoSeedreamProvider {
  return 'doubao';
}

const SHOT_LABELS: Record<string, string> = {
  wide: '全景',
  medium: '中景',
  medium_close: '中近景',
  closeup: '特写',
  insert: '细节',
};

const MOVE_LABELS: Record<string, string> = {
  static: '固定',
  push_in: '缓慢推进',
  pull_out: '缓慢拉远',
  pan: '横摇',
  track: '跟拍',
};

function compactText(value: unknown, fallback: string, maxLength = 48): string {
  const text = String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function buildSingleStoryboardSheetPrompt(input: {
  premise: string;
  style: string;
  scenes: ScriptScene[];
  outputMode?: StoryboardOutputMode;
  panelCount?: StoryboardPanelCount;
}): string {
  const outputMode = resolveStoryboardOutputMode(input.outputMode, input.panelCount);
  const panelCount = outputMode.grid.rows * outputMode.grid.cols;
  const gridDescription = `${outputMode.grid.cols} 列 × ${outputMode.grid.rows} 行，共 ${panelCount} 格`;
  const shots = Array.from(
    { length: panelCount },
    (_, index) =>
      input.scenes[index] ||
      ({
        id: `placeholder-${index + 1}`,
        description: `承接上一镜头并推进故事的第 ${index + 1} 个画面`,
        duration: 3,
        shotType: 'medium',
        cameraMovement: 'static',
      } as ScriptScene)
  );
  const shotLines = shots.map((scene, index) => {
    const number = String(index + 1).padStart(2, '0');
    const title = compactText(scene.beat, `镜头 ${number}`, 18);
    const visual = compactText(scene.subjectAction || scene.description, '推进故事动作', 72);
    const shotType = SHOT_LABELS[scene.shotType || 'medium'] || scene.shotType || '中景';
    const movement =
      MOVE_LABELS[scene.cameraMovement || 'static'] || scene.cameraMovement || '固定';
    const emotion = compactText(scene.emotionalBeat || scene.moodAtmosphere, '叙事推进', 18);
    return `${number}｜${title}｜画面：${visual}｜景别：${shotType}｜运镜：${movement}｜情绪：${emotion}`;
  });

  if (outputMode.id === 'storyboard_sheet') {
    return [
      '生成一张且仅一张完整的真实电影分镜参考图，禁止手绘线稿、漫画草图或第二张图片。',
      `版式必须严格为横向 16:9 画布，${gridDescription}，阅读顺序从左到右、从上到下。`,
      '每格必须采用写实电影剧照质感，并清晰包含两位编号、场景标题和镜头信息；底部文字简洁，不遮挡主体。',
      '全部镜头保持角色面孔、发型、服装、道具、场景空间、光源方向和电影调色连续一致。',
      outputMode.promptContract,
      `故事前提：${compactText(input.premise, '根据分镜方案生成真实电影分镜参考', 320)}`,
      `视觉风格：${compactText(input.style, '电影感写实', 80)}`,
      `${panelCount} 格内容必须逐格遵循以下方案：`,
      ...shotLines,
      '最终响应只能包含一张完整的真实电影分镜参考图。',
    ].join('\n');
  }

  if (outputMode.id === 'director_storyboard_sheet') {
    return [
      '生成一张且仅一张完整的纯黑白手绘分镜图：画面只允许黑色、白色与灰色，禁止金色、棕色及任何彩色。禁止写实照片、彩色电影剧照、3D 渲染或第二张图片。',
      `版式必须严格为横向 16:9 画布，${gridDescription}，每格等尺寸并按从左到右、从上到下阅读。`,
      '每格使用专业分镜师的铅笔线稿、墨线轮廓与灰阶明暗，保留构图线、方向箭头、清晰镜头编号、场景标题和简洁导演批注。',
      '人物身份、服装、道具、场景空间和动作方向必须在全部格子中连续一致；禁止任何彩色装饰、照片质感、缺格、重复格、额外格、Logo 和随机水印。',
      outputMode.promptContract,
      `故事前提：${compactText(input.premise, '根据分镜方案生成黑白手绘故事板', 320)}`,
      `手绘表现：${compactText(input.style, '专业电影分镜铅笔线稿', 80)}`,
      `${panelCount} 格内容必须逐格遵循以下方案：`,
      ...shotLines,
      '最终响应只能包含一张完整的黑白手绘分镜图。',
    ].join('\n');
  }

  if (outputMode.id === 'character_design_sheet') {
    return [
      '生成一张且仅一张完整的角色校色设定图，禁止生成第二张图片或独立角色图片。',
      '使用干净浅色背景，在横向 16:9 画布中呈现主全身像、正侧背多视图、动作姿态、表情组和服装材质细节。',
      '统一角色肤色、发色、服装与配饰颜色，局部细节必须与主视图完全一致。',
      outputMode.promptContract,
      `创作内容：${compactText(input.premise, '根据方案制作角色设定', 320)}`,
      `视觉风格：${compactText(input.style, '电影感写实', 80)}`,
      '视图清单：一幅主全身像；正面、侧面、背面标准站姿；2-3 个自然动作姿态；一组一致面孔的表情变化。',
      '细节清单：面部近景、发型结构、服装材质与色彩标注、鞋靴与关键配饰局部。',
      '最终响应只能包含一张完整角色校色设定成品图。',
    ].join('\n');
  }

  if (outputMode.id === 'cinematic_relationship_board') {
    return [
      '生成一张且仅一张完整的电影感参考图片，禁止生成第二张图片或独立补帧。',
      '版式为横向 16:9，以一幅完整叙事主视觉占据主体区域，附带 2-3 个角色表情、关系或关键细节小图。',
      '主视觉和局部参考必须保持角色身份、服装、环境、光线和色调一致，构图接近电影宣传参考图。',
      outputMode.promptContract,
      `创作内容：${compactText(input.premise, '根据方案制作关系氛围板', 320)}`,
      `视觉风格：${compactText(input.style, '电影感写实', 80)}`,
      ...shotLines,
      '最终响应只能包含一张完整电影感参考图片。',
    ].join('\n');
  }

  return [
    `生成一张且仅一张完整的专业电影${outputMode.label}图片，不要输出独立分镜图片或第二张图片。`,
    '版式必须严格为横向 16:9 画布，4 列 × 3 行，共 12 个等尺寸面板。所有面板边框清晰、间距统一，阅读顺序从左到右、从上到下。',
    '每个面板只表现一个完整瞬间，禁止面板内部再次拼贴、分屏或画中画。',
    '每格顶部保留白色标题栏：粗体两位镜头编号 + 简短中文标题；底部保留白色批注栏：景别 + 运镜。镜头编号、标题、景别和运镜四项缺一不可，文字需要清晰可读。',
    '每格画面内必须包含与该镜头匹配的方向箭头标注：红色箭头表示镜头运动或推进方向，蓝色箭头表示视线与关注点，绿色箭头表示人物走位、动作或屏幕方向；底部增加简洁图例。',
    '确保主要角色的脸、发型、服装、身形、关键道具以及场景空间在全部面板中连续一致。禁止缺格、重复格、额外格、随机水印、Logo 和无关文字。',
    `故事前提：${compactText(input.premise, '根据分镜方案生成完整故事板', 320)}`,
    `视觉风格：${compactText(input.style, '电影感写实', 80)}`,
    '十二格内容必须逐格遵循以下方案：',
    ...shotLines,
    `最终只交付一张包含上述十二格的完整${outputMode.label}图片。`,
  ].join('\n');
}

async function normalizeReferenceUrl(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  if (!url.startsWith('blob:') && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url)) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || url));
      reader.onerror = () => reject(new Error('参考图读取失败'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function runSingleStoryboardSheetExecution(args: {
  nodeId: string;
  prompt: string;
  provider?: StoryboardDoubaoSeedreamProvider;
  referenceImages: string[];
  getAuthToken: () => string | null;
  apiBaseUrl: string;
  onProgress?: (progress: number) => void;
}): Promise<{ imageUrl: string }> {
  const token = args.getAuthToken();
  const provider = resolveStoryboardDoubaoSeedreamProvider(args.provider);
  const references = await Promise.all(
    Array.from(new Set(args.referenceImages.filter(Boolean)))
      .slice(0, 4)
      .map(normalizeReferenceUrl)
  );
  args.onProgress?.(10);
  args.onProgress?.(20);
  const responsePromise = fetch(`${args.apiBaseUrl}/image/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      // 制作故事版只允许豆包 Seedream 5.0 Pro；provider 只可为已登记的豆包通道。
      model: STORYBOARD_IMAGE_MODEL_BY_PROVIDER[provider],
      provider,
      prompt: args.prompt,
      generationMode: references.length > 0 ? 'reference' : 'text_to_image',
      referenceImage: references[0] || undefined,
      referenceImages: references.length > 0 ? references : undefined,
      size: '1672x941',
      quality: 'medium',
      gptQuality: 'medium',
      gptOutputFormat: 'png',
      gptBackground: 'opaque',
      n: 1,
      source: 'storyboard-maker-single-sheet',
      forceStoryboardDoubaoSeedreamOnly: true,
      useEditEndpointWhenReferenceExists: references.length > 0,
    }),
  });
  args.onProgress?.(35);
  const response = await responsePromise;

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body.error || body.message || `故事版生成失败 HTTP ${response.status}`));
  }

  const result = (await response.json()) as Record<string, unknown>;
  args.onProgress?.(85);
  const data = (result.data || {}) as Record<string, unknown>;
  if (data.status === 'failed' || data.status === 'error') {
    throw new Error(String(data.error || '故事版生成失败'));
  }
  const imageUrl = extractImageUrl(result);
  if (!imageUrl) throw new Error('故事版生成完成但未返回图片');

  args.onProgress?.(95);
  try {
    const persisted = await persistGeneratedCanvasUrl({
      nodeId: args.nodeId,
      kind: 'image',
      url: imageUrl,
      fileName: `storyboard-sheet-${Date.now()}.png`,
    });
    args.onProgress?.(100);
    return { imageUrl: persisted.runtimeUrl || imageUrl };
  } catch {
    args.onProgress?.(100);
    return { imageUrl };
  }
}
