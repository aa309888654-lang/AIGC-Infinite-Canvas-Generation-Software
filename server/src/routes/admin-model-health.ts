import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import prisma from '../lib/prisma';
import axios from 'axios';
// 已废弃 (2026-07-18): xunfei 相关 imports 已移除（PROVIDER_ENDPOINTS 和 TEXT_MODELS 中的讯飞条目已清理）

export const adminModelHealthRouter = Router();

adminModelHealthRouter.use(authenticate, requireAdmin);

// ==================== Provider 连通性检测端点配置 ====================
interface ProviderEndpointConfig {
  url: string;
  method: 'GET' | 'POST';
  body?: any;
  timeout: number;
  apiKeyEnv?: string[];
  apiKeyResolver?: () => string;
  authMode?: 'bearer' | 'query' | 'raw'; // bearer=默认, query=URL参数, raw=裸Authorization
  keyParam?: string; // query模式下的参数名，默认 'key'
  extraParams?: Record<string, string>; // 额外URL参数
  successBodyCodes?: number[]; // 响应体中code字段表示成功的值
  supportedModels?: ProviderSupportedModel[];
}

type ProviderSupportedModel = { id: string; name: string; type: 'image' | 'video' | 'audio' | 'text' };

function getDisplayEndpoint(provider: string, endpoint?: string | null): string {
  if (provider === 'aisz' || endpoint?.includes('api.aisz.mom')) {
    return '兼容备用通道';
  }
  return endpoint || '';
}

function sanitizeProviderMessage(message: string): string {
  return message.replace(/https?:\/\/api\.aisz\.mom\/?(?:v1)?/gi, '兼容备用通道');
}

