const fs = require('fs');
const path = require('path');

const sha =
  process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || process.env.APP_BUILD_SHA || 'local';
const payload = {
  APP_BUILD_SHA: sha,
  APP_BUILD_TIME: new Date().toISOString(),
  APP_VERSION: process.env.npm_package_version || '1.0.0',
};

const outputDir = path.join(process.cwd(), 'dist');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'build-info.json'), JSON.stringify(payload, null, 2));
process.stdout.write(JSON.stringify(payload) + '\n');
