const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const ExcelJS = require('exceljs');
const { createLaundryPageService } = require('../../../../src/modules/web/laundry/application/services/laundry-page.service');

function createRepository(overrides = {}) {
  return {
    listUserPermissions: async () => [{ name: 'Laundry' }],
    listBagsByCamp: async () => [],
    listAvailableBags: async () => [],
    listLaundryReport: async () => [],
    findBagByCode: async () => null,
    findBagById: async () => null,
    findBagByRfid: async () => null,
    getBagDeletionBlockers: async () => ({
      hasSoldierAssignment: false,
      hasLaundryReportHistory: false,
      hasAdditionalItemReferences: false,
    }),
    userHasPermission: async (_userId, permissionName) =>
      [
        'Laundry',
        'Add laundry bag',
        'Edit laundry bag',
        'Remove laundry bag',
        'Save laundry status',
        'Download laundry app',
      ].includes(permissionName),
    addBag: async (payload) => ({ id: 'bag-new', laundryCount: 0, ...payload }),
    editBag: async (payload) => ({ id: payload.bagId, laundryCount: 0, ...payload }),
    deleteBag: async ({ bagId }) => ({ id: bagId, code: 'BAG-1' }),
    recordLinenExchange: async ({ bagId }) => ({
      id: bagId,
      code: 'BAG-1',
      status: 'pick_up',
      soldierId: 'soldier-1',
    }),
    setBagStatus: async ({ bagId, status }) => ({ id: bagId, code: 'BAG-1', status }),
    bulkUpsertBags: async () => [],
    ...overrides,
  };
}

