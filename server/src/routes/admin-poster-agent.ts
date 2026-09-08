import { Router, Response } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import {
  getKnowledgeOverview,
  getPosterAgentModelProvider,
  getPosterAgentModels,
  getPosterAgentRuntimeConfig,
  recommendPosterAgentModel,
} from '../services/poster-agent-service';

export const adminPosterAgentRouter = Router();

adminPosterAgentRouter.use(authenticate, requireAdmin);

adminPosterAgentRouter.get('/overview', async (_req: AuthRequest, res: Response) => {
  try {
    const models = getPosterAgentModels();
    const knowledge = getKnowledgeOverview();
    const runtime = getPosterAgentRuntimeConfig();
    const routingSamples = [
      '中秋节活动海报，国潮风，主标题醒目',
      '政府项目宣传海报，正式红蓝配色',
      'MBA 招生简章，包含课程时间地点和报名方式',
      '企业峰会倒计时海报，深蓝商务科技风',
    ].map((text) => ({ text, modelId: recommendPosterAgentModel(text) }));

    res.json({
      success: true,
      data: {
        runtime,
        models: models.map((model) => ({
          ...model,
          resolvedProvider: getPosterAgentModelProvider(model.id),
          isDefault: model.id === runtime.defaultModelId,
        })),
        knowledge,
        routingSamples,
        endpoints: [
          { method: 'POST', path: '/api/v1/poster-agent/chat', name: '智能体对话', auth: true },
          { method: 'POST', path: '/api/v1/poster-agent/optimize', name: '提示词优化', auth: true },
          { method: 'GET', path: '/api/v1/poster-agent/models', name: '模型列表', auth: true },
          { method: 'GET', path: '/api/v1/poster-agent/knowledge', name: '知识库概览', auth: true },
        ],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[AdminPosterAgent] overview failed: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

adminPosterAgentRouter.get('/health', async (_req: AuthRequest, res: Response) => {
  try {
    const models = getPosterAgentModels();
    const runtime = getPosterAgentRuntimeConfig();
    res.json({
      success: true,
      data: {
        status: 'online',
        timestamp: new Date().toISOString(),
        modelCount: models.length,
        defaultModelId: runtime.defaultModelId,
        autoRoutingEnabled: runtime.autoRoutingEnabled,
        internalChatEndpoint: runtime.internalChatEndpoint,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[AdminPosterAgent] health failed: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});
