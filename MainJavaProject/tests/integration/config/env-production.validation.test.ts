const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..', '..');

function runEnvWith(env) {
  return spawnSync(
    process.execPath,
    ['--require', './scripts/register-typescript.ts', '-e', "require('./src/core/config/env');"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...env,
      },
      encoding: 'utf8',
    },
  );
}

const baseEnv = {
  NODE_ENV: 'production',
  ENVIRONMENT_NAME: 'production',
  APP_NAME: 'GSS',
  APP_URL: 'https://example.com',
  SESSION_SECRET: 'x'.repeat(64),
  ACCESS_TOKEN_SECRET: 'y'.repeat(64),
  REFRESH_TOKEN_SECRET: 'z'.repeat(64),
  HASH_APP_BIKE: 'a'.repeat(64),
  HASH_APP_LAUNDRY: 'b'.repeat(64),
  HASH_APP_ASSET: 'c'.repeat(64),
  SECRET_NAME: 'GSS',
  DB_USER: 'gss',
  DB_HOST: '127.0.0.1',
  DB_NAME: 'gss',
  DB_PASSWORD: 'not-a-placeholder-password',
  DB_PORT: '5432',
  ADMIN_USERNAME: 'admin@example.com',
};

test('production env rejects placeholder secrets', () => {
  const result = runEnvWith({
    ...baseEnv,
    SESSION_SECRET: 'replace-me-session-secret',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SESSION_SECRET must be a real secret/i);
});

test('production env requires matching environment selectors', () => {
  const result = runEnvWith({
    ...baseEnv,
    ENVIRONMENT_NAME: 'staging',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NODE_ENV and ENVIRONMENT_NAME must refer to the same environment/i);
});
