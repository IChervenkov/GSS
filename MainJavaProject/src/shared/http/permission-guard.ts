const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');

function buildUnauthorizedError() {
  return new AppError({
    status: 401,
    code: ERROR_CODES.UNAUTHORIZED,
    message: 'Security check failed. Please sign in again.',
  });
}

function buildPermissionDeniedError() {
  return new AppError({
    status: 403,
    code: ERROR_CODES.PERMISSION_DENIED,
    message: 'You do not have permission to perform this action.',
  });
}

function normalizePermissionNames(permissionNames) {
  const values = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
  return values.map((value) => String(value || '').trim()).filter(Boolean);
}

function requireAnyPermission(checker, permissionNames) {
  if (typeof checker !== 'function') throw new Error('Permission checker is required');

  const names = normalizePermissionNames(permissionNames);
  if (names.length === 0) throw new Error('At least one permission name is required');

  return async (req, _res, next) => {
    const userId = req.session?.userId;
    if (!userId) {
      return next(buildUnauthorizedError());
    }

    const results = await Promise.all(names.map((name) => checker(userId, name)));
    if (!results.some(Boolean)) {
      return next(buildPermissionDeniedError());
    }

    return next();
  };
}

function requirePermission(checker, permissionName) {
  return requireAnyPermission(checker, [permissionName]);
}

module.exports = { requirePermission, requireAnyPermission };
