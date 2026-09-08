const EXPLICIT_NON_CHINESE_CULTURE_RE =
  /(欧美|西方|外国|异域|日本|日式|东京|京都|大阪|韩国|韩式|首尔|纽约|洛杉矶|巴黎|伦敦|米兰|罗马|曼谷|印度|阿拉伯|中东|非洲|拉美|美式|英式|法式|欧式|赛博东京|武士|和风|哥特|维多利亚|中世纪欧洲|american|western|european|japanese|japan|tokyo|kyoto|korean|korea|seoul|new york|paris|london|milan|rome|bangkok|arab|middle east|african|latin|samurai|gothic|victorian)/i;

const CULTURAL_DEFAULT_RULE = `【默认中国风规则】
- 当用户未明确指定其他国家、地域或文化背景时，默认采用中国风格、中国人、中国建筑、中国环境语境
- 默认应用中国风美学：中国人物形象、中式服饰（汉服/旗袍/中式现代服装）、中国建筑（亭台楼阁/徽派/四合院/现代中式）、中国场景元素
- 严禁出现"工笔画""工笔""水墨工笔"等工笔画风格描述词；如需传统东方韵味，请用服饰、场景、色彩、布景、光影、构图、展示风格来表达，例如汉服、亭台、青绿山水元素、朱砂红、月白、鎏金、电影级布光、商业海报展示风格
- 如果用户明确写了其他国家、城市、文化或民族风格，则严格按用户指定，不做中国化覆盖`;

export function hasExplicitNonChineseCulture(text: string): boolean {
  return EXPLICIT_NON_CHINESE_CULTURE_RE.test(text);
}

export function appendCulturalDefaultRule(prompt: string): string {
  const normalized = prompt.trim();
  if (!normalized || hasExplicitNonChineseCulture(normalized)) {
    return normalized;
  }

  if (normalized.includes(CULTURAL_DEFAULT_RULE)) {
    return normalized;
  }

  return `${normalized}\n\n${CULTURAL_DEFAULT_RULE}`;
}

export function getCulturalDefaultRule(text: string): string {
  return hasExplicitNonChineseCulture(text) ? '' : CULTURAL_DEFAULT_RULE;
}
