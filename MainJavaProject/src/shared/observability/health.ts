// @ts-nocheck
const { getLifecycleState } = require('../runtime/lifecycle');

function createHealthMonitor({
  env,
  metrics,
  pool,
  getRedisClient,
  isRedisConfigured,
  isRedisMandatory,
  getLifecycle = getLifecycleState,
} = {}) {
  async function getDbReadiness() {
    try {
      await pool.query('SELECT 1');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message };
    }
  }

  async function getRedisReadiness() {
    if (!isRedisConfigured?.(env)) {
      if (isRedisMandatory?.(env)) {
        return {
          ok: false,
          skipped: false,
          configured: false,
          required: true,
          error: 'Redis is mandatory in this environment but is not configured.',
        };
      }
      return { ok: true, skipped: true, configured: false, required: false };
    }

    try {
      const client = await getRedisClient?.(env);
      if (!client) return { ok: false, configured: true, required: isRedisMandatory?.(env), error: 'Redis client unavailable' };
      const pong = await client.ping();
      return { ok: pong === 'PONG', configured: true, required: isRedisMandatory?.(env), response: pong };
    } catch (error) {
      return { ok: false, configured: true, required: isRedisMandatory?.(env), error: error?.message };
    }
  }

  async function getSystemHealth() {
    const lifecycle = getLifecycle();
    return {
      status: 'ok',
      service: env.APP_NAME,
      now: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: env.APP_VERSION,
      build: {
        version: env.APP_VERSION,
        sha: env.APP_BUILD_SHA,
        time: env.APP_BUILD_TIME,
        environment: env.NODE_ENV,
      },
      metrics: metrics.snapshot().process,
      lifecycle,
    };
  }

  async function getReadiness() {
    const [db, redis] = await Promise.all([getDbReadiness(), getRedisReadiness()]);
    const lifecycle = getLifecycle();
    const ready = Boolean(db.ok && redis.ok && !lifecycle.shuttingDown);

    return {
      status: ready ? 'ready' : 'degraded',
      ready,
      service: env.APP_NAME,
      version: env.APP_VERSION,
      build: {
        version: env.APP_VERSION,
        sha: env.APP_BUILD_SHA,
        time: env.APP_BUILD_TIME,
        environment: env.NODE_ENV,
      },
      checks: { db, redis },
      lifecycle,
    };
  }

  function getAlertTargets() {
    return {
      repeated_500s: {
        metric: 'gss_http_error_total',
        labels: { class: '5xx' },
        suggest: 'Trigger when > 5 errors in 5 minutes per route.',
      },
      auth_spike_failures: {
        metric: 'gss_auth_failures_total',
        suggest: 'Trigger when invalid credentials or unauthorized errors spike above baseline.',
      },
      db_connection_exhaustion: {
        metric: 'gss_db_pool_waiting_clients',
        suggest: 'Trigger when waiting clients > 0 for sustained periods.',
      },
      redis_failure: {
        metric: 'gss_dependency_readiness',
        labels: { dependency: 'redis' },
        suggest: 'Trigger when readiness reports redis not ok.',
      },
      high_latency: {
        metric: 'gss_http_request_duration_ms',
        suggest: 'Trigger on p95 approximation or sustained max latency above SLO.',
      },
      socket_connection_instability: {
        metric: 'gss_socket_disconnects_total',
        suggest: 'Trigger when disconnects rise relative to connects.',
      },
    };
  }

  function getDashboardCatalog() {
    return {
      auth: [
        'sign-ins',
        '2fa verification',
        'refresh token rotation',
        'auth failures',
        'qr approval flow',
      ],
      traffic: [
        'requests per route',
        'request latency',
        'status code distribution',
        'top failing endpoints',
      ],
      system_errors: ['5xx by route/code', 'db failures', 'redis failures', 'job failures'],
      business_critical_actions: [
        'approval decisions',
        'password changes',
        'logout',
        'token refresh',
      ],
      websocket_activity: [
        'connections',
        'disconnects',
        'active sockets',
        'subscription changes',
        'emit validation failures',
      ],
    };
  }

  return {
    getSystemHealth,
    getReadiness,
    getAlertTargets,
    getDashboardCatalog,
  };
}

module.exports = { createHealthMonitor };
