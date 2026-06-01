const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

function createRepositoryWithQueries(queries) {
  return requireFresh(
    'src/modules/web/accommodation/infrastructure/repositories/accommodation.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('SELECT id, name, laundry_bag_id')) {
                return { rows: [{ id: 'soldier-1', name: 'Soldier One', laundry_bag_id: null }] };
              }
              if (sql.includes('UPDATE app.laundry_bags lb')) {
                return { rows: [], rowCount: 1 };
              }
              if (sql.includes('INSERT INTO app.additional_items')) {
                return {
                  rows: [
                    {
                      id: 'item-1',
                      soldier_id: 'soldier-1',
                      description: 'Laundry bag',
                      quantity: '1',
                      laundry_bag_id: 'bag-1',
                    },
                  ],
                };
              }
              return { rows: [], rowCount: 0 };
            },
          }),
      },
    },
  );
}

test('addAdditionalItem occupies additional laundry bags without replacing the soldier primary bag', async () => {
  const queries = [];
  const repository = createRepositoryWithQueries(queries);

  const result = await repository.addAdditionalItem({
    actorUserId: null,
    campId: 'camp-1',
    soldierId: 'soldier-1',
    description: 'Laundry bag',
    quantity: '1',
    laundryBagId: 'bag-1',
  });

  assert.equal(result.laundryBagId, 'bag-1');
  const bagUpdate = queries.find((query) => query.sql.includes('UPDATE app.laundry_bags lb'));
  assert.ok(bagUpdate);
  assert.deepEqual(bagUpdate.params, ['soldier-1', 'bag-1', 'camp-1']);
  assert.match(bagUpdate.sql, /SET soldier_id = \$1/);
  assert.match(bagUpdate.sql, /COALESCE\(NULLIF\(lb\.status, ''\), 'pick_up'\) = 'pick_up'/);
  assert.match(bagUpdate.sql, /NOT EXISTS \(\s+SELECT 1\s+FROM app\.additional_items ai/);

  const soldierUpdate = queries.find((query) => query.sql.includes('UPDATE app.soldiers'));
  assert.equal(soldierUpdate, undefined);
});

test('addAdditionalItem rejects laundry bags occupied by another soldier', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/accommodation/infrastructure/repositories/accommodation.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('SELECT id, name, laundry_bag_id')) {
                return { rows: [{ id: 'soldier-1', name: 'Soldier One', laundry_bag_id: null }] };
              }
              if (sql.includes('UPDATE app.laundry_bags lb')) {
                return { rows: [], rowCount: 0 };
              }
              throw new Error('save should be blocked before inserting the additional item');
            },
          }),
      },
    },
  );

  await assert.rejects(
    () =>
      repository.addAdditionalItem({
        actorUserId: null,
        campId: 'camp-1',
        soldierId: 'soldier-1',
        description: 'Laundry bag',
        quantity: '1',
        laundryBagId: 'bag-1',
      }),
    /Only Available laundry bags .* can be assigned/,
  );

  assert.ok(queries.some((query) => query.sql.includes('UPDATE app.laundry_bags lb')));
});

test('editAdditionalItem allows keeping its own laundry bag but blocks duplicate bag links', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/accommodation/infrastructure/repositories/accommodation.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('SELECT ai.id, ai.soldier_id, ai.laundry_bag_id')) {
                return {
                  rows: [
                    {
                      id: 'item-1',
                      soldier_id: 'soldier-1',
                      laundry_bag_id: 'bag-1',
                    },
                  ],
                };
              }
              if (sql.includes('SELECT id, name, laundry_bag_id')) {
                return { rows: [{ id: 'soldier-1', name: 'Soldier One', laundry_bag_id: null }] };
              }
              if (sql.includes('UPDATE app.laundry_bags lb')) {
                return { rows: [], rowCount: 1 };
              }
              if (sql.includes('UPDATE app.additional_items')) {
                return {
                  rows: [
                    {
                      id: 'item-1',
                      soldier_id: 'soldier-1',
                      description: 'Laundry bag',
                      quantity: '1',
                      laundry_bag_id: 'bag-1',
                    },
                  ],
                };
              }
              return { rows: [], rowCount: 0 };
            },
          }),
      },
    },
  );

  const result = await repository.editAdditionalItem({
    actorUserId: null,
    campId: 'camp-1',
    itemId: 'item-1',
    soldierId: 'soldier-1',
    description: 'Laundry bag',
    quantity: '1',
    laundryBagId: 'bag-1',
  });

  assert.equal(result.laundryBagId, 'bag-1');
  const bagUpdate = queries.find((query) => query.sql.includes('UPDATE app.laundry_bags lb'));
  assert.ok(bagUpdate);
  assert.match(bagUpdate.sql, /FROM app\.additional_items ai/);
  assert.match(bagUpdate.sql, /ai\.id <> \$4/);
  assert.deepEqual(bagUpdate.params, ['soldier-1', 'bag-1', 'camp-1', 'item-1']);
});

test('accommodateSoldier locks only the keys base table when reading key room metadata', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/accommodation/infrastructure/repositories/accommodation.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('FROM app.soldiers') && sql.includes('SELECT id, name, used_key')) {
                return { rows: [{ id: 'soldier-1', name: 'Soldier One', used_key: null }] };
              }
              if (sql.includes('FROM app.keys k') && sql.includes('LEFT JOIN app.room_keys')) {
                return {
                  rows: [
                    {
                      id: 'key-1',
                      name: 'Room 101',
                      soldier_id: null,
                      building_type: 'Accommodation',
                      has_bed_asset: true,
                    },
                  ],
                };
              }
              if (sql.includes('UPDATE app.soldiers')) return { rows: [{ id: 'soldier-1' }], rowCount: 1 };
              if (sql.includes('UPDATE app.keys')) return { rows: [{ id: 'key-1' }], rowCount: 1 };
              return { rows: [], rowCount: 1 };
            },
          }),
      },
    },
  );

  const result = await repository.accommodateSoldier({
    actorUserId: 'actor-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    keyId: 'key-1',
  });

  assert.deepEqual(result, { soldierId: 'soldier-1', keyId: 'key-1' });
  const keyLockQuery = queries.find(
    (query) => query.sql.includes('FROM app.keys k') && query.sql.includes('LEFT JOIN app.room_keys'),
  );
  assert.ok(keyLockQuery);
  assert.match(keyLockQuery.sql, /FOR UPDATE OF k/);
  assert.doesNotMatch(keyLockQuery.sql, /FOR UPDATE\s*$/);
});
