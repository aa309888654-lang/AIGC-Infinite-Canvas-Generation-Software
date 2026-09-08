/**
 * AICG 下游同步 — 上游节点执行完成后，将结果推送到已连接的下游节点
 */

import type { Edge, Node } from '@xyflow/react';
import { getCharacterAssetPayloadFromNodeData } from '@/components/canvas/nodes/character-payload';
import { getSceneAssetPayloadFromNodeData } from '@/components/canvas/nodes/scene-payload';
import { getPropAssetPayloadFromNodeData } from '@/components/canvas/nodes/prop-payload';
import { canvasStoreApi } from '@/store/useCanvasStore';
import { edgeIndexApi } from '@/store/useEdgeIndexStore';
import { nodeEventBus } from '@/lib/nodeEventBus';
import { sanitizePatchByPortType } from '@/services/edge-data-validator';

export interface NodeOutputSnapshot {
  resultUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  text?: string;
  prompt?: string;
  scenes?: unknown[];
  sceneSummary?: string;
  gridImageUrl?: string;
  coverImageUrl?: string;
  storyboardPayload?: string;
  frameResults?: unknown;
  mediaType?: 'image' | 'video' | 'audio' | 'text';
}

const TEXT_SOURCE_TYPES = new Set([
  'prompt',
  'aiGenText',
  'script',
  'storyboardMaker',
  'textInput',
  'adCopyText',
  'brandCopyText',
  'storyboardEdit',
  'cameraPath',
]);

const IMAGE_SOURCE_TYPES = new Set([
  'imageInput',
  'aiImage',
  'unifiedImageStudio',
  'imageGen',
  'aicgImageGen',
  'localMatting',
  'gridSplitter',
  'gridDirector',
  'scriptStoryboard',
  'multiAngle',
  'imageCollage',
  'frameExtractor',
  'characterLibrary',
  'sceneLibrary',
  'propLibrary',
  'characterConsistency',
  'director3D',
  'panorama360',
]);

const VIDEO_SOURCE_TYPES = new Set([
  'videoInput',
  'videoGen',
  'advancedVideoGen',
  'aicgVideoGen',
  'aiVideo', // ✅ P0-7：补充 aiVideo，AIVideoNode 输出可同步到下游
  'output', // ✅ 补充 output
]);
const AUDIO_SOURCE_TYPES = new Set(['audioInput', 'audioGen']);
const TEXT_TARGET_HANDLES = new Set([
  'input',
  'prompt',
  'promptInput',
  'text',
  'script',
  'scriptInput',
]);
const CLEAR_TEXT_TARGET_HANDLES = new Set([
  'prompt',
  'promptInput',
  'text',
  'script',
  'scriptInput',
]);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function mergeUniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function buildStoryboardMakerReferencePatch(
  targetData: Record<string, unknown>,
  imageUrl: string,
  targetHandle?: string
): Record<string, unknown> {
  const existingParams =
    targetData.params && typeof targetData.params === 'object' && !Array.isArray(targetData.params)
      ? (targetData.params as Record<string, unknown>)
      : {};
  const isCharacterReference =
    targetHandle === 'characterReference' || targetHandle === 'characterRef';
  const visualRefs = isCharacterReference
    ? asStringArray(targetData.referenceImageUrls)
    : mergeUniqueStrings([...asStringArray(targetData.referenceImageUrls), imageUrl]);
  const characterRefs = isCharacterReference
    ? mergeUniqueStrings([...asStringArray(targetData.characterReferenceUrls), imageUrl])
    : asStringArray(targetData.characterReferenceUrls);
  const referenceImages = mergeUniqueStrings([
    ...characterRefs,
    ...visualRefs,
    ...asStringArray(existingParams.referenceImages),
  ]);

  return {
    scriptSourceMode: 'image_reference',
    referenceImageUrls: visualRefs,
    characterReferenceUrls: characterRefs,
    visualReferenceImages: visualRefs,
    characterReferenceImages: characterRefs,
    referenceImage: referenceImages[0] || imageUrl,
    referenceImages,
    imageUrl,
    resultUrl: imageUrl,
    url: imageUrl,
    receivedImageUrl: imageUrl,
    mediaType: 'image',
    mediaTypes: Array.from(
      new Set([
        ...(Array.isArray(targetData.mediaTypes) ? (targetData.mediaTypes as string[]) : []),
        'image',
      ])
    ),
    activeMediaType: targetData.activeMediaType || 'image',
    params: {
      ...existingParams,
      referenceImage: referenceImages[0] || imageUrl,
      referenceImages,
      visualReferenceImages: visualRefs,
      characterReferenceImages: characterRefs,
    },
  };
}

