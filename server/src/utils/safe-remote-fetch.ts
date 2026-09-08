import axios, { AxiosResponse } from 'axios';
import { promises as dns } from 'dns';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { BlockList, isIP, LookupFunction } from 'net';
import { Readable } from 'stream';

const MAX_REDIRECTS = 3;
const blockedAddresses = new BlockList();
const blockedIpv4Subnets: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

for (const [network, prefix] of blockedIpv4Subnets) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
  // Block equivalent IPv4-mapped IPv6 spellings such as ::ffff:7f00:1.
  blockedAddresses.addSubnet(`::ffff:${network}`, 96 + prefix, 'ipv6');
}

blockedAddresses.addAddress('::', 'ipv6');
blockedAddresses.addAddress('::1', 'ipv6');
blockedAddresses.addSubnet('fc00::', 7, 'ipv6');
blockedAddresses.addSubnet('fe80::', 10, 'ipv6');
blockedAddresses.addSubnet('ff00::', 8, 'ipv6');

export interface SafeRemoteUrlPolicy {
  allowedHosts?: readonly string[];
}

interface ResolvedRemoteTarget {
  url: URL;
  addresses: Array<{ address: string; family: 4 | 6 }>;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, '');
}

export function isAllowedRemoteHostname(hostname: string, allowedHosts: readonly string[]): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return false;

  return allowedHosts.some((allowedHost) => {
    const normalizedAllowedHost = normalizeHostname(allowedHost);
    return Boolean(
      normalizedAllowedHost &&
      (normalizedHostname === normalizedAllowedHost || normalizedHostname.endsWith(`.${normalizedAllowedHost}`))
    );
  });
}

function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  const version = isIP(normalized);
  if (version === 4) return blockedAddresses.check(normalized, 'ipv4');
  if (version === 6) return blockedAddresses.check(normalized, 'ipv6');
  return true;
}

export function getRemoteImportAllowedHosts(
  rawAllowlist = process.env.REMOTE_IMPORT_ALLOWED_HOSTS || '',
): readonly string[] | undefined {
  const hosts = [...new Set(rawAllowlist
    .split(',')
    .map((host) => normalizeHostname(host))
    .filter(Boolean))];
  // An optional allowlist can narrow destinations without breaking the existing
  // public-URL import workflow when no list is configured.
  return hosts.length > 0 ? hosts : undefined;
}

async function resolveSafeRemoteHttpUrl(
  input: string,
  policy: SafeRemoteUrlPolicy = {},
): Promise<ResolvedRemoteTarget> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('远程文件 URL 格式无效');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('远程文件仅支持 http/https 协议');
  }
  if (parsed.username || parsed.password) {
    throw new Error('远程文件 URL 不允许包含认证信息');
  }
  const parsedHostname = parsed.hostname.toLowerCase();
  const hostname = parsedHostname.startsWith('[') && parsedHostname.endsWith(']')
    ? parsedHostname.slice(1, -1)
    : parsedHostname;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('不允许访问本机或内网地址');
  }
  if (policy.allowedHosts && !isAllowedRemoteHostname(hostname, policy.allowedHosts)) {
    throw new Error('远程文件域名不在白名单');
  }
  const resolved = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
    : await dns.lookup(hostname, { all: true, verbatim: true });
  const addresses = resolved.map(({ address, family }) => ({
    address,
    family: family as 4 | 6,
  }));
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error('不允许访问本机、内网或保留地址');
  }
  return { url: parsed, addresses };
}

function createPinnedLookup(addresses: ResolvedRemoteTarget['addresses']): LookupFunction {
  return (_hostname, options, callback) => {
    const requestedFamily = options?.family;
    const candidates = requestedFamily === 4 || requestedFamily === 6
      ? addresses.filter(({ family }) => family === requestedFamily)
      : addresses;
    if (candidates.length === 0) {
      const error = new Error('远程主机没有可用的已验证地址') as NodeJS.ErrnoException;
      error.code = 'ENOTFOUND';
      callback(error, '', 0);
      return;
    }
    if (options?.all) {
      callback(null, candidates);
      return;
    }
    callback(null, candidates[0].address, candidates[0].family);
  };
}

