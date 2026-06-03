// @ts-nocheck
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ASSET_TYPE_TEMPLATE_FILENAME,
  CLEAN_ITEM_TEMPLATE_FILENAME,
  createAssetsPageService,
} = require('../../../../src/modules/web/assets/application/services/assets-page.service');
const ExcelJS = require('exceljs');

test('assets page service builds the dashboard for the active camp', async () => {
  const calls = [];
  const service = createAssetsPageService({
    repository: {
      listUserPermissions: async () => [{ name: 'Assets' }],
      getAssetSummary: async ({ campId }) => {
        calls.push(['summary', campId]);
        return {
          totalAssets: 2,
          totalQuantity: '5',
          notFoundAssets: 1,
          completedAssets: 1,
          typeCount: 1,
        };
      },
      listAssetsTable: async ({ campId }) => {
        calls.push(['assets', campId]);
        return {
          rows: [
          {
            id: 'asset-1',
            code: 'A-001',
            name: 'Chair',
            typeName: 'Furniture',
            locationRoomName: 'Room 1',
            locationKeyName: 'Key 1',
            buildingName: 'Building A',
            quantity: '2',
            owner: 'Global RTS',
            status: 'New',
            inventoryStatus: 'completed',
            lastInventoryDate: '2030-01-02T00:00:00.000Z',
          },
          {
            id: 'asset-2',
            code: 'A-002',
            name: 'Desk',
            typeName: 'Furniture',
            quantity: '3',
            inventoryStatus: 'undiscovered',
          },
          ],
          total: 2,
          sourceTotal: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        };
      },
      listNotFoundAssetsTable: async ({ campId }) => {
        calls.push(['not-found', campId]);
        return {
          rows: [
            {
              id: 'asset-2',
              code: 'A-002',
              name: 'Desk',
              typeName: 'Furniture',
              quantity: '3',
              inventoryStatus: 'undiscovered',
            },
          ],
          total: 1,
          sourceTotal: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        };
      },
      listInventoryStatusTable: async ({ campId }) => {
        calls.push(['statuses', campId]);
        return {
          rows: [
            {
              status: 'completed',
              label: 'Completed',
              assetCount: 1,
              quantity: '2',
              lastInventoryDate: '2030-01-02T00:00:00.000Z',
            },
          ],
          total: 1,
          sourceTotal: 3,
          page: 1,
          limit: 10,
          totalPages: 1,
        };
      },
      listAssetTypesTable: async ({ campId }) => {
        calls.push(['types', campId]);
        return {
          rows: [
          {
            id: 'type-1',
            name: 'Furniture',
            assetCount: 2,
            notFoundCount: 1,
            completedCount: 1,
          },
          ],
          total: 1,
          sourceTotal: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        };
      },
      listInventoryEventsTable: async ({ campId }) => {
        calls.push(['events', campId]);
        return {
          rows: [
          {
            id: 'event-1',
            changedAt: '2030-01-03T00:00:00.000Z',
            addedQuantity: '2',
            removedQuantity: '0',
            lostQuantity: '1',
            modifiedQuantity: '0',
          },
          ],
          total: 1,
          sourceTotal: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        };
      },
    },
  });

  const result = await service.getAssetsView({
    userId: 'user-1',
    campId: 'camp-1',
    csrfToken: 'csrf-token',
  });

  assert.equal(result.totalAssets, 2);
  assert.equal(result.totalQuantity, '5');
  assert.equal(result.notFoundAssets, 1);
  assert.equal(result.completedAssets, 1);
  assert.equal(result.typeCount, 1);
  assert.equal(result.allAssets[0].location, 'Building A / Room 1 / Key 1');
  assert.equal(result.allAssets[0].lastInventoryDate, '2030-01-02 12:00 AM');
  assert.equal(result.notFoundRows[0].code, 'A-002');
  assert.equal(result.inventoryStatusRows.find((row) => row.status === 'completed').quantity, '2');
  assert.equal(
    result.inventoryStatusRows.find((row) => row.status === 'completed').lastInventoryDate,
    '2030-01-02 12:00 AM',
  );
  assert.equal(result.assetTypes[0].notFoundCount, 1);
  assert.equal(result.inventoryEvents[0].lostQuantity, '1');
  assert.deepEqual(calls, [
    ['summary', 'camp-1'],
    ['assets', 'camp-1'],
    ['not-found', 'camp-1'],
    ['statuses', 'camp-1'],
    ['types', 'camp-1'],
    ['events', 'camp-1'],
  ]);
});

