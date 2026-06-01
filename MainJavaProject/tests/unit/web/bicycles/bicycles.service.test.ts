const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const {
  createBicyclesService,
} = require('../../../../src/modules/web/bicycles/application/services/bicycles.service');

async function buildBicycleImportBuffer(rows = []) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bicycles');
  sheet.columns = [
    { header: 'Identifier', key: 'identifier' },
    { header: 'Bicycle Name', key: 'name' },
    { header: 'NFC Code', key: 'nfcCode' },
    { header: 'Status', key: 'status' },
    { header: 'Soldier', key: 'soldier' },
    { header: 'Helmet', key: 'helmet' },
    { header: 'Rental Date and Time', key: 'rentedAt' },
  ];
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

test('bicycles service summarizes inventory for the active camp', async () => {
  const service = createBicyclesService({
    repository: {
      findOverviewByCamp: async () => [
        {
          id: 'bike-1',
          name: 'Bike 1',
          nfcCode: 'NFC-1',
          status: 'available',
          assignedSoldier: null,
          assignedSoldierId: null,
          helmetCode: null,
          helmetId: null,
          assignmentId: null,
          rentedAt: null,
        },
        {
          id: 'bike-2',
          name: 'Bike 2',
          nfcCode: 'NFC-2',
          status: 'late',
          assignedSoldier: 'Soldier Two',
          assignedSoldierId: 'soldier-2',
          helmetCode: 'H-22',
          helmetId: 'helmet-22',
          assignmentId: 'assignment-2',
          rentedAt: '2030-01-01T12:00:00.000Z',
        },
        {
          id: 'bike-3',
          name: 'Bike 3',
          nfcCode: 'NFC-3',
          status: 'long_term',
          assignedSoldier: 'Soldier Three',
          assignedSoldierId: 'soldier-3',
          helmetCode: 'H-23',
          helmetId: 'helmet-23',
          assignmentId: 'assignment-3',
          rentedAt: '2030-01-02T12:00:00.000Z',
        },
      ],
      listUserPermissions: async () => [],
    },
  });

  const result = await service.getBicyclesOverview({ campId: 'camp-1' });

  assert.equal(result.status, 200);
  assert.equal(result.body.available, 1);
  assert.equal(result.body.rented, 0);
  assert.equal(result.body.repair, 0);
  assert.equal(result.body.late, 1);
  assert.equal(result.body.longTerm, 1);
  assert.deepEqual(
    result.body.rows.map((row) => row.id),
    ['bike-1', 'bike-2', 'bike-3'],
  );
  assert.equal(result.body.tables.bicycles.total, 3);
  assert.equal(result.body.lookups.rows.length, 3);
  assert.equal(result.body.helmetPairingCount, 2);
});

test('bicycles service returns an empty overview when no camp is selected', async () => {
  const service = createBicyclesService({
    repository: {
      findOverviewByCamp: async () => {
        throw new Error('repository should not be called without a camp');
      },
      listUserPermissions: async () => [],
    },
  });

  const result = await service.getBicyclesOverview({ campId: null });

  assert.deepEqual(result, {
    status: 200,
    body: {
      available: 0,
      rented: 0,
      repair: 0,
      late: 0,
      longTerm: 0,
      rows: [],
    },
  });
});

test('bicycles service applies bike table search sort and pagination on the server result', async () => {
  const service = createBicyclesService({
    repository: {
      findOverviewByCamp: async () => [
        { id: 'bike-1', name: 'Alpha Bike', nfcCode: 'NFC-1', status: 'available' },
        { id: 'bike-2', name: 'Bravo Bike', nfcCode: 'NFC-2', status: 'available' },
        { id: 'bike-3', name: 'Alpha Cargo', nfcCode: 'NFC-3', status: 'repair' },
      ],
      listHelmetsByCamp: async () => [],
    },
  });

  const result = await service.getBicyclesOverview({
    campId: 'camp-1',
    tableState: {
      bicycle: {
        page: 1,
        limit: 1,
        filters: { name: 'alpha' },
        sortColumn: 'name',
        sortDirection: 'desc',
      },
    },
  });

  assert.deepEqual(
    result.body.rows.map((row) => row.name),
    ['Alpha Cargo'],
  );
  assert.equal(result.body.tables.bicycles.total, 2);
  assert.equal(result.body.tables.bicycles.sourceTotal, 3);
  assert.equal(result.body.tables.bicycles.totalPages, 2);
  assert.equal(result.body.lookups.rows.length, 3);
});

