// @ts-nocheck
const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../helpers/module-mocks');

function createClient() {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (sql === 'SELECT fail') {
        const error = new Error('duplicate');
        error.code = '23505';
        throw error;
      }
      return { rowCount: 1, rows: [] };
    },
    releaseCalled: false,
    release() {
      this.releaseCalled = true;
    },
  };
}

test('withTransaction commits on success and releases client', async () => {
  const client = createClient();
  const { withTransaction } = requireFresh('src/infrastructure/db/transaction.ts', {
    'src/infrastructure/db/pool.ts': {
      pool: {
        connect: async () => client,
      },
    },
  });

  const result = await withTransaction(async (dbClient) => {
    await dbClient.query('SELECT 1');
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.deepEqual(client.queries, ['BEGIN', 'SELECT 1', 'COMMIT']);
  assert.equal(client.releaseCalled, true);
});

test('withTransaction rolls back and maps db errors', async () => {
  const client = createClient();
  const { withTransaction } = requireFresh('src/infrastructure/db/transaction.ts', {
    'src/infrastructure/db/pool.ts': {
      pool: {
        connect: async () => client,
      },
    },
  });

  await assert.rejects(
    () =>
      withTransaction(async (dbClient) => {
        await dbClient.query('SELECT fail');
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'DUPLICATE_DATA');
      return true;
    },
  );

  assert.deepEqual(client.queries, ['BEGIN', 'SELECT fail', 'ROLLBACK']);
  assert.equal(client.releaseCalled, true);
});
