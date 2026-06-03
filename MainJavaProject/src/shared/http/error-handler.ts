// @ts-nocheck
const { createToAppError } = require('../errors/to-app-error');
const { destroySessionAndClearCookie } = require('../utils/session-utils');
const { buildRequestMeta } = require('../security/audit-log');
const { createApiErrorRenderer, createWebErrorRenderer } = require('./error-response');
const { createSessionErrorPolicy } = require('./policies/session-error-policy');
const { METRIC_NAMES } = require('../observability/metric-names');

function isJsonRequest(req) {
  const accept = String(req.headers?.accept || '').toLowerCase();
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();

  return Boolean(
    req.xhr ||
      req.path?.startsWith('/api') ||
      contentType.includes('application/json') ||
      accept.includes('application/json'),
  );
}

function createErrorMetricsRecorder({ metrics, sessionPolicy } = {}) {
  return ({ req, appErr } = {}) => {
    const route = req?.route?.path || req?.path || 'unmatched';
    const statusClass = `${Math.floor(appErr.status / 100)}xx`;
    metrics?.counter?.(METRIC_NAMES.HTTP_ERROR_TOTAL, {
      method: req?.method,
      route,
      code: appErr.code,
      class: statusClass,
    });
    if (sessionPolicy?.isAuthFailure(appErr)) {
      metrics?.counter?.(METRIC_NAMES.AUTH_FAILURES_TOTAL, { code: appErr.code, route });
    }
  };
}

function createErrorLogger({ logger, env } = {}) {
  return ({ req, appErr } = {}) => {
    logger?.error?.('request_error', {
      reqId: req?.reqId,
      method: req?.method,
      path: req?.originalUrl,
      status: appErr.status,
      code: appErr.code,
      errorMessage: appErr.message,
      stack: env?.isProd ? undefined : appErr.stack,
    });
  };
}

function createErrorHandler({
  env,
  logger,
  metrics,
  auditLog,
  normalizeError = createToAppError(),
  sessionPolicy = createSessionErrorPolicy(),
  detectJsonRequest = isJsonRequest,
  recordMetrics,
  logError,
  renderApiError,
  renderWebError,
  invalidateSession = destroySessionAndClearCookie,
} = {}) {
  const errorMetricsRecorder = recordMetrics || createErrorMetricsRecorder({ metrics, sessionPolicy });
  const errorLogger = logError || createErrorLogger({ logger, env });
  const apiErrorRenderer = renderApiError || createApiErrorRenderer({ env });
  const webErrorRenderer = renderWebError || createWebErrorRenderer({ env });

  return async function errorHandler(err, req, res, _next) {
    const appErr = normalizeError(err);

    errorMetricsRecorder({ req, appErr, err });
    errorLogger({ req, appErr, err });

    if (res.headersSent) {
      return;
    }

    if (sessionPolicy.shouldInvalidate(appErr)) {
      auditLog?.(
        sessionPolicy.auditEvent,
        buildRequestMeta(req, {
          actorUserId: req?.user?.id || req?.session?.userId || null,
          code: appErr.code,
          reason: appErr.message,
        }),
      );
      try {
        await invalidateSession(req, res, env, { reason: 'session_error_policy' });
      } catch {
        // keep going even if session teardown fails
      }

      if (detectJsonRequest(req)) {
        return apiErrorRenderer({
          req,
          res,
          appErr,
          extras: { redirectTo: sessionPolicy.redirectTo },
        });
      }

      return res.redirect(303, sessionPolicy.redirectTo);
    }

    if (detectJsonRequest(req)) {
      return apiErrorRenderer({ req, res, appErr });
    }

    return webErrorRenderer({ req, res, appErr, title: 'Error' });
  };
}

module.exports = {
  createErrorHandler,
  createErrorLogger,
  createErrorMetricsRecorder,
  isJsonRequest,
};