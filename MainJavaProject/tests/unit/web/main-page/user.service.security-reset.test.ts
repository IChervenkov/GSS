const test = require('node:test');
const assert = require('node:assert/strict');

const { createUserService } = require('../../../../src/modules/web/main-page/application/services/user.service');

const actorUserId = '11111111-1111-1111-1111-111111111111';
const targetUserId = '22222222-2222-2222-2222-222222222222';

test('securityResetUser increments token state through repository and audits actor/target ids', async () => {
  const auditEntries = [];
  const realtimeEvents = [];
  const service = createUserService({
    env: {},
    repository: {
      findUserForEdit: async () => ({ id: targetUserId, username: 'target.user', isLocked: false }),
      securityResetUser: async (payload) => {
        assert.deepEqual(payload, { actorUserId, userId: targetUserId });
        return { id: targetUserId, username: 'target.user', tokenVersion: 5 };
      },
    },
    permissionRepository: { userHasPermission: async () => true },
    realtime: { emitUserUpdated: (userId, username) => realtimeEvents.push({ userId, username }) },
    auditLog: (event, meta) => auditEntries.push({ event, meta }),
  });

  const result = await service.securityResetUser({ actorUserId, userId: targetUserId, requestMeta: { reqId: 'req-1' } });
  assert.equal(result.status, 200);
  assert.deepEqual(realtimeEvents, [{ userId: targetUserId, username: 'target.user' }]);
  assert.equal(auditEntries[0].event, 'main.user.security_reset');
  assert.equal(auditEntries[0].meta.actorUserId, actorUserId);
  assert.equal(auditEntries[0].meta.targetUserId, targetUserId);
});