test('bicycles service searches report asset and soldier lookup options on the server result', async () => {
  const service = createBicyclesService({
    repository: {
      listHelmetsByCamp: async () => [
        { id: 'helmet-1', code: 'Alpha Helmet', nfcCode: 'NFC-H1' },
        { id: 'helmet-2', code: 'Bravo Helmet', nfcCode: 'NFC-H2' },
      ],
      findOverviewByCamp: async () => [
        {
          id: 'bike-1',
          name: 'Bike 1',
          assignedSoldierId: 'soldier-2',
          assignedSoldier: 'Bravo Soldier',
        },
        {
          id: 'bike-2',
          name: 'Bike 2',
          assignedSoldierId: 'soldier-1',
          assignedSoldier: 'Alpha Soldier',
        },
      ],
    },
  });

  const assets = await service.listReportAssets({
    campId: 'camp-1',
    assetType: 'helmet',
    search: 'bravo',
  });
  const soldiers = await service.listReportSoldiers({
    campId: 'camp-1',
    search: 'soldier',
    limit: 1,
  });

  assert.equal(assets.status, 200);
  assert.deepEqual(
    assets.body.assets.map((row) => row.id),
    ['helmet-2'],
  );
  assert.equal(soldiers.status, 200);
  assert.deepEqual(
    soldiers.body.soldiers.map((row) => row.id),
    ['soldier-1'],
  );
});

test('bicycles service adds helmets with NFC using helmet-specific permission', async () => {
  let addPayload = null;
  const service = createBicyclesService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Add helmet',
      findHelmetByCode: async () => null,
      findHelmetByNfcCode: async () => null,
      addHelmet: async (payload) => {
        addPayload = payload;
        return {
          id: 'helmet-1',
          code: payload.code,
          nfcCode: payload.nfcCode,
        };
      },
    },
  });

  const result = await service.addHelmet({
    actorUserId: 'user-1',
    campId: 'camp-1',
    code: 'H-1',
    nfcCode: 'NFC-H-1',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.helmet.nfcCode, 'NFC-H-1');
  assert.deepEqual(addPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    code: 'H-1',
    nfcCode: 'NFC-H-1',
  });
});

test('bicycles service lets bike editors lookup helmets for the bicycle being edited', async () => {
  let lookupPayload = null;
  const identifier = '11111111-1111-4111-8111-111111111111';
  const service = createBicyclesService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit bike',
      listAvailableHelmets: async (payload) => {
        lookupPayload = payload;
        return [{ id: 'helmet-1', code: 'H-1', nfcCode: 'NFC-H-1' }];
      },
    },
  });

  const result = await service.listAvailableHelmets({
    actorUserId: 'user-1',
    campId: 'camp-1',
    search: 'H',
    limit: 10,
    identifier,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.helmets, [{ id: 'helmet-1', code: 'H-1', nfcCode: 'NFC-H-1' }]);
  assert.deepEqual(lookupPayload, {
    campId: 'camp-1',
    search: 'H',
    limit: 10,
    identifier,
  });
});

