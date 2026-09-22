const EXPLICIT_NON_CHINESE_CULTURE_RE =
  /(欧美|西方|外国|异域|日本|日式|东京|京都|大阪|韩国|韩式|首尔|纽约|洛杉矶|巴黎|伦敦|米兰|罗马|曼谷|印度|阿拉伯|中东|非洲|拉美|美式|英式|法式|欧式|赛博东京|武士|和风|哥特|维多利亚|中世纪欧洲|american|western|european|japanese|japan|tokyo|kyoto|korean|korea|seoul|new york|paris|london|milan|rome|bangkok|arab|middle east|african|latin|samurai|gothic|victorian)/i;

const CHINESE_DEFAULT_SUFFIX =
  ' default to Chinese/East Asian people, Chinese scenes, Chinese architecture, and authentic Chinese environments when the user does not explicitly specify another culture or country';

export function hasExplicitNonChineseCulture(text: string): boolean {
  return EXPLICIT_NON_CHINESE_CULTURE_RE.test(text);
}

export function applyChineseDefaultsToPrompt(prompt: string): string {
  const normalized = prompt.trim();
  if (!normalized || hasExplicitNonChineseCulture(normalized)) {
    return normalized;
  }

  if (normalized.toLowerCase().includes(CHINESE_DEFAULT_SUFFIX.trim().toLowerCase())) {
    return normalized;
  }

  const suffix = normalized.endsWith('.') || normalized.endsWith('!') || normalized.endsWith('?') ? '' : ',';
  return `${normalized}${suffix}${CHINESE_DEFAULT_SUFFIX}`;
}
