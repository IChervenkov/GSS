const {
  isBlockedSession,
  registerFailedAttempt,
  resetFailedAttempts,
  DUMMY_BCRYPT_HASH,
} = require('../../domain/auth.blocker');
const { buildAuthSession } = require('../../infrastructure/session/auth.session');
const sessionUtils = require('../../../../../shared/utils/session-utils');

function buildAuthRequestContext(req) {
  return {
    authSession: buildAuthSession(req, sessionUtils),
    attemptTracker: {
      dummyBcryptHash: DUMMY_BCRYPT_HASH,
      isBlocked: () => isBlockedSession(req),
      registerFailedAttempt: () => registerFailedAttempt(req),
      resetFailedAttempts: () => resetFailedAttempts(req),
    },
  };
}

module.exports = { buildAuthRequestContext };