test('bicycles service marks overdue rented bicycles late before loading overview', async () => {
  const markedLateCalls = [];
  const emittedStatusChanges = [];
  const service = createBicyclesService({
    repository: {
      markOverdueRentalsLate: async (payload) => {
        markedLateCalls.push(payload);
        return ['bike-2', 'bike-2', 'bike-3'];
      },
      findOverviewByCamp: async () => [
        {
          id: 'bike-2',
          name: 'Bike 2',
          nfcCode: 'NFC-2',
          status: 'late',
          assignedSoldier: 'Soldier Two',
          assignedSoldierId: 'soldier-2',
          helmetCode: null,
          helmetId: null,
          assignmentId: 'assignment-2',
          rentedAt: '2030-01-01T12:00:00.000Z',
        },
      ],
    },
    realtime: {
      emitBicycleStatusChanged(identifier) {
        emittedStatusChanges.push(identifier);
      },
    },
  });

  const result = await service.getBicyclesOverview({ campId: 'camp-1' });

  assert.deepEqual(markedLateCalls, [{ campId: 'camp-1' }]);
  assert.deepEqual(emittedStatusChanges, ['bike-2', 'bike-3']);
  assert.equal(result.body.late, 1);
  assert.equal(result.body.rows[0].status, 'late');
});

test('bicycles service marks an available bicycle for repair without soldier or helmet fields', async () => {
  let repairPayload = null;
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findBicycleById: async () => ({
        id: 'bike-1',
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'available',
      }),
      findSoldierById: async () => {
        throw new Error('soldier lookup should be skipped for repair');
      },
      findHelmetById: async () => {
        throw new Error('helmet lookup should be skipped for repair');
      },
      findActiveAssignment: async () => null,
      helmetHasActiveAssignment: async () => false,
      markBicycleRepair: async (payload) => {
        repairPayload = payload;
        return {
          id: payload.identifier,
          name: 'Bike 1',
          status: 'repair',
        };
      },
    },
  });

  const rentedAt = new Date(Date.now() - 60_000).toISOString();
  const result = await service.rentBicycle({
    actorUserId: 'user-1',
    campId: 'camp-1',
    identifier: 'bike-1',
    rentedAt,
    repair: true,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Bicycle marked for repair.');
  assert.deepEqual(repairPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    identifier: 'bike-1',
    markedAt: new Date(rentedAt),
  });
});

test('bicycles service returns a repair bicycle with an active repair assignment', async () => {
  let returnPayload = null;
  const rentedAt = new Date(Date.now() - 60_000).toISOString();
  const returnedAt = new Date().toISOString();
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findBicycleById: async () => ({
        id: 'bike-1',
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'repair',
      }),
      findActiveAssignment: async () => ({
        id: 'assignment-1',
        identifier: 'bike-1',
        soldierId: null,
        helmetId: null,
        rentedAt,
        status: 'repair',
      }),
      returnBicycle: async (payload) => {
        returnPayload = payload;
        return { id: 'assignment-1', status: 'repair' };
      },
    },
  });

  const result = await service.returnBicycle({
    actorUserId: 'user-1',
    campId: 'camp-1',
    identifier: 'bike-1',
    returnedAt,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Bicycle returned successfully.');
  assert.deepEqual(returnPayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    identifier: 'bike-1',
    returnedAt: new Date(returnedAt),
  });
});