test('laundry overview builds totals and table state for every section', async () => {
  const rows = [
    {
      id: 'bag-1',
      code: 'BAG-A',
      rfidCode: 'RFID-A',
      type: 'Small',
      status: 'pick_up',
      laundryCount: 0,
      maxCountLaundry: 5,
      soldierName: null,
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
    },
    {
      id: 'bag-2',
      code: 'BAG-B',
      rfidCode: 'RFID-B',
      type: 'Large',
      status: 'drop_off',
      soldierId: 'soldier-2',
      laundryCount: 1,
      maxCountLaundry: 4,
      soldierName: 'Bravo Soldier',
      createdAt: '2026-04-21T08:00:00.000Z',
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
    {
      id: 'bag-3',
      code: 'BAG-C',
      rfidCode: 'RFID-C',
      type: 'Large',
      status: 'laundry_facility',
      soldierId: 'soldier-3',
      laundryCount: 2,
      maxCountLaundry: 4,
      soldierName: null,
      createdAt: '2026-04-22T08:00:00.000Z',
      updatedAt: '2026-04-22T08:00:00.000Z',
    },
    {
      id: 'bag-4',
      code: 'BAG-D',
      rfidCode: 'RFID-D',
      type: 'Mesh',
      status: 'ready_to_pick_up',
      soldierId: 'soldier-4',
      laundryCount: 3,
      maxCountLaundry: 6,
      soldierName: null,
      createdAt: '2026-04-23T08:00:00.000Z',
      updatedAt: '2026-04-23T08:00:00.000Z',
    },
    {
      id: 'bag-5',
      code: 'BAG-E',
      rfidCode: 'RFID-E',
      type: 'Small',
      status: 'drop_off',
      soldierId: 'soldier-5',
      laundryCount: 1,
      maxCountLaundry: 4,
      soldierName: 'Charlie Soldier',
      createdAt: '2026-04-24T08:00:00.000Z',
      updatedAt: '2026-04-24T08:00:00.000Z',
    },
    {
      id: 'bag-6',
      code: 'BAG-F',
      rfidCode: 'RFID-F',
      type: 'Mesh',
      status: 'laundry_facility',
      soldierId: 'soldier-6',
      laundryCount: 4,
      maxCountLaundry: 6,
      soldierName: 'Delta Soldier',
      createdAt: '2026-04-25T08:00:00.000Z',
      updatedAt: '2026-04-25T08:00:00.000Z',
    },
  ];
  const service = createLaundryPageService({
    repository: createRepository({ listBagsByCamp: async () => rows }),
  });

  const result = await service.getLaundryOverview({
    campId: 'camp-1',
    tableState: {
      all: {
        filters: { type: 'large' },
        sortColumn: 'code',
        sortDirection: 'desc',
        page: 1,
        limit: 1,
      },
      drop_off: {
        filters: { soldierName: 'bravo' },
        page: 1,
        limit: 10,
      },
      available: {
        filters: { code: 'BAG-A' },
        page: 1,
        limit: 10,
      },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.total, 6);
  assert.equal(result.body.pickUp, 1);
  assert.equal(result.body.dropOff, 2);
  assert.equal(result.body.laundryFacility, 2);
  assert.equal(result.body.readyToPickUp, 1);
  assert.equal(result.body.active, 5);
  assert.deepEqual(
    result.body.rows.map((row) => row.code),
    ['BAG-C'],
  );
  assert.equal(result.body.tables.all.total, 2);
  assert.equal(result.body.tables.all.totalPages, 2);
  assert.deepEqual(
    result.body.statusRows.drop_off.map((row) => row.code),
    ['BAG-B'],
  );
  assert.deepEqual(
    result.body.availableRows.map((row) => row.code),
    ['BAG-A'],
  );
  assert.deepEqual(result.body.statusTypeBreakdown.drop_off, [
    { type: 'Large', count: 1 },
    { type: 'Small', count: 1 },
  ]);
  assert.deepEqual(result.body.statusTypeBreakdown.laundry_facility, [
    { type: 'Large', count: 1 },
    { type: 'Mesh', count: 1 },
  ]);
  assert.deepEqual(result.body.statusTypeBreakdown.ready_to_pick_up, [
    { type: 'Mesh', count: 1 },
  ]);
});

test('status changes must use Move and require a soldier', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({ id: 'bag-1', code: 'BAG-1', status: 'pick_up' }),
    }),
  });

  await assert.rejects(
    () =>
      service.addBagToStatus({
        actorUserId: 'user-1',
        campId: 'camp-1',
        bagId: 'bag-1',
        status: 'laundry_facility',
      }),
    /Use Move to change the status/,
  );

  await assert.rejects(
    () =>
      service.moveBag({
        actorUserId: 'user-1',
        campId: 'camp-1',
        bagId: 'bag-1',
        status: 'laundry_facility',
      }),
    /assigned to a soldier/,
  );
});

test('assigned pick-up bags are shown as In soldier while unassigned bags remain Available', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      listBagsByCamp: async () => [
        {
          id: 'bag-1',
          code: 'BAG-1',
          rfidCode: 'RFID-1',
          type: 'Mesh',
          status: 'pick_up',
          soldierId: null,
          soldierName: null,
        },
        {
          id: 'bag-2',
          code: 'BAG-2',
          rfidCode: 'RFID-2',
          type: 'Mesh',
          status: 'pick_up',
          soldierId: 'soldier-2',
          soldierName: 'Assigned Soldier',
        },
      ],
    }),
  });

  const result = await service.getLaundryOverview({ campId: 'camp-1' });

  assert.equal(result.status, 200);
  assert.equal(result.body.pickUp, 1);
  assert.equal(result.body.inSoldier, 1);
  assert.deepEqual(
    result.body.rows.map((row) => [row.code, row.status, row.statusLabel]),
    [
      ['BAG-1', 'pick_up', 'Available'],
      ['BAG-2', 'in_soldier', 'In soldier'],
    ],
  );
  assert.deepEqual(
    result.body.availableRows.map((row) => row.code),
    ['BAG-1'],
  );
});