function buildGridDirectorScriptPatch(
  targetData: Record<string, unknown>,
  scriptText: string,
  scenes?: unknown
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (Array.isArray(scenes) && scenes.length > 0) {
    patch.scenes = scenes;
    patch.scriptScenes = scenes;
  }
  if (scriptText) {
    const existingParams =
      targetData.params &&
      typeof targetData.params === 'object' &&
      !Array.isArray(targetData.params)
        ? (targetData.params as Record<string, unknown>)
        : {};
    patch.prompt = scriptText;
    patch.params = { ...existingParams, prompt: scriptText };
  }
  return patch;
}

function summarizeScriptScenes(scenes: unknown[]): string {
  return scenes
    .map((scene, index) => {
      if (!scene || typeof scene !== 'object') return '';
      const data = scene as Record<string, unknown>;
      const description = String(data.description || data.prompt || data.content || '').trim();
      if (!description) return '';
      const duration = typeof data.duration === 'number' ? `${data.duration}s` : '';
      const shotType = typeof data.shotType === 'string' ? data.shotType : '';
      const meta = [duration, shotType].filter(Boolean).join(' / ');
      return meta ? `${index + 1}. ${description}（${meta}）` : `${index + 1}. ${description}`;
    })
    .filter(Boolean)
    .join('\n');
}