test('bicycles service edits active assignment fields for unavailable bicycles', async () => {
  let editPayload = null;
  let helmetCheckPayload = null;
  const rentedAt = new Date(Date.now() - 60_000).toISOString();
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findBicycleById: async () => ({
        id: 'bike-1',
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'rented',
      }),
      findBicycleByName: async () => null,
      findBicycleByNfcCode: async () => null,
      findActiveAssignment: async () => ({
        id: 'assignment-1',
        identifier: 'bike-1',
        soldierId: 'soldier-1',
        helmetId: 'helmet-1',
        rentedAt,
        status: 'rented',
      }),
      findSoldierById: async ({ soldierId }) =>
        soldierId === 'soldier-2' ? { id: soldierId, name: 'Soldier Two' } : null,
      findHelmetById: async ({ helmetId }) =>
        helmetId === 'helmet-2' ? { id: helmetId, code: 'H-2' } : null,
      helmetHasActiveAssignment: async (payload) => {
        helmetCheckPayload = payload;
        return false;
      },
      editBicycle: async (payload) => {
        editPayload = payload;
        return { id: 'bike-1', name: payload.name, nfcCode: payload.nfcCode };
      },
    },
  });

  const result = await service.editBicycle({
    actorUserId: 'user-1',
    campId: 'camp-1',
    identifier: 'bike-1',
    name: 'Bike 1A',
    nfcCode: 'NFC-1A',
    status: 'long_term',
    soldierId: 'soldier-2',
    helmetId: 'helmet-2',
    rentedAt,
  });

  assert.equal(result.status, 200);
  assert.equal(editPayload.assignment.assignmentId, 'assignment-1');
  assert.equal(editPayload.assignment.status, 'long_term');
  assert.equal(editPayload.assignment.soldierId, 'soldier-2');
  assert.equal(editPayload.assignment.helmetId, 'helmet-2');
  assert.deepEqual(helmetCheckPayload, {
    helmetId: 'helmet-2',
    excludeAssignmentId: 'assignment-1',
  });
});

test('bicycles service imports assignment changes for existing rented bicycles', async () => {
  let editPayload = null;
  const identifier = '11111111-1111-4111-8111-111111111111';
  const assignmentId = '22222222-2222-4222-8222-222222222222';
  const soldierId = '33333333-3333-4333-8333-333333333333';
  const helmetId = '44444444-4444-4444-8444-444444444444';
  const rentedAt = new Date(Date.now() - 60_000).toISOString();
  const fileBuffer = await buildBicycleImportBuffer([
    {
      identifier,
      name: 'Bike 1',
      nfcCode: 'NFC-1',
      status: 'Long term',
      soldier: 'Soldier One',
      helmet: 'H-1',
      rentedAt,
    },
  ]);
  const service = createBicyclesService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit bike',
      findBicycleById: async () => ({
        id: identifier,
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'rented',
      }),
      findBicycleByName: async () => null,
      findBicycleByNfcCode: async () => null,
      findActiveAssignment: async () => ({
        id: assignmentId,
        identifier,
        soldierId: '55555555-5555-4555-8555-555555555555',
        helmetId: null,
        rentedAt,
        status: 'rented',
      }),
      findSoldierByName: async ({ name }) =>
        name === 'Soldier One' ? { id: soldierId, name } : null,
      findSoldierById: async () => null,
      findHelmetByCode: async ({ code }) => (code === 'H-1' ? { id: helmetId, code } : null),
      findHelmetById: async () => null,
      findHelmetByNfcCode: async () => null,
      helmetHasActiveAssignment: async () => false,
      editBicycle: async (payload) => {
        editPayload = payload;
        return { id: identifier, name: payload.name, nfcCode: payload.nfcCode };
      },
    },
  });

  const result = await service.importBicycles({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fileBuffer,
    fileName: 'bicycles.xlsx',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.summary.updatedCount, 1);
  assert.equal(editPayload.assignment.assignmentId, assignmentId);
  assert.equal(editPayload.assignment.status, 'long_term');
  assert.equal(editPayload.assignment.soldierId, soldierId);
  assert.equal(editPayload.assignment.helmetId, helmetId);
  assert.deepEqual(editPayload.assignment.rentedAt, new Date(rentedAt));
});

