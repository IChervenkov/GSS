const bcrypt = require('bcryptjs');
const qrcode = require('qrcode');
const speakeasy = require('speakeasy');
const { AppError } = require('../../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');

const DUMMY_BCRYPT_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8sD1kLAkIOm.3nJnV76GdWXxK46Um.';

function createMobileAuthService({ env, repository, tokens, auditLog }) {
  async function checkLoginApp({ username, password, requestMeta }) {
    const user = await repository.findUserByUsername(username);

    if (user?.isLocked) {
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGIN_LOCKED, {
        ...requestMeta,
        username,
        targetUserId: user.id,
        outcome: 'locked',
      });
      throw new AppError({
        status: 423,
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'This account is locked. Contact an administrator.',
      });
    }

    const [passwordMatches, temporaryPasswordMatches] = await Promise.all([
      bcrypt.compare(password, user?.password || DUMMY_BCRYPT_HASH),
      bcrypt.compare(password, user?.temporaryPassword || DUMMY_BCRYPT_HASH),
    ]);

    if (!user) {
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGIN_FAILED, {
        ...requestMeta,
        username,
        outcome: 'failure',
      });
      return { success: false, validUsername: false };
    }

    if (!passwordMatches && !temporaryPasswordMatches) {
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGIN_FAILED, {
        ...requestMeta,
        username,
        targetUserId: user.id,
        outcome: 'failure',
      });
      return { success: false, validUsername: true };
    }

    auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGIN_SUCCEEDED, {
      ...requestMeta,
      username,
      targetUserId: user.id,
      usedTemporaryPassword: Boolean(temporaryPasswordMatches),
      outcome: 'success',
    });

    return { success: true, validUsername: true };
  }

  async function twoFactorVerifiedDevice({ username, requestMeta }) {
    const user = await repository.findUserByUsername(username);
    if (!user) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.MISSING_USER,
        message: 'User not found.',
      });
    }

    if (user.isLocked) {
      throw new AppError({
        status: 423,
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'This account is locked. Contact an administrator.',
      });
    }

    const issuer = env.SECRET_NAME || 'MyApp';
    let base32Secret = user.totpSecret || null;

    if (!base32Secret) {
      base32Secret = speakeasy.generateSecret({ length: 20, name: issuer }).base32;
      await repository.updateUserTotpSecret(user.id, base32Secret);
    }

    const qrCodeDataURL = await qrcode.toDataURL(
      speakeasy.otpauthURL({
        secret: base32Secret,
        label: `${issuer}:${user.username}`,
        issuer,
        encoding: 'base32',
      }),
      {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 6,
      },
    );

    auditLog?.(AUDIT_EVENT_NAMES.AUTH.TWO_FACTOR_CHALLENGE_ISSUED, {
      ...requestMeta,
      targetUserId: user.id,
      outcome: 'success',
    });

    return { qrCodeDataURL, secret: base32Secret };
  }

  async function requestShowQr({ username, requestMeta }) {
    const user = await repository.findUserByUsername(username);
    if (!user) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.MISSING_USER,
        message: 'User not found.',
      });
    }

    auditLog?.(AUDIT_EVENT_NAMES.AUTH.QR_REVEALED, {
      ...requestMeta,
      targetUserId: user.id,
      outcome: 'success',
    });

    return { success: true };
  }

  async function verifyDevice({ code, username, deviceId, deviceName, requestMeta }) {
    const user = await repository.findUserByUsername(username);
    if (!user?.totpSecret) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Verification session expired. Please sign in again.',
      });
    }

    if (user.isLocked) {
      throw new AppError({
        status: 423,
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'This account is locked. Contact an administrator.',
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.TWO_FACTOR_FAILED, {
        ...requestMeta,
        targetUserId: user.id,
        outcome: 'failure',
      });
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_CODE,
        message: 'Invalid verification code.',
      });
    }

    const identity = {
      sub: user.id,
      username: user.username,
      deviceId,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = tokens.createAccessToken(env, identity);
    const refreshToken = tokens.createRefreshToken(env, identity);
    const refreshPrincipal = tokens.verifyRefreshToken(env, refreshToken);

    await repository.createRefreshSession({
      userId: user.id,
      refreshTokenHash: tokens.hashToken(refreshToken),
      refreshJti: refreshPrincipal.jti,
      deviceId,
      deviceName,
      tokenVersion: user.tokenVersion,
      ttlDays: env.REFRESH_TOKEN_EXPIRES_IN,
      requestMeta,
    });

    auditLog?.(AUDIT_EVENT_NAMES.AUTH.TWO_FACTOR_VERIFIED, {
      ...requestMeta,
      targetUserId: user.id,
      deviceId: deviceId || null,
      outcome: 'success',
    });

    return { accessToken, refreshToken };
  }

  return {
    checkLoginApp,
    requestShowQr,
    twoFactorVerifiedDevice,
    verifyDevice,
  };
}

module.exports = { createMobileAuthService };
