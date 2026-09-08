import type { OptimizationScenario } from '@/services/prompt-optimizer-api';

export interface PromptTemplateItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly modality: readonly OptimizationScenario[];
  readonly keywords: readonly string[];
  readonly tags: readonly string[];
  readonly prompt: string;
  readonly weight: number;
}

export interface PromptTemplateMatch {
  readonly template: PromptTemplateItem;
  readonly score: number;
}

export interface PromptTemplateMatchResult {
  readonly matches: readonly PromptTemplateMatch[];
  readonly context: string;
}

interface MatchPromptTemplatesOptions {
  readonly modality: Extract<OptimizationScenario, 'image' | 'video'>;
  readonly maxTemplates?: number;
}

const clearFacePrompt =
  '极高清人物面部特写，眼睛、虹膜高光、眼睑、睫毛、眉毛毛流、鼻梁、鼻翼、嘴唇、唇纹、嘴角、下颌线、颧骨和真实皮肤纹理全部清晰稳定，保留毛孔、细小绒毛、泪膜或胡茬等真实细节，避免低清、磨皮、塑料脸、五官漂移、脸部融化和动态模糊';

const videoStabilityPrompt =
  '视频生成必须保持同一角色身份一致，脸型、眼距、鼻型、嘴唇厚度、牙齿排列、下巴、发际线和肤色全程稳定；表情变化按真实演员节奏连续发生，帧间无闪烁、无变脸、无五官跳动、无眼球错位、无嘴巴撕裂';

