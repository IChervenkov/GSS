const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createBikeAppService,
} = require('../../../../src/modules/api/bike-app/application/services/bike-app.service');

test('bike app camp list preserves per-user access flags', async () => {
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {
        listCampsAndPermissions: async () => ({
          camps: [
            {
              id: 'camp-1',
              name: 'Camp One',
              createdAt: '2026-05-13',
              canAccess: false,
            },
          ],
          total: 1,
        }),
      },
      bicycles: {},
    },
  });

  const result = await service.listCamps({
    actorUserId: 'user-1',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.camps, [
    {
      id: 'camp-1',
      name: 'Camp One',
      createdAt: '2026-05-13',
      canAccess: false,
    },
  ]);
});

test('bike app legacy rent requests infer camp context and emit the shared bicycle realtime update', async () => {
  const emitted = [];
  let rentPayload = null;
  const campId = '11111111-1111-4111-8111-111111111111';
  const identifier = '22222222-2222-4222-8222-222222222222';
  const soldierId = '33333333-3333-4333-8333-333333333333';
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {},
      bicycles: {
        userHasPermission: async () => true,
        findBicycleByNfcCode: async () => ({
          id: identifier,
          campId,
          name: 'Bike 1',
          nfcCode: 'NFC-BIKE-1',
          status: 'available',
        }),
        findBicycleById: async (payload) => {
          assert.deepEqual(payload, { identifier, campId });
          return {
            id: identifier,
            campId,
            name: 'Bike 1',
            nfcCode: 'NFC-BIKE-1',
            status: 'available',
          };
        },
        findActiveAssignment: async () => null,
        findSoldierById: async () => ({ id: soldierId, name: 'Soldier One' }),
        findHelmetById: async () => null,
        findHelmetByNfcCode: async () => null,
        helmetHasActiveAssignment: async () => false,
        rentBicycle: async (payload) => {
          rentPayload = payload;
          return { id: 'assignment-1', identifier, soldierId, rentedAt: payload.rentedAt };
        },
      },
    },
    eventBus: {
      emitBicycleStatusChanged(value) {
        emitted.push(value);
      },
    },
  });

  const result = await service.legacyRentBicycle({
    actorUserId: '44444444-4444-4444-8444-444444444444',
    nfcData: 'NFC-BIKE-1',
    date: '2026-04-17',
    time: '10:30',
    selectClient: soldierId,
    helmetId: '',
    req: { headers: {}, method: 'POST', originalUrl: '/api/nfcRent' },
  });

  assert.equal(result.status, 200);
  assert.equal(rentPayload.campId, campId);
  assert.equal(rentPayload.identifier, identifier);
  assert.deepEqual(emitted, [identifier]);
});

test('bike app legacy helmet delete accepts the mobile code field and emits the shared delete event', async () => {
  const emitted = [];
  let deletePayload = null;
  const campId = '11111111-1111-4111-8111-111111111111';
  const helmetId = '22222222-2222-4222-8222-222222222222';
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {},
      bicycles: {
        userHasPermission: async () => true,
        findHelmetByNfcCode: async () => null,
        findHelmetById: async ({ helmetId: id }) =>
          id === helmetId ? { id: helmetId, campId, code: 'H-1', nfcCode: 'NFC-H-1' } : null,
        findHelmetByCode: async () => null,
        helmetHasActiveAssignment: async () => false,
        helmetHasAssignmentHistory: async () => false,
        deleteHelmet: async (payload) => {
          deletePayload = payload;
          return { id: payload.helmetId };
        },
      },
    },
    eventBus: {
      emitBicycleDeleted(value) {
        emitted.push(value);
      },
    },
  });

  const result = await service.legacyDeleteHelmet({
    actorUserId: '33333333-3333-4333-8333-333333333333',
    code: helmetId,
    req: { headers: {}, method: 'DELETE', originalUrl: '/api/bicycles/removeHelmet' },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(deletePayload, {
    actorUserId: '33333333-3333-4333-8333-333333333333',
    campId,
    helmetId,
  });
  assert.deepEqual(emitted, [helmetId]);
});

