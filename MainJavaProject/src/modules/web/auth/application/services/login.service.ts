const { AppError } = require('../../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');
const bcrypt = require('bcryptjs');
const { authSuccess } = require('../../../../../shared/application/action-result');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');
const { METRIC_NAMES } = require('../../../../../shared/observability/metric-names');

function recordLoginMetric(metrics, outcome) {
  metrics?.counter?.(METRIC_NAMES.AUTH_LOGIN_ATTEMPTS_TOTAL, { outcome });
}

async function compareLoginPassword({ password, user, dummyHash }) {
  const comparisons = [];
  if (user?.password) comparisons.push(['password', bcrypt.compare(password, user.password)]);
  if (user?.temporaryPassword) {
    comparisons.push(['temporaryPassword', bcrypt.compare(password, user.temporaryPassword)]);
  }

  if (comparisons.length === 0) {
    await bcrypt.compare(password, dummyHash);
    return { passwordMatches: false, temporaryPasswordMatches: false };
  }

  const results = await Promise.all(comparisons.map(([, comparison]) => comparison));
  return comparisons.reduce(
    (matches, [kind], index) => ({
      ...matches,
      [kind === 'password' ? 'passwordMatches' : 'temporaryPasswordMatches']: results[index],
    }),
    { passwordMatches: false, temporaryPasswordMatches: false },
  );
}

function createLoginService({ repository, auditLog, metrics }) {
  async function login({ username, password, attemptTracker, authSession, requestMeta }) {
    if (attemptTracker.isBlocked()) {
      recordLoginMetric(metrics, 'blocked');
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGIN_BLOCKED, {
        ...requestMeta,
        actorUserId: requestMeta?.actorUserId || null,
        username,
        outcome: 'blocked',
      });
      throw new AppError({
        status: 429,
        code: ERROR_CODES.BLOCKED_SESSION,
        message: 'Too many failed attempts. Try again later.',
      });
    }

    const user = await repository.findUserByUsername(username);

    if (user?.isLocked) {
      recordLoginMetric(metrics, 'locked');
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

    const { passwordMatches, temporaryPasswordMatches } = await compareLoginPassword({
      password,
      user,
      dummyHash: attemptTracker.dummyBcryptHash,
    });

    if (!user || (!passwordMatches && !temporaryPasswordMatches)) {
      attemptTracker.registerFailedAttempt();
      recordLoginMetric(metrics, 'invalid_credentials');
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGIN_FAILED, {
        ...requestMeta,
        actorUserId: requestMeta?.actorUserId || null,
        username,
        outcome: 'failure',
      });
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid username or password.',
      });
    }

    attemptTracker.resetFailedAttempts();
    await authSession.transitionToPendingTwoFactor({ userId: user.id });

    recordLoginMetric(metrics, temporaryPasswordMatches ? 'success_temporary_password' : 'success');
    auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGIN_SUCCEEDED, {
      ...requestMeta,
      username,
      targetUserId: user.id,
      usedTemporaryPassword: Boolean(temporaryPasswordMatches),
      outcome: 'success',
    });

    return authSuccess('verify');
  }

  return { login };
}

module.exports = { createLoginService };