test('laundry overview does not check or mark overdue bags', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      listBagsByCamp: async () => [
        {
          id: 'bag-1',
          code: 'BAG-1',
          rfidCode: 'RFID-1',
          type: 'Mesh',
          status: 'laundry_facility',
          isOverdue: true,
          overdueSince: '2026-04-01T08:00:00.000Z',
          soldierId: 'soldier-1',
          soldierName: 'Assigned Soldier',
        },
        {
          id: 'bag-2',
          code: 'BAG-2',
          rfidCode: 'RFID-2',
          type: 'Mesh',
          status: 'ready_to_pick_up',
          isOverdue: true,
          overdueSince: '2026-04-02T08:00:00.000Z',
          soldierId: 'soldier-2',
          soldierName: 'Ready Soldier',
        },
      ],
    }),
  });

  const result = await service.getLaundryOverview({ campId: 'camp-1' });

  assert.equal(result.status, 200);
  assert.equal(result.body.active, 2);
  assert.equal(result.body.laundryFacility, 1);
  assert.equal(result.body.readyToPickUp, 1);
  assert.equal(result.body.rows[0].status, 'laundry_facility');
  assert.equal(result.body.rows[0].statusLabel, 'Laundry facility');
  assert.equal(result.body.rows[0].displayStatus, 'laundry_facility');
  assert.equal(result.body.rows[0].isOverdue, false);
  assert.equal(result.body.rows[0].overdueSince, null);
  assert.equal(result.body.statusRows.ready_to_pick_up[0].status, 'ready_to_pick_up');
  assert.equal(result.body.statusRows.ready_to_pick_up[0].statusLabel, 'Ready to pick up');
  assert.equal(result.body.statusRows.ready_to_pick_up[0].displayStatus, 'ready_to_pick_up');
  assert.deepEqual(result.body.notifications, []);
});

test('moving a soldier bag to In soldier stores the Available data status', async () => {
  const statusUpdates = [];
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({
        id: 'bag-1',
        code: 'BAG-1',
        status: 'ready_to_pick_up',
        soldierId: 'soldier-1',
      }),
      setBagStatus: async ({ bagId, status }) => {
        statusUpdates.push(status);
        return { id: bagId, code: 'BAG-1', status, soldierId: 'soldier-1' };
      },
    }),
  });

  const result = await service.moveBag({
    actorUserId: 'user-1',
    campId: 'camp-1',
    bagId: 'bag-1',
    status: 'in_soldier',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(statusUpdates, ['pick_up']);
  assert.equal(result.body.bag.status, 'in_soldier');
  assert.equal(result.body.bag.statusLabel, 'In soldier');
});

test('moving a bag accepts legacy mobile status labels and stores canonical status', async () => {
  const statusUpdates = [];
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({
        id: 'bag-1',
        code: 'BAG-1',
        status: 'Drop off',
        soldierId: 'soldier-1',
      }),
      setBagStatus: async ({ bagId, status, expectedStatus }) => {
        statusUpdates.push({ status, expectedStatus });
        return { id: bagId, code: 'BAG-1', status, soldierId: 'soldier-1' };
      },
    }),
  });

  const result = await service.moveBag({
    actorUserId: 'user-1',
    campId: 'camp-1',
    bagId: 'bag-1',
    status: 'Laundry facility',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(statusUpdates, [{ status: 'laundry_facility', expectedStatus: 'drop_off' }]);
  assert.equal(result.body.bag.status, 'laundry_facility');
});

