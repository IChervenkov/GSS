const { randomUUID } = require('crypto');
const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');

const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
});

function normalizeUserId(input = {}) {
  return String(input.sub || input.userId || input.id || '').trim();
}

function normalizeTokenVersion(value) {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function buildTokenClaims(identity = {}, tokenType) {
  const sub = normalizeUserId(identity);
  if (!sub) {
    throw new Error('Token subject is required');
  }

  const claims = {
    sub,
    type: tokenType,
    jti: String(identity.jti || randomUUID()),
    tokenVersion: normalizeTokenVersion(identity.tokenVersion),
  };

  if (identity.username) claims.username = String(identity.username);
  if (identity.deviceId) claims.deviceId = String(identity.deviceId);

  return claims;
}

function normalizeJwtOption(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function verifyJwtByType({
  token,
  secret,
  expectedType,
  issuer,
  audience,
  invalidCode,
  invalidMessage,
  expiredCode,
  expiredMessage,
  expiredStatus = 401,
}) {
  try {
    const verifyOptions = {};
    const normalizedIssuer = normalizeJwtOption(issuer);
    const normalizedAudience = normalizeJwtOption(audience);
    if (normalizedIssuer) verifyOptions.issuer = normalizedIssuer;
    if (normalizedAudience) verifyOptions.audience = normalizedAudience;
    const payload = require('jsonwebtoken').verify(token, secret, verifyOptions);

    if (payload?.type !== expectedType) {
      throw new AppError({
        status: 403,
        code: invalidCode || ERROR_CODES.INVALID_TOKEN,
        message: invalidMessage || 'Token type is invalid.',
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.name === 'TokenExpiredError' && expiredCode) {
      throw new AppError({
        status: expiredStatus,
        code: expiredCode,
        message: expiredMessage || 'Token has expired.',
        cause: error,
      });
    }
    throw new AppError({
      status: 403,
      code: invalidCode || ERROR_CODES.INVALID_TOKEN,
      message: invalidMessage || 'Invalid or expired token.',
      cause: error,
    });
  }
}

function toPrincipal(claims = {}, extras = {}) {
  const id = normalizeUserId(claims);
  if (!id) {
    throw new AppError({
      status: 403,
      code: ERROR_CODES.INVALID_TOKEN,
      message: 'Token principal is invalid.',
    });
  }

  return {
    id,
    userId: id,
    sub: id,
    username: claims.username ? String(claims.username) : null,
    tokenType: claims.type ? String(claims.type) : null,
    deviceId: claims.deviceId ? String(claims.deviceId) : null,
    tokenVersion: normalizeTokenVersion(claims.tokenVersion),
    jti: claims.jti ? String(claims.jti) : null,
    issuedAt: Number.isInteger(claims.iat) ? claims.iat : null,
    expiresAt: Number.isInteger(claims.exp) ? claims.exp : null,
    issuer: claims.iss ? String(claims.iss) : null,
    audience: claims.aud || null,
    claims,
    ...extras,
  };
}

module.exports = {
  TOKEN_TYPES,
  buildTokenClaims,
  normalizeUserId,
  normalizeTokenVersion,
  toPrincipal,
  verifyJwtByType,
};
