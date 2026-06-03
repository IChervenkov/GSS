// @ts-nocheck
const crypto = require('crypto');
const { AppError } = require('../../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');
const { MAIN_PERMISSIONS } = require('../../domain/main.permissions');
const { success } = require('../../../../../shared/application/action-result');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function generateTempPassword(length = 16) {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = lower + upper + digits + special;

  const getRandomChar = (characters) => characters[crypto.randomInt(0, characters.length)];
  const password = [
    getRandomChar(lower),
    getRandomChar(upper),
    getRandomChar(digits),
    getRandomChar(special),
  ];

  for (let index = password.length; index < length; index += 1) {
    password.push(getRandomChar(all));
  }

  for (let index = password.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.randomInt(0, index + 1);
    [password[index], password[randomIndex]] = [password[randomIndex], password[index]];
  }

  return password.join('');
}

function createUserService({ env, repository, permissionRepository, realtime, auditLog }) {
  async function ensureAdminPermission(actorUserId) {
    const allowed = await permissionRepository.userHasPermission(
      actorUserId,
      MAIN_PERMISSIONS.system,
    );
    if (!allowed) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to manage users.',
      });
    }
  }

  async function getUsers({
    page,
    limit,
    searchColumns = [],
    searchValues = [],
    sortColumn,
    sortDirection,
  }) {
    const normalizedSearchColumns = toArray(searchColumns);
    const normalizedSearchValues = toArray(searchValues);
    const filters = normalizedSearchColumns.map((column, index) => ({
      column,
      value: normalizedSearchValues[index],
    }));
    const sortMap = new Map([
      ['username', 'u.username'],
      ['account', 'account'],
      ['status', 'status'],
      ['user_confirmation', 'status'],
    ]);

    const result = await repository.listUsers({
      adminUsername: env.ADMIN_USERNAME,
      page,
      limit,
      filters,
      sort: {
        column: sortMap.get(sortColumn) || null,
        direction: sortDirection,
      },
    });

    return success({
      users: result.users,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    });
  }

  async function submitUserMessage({ actorUserId, type, subject, message }) {
    const created = await repository.createUserMessage({
      userId: actorUserId,
      type,
      subject,
      body: message,
    });
    realtime.emitAdminInboxUpdated?.(created);

    return success({
      message: 'Message sent successfully.',
      id: created?.sourceId,
    });
  }

  async function getAdminInbox({
    actorUserId,
    page,
    limit,
    searchColumns = [],
    searchValues = [],
    sortColumn,
    sortDirection,
  }) {
    await ensureAdminPermission(actorUserId);
    const normalizedSearchColumns = toArray(searchColumns);
    const normalizedSearchValues = toArray(searchValues);
    const filters = normalizedSearchColumns.map((column, index) => ({
      column,
      value: normalizedSearchValues[index],
    }));
    const result = await repository.listAdminInbox({
      page,
      limit,
      filters,
      sort: {
        column: sortColumn || null,
        direction: sortDirection,
      },
    });

    return success({
      items: result.items,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    });
  }

  async function updateUserMessageStatus({ actorUserId, messageId, status }) {
    await ensureAdminPermission(actorUserId);
    const updated = await repository.updateUserMessageStatus({
      messageId,
      status,
      actorUserId,
    });

    if (!updated) {
      throw new AppError({
        status: 404,
        code: 'USER_MESSAGE_NOT_FOUND',
        message: 'Message not found.',
      });
    }

    realtime.emitAdminInboxUpdated?.(updated);

    return success({
      message: `Message ${status}.`,
      item: updated,
    });
  }

  async function deleteAdminInboxItem({ actorUserId, itemId, itemKind }) {
    await ensureAdminPermission(actorUserId);
    const deleted = await repository.deleteAdminInboxItem({
      itemId,
      itemKind,
      actorUserId,
    });

    if (!deleted) {
      throw new AppError({
        status: 404,
        code: 'ADMIN_INBOX_ITEM_NOT_FOUND',
        message: 'Inbox entry not found.',
      });
    }

    realtime.emitAdminInboxUpdated?.({
      kind: 'admin_inbox_deleted',
      itemKind: deleted.kind,
      sourceId: deleted.sourceId,
    });

    if (deleted.kind === 'access_request') {
      realtime.emitUserListUpdated?.();
    }

    return success({
      message: 'Inbox entry deleted successfully.',
      item: deleted,
    });
  }

  async function addUser({ actorUserId, username, requestMeta }) {
    await ensureAdminPermission(actorUserId);
    const temporaryPassword = generateTempPassword(16);
    const temporaryPasswordHash = await repository.hashPassword(
      temporaryPassword,
      env.BCRYPT_ROUNDS,
    );
    const createdUser = await repository.createUser({
      actorUserId,
      username,
      temporaryPasswordHash,
    });
    realtime.emitUserListAdded();
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.USER_CREATED, { ...requestMeta, targetUserId: createdUser.id, username });

    return success({
      message: 'User added successfully',
      userId: createdUser.id,
      temporaryPassword,
    });
  }

  async function editUser({ actorUserId, userId, username, password, locked, requestMeta }) {
    await ensureAdminPermission(actorUserId);
    const currentUser = await repository.findUserForEdit(userId);
    if (!currentUser) {
      throw new AppError({ status: 404, code: 'MISSING_USER', message: 'User not found.' });
    }

    const passwordHash = password
      ? await repository.hashPassword(password, env.BCRYPT_ROUNDS)
      : null;
    const nextLocked = typeof locked === 'boolean' ? locked : Boolean(currentUser.isLocked);
    const lockChanged =
      typeof locked === 'boolean' && Boolean(locked) !== Boolean(currentUser.isLocked);
    const updatePayload = { actorUserId, userId, username, passwordHash };
    if (typeof locked === 'boolean') updatePayload.locked = locked;
    await repository.updateUser(updatePayload);
    realtime.emitUserUpdated(userId, username);
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.USER_UPDATED, {
      ...requestMeta,
      targetUserId: userId,
      username,
      passwordChanged: Boolean(password),
      accountLocked: nextLocked,
      accountLockChanged: lockChanged,
    });

    return success({
      message: 'User edited successfully',
      userId,
      locked: nextLocked,
      invalidateSessions: nextLocked && lockChanged,
    });
  }


  async function securityResetUser({ actorUserId, userId, requestMeta }) {
    await ensureAdminPermission(actorUserId);
    const targetUser = await repository.findUserForEdit(userId);
    if (!targetUser) {
      throw new AppError({ status: 404, code: 'MISSING_USER', message: 'User not found.' });
    }

    const result = await repository.securityResetUser({ actorUserId, userId });
    realtime.emitUserUpdated(userId, targetUser.username);
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.USER_SECURITY_RESET, {
      ...requestMeta,
      actorUserId,
      targetUserId: userId,
      username: targetUser.username,
      tokenVersion: result?.tokenVersion ?? null,
    });

    return success({
      message: 'User security reset completed successfully',
      userId,
      invalidateSessions: true,
      tokenVersion: result?.tokenVersion ?? null,
    });
  }

  async function deleteUsers({ actorUserId, sessionUserId, userIds, requestMeta }) {
    await ensureAdminPermission(actorUserId);
    const uniqueUserIds = [...new Set(userIds.map((userId) => String(userId)))];
    if (uniqueUserIds.includes(String(sessionUserId))) {
      throw new AppError({
        status: 400,
        code: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete yourself.',
      });
    }

    const deletedUsers = await repository.deleteUsers({ actorUserId, userIds: uniqueUserIds });
    if (deletedUsers.length !== uniqueUserIds.length) {
      throw new AppError({
        status: 400,
        code: 'USER_NOT_EXIST',
        message: 'Some users do not exist anymore.',
      });
    }

    for (const userId of uniqueUserIds) {
      realtime.emitUserDeleted(userId);
    }
    realtime.emitUserDeletedList(uniqueUserIds);
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.USER_DELETED, {
      ...requestMeta,
      actorUserId,
      targetUserId: uniqueUserIds.length === 1 ? uniqueUserIds[0] : null,
      deletedUserIds: uniqueUserIds,
    });

    return success({
      message: 'Users removed successfully',
      deletedUserIds: uniqueUserIds,
    });
  }

  async function resolveUserRequest({ actorUserId, requestId, decision, requestMeta }) {
    const allowedDecisions = new Set(['approved', 'denied']);
    if (!allowedDecisions.has(decision)) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_DECISION,
        message: 'Invalid approval decision.',
      });
    }

    await ensureAdminPermission(actorUserId);

    const resolveRequest = repository.resolveUserRequest || repository.resolveApprovalRequest;
    const resolved = await resolveRequest({
      requestId,
      decision,
      decidedBy: actorUserId,
    });

    if (resolved.kind === 'not_found') {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'Request not found.',
      });
    }

    if (resolved.kind === 'expired') {
      throw new AppError({
        status: 410,
        code: ERROR_CODES.REQUEST_EXPIRED,
        message: 'Request expired.',
      });
    }

    if (resolved.kind === 'already_resolved') {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.REQUEST_ALREADY_RESOLVED,
        message: `Request already ${resolved.value.status}.`,
      });
    }

    const request = resolved.value;
    const emitResolved = realtime.emitUserRequestResolved || realtime.emitApprovalResolved;
    emitResolved?.(request);
    realtime.emitUserRequestUpdated?.(request);
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.USER_REQUEST_RESOLVED, {
      ...requestMeta,
      approverUserId: actorUserId,
      requestId: request.requestId,
      decision: request.status,
      targetUserId: request.userId,
      requestType: request.requestType,
    });

    return success({
      message: `Request ${request.status}.`,
      requestId: request.requestId,
      decision: request.status,
      requestType: request.requestType,
      userId: request.userId,
    });
  }

  return {
    getUsers,
    submitUserMessage,
    getAdminInbox,
    updateUserMessageStatus,
    deleteAdminInboxItem,
    addUser,
    editUser,
    deleteUsers,
    resolveUserRequest,
    securityResetUser,
  };
}

module.exports = { createUserService };
