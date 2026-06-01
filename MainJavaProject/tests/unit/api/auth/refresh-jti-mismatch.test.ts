const test = require('node:test');
const assert = require('node:assert/strict');

const { createTokenService } = require('../../../../src/modules/api/auth/application/services/token.service');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

const userId = '11111111-1111-1111-1111-111111111111';

test('refresh token is rejected on refresh_jti mismatch', async () => {
  const service = createTokenService({
    env: {
      REFRESH_TOKEN_EXPIRES_IN: 14,
      REFRESH_SESSION_MAX_ACTIVE_PER_USER: 10,
      REFRESH_SESSION_MAX_ACTIVE_PER_DEVICE: 3,
    },
    repository: {
      rotateRefreshSession: async (payload) => {
        assert.equal(payload.refreshJti, 'refresh-jti-1');
        return { ok: false, reason: 'hash_mismatch' };
      },
    },
    tokens: {
      verifyRefreshToken: (env, token) => {
        if (token === 'current-refresh-token') {
          return { sub: userId, username: 'alice', deviceId: 'device-1', tokenVersion: 3, jti: 'refresh-jti-1' };
        }
        return { sub: userId, username: 'alice', deviceId: 'device-1', tokenVersion: 3, jti: 'refresh-jti-2' };
      },
      createRefreshToken: () => 'next-refresh-token',
      createAccessToken: () => 'next-access-token',
      hashToken: (value) => `hash:${value}`,
    },
  });

  await assert.rejects(
    () => service.refreshToken({ refreshToken: 'current-refresh-token', deviceId: 'device-1' }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, ERROR_CODES.INVALID_REFRESH_TOKEN);
      return true;
    },
  );
});
