const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('listRentalReport includes bicycles marked for repair in rows and daily totals', async () => {
  const queries = [];
  const from = new Date('2026-04-17T00:00:00.000Z');
  const to = new Date('2026-04-18T00:00:00.000Z');

  const repository = requireFresh(
    'src/modules/web/bicycles/infrastructure/repositories/bicycles.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });

              if (sql.includes('COUNT(*)::int AS rental_count')) {
                return { rows: [{ rental_date: '2026-04-17', rental_count: 1 }] };
              }

              return {
                rows: [
                  {
                    assignment_id: 'assignment-1',
                    bicycle_id: 'bike-1',
                    bicycle_name: 'Bike 1',
                    bicycle_nfc_code: 'NFC-B-1',
                    soldier_id: null,
                    soldier_name: null,
                    soldier_country: null,
                    soldier_meal_card: null,
                    helmet_id: null,
                    helmet_code: null,
                    helmet_nfc_code: null,
                    rented_at: from,
                    returned_at: null,
                    status: 'repair',
                    rental_date: '2026-04-17',
                  },
                ],
              };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called');
        },
      },
    },
  );

  const result = await repository.listRentalReport({ campId: 'camp-1', from, to });

  assert.equal(result.rows[0].status, 'repair');
  assert.deepEqual(result.dailyTotals, [{ date: '2026-04-17', rentalCount: 1 }]);
  assert.equal(queries.length, 2);
  queries.forEach((query) => {
    assert.deepEqual(query.params, ['camp-1', from, to]);
    assert.doesNotMatch(query.sql, /<>\s*'repair'/);
  });
});

test('listRecentRentalsByAsset includes repair assignments for the report lookup', async () => {
  const queries = [];
  const rentedAt = new Date('2026-04-17T10:00:00.000Z');

  const repository = requireFresh(
    'src/modules/web/bicycles/infrastructure/repositories/bicycles.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return {
                rows: [
                  {
                    assignment_id: 'assignment-1',
                    bicycle_id: 'bike-1',
                    bicycle_name: 'Bike 1',
                    bicycle_nfc_code: 'NFC-B-1',
                    soldier_id: null,
                    soldier_name: null,
                    soldier_country: null,
                    soldier_meal_card: null,
                    helmet_id: null,
                    helmet_code: null,
                    helmet_nfc_code: null,
                    rented_at: rentedAt,
                    returned_at: null,
                    status: 'repair',
                    rental_date: '2026-04-17',
                  },
                ],
              };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called');
        },
      },
    },
  );

  const result = await repository.listRecentRentalsByAsset({
    campId: 'camp-1',
    assetType: 'bicycle',
    assetId: 'bike-1',
    limit: 2,
  });

  assert.equal(result[0].status, 'repair');
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].params, ['camp-1', 'bicycle', 'bike-1', 2]);
  assert.doesNotMatch(queries[0].sql, /<>\s*'repair'/);
});

test('deleteBicycle only blocks active assignment references', async () => {
  let deleteSql = '';

  const repository = requireFresh(
    'src/modules/web/bicycles/infrastructure/repositories/bicycles.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql) {
              if (sql.includes('FROM app.bicycles') && sql.includes('LIMIT 1')) {
                return { rows: [{ id: 'bike-1', name: 'Bike 1' }] };
              }
              if (sql.includes('DELETE FROM app.bicycles')) {
                deleteSql = sql;
                return { rows: [{ id: 'bike-1' }] };
              }
              if (sql.includes('INSERT INTO app.user_monitoring_events')) {
                return { rows: [] };
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
          }),
      },
    },
  );

  const result = await repository.deleteBicycle({
    actorUserId: 'user-1',
    identifier: 'bike-1',
    campId: 'camp-1',
  });

  assert.deepEqual(result, { id: 'bike-1', name: 'Bike 1' });
  assert.match(deleteSql, /ba\.date_to IS NULL/);
});

test('deleteHelmet only blocks active assignment references', async () => {
  let deleteSql = '';

  const repository = requireFresh(
    'src/modules/web/bicycles/infrastructure/repositories/bicycles.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql) {
              if (sql.includes('FROM app.helmets') && sql.includes('LIMIT 1')) {
                return { rows: [{ id: 'helmet-1', code: 'H-1' }] };
              }
              if (sql.includes('DELETE FROM app.helmets')) {
                deleteSql = sql;
                return { rows: [{ id: 'helmet-1' }] };
              }
              if (sql.includes('INSERT INTO app.user_monitoring_events')) {
                return { rows: [] };
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
          }),
      },
    },
  );

  const result = await repository.deleteHelmet({
    actorUserId: 'user-1',
    helmetId: 'helmet-1',
    campId: 'camp-1',
  });

  assert.deepEqual(result, { id: 'helmet-1', code: 'H-1' });
  assert.match(deleteSql, /ba\.date_to IS NULL/);
});
