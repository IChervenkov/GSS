#!/usr/bin/env node
const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
const requestedEnv = String(
  process.env.NODE_ENV || process.env.ENVIRONMENT_NAME || 'development',
).toLowerCase();
const normalizedEnv = requestedEnv === 'dev' ? 'development' : requestedEnv;
const isProduction = normalizedEnv === 'production';
const composeArgs = isProduction
  ? ['compose', '--profile', 'production', 'up', '--build', '-d', 'postgres', 'redis', 'app']
  : ['compose', 'up', '-d', 'postgres', 'redis'];
const runArgs = isProduction ? composeArgs : ['run', 'dev', ...args];

function spawnCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} ${commandArgs.join(' ')} failed with exit code ${code}`));
    });
  });
}

(async () => {
  await spawnCommand('docker', composeArgs);

  if (isProduction) {
    return;
  }

  await spawnCommand('npm', ['run', 'dev:server', ...args]);
})().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
