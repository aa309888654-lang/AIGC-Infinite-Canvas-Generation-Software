import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { NodeProps } from '@xyflow/react';
import {
  Aperture,
  ArrowUp,
  Camera,
  ChevronDown,
  Copy,
  Download,
  Film,
  Focus,
  Grid2X2,
  Image as ImageIcon,
  ImageDown,
  ImageUp,
  ImagePlus,
  Layers,
  Languages,
  Loader2,
  Maximize2,
  Minimize2,
  Move3D,
  Paintbrush,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap,
  Scissors,
  Search,
  Settings2,
} from 'lucide-react';
import AICGUnifiedIOHandles from './AICGUnifiedIOHandles';
import { AICGNodeTopCornerActions } from './AICGNodeShell';
import { NodePointsBadge } from './NodePointsBadge';
import { resolveImageNodePoints } from './image-node-points';
import { pointsConfigService } from '@/services/membership/points-config-service';
import { useMembershipStore } from '@/store/useMembershipStore';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { canvasStoreApi, useCanvasStore } from '@/store/useCanvasStore';
import { useFileStore } from '@/store/useFileStore';
import { CANVAS_NODE_BASE_WIDTH } from '@/lib/canvas-node-dimensions';
import { cn, safeOpen } from '@/lib/utils';
import { toast } from 'sonner';
import {
  buildClipEditorUrl,
  sendCanvasMediaToClipEditor,
} from '@/services/canvas-clip-bridge-service';
import { spawnControllerToolNode } from '@/services/node-controller-action-service';
import { persistGeneratedCanvasUrl } from '@/services/canvas-asset-actions';
import { useNodeModels } from '@/hooks/useNodeModels';
import { useAppPanelStore } from '@/store/useAppPanelStore';
import type { UnifiedModelConfig } from '@/services/unified-api-model-service';
import { modelRegistry } from '@/services/model-registry';
import { getModelSupportedResolutions } from '@/config/model-resolutions';
import { getModelIconConfig } from '@/config/model-icons';
import { promptOptimizerService, classifyPromptAgent } from '@/services/prompt-optimizer-api';
import { DEFAULT_CHINA_IMAGE_OPTIMIZATION_CONTEXT } from '@/services/image-prompt-optimization-context';
import { matchPromptTemplates } from '@/lib/prompt-template-matcher';
import { checkQuotaOrFail } from '@/lib/quota-helper';
import { usePermission } from '@/hooks/usePermission';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { getSafeRenderableMediaUrl, normalizeMediaUrl } from '@/lib/media-url';
import {
  isImageProviderHiddenForMembership,
  isImageModelHiddenForMembership,
} from '@/lib/ai-image-membership';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { resolveWatermarkSetting } from '@/lib/watermark-policy';
import { confirm as confirmAction } from '@/components/ui/ConfirmDialog';
import { smartMattingEngine } from '@/services/smart-matting-service';
import {
  hasChineseText,
  translatePromptToChinese,
  translatePromptToEnglish,
} from '@/lib/prompt-auto-translation';
import {
  AI_IMG,
  NC_ICON_CLASS,
  NC_ICON_STROKE,
  aiImgActionBtn,
  aiImgChip,
  aiImgGenerateBtn,
  aiImgIconBtn,
  aiImgOptionBtn,
  aiImgToolbarBtn,
  aiImgTryBtn,
} from './ai-image-node-ui';
import SeedreamInteractiveEditor, { type SeedreamAnnotation } from './SeedreamInteractiveEditor';

const DEFAULT_NEGATIVE_PROMPT =
  '多手，手指不清晰，手部畸形，多余手指，缺失手指，融合手指，多余肢体，肢体畸形，人体结构错误，脸部变形，五官扭曲，眼睛异常，低清晰度，模糊，噪点，画面撕裂，画面闪烁，压缩痕迹，水印，文字，logo，签名，裁切错误，构图杂乱，重复主体，颜色异常, extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, bad anatomy, distorted face, low quality, blurry, noisy, tearing, flickering, watermark, text, logo';
const DEFAULT_AI_IMAGE_MODEL_ID = 'doubao-seedream-5-0-lite';
const DEFAULT_AI_IMAGE_MODEL_PROVIDER = 'doubao';

// 模型专用负向提示词 - 与后端 prompt-enhancer.ts 保持一致
const MODEL_NEGATIVE_PROMPTS: Record<string, string> = {
  // SenseNova U1 Fast - 擅长信息图与写实场景
  'sensenova-u1-fast':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra hands, missing hands, extra arms, missing arms, deformed arms, twisted arms, broken arms, abnormal limbs, extra limbs, missing limbs, extra legs, missing legs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, deformed eyes, bad teeth, deformed ears, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, JPEG artifacts, banding, watermark, text, logo, signature, copyright, brand name, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, symmetrical errors, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors',
  // StepFun Image Edit 2 - 擅长图片编辑与文生图
  'step-image-edit-2':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, deformed features, unwanted changes, inconsistent style, style drift, lost details, blurred details, over-smoothed texture, color shift, hue distortion, tone mismatch, low quality, blurry, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, compression artifacts, banding, color banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, duplicate elements, cloned regions, tiling artifacts, seams, stitching marks, edge artifacts, oversharpened, over-processed, artificial look, plastic skin, waxy texture, porcelain skin, doll-like',
  // Agnes Image 2.1 Flash - API 不支持 negative_prompt，负向内容由后端嵌入正向提示词
  'agnes-image-2.1-flash':
    'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural expression, low quality, blurry, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored errors, oversaturated, unnatural colors, color cast, washed out, compression artifacts, JPEG artifacts, banding',
  // 豆包 Seedream 5.0 Pro - 通用文生图
  'doubao-seedream-5-0-pro':
    'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, low quality, blurry, pixelated, noisy, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, oversaturated, unnatural colors, washed out, overexposed, underexposed, bad lighting, harsh shadows',
  // Seedream 5.0 Lite - 写实与艺术
  'doubao-seedream-5-0-lite':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, deformed ears, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, doll-like, over-processed',
  // Seedream 5.0 Pro - 专业级精准编辑（备用通道）
  'doubao-seedream-5-0-pro-edit':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, deformed ears, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, doll-like, over-processed',
  // 豆包 Seedream 5.0 Pro（原 nanoBanana 系列） - 通用高质量文生图
  'doubao-seedream-5-0-pro-nano':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, deformed features, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, compression artifacts, JPEG artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, over-processed, artificial look, plastic skin, porcelain skin',
  'doubao-seedream-5-0-lite-nano':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, deformed features, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, compression artifacts, JPEG artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, over-processed, artificial look, plastic skin, porcelain skin',
  'doubao-seedream-5-0-pro-nano-pro':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, deformed features, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, compression artifacts, JPEG artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, over-processed, artificial look, plastic skin, porcelain skin',
  // Wan2.7 - 万象文生图
  'Wan2.7_image':
    'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, low quality, blurry, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, watermark, text, logo, signature, copyright, cropped, out of frame, bad composition, oversaturated, unnatural colors, washed out, duplicate, cloned',
  // 豆包 Seedream 5.0 lite - 替代原国外模型
  'doubao-seedream-5-0-lite-grok':
    'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, low quality, blurry, pixelated, noisy, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, oversaturated, unnatural colors, washed out, overexposed, underexposed',
  // FLUX 系列
  'flux-2-pro':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, over-processed, artificial look',
  'flux-2-flex':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, over-processed, artificial look',
  'flux-2-dev':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, over-processed, artificial look',
  'flux-kontext-dev':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, over-processed, artificial look',
  'flux-kontext-pro':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, over-processed, artificial look',
  'flux-kontext-max':
    'extra fingers, missing fingers, fused fingers, deformed fingers, malformed hands, bad hands, extra limbs, missing limbs, bad anatomy, deformed body, distorted proportions, distorted face, asymmetrical face, bad eyes, crossed eyes, unnatural facial expression, low quality, blurry, out of focus, pixelated, noisy, grainy, overexposed, underexposed, bad lighting, harsh shadows, compression artifacts, banding, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, cluttered, duplicate, cloned, mirrored, oversaturated, undersaturated, unnatural colors, color cast, washed out, dull colors, plastic skin, waxy texture, over-processed, artificial look',
  // Midjourney
  midjourney:
    'extra fingers, missing fingers, deformed fingers, malformed hands, bad anatomy, deformed body, distorted face, asymmetrical face, bad eyes, crossed eyes, low quality, blurry, pixelated, noisy, watermark, text, logo, signature, copyright, cropped, out of frame, cut off, bad composition, oversaturated, unnatural colors, washed out, duplicate, cloned, overexposed, underexposed, bad lighting',
};

/** 根据模型 ID 获取专用负向提示词 */
function getModelNegativePrompt(modelId: string): string {
  // 精确匹配
  if (MODEL_NEGATIVE_PROMPTS[modelId]) return MODEL_NEGATIVE_PROMPTS[modelId];
  // 前缀匹配（处理 flux-kontext-* 等变体）
  const lower = modelId.toLowerCase();
  if (lower.startsWith('flux')) return MODEL_NEGATIVE_PROMPTS['flux-2-pro'];
  if (lower.includes('seedream') || lower.includes('doubao'))
    return MODEL_NEGATIVE_PROMPTS['doubao-seedream-5-0-lite'];
  if (lower.includes('midjourney') || lower === 'mj') return MODEL_NEGATIVE_PROMPTS['midjourney'];
  return DEFAULT_NEGATIVE_PROMPT;
}

const AI_IMAGE_PREVIEW_HEIGHT = Math.round((CANVAS_NODE_BASE_WIDTH * 9) / 16);
const LENS_OPTIONS = [
  'Panavision DXL2',
  'Arri Signature Prime',
  'Cooke S8/i',
  'Zeiss Supreme Prime',
];
const CAMERA_OPTIONS = ['ARRI ALEXA 35', 'Panavision DXL2', 'RED V-RAPTOR XL', 'Sony Venice 2'];
const FOCAL_OPTIONS = [14, 24, 35, 50, 85, 135];
const APERTURE_OPTIONS = ['f/1.4', 'f/2', 'f/2.8', 'f/4', 'f/5.6'];
const QUALITY_LABELS: Record<string, string> = {
  standard: '标准画质',
  medium: '中等画质',
  high: '高画质',
  ultra: '超高画质',
};

type ImageMode =
  | 'text_to_image'
  | 'image_to_image'
  | 'reference'
  | 'upscale'
  | 'inpaint'
  | 'outpaint';
type ReferenceKind = 'style' | 'color' | 'character' | 'structure' | 'remix' | 'mask';
type ImageField =
  | 'aspectRatio'
  | 'imageSize'
  | 'imageCount'
  | 'quality'
  | 'style'
  | 'steps'
  | 'cfgScale'
  | 'seed'
  | 'promptEnhancer'
  | 'negativePrompt'
  | 'background';

type PanelKey = 'model' | 'ratio' | 'camera' | 'advanced' | 'count' | null;

export interface AIImageModelPreset {
  id: string;
  resolutionModelId?: string;
  providerModel?: string;
  isCustomModel?: boolean;
  isBuiltIn?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
  isConfigured?: boolean;
  isAvailable?: boolean;
  label: string;
  provider: string;
  shortLabel: string;
  badge?: string;
  modes: ImageMode[];
  fields: ImageField[];
  aspectRatios?: string[];
  imageSizes?: string[];
  countOptions?: number[];
  referenceKinds?: ReferenceKind[];
  capabilityTags?: string[];
  note?: string;
  defaults: Record<string, unknown>;
}

interface ReferenceAsset {
  id: string;
  url: string;
  name?: string;
  weight: number;
  source?: 'manual' | 'result' | 'input';
}

type AIImageReferences = Partial<Record<ReferenceKind, ReferenceAsset[]>>;

interface ImageMaterialCandidate {
  id: string;
  name: string;
  token: string;
  url: string;
  previewUrl: string;
  source: '已连接' | '画布' | '我的作品';
}

interface MaterialMentionState {
  start: number;
  end: number;
  query: string;
  open: boolean;
}

const EMPTY_MATERIAL_MENTION: MaterialMentionState = {
  start: -1,
  end: -1,
  query: '',
  open: false,
};

const IMAGE_MATERIAL_NODE_TYPES = new Set([
  'aiImage',
  'aicgImageGen',
  'imageGen',
  'imageInput',
  'unifiedImageStudio',
  'borderlessImageGen',
  'seedream',
  'advancedImageGen',
  'gridDirector',
  'imageCollage',
]);

function normalizeMaterialName(value: string) {
  return (
    value
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .slice(0, 24) || '图片素材'
  );
}

function getModelReferenceImageLimit(model: AIImageModelPreset): number {
  const normalizedId = model.id.toLowerCase().replace(/\./g, '-');
  if (normalizedId.includes('seedream-5-0-pro')) return 10;
  if (normalizedId.includes('seedream-5-0')) return 14;
  return 4;
}

function findMaterialMention(value: string, caretPosition: number): MaterialMentionState {
  if (caretPosition < 0) return EMPTY_MATERIAL_MENTION;
  const beforeCaret = value.slice(0, caretPosition);
  const match = beforeCaret.match(/@([^\s@]*)$/);
  if (!match) return EMPTY_MATERIAL_MENTION;
  const start = beforeCaret.lastIndexOf('@');
  return start < 0
    ? EMPTY_MATERIAL_MENTION
    : { start, end: caretPosition, query: match[1] || '', open: true };
}

interface AIImageNodeData {
  type?: 'aiImage';
  label?: string;
  prompt?: string;
  modelId?: string;
  params?: Record<string, unknown>;
  source?: string;
  openPromptOnCreate?: boolean;
  autoExpandPrompt?: boolean;
  references?: AIImageReferences;
  imageUrl?: string;
  resultUrl?: string;
  resultUrls?: string[];
  resultAssetId?: string;
  task?: {
    status?: 'idle' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
    resultUrl?: string;
    resultUrls?: string[];
  };
}

type AIImageParams = Record<string, unknown> & {
  generationMode: ImageMode;
  prompt: string;
  modelId: string;
  modelProvider: string;
  aspectRatio?: string;
  imageSize?: string;
  imageCount?: number;
  negativePrompt?: string;
  promptEnhancer?: boolean;
  webSearch?: boolean;
  seedreamCapability?: string;
  seedreamOptimizeMode?: 'standard' | 'fast';
  seedreamAnnotations?: SeedreamAnnotation[];
  sequentialImageGeneration?: 'auto' | 'disabled';
  sequentialMaxImages?: number;
  outputFormat?: 'jpeg' | 'png';
  watermark?: boolean;
  references?: AIImageReferences;
};

const IMAGE_MODE_LABELS: Record<ImageMode, string> = {
  text_to_image: '文生图',
  image_to_image: '图生图',
  reference: '图片参考',
  upscale: '图片高清',
  inpaint: '局部重绘',
  outpaint: '扩图',
};

const IMAGE_MODE_HELP: Record<ImageMode, string> = {
  text_to_image: '只用提示词生成新画面',
  image_to_image: '基于输入图重绘或变化',
  reference: '使用多张参考图匹配风格、角色和构图',
  upscale: '提升图片清晰度与细节',
  inpaint: '使用遮罩修复局部区域',
  outpaint: '向画面外扩展内容',
};

const IMAGE_MODE_ICONS: Record<ImageMode, React.ReactNode> = {
  text_to_image: <Wand2 className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />,
  image_to_image: <ImagePlus className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />,
  reference: <Layers className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />,
  upscale: <ImageUp className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />,
  inpaint: <Paintbrush className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />,
  outpaint: <ImageDown className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />,
};

const IMAGE_MODE_FIELDS: Record<ImageMode, ImageField[]> = {
  text_to_image: [
    'aspectRatio',
    'imageSize',
    'imageCount',
    'style',
    'quality',
    'promptEnhancer',
    'negativePrompt',
    'seed',
  ],
  image_to_image: [
    'aspectRatio',
    'imageSize',
    'imageCount',
    'style',
    'cfgScale',
    'promptEnhancer',
    'negativePrompt',
    'seed',
  ],
  reference: [
    'aspectRatio',
    'imageSize',
    'imageCount',
    'style',
    'cfgScale',
    'promptEnhancer',
    'negativePrompt',
    'seed',
  ],
  upscale: ['imageSize', 'quality'],
  inpaint: ['aspectRatio', 'imageSize', 'style', 'cfgScale', 'promptEnhancer', 'seed'],
  outpaint: ['aspectRatio', 'imageSize', 'style', 'cfgScale', 'promptEnhancer', 'seed'],
};

