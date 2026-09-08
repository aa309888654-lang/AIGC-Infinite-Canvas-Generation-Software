# 小天画布（AICGXT）开源版 - 后端

## 📋 项目概述

这是小天画布（AICGXT）开源版的后端服务，提供 AI 创作能力与前端同源托管。开源本地模式下免登录、全功能解锁。

**技术栈**: Node.js + Express + Prisma + TypeScript + SQLite/PostgreSQL  
**版本**: v2.7.9

---

## ✨ 核心功能

### 🎯 用户与权限管理
- ✅ 用户注册、登录、认证
- ✅ JWT Token 认证
- ✅ 高级权限控制 (RBAC)
- ✅ 字段级别权限控制
- ✅ 权限模板管理
- ✅ SSO 单点登录支持（Enterprise）

### 💳 会员与支付系统
- ✅ 会员套餐管理（免费、专业、企业版）
- ✅ 积分系统
- ✅ 配额管理
- ✅ 支付宝/微信支付集成
- ✅ 手动开通会员

### 🤖 AI 服务商集成
- ✅ MiniMax（海螺AI）
- ✅ 豆包 (Doubao)
- ✅ 即梦 (Jimeng)
- ✅ Vidu
- ✅ Seedream
- ✅ OpenAI 兼容接口
- ✅ 负载均衡和故障转移

### 📊 内容管理
- ✅ 漫剧脚本管理
- ✅ 角色库管理
- ✅ 内容版本控制（Enterprise）
- ✅ 审核工作流（Enterprise）
- ✅ 内容发布计划（Enterprise）

### 🔒 安全与审计
- ✅ 企业级审计日志（Enterprise）
- ✅ 操作日志追踪
- ✅ IP 和 User-Agent 记录
- ✅ 日志归档和导出
- ✅ 合规报告生成
- ✅ 数据脱敏

### 📈 监控与告警
- ✅ 实时系统监控
- ✅ 性能指标追踪
- ✅ 告警系统
- ✅ 健康检查
- ✅ Prometheus 指标

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- 数据库: SQLite (开发) / PostgreSQL (生产)

### 安装步骤

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置数据库和其他参数

# 4. 初始化数据库
npx prisma generate
npx prisma db push

# 5. 初始化数据
npm run init:admin          # 创建管理员账号
npm run init:memberships    # 初始化会员套餐
npm run init:providers      # 初始化 AI 服务商配置
npm run init:system-config  # 初始化系统配置

# 6. 启动开发服务器
npm run dev

