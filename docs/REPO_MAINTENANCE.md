# 仓库长期维护说明

本文件说明这个 GitHub 仓库平时的维护方式。核心原则：**持续更新，不按版本号发布**。这一点也写在根目录的 `README.md` 和 `README.en.md` 里，README 是对外的唯一说明，本文件是对内的操作手册。

## 1. 分支与发布策略

- `main` 是唯一的长期分支，仓库默认分支也是它。
- 新功能、新模型适配、缺陷修复都直接推 `main`，时间间隔不固定，可能一天多笔，也可能几周没有动静。
- 不做语义化版本号，不打 release tag，不用 GitHub Releases 的版本列表，提交记录本身就是变更历史。
- 需要稳定快照的人自己打 tag 或 fork，仓库不提供。
- 推送方向是单向的：源项目到 GitHub，不从 GitHub 往回同步（见第 7 节的原因）。

## 2. 一条命令完成同步

在源项目根目录执行：

```powershell
node scripts/sync-github-release.cjs
```

脚本按顺序做四件事：重新生成发布包、把发布包镜像进一个可复用的 git 克隆、提交、推送 `main`。

常用参数：

- `--dry-run`：只跑打包和镜像比对，不提交不推送，用来先看一眼将要发生什么。
- `--no-push`：提交但不推送，适合网络不稳定时先落地本地镜像仓库。
- `--force`：跳过删除量保护（见第 4 节）。

也可以只生成发布包、不碰 git：

```powershell
node scripts/publish-github-release.cjs
```

## 3. 发布包含什么，不包含什么

进入发布包的只有 `scripts/publish-github-release.cjs` 里 `sourceFiles` 列表指定的内容：根目录构建配置、`src`、`public`、`server`、`docs`、`scripts`，以及 `web` 下仅剩的构建配置。

`web/` 目录只剩 vite、tailwind、electron 构建配置和少量脚本，那是历史副本。当前代码以 `src/` 和 `public/` 为准，`web/` 与它们重复，只保留构建需要的那几个文件。

明确排除的内容：`.env` 及任何真实密钥、数据库、日志、上传目录、`node_modules`、构建产物 `dist`、source map、本地会话目录。规则出处是 `docs/GITHUB_PUBLISH_RULES.md` 第 3 节。

## 4. 删除保护

镜像比对上万一不小心把整个目录漏打包，会造成大面积删除。脚本在提交前会统计删除量，满足任一条件就中止并要求确认：

- 删除文件数超过 500 个。
- 删除比例超过当前跟踪文件的 25%。

确认无误后加 `--force` 重跑。这不是阻碍正常维护，删除量大通常意味着打包配置写错了。

## 5. 体积策略

发布包按文件大小分三档处理：

- 50 MiB 以下：正常进包。
- 50 MiB 到 100 MiB：移到本地发布目录的 `_oversized/`，文件仍留在本地可取回，但不入 git 历史。清单记录在 `PUBLISH_MANIFEST.json` 的 `oversizedFiles` 字段。
- 100 MiB 以上：直接删除，清单记录在 `PUBLISH_MANIFEST.json` 的 `prunedFiles` 字段。

需要分发大体积演示素材时，挂到 GitHub Releases 附件或外链，不要塞进仓库。

仓库整体体积在 310 MB 量级，远低于 GitHub 的建议阈值，不需要做激进瘦身。

## 6. 刻意不用 Git LFS

`.gitattributes` 只把大体积素材标记为 `binary`，没有引入 Git LFS，原因有四个：

- 免费额度是 1 GB 存储加每月 1 GB 流量，演示视频放进去很快就会顶到上限。
- 每一次 clone 都要消耗额度流量，对匿名访客来说等于拉不到东西。
- LFS 在仓库里存的是指针文件，没有 LFS 客户端的人检出后拿到的是文本而不是真实素材，反而更难用。
- 需要完整素材的场景用 Releases 分发更直接，不会拖累日常代码 clone。

## 7. 两个关键注意事项

- 源项目目录 `D:\开源软件\国内7月` 的 git 状态是不完整的：`src/` 和 `public/` 是未跟踪目录，`origin/main` 的引用停在 `837b7b4`，而 GitHub 上的真实 `main` 已经推进到 `a528d90`。**绝对不要在那个目录执行 `git pull`**，未跟踪文件会被拒绝并打断正常工作流。同步只走 `scripts/sync-github-release.cjs` 一条路。
- `LICENSE` 和 `LICENSE-COMMERCIAL.md` 是两个不同的文件，内容不一样。同步脚本现在从源项目原样复制两份，早期版本会用 `LICENSE-COMMERCIAL.md` 覆盖 `LICENSE`，如果发现远程仓库的 `LICENSE` 内容变成商业授权条款，就是踩了这个坑，重跑一次同步即可修正。

## 8. 推送前自检

即使脚本已经自动跑过打包和构建，重大改动后仍然按 `docs/GITHUB_PUBLISH_RULES.md` 第 2 节人工确认一遍：

- `git status` 干净，没有密钥、数据库、上传内容被提交。
- `npm run build` 成功，产物里没有 `.map` 文件。
- 图片生成和视频生成入口能加载，模型配置路径没被改写。
- `git ls-files` 里没有超过 50 MiB 的单个文件，也没有 `_oversized/` 下的内容。

