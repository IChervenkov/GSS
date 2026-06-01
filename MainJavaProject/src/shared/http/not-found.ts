const { ERROR_CODES } = require('../errors/error-codes');
const { buildWebErrorRenderModel } = require('./error-response');

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

function notFound(req, res) {
  const payload = {
    code: ERROR_CODES.NOT_FOUND,
    message: 'The requested resource was not found.',
    details: [],
    requestId: req.reqId,
  };

  if (isJsonRequest(req)) {
    return res.status(404).json(payload);
  }

  return res.status(404).render(
    'error',
    buildWebErrorRenderModel({
      appErr: { status: 404, ...payload },
      req,
      env: { isProd: true },
      title: 'Not Found',
    }),
  );
}

module.exports = { notFound };
