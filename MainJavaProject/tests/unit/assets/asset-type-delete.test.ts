const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function loadWithExcelStub(request, parent, isMain) {
  if (request === 'exceljs') {
    return class WorkbookStub {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { createAssetsPageService } = require('../../../src/modules/web/assets/application/services/assets-page.service');

function createRepository(overrides = {}) {
  return {
    userHasPermission: async () => true,
    findAssetTypeById: async () => ({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Laptop',
      assetCount: 0,
      notFoundCount: 0,
      completedCount: 0,
    }),
    deleteAssetType: async () => ({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Laptop',
    }),
    ...overrides,
  };
}

test('deleteAssetType rejects asset types that are still used by assets', async () => {
  let deleteCalled = false;
  const service = createAssetsPageService({
    repository: createRepository({
      findAssetTypeById: async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Laptop',
        assetCount: 2,
        notFoundCount: 1,
        completedCount: 1,
      }),
      deleteAssetType: async () => {
        deleteCalled = true;
        return null;
      },
    }),
  });

  await assert.rejects(
    () =>
      service.deleteAssetType({
        actorUserId: '22222222-2222-4222-8222-222222222222',
        typeId: '11111111-1111-4111-8111-111111111111',
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'ASSET_TYPE_IN_USE');
      assert.equal(
        error.message,
        'The asset type cannot be deleted while assets of that type exist.',
      );
      return true;
    },
  );
  assert.equal(deleteCalled, false);
});

test('deleteAssetType rejects repository race-condition block results', async () => {
  const service = createAssetsPageService({
    repository: createRepository({
      deleteAssetType: async () => ({
        blocked: true,
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Laptop',
        assetCount: 1,
      }),
    }),
  });

  await assert.rejects(
    () =>
      service.deleteAssetType({
        actorUserId: '22222222-2222-4222-8222-222222222222',
        typeId: '11111111-1111-4111-8111-111111111111',
      }),
    { code: 'ASSET_TYPE_IN_USE', status: 409 },
  );
});

test('deleteAssetType deletes unused asset types', async () => {
  const service = createAssetsPageService({ repository: createRepository() });

  const result = await service.deleteAssetType({
    actorUserId: '22222222-2222-4222-8222-222222222222',
    typeId: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Asset type removed successfully.');
  assert.deepEqual(result.body.type, {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Laptop',
  });
});
