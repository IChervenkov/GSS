const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  createPasswordChangeService,
} = require('../../src/modules/web/auth/application/services/password-change.service');
const {
  createApprovalService,
} = require('../../src/modules/web/auth/application/services/approval.service');

const userId = '11111111-1111-1111-1111-111111111111';
const requestId = '22222222-2222-2222-2222-222222222222';
const buildFixture = (name) => `fixture-${name}`;
const currentPassword = buildFixture('current-pass-A1!');
const nextPassword = buildFixture('next-pass-B2!');
const storedPasswordHash = buildFixture('stored-password-hash');

test('password change lifecycle covers request, admin approval, completion, and session finalization', async () => {
  const originalCompare = bcrypt.compare;
  const originalHash = bcrypt.hash;
  const auditEvents = [];
  const repoCalls = [];

  bcrypt.compare = async (plain, hashed) => plain === currentPassword && hashed === storedPasswordHash;
  bcrypt.hash = async (value) => `hashed:${value}`;

  try {
    const passwordService = createPasswordChangeService({
      env: { BCRYPT_ROUNDS: 12 },
      repository: {
        findUserByUsername: async () => ({
          id: userId,
          username: 'user',
          password: storedPasswordHash,
          temporaryPassword: null,
          isLocked: false,
        }),
        createApprovalRequest: async () => ({
          requestId,
          expiresAt: new Date('2035-01-01T00:00:00.000Z'),
          reused: false,
        }),
        findPasswordChangeRequest: async () => ({
          requestId,
          userId,
          status: 'approved',
          expiresAt: '2035-01-01T00:00:00.000Z',
          requestType: 'password_change',
        }),
        completePasswordChange: async (payload) => {
          repoCalls.push(payload);
        },
      },
      eventBus: {
        emitUserRequestUpdated: () => {},
      },
      auditLog: (event, payload) => auditEvents.push({ event, payload }),
    });

    let finalized = false;
    const authSession = {
      beginPasswordChangeApproval: async ({ userId: value, requestId: request }) => {
        assert.equal(value, userId);
        assert.equal(request, requestId);
      },
      finalizePasswordChange: async () => {
        finalized = true;
      },
    };

    const requestResult = await passwordService.changePassword({
      username: 'user',
      currentPassword,
      newPassword: nextPassword,
      authSession,
      passwordChangeRequestId: null,
      attemptTracker: {
        dummyBcryptHash: 'dummy',
        isBlocked: () => false,
        registerFailedAttempt: () => {
          throw new Error('should not register failed attempt');
        },
        resetFailedAttempts: () => {},
      },
      requestMeta: { reqId: 'req-password' },
    });

    assert.equal(requestResult.status, 202);

    const approvedFollowup = await passwordService.changePassword({
      username: 'user',
      currentPassword,
      newPassword: nextPassword,
      authSession,
      passwordChangeRequestId: requestId,
      attemptTracker: {
        dummyBcryptHash: 'dummy',
        isBlocked: () => false,
        registerFailedAttempt: () => {
          throw new Error('should not register failed attempt');
        },
        resetFailedAttempts: () => {},
      },
      requestMeta: { reqId: 'req-password-approved' },
    });

    assert.equal(approvedFollowup.status, 200);
    assert.equal(finalized, true);
    assert.deepEqual(repoCalls, [
      {
        userId,
        requestId,
        hashedNewPassword: `hashed:${nextPassword}`,
      },
    ]);
    assert.ok(auditEvents.some((entry) => entry.event === 'auth.password_change.requested'));
    assert.ok(auditEvents.some((entry) => entry.event === 'auth.password_change.success'));

    const approvalService = createApprovalService({
      repository: {
        userHasPermission: async () => true,
        resolveApprovalRequest: async () => ({
          kind: 'resolved',
          value: {
            requestId,
            userId,
            status: 'approved',
            requestType: 'password_change',
          },
        }),
      },
      eventBus: {
        emitApprovalResolved: () => {},
        emitUserRequestUpdated: () => {},
      },
      qrPayloadTtlSeconds: 30,
    });

    const approval = await approvalService.verifyAdminDecision({
      userId,
      requestId,
      decision: 'approved',
    });
    assert.equal(approval.status, 200);
  } finally {
    bcrypt.compare = originalCompare;
    bcrypt.hash = originalHash;
  }
});