const promptTemplates: readonly PromptTemplateItem[] = [
  {
    id: 'quality.face.ultra-clear',
    name: '极清晰五官',
    category: '清晰稳定',
    modality: ['image', 'video'],
    keywords: [
      '清晰',
      '高清',
      '超清',
      '4k',
      '8k',
      '细节',
      '五官',
      '脸',
      '面部',
      '特写',
      '人像',
      '肖像',
      '毛孔',
    ],
    tags: ['五官', '高清', '皮肤纹理', '人像'],
    prompt: clearFacePrompt,
    weight: 1.15,
  },
  {
    id: 'quality.video.identity-lock',
    name: '视频五官锁定',
    category: '清晰稳定',
    modality: ['video'],
    keywords: ['视频', '人物', '脸', '表情', '特写', '高清', '稳定', '一致', '不变脸'],
    tags: ['帧间稳定', '五官锁定', '抗闪烁'],
    prompt: videoStabilityPrompt,
    weight: 1.2,
  },
  {
    id: 'micro.tears.speed',
    name: '泪速控制',
    category: '参数精控',
    modality: ['video'],
    keywords: ['哭', '流泪', '眼泪', '泪珠', '含泪', '哭戏', '泪水', '泪痕'],
    tags: ['眼泪', '泪膜', '流速', '微表情'],
    prompt:
      '精准控制眼泪生成与流速：先在下眼睑形成透明泪膜，0.6秒后泪珠在内眼角聚集，1.2秒第一颗泪珠缓慢越过下眼睑，沿脸颊以每秒脸颊高度8%到12%的速度滑落，泪痕细窄透明，不喷涌、不糊脸，睫毛湿润和眼眶泛红保持清晰',
    weight: 1.1,
  },
  {
    id: 'micro.smile.curve',
    name: '嘴角微笑弧度',
    category: '参数精控',
    modality: ['image', 'video'],
    keywords: ['微笑', '笑', '笑容', '开心', '喜悦', '释然', '温柔', '嘴角'],
    tags: ['嘴角', '微笑', '弧度', '表情强度'],
    prompt:
      '精准控制嘴角微笑弧度：嘴角上扬2到5毫米，弧度约5到12度，先由眼神变柔触发，再带动颧大肌轻微抬起，左右嘴角允许1毫米以内自然不对称；笑容真实克制，避免咧嘴大笑、假笑、嘴角拉伸和唇形撕裂',
    weight: 1.05,
  },
  {
    id: 'micro.sadness.restrained-tears',
    name: '强忍泪意',
    category: '悲伤',
    modality: ['image', 'video'],
    keywords: ['悲伤', '难过', '伤心', '哭', '含泪', '委屈', '心碎', '失落'],
    tags: ['悲伤', '眼眶泛红', '克制', '泪膜'],
    prompt:
      '强忍泪意的高级微表情：内眉上扬并向中间靠拢，眼眶逐渐泛红，下眼睑积起薄薄水光但不立刻落泪，嘴角轻微下坠又试图恢复中性，嘴唇闭合并轻颤，喉咙轻轻吞咽，悲伤克制真实',
    weight: 1.0,
  },
  {
    id: 'micro.joy.tearful-smile',
    name: '含泪微笑',
    category: '喜悦',
    modality: ['image', 'video'],
    keywords: ['含泪微笑', '哭着笑', '释然', '感动', '感谢', '笑着哭'],
    tags: ['含泪', '微笑', '复杂情绪'],
    prompt:
      '含泪微笑特写：眼眶湿润但泪珠克制，下眼睑微红，内眉略微上扬，嘴角努力上扬却带轻微颤动，鼻翼有极细微抽动，笑容略不对称，呈现脆弱、感谢、忍耐和释然混合情绪',
    weight: 1.05,
  },
  {
    id: 'micro.anger.restrained',
    name: '压抑怒意',
    category: '愤怒',
    modality: ['image', 'video'],
    keywords: ['愤怒', '生气', '怒', '压抑', '忍耐', '冷怒', '咬牙'],
    tags: ['眉间', '咬肌', '下颌', '怒意'],
    prompt:
      '压抑愤怒面部特写：眉头向内下压，眉间形成细小纵纹，上眼睑压低，眼神变窄并固定，下颌咬紧，咬肌微微凸起，嘴唇压成薄线，鼻翼轻微扩张，怒意被强行压住但清晰可见',
    weight: 1.0,
  },
  {
    id: 'head.turn.slow',
    name: '缓慢转头',
    category: '头部特写',
    modality: ['video'],
    keywords: ['转头', '回头', '回眸', '侧脸', '看镜头', '扭头'],
    tags: ['转头', '头部特写', '眼神牵引'],
    prompt:
      '电影级头部特写，人物从三分之二侧脸缓慢转向镜头，转头幅度25到35度，持续1.8到2.4秒；动作先由眼神轻微移动开始，再带动头部和下颌缓慢旋转，颈部肌肉自然牵动，转头过程中五官清晰稳定',
    weight: 1.1,
  },
  {
    id: 'head.blink.natural',
    name: '自然眨眼特写',
    category: '头部特写',
    modality: ['video'],
    keywords: ['眨眼', '闭眼', '睁眼', '眼睛', '眼神', '含泪眨眼'],
    tags: ['眨眼', '眼睑', '眼神'],
    prompt:
      '自然眨眼包含完整时间结构：上眼睑在0.08到0.12秒内下落，下眼睑轻微上提，闭合停留约0.05秒，再在0.12到0.18秒内自然睁开；眨眼后眼神重新聚焦，睫毛阴影和眼睑褶皱清晰可见',
    weight: 1.0,
  },
  {
    id: 'head.gaze.avoidance',
    name: '眼神漂移回避',
    category: '头部特写',
    modality: ['image', 'video'],
    keywords: ['眼神', '回避', '心虚', '羞怯', '犹豫', '看向', '视线'],
    tags: ['眼神', '视线', '回避'],
    prompt:
      '视线先短暂接触目标，然后向左下或右下缓慢回避，再犹豫地重新聚焦；眉尾、下眼睑和嘴角产生细微连锁反应，适合心虚、羞怯、悲伤、回忆和隐忍情绪，双眼运动同步且虹膜高光稳定',
    weight: 0.95,
  },
  {
    id: 'face.female.natural-cinematic',
    name: '女性电影自然脸',
    category: '五官风格',
    modality: ['image', 'video'],
    keywords: ['女性', '女孩', '女人', '女生', '美女', '女主', '自然脸', '电影脸'],
    tags: ['女性', '自然', '电影感', '五官'],
    prompt:
      '极高清女性电影自然脸特写，五官真实不网红化：眼睛清澈有稳定虹膜高光，眼褶细节清晰，眉毛毛流分明，鼻梁柔和立体，鼻翼边缘干净，嘴唇有真实唇纹和自然血色，脸颊保留毛孔、细小绒毛和轻微肤色变化',
    weight: 1.05,
  },
  {
    id: 'face.female.cool-premium',
    name: '女性清冷高级脸',
    category: '五官风格',
    modality: ['image', 'video'],
    keywords: ['清冷', '高级脸', '冷艳', '女性', '女孩', '女主', '时尚'],
    tags: ['女性', '清冷', '高级', '五官'],
    prompt:
      '高清清冷高级女性五官，眼型偏长且眼神克制，眉峰利落但不过分锐利，鼻梁线条清晰，鼻尖自然，唇形薄厚适中、唇峰明确，下颌线干净，颧骨轻微立体，光线突出眼窝、鼻梁、唇线和脸部骨相',
    weight: 1.0,
  },
  {
    id: 'face.female.tearful-closeup',
    name: '女性哭戏特写脸',
    category: '五官风格',
    modality: ['image', 'video'],
    keywords: ['女性', '女孩', '哭戏', '哭', '含泪', '眼泪', '委屈'],
    tags: ['女性', '哭戏', '泪膜', '五官'],
    prompt:
      '女性哭戏高清五官控制，眼眶泛红、泪膜透明，下眼睑和内眼角水光清晰，眉尾轻微下坠，鼻翼轻颤，嘴唇闭合或轻微颤动，唇纹保持清楚，情绪脆弱但克制，避免眼泪糊脸、哭到五官崩坏',
    weight: 1.08,
  },
  {
    id: 'face.male.natural-cinematic',
    name: '男性电影自然脸',
    category: '五官风格',
    modality: ['image', 'video'],
    keywords: ['男性', '男人', '男孩', '男生', '男主', '自然脸', '电影脸'],
    tags: ['男性', '自然', '电影感', '五官'],
    prompt:
      '极高清男性电影自然脸特写，五官真实有生活感：眉毛毛流清晰，眼神稳定有层次，鼻梁和鼻翼结构明确，嘴唇纹理真实，下颌线和胡茬细节可见，皮肤保留毛孔、细纹和轻微瑕疵，像真实演员近景',
    weight: 1.05,
  },
  {
    id: 'face.male.mature-hard',
    name: '男性硬朗成熟脸',
    category: '五官风格',
    modality: ['image', 'video'],
    keywords: ['男性', '男人', '硬朗', '成熟', '冷峻', '大叔', '沧桑'],
    tags: ['男性', '硬朗', '成熟', '五官'],
    prompt:
      '高清硬朗成熟男性五官，眉骨和眼窝立体，眼神沉稳，鼻梁挺直，鼻翼厚度自然，嘴唇线条克制，下颌线清晰，咬肌和颈部线条有轻微张力；皮肤质感真实，可见胡茬、毛孔和细纹',
    weight: 1.0,
  },
  {
    id: 'face.male.restrained-tears',
    name: '男性哭戏克制脸',
    category: '五官风格',
    modality: ['image', 'video'],
    keywords: ['男性', '男人', '哭', '含泪', '哭戏', '悲伤', '忍住'],
    tags: ['男性', '哭戏', '克制', '泪膜'],
    prompt:
      '男性克制哭戏高清五官，眼眶微红，泪膜在下眼睑聚集但不夸张落下，眉间收紧，嘴唇压住轻颤，下颌咬紧后缓慢放松；胡茬、皮肤纹理、眼部水光和鼻翼轻颤清晰稳定，情绪强烈但不崩溃',
    weight: 1.08,
  },
  {
    id: 'image.portrait.cinematic-light',
    name: '图片电影人像光影',
    category: '图片构图',
    modality: ['image'],
    keywords: ['人像', '头像', '写真', '摄影', '特写', '肖像', '光影', '电影感'],
    tags: ['图片', '构图', '光影', '人像'],
    prompt:
      '静态图片使用电影级人像构图，85mm人像焦段，浅景深，眼睛精准对焦，柔和主光与细腻轮廓光塑造鼻梁、颧骨和下颌线，背景虚化干净，强调真实皮肤纹理、五官清晰度和高级光影层次，不加入视频时间轴',
    weight: 1.0,
  },
];

