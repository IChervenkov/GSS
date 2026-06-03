// @ts-nocheck
const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const {
  createAccommodationService,
} = require('../../../../src/modules/web/accommodation/application/services/accommodation.service');

test('accommodation service summarizes buildings, rooms, keys, and building type', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        buildings: [{ id: 'building-1', name: 'Alpha', type: 'Barracks' }],
        rooms: [
          { id: 'room-1', name: 'Alpha / 101', buildingId: 'building-1', buildingName: 'Alpha' },
        ],
        keys: [
          {
            id: 'key-1',
            name: 'Alpha / 101 / 1',
            nfcCode: 'NFC-KEY-1',
            roomId: 'room-1',
            roomName: 'Alpha / 101',
            buildingId: 'building-1',
            buildingName: 'Alpha',
            soldierId: null,
            soldierName: null,
          },
          {
            id: 'key-2',
            name: 'Alpha / 101 / 2',
            nfcCode: 'NFC-KEY-2',
            roomId: 'room-1',
            roomName: 'Alpha / 101',
            buildingId: 'building-1',
            buildingName: 'Alpha',
            soldierId: 'soldier-1',
            soldierName: 'Soldier One',
          },
        ],
        movementReport: [
          {
            id: 'move-1',
            eventType: 'check-in',
            happenedAt: '2026-04-20T08:00:00.000Z',
            soldierId: 'soldier-1',
            soldierName: 'Soldier One',
            soldierMealCard: 'MC-1',
            laundryBagCode: 'BAG-1',
            previousKeyName: '',
            newKeyName: 'Alpha / 101 / 2',
          },
          {
            id: 'move-2',
            eventType: 'move',
            happenedAt: '2026-04-21T08:00:00.000Z',
            soldierId: 'soldier-1',
            soldierName: 'Soldier One',
            soldierMealCard: 'MC-1',
            laundryBagCode: 'BAG-1',
            previousKeyName: 'Alpha / 101 / 1',
            newKeyName: 'Alpha / 101 / 2',
          },
        ],
        additionalItemReport: [
          {
            id: 'item-1',
            soldierId: 'soldier-1',
            soldierName: 'Soldier One',
            description: 'Towel',
            quantity: '2',
            laundryBagCode: 'BAG-1',
            createdAt: '2026-04-20T09:00:00.000Z',
          },
        ],
      }),
      findUpcomingActionsByCamp: async () => [],
    },
  });

  const result = await service.getAccommodationOverview({ campId: 'camp-1' });

  assert.equal(result.overview.totalBuildings, 1);
  assert.equal(result.overview.totalRooms, 1);
  assert.equal(result.overview.totalKeys, 2);
  assert.equal(result.overview.freeKeys, 1);
  assert.equal(result.overview.occupiedKeys, 1);
  assert.equal(result.keys[0].nfcCode, 'NFC-KEY-1');
  assert.equal(result.report.totals.checkEvents, 1);
  assert.equal(result.report.totals.moveEvents, 1);
  assert.equal(result.report.totals.additionalItems, 1);
  assert.equal(result.report.checkEvents[0].eventType, 'check-in');
  assert.equal(result.report.checkEvents[0].soldierMealCard, 'MC-1');
  assert.equal(result.report.checkEvents[0].laundryBagCode, 'BAG-1');
  assert.equal(result.report.moveEvents[0].previousKeyName, 'Alpha / 101 / 1');
  assert.equal(result.report.additionalItems[0].description, 'Towel');
  assert.deepEqual(result.buildings[0], {
    id: 'building-1',
    name: 'Alpha',
    type: 'Barracks',
    roomCount: 1,
    totalKeys: 2,
    occupiedKeys: 1,
    freeKeys: 1,
    status: 'Free',
  });
  assert.equal(result.rooms[0].status, 'Free');
});

test('accommodation service downloads filtered report workbook with check-in details', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        movementReport: [
          {
            id: 'move-1',
            eventType: 'check-in',
            happenedAt: '2026-04-20T08:00:00.000Z',
            soldierName: 'Soldier One',
            soldierMealCard: 'MC-1',
            laundryBagCode: 'BAG-1',
            previousKeyName: '',
            newKeyName: 'Alpha / 101 / 2',
          },
          {
            id: 'move-2',
            eventType: 'check-out',
            happenedAt: '2026-04-21T08:00:00.000Z',
            soldierName: 'Soldier Two',
            soldierMealCard: 'MC-2',
            laundryBagCode: 'BAG-2',
            previousKeyName: 'Alpha / 101 / 3',
            newKeyName: '',
          },
        ],
        additionalItemReport: [],
      }),
    },
  });

  const result = await service.downloadAccommodationReport({
    campId: 'camp-1',
    section: 'check',
    fromDate: '2026-04-20',
    toDate: '2026-04-20',
  });

  assert.equal(result.status, 200);
  assert.equal(result.fileName, 'accommodation-report-check-2026-04-20-to-2026-04-20.xlsx');
  assert.ok(result.buffer.byteLength > 0);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const sheet = workbook.getWorksheet('Check-ins check-outs');

  assert.ok(sheet);
  assert.equal(workbook.worksheets.length, 1);
  assert.deepEqual(sheet.getRow(1).values.slice(1), [
    'Time',
    'Action',
    'Soldier',
    'Meal Card',
    'Bag',
    'Key',
  ]);
  assert.deepEqual(sheet.getRow(2).values.slice(1), [
    '2026-04-20 08:00 AM',
    'Check-in',
    'Soldier One',
    'MC-1',
    'BAG-1',
    'Alpha / 101 / 2',
  ]);
  assert.equal(sheet.getRow(3).actualCellCount, 0);
});

