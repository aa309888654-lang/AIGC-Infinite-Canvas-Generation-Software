/**
 * AI图片生成 Agent 提示词模板
 */

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  prompt: string;
  negativePrompt?: string;
  style?: string;
  parameters?: Record<string, unknown>;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // 人物类
  {
    id: 'portrait-closeup',
    name: '特写人像',
    category: '人物',
    prompt: 'Close-up portrait of {subject}, professional photography, sharp focus, detailed eyes, natural skin texture, soft studio lighting, {style}',
    negativePrompt: 'blurry, low quality, deformed, distorted features',
    parameters: { aspectRatio: '1:1', steps: 30 },
  },
  {
    id: 'full-body-portrait',
    name: '全身人像',
    category: '人物',
    prompt: 'Full body portrait of {subject}, standing pose, professional photography, {background}, natural lighting, {style}',
    negativePrompt: 'blurry, low quality, deformed legs, extra limbs',
    parameters: { aspectRatio: '3:4', steps: 35 },
  },
  {
    id: 'character-concept',
    name: '角色立绘',
    category: '人物',
    prompt: 'Character concept art of {character}, detailed illustration, full body, front view, {outfit}, {pose}, clean lineart, {style}',
    negativePrompt: 'low quality, amateur, deformed',
    parameters: { aspectRatio: '3:4', steps: 40 },
  },

  // 场景类
  {
    id: 'landscape-scenic',
    name: '风景全景',
    category: '场景',
    prompt: 'Breathtaking landscape photography of {scene}, golden hour lighting, cinematic composition, ultra detailed, {weather}',
    negativePrompt: 'artifacts, blur, low resolution, watermarks',
    parameters: { aspectRatio: '16:9', steps: 35 },
  },
  {
    id: 'city-street',
    name: '城市街景',
    category: '场景',
    prompt: 'Street photography of {city_location}, {time_of_day}, cinematic, {weather}, people walking, life and activity, ultra detailed',
    negativePrompt: 'empty, deserted, blurry',
    parameters: { aspectRatio: '16:9', steps: 30 },
  },
  {
    id: 'interior-design',
    name: '室内设计',
    category: '场景',
    prompt: 'Interior design visualization of {room_type}, modern style, photorealistic render, soft natural lighting, {furniture}',
    negativePrompt: 'cluttered, messy, low quality',
    parameters: { aspectRatio: '4:3', steps: 35 },
  },

  // 产品类
  {
    id: 'product-shot',
    name: '产品主图',
    category: '产品',
    prompt: 'Professional product photography of {product}, white background, studio lighting, high key, clean, commercial quality, 8k',
    negativePrompt: 'background noise, shadows, reflections, low quality',
    parameters: { aspectRatio: '1:1', steps: 25 },
  },
  {
    id: 'lifestyle-shot',
    name: '生活方式',
    category: '产品',
    prompt: 'Lifestyle product photography of {product}, {setting}, natural lighting, aspirational mood, editorial style',
    negativePrompt: 'artificial, staged, low quality',
    parameters: { aspectRatio: '4:3', steps: 30 },
  },

  // 艺术类
  {
    id: 'digital-painting-landscape',
    name: '数字绘画-风景',
    category: '艺术',
    prompt: 'Digital painting of {scene}, {style}, dramatic lighting, detailed, trending on artstation, masterpiece',
    negativePrompt: 'photograph, low quality, amateur',
    parameters: { aspectRatio: '16:9', steps: 40 },
  },
  {
    id: 'concept-art',
    name: '概念设计',
    category: '艺术',
    prompt: 'Concept art of {subject}, {environment}, {style}, detailed, cinematic lighting, trending on artstation',
    negativePrompt: 'simple, plain, low quality',
    parameters: { aspectRatio: '16:9', steps: 45 },
  },

  // 动漫类
  {
    id: 'anime-character',
    name: '动漫角色',
    category: '动漫',
    prompt: '{anime_style} anime character of {character}, {pose}, {expression}, detailed, vibrant colors, high quality',
    negativePrompt: 'realistic, photorealistic, low quality anime',
    parameters: { aspectRatio: '3:4', steps: 35 },
  },
  {
    id: 'anime-scene',
    name: '动漫场景',
    category: '动漫',
    prompt: '{anime_style} anime scene of {location}, {time}, beautiful scenery, detailed background, cinematic composition',
    negativePrompt: 'realistic, photorealistic, low quality',
    parameters: { aspectRatio: '16:9', steps: 40 },
  },
];

// 提示词变量占位符
export const PROMPT_VARIABLES = {
  subject: '描述主体（如：a young woman, an elderly man）',
  character: '角色描述（如：a warrior, a magician）',
  character_name: '角色名称',
  outfit: '服装描述（如：wearing armor, in casual clothes）',
  pose: '姿态描述（如：standing confidently, sitting gracefully）',
  expression: '表情描述（如：with a smile, looking serious）',
  scene: '场景描述（如：a mystical forest, an ancient temple）',
  background: '背景描述（如：in a park, against sunset sky）',
  environment: '环境描述（如：surrounded by ruins, in a futuristic city）',
  weather: '天气描述（如：under golden sunset, in rainy atmosphere）',
  city_location: '城市地点（如：Tokyo streets, Paris alleyway）',
  time_of_day: '时间段（如：at night, during golden hour）',
  room_type: '房间类型（如：living room, modern kitchen）',
  furniture: '家具描述（如：with minimalist furniture, cozy seating area）',
  product: '产品描述（如：a luxury watch, a sneaker shoe）',
  setting: '环境设定（如：in a coffee shop, on a beach）',
  location: '地点（如：a magical library, an underwater city）',
  time: '时间（如：during cherry blossom season, at twilight）',
  anime_style: '动漫风格（如：Studio Ghibli style, typical shonen anime）',
};

// 负面提示词模板
export const NEGATIVE_PROMPT_TEMPLATES = {
  general: 'blurry, low quality, deformed, distorted, watermark, text, logo, signature',
  realistic: 'anime, cartoon, illustration, painting, drawing, sketch, lowres',
  anime: 'realistic, photorealistic, 3d render, photograph, human, person',
  portrait: 'extra limbs, extra fingers, deformed face, bad anatomy, bad proportions',
  architecture: 'empty, desolate, poorly designed, cluttered',
  product: 'background clutter, poor lighting, shadows, reflections',
};

// 风格增强词
export const STYLE_ENHANCERS = {
  cinematic: ', cinematic lighting, film grain, anamorphic lens flare, movie still',
  dramatic: ', dramatic lighting, high contrast, dark atmosphere, volumetric light',
  ethereal: ', ethereal, dreamy, soft focus, magical atmosphere, glowing',
  vibrant: ', vibrant colors, highly saturated, vivid, colorful palette',
  moody: ', moody, dark, atmospheric, desaturated colors, dramatic shadows',
  golden: ', golden hour, warm tones, soft shadows, golden light rays',
  neon: ', neon lights, cyberpunk aesthetic, glowing lights, night scene',
  minimalist: ', minimalist, clean, simple composition, lots of negative space',
};

// 质量增强词
export const QUALITY_ENHANCERS = [
  '8k resolution',
  'highly detailed',
  'ultra sharp',
  'professional quality',
  'masterpiece',
  'best quality',
  'hyperrealistic',
  'photorealistic',
  'cinematic quality',
  'award winning',
];

export default {
  PROMPT_TEMPLATES,
  PROMPT_VARIABLES,
  NEGATIVE_PROMPT_TEMPLATES,
  STYLE_ENHANCERS,
  QUALITY_ENHANCERS,
};
