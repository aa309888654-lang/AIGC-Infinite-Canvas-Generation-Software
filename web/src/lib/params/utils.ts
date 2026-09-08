import { ALL_PARAMS } from './registry';
import { ClipKind, ParamDef, ParamGroupId, ParamId, ParamValue } from './types';

// Map for O(1) lookups
const paramMap = new Map<ParamId, ParamDef>(
  ALL_PARAMS.map(p => [p.id, p])
);

/**
 * Get parameter definition by ID
 */
export function getParamDef(id: ParamId): ParamDef | undefined {
  return paramMap.get(id);
}

/**
 * Get all parameters applicable to a specific clip kind, grouped by their category.
 * Used to automatically generate the UI Accordion in the properties panel.
 */
export function getParamsForClip(kind: ClipKind): Record<ParamGroupId, ParamDef[]> {
  const result: Record<string, ParamDef[]> = {};
  
  ALL_PARAMS.forEach(param => {
    if (param.appliesTo.includes(kind)) {
      if (!result[param.group]) {
        result[param.group] = [];
      }
      result[param.group].push(param);
    }
  });
  
  return result;
}

/**
 * Generates the default parameters payload for a new clip
 */
export function getDefaultParamsForClip(kind: ClipKind): Record<ParamId, ParamValue> {
  const defaults: Record<ParamId, ParamValue> = {};
  
  ALL_PARAMS.forEach(param => {
    if (param.appliesTo.includes(kind)) {
      // For compound params, deep clone the default object to prevent reference sharing
      if (typeof param.defaultValue === 'object' && param.defaultValue !== null) {
        defaults[param.id] = JSON.parse(JSON.stringify(param.defaultValue));
      } else {
        defaults[param.id] = param.defaultValue;
      }
    }
  });
  
  return defaults;
}

/**
 * Clamp a number parameter to its defined min/max bounds.
 */
export function clampParamValue(id: ParamId, value: number): number {
  const def = getParamDef(id);
  if (!def || def.kind !== 'number') return value;
  
  if (value < def.min) return def.min;
  if (value > def.max) return def.max;
  return value;
}
