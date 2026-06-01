const crypto = require('crypto');
const { AppError } = require('../../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');
const { ensureRefreshTokenPresent } = require('../../domain/auth.token-policy');
const {
  normalizeUserId,
  normalizeTokenVersion,
} = require('../../../../../shared/security/token-identity');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');
const { METRIC_NAMES } = require('../../../../../shared/observability/metric-names');
const { REVOCATION_REASONS } = require('../../domain/refresh-session.constants');

function hashFingerprint(clientFingerprint) {
  if (!clientFingerprint) return null;
  return crypto.createHash('sha256').update(String(clientFingerprint)).digest('hex');
}

function toAuditFailureReason(reason) {
  switch (reason) {
    case REVOCATION_REASONS.EXPIRED:
    case REVOCATION_REASONS.REVOKED:
    case REVOCATION_REASONS.HASH_MISMATCH:
    case REVOCATION_REASONS.DEVICE_MISMATCH:
    case REVOCATION_REASONS.FINGERPRINT_MISMATCH:
    case REVOCATION_REASONS.TOKEN_VERSION_MISMATCH:
    case REVOCATION_REASONS.CONCURRENCY_LIMIT:
      return reason;
    default:
      return 'invalid_refresh_token';
  }
}

function createInvalidRefreshTokenError() {
  return new AppError({
    status: 403,
    code: ERROR_CODES.INVALID_REFRESH_TOKEN,
    message: 'Refresh session is invalid or expired.',
  });
}

function recordRefreshMetric(metrics, outcome) {
  metrics?.counter?.(METRIC_NAMES.AUTH_REFRESH_TOTAL, { outcome });
}

function createTokenService({ env, repository, tokens, auditLog, metrics }) {
  async function logout({ refreshToken, deviceId, requestMeta }) {
    ensureRefreshTokenPresent(refreshToken);

    try {
      const payload = tokens.verifyRefreshToken(env, refreshToken);
      const userId = normalizeUserId(payload);
      const effectiveDeviceId = deviceId || payload.deviceId;

      if (effectiveDeviceId) {
        await repository.revokeRefreshSessionForCurrentDevice({
          userId,
          deviceId: effectiveDeviceId,
          reason: REVOCATION_REASONS.CURRENT_DEVICE_REVOKED,
        });
      } else {
        await repository.revokeAllRefreshSessionsForUser({
          userId,
          reason: REVOCATION_REASONS.CURRENT_DEVICE_REVOKED,
        });
      }

      auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGOUT_COMPLETED, {
        ...requestMeta,
        actorUserId: userId,
        targetUserId: userId,
        deviceId: effectiveDeviceId || null,
        outcome: 'success',
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw createInvalidRefreshTokenError();
    }
  }

  async function refreshToken({ refreshToken, deviceId, clientFingerprint, requestMeta }) {
    ensureRefreshTokenPresent(refreshToken);

    try {
      const payload = tokens.verifyRefreshToken(env, refreshToken);
      const userId = normalizeUserId(payload);
      const tokenVersion = normalizeTokenVersion(payload?.tokenVersion);
      const effectiveDeviceId = deviceId || payload.deviceId;
      const clientFingerprintHash = hashFingerprint(clientFingerprint);
      const nextRefreshToken = tokens.createRefreshToken(env, {
        sub: userId,
        username: payload.username,
        deviceId: effectiveDeviceId,
        tokenVersion,
      });
      const nextRefreshPrincipal = tokens.verifyRefreshToken(env, nextRefreshToken);
      const rotationResult = await repository.rotateRefreshSession({
        userId,
        refreshTokenHash: tokens.hashToken(refreshToken),
        refreshJti: payload.jti || null,
        deviceId: effectiveDeviceId,
        expectedTokenVersion: tokenVersion,
        nextRefreshHash: tokens.hashToken(nextRefreshToken),
        nextRefreshJti: nextRefreshPrincipal.jti,
        ttlDays: env.REFRESH_TOKEN_EXPIRES_IN,
        clientFingerprintHash,
        requestMeta,
        maxActivePerUser: env.REFRESH_SESSION_MAX_ACTIVE_PER_USER,
        maxActivePerDevice: env.REFRESH_SESSION_MAX_ACTIVE_PER_DEVICE,
      });

      const isLegacySuccess =
        Boolean(rotationResult) &&
        typeof rotationResult === 'object' &&
        !Object.hasOwn(rotationResult, 'ok');
      const normalizedRotationResult = isLegacySuccess
        ? { ok: true, session: rotationResult }
        : rotationResult;

      if (!normalizedRotationResult?.ok) {
        const failureReason = toAuditFailureReason(normalizedRotationResult?.reason);
        recordRefreshMetric(metrics, failureReason);
        auditLog?.(AUDIT_EVENT_NAMES.AUTH.REFRESH_TOKEN_REJECTED, {
          ...requestMeta,
          targetUserId: userId,
          tokenJti: payload.jti || null,
          tokenVersion,
          deviceId: effectiveDeviceId,
          reason: failureReason,
          sessionId: normalizedRotationResult?.session?.id || null,
          sessionFamilyId: normalizedRotationResult?.session?.sessionFamilyId || null,
          outcome: 'failure',
        });
        throw createInvalidRefreshTokenError();
      }

      recordRefreshMetric(metrics, 'success');
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.REFRESH_TOKEN_ROTATED, {
        ...requestMeta,
        targetUserId: userId,
        tokenJti: payload.jti || null,
        tokenVersion,
        deviceId: effectiveDeviceId,
        sessionId: normalizedRotationResult?.session?.id || null,
        sessionFamilyId: normalizedRotationResult?.session?.sessionFamilyId || null,
        outcome: 'success',
      });
      return {
        accessToken: tokens.createAccessToken(env, {
          sub: userId,
          username: payload.username,
          deviceId: effectiveDeviceId,
          tokenVersion,
        }),
        refreshToken: nextRefreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      recordRefreshMetric(metrics, 'token_invalid');
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.REFRESH_TOKEN_FAILED, {
        ...requestMeta,
        actorUserId: requestMeta?.actorUserId || null,
        deviceId,
        reason: 'token_invalid',
        outcome: 'failure',
      });
      throw createInvalidRefreshTokenError();
    }
  }

  return { logout, refreshToken };
}

module.exports = { createTokenService };
