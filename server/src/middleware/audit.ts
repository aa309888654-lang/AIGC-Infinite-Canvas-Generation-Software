import { Request, Response, NextFunction } from 'express';
import { logOperation, AdminAction, TargetType } from '../services/operation-log-service';
import { AuthRequest } from './auth';
import prisma from '../lib/prisma';
import { decryptFromStorage } from '../utils/encryption';
import { logger } from '../utils/logger';

/**
 * 统一审计日志中间件 - P0 修复
 *
 * 用法：
 *   adminRouter.post('/', auditMiddleware('user_create', 'user'), handler);
 *
 * 中间件会在响应成功后自动记录审计日志：
 *   - 操作者：从 req.userId 获取，查询用户名
 *   - 目标：从 req.params.id 或响应 data.id 获取
 *   - 变更前：GET 请求无 beforeValue；PUT/DELETE 会尝试获取（需路由配合）
 *   - 变更后：从 res.body 获取
 *   - 状态：根据 res.statusCode 判断 success/failed
 *
 * 注意：此中间件应在 authenticate + requireAdmin 之后挂载
 */

// 缓存管理员信息，避免每次审计都查库（5 分钟 TTL）
const adminCache = new Map<string, { username: string; expireAt: number }>();
const ADMIN_CACHE_TTL = 5 * 60 * 1000;

async function getAdminInfo(userId: string): Promise<{ id: string; username: string }> {
  const cached = adminCache.get(userId);
  if (cached && cached.expireAt > Date.now()) {
    return { id: userId, username: cached.username };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, emailCipher: true },
    });

    const username = user?.username || 'unknown';
    adminCache.set(userId, { username, expireAt: Date.now() + ADMIN_CACHE_TTL });
    return { id: userId, username };
  } catch {
    return { id: userId, username: 'unknown' };
  }
}

/**
 * 审计中间件工厂
 * @param action 操作类型（如 'user_create', 'api_key_delete'）
 * @param targetType 目标类型（如 'user', 'api_key'）
 * @param options 可选配置
 *   - getTargetId: 从 req 获取目标 ID 的函数（默认 req.params.id）
 *   - getTargetName: 从 req/res 获取目标名称的函数
 *   - getBeforeValue: 获取变更前值的函数（用于 PUT/DELETE）
 */
export function auditMiddleware(
  action: AdminAction,
  targetType: TargetType,
  options?: {
    getTargetId?: (req: Request) => string | undefined;
    getTargetName?: (req: Request, res: Response) => string | undefined;
    getBeforeValue?: (req: Request) => Promise<any>;
  }
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // 拦截 res.json 来捕获响应数据
    const originalJson = res.json.bind(res);
    let responseBody: any;

    res.json = function (body: any) {
      responseBody = body;
      return originalJson(body);
    };

    // 响应完成后记录审计日志
    res.on('finish', async () => {
      try {
        const adminId = req.userId;
        if (!adminId) return;

        const admin = await getAdminInfo(adminId);
        const targetId = options?.getTargetId?.(req) || (req.params.id as string) || responseBody?.data?.id;
        const targetName = options?.getTargetName?.(req, res) || responseBody?.data?.name || responseBody?.data?.username;
        const beforeValue = options?.getBeforeValue ? await options.getBeforeValue(req).catch(() => undefined) : undefined;

        await logOperation({
          adminId: admin.id,
          adminUsername: admin.username,
          action,
          targetType,
          targetId,
          targetName,
          beforeValue,
          afterValue: responseBody?.data,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          status: res.statusCode < 400 ? 'success' : 'failed',
          errorMessage: res.statusCode >= 400 ? responseBody?.error || responseBody?.message : undefined,
          metadata: {
            method: req.method,
            path: req.originalUrl || req.path,
            statusCode: res.statusCode,
          },
        });
      } catch (error) {
        logger.error('[AuditMiddleware] 记录审计日志失败:', error instanceof Error ? error.message : String(error));
      }
    });

    next();
  };
}

export default auditMiddleware;