test('bicycles service imports template rental date text as Europe Sofia local time', async () => {
  let editPayload = null;
  const identifier = '11111111-1111-4111-8111-111111111111';
  const assignmentId = '22222222-2222-4222-8222-222222222222';
  const soldierId = '33333333-3333-4333-8333-333333333333';
  const fileBuffer = await buildBicycleImportBuffer([
    {
      identifier,
      name: 'Bike 1',
      nfcCode: 'NFC-1',
      rentedAt: '5/18/2026 1:52:00 PM',
    },
  ]);
  const service = createBicyclesService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit bike',
      findBicycleById: async () => ({
        id: identifier,
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'rented',
      }),
      findBicycleByName: async () => null,
      findBicycleByNfcCode: async () => null,
      findActiveAssignment: async () => ({
        id: assignmentId,
        identifier,
        soldierId,
        helmetId: null,
        rentedAt: '2026-05-18T09:00:00.000Z',
        status: 'rented',
      }),
      helmetHasActiveAssignment: async () => false,
      editBicycle: async (payload) => {
        editPayload = payload;
        return { id: identifier, name: payload.name, nfcCode: payload.nfcCode };
      },
    },
  });

  const result = await service.importBicycles({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fileBuffer,
    fileName: 'bicycles.xlsx',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.summary.updatedCount, 1);
  assert.equal(editPayload.assignment.rentedAt.toISOString(), '2026-05-18T10:52:00.000Z');
});

test('bicycles service imports Excel date cells as Europe Sofia local time', async () => {
  let editPayload = null;
  const identifier = '11111111-1111-4111-8111-111111111111';
  const assignmentId = '22222222-2222-4222-8222-222222222222';
  const soldierId = '33333333-3333-4333-8333-333333333333';
  const fileBuffer = await buildBicycleImportBuffer([
    {
      identifier,
      name: 'Bike 1',
      nfcCode: 'NFC-1',
      rentedAt: new Date(Date.UTC(2026, 4, 18, 13, 52, 0)),
    },
  ]);
  const service = createBicyclesService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit bike',
      findBicycleById: async () => ({
        id: identifier,
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'rented',
      }),
      findBicycleByName: async () => null,
      findBicycleByNfcCode: async () => null,
      findActiveAssignment: async () => ({
        id: assignmentId,
        identifier,
        soldierId,
        helmetId: null,
        rentedAt: '2026-05-18T09:00:00.000Z',
        status: 'rented',
      }),
      helmetHasActiveAssignment: async () => false,
      editBicycle: async (payload) => {
        editPayload = payload;
        return { id: identifier, name: payload.name, nfcCode: payload.nfcCode };
      },
    },
  });

  const result = await service.importBicycles({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fileBuffer,
    fileName: 'bicycles.xlsx',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.summary.updatedCount, 1);
  assert.equal(editPayload.assignment.rentedAt.toISOString(), '2026-05-18T10:52:00.000Z');
});

test('bicycles service rejects imported assignment changes for available bicycles', async () => {
  const identifier = '11111111-1111-4111-8111-111111111111';
  const fileBuffer = await buildBicycleImportBuffer([
    {
      identifier,
      name: 'Bike 1',
      nfcCode: 'NFC-1',
      status: 'Rented',
    },
  ]);
  const service = createBicyclesService({
    repository: {
      userHasPermission: async (_userId, permissionName) => permissionName === 'Edit bike',
      findBicycleById: async () => ({
        id: identifier,
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'available',
      }),
      findBicycleByName: async () => null,
      findBicycleByNfcCode: async () => null,
      editBicycle: async () => {
        throw new Error('available bike assignment changes should not be saved');
      },
    },
  });

  const result = await service.importBicycles({
    actorUserId: 'user-1',
    campId: 'camp-1',
    fileBuffer,
    fileName: 'bicycles.xlsx',
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.summary.errorCount, 1);
  assert.match(result.body.summary.errors[0].message, /only be bulk updated for rented bikes/);
});

test('bicycles service rejects assignment edits for available bicycles', async () => {
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findBicycleById: async () => ({
        id: 'bike-1',
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'available',
      }),
      findBicycleByName: async () => null,
      findBicycleByNfcCode: async () => null,
    },
  });

  await assert.rejects(
    () =>
      service.editBicycle({
        actorUserId: 'user-1',
        campId: 'camp-1',
        identifier: 'bike-1',
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'rented',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'BICYCLE_ASSIGNMENT_EDIT_NOT_ALLOWED');
      return true;
    },
  );
});

