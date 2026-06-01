const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  createPasswordChangeService,
} = require('../../../../src/modules/web/auth/application/services/password-change.service');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

const buildFixture = (name) => `fixture-${name}`;
const currentPassword = buildFixture('current-pass-A1!');
const nextPassword = buildFixture('next-pass-B2!');
const storedPasswordHash = buildFixture('stored-password-hash');

const userId = '11111111-1111-1111-1111-111111111111';
const requestId = '22222222-2222-2222-2222-222222222222';

test('password change request stores realtime requester identity and emits pending status', async () => {
  const originalCompare = bcrypt.compare;
  const compareCalls = [];
  bcrypt.compare = async (plain, hashed) => {
    compareCalls.push({ plain, hashed });
    return plain === currentPassword && hashed === storedPasswordHash;
  };

  const calls = [];
  const emitted = [];

  try {
    const service = createPasswordChangeService({
      env: { BCRYPT_ROUNDS: 10 },
      repository: {
        findUserByUsername: async (username) => ({
          id: userId,
          username,
          password: storedPasswordHash,
          temporaryPassword: null,
        }),
        createApprovalRequest: async () => ({
          requestId,
          expiresAt: new Date('2035-01-01T00:00:00.000Z'),
          reused: false,
        }),
      },
      eventBus: {
        emitUserRequestUpdated(payload) {
          emitted.push(payload);
        },
      },
    });

    const result = await service.changePassword({
      username: 'tester',
      currentPassword,
      newPassword: nextPassword,
      authSession: {
        beginPasswordChangeApproval: async ({ userId: value, requestId: request }) => {
          calls.push(`request:${request}`);
          calls.push(`user:${value}`);
          calls.push('save');
        },
      },
      attemptTracker: {
        dummyBcryptHash: 'dummy',
        isBlocked: () => false,
        registerFailedAttempt: () => {
          throw new Error('should not fail');
        },
        resetFailedAttempts: () => {
          throw new Error('should not reset');
        },
      },
      requestMeta: { reqId: 'req-1' },
    });

    assert.equal(result.status, 202);
    assert.deepEqual(calls, [`request:${requestId}`, `user:${userId}`, 'save']);
    assert.deepEqual(emitted, [
      {
        requestId,
        requestType: 'password_change',
        status: 'pending',
        expiresAt: new Date('2035-01-01T00:00:00.000Z'),
        userId,
        version: 1,
      },
    ]);
    assert.deepEqual(compareCalls, [{ plain: currentPassword, hashed: storedPasswordHash }]);
  } finally {
    bcrypt.compare = originalCompare;
  }
});

test('password change rejects new password matching the other stored credential', async () => {
  const originalCompare = bcrypt.compare;
  const permanentPassword = buildFixture('permanent-pass-C3!');
  bcrypt.compare = async (plain, hashed) =>
    (plain === currentPassword && hashed === 'temporary-hash') ||
    (plain === permanentPassword && hashed === storedPasswordHash);

  try {
    const service = createPasswordChangeService({
      env: { BCRYPT_ROUNDS: 10 },
      repository: {
        findUserByUsername: async (username) => ({
          id: userId,
          username,
          password: storedPasswordHash,
          temporaryPassword: 'temporary-hash',
        }),
      },
      eventBus: {},
    });

    await assert.rejects(
      () =>
        service.changePassword({
          username: 'tester',
          currentPassword,
          newPassword: permanentPassword,
          authSession: {},
          attemptTracker: {
            dummyBcryptHash: 'dummy',
            isBlocked: () => false,
            registerFailedAttempt: () => {
              throw new Error('should not fail');
            },
            resetFailedAttempts: () => {},
          },
        }),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, ERROR_CODES.SAME_PASSWORD);
        return true;
      },
    );
  } finally {
    bcrypt.compare = originalCompare;
  }
});

test('password change rejects locked accounts before approval flow starts', async () => {
  const service = createPasswordChangeService({
    env: { BCRYPT_ROUNDS: 10 },
    repository: {
      findUserByUsername: async (username) => ({
        id: userId,
        username,
        password: storedPasswordHash,
        temporaryPassword: null,
        isLocked: true,
      }),
    },
    eventBus: {},
  });

  await assert.rejects(
    () =>
      service.changePassword({
        username: 'tester',
        currentPassword,
        newPassword: nextPassword,
        authSession: {
          save: async () => {},
        },
        attemptTracker: {
          dummyBcryptHash: 'dummy',
          isBlocked: () => false,
          registerFailedAttempt: () => {
            throw new Error('should not fail');
          },
          resetFailedAttempts: () => {
            throw new Error('should not reset');
          },
        },
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 423);
      assert.equal(error.code, ERROR_CODES.ACCOUNT_LOCKED);
      return true;
    },
  );
});
