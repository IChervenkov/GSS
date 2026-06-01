const bcrypt = require('bcryptjs');
const { AppError } = require('../../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');
const {
  ensureDifferentPassword,
  ensureStrongPassword,
} = require('../../domain/auth.policy');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');
const { accepted, authSuccess } = require('../../../../../shared/application/action-result');

async function compareCurrentPassword({ currentPassword, user, dummyHash }) {
  const comparisons = [];
  if (user?.temporaryPassword) {
    comparisons.push(['temporaryPassword', bcrypt.compare(currentPassword, user.temporaryPassword)]);
  }
  if (user?.password) comparisons.push(['password', bcrypt.compare(currentPassword, user.password)]);

  if (comparisons.length === 0) {
    await bcrypt.compare(currentPassword, dummyHash);
    return { temporaryPasswordMatches: false, passwordMatches: false };
  }

  const results = await Promise.all(comparisons.map(([, comparison]) => comparison));
  return comparisons.reduce(
    (matches, [kind], index) => ({
      ...matches,
      [kind === 'temporaryPassword' ? 'temporaryPasswordMatches' : 'passwordMatches']:
        results[index],
    }),
    { temporaryPasswordMatches: false, passwordMatches: false },
  );
}

async function ensureNewPasswordIsNotOtherStoredCredential({ newPassword, user, passwordMatches, temporaryPasswordMatches }) {
  const comparisons = [];
  if (user?.password && !passwordMatches) comparisons.push(bcrypt.compare(newPassword, user.password));
  if (user?.temporaryPassword && !temporaryPasswordMatches) {
    comparisons.push(bcrypt.compare(newPassword, user.temporaryPassword));
  }

  if (comparisons.length === 0) return;

  const matches = await Promise.all(comparisons);
  if (matches.some(Boolean)) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.SAME_PASSWORD,
      message: 'New password must be different from the current and temporary password.',
    });
  }
}

function createPasswordChangeService({ env, repository, eventBus, auditLog }) {
  async function getChangePasswordView() {
    return { title: 'Change Password' };
  }

  async function changePassword({
    username,
    currentPassword,
    newPassword,
    passwordChangeRequestId,
    authSession,
    attemptTracker,
    requestMeta,
  }) {
    if (attemptTracker.isBlocked()) {
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.PASSWORD_CHANGE_BLOCKED, { ...requestMeta, actorUserId: requestMeta?.actorUserId || null, username });
      throw new AppError({
        status: 429,
        code: ERROR_CODES.BLOCKED_SESSION,
        message: 'Too many failed attempts. Try again later.',
      });
    }

    ensureStrongPassword(newPassword);

    if (!(await ensureDifferentPassword(currentPassword, newPassword))) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.SAME_PASSWORD,
        message: 'New password must be different from current password.',
      });
    }

    const user = await repository.findUserByUsername(username);
    if (!user) {
      await bcrypt.compare(currentPassword, attemptTracker.dummyBcryptHash);
      attemptTracker.registerFailedAttempt();
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.PASSWORD_CHANGE_FAILED, {
        ...requestMeta,
        actorUserId: requestMeta?.actorUserId || null,
        username,
        reason: 'invalid_credentials',
      });
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid username or password.',
      });
    }

    if (user.isLocked) {
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.PASSWORD_CHANGE_LOCKED, {
        ...requestMeta,
        username,
        targetUserId: user.id,
      });
      throw new AppError({
        status: 423,
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'This account is locked. Contact an administrator.',
      });
    }

    const { temporaryPasswordMatches, passwordMatches } = await compareCurrentPassword({
      currentPassword,
      user,
      dummyHash: attemptTracker.dummyBcryptHash,
    });

    if (!temporaryPasswordMatches && !passwordMatches) {
      attemptTracker.registerFailedAttempt();
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.PASSWORD_CHANGE_FAILED, {
        ...requestMeta,
        actorUserId: requestMeta?.actorUserId || null,
        username,
        targetUserId: user.id,
        reason: 'invalid_credentials',
      });
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid username or password.',
      });
    }

    await ensureNewPasswordIsNotOtherStoredCredential({
      newPassword,
      user,
      passwordMatches,
      temporaryPasswordMatches,
    });

    if (passwordChangeRequestId) {
      const result = await repository.findPasswordChangeRequest(passwordChangeRequestId);
      if (!result) {
        await authSession.clearPasswordChangeApproval();
        throw new AppError({
          status: 404,
          code: ERROR_CODES.REQUEST_NOT_FOUND,
          message: 'Approval request not found.',
        });
      }

      if (new Date(result.expiresAt) <= new Date()) {
        await authSession.clearPasswordChangeApproval();
        throw new AppError({
          status: 410,
          code: ERROR_CODES.REQUEST_EXPIRED,
          message: 'Approval request expired.',
        });
      }

      if (result.status === 'denied') {
        await authSession.clearPasswordChangeApproval();
        auditLog?.(AUDIT_EVENT_NAMES.AUTH.PASSWORD_CHANGE_DENIED, {
          ...requestMeta,
          username,
          targetUserId: user.id,
          requestId: result.requestId,
        });
        throw new AppError({
          status: 403,
          code: ERROR_CODES.REQUEST_DENIED,
          message: 'The administrator denied the password change request.',
        });
      }

      if (result.status !== 'approved') {
        return accepted({
          status: result.status,
          requestId: result.requestId,
          message: 'Approval is still pending.',
        });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
      await repository.completePasswordChange({
        userId: user.id,
        hashedNewPassword,
        requestId: result.requestId,
      });
      attemptTracker.resetFailedAttempts();
      await authSession.finalizePasswordChange();
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.PASSWORD_CHANGE_SUCCEEDED, {
        ...requestMeta,
        username,
        targetUserId: user.id,
        requestId: result.requestId,
      });
      return authSuccess('login');
    }

    const createRequest = repository.createUserRequest || repository.createApprovalRequest;
    const approval = await createRequest({
      userId: user.id,
      requestType: 'password_change',
      metadata: { username },
    });

    await authSession.beginPasswordChangeApproval({
      userId: user.id,
      requestId: approval.requestId,
    });
    eventBus.emitUserRequestUpdated?.({
      requestId: approval.requestId,
      requestType: 'password_change',
      status: 'pending',
      expiresAt: approval.expiresAt,
      userId: user.id,
      version: 1,
    });
    auditLog?.(AUDIT_EVENT_NAMES.AUTH.PASSWORD_CHANGE_REQUESTED, {
      ...requestMeta,
      username,
      targetUserId: user.id,
      requestId: approval.requestId,
      reused: approval.reused,
    });

    return accepted({
      status: 'pending',
      requestId: approval.requestId,
      expiresAt: new Date(approval.expiresAt).toISOString(),
      message: 'Admin approval is required before the password can be changed.',
    });
  }

  return {
    getChangePasswordView,
    changePassword,
  };
}

module.exports = { createPasswordChangeService };