const PROVIDER_ENDPOINTS: Record<string, ProviderEndpointConfig> = {
  sensenova: {
    // SenseNova U1 图片与文本通道共用 token.sensenova.cn 鉴权。
    // /models 在当前域名会返回 404，使用最小 chat completion 探测 KEY 连通性。
    url: `${process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1'}/chat/completions`,
    method: 'POST',
    body: { model: 'sensenova-6.7-flash-lite', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
    timeout: 15000,
    apiKeyEnv: ['SENSENOVA_API_KEY', 'SENSENOVA_API_KEY_2'],
  },
  stepfun: {
    // StepFun 接入地址 https://api.stepfun.com/step_plan/v1（官方文档确认）
    // 不提供 /models 列表端点，改用 chat completion 探测
    url: 'https://api.stepfun.com/step_plan/v1/chat/completions',
    method: 'POST',
    body: { model: 'step-3.5-flash', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
    timeout: 15000,
    apiKeyEnv: ['STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3'],
    supportedModels: [
      { id: 'step-3.7-flash', name: 'Step 3.7 Flash (推理+多模态)', type: 'text' },
      { id: 'step-3.5-flash', name: 'Step 3.5 Flash (推理)', type: 'text' },
      { id: 'step-3.5-flash-2603', name: 'Step 3.5 Flash 2603 (版本)', type: 'text' },
      { id: 'step-router-v1', name: 'Step Router V1 (智能路由)', type: 'text' },
      { id: 'stepaudio-2.5-chat', name: 'StepAudio 2.5 Chat (语音对话)', type: 'audio' },
      { id: 'stepaudio-2.5-asr', name: 'StepAudio 2.5 ASR (语音识别)', type: 'audio' },
      { id: 'stepaudio-2.5-realtime', name: 'StepAudio 2.5 Realtime (实时语音)', type: 'audio' },
      { id: 'step-1o-audio', name: 'Step-1o Audio', type: 'audio' },
      { id: 'step-tts-mini', name: 'Step TTS Mini', type: 'audio' },
    ],
  },
  minimax: {
    // MiniMax 不提供 /v1/models 列表端点，改用 chat completion 探测
    // 域名与 .env 中 MINIMAX_BASE_URL 保持一致
    url: 'https://api.minimaxi.com/v1/text/chatcompletion_v2',
    method: 'POST',
    body: { model: 'MiniMax-M3', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
    timeout: 15000,
    apiKeyEnv: ['MINIMAX_API_KEY'],
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/models',
    method: 'GET', timeout: 8000,
    apiKeyEnv: ['DEEPSEEK_API_KEY'],
  },
  doubao: {
    // 火山引擎 ARK /api/v3/models 列表端点（已验证可用，返回 doubao-seedream/seedance 等模型）
    url: 'https://ark.cn-beijing.volces.com/api/v3/models',
    method: 'GET', timeout: 10000,
    apiKeyEnv: ['DOUBAO_API_KEY', 'DOUBAO_SEED_API_KEY', 'DOUBAO_IMAGE_KEY', 'DOUBAO_VIDEO_KEY', 'ARK_API_KEY'],
  },
  seedream: {
    // Seedream (豆包图片) 使用火山引擎 ARK，与 doubao 共用密钥
    url: 'https://ark.cn-beijing.volces.com/api/v3/models',
    method: 'GET', timeout: 10000,
    apiKeyEnv: ['DOUBAO_SEED_API_KEY', 'DOUBAO_IMAGE_KEY', 'ARK_API_KEY', 'DOUBAO_API_KEY'],
    supportedModels: [
      { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0 (文生图)', type: 'image' },
      { id: 'doubao-seedream-4-0-t2i', name: 'Seedream 4.0 (文生图)', type: 'image' },
      { id: 'doubao-seededit-3-0-i2i', name: 'Seededit 3.0 (图片编辑)', type: 'image' },
    ],
  },
  jimeng: {
    // 即梦 (Jimeng) 使用火山引擎 ARK，与 doubao 共用密钥
    url: 'https://ark.cn-beijing.volces.com/api/v3/models',
    method: 'GET', timeout: 10000,
    apiKeyEnv: ['DOUBAO_IMAGE_KEY', 'DOUBAO_SEED_API_KEY', 'ARK_API_KEY', 'DOUBAO_API_KEY'],
    supportedModels: [
      { id: 'jimeng-2.1-t2i', name: '即梦 2.1 (文生图)', type: 'image' },
      { id: 'jimeng-2.6-t2i', name: '即梦 2.6 (文生图)', type: 'image' },
      { id: 'jimeng-2.6-i2i', name: '即梦 2.6 (图片编辑)', type: 'image' },
    ],
  },
  volcano: {
    // 火山引擎 Volcano (Ark Code) coding 端点
    url: 'https://ark.cn-beijing.volces.com/api/coding/v3/models',
    method: 'GET', timeout: 10000,
    apiKeyEnv: ['VOLCANO_API_KEY', 'ARK_API_KEY'],
  },
  wuyinkeji: {
    url: 'https://api.wuyinkeji.com/api/async/detail',
    method: 'GET', timeout: 8000,
    apiKeyEnv: ['WUYIN_API_KEY'],
    authMode: 'query',
    keyParam: 'key',
    extraParams: { id: 'health_check_probe' },
    successBodyCodes: [200, 400], // 200=成功, 400=参数错误(密钥有效，只是任务ID不存在)
    supportedModels: [
      { id: 'Wan2.7_image', name: 'Wan2.7 (图片)', type: 'image' },
      { id: 'Wan2.6', name: 'Wan2.6 (图片)', type: 'image' },
      { id: 'Wan2.7', name: 'Wan2.7', type: 'video' },
      { id: 'video_seedance', name: 'Seedance 2.0', type: 'video' },
      { id: 'video_vidu', name: 'Vidu Q3', type: 'video' },
      { id: 'video_omni', name: '可灵 Omni', type: 'video' },
    ],
  },
  vidu: {
    // Vidu 无 /v1/models 端点，改用 /ent/v2/text2video 探测（POST 创建任务，401=密钥有效但参数错，200=密钥有效）
    url: 'https://api.vidu.com/ent/v2/text2video',
    method: 'POST',
    body: { model: 'viduq1-v1.5', prompt: 'health_check_probe' },
    timeout: 10000,
    apiKeyEnv: ['VIDU_API_KEY'],
    successBodyCodes: [200, 400, 401], // 200=成功, 400=参数错误(密钥有效), 401=密钥有效但格式要求
  },
  // 已废弃 (2026-07-18): nvidia provider - NIM API 已下线/无额度
  // 已废弃 (2026-07-18): zhipu provider - 智谱 GLM 已下线/无额度
  // 已废弃 (2026-07-18): xunfei provider - 讯飞星火文字通道已下线（comic.ts 仍保留讯飞 API 调用）
  // 已删除 (2026-07-20): 国外模型 aisz 通道已下线
  kling: {
    url: 'https://api.klingai.com/v1/models',
    method: 'GET', timeout: 8000,
    apiKeyEnv: ['KLING_API_KEY'],
  },
};

// ==================== 文本/对话模型注册表（小天通道模型） ====================
interface TextModelConfig {
  model: string;
  displayName: string;
  category: 'gpt' | 'deepseek' | 'glm' | 'minimax' | 'step' | 'volcano' | 'xunfei' | 'other';
  provider: string;
  baseUrl: string;
  apiKeyEnv: string[];
  apiKeyEnvLabel: string;
  apiKeyResolver?: () => string;
  // 检测模式：openai=POST /chat/completions + Bearer 认证（默认）
  //          anthropic=POST /v1/messages + x-api-key 认证
  authMode?: 'openai' | 'anthropic';
  // 探测请求实际使用的 model 参数（覆盖 model 字段，用于 model 名与上游参数不一致的场景，如讯飞 Spark X2/X1.5 统一用 x1）
  probeModel?: string;
}

const TEXT_MODELS: TextModelConfig[] = [
  // === DeepSeek 系列 ===
  { model: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', category: 'deepseek', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: ['DEEPSEEK_API_KEY'], apiKeyEnvLabel: 'DEEPSEEK_API_KEY' },
  // 注: SenseNova 文字/对话模型探测需使用 token.sensenova.cn 端点 (compatible-mode 端点对 chat/completions 返回 403)
  { model: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash (SenseNova)', category: 'deepseek', provider: 'sensenova', baseUrl: 'https://token.sensenova.cn/v1', apiKeyEnv: ['SENSENOVA_API_KEY', 'SENSENOVA_API_KEY_2', 'SENSENOVA_API_KEY_3'], apiKeyEnvLabel: 'SENSENOVA_API_KEY' },

  // === SenseNova 文本模型 ===
  { model: 'sensenova-6.7-flash-lite', displayName: 'SenseNova 6.7 Flash Lite', category: 'deepseek', provider: 'sensenova', baseUrl: 'https://token.sensenova.cn/v1', apiKeyEnv: ['SENSENOVA_API_KEY', 'SENSENOVA_API_KEY_2', 'SENSENOVA_API_KEY_3'], apiKeyEnvLabel: 'SENSENOVA_API_KEY' },

  // === GLM 系列 ===
  // 已废弃 (2026-07-18): glm-4-plus / glm-5.1 - 智谱 GLM 文字通道已下线/无额度

  // === MiniMax 文本模型 ===
  // 注: 探测使用 api.minimaxi.com (api.minimaxi.chat 返回 "invalid api key")
  { model: 'MiniMax-M3', displayName: 'MiniMax M3', category: 'minimax', provider: 'minimax', baseUrl: 'https://api.minimaxi.com/v1', apiKeyEnv: ['MINIMAX_API_KEY'], apiKeyEnvLabel: 'MINIMAX_API_KEY' },

  // === StepFun 文本/语音模型 ===
  { model: 'step-3.7-flash', displayName: 'Step 3.7 Flash (推理+多模态)', category: 'step', provider: 'stepfun', baseUrl: 'https://api.stepfun.com/step_plan/v1', apiKeyEnv: ['STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3'], apiKeyEnvLabel: 'STEPFUN_API_KEY' },
  { model: 'step-3.5-flash', displayName: 'Step 3.5 Flash (推理)', category: 'step', provider: 'stepfun', baseUrl: 'https://api.stepfun.com/step_plan/v1', apiKeyEnv: ['STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3'], apiKeyEnvLabel: 'STEPFUN_API_KEY' },
  { model: 'step-router-v1', displayName: 'Step Router V1 (智能路由)', category: 'step', provider: 'stepfun', baseUrl: 'https://api.stepfun.com/step_plan/v1', apiKeyEnv: ['STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3'], apiKeyEnvLabel: 'STEPFUN_API_KEY' },
  { model: 'stepaudio-2.5-chat', displayName: 'StepAudio 2.5 Chat (语音对话)', category: 'step', provider: 'stepfun', baseUrl: 'https://api.stepfun.com/step_plan/v1', apiKeyEnv: ['STEPFUN_API_KEY', 'STEPFUN_API_KEY_2', 'STEPFUN_API_KEY_3'], apiKeyEnvLabel: 'STEPFUN_API_KEY' },
    // StepFun TTS 使用 /v1/audio/speech 端点, ASR 使用 /v1/audio/asr/sse 端点
  // step-tts-mini 和 step-1o-audio 使用专用音频端点, 非Chat Completion API, 不在此检测

  // === Volcano (火山引擎) ===
  { model: 'ark-code-latest', displayName: 'Ark Code (火山)', category: 'volcano', provider: 'volcano', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', apiKeyEnv: ['VOLCANO_API_KEY'], apiKeyEnvLabel: 'VOLCANO_API_KEY' },

  // 已废弃 (2026-07-18): deepseek-v4-pro-nim (NVIDIA NIM) - 已下线/无额度
  // 已废弃 (2026-07-18): spark-x2 / spark-x15 (讯飞星火) - 文字通道已下线
];

// ==================== 工具函数 ====================
function resolveApiKey(apiKeyEnvs: string[]): string | null {
  for (const env of apiKeyEnvs) {
    const val = process.env[env];
    if (val && val.length > 5) return val;
  }
  return null;
}

function getEnvKeysWithStatus(apiKeyEnvs: string[]): Array<{ env: string; configured: boolean; preview: string }> {
  return apiKeyEnvs.map(env => {
    const val = process.env[env];
    return {
      env,
      configured: !!(val && val.length > 5),
      preview: val ? `${val.slice(0, 6)}${'*'.repeat(Math.max(0, val.length - 6))}` : '',
    };
  });
}

function getResponseBodyCode(data: any): number | undefined {
  const rawCode = data?.code ?? data?.base_resp?.status_code ?? data?.error?.code ?? data?.status_code;
  const code = Number(rawCode);
  return Number.isFinite(code) ? code : undefined;
}

function getResponseMessage(data: any): string {
  return String(
    data?.error?.message ||
    data?.message ||
    data?.base_resp?.status_msg ||
    data?.msg ||
    ''
  );
}

function isAuthFailureResponse(data: any): boolean {
  const code = getResponseBodyCode(data);
  if (code === 401 || code === 403 || code === 1004) return true;

  const message = getResponseMessage(data).toLowerCase();
  return /login fail|invalid key|invalid api|unauthorized|forbidden|authentication|api key/.test(message);
}

function isInsufficientBalanceResponse(data: any): boolean {
  const code = getResponseBodyCode(data);
  if (code === 402) return true;

  const message = getResponseMessage(data).toLowerCase();
  return /insufficient|balance|quota|欠费|余额不足/.test(message);
}

function hasBusinessError(data: any, successBodyCodes?: number[]): boolean {
  const code = getResponseBodyCode(data);
  if (code !== undefined) {
    if (successBodyCodes?.includes(code)) return false;
    if (code !== 0 && code !== 200) return true;
  }

  if (data?.error) return true;

  const message = getResponseMessage(data).toLowerCase();
  return /login fail|invalid|unauthorized|forbidden|not_found|not found|failed|error|欠费|余额不足/.test(message);
}

// 从 ProviderConfig.config JSON 解析每个模型的 isActive 状态
function getModelStateMap(configJson: string | null): Map<string, boolean> {
  const map = new Map<string, boolean>();
  if (!configJson) return map;
  try {
    const cfg = JSON.parse(configJson);
    const models = Array.isArray(cfg.models) ? cfg.models : [];
    for (const m of models) {
      if (typeof m === 'string') {
        map.set(m, true);
      } else if (m && typeof m === 'object') {
        const id = m.id || m.modelId;
        if (id) map.set(id, m.isActive !== false);
      }
    }
  } catch {
    // 忽略 JSON 解析错误
  }
  return map;
}

// 把 string[] 模型列表转换为含 isActive 状态的对象数组
function buildModelsPayload(
  modelIds: string[],
  stateMap: Map<string, boolean>,
  supportedModels: ProviderSupportedModel[] = []
): Array<{ id: string; name: string; type?: ProviderSupportedModel['type']; isActive: boolean }> {
  const supportedById = new Map(supportedModels.map((model) => [model.id, model]));
  return modelIds.map(id => ({
    id,
    name: supportedById.get(id)?.name || id,
    type: supportedById.get(id)?.type,
    isActive: stateMap.get(id) ?? true,
  }));
}

async function updateEnvFile(updates: Record<string, string>): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, 'utf-8');
  for (const [key, value] of Object.entries(updates)) {
    if (!value) continue;
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(envPath, content);
}

// ==================== 综合健康度检测（Provider + 文本模型） ====================
adminModelHealthRouter.get('/check', async (req: Request, res: Response) => {
  try {
    const providers = await prisma.providerConfig.findMany({
      where: { isActive: true },
      include: {
        apiKeys: {
          where: { isActive: true },
          take: 1,
          orderBy: { priority: 'desc' },
        },
      },
    });

    // --- 1. Provider 连通性检测 ---
    const providerResults = await Promise.allSettled(
      providers.map(async (provider) => {
        const endpoint = PROVIDER_ENDPOINTS[provider.provider];
        // 解析数据库 config JSON 获取模型 isActive 状态
        const modelStateMap = getModelStateMap(provider.config as string | null);
        const providerDbId = provider.id;
        // endpoint.url 始终使用 PROVIDER_ENDPOINTS 中配置的精确探测 URL（含路径）
        // provider.endpoint 仅用于 UI 展示（base URL），不能覆盖探测 URL
        const providerEndpoint = provider.endpoint || (endpoint?.url ?? '');

        if (!endpoint) {
          return {
            provider: provider.provider,
            providerId: providerDbId,
            displayName: provider.displayName,
            type: 'image/video',
            status: 'unknown',
            latency: 0,
            message: '未配置健康检测端点',
            models: [] as Array<{ id: string; name: string; isActive: boolean }>,
            modelCount: 0,
            endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
            apiKeys: [],
          };
        }

        // 优先从环境变量获取密钥
        let decryptedKey: string | null = null;
        if (endpoint.apiKeyResolver) {
          decryptedKey = endpoint.apiKeyResolver();
        }
        if (!decryptedKey && endpoint.apiKeyEnv) {
          decryptedKey = resolveApiKey(endpoint.apiKeyEnv);
        }
        // 回退到数据库密钥
        if (!decryptedKey && provider.apiKeys[0]?.encryptedKey) {
          decryptedKey = provider.apiKeys[0].encryptedKey;
        }

        if (!decryptedKey) {
          // 即使无密钥，也返回 supportedModels（带 isActive 状态）供 UI 显示
          const supportedIds = endpoint.supportedModels ? endpoint.supportedModels.map(m => m.id) : [];
          return {
            provider: provider.provider,
            providerId: providerDbId,
            displayName: provider.displayName,
            type: 'image/video',
            status: 'no_key',
            latency: 0,
            message: '无可用API密钥',
            models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
            modelCount: supportedIds.length,
            endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
            apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
          };
        }

        const start = Date.now();
        try {
          // 构建请求URL和headers（支持query/raw/bearer三种认证模式）
          let requestUrl = endpoint.url;
          const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

          if (endpoint.authMode === 'query') {
            const keyParam = endpoint.keyParam || 'key';
            const params = new URLSearchParams({ [keyParam]: decryptedKey });
            if (endpoint.extraParams) {
              for (const [k, v] of Object.entries(endpoint.extraParams)) params.append(k, v);
            }
            requestUrl = `${endpoint.url}?${params.toString()}`;
          } else if (endpoint.authMode === 'raw') {
            requestHeaders['Authorization'] = decryptedKey;
          } else {
            requestHeaders['Authorization'] = `Bearer ${decryptedKey}`;
          }

          const response = await axios({
            method: endpoint.method,
            url: requestUrl,
            headers: requestHeaders,
            data: endpoint.body,
            timeout: endpoint.timeout,
            validateStatus: () => true,
          });

          const latency = Date.now() - start;
          const status = response.status;
          const bodyCode = getResponseBodyCode(response.data);

          // 检查业务code是否在成功列表中（适用于非OpenAI兼容API如wuyinkeji）
          const isBodyCodeSuccess = endpoint.successBodyCodes && bodyCode !== undefined && endpoint.successBodyCodes.includes(bodyCode);
          const businessError = hasBusinessError(response.data, endpoint.successBodyCodes);

          if ((status >= 200 && status < 300 && !businessError) || isBodyCodeSuccess) {
            let modelIds: string[] = [];
            if (response.data?.data && Array.isArray(response.data.data)) {
              modelIds = response.data.data.map((m: any) => m.id || m.name).filter(Boolean).slice(0, 30);
            }
            // 如果有预定义的supportedModels，使用它
            if (endpoint.supportedModels && modelIds.length === 0) {
              modelIds = endpoint.supportedModels.map(m => m.id);
            }
            const supportedModelList = endpoint.supportedModels || [];
            return {
              provider: provider.provider,
              providerId: providerDbId,
              displayName: provider.displayName,
              type: 'image/video',
              status: 'healthy',
              latency,
              httpStatus: status,
              message: isBodyCodeSuccess
                ? `连通正常，支持 ${supportedModelList.length} 个模型`
                : `连通正常，${modelIds.length} 个模型可用`,
              models: buildModelsPayload(modelIds, modelStateMap, endpoint.supportedModels),
              modelCount: modelIds.length,
              endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
              apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
            };
          } else if (status === 401 || status === 403 || bodyCode === 401 || bodyCode === 403 || isAuthFailureResponse(response.data)) {
            const supportedIds = endpoint.supportedModels ? endpoint.supportedModels.map(m => m.id) : [];
            return {
              provider: provider.provider,
              providerId: providerDbId,
              displayName: provider.displayName,
              type: 'image/video',
              status: 'invalid_key',
              latency,
              httpStatus: status,
              message: 'API密钥无效或已过期',
              models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
              modelCount: supportedIds.length,
              endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
              apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
            };
          } else if (status === 429) {
            const supportedIds = endpoint.supportedModels ? endpoint.supportedModels.map(m => m.id) : [];
            return {
              provider: provider.provider,
              providerId: providerDbId,
              displayName: provider.displayName,
              type: 'image/video',
              status: 'rate_limited',
              latency,
              httpStatus: status,
              message: '请求频率受限',
              models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
              modelCount: supportedIds.length,
              endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
              apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
            };
          } else if (status === 402 || bodyCode === 402 || isInsufficientBalanceResponse(response.data)) {
            const supportedIds = endpoint.supportedModels ? endpoint.supportedModels.map(m => m.id) : [];
            return {
              provider: provider.provider,
              providerId: providerDbId,
              displayName: provider.displayName,
              type: 'image/video',
              status: 'insufficient_balance',
              latency,
              httpStatus: status,
              message: '账户余额不足',
              models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
              modelCount: supportedIds.length,
              endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
              apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
            };
          } else {
            const supportedIds = endpoint.supportedModels ? endpoint.supportedModels.map(m => m.id) : [];
            return {
              provider: provider.provider,
              providerId: providerDbId,
              displayName: provider.displayName,
              type: 'image/video',
              status: 'error',
              latency,
              httpStatus: status,
              message: `HTTP ${status}: ${response.data?.error?.message || response.data?.message || '未知错误'}`,
              models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
              modelCount: supportedIds.length,
              endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
              apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
            };
          }
        } catch (err: any) {
          const latency = Date.now() - start;
          const supportedIds = endpoint.supportedModels ? endpoint.supportedModels.map(m => m.id) : [];
          if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            return {
              provider: provider.provider,
              providerId: providerDbId,
              displayName: provider.displayName,
              type: 'image/video',
              status: 'timeout',
              latency,
              message: `连接超时 (${endpoint.timeout}ms)`,
              models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
              modelCount: supportedIds.length,
              endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
              apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
            };
          }
          if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return {
              provider: provider.provider,
              providerId: providerDbId,
              displayName: provider.displayName,
              type: 'image/video',
              status: 'unreachable',
              latency,
              message: `无法连接: ${err.code}`,
              models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
              modelCount: supportedIds.length,
              endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
              apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
            };
          }
          return {
            provider: provider.provider,
            providerId: providerDbId,
            displayName: provider.displayName,
            type: 'image/video',
            status: 'error',
            latency,
            message: sanitizeProviderMessage(err.message || '未知错误'),
            models: buildModelsPayload(supportedIds, modelStateMap, endpoint.supportedModels),
            modelCount: supportedIds.length,
            endpoint: getDisplayEndpoint(provider.provider, providerEndpoint),
            apiKeys: endpoint.apiKeyEnv ? getEnvKeysWithStatus(endpoint.apiKeyEnv) : [],
          };
        }
      })
    );

    const providerData = providerResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        provider: providers[i]?.provider || 'unknown',
        providerId: providers[i]?.id || '',
        displayName: providers[i]?.displayName || 'Unknown',
        type: 'image/video',
        status: 'error',
        latency: 0,
        message: r.reason?.message || '检测失败',
        models: [] as Array<{ id: string; name: string; isActive: boolean }>,
        modelCount: 0,
        endpoint: getDisplayEndpoint(providers[i]?.provider || '', providers[i]?.endpoint || ''),
        apiKeys: [],
      };
    });

    // --- 2. 文本模型健康检测（发送最小 chat completion 请求） ---
    const textModelResults = await Promise.allSettled(
      TEXT_MODELS.map(async (tm) => {
        const apiKey = tm.apiKeyResolver ? tm.apiKeyResolver() : resolveApiKey(tm.apiKeyEnv);
        if (!apiKey) {
          return {
            model: tm.model,
            displayName: tm.displayName,
            category: tm.category,
            provider: tm.provider,
            type: 'text',
            status: 'no_key',
            latency: 0,
            message: `无可用密钥 (${tm.apiKeyEnvLabel})`,
            apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
          };
        }

        const start = Date.now();
        try {
          // 根据 authMode 选择检测端点和认证方式
          const isAnthropic = tm.authMode === 'anthropic';
          const requestUrl = isAnthropic
            ? `${tm.baseUrl}/v1/messages`
            : `${tm.baseUrl}/chat/completions`;
          const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isAnthropic) {
            requestHeaders['x-api-key'] = apiKey;
            requestHeaders['anthropic-version'] = '2023-06-01';
          } else {
            requestHeaders['Authorization'] = `Bearer ${apiKey}`;
          }
          const requestData = {
            model: tm.probeModel || tm.model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
            stream: false,
          };

          const response = await axios({
            method: 'POST',
            url: requestUrl,
            headers: requestHeaders,
            data: requestData,
            timeout: 15000,
            validateStatus: () => true,
          });

          const latency = Date.now() - start;
          const status = response.status;
          const bodyCode = getResponseBodyCode(response.data);
          const businessError = hasBusinessError(response.data);

          if (status >= 200 && status < 300 && !businessError) {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'healthy',
              latency,
              message: '连通正常',
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          } else if (status === 401 || status === 403 || bodyCode === 401 || bodyCode === 403 || isAuthFailureResponse(response.data)) {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'invalid_key',
              latency,
              message: '密钥无效或已过期',
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          } else if (status === 402 || bodyCode === 402 || isInsufficientBalanceResponse(response.data)) {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'insufficient_balance',
              latency,
              message: '账户余额不足/欠费',
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          } else if (status === 429) {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'rate_limited',
              latency,
              message: '请求频率受限',
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          } else if (status === 404) {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'error',
              latency,
              message: `模型不存在或路径错误 (HTTP 404)`,
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          } else {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'error',
              latency,
              message: `HTTP ${status}: ${response.data?.error?.message || response.data?.message || '未知错误'}`,
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          }
        } catch (err: any) {
          const latency = Date.now() - start;
          if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'timeout',
              latency,
              message: '请求超时 (15s)',
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          }
          if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return {
              model: tm.model,
              displayName: tm.displayName,
              category: tm.category,
              provider: tm.provider,
              type: 'text',
              status: 'unreachable',
              latency,
              message: `无法连接: ${err.code}`,
              apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
            };
          }
          return {
            model: tm.model,
            displayName: tm.displayName,
            category: tm.category,
            provider: tm.provider,
            type: 'text',
            status: 'error',
            latency,
            message: sanitizeProviderMessage(err.message || '未知错误'),
            apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
          };
        }
      })
    );

    const textModelData = textModelResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const tm = TEXT_MODELS[i];
      return {
        model: tm.model,
        displayName: tm.displayName,
        category: tm.category,
        provider: tm.provider,
        type: 'text',
        status: 'error',
        latency: 0,
        message: r.reason?.message || '检测失败',
        apiKeys: getEnvKeysWithStatus(tm.apiKeyEnv),
      };
    });

    // --- 3. 汇总统计 ---
    const allResults = [...providerData, ...textModelData];
    const summary = {
      total: allResults.length,
      healthy: allResults.filter(d => d.status === 'healthy').length,
      invalid_key: allResults.filter(d => d.status === 'invalid_key').length,
      insufficient_balance: allResults.filter(d => d.status === 'insufficient_balance').length,
      timeout: allResults.filter(d => d.status === 'timeout').length,
      unreachable: allResults.filter(d => d.status === 'unreachable').length,
      rate_limited: allResults.filter(d => d.status === 'rate_limited').length,
      error: allResults.filter(d => d.status === 'error').length,
      no_key: allResults.filter(d => d.status === 'no_key').length,
      unknown: allResults.filter(d => d.status === 'unknown').length,
      avgLatency: Math.round(
        allResults.filter(d => d.latency > 0).reduce((a, b, _, arr) => a + b.latency / arr.length, 0)
      ),
    };

    res.json({
      success: true,
      data: {
        summary,
        providers: providerData,
        textModels: textModelData,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 单个 Provider 健康检测 ====================
adminModelHealthRouter.get('/check/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const providerConfig = await prisma.providerConfig.findFirst({
      where: { provider },
      include: { apiKeys: { where: { isActive: true }, take: 1 } },
    });

    if (!providerConfig) {
      return res.json({ success: false, error: 'Provider not found' });
    }

    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) {
      return res.json({
        success: true,
        data: { provider, status: 'unknown', message: '未配置检测端点' },
      });
    }

    let apiKey = endpoint.apiKeyResolver ? endpoint.apiKeyResolver() : '';
    if (!apiKey) {
      apiKey = resolveApiKey(endpoint.apiKeyEnv || []);
    }
    if (!apiKey && providerConfig.apiKeys[0]?.encryptedKey) {
      apiKey = providerConfig.apiKeys[0].encryptedKey;
    }

    if (!apiKey) {
      return res.json({
        success: true,
        data: { provider, status: 'no_key', message: '无可用API密钥' },
      });
    }

    const start = Date.now();
    try {
      let requestUrl = endpoint.url;
      const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (endpoint.authMode === 'query') {
        const keyParam = endpoint.keyParam || 'key';
        const params = new URLSearchParams({ [keyParam]: apiKey });
        if (endpoint.extraParams) {
          for (const [k, v] of Object.entries(endpoint.extraParams)) params.append(k, v);
        }
        requestUrl = `${endpoint.url}?${params.toString()}`;
      } else if (endpoint.authMode === 'raw') {
        requestHeaders.Authorization = apiKey;
      } else {
        requestHeaders.Authorization = `Bearer ${apiKey}`;
      }

      const response = await axios({
        method: endpoint.method,
        url: requestUrl,
        headers: requestHeaders,
        data: endpoint.body,
        timeout: endpoint.timeout,
        validateStatus: () => true,
      });

      const latency = Date.now() - start;
      const bodyCode = getResponseBodyCode(response.data);
      const isBodyCodeSuccess = endpoint.successBodyCodes && bodyCode !== undefined && endpoint.successBodyCodes.includes(bodyCode);
      const healthy = (response.status >= 200 && response.status < 300 && !hasBusinessError(response.data, endpoint.successBodyCodes)) || isBodyCodeSuccess;
      const status =
        healthy ? 'healthy' :
        response.status === 401 || response.status === 403 || bodyCode === 401 || bodyCode === 403 || isAuthFailureResponse(response.data) ? 'invalid_key' :
        response.status === 402 || bodyCode === 402 || isInsufficientBalanceResponse(response.data) ? 'insufficient_balance' :
        response.status === 429 || bodyCode === 429 ? 'rate_limited' :
        'error';

      res.json({
        success: true,
        data: {
          provider,
          status,
          latency,
          httpStatus: response.status,
          message: healthy
            ? '连通正常'
            : sanitizeProviderMessage(getResponseMessage(response.data) || `HTTP ${response.status}`),
        },
      });
    } catch (err: any) {
      const latency = Date.now() - start;
      res.json({
        success: true,
        data: {
          provider,
          status: err.code === 'ECONNABORTED' ? 'timeout' : 'error',
          latency,
          message: sanitizeProviderMessage(err.message),
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 更新 API 密钥 ====================
adminModelHealthRouter.post('/update-key', async (req: Request, res: Response) => {
  try {
    const { envVar, apiKey } = req.body;

    if (!envVar || !apiKey) {
      return res.status(400).json({ success: false, error: '缺少 envVar 或 apiKey 参数' });
    }

    // 验证环境变量名格式（只允许大写字母、数字、下划线）
    if (!/^[A-Z][A-Z0-9_]*$/.test(envVar)) {
      return res.status(400).json({ success: false, error: '环境变量名格式不合法' });
    }

    // 更新运行时环境变量
    process.env[envVar] = apiKey;

    // 同步到 .env 文件
    await updateEnvFile({ [envVar]: apiKey });

    // 同步到数据库 ProviderApiKey 表
    const providerName = envVar.toLowerCase().replace('_api_key', '').replace('_key', '');
    const providers = await prisma.providerConfig.findMany({
      where: { provider: { contains: providerName } },
    });

    for (const p of providers) {
      const existingKey = await prisma.providerApiKey.findFirst({
        where: { providerName: p.provider, keyLabel: { contains: 'env' } },
      });

      if (existingKey) {
        await prisma.providerApiKey.update({
          where: { id: existingKey.id },
          data: { encryptedKey: apiKey },
        });
      } else {
        await prisma.providerApiKey.create({
          data: {
            providerName: p.provider,
            keyLabel: `env-${envVar.toLowerCase()}`,
            encryptedKey: apiKey,
            isActive: true,
            priority: 10,
          },
        });
      }
    }

    res.json({
      success: true,
      message: `密钥已更新: ${envVar}`,
      data: {
        envVar,
        preview: `${apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, apiKey.length - 6))}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 更新 Provider Endpoint 地址 ====================
adminModelHealthRouter.post('/update-endpoint', async (req: Request, res: Response) => {
  try {
    const { providerId, endpoint } = req.body;

    if (!providerId || !endpoint) {
      return res.status(400).json({ success: false, error: '缺少 providerId 或 endpoint 参数' });
    }

    // 简单校验 URL 格式
    try {
      new URL(endpoint);
    } catch {
      return res.status(400).json({ success: false, error: 'endpoint URL 格式不合法' });
    }

    // 更新数据库 ProviderConfig.endpoint
    const updated = await prisma.providerConfig.update({
      where: { id: providerId },
      data: { endpoint },
      select: { id: true, provider: true, displayName: true, endpoint: true },
    });

    // 同步到运行时 PROVIDER_ENDPOINTS（仅内存生效，重启后以数据库为准）
    const providerKey = updated.provider;
    if (PROVIDER_ENDPOINTS[providerKey]) {
      PROVIDER_ENDPOINTS[providerKey].url = endpoint;
    }

    res.json({
      success: true,
      message: `地址已更新: ${updated.displayName}`,
      data: {
        providerId: updated.id,
        provider: updated.provider,
        displayName: updated.displayName,
        endpoint: getDisplayEndpoint(updated.provider, updated.endpoint),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ==================== 获取所有环境变量密钥状态 ====================
adminModelHealthRouter.get('/env-keys', async (req: Request, res: Response) => {
  try {
    const allEnvs = new Set<string>();
    for (const ep of Object.values(PROVIDER_ENDPOINTS)) {
      if (ep.apiKeyEnv) ep.apiKeyEnv.forEach(e => allEnvs.add(e));
    }
    for (const tm of TEXT_MODELS) {
      tm.apiKeyEnv.forEach(e => allEnvs.add(e));
    }
    // 额外添加其他已知的环境变量
    ['AGNES_KEY_POOL_API_KEY', 'AGNES_VIDEO_API_KEY', 'WUYIN_API_KEY'].forEach(e => allEnvs.add(e));

    const result = Array.from(allEnvs).sort().map(env => {
      const val = process.env[env];
      return {
        envVar: env,
        configured: !!(val && val.length > 5),
        preview: val ? `${val.slice(0, 6)}${'*'.repeat(Math.max(0, val.length - 6))}` : '',
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
