import { Router } from 'express';
import { adminController } from '../controllers/admin-controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit'; // P0 修复：审计中间件
import { asyncHandler } from '../middleware/errorHandler'; // P2 修复 #19：统一错误处理

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

// 会员管理、支付记录管理端点已随会员/支付系统移除

// ==================== 仪表盘统计 ====================
adminRouter.get('/stats', adminController.getStats);

// ==================== API密钥管理 ====================
// P0 修复：所有写操作添加审计中间件
adminRouter.get('/apikeys', adminController.getAllApiKeys);
adminRouter.post('/apikeys', auditMiddleware('api_key_create', 'api_key'), adminController.createApiKey);
adminRouter.put('/apikeys/:id', auditMiddleware('api_key_update', 'api_key'), adminController.updateApiKey);
adminRouter.delete('/apikeys/:id', auditMiddleware('api_key_delete', 'api_key'), adminController.deleteApiKey);
adminRouter.put('/apikeys/:id/toggle', auditMiddleware('api_key_enable', 'api_key'), adminController.toggleApiKey);
adminRouter.get('/apikeys/:id/stats', adminController.getApiKeyStats);

// ==================== 活动参与 ====================
adminRouter.get('/campaigns/:id/participations', adminController.getCampaignParticipations);

// asyncHandler 保留导入以备后续端点使用
void asyncHandler;
