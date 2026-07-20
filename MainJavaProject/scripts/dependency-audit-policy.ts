const { spawnSync } = require('child_process');

const npmExecPath = process.env.npm_execpath;
const auditCommand = npmExecPath ? process.execPath : process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
const auditArgs = npmExecPath
  ? [npmExecPath, 'audit', '--json']
  : process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm audit --json']
    : ['audit', '--json'];

const result = spawnSync(auditCommand, auditArgs, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.error) {
  process.stderr.write(`Could not run npm audit: ${result.error.message}\n`);
  process.exit(1);
}

if (!result.stdout && !result.stderr) {
  process.stderr.write('npm audit returned no output.\n');
  process.exit(result.status || 1);
}

let payload = null;
try {
  payload = JSON.parse(result.stdout || result.stderr);
} catch (error) {
  process.stderr.write('Could not parse npm audit output.\n');
  process.stderr.write(`${result.stdout || result.stderr}\n`);
  process.exit(1);
}

const vulnerabilities = payload.metadata?.vulnerabilities || {};
const counts = {
  critical: Number(vulnerabilities.critical || 0),
  high: Number(vulnerabilities.high || 0),
  moderate: Number(vulnerabilities.moderate || 0),
  low: Number(vulnerabilities.low || 0),
};

process.stdout.write(`Dependency audit summary: ${JSON.stringify(counts)}\n`);

if (counts.critical > 0 || counts.high > 0) {
  process.stderr.write('Dependency audit policy failed: no high or critical vulnerabilities are allowed.\n');
  process.exit(1);
}

process.stdout.write('Dependency audit policy passed.\n');