test('accommodation overview filters report time columns and sorts item quantities', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        movementReport: [
          {
            id: 'check-1',
            eventType: 'check-in',
            happenedAt: '2026-04-20T08:00:00.000Z',
            soldierName: 'Soldier One',
            soldierMealCard: 'MC-1',
            laundryBagCode: 'BAG-1',
            previousKeyName: '',
            newKeyName: 'Alpha / 101 / 1',
          },
          {
            id: 'check-2',
            eventType: 'check-out',
            happenedAt: '2026-04-20T09:00:00.000Z',
            soldierName: 'Soldier Two',
            soldierMealCard: 'MC-2',
            laundryBagCode: 'BAG-2',
            previousKeyName: 'Alpha / 101 / 2',
            newKeyName: '',
          },
          {
            id: 'move-1',
            eventType: 'move',
            happenedAt: '2026-04-20T10:30:00.000Z',
            soldierName: 'Soldier Three',
            previousKeyName: 'Alpha / 101 / 3',
            newKeyName: 'Alpha / 101 / 4',
          },
          {
            id: 'move-2',
            eventType: 'move',
            happenedAt: '2026-04-20T11:30:00.000Z',
            soldierName: 'Soldier Four',
            previousKeyName: 'Alpha / 101 / 5',
            newKeyName: 'Alpha / 101 / 6',
          },
        ],
        additionalItemReport: [
          {
            id: 'item-1',
            soldierName: 'Soldier One',
            description: 'Towel',
            quantity: '10',
            laundryBagCode: 'BAG-1',
            createdAt: '2026-04-20T07:00:00.000Z',
          },
          {
            id: 'item-2',
            soldierName: 'Soldier Two',
            description: 'Blanket',
            quantity: '2',
            laundryBagCode: 'BAG-2',
            createdAt: '2026-04-20T07:30:00.000Z',
          },
          {
            id: 'item-3',
            soldierName: 'Soldier Three',
            description: 'Socks',
            quantity: '1',
            laundryBagCode: 'BAG-3',
            createdAt: '2026-04-21T08:45:00.000Z',
          },
        ],
      }),
      findUpcomingActionsByCamp: async () => [],
    },
  });

  const result = await service.getAccommodationOverview({
    campId: 'camp-1',
    tableState: {
      report: {
        check: { filters: { happenedAt: '08:00 AM' } },
        move: { filters: { happenedAt: '11:30 AM' } },
        item: {
          filters: { createdAt: '2026-04-20' },
          sortColumn: 'quantity',
          sortDirection: 'desc',
        },
      },
    },
  });

  assert.deepEqual(
    result.report.checkEvents.map((row) => row.soldierName),
    ['Soldier One'],
  );
  assert.deepEqual(
    result.report.moveEvents.map((row) => row.soldierName),
    ['Soldier Four'],
  );
  assert.deepEqual(
    result.report.additionalItems.map((row) => row.quantity),
    ['10', '2'],
  );
  assert.equal(result.report.tables.item.sortColumn, 'quantity');
});

test('accommodation overview applies table search sort and pagination on the server result', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        buildings: [
          { id: 'building-1', name: 'Alpha', type: 'Barracks' },
          { id: 'building-2', name: 'Bravo', type: 'HQ' },
          { id: 'building-3', name: 'Charlie', type: 'Barracks' },
        ],
        rooms: [],
        keys: [],
        soldiers: [],
      }),
      findUpcomingActionsByCamp: async () => [],
    },
  });

  const result = await service.getAccommodationOverview({
    campId: 'camp-1',
    tableState: {
      building: {
        page: 1,
        limit: 1,
        filters: { type: 'barracks' },
        sortColumn: 'name',
        sortDirection: 'desc',
      },
    },
  });

  assert.deepEqual(
    result.buildings.map((building) => building.name),
    ['Charlie'],
  );
  assert.equal(result.tables.buildings.total, 2);
  assert.equal(result.tables.buildings.sourceTotal, 3);
  assert.equal(result.tables.buildings.totalPages, 2);
  assert.equal(result.lookups.buildings.length, 3);
});

test('accommodation service searches lookup options on the server result', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        keys: [
          {
            id: 'key-1',
            name: 'Alpha 101',
            nfcCode: 'NFC-1',
            buildingType: 'Accommodation',
            hasBedAsset: true,
            soldierId: null,
          },
          {
            id: 'key-2',
            name: 'Bravo 102',
            nfcCode: 'NFC-2',
            buildingType: 'Accommodation',
            hasBedAsset: true,
            soldierId: 'soldier-1',
          },
          {
            id: 'key-3',
            name: 'Bravo 103',
            nfcCode: 'NFC-3',
            buildingType: 'Accommodation',
            hasBedAsset: true,
            soldierId: null,
          },
        ],
      }),
    },
  });

  const result = await service.listAccommodationLookupOptions({
    campId: 'camp-1',
    type: 'key',
    search: 'bravo',
    onlyFree: true,
    limit: 1,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.rows.map((row) => row.id),
    ['key-3'],
  );
});

test('accommodation service only returns free Available laundry bags for soldier lookup', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        laundryBags: [
          { id: 'bag-free', code: 'BAG-FREE', status: 'pick_up', soldierId: null },
          { id: 'bag-busy-status', code: 'BAG-DROP', status: 'drop_off', soldierId: null },
          {
            id: 'bag-assigned',
            code: 'BAG-ASSIGNED',
            status: 'pick_up',
            soldierId: 'soldier-2',
            soldierName: 'Soldier Two',
          },
        ],
      }),
    },
  });

  const result = await service.listAccommodationLookupOptions({
    campId: 'camp-1',
    type: 'laundryBag',
    onlyFree: true,
    limit: 10,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.rows.map((row) => row.id),
    ['bag-free'],
  );
});

