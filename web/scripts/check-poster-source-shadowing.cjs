const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
const criticalFiles = [
  'services/enhanced-poster-pipeline',
  'services/poster-compositor',
  'services/poster-quality-checker',
  'services/poster-remote-quality-service',
  'services/poster-premium-workflow-types',
  'services/poster-task-client',
  'services/poster-agent-orchestrator',
  'services/poster-agent-schemas',
  'services/poster-native-text-policy',
  'pages/home-prompt/homePosterClient',
];

const shadows = criticalFiles.filter((relativePath) => (
  fs.existsSync(path.join(root, `${relativePath}.js`))
  && (fs.existsSync(path.join(root, `${relativePath}.ts`)) || fs.existsSync(path.join(root, `${relativePath}.tsx`)))
));

if (shadows.length) {
  console.error(`海报关键源码存在同名 JavaScript 旁路文件：\n${shadows.join('\n')}`);
  process.exit(1);
}

console.log(`Poster source shadowing check passed (${criticalFiles.length} critical modules).`);
