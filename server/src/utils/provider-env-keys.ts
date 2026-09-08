/** 后端专用：从环境变量解析模型服务商密钥，前端不可见 */

export function pickFirstEnvValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

export function collectEnvValues(names: string[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

export function resolveSensenovaApiKey(): string {
  return pickFirstEnvValue('SENSENOVA_API_KEY', 'SENSENOVA_API_KEY_2');
}

export function resolveSensenovaBackupApiKey(currentKey: string): string {
  return collectEnvValues(['SENSENOVA_API_KEY_2', 'SENSENOVA_API_KEY']).find((key) => key !== currentKey) || '';
}

export function resolveStepfunApiKey(): string {
  return pickFirstEnvValue('STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3');
}

export function resolveStepfunBackupApiKeys(currentKey: string): string[] {
  return collectEnvValues(['STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3', 'STEPFUN_API_KEY']).filter((key) => key !== currentKey);
}

export function resolveAgnesApiKey(): string {
  return pickFirstEnvValue('AGNES_API_KEY', 'AGNES_API_KEY_2', 'AGNES_API_KEY_3');
}

export function resolveAgnesVideoApiKey(): string {
  return pickFirstEnvValue('AGNES_API_KEY');
}

export function resolveAgnesImageApiKey(): string {
  return pickFirstEnvValue('AGNES_API_KEY_2', 'AGNES_API_KEY_3');
}

export function resolveAgnesBackupApiKeys(currentKey: string): string[] {
  return collectEnvValues(['AGNES_API_KEY_2', 'AGNES_API_KEY_3', 'AGNES_API_KEY']).filter((key) => key !== currentKey);
}

export function resolveApipathsApiKey(): string {
  return pickFirstEnvValue('APIPATHS_API_KEY', 'APIPATHS_API_KEY_2', 'APIPATHS_API_KEY_3');
}

export function resolveApipathsBackupApiKeys(currentKey: string): string[] {
  return collectEnvValues(['APIPATHS_API_KEY_2', 'APIPATHS_API_KEY_3', 'APIPATHS_API_KEY']).filter((key) => key !== currentKey);
}

// 已废弃 (2026-07-18): NVIDIA NIM 文字通道已下线/无额度。
// 保留函数因为 ai-provider.ts 仍有引用，后续清理 ai-provider.ts 后可移除。
export function resolveNvidiaApiKey(): string {
  return pickFirstEnvValue('NVIDIA_NIM_API_KEY', 'NVIDIA_KIMI_API_KEY');
}

// 已废弃 (2026-07-18): 智谱 GLM 文字通道已下线/无额度。
// 保留函数因为 ai-provider.ts 仍有引用，后续清理 ai-provider.ts 后可移除。
export function resolveZhipuApiKey(): string {
  return pickFirstEnvValue('ZHIPU_API_KEY', 'GLM51_API_KEY', 'GLM4_PLUS_API_KEY');
}

// 已废弃 (2026-07-18): 讯飞星火文字通道 (spark-x2 / spark-x15) 已下线。
// 保留常量与函数因为 comic.ts 和 ai-proxy.ts 仍依赖讯飞 HTTP 兼容端点进行漫剧内容生成。
export const XUNFEI_SPARK_X2_BASE_URL = 'https://spark-api-open.xf-yun.com/x2';
export const XUNFEI_SPARK_X15_BASE_URL = 'https://spark-api-open.xf-yun.com/v2';
// Spark X HTTP endpoints currently accept the upstream model parameter "x1".
export const XUNFEI_SPARK_UPSTREAM_MODEL = 'x1';

export function isXunfeiSparkProvider(provider: string): boolean {
  return provider === 'xunfei' || provider === 'xunfei-x2' || provider === 'xunfei-x15';
}

export function resolveXunfeiSparkApiKey(): string {
  const apiKey = pickFirstEnvValue('XUNFEI_APIKEY', 'XUNFEI_API_KEY');
  const apiSecret = pickFirstEnvValue('XUNFEI_APISECRET', 'XUNFEI_API_SECRET');
  if (apiKey && apiSecret) return `${apiKey}:${apiSecret}`;

  // Keep APIPassword as a fallback for deployments that have a valid HTTP API password.
  return pickFirstEnvValue('XUNFEI_API_PASSWORD');
}

export function resolveXunfeiSparkBaseUrl(provider: string): string {
  return provider === 'xunfei-x2' ? XUNFEI_SPARK_X2_BASE_URL : XUNFEI_SPARK_X15_BASE_URL;
}
