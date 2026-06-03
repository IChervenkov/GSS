// @ts-nocheck
const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiJwt } = require('../../../src/shared/http/api-jwt');
const { createAccessToken } = require('../../../src/modules/api/auth/infrastructure/security/auth.tokens');

const userId = '11111111-1111-1111-1111-111111111111';

test('api jwt middleware rejects stale access token after token_version bump', async () => {
  const env = {
    ACCESS_TOKEN_SECRET: 'x'.repeat(32),
    ACCESS_TOKEN_EXPIRES_IN: 15,
  };
  const token = createAccessToken(env, { sub: userId, tokenVersion: 1 });
  const middleware = createApiJwt({
    env,
    repository: {
      getUserTokenState: async () => ({ userId, tokenVersion: 2 }),
    },
  });

  const req = { method: 'GET', headers: { authorization: `Bearer ${token}` }, url: '/api/test' };

  await assert.rejects(
    () =>
      new Promise((resolve, reject) => {
        middleware(req, {}, (error) => (error ? reject(error) : resolve()));
      }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'INVALID_TOKEN');
      return true;
    },
  );
});
