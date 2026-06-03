// @ts-nocheck
const { normalizeErrorDetails } = require('./error-details');

class AppError extends Error {
  constructor({
    status = 500,
    code = 'INTERNAL_ERROR',
    message = 'Internal server error',
    details = [],
    cause,
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = normalizeErrorDetails(details, { code });
    this.cause = cause;
    Error.captureStackTrace?.(this, AppError);
  }
}

module.exports = { AppError };
