import type { CharacterAsset, CharacterAssetPayload } from '@/types/asset-library';

export interface CharacterLibraryPayload {
  version: 1;
  sourceNodeType: 'characterLibrary';
  character: CharacterAssetPayload;
}

export function buildCharacterAssetPayload(asset: CharacterAsset): CharacterAssetPayload {
  return {
    characterId: asset.id,
    name: asset.name,
    summary: asset.summary,
    primaryImage: asset.primaryImage,
    outfitImage: asset.outfitImage,
    prompt: asset.prompt,
    negativePrompt: asset.negativePrompt,
    tags: asset.tags,
    defaultVoiceAssetId: asset.defaultVoiceAssetId,
  };
}

export function buildCharacterLibraryPayload(asset: CharacterAsset): string {
  return JSON.stringify({
    version: 1,
    sourceNodeType: 'characterLibrary',
    character: buildCharacterAssetPayload(asset),
  } satisfies CharacterLibraryPayload);
}

export function parseCharacterLibraryPayload(raw: unknown): CharacterLibraryPayload | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CharacterLibraryPayload;
    if (
      parsed?.version !== 1 ||
      parsed?.sourceNodeType !== 'characterLibrary' ||
      !parsed?.character?.characterId ||
      !parsed?.character?.primaryImage
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getCharacterAssetPayloadFromNodeData(data: Record<string, unknown>) {
  const payload = parseCharacterLibraryPayload(data.payload);
  return payload?.character ?? null;
}

export function resolveCharacterReferenceFromNodeData(
  data: Record<string, unknown>,
  sourceHandle?: string | null,
): string | null {
  if (sourceHandle === 'outfitRef') {
    return (
      (typeof data.outfitRef === 'string' && data.outfitRef) ||
      getCharacterAssetPayloadFromNodeData(data)?.outfitImage ||
      null
    );
  }

  return (
    (typeof data.characterRef === 'string' && data.characterRef) ||
    (typeof data.imageUrl === 'string' && data.imageUrl) ||
    getCharacterAssetPayloadFromNodeData(data)?.primaryImage ||
    null
  );
}

export function resolveOutfitReferenceFromNodeData(data: Record<string, unknown>): string | null {
  return (
    (typeof data.outfitRef === 'string' && data.outfitRef) ||
    getCharacterAssetPayloadFromNodeData(data)?.outfitImage ||
    null
  );
}

export function appendPromptSegment(base: string, segment?: string | null): string {
  const normalizedBase = base.trim();
  const normalizedSegment = segment?.trim();

  if (!normalizedSegment) {
    return normalizedBase;
  }

  if (!normalizedBase) {
    return normalizedSegment;
  }

  if (normalizedBase.includes(normalizedSegment)) {
    return normalizedBase;
  }

  return `${normalizedBase}, ${normalizedSegment}`;
}
