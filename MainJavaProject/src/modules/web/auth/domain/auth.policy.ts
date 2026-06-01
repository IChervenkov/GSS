const bcrypt = require('bcryptjs');
const { AppError } = require('../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../shared/errors/error-codes');
const { MAIN_PERMISSIONS } = require('../../main-page/domain/main.permissions');

const STRONG_PASSWORD_PATTERN =
  /^(?=.{12,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

async function ensureDifferentPassword(currentPassword, newPassword) {
  return currentPassword !== newPassword;
}

function ensureStrongPassword(password) {
  if (!STRONG_PASSWORD_PATTERN.test(String(password || ''))) {
    throw new AppError({
      status: 422,
      code: ERROR_CODES.WEAK_PASSWORD,
      message: 'Password does not meet the security policy.',
      details: [{ message: 'Use 12-128 characters with upper, lower, number and symbol.' }],
    });
  }
}

async function ensureNewPasswordIsNotCurrent(
  newPassword,
  passwordHash,
  temporaryPasswordHash,
  dummyHash,
) {
  const hashes = [passwordHash, temporaryPasswordHash].filter(Boolean);
  if (hashes.length === 0) {
    await bcrypt.compare(newPassword, dummyHash);
    return;
  }

  const [matchesCurrent, matchesTemporary] = await Promise.all(
    hashes.map((hash) => bcrypt.compare(newPassword, hash)),
  );

  if (matchesCurrent || matchesTemporary) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.SAME_PASSWORD,
      message: 'New password must be different from the current and temporary password.',
    });
  }
}

async function checkSystemPermission(repository, userId) {
  const allowed = await repository.userHasPermission(userId, MAIN_PERMISSIONS.system);
  if (!allowed) {
    throw new AppError({
      status: 403,
      code: ERROR_CODES.PERMISSION_DENIED,
      message: 'You do not have permission to perform this action.',
    });
  }
}

module.exports = {
  STRONG_PASSWORD_PATTERN,
  ensureDifferentPassword,
  ensureStrongPassword,
  ensureNewPasswordIsNotCurrent,
  checkSystemPermission,
};