const IMAGE_MODEL_PRESETS: AIImageModelPreset[] = [
  {
    id: 'doubao-seedream-5-0-pro',
    label: '小天4 豆包 Seedream 5.0 Pro',
    shortLabel: '小天4 豆包 Seedream 5.0 Pro',
    provider: 'doubao',
    badge: '默认',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'style', 'background'],
    aspectRatios: ['auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '21:9'],
    imageSizes: ['1K', '2K', '3840x2160'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['默认生图', '海报生成', '多图组合'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '3840x2160',
      imageCount: 1,
      quality: 'high',
      style: 'vivid',
      background: 'opaque',
    },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro',
    shortLabel: '豆包 Seedream 5.0 Pro',
    provider: 'doubao',
    badge: '小天6',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    imageSizes: ['2K', '4K'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['独立通道', '4K高清', '参考图'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '2K',
      imageCount: 1,
    },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro',
    shortLabel: '豆包 Seedream 5.0 Pro',
    provider: 'doubao',
    badge: '小天6',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    imageSizes: ['2K', '4K'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['独立通道', '专业图像', '参考图'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '2K',
      imageCount: 1,
    },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro 4K',
    shortLabel: '豆包 Seedream 5.0 Pro 4K',
    provider: 'doubao',
    badge: '小天6',
    modes: ['text_to_image'],
    fields: ['aspectRatio', 'imageSize', 'quality', 'style', 'background'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
    imageSizes: ['4096x4096', '3840x2160', '2160x3840', '4096x3072', '3072x4096'],
    countOptions: [1],
    capabilityTags: ['独立通道', '4K高清', '高质量'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '3840x2160',
      imageCount: 1,
      quality: 'high',
      style: 'vivid',
      background: 'opaque',
    },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '小天8 豆包 Seedream 5.0 Pro（1k）',
    shortLabel: '小天8 豆包 Seedream 5.0 Pro（1k）',
    provider: 'doubao',
    badge: '小天8',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'style', 'background'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
    imageSizes: ['1024x1024', '1536x1024', '1024x1536'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['1K高清', '文生图', '图生图', '参考图'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '1024x1024',
      imageCount: 1,
      quality: 'high',
      style: 'vivid',
      background: 'opaque',
    },
  },
  {
    id: 'doubao-seedream-5-0-lite',
    label: '豆包 Seedream 5.0 Lite',
    shortLabel: '豆包 Seedream 5.0 Lite',
    provider: 'doubao',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'promptEnhancer'],
    aspectRatios: ['auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5'],
    imageSizes: ['2K', '3K', '4K'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['指令遵循', '信息图', '多图融合', '组图输出', '联网搜索', '14张参考图'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '2K',
      imageCount: 1,
      style: 'photoreal',
      cfgScale: 7,
      promptEnhancer: true,
      seedreamCapability: 'auto',
      sequentialImageGeneration: 'disabled',
      sequentialMaxImages: 6,
      outputFormat: 'jpeg',
      seed: -1,
    },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro',
    shortLabel: '豆包 Seedream 5.0 Pro',
    provider: 'doubao',
    modes: ['text_to_image', 'image_to_image', 'reference', 'inpaint', 'outpaint'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'promptEnhancer'],
    aspectRatios: ['auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '21:9'],
    imageSizes: ['1K', '2K'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix', 'mask'],
    capabilityTags: [
      '精准交互编辑',
      '点选与框选',
      '图层分离',
      '多图融合',
      '10张参考图',
      '原生多语种文字',
    ],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '2K',
      imageCount: 1,
      style: 'photoreal',
      cfgScale: 7.5,
      promptEnhancer: true,
      seedreamCapability: 'auto',
      sequentialImageGeneration: 'disabled',
      sequentialMaxImages: 6,
      outputFormat: 'jpeg',
      seed: -1,
    },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: 'Nano Banana 2 (小天)',
    shortLabel: 'Nano Banana 2 (小天)',
    provider: 'doubao',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize'],
    aspectRatios: ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
    imageSizes: ['1K', '2K', '4K'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['4K高清', '14张参考图'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '1K',
    },
  },
  {
    id: 'doubao-seedream-5-0-lite',
    label: 'Nano Banana 2 Lite (小天)',
    shortLabel: 'Nano Banana 2 Lite (小天)',
    provider: 'doubao',
    badge: 'Lite',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize'],
    aspectRatios: ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
    imageSizes: ['1K'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['轻量快速', '多参考图'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '1K',
      imageCount: 1,
      style: 'photoreal',
      cfgScale: 7,
      promptEnhancer: true,
      seed: -1,
    },
  },
  {
    id: 'Wan2.7_image',
    label: 'Wan2.7 (小天)',
    shortLabel: 'Wan2.7 (小天)',
    provider: 'doubao',
    badge: 'PS',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'negativePrompt', 'promptEnhancer', 'seed'],
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['一句话PS', '反向提示词', '智能改写'],
    defaults: {
      aspectRatio: '16:9',
      imageCount: 1,
      promptEnhancer: true,
      seed: -1,
    },
  },
  {
    id: 'doubao-seedream-5-0-lite',
    label: '豆包 Seedream 5.0 lite (小天)',
    shortLabel: '豆包 Seedream 5.0 lite (小天)',
    provider: 'doubao',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio'],
    aspectRatios: ['2:3', '3:2', '1:1', '16:9', '9:16'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['快速生成', '参考图'],
    defaults: {
      aspectRatio: '16:9',
    },
  },
];

/**
 * AI 图片节点对用户只暴露能力档位；每个档位由后端按健康状态选择真实渠道。
 * 不把小天渠道逐一堆在菜单里，避免用户在密钥、限流或失效时手动反复切换。
 */
const FEATURED_IMAGE_MODEL_PRESETS: AIImageModelPreset[] = [
  {
    id: 'hidream-o1-image-1.5',
    providerModel: 'HiDream-O1-Image-1.5',
    label: 'HiDream-O1-Image-1.5',
    shortLabel: 'HiDream-O1-Image-1.5',
    provider: 'hidream',
    badge: '旗舰',
    isBuiltIn: true,
    isPopular: true,
    isFeatured: true,
    isConfigured: false,
    isAvailable: false,
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'promptEnhancer'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    imageSizes: ['1K', '2K'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'character', 'structure', 'remix'],
    capabilityTags: ['热门', '旗舰', '高质量'],
    defaults: { aspectRatio: '16:9', imageSize: '2K', imageCount: 1, quality: 'high', promptEnhancer: true },
  },
  {
    id: 'hunyuan-image-3.0-instruct',
    providerModel: 'Hunyuan-Image-3.0-Instruct',
    label: 'Hunyuan-Image-3.0-Instruct',
    shortLabel: 'Hunyuan-Image-3.0-Instruct',
    provider: 'hunyuan',
    badge: '旗舰',
    isBuiltIn: true,
    isPopular: true,
    isFeatured: true,
    isConfigured: false,
    isAvailable: false,
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'promptEnhancer'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    imageSizes: ['1K', '2K'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'character', 'structure', 'remix'],
    capabilityTags: ['热门', '旗舰', '指令编辑'],
    defaults: { aspectRatio: '16:9', imageSize: '2K', imageCount: 1, quality: 'high', promptEnhancer: true },
  },
  {
    id: 'qwen-image-3.0-pro',
    providerModel: 'Qwen-Image-3.0-Pro',
    label: 'Qwen-Image-3.0 Pro',
    shortLabel: 'Qwen-Image-3.0 Pro',
    provider: 'qwen',
    badge: '旗舰',
    isBuiltIn: true,
    isPopular: true,
    isFeatured: true,
    isConfigured: false,
    isAvailable: false,
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'promptEnhancer'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    imageSizes: ['1K', '2K'],
    countOptions: [1, 2, 4],
    referenceKinds: ['style', 'character', 'structure', 'remix'],
    capabilityTags: ['热门', '旗舰', '文字渲染'],
    defaults: { aspectRatio: '16:9', imageSize: '2K', imageCount: 1, quality: 'high', promptEnhancer: true },
  },
];

const COMBINED_AI_IMAGE_MODEL_PRESETS: AIImageModelPreset[] = [
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro',
    shortLabel: '豆包 Seedream 5.0 Pro',
    provider: 'ai-node-router',
    badge: '智能轮换',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'style', 'background'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    imageSizes: ['2K', '4K'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['豆包 Seedream 5.0 Pro 优先', '自动轮换', '参考图'],
    defaults: { aspectRatio: '16:9', imageSize: '2K', imageCount: 1, quality: 'high' },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro',
    shortLabel: '豆包 Seedream 5.0 Pro',
    provider: 'ai-node-router',
    badge: '智能轮换',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'style', 'background'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    imageSizes: ['2K', '4K'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['豆包 Seedream 5.0 Pro 优先', '自动轮换', '参考图'],
    defaults: { aspectRatio: '16:9', imageSize: '2K', imageCount: 1, quality: 'high' },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro（2K）',
    shortLabel: '豆包 Seedream 5.0 Pro（2K）',
    provider: 'ai-node-router',
    badge: '智能轮换',
    modes: ['text_to_image', 'image_to_image', 'reference'],
    fields: ['aspectRatio', 'imageSize', 'imageCount', 'quality', 'style', 'background'],
    aspectRatios: ['auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '21:9'],
    imageSizes: ['1K', '2K'],
    countOptions: [1],
    referenceKinds: ['style', 'color', 'character', 'structure', 'remix'],
    capabilityTags: ['小天4 优先', '自动轮换', '2K'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '2K',
      imageCount: 1,
      quality: 'high',
      style: 'vivid',
      background: 'opaque',
    },
  },
  {
    id: 'doubao-seedream-5-0-pro',
    label: '豆包 Seedream 5.0 Pro（4K）',
    shortLabel: '豆包 Seedream 5.0 Pro（4K）',
    provider: 'doubao',
    badge: '小天6 专属',
    modes: ['text_to_image'],
    fields: ['aspectRatio', 'imageSize', 'quality', 'style', 'background'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
    imageSizes: ['4096x4096', '3840x2160', '2160x3840', '4096x3072', '3072x4096'],
    countOptions: [1],
    capabilityTags: ['仅小天6', '4K', '不降级'],
    defaults: {
      aspectRatio: '16:9',
      imageSize: '3840x2160',
      imageCount: 1,
      quality: 'high',
      style: 'vivid',
      background: 'opaque',
    },
  },
];

function normalizeCombinedAiImageModelSelection(modelId: string, provider: string) {
  const id = String(modelId || '')
    .trim()
    .toLowerCase();
  const normalizedId = id.replace(/^(?:jiekou-)/, '');
  const providerId = String(provider || '')
    .trim()
    .toLowerCase();
  // gpt-image-2 is not exposed by the public image-node menu. Migrate old
  // saved nodes and stale backend registry entries to the stable default.
  if (id === 'gpt-image-2') {
    return { modelId: DEFAULT_AI_IMAGE_MODEL_ID, provider: DEFAULT_AI_IMAGE_MODEL_PROVIDER };
  }
  if (
    providerId === 'jiekou' &&
    ['flux-2-pro', 'flux-kontext-pro', 'flux.1-kontext-pro'].includes(normalizedId)
  ) {
    return { modelId: 'doubao-seedream-5-0-pro', provider: 'ai-node-router' };
  }
  if (id === 'doubao-seedream-5-0-pro' || id === 'doubao-seedream-5-0-pro') {
    return { modelId: 'doubao-seedream-5-0-pro', provider: 'ai-node-router' };
  }
  if (id === 'doubao-seedream-5-0-pro' || id === 'doubao-seedream-5-0-pro') {
    return { modelId: 'doubao-seedream-5-0-pro', provider: 'ai-node-router' };
  }
  if (id === 'doubao-seedream-5-0-pro') {
    return { modelId: 'doubao-seedream-5-0-pro', provider: 'doubao' };
  }
  if (
    id === 'doubao-seedream-5-0-pro' ||
    (id.includes('doubao-seedream-5-0-pro') && ['apipaths', 'doubao'].includes(providerId))
  ) {
    return { modelId: 'doubao-seedream-5-0-pro', provider: 'ai-node-router' };
  }
  // 非合并范围的模型继续保持原样，避免菜单精简后意外改写用户的既有节点。
  return { modelId, provider };
}

const REMOVED_PUBLIC_IMAGE_MODEL_IDS = new Set([
  'image-01',
  'gpt-image-2',
  'step-image-edit-2',
  'agnes-image-2.1-flash',
]);

/** 取模型在服务端的真实模型名，用于在选择器里直接暴露 providerModel / modelId */
function getImageModelRealName(preset: Pick<AIImageModelPreset, 'id' | 'providerModel' | 'label'>): string {
  const realName = String(preset.providerModel || preset.id || '').trim();
  return realName || String(preset.label || '').trim();
}

function isRemovedPublicImageModel(preset: Pick<AIImageModelPreset, 'id' | 'label' | 'provider'>) {
  const source = `${preset.id} ${preset.label} ${preset.provider}`.toLowerCase();
  return REMOVED_PUBLIC_IMAGE_MODEL_IDS.has(preset.id.toLowerCase()) ||
    source.includes('gpt-image-2') ||
    source.includes('ai-node-router') ||
    source.includes('miniMax image-01'.toLowerCase()) ||
    source.includes('stepfun image edit 2') ||
    source.includes('agnes image 2.1 flash');
}

function isMergedAiImageChannelPreset(preset: AIImageModelPreset) {
  const provider = preset.provider.toLowerCase();
  if (provider.startsWith('custom-image-')) return false;
  const lower = `${preset.id} ${preset.label}`.toLowerCase();
  // 豆包 Seedream 5.0 Pro 的所有历史渠道（小天1/3/4/6 和旧别名）都只由两个合并项代替：2K、4K。
  if (
    provider !== 'ai-node-router' &&
    lower.includes('doubao-seedream-5-0-pro') &&
    !lower.includes('seedream 5.0 pro')
  ) return true;
  // 保留用户要求的官方 Seedream 5.0 Pro / Lite 入口，其它历史豆包渠道继续合并隐藏。
  if (lower.includes('seedream 5.0 lite') || lower.includes('seedream-5-0-lite')) return false;
  if (lower.includes('seedream 5.0 pro') || lower.includes('seedream-5-0-pro')) return false;
  return (
    provider !== 'ai-node-router' &&
    (lower.includes('doubao-seedream') ||
      (provider === 'jiekou' &&
        (lower.includes('flux 2 pro') || lower.includes('flux.1 kontext pro'))))
  );
}

// 小天6在当前部署中只启用了这两个拥有独立密钥的生图通道。不要让未配置的
// 通道进入控制器，否则旧画布数据或手动篡改参数会在生成时才暴露为密钥错误。
const ENABLED_DOUBAO_IMAGE_MODEL_IDS = new Set([
  'doubao-seedream-5-0-lite',
  'doubao-seedream-5-0-pro',
]);

function isEnabledDoubaoImageModel(preset: Pick<AIImageModelPreset, 'id' | 'provider'>) {
  return (
    preset.provider.toLowerCase() !== 'doubao' ||
    ENABLED_DOUBAO_IMAGE_MODEL_IDS.has(preset.id.toLowerCase())
  );
}

const ASPECT_OPTIONS = [
  { value: 'auto', label: '自适应', icon: '□' },
  { value: '1:1', label: '1:1', icon: '□' },
  { value: '9:16', label: '9:16', icon: '▯' },
  { value: '16:9', label: '16:9', icon: '▭' },
  { value: '3:4', label: '3:4', icon: '▯' },
  { value: '4:3', label: '4:3', icon: '▭' },
  { value: '3:2', label: '3:2', icon: '▭' },
  { value: '2:3', label: '2:3', icon: '▯' },
  { value: '4:5', label: '4:5', icon: '▯' },
  { value: '5:4', label: '5:4', icon: '▭' },
  { value: '21:9', label: '21:9', icon: '▭' },
];

const ADVANCED_STYLE_OPTIONS = [
  { value: 'cinematic', label: '电影感' },
  { value: 'photoreal', label: '写实' },
  { value: 'commercial', label: '商业摄影' },
  { value: 'design', label: '设计海报' },
  { value: 'vivid', label: '鲜明' },
];

const REFERENCE_KIND_META: Record<
  ReferenceKind,
  { label: string; shortLabel: string; icon: React.ReactNode; mode: ImageMode }
> = {
  style: {
    label: '风格参考',
    shortLabel: '风格',
    icon: <Move3D className="h-3.5 w-3.5" />,
    mode: 'reference',
  },
  color: {
    label: '校色参考',
    shortLabel: '校色',
    icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
    mode: 'reference',
  },
  character: {
    label: '角色参考',
    shortLabel: '角色',
    icon: <Layers className="h-3.5 w-3.5" />,
    mode: 'reference',
  },
  structure: {
    label: '结构参考',
    shortLabel: '结构',
    icon: <Grid2X2 className="h-3.5 w-3.5" />,
    mode: 'reference',
  },
  remix: {
    label: 'Remix 原图',
    shortLabel: 'Remix',
    icon: <Wand2 className="h-3.5 w-3.5" />,
    mode: 'image_to_image',
  },
  mask: {
    label: 'Mask / 编辑图',
    shortLabel: 'Mask',
    icon: <Maximize2 className="h-3.5 w-3.5" />,
    mode: 'inpaint',
  },
};

const DEFAULT_REFERENCE_KINDS: ReferenceKind[] = [
  'style',
  'color',
  'character',
  'structure',
  'remix',
  'mask',
];

function hasCapability(model: UnifiedModelConfig, names: string[]) {
  const capabilities = (model.modelInfo?.capabilities || []).map((capability) =>
    capability.toLowerCase()
  );
  const tags = (model.modelInfo?.tags || []).map((tag) => tag.toLowerCase());
  const haystack = [
    model.modelId,
    model.modelInfo?.name,
    model.modelInfo?.description,
    ...capabilities,
    ...tags,
  ]
    .join(' ')
    .toLowerCase();
  return names.some((name) => haystack.includes(name.toLowerCase()));
}

function getDynamicModelModes(model: UnifiedModelConfig): ImageMode[] {
  const modes: ImageMode[] = ['text_to_image'];

  if (
    hasCapability(model, [
      'image-to-image',
      'image_edit',
      'image-edit',
      'image variation',
      'image-variation',
      'remix',
      'reference',
    ])
  ) {
    modes.push('image_to_image');
  }
  if (
    hasCapability(model, ['reference', 'multi-image', 'character', 'style-reference', 'structure'])
  ) {
    modes.push('reference');
  }
  if (hasCapability(model, ['upscale', 'hd-quality', '4k-output', 'image-upscale'])) {
    modes.push('upscale');
  }
  if (hasCapability(model, ['inpaint', 'inpainting', 'erase', 'image-erase', 'mask'])) {
    modes.push('inpaint');
  }
  if (hasCapability(model, ['outpaint', 'image-outpaint', 'extend'])) {
    modes.push('outpaint');
  }

  return Array.from(new Set(modes));
}

function getDynamicModelReferenceKinds(model: UnifiedModelConfig): ReferenceKind[] {
  const kinds: ReferenceKind[] = ['remix'];

  if (hasCapability(model, ['style', 'style-reference', 'reference'])) {
    kinds.unshift('style', 'color');
  }
  if (hasCapability(model, ['character', 'character-reference', 'subject-reference']))
    kinds.push('character');
  if (hasCapability(model, ['structure', 'composition', 'controlnet', 'reference']))
    kinds.push('structure');
  if (hasCapability(model, ['inpaint', 'mask', 'erase'])) kinds.push('mask');

  return Array.from(new Set(kinds));
}

function getDynamicModelFields(model: UnifiedModelConfig, modes: ImageMode[]): ImageField[] {
  const fields = new Set<ImageField>(['aspectRatio', 'imageCount', 'quality', 'promptEnhancer']);

  if (model.modelInfo?.supportedResolutions?.length || model.modelInfo?.maxResolution)
    fields.add('imageSize');
  if (hasCapability(model, ['style', 'style-control', 'text-rendering', 'design']))
    fields.add('style');
  if (
    hasCapability(model, ['negative-prompt', 'cfg', 'image-to-image', 'reference']) ||
    modes.includes('image_to_image')
  )
    fields.add('cfgScale');
  if (!hasCapability(model, ['doubao-seedream', 'seedream'])) fields.add('seed');
  if (hasCapability(model, ['transparent', 'background'])) fields.add('background');

  return Array.from(fields);
}

function getDynamicModelImageSizes(model: UnifiedModelConfig) {
  const normalizedModelId = String(model.modelId || '')
    .toLowerCase()
    .replace(/\./g, '-');
  if (
    normalizedModelId === 'doubao-seedream-5-0-pro' ||
    normalizedModelId === 'doubao-seedream-5-0-pro'
  ) {
    return ['2K', '4K'];
  }
  if (normalizedModelId.includes('seedream-5-0-pro')) return ['1K', '2K'];
  if (normalizedModelId.includes('seedream-5-0')) return ['2K', '3K', '4K'];
  const modelResolutions = getModelSupportedResolutions(
    model.modelInfo?.providerModel || model.modelId
  );
  if (model.modelId?.toLowerCase().includes('doubao-seedream') && modelResolutions.length > 0) {
    return modelResolutions.map((resolution) => resolution.value);
  }

  const supported = model.modelInfo?.supportedResolutions || [];
  if (supported.length > 0) return supported;
  if (modelResolutions.length > 0) return modelResolutions.map((resolution) => resolution.value);
  if (hasCapability(model, ['4k', '4k-output'])) return ['1K', '2K', '4K'];
  return ['1K', '2K'];
}

function getDynamicModelCountOptions(model: UnifiedModelConfig) {
  if (
    String(model.modelId || '')
      .toLowerCase()
      .replace(/\./g, '-')
      .includes('seedream-5-0')
  ) {
    return [1];
  }
  if (hasCapability(model, ['batch', 'parallel', 'variation'])) return [1, 2, 4, 8];
  return [1, 2, 4];
}

const AUXILIARY_IMAGE_ACTION_MODEL_IDS = new Set([
  'image-eraser',
  'image-upscaler',
  'image-remove-background',
  'midjourney-variation',
  'midjourney-upscale',
  'midjourney-reroll',
  'midjourney-outpaint',
  'midjourney-inpaint',
  'midjourney-remix',
  'midjourney-remove-background',
  'mj-variation',
  'mj-upscale',
  'mj-reroll',
  'mj-outpaint',
  'mj-inpaint',
  'mj-remix',
  'mj-remove-background',
]);

const AUXILIARY_IMAGE_ACTION_ID_PATTERNS = [
  /(^|[-_])variation($|[-_])/,
  /(^|[-_])upscale($|[-_])/,
  /(^|[-_])reroll($|[-_])/,
  /(^|[-_])outpaint($|[-_])/,
  /(^|[-_])inpaint($|[-_])/,
  /(^|[-_])remix($|[-_])/,
  /(^|[-_])eraser($|[-_])/,
  /(^|[-_])remove[-_]background($|[-_])/,
  /(^|[-_])background[-_]remove($|[-_])/,
];

function getImageModelIdentityCandidates(identity?: string, provider?: string) {
  const normalizedIdentity = identity?.toLowerCase?.();
  if (!normalizedIdentity) return [];

  const providerPrefix = provider ? `${provider.toLowerCase()}-` : '';
  const candidates: string[] = [];
  let current = normalizedIdentity;

  while (current) {
    if (!candidates.includes(current)) candidates.push(current);
    if (!providerPrefix || !current.startsWith(providerPrefix)) break;
    current = current.slice(providerPrefix.length);
  }

  return candidates;
}

function getModelIdentityCandidates(preset: AIImageModelPreset) {
  return getImageModelIdentityCandidates(preset.id, preset.provider);
}

function normalizeImageModelIdentity(identity: string) {
  const aliasMap: Record<string, string> = {
    'mj-txt2img': 'midjourney',
    'midjourney-txt2img': 'midjourney',
    'mj-remove-background': 'midjourney-remove-background',
    'mj-variation': 'midjourney-variation',
    'mj-upscale': 'midjourney-upscale',
    'mj-reroll': 'midjourney-reroll',
    'mj-outpaint': 'midjourney-outpaint',
    'mj-inpaint': 'midjourney-inpaint',
    'mj-remix': 'midjourney-remix',
    'wan2.6': 'wan2.7_image',
    'wan2.7-image': 'wan2.7_image',
    'doubao-seedream-5-0-lite-alias': 'doubao-seedream-5-0-lite',
  };
  return aliasMap[identity] || identity;
}

function normalizeImageModelIdentityForProvider(identity: string, provider: string) {
  const normalized = normalizeImageModelIdentity(identity);
  if (provider.toLowerCase() === 'jiekou' && normalized.startsWith('flux-2-')) {
    return 'flux-2-pro';
  }
  if (provider.toLowerCase() === 'jiekou' && normalized.startsWith('flux-kontext-')) {
    return 'flux-kontext-pro';
  }
  return normalized;
}

function getModelCanonicalKey(preset: AIImageModelPreset) {
  const provider = preset.provider.toLowerCase();
  const identities = getModelIdentityCandidates(preset).map((identity) =>
    normalizeImageModelIdentityForProvider(identity, provider)
  );
  const normalizedIdentity =
    identities[identities.length - 1] ||
    normalizeImageModelIdentityForProvider(preset.id.toLowerCase(), provider);
  return `${provider}:${normalizedIdentity}`;
}

const IMAGE_MODEL_NOTES: Record<string, string> = {
  'image-01': '国风模型',
  'doubao-seedream-5-0-pro': '专业级精准编辑，多图融合',
  'doubao-seedream-5-0-lite': '顶级中文理解，全能型',
  'seedream-5-0-lite': '顶级中文理解，全能型',
  'seedream-5-0-pro': '专业级精准编辑，多图融合',
  'doubao-seedream-4-5': '老模型，稳定',
  'seedream-4-5': '老模型，稳定',
  'doubao-seedream-4.5': '老模型，稳定',
  'seedream-4.5': '老模型，稳定',
  'sensenova-u1-fast': '练习模型，品质较差',
  'u1-fast': '练习模型，品质较差',
  'step-image-edit-2': '练习模型，品质较差',
  'agnes-image-2.1-flash': '4K模型，生成较慢',
};

function resolveImageModelNote(preset: AIImageModelPreset): string | undefined {
  if (preset.note) return preset.note;
  const provider = preset.provider.toLowerCase();
  const candidates = getModelIdentityCandidates(preset).map((identity) =>
    normalizeImageModelIdentityForProvider(identity, provider)
  );
  for (const identity of candidates) {
    if (IMAGE_MODEL_NOTES[identity]) return IMAGE_MODEL_NOTES[identity];
  }
  return undefined;
}

function modelPresetMatchesId(
  preset: AIImageModelPreset,
  modelId: string,
  targetProvider?: string
) {
  const provider = preset.provider.toLowerCase();
  if (targetProvider && provider !== targetProvider.toLowerCase()) return false;
  const targetIdentities = getImageModelIdentityCandidates(modelId, provider).map((identity) =>
    normalizeImageModelIdentityForProvider(identity, provider)
  );

  return getModelIdentityCandidates(preset)
    .map((identity) => normalizeImageModelIdentityForProvider(identity, provider))
    .some((identity) => targetIdentities.includes(identity));
}

function isAuxiliaryImageActionModel(preset: AIImageModelPreset) {
  const identityCandidates = getModelIdentityCandidates(preset);
  return identityCandidates.some(
    (identity) =>
      AUXILIARY_IMAGE_ACTION_MODEL_IDS.has(normalizeImageModelIdentity(identity)) ||
      AUXILIARY_IMAGE_ACTION_ID_PATTERNS.some((pattern) =>
        pattern.test(normalizeImageModelIdentity(identity))
      )
  );
}

// 小天2的这三个模型不再在 AI 图片节点提供，其他页面仍可按各自配置使用。
function isRemovedXiaotian2ImageModel(preset: AIImageModelPreset) {
  const identities = getModelIdentityCandidates(preset).map((identity) =>
    normalizeImageModelIdentity(identity)
      .replace(/[._\s]+/g, '-')
      .replace(/--+/g, '-')
  );
  return identities.some(
    (identity) =>
      identity === 'flux-2-pro' ||
      identity === 'flux-kontext-pro' ||
      identity === 'flux-1-kontext-pro' ||
      identity === 'midjourney'
  );
}

function isHiddenImageProvider(provider: string | undefined, membershipLevel: string) {
  return isImageProviderHiddenForMembership(provider, membershipLevel);
}

function isHiddenImageModel(preset: AIImageModelPreset, membershipLevel: string) {
  const isDoubaoSeedream = getModelIdentityCandidates(preset)
    .map((identity) => normalizeImageModelIdentityForProvider(identity, preset.provider))
    .includes('doubao-seedream-5-0-pro');
  if (isDoubaoSeedream) return false;
  return isImageModelHiddenForMembership(preset.id, preset.provider, membershipLevel);
}

function shouldUseStableTrialImageDefault(modelId?: string, provider?: string) {
  const normalizedModel = String(modelId || '').toLowerCase();
  const normalizedProvider = String(provider || '').toLowerCase();
  return normalizedModel === 'doubao-seedream-5-0-pro' && normalizedProvider === 'doubao';
}

function getModelDedupePreferenceRank(preset: AIImageModelPreset) {
  const identities = getModelIdentityCandidates(preset).map(normalizeImageModelIdentity);
  if (preset.provider.toLowerCase() === 'jiekou') {
    if (identities.includes('flux-2-pro')) return 0;
    if (identities.includes('flux-2-flex')) return 1;
    if (identities.includes('flux-2-dev')) return 2;
    if (identities.includes('flux-kontext-pro')) return 0;
    if (identities.includes('flux-kontext-dev')) return 1;
    if (identities.includes('flux-kontext-max')) return 2;
  }
  return 0;
}

function buildDynamicImageModelPreset(model: UnifiedModelConfig): AIImageModelPreset {
  const modes = getDynamicModelModes(model);
  const fields = getDynamicModelFields(model, modes);
  const resolutionModelId = model.modelInfo?.providerModel || model.modelId;
  const inferredResolutions = getModelSupportedResolutions(resolutionModelId);
  const inferredAspectRatios = Array.from(
    new Set(inferredResolutions.map((resolution) => resolution.aspectRatio))
  );
  const aspectRatios = model.modelInfo?.supportedAspectRatios?.length
    ? model.modelInfo.supportedAspectRatios
    : inferredAspectRatios.length
      ? inferredAspectRatios
      : ['auto', '1:1', '9:16', '16:9', '3:4', '4:3'];
  const defaultParams = model.modelInfo?.defaultParams || {};
  const defaultAspectRatio = aspectRatios.includes('16:9')
    ? '16:9'
    : typeof defaultParams.aspectRatio === 'string' &&
        aspectRatios.includes(defaultParams.aspectRatio)
      ? defaultParams.aspectRatio
      : aspectRatios[0] || '1:1';
  const imageSizes = getDynamicModelImageSizes(model);
  const providerKey = model.provider.toLowerCase();
  const isDoubaoSeedreamModel = getImageModelIdentityCandidates(model.modelId, model.provider)
    .map((identity) => normalizeImageModelIdentityForProvider(identity, model.provider))
    .includes('doubao-seedream-5-0-pro');
  const shouldForceDoubaoSeedreamHighResDefaults =
    isDoubaoSeedreamModel && providerKey === 'doubao';
  const defaultImageSize = shouldForceDoubaoSeedreamHighResDefaults
    ? '3840x2160'
    : typeof defaultParams.imageSize === 'string'
      ? defaultParams.imageSize
      : typeof defaultParams.resolution === 'string'
        ? defaultParams.resolution
        : typeof defaultParams.size === 'string'
          ? defaultParams.size
          : imageSizes[0] || '2K';
  const supportedDefaultImageSize = shouldForceDoubaoSeedreamHighResDefaults
    ? defaultImageSize
    : imageSizes.includes(defaultImageSize)
      ? defaultImageSize
      : imageSizes[0] || defaultImageSize;

  const providerPrefix = `${model.provider.toLowerCase()}-`;
  const dynamicPresetId = model.modelId.toLowerCase().startsWith(providerPrefix)
    ? model.modelId
    : `${model.provider}-${model.modelId}`;
  const dynamicIdentities = getImageModelIdentityCandidates(model.modelId, model.provider).map(
    (identity) => normalizeImageModelIdentityForProvider(identity, model.provider)
  );
  const dynamicIdentity =
    dynamicIdentities[dynamicIdentities.length - 1] ||
    normalizeImageModelIdentityForProvider(model.modelId, model.provider);
  const customModelName = String(model.modelInfo?.providerModel || '').trim();
  const displayLabel =
    model.modelInfo?.isCustomModel && customModelName
      ? customModelName
      : dynamicIdentity === 'doubao-seedream-5-0-pro'
        ? '豆包 Seedream 5.0 Pro'
        : dynamicIdentity === 'flux-2-pro'
          ? 'FLUX 2 Pro'
          : dynamicIdentity === 'flux-kontext-pro'
            ? 'Flux.1 Kontext Pro'
            : model.modelInfo?.name || model.modelId;

  return {
    id: dynamicPresetId,
    resolutionModelId,
    providerModel: resolutionModelId,
    isCustomModel:
      model.modelInfo?.isCustomModel === true || providerKey.startsWith('custom-image-'),
    isBuiltIn: !(model.modelInfo?.isCustomModel === true || providerKey.startsWith('custom-image-')),
    isPopular: model.modelInfo?.isPopular !== false,
    isFeatured: model.modelInfo?.tags?.some((tag) => /旗舰|推荐|热门/i.test(tag)) === true,
    isConfigured: model.isConfigured,
    isAvailable: model.isAvailable,
    label: displayLabel,
    shortLabel: displayLabel,
    provider: model.provider,
    badge: model.isAvailable ? '已连接' : '未配置密钥',
    modes,
    fields,
    aspectRatios,
    imageSizes,
    countOptions: getDynamicModelCountOptions(model),
    referenceKinds: getDynamicModelReferenceKinds(model),
    capabilityTags: (model.modelInfo?.capabilities || []).slice(0, 3),
    defaults: {
      aspectRatio: defaultAspectRatio,
      imageSize: supportedDefaultImageSize,
      imageCount: Number(defaultParams.imageCount || defaultParams.outputCount || 1),
      steps: typeof defaultParams.steps === 'number' ? defaultParams.steps : undefined,
      style: typeof defaultParams.style === 'string' ? defaultParams.style : 'cinematic',
      quality: shouldForceDoubaoSeedreamHighResDefaults
        ? 'high'
        : typeof defaultParams.quality === 'string'
          ? defaultParams.quality
          : 'high',
      cfgScale: typeof defaultParams.cfgScale === 'number' ? defaultParams.cfgScale : 7,
      promptEnhancer: defaultParams.promptEnhancer ?? true,
      seed: typeof defaultParams.seed === 'number' ? defaultParams.seed : -1,
      background:
        typeof defaultParams.background === 'string' ? defaultParams.background : 'opaque',
    },
  };
}

export function mergeImageModelPresets(
  dynamicModels: UnifiedModelConfig[],
  membershipLevel: string
) {
  // 仅合并豆包 Seedream 5.0 Pro 的重复渠道；其它独立模型照常保留在菜单中。
  const dynamicPresets = dynamicModels
    .map(buildDynamicImageModelPreset)
    .filter(
      (preset) =>
        !isAuxiliaryImageActionModel(preset) &&
        !isRemovedXiaotian2ImageModel(preset) &&
        !isRemovedPublicImageModel(preset) &&
        isEnabledDoubaoImageModel(preset) &&
        !isHiddenImageModel(preset, membershipLevel)
    )
    .sort((a, b) => getModelDedupePreferenceRank(a) - getModelDedupePreferenceRank(b));
  const isCustomPreset = (preset: AIImageModelPreset) =>
    preset.provider.toLowerCase().startsWith('custom-image-');
  const getDedupeKey = (preset: AIImageModelPreset) =>
    isCustomPreset(preset)
      ? `custom:${preset.provider}:${preset.id}`
      : getModelCanonicalKey(preset);
  const dynamicKeys = new Set(
    dynamicPresets.filter((preset) => !isCustomPreset(preset)).map(getModelCanonicalKey)
  );
  const fallbackPresets = IMAGE_MODEL_PRESETS.filter(
    (preset) =>
      !dynamicKeys.has(getModelCanonicalKey(preset)) &&
      !isAuxiliaryImageActionModel(preset) &&
      !isRemovedXiaotian2ImageModel(preset) &&
      !isRemovedPublicImageModel(preset) &&
      isEnabledDoubaoImageModel(preset) &&
      !isHiddenImageModel(preset, membershipLevel)
  );
  const seen = new Set<string>();
  const otherPresets = [...dynamicPresets, ...fallbackPresets]
    .filter((preset) => !isMergedAiImageChannelPreset(preset))
    .filter((preset) => {
      const key = getDedupeKey(preset);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((preset) => ({ ...preset, note: resolveImageModelNote(preset) }));

  const featuredPresets = FEATURED_IMAGE_MODEL_PRESETS.filter(
    (preset) =>
      !seen.has(getDedupeKey(preset)) &&
      !isRemovedPublicImageModel(preset) &&
      !isHiddenImageModel(preset, membershipLevel)
  ).map((preset) => ({ ...preset, note: resolveImageModelNote(preset) }));
  return [...otherPresets, ...featuredPresets];
}

/** 按 provider 分组模型，小天1/2/3/4 优先 */
export function groupImageModelsByProvider(
  presets: AIImageModelPreset[]
): Array<{ label: string; options: AIImageModelPreset[] }> {
  const groupMap = new Map<string, AIImageModelPreset[]>();
  const providerGroupMap: Record<string, string> = {
    sensenova: 'SEN',
    doubao: '豆包',
    apipaths: '小天3',
    stepfun: 'STE',
    agnes: 'AG',
    minimax: 'MI001',
    openai: '第三方GPT',
    liblib: 'XTT',
    ideogram: 'Ideogram',
    grok: 'Grok',
  };

  for (const preset of presets) {
    // 豆包 Seedream 5.0 Pro（4K）虽然固定走小天6，但在菜单中与 豆包 Seedream 5.0 Pro（2K）并列展示，
    // 用户可清楚比较同一模型的两个清晰度档位。
    const groupLabel = preset.provider.toLowerCase().startsWith('custom-image-')
      ? '自定义模型'
      : providerGroupMap[preset.provider] || preset.provider;
    const existing = groupMap.get(groupLabel);
    if (existing) existing.push(preset);
    else groupMap.set(groupLabel, [preset]);
  }

  const groupOrder = [
    '自定义模型',
    '小天4',
    'AG',
    'MI001',
    'SEN',
    'STE',
    '小天6',
    '小天2',
    '小天3',
    '小天1',
  ];
  return Array.from(groupMap.entries())
    .map(([label, options]) => ({ label, options }))
    .sort((a, b) => {
      const ai = groupOrder.indexOf(a.label);
      const bi = groupOrder.indexOf(b.label);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
}

function getModelGlyph(model: AIImageModelPreset) {
  const source = `${model.provider} ${model.id} ${model.label}`.toLowerCase();
  if (source.includes('doubao') || source.includes('seedream')) return '豆';
  if (source.includes('stepfun') || source.includes('step-image')) return 'S';
  if (source.includes('minimax')) return 'M';
  if (
    source.includes('gpt') ||
    source.includes('doubao') ||
    source.includes('openai')
  )
    return 'G';
  if (source.includes('ideogram')) return 'I';
  if (source.includes('grok')) return 'X';
  if (source.includes('firefly') || source.includes('adobe')) return 'F';
  if (source.includes('leonardo')) return 'L';
  return model.shortLabel.slice(0, 1).toUpperCase();
}

function getImageModelIcon(model: AIImageModelPreset) {
  const source = `${model.provider} ${model.id} ${model.label}`.toLowerCase();
  if (source.includes('doubao') || source.includes('seedream'))
    return getModelIconConfig('doubao-seedream-5-0-lite');
  if (source.includes('minimax')) return getModelIconConfig('image-01');
  if (source.includes('nano') || source.includes('gemini'))
    return getModelIconConfig('doubao-seedream-5-0-pro');
  if (
    source.includes('gpt') ||
    source.includes('doubao') ||
    source.includes('openai') ||
    source.includes('apipaths')
  )
    return getModelIconConfig('doubao-seedream-5-0-pro');
  if (source.includes('liblib') || source.includes('navo')) {
    return {
      icon: '',
      color: '#A78BFA',
      bgColor: 'rgba(167,139,250,0.16)',
      description: 'XTT 图像模型',
    };
  }
  if (source.includes('agnes')) {
    return getModelIconConfig('agnes-image-2.1-flash');
  }
  if (source.includes('ideogram')) {
    return {
      icon: '',
      color: '#F472B6',
      bgColor: 'rgba(244,114,182,0.16)',
      description: 'Ideogram 图像模型',
    };
  }
  return getModelIconConfig(model.id);
}

function getSupportedAspectOptions(model: AIImageModelPreset) {
  if (!model.aspectRatios?.length) return ASPECT_OPTIONS;
  return ASPECT_OPTIONS.filter((option) => model.aspectRatios?.includes(option.value));
}

/**
 * Model switching must never leave the node with a size from the previous
 * provider. Keep the current composition when possible, otherwise choose the
 * new model's declared default and a resolution that belongs to that ratio.
 */
function resolveSmartModelDimensions(
  model: AIImageModelPreset,
  currentAspectRatio?: string
): Pick<AIImageParams, 'aspectRatio' | 'imageSize'> {
  const supportedRatios = model.aspectRatios?.length ? model.aspectRatios : ['16:9'];
  const preferredAspectRatio = String(currentAspectRatio || '');
  const aspectRatio = supportedRatios.includes(preferredAspectRatio)
    ? preferredAspectRatio
    : supportedRatios.includes(String(model.defaults.aspectRatio || ''))
      ? String(model.defaults.aspectRatio)
      : supportedRatios.includes('16:9')
        ? '16:9'
        : supportedRatios[0];
  const supportedSizes = model.imageSizes || [];
  const resolutionModelId = model.resolutionModelId || model.id;
  const declaredResolutions = getModelSupportedResolutions(resolutionModelId);
  const exactSizes = declaredResolutions.filter(
    (resolution) =>
      supportedSizes.includes(resolution.value) && resolution.aspectRatio === aspectRatio
  );
  const defaultSize = String(model.defaults.imageSize || '');
  const imageSize =
    exactSizes.find((resolution) => resolution.value === defaultSize)?.value ||
    exactSizes[0]?.value ||
    (supportedSizes.includes(defaultSize) ? defaultSize : supportedSizes[0]) ||
    defaultSize ||
    'auto';
  return { aspectRatio, imageSize };
}

function getResultUrls(nodeData: AIImageNodeData): string[] {
  // 优先取最新的 resultUrl/imageUrl，避免旧 resultUrls 残留导致主图仍显老图
  const urls = [
    nodeData.resultUrl,
    nodeData.imageUrl,
    nodeData.task?.resultUrl,
    ...(Array.isArray(nodeData.task?.resultUrls) ? nodeData.task.resultUrls : []),
    ...(Array.isArray(nodeData.resultUrls) ? nodeData.resultUrls : []),
  ]
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .map(normalizeMediaUrl);
  return Array.from(new Set(urls));
}

function normalizeReferences(data: AIImageNodeData): AIImageReferences {
  const source =
    data.references || (data.params?.references as AIImageReferences | undefined) || {};
  const normalized = DEFAULT_REFERENCE_KINDS.reduce<AIImageReferences>((acc, kind) => {
    const items = source[kind];
    if (Array.isArray(items) && items.length > 0) {
      acc[kind] = items.filter((item) => typeof item.url === 'string' && item.url.trim());
    }
    return acc;
  }, {});
  const legacyReferenceUrl = String(
    (data as Record<string, unknown>).referenceImage || data.params?.referenceImage || ''
  ).trim();
  if (
    legacyReferenceUrl &&
    !DEFAULT_REFERENCE_KINDS.some((kind) =>
      normalized[kind]?.some((item) => item.url === legacyReferenceUrl)
    )
  ) {
    normalized.remix = [
      {
        id: `legacy-reference-${legacyReferenceUrl.slice(-24)}`,
        url: legacyReferenceUrl,
        name: '待编辑原图',
        weight: 1,
        source: 'input',
      },
      ...(normalized.remix || []),
    ];
  }
  return normalized;
}

function migrateDoubaoSeedreamLegacyDefaults(
  params: AIImageParams,
  model: AIImageModelPreset
): AIImageParams {
  const provider = model.provider.toLowerCase();
  const isDoubaoSeedream = getModelIdentityCandidates(model)
    .map((identity) => normalizeImageModelIdentityForProvider(identity, model.provider))
    .includes('doubao-seedream-5-0-pro');
  if (!isDoubaoSeedream) return params;

  if (provider === 'apipaths') {
    const next: AIImageParams = { ...params };
    const stableSizeByAspectRatio: Record<string, string> = {
      '1:1': '2048x2048',
      '16:9': '2048x1152',
      '9:16': '1152x2048',
      '4:3': '2048x1536',
      '3:4': '1536x2048',
      '3:2': '1536x1024',
      '2:3': '1024x1536',
    };
    const currentAspectRatio = String(next.aspectRatio || '16:9');
    const stableAspectRatio = model.aspectRatios.includes(currentAspectRatio)
      ? currentAspectRatio
      : '16:9';
    const currentImageSize = String(next.imageSize || '');
    if (!model.imageSizes?.includes(currentImageSize)) {
      next.aspectRatio = stableAspectRatio;
      next.imageSize = stableSizeByAspectRatio[stableAspectRatio] || '2048x1152';
      if (!next.quality || next.quality === 'high' || next.quality === 'auto') {
        next.quality = 'medium';
      }
    }
    return next;
  }

  const shouldForceDoubaoSeedreamHighResDefaults = provider === 'doubao';
  if (!shouldForceDoubaoSeedreamHighResDefaults) return params;

  const next: AIImageParams = { ...params };
  const hasLegacyAspectRatio =
    !next.aspectRatio || next.aspectRatio === 'auto' || next.aspectRatio === '1:1';
  const hasLegacyImageSize =
    !next.imageSize ||
    next.imageSize === 'auto' ||
    next.imageSize === '2K' ||
    next.imageSize === 'medium';
  const hasLegacyQuality = !next.quality || next.quality === 'auto' || next.quality === 'medium';

  if (hasLegacyAspectRatio) next.aspectRatio = '16:9';
  if (hasLegacyImageSize) next.imageSize = '3840x2160';
  if (hasLegacyQuality) next.quality = 'high';
  return next;
}

function getReferenceCount(references: AIImageReferences) {
  return DEFAULT_REFERENCE_KINDS.reduce(
    (total, kind) => total + (references[kind]?.length || 0),
    0
  );
}

const IMAGE_SOURCE_NODE_TYPES = new Set([
  'aiImage',
  'imageInput',
  'imageGen',
  'unifiedImageStudio',
  'aicgImageGen',
  'gridDirector',
  'scriptStoryboard',
  'gridSplitter',
  'imageCollage',
  'localMatting',
  'characterLibrary',
  'characterConsistency',
]);

function extractSourceImageUrl(data: Record<string, unknown>): string | null {
  const task = data.task as Record<string, unknown> | undefined;
  const resultUrls = data.resultUrls as string[] | undefined;
  const candidates = [
    data.resultUrl,
    data.imageUrl,
    data.outputImageUrl,
    data.gridImageUrl,
    task?.resultUrl,
    Array.isArray(task?.resultUrls) ? task?.resultUrls?.[0] : undefined,
    Array.isArray(resultUrls) ? resultUrls[0] : undefined,
    data.url,
    data.output,
    data.originalImageUrl,
    data.thumbnailUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function collectConnectedImages(nodeId: string): string[] {
  const nodes = canvasStoreApi.getNodes();
  const edges = canvasStoreApi.getEdges();
  const incoming = edges.filter((e) => e.target === nodeId);
  const urls: string[] = [];
  for (const edge of incoming) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;
    const sourceType = String(
      (sourceNode.data as { type?: string })?.type || sourceNode.type || ''
    );
    if (sourceType && !IMAGE_SOURCE_NODE_TYPES.has(sourceType)) continue;
    const url = extractSourceImageUrl(sourceNode.data as Record<string, unknown>);
    if (url) urls.push(url);
  }
  return Array.from(new Set(urls));
}

function buildCameraPrompt(params: AIImageParams) {
  const parts = [
    params.cameraBody,
    params.lens,
    params.focalLength ? `${params.focalLength}mm` : '',
    params.aperture,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function getImageCountOptions(model: AIImageModelPreset) {
  const baseOptions = model.countOptions?.length ? model.countOptions : [1, 2, 3, 4];
  if (baseOptions.length === 1 && baseOptions[0] === 1) return baseOptions;
  return Array.from(new Set([...baseOptions, 3])).sort((a, b) => a - b);
}

function getSupportedImageCount(model: AIImageModelPreset, rawCount?: number) {
  const normalizedProvider = model.provider.toLowerCase();
  const normalizedModelId = normalizeImageModelIdentity(model.id);
  if (
    normalizedProvider === 'stepfun' ||
    normalizedProvider === 'sensenova' ||
    normalizedModelId === 'step-image-edit-2' ||
    normalizedModelId.startsWith('sensenova-u1')
  ) {
    return 1;
  }
  const countOptions = getImageCountOptions(model);
  const requestedCount = Number(rawCount || model.defaults.imageCount || 1);
  if (countOptions.includes(requestedCount)) return requestedCount;
  return countOptions[0] || 1;
}

function getModelDisplayLabel(model: AIImageModelPreset) {
  return model.label;
}

export function getModelDisplayShortLabel(model: AIImageModelPreset) {
  return model.shortLabel || model.label;
}

export function getModelPickerDisplayLabel(model: AIImageModelPreset) {
  const label = getModelDisplayShortLabel(model);
  return model.provider.toLowerCase().startsWith('custom-image-') ? `自定义模型 · ${label}` : label;
}

export function getModelDisplayTitle(model: AIImageModelPreset) {
  const label = getModelDisplayLabel(model);
  return model.provider === 'doubao' ||
    model.provider === 'apipaths'
    ? label
    : `${model.provider} · ${label}`;
}

function getImageModelPointsForNode(
  modelId: string | undefined,
  _provider: string | undefined
): number {
  const normalizedModel = String(modelId || '')
    .toLowerCase()
    .replace(/^(?:doubao|apipaths|zxteams)-/, '');
  if (normalizedModel === 'doubao-seedream-5-0-pro') return 30;
  if (normalizedModel === 'doubao-seedream-5-0-pro') return 50;
  if (normalizedModel === 'doubao-seedream-5-0-pro') return 60;
  if (normalizedModel === 'wan2.7_image' || normalizedModel === 'wan2.6') return 60;
  if (normalizedModel.includes('seedream-5-0-pro')) return 80;
  if (normalizedModel.includes('seedream-5-0-lite')) return 60;
  if (normalizedModel === 'doubao-seedream-5-0-pro' || normalizedModel === 'doubao-seedream-5-0-pro') return 30;
  return pointsConfigService.getImagePoints(modelId);
}

function buildGenerationPayload(
  params: AIImageParams,
  model: AIImageModelPreset,
  references: AIImageReferences
) {
  const imageCount = getSupportedImageCount(model, params.imageCount);
  const imageSize = params.imageSize || model.defaults.imageSize || model.imageSizes?.[0];
  // 将摄像机参数拼接到 prompt 末尾，确保到达后端
  const cameraPrompt = buildCameraPrompt(params);
  const seedreamCapabilityPrompts: Record<string, string> = {
    infographic: '严格按信息图结构组织内容，保证文字、数字、图标和视觉层级准确清晰',
    interactive_edit: '严格遵循编辑指令，仅修改明确指定的对象或区域，保持其他内容不变',
    layer_separation: '将主体、背景、文字和装饰元素拆分为边界清晰、便于独立使用的图层素材',
    precise_coordinate: '严格按照提示词中的坐标、方位、距离和尺寸关系放置所有元素',
    arbitrary_marking: '严格保留并遵循输入图中的框选、箭头、点位、涂抹和任意标记',
    multi_image_fusion: '融合全部参考图中的指定主体、风格与结构，保持身份和关键视觉特征一致',
  };
  const capabilityPrompt = seedreamCapabilityPrompts[String(params.seedreamCapability || '')] || '';
  const promptParts = [params.prompt.trim(), capabilityPrompt, cameraPrompt].filter(Boolean);
  const finalPrompt = promptParts.join('. ');
  return {
    taskType: 'image-generation',
    nodeKind: 'aiImage',
    modelProvider: model.provider,
    modelId: model.id,
    modelName: model.label,
    generationMode: params.generationMode,
    prompt: finalPrompt,
    negativePrompt: params.negativePrompt,
    // P1 修复（BUG-I16）：将内层 params 字段提升到外层，与其他节点单层 params 结构保持一致
    aspectRatio: params.aspectRatio,
    imageSize,
    imageCount,
    quality: params.quality,
    style: params.style,
    cfgScale: params.cfgScale,
    seed: params.seed,
    background: params.background,
    promptEnhancer: params.promptEnhancer,
    webSearch: params.webSearch,
    seedreamCapability: params.seedreamCapability,
    seedreamOptimizeMode: params.seedreamOptimizeMode,
    seedreamAnnotations: params.seedreamAnnotations,
    sequentialImageGeneration: params.sequentialImageGeneration,
    sequentialMaxImages: params.sequentialMaxImages,
    outputFormat: params.outputFormat,
    watermark: params.watermark,
    cameraPrompt,
    references,
    requestedAt: new Date().toISOString(),
  };
}

function normalizeParams(data: AIImageNodeData, model: AIImageModelPreset): AIImageParams {
  const rawMode = data.params?.generationMode;
  const merged = {
    generationMode:
      typeof rawMode === 'string' && IMAGE_MODE_LABELS[rawMode as ImageMode]
        ? (rawMode as ImageMode)
        : 'text_to_image',
    prompt: String(data.prompt || data.params?.prompt || ''),
    negativePrompt: getModelNegativePrompt(model.id),
    ...model.defaults,
    ...(data.params || {}),
    modelId: String(data.params?.modelId || model.id),
    modelProvider: String(data.params?.modelProvider || model.provider),
    references: normalizeReferences(data),
  };
  const normalizedSelection = normalizeCombinedAiImageModelSelection(
    String(merged.modelId || model.id),
    String(merged.modelProvider || model.provider)
  );
  merged.modelId = normalizedSelection.modelId;
  merged.modelProvider = normalizedSelection.provider;
  // 迁移已废弃的 liblib / lib-navo-pro 节点到 sensenova-u1-fast
  if (merged.modelProvider === 'liblib' || merged.modelId === 'lib-navo-pro') {
    merged.modelProvider = 'sensenova';
    merged.modelId = 'sensenova-u1-fast';
  }
  if (
    merged.modelProvider === 'doubao' &&
    !ENABLED_DOUBAO_IMAGE_MODEL_IDS.has(String(merged.modelId).toLowerCase())
  ) {
    merged.modelId = 'doubao-seedream-5-0-pro';
    merged.modelProvider = 'doubao';
    merged.generationMode = 'text_to_image';
  }
  const nextParams = migrateDoubaoSeedreamLegacyDefaults(merged, model);
  const routedSelection = normalizeCombinedAiImageModelSelection(
    String(nextParams.modelId || model.id),
    String(nextParams.modelProvider || model.provider)
  );
  return {
    ...nextParams,
    modelId: routedSelection.modelId,
    modelProvider: routedSelection.provider,
    imageCount: getSupportedImageCount(model, nextParams.imageCount),
  };
}

function AIImageNode({ data, id, selected }: NodeProps) {
  const initialNodeData = data as AIImageNodeData;
  const shouldOpenPromptOnCreate = Boolean(
    initialNodeData.openPromptOnCreate ||
    initialNodeData.autoExpandPrompt ||
    initialNodeData.params?.openPromptOnCreate ||
    initialNodeData.params?.autoExpandPrompt
  );
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);
  const [showReferences, setShowReferences] = useState(false);
  const [materialMention, setMaterialMention] =
    useState<MaterialMentionState>(EMPTY_MATERIAL_MENTION);
  const [activeMaterialIndex, setActiveMaterialIndex] = useState(0);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAwaitingRegenerationConfirm, setIsAwaitingRegenerationConfirm] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isMonitorFocused, setIsMonitorFocused] = useState(
    shouldOpenPromptOnCreate
      ? false
      : Boolean(initialNodeData.imageUrl || initialNodeData.resultUrl)
  );
  const [isPromptExpanded, setIsPromptExpanded] = useState(shouldOpenPromptOnCreate);
  const [showImageModal, setShowImageModal] = useState(false);
  const [previewNaturalRatio, setPreviewNaturalRatio] = useState<number | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optimizeRequestVersionRef = useRef(0);
  const keepPromptOpenForLaunchRef = useRef(shouldOpenPromptOnCreate);
  const didApplyOpenPromptOnCreateRef = useRef(false);
  const { models: unifiedImageModels } = useNodeModels('aiImage');
  const canvasNodes = useCanvasStore((state) => state.nodes);
  const canvasEdges = useCanvasStore((state) => state.edges);
  const files = useFileStore((state) => state.files);
  const { permissions } = usePermission();
  const membershipLevel = useMembershipStore((s) => s.membership?.membershipLevel || 'trial');
  const modelPresets = useMemo(
    () => mergeImageModelPresets(unifiedImageModels, membershipLevel),
    [unifiedImageModels, membershipLevel]
  );
  const nodeData = data as AIImageNodeData;
  // 图片生成允许 5 分钟内完成，期间同一节点不允许重复提交
  const { isSubmitting, acquireLock, releaseLock } = useSubmitLock(nodeData, {
    nodeId: id as string,
    timeoutMs: 300000,
  });
  const rawSelectedModelId = String(
    nodeData.params?.modelId || nodeData.modelId || DEFAULT_AI_IMAGE_MODEL_ID
  );
  const rawSelectedModelProvider = String(
    nodeData.params?.modelProvider ||
      (rawSelectedModelId === DEFAULT_AI_IMAGE_MODEL_ID ? DEFAULT_AI_IMAGE_MODEL_PROVIDER : '')
  );
  const combinedSelectedModel = normalizeCombinedAiImageModelSelection(
    rawSelectedModelId,
    rawSelectedModelProvider
  );
  const useStableDefault = shouldUseStableTrialImageDefault(
    combinedSelectedModel.modelId,
    combinedSelectedModel.provider
  );
  const selectedModelId = useStableDefault
    ? DEFAULT_AI_IMAGE_MODEL_ID
    : combinedSelectedModel.modelId;
  const selectedModelProvider = useStableDefault
    ? DEFAULT_AI_IMAGE_MODEL_PROVIDER
    : combinedSelectedModel.provider;
  const isSelectedModelHidden = isImageModelHiddenForMembership(
    selectedModelId,
    selectedModelProvider,
    membershipLevel
  );
  const isUnsupportedDoubaoModel =
    selectedModelProvider.toLowerCase() === 'doubao' &&
    !ENABLED_DOUBAO_IMAGE_MODEL_IDS.has(selectedModelId.toLowerCase());
  // 优先匹配用户已选模型；匹配失败时构造临时 preset 保留用户选择，避免 fallback 到 SenseNova U1 Fast 污染 params
  const matchedModel = isSelectedModelHidden
    ? undefined
    : isUnsupportedDoubaoModel
      ? modelPresets.find((item) => item.id === 'doubao-seedream-5-0-pro')
      : modelPresets.find((item) =>
          modelPresetMatchesId(item, selectedModelId, selectedModelProvider)
        ) || modelPresets.find((item) => modelPresetMatchesId(item, selectedModelId));
  const model =
    matchedModel ||
    (isUnsupportedDoubaoModel
      ? IMAGE_MODEL_PRESETS.find((item) => item.id === 'doubao-seedream-5-0-pro')!
      : !isSelectedModelHidden &&
          selectedModelId &&
          selectedModelId !== String(modelPresets[0]?.id || IMAGE_MODEL_PRESETS[0].id)
        ? {
            ...IMAGE_MODEL_PRESETS[0],
            id: selectedModelId,
            provider: selectedModelProvider || IMAGE_MODEL_PRESETS[0].provider,
            label: selectedModelId,
            shortLabel: selectedModelId,
          }
        : modelPresets[0] || IMAGE_MODEL_PRESETS[0]);
  const isCustomImageModel =
    model.isCustomModel === true || model.provider.toLowerCase().startsWith('custom-image-');
  const openApiSettings = useCallback((provider?: string, modelId?: string) => {
    useAppPanelStore.getState().setSettingsOpen(true, 'api-config', {
      provider,
      model: modelId,
    });
  }, []);
  const params = useMemo<AIImageParams>(() => {
    const normalized = normalizeParams(nodeData, model);
    return {
      ...normalized,
      watermark: resolveWatermarkSetting(nodeData.params?.watermark, membershipLevel),
    } as AIImageParams;
  }, [membershipLevel, model, nodeData]);
  const references = useMemo(() => normalizeReferences(nodeData), [nodeData]);
  const materialCandidates = useMemo<ImageMaterialCandidate[]>(() => {
    const candidates: ImageMaterialCandidate[] = [];
    const seenUrls = new Set<string>();
    const addCandidate = (candidate: ImageMaterialCandidate) => {
      if (!candidate.url || seenUrls.has(candidate.url)) return;
      seenUrls.add(candidate.url);
      candidates.push(candidate);
    };

    const connectedSourceIds = new Set(
      canvasEdges.filter((edge) => edge.target === id).map((edge) => edge.source)
    );
    const orderedCanvasNodes = [...canvasNodes].sort(
      (left, right) =>
        Number(connectedSourceIds.has(right.id)) - Number(connectedSourceIds.has(left.id))
    );

    orderedCanvasNodes.forEach((node) => {
      if (node.id === id || !IMAGE_MATERIAL_NODE_TYPES.has(String(node.type || ''))) return;
      const sourceData = (node.data || {}) as Record<string, unknown>;
      const task = sourceData.task as Record<string, unknown> | undefined;
      const urls = [
        sourceData.imageUrl,
        sourceData.resultUrl,
        sourceData.outputImageUrl,
        task?.resultUrl,
        ...(Array.isArray(sourceData.resultUrls) ? sourceData.resultUrls : []),
        ...(Array.isArray(task?.resultUrls) ? task.resultUrls : []),
      ].filter((url): url is string => typeof url === 'string' && Boolean(url));
      const baseName = normalizeMaterialName(
        String(sourceData.fileName || sourceData.label || `画布素材-${node.id.slice(0, 6)}`)
      );
      urls.forEach((url, index) => {
        const name = urls.length > 1 ? `${baseName}-${index + 1}` : baseName;
        addCandidate({
          id: `canvas-${node.id}-${index}`,
          name,
          token: `@${name}`,
          url,
          previewUrl: url,
          source: connectedSourceIds.has(node.id) ? '已连接' : '画布',
        });
      });
    });

    files
      .filter((file) => file.type === 'image' && !file.isDeleted && Boolean(file.url))
      .forEach((file) => {
        const name = normalizeMaterialName(file.name || `作品-${file.id.slice(0, 6)}`);
        addCandidate({
          id: `library-${file.id}`,
          name,
          token: `@${name}`,
          url: file.url,
          previewUrl: file.thumbnailUrl || file.url,
          source: '我的作品',
        });
      });

    return candidates;
  }, [canvasEdges, canvasNodes, files, id]);
  const filteredMaterialCandidates = useMemo(() => {
    const query = materialMention.query.trim().toLowerCase();
    return (
      query
        ? materialCandidates.filter(
            (candidate) =>
              candidate.name.toLowerCase().includes(query) ||
              candidate.source.toLowerCase().includes(query)
          )
        : materialCandidates
    ).slice(0, 8);
  }, [materialCandidates, materialMention.query]);
  const connectedMaterialCandidates = useMemo(
    () => materialCandidates.filter((candidate) => candidate.source === '已连接'),
    [materialCandidates]
  );
  const normalizedSeedreamModelId = model.id.toLowerCase().replace(/\./g, '-');
  const isSeedream5Pro = normalizedSeedreamModelId.includes('seedream-5-0-pro');
  const seedreamAnnotations = Array.isArray(params.seedreamAnnotations)
    ? params.seedreamAnnotations.filter((annotation): annotation is SeedreamAnnotation =>
        Boolean(
          annotation &&
          typeof annotation.id === 'string' &&
          typeof annotation.imageUrl === 'string' &&
          (annotation.kind === 'point' || annotation.kind === 'bbox') &&
          Array.isArray(annotation.coordinates)
        )
      )
    : [];
  const seedreamEditorImages = useMemo(() => {
    const result: Array<{ url: string; name: string }> = [];
    const seen = new Set<string>();
    for (const kind of [
      'style',
      'color',
      'character',
      'structure',
      'remix',
      'mask',
    ] as ReferenceKind[]) {
      for (const asset of references[kind] || []) {
        if (!asset.url || seen.has(asset.url)) continue;
        seen.add(asset.url);
        result.push({ url: asset.url, name: asset.name || REFERENCE_KIND_META[kind].label });
      }
    }
    return result.slice(0, 10);
  }, [references]);
  const resultUrls = useMemo(() => getResultUrls(nodeData), [nodeData]);
  const mode = params.generationMode;
  const [localPrompt, setLocalPrompt] = useState(String(params.prompt || ''));
  const availableModes = model.modes;
  const isProcessing = nodeData.task?.status === 'processing';
  const realTaskProgress = Number(nodeData.task?.progress ?? 0) || 0;
  const generationProgress = isProcessing
    ? Math.max(0, Math.min(99, Math.round(Math.max(realTaskProgress, displayProgress))))
    : 100;
  const imageCount = Number(params.imageCount || 1);
  const imageSize = String(params.imageSize || params.quality || '2K');
  const imageSizeLabel = imageSize === '3840x2160' ? '4K' : imageSize;
  const aspectRatio = String(params.aspectRatio || '16:9');
  const cameraLabel = `${params.focalLength || 24}mm · ${params.aperture || 'f/2.8'}`;
  const seed = Number(params.seed ?? -1);
  const referenceCount = getReferenceCount(references);
  const canGenerate =
    !isProcessing &&
    !isSubmitting &&
    !isAwaitingRegenerationConfirm &&
    (mode !== 'text_to_image' || localPrompt.trim().length > 0);
  const primaryResultUrl = getSafeRenderableMediaUrl(resultUrls[0] || nodeData.imageUrl);
  const dynamicPreviewHeight = previewNaturalRatio
    ? Math.min(Math.round(CANVAS_NODE_BASE_WIDTH / previewNaturalRatio), 600)
    : AI_IMAGE_PREVIEW_HEIGHT;
  const persistedResultAssetId = nodeData.resultAssetId;
  const persistedResultAttemptRef = useRef('');

  const handleResultImageError = useCallback(() => {
    const fallbackUrl =
      typeof (nodeData.task as { cosUrl?: unknown } | undefined)?.cosUrl === 'string'
        ? (nodeData.task as { cosUrl: string }).cosUrl
        : undefined;
    if (fallbackUrl && fallbackUrl !== primaryResultUrl) {
      canvasStoreApi.updateNodeData(id as string, {
        resultUrl: fallbackUrl,
        imageUrl: fallbackUrl,
        resultUrls: [fallbackUrl],
        error: undefined,
        task: nodeData.task ? { ...nodeData.task, resultUrl: fallbackUrl } : nodeData.task,
      });
      return;
    }

    canvasStoreApi.updateNodeData(id as string, {
      imageUrl: undefined,
      resultUrl: undefined,
      resultUrls: undefined,
      error: '结果图片文件无法访问，请重新生成或检查上传目录配置',
      task: nodeData.task
        ? { ...nodeData.task, resultUrl: undefined, error: '结果图片文件无法访问' }
        : nodeData.task,
    });
    setIsMonitorFocused(false);
  }, [id, nodeData.task, primaryResultUrl]);

  useEffect(() => {
    setLocalPrompt(String(params.prompt || ''));
  }, [params.prompt]);

  useEffect(() => {
    if (!shouldOpenPromptOnCreate || didApplyOpenPromptOnCreateRef.current) return;
    didApplyOpenPromptOnCreateRef.current = true;
    keepPromptOpenForLaunchRef.current = true;
    setIsMonitorFocused(false);
    setIsPromptExpanded(true);
    const timer = window.setTimeout(() => {
      const textarea = promptTextareaRef.current;
      if (!textarea) return;
      textarea.focus({ preventScroll: true });
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [shouldOpenPromptOnCreate]);

  useEffect(() => {
    if (!isProcessing) {
      setDisplayProgress(0);
      return;
    }
    setIsMonitorFocused(true);
    setDisplayProgress((value) => Math.max(value, realTaskProgress, 5));
    const timer = window.setInterval(() => {
      setDisplayProgress((value) => Math.min(99, value + (value < 72 ? 3 : value < 92 ? 1 : 0)));
    }, 900);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  useEffect(() => {
    if (primaryResultUrl && !keepPromptOpenForLaunchRef.current) setIsMonitorFocused(true);
    if (!primaryResultUrl) setPreviewNaturalRatio(null);
  }, [primaryResultUrl]);

  useEffect(() => {
    if (!primaryResultUrl || persistedResultAssetId) return;
    if (primaryResultUrl.startsWith('/uploads/') || primaryResultUrl.includes('/canvas-assets/'))
      return;
    if (persistedResultAttemptRef.current === primaryResultUrl) return;
    persistedResultAttemptRef.current = primaryResultUrl;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const persisted = await persistGeneratedCanvasUrl({
            nodeId: id as string,
            kind: 'image',
            url: primaryResultUrl,
            fileName: `ai-image-${id}-${Date.now()}.png`,
          });
          if (cancelled) return;
          const nextUrl = persisted.runtimeUrl || primaryResultUrl;
          // 持久化后用新 URL 覆盖 resultUrls，避免旧图残留
          const nextResultUrls = [nextUrl];
          canvasStoreApi.updateNodeData(id as string, {
            resultAssetId: persisted.asset.id,
            resultUrl: nextUrl,
            imageUrl: nextUrl,
            resultUrls: nextResultUrls,
            task: nodeData.task
              ? { ...nodeData.task, resultUrl: nextUrl, resultUrls: nextResultUrls }
              : nodeData.task,
          });
        } catch {
          if (!cancelled) persistedResultAttemptRef.current = '';
        }
      })();
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id, nodeData.task, persistedResultAssetId, primaryResultUrl, resultUrls]);

  const patchParams = (patch: Record<string, unknown>) => {
    const currentData = canvasStoreApi.getNodes().find((node) => node.id === id)?.data as
      | AIImageNodeData
      | undefined;
    const currentParams = currentData?.params || {};
    const nextParams = {
      ...params,
      ...currentParams,
      modelId: currentParams.modelId || currentData?.modelId || params.modelId,
      modelProvider: currentParams.modelProvider || params.modelProvider,
      ...patch,
    };
    canvasStoreApi.updateNodeData(id as string, {
      modelId: nextParams.modelId,
      prompt: nextParams.prompt,
      params: nextParams,
    });
  };

  const syncMaterialMention = useCallback((value: string, caretPosition: number | null) => {
    if (caretPosition === null) {
      setMaterialMention(EMPTY_MATERIAL_MENTION);
      return;
    }
    setMaterialMention(findMaterialMention(value, caretPosition));
    setActiveMaterialIndex(0);
  }, []);

  const handleOpenMaterialMenu = () => {
    const textarea = promptTextareaRef.current;
    const caret = textarea?.selectionStart ?? localPrompt.length;
    setMaterialMention({ start: caret, end: caret, query: '', open: true });
    setActiveMaterialIndex(0);
    requestAnimationFrame(() => textarea?.focus());
  };

  const handleSelectMaterial = (candidate: ImageMaterialCandidate) => {
    const start = materialMention.start >= 0 ? materialMention.start : localPrompt.length;
    const end = materialMention.end >= 0 ? materialMention.end : start;
    const before = localPrompt.slice(0, start);
    const after = localPrompt.slice(end);
    const leadingSpace = before && !/\s$/.test(before) ? ' ' : '';
    const trailingSpace = after && !/^\s/.test(after) ? ' ' : '';
    const insertedText = `${leadingSpace}${candidate.token}${trailingSpace || ' '}`;
    const nextPrompt = `${before}${insertedText}${after}`;
    const nextCaret = before.length + insertedText.length;
    const currentData = canvasStoreApi.getNodes().find((node) => node.id === id)?.data as
      | AIImageNodeData
      | undefined;
    const currentReferences = normalizeReferences(currentData || nodeData);
    const nextAsset: ReferenceAsset = {
      id: `mention-${candidate.id}`,
      url: candidate.url,
      name: candidate.name,
      weight: 0.8,
      source: 'manual',
    };
    const nextRemixReferences = [
      nextAsset,
      ...(currentReferences.remix || []).filter((asset) => asset.url !== candidate.url),
    ].slice(0, getModelReferenceImageLimit(model));
    const nextReferences: AIImageReferences = {
      ...currentReferences,
      remix: nextRemixReferences,
    };
    const currentParams = currentData?.params || params;
    const nextParams = {
      ...currentParams,
      prompt: nextPrompt,
      generationMode: 'image_to_image' as const,
      references: nextReferences,
    };

    setLocalPrompt(nextPrompt);
    setMaterialMention(EMPTY_MATERIAL_MENTION);
    setShowReferences(true);
    canvasStoreApi.updateNodeData(id as string, {
      prompt: nextPrompt,
      params: nextParams,
      references: nextReferences,
    });
    requestAnimationFrame(() => {
      const textarea = promptTextareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handlePromptKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.nativeEvent.stopImmediatePropagation?.();
      return;
    }
    if (event.nativeEvent.isComposing || event.key === 'Process') return;

    if (materialMention.open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMaterialMention(EMPTY_MATERIAL_MENTION);
        return;
      }
      if (filteredMaterialCandidates.length > 0 && event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveMaterialIndex((current) =>
          current >= filteredMaterialCandidates.length - 1 ? 0 : current + 1
        );
        return;
      }
      if (filteredMaterialCandidates.length > 0 && event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveMaterialIndex((current) =>
          current <= 0 ? filteredMaterialCandidates.length - 1 : current - 1
        );
        return;
      }
      if (filteredMaterialCandidates.length > 0 && (event.key === 'Enter' || event.key === 'Tab')) {
        event.preventDefault();
        handleSelectMaterial(filteredMaterialCandidates[activeMaterialIndex]);
        return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      event.currentTarget.select();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handlePrepareGenerate();
    }
  };

  const handlePromptPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  const handleOptimizePrompt = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const promptText = localPrompt.trim();
    if (!promptText || isOptimizingPrompt) return;

    const requestVersion = ++optimizeRequestVersionRef.current;
    setOptimizeError(null);
    setIsOptimizingPrompt(true);
    try {
      const llmConfig = useUnifiedAPIConfigStore.getState().userCredentialConfigs['prompt-optimizer-llm'];
      if (!llmConfig?.hasCredentials) {
        toast.warning('请前往系统设置 → LLM配置选择模型并填写 API Key');
        useAppPanelStore.getState().setSettingsOpen(true, 'llm-config');
        return;
      }
      const quota = await checkQuotaOrFail('prompt', permissions);
      if (!quota.allowed) {
        toast.error(quota.message);
        return;
      }

      const agentCategory = classifyPromptAgent(promptText, 'image');
      const templateMatch = matchPromptTemplates(promptText, {
        modality: 'image',
        maxTemplates: 6,
      });
      const optimizationContext = [
        `目标图片模型：${model.label || model.id}（${model.id}）。请针对该模型的图片生成能力优化，不要改写成其他模型专属参数。`,
        '这是 AI 图片生成专用优化，不得使用视频提示词结构。完整保留并执行原有分类模板、构图、光影、色调、镜头、环境、材质、风格和细节等专业优化能力，在此基础上新增并补齐四个核心维度：1. 主要主体，包括人物、物体或角色的外观、动作、表情和关键特征；2. 场景与环境状态，包括地点、时间、天气、光线、空间层次、背景元素和环境动态；3. 情绪目标，包括观众应感受到的情绪、叙事氛围或商业表达目标；4. 视觉风格，包括媒介风格、构图、镜头视角、色调、材质、光影和画质。不得为了加入四维而删除、压缩或弱化原有优化内容。',
        '最终输出一段可直接用于图片生成的完整中文提示词。四个新增维度需要内容明确、可识别且均不为空，可以自然融入原有专业提示词结构，无需把最终结果限制成只有四项。',
        mode === 'text_to_image'
          ? '当前任务是文字生成图片。输出单段、可直接用于图片生成的最终提示词。'
          : '当前任务包含参考图片。必须保留参考图主体身份、关键外观、构图关系和用户明确要求，只补充执行编辑所需的视觉信息。',
        templateMatch.context,
        DEFAULT_CHINA_IMAGE_OPTIMIZATION_CONTEXT,
        '严禁输出“工笔画”“工笔”“水墨工笔”“宣纸肌理”等工笔画风格描述词。如需东方韵味，使用服饰、场景、色彩、布景、光影和构图表达。',
        '只输出最终提示词，不解释优化过程，不复述这些内部规则。',
      ]
        .filter(Boolean)
        .join('\n\n');
      const result = await promptOptimizerService.optimizePrompt(
        promptText,
        'image',
        agentCategory,
        [model.id],
        undefined,
        optimizationContext
      );
      if (requestVersion !== optimizeRequestVersionRef.current) {
        toast.info('提示词已修改，已忽略过期的优化结果');
        return;
      }
      if (!result.success || !result.optimizedPrompt) {
        throw new Error(result.error || '优化失败');
      }

      const optimizedPrompt = result.optimizedPrompt.trim();
      let displayPrompt = optimizedPrompt;
      if (!hasChineseText(displayPrompt)) {
        try {
          displayPrompt = await translatePromptToChinese(displayPrompt);
        } catch {
          displayPrompt = optimizedPrompt;
        }
      }
      if (requestVersion !== optimizeRequestVersionRef.current) {
        toast.info('提示词已修改，已忽略过期的优化结果');
        return;
      }
      setLocalPrompt(displayPrompt);
      patchParams({ prompt: displayPrompt });
      const qualitySuffix = result.qualityReport?.overallScore
        ? ` · 质量 ${result.qualityReport.overallScore}分${result.qualityReport.selfRepaired ? ' · 已自检修复' : ''}`
        : '';
      toast.success(`图片提示词优化成功${qualitySuffix}`);
    } catch (error) {
      const msg = (error as Error).message || '优化服务异常';
      setOptimizeError(msg);
      toast.error(msg);
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  const handleTranslatePrompt = async () => {
    const text = localPrompt.trim();
    if (!text || isTranslating) return;
    setIsTranslating(true);
    try {
      const translated = await translatePromptToEnglish(text);
      setLocalPrompt(translated);
      patchParams({ prompt: translated });
      toast.success('已翻译为英文');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '翻译失败');
    } finally {
      setIsTranslating(false);
    }
  };

  const patchReferences = (nextReferences: AIImageReferences, nextMode?: ImageMode) => {
    const nextParams = {
      ...params,
      references: nextReferences,
      ...(nextMode ? { generationMode: nextMode } : {}),
    };
    canvasStoreApi.updateNodeData(id as string, {
      params: nextParams,
      references: nextReferences,
    });
  };

  const togglePanel = (panel: PanelKey) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const handleModelChange = (modelId: string, provider?: string) => {
    const nextModel =
      modelPresets.find(
        (item) => item.id === modelId && (!provider || item.provider === provider)
      ) ||
      modelPresets.find((item) => modelPresetMatchesId(item, modelId, provider)) ||
      modelPresets.find((item) => item.id === modelId) ||
      modelPresets.find((item) => modelPresetMatchesId(item, modelId)) ||
      modelPresets[0] ||
      IMAGE_MODEL_PRESETS[0];
    const nextMode = nextModel.modes.includes(mode) ? mode : nextModel.modes[0];
    const { aspectRatio: nextAspectRatio, imageSize: nextImageSize } = resolveSmartModelDimensions(
      nextModel,
      String(params.aspectRatio || '')
    );
    setOpenPanel(null);
    patchParams({
      ...nextModel.defaults,
      aspectRatio: nextAspectRatio,
      imageSize: nextImageSize,
      imageCount: getSupportedImageCount(nextModel, Number(nextModel.defaults.imageCount || 1)),
      modelId: nextModel.id,
      modelProvider: nextModel.provider,
      generationMode: nextMode,
      seedreamAnnotations: [],
      ...(nextModel.id.toLowerCase().includes('seedream-5-0-pro')
        ? { webSearch: false, sequentialImageGeneration: 'disabled' }
        : {}),
    });
  };

  const handlePrepareGenerate = async () => {
    if (model.isAvailable === false) {
      toast.warning('当前模型未配置密钥，请前往系统设置 → API配置匹配密钥');
      openApiSettings(model.provider, model.providerModel || model.id);
      return;
    }
    let promptText = localPrompt.trim();
    if (!promptText && mode === 'text_to_image') {
      toast.warning('请先输入图片生成提示词');
      return;
    }
    // 连线图片和提示词中的 @素材 都必须进入真实请求，而不只是用于界面校验。
    const connectedUrls = collectConnectedImages(id as string);
    const mentionedMaterials = materialCandidates.filter((candidate) =>
      promptText.includes(candidate.token)
    );
    const automaticAssets: ReferenceAsset[] = Array.from(
      new Map(
        [
          ...connectedUrls.map((url, index) => ({
            id: `connected-${id}-${index}`,
            url,
            name: `已连接图片${index + 1}`,
            weight: 1,
            source: 'input' as const,
          })),
          ...mentionedMaterials.map((candidate) => ({
            id: `mention-${candidate.id}`,
            url: candidate.url,
            name: candidate.name,
            weight: 1,
            source: 'manual' as const,
          })),
        ].map((asset) => [asset.url, asset])
      ).values()
    );
    const mergedRemixReferences = Array.from(
      new Map(
        [...automaticAssets, ...(references.remix || [])].map((asset) => [asset.url, asset])
      ).values()
    ).slice(0, getModelReferenceImageLimit(model));
    const effectiveReferences: AIImageReferences = {
      ...references,
      ...(mergedRemixReferences.length > 0 ? { remix: mergedRemixReferences } : {}),
    };

    // reference/image_to_image 模式校验参考图存在性
    const needsRef =
      mode === 'reference' ||
      mode === 'image_to_image' ||
      mode === 'inpaint' ||
      mode === 'outpaint';
    if (needsRef && getReferenceCount(effectiveReferences) === 0) {
      toast.warning('当前模式需要参考图，请先添加参考图或通过画布连线传入图片');
      return;
    }
    if (isProcessing || isAwaitingRegenerationConfirm) return;
    if (primaryResultUrl) {
      setIsAwaitingRegenerationConfirm(true);
      const confirmed = await confirmAction(
        '当前节点已有生成结果，再次生成将创建新图片并消耗相应积分。',
        {
          title: '确认再次生成',
          confirmText: '再次生成',
          cancelText: '保留当前图片',
          variant: 'warning',
        }
      );
      setIsAwaitingRegenerationConfirm(false);
      if (!confirmed) return;
    }
    // 同一节点生成中不允许重复提交（5 分钟兜底）
    if (!acquireLock()) return;
    setOpenPanel(null);
    setIsMonitorFocused(true);
    setDisplayProgress(5);
    const startedAt = new Date().toISOString();
    // A node may be rendered repeatedly. Keep retries of this click idempotent while
    // giving the next explicit click a fresh billing/generation request.
    const generationRequestId = `image:${id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    canvasStoreApi.updateNodeData(id as string, {
      task: { status: 'processing', progress: 5, startedAt },
      error: undefined,
      prompt: promptText,
      params: {
        ...params,
        prompt: promptText,
        references: effectiveReferences,
        idempotencyKey: generationRequestId,
        preparedAt: startedAt,
      },
      references: effectiveReferences,
    });
    const requestedImageCount = getSupportedImageCount(model, imageCount);
    const nextGenerationParams = {
      ...params,
      prompt: promptText,
      imageCount: requestedImageCount,
    };
    const generationPayload = buildGenerationPayload(
      nextGenerationParams,
      model,
      effectiveReferences
    );
    canvasStoreApi.updateNodeData(id as string, {
      task: { status: 'processing', progress: 8, startedAt },
      error: undefined,
      prompt: promptText,
      params: {
        ...params,
        prompt: promptText,
        imageCount: requestedImageCount,
        references: effectiveReferences,
        generationPayload,
        idempotencyKey: generationRequestId,
        preparedAt: startedAt,
      },
      references: effectiveReferences,
    });
    window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id } }));
    // ✅ 锁会在 task.status 变为终态时由 useSubmitLock 内部逻辑自动释放
  };

  const selectConnectedReference = (kind: ReferenceKind, candidate: ImageMaterialCandidate) => {
    const item: ReferenceAsset = {
      id: `${kind}-${candidate.id}`,
      url: candidate.url,
      name: candidate.name,
      weight: 1,
      source: 'input',
    };
    patchReferences(
      {
        ...references,
        [kind]: [item],
      },
      REFERENCE_KIND_META[kind].mode
    );
    toast.success(`已选择${REFERENCE_KIND_META[kind].label}`);
  };

  const removeReference = (kind: ReferenceKind, assetId: string) => {
    patchReferences({
      ...references,
      [kind]: (references[kind] || []).filter((asset) => asset.id !== assetId),
    });
  };

  const updateReferenceWeight = (kind: ReferenceKind, assetId: string, weight: number) => {
    patchReferences({
      ...references,
      [kind]: (references[kind] || []).map((asset) =>
        asset.id === assetId ? { ...asset, weight } : asset
      ),
    });
  };

  const ensureResultReady = () => {
    if (resultUrls.length === 0) {
      toast.warning('请先生成或连接图片结果');
      return false;
    }
    return true;
  };

  const handleSendToClip = () => {
    if (!ensureResultReady()) return;
    sendCanvasMediaToClipEditor(
      resultUrls.map((url, index) => ({
        url,
        type: 'image' as const,
        name: `AI图片 ${index + 1}`,
        duration: 3,
      })),
      id as string
    );
    safeOpen(buildClipEditorUrl());
    toast.success('已发送到 AI 剪辑');
  };

  const handleCopyPayload = async () => {
    const generationPayload = buildGenerationPayload(params, model, references);
    try {
      await navigator.clipboard.writeText(JSON.stringify(generationPayload, null, 2));
      toast.success('任务参数已复制');
    } catch (err) {
      console.error('[AIImageNode] 复制任务参数失败:', err);
      toast.error('复制失败');
    }
  };

  const handleDownload = () => {
    if (!ensureResultReady()) return;
    safeOpen(resultUrls[0]);
  };

  const handleAnalyzeResult = async () => {
    if (!ensureResultReady()) return;
    const token = getAuthToken();
    const imageUrl = resultUrls[0];
    canvasStoreApi.updateNodeData(id as string, {
      task: { status: 'processing', progress: 15 },
      error: undefined,
    });
    try {
      const response = await fetch(`${API_BASE_URL}/image/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageUrl,
          model: 'qwen-vl-plus',
          analysisMode: 'prompt_generate',
          language: 'zh',
          outputDetail: 'detailed',
          maxTokens: 1024,
          temperature: 0.3,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || '图片分析失败');
      }
      const analysisResult = String(
        payload.analysis || payload.result || payload.text || ''
      ).trim();
      canvasStoreApi.updateNodeData(id as string, {
        analysisResult,
        outputText: analysisResult,
        task: { status: 'completed', progress: 100, resultUrl: imageUrl },
      });
      toast.success('图片分析完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片分析失败';
      canvasStoreApi.updateNodeData(id as string, {
        error: message,
        task: { status: 'failed', progress: 100, error: message },
      });
      toast.error(message);
    }
  };

  const handleRemoveBackground = async () => {
    if (!ensureResultReady()) return;
    const imageUrl = resultUrls[0];
    canvasStoreApi.updateNodeData(id as string, {
      task: { status: 'processing', progress: 20 },
      error: undefined,
    });
    try {
      const result = await smartMattingEngine.removeBackground(imageUrl, {
        strategy: 'auto',
        backgroundColor: 'transparent',
        edgeRefinement: 'medium',
        featherRadius: 1,
        decontaminateColors: true,
        outputScale: 1,
        rembgModel: 'birefnet-general',
        browserAIModel: 'isnet_fp16',
        browserAIDevice: 'gpu',
      });
      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || '抠图失败');
      }
      canvasStoreApi.updateNodeData(id as string, {
        imageUrl: result.imageUrl,
        resultUrl: result.imageUrl,
        resultUrls: [result.imageUrl],
        maskUrl: result.maskUrl,
        task: {
          status: 'completed',
          progress: 100,
          resultUrl: result.imageUrl,
          resultUrls: [result.imageUrl],
        },
      });
      toast.success('背景已移除');
    } catch (error) {
      const message = error instanceof Error ? error.message : '抠图失败';
      canvasStoreApi.updateNodeData(id as string, {
        error: message,
        task: { status: 'failed', progress: 100, error: message },
      });
      toast.error(message);
    }
  };

  const handleStyleTransfer = () => {
    if (!ensureResultReady()) return;
    handleSpawnResultAction('image-style-transfer', 'aiImage', '风格迁移', {
      label: '风格迁移',
      params: {
        generationMode: 'image_to_image',
        referenceImage: resultUrls[0],
        prompt: params.prompt || '保留主体结构，转换为电影级商业视觉风格，精致光影，高级质感',
        style: 'cinematic',
        strength: 0.7,
      },
    });
  };

  const handleCloseResultNode = () => canvasStoreApi.deleteNode(id as string);

  const handleSpawnResultAction = (
    actionId: string,
    targetType: string,
    label: string,
    initialData?: Record<string, unknown>
  ) => {
    if (!ensureResultReady()) return;
    spawnControllerToolNode(id as string, targetType, {
      controllerActionId: actionId,
      label,
      toastLabel: label,
      sourceHandle: 'output',
      targetHandle: targetType === 'aiVideo' || targetType === 'aicgVideoGen' ? 'input' : 'input',
      initialData: {
        imageUrl: resultUrls[0],
        receivedImageUrl: resultUrls[0],
        referenceImage: resultUrls[0],
        prompt: params.prompt,
        params: {
          prompt: params.prompt,
          referenceImage: resultUrls[0],
          generationMode: actionId === 'image-variation' ? 'image_to_image' : 'reference',
        },
        ...initialData,
      },
    });
  };

  return (
    <div
      className="group relative select-none"
      style={{ width: CANVAS_NODE_BASE_WIDTH }}
      data-mimomi-node-id={id as string}
      data-mimomi-node-type="aiImage"
      data-mimomi-panel="ai-image-node"
    >
      <AICGUnifiedIOHandles
        nodeId={id as string}
        nodeType="aiImage"
        inputId="input"
        outputId="output"
        extraInputs={['prompt', 'image']}
        inputTip="提示词 / 参考图"
        outputTip="图片输出"
      />

      {!isMonitorFocused ? (
        <ResultActionStrip
          hasResult={resultUrls.length > 0}
          dense
          onVariant={() =>
            handleSpawnResultAction('image-variation', 'aiImage', '图片变体', { label: '图片变体' })
          }
          onUpscale={() =>
            handleSpawnResultAction('image-upscale', 'aiImage', '图片高清', {
              params: { generationMode: 'upscale', referenceImage: resultUrls[0] },
            })
          }
          onInpaint={() =>
            handleSpawnResultAction('image-inpaint', 'aiImage', '局部重绘', {
              mode: 'inpaint',
              maskMode: 'upload',
            })
          }
          onOutpaint={() =>
            handleSpawnResultAction('image-outpaint', 'aiImage', '扩图', {
              mode: 'outpaint',
              expandDirection: 'all',
            })
          }
          onVideo={() =>
            handleSpawnResultAction('image-to-video', 'aiVideo', '图片生视频', {
              params: {
                generationMode: 'image_to_video',
                referenceImage: resultUrls[0],
                prompt: params.prompt,
              },
            })
          }
          onClip={handleSendToClip}
          onDownload={handleDownload}
          onCopy={handleCopyPayload}
        />
      ) : null}

      <div
        className={cn(
          'drag-handle relative cursor-grab overflow-hidden active:cursor-grabbing',
          AI_IMG.preview,
          isMonitorFocused && 'mt-0',
          selected ? AI_IMG.previewSelected : AI_IMG.previewIdle
        )}
        style={{ height: dynamicPreviewHeight }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setIsMonitorFocused((value) => !value);
        }}
        title="双击隐藏/显示参数"
      >
        {primaryResultUrl || isProcessing ? (
          <div
            className={cn(
              'absolute right-11 top-3 z-20 rounded-md px-2 py-0.5 text-[10px] text-white/55',
              AI_IMG.badge
            )}
          >
            {isProcessing ? `生成中 ${generationProgress}%` : '已出图'}
          </div>
        ) : null}
        {primaryResultUrl ? (
          <>
            <img
              src={primaryResultUrl}
              alt="AI图片结果"
              draggable={false}
              className="h-full w-full object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setPreviewNaturalRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
              onError={handleResultImageError}
            />
            <button
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setShowImageModal(true);
              }}
              className="nodrag nowheel absolute bottom-3 right-3 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/55 text-white/85 backdrop-blur-md transition-all hover:bg-black/75 hover:text-white"
              title="放大预览"
              aria-label="放大预览"
            >
              <Maximize2 className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                handleCloseResultNode();
              }}
              className="nodrag nowheel absolute right-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-md border border-white/12 bg-transparent text-white/72 transition-all hover:border-red-400/55 hover:bg-transparent hover:text-red-300"
              title="关闭图片和节点"
              aria-label="关闭图片和节点"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </>
        ) : (
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-5',
              AI_IMG.emptyBg
            )}
          >
            <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 text-[11px] font-semibold text-white/72">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>AI图片</span>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                canvasStoreApi.deleteNode(id as string);
              }}
              className="absolute right-2 top-2 z-20 nodrag nowheel flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-white/40 transition-all hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-400"
              title="关闭节点"
              aria-label="关闭节点"
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
            <ImageIcon className={cn('h-11 w-11', AI_IMG.emptyIcon)} strokeWidth={1.25} />
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6">
              <span className={AI_IMG.tryLabel}>尝试:</span>
              <button
                type="button"
                className={aiImgTryBtn()}
                onClick={(event) => {
                  event.stopPropagation();
                  patchParams({ generationMode: 'image_to_image' });
                  setShowReferences(true);
                }}
              >
                <Upload className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
                图生图
              </button>
              <button
                type="button"
                className={aiImgTryBtn()}
                onClick={(event) => {
                  event.stopPropagation();
                  patchParams({ generationMode: 'upscale' });
                }}
              >
                <Zap className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
                图片高清
              </button>
            </div>
          </div>
        )}

        {isProcessing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
            <div className={AI_IMG.progressCard}>
              <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
                <span>正在生成图片</span>
                <span>{generationProgress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/35">
                <div
                  className="h-full rounded-full bg-white/75 transition-all duration-500"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {primaryResultUrl ? (
          <div className={cn('absolute bottom-3 left-3', AI_IMG.badge)}>
            {IMAGE_MODE_LABELS[mode]} · {getModelDisplayShortLabel(model)}
          </div>
        ) : null}
      </div>

      {!isMonitorFocused ? (
        <div className={cn('nodrag nowheel relative', AI_IMG.panel)}>
          <div className={cn('relative px-2 pt-2', materialMention.open && 'z-40')}>
            <div className="min-w-0">
              <div
                className={cn(AI_IMG.promptBox, 'overflow-visible', materialMention.open && 'z-40')}
              >
                <textarea
                  ref={promptTextareaRef}
                  value={localPrompt}
                  onChange={(event) => {
                    event.stopPropagation();
                    optimizeRequestVersionRef.current += 1;
                    setOptimizeError(null);
                    const nextPrompt = event.target.value;
                    setLocalPrompt(nextPrompt);
                    syncMaterialMention(nextPrompt, event.target.selectionStart);
                  }}
                  onBlur={(event) => {
                    event.stopPropagation();
                    patchParams({ prompt: localPrompt });
                    window.setTimeout(() => setMaterialMention(EMPTY_MATERIAL_MENTION), 120);
                  }}
                  onKeyDownCapture={handlePromptKeyDown}
                  onKeyDown={(event) => event.stopPropagation()}
                  onKeyUp={(event) => {
                    event.stopPropagation();
                    if (
                      materialMention.open &&
                      ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)
                    ) {
                      return;
                    }
                    syncMaterialMention(localPrompt, event.currentTarget.selectionStart);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    syncMaterialMention(localPrompt, event.currentTarget.selectionStart);
                  }}
                  onCopyCapture={(event) => event.stopPropagation()}
                  onPasteCapture={handlePromptPaste}
                  onPaste={(event) => event.stopPropagation()}
                  onInput={(event) => event.stopPropagation()}
                  onBeforeInput={(event) => event.stopPropagation()}
                  onCompositionStart={(event) => event.stopPropagation()}
                  onCompositionEnd={(event) => event.stopPropagation()}
                  onPointerDownCapture={(event) => event.stopPropagation()}
                  onMouseDownCapture={(event) => event.stopPropagation()}
                  placeholder="可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜"
                  className={cn(
                    AI_IMG.promptArea,
                    'pr-9 transition-[height,min-height] duration-200',
                    isPromptExpanded ? 'h-[168px]' : 'h-[78px]'
                  )}
                />
                {materialMention.open ? (
                  <div
                    className="absolute left-0 top-[calc(100%+78px)] z-50 w-[300px] max-w-full overflow-hidden rounded-lg border border-white/14 bg-[#111214]/98 shadow-[0_16px_38px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                    onMouseDown={(event) => event.stopPropagation()}
                    onWheelCapture={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/8 px-2.5 py-2 text-[10px] text-white/48">
                      <span>选择图片素材</span>
                      <span>{filteredMaterialCandidates.length} 项</span>
                    </div>
                    {filteredMaterialCandidates.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto p-1.5">
                        {filteredMaterialCandidates.map((candidate, index) => (
                          <button
                            key={candidate.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectMaterial(candidate);
                            }}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                              index === activeMaterialIndex
                                ? 'bg-white/[0.1] text-white'
                                : 'text-white/72 hover:bg-white/[0.06] hover:text-white'
                            )}
                          >
                            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-white/12 bg-black/35">
                              <img
                                src={getSafeRenderableMediaUrl(candidate.previewUrl)}
                                alt={candidate.name}
                                draggable={false}
                                className="h-full w-full object-cover"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-medium">
                                {candidate.token}
                              </span>
                              <span className="block truncate text-[9px] text-white/40">
                                {candidate.source}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-[10px] leading-4 text-white/42">
                        暂无可引用图片，请先在画布生成图片或添加到“我的作品”。
                      </div>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsPromptExpanded((value) => !value);
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  className={cn(
                    aiImgIconBtn(
                      isPromptExpanded,
                      'absolute right-1.5 top-1.5 z-10 h-6 w-6 bg-[#18191b]/82 backdrop-blur-sm'
                    )
                  )}
                  title={isPromptExpanded ? '收起提示词输入区' : '扩大提示词输入区'}
                  aria-label={isPromptExpanded ? '收起提示词输入区' : '扩大提示词输入区'}
                >
                  {isPromptExpanded ? (
                    <Minimize2 className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
                  ) : (
                    <Maximize2 className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
                  )}
                </button>
                <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[9px] text-white/34">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenMaterialMenu();
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      title="引用图片素材"
                      aria-label="引用图片素材"
                      className={cn(
                        'pointer-events-auto rounded-md border px-1.5 py-0.5 transition-colors',
                        materialMention.open
                          ? 'border-white/24 bg-white/[0.1] text-white/82'
                          : 'border-white/10 bg-white/[0.04] text-white/38 hover:border-white/20 hover:bg-white/[0.07] hover:text-white/68'
                      )}
                    >
                      @ 引用素材
                    </button>
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                      主体 / 场景 / 风格
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={handleTranslatePrompt}
                      onMouseDown={(event) => event.stopPropagation()}
                      disabled={isTranslating || !localPrompt.trim()}
                      title="翻译为英文"
                      className={cn(aiImgIconBtn(), 'pointer-events-auto disabled:opacity-30')}
                    >
                      {isTranslating ? (
                        <Loader2
                          className={cn(NC_ICON_CLASS, 'animate-spin')}
                          strokeWidth={NC_ICON_STROKE}
                        />
                      ) : (
                        <Languages className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleOptimizePrompt}
                      onMouseDown={(event) => event.stopPropagation()}
                      disabled={isOptimizingPrompt || !localPrompt.trim()}
                      title={
                        optimizeError ||
                        '图片四维优化：主要主体、场景与环境状态、情绪目标、视觉风格'
                      }
                      aria-label={
                        isOptimizingPrompt
                          ? '正在优化提示词'
                          : optimizeError
                            ? `提示词优化失败：${optimizeError}，点击重试`
                            : '图片四维提示词优化'
                      }
                      className={cn(
                        'pointer-events-auto flex h-6 shrink-0 items-center justify-center gap-0.5 rounded-md px-1.5 text-[10px] font-medium transition-colors disabled:opacity-35',
                        isOptimizingPrompt || !localPrompt.trim()
                          ? 'cursor-not-allowed bg-white/[0.03] text-white/35'
                          : optimizeError
                            ? 'bg-red-500/75 text-white'
                            : 'bg-white/10 text-white/88 hover:bg-white/16'
                      )}
                    >
                      {isOptimizingPrompt ? (
                        <Loader2
                          className={cn(NC_ICON_CLASS, 'animate-spin')}
                          strokeWidth={NC_ICON_STROKE}
                        />
                      ) : (
                        <Wand2
                          className={cn(NC_ICON_CLASS, 'stroke-[1.5]')}
                          strokeWidth={NC_ICON_STROKE}
                        />
                      )}
                      <span>{isOptimizingPrompt ? '优化中' : '图片优化'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ParameterSummary
            mode={mode}
            availableModes={availableModes}
            referenceCount={referenceCount}
            seed={seed}
            patchParams={patchParams}
            onReferenceClick={() => setShowReferences((value) => !value)}
            onStyleClick={() => setShowReferences((value) => !value)}
            onMaskClick={() => setShowReferences((value) => !value)}
          />

          {showReferences ? (
            <ReferenceStrip
              model={model}
              references={references}
              candidates={connectedMaterialCandidates}
              expanded={showReferences}
              onToggle={() => setShowReferences((value) => !value)}
              onSelect={selectConnectedReference}
              onRemove={removeReference}
              onWeightChange={updateReferenceWeight}
            />
          ) : null}

          {showReferences && isSeedream5Pro ? (
            <div className="mx-3 mb-3">
              <SeedreamInteractiveEditor
                images={seedreamEditorImages}
                annotations={seedreamAnnotations}
                onChange={(nextAnnotations) =>
                  patchParams({
                    seedreamAnnotations: nextAnnotations,
                    seedreamCapability: nextAnnotations.length > 0 ? 'interactive_edit' : 'auto',
                    ...(nextAnnotations.length > 0 ? { generationMode: 'image_to_image' } : {}),
                  })
                }
              />
            </div>
          ) : null}

          <div className={cn(AI_IMG.footerBar, 'relative')}>
            <div className={AI_IMG.footerLeft}>
              <ModelPicker
                model={model}
                open={openPanel === 'model'}
                onToggle={() => {
                  if (openPanel !== 'model') {
                    void (async () => {
                      const configStore = useUnifiedAPIConfigStore.getState();
                      await configStore.fetchProviderConfigs({ force: true });
                      await configStore.fetchUserCredentialConfigs();
                      await modelRegistry.refreshFromBackend();
                    })().catch((error) => {
                      console.warn('[AIImageNode] 刷新个人自定义模型失败:', error);
                    });
                  }
                  togglePanel('model');
                }}
              />

              <ToolbarButton active={openPanel === 'ratio'} onClick={() => togglePanel('ratio')}>
                <span className="max-w-[160px] truncate">
                  {aspectRatio} · {QUALITY_LABELS[String(params.quality || 'standard')] || '标准'} ·{' '}
                  {imageSizeLabel}
                </span>
                <ChevronDown
                  className={cn(NC_ICON_CLASS, 'shrink-0 text-white/40')}
                  strokeWidth={NC_ICON_STROKE}
                />
              </ToolbarButton>

              <ToolbarButton active={openPanel === 'camera'} onClick={() => togglePanel('camera')}>
                <Camera className={cn(NC_ICON_CLASS, 'shrink-0')} strokeWidth={NC_ICON_STROKE} />
                <span className="max-w-[100px] truncate">{cameraLabel}</span>
              </ToolbarButton>
            </div>

            <div className={AI_IMG.footerRight}>
              <IconButton
                title="高级设置"
                active={openPanel === 'advanced'}
                onClick={() => togglePanel('advanced')}
              >
                <SlidersHorizontal className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
              </IconButton>
              <ToolbarButton active={openPanel === 'count'} onClick={() => togglePanel('count')}>
                <span>{imageCount}张</span>
                <ChevronDown
                  className={cn(NC_ICON_CLASS, 'text-white/40')}
                  strokeWidth={NC_ICON_STROKE}
                />
              </ToolbarButton>
              <NodePointsBadge
                points={resolveImageNodePoints(
                  getImageModelPointsForNode(selectedModelId, selectedModelProvider),
                  imageCount,
                  isCustomImageModel
                )}
              />
              <button
                type="button"
                data-mimomi-action="generate"
                onClick={(event) => {
                  event.stopPropagation();
                  handlePrepareGenerate();
                }}
                className={aiImgGenerateBtn(canGenerate)}
                disabled={!canGenerate || isSubmitting}
                title={
                  isProcessing || isSubmitting
                    ? '图片生成中'
                    : mode === 'text_to_image' && !localPrompt.trim()
                      ? '请先输入提示词'
                      : '开始生成（Ctrl+Enter）'
                }
              >
                {isProcessing ? (
                  <Loader2
                    className={cn(NC_ICON_CLASS, 'animate-spin')}
                    strokeWidth={NC_ICON_STROKE}
                  />
                ) : (
                  <Zap className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
                )}
                {isProcessing ? '生成中...' : '生成'}
              </button>
            </div>
            {openPanel === 'model' ? (
              <ModelPickerPanel
                model={model}
                modelPresets={modelPresets}
                onChange={handleModelChange}
                onOpenSettings={openApiSettings}
              />
            ) : null}
          </div>

          {openPanel === 'ratio' ? (
            <RatioPanel
              model={model}
              params={params}
              patchParams={patchParams}
              onClose={() => setOpenPanel(null)}
            />
          ) : null}
          {openPanel === 'camera' ? (
            <CameraPanel
              params={params}
              patchParams={patchParams}
              onClose={() => setOpenPanel(null)}
            />
          ) : null}
          {openPanel === 'advanced' ? (
            <AdvancedPanel
              model={model}
              mode={mode}
              params={params}
              patchParams={patchParams}
              membershipLevel={membershipLevel}
            />
          ) : null}
          {openPanel === 'count' ? (
            <CountPanel
              model={model}
              value={imageCount}
              patchParams={patchParams}
              onClose={() => setOpenPanel(null)}
            />
          ) : null}
        </div>
      ) : null}

      {showImageModal &&
        primaryResultUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setShowImageModal(false)}
          >
            <div
              className="relative max-w-[90vw] w-full mx-4 rounded-2xl overflow-hidden bg-black shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={primaryResultUrl}
                alt="AI图片结果"
                className="w-full max-h-[85vh] object-contain"
                draggable={false}
                onError={handleResultImageError}
              />
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all"
                aria-label="关闭预览"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function ModelBadge({ model }: { model: AIImageModelPreset }) {
  const glyph = getModelGlyph(model);
  const iconConfig = getImageModelIcon(model);
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <span
      className="relative ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md text-[9px] font-bold"
      style={{
        backgroundColor: iconConfig.bgColor,
        color: iconConfig.color,
      }}
      title={getModelDisplayTitle(model)}
    >
      {iconConfig.icon && !iconFailed ? (
        <img
          src={iconConfig.icon}
          alt=""
          draggable={false}
          className="h-3.5 w-3.5 object-contain"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <>
          <ImageIcon className="absolute h-5 w-5 opacity-10" />
          <span className="relative">{glyph}</span>
        </>
      )}
    </span>
  );
}

function ModelPicker({
  model,
  open,
  onToggle,
}: {
  model: AIImageModelPreset;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        className={cn(AI_IMG.modelPicker, open && 'border-white/28 bg-white/[0.08]')}
        title={getModelDisplayTitle(model)}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <ModelBadge model={model} />
        <span className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-white/78">
          {getModelPickerDisplayLabel(model)}
        </span>
        <ChevronDown
          className={cn(
            'shrink-0 text-white/40 transition-transform',
            NC_ICON_CLASS,
            open && 'rotate-180 text-white/80'
          )}
          strokeWidth={NC_ICON_STROKE}
        />
      </button>
    </div>
  );
}

function ModelPickerPanel({
  model,
  modelPresets,
  onChange,
  onOpenSettings,
}: {
  model: AIImageModelPreset;
  modelPresets: AIImageModelPreset[];
  onChange: (modelId: string, provider?: string) => void;
  onOpenSettings: (provider?: string, modelId?: string) => void;
}) {
  // 默认只列出已匹配密钥的模型，避免菜单被大量"未配置密钥"项淹没；
  // 需要补密钥时再展开全部模型。
  const [showAllModels, setShowAllModels] = useState(false);
  const configuredCount = useMemo(
    () => modelPresets.filter((item) => item.isAvailable === true).length,
    [modelPresets]
  );
  const visiblePresets = useMemo(
    () => (showAllModels ? modelPresets : modelPresets.filter((item) => item.isAvailable === true)),
    [modelPresets, showAllModels]
  );
  const groups = groupImageModelsByProvider(visiblePresets);
  return (
    <div
      className={cn(
        'nodrag nowheel absolute left-2 bottom-full z-[120] w-[260px] overflow-hidden bg-[#101115] p-1.5',
        AI_IMG.popover
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
        {groups.length === 0 ? (
          <div className="px-1.5 py-3 text-[10px] leading-relaxed text-white/40">
            暂无已匹配密钥的模型。展开全部模型后，可点击模型右侧的钥匙图标前往系统设置补配 API Key。
          </div>
        ) : null}
        {groups.map((group) => (
          <div key={group.label} className="py-1">
            <div className="mb-1 px-1.5 text-[9px] font-semibold uppercase text-white/35">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.options.map((item) => {
                const active = item.id === model.id && item.provider === model.provider;
                const configured = item.isAvailable === true;
                const statusLabel = configured ? '已配置' : '未配置密钥';
                return (
                  <div
                    key={`${item.provider}:${item.id}`}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left transition-colors',
                      item.note ? 'h-auto py-1' : 'h-8',
                      active
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/68 hover:bg-white/[0.06] hover:text-white'
                    )}
                    title={getModelDisplayTitle(item)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onChange(item.id, item.provider);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onChange(item.id, item.provider);
                      }
                    }}
                  >
                    <ModelBadge model={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium">
                        {getModelDisplayShortLabel(item)}
                      </span>
                      <span className="block truncate text-[9px] leading-tight text-white/35">
                        {getImageModelRealName(item)}
                        {item.note ? ` | ${item.note}` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className={cn(
                        'rounded px-1 py-0.5 text-[8px]',
                        configured ? 'bg-emerald-300/10 text-emerald-200/80' : 'bg-amber-300/10 text-amber-200/90'
                      )}>
                        {statusLabel}
                      </span>
                      {!configured ? (
                        <button
                          type="button"
                          className="rounded p-0.5 text-amber-200/80 hover:bg-white/10 hover:text-white"
                          title="前往系统设置 → API配置匹配密钥"
                          aria-label={`为${getModelDisplayShortLabel(item)}匹配密钥`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenSettings(item.provider, item.providerModel || item.id);
                          }}
                        >
                          <Settings2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {configuredCount < modelPresets.length ? (
        <button
          type="button"
          className="mt-1 w-full rounded-md px-1.5 py-1 text-left text-[10px] text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/80"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setShowAllModels((value) => !value);
          }}
        >
          {showAllModels
            ? `仅显示已匹配模型 (${configuredCount})`
            : `显示全部模型 (${modelPresets.length})`}
        </button>
      ) : null}
    </div>
  );
}

function ParameterSummary({
  mode,
  availableModes,
  referenceCount,
  seed,
  patchParams,
  onReferenceClick,
  onStyleClick,
  onMaskClick,
}: {
  mode: ImageMode;
  availableModes: ImageMode[];
  referenceCount: number;
  seed: number;
  patchParams: (patch: Record<string, unknown>) => void;
  onReferenceClick: () => void;
  onStyleClick: () => void;
  onMaskClick: () => void;
}) {
  const renderReferenceTools = () => (
    <>
      <button
        type="button"
        className={aiImgChip(false)}
        title="添加风格参考图"
        onClick={(event) => {
          event.stopPropagation();
          onStyleClick();
        }}
      >
        <Sparkles className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
        <span>风格</span>
      </button>
      <button
        type="button"
        className={aiImgChip(false)}
        title="添加局部重绘标记图"
        onClick={(event) => {
          event.stopPropagation();
          onMaskClick();
        }}
      >
        <Focus className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
        <span>标记</span>
      </button>
    </>
  );
  let insertedReferenceTools = false;

  return (
    <div className="mx-2 my-1.5 flex min-w-0 flex-wrap items-center gap-1">
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {availableModes.map((item) => {
          const shouldInsertAfterItem =
            item === 'inpaint' || (!availableModes.includes('inpaint') && item === 'reference');
          const includeToolsAfterThis = shouldInsertAfterItem && !insertedReferenceTools;
          if (includeToolsAfterThis) insertedReferenceTools = true;

          return (
            <Fragment key={item}>
              <button
                type="button"
                className={aiImgChip(mode === item)}
                title={IMAGE_MODE_HELP[item]}
                onClick={() => patchParams({ generationMode: item })}
              >
                {IMAGE_MODE_ICONS[item]}
                <span>{IMAGE_MODE_LABELS[item]}</span>
              </button>
              {includeToolsAfterThis ? renderReferenceTools() : null}
            </Fragment>
          );
        })}
        {!insertedReferenceTools ? renderReferenceTools() : null}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onReferenceClick();
        }}
        className={aiImgChip(false, 'shrink-0')}
        title="展开多图参考"
      >
        <Layers className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
        <span>多图参考{referenceCount > 0 ? ` · ${referenceCount}张` : ''}</span>
      </button>
      <span className={cn(aiImgChip(false, 'shrink-0'), 'cursor-default')} title="随机种子">
        <Zap className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
        <span>{seed === -1 ? '随机种子' : `种子 ${seed}`}</span>
      </span>
    </div>
  );
}

function ReferenceStrip({
  model,
  references,
  candidates,
  expanded,
  onToggle,
  onSelect,
  onRemove,
  onWeightChange,
}: {
  model: AIImageModelPreset;
  references: AIImageReferences;
  candidates: ImageMaterialCandidate[];
  expanded: boolean;
  onToggle: () => void;
  onSelect: (kind: ReferenceKind, candidate: ImageMaterialCandidate) => void;
  onRemove: (kind: ReferenceKind, assetId: string) => void;
  onWeightChange: (kind: ReferenceKind, assetId: string, weight: number) => void;
}) {
  const supportedKinds = model.referenceKinds || DEFAULT_REFERENCE_KINDS;
  const referenceCount = getReferenceCount(references);
  const previewAssets = supportedKinds
    .map((kind) => references[kind]?.[0])
    .filter((asset): asset is ReferenceAsset => Boolean(asset));

  return (
    <div className={cn('mx-3 mb-3 p-2.5', AI_IMG.subPanel)}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="flex w-full items-center justify-between gap-2 text-left text-[11px]"
      >
        <span className="flex items-center gap-2 font-semibold text-white/82">
          <ImagePlus className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
          参考图
          <span className={AI_IMG.badge}>{referenceCount}张</span>
        </span>
        <span className="flex min-w-0 items-center gap-1">
          {previewAssets.slice(0, 3).map((asset) => (
            <span key={asset.id} className="h-5 w-5 overflow-hidden rounded border border-white/18">
              <img
                src={asset.url}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            </span>
          ))}
          <ChevronDown
            className={cn(
              cn(NC_ICON_CLASS, 'text-white/52 transition-transform'),
              expanded && 'rotate-180'
            )}
          />
        </span>
      </button>

      {!expanded ? (
        <div className={cn('mt-1 truncate', AI_IMG.hint)}>
          {referenceCount > 0
            ? '已配置参考，点击展开调整权重'
            : '点击展开，从已连接图片中选择风格、校色、角色、结构或 Remix'}
        </div>
      ) : null}

      {expanded ? (
        <>
          <div className="mb-2 mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className={cn('min-w-0 truncate', AI_IMG.hint)}>
              {candidates.length > 0
                ? `已连接 ${candidates.length} 张图片，可分别指定参考用途`
                : '请先把图片输入节点连接到当前 AI 图片节点'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {supportedKinds.map((kind) => {
              const meta = REFERENCE_KIND_META[kind];
              const assets = references[kind] || [];
              const firstAsset = assets[0];

              return (
                <div
                  key={kind}
                  className="min-w-0 rounded-lg border border-white/12 bg-[#101012] p-1"
                >
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className="flex h-[54px] w-full items-center justify-center overflow-hidden rounded-lg border border-white/12 bg-black/24 text-white/52 transition-colors hover:border-white/24 hover:bg-white/[0.06] hover:text-white/88"
                    title={
                      firstAsset
                        ? `${meta.label}：${firstAsset.name || '已连接图片'}`
                        : `请选择${meta.label}`
                    }
                  >
                    {firstAsset ? (
                      <img
                        src={firstAsset.url}
                        alt={meta.label}
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex flex-col items-center gap-1">
                        {meta.icon}
                        <ImagePlus className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="truncate text-[10px] font-medium text-white/72">
                      {meta.shortLabel}
                    </span>
                    {firstAsset ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove(kind, firstAsset.id);
                        }}
                        className={aiImgIconBtn(false, 'h-5 w-5 !rounded-md')}
                        title="移除参考图"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                  <select
                    value={firstAsset?.url || ''}
                    disabled={candidates.length === 0}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const candidate = candidates.find((item) => item.url === event.target.value);
                      if (candidate) onSelect(kind, candidate);
                    }}
                    className="nodrag nowheel mt-1 h-6 w-full rounded border border-white/12 bg-black/35 px-1 text-[9px] text-white/72 outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    title={`选择${meta.label}`}
                  >
                    <option value="">选择连接图片</option>
                    {candidates.map((candidate) => (
                      <option key={`${kind}-${candidate.id}`} value={candidate.url}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  {firstAsset ? (
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={firstAsset.weight}
                      onChange={(event) =>
                        onWeightChange(kind, firstAsset.id, Number(event.target.value))
                      }
                      className="mt-1 h-1 w-full accent-white"
                      title={`权重 ${Math.round(firstAsset.weight * 100)}%`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ResultActionStrip({
  hasResult,
  dense,
  onVariant,
  onUpscale,
  onInpaint,
  onOutpaint,
  onVideo,
  onClip,
  onDownload,
  onCopy,
}: {
  hasResult: boolean;
  dense?: boolean;
  onVariant: () => void;
  onUpscale: () => void;
  onInpaint: () => void;
  onOutpaint: () => void;
  onVideo: () => void;
  onClip: () => void;
  onDownload: () => void;
  onCopy: () => void;
}) {
  const actions = [
    {
      label: '变体',
      icon: <Sparkles className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onVariant,
      requiresResult: true,
    },
    {
      label: '高清',
      icon: <Zap className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onUpscale,
      requiresResult: true,
    },
    {
      label: '重绘',
      icon: <Wand2 className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onInpaint,
      requiresResult: true,
    },
    {
      label: '扩图',
      icon: <Maximize2 className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onOutpaint,
      requiresResult: true,
    },
    {
      label: '视频',
      icon: <Film className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onVideo,
      requiresResult: true,
    },
    {
      label: '剪辑',
      icon: <Layers className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onClip,
      requiresResult: true,
    },
    {
      label: '下载',
      icon: <Download className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onDownload,
      requiresResult: true,
    },
    {
      label: '参数',
      icon: <Copy className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />,
      onClick: onCopy,
      requiresResult: false,
    },
  ];

  return (
    <div className={cn('flex flex-wrap gap-1.5', dense ? 'mb-2 px-1' : 'mx-3 mb-3')}>
      {actions.map((action) => {
        const disabled = action.requiresResult && !hasResult;
        return (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            title={disabled ? '生成完成后可用' : action.label}
            onClick={(event) => {
              event.stopPropagation();
              if (disabled) return;
              action.onClick();
            }}
            className={aiImgActionBtn(disabled, dense ? 'h-7 px-2' : 'h-7 px-2.5')}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={aiImgToolbarBtn(active)}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={aiImgIconBtn(active)}
    >
      {children}
    </button>
  );
}

function RatioPanel({
  model,
  params,
  patchParams,
  onClose,
}: {
  model: AIImageModelPreset;
  params: AIImageParams;
  patchParams: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const aspectRatio = String(params.aspectRatio || '16:9');
  const imageSize = String(params.imageSize || '2K');
  const allSizes = model.imageSizes?.length ? model.imageSizes : ['1K', '2K', '4K'];
  const aspectOptions = getSupportedAspectOptions(model);

  // 根据所选比例过滤分辨率：通过 model-resolutions 映射 size → aspectRatio
  const modelResolutions = getModelSupportedResolutions(model.resolutionModelId || model.id);
  const resolutionByValue = useMemo(
    () => new Map(modelResolutions.map((r) => [r.value, r])),
    [modelResolutions]
  );
  const sizes = useMemo(() => {
    const hasResolutionMap =
      modelResolutions.length > 0 && allSizes.some((s) => resolutionByValue.has(s));
    if (!hasResolutionMap) return allSizes; // 纯档位（1K/2K/4K）不按比例过滤
    return allSizes.filter((size) => {
      const resolution = resolutionByValue.get(size);
      return resolution ? resolution.aspectRatio === aspectRatio : false;
    });
  }, [allSizes, modelResolutions, resolutionByValue, aspectRatio]);

  // 当前分辨率不在过滤后的列表中时，自动切换到第一个匹配项
  useEffect(() => {
    if (sizes.length > 0 && !sizes.includes(imageSize)) {
      patchParams({ imageSize: sizes[0] });
    }
  }, [sizes, imageSize, patchParams]);

  const selectAspectRatio = (nextAspectRatio: string) => {
    const hasResolutionMap =
      modelResolutions.length > 0 && allSizes.some((size) => resolutionByValue.has(size));
    const matchingSizes = hasResolutionMap
      ? allSizes.filter((size) => resolutionByValue.get(size)?.aspectRatio === nextAspectRatio)
      : allSizes;
    patchParams({
      aspectRatio: nextAspectRatio,
      ...(matchingSizes.length > 0 && !matchingSizes.includes(imageSize)
        ? { imageSize: matchingSizes[0] }
        : {}),
    });
    onClose();
  };

  return (
    <div
      className={cn(
        'absolute left-[102px] top-[calc(100%-2px)] z-40 w-[342px] p-3',
        AI_IMG.popover
      )}
    >
      <div className={cn('mb-3', AI_IMG.sectionLabel)}>分辨率</div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => {
              patchParams({ imageSize: size });
              onClose();
            }}
            className={aiImgOptionBtn(imageSize === size, 'h-8 text-[12px]')}
          >
            {size === '3840x2160' ? '4K' : size}
          </button>
        ))}
      </div>
      <div className={cn('mb-3', AI_IMG.sectionLabel)}>比例</div>
      <div className="grid grid-cols-5 gap-2">
        {aspectOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => selectAspectRatio(option.value)}
            className={aiImgOptionBtn(
              aspectRatio === option.value,
              'flex h-[64px] flex-col items-center justify-center gap-1 text-[12px]'
            )}
          >
            <span className="text-[17px] leading-none">{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CameraSliderColumn({
  group,
}: {
  group: {
    id: string;
    label: string;
    icon: typeof Camera;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  };
}) {
  const Icon = group.icon;
  const activeIndex = Math.max(
    0,
    group.options.findIndex((option) => option.value === group.value)
  );
  const current = group.options[activeIndex] || group.options[0];

  return (
    <div className={cn('flex min-w-0 flex-col items-center px-1.5 py-2', AI_IMG.subPanel)}>
      <div className="mb-1 flex items-center gap-1 text-[10px] text-white/45">
        <Icon className="h-3 w-3 shrink-0" strokeWidth={NC_ICON_STROKE} />
        <span className="truncate">{group.label}</span>
      </div>
      <span
        className="mb-2 line-clamp-2 min-h-[2rem] w-full px-0.5 text-center text-[9px] leading-tight text-white/75"
        title={current?.label || group.value}
      >
        {current?.label || group.value}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(0, group.options.length - 1)}
        step={1}
        value={activeIndex}
        onChange={(event) => {
          const next = group.options[Number(event.target.value)];
          if (next) group.onChange(next.value);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        className="nodrag nowheel h-[88px] w-5 cursor-pointer accent-white/65 [direction:rtl] [writing-mode:vertical-lr]"
        title={current?.label}
      />
      <div className="mt-2 flex w-full flex-col gap-0.5 text-center text-[8px] leading-tight text-white/28">
        <span className="truncate" title={group.options[0]?.label}>
          {group.options[0]?.label}
        </span>
        <span className="truncate" title={group.options[group.options.length - 1]?.label}>
          {group.options[group.options.length - 1]?.label}
        </span>
      </div>
    </div>
  );
}

function CameraPanel({
  params,
  patchParams,
  onClose,
}: {
  params: AIImageParams;
  patchParams: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const cameraBody = String(params.cameraBody || 'Panavision DXL2');
  const lens = String(params.lens || 'Arri Signature Prime');
  const focalLength = Number(params.focalLength || 14);
  const aperture = String(params.aperture || 'f/4');
  const applyCameraPreset = (preset: {
    cameraBody: string;
    lens: string;
    focalLength: number;
    aperture: string;
  }) => {
    patchParams({ ...preset, cameraMode: '摄像机' });
  };

  const cameraPresets = [
    {
      label: '电影广角',
      icon: Film,
      cameraBody: 'ARRI ALEXA 35',
      lens: 'Arri Signature Prime',
      focalLength: 24,
      aperture: 'f/2.8',
    },
    {
      label: '人像虚化',
      icon: Aperture,
      cameraBody: 'Sony Venice 2',
      lens: 'Cooke S8/i',
      focalLength: 85,
      aperture: 'f/1.4',
    },
    {
      label: '产品特写',
      icon: Focus,
      cameraBody: 'RED V-RAPTOR XL',
      lens: 'Zeiss Supreme Prime',
      focalLength: 50,
      aperture: 'f/4',
    },
  ];

  const sliderGroups = [
    {
      id: 'cameraBody',
      label: '相机',
      icon: Camera,
      value: cameraBody,
      options: CAMERA_OPTIONS.map((value) => ({ value, label: value })),
      onChange: (value: string) => patchParams({ cameraBody: value, cameraMode: '摄像机' }),
    },
    {
      id: 'lens',
      label: '镜头',
      icon: Film,
      value: lens,
      options: LENS_OPTIONS.map((value) => ({ value, label: value })),
      onChange: (value: string) => patchParams({ lens: value, cameraMode: '摄像机' }),
    },
    {
      id: 'focalLength',
      label: '焦距',
      icon: Focus,
      value: String(focalLength),
      options: FOCAL_OPTIONS.map((value) => ({ value: String(value), label: `${value}mm` })),
      onChange: (value: string) =>
        patchParams({ focalLength: Number(value), cameraMode: '摄像机' }),
    },
    {
      id: 'aperture',
      label: '光圈',
      icon: Aperture,
      value: aperture,
      options: APERTURE_OPTIONS.map((value) => ({ value, label: value })),
      onChange: (value: string) => patchParams({ aperture: value, cameraMode: '摄像机' }),
    },
  ];

  return (
    <div
      className={cn(
        'absolute left-0 top-[calc(100%-2px)] z-40 w-full overflow-hidden',
        AI_IMG.popover
      )}
    >
      <div className="flex h-11 items-center justify-between border-b border-white/12 px-4">
        <div className="flex items-center gap-2">
          <Camera className={cn(NC_ICON_CLASS, 'text-white/55')} strokeWidth={NC_ICON_STROKE} />
          <span className={AI_IMG.title}>摄像机</span>
        </div>
        <button type="button" onClick={onClose} className={aiImgIconBtn(false, 'h-7 w-7')}>
          <X className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
        </button>
      </div>

      <div className="max-h-[240px] overflow-y-auto p-3 custom-scrollbar">
        <div className="mb-3 flex flex-wrap gap-2">
          {cameraPresets.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyCameraPreset(preset)}
                className={aiImgActionBtn(false, 'h-9 shrink-0 px-2.5')}
              >
                <Icon className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} />
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {sliderGroups.map((group) => (
            <CameraSliderColumn key={group.id} group={group} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdvancedPanel({
  model,
  mode,
  params,
  patchParams,
  membershipLevel,
}: {
  model: AIImageModelPreset;
  mode: ImageMode;
  params: AIImageParams;
  patchParams: (patch: Record<string, unknown>) => void;
  membershipLevel: string;
}) {
  const visibleFields = model.fields.filter((field) => IMAGE_MODE_FIELDS[mode]?.includes(field));
  const normalizedModelId = model.id.toLowerCase().replace(/\./g, '-');
  const isSeedream5 = normalizedModelId.includes('seedream-5-0');
  const isSeedream5Lite = isSeedream5 && !normalizedModelId.includes('pro');

  return (
    <div
      className={cn(
        'absolute left-0 top-[calc(100%-2px)] z-40 w-full rounded-b-[12px] border-x border-b border-white p-4',
        AI_IMG.popover
      )}
    >
      <div className={cn('mb-4', AI_IMG.sectionLabel)}>高级设置</div>
      <div className="grid grid-cols-2 gap-3">
        <div
          className={cn(
            'col-span-2 flex items-center justify-between gap-3 px-3 py-2.5 text-[12px]',
            AI_IMG.subPanel
          )}
        >
          <div className="min-w-0">
            <div className="font-medium text-white/82">品牌水印</div>
            <div className="mt-0.5 text-[10px] text-white/42">
              右下角 · 20%透明度 ·{' '}
              {membershipLevel === 'trial' ? '体验版默认开启' : '当前会员默认关闭'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(params.watermark)}
            aria-label="品牌水印"
            onClick={() => patchParams({ watermark: !params.watermark })}
            className={cn(
              'h-5 w-9 shrink-0 rounded-full border border-white/20 p-0.5 transition-colors',
              params.watermark ? 'bg-white/[0.18]' : 'bg-black/24'
            )}
          >
            <span
              className={cn(
                'block h-3.5 w-3.5 rounded-full transition-transform',
                params.watermark ? 'translate-x-4 bg-white' : 'bg-white/55'
              )}
            />
          </button>
        </div>
        <label className={cn('col-span-2 min-w-0 px-2 py-1.5', AI_IMG.subPanel)}>
          <span className={cn('mb-1 block', AI_IMG.sectionLabel)}>反向提示词</span>
          <textarea
            value={String(params.negativePrompt || getModelNegativePrompt(model.id))}
            onChange={(event) => patchParams({ negativePrompt: event.target.value })}
            className="h-16 w-full resize-none bg-transparent text-[11px] leading-5 text-white/88 outline-none placeholder:text-white/40"
            placeholder="输入不想出现的内容"
          />
        </label>
        {visibleFields.includes('style') ? (
          <SelectField
            label="风格"
            value={String(params.style || 'cinematic')}
            options={ADVANCED_STYLE_OPTIONS}
            onChange={(value) => patchParams({ style: value })}
          />
        ) : null}
        {visibleFields.includes('quality') ? (
          <SelectField
            label="质量"
            value={String(params.quality || 'high')}
            options={getImageFieldOptions('quality')}
            onChange={(value) => patchParams({ quality: value })}
          />
        ) : null}
        {visibleFields.includes('cfgScale') ? (
          <SelectField
            label="提示词强度"
            value={String(params.cfgScale || 7)}
            options={getImageFieldOptions('cfgScale')}
            onChange={(value) => patchParams({ cfgScale: Number(value) })}
          />
        ) : null}
        {visibleFields.includes('background') ? (
          <SelectField
            label="背景"
            value={String(params.background || 'opaque')}
            options={getImageFieldOptions('background')}
            onChange={(value) => patchParams({ background: value })}
          />
        ) : null}
        {isSeedream5 ? (
          <SelectField
            label="Seedream 任务能力"
            value={String(params.seedreamCapability || 'auto')}
            options={
              isSeedream5Lite
                ? [
                    { value: 'auto', label: '智能遵循指令' },
                    { value: 'infographic', label: '信息图' },
                    { value: 'multi_image_fusion', label: '多图融合' },
                  ]
                : [
                    { value: 'auto', label: '智能遵循指令' },
                    { value: 'interactive_edit', label: '交互编辑' },
                    { value: 'layer_separation', label: '图层分离' },
                    { value: 'precise_coordinate', label: '精准坐标' },
                    { value: 'arbitrary_marking', label: '任意标记' },
                    { value: 'multi_image_fusion', label: '多图融合' },
                    { value: 'infographic', label: '信息图' },
                  ]
            }
            onChange={(value) => patchParams({ seedreamCapability: value })}
          />
        ) : null}
        {isSeedream5 ? (
          <SelectField
            label="输出格式"
            value={String(params.outputFormat || 'jpeg')}
            options={[
              { value: 'jpeg', label: 'JPEG' },
              { value: 'png', label: 'PNG' },
            ]}
            onChange={(value) => patchParams({ outputFormat: value })}
          />
        ) : null}
        {isSeedream5 && !isSeedream5Lite ? (
          <SelectField
            label="提示词优化"
            value={String(params.seedreamOptimizeMode || 'standard')}
            options={[
              { value: 'standard', label: '标准模式 · 质量优先' },
              { value: 'fast', label: '极速模式 · 速度优先' },
            ]}
            onChange={(value) => patchParams({ seedreamOptimizeMode: value })}
          />
        ) : null}
        {isSeedream5Lite ? (
          <SelectField
            label="组图输出"
            value={String(params.sequentialImageGeneration || 'disabled')}
            options={[
              { value: 'disabled', label: '关闭' },
              { value: 'auto', label: '智能组图' },
            ]}
            onChange={(value) => patchParams({ sequentialImageGeneration: value })}
          />
        ) : null}
        {isSeedream5Lite && params.sequentialImageGeneration === 'auto' ? (
          <SelectField
            label="组图上限"
            value={String(params.sequentialMaxImages || 6)}
            options={[3, 4, 6, 8, 10, 12, 15].map((value) => ({ value, label: `${value} 张` }))}
            onChange={(value) => patchParams({ sequentialMaxImages: Number(value) })}
          />
        ) : null}
        {isSeedream5Lite ? (
          <label
            className={cn(
              'flex items-center justify-between px-3 py-2 text-[12px]',
              AI_IMG.subPanel
            )}
          >
            <span className="text-white/78">联网搜索</span>
            <button
              type="button"
              onClick={() => patchParams({ webSearch: !params.webSearch })}
              className={cn(
                'h-5 w-9 rounded-full border border-white/20 p-0.5 transition-colors',
                params.webSearch ? 'bg-white/[0.14]' : 'bg-black/24'
              )}
            >
              <span
                className={cn(
                  'block h-3.5 w-3.5 rounded-full transition-transform',
                  params.webSearch ? 'translate-x-4 bg-white' : 'bg-white/55'
                )}
              />
            </button>
          </label>
        ) : null}
        <label
          className={cn('flex items-center justify-between px-3 py-2 text-[12px]', AI_IMG.subPanel)}
        >
          <span className="text-white/78">提示词增强</span>
          <button
            type="button"
            onClick={() => patchParams({ promptEnhancer: !(params.promptEnhancer ?? true) })}
            className={cn(
              'h-5 w-9 rounded-full border border-white/20 p-0.5 transition-colors',
              (params.promptEnhancer ?? true) ? 'bg-white/[0.14]' : 'bg-black/24'
            )}
          >
            <span
              className={cn(
                'block h-3.5 w-3.5 rounded-full transition-transform',
                (params.promptEnhancer ?? true) ? 'translate-x-4 bg-white' : 'bg-white/55'
              )}
            />
          </button>
        </label>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className={cn('min-w-0 px-2 py-1.5', AI_IMG.subPanel)}>
      <span className={cn('mb-1 block', AI_IMG.sectionLabel)}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-[12px] text-white outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CountPanel({
  model,
  value,
  patchParams,
  onClose,
}: {
  model: AIImageModelPreset;
  value: number;
  patchParams: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const countOptions = getImageCountOptions(model);

  return (
    <div
      className={cn(
        'absolute right-[78px] top-[calc(100%-2px)] z-40 w-[66px] overflow-hidden py-1',
        AI_IMG.popover
      )}
    >
      {countOptions.map((count) => (
        <button
          key={count}
          type="button"
          onClick={() => {
            patchParams({ imageCount: count });
            onClose();
          }}
          className={cn(
            'block h-10 w-full text-[13px] font-medium transition-colors hover:bg-white/[0.08]',
            value === count ? 'bg-white/[0.08] text-white' : 'text-white/62'
          )}
        >
          {count}张
        </button>
      ))}
    </div>
  );
}

function getImageFieldOptions(field: ImageField): Array<{ value: string | number; label: string }> {
  switch (field) {
    case 'imageCount':
      return [1, 2, 3, 4, 8].map((value) => ({ value, label: `${value}` }));
    case 'quality':
      return ['standard', 'medium', 'high', 'ultra'].map((value) => ({ value, label: value }));
    case 'style':
      return ADVANCED_STYLE_OPTIONS;
    case 'cfgScale':
      return [3, 5, 7, 9, 12].map((value) => ({ value, label: `${value}` }));
    case 'background':
      return ['opaque', 'transparent', 'auto'].map((value) => ({ value, label: value }));
    default:
      return [];
  }
}

export default memo(AIImageNode);
