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

test('listCampAccessMatrix returns paged camps and user camp grants', async () => {
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
              if (sql.includes('FROM app.camps') && sql.includes('LIMIT')) {
                return { rows: [{ id: 'camp-1', name: 'Alpha' }] };
              }
              return { rows: [{ user_id: 'user-1', camp_id: 'camp-1' }] };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called');
        },
      },
    },
  );

  const result = await repository.listCampAccessMatrix({
    adminUsername: 'admin',
    page: 1,
    limit: 20,
    filters: [
      { column: 'name', value: 'Alpha' },
      { column: 'name; DROP TABLE app.camps', value: 'bad' },
    ],
    sort: {
      column: 'name; DROP TABLE app.camps',
      direction: 'desc',
    },
  });

  assert.deepEqual(result, {
    users: [{ id: 'user-1', username: 'operator' }],
    camps: [{ id: 'camp-1', name: 'Alpha' }],
    userCampAccess: [{ userId: 'user-1', campId: 'camp-1' }],
    total: 1,
  });

  const campsQuery = queries.find(
    (entry) => entry.sql.includes('FROM app.camps') && entry.sql.includes('LIMIT'),
  );
  assert.ok(campsQuery);
  assert.match(campsQuery.sql, /WHERE name::text ILIKE \$1/);
  assert.match(campsQuery.sql, /ORDER BY name ASC, name ASC/);
  assert.doesNotMatch(campsQuery.sql, /DROP TABLE/);
  assert.deepEqual(campsQuery.params, ['%Alpha%', 20, 0]);
});

test('saveCampAccess grants and revokes camp access in one transaction', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/permission.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return { rows: [] };
            },
          }),
      },
    },
  );

  const result = await repository.saveCampAccess({
    actorUserId: 'actor-1',
    changes: [
      { userId: 'user-1', campId: 'camp-1', isChecked: true },
      { userId: 'user-2', campId: 'camp-2', isChecked: false },
    ],
  });

  assert.deepEqual(result, { affectedUserIds: ['user-1', 'user-2'] });
  assert.match(queries[0].sql, /INSERT INTO app\.user_camp_access/);
  assert.deepEqual(queries[0].params, ['user-1', 'camp-1', 'actor-1']);
  assert.match(queries[1].sql, /DELETE FROM app\.user_camp_access/);
  assert.deepEqual(queries[1].params, ['user-2', 'camp-2']);
  assert.match(queries[2].sql, /INSERT INTO app\.user_monitoring_events/);
});
