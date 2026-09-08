import type { StoryboardElement, StoryboardPlanV2, StoryboardShot } from './storyboard-plan-v2';

const SHOT_LABELS: Record<StoryboardShot['shotType'], string> = {
  extreme_wide: 'extreme wide shot',
  wide: 'wide shot',
  full: 'full body shot',
  medium: 'medium shot',
  medium_close: 'medium close shot',
  closeup: 'close-up',
  extreme_closeup: 'extreme close-up',
  insert: 'insert detail shot',
};

const ANGLE_LABELS: Record<StoryboardShot['cameraAngle'], string> = {
  eye_level: 'eye-level angle',
  low_angle: 'low angle',
  high_angle: 'high angle',
  top_down: 'top-down angle',
  dutch: 'Dutch angle',
  over_shoulder: 'over-the-shoulder angle',
  pov: 'point-of-view angle',
};

function compactList(values: Array<string | undefined>): string {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
}

function formatPositions(positions?: StoryboardShot['continuity']['characterPositions']): string {
  if (!positions) return 'not specified';
  const entries = Object.entries(positions);
  if (entries.length === 0) return 'not specified';
  return entries.map(([id, position]) => `${id}: ${position}`).join(', ');
}

function resolveElements(plan: StoryboardPlanV2, ids?: string[]): StoryboardElement[] {
  if (!ids?.length) return [];
  const byId = new Map(plan.elements.map((element) => [element.id, element]));
  return ids.map((id) => byId.get(id)).filter((item): item is StoryboardElement => Boolean(item));
}

function describeElements(elements: StoryboardElement[]): string {
  if (elements.length === 0) return 'none';
  return elements
    .map((element) => {
      const lock = element.locked ? 'locked' : 'planned';
      const anchors = element.visualAnchors.length > 0
        ? ` anchors: ${element.visualAnchors.join(', ')}`
        : '';
      return `${element.name} (${element.type}, ${lock}) - ${element.canonicalDescription}${anchors}`;
    })
    .join(' | ');
}

export function compileShotPromptForDoubaoSeedream(input: {
  plan: StoryboardPlanV2;
  shot: StoryboardShot;
  total?: number;
  basePrompt?: string;
  negativePrompt?: string;
}): string {
  const { plan, shot } = input;
  const total = input.total || plan.shots.length;
  const characterElements = resolveElements(plan, shot.references.characterIds);
  const outfitElements = resolveElements(plan, shot.references.outfitIds);
  const propElements = resolveElements(plan, shot.references.propIds);
  const locationElements = resolveElements(plan, shot.references.locationIds);
  const styleElements = resolveElements(plan, shot.references.styleIds);
  const preserve = compactList(shot.continuity.preserveFromPrevious || []);
  const requiredProps = compactList(shot.continuity.requiredProps || []);
  const cameraMove = shot.cameraMove || 'static';
  const negativePrompt = compactList([
    shot.negativePrompt,
    input.negativePrompt,
    'panel labels, watermarks, random logos, unreadable text, extra text unless explicitly required',
  ]);

  return [
    `Create storyboard frame ${shot.index + 1}/${total}.`,
    input.basePrompt ? `Story premise: ${input.basePrompt}.` : '',
    `Story beat: ${shot.beat}.`,
    `Emotional beat: ${shot.emotionalBeat}.`,
    `Shot language: ${SHOT_LABELS[shot.shotType]}, ${ANGLE_LABELS[shot.cameraAngle]}, ${cameraMove}.`,
    `Subject action: ${shot.subjectAction}.`,
    `Environment: ${shot.environment}.`,
    `Lighting: ${shot.lighting}.`,
    `Composition: ${shot.composition}.`,
    `Continuity: preserve ${preserve || 'identity and scene logic'}; screen direction ${shot.continuity.screenDirection || 'consistent'}; positions ${formatPositions(shot.continuity.characterPositions)}; required props ${requiredProps || 'none'}.`,
    `Element bible: characters ${describeElements(characterElements)}. Outfits ${describeElements(outfitElements)}. Props ${describeElements(propElements)}. Locations ${describeElements(locationElements)}. Style ${describeElements(styleElements)}.`,
    'Reference usage: use bound reference images as identity, outfit, prop, location, and style anchors. Do not redesign locked elements.',
    `Avoid: ${negativePrompt}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function compileStoryboardPlanPrompts(
  plan: StoryboardPlanV2,
  options?: { basePrompt?: string; negativePrompt?: string },
): Array<{ shot: StoryboardShot; prompt: string }> {
  return plan.shots.map((shot) => ({
    shot,
    prompt: compileShotPromptForDoubaoSeedream({
      plan,
      shot,
      total: plan.shots.length,
      basePrompt: options?.basePrompt,
      negativePrompt: options?.negativePrompt,
    }),
  }));
}
