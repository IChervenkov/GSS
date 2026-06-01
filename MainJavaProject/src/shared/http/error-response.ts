function normalizeDetails(details) {
  if (Array.isArray(details)) return details;
  if (details === undefined || details === null) return [];
  return [details];
}

function buildApiErrorPayload(appErr, req, env, extras = {}) {
  return {
    code: appErr.code,
    message: appErr.message,
    details: normalizeDetails(appErr.details),
    requestId: req?.reqId || null,
    ...extras,
    ...(env?.isProd ? {} : { stack: appErr.stack }),
  };
}

function buildWebErrorRenderModel({ appErr, req, env, title = 'Error' } = {}) {
  return {
    title,
    statusCode: appErr.status,
    code: appErr.code,
    message: appErr.message,
    details: normalizeDetails(appErr.details),
    requestId: req?.reqId || null,
    reqId: req?.reqId || null,
    stack: env?.isProd ? undefined : appErr.stack,
  };
}

function createApiErrorRenderer({ env, buildPayload = buildApiErrorPayload } = {}) {
  return ({ req, res, appErr, extras } = {}) => res.status(appErr.status).json(buildPayload(appErr, req, env, extras));
}

function createWebErrorRenderer({ env, buildModel = buildWebErrorRenderModel } = {}) {
  return ({ req, res, appErr, title = 'Error' } = {}) =>
    res.status(appErr.status).render('error', buildModel({ appErr, req, env, title }));
}

module.exports = {
  buildApiErrorPayload,
  buildWebErrorRenderModel,
  createApiErrorRenderer,
  createWebErrorRenderer,
};
