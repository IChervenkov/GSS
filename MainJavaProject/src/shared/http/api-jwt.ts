const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');
const { verifyAccessToken } = require('../../modules/api/auth/infrastructure/security/auth.tokens');
const { AUDIT_EVENT_NAMES } = require('../security/audit-event-names');

function createApiJwt(options = {}) {
  const resolved = options?.env ? options : { env: options };
  const { env, repository, auditLog } = resolved;
  if (!env?.ACCESS_TOKEN_SECRET) {
    throw new Error('ACCESS_TOKEN_SECRET is required');
  }

  return (req, _res, next) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token) {
      throw new AppError({ status: 401, code: 'MISSING_TOKEN', message: 'Missing bearer token' });
    }

    const principal = verifyAccessToken(env, token);

    const finalize = () => {
      req.user = principal;
      req.auth = principal;
      next();
    };

    if (typeof repository?.getUserTokenState !== 'function') {
      finalize();
      return;
    }

    Promise.resolve(repository.getUserTokenState(principal.id))
      .then((tokenState) => {
        if (!tokenState || Number(tokenState.tokenVersion || 0) !== Number(principal.tokenVersion || 0)) {
          auditLog?.(AUDIT_EVENT_NAMES.AUTH.ACCESS_TOKEN_REJECTED, {
            actorUserId: principal.id,
            targetUserId: principal.id,
            tokenJti: principal.jti,
            tokenVersion: principal.tokenVersion,
            reason: 'token_version_mismatch',
            method: req.method,
            path: req.originalUrl || req.url,
          });
          throw new AppError({ status: 403, code: ERROR_CODES.INVALID_TOKEN, message: 'Invalid or expired token' });
        }
        finalize();
      })
      .catch(next);
  };
}

module.exports = { createApiJwt };