test('accommodation overview hides completed upcoming actions without clearing schedule data', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        buildings: [],
        rooms: [],
        keys: [],
        soldiers: [
          {
            id: 'soldier-completed',
            name: 'Completed Soldier',
            upcomingAccommodation: '2030-06-10',
            upcomingRelease: '2030-06-10',
            dateAccommodation: '2030-06-10T08:00:00.000Z',
            dateFree: '2030-06-10T10:00:00.000Z',
            activeBikeRentalCount: 1,
          },
        ],
      }),
      findUpcomingActionsByCamp: async () => [
        {
          soldierName: 'Pending Arrival',
          upcomingAccommodation: '2030-06-10',
          upcomingAccommodationKeyName: 'A-101-1',
        },
        {
          soldierName: 'Pending Release',
          upcomingRelease: '2030-06-10',
          keyId: 'key-release',
          keyName: 'R-202-1',
        },
        {
          soldierName: 'Already Accommodated',
          upcomingAccommodation: '2030-06-10',
          keyId: 'key-active',
          keyName: 'B-303-1',
        },
        {
          soldierName: 'Already Released',
          upcomingRelease: '2030-06-10',
          dateFree: '2030-06-10T10:00:00.000Z',
        },
        {
          soldierName: 'Completed Soldier',
          upcomingAccommodation: '2030-06-10',
          upcomingRelease: '2030-06-10',
          dateAccommodation: '2030-06-10T08:00:00.000Z',
          dateFree: '2030-06-10T10:00:00.000Z',
        },
      ],
    },
    now: () => new Date('2030-06-10T12:00:00.000Z'),
  });

  const result = await service.getAccommodationOverview({ campId: 'camp-1' });

  assert.equal(result.overview.upcomingAccommodationCount, 1);
  assert.equal(result.overview.upcomingReleaseCount, 1);
  assert.deepEqual(result.upcoming.accommodationList, [
    'Pending Arrival - Upcoming key: A-101-1',
  ]);
  assert.deepEqual(result.upcoming.releaseList, ['Pending Release - Key: R-202-1']);
  assert.equal(result.soldiers[0].upcomingAccommodation, '2030-06-10');
  assert.equal(result.soldiers[0].upcomingRelease, '2030-06-10');
  assert.equal(result.soldiers[0].activeBikeRentalCount, 1);
});

test('accommodation service labels fully free and occupied room/building statuses', async () => {
  const service = createAccommodationService({
    repository: {
      getAccommodationOverviewData: async () => ({
        buildings: [
          { id: 'building-free', name: 'Free Building', type: 'Barracks' },
          { id: 'building-occupied', name: 'Occupied Building', type: 'Barracks' },
        ],
        rooms: [
          {
            id: 'room-free',
            name: 'Free Building / 101',
            buildingId: 'building-free',
            buildingName: 'Free Building',
          },
          {
            id: 'room-occupied',
            name: 'Occupied Building / 101',
            buildingId: 'building-occupied',
            buildingName: 'Occupied Building',
          },
        ],
        keys: [
          {
            id: 'key-free',
            name: 'Free Building / 101 / 1',
            roomId: 'room-free',
            roomName: 'Free Building / 101',
            buildingId: 'building-free',
            buildingName: 'Free Building',
            soldierId: null,
            soldierName: null,
          },
          {
            id: 'key-occupied',
            name: 'Occupied Building / 101 / 1',
            roomId: 'room-occupied',
            roomName: 'Occupied Building / 101',
            buildingId: 'building-occupied',
            buildingName: 'Occupied Building',
            soldierId: 'soldier-1',
            soldierName: 'Soldier One',
          },
        ],
      }),
      findUpcomingActionsByCamp: async () => [],
    },
  });

  const result = await service.getAccommodationOverview({ campId: 'camp-1' });
  const buildingsById = new Map(result.buildings.map((building) => [building.id, building]));
  const roomsById = new Map(result.rooms.map((room) => [room.id, room]));

  assert.equal(buildingsById.get('building-free').status, 'Fully free');
  assert.equal(roomsById.get('room-free').status, 'Fully free');
  assert.equal(buildingsById.get('building-occupied').status, 'Occupied');
  assert.equal(roomsById.get('room-occupied').status, 'Occupied');
});

test('accommodation service adds a building with add destination permission', async () => {
  let addPayload = null;
  const emittedCampIds = [];
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Add destination',
      findBuildingByName: async () => null,
      addBuilding: async (payload) => {
        addPayload = payload;
        return { id: 'building-1', name: payload.name, type: payload.type };
      },
    },
    realtime: {
      emitAccommodationChanged: (campId) => emittedCampIds.push(campId),
    },
  });

  const result = await service.addBuilding({
    actorUserId: 'user-1',
    campId: 'camp-1',
    name: ' Alpha   Hall ',
    type: ' Barracks ',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.building.name, 'Alpha Hall');
  assert.deepEqual(addPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    name: 'Alpha Hall',
    type: 'Barracks',
  });
  assert.deepEqual(emittedCampIds, ['camp-1']);
});

test('accommodation service blocks deleting rooms that still have keys', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findRoomById: async () => ({
        id: 'room-1',
        name: 'Alpha / 101',
        keyCount: 1,
      }),
      deleteRoom: async () => {
        throw new Error('delete should be blocked before repository delete');
      },
    },
  });

  await assert.rejects(
    () =>
      service.deleteRoom({
        actorUserId: 'user-1',
        campId: 'camp-1',
        roomId: 'room-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_ROOM_HAS_KEYS');
      return true;
    },
  );
});

