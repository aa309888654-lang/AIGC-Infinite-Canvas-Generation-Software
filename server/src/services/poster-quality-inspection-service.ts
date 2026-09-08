import axios from 'axios';
import { getApiProviderConfig } from '../routes/ai-provider';
import { logger } from '../utils/logger';
import { POSTER_WORKFLOW_VERSIONS } from '../config/poster-workflow-versions';

export interface PosterQualityInspectionInput {
  imageUrl: string;
  candidateId?: string;
  tier?: string;
  expectedText?: {
    title?: string;
    subtitle?: string;
    organizer?: string;
    date?: string;
    location?: string;
    contact?: string;
    cta?: string;
    description?: string;
    benefits?: string[];
    personName?: string;
    school?: string;
    company?: string;
    position?: string;
    companyDesc?: string;
    motto?: string;
    hometown?: string;
    birthday?: string;
    hobbies?: string;
    honors?: string;
  };
  brand?: {
    name?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    tone?: string;
  };
  localScore?: number;
}

export interface PosterQualityInspectionMetric {
  id: string;
  label: string;
  score: number;
  detail: string;
}

export interface PosterQualityInspectionIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  suggestedAction: string;
}

export interface PosterQualityInspectionResult {
  engine: {
    ocr: 'paddleocr' | 'vlm' | 'none';
    vlm: string | null;
  };
  ocrText: string;
  textAccuracyScore: number;
  overallScore: number;
  passed: boolean;
  retryRecommended: boolean;
  metrics: PosterQualityInspectionMetric[];
  issues: PosterQualityInspectionIssue[];
  suggestions: string[];
  rawVlm?: unknown;
  usedExternalAnalyzer: boolean;
  /** True when OCR/VLM is unavailable and the result is not a real pixel-quality verdict. */
  degraded: boolean;
  gates: Array<{
    name: 'input' | 'pixel' | 'business';
    status: 'passed' | 'failed' | 'degraded';
    score: number;
    detail: string;
  }>;
  ruleVersion: string;
}

interface VlmPosterInspectionJson {
  ocrText?: string;
  scores?: Partial<Record<'textAccuracy' | 'readability' | 'layoutCompliance' | 'brandConsistency' | 'visualBalance' | 'sharpness', number>>;
  issues?: Array<Partial<PosterQualityInspectionIssue>>;
  suggestions?: string[];
  overallScore?: number;
  retryRecommended?: boolean;
}

function clampScore(value: unknown, fallback = 75): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function collectExpectedText(input: PosterQualityInspectionInput): string[] {
  const expected = input.expectedText || {};
  return [
    expected.title,
    expected.subtitle,
    expected.organizer,
    expected.date,
    expected.location,
    expected.contact,
    expected.cta,
    expected.description,
    ...(Array.isArray(expected.benefits) ? expected.benefits : []),
    expected.personName,
    expected.school,
    expected.company,
    expected.position,
    expected.companyDesc,
    expected.motto,
    expected.hometown,
    expected.birthday,
    expected.hobbies,
    expected.honors,
    input.brand?.name,
  ].map((item) => String(item || '').trim()).filter(Boolean);
}

export function calculatePosterTextAccuracy(ocrText: string, expectedTexts: string[]): number {
  const normalizedOcr = normalizeText(ocrText);
  const normalizedExpected = expectedTexts.map(normalizeText).filter((item) => item.length >= 2);
  if (normalizedExpected.length === 0) return normalizedOcr ? 86 : 72;
  if (!normalizedOcr) return 35;

  const matched = normalizedExpected.filter((item) => normalizedOcr.includes(item));
  const partialMatched = normalizedExpected.filter((item) => {
    if (matched.includes(item)) return false;
    if (item.length < 4) return false;
    const probeLength = Math.max(2, Math.ceil(item.length * 0.55));
    return normalizedOcr.includes(item.slice(0, probeLength));
  });

  return clampScore(((matched.length + partialMatched.length * 0.55) / normalizedExpected.length) * 100, 72);
}

function extractJsonBlock(text: string): VlmPosterInspectionJson | null {
  const source = String(text || '').trim();
  if (!source) return null;
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || source.match(/\{[\s\S]*\}/)?.[0] || source;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' ? parsed as VlmPosterInspectionJson : null;
  } catch {
    return null;
  }
}