function buildCharacterLibraryText(sourceData: Record<string, unknown>): string {
  const payload = getCharacterAssetPayloadFromNodeData(sourceData);
  const rawPayload = typeof sourceData.payload === 'string' ? sourceData.payload : '';
  if (!payload) return rawPayload;

  const readableText = [
    payload.name ? `角色：${payload.name}` : '',
    payload.summary ? `简介：${payload.summary}` : '',
    payload.prompt ? `提示词：${payload.prompt}` : '',
    payload.negativePrompt ? `负向：${payload.negativePrompt}` : '',
    payload.tags?.length ? `标签：${payload.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return readableText || rawPayload;
}

function getCharacterLibraryImage(
  sourceData: Record<string, unknown>,
  sourceHandle?: string
): string | undefined {
  const payload = getCharacterAssetPayloadFromNodeData(sourceData);
  if (sourceHandle === 'outfitRef') {
    return (sourceData.outfitRef as string | undefined) || payload?.outfitImage;
  }

  return (
    (sourceData.characterRef as string | undefined) ||
    (sourceData.imageUrl as string | undefined) ||
    payload?.primaryImage
  );
}

function buildSceneLibraryText(sourceData: Record<string, unknown>): string {
  const payload = getSceneAssetPayloadFromNodeData(sourceData);
  const rawPayload = typeof sourceData.payload === 'string' ? sourceData.payload : '';
  if (!payload) return rawPayload;

  const readableText = [
    payload.name ? `场景：${payload.name}` : '',
    payload.summary ? `简介：${payload.summary}` : '',
    payload.environmentPrompt ? `环境：${payload.environmentPrompt}` : '',
    payload.lightingPrompt ? `光照：${payload.lightingPrompt}` : '',
    payload.prompt ? `提示词：${payload.prompt}` : '',
    payload.negativePrompt ? `负向：${payload.negativePrompt}` : '',
    payload.tags?.length ? `标签：${payload.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return readableText || rawPayload;
}

function getSceneLibraryImage(sourceData: Record<string, unknown>): string | undefined {
  const payload = getSceneAssetPayloadFromNodeData(sourceData);
  return (
    (sourceData.sceneRef as string | undefined) ||
    (sourceData.imageUrl as string | undefined) ||
    payload?.primaryImage
  );
}

function buildPropLibraryText(sourceData: Record<string, unknown>): string {
  const payload = getPropAssetPayloadFromNodeData(sourceData);
  const rawPayload = typeof sourceData.payload === 'string' ? sourceData.payload : '';
  if (!payload) return rawPayload;

  const readableText = [
    payload.name ? `道具：${payload.name}` : '',
    payload.summary ? `简介：${payload.summary}` : '',
    payload.materialTags?.length ? `材质：${payload.materialTags.join(', ')}` : '',
    payload.prompt ? `提示词：${payload.prompt}` : '',
    payload.negativePrompt ? `负向：${payload.negativePrompt}` : '',
    payload.tags?.length ? `标签：${payload.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return readableText || rawPayload;
}

function getPropLibraryImage(sourceData: Record<string, unknown>): string | undefined {
  const payload = getPropAssetPayloadFromNodeData(sourceData);
  return (
    (sourceData.propRef as string | undefined) ||
    (sourceData.imageUrl as string | undefined) ||
    payload?.primaryImage
  );
}

function readTaskResult(data: Record<string, unknown>): string | undefined {
  const task = data.task as Record<string, unknown> | undefined;
  const fromTask = task?.resultUrl as string | undefined;
  const fromUrls = Array.isArray(task?.resultUrls)
    ? (task!.resultUrls as string[])[0]
    : Array.isArray(data.resultUrls)
      ? (data.resultUrls as string[])[0]
      : undefined;
  return (
    fromTask ||
    (data.resultUrl as string) ||
    fromUrls ||
    (data.imageUrl as string) ||
    (data.videoUrl as string) ||
    (data.audioUrl as string) ||
    (data.url as string) ||
    (data.panoramaImageUrl as string) ||
    (data.gridImageUrl as string) ||
    (data.coverImageUrl as string) ||
    (data.output as string)
  );
}

export function extractNodeOutput(node: Node): NodeOutputSnapshot {
  const data = (node.data || {}) as Record<string, unknown>;
  const nodeType = (data.type || node.type || '') as string;
  const mediaUrl = readTaskResult(data);

  if (TEXT_SOURCE_TYPES.has(nodeType)) {
    const scenes = Array.isArray(data.scenes) ? data.scenes : undefined;
    const sceneSummary = scenes ? summarizeScriptScenes(scenes) : undefined;
    const text = String(
      data.outputText ||
        data.outputPrompt ||
        data.prompt ||
        data.text ||
        data.content ||
        data.localPrompt ||
        data.script ||
        ''
    ).trim();
    return { text, prompt: text, scenes, sceneSummary, mediaType: 'text' };
  }

  if (VIDEO_SOURCE_TYPES.has(nodeType)) {
    return {
      resultUrl: mediaUrl,
      videoUrl: mediaUrl || (data.videoUrl as string),
      mediaType: 'video',
    };
  }

  if (AUDIO_SOURCE_TYPES.has(nodeType)) {
    const audio = mediaUrl || (data.audioUrl as string) || (data.resultUrl as string);
    return { resultUrl: audio, audioUrl: audio, mediaType: 'audio' };
  }

  if (nodeType === 'characterLibrary') {
    const image = getCharacterLibraryImage(data);
    const text = buildCharacterLibraryText(data);
    return {
      resultUrl: image,
      imageUrl: image,
      text,
      prompt: text,
      mediaType: image ? 'image' : 'text',
    };
  }

  if (nodeType === 'sceneLibrary') {
    const image = getSceneLibraryImage(data);
    const text = buildSceneLibraryText(data);
    return {
      resultUrl: image,
      imageUrl: image,
      text,
      prompt: text,
      mediaType: image ? 'image' : 'text',
    };
  }

  if (nodeType === 'propLibrary') {
    const image = getPropLibraryImage(data);
    const text = buildPropLibraryText(data);
    return {
      resultUrl: image,
      imageUrl: image,
      text,
      prompt: text,
      mediaType: image ? 'image' : 'text',
    };
  }

  return {
    resultUrl: mediaUrl,
    imageUrl: mediaUrl || (data.imageUrl as string),
    gridImageUrl: (data.gridImageUrl as string) || mediaUrl,
    coverImageUrl: data.coverImageUrl as string | undefined,
    storyboardPayload: data.storyboardPayload as string | undefined,
    frameResults: data.frameResults,
    mediaType: 'image',
  };
}

function appendUniquePromptSegment(base: unknown, segment: unknown): string {
  const baseText = String(base || '').trim();
  const segmentText = String(segment || '').trim();
  if (!segmentText) return baseText;
  if (!baseText) return segmentText;
  return baseText.includes(segmentText) ? baseText : `${baseText}\n${segmentText}`;
}

function readObjectParam(sourceData: Record<string, unknown>, key: string): unknown {
  const params =
    sourceData.params && typeof sourceData.params === 'object' && !Array.isArray(sourceData.params)
      ? (sourceData.params as Record<string, unknown>)
      : {};
  return params[key];
}

export function buildDownstreamPatch(
  targetType: string | undefined,
  targetHandle: string | undefined,
  sourceHandle: string | undefined,
  sourceType: string | undefined,
  sourceData: Record<string, unknown>,
  targetData: Record<string, unknown>,
  output: NodeOutputSnapshot
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const handle = targetHandle || 'input';

  if (sourceType === 'cameraPath') {
    const pathPrompt = String(
      sourceData.outputPrompt || sourceData.prompt || output.prompt || output.text || ''
    ).trim();
    const imageUrl = String(sourceData.imageUrl || sourceData.resultUrl || '').trim();
    const cameraPath = sourceData.cameraPath;
    const cameraPathJson = String(sourceData.cameraPathJson || '').trim();
    const existingParams =
      targetData.params && typeof targetData.params === 'object' && !Array.isArray(targetData.params)
        ? (targetData.params as Record<string, unknown>)
        : {};

    if (sourceHandle === 'image') {
      if (!imageUrl) return patch;
      return {
        imageUrl,
        resultUrl: imageUrl,
        receivedImageUrl: imageUrl,
        referenceImage: imageUrl,
        startImage: imageUrl,
        mediaType: 'image',
        params: {
          ...existingParams,
          referenceImage: imageUrl,
          startImage: imageUrl,
          generationMode: 'image_to_video',
        },
      };
    }

    if (targetType === 'aiVideo') {
      if (pathPrompt) {
        patch.prompt = pathPrompt;
        patch.text = pathPrompt;
        patch.content = pathPrompt;
      }
      if (imageUrl) {
        patch.imageUrl = imageUrl;
        patch.resultUrl = imageUrl;
        patch.referenceImage = imageUrl;
        patch.startImage = imageUrl;
        patch.mediaType = 'image';
      }
      patch.cameraPath = cameraPath;
      patch.cameraPathJson = cameraPathJson;
      patch.params = {
        ...existingParams,
        ...(pathPrompt ? { prompt: pathPrompt } : {}),
        ...(imageUrl
          ? {
              referenceImage: imageUrl,
              startImage: imageUrl,
              generationMode: 'image_to_video',
            }
          : {}),
        cameraPath,
        cameraPathJson,
        cameraPathMode:
          cameraPath && typeof cameraPath === 'object'
            ? (cameraPath as Record<string, unknown>).mode
            : sourceData.mode,
      };
      return patch;
    }
  }

  if (sourceHandle === 'prompt') {
    const promptText = String(
      sourceData.outputPrompt ||
        sourceData.prompt ||
        output.prompt ||
        output.text ||
        sourceData.text ||
        sourceData.content ||
        ''
    ).trim();
    if (!promptText) return patch;

    const existingParams =
      targetData.params &&
      typeof targetData.params === 'object' &&
      !Array.isArray(targetData.params)
        ? (targetData.params as Record<string, unknown>)
        : {};

    // ✅ P2-2：字段统一 — 仅向文本类句柄写 prompt/text/content，避免污染图片/视频句柄
    if (TEXT_TARGET_HANDLES.has(handle)) {
      patch.prompt = promptText;
      patch.text = promptText;
      patch.content = promptText;
    }
    // gridDirector 始终通过 params.prompt 接收
    if (TEXT_TARGET_HANDLES.has(handle) || targetType === 'gridDirector') {
      patch.params = { ...existingParams, prompt: promptText };
    }
    return patch;
  }

  const targetPrefersViewData = ['prompt', 'promptInput', 'text', 'script', 'scriptInput'].includes(
    handle
  );

  if (
    sourceType === 'panorama360' &&
    (sourceHandle === 'viewData' || (sourceHandle === 'output' && targetPrefersViewData))
  ) {
    const viewText = String(
      sourceData.viewData ||
        sourceData.output ||
        sourceData.outputText ||
        sourceData.prompt ||
        output.text ||
        output.prompt ||
        ''
    ).trim();
    if (!viewText) return patch;

    if (TEXT_TARGET_HANDLES.has(handle)) {
      patch.prompt = viewText;
      patch.text = viewText;
      patch.content = viewText;
    }
    return patch;
  }

  if (sourceType === 'characterLibrary') {
    if (sourceHandle === 'payload') {
      const rawPayload = typeof sourceData.payload === 'string' ? sourceData.payload : '';
      const text = buildCharacterLibraryText(sourceData);
      if (!rawPayload && !text) return patch;

      patch.payload = rawPayload;
      patch.characterPayload = rawPayload;
      if (TEXT_TARGET_HANDLES.has(handle)) {
        patch.prompt = text || rawPayload;
        patch.text = text || rawPayload;
        patch.content = text || rawPayload;
      }
      if (targetType === 'gridDirector') {
        const existingParams =
          targetData.params &&
          typeof targetData.params === 'object' &&
          !Array.isArray(targetData.params)
            ? (targetData.params as Record<string, unknown>)
            : {};
        patch.params = { ...existingParams, prompt: text || rawPayload };
      }
      return patch;
    }

    const imageUrl = getCharacterLibraryImage(sourceData, sourceHandle);
    if (!imageUrl) return patch;

    if (targetType === 'storyboardMaker') {
      return buildStoryboardMakerReferencePatch(targetData, imageUrl, handle);
    }

    if (handle === 'characterImage' || handle === 'targetImage') {
      if (handle === 'characterImage') patch.characterImageUrl = imageUrl;
      if (handle === 'targetImage') patch.targetImageUrl = imageUrl;
      patch.imageUrl = imageUrl;
      patch.mediaType = 'image';
      return patch;
    }

    if (targetType === 'gridDirector') {
      const existingParams =
        targetData.params &&
        typeof targetData.params === 'object' &&
        !Array.isArray(targetData.params)
          ? (targetData.params as Record<string, unknown>)
          : {};
      if (sourceHandle === 'outfitRef') {
        patch.outfitRef = imageUrl;
        patch.params = { ...existingParams, outfitRef: imageUrl };
      } else {
        patch.characterRef = imageUrl;
        patch.params = { ...existingParams, characterRef: imageUrl };
      }
    }

    patch.imageUrl = imageUrl;
    patch.resultUrl = imageUrl;
    patch.url = imageUrl;
    patch.receivedImageUrl = imageUrl;
    patch.mediaType = 'image';
    if (targetType === 'output') {
      patch.output = imageUrl;
    }
    if (IMAGE_SOURCE_TYPES.has(targetType || '')) {
      patch.originalImageUrl = imageUrl;
    }
    return patch;
  }

  if (sourceType === 'sceneLibrary') {
    if (sourceHandle === 'payload') {
      const rawPayload = typeof sourceData.payload === 'string' ? sourceData.payload : '';
      const text = buildSceneLibraryText(sourceData);
      if (!rawPayload && !text) return patch;

      patch.payload = rawPayload;
      patch.scenePayload = rawPayload;
      if (TEXT_TARGET_HANDLES.has(handle)) {
        patch.prompt = text || rawPayload;
        patch.text = text || rawPayload;
        patch.content = text || rawPayload;
      }
      if (targetType === 'aiVideo') {
        const existingParams =
          targetData.params &&
          typeof targetData.params === 'object' &&
          !Array.isArray(targetData.params)
            ? (targetData.params as Record<string, unknown>)
            : {};
        const sceneText = text || rawPayload;
        patch.prompt = appendUniquePromptSegment(
          targetData.prompt || existingParams.prompt,
          sceneText
        );
        patch.scenePayload = rawPayload;
        patch.params = { ...existingParams, prompt: patch.prompt, scenePayload: rawPayload };
      }
      if (targetType === 'gridDirector') {
        const existingParams =
          targetData.params &&
          typeof targetData.params === 'object' &&
          !Array.isArray(targetData.params)
            ? (targetData.params as Record<string, unknown>)
            : {};
        patch.params = { ...existingParams, prompt: text || rawPayload };
      }
      return patch;
    }

    const imageUrl = getSceneLibraryImage(sourceData);
    if (!imageUrl) return patch;

    if (targetType === 'storyboardMaker') {
      return buildStoryboardMakerReferencePatch(targetData, imageUrl, handle);
    }

    if (targetType === 'gridDirector') {
      const existingParams =
        targetData.params &&
        typeof targetData.params === 'object' &&
        !Array.isArray(targetData.params)
          ? (targetData.params as Record<string, unknown>)
          : {};
      patch.sceneRef = imageUrl;
      patch.environmentRef = imageUrl;
      patch.params = { ...existingParams, sceneRef: imageUrl, environmentRef: imageUrl };
    }

    if (targetType === 'aiVideo') {
      const existingParams =
        targetData.params &&
        typeof targetData.params === 'object' &&
        !Array.isArray(targetData.params)
          ? (targetData.params as Record<string, unknown>)
          : {};
      const existingReferenceImages = Array.isArray(existingParams.referenceImages)
        ? existingParams.referenceImages.filter((item): item is string => typeof item === 'string')
        : [];
      patch.referenceImage = imageUrl;
      patch.referenceImages = existingReferenceImages.includes(imageUrl)
        ? existingReferenceImages
        : [...existingReferenceImages, imageUrl];
      patch.params = {
        ...existingParams,
        referenceImage: imageUrl,
        referenceImages: patch.referenceImages,
      };
    }

    patch.imageUrl = imageUrl;
    patch.resultUrl = imageUrl;
    patch.url = imageUrl;
    patch.receivedImageUrl = imageUrl;
    patch.mediaType = 'image';
    if (targetType === 'output') {
      patch.output = imageUrl;
    }
    if (IMAGE_SOURCE_TYPES.has(targetType || '')) {
      patch.originalImageUrl = imageUrl;
    }
    return patch;
  }

  if (sourceType === 'propLibrary') {
    if (sourceHandle === 'payload') {
      const rawPayload = typeof sourceData.payload === 'string' ? sourceData.payload : '';
      const text = buildPropLibraryText(sourceData);
      if (!rawPayload && !text) return patch;

      patch.payload = rawPayload;
      patch.propPayload = rawPayload;
      if (TEXT_TARGET_HANDLES.has(handle)) {
        patch.prompt = text || rawPayload;
        patch.text = text || rawPayload;
        patch.content = text || rawPayload;
      }
      if (targetType === 'gridDirector') {
        const existingParams =
          targetData.params &&
          typeof targetData.params === 'object' &&
          !Array.isArray(targetData.params)
            ? (targetData.params as Record<string, unknown>)
            : {};
        patch.params = { ...existingParams, prompt: text || rawPayload };
      }
      return patch;
    }

    const imageUrl = getPropLibraryImage(sourceData);
    if (!imageUrl) return patch;

    if (targetType === 'storyboardMaker') {
      return buildStoryboardMakerReferencePatch(targetData, imageUrl, handle);
    }

    if (targetType === 'gridDirector') {
      const existingParams =
        targetData.params &&
        typeof targetData.params === 'object' &&
        !Array.isArray(targetData.params)
          ? (targetData.params as Record<string, unknown>)
          : {};
      patch.propRef = imageUrl;
      patch.reference = imageUrl;
      patch.params = { ...existingParams, propRef: imageUrl, reference: imageUrl };
    }

    patch.imageUrl = imageUrl;
    patch.resultUrl = imageUrl;
    patch.url = imageUrl;
    patch.receivedImageUrl = imageUrl;
    patch.mediaType = 'image';
    if (targetType === 'output') {
      patch.output = imageUrl;
    }
    if (IMAGE_SOURCE_TYPES.has(targetType || '')) {
      patch.originalImageUrl = imageUrl;
    }
    return patch;
  }

  if (sourceType === 'script' && targetType === 'gridDirector') {
    const scriptText = String(
      sourceHandle === 'scenes'
        ? output.sceneSummary || sourceData.script || output.text || ''
        : sourceData.script || output.text || ''
    );
    return buildGridDirectorScriptPatch(targetData, scriptText, sourceData.scenes);
  }

  if (sourceType === 'script' && sourceHandle === 'scenes') {
    const sceneSummary = output.sceneSummary || '';
    const scenes =
      output.scenes || (Array.isArray(sourceData.scenes) ? sourceData.scenes : undefined);
    if (Array.isArray(scenes) && scenes.length > 0) {
      patch.scenes = scenes;
      patch.scriptScenes = scenes;
      patch.storyboardScenes = scenes;
    }
    if (TEXT_TARGET_HANDLES.has(handle)) {
      patch.prompt = sceneSummary || output.prompt || output.text;
      patch.text = sceneSummary || output.text || output.prompt;
      patch.content = sceneSummary || output.text || output.prompt;
    }
    return patch;
  }

  if (output.mediaType === 'text' || TEXT_SOURCE_TYPES.has(sourceType || '')) {
    if (targetType === 'gridDirector' && handle === 'scriptInput') {
      return buildGridDirectorScriptPatch(
        targetData,
        String(output.prompt || output.text || sourceData.script || ''),
        sourceData.scenes
      );
    }
    if (TEXT_TARGET_HANDLES.has(handle)) {
      patch.prompt = output.prompt || output.text;
      patch.text = output.text || output.prompt;
      patch.content = output.text || output.prompt;
    }
    return patch;
  }

  if (sourceType === 'gridDirector' && sourceHandle === 'scenes') {
    const storyboardPayload = output.storyboardPayload || '';
    if (!storyboardPayload) return patch;
    patch.storyboardPayload = storyboardPayload;
    if (['input', 'prompt', 'promptInput', 'text', 'script'].includes(handle)) {
      patch.prompt = storyboardPayload;
      patch.text = storyboardPayload;
      patch.content = storyboardPayload;
    }
    return patch;
  }

  if (sourceType === 'imageInput' && sourceHandle === 'prompt') {
    const analysisText = String(
      sourceData.analysisResult || sourceData.outputText || sourceData.prompt || ''
    ).trim();
    if (analysisText && TEXT_TARGET_HANDLES.has(handle)) {
      patch.prompt = analysisText;
      patch.text = analysisText;
      patch.content = analysisText;
    }
    return patch;
  }

  if (output.mediaType === 'video' || handle === 'video' || handle === 'videoInput') {
    if (output.videoUrl || output.resultUrl) {
      const url = output.videoUrl || output.resultUrl;
      patch.videoUrl = url;
      patch.receivedVideoUrl = url;
      patch.url = url;
      patch.mediaType = 'video';
      // ✅ P1-6：累积 mediaTypes 数组，避免互相覆盖；保留 mediaType 向后兼容
      const existingTypes = Array.isArray(targetData.mediaTypes)
        ? (targetData.mediaTypes as string[])
        : [];
      patch.mediaTypes = Array.from(new Set([...existingTypes, 'video']));
      if (!targetData.activeMediaType) patch.activeMediaType = 'video';
    }
    return patch;
  }

  if (output.mediaType === 'audio' || handle === 'audio') {
    if (output.audioUrl || output.resultUrl) {
      const url = output.audioUrl || output.resultUrl;
      patch.audioUrl = url;
      patch.receivedAudioUrl = url;
      patch.resultUrl = url;
      patch.url = url;
      patch.mediaType = 'audio';
      // ✅ P1-6：累积 mediaTypes 数组
      const existingTypes = Array.isArray(targetData.mediaTypes)
        ? (targetData.mediaTypes as string[])
        : [];
      patch.mediaTypes = Array.from(new Set([...existingTypes, 'audio']));
      if (!targetData.activeMediaType) patch.activeMediaType = 'audio';
      if (targetType === 'output') {
        patch.output = url;
      }
    }
    return patch;
  }

  const sourceMaskUrl =
    sourceType === 'localMatting' && sourceHandle === 'mask'
      ? (sourceData.maskUrl as string | undefined)
      : undefined;
  const imageUrl = sourceMaskUrl || output.imageUrl || output.gridImageUrl || output.resultUrl;
  if (!imageUrl) return patch;

  if (targetType === 'storyboardMaker') {
    return buildStoryboardMakerReferencePatch(targetData, imageUrl, handle);
  }

  if (sourceType === 'gridDirector') {
    if (output.storyboardPayload) {
      patch.storyboardPayload = output.storyboardPayload;
    }
    patch.gridImageUrl = output.gridImageUrl || imageUrl;
    patch.coverImageUrl = output.coverImageUrl || imageUrl;
    if (output.frameResults !== undefined) {
      patch.storyboardFrames = output.frameResults;
    }
  }

  if (handle === 'characterImage' || handle === 'targetImage') {
    if (handle === 'characterImage') patch.characterImageUrl = imageUrl;
    if (handle === 'targetImage') patch.targetImageUrl = imageUrl;
    patch.imageUrl = imageUrl;
    return patch;
  }

  if (handle === 'mask') {
    patch.maskUrl = imageUrl;
    return patch;
  }

  patch.imageUrl = imageUrl;
  patch.resultUrl = imageUrl;
  patch.url = imageUrl;
  patch.receivedImageUrl = imageUrl;
  patch.mediaType = 'image';
  // ✅ P1-6：累积 mediaTypes 数组，避免互相覆盖
  const existingTypesForImage = Array.isArray(targetData.mediaTypes)
    ? (targetData.mediaTypes as string[])
    : [];
  patch.mediaTypes = Array.from(new Set([...existingTypesForImage, 'image']));
  if (!targetData.activeMediaType) patch.activeMediaType = 'image';

  if (sourceType === 'director3D' && targetType === 'aiVideo') {
    const existingParams =
      targetData.params &&
      typeof targetData.params === 'object' &&
      !Array.isArray(targetData.params)
        ? (targetData.params as Record<string, unknown>)
        : {};
    const directorPrompt = String(sourceData.prompt || output.prompt || '').trim();
    const mergedPrompt = appendUniquePromptSegment(
      targetData.prompt || existingParams.prompt,
      directorPrompt
    );
    const director3DView = readObjectParam(sourceData, 'view');
    const director3DObjects = readObjectParam(sourceData, 'objects');
    const director3DCameras = readObjectParam(sourceData, 'cameras');
    const director3DCameraPresets = readObjectParam(sourceData, 'cameraPresets');
    const director3DEnvironment = readObjectParam(sourceData, 'environment');

    patch.referenceImage = imageUrl;
    patch.startImage = imageUrl;
    if (mergedPrompt) {
      patch.prompt = mergedPrompt;
    }
    patch.director3DView = director3DView;
    patch.director3DObjects = director3DObjects;
    patch.director3DCameras = director3DCameras;
    patch.director3DCameraPresets = director3DCameraPresets;
    patch.director3DEnvironment = director3DEnvironment;
    patch.params = {
      ...existingParams,
      referenceImage: imageUrl,
      startImage: imageUrl,
      ...(mergedPrompt ? { prompt: mergedPrompt } : {}),
      director3DView,
      director3DObjects,
      director3DCameras,
      director3DCameraPresets,
      director3DEnvironment,
      generationMode: existingParams.generationMode || 'image_to_video',
    };
  }

  if (targetType === 'output') {
    patch.output = imageUrl;
  }

  if (IMAGE_SOURCE_TYPES.has(targetType || '')) {
    patch.originalImageUrl = patch.originalImageUrl || imageUrl;
  }

  return patch;
}

/** 将 sourceNode 的输出同步到所有直接下游节点 */
export function syncDownstreamFromNode(sourceNodeId: string): number {
  const edges = canvasStoreApi.getEdges();
  const nodes = canvasStoreApi.getNodes();
  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return 0;

  const sourceData = (sourceNode.data || {}) as Record<string, unknown>;
  const sourceType = (sourceData.type || sourceNode.type || '') as string;
  const output = extractNodeOutput(sourceNode);
  const outgoing = edgeIndexApi.getOutgoingEdges(sourceNodeId, edges);
  let synced = 0;

  for (const edge of outgoing) {
    const target = canvasStoreApi.getNodes().find((n) => n.id === edge.target);
    if (!target) continue;
    const targetData = (target.data || {}) as Record<string, unknown>;
    const targetType = (targetData.type || target.type || '') as string;
    const targetHandle = edge.targetHandle || 'input';

    const rawPatch = buildDownstreamPatch(
      targetType,
      edge.targetHandle || undefined,
      edge.sourceHandle || undefined,
      sourceType,
      sourceData,
      targetData,
      output
    );

    if (Object.keys(rawPatch).length === 0) continue;

    // ✅ P2-1：运行时边数据校验 — 按目标端口类型过滤不兼容字段
    const { sanitizedPatch, filteredFields, valid } = sanitizePatchByPortType(
      rawPatch,
      targetType,
      targetHandle
    );

    if (filteredFields.length > 0 && typeof console !== 'undefined') {
      console.debug(
        `[syncDownstream] 🔄 P2-1 过滤不兼容字段：${filteredFields.join(', ')} → ${targetType}:${targetHandle}`
      );
    }

    if (!valid) continue;

    canvasStoreApi.updateNodeData(edge.target, {
      ...sanitizedPatch,
      _aicgSyncedFrom: sourceNodeId,
      _aicgSyncedAt: Date.now(),
    });
    synced += 1;
  }

  if (synced > 0) {
    nodeEventBus.emitDownstreamSynced(sourceNodeId, synced);
  }

  return synced;
}

type ClearableLibraryType = 'sceneLibrary' | 'propLibrary';

function clearLibraryDownstreamFromNode(
  sourceNodeId: string,
  libraryType: ClearableLibraryType
): number {
  const outgoing = canvasStoreApi.getEdges().filter((edge) => edge.source === sourceNodeId);
  let cleared = 0;

  for (const edge of outgoing) {
    const target = canvasStoreApi.getNodes().find((entry) => entry.id === edge.target);
    if (!target) continue;

    const sourceHandle =
      edge.sourceHandle || (libraryType === 'sceneLibrary' ? 'sceneRef' : 'propRef');
    const targetHandle = edge.targetHandle || 'input';
    const targetType = String(
      target.type || (target.data as Record<string, unknown> | undefined)?.type || ''
    );
    const targetData = (target.data || {}) as Record<string, unknown>;
    const existingParams =
      targetData.params &&
      typeof targetData.params === 'object' &&
      !Array.isArray(targetData.params)
        ? (targetData.params as Record<string, unknown>)
        : {};
    const clearsPayload = sourceHandle === 'payload' || CLEAR_TEXT_TARGET_HANDLES.has(targetHandle);
    const patch: Record<string, unknown> = {
      _aicgSyncedFrom: undefined,
      _aicgSyncedAt: Date.now(),
    };

    if (clearsPayload) {
      patch.prompt = '';
      patch.text = '';
      patch.content = '';
      patch.payload = '';
      if (libraryType === 'sceneLibrary') {
        patch.scenePayload = '';
      } else {
        patch.propPayload = '';
      }
      if (targetType === 'gridDirector') {
        patch.params = { ...existingParams, prompt: '' };
      }
    } else {
      patch.imageUrl = '';
      patch.resultUrl = '';
      patch.url = '';
      patch.receivedImageUrl = '';
      patch.originalImageUrl = '';
      patch.referenceImageUrl = '';
      patch.mediaType = undefined;
      if (targetType === 'output') {
        patch.output = '';
      }
      if (targetType === 'gridDirector') {
        patch.params =
          libraryType === 'sceneLibrary'
            ? { ...existingParams, sceneRef: '', environmentRef: '' }
            : { ...existingParams, propRef: '', reference: '' };
      }
      if (libraryType === 'sceneLibrary') {
        patch.sceneRef = '';
        patch.environmentRef = '';
      } else {
        patch.propRef = '';
        patch.reference = '';
      }
    }

    canvasStoreApi.updateNodeData(edge.target, patch);
    cleared += 1;
  }

  if (cleared > 0) {
    nodeEventBus.emitDownstreamSynced(sourceNodeId, cleared);
  }

  return cleared;
}

export function clearSceneLibraryDownstreamFromNode(sourceNodeId: string): number {
  return clearLibraryDownstreamFromNode(sourceNodeId, 'sceneLibrary');
}

export function clearPropLibraryDownstreamFromNode(sourceNodeId: string): number {
  return clearLibraryDownstreamFromNode(sourceNodeId, 'propLibrary');
}

export function getDownstreamNodeIds(sourceNodeId: string, edges: Edge[]): string[] {
  // ✅ P1-4：优先使用边索引缓存
  return edgeIndexApi.getOutgoingEdges(sourceNodeId, edges).map((e) => e.target);
}
