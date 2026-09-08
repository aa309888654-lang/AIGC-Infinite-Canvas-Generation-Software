import type { Node } from '@xyflow/react';
import { CANVAS_MATERIAL_PRESETS } from '@/config/material-presets';

export const WORKFLOW_MARKETPLACE_PREVIEW_IMAGES = [
  '/showcase-images/0.webp',
  '/showcase-images/1.webp',
  '/showcase-images/2.webp',
  '/showcase-images/3.webp',
  '/showcase-images/4.webp',
  '/showcase-images/5.webp',
  '/showcase-images/6.webp',
  '/showcase-images/7.webp',
  '/showcase-images/8.webp',
  '/showcase-images/9.webp',
  '/templates/template-1.webp',
  '/templates/template-2.webp',
  '/templates/template-3.webp',
  '/templates/template-4.webp',
  '/templates/template-6.webp',
] as const;

export const WORKFLOW_MARKETPLACE_PREVIEW_VIDEOS = [
  '/sample-videos/1.mp4',
  '/sample-videos/2.mp4',
  '/sample-videos/3.mp4',
  '/sample-videos/4.mp4',
] as const;

const VIDEO_NODE_TYPES = new Set([
  'videoInput',
  'aiVideo',
  'aicgVideoGen',
  'advancedVideoGen',
  'videoCompose',
  'frameExtractor',
  'gridDirector',
  'scriptStoryboard',
  'storyboardMaker',
  'storyboardEdit',
  'director3D',
  'panorama360',
]);

const IMAGE_INPUT_NODE_TYPES = new Set([
  'imageInput',
  'characterLibrary',
  'sceneLibrary',
  'propLibrary',
]);

const VIDEO_INPUT_NODE_TYPES = new Set(['videoInput']);

export interface WorkflowNodeCompletionContext {
  templateId: string;
  templateName: string;
  templateDescription?: string;
  stepIndex: number;
  nodeDescription?: string;
}