const synonymGroups: readonly (readonly string[])[] = [
  ['哭', '流泪', '眼泪', '泪珠', '含泪', '哭戏', '泪水', '泪痕', '委屈', '心碎'],
  ['笑', '微笑', '笑容', '开心', '喜悦', '释然', '温柔', '嘴角'],
  ['回头', '回眸', '转头', '侧脸', '看镜头', '扭头'],
  ['清晰', '高清', '超清', '4k', '8k', '细节', '毛孔', '锐利'],
  ['女性', '女孩', '女人', '女生', '美女', '女主'],
  ['男性', '男人', '男孩', '男生', '男主'],
  ['愤怒', '生气', '怒', '压抑', '冷怒', '忍耐'],
  ['眼神', '视线', '凝视', '回避', '心虚', '犹豫'],
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[，。！？、,.!?;；:："'“”‘’()[\]{}<>]/g, ' ');
}

function expandQueryTokens(input: string): Set<string> {
  const normalized = normalizeText(input);
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));

  for (const group of synonymGroups) {
    if (group.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      group.forEach((keyword) => tokens.add(keyword.toLowerCase()));
    }
  }

  return tokens;
}

function scoreTemplate(
  template: PromptTemplateItem,
  input: string,
  tokens: Set<string>,
  modality: Extract<OptimizationScenario, 'image' | 'video'>
): number {
  if (!template.modality.includes(modality)) return 0;

  const normalizedInput = normalizeText(input);
  let score = 0;

  for (const keyword of template.keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (normalizedInput.includes(normalizedKeyword) || tokens.has(normalizedKeyword)) {
      score += normalizedKeyword.length >= 3 ? 5 : 3;
    }
  }

  for (const tag of template.tags) {
    const normalizedTag = tag.toLowerCase();
    if (normalizedInput.includes(normalizedTag) || tokens.has(normalizedTag)) {
      score += 2.5;
    }
  }

  if (score === 0) return 0;
  score *= template.weight;
  if (template.category === '清晰稳定') score += modality === 'video' ? 3 : 2;
  if (modality === 'video' && ['头部特写', '参数精控'].includes(template.category)) score += 1;
  if (modality === 'image' && template.category === '图片构图') score += 2;

  return score;
}

