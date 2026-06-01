const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { AppError } = require('../../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');
const { authSuccess } = require('../../../../../shared/application/action-result');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');
const { METRIC_NAMES } = require('../../../../../shared/observability/metric-names');

function record2faMetric(metrics, action, outcome) {
  metrics?.counter?.(METRIC_NAMES.AUTH_TWO_FACTOR_ATTEMPTS_TOTAL, { action, outcome });
}

function createTwoFactorService({ env, repository, auditLog, metrics }) {
  async function getVerifyView({ authSession, pendingUserId, requestMeta }) {
    if (!pendingUserId) {
      record2faMetric(metrics, 'challenge', 'unauthorized');
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'You must sign in again before verifying your code.',
      });
    }

    const issuer = env.SECRET_NAME || 'MyApp';
    const user = await repository.findUserTotpSecretById(pendingUserId);
    if (!user) {
      record2faMetric(metrics, 'challenge', 'missing_user');
      throw new AppError({
        status: 404,
        code: ERROR_CODES.MISSING_USER,
        message: 'User not found.',
      });
    }

    if (user.isLocked) {
      record2faMetric(metrics, 'challenge', 'locked');
      throw new AppError({
        status: 423,
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'This account is locked. Contact an administrator.',
      });
    }

    let base32Secret = user.totpSecret || null;
    let isFirstShowQr = false;

    if (!base32Secret) {
      isFirstShowQr = true;
      const generated = speakeasy.generateSecret({ length: 20, name: issuer });
      base32Secret = generated.base32;
      await repository.updateUserTotpSecret(pendingUserId, base32Secret);
    }

    const label = `${issuer}:${user.username}`;
    const otpauthUrl = speakeasy.otpauthURL({
      secret: base32Secret,
      label,
      issuer,
      encoding: 'base32',
    });
    const qrCodeDataURL = await qrcode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
    });
    const expiresAt = Date.now() + env.TWO_FACTOR_ENROLLMENT_TTL_SECONDS * 1000;

    await authSession.issueVerifyChallenge({ secret: base32Secret, qrCodeDataURL, expiresAt });
    record2faMetric(metrics, 'challenge', isFirstShowQr ? 'issued_first_enrollment' : 'issued');
    auditLog?.(AUDIT_EVENT_NAMES.AUTH.TWO_FACTOR_CHALLENGE_ISSUED, {
      ...requestMeta,
      targetUserId: pendingUserId,
      firstEnrollment: isFirstShowQr,
      expiresAt,
      outcome: 'success',
    });

    return {
      title: '2FA Verification',
      qrCodeDataURL: isFirstShowQr ? qrCodeDataURL : null,
    };
  }

  async function verifyCode({
    authSession,
    attemptTracker,
    userSecret,
    code,
    challengeExpiresAt,
    requestMeta,
    pendingUserId,
  }) {
    if (attemptTracker.isBlocked()) {
      record2faMetric(metrics, 'verify', 'blocked');
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.TWO_FACTOR_BLOCKED, {
        ...requestMeta,
        targetUserId: pendingUserId || requestMeta?.targetUserId || null,
        outcome: 'blocked',
      });
      throw new AppError({
        status: 429,
        code: ERROR_CODES.BLOCKED_SESSION,
        message: 'Too many failed attempts. Try again later.',
      });
    }

    if (!userSecret || !challengeExpiresAt || Number(challengeExpiresAt) <= Date.now()) {
      record2faMetric(metrics, 'verify', 'expired');
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Verification session expired. Please sign in again.',
      });
    }

    const user = pendingUserId ? await repository.findUserTotpSecretById(pendingUserId) : null;
    if (!user) {
      record2faMetric(metrics, 'verify', 'missing_user');
      throw new AppError({
        status: 404,
        code: ERROR_CODES.MISSING_USER,
        message: 'User not found.',
      });
    }

    if (user.isLocked) {
      record2faMetric(metrics, 'verify', 'locked');
      throw new AppError({
        status: 423,
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'This account is locked. Contact an administrator.',
      });
    }

    const verified = speakeasy.totp.verify({
      secret: userSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      attemptTracker.registerFailedAttempt();
      await authSession.save();
      record2faMetric(metrics, 'verify', 'invalid_code');
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.TWO_FACTOR_FAILED, {
        ...requestMeta,
        targetUserId: pendingUserId,
        outcome: 'failure',
      });
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_CODE,
        message: 'Invalid verification code.',
      });
    }

    const userIdToPromote = pendingUserId;

    attemptTracker.resetFailedAttempts();
    await authSession.completeTwoFactorAuthentication({ userId: userIdToPromote });
    record2faMetric(metrics, 'verify', 'success');
    auditLog?.(AUDIT_EVENT_NAMES.AUTH.TWO_FACTOR_VERIFIED, {
      ...requestMeta,
      targetUserId: userIdToPromote,
      outcome: 'success',
    });

    return authSuccess('mainPage');
  }

  return {
    getVerifyView,
    verifyCode,
  };
}

module.exports = { createTwoFactorService };