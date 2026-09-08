import { describe, expect, it, vi } from 'vitest';
import { DoubaoProvider } from './doubao-provider';

const config = {
  apiKey: 'ark-test-key',
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
} as any;

describe('DoubaoProvider Seedream 5.0', () => {
  it('uses the official Pro model and omits Lite-only or unsupported controls', async () => {
    const provider = new DoubaoProvider();
    const post = vi.spyOn(provider as any, 'apiPost').mockResolvedValue({
      data: [{ url: 'https://example.com/pro.png' }],
    });
    const references = Array.from(
      { length: 11 },
      (_, index) => `https://example.com/reference-${index + 1}.png`
    );

    const result = await provider.generateImage(
      {
        model: 'doubao-seedream-5-0-pro',
        prompt: '把指定位置的杯子换成花瓶',
        negativePrompt: 'legacy negative prompt',
        resolution: '16:9',
        imageSize: '2K',
        referenceImages: references,
        promptEnhancer: true,
        seedreamOptimizeMode: 'fast',
        sequentialImageGeneration: 'auto',
        sequentialMaxImages: 8,
        webSearch: true,
        outputFormat: 'png',
        seed: 123,
        cfgStrength: 7.5,
      } as any,
      config
    );

    expect(result.status).toBe('completed');
    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'doubao-seedream-5-0-pro-260628',
      size: '2K',
      response_format: 'url',
      output_format: 'png',
      watermark: false,
      optimize_prompt_options: { mode: 'fast' },
    });
    expect(String(body.prompt)).toContain('输出画面宽高比为 16:9');
    expect(body.image as unknown[]).toHaveLength(10);
    expect(body).not.toHaveProperty('negative_prompt');
    expect(body).not.toHaveProperty('sequential_image_generation');
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('stream');
    expect(body).not.toHaveProperty('seed');
    expect(body).not.toHaveProperty('guidance_scale');
  });

  it('enables Lite group output and web search within the 15-image budget', async () => {
    const provider = new DoubaoProvider();
    const post = vi.spyOn(provider as any, 'apiPost').mockResolvedValue({
      data: [{ url: 'https://example.com/lite-1.jpg' }, { url: 'https://example.com/lite-2.jpg' }],
    });

    const result = await provider.generateImage(
      {
        model: 'doubao-seedream-5-0-lite',
        prompt: '生成一组统一品牌视觉',
        resolution: '4:5',
        imageSize: '4K',
        referenceImages: [
          'https://example.com/reference-a.png',
          'https://example.com/reference-b.png',
        ],
        promptEnhancer: true,
        seedreamOptimizeMode: 'fast',
        sequentialImageGeneration: 'auto',
        sequentialMaxImages: 15,
        webSearch: true,
        outputFormat: 'jpeg',
      } as any,
      config
    );

    expect(result.result?.urls).toHaveLength(2);
    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'doubao-seedream-5-0-260128',
      size: '4K',
      optimize_prompt_options: { mode: 'standard' },
      sequential_image_generation: 'auto',
      sequential_image_generation_options: { max_images: 13 },
      stream: false,
      tools: [{ type: 'web_search' }],
      output_format: 'jpeg',
      watermark: false,
    });
    expect(String(body.prompt)).toContain('输出画面宽高比为 4:5');
  });
});
