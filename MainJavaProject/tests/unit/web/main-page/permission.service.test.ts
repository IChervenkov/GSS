const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPermissionService,
} = require('../../../../src/modules/web/main-page/application/services/permission.service');
const {
  createMainEventBus,
} = require('../../../../src/modules/web/main-page/infrastructure/realtime/main-page.event-bus');

test('main event bus emits permission list and authenticated access update signals', () => {
  const emitted = [];
  const eventBus = createMainEventBus({
    emitRoomEvent(room, eventName, payload = {}) {
      emitted.push({ room, eventName, payload });
      return true;
    },
  });

  assert.equal(eventBus.emitPermissionListUpdated(), true);
  assert.equal(eventBus.emitPermissionAccessChanged(), true);

  assert.deepEqual(emitted, [
    { room: 'ui:permission:list', eventName: 'permission:updated', payload: {} },
    { room: 'presence:authenticated', eventName: 'permission:access:changed', payload: {} },
  ]);
});

test('savePermissions emits self-refresh events for each affected user', async () => {
  const emitted = [];
  const reevaluated = [];

  const service = createPermissionService({
    env: {},
    repository: {
      userHasPermission: async () => true,
      savePermissions: async () => ({
        affectedUserIds: [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
        ],
      }),
    },
    realtime: {
      emitPermissionListUpdated() {
        emitted.push({ type: 'list' });
      },
      emitPermissionAccessChanged() {
        emitted.push({ type: 'access' });
      },
      emitPermissionSelfRefresh(userId) {
        emitted.push({ type: 'self', userId });
      },
      async reevaluateUserSockets(userId, reason) {
        reevaluated.push({ userId, reason });
      },
    },
    auditLog() {},
  });

  const result = await service.savePermissions({
    actorUserId: '33333333-3333-3333-3333-333333333333',
    changes: [
      {
        userId: '11111111-1111-1111-1111-111111111111',
        permId: 'perm-1',
        isCheck: true,
      },
      {
        userId: '22222222-2222-2222-2222-222222222222',
        permId: 'perm-2',
        isCheck: false,
      },
    ],
  });

  assert.equal(result.status, 200);
  assert.deepEqual(emitted, [
    { type: 'list' },
    { type: 'access' },
    { type: 'self', userId: '11111111-1111-1111-1111-111111111111' },
    { type: 'self', userId: '22222222-2222-2222-2222-222222222222' },
  ]);
  assert.deepEqual(reevaluated, [
    { userId: '11111111-1111-1111-1111-111111111111', reason: 'permissions_changed' },
    { userId: '22222222-2222-2222-2222-222222222222', reason: 'permissions_changed' },
  ]);
});

test('saveCampAccess emits camp-access refresh events for each affected user', async () => {
  const emitted = [];
  const reevaluated = [];

  const service = createPermissionService({
    env: {},
    repository: {
      userHasPermission: async () => true,
      saveCampAccess: async () => ({
        affectedUserIds: [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
        ],
      }),
    },
    realtime: {
      emitCampAccessChanged() {
        emitted.push({ type: 'camp-access' });
      },
      emitCampAccessSelfRefresh(userId) {
        emitted.push({ type: 'self', userId });
      },
      async reevaluateUserSockets(userId, reason) {
        reevaluated.push({ userId, reason });
      },
    },
    auditLog() {},
  });

  const result = await service.saveCampAccess({
    actorUserId: '33333333-3333-3333-3333-333333333333',
    changes: [
      {
        userId: '11111111-1111-1111-1111-111111111111',
        campId: '44444444-4444-4444-4444-444444444444',
        isCheck: true,
      },
      {
        userId: '22222222-2222-2222-2222-222222222222',
        campId: '55555555-5555-5555-5555-555555555555',
        isCheck: false,
      },
    ],
  });

  assert.equal(result.status, 200);
  assert.deepEqual(emitted, [
    { type: 'camp-access' },
    { type: 'self', userId: '11111111-1111-1111-1111-111111111111' },
    { type: 'self', userId: '22222222-2222-2222-2222-222222222222' },
  ]);
  assert.deepEqual(reevaluated, [
    { userId: '11111111-1111-1111-1111-111111111111', reason: 'permissions_changed' },
    { userId: '22222222-2222-2222-2222-222222222222', reason: 'permissions_changed' },
  ]);
});

test('savePermissions rejects Full permission without Admin permission', async () => {
  const checkedPermissions = [];
  const service = createPermissionService({
    env: {},
    repository: {
      userHasPermission: async (_userId, permissionName) => {
        checkedPermissions.push(permissionName);
        return permissionName === 'Full permission';
      },
      savePermissions: async () => {
        throw new Error('savePermissions should not be called');
      },
    },
    realtime: {},
    auditLog() {},
  });

  await assert.rejects(
    () =>
      service.savePermissions({
        actorUserId: '33333333-3333-3333-3333-333333333333',
        changes: [],
      }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'PERMISSION_DENIED');
      return true;
    },
  );
  assert.deepEqual(checkedPermissions, ['Admin permission']);
});
