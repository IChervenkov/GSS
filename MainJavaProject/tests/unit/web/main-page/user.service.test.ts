const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createUserService,
} = require('../../../../src/modules/web/main-page/application/services/user.service');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

const buildFixture = (name) => `fixture-${name}`;
const strongPassword = buildFixture('updated-pass-A1!');
const storedPasswordHash = buildFixture('stored-password-hash');
const tempPasswordHash = buildFixture('temporary-password-hash');
const nextPasswordHash = buildFixture('next-password-hash');

const validActorUserId = '11111111-1111-1111-1111-111111111111';
const validTargetUserId = '22222222-2222-2222-2222-222222222222';
const validRequestId = '33333333-3333-3333-3333-333333333333';

test('resolveUserRequest rejects invalid decision', async () => {
  const service = createUserService({
    env: {},
    repository: {},
    permissionRepository: {
      userHasPermission: async () => true,
    },
    realtime: {},
  });

  await assert.rejects(
    () =>
      service.resolveUserRequest({
        actorUserId: validActorUserId,
        requestId: validRequestId,
        decision: 'maybe',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 400);
      assert.equal(error.code, ERROR_CODES.INVALID_DECISION);
      return true;
    },
  );
});

test('addUser rejects Full permission without Admin permission', async () => {
  const checkedPermissions = [];
  const service = createUserService({
    env: {},
    repository: {
      hashPassword: async () => {
        throw new Error('hashPassword should not be called');
      },
    },
    permissionRepository: {
      userHasPermission: async (_userId, permissionName) => {
        checkedPermissions.push(permissionName);
        return permissionName === 'Full permission';
      },
    },
    realtime: {},
  });

  await assert.rejects(
    () =>
      service.addUser({
        actorUserId: validActorUserId,
        username: 'new.user',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 403);
      assert.equal(error.code, 'PERMISSION_DENIED');
      return true;
    },
  );
  assert.deepEqual(checkedPermissions, ['Admin permission']);
});

test('resolveUserRequest emits approval and user-list refresh events', async () => {
  let emittedApprovalRequest = null;
  let emittedUserRequest = null;
  const auditEntries = [];

  const service = createUserService({
    env: {},
    repository: {
      resolveApprovalRequest: async () => ({
        kind: 'resolved',
        value: {
          requestId: validRequestId,
          userId: validTargetUserId,
          status: 'approved',
          requestType: 'show_qr',
        },
      }),
    },
    permissionRepository: {
      userHasPermission: async () => true,
    },
    realtime: {
      emitApprovalResolved(request) {
        emittedApprovalRequest = request;
      },
      emitUserRequestUpdated(request) {
        emittedUserRequest = request;
      },
    },
    auditLog(event, meta) {
      auditEntries.push({ event, meta });
    },
  });

  const result = await service.resolveUserRequest({
    actorUserId: validActorUserId,
    requestId: validRequestId,
    decision: 'approved',
    requestMeta: { ipAddress: '127.0.0.1' },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    message: 'Request approved.',
    requestId: validRequestId,
    decision: 'approved',
    requestType: 'show_qr',
    userId: validTargetUserId,
  });
  assert.deepEqual(emittedApprovalRequest, {
    requestId: validRequestId,
    userId: validTargetUserId,
    status: 'approved',
    requestType: 'show_qr',
  });
  assert.deepEqual(emittedUserRequest, {
    requestId: validRequestId,
    userId: validTargetUserId,
    status: 'approved',
    requestType: 'show_qr',
  });
  assert.equal(auditEntries[0]?.event, 'main.user.request.resolved');
});

test('resolveUserRequest emits one resolved event when both realtime aliases are present', async () => {
  let resolvedCount = 0;
  const service = createUserService({
    env: {},
    repository: {
      resolveApprovalRequest: async () => ({
        kind: 'resolved',
        value: {
          requestId: validRequestId,
          userId: validTargetUserId,
          status: 'approved',
          requestType: 'show_qr',
        },
      }),
    },
    permissionRepository: {
      userHasPermission: async () => true,
    },
    realtime: {
      emitUserRequestUpdated() {},
      emitUserRequestResolved() {
        resolvedCount += 1;
      },
      emitApprovalResolved() {
        resolvedCount += 1;
      },
    },
    auditLog() {},
  });

  await service.resolveUserRequest({
    actorUserId: validActorUserId,
    requestId: validRequestId,
    decision: 'approved',
  });

  assert.equal(resolvedCount, 1);
});

