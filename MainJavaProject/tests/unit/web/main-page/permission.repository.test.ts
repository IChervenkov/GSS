const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('listPermissionMatrix uses only whitelisted filter and sort columns', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/permission.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('COUNT(*)::int AS count')) {
                return { rows: [{ count: 1 }] };
              }
              if (sql.includes('FROM app.users')) {
                return { rows: [{ id: 'user-1', username: 'operator' }] };
              }
              if (sql.includes('FROM app.permissions') && sql.includes('LIMIT')) {
                return { rows: [{ id: 'perm-1', name: 'Manage users' }] };
              }
              return { rows: [{ user_id: 'user-1', permission_id: 'perm-1' }] };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called');
        },
      },
    },
  );

  const result = await repository.listPermissionMatrix({
    adminUsername: 'admin',
    page: 1,
    limit: 20,
    filters: [
      { column: 'name', value: 'Manage' },
      { column: 'name; DROP TABLE app.permissions', value: 'bad' },
    ],
    sort: {
      column: 'name; DROP TABLE app.permissions',
      direction: 'desc',
    },
  });

  assert.deepEqual(result, {
    users: [{ id: 'user-1', username: 'operator' }],
    permissions: [{ id: 'perm-1', name: 'Manage users' }],
    userPermissions: [{ userId: 'user-1', permissionId: 'perm-1' }],
    total: 1,
  });

  const permissionsQuery = queries.find((entry) => entry.sql.includes('FROM app.permissions') && entry.sql.includes('LIMIT'));
  assert.ok(permissionsQuery);
  assert.match(permissionsQuery.sql, /WHERE name::text ILIKE \$1/);
  assert.match(permissionsQuery.sql, /ORDER BY name ASC, name ASC/);
  assert.doesNotMatch(permissionsQuery.sql, /DROP TABLE/);
  assert.deepEqual(permissionsQuery.params, ['%Manage%', 20, 0]);
});

test('userHasPermission returns false when no rows are found', async () => {
  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/permission.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query() {
              return { rowCount: 0, rows: [] };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called');
        },
      },
    },
  );

  const result = await repository.userHasPermission('user-1', 'Manage users');
  assert.equal(result, false);
});