test('moving into active laundry statuses does not check overdue or mark the response bag', async () => {
  const scenarios = [
    {
      currentStatus: 'pick_up',
      requestedStatus: 'drop_off',
      storedStatus: 'drop_off',
    },
    {
      currentStatus: 'drop_off',
      requestedStatus: 'laundry_facility',
      storedStatus: 'laundry_facility',
    },
    {
      currentStatus: 'laundry_facility',
      requestedStatus: 'ready_to_pick_up',
      storedStatus: 'ready_to_pick_up',
    },
  ];

  for (const scenario of scenarios) {
    const expectedLabels = {
      drop_off: 'Drop-off',
      laundry_facility: 'Laundry facility',
      ready_to_pick_up: 'Ready to pick up',
    };
    const service = createLaundryPageService({
      repository: createRepository({
        findBagById: async () => ({
          id: 'bag-1',
          code: 'BAG-1',
          status: scenario.currentStatus,
          soldierId: 'soldier-1',
        }),
        setBagStatus: async ({ bagId, status }) => ({
          id: bagId,
          code: 'BAG-1',
          status,
          soldierId: 'soldier-1',
        }),
      }),
      realtime: {
        emitLaundryChanged() {},
      },
    });

    const result = await service.moveBag({
      actorUserId: 'user-1',
      campId: 'camp-1',
      bagId: 'bag-1',
      status: scenario.requestedStatus,
    });

    assert.equal(result.body.bag.status, scenario.storedStatus);
    assert.equal(result.body.bag.statusLabel, expectedLabels[scenario.storedStatus]);
    assert.equal(result.body.bag.displayStatus, scenario.storedStatus);
    assert.equal(result.body.bag.isOverdue, false);
    assert.equal(result.body.bag.overdueSince, null);
  }
});

test('moving a bag returns the stored status without overdue decoration', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({
        id: 'bag-1',
        code: 'BAG-1',
        status: 'drop_off',
        soldierId: 'soldier-1',
      }),
      setBagStatus: async ({ bagId, status }) => ({
        id: bagId,
        code: 'BAG-1',
        status,
        soldierId: 'soldier-1',
      }),
    }),
    realtime: {
      emitLaundryChanged() {},
    },
  });

  const result = await service.moveBag({
    actorUserId: 'user-1',
    campId: 'camp-1',
    bagId: 'bag-1',
    status: 'ready_to_pick_up',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.bag.status, 'ready_to_pick_up');
  assert.equal(result.body.bag.statusLabel, 'Ready to pick up');
  assert.equal(result.body.bag.displayStatus, 'ready_to_pick_up');
  assert.equal(result.body.bag.isOverdue, false);
});

test('moving a bag rejects unchanged and blocked status transitions', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({
        id: 'bag-1',
        code: 'BAG-1',
        status: 'drop_off',
        soldierId: 'soldier-1',
      }),
    }),
  });

  await assert.rejects(
    () =>
      service.moveBag({
        actorUserId: 'user-1',
        campId: 'camp-1',
        bagId: 'bag-1',
        status: 'drop_off',
      }),
    /already set to Drop-off/,
  );

  await assert.rejects(
    () =>
      service.moveBag({
        actorUserId: 'user-1',
        campId: 'camp-1',
        bagId: 'bag-1',
        status: 'in_soldier',
      }),
    /can only be moved to Laundry facility, Ready to pick up/,
  );
});

test('moving a bag rejects stale status updates', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({
        id: 'bag-1',
        code: 'BAG-1',
        status: 'drop_off',
        soldierId: 'soldier-1',
      }),
      setBagStatus: async () => null,
    }),
  });

  await assert.rejects(
    () =>
      service.moveBag({
        actorUserId: 'user-1',
        campId: 'camp-1',
        bagId: 'bag-1',
        status: 'laundry_facility',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'LAUNDRY_BAG_STATUS_CONFLICT');
      assert.match(error.message, /status changed/i);
      return true;
    },
  );
});

test('linen exchange records an instant completed laundry report for assigned bags regardless of status', async () => {
  const exchanges = [];
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({
        id: 'bag-1',
        code: 'BAG-1',
        status: 'drop_off',
        soldierId: 'soldier-1',
      }),
      recordLinenExchange: async ({ bagId }) => {
        exchanges.push(bagId);
        return {
          id: bagId,
          code: 'BAG-1',
          status: 'drop_off',
          soldierId: 'soldier-1',
        };
      },
    }),
  });

  const result = await service.recordLinenExchange({
    actorUserId: 'user-1',
    campId: 'camp-1',
    bagId: 'bag-1',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(exchanges, ['bag-1']);
  assert.equal(result.body.bag.status, 'drop_off');
});

