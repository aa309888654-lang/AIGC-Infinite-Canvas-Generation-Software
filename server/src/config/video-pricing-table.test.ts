import { describe, expect, it } from 'vitest';
import { calculateConfiguredVideoPoints, getConfiguredVideoRate } from './video-pricing-table';

describe('video pricing table', () => {
  const cases: Array<[string, string, Record<string, unknown>, number]> = [
    ['doubao-seedance-2-mini', '720p', {}, 88.8],
    ['doubao-seedance-2-mini', '720p', { hasVideoInput: true }, 54],
    ['doubao-seedance-2-fast', '480p', { hasVideoInput: true }, 39.6],
    ['doubao-seedance-2', '480p', {}, 82.8],
    ['doubao-seedance-1-5-pro', '1080p', { generateAudio: true }, 64.8],
    ['doubao-seedance-1-5-pro', '720p', {}, 15.6],
    ['doubao-happyhorse-ref2v', '1080p', {}, 126],
    ['doubao-kling-v3-turbo-i2v', '720p', {}, 78],
    ['doubao-kling-3-0', '720p', {}, 61.2],
    ['doubao-kling-3-0', '720p', { generateAudio: true }, 87.6],
    ['Sora2', '720p', {}, 12],
    ['Wan2.7', '720p', {}, 36],
    ['Package_1.0', '720p', {}, 2.4],
    ['Digital_Humans', '720p', {}, 2.4],
    ['video_omni', '720p', {}, 120],
    ['video_vidu', '720p', {}, 120],
    ['google_omni', '720p', {}, 12],
    ['Video_Upscaling', '1080p', {}, 12],
  ];
  it.each(cases)('%s %s', (model, resolution, context, expected) => {
    expect(getConfiguredVideoRate(model, resolution, context)).toBe(expected);
    expect(calculateConfiguredVideoPoints(model, resolution, 2, context)).toBe(Math.ceil(expected * 2));
  });
});