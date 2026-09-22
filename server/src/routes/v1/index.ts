import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth'; // SEC-10 修复：导入 requireAuth
import axios from 'axios'; // SEC-10 修复：使用标准 import 而非内联 require
import { adminTaskRouter } from '../admin-task';
import adminNotificationsRouter from '../admin/notifications';
import { adminFrontendMonitoringRouter } from '../admin-frontend-monitoring';
import backupManagementRouter from '../backup-management';
import adminSiteMessagesRouter from '../admin/site-messages';
import adminSponsorRouter from '../admin-sponsor';
import adminChatRouter from '../admin-chat';
import adminMediaGatewayRouter from '../admin-mediagateway';
import { adminAiUsageRouter } from '../admin-ai-usage';
import { adminGeneratedCleanupRouter } from '../admin-generated-cleanup';
import { adminModelHealthRouter } from '../admin-model-health';
import { adminGovernanceRouter } from '../admin-governance';
import { adminAccessControlRouter } from '../admin-access-control';
import { adminRouter } from '../admin';
import { frontendMonitoringRouter } from '../frontend-monitoring';
import { stabilityMonitorRouter } from '../stability-monitor';
import fileManagementRouter from '../file-management';
import monitoringRouter from '../monitoring';
import notificationRouter from '../notification';
import siteMessagesRouter from '../site-messages';
import websocketPushRouter from '../websocket-push';
import exportRouter from '../export';
import auditRouter from '../audit';
import { taskRouter } from '../task';
import { videoRouter } from '../video';
import { videoProxyRouter } from '../video-proxy';
import { imageRouter } from '../image';
import permissionRouter from '../permission';
import { logsRouter } from '../logs';
import { apiKeyRouter } from '../apikey';
import { aiProviderPublicRouter, aiProviderRouter } from '../ai-provider';
import { userApiKeyRouter } from '../user-api-key';
import { userModelCredentialsRouter } from '../user-model-credentials';
import { operationLogRouter } from '../operation-log';
import { aiProxyRouter, aiPublicRouter } from '../ai-proxy';
import { secureProxyRouter } from '../secure-proxy';
import { rembgRouter } from '../rembg';
import { baiduAiRouter } from '../baidu-ai';
import { sam2Router } from '../sam2';
import { upscaleRouter } from '../upscale';
import { audioRouter } from '../audio';
import { comicRouter } from '../comic';
import { comicProjectRouter } from '../comic-project';
import canvasProjectRouter from '../canvas-project';
import { aicgSkillsRouter } from '../aicg-skills';
import { communityRouter } from '../community';
import comicWorkspaceRouter from '../comic-workspace';
import { characterLibraryRouter } from '../character-library';
import { sceneLibraryRouter } from '../scene-library';
import { propLibraryRouter } from '../prop-library';
import { softwareUpdateRouter } from '../software-update';
import { promptLogRouter } from '../prompt-log';
import workflowRouter from '../workflow';
import { ragRouter } from '../rag';
import publicChatRouter from '../public-chat';
import { syncRouter } from '../sync';
import publicSponsorRouter from '../public-sponsor';
import publicSponsorOrdersRouter from '../public-sponsor-orders';
import { appConfigRouter, adminAppConfigRouter } from '../app-config';
import { tutorialVideosRouter } from '../tutorial-videos';
import { promptSafety } from '../../middleware/prompt-safety';
import { APP_DISPLAY_VERSION } from '../../config/app-version';

const v1Router = Router();

type RouteMount = readonly [path: string, router: Router];

export const ADMIN_ROUTE_MOUNTS = [
  '/admin/tasks',
  '/admin/notifications',
  '/admin/frontend-monitoring',
  '/admin/backup',
  '/admin/site-messages',
  '/admin/sponsor',
  '/admin/chat',
  '/admin/mediagateway',
  '/admin/ai-usage',
  '/admin/generated-cleanup',
  '/admin/model-health',
  '/admin/governance',
  '/admin/access-control',
  '/admin/app-config',
  '/admin/stability',
  '/admin/operation-logs',
  '/admin',
] as const;

export const PUBLIC_ROUTE_MOUNTS = [
  '/files',
  '/monitor',
  '/monitoring',
  '/notifications',
  '/site-messages',
  '/ws-push',
  '/export',
  '/audit',
  '/tasks',
  '/video',
  '/video-proxy',
  '/image',
  '/app-config',
  '/tutorial-videos',
  '/apikey',
  '/ai-providers',
  '/user-api-keys',
  '/user-model-credentials',
  '/ai',
  '/proxy',
  '/rembg',
  '/baidu-ai',
  '/sam2',
  '/upscale',
  '/audio',
  '/comic',
  '/comic-project',
  '/canvas-project',
  '/aicg-skills',
  '/community',
  '/comic-workspace',
  '/character-library',
  '/scene-library',
  '/prop-library',
  '/software',
  '/prompt-logs',
  '/workflow',
  '/rag',
  '/public/chat',
  '/public/ai',
  '/public/ai-providers',
  '/sync',
  '/public',
] as const;

// SEC-AUDIT 修复：精简根路由返回，避免 API 端点目录暴露（信息泄露）
// 安全最佳实践：公开端点不应枚举所有路由，仅返回最小必要信息
v1Router.get('/', (_req, res) => {
  res.json({
    success: true,
    version: APP_DISPLAY_VERSION,
  });
});

