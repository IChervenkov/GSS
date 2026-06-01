const test = require('node:test');
const assert = require('node:assert/strict');

const { createHealthMonitor } = require('../../../src/shared/observability/health');

test('readiness fails when Redis is mandatory but unavailable', async () => {
  const health = createHealthMonitor({
    env: {
      APP_NAME: 'gss-test',
      APP_VERSION: '1.0.0',
      APP_BUILD_SHA: '',
      APP_BUILD_TIME: '',
      NODE_ENV: 'staging',
      REDIS_REQUIRED: true,
      isProdLike: true,
    },
    metrics: {
      snapshot: () => ({ process: {} }),
    },
    pool: { query: async () => ({ rows: [{ now: 1 }] }) },
    getRedisClient: async () => { throw new Error('redis down'); },
    isRedisConfigured: () => true,
    isRedisMandatory: () => true,
    getLifecycle: () => ({ shuttingDown: false }),
  });

  const readiness = await health.getReadiness();

  assert.equal(readiness.ready, false);
  assert.equal(readiness.checks.redis.ok, false);
  assert.equal(readiness.checks.redis.required, true);
  assert.match(readiness.checks.redis.error, /redis down/i);
});