test('assets page service avoids asset queries when no camp is selected', async () => {
  let assetQueryCount = 0;
  const service = createAssetsPageService({
    repository: {
      listUserPermissions: async () => [{ name: 'Assets' }],
      getAssetSummary: async () => {
        assetQueryCount += 1;
        return {};
      },
      listAssetsTable: async () => {
        assetQueryCount += 1;
        return {};
      },
      listNotFoundAssetsTable: async () => {
        assetQueryCount += 1;
        return {};
      },
      listInventoryStatusTable: async () => {
        assetQueryCount += 1;
        return {};
      },
      listAssetTypesTable: async () => {
        assetQueryCount += 1;
        return {};
      },
      listInventoryEventsTable: async () => {
        assetQueryCount += 1;
        return {};
      },
    },
  });

  const result = await service.getAssetsView({
    userId: 'user-1',
    campId: null,
    csrfToken: 'csrf-token',
  });

  assert.equal(result.campRequired, true);
  assert.equal(result.totalAssets, 0);
  assert.equal(result.notFoundAssets, 0);
  assert.equal(assetQueryCount, 0);
});

test('assets data normalizes per-table search, sorting, and pagination state', async () => {
  const received = {};
  const emptyTable = () => ({
    rows: [],
    total: 0,
    sourceTotal: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const service = createAssetsPageService({
    repository: {
      getAssetSummary: async () => ({
        totalAssets: 0,
        totalQuantity: '0',
        notFoundAssets: 0,
        completedAssets: 0,
        typeCount: 0,
      }),
      listAssetsTable: async ({ state }) => {
        received.allAssets = state;
        return emptyTable();
      },
      listNotFoundAssetsTable: async ({ state }) => {
        received.notFoundRows = state;
        return emptyTable();
      },
      listInventoryStatusTable: async ({ state }) => {
        received.inventoryStatusRows = state;
        return emptyTable();
      },
      listAssetTypesTable: async ({ state }) => {
        received.assetTypes = state;
        return emptyTable();
      },
      listInventoryEventsTable: async ({ state }) => {
        received.inventoryEvents = state;
        return emptyTable();
      },
    },
  });

  await service.getAssetsData({
    campId: 'camp-1',
    tableState: {
      allAssets: {
        page: 3,
        limit: 25,
        filters: { code: 'A-', quantity: '7', unknown: 'ignored' },
        sortColumn: 'quantity',
        sortDirection: 'desc',
      },
      assetTypes: {
        filters: { name: 'Furniture', assetCount: '2' },
        sortColumn: 'assetCount',
        sortDirection: 'asc',
      },
    },
  });

  assert.deepEqual(received.allAssets, {
    page: 3,
    limit: 25,
    filters: [{ column: 'code', value: 'A-' }],
    sortColumn: 'quantity',
    sortDirection: 'desc',
  });
  assert.deepEqual(received.assetTypes.filters, [{ column: 'name', value: 'Furniture' }]);
  assert.equal(received.assetTypes.sortColumn, 'assetCount');
});

test('assets page service adds an asset and emits realtime refresh', async () => {
  const emitted = [];
  const service = createAssetsPageService({
    realtime: {
      emitAssetsChanged: (campId) => emitted.push(['assets', campId]),
      emitAccommodationChanged: (campId, payload) => emitted.push(['accommodation', campId, payload]),
    },
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      addAsset: async ({ payload }) => ({
        id: 'asset-1',
        ...payload,
        typeName: 'Furniture',
      }),
    },
  });

  const result = await service.addAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: {
      code: 'A-001',
      rfidCode: 'RFID-A-001',
      name: 'Chair',
      typeId: 'type-chair',
      locationRoomId: 'room-1',
      quantity: '2',
      status: 'Good',
      expandable: 'Non Expandable',
      inventoryStatus: 'completed',
      isFixed: true,
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.asset.code, 'A-001');
  assert.equal(result.body.asset.inventoryStatusLabel, 'Completed');
  assert.deepEqual(emitted, [['assets', 'camp-1']]);
});

test('assets page service edits and deletes assets with realtime refresh', async () => {
  const emitted = [];
  const calls = [];
  const service = createAssetsPageService({
    realtime: {
      emitAssetsChanged: (campId) => emitted.push(['assets', campId]),
      emitAccommodationChanged: (campId, payload) => emitted.push(['accommodation', campId, payload]),
    },
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetById: async ({ assetId }) => ({
        id: assetId,
        code: 'A-001',
        rfidCode: 'RFID-A-001',
        name: 'Chair',
        isQuantitative: false,
      }),
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      editAsset: async ({ assetId, payload }) => {
        calls.push(['edit', assetId, payload.code]);
        return { id: assetId, ...payload };
      },
      deleteAsset: async ({ assetId }) => {
        calls.push(['delete', assetId]);
        return { id: assetId };
      },
    },
  });

  const editResult = await service.editAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    assetId: 'asset-1',
    payload: {
      code: 'A-002',
      rfidCode: 'RFID-A-002',
      name: 'Chair XL',
      typeId: 'type-chair',
      locationRoomId: 'room-1',
      quantity: '1',
      status: 'Good',
      inventoryStatus: 'completed',
    },
  });
  const deleteResult = await service.deleteAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    assetId: 'asset-1',
  });

  assert.equal(editResult.status, 200);
  assert.equal(deleteResult.status, 200);
  assert.deepEqual(emitted, [
    ['assets', 'camp-1'],
    ['assets', 'camp-1'],
  ]);
  assert.deepEqual(calls, [
    ['edit', 'asset-1', 'A-002'],
    ['delete', 'asset-1'],
  ]);
});