test('accommodation service blocks deleting occupied keys', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findKeyById: async () => ({
        id: 'key-1',
        name: 'Alpha / 101 / 1',
        soldierId: 'soldier-1',
      }),
      deleteKey: async () => {
        throw new Error('delete should be blocked before repository delete');
      },
    },
  });

  await assert.rejects(
    () =>
      service.deleteKey({
        actorUserId: 'user-1',
        campId: 'camp-1',
        keyId: 'key-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_KEY_OCCUPIED');
      return true;
    },
  );
});

test('accommodation service adds a key with a unique NFC code', async () => {
  let addPayload = null;
  const emittedCampIds = [];
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Add key',
      findRoomById: async () => ({
        id: 'room-1',
        name: 'Alpha / 101',
      }),
      findKeyByName: async () => null,
      findKeyByNfcCode: async () => null,
      addKey: async (payload) => {
        addPayload = payload;
        return {
          id: 'key-1',
          name: payload.name,
          nfcCode: payload.nfcCode,
          roomId: payload.roomId,
        };
      },
    },
    realtime: {
      emitAccommodationChanged: (campId) => emittedCampIds.push(campId),
    },
  });

  const result = await service.addKey({
    actorUserId: 'user-1',
    campId: 'camp-1',
    name: ' Alpha / 101 / 1 ',
    nfcCode: ' NFC-KEY-1 ',
    roomId: 'room-1',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.key.nfcCode, 'NFC-KEY-1');
  assert.deepEqual(addPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    name: 'Alpha / 101 / 1',
    nfcCode: 'NFC-KEY-1',
    roomId: 'room-1',
  });
  assert.deepEqual(emittedCampIds, ['camp-1']);
});

test('accommodation service blocks adding a soldier when upcoming release is before upcoming accommodation', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Add soldier',
      findSoldierByName: async () => null,
      addSoldier: async () => {
        throw new Error('add should be blocked before repository insert');
      },
    },
  });

  await assert.rejects(
    () =>
      service.addSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        name: 'Soldier One',
        upcomingAccommodation: '2026-04-20',
        upcomingRelease: '2026-04-19',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'ACCOMMODATION_INVALID_UPCOMING_SCHEDULE');
      return true;
    },
  );
});

test('accommodation service blocks editing a soldier when upcoming release is before upcoming accommodation', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit soldier',
      findSoldierById: async () => ({ id: 'soldier-1', name: 'Soldier One' }),
      findSoldierByName: async () => null,
      editSoldier: async () => {
        throw new Error('edit should be blocked before repository update');
      },
    },
  });

  await assert.rejects(
    () =>
      service.editSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        name: 'Soldier One',
        upcomingAccommodation: '2026-04-20',
        upcomingRelease: '2026-04-19',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'ACCOMMODATION_INVALID_UPCOMING_SCHEDULE');
      return true;
    },
  );
});

test('accommodation service preserves local calendar dates from date objects', async () => {
  let addPayload = null;
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Add soldier',
      findSoldierByName: async () => null,
      addSoldier: async (payload) => {
        addPayload = payload;
        return { id: 'soldier-1', name: payload.name };
      },
    },
  });

  const result = await service.addSoldier({
    actorUserId: 'user-1',
    campId: 'camp-1',
    name: 'Soldier One',
    upcomingAccommodation: new Date(2026, 3, 21),
    upcomingRelease: new Date(2026, 3, 21),
  });

  assert.equal(result.status, 200);
  assert.equal(addPayload.upcomingAccommodation, '2026-04-21');
  assert.equal(addPayload.upcomingRelease, '2026-04-21');
});

test('accommodation service blocks assigning busy laundry bags to soldiers', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Add soldier',
      findSoldierByName: async () => null,
      findLaundryBagById: async ({ laundryBagId }) => ({
        id: laundryBagId,
        code: 'BAG-1',
        status: 'drop_off',
        soldierId: null,
      }),
      addSoldier: async () => {
        throw new Error('add should be blocked before repository insert');
      },
    },
  });

  await assert.rejects(
    () =>
      service.addSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        name: 'Soldier One',
        laundryBagId: 'bag-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_LAUNDRY_BAG_NOT_AVAILABLE');
      return true;
    },
  );
});

test('accommodation service allows editing a soldier while keeping their current busy bag', async () => {
  let editPayload = null;
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit soldier',
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        laundryBagId: 'bag-1',
      }),
      findSoldierByName: async () => null,
      findLaundryBagById: async ({ laundryBagId }) => ({
        id: laundryBagId,
        code: 'BAG-1',
        status: 'drop_off',
        soldierId: 'soldier-1',
      }),
      editSoldier: async (payload) => {
        editPayload = payload;
        return { id: payload.soldierId, name: payload.name, laundryBagId: payload.laundryBagId };
      },
    },
  });

  const result = await service.editSoldier({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    name: 'Soldier One Updated',
    laundryBagId: 'bag-1',
  });

  assert.equal(result.status, 200);
  assert.equal(editPayload.laundryBagId, 'bag-1');
});

test('accommodation service blocks editing a soldier onto another soldier assigned bag', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit soldier',
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        laundryBagId: null,
      }),
      findSoldierByName: async () => null,
      findLaundryBagById: async ({ laundryBagId }) => ({
        id: laundryBagId,
        code: 'BAG-2',
        status: 'pick_up',
        soldierId: 'soldier-2',
        soldierName: 'Soldier Two',
      }),
      editSoldier: async () => {
        throw new Error('edit should be blocked before repository update');
      },
    },
  });

  await assert.rejects(
    () =>
      service.editSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        name: 'Soldier One',
        laundryBagId: 'bag-2',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_LAUNDRY_BAG_NOT_AVAILABLE');
      return true;
    },
  );
});

