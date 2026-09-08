import { getVideoControllerModelPresets as getRawVideoControllerModelPresets } from './video-controller-models';
import type {
  OfficialVideoField,
  OfficialVideoMode,
  OfficialVideoModelCapability,
} from './video-model-capabilities';

interface VideoControllerModelFamily {
  label: string;
  routes: Partial<Record<OfficialVideoMode, string>>;
}

// Some providers expose one route per generation mode. Present those routes as
// one controller model and choose the concrete route only when execution starts.
const VIDEO_CONTROLLER_MODEL_FAMILIES: Record<string, VideoControllerModelFamily> = {};

const canonicalIds = new Map<string, string>();
for (const [canonicalId, family] of Object.entries(VIDEO_CONTROLLER_MODEL_FAMILIES)) {
  for (const routeId of Object.values(family.routes)) {
    if (routeId) canonicalIds.set(routeId, canonicalId);
  }
}

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

export function getVideoControllerCanonicalModelId(modelId: string): string {
  return canonicalIds.get(modelId) || modelId;
}

export function resolveVideoControllerRouteId(modelId: string, mode: OfficialVideoMode): string {
  const canonicalId = getVideoControllerCanonicalModelId(modelId);
  return VIDEO_CONTROLLER_MODEL_FAMILIES[canonicalId]?.routes[mode] || modelId;
}

export function getVideoControllerModelPresets(): OfficialVideoModelCapability[] {
  const rawModels = getRawVideoControllerModelPresets();
  return rawModels.flatMap((model) => {
    const canonicalId = getVideoControllerCanonicalModelId(model.id);
    if (canonicalId !== model.id) return [];
    const family = VIDEO_CONTROLLER_MODEL_FAMILIES[canonicalId];
    if (!family) return [model];

    const members = unique(Object.values(family.routes).filter((id): id is string => Boolean(id)))
      .map((id) => rawModels.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is OfficialVideoModelCapability => Boolean(candidate));
    return [
      {
        ...model,
        label: family.label,
        aliases: unique(members.flatMap((member) => [member.id, ...(member.aliases || [])])),
        modes: unique(members.flatMap((member) => member.modes)) as OfficialVideoMode[],
        fields: unique(members.flatMap((member) => member.fields)) as OfficialVideoField[],
        aspectRatios: unique(members.flatMap((member) => member.aspectRatios)),
        resolutions: unique(members.flatMap((member) => member.resolutions)),
        durations: unique(members.flatMap((member) => member.durations)).sort((a, b) => a - b),
        notes: unique(members.flatMap((member) => member.notes || [])),
      },
    ];
  });
}
