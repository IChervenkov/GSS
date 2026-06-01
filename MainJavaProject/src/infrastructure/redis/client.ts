const env = require('../../core/config/env');
const { createLogger } = require('../logging/logger');
const { metrics } = require('../../shared/observability/metrics');

const logger = createLogger({ level: env.LOG_LEVEL, service: env.APP_NAME }).child({
  component: 'redis',
});

let redisLib = null;
try {
  redisLib = require('redis');
} catch {
  redisLib = null;
}

let clientPromise = null;
let redisState = { configured: false, connected: false, lastError: null };

function syncRedisMetrics() {
  metrics.gaugeSet(
    'gss_dependency_readiness',
    { dependency: 'redis' },
    redisState.connected ? 1 : 0,
  );
}

function isRedisConfigured(config = env) {
  return Boolean(config.REDIS_HOST && config.REDIS_PORT);
}

function isRedisMandatory(config = env) {
  return Boolean(config?.REDIS_REQUIRED || config?.isProdLike);
}

function getRedisState() {
  return { ...redisState };
}

async function getRedisClient(config = env) {
  redisState.configured = isRedisConfigured(config);
  syncRedisMetrics();

  if (!redisLib) {
    if (isRedisMandatory(config) || isRedisConfigured(config)) {
      throw new Error('Redis support is required but the "redis" package is not installed.');
    }
    return null;
  }

  if (!isRedisConfigured(config)) {
    if (isRedisMandatory(config)) {
      throw new Error(
        'REDIS_HOST and REDIS_PORT are required when Redis-backed infrastructure is mandatory.',
      );
    }
    return null;
  }

  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const client = redisLib.createClient({
      socket: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        keepAlive: true,
      },
    });

    client.on('error', (err) => {
      redisState = {
        configured: true,
        connected: false,
        lastError: err?.message || 'Redis client error',
      };
      metrics.counter('gss_redis_errors_total');
      syncRedisMetrics();
      logger.error('redis_client_error', {
        errorMessage: err?.message,
        stack: config.isProd ? undefined : err?.stack,
      });
    });

    client.on?.('end', () => {
      redisState = { ...redisState, connected: false };
      syncRedisMetrics();
      logger.warn('redis_client_disconnected');
    });

    client.on?.('reconnecting', () => {
      metrics.counter('gss_redis_reconnects_total');
      logger.warn('redis_client_reconnecting');
    });

    if (!client.isOpen) {
      await client.connect();
    }

    redisState = { configured: true, connected: true, lastError: null };
    syncRedisMetrics();
    logger.info('redis_client_connected', { host: config.REDIS_HOST, port: config.REDIS_PORT });
    return client;
  })().catch((error) => {
    clientPromise = null;
    redisState = {
      configured: true,
      connected: false,
      lastError: error?.message || 'Redis connect failed',
    };
    syncRedisMetrics();
    throw error;
  });

  return clientPromise;
}

module.exports = {
  getRedisClient,
  getRedisState,
  isRedisConfigured,
  isRedisMandatory,
};
