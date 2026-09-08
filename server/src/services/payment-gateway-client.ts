/**
 * 支付网关客户端
 *
 * 封装对自建支付网关的 API 调用（开源版默认未启用）。
 * 每个请求自动携带 HMAC-SHA256 签名，确保服务间通信安全。
 *
 * 安全机制：
 * 1. HMAC-SHA256 请求签名 - 防篡改、防伪造
 * 2. 时间戳窗口 (±5分钟) - 防延迟攻击
 * 3. Nonce 去重 - 防重放攻击
 * 4. 请求体 SHA-256 哈希 - 保证内容完整性
 *
 * 环境变量：
 *   PAYMENT_GATEWAY_URL  - 支付网关地址（如 https://pay.example.com）
 *   INTERNAL_API_KEY     - 内部 API 密钥 (两台服务器共用)
 */
import crypto from 'crypto';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ==================== 签名工具 ====================

const TIMESTAMP_TOLERANCE_SEC = 300; // 5 分钟容差
const NONCE_TTL_SEC = 600; // nonce 缓存 10 分钟
const MAX_NONCE_CACHE = 100000;

// nonce 缓存: Map<nonce, expireAt>
const nonceCache = new Map<string, number>();

/** 计算请求体的 SHA-256 哈希 */
function bodyHash(body: unknown): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body || {});
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** 构造签名字符串 */
function buildStringToSign(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodyHashHex: string,
): string {
  return [method.toUpperCase(), path, timestamp, nonce, bodyHashHex].join('\n');
}

/** 生成 HMAC-SHA256 签名 (Base64) */
function sign(stringToSign: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(stringToSign, 'utf8').digest('base64');
}

/** 生成随机 nonce */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** 生成完整签名头 (发送请求时调用) */
export function createSignatureHeaders(opts: {
  method: string;
  path: string;
  body: unknown;
  secret: string;
}): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();
  const hash = bodyHash(opts.body);

  const stringToSign = buildStringToSign(opts.method, opts.path, timestamp, nonce, hash);
  const signature = sign(stringToSign, opts.secret);

  return {
    'X-Api-Timestamp': timestamp,
    'X-Api-Nonce': nonce,
    'X-Api-Signature': signature,
    'X-Api-Body-Hash': hash,
    'X-Internal-API-Key': opts.secret,
  };
}

/** 验证签名 (接收支付网关转发的回调时使用) */
export function verifySignature(
  headers: Record<string, string>,
  method: string,
  path: string,
  body: unknown,
  secret: string,
): { valid: boolean; msg: string } {
  // HTTP headers 大小写不敏感，统一转小写查找
  const lowerHeaders: Record<string, string> = {};
  for (const key of Object.keys(headers || {})) {
    lowerHeaders[key.toLowerCase()] = headers[key];
  }

  const timestamp = lowerHeaders['x-api-timestamp'];
  const nonce = lowerHeaders['x-api-nonce'];
  const signature = lowerHeaders['x-api-signature'];
  const receivedBodyHash = lowerHeaders['x-api-body-hash'];
  const apiKey = lowerHeaders['x-internal-api-key'];

  // 1. 检查必要头是否齐全
  if (!timestamp || !nonce || !signature || !receivedBodyHash) {
    return { valid: false, msg: '缺少签名相关请求头' };
  }

  // 2. API Key 身份认证
  if (!apiKey || apiKey !== secret) {
    return { valid: false, msg: 'API Key 无效' };
  }

  // 3. 时间戳窗口校验 (防延迟攻击)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SEC) {
    return { valid: false, msg: `时间戳超出容差 (±${TIMESTAMP_TOLERANCE_SEC}s)` };
  }

  // 4. nonce 防重放
  cleanupNonceCache(now);
  if (nonceCache.has(nonce)) {
    return { valid: false, msg: '请求已过期或被重放' };
  }

  // 5. 请求体哈希校验 (防篡改)
  const computedBodyHash = bodyHash(body);
  if (computedBodyHash !== receivedBodyHash) {
    return { valid: false, msg: '请求体哈希不匹配' };
  }

  // 6. 签名校验
  const stringToSign = buildStringToSign(method, path, timestamp, nonce, receivedBodyHash);
  const expectedSignature = sign(stringToSign, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, msg: '签名验证失败' };
  }

  // 7. 标记 nonce 已使用
  nonceCache.set(nonce, now + NONCE_TTL_SEC);

  return { valid: true, msg: 'ok' };
}

