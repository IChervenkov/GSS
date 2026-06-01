const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('findUserByUsername maps a persisted user row into a predictable entity', async () => {
  const repository = requireFresh('src/modules/web/auth/infrastructure/repositories/user-auth.repository.ts', {
    'src/infrastructure/db/transaction.ts': {
      withClient: async (callback) =>
        callback({
          async query() {
            return {
              rows: [
                {
                  id: 'user-1',
                  username: 'operator',
                  password: 'hash',
                  temporary_password: null,
                  totp_secret: 'totp-secret',
                  is_locked: 0,
                },
              ],
            };
          },
        }),
    },
  });

  const result = await repository.findUserByUsername('operator');

  assert.deepEqual(result, {
    id: 'user-1',
    username: 'operator',
    password: 'hash',
    temporaryPassword: null,
    totpSecret: 'totp-secret',
    isLocked: false,
  });
});

test('findUserByUsername returns null when the user does not exist', async () => {
  const repository = requireFresh('src/modules/web/auth/infrastructure/repositories/user-auth.repository.ts', {
    'src/infrastructure/db/transaction.ts': {
      withClient: async (callback) =>
        callback({
          async query() {
            return { rows: [] };
          },
        }),
    },
  });

  const result = await repository.findUserByUsername('missing');
  assert.equal(result, null);
});
