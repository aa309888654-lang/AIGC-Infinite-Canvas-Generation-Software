import type { ComicStyle } from '@shared/types/comic';

export type { ComicStyle };

const STYLE_MAP: Record<ComicStyle, string> = {
  anime: 'anime style, high quality, clean lineart, vibrant colors',
  manga: 'manga style, black and white, detailed lineart',
  real: 'realistic style, photorealistic, detailed',
  chibi: 'chibi style, cute, small proportions, big head',
};

const STYLE_SCENE_MAP: Record<ComicStyle, string> = {
  anime: 'anime style, vibrant colors, clean',
  manga: 'manga style, detailed, atmospheric',
  real: 'photorealistic, detailed, cinematic',
  chibi: 'cute style, soft colors, charming',
};

const STYLE_EXPRESSION_MAP: Record<ComicStyle, string> = {
  anime: 'anime style, expressive, clean lineart',
  manga: 'manga style, detailed, expressive',
  real: 'realistic, photorealistic, detailed',
  chibi: 'chibi style, cute, exaggerated expressions',
};

const GENDER_MAP: Record<string, string> = {
  male: 'male character, masculine features',
  female: 'female character, feminine features',
  neutral: 'androgynous character',
};

const AGE_MAP: Record<string, string> = {
  child: 'child, young, small stature',
  teenager: 'teenager, youthful, youthful features',
  'young-adult': 'young adult, early twenties',
  adult: 'adult, mature features',
  elderly: 'elderly, aged, wise appearance',
};

const SCENE_TYPE_MAP: Record<string, string> = {
  indoor: 'indoor scene, interior design, room',
  outdoor: 'outdoor scene, nature, landscape',
  sky: 'sky scene, clouds, atmosphere',
  city: 'city scene, urban, buildings, street',
  fantasy: 'fantasy world, magical, ethereal',
};

const TIME_MAP: Record<string, string> = {
  morning: 'morning light, sunrise, golden hour, soft shadows',
  noon: 'bright daylight, noon sun, clear sky',
  afternoon: 'afternoon light, warm tones, soft shadows',
  evening: 'evening, sunset, warm orange light, golden',
  night: 'night scene, dark, moonlight, stars, mysterious',
};

const WEATHER_MAP: Record<string, string> = {
  sunny: 'clear sky, bright, cheerful',
  cloudy: 'cloudy, overcast, soft light',
  rainy: 'rain, raindrops, wet, moody',
  snowy: 'snow, snowy, winter, cold',
  stormy: 'storm, lightning, dramatic, dark clouds',
};

const EXPRESSION_MAP: Record<string, string> = {
  neutral: 'neutral expression, calm face',
  happy: 'happy, smiling, joyful, cheerful',
  sad: 'sad, crying, tearful, melancholic',
  angry: 'angry, furious, irritated, gritting teeth',
  surprised: 'surprised, shocked, amazed, wide eyes',
  scared: 'scared, frightened, terrified, fearful',
  excited: 'excited, energetic, enthusiastic, lively',
  thinking: 'thinking, deep thought, pensive, contemplative',
  confused: 'confused, puzzled, bewildered, uncertain',
  tired: 'tired, sleepy, exhausted, weary',
};

export function normalizeStyle(style?: string): ComicStyle {
  if (!style) return 'anime';
  const lower = style.toLowerCase();
  if (lower in STYLE_MAP) return lower as ComicStyle;
  return 'anime';
}

export function buildCharacterPrompt(params: {
  name: string;
  description: string;
  style?: string;
  gender?: string;
  age?: string;
  appearance?: string;
  outfit?: string;
  personality?: string;
}): string {
  const s = normalizeStyle(params.style);
  const styleStr = STYLE_MAP[s];
  const genderStr = GENDER_MAP[params.gender || 'neutral'] || GENDER_MAP.neutral;
  const ageStr = AGE_MAP[params.age || 'young-adult'] || AGE_MAP['young-adult'];

  const parts: string[] = [styleStr, genderStr, ageStr];

  if (params.appearance) parts.push(params.appearance);
  if (params.outfit) parts.push(params.outfit);
  if (params.personality) parts.push(`${params.personality} personality`);
  if (params.description) parts.push(params.description);

  parts.push('full body, standing pose, character design sheet, multiple angles');
  return parts.filter(Boolean).join(', ');
}

