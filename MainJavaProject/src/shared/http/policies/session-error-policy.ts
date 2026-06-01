const { getErrorDefinition } = require('../../errors/error-catalog');
const { AUDIT_EVENT_NAMES } = require('../../security/audit-event-names');

function createSessionErrorPolicy({
  redirectTo = '/',
  auditEvent = AUDIT_EVENT_NAMES.SECURITY.SESSION_INVALIDATED,
  authFailureCodes = ['INVALID_CREDENTIALS', 'UNAUTHORIZED', 'INVALID_TOKEN', 'INVALID_REFRESH_TOKEN'],
} = {}) {
  const authFailureCodeSet = new Set(authFailureCodes);

  return Object.freeze({
    redirectTo,
    auditEvent,
    isAuthFailure(appErr) {
      return authFailureCodeSet.has(appErr?.code);
    },
    shouldInvalidate(appErr) {
      return Boolean(getErrorDefinition(appErr?.code)?.invalidateSession);
    },
  });
}

module.exports = { createSessionErrorPolicy };