test('assets page service restarts inventory and emits realtime refresh', async () => {
  const emitted = [];
  let restartPayload;
  const service = createAssetsPageService({
    realtime: {
      emitAssetsChanged: (campId) => emitted.push(campId),
    },
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      restartInventory: async (payload) => {
        restartPayload = payload;
        return { updatedCount: 3 };
      },
    },
  });

  const result = await service.restartInventory({
    actorUserId: 'user-1',
    campId: 'camp-1',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.updatedCount, 3);
  assert.deepEqual(restartPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    locationRoomId: null,
  });
  assert.deepEqual(emitted, ['camp-1']);
});

test('assets page service generates RFID and keeps quantity for quantitative assets', async () => {
  let savedPayload;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      addAsset: async ({ payload }) => {
        savedPayload = payload;
        return {
          id: 'asset-1',
          ...payload,
          typeName: 'Furniture',
        };
      },
    },
  });

  const result = await service.addAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: {
      code: 'A-002',
      rfidCode: 'RFID-USER-2',
      name: 'Tables',
      typeId: 'type-table',
      locationRoomId: 'room-1',
      quantity: '12',
      status: 'Good',
      isQuantitative: true,
    },
  });

  assert.equal(result.status, 200);
  assert.equal(savedPayload.quantity, '12');
  assert.equal(savedPayload.isQuantitative, true);
  assert.match(savedPayload.rfidCode, /^RFID-ASSET-[0-9A-F]{16}$/);
});


test('assets page service rejects Bed type for quantitative assets on add and edit', async () => {
  let addCalled = false;
  let editCalled = false;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      listAssetTypesByCamp: async () => [
        { id: 'type-bed', name: 'Bed' },
        { id: 'type-chair', name: 'Chair' },
      ],
      findAssetById: async ({ assetId }) => ({
        id: assetId,
        code: 'BED-001',
        rfidCode: 'RFID-BED-001',
        name: 'Bed 1',
        typeId: 'type-bed',
        locationRoomId: 'room-1',
        quantity: '1',
        status: 'Good',
        isQuantitative: false,
      }),
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      addAsset: async () => {
        addCalled = true;
        return { id: 'asset-new' };
      },
      editAsset: async () => {
        editCalled = true;
        return { id: 'asset-1' };
      },
    },
  });

  for (const action of [
    () =>
      service.addAsset({
        actorUserId: 'user-1',
        campId: 'camp-1',
        payload: {
          code: 'BED-002',
          rfidCode: '',
          name: 'Beds',
          typeId: 'type-bed',
          locationRoomId: 'room-1',
          quantity: '5',
          status: 'Good',
          isQuantitative: true,
        },
      }),
    () =>
      service.editAsset({
        actorUserId: 'user-1',
        campId: 'camp-1',
        assetId: 'asset-1',
        payload: {
          code: 'BED-001',
          rfidCode: 'RFID-BED-001',
          name: 'Bed 1',
          typeId: 'type-bed',
          locationRoomId: 'room-1',
          quantity: '5',
          status: 'Good',
          isQuantitative: true,
        },
      }),
  ]) {
    await assert.rejects(action, (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'ASSET_QUANTITATIVE_BED_TYPE_NOT_ALLOWED');
      assert.match(error.message, /Quantitative assets cannot use the Bed asset type/);
      return true;
    });
  }

  assert.equal(addCalled, false);
  assert.equal(editCalled, false);
});

