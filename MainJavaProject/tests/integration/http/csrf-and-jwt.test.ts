const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { ensureCsrfToken, attachCsrfToken } = require('../../../src/core/config/csrf');
const { createApiJwt } = require('../../../src/shared/http/api-jwt');
const { createAccessToken, createRefreshToken } = require('../../../src/modules/api/auth/infrastructure/security/auth.tokens');
const { createNextRecorder } = require('../../helpers/fakes');

test('ensureCsrfToken creates and persists a session token', async () => {
  const req = { session: {} };
  const token = ensureCsrfToken(req);
  assert.equal(typeof token, 'string');
  assert.equal(req.session.csrfToken, token);
});

test('attachCsrfToken writes token to res.locals', async () => {
  const middleware = attachCsrfToken();
  const req = { session: {} };
  const res = { locals: {} };
  const { next, calls } = createNextRecorder();
  middleware(req, res, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], null);
  assert.equal(res.locals.csrfToken, req.session.csrfToken);
});

test('api jwt middleware accepts valid bearer token', async () => {
  const secret = 'x'.repeat(32);
  const env = { ACCESS_TOKEN_SECRET: secret, ACCESS_TOKEN_EXPIRES_IN: 15 };
  const token = createAccessToken(env, { sub: '11111111-1111-1111-1111-111111111111' });
  const middleware = createApiJwt(env);
  const req = { method: 'GET', headers: { authorization: `Bearer ${token}` } };
  const { next, calls } = createNextRecorder();

  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], null);
  assert.equal(req.user.id, '11111111-1111-1111-1111-111111111111');
  assert.equal(req.user.sub, '11111111-1111-1111-1111-111111111111');
  assert.equal(req.user.tokenType, 'access');
});

test('api jwt middleware rejects refresh token in bearer context', async () => {
  const secret = 'x'.repeat(32);
  const env = {
    ACCESS_TOKEN_SECRET: secret,
    REFRESH_TOKEN_SECRET: secret,
    ACCESS_TOKEN_EXPIRES_IN: 15,
    REFRESH_TOKEN_EXPIRES_IN: 14,
  };
  const token = createRefreshToken(env, { sub: '11111111-1111-1111-1111-111111111111' });
  const middleware = createApiJwt(env);

  assert.throws(
    () => middleware({ method: 'GET', headers: { authorization: `Bearer ${token}` } }, {}, () => {}),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'INVALID_TOKEN');
      return true;
    },
  );
});

test('api jwt middleware exposes expired access token as refreshable auth failure', async () => {
  const secret = 'x'.repeat(32);
  const env = { ACCESS_TOKEN_SECRET: secret, ACCESS_TOKEN_EXPIRES_IN: 15 };
  const token = jwt.sign(
    {
      sub: '11111111-1111-1111-1111-111111111111',
      type: 'access',
      tokenVersion: 0,
    },
    secret,
    { expiresIn: '-1s' },
  );
  const middleware = createApiJwt(env);

  assert.throws(
    () => middleware({ method: 'GET', headers: { authorization: `Bearer ${token}` } }, {}, () => {}),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.code, 'ACCESS_TOKEN_EXPIRED');
      return true;
    },
  );
});

test('api jwt middleware throws on missing token', async () => {
  const middleware = createApiJwt({ ACCESS_TOKEN_SECRET: 'x'.repeat(32) });
  assert.throws(
    () => middleware({ method: 'GET', headers: {} }, {}, () => {}),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.code, 'MISSING_TOKEN');
      return true;
    },
  );
});
