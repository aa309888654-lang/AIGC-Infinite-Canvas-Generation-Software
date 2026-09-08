import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, optionalAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { logOperation } from '../services/operation-log-service';
import {
  archiveModel,
  AppSectionConfig,
  ModelParameterField,
  getAppBootstrap,
  getAppSections,
  getFeatureFlags,
  getModelCatalog,
  publishSnapshot,
  resetRechargePackages,
  saveAppSections,
  saveFeatureFlags,
  saveModelParameterSchema,
  savePointsPolicy,
  saveRechargePackageList,
  setModelStatus,
  updateModelPricing,
  upsertModelInProvider,
} from '../services/app-config-service';
import { normalizeRechargePackage } from '../services/points-packages-service';
import { websocketPushService } from '../services/websocket-push-service';

export const appConfigRouter = Router();
export const adminAppConfigRouter = Router();

const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  area: z.enum(['home', 'workspace', 'canvas', 'membership', 'admin', 'navigation']),
  route: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean(),
  order: z.number(),
  requiredRole: z.enum(['guest', 'user', 'admin']).optional(),
  featureFlag: z.string().optional(),
});

const parameterFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'number', 'select', 'boolean', 'image', 'file', 'slider']),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
  helpText: z.string().optional(),
});

const parameterSchema = z.object({
  version: z.string().optional(),
  fields: z.array(parameterFieldSchema),
});

const modelPayloadSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['image', 'video', 'audio', 'text', 'music', 'both']).optional(),
  // provider 实际执行模型ID（当与 modelId 不同时使用，例如聚合 provider 场景）
  providerModel: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  supportedModes: z.array(z.string()).optional(),
  supportedAspectRatios: z.array(z.string()).optional(),
  supportedDurations: z.array(z.number()).optional(),
  requiredInputs: z.array(z.string()).optional(),
  modelCategory: z.enum(['generation', 'edit', 'action']).optional(),
  maxResolution: z.string().optional(),
  maxDuration: z.number().optional(),
  defaultParams: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  disabledReason: z.string().optional(),
  providerDisplayName: z.string().optional(),
  providerName: z.string().optional(),
  providerDescription: z.string().optional(),
});

const modelPatchSchema = modelPayloadSchema.omit({ provider: true }).partial().extend({
  modelId: z.string().optional(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
  disabledReason: z.string().optional(),
});

const pricingSchema = z.object({
  taskType: z.enum(['image', 'video', 'text', 'audio', 'music']),
  pointsCost: z.number().int().min(0),
  isActive: z.boolean().optional(),
  note: z.string().optional(),
});

const pointsPolicySchema = z.record(z.number().min(0));

const rechargePackageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  points: z.number().int().min(1),
  price: z.number().min(0.01),
  originalPrice: z.number().min(0).optional(),
  description: z.string().optional(),
  bonusPoints: z.number().int().min(0).optional(),
  isPopular: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

async function getAdminIdentity(req: AuthRequest): Promise<{ id: string; username: string }> {
  if (!req.userId) return { id: 'unknown', username: 'unknown' };
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, email: true },
  });
  return {
    id: user?.id || req.userId,
    username: user?.username || user?.email || req.userId,
  };
}

/**
 * 通知所有已连接的前端客户端：应用配置已更新。
 * 模型 CRUD、定价、参数、状态变更后均应调用此函数，
 * 触发前端 modelRegistry.refreshFromBackend() 重新拉取模型列表。
 *
 * WebSocket 广播失败不影响 API 响应，仅记录警告日志。
 */
