const SESSION_FIELDS = Object.freeze({
  USER_ID: 'userId',
  CSRF_TOKEN: 'csrfToken',
  ABSOLUTE_EXPIRES_AT: 'absoluteExpiresAt',
  PENDING_USER_ID: 'pendingUserId',
  VERIFY_SECRET: 'secret',
  VERIFY_QR_CODE_DATA_URL: 'qrCodeDataURL',
  VERIFY_CHALLENGE_EXPIRES_AT: 'verifyChallengeExpiresAt',
  QR_REQUEST_ID: 'qrRequestId',
  QR_PAYLOAD_CONSUMED_AT: 'qrPayloadConsumedAt',
  PENDING_PASSWORD_CHANGE_USER_ID: 'pendingPasswordChangeUserId',
  PENDING_PASSWORD_CHANGE_REQUEST_ID: 'pendingPasswordChangeRequestId',
});

function getSession(reqOrSession) {
  if (!reqOrSession) return null;
  return reqOrSession.session || reqOrSession;
}

function deleteField(session, field) {
  if (!session) return;
  delete session[field];
}

function clearCsrfToken(session) {
  deleteField(session, SESSION_FIELDS.CSRF_TOKEN);
}

function getAuthenticatedUserId(reqOrSession) {
  const session = getSession(reqOrSession);
  return session?.[SESSION_FIELDS.USER_ID] || null;
}

function getPendingUserId(reqOrSession) {
  const session = getSession(reqOrSession);
  return session?.[SESSION_FIELDS.PENDING_USER_ID] || null;
}

function getPendingPasswordChangeRequestId(reqOrSession) {
  const session = getSession(reqOrSession);
  return session?.[SESSION_FIELDS.PENDING_PASSWORD_CHANGE_REQUEST_ID] || null;
}

function getPendingPasswordChangeUserId(reqOrSession) {
  const session = getSession(reqOrSession);
  return session?.[SESSION_FIELDS.PENDING_PASSWORD_CHANGE_USER_ID] || null;
}

function getVerifyChallenge(reqOrSession) {
  const session = getSession(reqOrSession);
  if (!session) {
    return {
      secret: null,
      qrCodeDataURL: null,
      expiresAt: null,
      qrRequestId: null,
      qrPayloadConsumedAt: null,
    };
  }

  return {
    secret: session[SESSION_FIELDS.VERIFY_SECRET] || null,
    qrCodeDataURL: session[SESSION_FIELDS.VERIFY_QR_CODE_DATA_URL] || null,
    expiresAt: session[SESSION_FIELDS.VERIFY_CHALLENGE_EXPIRES_AT] || null,
    qrRequestId: session[SESSION_FIELDS.QR_REQUEST_ID] || null,
    qrPayloadConsumedAt: session[SESSION_FIELDS.QR_PAYLOAD_CONSUMED_AT] || null,
  };
}

function isAuthenticated(reqOrSession) {
  return Boolean(getAuthenticatedUserId(reqOrSession));
}

function hasPendingTwoFactor(reqOrSession) {
  return Boolean(getPendingUserId(reqOrSession));
}

function clearVerifyChallenge(reqOrSession) {
  const session = getSession(reqOrSession);
  if (!session) return;
  deleteField(session, SESSION_FIELDS.VERIFY_QR_CODE_DATA_URL);
  deleteField(session, SESSION_FIELDS.VERIFY_SECRET);
  deleteField(session, SESSION_FIELDS.VERIFY_CHALLENGE_EXPIRES_AT);
  deleteField(session, SESSION_FIELDS.QR_REQUEST_ID);
  deleteField(session, SESSION_FIELDS.QR_PAYLOAD_CONSUMED_AT);
}

function clearPendingPasswordChange(reqOrSession) {
  const session = getSession(reqOrSession);
  if (!session) return;
  deleteField(session, SESSION_FIELDS.PENDING_PASSWORD_CHANGE_REQUEST_ID);
  deleteField(session, SESSION_FIELDS.PENDING_PASSWORD_CHANGE_USER_ID);
}

function clearPendingAuth(reqOrSession) {
  const session = getSession(reqOrSession);
  if (!session) return;
  deleteField(session, SESSION_FIELDS.PENDING_USER_ID);
  clearVerifyChallenge(session);
}

function clearAuthenticatedUser(reqOrSession) {
  const session = getSession(reqOrSession);
  if (!session) return;
  deleteField(session, SESSION_FIELDS.USER_ID);
}

function clearAllAuthState(reqOrSession) {
  const session = getSession(reqOrSession);
  if (!session) return;
  clearAuthenticatedUser(session);
  clearPendingAuth(session);
  clearPendingPasswordChange(session);
  clearCsrfToken(session);
}

function beginPendingLogin(reqOrSession, { userId }) {
  const session = getSession(reqOrSession);
  if (!session) return;
  clearAllAuthState(session);
  session[SESSION_FIELDS.PENDING_USER_ID] = userId;
}

function beginVerifyChallenge(reqOrSession, { secret, qrCodeDataURL, expiresAt, qrRequestId = null }) {
  const session = getSession(reqOrSession);
  if (!session) return;
  session[SESSION_FIELDS.VERIFY_SECRET] = secret;
  session[SESSION_FIELDS.VERIFY_QR_CODE_DATA_URL] = qrCodeDataURL;
  session[SESSION_FIELDS.VERIFY_CHALLENGE_EXPIRES_AT] = expiresAt;
  session[SESSION_FIELDS.QR_REQUEST_ID] = qrRequestId;
  session[SESSION_FIELDS.QR_PAYLOAD_CONSUMED_AT] = null;
}

function consumeQrPayload(reqOrSession) {
  const session = getSession(reqOrSession);
  if (!session) return;
  session[SESSION_FIELDS.QR_PAYLOAD_CONSUMED_AT] = Date.now();
}

function completeTwoFactorLogin(reqOrSession, { userId }) {
  const session = getSession(reqOrSession);
  if (!session) return;
  clearAllAuthState(session);
  session[SESSION_FIELDS.USER_ID] = userId;
}

function beginPasswordChangeApproval(reqOrSession, { userId, requestId }) {
  const session = getSession(reqOrSession);
  if (!session) return;
  clearPendingPasswordChange(session);
  session[SESSION_FIELDS.PENDING_PASSWORD_CHANGE_USER_ID] = userId;
  session[SESSION_FIELDS.PENDING_PASSWORD_CHANGE_REQUEST_ID] = requestId;
}

function getSessionPrincipalId(reqOrSession) {
  return (
    getAuthenticatedUserId(reqOrSession) ||
    getPendingUserId(reqOrSession) ||
    getPendingPasswordChangeUserId(reqOrSession) ||
    null
  );
}

module.exports = {
  SESSION_FIELDS,
  getAuthenticatedUserId,
  getPendingUserId,
  getPendingPasswordChangeRequestId,
  getPendingPasswordChangeUserId,
  getVerifyChallenge,
  isAuthenticated,
  hasPendingTwoFactor,
  clearCsrfToken,
  clearVerifyChallenge,
  clearPendingPasswordChange,
  clearPendingAuth,
  clearAuthenticatedUser,
  clearAllAuthState,
  beginPendingLogin,
  beginVerifyChallenge,
  consumeQrPayload,
  completeTwoFactorLogin,
  beginPasswordChangeApproval,
  getSessionPrincipalId,
};
