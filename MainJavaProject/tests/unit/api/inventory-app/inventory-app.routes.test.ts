const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createApiInventoryAppRouter } = require('../../../../src/modules/api/inventory-app/inventory-app.routes');
const { startServer, requestJson } = require('../../../helpers/http');

function createApp(dependencies) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  });
  app.use('/api', createApiInventoryAppRouter(dependencies));
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ code: error.code, message: error.message });
  });
  return app;
}

function createDependencies() {
  const calls = [];
  const assets = {
    getAssetSummary: async ({ campId }) => {
      calls.push(['summary', campId]);
      return {
        totalAssets: 2,
        totalQuantity: '3',
        notFoundAssets: 1,
        completedAssets: 1,
        typeCount: 1,
      };
    },
    listAssetsTable: async () => ({ rows: [], total: 0, sourceTotal: 0, page: 1, limit: 10, totalPages: 1 }),
    listNotFoundAssetsTable: async () => ({ rows: [], total: 0, sourceTotal: 0, page: 1, limit: 10, totalPages: 1 }),
    listInventoryStatusTable: async () => ({ rows: [], total: 0, sourceTotal: 0, page: 1, limit: 10, totalPages: 1 }),
    listAssetTypesTable: async () => ({ rows: [], total: 0, sourceTotal: 0, page: 1, limit: 10, totalPages: 1 }),
    listCleanItemsTable: async () => ({ rows: [], total: 0, sourceTotal: 0, page: 1, limit: 10, totalPages: 1 }),
    getCleanItemSummary: async () => ({}),
    listInventoryEventsTable: async () => ({ rows: [], total: 0, sourceTotal: 0, page: 1, limit: 10, totalPages: 1 }),
    listAssetTypesByCamp: async () => [],
    listRoomsByCamp: async () => [],
    listKeysByCamp: async () => [],
    listAssetsByCamp: async () => [],
    listUserPermissions: async ({ userId }) => {
      calls.push(['permissions', userId]);
      return [{ name: 'Asset management' }];
    },
    findAssetByRfid: async ({ campId, rfidCode }) => ({ id: 'asset-1', campId, rfidCode }),
    recordAssetInventory: async ({ assetId, inventoryStatus, locationKeyId }) => ({
      id: assetId,
      inventoryStatus,
      locationKeyId,
    }),
    userHasPermission: async () => true,
  };
  const main = {
    listCampsAndPermissions: async ({ userId }) => {
      calls.push(['camps', userId]);
      return { camps: [{ id: 'camp-1', name: 'Camp One', createdAt: '2026-05-13' }] };
    },
  };
  return {
    calls,
    env: { APP_ASSET_VERSION: '1.5.3', HASH_APP_ASSET: 'hash' },
    eventBus: { emitAssetsChanged: () => calls.push(['changed']) },
    repositories: { assets, main },
  };
}

test('inventory app exposes camps permissions and overview endpoints', async () => {
  const dependencies = createDependencies();
  const server = await startServer(createApp(dependencies));
  try {
    const camps = await requestJson(server.baseUrl, '/api/inventory-app/camps');
    assert.equal(camps.response.status, 200);
    assert.deepEqual(camps.body.camps, [
      { id: 'camp-1', name: 'Camp One', createdAt: '2026-05-13' },
    ]);

    const permissions = await requestJson(server.baseUrl, '/api/inventory-app/permissions');
    assert.equal(permissions.response.status, 200);
    assert.deepEqual(permissions.body.permissions, [{ name: 'Asset management' }]);

    const overview = await requestJson(
      server.baseUrl,
      '/api/inventory-app/overview?campId=camp-1&state=%7B%7D',
    );
    assert.equal(overview.response.status, 200);
    assert.equal(overview.body.totalAssets, 2);
    assert.equal(overview.body.completedAssets, 1);

    assert.deepEqual(dependencies.calls.slice(0, 3), [
      ['camps', 'user-1'],
      ['permissions', 'user-1'],
      ['summary', 'camp-1'],
    ]);
  } finally {
    await server.close();
  }
});

test('inventory scan forwards replacement key selection', async () => {
  const dependencies = createDependencies();
  const server = await startServer(createApp(dependencies));
  try {
    const result = await requestJson(server.baseUrl, '/api/inventory-app/inventory/scan', {
      method: 'POST',
      body: JSON.stringify({
        campId: 'camp-1',
        assetId: 'asset-1',
        locationRoomId: 'room-2',
        locationKeyId: 'key-2',
        inventoryStatus: 'completed',
      }),
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.body.asset.locationKeyId, 'key-2');
  } finally {
    await server.close();
  }
});