/** 恒定时间字符串比较 (防时序攻击) */
function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** 清理过期的 nonce */
function cleanupNonceCache(now: number): void {
  if (nonceCache.size < MAX_NONCE_CACHE) return;
  for (const [key, expireAt] of nonceCache) {
    if (expireAt <= now) {
      nonceCache.delete(key);
    }
  }
}

// ==================== 支付网关客户端 ====================

/** 支付网关配置 */
function getGatewayConfig() {
  const url = process.env.PAYMENT_GATEWAY_URL || '';
  const apiKey = process.env.INTERNAL_API_KEY || '';
  if (!apiKey || !url) {
    throw new Error('[PaymentGateway] PAYMENT_GATEWAY_URL 或 INTERNAL_API_KEY 未配置，支付网关不可用');
  }
  return { url, apiKey };
}

/** 创建带签名拦截器的 axios 实例 */
function createHttpClient(): AxiosInstance {
  const { url, apiKey } = getGatewayConfig();
  const client = axios.create({
    baseURL: `${url}/api/payment`,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  // 请求拦截器 - 自动为每个请求添加 HMAC 签名
  client.interceptors.request.use((requestConfig: InternalAxiosRequestConfig) => {
    const method = (requestConfig.method || 'post').toUpperCase();
    const path = requestConfig.url || '/';

    // 序列化请求体
    const body = requestConfig.data || {};
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    // 生成签名头
    const signHeaders = createSignatureHeaders({
      method,
      path,
      body: bodyStr,
      secret: apiKey,
    });

    // 设置签名头 (使用 AxiosHeaders API 兼容新版 axios)
    for (const [key, value] of Object.entries(signHeaders)) {
      requestConfig.headers.set(key, value);
    }

    // 使用序列化后的字符串作为请求体，确保哈希一致
    requestConfig.data = bodyStr;

    return requestConfig;
  });

  return client;
}

// 懒加载 HTTP 客户端 (首次调用时创建)
let _httpClient: AxiosInstance | null = null;
function httpClient(): AxiosInstance {
  if (!_httpClient) {
    _httpClient = createHttpClient();
  }
  return _httpClient;
}

// ==================== 支付网关 API 接口 ====================

export interface NativePayParams {
  outTradeNo: string;
  totalFee: string;
  body: string;
  attach?: string;
  auto?: boolean;
  configNo?: string;
}

export interface PaymentGatewayResponse {
  code: number;
  msg: string;
  data?: any;
}

export const paymentGatewayClient = {
  /**
   * 创建 Native 扫码支付
   * 返回二维码 code_url，用于生成二维码图片
   */
  async nativePay(params: NativePayParams): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().post('/native', params);
    return data;
  },

  /**
   * 创建 JSAPI 支付 (微信公众号内)
   */
  async jsapiPay(params: any): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().post('/jsapi', params);
    return data;
  },

  /**
   * 创建 H5 支付
   */
  async wapPay(params: any): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().post('/wap', params);
    return data;
  },

  /**
   * 查询订单
   */
  async queryOrder(params: {
    outTradeNo?: string;
    transactionId?: string;
  }): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().post('/query', params);
    return data;
  },

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo: string): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().post('/close', { outTradeNo });
    return data;
  },

  /**
   * 申请退款
   */
  async refundOrder(params: any): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().post('/refund', params);
    return data;
  },

  /**
   * 查询退款结果
   */
  async getRefundResult(refundOutTradeNo: string): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().post('/refund/query', { refundOutTradeNo });
    return data;
  },

  /**
   * 健康检查 - 验证与支付网关的连接
   */
  async healthCheck(): Promise<PaymentGatewayResponse> {
    const { data } = await httpClient().get('/health');
    return data;
  },
};

export default paymentGatewayClient;
