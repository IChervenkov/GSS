const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  createLoginService,
} = require('../../../../src/modules/web/auth/application/services/login.service');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

const buildFixture = (name) => `fixture-${name}`;
const validPassword = buildFixture('login-pass-A1!');
const storedPasswordHash = buildFixture('stored-password-hash');

test('login service returns redirect and resets attempts for valid password', async () => {
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async (plain, hashed) =>
    plain === validPassword && hashed === storedPasswordHash;

  const repository = {
    findUserByUsername: async (username) => ({
      id: '11111111-1111-1111-1111-111111111111',
      username,
      password: storedPasswordHash,
      temporaryPassword: null,
    }),
  };

  const calls = [];
  const attemptTracker = {
    dummyBcryptHash: 'dummy',
    isBlocked: () => false,
    registerFailedAttempt: () => calls.push('registerFailedAttempt'),
    resetFailedAttempts: () => calls.push('resetFailedAttempts'),
  };
  const authSession = {
    transitionToPendingTwoFactor: async ({ userId }) => calls.push(`transitionToPendingTwoFactor:${userId}`),
  };

  try {
    const service = createLoginService({ repository });
    const result = await service.login({
      username: 'admin',
      password: validPassword,
      attemptTracker,
      authSession,
      requestMeta: { reqId: 'req-1' },
    });

    assert.deepEqual(result, {
      status: 200,
      body: { redirectTo: '/web/login/verify/data' },
    });
    assert.deepEqual(calls, [
      'resetFailedAttempts',
      'transitionToPendingTwoFactor:11111111-1111-1111-1111-111111111111',
    ]);
  } finally {
    bcrypt.compare = originalCompare;
  }
});

test('login service blocks invalid credentials and increments attempt tracker', async () => {
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async () => false;

  let failedAttempts = 0;
  const service = createLoginService({
    repository: {
      findUserByUsername: async () => null,
    },
  });

  try {
    await assert.rejects(
      () =>
        service.login({
          username: 'admin',
          password: 'wrong',
          attemptTracker: {
            dummyBcryptHash: 'dummy',
            isBlocked: () => false,
            registerFailedAttempt: () => {
              failedAttempts += 1;
            },
            resetFailedAttempts: () => {
              throw new Error('should not reset attempts');
            },
          },
          authSession: {
            transitionToPendingTwoFactor: async () => {},
          },
        }),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.status, 401);
        assert.equal(error.code, ERROR_CODES.INVALID_CREDENTIALS);
        return true;
      },
    );
    assert.equal(failedAttempts, 1);
  } finally {
    bcrypt.compare = originalCompare;
  }
});

test('login service rejects locked accounts before creating a pending session', async () => {
  const calls = [];
  const service = createLoginService({
    repository: {
      findUserByUsername: async (username) => ({
        id: '11111111-1111-1111-1111-111111111111',
        username,
        password: storedPasswordHash,
        temporaryPassword: null,
        isLocked: true,
      }),
    },
  });

  await assert.rejects(
    () =>
      service.login({
        username: 'locked.user',
        password: validPassword,
        attemptTracker: {
          dummyBcryptHash: 'dummy',
          isBlocked: () => false,
          registerFailedAttempt: () => calls.push('registerFailedAttempt'),
          resetFailedAttempts: () => calls.push('resetFailedAttempts'),
        },
        authSession: {
          transitionToPendingTwoFactor: async () => calls.push('transitionToPendingTwoFactor'),
        },
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 423);
      assert.equal(error.code, ERROR_CODES.ACCOUNT_LOCKED);
      return true;
    },
  );

  assert.deepEqual(calls, []);
});