test('accommodation service accommodates a soldier to a free key', async () => {
  let accommodationPayload = null;
  const emittedCampIds = [];
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) =>
        permissionName === 'Manage accommodation',
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: null,
        usedKey: null,
      }),
      findKeyById: async () => ({
        id: 'key-1',
        name: 'Alpha / 101 / 1',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: null,
      }),
      accommodateSoldier: async (payload) => {
        accommodationPayload = payload;
        return { soldierId: payload.soldierId, keyId: payload.keyId };
      },
    },
    realtime: {
      emitAccommodationChanged: (campId) => emittedCampIds.push(campId),
    },
  });

  const result = await service.accommodateSoldier({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    keyId: 'key-1',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(accommodationPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    keyId: 'key-1',
  });
  assert.deepEqual(emittedCampIds, ['camp-1']);
});

test('accommodation service rejects stale key selections during accommodation', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) =>
        permissionName === 'Manage accommodation',
      findSoldierById: async () => ({ id: 'soldier-1', name: 'Soldier One', keyId: null }),
      findKeyById: async () => ({
        id: 'key-1',
        name: 'Alpha / 101 / 1',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: null,
      }),
      accommodateSoldier: async () => null,
    },
  });

  await assert.rejects(
    () =>
      service.accommodateSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        keyId: 'key-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_ACCOMMODATION_CONFLICT');
      assert.match(error.message, /no longer available/i);
      return true;
    },
  );
});

test('accommodation service requires a Bed asset for Accommodation building keys', async () => {
  let accommodateCalled = false;
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) =>
        permissionName === 'Manage accommodation',
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: null,
        usedKey: null,
      }),
      findKeyById: async () => ({
        id: 'key-1',
        name: 'Alpha / 101 / 1',
        buildingType: 'Accommodation',
        hasBedAsset: false,
        soldierId: null,
      }),
      accommodateSoldier: async () => {
        accommodateCalled = true;
      },
    },
  });

  await assert.rejects(
    () =>
      service.accommodateSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        keyId: 'key-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_KEY_NOT_ACCOMMODATION_BED');
      return true;
    },
  );
  assert.equal(accommodateCalled, false);
});

test('accommodation service blocks non-accommodation building keys for accommodation', async () => {
  let accommodateCalled = false;
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) =>
        permissionName === 'Manage accommodation',
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: null,
        usedKey: null,
      }),
      findKeyById: async () => ({
        id: 'key-1',
        name: 'Office Key',
        buildingType: 'Office',
        hasBedAsset: false,
        soldierId: null,
      }),
      accommodateSoldier: async () => {
        accommodateCalled = true;
      },
    },
  });

  await assert.rejects(
    () =>
      service.accommodateSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        keyId: 'key-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_KEY_NOT_ACCOMMODATION_BED');
      return true;
    },
  );
  assert.equal(accommodateCalled, false);
});

test('accommodation service blocks move chains into Accommodation keys without Bed assets', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: 'key-current',
      }),
      findKeyById: async () => ({
        id: 'key-target',
        name: 'Target Key',
        buildingType: 'Accommodation',
        hasBedAsset: false,
        soldierId: null,
      }),
      moveSoldier: async () => {
        throw new Error('move should be blocked before repository update');
      },
    },
  });

  await assert.rejects(
    () =>
      service.moveSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        keyId: 'key-target',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_KEY_NOT_ACCOMMODATION_BED');
      return true;
    },
  );
});

test('accommodation service accommodates multiple soldiers to free keys', async () => {
  const accommodated = [];
  const emittedCampIds = [];
  const soldiers = new Map([
    ['soldier-1', { id: 'soldier-1', name: 'Soldier One', keyId: null, usedKey: null }],
    ['soldier-2', { id: 'soldier-2', name: 'Soldier Two', keyId: null, usedKey: null }],
  ]);
  const keys = new Map([
    [
      'key-1',
      {
        id: 'key-1',
        name: 'Alpha / 101 / 1',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: null,
      },
    ],
    [
      'key-2',
      {
        id: 'key-2',
        name: 'Alpha / 101 / 2',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: null,
      },
    ],
  ]);
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) =>
        permissionName === 'Manage accommodation',
      findSoldierById: async ({ soldierId }) => soldiers.get(soldierId) || null,
      findKeyById: async ({ keyId }) => keys.get(keyId) || null,
      accommodateSoldier: async (payload) => {
        accommodated.push(payload);
        return { soldierId: payload.soldierId, keyId: payload.keyId };
      },
    },
    realtime: {
      emitAccommodationChanged: (campId) => emittedCampIds.push(campId),
    },
  });

  const result = await service.accommodateSoldiers({
    actorUserId: 'user-1',
    campId: 'camp-1',
    assignments: [
      { soldierId: 'soldier-1', keyId: 'key-1' },
      { soldierId: 'soldier-2', keyId: 'key-2' },
    ],
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.accommodations.length, 2);
  assert.deepEqual(
    accommodated.map(({ soldierId, keyId }) => ({ soldierId, keyId })),
    [
      { soldierId: 'soldier-1', keyId: 'key-1' },
      { soldierId: 'soldier-2', keyId: 'key-2' },
    ],
  );
  assert.deepEqual(emittedCampIds, ['camp-1']);
});

test('accommodation service blocks duplicate keys in multiple soldier accommodation', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
    },
  });

  await assert.rejects(
    () =>
      service.accommodateSoldiers({
        actorUserId: 'user-1',
        campId: 'camp-1',
        assignments: [
          { soldierId: 'soldier-1', keyId: 'key-1' },
          { soldierId: 'soldier-2', keyId: 'key-1' },
        ],
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'ACCOMMODATION_BULK_DUPLICATE_ASSIGNMENTS');
      return true;
    },
  );
});

