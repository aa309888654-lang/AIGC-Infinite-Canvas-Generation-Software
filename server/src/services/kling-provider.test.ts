import { describe, expect, it, vi } from 'vitest';
import { KlingProvider } from './kling-provider';

const config = { apiKey: 'test-key', endpoint: 'https://api-beijing.klingai.com' } as any;

describe('KlingProvider', () => {
  it('maps Kling 3.0 Turbo image-to-video parameters', async () => {
    const provider = new KlingProvider();
    const post = vi.spyOn(provider as any, 'apiPost').mockResolvedValue({ code: 0, data: { id: 'turbo-task' } });

    const result = await provider.generateVideo({
      model: 'kling-3.0-turbo', prompt: 'track the path', imageUrl: 'https://example.com/start.jpg',
      resolution: '1080p', duration: 20,
    } as any, config);

    expect(result.status).toBe('pending');
    expect(post).toHaveBeenCalledWith(
      'https://api-beijing.klingai.com/image-to-video/kling-3.0-turbo',
      expect.objectContaining({
        contents: [{ type: 'prompt', text: 'track the path' }, { type: 'first_frame', url: 'https://example.com/start.jpg' }],
        settings: { resolution: '1080p', duration: 15 },
      }),
      { Authorization: 'Bearer test-key' },
    );
  });

  it('maps Kling 3.0 Omni flagship options', async () => {
    const provider = new KlingProvider();
    const post = vi.spyOn(provider as any, 'apiPost').mockResolvedValue({ code: 0, data: { id: 'omni-task' } });

    await provider.generateVideo({
      model: 'kling-3.0', prompt: 'continuous camera move', firstFrameUrl: 'https://example.com/a.jpg',
      lastFrameUrl: 'https://example.com/b.jpg', pixelResolution: '4K', duration: 3,
      generateAudio: true, multiShot: true,
    } as any, config);

    expect(post.mock.calls[0][1]).toEqual(expect.objectContaining({
      contents: [
        { type: 'prompt', text: 'continuous camera move' },
        { type: 'first_frame', url: 'https://example.com/a.jpg' },
        { type: 'last_frame', url: 'https://example.com/b.jpg' },
      ],
      settings: { resolution: '4k', duration: 3, audio: 'native', multi_shot: true },
    }));
  });

  it('rejects a last frame for Turbo', async () => {
    const provider = new KlingProvider();
    const result = await provider.generateVideo({
      model: 'kling-3.0-turbo', prompt: 'move', firstFrameUrl: 'a', lastFrameUrl: 'b',
    } as any, config);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('不支持尾帧');
  });

  it('extracts the completed video URL', async () => {
    const provider = new KlingProvider();
    vi.spyOn(provider as any, 'apiGetWithRetry').mockResolvedValue({
      code: 0,
      data: [{ id: 'task-1', status: 'succeeded', outputs: [{ type: 'video', url: 'https://example.com/out.mp4' }] }],
    });
    const result = await provider.getTaskStatus('task-1', config);
    expect(result.status).toBe('completed');
    expect(result.result?.videoUrl).toBe('https://example.com/out.mp4');
  });
});
