const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  createLoginService,
} = require('../../src/modules/web/auth/application/services/login.service');
const {
  createApprovalService,
} = require('../../src/modules/web/auth/application/services/approval.service');
const {
  createTokenService,
} = require('../../src/modules/api/auth/application/services/token.service');

const userId = '11111111-1111-1111-1111-111111111111';
const requestId = '22222222-2222-2222-2222-222222222222';
const buildFixture = (name) => `fixture-${name}`;
const validPassword = buildFixture('login-pass-A1!');
const storedPasswordHash = buildFixture('stored-password-hash');
const oldRefreshToken = buildFixture('refresh-token-old');
const newRefreshToken = buildFixture('refresh-token-new');
const newAccessToken = buildFixture('access-token-new');

test('critical auth flow covers login, QR request, approval, payload reveal, and refresh rotation', async () => {
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async (plain, hashed) =>
    plain === validPassword && hashed === storedPasswordHash;

  const auditEvents = [];
  const sessionState = { pendingUserId: null, saved: false, qrConsumed: false };

  try {
    const loginService = createLoginService({
      repository: {
        findUserByUsername: async () => ({
          id: userId,
          username: 'admin',
          password: storedPasswordHash,
          temporary_password: null,
        }),
      },
      auditLog: (event, payload) => auditEvents.push({ event, payload }),
    });

    const loginResult = await loginService.login({
      username: 'admin',
      password: validPassword,
      attemptTracker: {
        dummyBcryptHash: 'dummy',
        isBlocked: () => false,
        registerFailedAttempt: () => {
          throw new Error('should not fail');
        },
        resetFailedAttempts: () => {},
      },
      authSession: {
        transitionToPendingTwoFactor: async ({ userId: value }) => {
          sessionState.pendingUserId = value;
          sessionState.saved = true;
        },
      },
      requestMeta: { reqId: 'req-login' },
    });

    assert.equal(loginResult.status, 200);
    assert.equal(sessionState.pendingUserId, userId);
    assert.equal(sessionState.saved, true);

    const approvalService = createApprovalService({
      repository: {
        userHasPermission: async () => true,
        createApprovalRequest: async () => ({
          requestId,
          expiresAt: new Date('2035-01-01T00:00:00.000Z'),
          reused: false,
        }),
        resolveApprovalRequest: async () => ({
          kind: 'resolved',
          value: { request_id: requestId, user_id: userId, status: 'approved', type: 'show_qr' },
        }),
        findApprovalRequest: async () => ({
          request_id: requestId,
          user_id: userId,
          status: 'approved',
          expires_at: '2035-01-01T00:00:00.000Z',
        }),
      },
      eventBus: {
        emitApprovalResolved: () => {},
        emitUserRequestUpdated: () => {},
      },
      qrPayloadTtlSeconds: 30,
      auditLog: (event, payload) => auditEvents.push({ event, payload }),
    });

    const requestResult = await approvalService.requestQr({
      pendingUserId: userId,
      challengeExpiresAt: Date.now() + 30_000,
      requestMeta: { reqId: 'req-request' },
    });
    assert.equal(requestResult.status, 202);
    assert.equal(requestResult.body.requestId, requestId);

    const decisionResult = await approvalService.verifyAdminDecision({
      userId,
      requestId,
      decision: 'approved',
      requestMeta: { reqId: 'req-approve' },
    });
    assert.equal(decisionResult.status, 200);
    assert.equal(decisionResult.body.decision, 'approved');

    const payloadResult = await approvalService.getApprovedQrPayload({
      pendingUserId: userId,
      requestId,
      qrRequestId: requestId,
      challengeExpiresAt: Date.now() + 30_000,
      qrCodeDataURL: 'data:image/png;base64,abc',
      markQrPayloadConsumed: () => {
        sessionState.qrConsumed = true;
      },
      requestMeta: { reqId: 'req-payload' },
    });
    assert.equal(payloadResult.status, 200);
    assert.equal(payloadResult.body.status, 'approved');
    assert.equal(sessionState.qrConsumed, true);

    const tokenService = createTokenService({
      env: { REFRESH_TOKEN_EXPIRES_IN: 14 },
      repository: {
        rotateRefreshSession: async () => ({ id: 'session-1', user_id: userId }),
      },
      tokens: {
        verifyRefreshToken: () => ({ userId, role: 'admin' }),
        createRefreshToken: () => newRefreshToken,
        createAccessToken: () => newAccessToken,
        hashToken: (token) => `hash:${token}`,
      },
      auditLog: (event, payload) => auditEvents.push({ event, payload }),
    });

    const rotated = await tokenService.refreshToken({
      refreshToken: oldRefreshToken,
      deviceId: 'device-1',
      requestMeta: { reqId: 'req-refresh' },
    });
    assert.deepEqual(rotated, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
    assert.ok(auditEvents.some((entry) => entry.event === 'auth.login.success'));
    assert.ok(auditEvents.some((entry) => entry.event === 'auth.approval.resolved'));
    assert.ok(auditEvents.some((entry) => entry.event === 'auth.refresh.rotated'));
  } finally {
    bcrypt.compare = originalCompare;
  }
});