function notifyConfigUpdate(action: string, adminId: string, detail?: Record<string, unknown>): void {
  websocketPushService.broadcast({
    type: 'app_config_updated',
    data: {
      action,
      adminId,
      detail,
      publishedAt: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  }).catch((err) => {
    console.warn(
      `[AppConfig] WebSocket 广播配置更新通知失败 (action=${action}):`,
      err instanceof Error ? err.message : String(err)
    );
  });
}

async function logConfigChange(req: AuthRequest, targetName: string, beforeValue: unknown, afterValue: unknown): Promise<void> {
  const admin = await getAdminIdentity(req);
  await logOperation({
    adminId: admin.id,
    adminUsername: admin.username,
    action: 'config_update',
    targetType: 'config',
    targetName,
    beforeValue: typeof beforeValue === 'string' ? beforeValue : JSON.stringify(beforeValue ?? null),
    afterValue: typeof afterValue === 'string' ? afterValue : JSON.stringify(afterValue ?? null),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

function decodeParam(value: string): string {
  return decodeURIComponent(value);
}

appConfigRouter.get('/bootstrap', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const data = await getAppBootstrap(req.membershipLevel);
    if (!req.userId) {
      data.models = [];
      data.providers = [];
      data.pricingRules = [];
    }
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

appConfigRouter.get('/sections', async (_req, res) => {
  try {
    res.json({ success: true, data: await getAppSections() });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

appConfigRouter.get('/models/available', authenticate, async (req: AuthRequest, res) => {
  try {
    const catalog = await getModelCatalog({ membershipLevel: req.membershipLevel });
    res.json({ success: true, data: catalog });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.use(authenticate, requireAdmin);

adminAppConfigRouter.get('/bootstrap', async (req: AuthRequest, res) => {
  try {
    const data = await getAppBootstrap(req.membershipLevel || 'enterprise');
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.get('/models', async (_req, res) => {
  try {
    const data = await getModelCatalog({ includeInactive: true, membershipLevel: 'enterprise' });
    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.post('/models', async (req: AuthRequest, res) => {
  try {
    const input = modelPayloadSchema.parse(req.body);
    const created = await upsertModelInProvider(input.provider, input);
    await logConfigChange(req, `model:${input.provider}:${input.modelId}`, null, created);
    // 通知前端刷新模型列表（新增模型立即生效）
    notifyConfigUpdate('model_create', req.userId || 'unknown', { provider: input.provider, modelId: input.modelId });
    res.status(201).json({ success: true, data: created, message: '模型已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/models/:provider/:modelId', async (req: AuthRequest, res) => {
  try {
    const provider = decodeParam(req.params.provider);
    const modelId = decodeParam(req.params.modelId);
    const input = modelPatchSchema.parse(req.body);
    const updated = await upsertModelInProvider(provider, { ...input, modelId });
    await logConfigChange(req, `model:${provider}:${modelId}`, { provider, modelId }, updated);
    notifyConfigUpdate('model_update', req.userId || 'unknown', { provider, modelId });
    res.json({ success: true, data: updated, message: '模型已更新' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.patch('/models/:provider/:modelId/status', async (req: AuthRequest, res) => {
  try {
    const provider = decodeParam(req.params.provider);
    const modelId = decodeParam(req.params.modelId);
    const input = statusSchema.parse(req.body);
    const updated = await setModelStatus(provider, modelId, input.isActive, input.disabledReason);
    await logConfigChange(req, `model-status:${provider}:${modelId}`, null, updated);
    notifyConfigUpdate('model_status_change', req.userId || 'unknown', { provider, modelId, isActive: input.isActive });
    res.json({ success: true, data: updated, message: input.isActive ? '模型已启用' : '模型已禁用' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.delete('/models/:provider/:modelId', async (req: AuthRequest, res) => {
  try {
    const provider = decodeParam(req.params.provider);
    const modelId = decodeParam(req.params.modelId);
    const archived = await archiveModel(provider, modelId);
    await logConfigChange(req, `model-archive:${provider}:${modelId}`, null, archived);
    notifyConfigUpdate('model_delete', req.userId || 'unknown', { provider, modelId });
    res.json({ success: true, data: archived, message: '模型已下架' });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/models/:provider/:modelId/parameters', async (req: AuthRequest, res) => {
  try {
    const provider = decodeParam(req.params.provider);
    const modelId = decodeParam(req.params.modelId);
    const input = parameterSchema.parse(req.body);
    const schema = await saveModelParameterSchema(provider, modelId, {
      version: input.version || '1.0',
      fields: input.fields as ModelParameterField[],
    });
    await logConfigChange(req, `model-parameters:${provider}:${modelId}`, null, schema);
    notifyConfigUpdate('model_parameters_update', req.userId || 'unknown', { provider, modelId });
    res.json({ success: true, data: schema, message: '模型参数已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/models/:provider/:modelId/pricing', async (req: AuthRequest, res) => {
  try {
    const provider = decodeParam(req.params.provider);
    const modelId = decodeParam(req.params.modelId);
    const input = pricingSchema.parse(req.body);
    const rule = await updateModelPricing(provider, modelId, {
      taskType: input.taskType,
      pointsCost: input.pointsCost,
      isActive: input.isActive,
      note: input.note,
    });
    await logConfigChange(req, `model-pricing:${provider}:${modelId}`, null, rule);
    notifyConfigUpdate('model_pricing_update', req.userId || 'unknown', { provider, modelId });
    res.json({ success: true, data: rule, message: '模型积分定价已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.get('/sections', async (_req, res) => {
  try {
    res.json({ success: true, data: await getAppSections() });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/sections', async (req: AuthRequest, res) => {
  try {
    const sections = z.array(sectionSchema).parse(req.body.sections || req.body) as AppSectionConfig[];
    const saved = await saveAppSections(sections);
    await logConfigChange(req, 'app-sections', null, saved);
    res.json({ success: true, data: saved, message: '前端板块配置已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.get('/feature-flags', async (_req, res) => {
  try {
    res.json({ success: true, data: await getFeatureFlags() });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/feature-flags', async (req: AuthRequest, res) => {
  try {
    const flags = z.record(z.boolean()).parse(req.body.flags || req.body);
    const saved = await saveFeatureFlags(flags);
    await logConfigChange(req, 'feature-flags', null, saved);
    res.json({ success: true, data: saved, message: '功能开关已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/points-policy', async (req: AuthRequest, res) => {
  try {
    const values = pointsPolicySchema.parse(req.body.config || req.body);
    const saved = await savePointsPolicy(values);
    await logConfigChange(req, 'points-policy', null, saved);
    res.json({ success: true, data: saved, message: '积分政策已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/invite-policy', async (req: AuthRequest, res) => {
  try {
    const values = pointsPolicySchema.parse(req.body.config || req.body);
    const saved = await savePointsPolicy(values);
    await logConfigChange(req, 'invite-policy', null, saved);
    res.json({ success: true, data: saved, message: '邀请奖励政策已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.put('/recharge-packages', async (req: AuthRequest, res) => {
  try {
    const packages = z.array(rechargePackageSchema).parse(req.body.packages || req.body);
    const saved = await saveRechargePackageList(packages.map((pkg) => normalizeRechargePackage(pkg)));
    await logConfigChange(req, 'recharge-packages', null, saved);
    res.json({ success: true, data: saved, message: '充值套餐已保存' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.post('/recharge-packages/reset', async (req: AuthRequest, res) => {
  try {
    const saved = await resetRechargePackages();
    await logConfigChange(req, 'recharge-packages-reset', null, saved);
    res.json({ success: true, data: saved, message: '充值套餐已重置' });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

adminAppConfigRouter.post('/publish', async (req: AuthRequest, res) => {
  try {
    const admin = await getAdminIdentity(req);
    const result = await publishSnapshot(admin.id);
    await logConfigChange(req, 'app-config-publish', null, result);

    // 通过 WebSocket 通知所有已连接的前端客户端：配置已更新，需要重新拉取 bootstrap
    websocketPushService.broadcast({
      type: 'app_config_updated',
      data: { version: result.version, publishedAt: new Date().toISOString(), adminId: admin.id },
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      // WebSocket 广播失败不影响发布结果
      console.warn('[AppConfig] WebSocket 广播配置更新通知失败:', err instanceof Error ? err.message : String(err));
    });

    res.json({ success: true, data: result, message: '配置已发布并创建快照' });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});
