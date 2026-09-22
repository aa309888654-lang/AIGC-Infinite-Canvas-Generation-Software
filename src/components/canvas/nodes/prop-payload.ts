import type { PropAsset, PropAssetPayload } from '@/types/asset-library';

export interface PropLibraryPayload {
  version: 1;
  sourceNodeType: 'propLibrary';
  prop: PropAssetPayload;
}

export function buildPropAssetPayload(asset: PropAsset): PropAssetPayload {
  return {
    propId: asset.id,
    name: asset.name,
    summary: asset.summary,
    primaryImage: asset.primaryImage,
    materialTags: asset.materialTags,
    prompt: asset.prompt,
    negativePrompt: asset.negativePrompt,
    tags: asset.tags,
  };
}

export function buildPropLibraryPayload(asset: PropAsset): string {
  return JSON.stringify({
    version: 1,
    sourceNodeType: 'propLibrary',
    prop: buildPropAssetPayload(asset),
  } satisfies PropLibraryPayload);
}

export function parsePropLibraryPayload(raw: unknown): PropLibraryPayload | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PropLibraryPayload;
    if (
      parsed?.version !== 1 ||
      parsed?.sourceNodeType !== 'propLibrary' ||
      !parsed?.prop?.propId ||
      !parsed?.prop?.primaryImage
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getPropAssetPayloadFromNodeData(data: Record<string, unknown>) {
  const payload = parsePropLibraryPayload(data.payload);
  return payload?.prop ?? null;
}

export function resolvePropReferenceFromNodeData(
  data: Record<string, unknown>,
): string | null {
  return (
    (typeof data.propRef === 'string' && data.propRef) ||
    (typeof data.imageUrl === 'string' && data.imageUrl) ||
    getPropAssetPayloadFromNodeData(data)?.primaryImage ||
    null
  );
}
