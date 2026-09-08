/**
 * admin-user 路由 — 管理员用户管理路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

export const adminUserRouter = Router();

// 所有用户管理端点已移除
adminUserRouter.get('/', (_req, res) => {
  res.json({ success: true, users: [], total: 0 });
});