test('assets page service requires type room quantity and status for asset saves', async () => {
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      addAsset: async () => ({ id: 'asset-1' }),
    },
  });

  for (const [field, payload] of [
    ['Asset type', { typeId: '' }],
    ['Room', { locationRoomId: '' }],
    ['Asset quantity', { quantity: '' }],
    ['Asset status', { status: '' }],
  ]) {
    await assert.rejects(
      () =>
        service.addAsset({
          actorUserId: 'user-1',
          campId: 'camp-1',
          payload: {
            code: 'A-REQ',
            rfidCode: 'RFID-A-REQ',
            name: 'Required asset',
            typeId: 'type-chair',
            locationRoomId: 'room-1',
            quantity: '1',
            status: 'Good',
            ...payload,
          },
        }),
      (error) => {
        assert.equal(error.name, 'AppError');
        assert.equal(error.status, 400);
        assert.match(error.message, new RegExp(field));
        return true;
      },
    );
  }
});

test('assets page service defaults MRAH, formats M2 inside, and ignores user system dates', async () => {
  let savedPayload;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      addAsset: async ({ payload }) => {
        savedPayload = payload;
        return { id: 'asset-1', ...payload };
      },
    },
  });

  const result = await service.addAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: {
      code: 'A-005',
      rfidCode: 'RFID-A-005',
      name: 'Desk',
      typeId: 'type-desk',
      locationRoomId: 'room-1',
      quantity: '1',
      status: 'Fair',
      m2Inside: '10.1',
      writtenOffDate: '2030-01-01',
      lastInventoryDate: '2030-01-02',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(savedPayload.mrah, 'Global RTS');
  assert.equal(savedPayload.m2Inside, '10.10');
  assert.equal(savedPayload.writtenOffDate, null);
  assert.equal(savedPayload.lastInventoryDate, null);
});

test('assets page service validates numeric asset lifecycle fields and purchase price', async () => {
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      addAsset: async () => ({ id: 'asset-1' }),
    },
  });

  for (const [field, payload] of [
    ['Purchase price', { purchasePrice: 'abc' }],
    ['Lifecycle year', { yearOfLifeCycle: 'abc' }],
    ['Lifecycle rest', { restOfLifeCycle: 'abc' }],
    ['Rest value', { restValue: 'abc' }],
  ]) {
    await assert.rejects(
      () =>
        service.addAsset({
          actorUserId: 'user-1',
          campId: 'camp-1',
          payload: {
            code: 'A-NUM',
            rfidCode: 'RFID-A-NUM',
            name: 'Numeric asset',
            typeId: 'type-chair',
            locationRoomId: 'room-1',
            quantity: '1',
            status: 'Good',
            ...payload,
          },
        }),
      (error) => {
        assert.equal(error.name, 'AppError');
        assert.equal(error.status, 400);
        assert.match(error.message, new RegExp(field));
        return true;
      },
    );
  }
});

test('assets page service requires replacement references to match asset lookups', async () => {
  let savedPayload;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      listAssetsByCamp: async () => [
        { id: 'asset-old', code: 'A-OLD', name: 'Old desk', typeName: 'Furniture' },
        { id: 'asset-new', code: 'A-NEW', name: 'New desk', typeName: 'Furniture' },
      ],
      addAsset: async ({ payload }) => {
        savedPayload = payload;
        return { id: 'asset-1', ...payload };
      },
    },
  });

  const result = await service.addAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: {
      code: 'A-006',
      rfidCode: 'RFID-A-006',
      name: 'Desk',
      typeId: 'type-desk',
      locationRoomId: 'room-1',
      quantity: '1',
      status: 'Fair',
      purchasePrice: '10.1',
      yearOfLifeCycle: '1',
      restOfLifeCycle: '2.5',
      restValue: '3',
      replacedOff: 'A-OLD',
      replacedBy: 'asset-new',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(savedPayload.purchasePrice, '10.10');
  assert.equal(savedPayload.replacedOff, 'A-OLD - Old desk');
  assert.equal(savedPayload.replacedBy, 'A-NEW - New desk');

  await assert.rejects(
    () =>
      service.addAsset({
        actorUserId: 'user-1',
        campId: 'camp-1',
        payload: {
          code: 'A-007',
          rfidCode: 'RFID-A-007',
          name: 'Desk 2',
          typeId: 'type-desk',
          locationRoomId: 'room-1',
          quantity: '1',
          status: 'Good',
          replacedOff: 'missing asset',
        },
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'ASSET_LOOKUP_NOT_FOUND');
      assert.match(error.message, /Replaced off/);
      return true;
    },
  );
});

