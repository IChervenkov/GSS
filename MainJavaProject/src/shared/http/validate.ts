const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');
const { normalizeValidationDetail } = require('../errors/error-details');

function getValidationInput(req, source) {
  const value = req[source];
  if (source !== 'body' || !value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const { _csrf, ...body } = value;
  return body;
}

module.exports = function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(getValidationInput(req, source));
    if (error) {
      return next(
        new AppError({
          status: 422,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid input format.',
          details: (error.details || []).map((detail) => normalizeValidationDetail(detail)),
        }),
      );
    }
    if (source === 'query') {
      Object.defineProperty(req, 'query', {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    } else {
      req[source] = value;
    }
    return next();
  };
};
