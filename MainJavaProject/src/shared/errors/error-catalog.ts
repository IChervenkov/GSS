const ERROR_DEFINITIONS = Object.freeze([
  { code: 'INTERNAL_ERROR', status: 500, defaultMessage: 'Internal server error' },
  { code: 'VALIDATION_ERROR', status: 422, defaultMessage: 'Invalid input format.' },
  { code: 'NOT_FOUND', status: 404, defaultMessage: 'The requested resource was not found.' },
  { code: 'METHOD_NOT_ALLOWED', status: 405, defaultMessage: 'Method not allowed.' },
  { code: 'UNAUTHORIZED', status: 401, defaultMessage: 'Unauthorized', invalidateSession: true },
  { code: 'FORBIDDEN', status: 403, defaultMessage: 'Forbidden.' },
  {
    code: 'EBADCSRFTOKEN',
    status: 403,
    defaultMessage: 'Security check failed. Please sign in again.',
    invalidateSession: true,
  },
  { code: 'INVALID_CREDENTIALS', status: 401, defaultMessage: 'Invalid username or password.' },
  { code: 'ACCOUNT_LOCKED', status: 423, defaultMessage: 'Account is locked.' },
  { code: 'BLOCKED_SESSION', status: 403, defaultMessage: 'Session is blocked.' },
  { code: 'INVALID_CODE', status: 401, defaultMessage: 'Invalid verification code.' },
  { code: 'MISSING_USER', status: 401, defaultMessage: 'Missing authenticated user.' },
  { code: 'REQUEST_ID_REQUIRED', status: 400, defaultMessage: 'Request id is required.' },
  { code: 'REQUEST_NOT_FOUND', status: 404, defaultMessage: 'Request was not found.' },
  { code: 'REQUEST_EXPIRED', status: 410, defaultMessage: 'Request has expired.' },
  { code: 'REQUEST_DENIED', status: 403, defaultMessage: 'Request was denied.' },
  { code: 'REQUEST_ALREADY_RESOLVED', status: 409, defaultMessage: 'Request was already resolved.' },
  { code: 'QR_NOT_AVAILABLE', status: 404, defaultMessage: 'QR payload is not available.' },
  { code: 'INVALID_DECISION', status: 422, defaultMessage: 'Decision is invalid.' },
  { code: 'PERMISSION_DENIED', status: 403, defaultMessage: 'Permission denied.' },
  { code: 'SAME_PASSWORD', status: 409, defaultMessage: 'New password must be different.' },
  { code: 'WEAK_PASSWORD', status: 422, defaultMessage: 'Password does not meet policy requirements.' },
  { code: 'RATE_LIMITED', status: 429, defaultMessage: 'Too many requests. Please try again later.' },
  { code: 'MISSING_REFRESH_TOKEN', status: 401, defaultMessage: 'Refresh token is required.' },
  {
    code: 'INVALID_REFRESH_TOKEN',
    status: 403,
    defaultMessage: 'Refresh session is invalid or expired.',
    invalidateSession: true,
  },
  {
    code: 'INVALID_TOKEN',
    status: 403,
    defaultMessage: 'Invalid or expired token',
    invalidateSession: true,
  },
  {
    code: 'ACCESS_TOKEN_EXPIRED',
    status: 401,
    defaultMessage: 'Access token has expired.',
  },
  { code: 'INVALID_TOKEN_TYPE', status: 403, defaultMessage: 'Invalid token type.' },
  { code: 'SESSION_UNAVAILABLE', status: 503, defaultMessage: 'Session storage is unavailable.' },
  { code: 'UPLOAD_TOO_LARGE', status: 413, defaultMessage: 'File too large.' },
  { code: 'UPLOAD_ERROR', status: 400, defaultMessage: 'Upload error.' },
]);

function validateCatalog(definitions) {
  const seen = new Set();
  for (const definition of definitions) {
    if (!definition?.code) {
      throw new Error('Error catalog entry is missing a code.');
    }
    if (seen.has(definition.code)) {
      throw new Error(`Duplicate error code detected: ${definition.code}`);
    }
    seen.add(definition.code);
    if (!Number.isInteger(definition.status) || definition.status < 400 || definition.status > 599) {
      throw new Error(`Invalid HTTP status for error code ${definition.code}`);
    }
    if (!definition.defaultMessage || !String(definition.defaultMessage).trim()) {
      throw new Error(`Missing default message for error code ${definition.code}`);
    }
  }
  return definitions;
}

const VALIDATED_ERROR_DEFINITIONS = Object.freeze(validateCatalog([...ERROR_DEFINITIONS]));
const ERROR_CATALOG = Object.freeze(
  Object.fromEntries(VALIDATED_ERROR_DEFINITIONS.map((definition) => [definition.code, Object.freeze({ ...definition })])),
);

function getErrorDefinition(code) {
  if (!code) return ERROR_CATALOG.INTERNAL_ERROR;
  return ERROR_CATALOG[code] || null;
}

module.exports = {
  ERROR_CATALOG,
  ERROR_DEFINITIONS: VALIDATED_ERROR_DEFINITIONS,
  getErrorDefinition,
};
