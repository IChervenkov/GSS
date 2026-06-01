const test = require('node:test');
const assert = require('node:assert/strict');

const state = require('../../../src/shared/session/web-session-state');
const { getSessionCookieOptions } = require('../../../src/shared/utils/session-utils');
const { buildAuthSession } = require('../../../src/modules/web/auth/infrastructure/session/auth.session');

function createSessionReq() {
  return {
    session: {
      regenerate(callback) {
        const preservedAbsoluteExpiresAt = this.absoluteExpiresAt;
        this.userId = undefined;
        this.pendingUserId = undefined;
        this.secret = undefined;
        this.qrCodeDataURL = undefined;
        this.verifyChallengeExpiresAt = undefined;
        this.qrRequestId = undefined;
        this.qrPayloadConsumedAt = undefined;
        this.pendingPasswordChangeRequestId = undefined;
        this.pendingPasswordChangeUserId = undefined;
        this.csrfToken = undefined;
        if (preservedAbsoluteExpiresAt) this.absoluteExpiresAt = preservedAbsoluteExpiresAt;
        callback(null);
      },
      save(callback) {
        callback(null);
      },
    },
  };
}

const sessionUtils = {
  regenerateSession: (req) =>
    new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve()))),
  saveSession: (req) =>
    new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve()))),
};

test('web session state clears pending auth fields when completing two-factor login', async () => {
  const req = createSessionReq();
  req.session.pendingUserId = 'user-1';
  req.session.secret = 'secret-1';
  req.session.qrCodeDataURL = 'data:image/png;base64,abc';
  req.session.verifyChallengeExpiresAt = Date.now() + 30_000;
  req.session.pendingPasswordChangeRequestId = 'request-1';
  req.session.pendingPasswordChangeUserId = 'user-1';
  req.session.csrfToken = 'csrf-1';

  const authSession = buildAuthSession(req, sessionUtils);
  await authSession.completeTwoFactorAuthentication({ userId: 'user-1' });

  assert.equal(state.getAuthenticatedUserId(req), 'user-1');
  assert.equal(state.getPendingUserId(req), null);
  assert.deepEqual(state.getVerifyChallenge(req), {
    secret: null,
    qrCodeDataURL: null,
    expiresAt: null,
    qrRequestId: null,
    qrPayloadConsumedAt: null,
  });
  assert.equal(state.getPendingPasswordChangeRequestId(req), null);
  assert.equal(req.session.csrfToken, undefined);
});

test('auth session finalizePasswordChange regenerates and clears all auth state', async () => {
  const req = createSessionReq();
  req.session.userId = 'user-1';
  req.session.pendingPasswordChangeRequestId = 'request-1';
  req.session.pendingPasswordChangeUserId = 'user-1';
  req.session.csrfToken = 'csrf-1';

  const authSession = buildAuthSession(req, sessionUtils);
  await authSession.finalizePasswordChange();

  assert.equal(state.getAuthenticatedUserId(req), null);
  assert.equal(state.getPendingPasswordChangeRequestId(req), null);
  assert.equal(req.session.csrfToken, undefined);
});

test('consumeQrPayload records reveal time without deleting active challenge payload', async () => {
  const req = createSessionReq();
  req.session.qrCodeDataURL = 'data:image/png;base64,abc';

  state.consumeQrPayload(req);

  assert.equal(state.getVerifyChallenge(req).qrCodeDataURL, 'data:image/png;base64,abc');
  assert.equal(typeof state.getVerifyChallenge(req).qrPayloadConsumedAt, 'number');
});

test('getSessionCookieOptions uses explicit environment overrides', () => {
  assert.deepEqual(
    getSessionCookieOptions({
      isProd: true,
      SESSION_COOKIE_SECURE: false,
      SESSION_COOKIE_SAME_SITE: 'strict',
      SESSION_COOKIE_DOMAIN: 'example.com',
      SESSION_COOKIE_PATH: '/web',
    }),
    {
      path: '/web',
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      domain: 'example.com',
    },
  );
});