export function buildScenePrompt(params: {
  type?: string;
  timeOfDay?: string;
  weather?: string;
  description: string;
  style?: string;
  isVideo?: boolean;
  location?: string;
  mood?: string;
}): string {
  const s = normalizeStyle(params.style);
  const styleStr = STYLE_SCENE_MAP[s];
  const typeStr = SCENE_TYPE_MAP[params.type || 'outdoor'] || SCENE_TYPE_MAP.outdoor;
  const timeStr = TIME_MAP[params.timeOfDay || 'afternoon'] || TIME_MAP.afternoon;
  const weatherStr = WEATHER_MAP[params.weather || 'sunny'] || WEATHER_MAP.sunny;

  const parts: string[] = [styleStr, typeStr, timeStr, weatherStr];

  if (params.location) parts.push(`Location: ${params.location}`);
  if (params.mood) parts.push(`Mood: ${params.mood}`);
  if (params.description) parts.push(params.description);

  parts.push(params.isVideo ? 'cinematic, smooth motion' : 'detailed illustration, wide shot, detailed background');
  return parts.filter(Boolean).join(', ');
}

export function buildExpressionPrompt(params: {
  expression: string;
  style?: string;
  characterDescription?: string;
}): string {
  const s = normalizeStyle(params.style);
  const styleStr = STYLE_EXPRESSION_MAP[s];
  const exprStr = EXPRESSION_MAP[params.expression] || EXPRESSION_MAP.neutral;
  const charDesc = params.characterDescription || 'character';

  return `${styleStr}, ${charDesc}, ${exprStr}, face close-up, character portrait, single character, white background`;
}

const ASSET_CATEGORY_MAP: Record<string, string> = {
  prop: 'prop, handheld object, single item',
  accessory: 'accessory, wearable item, single piece',
  weapon: 'weapon, detailed weapon design, single weapon',
  artifact: 'magical artifact, glowing mystical object, single artifact',
};

const ASSET_MATERIAL_MAP: Record<string, string> = {
  metal: 'metallic material, shiny metal surface, reflective',
  wood: 'wooden material, natural wood grain, carved wood',
  stone: 'stone material, rocky texture, solid stone',
  crystal: 'crystal material, translucent, glowing crystal',
  fabric: 'fabric material, cloth, textile',
  leather: 'leather material, textured leather',
  energy: 'energy material, glowing, ethereal light',
  organic: 'organic material, natural, biological',
};

/**
 * 构建通用资产（道具/饰品/武器/法器）的图像生成提示词。
 * 与场景图不同，资产图强调"材质/功能/单物品特写"，避免场景化描述。
 */
export function buildAssetPrompt(params: {
  name: string;
  description: string;
  category?: string;
  material?: string;
  function?: string;
  style?: string;
}): string {
  const s = normalizeStyle(params.style);
  const styleStr = STYLE_MAP[s];
  const categoryStr = ASSET_CATEGORY_MAP[params.category || 'prop'] || ASSET_CATEGORY_MAP.prop;
  const materialStr = ASSET_MATERIAL_MAP[params.material] || '';

  const parts: string[] = [styleStr, categoryStr];
  if (materialStr) parts.push(materialStr);
  if (params.name) parts.push(`Name: ${params.name}`);
  if (params.function) parts.push(`Function: ${params.function}`);
  if (params.description) parts.push(params.description);

  parts.push('centered composition, single object, clean background, product shot, detailed design, high quality');
  return parts.filter(Boolean).join(', ');
}
