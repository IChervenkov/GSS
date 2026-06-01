const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTokenService,
} = require('../../../../src/modules/api/auth/application/services/token.service');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

test('refreshToken rotates refresh session and returns both tokens', async () => {
  const auditEvents = [];
  const service = createTokenService({
    env: {
      REFRESH_TOKEN_EXPIRES_IN: 14,
      REFRESH_SESSION_MAX_ACTIVE_PER_USER: 10,
      REFRESH_SESSION_MAX_ACTIVE_PER_DEVICE: 3,
    },
    repository: {
      rotateRefreshSession: async (payload) => {
        assert.equal(payload.deviceId, 'device-1');
        assert.equal(payload.userId, 'user-1');
        assert.equal(payload.requestMeta.ip, '127.0.0.1');
        assert.ok(payload.clientFingerprintHash);
        return { ok: true, session: { id: 'session-1', sessionFamilyId: 'family-1' } };
      },
    },
    tokens: {
      verifyRefreshToken: () => ({ id: 'user-1', username: 'alice', deviceId: 'device-1', tokenVersion: 3, jti: 'jti-1' }),
      createRefreshToken: (_env, payload) => {
        assert.equal(payload.sub, 'user-1');
        assert.equal(payload.username, 'alice');
        assert.equal(payload.deviceId, 'device-1');
        assert.equal(payload.tokenVersion, 3);
        return 'next-refresh-token';
      },
      createAccessToken: (_env, payload) => {
        assert.equal(payload.sub, 'user-1');
        assert.equal(payload.username, 'alice');
        assert.equal(payload.deviceId, 'device-1');
        assert.equal(payload.tokenVersion, 3);
        return 'next-access-token';
      },
      hashToken: (value) => `hash:${value}`,
    },
    auditLog: (event, meta) => auditEvents.push({ event, meta }),
  });

  const result = await service.refreshToken({
    refreshToken: 'current-refresh-token',
    deviceId: 'device-1',
    clientFingerprint: 'fp-1',
    requestMeta: { ip: '127.0.0.1', userAgent: 'node-test' },
  });
  assert.deepEqual(result, {
    accessToken: 'next-access-token',
    refreshToken: 'next-refresh-token',
  });
  assert.equal(auditEvents[0].event, 'auth.refresh.rotated');
  assert.equal(auditEvents[0].meta.sessionId, 'session-1');
  assert.equal(auditEvents[0].meta.sessionFamilyId, 'family-1');
});

test('refreshToken normalizes token failures into INVALID_REFRESH_TOKEN', async () => {
  const auditEvents = [];
  const service = createTokenService({
    env: {
      REFRESH_TOKEN_EXPIRES_IN: 14,
      REFRESH_SESSION_MAX_ACTIVE_PER_USER: 10,
      REFRESH_SESSION_MAX_ACTIVE_PER_DEVICE: 3,
    },
    repository: {
      rotateRefreshSession: async () => null,
    },
    tokens: {
      verifyRefreshToken: () => {
        throw new Error('jwt malformed');
      },
      createRefreshToken: (_env, payload) => {
        assert.equal(payload.sub, 'user-1');
        assert.equal(payload.username, 'alice');
        assert.equal(payload.deviceId, 'device-1');
        assert.equal(payload.tokenVersion, 3);
        return 'next-refresh-token';
      },
      createAccessToken: (_env, payload) => {
        assert.equal(payload.sub, 'user-1');
        assert.equal(payload.username, 'alice');
        assert.equal(payload.deviceId, 'device-1');
        assert.equal(payload.tokenVersion, 3);
        return 'next-access-token';
      },
      hashToken: (value) => `hash:${value}`,
    },
    auditLog: (event, meta) => auditEvents.push({ event, meta }),
  });

  await assert.rejects(
    () => service.refreshToken({ refreshToken: 'bad-token', deviceId: 'device-1' }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 403);
      assert.equal(error.code, ERROR_CODES.INVALID_REFRESH_TOKEN);
      return true;
    },
  );

  assert.equal(auditEvents[0].event, 'auth.refresh.failed');
  assert.equal(auditEvents[0].meta.reason, 'token_invalid');
});

test('refreshToken audits specific repository rejection reasons', async () => {
  const auditEvents = [];
  const service = createTokenService({
    env: {
      REFRESH_TOKEN_EXPIRES_IN: 14,
      REFRESH_SESSION_MAX_ACTIVE_PER_USER: 10,
      REFRESH_SESSION_MAX_ACTIVE_PER_DEVICE: 3,
    },
    repository: {
      rotateRefreshSession: async () => ({
        ok: false,
        reason: 'device_mismatch',
        session: { id: 'session-1', sessionFamilyId: 'family-1' },
      }),
    },
    tokens: {
      verifyRefreshToken: () => ({ sub: 'user-1', username: 'alice', deviceId: 'device-1', tokenVersion: 3, jti: 'jti-1' }),
      createRefreshToken: () => 'next-refresh-token',
      createAccessToken: () => 'next-access-token',
      hashToken: (value) => `hash:${value}`,
    },
    auditLog: (event, meta) => auditEvents.push({ event, meta }),
  });

  await assert.rejects(
    () => service.refreshToken({ refreshToken: 'current-refresh-token', deviceId: 'device-1' }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, ERROR_CODES.INVALID_REFRESH_TOKEN);
      return true;
    },
  );

  assert.equal(auditEvents[0].event, 'auth.refresh.rejected');
  assert.equal(auditEvents[0].meta.reason, 'device_mismatch');
  assert.equal(auditEvents[0].meta.sessionId, 'session-1');
});
