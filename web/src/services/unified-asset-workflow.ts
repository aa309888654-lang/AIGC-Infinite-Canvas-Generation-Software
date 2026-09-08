import { generateId } from '@/lib/utils';
import type { ClipImportItem, ClipMediaType } from '@/services/canvas-clip-bridge-service';
import type { MediaAsset } from '@/store/editmaster/types';
import type { Node } from '@xyflow/react';

export type UnifiedAssetType = 'image' | 'video' | 'audio' | 'text' | 'workflow' | 'document' | 'other';

export interface UnifiedAssetLike {
  id: string;
  name: string;
  type: UnifiedAssetType | string;
  url?: string;
  thumbnailUrl?: string;
  size?: number;
  duration?: number;
  textContent?: string;
  source?: string;
  sourceType?: string;
  nodeId?: string;
  metadata?: Record<string, unknown>;
  storyboard?: MediaAsset['storyboard'];
}

export interface UnifiedAssetDragPayload {
  type: 'asset';
  sourceId: string;
  kind: 'video' | 'image' | 'audio' | 'text';
  name: string;
  duration: number;
  url?: string;
  thumbnailUrl?: string;
  assetType: 'video' | 'image' | 'audio';
  fileType: UnifiedAssetType | string;
  size?: number;
  storyboard?: MediaAsset['storyboard'];
  source?: string;
  sourceType?: string;
  nodeId?: string;
}

export function isTimelineMediaType(type: string): type is ClipMediaType {
  return type === 'image' || type === 'video' || type === 'audio';
}

export function canSendAssetToTimeline(asset: UnifiedAssetLike): asset is UnifiedAssetLike & { type: ClipMediaType; url: string } {
  return isTimelineMediaType(String(asset.type)) && Boolean(asset.url);
}

export function getDefaultAssetDuration(asset: Pick<UnifiedAssetLike, 'type' | 'duration'>): number {
  if (typeof asset.duration === 'number' && Number.isFinite(asset.duration) && asset.duration > 0) {
    return asset.duration;
  }
  return asset.type === 'image' ? 3 : 5;
}

export function buildClipImportItemFromAsset(asset: UnifiedAssetLike): ClipImportItem | null {
  if (!canSendAssetToTimeline(asset)) return null;
  return {
    url: asset.url,
    type: asset.type,
    name: asset.name,
    duration: getDefaultAssetDuration(asset),
    storyboard: asset.storyboard,
  };
}

export function buildTimelineDragPayload(asset: UnifiedAssetLike): UnifiedAssetDragPayload | null {
  if (!canSendAssetToTimeline(asset)) return null;
  const kind = asset.type === 'audio' ? 'audio' : asset.type === 'image' ? 'image' : 'video';
  return {
    type: 'asset',
    sourceId: asset.id,
    kind,
    name: asset.name,
    duration: getDefaultAssetDuration(asset),
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
    assetType: asset.type,
    fileType: asset.type,
    size: asset.size,
    storyboard: asset.storyboard,
    source: asset.source,
    sourceType: asset.sourceType,
    nodeId: asset.nodeId,
  };
}

export function buildCanvasNodeFromAsset(asset: UnifiedAssetLike, position = { x: 100, y: 100 }): Node<Record<string, unknown>> | null {
  const nodeId = generateId();
  const baseData = {
    label: asset.name,
    fileName: asset.name,
    sourceAssetId: asset.id,
    source: asset.source,
    sourceType: asset.sourceType,
  };

  if (asset.type === 'image' && asset.url) {
    return {
      id: nodeId,
      type: 'imageInput',
      position,
      data: {
        ...baseData,
        type: 'imageInput',
        imageUrl: asset.url,
        thumbnailUrl: asset.thumbnailUrl || asset.url,
      },
    };
  }

  if (asset.type === 'video' && asset.url) {
    return {
      id: nodeId,
      type: 'videoInput',
      position,
      data: {
        ...baseData,
        type: 'videoInput',
        videoUrl: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
        duration: asset.duration,
      },
    };
  }

  if (asset.type === 'audio' && asset.url) {
    return {
      id: nodeId,
      type: 'audioGen',
      position,
      data: {
        ...baseData,
        type: 'audioInput',
        audioUrl: asset.url,
        duration: asset.duration,
      },
    };
  }

  if (asset.type === 'text') {
    return {
      id: nodeId,
      type: 'aiGenText',
      position,
      data: {
        ...baseData,
        type: 'aiGenText',
        text: asset.textContent || asset.name,
        content: asset.textContent || asset.name,
        textContent: asset.textContent || asset.name,
      },
    };
  }

  return null;
}