test('assets page service enforces required asset fields in bulk updates', async () => {
  let bulkCalled = false;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      listAssetTypesByCamp: async () => [{ id: 'type-chair', name: 'Chair' }],
      listRoomsByCamp: async () => [{ id: 'room-1', name: 'Room 1' }],
      listKeysByCamp: async () => [],
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      bulkUpsertAssets: async () => {
        bulkCalled = true;
        return [];
      },
    },
  });

  const result = await service.bulkUpdateAssets({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload:
      ',A-001,Chair Asset,Chair,Room 1,,Furniture,1,Global RTS,,undiscovered,Billeting,false,Description',
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.summary.totalRows, 1);
  assert.equal(result.body.summary.errorCount, 1);
  assert.equal(result.body.summary.errors[0].rowNumber, 1);
  assert.match(result.body.summary.errors[0].message, /Asset status/);
  assert.equal(bulkCalled, false);
});

test('assets page service rejects quantitative values when bulk updating existing assets', async () => {
  let bulkCalled = false;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      listAssetTypesByCamp: async () => [{ id: 'type-chair', name: 'Chair' }],
      listRoomsByCamp: async () => [{ id: 'room-1', name: 'Room 1' }],
      listKeysByCamp: async () => [],
      listAssetsByCamp: async () => [],
      findAssetById: async ({ assetId }) => ({
        id: assetId,
        code: 'A-001',
        rfidCode: 'RFID-A-001',
        name: 'Chair Asset',
        typeId: 'type-chair',
        locationRoomId: 'room-1',
        quantity: '1',
        status: 'Good',
        isQuantitative: false,
      }),
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      bulkUpsertAssets: async () => {
        bulkCalled = true;
        return [];
      },
    },
  });

  const result = await service.bulkUpdateAssets({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: [
      '33333333-3333-4333-8333-333333333333',
      'A-001',
      'RFID-A-001',
      'Chair Asset',
      'Chair',
      'Room 1',
      '',
      'Furniture',
      '1',
      'Global RTS',
      'Global RTS',
      'Good',
      'undiscovered',
      'Billeting',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'false',
      'true',
      'Description',
    ].join(','),
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.summary.totalRows, 1);
  assert.equal(result.body.summary.errorCount, 1);
  assert.equal(result.body.summary.errors[0].rowNumber, 1);
  assert.equal(result.body.summary.errors[0].code, 'ASSET_BULK_QUANTITATIVE_CREATE_ONLY');
  assert.match(result.body.summary.errors[0].message, /Quantitative can only be set/);
  assert.equal(bulkCalled, false);
});


test('assets page service reports Bed type as invalid for new quantitative rows in bulk updates', async () => {
  let bulkCalled = false;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      listAssetTypesByCamp: async () => [
        { id: 'type-bed', name: 'Bed' },
        { id: 'type-chair', name: 'Chair' },
      ],
      listRoomsByCamp: async () => [{ id: 'room-1', name: 'Room 1' }],
      listKeysByCamp: async () => [],
      listAssetsByCamp: async () => [],
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      bulkUpsertAssets: async () => {
        bulkCalled = true;
        return [];
      },
    },
  });

  const result = await service.bulkUpdateAssets({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: [
      '',
      'BED-100',
      '',
      'Beds',
      'Bed',
      'Room 1',
      '',
      'Furniture',
      '10',
      'Global RTS',
      'Global RTS',
      'Good',
      'undiscovered',
      'Billeting',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'false',
      'true',
      'Description',
    ].join(','),
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.summary.totalRows, 1);
  assert.equal(result.body.summary.errorCount, 1);
  assert.equal(result.body.summary.errors[0].rowNumber, 1);
  assert.equal(result.body.summary.errors[0].code, 'ASSET_QUANTITATIVE_BED_TYPE_NOT_ALLOWED');
  assert.match(result.body.summary.errors[0].message, /Quantitative assets cannot use the Bed asset type/);
  assert.equal(bulkCalled, false);
});