function normalizePaddleOcrResponse(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(normalizePaddleOcrResponse).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const direct = record.text || record.ocrText || record.fullText;
    if (typeof direct === 'string') return direct;
    const nested = record.data || record.result || record.results || record.texts || record.words;
    return normalizePaddleOcrResponse(nested);
  }
  return '';
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:')) return imageUrl;
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  const contentType = response.headers['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(response.data).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

async function callPaddleOcr(imageUrl: string): Promise<string | null> {
  const endpoint = process.env.PADDLE_OCR_ENDPOINT || process.env.POSTER_PADDLE_OCR_ENDPOINT;
  if (!endpoint) return null;

  try {
    const response = await axios.post(endpoint, { imageUrl, url: imageUrl }, { timeout: 45000 });
    const text = normalizePaddleOcrResponse(response.data).trim();
    if (text) return text;
  } catch (error) {
    logger.warn('[PosterQuality] PaddleOCR imageUrl call failed:', error instanceof Error ? error.message : String(error));
  }

  try {
    const dataUrl = await fetchImageAsBase64(imageUrl);
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const response = await axios.post(endpoint, { image: base64, imageBase64: base64 }, { timeout: 45000 });
    const text = normalizePaddleOcrResponse(response.data).trim();
    return text || null;
  } catch (error) {
    logger.warn('[PosterQuality] PaddleOCR base64 call failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function buildInspectionPrompt(input: PosterQualityInspectionInput, ocrText: string): string {
  const expectedTexts = collectExpectedText(input);
  return [
    '你是世界顶级商业海报质检总监。请严格检查这张海报成图，并只返回 JSON，不要输出 Markdown。',
    '检查维度：文字正确性、文字可读性、版式安全区、品牌一致性、视觉平衡、主体清晰度。',
    `质量档位：${input.tier || 'standard'}`,
    expectedTexts.length > 0 ? `原始应出现文字：${expectedTexts.join(' / ')}` : '原始应出现文字：未提供',
    input.brand ? `品牌信息：${JSON.stringify(input.brand)}` : '品牌信息：未提供',
    ocrText ? `外部 OCR 已识别文字：${ocrText}` : '外部 OCR 未返回文字，请你直接识别画面文字。',
    'JSON Schema: {"ocrText":"识别到的全部文字","scores":{"textAccuracy":0-100,"readability":0-100,"layoutCompliance":0-100,"brandConsistency":0-100,"visualBalance":0-100,"sharpness":0-100},"overallScore":0-100,"retryRecommended":boolean,"issues":[{"severity":"info|warning|error","title":"问题","detail":"说明","suggestedAction":"修复建议"}],"suggestions":["建议"]}',
  ].join('\n');
}

async function callOpenAICompatibleVision(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  imageContent: string;
  prompt: string;
}): Promise<string> {
  const response = await axios.post(
    options.endpoint,
    {
      model: options.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: options.prompt },
            { type: 'image_url', image_url: { url: options.imageContent } },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0.1,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      timeout: 60000,
    },
  );
  return String(response.data?.choices?.[0]?.message?.content || '').trim();
}

async function callPosterVlmInspection(input: PosterQualityInspectionInput, ocrText: string): Promise<{ model: string; parsed: VlmPosterInspectionJson } | null> {
  const imageContent = await fetchImageAsBase64(input.imageUrl).catch(() => input.imageUrl);
  const prompt = buildInspectionPrompt(input, ocrText);

  const qwenConfig = await getApiProviderConfig('aliyun');
  if (qwenConfig?.apiKey) {
    try {
      const content = await callOpenAICompatibleVision({
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        apiKey: qwenConfig.apiKey,
        model: 'qwen-vl-plus',
        imageContent,
        prompt,
      });
      const parsed = extractJsonBlock(content);
      if (parsed) return { model: 'qwen-vl-plus', parsed };
    } catch (error) {
      logger.warn('[PosterQuality] Qwen VL inspection failed:', error instanceof Error ? error.message : String(error));
    }
  }

  const doubaoConfig = await getApiProviderConfig('doubao');
  if (doubaoConfig?.apiKey) {
    try {
      const content = await callOpenAICompatibleVision({
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiKey: doubaoConfig.apiKey,
        model: 'doubao-vision',
        imageContent,
        prompt,
      });
      const parsed = extractJsonBlock(content);
      if (parsed) return { model: 'doubao-vision', parsed };
    } catch (error) {
      logger.warn('[PosterQuality] Doubao VL inspection failed:', error instanceof Error ? error.message : String(error));
    }
  }

  return null;
}

function toIssue(item: Partial<PosterQualityInspectionIssue>, index: number): PosterQualityInspectionIssue {
  const severity = item.severity === 'error' || item.severity === 'warning' || item.severity === 'info'
    ? item.severity
    : 'warning';
  return {
    id: `remote-${index + 1}`,
    severity,
    title: String(item.title || '远程质检提示'),
    detail: String(item.detail || item.title || '视觉模型发现需要复核的问题。'),
    suggestedAction: String(item.suggestedAction || '根据质检建议调整布局或触发精修。'),
  };
}

function buildMetrics(scores: VlmPosterInspectionJson['scores'], textAccuracyScore: number): PosterQualityInspectionMetric[] {
  return [
    { id: 'remote_ocr_text_accuracy', label: 'OCR文字准确性', score: textAccuracyScore, detail: '基于 PaddleOCR/VLM OCR 与原始槽位文本比对。' },
    { id: 'remote_readability', label: 'VLM文字可读性', score: clampScore(scores?.readability, textAccuracyScore), detail: '视觉模型评估文字和背景对比度、可读性。' },
    { id: 'remote_layout_compliance', label: 'VLM版式合规', score: clampScore(scores?.layoutCompliance), detail: '视觉模型评估安全区、对齐、信息层级。' },
    { id: 'remote_brand_consistency', label: 'VLM品牌一致性', score: clampScore(scores?.brandConsistency), detail: '视觉模型评估品牌色、风格和识别一致性。' },
    { id: 'remote_visual_balance', label: 'VLM视觉平衡', score: clampScore(scores?.visualBalance), detail: '视觉模型评估留白、重心和画面层次。' },
    { id: 'remote_sharpness', label: 'VLM主体清晰度', score: clampScore(scores?.sharpness), detail: '视觉模型评估主体边缘、噪点和清晰交付质量。' },
  ];
}

export async function inspectPosterQuality(input: PosterQualityInspectionInput): Promise<PosterQualityInspectionResult> {
  const expectedTexts = collectExpectedText(input);
  const paddleText = await callPaddleOcr(input.imageUrl);
  const vlm = await callPosterVlmInspection(input, paddleText || '');
  const vlmText = String(vlm?.parsed.ocrText || '').trim();
  const ocrText = (paddleText || vlmText || '').trim();
  const textAccuracyScore = clampScore(
    vlm?.parsed.scores?.textAccuracy,
    calculatePosterTextAccuracy(ocrText, expectedTexts),
  );
  const metrics = buildMetrics(vlm?.parsed.scores, textAccuracyScore);
  const metricAverage = clampScore(metrics.reduce((sum, item) => sum + item.score, 0) / metrics.length);
  const overallScore = clampScore(vlm?.parsed.overallScore, Math.round(metricAverage * 0.82 + textAccuracyScore * 0.18));
  const issues = (vlm?.parsed.issues || []).map(toIssue);

  if (textAccuracyScore < 60) {
    issues.unshift({
      id: 'ocr-text-mismatch',
      severity: 'error',
      title: 'OCR文字不匹配',
      detail: ocrText ? `识别文字与原始槽位匹配度较低：${ocrText.slice(0, 160)}` : '未识别到可靠文字。',
      suggestedAction: '保留原始中文文案，增强文字准确性约束后使用豆包 Seedream 5.0 Pro 重新生成或定向精修。',
    });
  }

  const retryRecommended = Boolean(vlm?.parsed.retryRecommended)
    || overallScore < (input.tier === 'premium_print' ? 84 : 76)
    || issues.some((item) => item.severity === 'error');

  const degraded = !vlm;
  if (degraded) {
    issues.unshift({
      id: 'quality-inspection-degraded',
      severity: 'warning',
      title: '真实像素质检不可用',
      detail: paddleText
        ? 'PaddleOCR 仅完成文字识别，VLM 未返回版式与视觉结果，当前报告不能作为完整质量结论。'
        : 'PaddleOCR 与 VLM 均未返回有效结果，当前报告不能替代真实文字和版式检查。',
      suggestedAction: '恢复 OCR/VLM 服务后重新质检；在恢复前不要将该分数作为发布门槛。',
    });
  }

  const inputScore = expectedTexts.length > 0 ? 100 : 70;
  const pixelScore = Math.round((textAccuracyScore + metrics[1].score + metrics[5].score) / 3);
  const businessScore = Math.round((metrics[2].score + metrics[3].score + metrics[4].score) / 3);
  const pixelThreshold = input.tier === 'premium_print' ? 84 : 76;
  const businessThreshold = input.tier === 'premium_print' ? 82 : 74;
  const gates: PosterQualityInspectionResult['gates'] = [
    {
      name: 'input',
      status: expectedTexts.length > 0 ? 'passed' : 'failed',
      score: inputScore,
      detail: expectedTexts.length > 0 ? '必需文案和质检输入完整。' : '缺少可核验的必需文案。',
    },
    {
      name: 'pixel',
      status: degraded ? 'degraded' : pixelScore >= pixelThreshold ? 'passed' : 'failed',
      score: pixelScore,
      detail: degraded ? 'VLM 不可用，无法完成完整像素质量判断。' : '基于 OCR 文字准确率、可读性与清晰度。',
    },
    {
      name: 'business',
      status: degraded ? 'degraded' : businessScore >= businessThreshold ? 'passed' : 'failed',
      score: businessScore,
      detail: degraded ? 'VLM 不可用，无法完成品牌与版式判断。' : '基于版式、品牌一致性与视觉平衡。',
    },
  ];
  const allGatesPassed = gates.every((gate) => gate.status === 'passed');

  return {
    engine: {
      ocr: paddleText ? 'paddleocr' : vlmText ? 'vlm' : 'none',
      vlm: vlm?.model || null,
    },
    ocrText,
    textAccuracyScore,
    overallScore,
    passed: !retryRecommended && allGatesPassed,
    retryRecommended: retryRecommended || !allGatesPassed,
    metrics,
    issues,
    suggestions: Array.isArray(vlm?.parsed.suggestions) ? vlm!.parsed.suggestions!.map(String).slice(0, 6) : [],
    rawVlm: vlm?.parsed,
    usedExternalAnalyzer: Boolean(paddleText || vlm),
    degraded,
    gates,
    ruleVersion: POSTER_WORKFLOW_VERSIONS.qualityRules,
  };
}
