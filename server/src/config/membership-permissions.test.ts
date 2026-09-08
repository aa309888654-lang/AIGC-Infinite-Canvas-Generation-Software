import { describe, expect, it } from 'vitest';
import { calculateVideoPoints } from './membership-permissions';

describe('video pricing integration', () => {
  it('uses the conditional table before legacy fallback rules', () => {
    expect(calculateVideoPoints('doubao-seedance-2', '480p', 5)).toBe(414);
    expect(calculateVideoPoints('doubao-happyhorse-video-edit', '1080p', 4)).toBe(504);
  });
});