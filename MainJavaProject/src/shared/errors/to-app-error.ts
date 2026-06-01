let MulterError = null;
try {
  ({ MulterError } = require('multer'));
} catch {
  MulterError = null;
}
const { AppError } = require('./app-error');
const { ERROR_CODES } = require('./error-codes');
const { getErrorDefinition } = require('./error-catalog');
const { normalizeErrorDetails } = require('./error-details');

function normalizeErrorCode(rawCode) {
  if (rawCode === 'EBADCSRFTOKEN') return ERROR_CODES.EBADCSRFTOKEN;
  if (rawCode === 'VALIDATION_ERROR') return ERROR_CODES.VALIDATION_ERROR;
  if (rawCode === 'UNAUTHORIZED') return ERROR_CODES.UNAUTHORIZED;
  if (typeof rawCode === 'string' && getErrorDefinition(rawCode)) return rawCode;
  return null;
}

function mapMulterError(error) {
  if (!MulterError || !(error instanceof MulterError)) return null;
  const code = error.code === 'LIMIT_FILE_SIZE' ? ERROR_CODES.UPLOAD_TOO_LARGE : ERROR_CODES.UPLOAD_ERROR;
  const definition = getErrorDefinition(code);
  return new AppError({
    status: definition.status,
    code,
    message: definition.defaultMessage,
    details: normalizeErrorDetails(error.details),
    cause: error,
  });
}

function createToAppError() {
  return function toAppError(err) {
    if (!err) return new AppError();
    if (err instanceof AppError) return err;

    const multerError = mapMulterError(err);
    if (multerError) return multerError;

    const normalizedCode = normalizeErrorCode(err.code);
    const definition = getErrorDefinition(normalizedCode || err.code) || getErrorDefinition(ERROR_CODES.INTERNAL_ERROR);

    return new AppError({
      status: Number.isInteger(err.status) ? err.status : definition.status,
      code: normalizedCode || definition.code,
      message: err.message || definition.defaultMessage,
      details: normalizeErrorDetails(err.details, { code: normalizedCode || definition.code }),
      cause: err,
    });
  };
}

const toAppError = createToAppError();

module.exports = { createToAppError, toAppError };