test('assets page service only allows key assignments for Bed assets', async () => {
  let addCalled = false;
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      listAssetTypesByCamp: async () => [
        { id: 'type-bed', name: 'Bed' },
        { id: 'type-chair', name: 'Chair' },
      ],
      addAsset: async () => {
        addCalled = true;
      },
    },
  });

  await assert.rejects(
    () =>
      service.addAsset({
        actorUserId: 'user-1',
        campId: 'camp-1',
        payload: {
          code: 'A-003',
          rfidCode: 'RFID-ASSET-003',
          name: 'Chair',
          typeId: 'type-chair',
          locationRoomId: 'room-1',
          locationKeyId: 'key-1',
          quantity: '1',
          status: 'Good',
        },
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'ASSET_KEY_REQUIRES_BED_TYPE');
      return true;
    },
  );
  assert.equal(addCalled, false);

  const result = await service.addAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: {
      code: 'A-004',
      rfidCode: 'RFID-ASSET-004',
      name: 'Bed 1',
      typeId: 'type-bed',
      locationRoomId: 'room-1',
      locationKeyId: 'key-1',
      quantity: '1',
      status: 'Good',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(addCalled, true);
});

test('assets page service emits accommodation refresh when Bed key links change', async () => {
  const emitted = [];
  const service = createAssetsPageService({
    realtime: {
      emitAssetsChanged: (campId) => emitted.push(['assets', campId]),
      emitAccommodationChanged: (campId, payload) =>
        emitted.push(['accommodation', campId, payload]),
    },
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetByCode: async () => null,
      findAssetByRfid: async () => null,
      findAssetById: async ({ assetId }) => ({
        id: assetId,
        code: 'BED-001',
        rfidCode: 'RFID-BED-001',
        name: 'Bed 1',
        typeId: 'type-bed',
        typeName: 'Bed',
        locationRoomId: 'room-1',
        locationKeyId: 'key-1',
        quantity: '1',
        status: 'Good',
        isQuantitative: false,
      }),
      listAssetTypesByCamp: async () => [{ id: 'type-bed', name: 'Bed' }],
      addAsset: async ({ payload }) => ({ id: 'asset-1', ...payload }),
      editAsset: async ({ assetId, payload }) => ({ id: assetId, ...payload }),
      deleteAsset: async ({ assetId }) => ({ id: assetId }),
    },
  });

  await service.addAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: {
      code: 'BED-002',
      rfidCode: 'RFID-BED-002',
      name: 'Bed 2',
      typeId: 'type-bed',
      locationRoomId: 'room-1',
      locationKeyId: 'key-2',
      quantity: '1',
      status: 'Good',
    },
  });
  await service.editAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    assetId: 'asset-1',
    payload: {
      code: 'BED-001',
      rfidCode: 'RFID-BED-001',
      name: 'Bed 1',
      typeId: 'type-bed',
      locationRoomId: 'room-1',
      locationKeyId: 'key-3',
      quantity: '1',
      status: 'Good',
    },
  });
  await service.deleteAsset({
    actorUserId: 'user-1',
    campId: 'camp-1',
    assetId: 'asset-1',
  });

  assert.deepEqual(emitted, [
    ['assets', 'camp-1'],
    ['accommodation', 'camp-1', { source: 'assets' }],
    ['assets', 'camp-1'],
    ['accommodation', 'camp-1', { source: 'assets' }],
    ['assets', 'camp-1'],
    ['accommodation', 'camp-1', { source: 'assets' }],
  ]);
});