test('editUser updates a user that still has a temporary password', async () => {
  const auditEntries = [];
  const hashCalls = [];
  const updateCalls = [];
  let emittedUpdate = null;

  const service = createUserService({
    env: { BCRYPT_ROUNDS: 12 },
    repository: {
      findUserForEdit: async () => ({
        id: validTargetUserId,
        username: 'old.user',
        password: null,
        temporaryPassword: tempPasswordHash,
        isLocked: false,
      }),
      hashPassword: async (value, rounds) => {
        hashCalls.push({ value, rounds });
        return nextPasswordHash;
      },
      updateUser: async (payload) => {
        updateCalls.push(payload);
      },
    },
    permissionRepository: {
      userHasPermission: async () => true,
    },
    realtime: {
      emitUserUpdated(userId, username) {
        emittedUpdate = { userId, username };
      },
    },
    auditLog(event, meta) {
      auditEntries.push({ event, meta });
    },
  });

  const result = await service.editUser({
    actorUserId: validActorUserId,
    userId: validTargetUserId,
    username: 'new.user',
    password: strongPassword,
    requestMeta: { ipAddress: '127.0.0.1' },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    message: 'User edited successfully',
    userId: validTargetUserId,
    locked: false,
    invalidateSessions: false,
  });
  assert.deepEqual(hashCalls, [{ value: strongPassword, rounds: 12 }]);
  assert.deepEqual(updateCalls, [
    {
      actorUserId: validActorUserId,
      userId: validTargetUserId,
      username: 'new.user',
      passwordHash: nextPasswordHash,
    },
  ]);
  assert.deepEqual(emittedUpdate, {
    userId: validTargetUserId,
    username: 'new.user',
  });
  assert.equal(auditEntries[0]?.event, 'main.user.updated');
  assert.equal(auditEntries[0]?.meta?.passwordChanged, true);
});

test('editUser marks a user as locked and requests session invalidation', async () => {
  const updateCalls = [];

  const service = createUserService({
    env: { BCRYPT_ROUNDS: 12 },
    repository: {
      findUserForEdit: async () => ({
        id: validTargetUserId,
        username: 'old.user',
        password: storedPasswordHash,
        temporaryPassword: null,
        isLocked: false,
      }),
      hashPassword: async () => {
        throw new Error('password hash should not be called');
      },
      updateUser: async (payload) => {
        updateCalls.push(payload);
      },
    },
    permissionRepository: {
      userHasPermission: async () => true,
    },
    realtime: {
      emitUserUpdated() {},
    },
    auditLog() {},
  });

  const result = await service.editUser({
    actorUserId: validActorUserId,
    userId: validTargetUserId,
    username: 'old.user',
    password: '',
    locked: true,
  });

  assert.deepEqual(updateCalls, [
    {
      actorUserId: validActorUserId,
      userId: validTargetUserId,
      username: 'old.user',
      passwordHash: null,
      locked: true,
    },
  ]);
  assert.deepEqual(result.body, {
    message: 'User edited successfully',
    userId: validTargetUserId,
    locked: true,
    invalidateSessions: true,
  });
});

test('deleteUsers returns deleted ids and emits realtime updates', async () => {
  const deletedUserSignals = [];
  let deletedUserListSignal = null;

  const service = createUserService({
    env: {},
    repository: {
      deleteUsers: async () => [{ id: validTargetUserId, username: 'removed.user' }],
    },
    permissionRepository: {
      userHasPermission: async () => true,
    },
    realtime: {
      emitUserDeleted(userId) {
        deletedUserSignals.push(userId);
      },
      emitUserDeletedList(userIds) {
        deletedUserListSignal = userIds;
      },
    },
    auditLog() {},
  });

  const result = await service.deleteUsers({
    actorUserId: validActorUserId,
    sessionUserId: '99999999-9999-9999-9999-999999999999',
    userIds: [validTargetUserId],
    requestMeta: { ipAddress: '127.0.0.1' },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    message: 'Users removed successfully',
    deletedUserIds: [validTargetUserId],
  });
  assert.deepEqual(deletedUserSignals, [validTargetUserId]);
  assert.deepEqual(deletedUserListSignal, [validTargetUserId]);
});

test('deleteAdminInboxItem emits inbox and user-list refresh for access requests', async () => {
  let inboxSignal = null;
  let userListRefreshCount = 0;

  const service = createUserService({
    env: {},
    repository: {
      deleteAdminInboxItem: async () => ({
        sourceId: validRequestId,
        kind: 'access_request',
      }),
    },
    permissionRepository: {
      userHasPermission: async () => true,
    },
    realtime: {
      emitAdminInboxUpdated(payload) {
        inboxSignal = payload;
      },
      emitUserListUpdated() {
        userListRefreshCount += 1;
      },
    },
    auditLog() {},
  });

  const result = await service.deleteAdminInboxItem({
    actorUserId: validActorUserId,
    itemId: validRequestId,
    itemKind: 'access_request',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Inbox entry deleted successfully.');
  assert.deepEqual(inboxSignal, {
    kind: 'admin_inbox_deleted',
    itemKind: 'access_request',
    sourceId: validRequestId,
  });
  assert.equal(userListRefreshCount, 1);
});
