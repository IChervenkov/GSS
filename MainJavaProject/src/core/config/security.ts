// @ts-nocheck
const crypto = require('crypto');
const helmet = require('helmet');
const hpp = require('hpp');

function toConnectSrc(env) {
  const values = new Set(["'self'"]);

  if (env.APP_URL) {
    values.add(env.APP_URL);
    try {
      const url = new URL(env.APP_URL);
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      values.add(`${wsProtocol}//${url.host}`);
    } catch {}
  }

  if (env.OBSERVABILITY_BROWSER_ENDPOINT) {
    values.add(env.OBSERVABILITY_BROWSER_ENDPOINT);
  }

  return [...values];
}

function applySecurity(app, { env } = {}) {
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  app.use(hpp());
  app.use(
    helmet({
      frameguard: { action: 'deny' },
      hsts: env.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      contentSecurityPolicy: {
      reportOnly: env.CSP_REPORT_ONLY === 'true',
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          'img-src': ["'self'", 'data:'],
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'connect-src': toConnectSrc(env),
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
      noSniff: true,
      xssFilter: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      originAgentCluster: true,
      dnsPrefetchControl: { allow: false },
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );
}

module.exports = { applySecurity };
