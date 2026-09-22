# GitHub 发布规则

本文件是本项目后续所有 GitHub 发布的执行标准。发布工作目录固定为 `D:\开源软件\发布到GitHub`，由 `node scripts/publish-github-release.cjs` 生成。

## 1. 发布结构

每次发布必须生成以下目录：

- `源代码软件`：可审查、可构建的源码副本，不包含密钥、用户数据、依赖目录、缓存和历史构建产物。这是唯一上传到 GitHub 的内容。

同时生成 `PUBLISH_MANIFEST.json` 和本规则副本。

## 2. GitHub 专业说明要求

GitHub 根目录必须包含 README、许可证、部署说明、变更记录和安全政策。README 至少说明：项目用途（图片生成、视频生成）、本地构建命令、环境变量配置、API/模型供应商责任、许可证范围、第三方依赖许可证、已知安全边界和发布版本校验方法。

发布前必须检查：

1. `git status`，确认没有把密钥、数据库、上传文件或本地会话提交到仓库。
2. `npm run build` 成功，且生产构建无 `.map` 文件。
3. 图片生成、视频生成入口可加载，API 请求路径和模型配置未被改写。
4. 发布目录不包含真实密钥、数据库、日志、用户上传内容或示例视频文件。

## 3. 素材和文件清理

清理只针对发布副本，不得删除源项目文件。禁止发布：`.env`、私钥、API Key、JWT Secret、数据库、日志、上传目录、`.mimosa`、`.joycode`、`.zcode`、`node_modules`、缓存、测试快照和旧构建目录。静态素材使用引用可达性检查；运行时通过稳定路径加载的 `ai-models`、`models`、字体、品牌和生成工作流资源属于保护目录，不按静态字符串误删。

## 4. 不混淆与不加密

- 发布形态固定为源代码，前端和后端都不做变量混淆、字符串隐藏或压缩加密。
- 不再生成 AES-256-GCM 核心加密包；源码本身就是公开交付内容，密钥必须放在仓库之外。
- 浏览器端 JavaScript 必须在用户设备上执行，混淆只能提高逆向成本，不能替代服务端权限控制与密钥隔离，因此本项目的交付策略是开放源码、收紧服务端。
- 发布前必须确认 `npm run build` 成功，且交付副本中没有任何混淆产物或 source map。
- 若发现图片或视频功能异常，发布必须中止。

## 5. 发布命令

在源项目根目录执行：

```powershell
node scripts/publish-github-release.cjs
```

脚本会先执行一次 `npm run build` 校验源码可编译，再把源码复制到 `源代码软件`。
使用其他目录名时：

```powershell
$env:RELEASE_FOLDER_NAME = '源代码软件'
node scripts/publish-github-release.cjs
```

本地预览前端产物：

```powershell
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

## 6. GitHub 推送

发布脚本不自动猜测远程仓库，也不保存 GitHub Token。配置远程仓库并完成登录后再推送：

```powershell
git remote add origin https://github.com/<owner>/<repo>.git
git add .
git commit -m "chore: prepare GitHub release"
git push -u origin master
```

推送前必须人工复核 `git diff --cached --name-only` 和密钥扫描结果。若没有仓库地址或登录状态，脚本只能生成本地发布物，不能代表已经发布到 GitHub。
