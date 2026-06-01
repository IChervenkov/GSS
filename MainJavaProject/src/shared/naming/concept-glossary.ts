const AUTH_REQUEST_TYPES = Object.freeze({
  QR_ENROLLMENT: 'show_qr',
  PASSWORD_CHANGE: 'password_change',
});

const AUTH_REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  EXPIRED: 'expired',
});

const SESSION_PRINCIPAL_FIELDS = Object.freeze({
  AUTHENTICATED_USER_ID: 'userId',
  PENDING_TWO_FACTOR_USER_ID: 'pendingUserId',
  PENDING_PASSWORD_CHANGE_USER_ID: 'pendingPasswordChangeUserId',
  PENDING_PASSWORD_CHANGE_REQUEST_ID: 'pendingPasswordChangeRequestId',
  VERIFICATION_CHALLENGE_SECRET: 'secret',
  VERIFICATION_CHALLENGE_QR_DATA_URL: 'qrCodeDataURL',
  VERIFICATION_CHALLENGE_EXPIRES_AT: 'verifyChallengeExpiresAt',
  VERIFICATION_CHALLENGE_REQUEST_ID: 'qrRequestId',
});

module.exports = {
  AUTH_REQUEST_TYPES,
  AUTH_REQUEST_STATUSES,
  SESSION_PRINCIPAL_FIELDS,
};