export interface MarketplaceTemplateLike {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  promptTemplate?: string;
  defaultParams?: Record<string, unknown>;
  mediaAssets?: string[];
  resourceUrl?: string;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFrom<T extends readonly string[]>(items: T, key: string): T[number] {
  return items[hashString(key) % items.length];
}

export function pickWorkflowPreviewImage(key: string): string {
  return pickFrom(WORKFLOW_MARKETPLACE_PREVIEW_IMAGES, key);
}

export function pickWorkflowPreviewVideo(key: string): string {
  return pickFrom(WORKFLOW_MARKETPLACE_PREVIEW_VIDEOS, key);
}

export function isWorkflowVideoNode(nodeType: string): boolean {
  return VIDEO_NODE_TYPES.has(nodeType);
}

function getMaterialPresetFromData(data: Record<string, unknown>) {
  const materialPresetId =
    readString(data.materialPresetId) ||
    readString((data.params as Record<string, unknown>)?.materialPresetId);
  if (!materialPresetId) return undefined;
  return CANVAS_MATERIAL_PRESETS.find((preset) => preset.id === materialPresetId);
}

function getNodePrompt(
  data: Record<string, unknown>,
  context: WorkflowNodeCompletionContext
): string {
  const params = (data.params as Record<string, unknown>) || {};
  return (
    readString(data.prompt) ||
    readString(params.prompt) ||
    readString(data.script) ||
    readString(params.script) ||
    readString(data.text) ||
    readString(params.text) ||
    `${context.templateName} - ${context.nodeDescription || context.templateDescription || 'workflow step'}`
  );
}

function getNodePreviewImage(
  nodeType: string,
  data: Record<string, unknown>,
  context: WorkflowNodeCompletionContext
): string {
  const params = (data.params as Record<string, unknown>) || {};
  const materialPreset = getMaterialPresetFromData(data);
  return (
    readString(data.previewImageUrl) ||
    readString(data.imageUrl) ||
    readString(data.thumbnailUrl) ||
    readString(params.previewImageUrl) ||
    readString(params.imageUrl) ||
    materialPreset?.thumbnailUrl ||
    pickWorkflowPreviewImage(`${context.templateId}:${nodeType}:${context.stepIndex}`)
  );
}

function getNodePreviewVideo(
  nodeType: string,
  data: Record<string, unknown>,
  context: WorkflowNodeCompletionContext
): string {
  const params = (data.params as Record<string, unknown>) || {};
  return (
    readString(data.previewVideoUrl) ||
    readString(data.videoUrl) ||
    readString(params.previewVideoUrl) ||
    readString(params.videoUrl) ||
    pickWorkflowPreviewVideo(`${context.templateId}:${nodeType}:${context.stepIndex}`)
  );
}

export function completeWorkflowNodeData(
  nodeType: string,
  data: Record<string, unknown>,
  context: WorkflowNodeCompletionContext
): Record<string, unknown> {
  const params = (data.params as Record<string, unknown>) || {};
  const prompt = getNodePrompt(data, context);
  const previewImageUrl = getNodePreviewImage(nodeType, data, context);
  const previewVideoUrl = getNodePreviewVideo(nodeType, data, context);
  const shouldAttachVideo = isWorkflowVideoNode(nodeType) || VIDEO_INPUT_NODE_TYPES.has(nodeType);
  const completedParams = {
    ...params,
    prompt,
    previewImageUrl,
    marketplaceTemplateId: context.templateId,
    marketplaceStepIndex: context.stepIndex,
    ...(shouldAttachVideo ? { previewVideoUrl } : {}),
  };

  return {
    ...data,
    prompt,
    previewImageUrl,
    ...(IMAGE_INPUT_NODE_TYPES.has(nodeType) && !readString(data.imageUrl)
      ? { imageUrl: previewImageUrl }
      : {}),
    ...(shouldAttachVideo ? { previewVideoUrl } : {}),
    ...(VIDEO_INPUT_NODE_TYPES.has(nodeType) && !readString(data.videoUrl)
      ? { videoUrl: previewVideoUrl }
      : {}),
    params: completedParams,
  };
}

export function ensureWorkflowNodesHaveVideo(nodes: Node[], templateId: string): Node[] {
  if (
    nodes.some((node) => {
      const data = (node.data || {}) as Record<string, unknown>;
      const params = (data.params as Record<string, unknown>) || {};
      return Boolean(
        readString(data.previewVideoUrl) ||
        readString(data.videoUrl) ||
        readString(params.previewVideoUrl)
      );
    })
  ) {
    return nodes;
  }

  const lastIndex = Math.max(0, nodes.length - 1);
  const previewVideoUrl = pickWorkflowPreviewVideo(`${templateId}:workflow-video`);
  return nodes.map((node, index) => {
    if (index !== lastIndex) return node;
    const data = (node.data || {}) as Record<string, unknown>;
    const params = (data.params as Record<string, unknown>) || {};
    return {
      ...node,
      data: {
        ...data,
        previewVideoUrl,
        params: {
          ...params,
          previewVideoUrl,
        },
      },
    };
  });
}

export function completeMarketplaceTemplate<T extends MarketplaceTemplateLike>(template: T): T {
  const nodes = ensureWorkflowNodesHaveVideo(
    (template.nodes || []).map((node, index) => {
      const nodeType =
        node.type || readString((node.data as Record<string, unknown>)?.type) || 'output';
      return {
        ...node,
        data: completeWorkflowNodeData(nodeType, (node.data || {}) as Record<string, unknown>, {
          templateId: template.id,
          templateName: template.name,
          templateDescription: template.description,
          stepIndex: index,
        }),
      };
    }),
    template.id
  );

  const firstNodeData = (nodes[0]?.data || {}) as Record<string, unknown>;
  const firstNodeParams = (firstNodeData.params as Record<string, unknown>) || {};
  const firstImage =
    readString(firstNodeData.previewImageUrl) ||
    readString(firstNodeData.imageUrl) ||
    readString(firstNodeParams.previewImageUrl);
  const firstVideo =
    readString(firstNodeData.previewVideoUrl) ||
    readString(firstNodeData.videoUrl) ||
    readString(firstNodeParams.previewVideoUrl);

  const thumbnailUrl =
    template.thumbnailUrl || firstImage || pickWorkflowPreviewImage(`${template.id}:template`);
  const previewVideoUrl =
    template.previewVideoUrl || firstVideo || pickWorkflowPreviewVideo(`${template.id}:template`);
  const promptTemplate =
    template.promptTemplate ||
    readString(firstNodeData.prompt) ||
    readString(firstNodeParams.prompt) ||
    template.description;
  const defaultParams = {
    prompt: promptTemplate,
    aspectRatio: '16:9',
    resolution: '1080p',
    imageSize: '2K',
    duration: 5,
    ...(template.defaultParams || {}),
  };
  const mediaAssets = Array.from(
    new Set(
      [
        ...(template.mediaAssets || []),
        thumbnailUrl,
        previewVideoUrl,
        template.resourceUrl || '',
      ].filter(Boolean)
    )
  );

  return {
    ...template,
    nodes,
    thumbnailUrl,
    previewVideoUrl,
    promptTemplate,
    defaultParams,
    mediaAssets,
  };
}