test('bicycles service deletes available bicycles with assignment history', async () => {
  let deletePayload = null;
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findBicycleById: async () => ({
        id: 'bike-1',
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'available',
      }),
      findActiveAssignment: async () => null,
      hasAssignmentHistory: async () => true,
      deleteBicycle: async (payload) => {
        deletePayload = payload;
        return { id: payload.identifier };
      },
    },
  });

  const result = await service.deleteBicycle({
    actorUserId: 'user-1',
    campId: 'camp-1',
    identifier: 'bike-1',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(deletePayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    identifier: 'bike-1',
  });
});

test('bicycles service blocks deleting bicycles with active assignments', async () => {
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findBicycleById: async () => ({
        id: 'bike-1',
        name: 'Bike 1',
        nfcCode: 'NFC-1',
        status: 'rented',
      }),
      findActiveAssignment: async () => ({ id: 'assignment-1', identifier: 'bike-1' }),
      deleteBicycle: async () => {
        throw new Error('delete should be blocked before repository delete');
      },
    },
  });

  await assert.rejects(
    () =>
      service.deleteBicycle({
        actorUserId: 'user-1',
        campId: 'camp-1',
        identifier: 'bike-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'BICYCLE_DELETE_BLOCKED');
      assert.match(error.message, /active rental or repair assignment/);
      return true;
    },
  );
});

test('bicycles service deletes available helmets with assignment history', async () => {
  let deletePayload = null;
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findHelmetById: async () => ({
        id: 'helmet-1',
        code: 'H-1',
        nfcCode: 'NFC-H-1',
      }),
      helmetHasActiveAssignment: async () => false,
      helmetHasAssignmentHistory: async () => true,
      deleteHelmet: async (payload) => {
        deletePayload = payload;
        return { id: payload.helmetId };
      },
    },
  });

  const result = await service.deleteHelmet({
    actorUserId: 'user-1',
    campId: 'camp-1',
    helmetId: 'helmet-1',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(deletePayload, {
    actorUserId: 'user-1',
    campId: 'camp-1',
    helmetId: 'helmet-1',
  });
});

test('bicycles service blocks deleting helmets with active assignments', async () => {
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findHelmetById: async () => ({
        id: 'helmet-1',
        code: 'H-1',
        nfcCode: 'NFC-H-1',
      }),
      helmetHasActiveAssignment: async () => true,
      deleteHelmet: async () => {
        throw new Error('delete should be blocked before repository delete');
      },
    },
  });

  await assert.rejects(
    () =>
      service.deleteHelmet({
        actorUserId: 'user-1',
        campId: 'camp-1',
        helmetId: 'helmet-1',
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'HELMET_DELETE_BLOCKED');
      assert.match(error.message, /active rental/);
      return true;
    },
  );
});