test('accommodation service issues non-accommodation keys without accommodating the soldier', async () => {
  let issuedPayload = null;
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) =>
        permissionName === 'Manage accommodation',
      findKeyById: async () => ({
        id: 'key-office',
        name: 'Office Key',
        buildingType: 'Office',
        hasBedAsset: false,
        soldierId: null,
      }),
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: null,
        usedKey: null,
      }),
      issueKeyToSoldier: async (payload) => {
        issuedPayload = payload;
        return { keyId: payload.keyId, soldierId: payload.soldierId };
      },
    },
  });

  const result = await service.issueKeyToSoldier({
    actorUserId: 'user-1',
    campId: 'camp-1',
    keyId: 'key-office',
    soldierId: 'soldier-1',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(
    { keyId: issuedPayload.keyId, soldierId: issuedPayload.soldierId },
    { keyId: 'key-office', soldierId: 'soldier-1' },
  );
});

test('accommodation service refuses general release for an active accommodation key', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async (_userId, permissionName) =>
        permissionName === 'Manage accommodation',
      findKeyById: async () => ({
        id: 'key-bed',
        name: 'Bed Key',
        soldierId: 'soldier-1',
      }),
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: 'key-bed',
        usedKey: 'key-bed',
      }),
      releaseKeyFromSoldier: async () => {
        throw new Error('release should be blocked before repository update');
      },
    },
  });

  await assert.rejects(
    () =>
      service.releaseKeyFromSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        keyId: 'key-bed',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_KEY_IS_ACTIVE_ACCOMMODATION');
      return true;
    },
  );
});

test('accommodation service rejects non-positive additional item quantities', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async () => {
        throw new Error('soldier lookup should not run for invalid quantity');
      },
      addAdditionalItem: async () => {
        throw new Error('item save should not run for invalid quantity');
      },
    },
  });

  await assert.rejects(
    () =>
      service.addAdditionalItem({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        description: 'Towel',
        quantity: '0',
      }),
    /Quantity must be a whole number starting from 1\./,
  );
});

test('accommodation service blocks assigning busy laundry bags to additional items', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async () => ({ id: 'soldier-1', name: 'Soldier One' }),
      findLaundryBagById: async ({ laundryBagId }) => ({
        id: laundryBagId,
        code: 'BAG-1',
        status: 'pick_up',
        soldierId: 'soldier-2',
        soldierName: 'Soldier Two',
      }),
      addAdditionalItem: async () => {
        throw new Error('item save should be blocked before repository insert');
      },
    },
  });

  await assert.rejects(
    () =>
      service.addAdditionalItem({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        description: 'Towel',
        quantity: '1',
        laundryBagId: 'bag-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_LAUNDRY_BAG_NOT_AVAILABLE');
      return true;
    },
  );
});

test('accommodation service allows additional items to keep a bag occupied by the same soldier', async () => {
  let savedPayload = null;
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async ({ soldierId }) => ({ id: soldierId, name: 'Soldier One' }),
      findLaundryBagById: async ({ laundryBagId }) => ({
        id: laundryBagId,
        code: 'BAG-1',
        status: 'drop_off',
        soldierId: 'soldier-1',
      }),
      addAdditionalItem: async (payload) => {
        savedPayload = payload;
        return { id: 'item-1', ...payload };
      },
    },
  });

  const result = await service.addAdditionalItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    description: 'Laundry bag',
    quantity: '3',
    laundryBagId: 'bag-1',
  });

  assert.equal(result.status, 200);
  assert.equal(savedPayload.laundryBagId, 'bag-1');
  assert.equal(savedPayload.quantity, '1');
});

test('accommodation service keeps additional item quantity at one when a laundry bag is assigned', async () => {
  const savedPayloads = [];
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findAdditionalItemById: async () => ({
        id: 'item-1',
        soldierId: 'soldier-1',
        description: 'Laundry bag',
        quantity: '7',
        laundryBagId: null,
      }),
      findSoldierById: async ({ soldierId }) => ({ id: soldierId, name: 'Soldier One' }),
      findLaundryBagById: async ({ laundryBagId }) => ({
        id: laundryBagId,
        code: 'BAG-1',
        status: 'pick_up',
        soldierId: null,
      }),
      addAdditionalItem: async (payload) => {
        savedPayloads.push(payload);
        return { id: 'item-new', ...payload };
      },
      editAdditionalItem: async (payload) => {
        savedPayloads.push(payload);
        return { id: payload.itemId, ...payload };
      },
    },
  });

  await service.addAdditionalItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    description: 'Laundry bag',
    quantity: '7',
    laundryBagId: 'bag-1',
  });
  await service.editAdditionalItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    itemId: 'item-1',
    soldierId: 'soldier-1',
    description: 'Laundry bag',
    quantity: '12',
    laundryBagId: 'bag-1',
  });

  assert.deepEqual(
    savedPayloads.map((payload) => payload.quantity),
    ['1', '1'],
  );
});