test('laundry report summarizes active, washed, linen exchange, and countries by date interval', async () => {
  let reportPayload = null;
  const service = createLaundryPageService({
    repository: createRepository({
      listLaundryReport: async (payload) => {
        reportPayload = payload;
        return [
          {
            id: 'report-1',
            bagId: 'bag-1',
            bagCode: 'BAG-1',
            rfidCode: 'RFID-1',
            type: 'Mesh',
            soldierId: 'soldier-1',
            soldierName: 'Alpha Soldier',
            soldierCountry: 'USA',
            dateDropOff: new Date('2026-04-17T09:00:00.000Z'),
            dateReadyToPickUp: null,
            reportDate: '2026-04-17',
          },
          {
            id: 'report-2',
            bagId: 'bag-2',
            bagCode: 'BAG-2',
            soldierId: 'soldier-2',
            soldierName: 'Bravo Soldier',
            soldierCountry: 'USA',
            dateDropOff: new Date('2026-04-17T10:00:00.000Z'),
            dateReadyToPickUp: new Date('2026-04-18T10:00:00.000Z'),
            reportDate: '2026-04-17',
          },
          {
            id: 'report-3',
            bagId: 'bag-3',
            bagCode: 'BAG-3',
            soldierId: 'soldier-3',
            soldierName: 'Charlie Soldier',
            soldierCountry: 'BGR',
            dateDropOff: new Date('2026-04-18T11:00:00.000Z'),
            dateReadyToPickUp: new Date('2026-04-18T11:00:00.000Z'),
            reportDate: '2026-04-18',
          },
        ];
      },
    }),
  });

  const result = await service.getLaundryReport({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fromDate: '2026-04-17',
    toDate: '2026-04-18',
    tableState: {
      history: {
        filters: { soldierCountry: 'usa' },
        page: 1,
        limit: 10,
      },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(reportPayload.campId, 'camp-1');
  assert.equal(reportPayload.from.toISOString(), '2026-04-17T00:00:00.000Z');
  assert.equal(reportPayload.to.toISOString(), '2026-04-19T00:00:00.000Z');
  assert.equal(result.body.totalBags, 3);
  assert.equal(result.body.beingWashedCount, 1);
  assert.equal(result.body.washedCount, 2);
  assert.equal(result.body.linenExchangeCount, 1);
  assert.deepEqual(
    result.body.rows.map((row) => row.bagCode),
    ['BAG-1', 'BAG-2'],
  );
  assert.deepEqual(result.body.countryTotals, [
    { country: 'BGR', totalCount: 1, beingWashedCount: 0, washableCount: 0, linenExchangeCount: 1 },
    { country: 'USA', totalCount: 2, beingWashedCount: 1, washableCount: 1, linenExchangeCount: 0 },
  ]);
  assert.deepEqual(result.body.dailyTotals, [
    { date: '2026-04-17', totalCount: 2, beingWashedCount: 1, washedCount: 1, linenExchangeCount: 0 },
    { date: '2026-04-18', totalCount: 1, beingWashedCount: 0, washedCount: 1, linenExchangeCount: 1 },
  ]);

  const filteredCountryResult = await service.getLaundryReport({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fromDate: '2026-04-17',
    toDate: '2026-04-18',
    tableState: {
      country: {
        filters: { country: 'us' },
        sortColumn: 'totalCount',
        sortDirection: 'desc',
        page: 1,
        limit: 10,
      },
    },
  });

  assert.deepEqual(filteredCountryResult.body.countryTotals, [
    { country: 'USA', totalCount: 2, beingWashedCount: 1, washableCount: 1, linenExchangeCount: 0 },
  ]);
  assert.equal(filteredCountryResult.body.tables.country.sortColumn, 'totalCount');
  assert.equal(filteredCountryResult.body.tables.country.sortDirection, 'desc');
});

test('laundry report download marks linen exchanges in the workbook', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      listLaundryReport: async () => [
        {
          id: 'report-1',
          bagId: 'bag-1',
          bagCode: 'BAG-1',
          soldierId: 'soldier-1',
          soldierName: 'Alpha Soldier',
          soldierCountry: 'USA',
          dateDropOff: new Date('2026-04-17T09:00:00.000Z'),
          dateReadyToPickUp: new Date('2026-04-17T09:00:00.000Z'),
          reportDate: '2026-04-17',
        },
      ],
    }),
  });

  const result = await service.downloadLaundryReport({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fromDate: '2026-04-17',
    toDate: '2026-04-17',
  });

  assert.equal(result.fileName, 'laundry-report-2026-04-17-to-2026-04-17.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const history = workbook.getWorksheet('Laundry history');
  assert.equal(history.getRow(2).getCell(4).value, 'Linen exchange');
  assert.equal(history.getRow(2).getCell(4).fill.fgColor.argb, 'FFFFF2CC');
});