test('assets data includes room and key lookup metadata', async () => {
  const emptyTable = () => ({
    rows: [],
    total: 0,
    sourceTotal: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const service = createAssetsPageService({
    repository: {
      getAssetSummary: async () => ({
        totalAssets: 0,
        totalQuantity: '0',
        notFoundAssets: 0,
        completedAssets: 0,
        typeCount: 1,
      }),
      listAssetsTable: async () => emptyTable(),
      listNotFoundAssetsTable: async () => emptyTable(),
      listInventoryStatusTable: async () => emptyTable(),
      listAssetTypesTable: async () => emptyTable(),
      listInventoryEventsTable: async () => emptyTable(),
      listAssetTypesByCamp: async () => [{ id: 'type-bed', name: 'Bed' }],
      listRoomsByCamp: async () => [
        {
          id: 'room-1',
          name: '101',
          buildingName: 'Alpha',
          buildingType: 'Accommodation',
        },
      ],
      listKeysByCamp: async () => [
        {
          id: 'key-1',
          name: '101-A',
          roomId: 'room-1',
          roomName: '101',
          buildingName: 'Alpha',
          status: 'Occupied',
        },
      ],
    },
  });

  const result = await service.getAssetsData({ campId: 'camp-1' });

  assert.equal(result.lookups.rooms[0].meta, 'Alpha | Accommodation');
  assert.equal(result.lookups.keys[0].meta, 'Alpha | 101 | Occupied');
  assert.equal(result.lookups.assetTypes[0].isProtected, true);
});

test('assets page service manages asset types and protects Bed', async () => {
  const calls = [];
  const emitted = [];
  const service = createAssetsPageService({
    realtime: {
      emitAssetsChanged: (campId) => emitted.push(campId),
    },
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetTypeByName: async ({ name }) => (name === 'Existing' ? { id: 'type-existing', name } : null),
      findAssetTypeById: async ({ typeId }) =>
        typeId === 'type-bed' ? { id: typeId, name: 'Bed' } : { id: typeId, name: 'Chair' },
      addAssetType: async ({ name }) => {
        calls.push(['add', name]);
        return { id: 'type-new', name, assetCount: 0 };
      },
      editAssetType: async ({ typeId, name }) => {
        calls.push(['edit', typeId, name]);
        return { id: typeId, name, assetCount: 0 };
      },
      deleteAssetType: async ({ typeId }) => {
        calls.push(['delete', typeId]);
        return { id: typeId, name: 'Chair XL' };
      },
    },
  });

  const addResult = await service.addAssetType({ actorUserId: 'user-1', name: 'Table' });
  const editResult = await service.editAssetType({
    actorUserId: 'user-1',
    typeId: 'type-chair',
    name: 'Chair XL',
  });
  const deleteResult = await service.deleteAssetType({
    actorUserId: 'user-1',
    typeId: 'type-chair',
  });

  assert.equal(addResult.body.type.name, 'Table');
  assert.equal(editResult.body.type.name, 'Chair XL');
  assert.equal(deleteResult.status, 200);
  assert.deepEqual(calls, [
    ['add', 'Table'],
    ['edit', 'type-chair', 'Chair XL'],
    ['delete', 'type-chair'],
  ]);
  assert.deepEqual(emitted, [undefined, undefined, undefined]);
  await assert.rejects(
    () => service.editAssetType({ actorUserId: 'user-1', typeId: 'type-bed', name: 'Bunk' }),
    (error) => {
      assert.equal(error.code, 'ASSET_TYPE_PROTECTED');
      return true;
    },
  );
});

test('assets page service manages clean items between warehouses', async () => {
  const emitted = [];
  const calls = [];
  const service = createAssetsPageService({
    realtime: {
      emitAssetsChanged: (campId) => emitted.push(campId),
    },
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findCleanItemByNameAndWarehouse: async () => null,
      findCleanItemById: async () => ({
        id: 'item-1',
        itemName: 'Towel',
        totalAmount: 10,
        countGetItem: 2,
        availableAmount: 8,
        warehouse: 'large',
      }),
      addCleanItem: async ({ payload }) => {
        calls.push(['add', payload]);
        return { id: 'item-1', ...payload };
      },
      moveCleanItem: async ({ warehouse, quantity }) => {
        calls.push(['move', warehouse, quantity]);
        return {
          id: 'item-1',
          itemName: 'Towel',
          totalAmount: 10,
          countGetItem: 5,
          warehouse: 'large',
        };
      },
      editCleanItem: async ({ itemId, payload }) => {
        calls.push(['edit', itemId, payload.itemName]);
        return { id: itemId, ...payload };
      },
      deleteCleanItem: async ({ itemId }) => {
        calls.push(['delete', itemId]);
        return { id: itemId };
      },
    },
  });

  const addResult = await service.addCleanItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    payload: { itemName: 'Towel', totalAmount: 10, countGetItem: 2, warehouse: 'large' },
  });
  const moveResult = await service.moveCleanItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    itemId: 'item-1',
    warehouse: 'small',
    quantity: 3,
  });
  const editResult = await service.editCleanItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    itemId: 'item-1',
    payload: { itemName: 'Towel XL', totalAmount: 12, countGetItem: 3, warehouse: 'small' },
  });
  const deleteResult = await service.deleteCleanItem({
    actorUserId: 'user-1',
    campId: 'camp-1',
    itemId: 'item-1',
  });

  assert.equal(addResult.body.item.availableAmount, 10);
  assert.equal(moveResult.body.item.availableAmount, 5);
  assert.equal(editResult.body.item.availableAmount, 12);
  assert.equal(deleteResult.status, 200);
  assert.deepEqual(emitted, ['camp-1', 'camp-1', 'camp-1', 'camp-1']);
  assert.equal(calls[0][0], 'add');
  assert.deepEqual(calls[1], ['move', 'small', 3]);
  assert.deepEqual(calls[2], ['edit', 'item-1', 'Towel XL']);
  assert.deepEqual(calls[3], ['delete', 'item-1']);
});

