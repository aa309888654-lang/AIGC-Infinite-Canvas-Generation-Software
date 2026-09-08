import { describe, expect, it, vi } from 'vitest';
import { DoubaoProvider } from './doubao-provider';

const config = {
  apiKey: 'ark-test-key',
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
} as any;

describe('DoubaoProvider Seedance 2.0', () => {
  it('submits the camera-path prompt and first frame using the Ark contents API', async () => {
    const provider = new DoubaoProvider();
    const post = vi.spyOn(provider as any, 'apiPost').mockResolvedValue({ id: 'seedance-task' });
    const pathPrompt = [
      '严格复现所给镜头路径、关键点顺序与时间节奏。',
      '0.0s-1.3s：相机平滑移动向右，从镜头起点到达镜头1',
      '保持单一连续镜头；不得反向运动、跳过镜头点或增加切镜。',
    ].join('\n');

    const result = await provider.generateVideo({
      model: 'doubao-seedance-2-0',
      mode: 'image_to_video',
      prompt: pathPrompt,
      firstFrameUrl: 'https://example.com/frame.jpg',
      resolution: '1080p',
      aspectRatio: '16:9',
      duration: 5,
      generateAudio: false,
      enableDraft: false,
    } as any, config);

    expect(result.status).toBe('pending');
    expect(result.model).toBe('doubao-seedance-2-0-260128');
    expect(post).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      expect.objectContaining({
        model: 'doubao-seedance-2-0-260128',
        content: [
          { type: 'text', text: pathPrompt },
          { type: 'image_url', image_url: { url: 'https://example.com/frame.jpg' }, role: 'first_frame' },
        ],
        resolution: '1080p',
        ratio: '16:9',
        duration: 5,
        generate_audio: false,
      }),
      { Authorization: 'Bearer ark-test-key' },
    );
  });

  it('queries an Ark task and extracts the generated video URL', async () => {
    const provider = new DoubaoProvider();
    const get = vi.spyOn(provider as any, 'apiGetWithRetry').mockResolvedValue({
      id: 'seedance-task',
      status: 'succeeded',
      content: { video_url: 'https://example.com/seedance.mp4' },
    });

    const result = await provider.getTaskStatus('seedance-task', config);

    expect(get).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/seedance-task',
      { Authorization: 'Bearer ark-test-key' },
      30000,
      2,
      1000,
    );
    expect(result.status).toBe('completed');
    expect(result.result?.videoUrl).toBe('https://example.com/seedance.mp4');
  });
});
