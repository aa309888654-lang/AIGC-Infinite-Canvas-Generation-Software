import type { Node } from '@xyflow/react';
import { getViteEnvValue } from '@/lib/vite-env';
import placeholderImage from '@/assets/dubbing-forest-bg.webp';

export type MockGenerationKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'storyboard'
  | 'grid'
  | 'panorama'
  | 'model3d'
  | 'data';

export interface MockNodeGenerationOptions {
  nodeId: string;
  nodeType?: string | null;
  label?: string | null;
  prompt?: string | null;
  params?: Record<string, unknown> | null;
  input?: Record<string, unknown>;
}

export interface MockNodeGenerationResult {
  kind: MockGenerationKind;
  title: string;
  prompt: string;
  resultUrl?: string;
  resultUrls?: string[];
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  outputText?: string;
  gridImageUrl?: string;
  coverImageUrl?: string;
  panoramaImageUrl?: string;
  storyboardPayload?: Record<string, unknown>;
  frameResults?: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  output: Record<string, unknown>;
}

const MOCK_IMAGE_URL = placeholderImage;
const MOCK_VIDEO_URL = '/sample-videos/1.mp4';
const MOCK_AUDIO_URL = 'mock://audio/generated-preview.wav';

export function isMockGenerationEnabled(params?: Record<string, unknown> | null): boolean {
  if (params?.mockGeneration === true || params?.mock === true || params?.devMock === true) return true;
  if (getViteEnvValue('VITE_AI_MOCK_GENERATION') === 'true') return true;
  if (typeof window === 'undefined') return false;

  const query = new URLSearchParams(window.location.search);
  return (
    query.get('mockGeneration') === '1' ||
    query.get('aiMock') === '1' ||
    query.get('posterMock') === '1' ||
    window.localStorage.getItem('ai_mock_generation') === '1' ||
    window.localStorage.getItem('poster_mock_generation') === '1'
  );
}

export function getMockImageUrl(): string {
  if (typeof window === 'undefined') return MOCK_IMAGE_URL;
  return new URL(MOCK_IMAGE_URL, window.location.origin).toString();
}

function getMockVideoUrl(): string {
  if (typeof window === 'undefined') return MOCK_VIDEO_URL;
  return new URL(MOCK_VIDEO_URL, window.location.origin).toString();
}

function normalizeNodeType(nodeType?: string | null): string {
  return String(nodeType || '').trim();
}

export function inferMockGenerationKind(nodeType?: string | null): MockGenerationKind {
  const type = normalizeNodeType(nodeType);
  const lower = type.toLowerCase();

  if (/storyboard|director|shot/.test(lower)) return 'storyboard';
  if (/text|prompt|script|copy/.test(lower)) return 'text';
  if (/video|compose/.test(lower)) return 'video';
  if (/audio|music|voice|tts/.test(lower)) return 'audio';
  if (/grid|collage|splitter/.test(lower)) return 'grid';
  if (/panorama|vr360|360/.test(lower)) return 'panorama';
  if (/3d|character|model/.test(lower)) return 'model3d';
  if (/image|poster|matting|inpaint|outpaint|gptimage|studio/.test(lower)) return 'image';

  return 'data';
}

function safePrompt(prompt?: string | null, fallback = '模拟生成测试内容'): string {
  const text = String(prompt || '').trim();
  return text || fallback;
}

function createFrameResults(baseUrl: string, prompt: string) {
  return Array.from({ length: 6 }, (_, index) => ({
    cellIndex: index,
    status: 'succeeded',
    imageUrl: baseUrl,
    prompt: `${prompt} / 镜头 ${index + 1}`,
  }));
}

