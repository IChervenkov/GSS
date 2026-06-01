const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const allowedDirs = ['src', 'tests', 'scripts', '.github', 'ops', 'operations'];
const ignoredDirNames = new Set(['node_modules', '.git', 'coverage', 'dist', 'build']);
const ignoredExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.zip', '.sql']);
const patterns = [
  { name: 'private key', regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP)? ?PRIVATE KEY-----/ },
  { name: 'aws access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'github token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'generic hard-coded secret assignment', regex: /\b(?:secret|token|password|api[_-]?key)\b\s*[:=]\s*['"][^'"\n]{12,}['"]/i },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirNames.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (ignoredExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    files.push(fullPath);
  }
  return files;
}

const findings = [];
for (const name of allowedDirs) {
  const target = path.join(rootDir, name);
  if (!fs.existsSync(target)) continue;
  for (const file of walk(target)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        findings.push({ file: path.relative(rootDir, file), rule: pattern.name });
      }
    }
  }
}

if (findings.length) {
  process.stderr.write('Secret scan failed.\n');
  for (const finding of findings) {
    process.stderr.write(`- ${finding.file}: ${finding.rule}\n`);
  }
  process.exit(1);
}

process.stdout.write('Secret scan passed.\n');
