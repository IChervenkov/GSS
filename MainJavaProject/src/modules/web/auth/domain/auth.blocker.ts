const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_TIME_MS = 15 * 60 * 1000;
const DUMMY_BCRYPT_HASH = '$2b$10$bKrO7NmkjestqCBh18T.wuk7Mq6cFWsLHpbWkrS37r9cjc1/yXc..';

function getFailedLoginRecord(req) {
  if (!req.session) return { failedAttempts: 0, blockExpiresAt: null };
  return req.session.failedLogin || { failedAttempts: 0, blockExpiresAt: null };
}

function isBlockedSession(req) {
  const record = getFailedLoginRecord(req);
  if (record.blockExpiresAt && record.blockExpiresAt > Date.now()) return true;

  if (record.blockExpiresAt && record.blockExpiresAt <= Date.now() && req.session) {
    req.session.failedLogin = { failedAttempts: 0, blockExpiresAt: null };
  }

  return false;
}

function registerFailedAttempt(req) {
  if (!req.session) return;
  const record = getFailedLoginRecord(req);
  record.failedAttempts = (record.failedAttempts || 0) + 1;
  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.blockExpiresAt = Date.now() + BLOCK_TIME_MS;
  }
  req.session.failedLogin = record;
}

function resetFailedAttempts(req) {
  if (!req.session) return;
  req.session.failedLogin = { failedAttempts: 0, blockExpiresAt: null };
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  BLOCK_TIME_MS,
  DUMMY_BCRYPT_HASH,
  getFailedLoginRecord,
  isBlockedSession,
  registerFailedAttempt,
  resetFailedAttempts,
};
