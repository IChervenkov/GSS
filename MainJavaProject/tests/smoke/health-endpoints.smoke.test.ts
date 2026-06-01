const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { startServer, requestJson } = require('../helpers/http');
const { requireFresh } = require('../helpers/module-mocks');

function jsonRoute(pathname, handler) {
  const router = express.Router();
  router.get(pathname, handler);
  return router;
}

test('health and readiness endpoints return smoke-safe responses', async () => {
  const env = {
    API_RATE_LIMIT_WINDOW_MS: 60000,
    API_RATE_LIMIT_MAX: 100,
    API_SLOWDOWN_DELAY_AFTER: 20,
    API_SLOWDOWN_DELAY_MS: 100,
  };

  const { createApp } = requireFresh('src/app/create-app.ts', {
    'src/modules/web/base/base.routes.ts': {
      createWebBaseRouter: () => {
        const router = express.Router();
        router.get('/health/live', (req, res) => {
          if (req.headers.authorization !== 'Bearer health-token') {
            return res.status(401).json({ code: 'UNAUTHORIZED' });
          }
          return res.status(200).json({ status: 'ok' });
        });
        router.get('/health/ready', (req, res) => {
          if (req.headers.authorization !== 'Bearer health-token') {
            return res.status(401).json({ code: 'UNAUTHORIZED' });
          }
          return res.status(200).json({ ready: true, status: 'ready' });
        });
        return router;
      },
    },
    'src/modules/web/auth/auth.routes.ts': {
      createWebAuthRouter: () => express.Router(),
      createWebAuthPublicRouter: () => express.Router(),
      createWebAuthProtectedRouter: () => express.Router(),
    },
    'src/modules/api/auth/auth.routes.ts': {
      createApiAuthRouter: () => express.Router(),
    },
    'src/shared/http/api-jwt.ts': {
      createApiJwt: () => express.Router(),
    },
    'src/modules/web/accommodation/accommodation.routes.ts': {
      createWebAccommodationRouter: () => express.Router(),
    },
    'src/modules/web/assets/assets.routes.ts': {
      createWebAssetsRouter: () => express.Router(),
    },
    'src/modules/web/bicycles/bicycles.routes.ts': {
      createWebBicyclesRouter: () => express.Router(),
    },
    'src/modules/web/laundry/laundry.routes.ts': {
      createWebLaundryRouter: () => express.Router(),
    },
    'src/modules/web/main-page/main.routes.ts': {
      createWebMainRouter: () => express.Router(),
    },
    'src/core/config/security.ts': {
      applySecurity: () => {},
    },
    'src/core/config/csrf.ts': {
      csrfSynchronisedProtection: (_req, _res, next) => next(),
      attachCsrfToken: () => (_req, _res, next) => next(),
    },
    'src/shared/http/web-auth.ts': {
      requireWebAuth: () => (_req, _res, next) => next(),
    },
    'src/shared/http/not-found.ts': {
      notFound: (_req, res) => res.status(404).json({ code: 'NOT_FOUND' }),
    },
  });

  const { app, attach } = createApp({
    env,
    requestLoggerMiddleware: (_req, _res, next) => next(),
    errorHandler: (error, _req, res, _next) =>
      res.status(error?.status || 500).json({ error: error?.message || 'boom' }),
    modules: { web: { auth: {}, base: {} }, api: { auth: { repositories: { auth: {} } } } },
    rateLimitStore: new Map(),
  });

  attach({
    sessionMiddleware: (req, _res, next) => {
      req.session = {};
      next();
    },
  });

  const server = await startServer(app);
  try {
    const health = await requestJson(server.baseUrl, '/health/live', {
      headers: { Authorization: 'Bearer health-token' },
    });
    assert.equal(health.response.status, 200);
    assert.equal(health.body.status, 'ok');

    const ready = await requestJson(server.baseUrl, '/health/ready', {
      headers: { Authorization: 'Bearer health-token' },
    });
    assert.equal(ready.response.status, 200);
    assert.equal(ready.body.ready, true);

    const unauthorized = await requestJson(server.baseUrl, '/health/live');
    assert.equal(unauthorized.response.status, 401);
  } finally {
    await server.close();
  }
});
