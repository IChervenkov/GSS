const REVOCATION_REASONS = Object.freeze({
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  HASH_MISMATCH: 'hash_mismatch',
  DEVICE_MISMATCH: 'device_mismatch',
  FINGERPRINT_MISMATCH: 'fingerprint_mismatch',
  TOKEN_VERSION_MISMATCH: 'token_version_mismatch',
  USER_REVOKED: 'user_revoked',
  ADMIN_REVOKED: 'admin_revoked',
  CURRENT_DEVICE_REVOKED: 'current_device_revoked',
  CONCURRENCY_LIMIT: 'concurrency_limit',
  NOT_FOUND: 'not_found',
});

module.exports = { REVOCATION_REASONS };
