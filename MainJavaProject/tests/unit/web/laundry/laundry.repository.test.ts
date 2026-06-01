const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('setBagStatus does not insert a duplicate drop-off report when one is still open', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('UPDATE app.laundry_bags')) {
                return {
                  rows: [
                    {
                      id: 'bag-1',
                      code: 'BAG-1',
                      rfid_code: 'RFID-1',
                      type: 'Mesh',
                      status: 'drop_off',
                      laundry_count: 0,
                      max_count_laundry: 1,
                      soldier_id: 'soldier-1',
                      camp_id: 'camp-1',
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

  await repository.setBagStatus({
    actorUserId: null,
    campId: 'camp-1',
    bagId: 'bag-1',
    status: 'drop_off',
  });

  const insertQuery = queries.find((query) =>
    query.sql.includes('INSERT INTO app.laundry_reports'),
  );
  assert.ok(insertQuery);
  assert.match(insertQuery.sql, /date_ready_to_pick_up IS NULL/);
  assert.match(insertQuery.sql, /WHERE NOT EXISTS/);
  assert.deepEqual(insertQuery.params, ['bag-1', 'soldier-1']);
});

test('setBagStatus writes report dates only for laundry flow statuses', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('UPDATE app.laundry_bags')) {
                return {
                  rows: [
                    {
                      id: 'bag-1',
                      code: 'BAG-1',
                      rfid_code: 'RFID-1',
                      type: 'Mesh',
                      status: 'laundry_facility',
                      laundry_count: 0,
                      max_count_laundry: 1,
                      soldier_id: 'soldier-1',
                      camp_id: 'camp-1',
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

  await repository.setBagStatus({
    actorUserId: null,
    campId: 'camp-1',
    bagId: 'bag-1',
    status: 'laundry_facility',
  });

  assert.ok(queries.some((query) => query.sql.includes('INSERT INTO app.laundry_reports')));
  assert.equal(
    queries.some((query) => query.sql.includes('SET date_ready_to_pick_up')),
    false,
  );
});

test('setBagStatus closes the latest open laundry report when moving to ready', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('UPDATE app.laundry_bags')) {
                return {
                  rows: [
                    {
                      id: 'bag-1',
                      code: 'BAG-1',
                      rfid_code: 'RFID-1',
                      type: 'Mesh',
                      status: 'ready_to_pick_up',
                      laundry_count: 0,
                      max_count_laundry: 1,
                      soldier_id: 'soldier-1',
                      camp_id: 'camp-1',
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

  await repository.setBagStatus({
    actorUserId: null,
    campId: 'camp-1',
    bagId: 'bag-1',
    status: 'ready_to_pick_up',
  });

  const readyQuery = queries.find((query) => query.sql.includes('SET date_ready_to_pick_up'));
  assert.ok(readyQuery);
  assert.match(readyQuery.sql, /date_ready_to_pick_up IS NULL/);
  assert.deepEqual(readyQuery.params, ['bag-1']);
});

test('recordLinenExchange inserts one report with matching drop-off and ready dates', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('FROM app.laundry_bags lb')) {
                return {
                  rows: [
                    {
                      id: 'bag-1',
                      code: 'BAG-1',
                      rfid_code: 'RFID-1',
                      type: 'Mesh',
                      status: 'pick_up',
                      laundry_count: 0,
                      max_count_laundry: 1,
                      soldier_id: 'soldier-1',
                      camp_id: 'camp-1',
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

  await repository.recordLinenExchange({
    actorUserId: null,
    campId: 'camp-1',
    bagId: 'bag-1',
  });

  const insertQuery = queries.find((query) =>
    query.sql.includes('INSERT INTO app.laundry_reports'),
  );
  assert.ok(insertQuery);
  assert.match(insertQuery.sql, /date_drop_off, date_ready_to_pick_up/);
  assert.match(insertQuery.sql, /SELECT \$1, exchange_date, exchange_date, \$2/);
  assert.deepEqual(insertQuery.params, ['bag-1', 'soldier-1']);
});

test('listAvailableBags only returns unassigned bags in stored Available status', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return { rows: [] };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called');
        },
      },
    },
  );

  await repository.listAvailableBags({ campId: 'camp-1', search: '', limit: 20 });

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /REGEXP_REPLACE\(TRIM\(lb\.status\)/);
  assert.match(queries[0].sql, /END = 'pick_up'/);
  assert.match(queries[0].sql, /lb\.soldier_id IS NULL/);
  assert.match(queries[0].sql, /s_by_bag\.id IS NULL/);
});

test('listLaundryReport filters report rows by camp and drop-off interval', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return {
                rows: [
                  {
                    id: 'report-1',
                    bag_id: 'bag-1',
                    bag_code: 'BAG-1',
                    soldier_country: 'USA',
                    date_drop_off: new Date('2026-04-17T09:00:00.000Z'),
                    date_ready_to_pick_up: new Date('2026-04-17T09:00:00.000Z'),
                    report_date: '2026-04-17',
                    is_linen_exchange: true,
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

  const from = new Date('2026-04-17T00:00:00.000Z');
  const to = new Date('2026-04-18T00:00:00.000Z');
  const result = await repository.listLaundryReport({ campId: 'camp-1', from, to });

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /FROM app\.laundry_reports lr/);
  assert.match(queries[0].sql, /JOIN app\.laundry_bags lb/);
  assert.match(queries[0].sql, /lb\.camp_id = \$1/);
  assert.match(queries[0].sql, /lr\.date_drop_off >= \$2/);
  assert.match(queries[0].sql, /lr\.date_drop_off < \$3/);
  assert.deepEqual(queries[0].params, ['camp-1', from, to]);
  assert.equal(result[0].isLinenExchange, true);
  assert.equal(result[0].bagCode, 'BAG-1');
});

test('listBagsByCamp does not derive overdue state for active bags', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return {
                rows: [
                  {
                    id: 'bag-1',
                    code: 'BAG-1',
                    rfid_code: 'RFID-1',
                    type: 'Mesh',
                    status: 'ready_to_pick_up',
                    laundry_count: 1,
                    max_count_laundry: 3,
                    soldier_id: 'soldier-1',
                    soldier_name: 'Assigned Soldier',
                    camp_id: 'camp-1',
                    has_laundry_report_history: true,
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

  const result = await repository.listBagsByCamp({ campId: 'camp-1' });

  assert.equal(queries.length, 1);
  assert.doesNotMatch(queries[0].sql, /INTERVAL '7 days'/);
  assert.doesNotMatch(queries[0].sql, /active_laundry_cycle/);
  assert.doesNotMatch(queries[0].sql, /is_overdue/);
  assert.doesNotMatch(queries[0].sql, /overdue_since/);
  assert.deepEqual(queries[0].params, ['camp-1']);
  assert.equal(result[0].status, 'ready_to_pick_up');
  assert.equal(result[0].isOverdue, false);
  assert.equal(result[0].overdueSince, null);
});

test('setBagStatus compares expected status using canonical status labels', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('UPDATE app.laundry_bags')) {
                return {
                  rows: [
                    {
                      id: 'bag-1',
                      code: 'BAG-1',
                      rfid_code: 'RFID-1',
                      type: 'Mesh',
                      status: 'laundry_facility',
                      laundry_count: 0,
                      max_count_laundry: 1,
                      soldier_id: 'soldier-1',
                      camp_id: 'camp-1',
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

  await repository.setBagStatus({
    actorUserId: null,
    campId: 'camp-1',
    bagId: 'bag-1',
    status: 'laundry_facility',
    expectedStatus: 'drop_off',
  });

  const updateQuery = queries.find((query) => query.sql.includes('UPDATE app.laundry_bags'));
  assert.ok(updateQuery);
  assert.match(updateQuery.sql, /REGEXP_REPLACE\(TRIM\(status\)/);
  assert.match(updateQuery.sql, /= \$4/);
  assert.deepEqual(updateQuery.params, ['bag-1', 'camp-1', 'laundry_facility', 'drop_off']);
});

test('deleteBag allows report history but keeps active references from being deleted', async () => {
  const queries = [];
  const repository = requireFresh(
    'src/modules/web/laundry/infrastructure/repositories/laundry.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('SELECT id, code')) {
                return { rows: [{ id: 'bag-1', code: 'BAG-1' }] };
              }
              if (sql.includes('DELETE FROM app.laundry_bags')) {
                return { rows: [{ id: 'bag-1' }] };
              }
              return { rows: [] };
            },
          }),
      },
    },
  );

  const result = await repository.deleteBag({
    actorUserId: null,
    campId: 'camp-1',
    bagId: 'bag-1',
  });

  assert.deepEqual(result, { id: 'bag-1', code: 'BAG-1' });
  const deleteQuery = queries.find((query) => query.sql.includes('DELETE FROM app.laundry_bags'));
  assert.ok(deleteQuery);
  assert.match(deleteQuery.sql, /REGEXP_REPLACE\(TRIM\(lb\.status\)/);
  assert.match(deleteQuery.sql, /END = 'pick_up'/);
  assert.doesNotMatch(deleteQuery.sql, /FROM app\.laundry_reports/);
  assert.match(deleteQuery.sql, /NOT EXISTS \(\s+SELECT 1\s+FROM app\.additional_items/);
  assert.match(deleteQuery.sql, /NOT EXISTS \(\s+SELECT 1\s+FROM app\.soldiers/);
});
