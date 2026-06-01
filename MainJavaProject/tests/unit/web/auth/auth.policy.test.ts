const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  ensureStrongPassword,
  ensureNewPasswordIsNotCurrent,
  checkSystemPermission,
} = require('../../../../src/modules/web/auth/domain/auth.policy');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

test('ensureStrongPassword accepts industrial-grade password and rejects weak one', async () => {
  assert.doesNotThrow(() => ensureStrongPassword('Strong#Password123'));

  assert.throws(
    () => ensureStrongPassword('weak'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 422);
      assert.equal(error.code, ERROR_CODES.WEAK_PASSWORD);
      return true;
    },
  );
});

test('ensureNewPasswordIsNotCurrent rejects password equal to current hash', async () => {
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async (plain, hashed) =>
    plain === 'Strong#Password123' && hashed === 'current-hash';
  try {
    await assert.rejects(
      () => ensureNewPasswordIsNotCurrent('Strong#Password123', 'current-hash', null, 'dummy'),
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

test('checkSystemPermission denies callers without Admin permission', async () => {
  await assert.rejects(
    () =>
      checkSystemPermission(
        { userHasPermission: async () => false },
        '11111111-1111-1111-1111-111111111111',
      ),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 403);
      assert.equal(error.code, ERROR_CODES.PERMISSION_DENIED);
      return true;
    },
  );
});