# 7. 访问管理后台
# http://localhost:3001/admin
```

### 企业功能初始化

```bash
# 初始化企业级功能（审计、权限、版本控制等）
npx tsx scripts/init-enterprise-features.ts
```

---

## 📁 项目结构

```
backend/
├── src/
│   ├── config/              # 配置文件
│   │   └── app.ts          # Express 应用配置
│   ├── controllers/         # 控制器
│   ├── lib/                # 库文件
│   │   └── prisma.ts      # Prisma 客户端
│   ├── middleware/         # 中间件
│   │   ├── auth.ts        # 认证中间件
│   │   ├── errorHandler.ts # 错误处理
│   │   ├── rateLimiter.ts # 限流器
│   │   └── requestLogger.ts # 请求日志
│   ├── routes/             # 路由
│   │   ├── admin/         # 管理后台路由
│   │   │   ├── notifications.ts
│   │   │   └── ...
│   │   ├── v1/            # API v1 路由
│   │   └── ...
│   ├── services/           # 业务服务
│   │   ├── admin-service.ts
│   │   ├── membership-service.ts
│   │   ├── payment-service.ts
│   │   ├── points-service.ts
│   │   ├── quota-service.ts
│   │   ├── permission-service.ts
│   │   ├── audit-service.ts
│   │   ├── enhanced-audit-service.ts       # ✨ Enterprise
│   │   ├── advanced-permission-service.ts   # ✨ Enterprise
│   │   ├── content-version-service.ts       # ✨ Enterprise
│   │   ├── review-workflow-service.ts       # ✨ Enterprise
│   │   └── ...
│   ├── types/             # 类型定义
│   ├── utils/             # 工具函数
│   └── index.ts           # 应用入口
├── prisma/
│   ├── schema.prisma     # 数据库模型
│   └── dev.db            # SQLite 数据库
├── scripts/               # 脚本
│   ├── init-admin.ts
│   ├── init-memberships.ts
│   ├── init-enterprise-features.ts         # ✨ Enterprise
│   └── ...
├── package.json
├── tsconfig.json
└── .env
```

---

## 🎯 API 文档

### 认证 API
```
POST /api/v1/auth/register     # 用户注册
POST /api/v1/auth/login        # 用户登录
POST /api/v1/auth/refresh       # 刷新 Token
POST /api/v1/auth/logout       # 退出登录
```

### 用户 API
```
GET    /api/v1/users           # 获取用户列表
GET    /api/v1/users/:id       # 获取用户详情
PUT    /api/v1/users/:id       # 更新用户
DELETE /api/v1/users/:id       # 删除用户
```

### 会员 API
```
GET    /api/v1/memberships      # 获取会员套餐
POST   /api/v1/memberships/order # 创建订单
POST   /api/v1/payments/callback # 支付回调
```

### AI 服务 API
```
POST   /api/v1/ai/generate      # AI 生成
GET    /api/v1/ai/models       # 获取可用模型
GET    /api/v1/ai/providers    # 获取服务商
```

### 管理后台 API

#### 用户管理
```
GET    /api/v1/admin/users      # 用户列表
PUT    /api/v1/admin/users/:id # 更新用户
DELETE /api/v1/admin/users/:id # 删除用户
```

#### 会员管理
```
GET    /api/v1/admin/memberships    # 会员列表
POST   /api/v1/admin/memberships    # 创建套餐
PUT    /api/v1/admin/memberships/:id # 更新套餐
```

#### 订单管理
```
GET    /api/v1/admin/payments      # 订单列表
POST   /api/v1/admin/payments/:id/refund # 退款
```

#### AI 服务商管理
```
GET    /api/v1/admin/providers     # 服务商列表
POST   /api/v1/admin/providers     # 添加服务商
PUT    /api/v1/admin/providers/:id # 更新服务商
```

#### 积分管理
```
GET    /api/v1/admin/points        # 积分记录
POST   /api/v1/admin/points/grant # 赠送积分
```

### ✨ Enterprise API

#### 审计日志
```
GET    /api/v1/audit/logs          # 查询日志
GET    /api/v1/audit/statistics   # 统计数据
GET    /api/v1/audit/report       # 生成报告
GET    /api/v1/audit/export      # 导出日志
```

#### 权限管理
```
GET    /api/v1/permissions/role/:role       # 获取角色权限
PUT    /api/v1/permissions/role/:role        # 更新角色权限
GET    /api/v1/permissions/templates        # 权限模板
POST   /api/v1/permissions/templates        # 创建模板
POST   /api/v1/permissions/fields           # 设置字段权限
POST   /api/v1/permissions/check            # 权限检查
```

#### 内容版本
```
POST   /api/v1/versions                     # 创建版本
GET    /api/v1/versions/:contentType/:id    # 版本列表
GET    /api/v1/versions/:contentType/:id/:version # 版本详情
POST   /api/v1/versions/:contentType/:id/:version/rollback # 回滚
```

#### 审核工作流
```
GET    /api/v1/workflows/templates           # 工作流模板
POST   /api/v1/workflows                   # 创建工作流
GET    /api/v1/workflows/:id               # 工作流详情
POST   /api/v1/workflows/:id/approve      # 审核通过
POST   /api/v1/workflows/:id/reject        # 审核拒绝
GET    /api/v1/workflows/tasks/user/:id    # 用户任务
```

#### 系统监控
```
GET    /api/v1/stability/metrics           # 实时指标
GET    /api/v1/stability/report            # 系统报告
GET    /api/v1/stability/history           # 历史数据
GET    /api/v1/stability/alerts/config     # 告警配置
PUT    /api/v1/stability/alerts/config     # 更新配置
```

---

## 🔧 配置说明

### 环境变量 (.env)

```env
# 应用配置
NODE_ENV=development
PORT=3001

# 数据库
DATABASE_URL="file:./prisma/dev.db"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# 加密
ENCRYPTION_KEY=your-encryption-key

