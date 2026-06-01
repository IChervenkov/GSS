const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createUserSessionInvalidator,
} = require('../../../../src/modules/web/main-page/infrastructure/session/user-session.invalidator');

test('user session invalidator destroys sessions and disconnects live sockets', async () => {
  const destroyedSessionIds = [];
  const disconnected = [];
  const invalidator = createUserSessionInvalidator({
    disconnectUserSockets: async (userId, reason) => {
      disconnected.push({ userId, reason });
      return userId === 'user-1' ? 2 : 1;
    },
  });

  const result = await invalidator.invalidate({
    reason: 'admin_user_deleted',
    userIds: ['user-1', 'user-1', 'user-2'],
    store: {
      all(callback) {
        callback(null, {
          'sess-1': { userId: 'user-1' },
          'sess-2': { pendingUserId: 'user-2' },
          'sess-3': { userId: 'user-3' },
        });
      },
      destroy(sessionId, callback) {
        destroyedSessionIds.push(sessionId);
        callback(null);
      },
    },
  });

  assert.deepEqual(destroyedSessionIds.sort(), ['sess-1', 'sess-2']);
  assert.deepEqual(disconnected, [
    { userId: 'user-1', reason: 'admin_user_deleted' },
    { userId: 'user-2', reason: 'admin_user_deleted' },
  ]);
  assert.deepEqual(result.disconnectedSocketCounts, { 'user-1': 2, 'user-2': 1 });
});

