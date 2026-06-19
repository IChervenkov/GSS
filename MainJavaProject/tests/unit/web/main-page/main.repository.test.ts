const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('listCampsAndPermissions returns all camps with per-user access flags', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/main.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('COUNT(*)::int AS count')) {
                return { rows: [{ count: 2 }] };
              }
              if (sql.includes('LEFT JOIN app.user_camp_access')) {
                return {
                  rows: [
                    {
                      id: 'camp-1',
                      name: 'Alpha',
                      created_at: '2024-01-01T00:00:00.000Z',
                      can_access: true,
                    },
                    {
                      id: 'camp-2',
                      name: 'Bravo',
                      created_at: '2024-01-02T00:00:00.000Z',
                      can_access: false,
                    },
                  ],
                };
              }
              return { rows: [{ name: 'Bicycles' }] };
            },
          }),
      },
    },
  );

  const result = await repository.listCampsAndPermissions({
    userId: 'user-1',
    page: 1,
    limit: 10,
    filters: [{ column: 'name', value: 'a' }],
    sortColumn: 'name',
    sortDirection: 'asc',
  });

  assert.deepEqual(result.camps.map((camp) => ({ id: camp.id, canAccess: camp.canAccess })), [
    { id: 'camp-1', canAccess: true },
    { id: 'camp-2', canAccess: false },
  ]);
  assert.equal(result.total, 2);

  const campQuery = queries.find((entry) => entry.sql.includes('LEFT JOIN app.user_camp_access'));
  assert.ok(campQuery);
  assert.match(campQuery.sql, /LEFT JOIN app\.user_camp_access/);
  assert.match(campQuery.sql, /uca\.user_id = \$1/);
  assert.match(campQuery.sql, /WHERE c\.name ILIKE \$2/);
  assert.deepEqual(campQuery.params, ['user-1', '%a%', 10, 0]);
});