# AI 服务商
ARK_API_KEY=your-ark-api-key
MINIMAX_API_KEY=your-minimax-key
# ...

# 存储
MINIO_ENDPOINT=localhost
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key

# Redis
REDIS_URL=redis://localhost:6379

# 邮件
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email
EMAIL_PASSWORD=your-password

# 支付
ALIPAY_APP_ID=your-app-id
WECHAT_APP_ID=your-app-id
```

---

## 📊 数据库模型

### 核心表 (30+)
- `users` - 用户表
- `memberships` - 会员套餐
- `user_memberships` - 用户会员关系
- `payment_logs` - 支付日志
- `points_transactions` - 积分交易
- `quota_transactions` - 配额交易
- `tasks` - 任务记录
- `provider_configs` - AI 服务商配置
- `system_configs` - 系统配置
- `operation_logs` - 操作日志

### ✨ Enterprise 表
- `enhanced_audit_logs` - 增强审计日志
- `audit_archives` - 审计归档
- `permission_templates` - 权限模板
- `field_permissions` - 字段权限
- `permission_groups` - 权限组
- `role_permissions` - 角色权限
- `content_versions` - 内容版本
- `review_workflow_templates` - 工作流模板
- `review_workflows` - 工作流实例
- `review_tasks` - 审核任务
- `review_comments` - 审核评论
- `content_schedules` - 发布计划
- `content_releases` - 内容发布
- `sso_configs` - SSO 配置
- `sso_sessions` - SSO 会话

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --testPathPattern=auth

# 覆盖率报告
npm run test:coverage
```

---

## 🚢 部署

### Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

RUN npx prisma generate
RUN npx prisma migrate deploy

EXPOSE 3001
CMD ["npm", "start"]
```

### PM2 部署

```bash
# 构建
npm run build

# 启动
pm2 start dist/index.js --name backend

# 监控
pm2 monit

# 日志
pm2 logs backend
```

---

## 📈 性能优化

### 数据库优化
- ✅ 适当的索引设计
- ✅ 查询分页
- ✅ 连接池管理

### 缓存策略
- ✅ Redis 缓存
- ✅ 权限缓存（5分钟 TTL）
- ✅ 配置缓存

### API 优化
- ✅ 响应压缩
- ✅ 请求限流
- ✅ 异步处理

---

## 🔒 安全特性

- ✅ JWT 认证
- ✅ 密码加密 (bcrypt)
- ✅ CORS 配置
- ✅ Helmet 安全头
- ✅ 请求限流
- ✅ SQL 注入防护
- ✅ XSS 防护
- ✅ CSRF 防护
- ✅ 敏感信息加密
- ✅ 审计日志追踪

---

## 📝 开发指南

### 代码规范
- ✅ TypeScript 严格模式
- ✅ ESLint 代码检查
- ✅ Prettier 代码格式化
- ✅ 命名规范（camelCase）

### Git 工作流
```
feature/xxx -> develop -> main
```

### 代码审查
1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 Pull Request
5. 代码审查
6. 合并到主分支

---

## 📚 文档

- [详细实施报告](./ENTERPRISE_IMPLEMENTATION_REPORT.md) - ✨ Enterprise 功能详情
- [快速开始指南](./ENTERPRISE_FEATURES_QUICKSTART.md) - ✨ Enterprise 功能使用
- [Strapi 对比报告](./STRAPI_PROFESSIONAL_COMPARISON.md) - 功能对比分析
- [后端对比报告](./BACKEND_COMPARISON_REPORT.md) - 与旧版对比
- [管理后台功能](./ADMIN_BACKEND_FEATURES.md) - 功能清单
- [系统设置文档](./ADMIN_SYSTEM_SETTINGS.md) - 配置说明

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 📞 联系方式

- 项目主页: https://github.com/your-repo
- 问题反馈: https://github.com/your-repo/issues
- 文档: https://docs.example.com

---

## 🙏 致谢

- [Express](https://expressjs.com/) - Web 框架
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [TypeScript](https://www.typescriptlang.org/) - 类型系统
- [Strapi](https://strapi.io/) - 功能参考
- 所有开源贡献者

---

**最后更新**: 2026-04-17  
**版本**: v2.7.9  
**状态**: ✅ 生产就绪