// 后台管理路由集中挂载，避免管理/运维接口散落在 v1 顶层。
const adminRouteMounts: RouteMount[] = [
  ['/admin/tasks', adminTaskRouter],
  ['/admin/notifications', adminNotificationsRouter],
  ['/admin/frontend-monitoring', adminFrontendMonitoringRouter],
  ['/admin/backup', backupManagementRouter],
  ['/admin/site-messages', adminSiteMessagesRouter],
  ['/admin/sponsor', adminSponsorRouter],
  ['/admin/chat', adminChatRouter],
  ['/admin/mediagateway', adminMediaGatewayRouter],
  ['/admin/ai-usage', adminAiUsageRouter],
  ['/admin/generated-cleanup', adminGeneratedCleanupRouter],
  ['/admin/model-health', adminModelHealthRouter],
  ['/admin/governance', adminGovernanceRouter],
  ['/admin/access-control', adminAccessControlRouter],
  ['/admin/app-config', adminAppConfigRouter],
  ['/admin/stability', stabilityMonitorRouter],
  ['/admin/operation-logs', operationLogRouter],
  ['/admin', adminRouter],
];
adminRouteMounts.forEach(([routePath, route]) => v1Router.use(routePath, route));

v1Router.use('/files', fileManagementRouter);
v1Router.use('/monitor', frontendMonitoringRouter);
v1Router.use('/monitoring', monitoringRouter);
v1Router.use('/notifications', notificationRouter);
v1Router.use('/site-messages', siteMessagesRouter);
v1Router.use('/ws-push', websocketPushRouter);
v1Router.use('/export', exportRouter);
v1Router.use('/audit', auditRouter);

v1Router.use('/tasks', taskRouter);
// Public video API entry. Clients should stay on /api/v1/video for compatibility.
v1Router.use('/video', promptSafety, videoRouter);
// Internal video routing and operations surface. Not the preferred public entry.
v1Router.use('/video-proxy', promptSafety, videoProxyRouter);
v1Router.use('/image', promptSafety, imageRouter);

// 计费/会员/支付/用户管理/内容审核/短信/邮件/海报功能已移除

v1Router.use('/permission', permissionRouter);
v1Router.use('/logs', logsRouter);
v1Router.use('/app-config', appConfigRouter);
v1Router.use('/tutorial-videos', tutorialVideosRouter);
v1Router.use('/apikey', apiKeyRouter);
v1Router.use('/ai-providers', aiProviderRouter);
v1Router.use('/user-api-keys', userApiKeyRouter);
v1Router.use('/user-model-credentials', userModelCredentialsRouter);
v1Router.use('/ai', promptSafety, aiProxyRouter);
v1Router.use('/proxy', secureProxyRouter);
v1Router.use('/rembg', rembgRouter);
v1Router.use('/baidu-ai', baiduAiRouter);
v1Router.use('/sam2', sam2Router);
v1Router.use('/upscale', upscaleRouter);
v1Router.use('/audio', promptSafety, audioRouter);
v1Router.use('/comic', promptSafety, comicRouter);
v1Router.use('/comic-project', comicProjectRouter);
v1Router.use('/canvas-project', promptSafety, canvasProjectRouter);
v1Router.use('/aicg-skills', promptSafety, aicgSkillsRouter);
v1Router.use('/community', communityRouter);
v1Router.use('/comic-workspace', promptSafety, comicWorkspaceRouter);
v1Router.use('/character-library', promptSafety, characterLibraryRouter);
v1Router.use('/scene-library', promptSafety, sceneLibraryRouter);
v1Router.use('/prop-library', promptSafety, propLibraryRouter);
v1Router.use('/software', softwareUpdateRouter);

v1Router.use('/prompt-logs', promptSafety, promptLogRouter);

v1Router.use('/workflow', promptSafety, workflowRouter);

v1Router.get('/wuyinkeji/task/:taskId', requireAuth, async (req: Request, res: Response) => { // SEC-10 修复：添加 requireAuth 防止未认证调用
  try {
    const { taskId } = req.params;
    if (!taskId) {
      res.status(400).json({ success: false, error: '缺少 taskId' });
      return;
    }
    const apiKey = process.env.WUYIN_API_KEY || '';
    if (!apiKey) {
      res.status(500).json({ success: false, error: '小天API密钥未配置' });
      return;
    }
    const response = await axios.get(`https://api.wuyinkeji.com/api/async/detail`, {
      params: { key: apiKey, id: taskId },
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.response?.data?.msg || error?.message || '查询失败',
    });
  }
});

// RAG 知识库检索
v1Router.use('/rag', promptSafety, ragRouter);

// 公开路由（无需认证）
v1Router.use('/public/chat', promptSafety, publicChatRouter);
v1Router.use('/public/ai', promptSafety, aiPublicRouter);
v1Router.use('/public/ai-providers', aiProviderPublicRouter);
v1Router.use('/sync', syncRouter);
v1Router.use('/public', publicSponsorRouter);
v1Router.use('/sponsor-orders', publicSponsorOrdersRouter);

export { v1Router };