test('laundry service downloads the mobile app package with integrity verification', async () => {
  const appPath = 'androidApp/gss-laundry-1.4.2-release.apk';
  const appBuffer = await fs.readFile(appPath);
  const appHash = crypto.createHash('sha256').update(appBuffer).digest('hex');
  let auditEvent = null;
  let auditPayload = null;
  const service = createLaundryPageService({
    repository: createRepository(),
    env: {
      APP_LAUNDRY_FILE_PATH: appPath,
      HASH_APP_LAUNDRY: appHash,
    },
    auditLog: (eventName, payload) => {
      auditEvent = eventName;
      auditPayload = payload;
    },
  });

  const result = await service.downloadLaundryMobileApp({
    actorUserId: 'user-1',
    requestMeta: { ip: '127.0.0.1' },
  });

  assert.equal(result.status, 200);
  assert.equal(result.fileName, 'gss-laundry-1.4.2-release.apk');
  assert.equal(result.contentType, 'application/vnd.android.package-archive');
  assert.equal(result.buffer.length, appBuffer.length);
  assert.equal(auditEvent, 'laundry.mobile_app.downloaded');
  assert.equal(auditPayload.actorUserId, 'user-1');
  assert.equal(auditPayload.hash, appHash);
});

test('laundry service uses the default mobile app path when env path is blank', async () => {
  const appPath = 'androidApp/gss-laundry-1.4.2-release.apk';
  const appBuffer = await fs.readFile(appPath);
  const appHash = crypto.createHash('sha256').update(appBuffer).digest('hex');
  const service = createLaundryPageService({
    repository: createRepository(),
    env: {
      APP_LAUNDRY_FILE_PATH: '',
      HASH_APP_LAUNDRY: appHash,
    },
  });

  const result = await service.downloadLaundryMobileApp({ actorUserId: 'user-1' });

  assert.equal(result.status, 200);
  assert.equal(result.fileName, 'gss-laundry-1.4.2-release.apk');
  assert.equal(result.buffer.length, appBuffer.length);
});

test('laundry service returns a clean app error when the mobile app path is a directory', async () => {
  const service = createLaundryPageService({
    repository: createRepository(),
    env: {
      APP_LAUNDRY_FILE_PATH: '.',
      HASH_APP_LAUNDRY: '0'.repeat(64),
    },
  });

  await assert.rejects(
    () => service.downloadLaundryMobileApp({ actorUserId: 'user-1' }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 404);
      assert.equal(error.code, 'LAUNDRY_MOBILE_APP_NOT_FOUND');
      assert.match(error.message, /not available/i);
      return true;
    },
  );
});

test('adding a bag rejects duplicate RFID codes', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      findBagByRfid: async ({ rfidCode }) => (rfidCode === 'RFID-1' ? { id: 'bag-9', rfidCode } : null),
    }),
  });

  await assert.rejects(
    () =>
      service.addBag({
        actorUserId: 'user-1',
        campId: 'camp-1',
        code: 'BAG-1',
        rfidCode: 'RFID-1',
        type: 'Mesh',
        status: 'pick_up',
        maxCountLaundry: 1,
      }),
    /RFID code already exists/i,
  );
});

