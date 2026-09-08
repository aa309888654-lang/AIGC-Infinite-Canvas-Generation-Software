# 小天画布 开源版

纯前端 AI 创意工作台：**基础生图 + 生视频**（无限画布可选）

一个进程、一条命令即可启动前端创作工具。

## 特性

- **纯前端**：完全去掉后端，无需 Node.js 后端服务器
- **仅保留核心功能**：生图（Flux / 本地模型 / 自定义 API）、生视频（简单生成或上传视频）
- **无限画布**：可选节点式创作界面
- **本地优先**：所有模型 API Key 可在本地配置

## 快速开始

要求：Node.js >= 18

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 访问 http://localhost:5178
```

## 目录结构

```
├── package.json
├── web/              # 前端主目录（React + Vite + TS）
│   ├── src/          # 核心组件、画布、模型选择
│   ├── public/       # 图片、视频素材
│   └── vite.config.ts
```

## 技术栈

- 前端：React 19 + Vite + TypeScript + Tailwind CSS
- 无限画布：Konva.js / Fabric.js（可选）
- 模型：支持本地模型或公开 API（Flux、Vidu、豆包等）

## 授权说明

本项目采用 **Source-Available 商业授权**（详见 [LICENSE](./LICENSE) 和 [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md)）：

| 用途 | 状态 |
|---|---|
| 个人学习、研究、个人创作 | ✅ 免费 |
| 个人 / 非公司主体商用（含发布、获利、二次开发） | ✅ **个人免费商用** |
| 公司、企业、工作室、机构对外提供 SaaS / 产品 / 服务 | ⚠️ 需取得**书面商业授权** |

- 所有上传文件仅保存在本地，请自行备份。
- 第三方依赖、模型、字体、素材和生成内容受其各自许可证或权利约束，使用者需自行完成合规审核。

Enjoy open-source AI 画布！🚀
