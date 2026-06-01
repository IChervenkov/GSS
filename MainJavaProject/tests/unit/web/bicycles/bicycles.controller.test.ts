const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createBicyclesController,
} = require('../../../../src/modules/web/bicycles/presentation/bicycles.controller');

test('bicycles controller parses overview table state query JSON before loading data', async () => {
  let payload = null;
  const controller = createBicyclesController({
    useCases: {
      getBicyclesOverview: async (input) => {
        payload = input;
        return { status: 200, body: { rows: [] } };
      },
    },
  });

  const state = { bicycle: { page: 2, sortColumn: 'name', sortDirection: 'asc' } };
  const result = await controller.bicyclesData({
    session: { camp: 'camp-1' },
    query: { state: JSON.stringify(state) },
  });

  assert.deepEqual(payload, {
    campId: 'camp-1',
    tableState: state,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { rows: [] });
});

test('bicycles controller parses report table state query JSON before loading report', async () => {
  let payload = null;
  const controller = createBicyclesController({
    useCases: {
      getBicycleRentalReport: async (input) => {
        payload = input;
        return { status: 200, body: { rows: [] } };
      },
    },
  });

  const state = { history: { page: 3, filters: { status: 'late' } } };
  const result = await controller.bicycleRentalReport({
    session: { camp: 'camp-1' },
    query: {
      fromDate: '2026-04-01',
      toDate: '2026-04-23',
      state: JSON.stringify(state),
    },
  });

  assert.deepEqual(payload, {
    campId: 'camp-1',
    fromDate: '2026-04-01',
    toDate: '2026-04-23',
    tableState: state,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { rows: [] });
});
