export const STORYBOARD_NAVIGATE_REQUEST_EVENT = 'storyboard:navigate-to-shot';
export const STORYBOARD_FOCUS_SHOT_EVENT = 'storyboard:focus-shot';

export interface StoryboardNavigateDetail {
  shotId: string;
  source?: 'clip' | 'marker' | string;
  focusNodes?: boolean;
  ts: number;
}

let pendingNavigation: StoryboardNavigateDetail | null = null;

export function setPendingStoryboardNavigation(detail: StoryboardNavigateDetail | null) {
  pendingNavigation = detail;
}

export function consumePendingStoryboardNavigation() {
  const detail = pendingNavigation;
  pendingNavigation = null;
  return detail;
}

export function dispatchStoryboardShotFocus(detail: StoryboardNavigateDetail) {
  window.dispatchEvent(new CustomEvent<StoryboardNavigateDetail>(STORYBOARD_FOCUS_SHOT_EVENT, { detail }));
}

export function navigateToStoryboardShot(
  shotId: string,
  options: { source?: StoryboardNavigateDetail['source']; focusNodes?: boolean } = {}
) {
  if (!shotId) return;
  const detail: StoryboardNavigateDetail = {
    shotId,
    source: options.source,
    focusNodes: options.focusNodes ?? true,
    ts: Date.now(),
  };
  setPendingStoryboardNavigation(detail);
  window.dispatchEvent(new CustomEvent<StoryboardNavigateDetail>(STORYBOARD_NAVIGATE_REQUEST_EVENT, { detail }));
}
