const test = require('node:test');
const assert = require('node:assert/strict');

const {
  filterAuthorizedRooms,
} = require('../../src/infrastructure/realtime/room-policy');

const principal = {
  id: '11111111-1111-1111-1111-111111111111',
  permissions: ['Admin permission'],
};

test('permission revocation while a privileged UI is open drops the shared room on re-evaluation', async () => {
  let permissionGranted = true;

  const initial = await filterAuthorizedRooms({
    principal,
    requestedRooms: ['permission:list', 'user:list'],
    hasPermission: async (_principal, permissionName) =>
      permissionName === 'Admin permission' && permissionGranted,
  });

  assert.deepEqual(initial.allowed, ['permission:list', 'user:list']);
  assert.deepEqual(initial.rejected, []);

  permissionGranted = false;

  const afterRevocation = await filterAuthorizedRooms({
    principal,
    requestedRooms: ['permission:list', 'user:list'],
    hasPermission: async (_principal, permissionName) =>
      permissionName === 'Admin permission' && permissionGranted,
  });

  assert.deepEqual(afterRevocation.allowed, []);
  assert.equal(afterRevocation.rejected.length, 2);
  assert.ok(afterRevocation.rejected.every((entry) => entry.reasonCode === 'missing_permission'));
});
