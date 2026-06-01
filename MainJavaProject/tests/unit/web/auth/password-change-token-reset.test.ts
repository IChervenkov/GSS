const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

const userId = '11111111-1111-1111-1111-111111111111';

test('password change completion increments token_version and revokes active refresh sessions', async () => {
  const calls = [];
  const repository = requireFresh('src/modules/web/auth/infrastructure/repositories/password-change.repository.ts', {
    'src/infrastructure/db/transaction.ts': {
      withClient: async () => null,
      withTransaction: async (fn) =>
        fn({
          query: async (sql, params) => {
            calls.push({ sql: String(sql), params });
            return { rowCount: 1, rows: [] };
          },
        }),
    },
  });

  await repository.completePasswordChange({
    userId,
    hashedNewPassword: 'hash-1',
    requestId: '22222222-2222-2222-2222-222222222222',
  });

  assert.match(calls[0].sql, /token_version = token_version \+ 1/);
  assert.deepEqual(calls[0].params, ['hash-1', userId]);
  assert.match(calls[1].sql, /UPDATE app\.user_sessions/);
  assert.deepEqual(calls[1].params, [userId]);
});
