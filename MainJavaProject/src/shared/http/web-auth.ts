const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');
const { isSessionExpired } = require('../utils/session-utils');
const { isAuthenticated, hasPendingTwoFactor } = require('../session/web-session-state');

const PUBLIC_PATHS = new Set(['/login', '/password/change/data', '/password/change']);
const PENDING_2FA_PATHS = new Set([
  '/login/verify/data',
  '/login/request-qr',
  '/login/request-qr/payload',
  '/verify',
]);

function requireWebAuth() {
  return (req, _res, next) => {
    if (isSessionExpired(req)) {
      return next(
        new AppError({
          status: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Security check failed. Please sign in again.',
        }),
      );
    }
    if (PUBLIC_PATHS.has(req.path)) return next();
    if (PENDING_2FA_PATHS.has(req.path) && hasPendingTwoFactor(req)) return next();
    if (isAuthenticated(req)) return next();

    return next(
      new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Security check failed. Please sign in again.',
      }),
    );
  };
}

module.exports = { requireWebAuth, PUBLIC_PATHS, PENDING_2FA_PATHS };
