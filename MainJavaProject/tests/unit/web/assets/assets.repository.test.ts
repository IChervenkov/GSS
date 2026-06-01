const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('recordAssetInventory uses typed location parameter without unused placeholders', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/assets/infrastructure/repositories/assets.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params = []) {
              queries.push({ sql, params });
              if (sql.includes('SELECT id, quantity')) {
                return {
                  rows: [{ id: 'asset-1', quantity: '2', inventory_status: 'undiscovered' }],
                };
              }
              if (sql.includes('UPDATE app.assets')) {
                return {
                  rows: [
                    {
                      id: 'asset-1',
                      code: 'A-001',
                      quantity: '2',
                      inventory_status: 'completed',
                      location_room: 'room-1',
                      last_inventory_date: new Date('2026-05-14T06:36:06.980Z'),
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

  const asset = await repository.recordAssetInventory({
    actorUserId: 'user-1',
    campId: 'camp-1',
    assetId: 'asset-1',
    locationRoomId: null,
    locationKeyId: 'key-1',
    inventoryStatus: 'completed',
  });

  const updateQuery = queries.find((query) => query.sql.includes('UPDATE app.assets'));
  assert.ok(updateQuery);
  assert.match(updateQuery.sql, /COALESCE\(\$3::uuid, location_room\)/);
  assert.match(updateQuery.sql, /inventory_status = \$4::text/);
  assert.match(updateQuery.sql, /WHEN \$5::uuid IS NOT NULL THEN \$5::uuid/);
  assert.deepEqual(updateQuery.params, ['asset-1', 'camp-1', null, 'completed', 'key-1']);
  assert.equal(asset.id, 'asset-1');
  assert.equal(asset.inventoryStatus, 'completed');
});

test('restartInventory resets only completed assets and can scope to a room', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/assets/infrastructure/repositories/assets.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params = []) {
              queries.push({ sql, params });
              if (sql.includes('UPDATE app.assets')) {
                return { rows: [{ id: 'asset-1' }, { id: 'asset-2' }], rowCount: 2 };
              }
              return { rows: [], rowCount: 0 };
            },
          }),
      },
    },
  );

  const result = await repository.restartInventory({
    actorUserId: 'user-1',
    campId: 'camp-1',
    locationRoomId: 'room-1',
  });

  const updateQuery = queries.find((query) => query.sql.includes('UPDATE app.assets'));
  assert.ok(updateQuery);
  assert.match(updateQuery.sql, /a\.location_room = \$2/);
  assert.match(
    updateQuery.sql,
    /COALESCE\(NULLIF\(a\.inventory_status, ''\), 'undiscovered'\) = 'completed'/,
  );
  assert.deepEqual(updateQuery.params, ['camp-1', 'room-1']);
  assert.deepEqual(result, { updatedCount: 2 });
});
