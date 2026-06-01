const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRoomPolicy,
  getDefaultRoomsForUser,
  parseRoom,
} = require('../../../src/infrastructure/realtime/room-policy');

const userId = '11111111-1111-1111-1111-111111111111';

test('default rooms always include self, presence, and workspace notification rooms', async () => {
  assert.deepEqual(getDefaultRoomsForUser(userId), [
    `user:${userId}`,
    'presence:authenticated',
    'ui:workspace:notifications',
  ]);
});

test('parseRoom resolves registered room metadata', async () => {
  assert.deepEqual(parseRoom(`user:${userId}`), {
    key: 'user.self',
    roomKind: 'user',
    roomName: `user:${userId}`,
    ownerUserId: userId,
    isDefault: true,
    manualUnsubscribeAllowed: false,
  });
  assert.equal(parseRoom('ui:user:list').roomKind, 'ui.user.list');
});

test('room policy denies shared admin rooms without live permission checks', async () => {
  const roomPolicy = createRoomPolicy();
  const result = await roomPolicy.canAccessRoom({ principal: { id: userId }, room: 'ui:user:list' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROOM_ACCESS_DENIED');
});

test('room policy allows camp list room for authenticated users', async () => {
  const roomPolicy = createRoomPolicy();
  const result = await roomPolicy.canAccessRoom({ principal: { id: userId }, room: 'ui:camp:list' });
  assert.equal(result.ok, true);
  assert.equal(result.code, null);
});

test('room policy allows accommodation list room with accommodation section permission', async () => {
  const roomPolicy = createRoomPolicy({
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return permissionName === 'Accommodation and keys';
      },
    },
  });

  const result = await roomPolicy.canAccessRoom({
    principal: { id: userId },
    room: 'ui:accommodation:list',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, null);
  assert.equal(parseRoom('ui:accommodation:list').roomKind, 'ui.accommodation.list');
});

test('room policy requires bicycle section access for bicycle list room', async () => {
  const roomPolicy = createRoomPolicy({
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return permissionName === 'Bicycles';
      },
    },
  });

  const result = await roomPolicy.canAccessRoom({
    principal: { id: userId },
    room: 'ui:bicycle:list',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, null);
});

test('room policy rejects bicycle list room with only bike operation permissions', async () => {
  const roomPolicy = createRoomPolicy({
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return permissionName === 'Add bike';
      },
    },
  });

  const result = await roomPolicy.canAccessRoom({
    principal: { id: userId },
    room: 'ui:bicycle:list',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROOM_ACCESS_DENIED');
});

test('room policy allows capability-based rooms and rejects cross-user rooms', async () => {
  const roomPolicy = createRoomPolicy({
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return permissionName === 'Admin permission';
      },
    },
  });

  const userRoomResult = await roomPolicy.canAccessRoom({
    principal: { id: userId },
    room: `user:${userId}`,
  });
  assert.equal(userRoomResult.ok, true);

  const sharedRoomResult = await roomPolicy.canAccessRoom({
    principal: { id: userId },
    room: 'ui:user:list',
  });
  assert.equal(sharedRoomResult.ok, true);

  const foreignRoomResult = await roomPolicy.canAccessRoom({
    principal: { id: userId },
    room: 'user:22222222-2222-2222-2222-222222222222',
  });
  assert.equal(foreignRoomResult.ok, false);
  assert.equal(foreignRoomResult.code, 'ROOM_ACCESS_DENIED');
});

test('room policy rejects admin rooms for Full permission without Admin permission', async () => {
  const checkedPermissions = [];
  const roomPolicy = createRoomPolicy({
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        checkedPermissions.push(permissionName);
        return permissionName === 'Full permission';
      },
    },
  });

  const result = await roomPolicy.canAccessRoom({
    principal: { id: userId },
    room: 'ui:permission:list',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROOM_ACCESS_DENIED');
  assert.deepEqual(checkedPermissions, ['Admin permission']);
});

test('filterAuthorizedRooms deduplicates rooms and separates rejected items with reason codes', async () => {
  const roomPolicy = createRoomPolicy({
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return permissionName === 'Add camp';
      },
    },
  });

  const result = await roomPolicy.filterAuthorizedRooms({
    principal: { id: userId },
    rooms: ['ui:camp:list', `user:${userId}`, 'bad-room', `user:${userId}`, 'ui:user:list'],
  });

  assert.deepEqual(result.allowed, ['ui:camp:list', `user:${userId}`]);
  assert.deepEqual(result.rejected, [
    { room: 'bad-room', code: 'ROOM_NOT_REGISTERED' },
    { room: 'ui:user:list', code: 'ROOM_ACCESS_DENIED' },
  ]);
});
