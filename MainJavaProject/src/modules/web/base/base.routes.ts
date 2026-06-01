const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const { noCache } = require('../../../shared/http/no-cache');
const { buildApiErrorPayload } = require('../../../shared/http/error-response');
const { buildGetRoute } = require('../../../shared/http/route-builders');
const { createBaseModule } = require('./base.module');

function bearerToken(value = '') {
  const raw = String(value || '').trim();
  return raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
}

function requireOpsToken(expectedToken = '') {
  return (req, res, next) => {
    if (!expectedToken) return next();
    const token = bearerToken(req.headers.authorization || req.query.token || '');
    if (token === expectedToken) return next();
    return res.status(401).json(
      buildApiErrorPayload(
        {
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Observability endpoint requires a valid token.',
          details: [],
        },
        req,
        { isProd: true },
      ),
    );
  };
}

function createWebBaseRouter({ env, metrics, health, pool, getRedisState }) {
  const router = express.Router();
  const { controller } = createBaseModule();
  const noop204 = (_req, res) => res.status(204).end();

  if (!controller) {
    throw new AppError({ status: 500, message: 'Base controller not wired' });
  }

  buildGetRoute(router, '/', null, noCache, controller.basePage);
  buildGetRoute(router, '/favicon.ico', noop204);
  buildGetRoute(router, '/.well-known/appspecific/com.chrome.devtools.json', noop204);

  const metricsGuard = requireOpsToken(env.OBSERVABILITY_METRICS_AUTH_TOKEN);
  const healthGuard = requireOpsToken(env.OBSERVABILITY_HEALTH_AUTH_TOKEN);

  buildGetRoute(router, '/health/live', healthGuard, async (_req, res) => {
    const payload = await health.getSystemHealth();
    return res.status(200).json(payload);
  });

  buildGetRoute(router, '/health/ready', healthGuard, async (_req, res) => {
    const payload = await health.getReadiness();
    return res.status(payload.ready ? 200 : 503).json(payload);
  });

  buildGetRoute(router, '/health', healthGuard, async (_req, res) => {
    const [healthPayload, readiness] = await Promise.all([
      health.getSystemHealth(),
      health.getReadiness(),
    ]);
    return res.status(readiness.ready ? 200 : 503).json({ ...healthPayload, readiness });
  });

  buildGetRoute(router, '/metrics', metricsGuard, (_req, res) => {
    if (!env.OBSERVABILITY_METRICS_ENABLED) return res.status(404).end();
    metrics.gaugeSet('gss_dependency_readiness', { dependency: 'db' }, 1);
    metrics.gaugeSet('gss_db_pool_total_clients', {}, Number(pool.totalCount || 0));
    metrics.gaugeSet('gss_db_pool_idle_clients', {}, Number(pool.idleCount || 0));
    metrics.gaugeSet('gss_db_pool_waiting_clients', {}, Number(pool.waitingCount || 0));
    const redis = getRedisState();
    metrics.gaugeSet('gss_dependency_readiness', { dependency: 'redis' }, redis.connected ? 1 : 0);
    res.type('text/plain').send(metrics.toPrometheusText());
  });

  buildGetRoute(router, '/ops/alerts', metricsGuard, (_req, res) => {
    return res.status(200).json(health.getAlertTargets());
  });

  buildGetRoute(router, '/ops/dashboards', metricsGuard, (_req, res) => {
    return res.status(200).json(health.getDashboardCatalog());
  });

  return router;
}

module.exports = { createWebBaseRouter };