test('accommodation service emits soldier realtime updates when additional item bags change', async () => {
  const soldierEvents = [];
  const accommodationEvents = [];
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findAdditionalItemById: async ({ itemId }) => ({
        id: itemId,
        soldierId: 'soldier-1',
        description: 'Laundry bag',
        quantity: '1',
        laundryBagId: 'bag-1',
      }),
      findSoldierById: async ({ soldierId }) => ({ id: soldierId, name: 'Soldier One' }),
      findLaundryBagById: async ({ laundryBagId }) => ({
        id: laundryBagId,
        code: 'BAG-1',
        status: 'pick_up',
        soldierId: null,
      }),
      addAdditionalItem: async (payload) => ({ id: 'item-new', ...payload }),
      editAdditionalItem: async (payload) => ({ id: payload.itemId, ...payload }),
      deleteAdditionalItem: async ({ itemId }) => ({ id: itemId }),
    },
    realtime: {
      emitAccommodationChanged: (campId) => accommodationEvents.push({ campId }),
      emitSoldierChanged: (campId, payload) => soldierEvents.push({ campId, payload }),
    },
  });

  await service.addAdditionalItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    description: 'Laundry bag',
    quantity: '1',
    laundryBagId: 'bag-1',
  });
  await service.editAdditionalItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    itemId: 'item-1',
    soldierId: 'soldier-1',
    description: 'Laundry bag',
    quantity: '1',
    laundryBagId: 'bag-1',
  });
  await service.deleteAdditionalItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    itemId: 'item-1',
  });

  assert.deepEqual(
    soldierEvents.map((event) => [event.campId, event.payload.soldierId]),
    [
      ['camp-1', 'soldier-1'],
      ['camp-1', 'soldier-1'],
      ['camp-1', 'soldier-1'],
    ],
  );
  assert.deepEqual(accommodationEvents, []);
});

test('accommodation service deletes soldiers when only inactive or historical data exists', async () => {
  let deletedPayload = null;
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: null,
        usedKey: null,
        laundryBagId: 'bag-1',
        upcomingAccommodation: '2026-04-25',
        upcomingRelease: '2026-04-30',
        upcomingAccommodationKey: 'key-upcoming',
        dateAccommodation: '2026-04-20T08:00:00.000Z',
        dateFree: '2026-04-21T08:00:00.000Z',
      }),
      findSoldierDeletionBlockers: async () => ({
        keyAssignmentCount: 0,
        additionalItemCount: 0,
        activeBicycleAssignmentCount: 0,
      }),
      deleteSoldier: async (payload) => {
        deletedPayload = payload;
        return { id: payload.soldierId, name: 'Soldier One' };
      },
    },
  });

  const result = await service.deleteSoldier({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Soldier removed successfully.');
  assert.deepEqual(deletedPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
  });
});

test('accommodation service blocks deleting soldiers with additional items or active bike rentals', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async () => ({
        id: 'soldier-1',
        name: 'Soldier One',
        keyId: null,
        usedKey: null,
        laundryBagId: 'bag-1',
        upcomingAccommodation: null,
        upcomingRelease: null,
        upcomingAccommodationKey: null,
        dateAccommodation: null,
        dateFree: null,
      }),
      findSoldierDeletionBlockers: async () => ({
        keyAssignmentCount: 0,
        additionalItemCount: 2,
        activeBicycleAssignmentCount: 1,
      }),
      deleteSoldier: async () => {
        throw new Error('delete should be blocked before repository update');
      },
    },
  });

  await assert.rejects(
    () =>
      service.deleteSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ACCOMMODATION_SOLDIER_DELETE_BLOCKED');
      assert.match(error.message, /additional items/);
      assert.match(error.message, /active bicycle rentals/);
      assert.deepEqual(
        error.details.map((detail) => detail.code),
        ['additional_items', 'active_bicycle_rentals'],
      );
      return true;
    },
  );
});

test('accommodation service releases accommodated soldiers from selected rooms', async () => {
  const discharged = [];
  const releasedKeys = [];
  const emittedCampIds = [];
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      getAccommodationOverviewData: async () => ({
        buildings: [],
        rooms: [{ id: 'room-1', name: 'Alpha / 101' }],
        keys: [
          { id: 'key-1', roomId: 'room-1', soldierId: 'soldier-1' },
          { id: 'key-issued', roomId: 'room-1', soldierId: 'soldier-2' },
          { id: 'key-outside', roomId: 'room-2', soldierId: 'soldier-3' },
        ],
        soldiers: [
          { id: 'soldier-1', name: 'Soldier One', keyId: 'key-1', roomId: 'room-1' },
          { id: 'soldier-2', name: 'Soldier Two', keyId: null, roomId: 'room-1' },
          { id: 'soldier-3', name: 'Soldier Three', keyId: 'key-3', roomId: 'room-2' },
        ],
      }),
      dischargeSoldier: async (payload) => {
        discharged.push(payload);
        return { soldierId: payload.soldierId };
      },
      releaseKeyFromSoldier: async (payload) => {
        releasedKeys.push(payload);
        return { keyId: payload.keyId };
      },
    },
    realtime: {
      emitAccommodationChanged: (campId) => emittedCampIds.push(campId),
    },
  });

  const result = await service.releaseRooms({
    actorUserId: 'user-1',
    campId: 'camp-1',
    roomIds: ['room-1'],
  });

  assert.equal(result.status, 200);
  assert.deepEqual(discharged.map((payload) => payload.soldierId), ['soldier-1']);
  assert.deepEqual(releasedKeys.map((payload) => payload.keyId), ['key-issued']);
  assert.deepEqual(emittedCampIds, ['camp-1']);
});

