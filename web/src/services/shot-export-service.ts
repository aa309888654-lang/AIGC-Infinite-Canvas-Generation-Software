import type { GenerationVersion } from '@/types/generation-version';
import type { Shot } from '@/types/shot-system';
import type { ClipImportItem } from '@/services/canvas-clip-bridge-service';
import type { StoryboardClipMetadata } from '@/store/editmaster/types';

export interface StoryboardExportAsset {
  type: 'image' | 'video';
  url: string;
  versionId: string;
  nodeId: string;
  prompt?: string;
  modelId?: string;
}

export interface StoryboardExportItem {
  shotId: string;
  index: number;
  title: string;
  scene: string;
  scriptText: string;
  visualPrompt: string;
  camera: string;
  duration: number;
  aspectRatio: string;
  status: Shot['status'];
  asset?: StoryboardExportAsset;
}

export interface StoryboardExportSummary {
  shotCount: number;
  imageReadyCount: number;
  videoReadyCount: number;
  missingAssetCount: number;
  totalDuration: number;
}

export interface StoryboardExportDocument {
  schema: 'xiaotian.storyboard.export';
  version: 1;
  createdAt: string;
  summary: StoryboardExportSummary;
  shots: StoryboardExportItem[];
}

function sortVersions(a: GenerationVersion, b: GenerationVersion) {
  if (a.selected !== b.selected) return a.selected ? -1 : 1;
  if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function findVersion(shot: Shot, versions: GenerationVersion[], mediaType: 'image' | 'video') {
  const selectedId = mediaType === 'image' ? shot.selectedImageVersionId : shot.selectedVideoVersionId;
  const candidates = versions
    .filter((version) => version.shotId === shot.id && version.mediaType === mediaType)
    .sort(sortVersions);

  return candidates.find((version) => version.id === selectedId) || candidates[0];
}

function toAsset(version: GenerationVersion | undefined): StoryboardExportAsset | undefined {
  if (!version || (version.mediaType !== 'image' && version.mediaType !== 'video')) return undefined;

  return {
    type: version.mediaType,
    url: version.url,
    versionId: version.id,
    nodeId: version.nodeId,
    prompt: version.prompt,
    modelId: version.modelId,
  };
}

export function buildStoryboardExport(shots: Shot[], versions: GenerationVersion[]): StoryboardExportDocument {
  const orderedShots = [...shots].sort((a, b) => a.index - b.index);
  const items = orderedShots.map((shot) => {
    const selectedVideo = findVersion(shot, versions, 'video');
    const selectedImage = findVersion(shot, versions, 'image');
    const asset = toAsset(selectedVideo) || toAsset(selectedImage);

    return {
      shotId: shot.id,
      index: shot.index,
      title: shot.title,
      scene: shot.scene,
      scriptText: shot.scriptText,
      visualPrompt: shot.visualPrompt,
      camera: shot.camera,
      duration: shot.duration,
      aspectRatio: shot.aspectRatio,
      status: shot.status,
      asset,
    };
  });

  return {
    schema: 'xiaotian.storyboard.export',
    version: 1,
    createdAt: new Date().toISOString(),
    summary: {
      shotCount: items.length,
      imageReadyCount: items.filter((item) => item.asset?.type === 'image').length,
      videoReadyCount: items.filter((item) => item.asset?.type === 'video').length,
      missingAssetCount: items.filter((item) => !item.asset).length,
      totalDuration: items.reduce((total, item) => total + item.duration, 0),
    },
    shots: items,
  };
}

export function storyboardExportFilename(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `xiaotian-storyboard-${stamp}.json`;
}

export function downloadStoryboardExport(document: StoryboardExportDocument) {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = storyboardExportFilename();
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildClipItemsFromStoryboardExport(document: StoryboardExportDocument): ClipImportItem[] {
  return document.shots
    .filter((shot) => shot.asset?.url)
    .map((shot) => ({
      url: shot.asset!.url,
      type: shot.asset!.type,
      name: `${String(shot.index).padStart(2, '0')} ${shot.title}`,
      duration: shot.duration,
      storyboard: {
        source: 'storyboard',
        shotId: shot.shotId,
        index: shot.index,
        title: shot.title,
        scene: shot.scene,
        scriptText: shot.scriptText,
        visualPrompt: shot.visualPrompt,
        camera: shot.camera,
        aspectRatio: shot.aspectRatio,
        versionId: shot.asset!.versionId,
        nodeId: shot.asset!.nodeId,
        mediaType: shot.asset!.type,
        prompt: shot.asset!.prompt,
        modelId: shot.asset!.modelId,
      } satisfies StoryboardClipMetadata,
    }));
}