test('bike app returns current user permissions for realtime button state', async () => {
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {},
      bicycles: {
        listUserPermissions: async ({ userId }) => {
          assert.equal(userId, '11111111-1111-4111-8111-111111111111');
          return [{ name: 'Add bike' }, { name: 'Save bike status' }];
        },
      },
    },
  });

  const result = await service.currentPermissions({
    actorUserId: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.permissions, [
    { id: null, name: 'Add bike' },
    { id: null, name: 'Save bike status' },
  ]);
});

test('bike app inventory includes the web overview metric fields', async () => {
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {},
      bicycles: {
        userHasPermission: async () => true,
        findOverviewByCamp: async () => [
          {
            id: 'bike-1',
            name: 'Bike 1',
            nfcCode: 'NFC-1',
            status: 'available',
          },
          {
            id: 'bike-2',
            name: 'Bike 2',
            nfcCode: 'NFC-2',
            status: 'late',
            helmetCode: 'H-2',
          },
          {
            id: 'bike-3',
            name: 'Bike 3',
            nfcCode: 'NFC-3',
            status: 'repair',
          },
        ],
        listHelmetsByCamp: async () => [],
      },
    },
  });

  const result = await service.inventory({
    actorUserId: '11111111-1111-4111-8111-111111111111',
    campId: '22222222-2222-4222-8222-222222222222',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.totalBicycles, 3);
  assert.equal(result.body.helmetPairingCount, 1);
  assert.equal(result.body.needsAttention, 2);
});

test('bike app soldier lookup resolves scanned key NFC to the soldier using that key', async () => {
  const campId = '11111111-1111-4111-8111-111111111111';
  const soldierId = '22222222-2222-4222-8222-222222222222';
  let textSearchCalled = false;
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {},
      bicycles: {
        userHasPermission: async () => true,
        findSoldierByKeyNfcCode: async (payload) => {
          assert.deepEqual(payload, { campId, nfcCode: 'KEY-NFC-1' });
          return {
            id: soldierId,
            name: 'Soldier One',
            country: 'BG',
            mealCard: 'MC-1',
          };
        },
        listSoldiers: async () => {
          textSearchCalled = true;
          return [];
        },
        listActiveAssignmentCountsBySoldierIds: async (payload) => {
          assert.deepEqual(payload, { campId, soldierIds: [soldierId] });
          return new Map([[soldierId, 1]]);
        },
      },
    },
    eventBus: {},
  });

  const result = await service.listSoldiers({
    actorUserId: '33333333-3333-4333-8333-333333333333',
    campId,
    search: 'KEY-NFC-1',
  });

  assert.equal(result.status, 200);
  assert.equal(textSearchCalled, false);
  assert.deepEqual(result.body.soldiers, [
    {
      id: soldierId,
      name: 'Soldier One',
      country: 'BG',
      mealCard: 'MC-1',
      activeAssignmentCount: 1,
    },
  ]);
});

test('bike app soldier list is available with Bicycles section permission', async () => {
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {},
      bicycles: {
        listUserPermissions: async () => [{ name: 'Bicycles' }],
        findSoldierByKeyNfcCode: async () => null,
        listSoldiers: async () => [
          { id: 'soldier-1', name: 'Soldier One', country: 'BG', mealCard: 'MC-1' },
        ],
      },
    },
    eventBus: {},
  });

  const result = await service.listSoldiers({
    actorUserId: '33333333-3333-4333-8333-333333333333',
    campId: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.soldiers, [
    {
      id: 'soldier-1',
      name: 'Soldier One',
      country: 'BG',
      mealCard: 'MC-1',
      activeAssignmentCount: 0,
    },
  ]);
});

test('bike app soldier list rejects users without Bicycles or Full permission', async () => {
  const service = createBikeAppService({
    env: {},
    repositories: {
      main: {},
      bicycles: {
        listUserPermissions: async () => [{ name: 'Add bike' }],
        findSoldierByKeyNfcCode: async () => null,
        listSoldiers: async () => {
          throw new Error('should not list soldiers without section access');
        },
      },
    },
    eventBus: {},
  });

  await assert.rejects(
    () =>
      service.listSoldiers({
        actorUserId: '33333333-3333-4333-8333-333333333333',
        campId: '11111111-1111-4111-8111-111111111111',
      }),
    /You don't have permission to use the bicycle mobile app/,
  );
});