export function buildMockNodeGenerationResult(options: MockNodeGenerationOptions): MockNodeGenerationResult {
  const kind = inferMockGenerationKind(options.nodeType);
  const timestamp = Date.now();
  const prompt = safePrompt(options.prompt);
  const label = options.label || options.nodeType || 'AI 节点';
  const imageUrl = getMockImageUrl();
  const videoUrl = getMockVideoUrl();
  const resultUrls = kind === 'image' || kind === 'grid' ? [imageUrl] : undefined;
  const title = `${label} Mock 生成`;

  const commonMetadata = {
    mock: true,
    provider: 'local-dev',
    model: 'mock-generation',
    generatedAt: timestamp,
    nodeId: options.nodeId,
    nodeType: options.nodeType || 'unknown',
    prompt,
    params: options.params || {},
  };

  if (kind === 'text') {
    const outputText = [
      `【Mock 文本】${prompt}`,
      '这是一段用于节点联调的模拟输出，可继续连接到图片、视频、配音或海报节点。',
      `生成时间：${new Date(timestamp).toLocaleString('zh-CN')}`,
    ].join('\n');
    return {
      kind,
      title,
      prompt,
      outputText,
      metadata: commonMetadata,
      output: { type: 'text', text: outputText, outputText, metadata: commonMetadata },
    };
  }

  if (kind === 'video') {
    return {
      kind,
      title,
      prompt,
      resultUrl: videoUrl,
      videoUrl,
      metadata: commonMetadata,
      output: { type: 'video', video: videoUrl, videoUrl, resultUrl: videoUrl, metadata: commonMetadata },
    };
  }

  if (kind === 'audio') {
    return {
      kind,
      title,
      prompt,
      resultUrl: MOCK_AUDIO_URL,
      audioUrl: MOCK_AUDIO_URL,
      metadata: commonMetadata,
      output: { type: 'audio', audio: MOCK_AUDIO_URL, audioUrl: MOCK_AUDIO_URL, resultUrl: MOCK_AUDIO_URL, metadata: commonMetadata },
    };
  }

  if (kind === 'storyboard' || kind === 'grid') {
    const frameResults = createFrameResults(imageUrl, prompt);
    const storyboardPayload = {
      title,
      prompt,
      scenes: frameResults.map((frame, index) => ({
        id: `mock-scene-${index + 1}`,
        title: `模拟镜头 ${index + 1}`,
        prompt: frame.prompt,
        imageUrl,
        duration: 4,
      })),
    };
    return {
      kind,
      title,
      prompt,
      resultUrl: imageUrl,
      resultUrls,
      imageUrl,
      gridImageUrl: imageUrl,
      coverImageUrl: imageUrl,
      frameResults,
      storyboardPayload,
      metadata: commonMetadata,
      output: { type: kind, image: imageUrl, imageUrl, resultUrl: imageUrl, frameResults, storyboardPayload, metadata: commonMetadata },
    };
  }

  if (kind === 'panorama') {
    return {
      kind,
      title,
      prompt,
      resultUrl: imageUrl,
      imageUrl,
      panoramaImageUrl: imageUrl,
      metadata: commonMetadata,
      output: { type: 'panorama', image: imageUrl, panoramaImageUrl: imageUrl, resultUrl: imageUrl, metadata: commonMetadata },
    };
  }

  if (kind === 'model3d') {
    return {
      kind,
      title,
      prompt,
      resultUrl: imageUrl,
      imageUrl,
      metadata: commonMetadata,
      output: { type: 'model3d', previewUrl: imageUrl, resultUrl: imageUrl, metadata: commonMetadata },
    };
  }

  if (kind === 'image') {
    const mode = String(options.params?.generationMode ?? '').toLowerCase();
    const inputRef =
      (typeof options.input?.referenceImage === 'string' && options.input.referenceImage) ||
      (typeof options.params?.referenceImage === 'string' && (options.params.referenceImage as string)) ||
      (Array.isArray(options.params?.referenceImages) ? (options.params.referenceImages as string[])[0] : undefined) ||
      undefined;

    // For upscale / reference / image-to-image, prefer the real input so
    // the canvas preview mirrors the connected source instead of a placeholder.
    const resolvedUrl =
      (mode === 'upscale' || mode === 'image_to_image' || mode === 'reference' || !!inputRef)
        ? (inputRef ?? imageUrl)
        : imageUrl;

    const resolvedUrls = [resolvedUrl];

    return {
      kind,
      title,
      prompt,
      resultUrl: resolvedUrl,
      resultUrls: resolvedUrls,
      imageUrl: resolvedUrl,
      metadata: {
        ...commonMetadata,
        mockUpscale: mode === 'upscale',
        usedInputImage: resolvedUrl !== imageUrl,
      },
      output: {
        type: 'image',
        image: resolvedUrl,
        imageUrl: resolvedUrl,
        resultUrl: resolvedUrl,
        resultUrls: resolvedUrls,
        metadata: {
          ...commonMetadata,
          mockUpscale: mode === 'upscale',
          usedInputImage: resolvedUrl !== imageUrl,
        },
      },
    };
  }

  return {
    kind,
    title,
    prompt,
    metadata: commonMetadata,
    output: { type: 'data', status: 'completed', metadata: commonMetadata },
  };
}

export function buildMockNodeGenerationResultForNode(node: Node, prompt?: string | null): MockNodeGenerationResult {
  const data = (node.data || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;

  // Collect any connected / upstream image URL so mock can echo it back.
  const referenceImage =
    (typeof data.referenceImage === 'string' && data.referenceImage) ||
    (typeof data.receivedImageUrl === 'string' && data.receivedImageUrl) ||
    (typeof data.sourceImageUrl === 'string' && data.sourceImageUrl) ||
    (typeof data.originalImageUrl === 'string' && data.originalImageUrl) ||
    (typeof data.imageUrl === 'string' && data.imageUrl) ||
    undefined;

  return buildMockNodeGenerationResult({
    nodeId: String(node.id),
    nodeType: node.type || String(data.type || ''),
    label: String(data.label || data.title || data.toolLabel || node.type || 'AI 节点'),
    prompt: prompt || String(params.prompt || data.prompt || data.text || data.content || data.script || ''),
    params,
    input: { referenceImage },
  });
}
