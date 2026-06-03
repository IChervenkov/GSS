const express = require('express');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const ts = require('typescript');

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

function isPathInside(basePath, candidatePath) {
  const relativePath = path.relative(basePath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolvePublicAssetPath(publicRoot, requestPath) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(requestPath).replace(/^[/\\]+/, '');
  } catch {
    return null;
  }

  const normalizedPath = path.normalize(relativePath);
  const absolutePath = path.resolve(publicRoot, normalizedPath);
  return isPathInside(publicRoot, absolutePath) ? absolutePath : null;
}

function transpileBrowserTypeScript(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      sourceMap: false,
    },
    fileName,
  }).outputText;
}

function serveBrowserTypeScript(publicRoot) {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (path.extname(req.path) !== '.ts') return next();

    const filePath = resolvePublicAssetPath(publicRoot, req.path);
    if (!filePath) return next();

    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) return next();

      const source = await fs.promises.readFile(filePath, 'utf8');
      const output = transpileBrowserTypeScript(source, filePath);
      res.setHeader('Content-Type', 'text/javascript; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-cache');
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).send(output);
    } catch (error) {
      if (error?.code === 'ENOENT') return next();
      return next(error);
    }
  };
}

function createApp({ env, requestLoggerMiddleware, errorHandler, modules, rateLimitStore }) {
  const app = express();
  const rootDir = path.resolve(__dirname, '../..');
  const sharedPublicRoot = path.join(rootDir, 'src/shared/public');
  const authPublicRoot = path.join(rootDir, 'src/modules/web/auth/public');
  const accommodationPublicRoot = path.join(rootDir, 'src/modules/web/accommodation/public');
  const assetsPublicRoot = path.join(rootDir, 'src/modules/web/assets/public');
  const bicyclesPublicRoot = path.join(rootDir, 'src/modules/web/bicycles/public');
  const laundryPublicRoot = path.join(rootDir, 'src/modules/web/laundry/public');
  const mainPublicRoot = path.join(rootDir, 'src/modules/web/main-page/public');

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
    serveBrowserTypeScript(sharedPublicRoot),
    express.static(sharedPublicRoot, scriptStaticOptions),
  );
  app.use(
    '/assets/auth',
    serveBrowserTypeScript(authPublicRoot),
    express.static(authPublicRoot, scriptStaticOptions),
  );
  app.use(
    '/assets/accommodation',
    serveBrowserTypeScript(accommodationPublicRoot),
    express.static(accommodationPublicRoot, scriptStaticOptions),
  );
  app.use(
    '/assets/assets',
    serveBrowserTypeScript(assetsPublicRoot),
    express.static(assetsPublicRoot, scriptStaticOptions),
  );
  app.use(
    '/assets/bicycles',
    serveBrowserTypeScript(bicyclesPublicRoot),
    express.static(bicyclesPublicRoot, scriptStaticOptions),
  );
  app.use(
    '/assets/laundry',
    serveBrowserTypeScript(laundryPublicRoot),
    express.static(laundryPublicRoot, scriptStaticOptions),
  );
  app.use(
    '/assets/main',
    serveBrowserTypeScript(mainPublicRoot),
    express.static(mainPublicRoot, scriptStaticOptions),
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
