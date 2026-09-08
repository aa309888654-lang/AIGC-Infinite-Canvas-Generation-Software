import axios from 'axios';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as safeRemoteFetch from './safe-remote-fetch';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('safe remote host policy', () => {
  it('exports an exact hostname allowlist matcher', () => {
    expect(typeof (safeRemoteFetch as any).isAllowedRemoteHostname).toBe('function');
  });

  it('exports a redirect-safe streaming fetch helper', () => {
    expect(typeof (safeRemoteFetch as any).fetchSafeRemoteResponse).toBe('function');
  });

  it('allows exact hosts and their real subdomains', () => {
    const isAllowed = (safeRemoteFetch as any).isAllowedRemoteHostname;

    expect(isAllowed('aliyuncs.com', ['aliyuncs.com'])).toBe(true);
    expect(isAllowed('bucket.oss.aliyuncs.com', ['aliyuncs.com'])).toBe(true);
  });

  it('rejects substring and deceptive suffix matches', () => {
    const isAllowed = (safeRemoteFetch as any).isAllowedRemoteHostname;

    expect(isAllowed('aliyuncs.com.evil.example', ['aliyuncs.com'])).toBe(false);
    expect(isAllowed('notaliyuncs.com', ['aliyuncs.com'])).toBe(false);
    expect(isAllowed('evil-aliyuncs.com', ['aliyuncs.com'])).toBe(false);
  });

  it('rejects a disallowed hostname before DNS resolution', async () => {
    const assertSafe = safeRemoteFetch.assertSafeRemoteHttpUrl as any;

    await expect(
      assertSafe('https://aliyuncs.com.evil.invalid/file.png', { allowedHosts: ['aliyuncs.com'] }),
    ).rejects.toThrow('远程文件域名不在白名单');
  });

  it('keeps the allowlist optional so public remote imports remain compatible', () => {
    const getAllowlist = (safeRemoteFetch as any).getRemoteImportAllowedHosts;

    expect(getAllowlist('')).toBeUndefined();
    expect(getAllowlist('cdn.example.com, images.example.com')).toEqual([
      'cdn.example.com',
      'images.example.com',
    ]);
  });

  it('keeps public IPv4 imports available when no allowlist is configured', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: new ArrayBuffer(0),
    } as any);

    await expect(safeRemoteFetch.fetchRemoteBuffer('https://93.184.216.34/file')).resolves.toBeDefined();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each([
    'http://127.0.0.1/private',
    'http://10.0.0.1/private',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/private',
    'http://[::ffff:7f00:1]/private',
  ])('rejects local, private, metadata, and mapped addresses: %s', async (url) => {
    await expect(safeRemoteFetch.assertSafeRemoteHttpUrl(url)).rejects.toThrow(
      /不允许访问本机、内网或保留地址/,
    );
  });

  it('pins the outbound connection to the prevalidated address', async () => {
    let requestConfig: any;
    vi.spyOn(axios, 'get').mockImplementationOnce(async (_url, config) => {
      requestConfig = config;
      return {
        status: 200,
        headers: {},
        data: new ArrayBuffer(0),
      } as any;
    });

    await safeRemoteFetch.fetchRemoteBuffer('https://93.184.216.34/file');

    expect(requestConfig.httpsAgent).toBeDefined();
    expect(requestConfig.proxy).toBe(false);
    const lookup = requestConfig.httpsAgent.options.lookup;
    const resolved = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      lookup('93.184.216.34', {}, (error: Error | null, address: string, family: number) => {
        if (error) reject(error);
        else resolve({ address, family });
      });
    });
    expect(resolved).toEqual({ address: '93.184.216.34', family: 4 });
  });

  it('revalidates the hostname on every redirect', async () => {
    const get = vi.spyOn(axios, 'get')
      .mockResolvedValueOnce({
        status: 302,
        headers: { location: 'https://1.1.1.1/private' },
      } as any)
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: new ArrayBuffer(0),
      } as any);

    await expect(
      (safeRemoteFetch.fetchRemoteBuffer as any)('https://93.184.216.34/file', {
        allowedHosts: ['93.184.216.34'],
      }),
    ).rejects.toThrow('远程文件域名不在白名单');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('revalidates streaming redirects and stops before fetching a disallowed target', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 302,
      headers: { location: 'https://1.1.1.1/private' },
      data: Readable.from([]),
    } as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('legacy fetch must not be used')));

    await expect((safeRemoteFetch.fetchSafeRemoteResponse as any)('https://93.184.216.34/file', {
      allowedHosts: ['93.184.216.34'],
    })).rejects.toThrow('远程文件域名不在白名单');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized streaming responses from Content-Length', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      headers: { 'content-length': '1024' },
      data: Readable.from([Buffer.from('large')]),
    } as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('legacy fetch must not be used')));

    await expect((safeRemoteFetch.fetchSafeRemoteResponse as any)('https://93.184.216.34/file', {
      allowedHosts: ['93.184.216.34'],
      maxBytes: 100,
    })).rejects.toThrow('远程文件超过大小限制');
  });

  it('aborts a chunked response when its actual body exceeds the limit', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: Readable.from([Buffer.alloc(60), Buffer.alloc(60)]),
    } as any);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('legacy fetch must not be used')));

    const safeResponse = await safeRemoteFetch.fetchSafeRemoteResponse('https://93.184.216.34/file', {
      allowedHosts: ['93.184.216.34'],
      maxBytes: 100,
    });

    await expect(safeResponse.response.arrayBuffer()).rejects.toThrow('远程文件超过大小限制');
    safeResponse.dispose();
  });

  it('pins streaming connections and bypasses environment proxies', async () => {
    let requestConfig: any;
    vi.spyOn(axios, 'get').mockImplementationOnce(async (_url, config) => {
      requestConfig = config;
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'image/png' },
        data: Readable.from([Buffer.from('ok')]),
      } as any;
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('legacy fetch must not be used')));

    const safeResponse = await safeRemoteFetch.fetchSafeRemoteResponse('https://93.184.216.34/file');

    expect(requestConfig.httpsAgent).toBeDefined();
    expect(requestConfig.proxy).toBe(false);
    expect(await safeResponse.response.text()).toBe('ok');
  });
});
