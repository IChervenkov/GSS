const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { requestLogger, updateRequestContext } = require('../../../src/infrastructure/logging/logger');

function createResponseDouble() {
  const res = new EventEmitter();
  res.locals = {};
  res.statusCode = 204;
  res.headers = {};
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  return res;
}

test('requestLogger records normalized request context metrics and structured log fields', async () => {
  const counters = [];
  const histograms = [];
  const infos = [];
  const middleware = requestLogger({
    metrics: {
      counter: (name, labels, value) => counters.push({ name, labels, value: value ?? 1 }),
      histogramObserve: (name, labels, value) => histograms.push({ name, labels, value }),
    },
    logger: {
      info: (msg, meta) => infos.push({ msg, meta }),
    },
  });

  const req = {
    method: 'POST',
    path: '/web/login',
    originalUrl: '/web/login?next=%2Fweb%2Fmain-page',
    headers: {},
    session: { userId: 'user-1' },
    route: { path: '/web/login' },
  };
  const res = createResponseDouble();

  await new Promise((resolve) => {
    middleware(req, res, () => {
      updateRequestContext({ module: 'web.auth', useCase: 'login.submit' });
      res.emit('finish');
      resolve();
    });
  });

  assert.equal(typeof req.reqId, 'string');
  assert.equal(res.locals.reqId, req.reqId);
  assert.equal(res.headers['X-Request-Id'], req.reqId);

  assert.deepEqual(counters, [
    {
      name: 'gss_http_requests_total',
      labels: { method: 'POST', route: '/web/login', status: '204' },
      value: 1,
    },
    {
      name: 'gss_http_request_context_total',
      labels: {
        method: 'POST',
        route: '/web/login',
        status: '204',
        module: 'web.auth',
        useCase: 'login.submit',
        authState: 'authenticated',
      },
      value: 1,
    },
  ]);

  assert.equal(histograms.length, 1);
  assert.equal(histograms[0].name, 'gss_http_request_duration_ms');
  assert.deepEqual(histograms[0].labels, {
    method: 'POST',
    route: '/web/login',
    status: '204',
    module: 'web.auth',
  });
  assert.equal(typeof histograms[0].value, 'number');

  assert.equal(infos.length, 1);
  assert.equal(infos[0].msg, 'http');
  assert.equal(infos[0].meta.reqId, req.reqId);
  assert.equal(infos[0].meta.module, 'web.auth');
  assert.equal(infos[0].meta.useCase, 'login.submit');
  assert.equal(infos[0].meta.userId, 'user-1');
  assert.equal(infos[0].meta.status, 204);
});

test('requestLogger marks pending sessions as pending auth state', async () => {
  const counters = [];
  const middleware = requestLogger({
    metrics: {
      counter: (name, labels) => counters.push({ name, labels }),
      histogramObserve() {},
    },
    logger: { info() {} },
  });

  const req = {
    method: 'GET',
    path: '/web/login/verify',
    originalUrl: '/web/login/verify',
    headers: { 'x-request-id': 'req-fixed' },
    session: { pendingUserId: 'pending-1' },
    route: { path: '/web/login/verify' },
  };
  const res = createResponseDouble();

  await new Promise((resolve) => {
    middleware(req, res, () => {
      res.emit('finish');
      resolve();
    });
  });

  const contextMetric = counters.find((entry) => entry.name === 'gss_http_request_context_total');
  assert.deepEqual(contextMetric.labels, {
    method: 'GET',
    route: '/web/login/verify',
    status: '204',
    module: 'unassigned',
    useCase: 'GET /web/login/verify',
    authState: 'pending',
  });
});
