const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../helpers/module-mocks');

test('server boot fails closed when Redis is required and unavailable', async () => {
  const logger = {
    info() {},
    error() {},
    fatal() {},
  };

  const { startServer } = requireFresh('src/bootstrap/server.ts', {
    'src/core/config/env.ts': {
      DB_RUN_MIGRATIONS_ON_BOOT: false,
      DB_RUN_MAINTENANCE_ON_BOOT: false,
      DB_MAINTENANCE_INTERVAL_MS: 60_000,
      KEEP_ALIVE_TIMEOUT_MS: 65_000,
      HEADERS_TIMEOUT_MS: 66_000,
      CONNECTION_DRAIN_TIMEOUT_MS: 15_000,
      GRACEFUL_SHUTDOWN_TIMEOUT_MS: 30_000,
      PORT: 0,
    },
    'src/app/create-app.ts': {
      createApp: () => ({
        app: { use() {}, set() {} },
        attach() {},
      }),
    },
    'src/infrastructure/db/migrations/migrate.ts': {
      runMigrations: async () => {},
    },
    'src/infrastructure/maintenance/maintenance-scheduler.ts': {
      startMaintenanceScheduler: () => ({ stop() {} }),
    },
    'src/shared/runtime/lifecycle.ts': {
      markShuttingDown() {},
    },
    'src/bootstrap/runtime-dependencies.ts': {
      createRuntimeDependencies: () => ({
        logger,
        pool: { end: async () => {} },
        metrics: {},
        rateLimitStore: { backendMode: 'redis' },
        socketRuntime: {
          async createSocket() {
            throw new Error('socket should not initialize when Redis preflight fails');
          },
          getAdapterMode() {
            return 'redis';
          },
        },
        async initializeRedisInfrastructure() {
          throw new Error('Redis is mandatory but unavailable');
        },
        async createSessionMiddleware() {
          throw new Error('session middleware should not initialize when Redis preflight fails');
        },
        async runDatabaseMaintenance() {},
      }),
    },
  });

  await assert.rejects(() => startServer(), /Redis is mandatory but unavailable/);
});
