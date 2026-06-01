const test = require('node:test');
const assert = require('node:assert/strict');

const { createErrorHandler } = require('../../../src/shared/http/error-handler');
const { AppError } = require('../../../src/shared/errors/app-error');
const { createSessionErrorPolicy } = require('../../../src/shared/http/policies/session-error-policy');
const { ERROR_CODES } = require('../../../src/shared/errors/error-codes');
const { ERROR_CATALOG } = require('../../../src/shared/errors/error-catalog');

function createResponseDouble() {
  return {
    statusCode: null,
    jsonBody: null,
    renderView: null,
    renderModel: null,
    redirectArgs: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    },
    render(view, model) {
      this.renderView = view;
      this.renderModel = model;
      return this;
    },
    redirect(...args) {
      this.redirectArgs = args;
      return this;
    },
  };
}

test('error catalog has unique codes and valid statuses', () => {
  const codes = Object.keys(ERROR_CATALOG);
  assert.equal(new Set(codes).size, codes.length);
  for (const definition of Object.values(ERROR_CATALOG)) {
    assert.equal(typeof definition.defaultMessage, 'string');
    assert.ok(definition.defaultMessage.length > 0);
    assert.ok(Number.isInteger(definition.status));
    assert.ok(definition.status >= 400 && definition.status <= 599);
  }
});

test('error handler invalidates session through injected policy and returns API redirect payload', async () => {
  const invalidations = [];
  const audits = [];
  const req = {
    method: 'POST',
    path: '/api/token',
    originalUrl: '/api/token',
    headers: { accept: 'application/json' },
    session: { userId: 'user-1' },
    reqId: 'req-1',
  };
  const res = createResponseDouble();
  const handler = createErrorHandler({
    env: { isProd: true },
    sessionPolicy: createSessionErrorPolicy({ redirectTo: '/signin' }),
    auditLog: (event, meta) => audits.push({ event, meta }),
    invalidateSession: async (...args) => invalidations.push(args),
    logError: () => {},
    recordMetrics: () => {},
  });

  await handler(new AppError({ status: 403, code: ERROR_CODES.INVALID_TOKEN, message: 'bad token' }), req, res);

  assert.equal(invalidations.length, 1);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonBody, {
    code: ERROR_CODES.INVALID_TOKEN,
    message: 'bad token',
    details: [],
    requestId: 'req-1',
    redirectTo: '/signin',
  });
  assert.equal(audits[0].event, 'security.session.invalidated');
});

test('error handler does not invalidate sessions for expired API access tokens', async () => {
  const invalidations = [];
  const audits = [];
  const req = {
    method: 'POST',
    path: '/api/inventory-app/assets',
    originalUrl: '/api/inventory-app/assets',
    headers: { accept: 'application/json' },
    session: { userId: 'user-1' },
    reqId: 'req-expired-access',
  };
  const res = createResponseDouble();
  const handler = createErrorHandler({
    env: { isProd: true },
    auditLog: (event, meta) => audits.push({ event, meta }),
    invalidateSession: async (...args) => invalidations.push(args),
    logError: () => {},
    recordMetrics: () => {},
  });

  await handler(
    new AppError({
      status: 401,
      code: ERROR_CODES.ACCESS_TOKEN_EXPIRED,
      message: 'Access token has expired.',
    }),
    req,
    res,
  );

  assert.equal(invalidations.length, 0);
  assert.equal(audits.length, 0);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, {
    code: ERROR_CODES.ACCESS_TOKEN_EXPIRED,
    message: 'Access token has expired.',
    details: [],
    requestId: 'req-expired-access',
  });
});

test('error handler renders web errors without invalidating session when policy does not match', async () => {
  const req = {
    method: 'GET',
    path: '/web/main',
    originalUrl: '/web/main',
    headers: { accept: 'text/html' },
    reqId: 'req-2',
  };
  const res = createResponseDouble();
  const handler = createErrorHandler({
    env: { isProd: true },
    invalidateSession: async () => { throw new Error('should not be called'); },
    logError: () => {},
    recordMetrics: () => {},
  });

  await handler(new Error('boom'), req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.renderView, 'error');
  assert.equal(res.renderModel.code, 'INTERNAL_ERROR');
  assert.equal(res.renderModel.requestId, 'req-2');
});
