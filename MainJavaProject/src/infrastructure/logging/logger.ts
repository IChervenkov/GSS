// @ts-nocheck
const crypto = require('crypto');
const {
  getRequestContext,
  runWithRequestContext,
  updateRequestContext,
} = require('../../shared/observability/request-context');
const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const levelIndex = (value) => LEVELS.indexOf(value);
const SECRET_KEYS = new Set([
  'password',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'totp_secret',
  'temporary_password',
]);

function nowIso() {
  return new Date().toISOString();
}

function redact(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEYS.has(String(key).toLowerCase()) ? '[REDACTED]' : redact(item, seen),
    ]),
  );
}

function buildContextFields() {
  const ctx = getRequestContext();
  return {
    reqId: ctx.reqId,
    userId: ctx.userId,
    pendingUserId: ctx.pendingUserId,
    module: ctx.module,
    useCase: ctx.useCase,
    repository: ctx.repository,
    securityEventCategory: ctx.securityEventCategory,
  };
}

function createLogger({ level = 'info', service = 'app', base = {} } = {}) {
  const minLevel = levelIndex(level);
  const baseFields = { service, ...base };

  function write(lvl, msg, meta) {
    if (minLevel === -1 || levelIndex(lvl) > minLevel) return;
    const payload = JSON.stringify({
      ts: nowIso(),
      level: lvl,
      msg,
      ...baseFields,
      ...buildContextFields(),
      ...(redact(meta) || {}),
    });
    if (lvl === 'fatal' || lvl === 'error') {
      process.stderr.write(`${payload}
`);
      return;
    }
    process.stdout.write(`${payload}
`);
  }

  return {
    fatal: (msg, meta) => write('fatal', msg, meta),
    error: (msg, meta) => write('error', msg, meta),
    warn: (msg, meta) => write('warn', msg, meta),
    info: (msg, meta) => write('info', msg, meta),
    debug: (msg, meta) => write('debug', msg, meta),
    trace: (msg, meta) => write('trace', msg, meta),
    child: (extra = {}) =>
      createLogger({ level, service: extra.service || service, base: { ...baseFields, ...extra } }),
  };
}

function requestLogger({ logger, metrics } = {}) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    const reqId = req.headers['x-request-id'] || crypto.randomUUID();
    const initialContext = {
      reqId,
      userId: req.session?.userId,
      pendingUserId: req.session?.pendingUserId,
      module: undefined,
      useCase: undefined,
      securityEventCategory: undefined,
    };

    runWithRequestContext(initialContext, () => {
      req.reqId = reqId;
      res.locals.reqId = reqId;
      res.setHeader('X-Request-Id', reqId);
      updateRequestContext({
        userId: req.session?.userId,
        pendingUserId: req.session?.pendingUserId,
      });

      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const route = req.route?.path || req.path || 'unmatched';
        const ctx = getRequestContext();
        const status = String(res.statusCode);
        metrics?.counter?.('gss_http_requests_total', {
          method: req.method,
          route,
          status,
        });
        metrics?.counter?.('gss_http_request_context_total', {
          method: req.method,
          route,
          status,
          module: ctx.module || 'unassigned',
          useCase: ctx.useCase || `${req.method.toUpperCase()} ${route}`,
          authState: ctx.userId ? 'authenticated' : ctx.pendingUserId ? 'pending' : 'anonymous',
        });
        metrics?.histogramObserve?.(
          'gss_http_request_duration_ms',
          { method: req.method, route, status, module: ctx.module || 'unassigned' },
          durationMs,
        );
        logger?.info?.('http', {
          reqId,
          method: req.method,
          path: req.originalUrl,
          route,
          status: res.statusCode,
          duration_ms: Math.round(durationMs * 10) / 10,
          module: ctx.module,
          useCase: ctx.useCase,
          userId: ctx.userId,
          pendingUserId: ctx.pendingUserId,
        });
      });

      next();
    });
  };
}

module.exports = { createLogger, requestLogger, updateRequestContext };
