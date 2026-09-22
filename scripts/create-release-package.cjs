const fs = require('fs');
const path = require('path');

const workspace = path.resolve(__dirname, '..');
const sourceDist = path.join(workspace, 'web', 'dist');
const releaseDir = path.join(workspace, '发布版本');

function removeIfExists(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(sourcePath, destinationPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, destinationPath);
  }
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

function writeText(name, content) {
  fs.writeFileSync(path.join(releaseDir, name), content.trimStart() + '\n', 'utf8');
}

if (!fs.existsSync(sourceDist)) {
  throw new Error(`找不到构建目录: ${sourceDist}`);
}

removeIfExists(releaseDir);
fs.mkdirSync(releaseDir, { recursive: true });
copyTree(sourceDist, releaseDir);

// Do not ship source maps, environment files, or build caches.
for (const file of walk(releaseDir)) {
  if (/\.(map|tsbuildinfo)$/i.test(file) || path.basename(file).startsWith('.env')) {
    fs.rmSync(file, { force: true });
  }
}

writeText('LICENSE-COMMERCIAL.md', `
# 小天画布商业授权说明

版权所有：xtaicg.com / aicgxt.com

## 个人免费商用

个人开发者、个人创作者和非公司主体可以免费使用本项目进行商业创作、发布和获利。

## 公司商用授权

公司、企业、工作室、机构或代表公司开展业务的组织，须在生产环境商用前取得书面商业授权。授权范围、部署数量、品牌标识和技术支持以双方签署的授权协议为准。

## 开源与限制

本发布包仅包含生产构建产物，不包含源代码。不得移除或遮挡产品标识、版权声明、构建完整性标记，不得将本发布包转售、再分发为独立软件或用于提供未授权的托管服务。

第三方依赖仍受其各自许可证约束；使用者应自行审核模型、素材、字体和生成内容的第三方权利。

## 安全边界

浏览器端代码可以被终端用户检查，任何前端混淆都不能保证“无法破解”。API 密钥、授权私钥和 AES-256 密钥不得放入前端发布包，应仅配置在服务端环境变量或密钥管理系统中。
`);

writeText('SECURITY-DEPLOYMENT.md', `
# 部署安全要求

1. 服务端必须设置随机的 32 字节 ENCRYPTION_KEY（64 位十六进制），并通过环境变量或密钥管理系统注入。
2. 不要把 .env、API Key、JWT Secret、数据库密码或授权私钥复制到本目录或静态资源目录。
3. 生产环境使用 HTTPS、严格的 CSP、最小权限数据库账号，并限制管理接口网络访问。
4. AES-256-GCM 只用于服务端敏感数据加密，密钥不得进入前端发布包。
`);

writeText('README-RELEASE.md', `
# 发布版本

这是小天画布的生产前端构建包，已完成 Vite 生产压缩、Terser 二次混淆和源码映射移除。

- 个人主体：免费商用
- 公司/企业主体：需要商业授权
- 商业授权与安全要求：见 LICENSE-COMMERCIAL.md 和 SECURITY-DEPLOYMENT.md
`);

const files = walk(releaseDir).sort();

console.log(`发布版本已生成: ${releaseDir}`);
console.log(`文件数: ${files.length}`);
