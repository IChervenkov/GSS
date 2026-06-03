// @ts-nocheck
require('../../scripts/register-typescript.ts');

const http = require('http');
const env = require('../core/config/env');
const { createApp } = require('../app/create-app');
const { runMigrations } = require('../infrastructure/db/migrations/migrate');
const {
  startMaintenanceScheduler,
} = require('../infrastructure/maintenance/maintenance-scheduler');
const { markShuttingDown } = require('../shared/runtime/lifecycle');
const { createRuntimeDependencies } = require('./runtime-dependencies');

const runtime = createRuntimeDependencies(env);
const { logger, pool, metrics, socketRuntime } = runtime;

logger.info('startup_config_summary', env.startupSummary);

async function startServer() {
  await runtime.initializeRedisInfrastructure?.();

  if (env.DB_RUN_MIGRATIONS_ON_BOOT) {
    await runMigrations({
      logger,
      env,
      executionMode: 'startup',
      gateToken: env.DB_MIGRATION_GATE_TOKEN,
      releaseId: env.DB_MIGRATION_RELEASE_ID,
      appliedBy: env.DB_MIGRATION_APPLIED_BY || 'runtime-boot',
    });
  }

  const { app, attach } = createApp(runtime);
  const sessionMiddleware = await runtime.createSessionMiddleware();
  const server = http.createServer(app);
  const sockets = new Set();
  const io = await socketRuntime.createSocket(server, sessionMiddleware);

  logger.info('startup_backend_modes', {
    sessionBackendMode: sessionMiddleware.backendMode || 'unknown',
    socketAdapterMode: socketRuntime.getAdapterMode?.() || 'unknown',
    rateLimitBackendMode: runtime.rateLimitStore?.backendMode || 'unknown',
  });

  attach({ sessionMiddleware });

  server.keepAliveTimeout = env.KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = env.HEADERS_TIMEOUT_MS;

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve) => {
    server.listen(env.PORT, () => {
      logger.info('server_started', { port: env.PORT, nodeEnv: env.NODE_ENV });
      resolve();
    });
  });

  if (env.DB_RUN_MAINTENANCE_ON_BOOT) {
    setTimeout(() => {
      void runtime.runDatabaseMaintenance().catch((error) => {
        logger.error('db_maintenance_bootstrap_failed', {
          errorMessage: error?.message,
          stack: env.isProd ? undefined : error?.stack,
        });
      });
    }, env.DB_MAINTENANCE_INITIAL_DELAY_MS).unref?.();
  }

  const maintenanceScheduler = startMaintenanceScheduler({
    intervalMs: env.DB_MAINTENANCE_INTERVAL_MS,
    initialDelayMs: env.DB_MAINTENANCE_INITIAL_DELAY_MS,
    logger,
    metrics,
    runJob: () => runtime.runDatabaseMaintenance(),
  });

  let shutdownStarted = false;
  const shutdown = (signal) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    markShuttingDown(signal);
    logger.info('server_shutdown_started', { signal });

    maintenanceScheduler.stop();
    io.close();

    server.close(async () => {
      await pool.end().catch(() => {});
      logger.info('server_shutdown_completed', { signal });
      process.exit(0);
    });

    setTimeout(() => {
      for (const socket of sockets) {
        socket.end();
        socket.destroy();
      }
    }, env.CONNECTION_DRAIN_TIMEOUT_MS).unref();

    setTimeout(() => {
      logger.error('server_shutdown_forced', {
        signal,
        timeoutMs: env.GRACEFUL_SHUTDOWN_TIMEOUT_MS,
      });
      process.exit(1);
    }, env.GRACEFUL_SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return { app, server, io };
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.fatal('server_start_failed', {
      errorMessage: err?.message,
      stack: env.isProd ? undefined : err?.stack,
    });
    process.exit(1);
  });
}

module.exports = { startServer };
