/**
 * 运行时边数据校验器（P2-1）
 *
 * 在 syncDownstreamFromNode 写入下游前，校验 buildDownstreamPatch 产出的 patch
 * 是否与目标句柄的端口类型兼容。过滤掉不兼容字段，防止类型污染。
 *
 * 端口类型与字段映射：
 * - image  → imageUrl, resultUrl, url, receivedImageUrl, mediaType, mediaTypes, originalImageUrl, characterImageUrl, targetImageUrl, maskUrl, referenceImage, referenceImages, gridImageUrl, coverImageUrl
 * - video  → videoUrl, receivedVideoUrl, url, mediaType, mediaTypes, activeMediaType
 * - audio  → audioUrl, receivedAudioUrl, resultUrl, url, mediaType, mediaTypes, activeMediaType
 * - string/prompt → prompt, text, content, outputPrompt, params.prompt, payload, scriptScenes, scenes, storyboardPayload
 *
 * 对于 string 类型端口（泛化 input），允许所有字段通过（向后兼容）。
 */

import { getPortType, type PortType } from '@/types/node-system';
import type { NodeOutputSnapshot } from '@/services/aicg-downstream-sync';

export interface EdgeDataValidationResult {
  /** 是否兼容（true = 可写入，false = 应跳过） */
  valid: boolean;
  /** 过滤后的 patch（仅含目标句柄类型可接受字段） */
  sanitizedPatch: Record<string, unknown>;
  /** 被过滤掉的字段名列表（用于日志） */
  filteredFields: string[];
  /** 目标端口类型（null = 未注册端口，放行所有） */
  targetPortType: PortType | null;
}

/** image 端口允许的字段白名单 */
const IMAGE_PORT_FIELDS = new Set([
  'imageUrl', 'resultUrl', 'url', 'receivedImageUrl',
  'mediaType', 'mediaTypes', 'activeMediaType', 'originalImageUrl',
  'characterImageUrl', 'targetImageUrl', 'maskUrl',
  'referenceImage', 'referenceImages', 'startImage',
  'referenceImageUrls', 'characterReferenceUrls',
  'visualReferenceImages', 'characterReferenceImages',
  'gridImageUrl', 'coverImageUrl', 'storyboardFrames',
  'storyboardPayload',
  'params', 'scriptSourceMode',
  // library 节点特有
  'characterRef', 'outfitRef', 'sceneRef', 'environmentRef', 'propRef', 'reference',
  // director3D 特有
  'director3DView', 'director3DObjects', 'director3DCameras', 'director3DCameraPresets', 'director3DEnvironment',
  // 同步标记
  '_aicgSyncedFrom', '_aicgSyncedAt', 'output',
]);

/** video 端口允许的字段白名单 */
const VIDEO_PORT_FIELDS = new Set([
  'videoUrl', 'receivedVideoUrl', 'url', 'resultUrl',
  'mediaType', 'mediaTypes', 'activeMediaType',
  'referenceImage', 'referenceImages', 'startImage',
  // director3D → aiVideo 的附加字段
  'prompt', 'params', 'director3DView', 'director3DObjects',
  'director3DCameras', 'director3DCameraPresets', 'director3DEnvironment',
  '_aicgSyncedFrom', '_aicgSyncedAt', 'output',
]);

/** audio 端口允许的字段白名单 */
const AUDIO_PORT_FIELDS = new Set([
  'audioUrl', 'receivedAudioUrl', 'resultUrl', 'url',
  'mediaType', 'mediaTypes', 'activeMediaType',
  '_aicgSyncedFrom', '_aicgSyncedAt', 'output',
]);

/** text/prompt 端口允许的字段白名单 */
const TEXT_PORT_FIELDS = new Set([
  'prompt', 'text', 'content', 'outputPrompt', 'params',
  'payload', 'characterPayload', 'scenePayload', 'propPayload',
  'cameraPath', 'cameraPathJson',
  'scenes', 'scriptScenes', 'storyboardScenes',
  'storyboardPayload',
  '_aicgSyncedFrom', '_aicgSyncedAt',
]);

/**
 * 根据目标端口类型过滤 patch，移除不兼容字段。
 *
 * @param patch buildDownstreamPatch 产出的原始 patch
 * @param targetNodeType 目标节点类型
 * @param targetHandle 目标句柄 ID
 * @returns 过滤结果
 */
export function sanitizePatchByPortType(
  patch: Record<string, unknown>,
  targetNodeType: string,
  targetHandle: string,
): EdgeDataValidationResult {
  const targetPortType = getPortType(targetNodeType, targetHandle, 'target');

  // 未注册端口 → 放行所有字段（向后兼容）
  if (targetPortType === null) {
    return {
      valid: true,
      sanitizedPatch: patch,
      filteredFields: [],
      targetPortType: null,
    };
  }

  // string 类型端口是泛化端口，放行所有字段（向后兼容）
  if (targetPortType === 'string') {
    return {
      valid: true,
      sanitizedPatch: patch,
      filteredFields: [],
      targetPortType,
    };
  }

  // 根据端口类型选择白名单
  let allowedFields: Set<string>;
  switch (targetPortType) {
    case 'image':
      allowedFields = IMAGE_PORT_FIELDS;
      break;
    case 'video':
      allowedFields = VIDEO_PORT_FIELDS;
      break;
    case 'audio':
      allowedFields = AUDIO_PORT_FIELDS;
      break;
    case 'prompt':
      allowedFields = TEXT_PORT_FIELDS;
      break;
    default:
      return {
        valid: true,
        sanitizedPatch: patch,
        filteredFields: [],
        targetPortType,
      };
  }

  // 过滤 patch
  const sanitizedPatch: Record<string, unknown> = {};
  const filteredFields: string[] = [];

  for (const key of Object.keys(patch)) {
    if (allowedFields.has(key)) {
      sanitizedPatch[key] = patch[key];
    } else {
      filteredFields.push(key);
    }
  }

  return {
    valid: Object.keys(sanitizedPatch).length > 0,
    sanitizedPatch,
    filteredFields,
    targetPortType,
  };
}

/**
 * 判断 source 输出是否与 target 端口类型兼容（粗粒度校验）。
 * 用于 syncDownstreamFromNode 的早期短路。
 */
export function isOutputCompatibleWithPort(
  output: NodeOutputSnapshot,
  targetNodeType: string,
  targetHandle: string,
): boolean {
  const targetPortType = getPortType(targetNodeType, targetHandle, 'target');
  if (targetPortType === null || targetPortType === 'string') return true;

  const hasImage = !!(output.imageUrl || output.gridImageUrl || output.resultUrl);
  const hasVideo = !!output.videoUrl;
  const hasAudio = !!output.audioUrl;
  const hasText = !!(output.prompt || output.text);

  switch (targetPortType) {
    case 'image':
      return hasImage;
    case 'video':
      return hasVideo || hasImage; // 图片可作视频参考
    case 'audio':
      return hasAudio;
    case 'prompt':
      return hasText;
    default:
      return true;
  }
}
