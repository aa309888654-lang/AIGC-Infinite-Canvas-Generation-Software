# P1 修复 #14：多阶段 Dockerfile - 小天 AICG Studio 后端
# 目标：最小化生产镜像体积，不包含 devDependencies / 源码 / tsx

# ---------- Stage 1: base ----------
FROM node:20-alpine AS base
WORKDIR /app
# 安装必要原生依赖（ffmpeg 用于音视频处理）
RUN apk add --no-cache ffmpeg openssl
ENV NODE_ENV=production

# ---------- Stage 2: deps ----------
FROM base AS deps
# 仅复制依赖清单，利用 Docker 层缓存
COPY package*.json ./
COPY prisma ./prisma
# 安装生产依赖并生成 Prisma Client（不含 devDependencies）
RUN npm ci --omit=dev && \
    npx prisma generate

# ---------- Stage 3: builder ----------
FROM base AS builder
COPY package*.json ./
COPY prisma ./prisma
# builder 阶段需要 devDependencies 来执行 tsc
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
# 编译 TypeScript -> dist
RUN npm run build
# 复制运行时需要的非 TS 资源（providers.json 在 build 脚本中已处理，这里兜底）
RUN if [ -f src/services/promptSmart3/providers.json ]; then \
      mkdir -p dist/services/promptSmart3 && \
      cp src/services/promptSmart3/providers.json dist/services/promptSmart3/providers.json; \
    fi

# ---------- Stage 4: runner ----------
FROM base AS runner
# 创建非 root 用户运行应用
RUN addgroup -S app && adduser -S app -G app
# 从 deps 阶段复制 node_modules + prisma client
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
# 从 builder 阶段复制编译产物
COPY --from=builder /app/dist ./dist
# 复制运行时配置文件
COPY package*.json ./
COPY ecosystem.config.js ./

# 创建数据/日志目录并授权
RUN mkdir -p uploads logs && chown -R app:app /app
USER app

EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3200/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# 生产环境使用 PM2 单实例 fork 模式（SQLite 已被禁用，需配置 PostgreSQL）
CMD ["node", "dist/index.js"]
