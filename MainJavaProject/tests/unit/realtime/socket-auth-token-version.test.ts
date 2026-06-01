const test = require('node:test');
const assert = require('node:assert/strict');

const { createSocketSessionValidator } = require('../../../src/infrastructure/realtime/socket-auth');
const { createAccessToken } = require('../../../src/modules/api/auth/infrastructure/security/auth.tokens');

const userId = '11111111-1111-1111-1111-111111111111';

test('socket auth rejects stale jwt after token_version bump', async () => {
  const env = {
    ACCESS_TOKEN_SECRET: 'x'.repeat(32),
    REFRESH_TOKEN_SECRET: 'y'.repeat(32),
    ACCESS_TOKEN_EXPIRES_IN: 15,
    REFRESH_TOKEN_EXPIRES_IN: 14,
  };
  const token = createAccessToken(env, { sub: userId, tokenVersion: 1 });
  const io = { engine: { use() {} }, use(handler) { this.handler = handler; } };
  createSocketSessionValidator({
    env,
    logger: { child() { return this; }, warn() {} },
    repository: { getUserTokenState: async () => ({ userId, tokenVersion: 2 }) },
  })(io, (_req, _res, next) => next());

  const socket = { id: 'socket-1', handshake: { auth: { token }, headers: {} }, request: {} };
  const error = await new Promise((resolve) => io.handler(socket, resolve));
  assert.equal(error?.data?.code, 'INVALID_TOKEN');
});
