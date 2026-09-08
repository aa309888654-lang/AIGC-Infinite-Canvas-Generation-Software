/**
 * admin-access-control 路由 — 管理员访问控制路由（存根）
 *
 * 登录与会员系统已移除，此文件保留空路由以维持编译兼容。
 */

import { Router } from 'express';

export const adminAccessControlRouter = Router();

// 所有访问控制端点已移除
adminAccessControlRouter.get('/', (_req, res) => {
  res.json({ success: true, rules: [] });
});