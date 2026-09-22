import type { Node } from '@xyflow/react';
import { useGenerationVersionStore } from '@/store/useGenerationVersionStore';
import { useShotStore } from '@/store/useShotStore';
import type { GenerationMediaType, GenerationVersion } from '@/types/generation-version';
import type { ShotStatus } from '@/types/shot-system';

type NodeData = Record<string, unknown> & {
  shotId?: string;
  shotRole?: string;
  prompt?: string;
  modelId?: string;
  params?: Record<string, unknown>;
  task?: {
    status?: string;
    resultUrl?: string;
    resultUrls?: string[];
    error?: string;
  };
};

export interface ShotResultSyncSummary {
  syncedCount: number;
  updatedShotIds: string[];
}

const URL_FIELDS = ['resultUrl', 'imageUrl', 'videoUrl', 'audioUrl', 'url', 'cosUrl'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function collectUrls(data: NodeData): string[] {
  const urls = new Set<string>();

  for (const field of URL_FIELDS) {
    const url = asString(data[field]);
    if (url) urls.add(url);
  }

  if (Array.isArray(data.resultUrls)) {
    data.resultUrls.forEach((url) => {
      if (typeof url === 'string' && url.trim()) urls.add(url.trim());
    });
  }

  if (data.task) {
    const taskUrl = asString(data.task.resultUrl);
    if (taskUrl) urls.add(taskUrl);
    if (Array.isArray(data.task.resultUrls)) {
      data.task.resultUrls.forEach((url) => {
        if (typeof url === 'string' && url.trim()) urls.add(url.trim());
      });
    }
  }

  return [...urls];
}

function urlHasExtension(url: string, extensions: string[]) {
  const normalized = url.split('?')[0]?.toLowerCase() || '';
  return extensions.some((extension) => normalized.endsWith(extension));
}

function inferMediaType(node: Node<Record<string, unknown>>, url: string): GenerationMediaType {
  const data = node.data as NodeData;
  const nodeType = `${node.type || ''} ${asString(data.type) || ''} ${data.shotRole || ''}`.toLowerCase();

  if (nodeType.includes('audio') || urlHasExtension(url, AUDIO_EXTENSIONS)) return 'audio';
  if (nodeType.includes('video') || urlHasExtension(url, VIDEO_EXTENSIONS)) return 'video';
  if (nodeType.includes('image') || nodeType.includes('img') || urlHasExtension(url, IMAGE_EXTENSIONS)) return 'image';

  return 'text';
}

function getPrompt(data: NodeData) {
  return asString(data.prompt) || asString(data.params?.prompt);
}

function getModelId(data: NodeData) {
  return asString(data.modelId) || asString(data.params?.modelId);
}

function getNextStatus(current: ShotStatus, mediaType: GenerationMediaType): ShotStatus {
  if (mediaType === 'video') return 'video_ready';
  if (mediaType === 'image' && current !== 'video_ready') return 'image_ready';
  return current;
}

function patchShotForVersion(version: GenerationVersion) {
  const shotStore = useShotStore.getState();
  const shot = shotStore.shots.find((item) => item.id === version.shotId);
  if (!shot) return;

  const patch =
    version.mediaType === 'video'
      ? {
          status: getNextStatus(shot.status, version.mediaType),
          selectedVideoVersionId: shot.selectedVideoVersionId || version.id,
        }
      : version.mediaType === 'image'
        ? {
            status: getNextStatus(shot.status, version.mediaType),
            selectedImageVersionId: shot.selectedImageVersionId || version.id,
          }
        : {
            status: getNextStatus(shot.status, version.mediaType),
          };

  shotStore.updateShot(version.shotId, patch);
}

export function syncShotResultFromNode(
  node: Node<Record<string, unknown>> | undefined,
  success = true
): ShotResultSyncSummary {
  if (!node) return { syncedCount: 0, updatedShotIds: [] };

  const data = asRecord(node.data) as NodeData | undefined;
  if (!data?.shotId) return { syncedCount: 0, updatedShotIds: [] };

  const shotStore = useShotStore.getState();
  const shot = shotStore.shots.find((item) => item.id === data.shotId);
  if (!shot) return { syncedCount: 0, updatedShotIds: [] };

  if (!success || data.task?.status === 'failed' || data.error) {
    shotStore.updateShot(data.shotId, { status: 'failed' });
    return { syncedCount: 0, updatedShotIds: [data.shotId] };
  }

  const urls = collectUrls(data);
  if (urls.length === 0) return { syncedCount: 0, updatedShotIds: [] };

  const versionStore = useGenerationVersionStore.getState();
  let syncedCount = 0;

  for (const url of urls) {
    const version = versionStore.upsertFromNodeResult({
      shotId: data.shotId,
      nodeId: node.id,
      nodeType: node.type,
      mediaType: inferMediaType(node, url),
      url,
      prompt: getPrompt(data),
      modelId: getModelId(data),
      params: data.params,
      source: 'node-sync',
    });

    patchShotForVersion(version);
    syncedCount += 1;
  }

  return { syncedCount, updatedShotIds: syncedCount > 0 ? [data.shotId] : [] };
}

export function syncAllShotResultsFromNodes(nodes: Node<Record<string, unknown>>[]): ShotResultSyncSummary {
  const updatedShotIds = new Set<string>();
  let syncedCount = 0;

  for (const node of nodes) {
    const summary = syncShotResultFromNode(node);
    syncedCount += summary.syncedCount;
    summary.updatedShotIds.forEach((shotId) => updatedShotIds.add(shotId));
  }

  return { syncedCount, updatedShotIds: [...updatedShotIds] };
}
