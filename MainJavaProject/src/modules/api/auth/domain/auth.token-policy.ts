const { AppError } = require('../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../shared/errors/error-codes');

function ensureRefreshTokenPresent(refreshToken) {
  if (!refreshToken) {
    throw new AppError({
      status: 401,
      code: ERROR_CODES.MISSING_REFRESH_TOKEN,
      message: 'Refresh token is required.',
    });
  }
}

module.exports = { ensureRefreshTokenPresent };
