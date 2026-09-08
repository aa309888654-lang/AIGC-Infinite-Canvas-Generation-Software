import type { SceneAsset, SceneAssetPayload } from '@/types/asset-library';

export interface SceneLibraryPayload {
  version: 1;
  sourceNodeType: 'sceneLibrary';
  scene: SceneAssetPayload;
}

export function buildSceneAssetPayload(asset: SceneAsset): SceneAssetPayload {
  return {
    sceneId: asset.id,
    name: asset.name,
    summary: asset.summary,
    primaryImage: asset.primaryImage,
    lightingPrompt: asset.lightingPrompt,
    environmentPrompt: asset.environmentPrompt,
    prompt: asset.prompt,
    negativePrompt: asset.negativePrompt,
    tags: asset.tags,
  };
}

export function buildSceneLibraryPayload(asset: SceneAsset): string {
  return JSON.stringify({
    version: 1,
    sourceNodeType: 'sceneLibrary',
    scene: buildSceneAssetPayload(asset),
  } satisfies SceneLibraryPayload);
}

export function parseSceneLibraryPayload(raw: unknown): SceneLibraryPayload | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SceneLibraryPayload;
    if (
      parsed?.version !== 1 ||
      parsed?.sourceNodeType !== 'sceneLibrary' ||
      !parsed?.scene?.sceneId
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getSceneAssetPayloadFromNodeData(data: Record<string, unknown>) {
  const payload = parseSceneLibraryPayload(data.payload);
  return payload?.scene ?? null;
}

export function resolveSceneReferenceFromNodeData(
  data: Record<string, unknown>,
): string | null {
  return (
    (typeof data.sceneRef === 'string' && data.sceneRef) ||
    (typeof data.imageUrl === 'string' && data.imageUrl) ||
    getSceneAssetPayloadFromNodeData(data)?.primaryImage ||
    null
  );
}
