const express = require('express');
const path = require('path');
const ejs = require('ejs');

const { applySecurity } = require('../core/config/security');
const { csrfSynchronisedProtection, attachCsrfToken } = require('../core/config/csrf');
const { requireWebAuth } = require('../shared/http/web-auth');
const { notFound } = require('../shared/http/not-found');
const {
  createWebAuthRouter,
  createWebAuthPublicRouter,
  createWebAuthProtectedRouter,
} = require('../modules/web/auth/auth.routes');
const { createApiAuthRouter } = require('../modules/api/auth/auth.routes');
const { createApiBikeAppRouter } = require('../modules/api/bike-app/bike-app.routes');
const { createApiInventoryAppRouter } = require('../modules/api/inventory-app/inventory-app.routes');
const { createApiLaundryAppRouter } = require('../modules/api/laundry-app/laundry-app.routes');
const { createApiJwt } = require('../shared/http/api-jwt');
const { createWebBaseRouter } = require('../modules/web/base/base.routes');
const {
  createWebAccommodationRouter,
} = require('../modules/web/accommodation/accommodation.routes');
const { createWebAssetsRouter } = require('../modules/web/assets/assets.routes');
const { createWebBicyclesRouter } = require('../modules/web/bicycles/bicycles.routes');
const { createWebLaundryRouter } = require('../modules/web/laundry/laundry.routes');
const { createWebMainRouter } = require('../modules/web/main-page/main-page.routes');
const {
  createRateLimitMiddleware,
} = require('../shared/http/rate-limit');

const scriptStaticOptions = {
  setHeaders(res, filePath) {
    if (path.extname(filePath) === '.ts') {
      res.setHeader('Content-Type', 'text/javascript; charset=UTF-8');
    }
  },
};

function createApp({ env, requestLoggerMiddleware, errorHandler, modules, rateLimitStore }) {
  const app = express();
  const rootDir = path.resolve(__dirname, '../..');

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '250kb', extended: true }));
  applySecurity(app, { env });

  app.engine('ejs', (filePath, options, callback) => {
    ejs
      .renderFile(filePath, options, {
        async: true,
        views: app.get('views'),
        root: rootDir,
      })
      .then((html) => callback(null, html), callback);
  });
  app.set('view engine', 'ejs');
  app.set('views', [
    path.join(rootDir, 'src/shared/views'),
    path.join(rootDir, 'src/modules/web/auth/views'),
    path.join(rootDir, 'src/modules/web/accommodation/views'),
    path.join(rootDir, 'src/modules/web/assets/views'),
    path.join(rootDir, 'src/modules/web/bicycles/views'),
    path.join(rootDir, 'src/modules/web/laundry/views'),
    path.join(rootDir, 'src/modules/web/main-page/views'),
  ]);
  app.use(
    '/assets/shared',
    express.static(path.join(rootDir, 'src/shared/public'), scriptStaticOptions),
  );
  app.use(
    '/assets/auth',
    express.static(path.join(rootDir, 'src/modules/web/auth/public'), scriptStaticOptions),
  );
  app.use(
    '/assets/accommodation',
    express.static(path.join(rootDir, 'src/modules/web/accommodation/public'), scriptStaticOptions),
  );
  app.use(
    '/assets/assets',
    express.static(path.join(rootDir, 'src/modules/web/assets/public'), scriptStaticOptions),
  );
  app.use(
    '/assets/bicycles',
    express.static(path.join(rootDir, 'src/modules/web/bicycles/public'), scriptStaticOptions),
  );
  app.use(
    '/assets/laundry',
    express.static(path.join(rootDir, 'src/modules/web/laundry/public'), scriptStaticOptions),
  );
  app.use(
    '/assets/main',
    express.static(path.join(rootDir, 'src/modules/web/main-page/public'), scriptStaticOptions),
  );

  const apiBurstProtection = createRateLimitMiddleware({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    max: env.API_RATE_LIMIT_MAX,
    blockMs: env.API_RATE_LIMIT_WINDOW_MS,
    message: 'Too many API requests. Please slow down.',
    store: rateLimitStore,
  });

  const attach = ({ sessionMiddleware }) => {
    app.use(sessionMiddleware);
    app.use(requestLoggerMiddleware);

    app.use(createWebBaseRouter(modules.web.base));

    app.use('/web', attachCsrfToken());
    app.use('/web', csrfSynchronisedProtection);
    app.use(
      '/web',
      createWebAuthPublicRouter?.(modules.web.auth) || createWebAuthRouter(modules.web.auth),
    );
    app.use('/web', requireWebAuth());
    app.use('/web', createWebAuthProtectedRouter?.(modules.web.auth) || express.Router());
    app.use('/web', createWebAccommodationRouter(modules.web.accommodation));
    app.use('/web', createWebAssetsRouter(modules.web.assets));
    app.use('/web', createWebBicyclesRouter(modules.web.bicycles));
    app.use('/web', createWebLaundryRouter(modules.web.laundry));
    app.use('/web', createWebMainRouter(modules.web.main));

    app.use('/api', apiBurstProtection);
    app.use('/api', createApiAuthRouter(modules.api.auth));
    app.use(
      '/api',
      createApiJwt({
        env,
        repository: modules?.api?.auth?.repositories?.auth,
        auditLog: modules?.api?.auth?.auditLog,
      }),
    );
    if (modules?.api?.bikeApp) {
      app.use('/api', createApiBikeAppRouter(modules.api.bikeApp));
    }
    if (modules?.api?.inventoryApp) {
      app.use('/api', createApiInventoryAppRouter(modules.api.inventoryApp));
    }
    if (modules?.api?.laundryApp) {
      app.use('/api', createApiLaundryAppRouter(modules.api.laundryApp));
    }

    app.use(notFound);
    app.use(errorHandler);
    return app;
  };

  return { app, attach };
}

module.exports = { createApp };