export async function assertSafeRemoteHttpUrl(
  input: string,
  policy: SafeRemoteUrlPolicy = {},
): Promise<URL> {
  return (await resolveSafeRemoteHttpUrl(input, policy)).url;
}

export async function fetchRemoteBuffer(
  input: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    allowedHosts?: readonly string[];
    headers?: Record<string, string>;
  } = {},
): Promise<AxiosResponse<ArrayBuffer>> {
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024;
  const timeout = options.timeoutMs ?? 30_000;
  const policy: SafeRemoteUrlPolicy = { allowedHosts: options.allowedHosts };
  let current = await resolveSafeRemoteHttpUrl(input, policy);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const lookup = createPinnedLookup(current.addresses);
    const httpAgent = new HttpAgent({ lookup });
    const httpsAgent = new HttpsAgent({ lookup });
    let response: AxiosResponse<ArrayBuffer>;
    try {
      response = await axios.get<ArrayBuffer>(current.url.toString(), {
        responseType: 'arraybuffer',
        timeout,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        maxRedirects: 0,
        proxy: false,
        httpAgent,
        httpsAgent,
        headers: options.headers,
        validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
      });
    } finally {
      httpAgent.destroy();
      httpsAgent.destroy();
    }
    if (response.status < 300) return response;

    const location = response.headers.location;
    if (!location || redirect === MAX_REDIRECTS) throw new Error('远程文件重定向次数过多');
    current = await resolveSafeRemoteHttpUrl(new URL(location, current.url).toString(), policy);
  }
  throw new Error('远程文件下载失败');
}

export interface SafeRemoteResponseOptions extends SafeRemoteUrlPolicy {
  headers?: Record<string, string>;
  maxBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SafeRemoteResponse {
  response: Response;
  finalUrl: URL;
  maxBytes: number;
  dispose: () => void;
}

export async function fetchSafeRemoteResponse(
  input: string,
  options: SafeRemoteResponseOptions = {},
): Promise<SafeRemoteResponse> {
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const dispose = () => {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  };

  try {
    let current = await resolveSafeRemoteHttpUrl(input, options);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const lookup = createPinnedLookup(current.addresses);
      const httpAgent = new HttpAgent({ lookup });
      const httpsAgent = new HttpsAgent({ lookup });
      let response: AxiosResponse<Readable>;
      try {
        response = await axios.get<Readable>(current.url.toString(), {
          responseType: 'stream',
          timeout: options.timeoutMs ?? 30_000,
          maxRedirects: 0,
          proxy: false,
          httpAgent,
          httpsAgent,
          headers: options.headers,
          signal: controller.signal,
          validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
        });
      } catch (error) {
        httpAgent.destroy();
        httpsAgent.destroy();
        throw error;
      }

      let agentsReleased = false;
      const releaseAgents = () => {
        if (agentsReleased) return;
        agentsReleased = true;
        httpAgent.destroy();
        httpsAgent.destroy();
      };
      response.data.once('end', releaseAgents);
      response.data.once('close', releaseAgents);
      response.data.once('error', releaseAgents);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        response.data.destroy();
        releaseAgents();
        if (!location || redirect === MAX_REDIRECTS) {
          throw new Error('远程文件重定向次数过多');
        }
        current = await resolveSafeRemoteHttpUrl(new URL(location, current.url).toString(), options);
        continue;
      }

      const declaredLength = Number(response.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        response.data.destroy();
        releaseAgents();
        throw new Error('远程文件超过大小限制');
      }

      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value === undefined || value === null) continue;
        responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value));
      }

      let receivedBytes = 0;
      const webBody = Readable.toWeb(response.data) as ReadableStream<Uint8Array>;
      const limitedBody = webBody.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, streamController) {
          receivedBytes += chunk.byteLength;
          if (receivedBytes > maxBytes) {
            const error = new Error('远程文件超过大小限制');
            streamController.error(error);
            controller.abort(error);
            response.data.destroy(error);
            releaseAgents();
            dispose();
            return;
          }
          streamController.enqueue(chunk);
        },
        flush() {
          dispose();
        },
      }));
      const limitedResponse = new Response(limitedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
      return { response: limitedResponse, finalUrl: current.url, maxBytes, dispose };
    }
    throw new Error('远程文件重定向次数过多');
  } catch (error) {
    dispose();
    throw error;
  }
}
