const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const envModulePath = path.join(projectRoot, 'src/core/config/env.ts');

function buildBaseEnv(overrides = {}) {
  return {
    NODE_ENV: 'test',
    ENVIRONMENT_NAME: 'test',
    PORT: '3000',
    APP_NAME: 'GSS',
    APP_URL: 'http://localhost:3000',
    APP_VERSION: '1.0.0',
    APP_BUILD_SHA: 'test-sha',
    APP_BUILD_TIME: '2026-01-01T00:00:00.000Z',
    SESSION_SECRET: 's'.repeat(64),
    ACCESS_TOKEN_SECRET: 'a'.repeat(64),
    REFRESH_TOKEN_SECRET: 'r'.repeat(64),
    SESSION_SECRET_PREVIOUS: '',
    SECRET_NAME: 'GSS',
    ACCESS_TOKEN_EXPIRES_IN: '15',
    REFRESH_TOKEN_EXPIRES_IN: '14',
    DB_USER: 'gss',
    DB_HOST: 'localhost',
    DB_NAME: 'gss',
    DB_PASSWORD: 'db-password-that-is-real',
    DB_PORT: '5432',
    DATABASE_SSL: 'false',
    HASH_APP_BIKE: 'b'.repeat(64),
    HASH_APP_LAUNDRY: 'l'.repeat(64),
    HASH_APP_ASSET: 'x'.repeat(64),
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_REQUIRED: 'false',
    SESSION_REDIS_PREFIX: 'sess:',
    ADMIN_USERNAME: 'admin@example.com',
    OBSERVABILITY_METRICS_ENABLED: 'true',
    OBSERVABILITY_METRICS_AUTH_TOKEN: 'metrics-token-real-value',
    OBSERVABILITY_HEALTH_AUTH_TOKEN: 'health-token-real-value',
    ...overrides,
  };
}

function runEnvModule(overrides = {}) {
  const result = spawnSync(process.execPath, ['-e', `const env = require(${JSON.stringify(envModulePath)}); process.stdout.write(JSON.stringify(env.startupSummary));`], {
    cwd: projectRoot,
    env: {
      ...buildBaseEnv(overrides),
      NODE_PATH: path.join(projectRoot, 'node_modules'),
    },
    encoding: 'utf8',
  });
  return result;
}

test('env config rejects deprecated aliases', () => {
  const result = runEnvModule({ REDIS_URL: 'redis://localhost:6379' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /REDIS_URL is deprecated/i);
});

test('env config rejects mismatched NODE_ENV and ENVIRONMENT_NAME', () => {
  const result = runEnvModule({ NODE_ENV: 'staging', ENVIRONMENT_NAME: 'production', APP_URL: 'https://example.com' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NODE_ENV and ENVIRONMENT_NAME must refer to the same environment/i);
});

test('env config exposes safe startup summary only', () => {
  const result = runEnvModule({ DB_RUN_MIGRATIONS_ON_BOOT: 'true', ALLOW_RUNTIME_MIGRATIONS: 'true' });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout.trim());
  assert.deepEqual(summary, {
    environment: 'test',
    nodeEnv: 'test',
    version: '1.0.0',
    buildSha: 'test-sha',
    dbSslEnabled: false,
    redisEnabled: true,
    metricsEnabled: true,
    migrationsEnabled: true,
    maintenanceEnabled: true,
  });
});
