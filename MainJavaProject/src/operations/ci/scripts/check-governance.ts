const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const repoRoot = process.cwd();
const modulesRoot = path.join(repoRoot, 'src', 'modules');
const opsRoot = path.join(repoRoot, 'src', 'operations');

const requiredAdrFiles = [
  '0001-auth-session-model.md',
  '0002-realtime-model.md',
  '0003-permission-model.md',
  '0004-deployment-topology.md',
];

const requiredRunbookFiles = [
  'auth-incident-runbook.md',
  'redis-outage-runbook.md',
  'db-failover-restore-runbook.md',
  'deployment-rollback-runbook.md',
];

function assertExists(relativePath, errors) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

function listLeafModuleDirs(baseDir) {
  const leafDirs = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const childDirs = entries.filter((entry) => entry.isDirectory());
    const hasModuleFile = entries.some((entry) => entry.isFile() && entry.name.endsWith('.module.ts'));

    if (hasModuleFile) {
      leafDirs.push(currentDir);
      return;
    }

    for (const entry of childDirs) {
      walk(path.join(currentDir, entry.name));
    }
  }

  if (fs.existsSync(baseDir)) {
    walk(baseDir);
  }

  return leafDirs;
}

function main() {
  const errors = [];

  assertExists('.github/pull_request_template.md', errors);
  assertExists('src/operations/README.md', errors);
  assertExists('src/operations/ownership/README.md', errors);
  assertExists('src/operations/alerts/alert-catalog.yml', errors);

  for (const fileName of requiredAdrFiles) {
    assertExists(path.join('src', 'operations', 'adrs', fileName), errors);
  }

  for (const fileName of requiredRunbookFiles) {
    assertExists(path.join('src', 'operations', 'runbooks', fileName), errors);
  }

  for (const moduleDir of listLeafModuleDirs(modulesRoot)) {
    const ownershipPath = path.join(moduleDir, 'OWNERSHIP.md');
    if (!fs.existsSync(ownershipPath)) {
      errors.push(`Missing OWNERSHIP.md for module: ${path.relative(repoRoot, moduleDir)}`);
      continue;
    }

    const ownershipContent = fs.readFileSync(ownershipPath, 'utf8');
    const requiredSections = [
      'Primary owner',
      'Secondary owner',
      'Scope',
      'Critical dependencies',
      'Critical user flows',
      'Change risks',
      'Minimum review requirement',
      'Operational dashboards / alerts to watch',
      'Runbooks linked',
    ];

    for (const section of requiredSections) {
      if (!ownershipContent.includes(section)) {
        errors.push(
          `OWNERSHIP.md is missing section "${section}" in module: ${path.relative(repoRoot, moduleDir)}`
        );
      }
    }
  }

  if (errors.length > 0) {
    process.stderr.write('Governance validation failed:\n\n');
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exit(1);
  }

  process.stdout.write('Governance validation passed.\n');
}

main();