test('accommodation service releases accommodated soldiers from selected buildings', async () => {
  const discharged = [];
  const releasedKeys = [];
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      getAccommodationOverviewData: async () => ({
        buildings: [{ id: 'building-1', name: 'Alpha' }],
        rooms: [],
        keys: [
          { id: 'key-1', buildingId: 'building-1', soldierId: 'soldier-1' },
          { id: 'key-issued', buildingId: 'building-1', soldierId: 'soldier-4' },
          { id: 'key-outside', buildingId: 'building-2', soldierId: 'soldier-3' },
        ],
        soldiers: [
          {
            id: 'soldier-1',
            name: 'Soldier One',
            keyId: 'key-1',
            buildingId: 'building-1',
          },
          {
            id: 'soldier-2',
            name: 'Soldier Two',
            usedKey: 'key-2',
            buildingId: 'building-1',
          },
          {
            id: 'soldier-3',
            name: 'Soldier Three',
            keyId: 'key-3',
            buildingId: 'building-2',
          },
        ],
      }),
      dischargeSoldier: async (payload) => {
        discharged.push(payload);
        return { soldierId: payload.soldierId };
      },
      releaseKeyFromSoldier: async (payload) => {
        releasedKeys.push(payload);
        return { keyId: payload.keyId };
      },
    },
  });

  const result = await service.releaseBuildings({
    actorUserId: 'user-1',
    campId: 'camp-1',
    buildingIds: ['building-1'],
  });

  assert.equal(result.status, 200);
  assert.deepEqual(discharged.map((payload) => payload.soldierId), [
    'soldier-1',
    'soldier-2',
  ]);
  assert.deepEqual(releasedKeys.map((payload) => payload.keyId), ['key-issued']);
});

test('accommodation service requires a complete move chain for occupied keys', async () => {
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async ({ soldierId }) =>
        soldierId === 'soldier-1'
          ? {
              id: 'soldier-1',
              name: 'Soldier One',
              keyId: 'key-current',
            }
          : {
              id: 'soldier-2',
              name: 'Soldier Two',
              keyId: 'key-target',
            },
      findKeyById: async () => ({
        id: 'key-target',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: 'soldier-2',
      }),
      moveSoldier: async () => {
        throw new Error('move should be blocked before repository update');
      },
    },
  });

  await assert.rejects(
    () =>
      service.moveSoldier({
        actorUserId: 'user-1',
        campId: 'camp-1',
        soldierId: 'soldier-1',
        keyId: 'key-target',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'ACCOMMODATION_MOVE_CHAIN_INCOMPLETE');
      return true;
    },
  );
});

test('accommodation service moves a soldier chain into a free key', async () => {
  let savedMove = null;
  const soldiers = new Map([
    ['soldier-1', { id: 'soldier-1', name: 'Soldier One', keyId: 'key-1' }],
    ['soldier-2', { id: 'soldier-2', name: 'Soldier Two', keyId: 'key-2' }],
    ['soldier-3', { id: 'soldier-3', name: 'Soldier Three', keyId: 'key-3' }],
  ]);
  const keys = new Map([
    [
      'key-2',
      {
        id: 'key-2',
        name: 'Key 2',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: 'soldier-2',
      },
    ],
    [
      'key-3',
      {
        id: 'key-3',
        name: 'Key 3',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: 'soldier-3',
      },
    ],
    [
      'key-4',
      {
        id: 'key-4',
        name: 'Key 4',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: null,
      },
    ],
  ]);
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async ({ soldierId }) => soldiers.get(soldierId) || null,
      findKeyById: async ({ keyId }) => keys.get(keyId) || null,
      moveSoldier: async (payload) => {
        savedMove = payload;
        return { moves: payload.assignments };
      },
    },
  });

  const result = await service.moveSoldier({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    keyIds: ['key-2', 'key-3', 'key-4'],
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, '3 soldiers moved successfully.');
  assert.deepEqual(
    savedMove.assignments.map((assignment) => ({
      soldierId: assignment.soldierId,
      previousKeyId: assignment.previousKeyId,
      keyId: assignment.keyId,
    })),
    [
      { soldierId: 'soldier-1', previousKeyId: 'key-1', keyId: 'key-2' },
      { soldierId: 'soldier-2', previousKeyId: 'key-2', keyId: 'key-3' },
      { soldierId: 'soldier-3', previousKeyId: 'key-3', keyId: 'key-4' },
    ],
  );
});

test('accommodation service supports chain swaps back to the first soldier key', async () => {
  let savedMove = null;
  const soldiers = new Map([
    ['soldier-1', { id: 'soldier-1', name: 'Soldier One', keyId: 'key-1' }],
    ['soldier-2', { id: 'soldier-2', name: 'Soldier Two', keyId: 'key-2' }],
    ['soldier-3', { id: 'soldier-3', name: 'Soldier Three', keyId: 'key-3' }],
  ]);
  const keys = new Map([
    [
      'key-1',
      {
        id: 'key-1',
        name: 'Key 1',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: 'soldier-1',
      },
    ],
    [
      'key-2',
      {
        id: 'key-2',
        name: 'Key 2',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: 'soldier-2',
      },
    ],
    [
      'key-3',
      {
        id: 'key-3',
        name: 'Key 3',
        buildingType: 'Accommodation',
        hasBedAsset: true,
        soldierId: 'soldier-3',
      },
    ],
  ]);
  const service = createAccommodationService({
    repository: {
      userHasPermission: async () => true,
      findSoldierById: async ({ soldierId }) => soldiers.get(soldierId) || null,
      findKeyById: async ({ keyId }) => keys.get(keyId) || null,
      moveSoldier: async (payload) => {
        savedMove = payload;
        return { moves: payload.assignments };
      },
    },
  });

  const result = await service.moveSoldier({
    actorUserId: 'user-1',
    campId: 'camp-1',
    soldierId: 'soldier-1',
    keyIds: ['key-2', 'key-3', 'key-1'],
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, '3 soldiers moved successfully.');
  assert.deepEqual(
    savedMove.assignments.map((assignment) => ({
      soldierId: assignment.soldierId,
      previousKeyId: assignment.previousKeyId,
      keyId: assignment.keyId,
    })),
    [
      { soldierId: 'soldier-1', previousKeyId: 'key-1', keyId: 'key-2' },
      { soldierId: 'soldier-2', previousKeyId: 'key-2', keyId: 'key-3' },
      { soldierId: 'soldier-3', previousKeyId: 'key-3', keyId: 'key-1' },
    ],
  );
});
