const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const {
  createCampService,
} = require('../../../../src/modules/web/main-page/application/services/camp.service');

async function buildWorkbookBuffer(rows, headers = ['Camp ID', 'Camp Name']) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Camps');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

test('camp service generates a reusable xlsx template for imports', async () => {
  const service = createCampService({
    permissionRepository: { userHasPermission: async () => true },
    repository: {},
    realtime: {},
    auditLog: () => {},
  });

  const result = await service.downloadCampTemplate();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);

  assert.equal(result.status, 200);
  assert.equal(result.fileName, 'camp-template.xlsx');
  assert.equal(workbook.getWorksheet('Instructions').getCell('A1').text.length > 0, true);
  assert.deepEqual(workbook.getWorksheet('Camps').getRow(1).values.slice(1, 3), [
    'Camp ID',
    'Camp Name',
  ]);
});

test('camp service imports add and edit rows from a valid template and emits progress', async () => {
  const actorUserId = '11111111-1111-1111-1111-111111111111';
  const existingCampId = '22222222-2222-4222-8222-222222222222';
  const added = [];
  const edited = [];
  const progressEvents = [];

  const service = createCampService({
    permissionRepository: {
      userHasPermission: async (_userId, permissionName) =>
        ['Full permission', 'Add camp', 'Edit camp'].includes(permissionName),
    },
    repository: {
      addCamp: async ({ campName }) => {
        added.push(campName);
        return { id: '33333333-3333-4333-8333-333333333333', name: campName };
      },
      editCamp: async ({ campId, campName }) => {
        edited.push({ campId, campName });
        return { id: campId, name: campName };
      },
      findCampById: async (campId) =>
        String(campId) === existingCampId
          ? { id: existingCampId, name: 'Camp Legacy', created_at: '2024-01-01T00:00:00.000Z' }
          : null,
      findCampByName: async () => null,
      getCampDependencySummary: async () => ({}),
      deleteCamp: async () => ({}),
    },
    realtime: {
      emitCampAdded: () => progressEvents.push({ type: 'refresh' }),
      emitCampImportProgress: (_userId, payload) =>
        progressEvents.push({ type: 'progress', payload }),
    },
    auditLog: () => {},
  });

  const buffer = await buildWorkbookBuffer([
    ['', 'Camp North'],
    [existingCampId, 'Camp Modernized'],
  ]);

  const result = await service.importCamps({
    actorUserId,
    fileBuffer: buffer,
    fileName: 'camp-template.xlsx',
    requestMeta: { ip: '127.0.0.1' },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(added, ['Camp North']);
  assert.deepEqual(edited, [{ campId: existingCampId, campName: 'Camp Modernized' }]);
  assert.equal(result.body.summary.addedCount, 1);
  assert.equal(result.body.summary.updatedCount, 1);
  assert.equal(result.body.summary.errorCount, 0);
  assert.equal(
    progressEvents.some(
      (event) => event.type === 'progress' && event.payload.stage === 'completed',
    ),
    true,
  );
});

test('camp service returns validation feedback when every imported row fails', async () => {
  const actorUserId = '11111111-1111-1111-1111-111111111111';
  const service = createCampService({
    permissionRepository: {
      userHasPermission: async (_userId, permissionName) =>
        ['Full permission', 'Add camp'].includes(permissionName),
    },
    repository: {
      addCamp: async () => {
        throw new Error('should not be called');
      },
      editCamp: async () => {
        throw new Error('should not be called');
      },
      findCampById: async () => null,
      findCampByName: async () => ({
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Camp Existing',
      }),
      getCampDependencySummary: async () => ({}),
      deleteCamp: async () => ({}),
    },
    realtime: {
      emitCampAdded: () => {},
      emitCampImportProgress: () => {},
    },
    auditLog: () => {},
  });

  const buffer = await buildWorkbookBuffer([['', 'Camp Existing']]);
  const result = await service.importCamps({
    actorUserId,
    fileBuffer: buffer,
    fileName: 'camp-template.xlsx',
    requestMeta: {},
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.summary.addedCount, 0);
  assert.equal(result.body.summary.updatedCount, 0);
  assert.equal(result.body.summary.errorCount, 1);
  assert.match(result.body.summary.errors[0].message, /already exists/i);
});

test('camp service rejects templates with invalid headers', async () => {
  const actorUserId = '11111111-1111-1111-1111-111111111111';
  const service = createCampService({
    permissionRepository: {
      userHasPermission: async (_userId, permissionName) =>
        ['Full permission', 'Add camp'].includes(permissionName),
    },
    repository: {
      addCamp: async () => ({}),
      editCamp: async () => ({}),
      findCampById: async () => null,
      findCampByName: async () => null,
      getCampDependencySummary: async () => ({}),
      deleteCamp: async () => ({}),
    },
    realtime: {
      emitCampAdded: () => {},
      emitCampImportProgress: () => {},
    },
    auditLog: () => {},
  });

  const buffer = await buildWorkbookBuffer([['', 'Camp North']], ['Wrong ID', 'Wrong Name']);

  await assert.rejects(
    () =>
      service.importCamps({
        actorUserId,
        fileBuffer: buffer,
        fileName: 'camp-template.xlsx',
        requestMeta: {},
      }),
    (error) => {
      assert.equal(error.code, 'INVALID_CAMP_TEMPLATE');
      return true;
    },
  );
});

test('camp service clears the current camp session when deleting the selected camp', async () => {
  const calls = [];
  const campId = '22222222-2222-4222-8222-222222222222';
  const service = createCampService({
    permissionRepository: { userHasPermission: async () => true },
    repository: {
      getCampDependencySummary: async () => ({}),
      deleteCamp: async (payload) => calls.push({ type: 'delete', payload }),
    },
    realtime: {
      emitCampDeleted: (deletedCampId) => calls.push({ type: 'realtime', campId: deletedCampId }),
    },
    auditLog: () => {},
  });

  const result = await service.removeCamp({
    actorUserId: '11111111-1111-1111-1111-111111111111',
    campId,
    currentCampId: campId,
    mainSession: {
      clearCurrentCamp: () => calls.push({ type: 'clear' }),
      save: async () => calls.push({ type: 'save' }),
    },
    requestMeta: {},
  });

  assert.equal(result.status, 200);
  assert.deepEqual(calls, [
    { type: 'delete', payload: { actorUserId: '11111111-1111-1111-1111-111111111111', campId } },
    { type: 'clear' },
    { type: 'save' },
    { type: 'realtime', campId },
  ]);
});
