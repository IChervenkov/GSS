const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.cwd();
const TARGET_DIRS = ['src', 'tests', 'scripts'];
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

function collectJsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(absolute, acc);
      continue;
    }
    if (entry.isFile() && absolute.endsWith('.ts')) acc.push(absolute);
  }
  return acc;
}

function isFrontendModule(file) {
  return file.includes(`${path.sep}public${path.sep}js${path.sep}`);
}

const files = TARGET_DIRS.flatMap((dir) => collectJsFiles(path.join(ROOT, dir)));
const issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  if (!isFrontendModule(file)) {
    try {
      new vm.Script(content, { filename: file });
    } catch (error) {
      issues.push(`Syntax error in ${path.relative(ROOT, file)}: ${error.message}`);
    }
  }

  if (/\bconsole\.(log|debug|info|warn|error)\s*\(/.test(content)) {
    issues.push(`Console usage found in ${path.relative(ROOT, file)}.`);
  }
}

if (issues.length > 0) {
  process.stderr.write(`${issues.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Lint passed for ${files.length} files.\n`);
