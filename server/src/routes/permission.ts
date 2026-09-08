/**
 * permission 路由 — 权限路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

const permissionRouter = Router();

// 所有权限端点已移除
permissionRouter.get('/', (_req, res) => {
  res.json({ success: true, permissions: [] });
});

export default permissionRouter;