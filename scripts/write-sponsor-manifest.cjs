const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', '发布版本');
const sponsorDir = path.join(root, 'sponsor');
if (!fs.existsSync(sponsorDir)) throw new Error(`赞助资源目录不存在: ${sponsorDir}`);

const files = fs.readdirSync(sponsorDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => {
    const file = path.join(sponsorDir, entry.name);
    return {
      path: `sponsor/${entry.name}`,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      bytes: fs.statSync(file).size,
    };
  });

fs.writeFileSync(
  path.join(root, 'sponsor-manifest.json'),
  `${JSON.stringify({ version: 1, purpose: '赞助支持资源，发布包必需', files }, null, 2)}\n`,
  'utf8'
);
console.log(`赞助资源清单已生成: ${files.length} 个文件`);
