const test = require('node:test');
const assert = require('node:assert/strict');

const { invalidateUserSessions } = require('../../../src/shared/utils/session-utils');

test('invalidateUserSessions destroys matching sessions from an array-based store', async () => {
  const destroyedSessionIds = [];
  const result = await invalidateUserSessions({
    userIds: ['user-1'],
    store: {
      all(callback) {
        callback(null, [
          { id: 'sess-1', userId: 'user-1' },
          { id: 'sess-2', pendingUserId: 'user-1' },
          { id: 'sess-3', userId: 'user-2' },
        ]);
      },
      destroy(sessionId, callback) {
        destroyedSessionIds.push(sessionId);
        callback(null);
      },
    },
  });

  assert.deepEqual(destroyedSessionIds, ['sess-1', 'sess-2']);
  assert.deepEqual(result, {
    destroyedSessionIds: ['sess-1', 'sess-2'],
    skipped: false,
  });
});

test('invalidateUserSessions destroys matching sessions from an object-based store', async () => {
  const destroyedSessionIds = [];
  const result = await invalidateUserSessions({
    userIds: ['user-2'],
    store: {
      all(callback) {
        callback(null, {
          'sess-1': { userId: 'user-1' },
          'sess-2': { pendingPasswordChangeUserId: 'user-2' },
        });
      },
      destroy(sessionId, callback) {
        destroyedSessionIds.push(sessionId);
        callback(null);
      },
    },
  });

  assert.deepEqual(destroyedSessionIds, ['sess-2']);
  assert.deepEqual(result, {
    destroyedSessionIds: ['sess-2'],
    skipped: false,
  });
});

test('invalidateUserSessions skips stores that cannot enumerate sessions', async () => {
  const result = await invalidateUserSessions({
    userIds: ['user-1'],
    store: {
      destroy(_sessionId, callback) {
        callback(null);
      },
    },
  });

  assert.deepEqual(result, {
    destroyedSessionIds: [],
    skipped: true,
  });
});
