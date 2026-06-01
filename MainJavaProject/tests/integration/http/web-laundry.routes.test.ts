const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { requireFresh } = require('../../helpers/module-mocks');
const { startServer, requestJson } = require('../../helpers/http');

function createTestApp(router) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
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

function createController() {
  const ok = (_req, res) => res.status(200).json({ ok: true });
  return {
    laundryPage: ok,
    laundryData: ok,
    laundryReport: ok,
    availableBags: ok,
    downloadBagTemplate: ok,
    downloadLaundryMobileApp: ok,
    downloadLaundryReport: ok,
    addBag: ok,
    editBag: ok,
    deleteBag: ok,
    addBagToStatus: ok,
    moveBag: ok,
    recordLinenExchange: ok,
    removeBagFromStatus: ok,
    bulkUpdateBags: ok,
    importBags: ok,
  };
}

function createRouterWithPermission(permissionChecker) {
  const routerModule = requireFresh('src/modules/web/laundry/laundry.routes.ts', {
    'src/modules/web/laundry/laundry.module.ts': {
      createLaundryModule: () => ({
        controller: createController(),
        permissionChecker,
      }),
    },
  });

  return routerModule.createWebLaundryRouter({ repositories: { laundry: {} } });
}

test('web laundry route GET /web/laundry allows users with Full permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Full permission'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/laundry');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});

test('web laundry route GET /web/laundry returns 403 when Laundry and Full permission are both denied', async () => {
  const app = createTestApp(createRouterWithPermission(async () => false));
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/laundry');

    assert.equal(response.status, 403);
    assert.equal(body.code, 'PERMISSION_DENIED');
  } finally {
    await server.close();
  }
});

test('web laundry route GET /web/laundry/mobile-app allows users with download permission', async () => {
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => permissionName === 'Download laundry app'),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/laundry/mobile-app');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});
