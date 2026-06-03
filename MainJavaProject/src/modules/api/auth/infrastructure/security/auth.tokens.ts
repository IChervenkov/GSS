// @ts-nocheck
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  TOKEN_TYPES,
  buildTokenClaims,
  toPrincipal,
  verifyJwtByType,
} = require('../../../../../shared/security/token-identity');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeJwtOption(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildJwtOptions({ env, expiresIn }) {
  const options = { expiresIn };
  const issuer = normalizeJwtOption(env.ACCESS_TOKEN_ISSUER);
  const audience = normalizeJwtOption(env.ACCESS_TOKEN_AUDIENCE);
  if (issuer) options.issuer = issuer;
  if (audience) options.audience = audience;
  return options;
}

function createAccessToken(env, identity) {
  const claims = buildTokenClaims(identity, TOKEN_TYPES.ACCESS);
  return jwt.sign(claims, env.ACCESS_TOKEN_SECRET, buildJwtOptions({ env, expiresIn: `${env.ACCESS_TOKEN_EXPIRES_IN}m` }));
}

function createRefreshToken(env, identity) {
  const claims = buildTokenClaims(identity, TOKEN_TYPES.REFRESH);
  return jwt.sign(claims, env.REFRESH_TOKEN_SECRET, buildJwtOptions({ env, expiresIn: `${env.REFRESH_TOKEN_EXPIRES_IN}d` }));
}

function verifyAccessToken(env, accessToken) {
  const claims = verifyJwtByType({
    token: accessToken,
    secret: env.ACCESS_TOKEN_SECRET,
    expectedType: TOKEN_TYPES.ACCESS,
    issuer: env.ACCESS_TOKEN_ISSUER,
    audience: env.ACCESS_TOKEN_AUDIENCE,
    invalidCode: ERROR_CODES.INVALID_TOKEN,
    invalidMessage: 'Invalid or expired token',
    expiredCode: ERROR_CODES.ACCESS_TOKEN_EXPIRED,
    expiredMessage: 'Access token has expired.',
  });
  return toPrincipal(claims, { authType: 'jwt', via: 'jwt' });
}

function verifyRefreshToken(env, refreshToken) {
  const claims = verifyJwtByType({
    token: refreshToken,
    secret: env.REFRESH_TOKEN_SECRET,
    expectedType: TOKEN_TYPES.REFRESH,
    issuer: env.ACCESS_TOKEN_ISSUER,
    audience: env.ACCESS_TOKEN_AUDIENCE,
    invalidCode: ERROR_CODES.INVALID_REFRESH_TOKEN,
    invalidMessage: 'Refresh session is invalid or expired.',
  });
  return toPrincipal(claims, { authType: 'jwt', via: 'jwt' });
}

module.exports = {
  hashToken,
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TOKEN_TYPES,
};
