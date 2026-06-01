const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const repoRoot = process.cwd();
const alertCatalogPath = path.join(repoRoot, 'src', 'operations', 'alerts', 'alert-catalog.yml');

function parseSimpleYamlObjects(text) {
  const lines = text.split(/\r?\n/);
  const alerts = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    if (line.startsWith('- ')) {
      if (current) alerts.push(current);
      current = {};
      const remainder = line.slice(2).trim();
      if (remainder) {
        const [key, ...rest] = remainder.split(':');
        current[key.trim()] = rest.join(':').trim().replace(/^"|"$/g, '');
      }
      continue;
    }

    if (!current) {
      continue;
    }

    const match = line.match(/^\s*([A-Za-z0-9_\-]+):\s*(.*)$/);
    if (match) {
      current[match[1]] = match[2].trim().replace(/^"|"$/g, '');
    }
  }

  if (current) alerts.push(current);
  return alerts;
}

function main() {
  if (!fs.existsSync(alertCatalogPath)) {
    process.stderr.write(`Missing alert catalog: ${path.relative(repoRoot, alertCatalogPath)}\n`);
    process.exit(1);
  }

  const alerts = parseSimpleYamlObjects(fs.readFileSync(alertCatalogPath, 'utf8'));
  const errors = [];

  if (alerts.length === 0) {
    errors.push('Alert catalog does not contain any alerts.');
  }

  for (const alert of alerts) {
    const name = alert.name || '<unnamed-alert>';
    const runbookPath = alert.runbook;
    const dashboard = alert.dashboard;
    const severity = alert.severity;

    if (!severity) {
      errors.push(`Alert ${name} is missing severity.`);
    }

    if (!dashboard) {
      errors.push(`Alert ${name} is missing dashboard.`);
    }

    if (!runbookPath) {
      errors.push(`Alert ${name} is missing runbook.`);
      continue;
    }

    const absoluteRunbookPath = path.join(repoRoot, runbookPath);
    if (!fs.existsSync(absoluteRunbookPath)) {
      errors.push(`Alert ${name} references missing runbook: ${runbookPath}`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write('Alert/runbook validation failed:\n\n');
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Alert/runbook validation passed for ${alerts.length} alerts.\n`);
}

main();
