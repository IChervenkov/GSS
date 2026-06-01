const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  '.next',
  '.cache',
  'tmp',
  'temp',
  'reports',
  'lcov-report',
]);

const TEMPLATE_EXTENSIONS = new Set(['.ejs', '.html']);
const JS_EXTENSIONS = new Set(['.ts', '.mjs', '.cjs']);

function writeStdout(message) {
  process.stdout.write(`${message}\n`);
}

function writeStderr(message) {
  process.stderr.write(`${message}\n`);
}

function shouldSkip(fullPath) {
  const parts = fullPath.split(path.sep);
  return parts.some((part) => SKIP_DIRS.has(part));
}

function getAllFiles(dir, out = []) {
  if (shouldSkip(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (shouldSkip(full)) {
      continue;
    }

    if (entry.isDirectory()) {
      getAllFiles(full, out);
    } else {
      out.push(full);
    }
  }

  return out;
}

function fail(file, reason) {
  writeStderr(`CSP violation in: ${file}`);
  writeStderr(`Reason: ${reason}`);
  process.exit(1);
}

function scanTemplate(file) {
  const content = fs.readFileSync(file, 'utf8');

  const checks = [
    { pattern: /<[^>]+\sstyle=/i, reason: 'inline style attribute' },
    { pattern: /\son[a-z]+\s*=/i, reason: 'inline event handler' },
    { pattern: /<style\b/i, reason: 'inline <style> block' },
    {
      pattern: /<script\b(?![^>]*\bsrc=)(?![^>]*\bnonce=)/i,
      reason: 'inline <script> without src or nonce',
    },
    { pattern: /javascript:/i, reason: 'javascript: URL' },
  ];

  for (const check of checks) {
    if (check.pattern.test(content)) {
      fail(file, check.reason);
    }
  }
}

function scanJs(file) {
  const content = fs.readFileSync(file, 'utf8');

  const checks = [
    {
      pattern: /setAttribute\s*\(\s*['"]style['"]/,
      reason: "setAttribute('style', ...)",
    },
    {
      pattern: /\.style\.[a-zA-Z0-9_]+\s*=/,
      reason: 'direct inline style mutation',
    },
  ];

  for (const check of checks) {
    if (check.pattern.test(content)) {
      fail(file, check.reason);
    }
  }
}

const files = getAllFiles(ROOT);

for (const file of files) {
  const ext = path.extname(file).toLowerCase();

  if (TEMPLATE_EXTENSIONS.has(ext)) {
    scanTemplate(file);
    continue;
  }

  if (JS_EXTENSIONS.has(ext) && !file.includes(`${path.sep}scripts${path.sep}`)) {
    scanJs(file);
  }
}

writeStdout('CSP hygiene check passed');