test('deleting an available bag is allowed with report history', async () => {
  const deletes = [];
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({
        id: 'bag-1',
        code: 'BAG-1',
        status: 'pick_up',
        hasLaundryReportHistory: true,
      }),
      getBagDeletionBlockers: async () => ({
        hasSoldierAssignment: false,
        hasLaundryReportHistory: true,
        hasAdditionalItemReferences: false,
      }),
      deleteBag: async ({ bagId }) => {
        deletes.push(bagId);
        return { id: bagId, code: 'BAG-1' };
      },
    }),
  });

  const result = await service.deleteBag({
    actorUserId: 'user-1',
    campId: 'camp-1',
    bagId: 'bag-1',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(deletes, ['bag-1']);
});

test('deleting a bag is blocked until it is available', async () => {
  const service = createLaundryPageService({
    repository: createRepository({
      findBagById: async () => ({ id: 'bag-1', code: 'BAG-1', status: 'ready_to_pick_up' }),
      deleteBag: async () => {
        throw new Error('delete should be blocked before repository delete');
      },
    }),
  });

  await assert.rejects(
    () =>
      service.deleteBag({
        actorUserId: 'user-1',
        campId: 'camp-1',
        bagId: 'bag-1',
      }),
    /must be Available/i,
  );
});

test('laundry overview sorts numeric columns on the server side', async () => {
  const rows = [
    {
      id: 'bag-1',
      code: 'BAG-A',
      rfidCode: 'RFID-A',
      type: 'Small',
      status: 'pick_up',
      laundryCount: 2,
      maxCountLaundry: 5,
      soldierName: null,
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
    },
    {
      id: 'bag-2',
      code: 'BAG-B',
      rfidCode: 'RFID-B',
      type: 'Large',
      status: 'pick_up',
      laundryCount: 10,
      maxCountLaundry: 12,
      soldierName: null,
      createdAt: '2026-04-21T08:00:00.000Z',
      updatedAt: '2026-04-21T08:00:00.000Z',
    },
    {
      id: 'bag-3',
      code: 'BAG-C',
      rfidCode: 'RFID-C',
      type: 'Mesh',
      status: 'pick_up',
      laundryCount: 4,
      maxCountLaundry: 9,
      soldierName: null,
      createdAt: '2026-04-22T08:00:00.000Z',
      updatedAt: '2026-04-22T08:00:00.000Z',
    },
  ];
  const service = createLaundryPageService({
    repository: createRepository({ listBagsByCamp: async () => rows }),
  });

  const result = await service.getLaundryOverview({
    campId: 'camp-1',
    tableState: {
      all: {
        filters: { maxCountLaundry: '9' },
        sortColumn: 'laundryCount',
        sortDirection: 'desc',
        page: 1,
        limit: 10,
      },
    },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.rows.map((row) => row.code),
    ['BAG-C'],
  );
  assert.equal(result.body.tables.all.total, 1);
});

test('laundry bag template import validates uniqueness without scope errors', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Laundry Bags');
  sheet.addRow(['Identifier', 'Bag Code', 'RFID Code', 'Bag Type', 'Max Laundry Count']);
  sheet.addRow(['', 'BAG-NEW-1', 'RFID-NEW-1', 'Mesh', 3]);
  sheet.addRow(['', 'BAG-NEW-2', 'RFID-NEW-2', 'Mesh', 4]);

  const importedRows = [];
  const service = createLaundryPageService({
    repository: createRepository({
      bulkUpsertBags: async ({ rows }) => {
        importedRows.push(...rows);
        return rows.map((row, index) => ({
          action: 'added',
          bag: {
            id: `bag-${index + 1}`,
            code: row.code,
            rfidCode: row.rfidCode,
            type: row.type,
            status: 'pick_up',
            laundryCount: 0,
            maxCountLaundry: row.maxCountLaundry,
          },
        }));
      },
    }),
  });

  const result = await service.importBags({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fileBuffer: await workbook.xlsx.writeBuffer(),
    fileName: 'laundry-bag-template.xlsx',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.summary.addedCount, 2);
  assert.deepEqual(
    importedRows.map((row) => row.rowNumber),
    [2, 3],
  );
});
