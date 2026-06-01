const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { requireFresh } = require('../../helpers/module-mocks');
const { startServer, requestJson } = require('../../helpers/http');

function createTestApp(router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = {
      userId: '11111111-1111-1111-1111-111111111111',
      camp: '22222222-2222-2222-2222-222222222222',
    };
    next();
  });
  app.use('/web', router);
  app.use((error, _req, res, _next) => {
    res
      .status(error.status || 500)
      .json({ code: error.code || 'INTERNAL_ERROR', message: error.message });
  });
  return app;
}

function createRouterWithPermission(permissionChecker) {
  const routerModule = requireFresh('src/modules/web/assets/assets.routes.ts', {
    'src/modules/web/assets/assets.module.ts': {
      createAssetsModule: () => ({
        controller: {
          addAsset: (_req, res) => res.status(200).json({ ok: true }),
          addAssetType: (_req, res) => res.status(200).json({ ok: true }),
          addCleanItem: (_req, res) => res.status(200).json({ ok: true }),
          assetsPage: (_req, res) => res.status(200).json({ ok: true }),
          assetsData: (_req, res) => res.status(200).json({ rows: [] }),
          bulkUpdateAssetTypes: (_req, res) => res.status(200).json({ ok: true }),
          bulkUpdateAssets: (_req, res) => res.status(200).json({ ok: true }),
          bulkUpdateCleanItems: (_req, res) => res.status(200).json({ ok: true }),
          deleteAsset: (_req, res) => res.status(200).json({ ok: true }),
          deleteAssetType: (_req, res) => res.status(200).json({ ok: true }),
          deleteCleanItem: (_req, res) => res.status(200).json({ ok: true }),
          downloadAssetTemplate: (_req, res) => res.status(200).send('template'),
          downloadAssetTypeTemplate: (_req, res) => res.status(200).send('type template'),
          downloadCleanItemTemplate: (_req, res) => res.status(200).send('clean item template'),
          downloadAssetsMobileApp: (_req, res) => res.status(200).send('assets apk'),
          editAsset: (_req, res) => res.status(200).json({ ok: true }),
          editAssetType: (_req, res) => res.status(200).json({ ok: true }),
          editCleanItem: (_req, res) => res.status(200).json({ ok: true }),
          importAssets: (_req, res) => res.status(200).json({ ok: true }),
          importAssetTypes: (_req, res) => res.status(200).json({ ok: true }),
          importCleanItems: (_req, res) => res.status(200).json({ ok: true }),
          moveCleanItem: (_req, res) => res.status(200).json({ ok: true }),
          restartInventory: (_req, res) => res.status(200).json({ ok: true }),
        },
        permissionChecker,
      }),
    },
  });

  return routerModule.createWebAssetsRouter({ repositories: { assets: {} } });
}

test('web assets route GET /web/assets allows users with Full permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Full permission'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});


test('web assets route GET /web/assets allows users with Asset management permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Asset management'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});

test('web assets route GET /web/assets allows users with Assets permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Assets'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});

test('web assets route GET /web/assets returns 403 when Assets and Full permission are denied', async () => {
  const app = createTestApp(createRouterWithPermission(async () => false));
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets');

    assert.equal(response.status, 403);
    assert.equal(body.code, 'PERMISSION_DENIED');
  } finally {
    await server.close();
  }
});

test('web assets route GET /web/assets/data allows Assets permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Assets'),
  );
  const server = await startServer(app);

  try {
    const state = encodeURIComponent(JSON.stringify({ allAssets: { page: 1 } }));
    const { response, body } = await requestJson(server.baseUrl, `/web/assets/data?state=${state}`);

    assert.equal(response.status, 200);
    assert.deepEqual(body, { rows: [] });
  } finally {
    await server.close();
  }
});

test('web assets route POST /web/assets allows Add asset permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Add asset'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets', {
      method: 'POST',
      body: JSON.stringify({
        code: 'A-001',
        rfidCode: 'RFID-A-001',
        name: 'Desk',
        typeId: '33333333-3333-4333-8333-333333333333',
        locationRoomId: '44444444-4444-4444-8444-444444444444',
        quantity: '1',
        status: 'Good',
        expandable: 'Non Expandable',
        inventoryStatus: 'undiscovered',
        isFixed: false,
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});

test('web assets route DELETE /web/assets allows validated asset deletion requests', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Remove asset'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets', {
      method: 'DELETE',
      body: JSON.stringify({ assetId: '33333333-3333-4333-8333-333333333333' }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});

test('web assets route POST /web/assets/inventory/restart allows Save inventory permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Save inventory'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets/inventory/restart', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});

test('web assets route POST /web/assets/types allows validated type requests', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Add asset type'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets/types', {
      method: 'POST',
      body: JSON.stringify({ name: 'Furniture' }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});

test('web assets route POST /web/assets/clean-items allows validated clean item requests', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Add clean item'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/assets/clean-items', {
      method: 'POST',
      body: JSON.stringify({
        itemName: 'Towel',
        totalAmount: 25,
        countGetItem: 2,
        warehouse: 'large',
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});
