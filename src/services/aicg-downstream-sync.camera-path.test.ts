import { buildDownstreamPatch } from './aicg-downstream-sync';

describe('camera path downstream sync', () => {
  it('forwards prompt, image and path data to an AI video node', () => {
    const cameraPath = {
      schemaVersion: 1,
      mode: 'strict',
      semantics: 'camera_translation',
      durationSec: 5,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.8 }],
      waypoints: [],
      promptMotionText: '严格复现镜头路径',
      updatedAt: '2026-07-19T00:00:00.000Z',
    };
    const patch = buildDownstreamPatch(
      'aiVideo',
      'input',
      'output',
      'cameraPath',
      {
        prompt: cameraPath.promptMotionText,
        imageUrl: 'https://example.com/frame.jpg',
        cameraPath,
        cameraPathJson: JSON.stringify(cameraPath),
      },
      { params: { resolution: '1080p' } },
      {} as any,
    );

    expect(patch).toEqual(expect.objectContaining({
      prompt: cameraPath.promptMotionText,
      startImage: 'https://example.com/frame.jpg',
      cameraPath,
      cameraPathJson: JSON.stringify(cameraPath),
    }));
    expect(patch.params).toEqual(expect.objectContaining({
      resolution: '1080p',
      generationMode: 'image_to_video',
      cameraPath,
      cameraPathMode: 'strict',
    }));
  });
});