test('bicycles service rejects rental dates in the future', async () => {
  const service = createBicyclesService({
    repository: {
      userHasPermission: async () => true,
      findBicycleById: async () => {
        throw new Error('bicycle lookup should be skipped for an invalid rental date');
      },
    },
  });

  await assert.rejects(
    () =>
      service.rentBicycle({
        actorUserId: 'user-1',
        campId: 'camp-1',
        identifier: 'bike-1',
        soldierId: 'soldier-1',
        rentedAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    (error) => {
      assert.equal(error.name, 'AppError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'INVALID_BICYCLE_DATE');
      assert.equal(error.message, 'Rental date cannot be in the future.');
      return true;
    },
  );
});

test('bicycles service builds a rental report for the selected date interval', async () => {
  let reportPayload = null;
  const service = createBicyclesService({
    repository: {
      listRentalReport: async (payload) => {
        reportPayload = payload;
        return {
          rows: [
            {
              assignmentId: 'assignment-1',
              identifier: 'bike-1',
              bicycleName: 'Bike 1',
              bicycleNfcCode: 'NFC-B-1',
              soldierId: 'soldier-1',
              soldierName: 'Soldier One',
              soldierCountry: 'BG',
              soldierMealCard: 'M-1',
              helmetId: 'helmet-1',
              helmetCode: 'H-1',
              helmetNfcCode: 'NFC-H-1',
              rentedAt: new Date('2026-04-17T09:15:00.000Z'),
              returnedAt: new Date('2026-04-17T12:15:00.000Z'),
              status: 'rented',
              rentalDate: '2026-04-17',
            },
          ],
          dailyTotals: [{ date: '2026-04-17', rentalCount: 1 }],
        };
      },
    },
  });

  const result = await service.getBicycleRentalReport({
    campId: 'camp-1',
    fromDate: '2026-04-16',
    toDate: '2026-04-18',
  });

  assert.equal(result.status, 200);
  assert.equal(reportPayload.campId, 'camp-1');
  assert.equal(reportPayload.from.toISOString(), '2026-04-16T00:00:00.000Z');
  assert.equal(reportPayload.to.toISOString(), '2026-04-19T00:00:00.000Z');
  assert.deepEqual(result.body.dailyTotals, [
    { date: '2026-04-16', rentalCount: 0 },
    { date: '2026-04-17', rentalCount: 1 },
    { date: '2026-04-18', rentalCount: 0 },
  ]);
  assert.equal(result.body.totalRentals, 1);
  assert.deepEqual(result.body.rows[0], {
    assignmentId: 'assignment-1',
    identifier: 'bike-1',
    bicycleName: 'Bike 1',
    bicycleNfcCode: 'NFC-B-1',
    soldierId: 'soldier-1',
    soldierName: 'Soldier One',
    soldierCountry: 'BG',
    soldierMealCard: 'M-1',
    helmetId: 'helmet-1',
    helmetCode: 'H-1',
    helmetNfcCode: 'NFC-H-1',
    rentedAt: '2026-04-17T09:15:00.000Z',
    returnedAt: '2026-04-17T12:15:00.000Z',
    status: 'rented',
    rentalDate: '2026-04-17',
  });
});

test('bicycles service returns the two most recent rentals for a selected asset', async () => {
  let lookupPayload = null;
  const assetId = '11111111-1111-4111-8111-111111111111';
  const service = createBicyclesService({
    repository: {
      listRecentRentalsByAsset: async (payload) => {
        lookupPayload = payload;
        return [
          {
            assignmentId: 'assignment-2',
            identifier: 'bike-2',
            bicycleName: 'Bike 2',
            bicycleNfcCode: 'NFC-B-2',
            soldierId: 'soldier-2',
            soldierName: 'Soldier Two',
            helmetId: assetId,
            helmetCode: 'H-1',
            helmetNfcCode: 'NFC-H-1',
            rentedAt: new Date('2026-04-18T10:00:00.000Z'),
            returnedAt: null,
            status: 'long_term',
            rentalDate: '2026-04-18',
          },
        ];
      },
    },
  });

  const result = await service.getRecentRentalsByAsset({
    campId: 'camp-1',
    assetType: 'helmet',
    assetId,
    limit: 2,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(lookupPayload, {
    campId: 'camp-1',
    assetType: 'helmet',
    assetId,
    limit: 2,
  });
  assert.equal(result.body.rows.length, 1);
  assert.equal(result.body.rows[0].helmetId, assetId);
  assert.equal(result.body.rows[0].rentedAt, '2026-04-18T10:00:00.000Z');
  assert.equal(result.body.rows[0].status, 'long_term');
});

test('bicycles service returns active bike and helmet assignments for a selected soldier', async () => {
  let lookupPayload = null;
  const soldierId = '22222222-2222-4222-8222-222222222222';
  const service = createBicyclesService({
    repository: {
      listActiveAssignmentsBySoldier: async (payload) => {
        lookupPayload = payload;
        return [
          {
            assignmentId: 'assignment-1',
            identifier: 'bike-1',
            bicycleName: 'Bike 1',
            bicycleNfcCode: 'NFC-B-1',
            soldierId,
            soldierName: 'Soldier One',
            helmetId: 'helmet-1',
            helmetCode: 'H-1',
            helmetNfcCode: 'NFC-H-1',
            rentedAt: '2026-04-17T09:15:00.000Z',
            returnedAt: null,
            status: 'rented',
            rentalDate: '2026-04-17',
          },
        ];
      },
    },
  });

  const result = await service.getActiveAssignmentsBySoldier({
    campId: 'camp-1',
    soldierId,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(lookupPayload, { campId: 'camp-1', soldierId });
  assert.deepEqual(result.body.rows[0], {
    assignmentId: 'assignment-1',
    identifier: 'bike-1',
    bicycleName: 'Bike 1',
    bicycleNfcCode: 'NFC-B-1',
    soldierId,
    soldierName: 'Soldier One',
    soldierCountry: null,
    soldierMealCard: null,
    helmetId: 'helmet-1',
    helmetCode: 'H-1',
    helmetNfcCode: 'NFC-H-1',
    rentedAt: '2026-04-17T09:15:00.000Z',
    returnedAt: null,
    status: 'rented',
    rentalDate: '2026-04-17',
  });
});

test('bicycles service downloads a filtered rental report workbook', async () => {
  const service = createBicyclesService({
    repository: {
      listRentalReport: async () => ({
        rows: [
          {
            assignmentId: 'assignment-1',
            identifier: 'bike-1',
            bicycleName: 'Bike 1',
            bicycleNfcCode: 'NFC-B-1',
            soldierId: 'soldier-1',
            soldierName: 'Soldier One',
            helmetCode: 'H-1',
            helmetNfcCode: 'NFC-H-1',
            rentedAt: '2026-04-17T09:15:00.000Z',
            returnedAt: null,
            status: 'long_term',
            rentalDate: '2026-04-17',
          },
        ],
        dailyTotals: [{ date: '2026-04-17', rentalCount: 1 }],
      }),
    },
  });

  const result = await service.downloadBicycleRentalReport({
    campId: 'camp-1',
    fromDate: '2026-04-17',
    toDate: '2026-04-17',
  });

  assert.equal(result.status, 200);
  assert.equal(
    result.contentType,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  assert.equal(result.fileName, 'bicycle-rental-report-2026-04-17-to-2026-04-17.xlsx');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const totalsSheet = workbook.getWorksheet('Daily totals');
  const historySheet = workbook.getWorksheet('Rental history');
  assert.equal(totalsSheet.getCell('A2').value, '2026-04-17');
  assert.equal(totalsSheet.getCell('B2').value, 1);
  assert.equal(totalsSheet.getCell('A3').value, 'Total rentals in period');
  assert.equal(totalsSheet.getCell('B3').value, 1);
  assert.equal(historySheet.getCell('A1').value, 'Rented At');
  assert.equal(historySheet.getCell('A2').value, '2026-04-17 09:15 AM');
  assert.equal(historySheet.getCell('B2').value, 'No information');
  assert.equal(historySheet.getCell('C2').value, 'Long term');
  assert.equal(historySheet.getCell('D2').value, 'Bike 1');
  assert.equal(historySheet.getCell('G2').value, 'Soldier One');
  assert.equal(historySheet.getCell('I2').value, 'No information');
  assert.equal(historySheet.getCell('J2').value, 'No information');
  assert.equal(historySheet.getCell('K2').value, 'H-1');
  assert.equal(historySheet.getCell('L2').value, 'No information');
});
