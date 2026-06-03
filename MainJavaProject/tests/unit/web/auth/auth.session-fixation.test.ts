// @ts-nocheck
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAuthSession } = require('../../../../src/modules/web/auth/infrastructure/session/auth.session');

test('auth session regenerates on pending-login, login-complete, password-finalize, and privilege-rotation transitions', async () => {
  const req = { session: { userId: 'legacy-user', csrfToken: 'csrf-1' } };
  const calls = [];
  const sessionUtils = {
    saveSession: async () => {
      calls.push('save');
    },
    regenerateSession: async () => {
      calls.push('regenerate');
    },
  };

  const authSession = buildAuthSession(req, sessionUtils);

  await authSession.transitionToPendingTwoFactor({ userId: 'user-1' });
  assert.equal(req.session.pendingUserId, 'user-1');
  assert.equal(req.session.userId, undefined);
  assert.equal(req.session.csrfToken, undefined);

  await authSession.completeTwoFactorAuthentication({ userId: 'user-1' });
  assert.equal(req.session.userId, 'user-1');
  assert.equal(req.session.pendingUserId, undefined);

  await authSession.beginPasswordChangeApproval({ userId: 'user-1', requestId: 'request-1' });
  assert.equal(req.session.pendingPasswordChangeRequestId, 'request-1');

  await authSession.finalizePasswordChange();
  assert.equal(req.session.pendingPasswordChangeRequestId, undefined);
  assert.equal(req.session.userId, undefined);

  await authSession.rotateAfterPrivilegeChange({ userId: 'user-2' });
  assert.equal(req.session.userId, 'user-2');

  assert.deepEqual(calls, [
    'regenerate',
    'save',
    'regenerate',
    'save',
    'save',
    'regenerate',
    'save',
    'regenerate',
    'save',
  ]);
});
