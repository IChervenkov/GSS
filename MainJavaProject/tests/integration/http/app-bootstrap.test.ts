const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { requireFresh } = require('../../helpers/module-mocks');
const { startServer, requestJson } = require('../../helpers/http');

function createRouter(pathname, handler) {
  const router = express.Router();
  router.all(pathname, handler);
  return router;
}

test('app bootstrap mounts each web router once and parses JSON and urlencoded bodies', async () => {
  const factoryCalls = {
    accommodation: 0,
    assets: 0,
    bicycles: 0,
    laundry: 0,
  };

  const { createApp } = requireFresh('src/app/create-app.ts', {
    'src/core/config/security.ts': {
      applySecurity() {},
    },
    'src/core/config/csrf.ts': {
      csrfSynchronisedProtection: (_req, _res, next) => next(),
      attachCsrfToken: () => (_req, _res, next) => next(),
    },
    'src/infrastructure/logging/logger.ts': {
      createLogger: () => ({
        child() {
          return this;
        },
        info() {},
        warn() {},
        error() {},
      }),
      requestLogger: () => (_req, _res, next) => next(),
    },
    'src/modules/web/base/base.routes.ts': {
      createWebBaseRouter: () => createRouter('/healthz', (_req, res) => res.sendStatus(204)),
    },
    'src/modules/web/auth/auth.routes.ts': {
      createWebAuthPublicRouter: () =>
        createRouter('/login', (req, res) => {
          res.status(200).json({ body: req.body });
        }),
      createWebAuthProtectedRouter: () =>
        createRouter('/admin/ping', (_req, res) => res.status(200).json({ ok: true })),
      createWebAuthRouter: () => express.Router(),
    },
    'src/modules/web/accommodation/accommodation.routes.ts': {
      createWebAccommodationRouter: () => {
        factoryCalls.accommodation += 1;
        return createRouter('/accommodation/ping', (_req, res) =>
          res.status(200).json({ ok: true }),
        );
      },
    },
    'src/modules/web/assets/assets.routes.ts': {
      createWebAssetsRouter: () => {
        factoryCalls.assets += 1;
        return createRouter('/assets/ping', (_req, res) => res.status(200).json({ ok: true }));
      },
    },
    'src/modules/web/bicycles/bicycles.routes.ts': {
      createWebBicyclesRouter: () => {
        factoryCalls.bicycles += 1;
        return createRouter('/bicycles/ping', (_req, res) => res.status(200).json({ ok: true }));
      },
    },
    'src/modules/web/laundry/laundry.routes.ts': {
      createWebLaundryRouter: () => {
        factoryCalls.laundry += 1;
        return createRouter('/laundry/ping', (_req, res) => res.status(200).json({ ok: true }));
      },
    },
    'src/modules/web/main-page/main.routes.ts': {
      createWebMainRouter: () =>
        createRouter('/main/ping', (_req, res) => res.status(200).json({ ok: true })),
    },
    'src/modules/api/auth/auth.routes.ts': {
      createApiAuthRouter: () =>
        createRouter('/token', (_req, res) => res.status(200).json({ ok: true })),
    },
    'src/shared/http/api-jwt.ts': {
      createApiJwt: () =>
        createRouter('/jwt/ping', (_req, res) => res.status(200).json({ ok: true })),
    },
  });

  const env = {
    LOG_LEVEL: 'silent',
    APP_NAME: 'gss-test',
    API_RATE_LIMIT_WINDOW_MS: 60_000,
    API_RATE_LIMIT_MAX: 20,
    API_SLOWDOWN_DELAY_AFTER: 10,
    API_SLOWDOWN_DELAY_MS: 1,
  };

  const { app, attach } = createApp({
    env,
    requestLoggerMiddleware: (_req, _res, next) => next(),
    errorHandler: (error, _req, res, _next) => {
      res.status(error.status || 500).json({ code: error.code || 'INTERNAL_ERROR' });
    },
    rateLimitStore: {
      async get() {
        return { hits: [], blockedUntil: 0 };
      },
      async hit() {
        return { hits: [] };
      },
      async block() {},
    },
    modules: {
      api: {
        auth: {},
      },
      web: {
        accommodation: {},
        assets: {},
        auth: {},
        base: {},
        bicycles: {},
        laundry: {},
        main: {},
      },
    },
  });
  attach({
    sessionMiddleware: (req, _res, next) => {
      req.session = { userId: '11111111-1111-1111-1111-111111111111' };
      next();
    },
  });

  const server = await startServer(app);

  try {
    const jsonResult = await requestJson(server.baseUrl, '/web/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin' }),
    });

    const formResponse = await fetch(`${server.baseUrl}/web/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'username=operator&password=Secret123%21',
    });
    const formBody = await formResponse.json();

    const bicyclesResult = await requestJson(server.baseUrl, '/web/bicycles/ping');
    const assetsResult = await requestJson(server.baseUrl, '/web/assets/ping');

    assert.equal(jsonResult.response.status, 200);
    assert.deepEqual(jsonResult.body, { body: { username: 'admin' } });
    assert.equal(formResponse.status, 200);
    assert.deepEqual(formBody, {
      body: { username: 'operator', password: 'Secret123!' },
    });
    assert.equal(assetsResult.response.status, 200);
    assert.equal(bicyclesResult.response.status, 200);
    assert.deepEqual(factoryCalls, {
      accommodation: 1,
      assets: 1,
      bicycles: 1,
      laundry: 1,
    });
  } finally {
    await server.close();
  }
});
