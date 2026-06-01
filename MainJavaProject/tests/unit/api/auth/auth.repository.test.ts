const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('rotateRefreshSession uses row locks for concurrency-sensitive session rotation', async () => {
  const queries = [];

  const repository = requireFresh('src/modules/api/auth/infrastructure/persistence/auth.repository.ts', {
    'src/infrastructure/db/transaction.ts': {
      withClient: async () => {
        throw new Error('withClient should not be called');
      },
      withTransaction: async (callback) =>
        callback({
          async query(sql) {
            queries.push(sql);
            if (sql.includes('FROM app.user_sessions AS sessions')) {
              return { rowCount: 0, rows: [] };
            }
            return { rowCount: 0, rows: [] };
          },
        }),
    },
  });

  const result = await repository.rotateRefreshSession({
    userId: 'user-1',
    refreshTokenHash: 'hash-1',
    refreshJti: null,
    deviceId: 'device-1',
    expectedTokenVersion: 0,
    nextRefreshHash: 'hash-2',
    nextRefreshJti: 'jti-2',
    ttlDays: 7,
    clientFingerprintHash: null,
    requestMeta: null,
    maxActivePerUser: null,
    maxActivePerDevice: null,
  });

  assert.deepEqual(result, {
    ok: false,
    reason: 'not_found',
  });

  const lockQuery = queries.find((sql) => sql.includes('FOR UPDATE OF sessions, users'));
  assert.ok(lockQuery, 'expected the session lookup query to lock the session and user rows');
});