function limitByCategory(
  matches: readonly PromptTemplateMatch[],
  perCategory: number
): PromptTemplateMatch[] {
  const counts = new Map<string, number>();
  const selected: PromptTemplateMatch[] = [];

  for (const match of matches) {
    const count = counts.get(match.template.category) || 0;
    if (count >= perCategory) continue;
    counts.set(match.template.category, count + 1);
    selected.push(match);
  }

  return selected;
}

function buildContext(
  matches: readonly PromptTemplateMatch[],
  modality: Extract<OptimizationScenario, 'image' | 'video'>
): string {
  if (matches.length === 0) {
    return modality === 'video'
      ? '未命中专用模板。请仅基于用户原始需求补全视频镜头、动作、光影、构图和连续性，不添加无关人物或情节。'
      : '未命中专用模板。请仅基于用户原始需求补全构图、光影、色调、材质和画面细节，不添加无关人物或主体。';
  }

  const lines = matches.map(
    (match, index) =>
      `${index + 1}. ${match.template.category}｜${match.template.name}：${match.template.prompt}`
  );
  const modeRule =
    modality === 'video'
      ? '当前是 AI 视频节点：请把模板能力融合成连续视频提示词，保留动作时序、镜头运动、表情变化、帧间稳定、五官锁定和抗闪烁要求。不要机械堆砌模板。'
      : '当前是 AI 图片节点：请把模板能力融合成静态图片提示词，强调构图、光影、五官清晰、皮肤质感和瞬间情绪；不要加入视频时间轴、帧间、流速或连续转场描述，除非用户明确要求动态瞬间。';

  return [
    '系统已根据用户原始提示词自动匹配以下专业模板能力，请自然融合进最终优化结果：',
    ...lines,
    modeRule,
    '必须保留用户原始主体、场景、风格与限制；合并重复表达；输出自然完整的最终提示词。',
  ].join('\n');
}

export function matchPromptTemplates(
  input: string,
  options: MatchPromptTemplatesOptions
): PromptTemplateMatchResult {
  const maxTemplates = options.maxTemplates ?? (options.modality === 'video' ? 8 : 6);
  const tokens = expandQueryTokens(input);
  const scored = promptTemplates
    .map((template) => ({
      template,
      score: scoreTemplate(template, input, tokens, options.modality),
    }))
    .filter((match) => match.score > 2)
    .sort((a, b) => b.score - a.score);

  const selected = limitByCategory(scored, 2).slice(0, maxTemplates);

  return {
    matches: selected,
    context: buildContext(selected, options.modality),
  };
}