test('assets page service calculates clean item checked out from quantity edits', async () => {
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findCleanItemByNameAndWarehouse: async () => null,
      findCleanItemById: async ({ itemId }) =>
        itemId === 'small-item'
          ? {
              id: itemId,
              itemName: 'Towel',
              totalAmount: 5,
              countGetItem: 1,
              availableAmount: 4,
              warehouse: 'small',
            }
          : {
              id: itemId,
              itemName: 'Towel',
              totalAmount: 10,
              countGetItem: 3,
              availableAmount: 7,
              warehouse: 'large',
            },
      editCleanItem: async ({ itemId, payload }) => ({ id: itemId, ...payload }),
    },
  });

  await assert.rejects(
    () =>
      service.editCleanItem({
        actorUserId: 'user-1',
        campId: 'camp-1',
        itemId: 'large-item',
        payload: { itemName: 'Towel', totalAmount: 6 },
      }),
    (error) => {
      assert.equal(error.code, 'INVALID_CLEAN_ITEM_AMOUNT');
      assert.match(error.message, /Large warehouse quantity can only be increased/);
      return true;
    },
  );

  await assert.rejects(
    () =>
      service.editCleanItem({
        actorUserId: 'user-1',
        campId: 'camp-1',
        itemId: 'small-item',
        payload: { itemName: 'Towel', totalAmount: 5 },
      }),
    (error) => {
      assert.equal(error.code, 'INVALID_CLEAN_ITEM_AMOUNT');
      assert.match(error.message, /Small warehouse quantity can only be reduced/);
      return true;
    },
  );
});

async function buildWorkbookBuffer({ worksheetName, headers, row }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(worksheetName);
  sheet.columns = headers.map((header) => ({ header, key: header.replace(/\s+/g, '_') }));
  sheet.addRow(row);
  return workbook.xlsx.writeBuffer();
}

test('assets page service downloads and imports asset type templates', async () => {
  const calls = [];
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findAssetTypeByName: async () => null,
      findAssetTypeById: async () => null,
      bulkUpsertAssetTypes: async ({ rows }) => {
        calls.push(rows);
        return rows.map(() => ({ action: 'added' }));
      },
    },
  });

  const template = await service.downloadAssetTypeTemplate({ actorUserId: 'user-1' });
  const fileBuffer = await buildWorkbookBuffer({
    worksheetName: 'Asset Types',
    headers: ['identifier', 'name'],
    row: ['', 'Mattress'],
  });
  const result = await service.importAssetTypes({
    actorUserId: 'user-1',
    fileBuffer,
    fileName: ASSET_TYPE_TEMPLATE_FILENAME,
  });

  assert.equal(template.fileName, ASSET_TYPE_TEMPLATE_FILENAME);
  assert.equal(result.body.summary.addedCount, 1);
  assert.equal(calls[0][0].name, 'Mattress');
});

test('assets page service downloads and imports clean item templates', async () => {
  const calls = [];
  const service = createAssetsPageService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName !== 'Full permission',
      findCleanItemByNameAndWarehouse: async () => null,
      bulkUpsertCleanItems: async ({ rows }) => {
        calls.push(rows);
        return rows.map(() => ({ action: 'updated' }));
      },
    },
  });

  const template = await service.downloadCleanItemTemplate({ actorUserId: 'user-1' });
  const fileBuffer = await buildWorkbookBuffer({
    worksheetName: 'Clean Items',
    headers: ['identifier', 'item name', 'total amount'],
    row: ['', 'Towel', 120],
  });
  const result = await service.importCleanItems({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fileBuffer,
    fileName: CLEAN_ITEM_TEMPLATE_FILENAME,
  });

  assert.equal(template.fileName, CLEAN_ITEM_TEMPLATE_FILENAME);
  assert.equal(result.body.summary.updatedCount, 1);
  assert.equal(calls[0][0].itemName, 'Towel');
  assert.equal(calls[0][0].countGetItem, 0);
  assert.equal(calls[0][0].warehouse, 'large');
});
