const fs = require('fs');
const path = require('path');

const PRESERVED_ENTRIES = new Set(['models']);

function cleanDistOutput(distDirectory) {
  if (!fs.existsSync(distDirectory)) return;

  for (const entry of fs.readdirSync(distDirectory)) {
    if (PRESERVED_ENTRIES.has(entry)) continue;

    fs.rmSync(path.join(distDirectory, entry), {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}

if (require.main === module) {
  cleanDistOutput(process.argv[2] || path.resolve(__dirname, '..', 'dist'));
}

module.exports = { cleanDistOutput };
