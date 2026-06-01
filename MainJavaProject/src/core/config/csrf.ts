const { csrfSync } = require('csrf-sync');
const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const { generateToken, csrfSynchronisedProtection } = csrfSync({
  ignoredMethods: [...SAFE_METHODS],
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] || req.headers['csrf-token'] || req.body?._csrf || null,
  getTokenFromState: (req) => req.session?.csrfToken || null,
  storeTokenInState: (req, token) => {
    if (req.session) req.session.csrfToken = token;
  },
  size: 64,
});

function ensureCsrfToken(req) {
  if (!req.session) {
    throw new AppError({
      status: 403,
      code: ERROR_CODES.EBADCSRFTOKEN,
      message: 'Security check failed. Please sign in again.',
    });
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken(req);
  }
  return req.session.csrfToken;
}

function attachCsrfToken() {
  return (req, res, next) => {
    try {
      res.locals.csrfToken = ensureCsrfToken(req);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  generateToken,
  ensureCsrfToken,
  csrfSynchronisedProtection,
  attachCsrfToken,
};
