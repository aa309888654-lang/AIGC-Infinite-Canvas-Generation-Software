import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { lookup as dnsLookup } from 'dns';

/**
 * 官网赞助支付网关客户端（YunGouOS，与 https://aicgxt.cn/sponsor 同一套）。
 *
 * SSRF 防护：
 * 1. 目标 URL 为字面量固定官网地址，调用方不可注入；
 * 2. 每次发起请求前先经白名单校验（仅 https + aicgxt.cn 域名）；
 * 3. maxRedirects: 0 —— 不跟随重定向，避免被 302 引导至内网；
 * 4. 连接时自定义 DNS lookup 校验解析结果 IP，阻断环回/私网/保留地址，防 DNS rebinding。
 */

const SPONSOR_UPSTREAM_ALLOW_PROTOCOLS = ['https:'] as const;
const SPONSOR_UPSTREAM_ALLOW_HOSTS = ['aicgxt.cn', 'www.aicgxt.cn'] as const;

const assertAllowedSponsorUrl = (rawUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('赞助上游地址不是合法 URL');
  }
  if (!SPONSOR_UPSTREAM_ALLOW_PROTOCOLS.includes(parsed.protocol as any)) {
    throw new Error('赞助上游地址协议不在白名单');
  }
  if (!SPONSOR_UPSTREAM_ALLOW_HOSTS.includes(parsed.hostname.toLowerCase() as any)) {
    throw new Error('赞助上游地址主机不在白名单');
  }
  return parsed.toString();
};

const isBlockedIpv4 = (parts: number[]): boolean => {
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const parseIpv4 = (value: string): number[] | null => {
  const parts = value.split('.').map((part) => Number(part));
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
};

// 环回/私网/链路本地/保留/组播（含 IPv4-mapped IPv6）一律拒绝
const isBlockedAddress = (address: string): boolean => {
  const normalized = address.trim().toLowerCase();
  const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) {
    const ipv4 = parseIpv4(mapped[1]);
    return ipv4 !== null && isBlockedIpv4(ipv4);
  }
  const ipv4 = parseIpv4(normalized);
  if (ipv4) return isBlockedIpv4(ipv4);
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb'))
    return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('ff')) return true;
  return false;
};

// 连接时 DNS 校验：解析落到内网/环回即拒绝连接
const safeLookup: typeof dnsLookup = ((hostname: string, options: any, callback: any) => {
  const cb = typeof options === 'function' ? options : callback;
  dnsLookup(hostname, { ...(typeof options === 'object' ? options : {}), all: true } as any, (err, addresses: any) => {
    if (err) {
      cb(err);
      return;
    }
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: 4 }];
    for (const entry of list) {
      const ip = typeof entry === 'string' ? entry : entry.address;
      if (isBlockedAddress(ip)) {
        cb(new Error(`目标主机解析到被阻断的地址: ${ip}`));
        return;
      }
    }
    if (typeof options === 'object' && options?.all) {
      cb(null, list);
    } else {
      cb(null, list[0].address, list[0].family);
    }
  });
}) as any;

const httpAgent = new HttpAgent({ lookup: safeLookup } as any);
const httpsAgent = new HttpsAgent({ lookup: safeLookup } as any);

const UPSTREAM_ORDERS_URL = 'https://aicgxt.cn/api/v1/sponsor-orders';
const UPSTREAM_REQUEST_CONFIG = {
  httpAgent,
  httpsAgent,
  maxRedirects: 0,
} as const;

const MAX_SPONSOR_AMOUNT = 500;
const ORDER_NO_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export interface SponsorUpstreamError extends Error {
  upstreamStatus?: number;
  upstreamBody?: unknown;
}

const toUpstreamError = (error: any): SponsorUpstreamError => {
  const wrapped: SponsorUpstreamError = new Error(error?.message || 'upstream request failed');
  if (error?.response) {
    wrapped.upstreamStatus = error.response.status;
    wrapped.upstreamBody = error.response.data;
  }
  return wrapped;
};

export const createSponsorOrder = async (amount: number): Promise<{ status: number; body: unknown }> => {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SPONSOR_AMOUNT) {
    throw new Error('赞助金额不合法');
  }
  const url = assertAllowedSponsorUrl(UPSTREAM_ORDERS_URL);
  try {
    const upstream = await axios.post(
      url,
      { amount },
      { timeout: 15000, ...UPSTREAM_REQUEST_CONFIG },
    );
    return { status: upstream.status, body: upstream.data };
  } catch (error: any) {
    throw toUpstreamError(error);
  }
};

export const querySponsorOrder = async (orderNo: string): Promise<{ status: number; body: unknown }> => {
  if (!ORDER_NO_PATTERN.test(orderNo)) {
    throw new Error('订单号不合法');
  }
  const url = assertAllowedSponsorUrl(`${UPSTREAM_ORDERS_URL}/${encodeURIComponent(orderNo)}`);
  try {
    const upstream = await axios.get(url, { timeout: 10000, ...UPSTREAM_REQUEST_CONFIG });
    return { status: upstream.status, body: upstream.data };
  } catch (error: any) {
    throw toUpstreamError(error);
  }
};
