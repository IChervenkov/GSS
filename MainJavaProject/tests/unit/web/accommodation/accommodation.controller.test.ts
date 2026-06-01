const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAccommodationController,
} = require('../../../../src/modules/web/accommodation/presentation/accommodation.controller');

test('accommodation controller forwards move key chains to the use case', async () => {
  let payload = null;
  const controller = createAccommodationController({
    useCases: {
      moveSoldier: async (input) => {
        payload = input;
        return { status: 200, body: { ok: true } };
      },
    },
  });

  const result = await controller.moveSoldier({
    session: {
      userId: 'user-1',
      campId: 'camp-1',
    },
    body: {
      soldierId: 'soldier-1',
      keyIds: ['key-2', 'key-3', 'key-4'],
    },
  });

  assert.deepEqual(payload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    keyId: undefined,
    keyIds: ['key-2', 'key-3', 'key-4'],
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
});

test('accommodation controller parses table state query JSON before loading data', async () => {
  let payload = null;
  const controller = createAccommodationController({
    useCases: {
      getAccommodationOverview: async (input) => {
        payload = input;
        return { overview: {}, buildings: [] };
      },
    },
  });

  const state = { building: { page: 2, sortColumn: 'name', sortDirection: 'asc' } };
  const result = await controller.accommodationData({
    session: { campId: 'camp-1' },
    query: { state: JSON.stringify(state) },
  });

  assert.deepEqual(payload, {
    campId: 'camp-1',
    tableState: state,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { overview: {}, buildings: [] });
});
