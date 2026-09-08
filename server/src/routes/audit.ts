/**
 * audit 路由 — 审计路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

const auditRouter = Router();

// 所有审计端点已移除
auditRouter.get('/', (_req, res) => {
  res.json({ success: true, logs: [] });
});

export default auditRouter;