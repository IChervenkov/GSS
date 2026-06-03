const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { requireFresh } = require('../../../helpers/module-mocks');
const { startServer, requestJson } = require('../../../helpers/http');

function controllerProxy(overrides = {}) {
  return new Proxy(overrides, {
    get(target, key) {
      if (key in target) return target[key];
      return (_req, res) => res.status(200).json({ ok: true });
    },
  });
}

test('api bike app route validates NFC lookup and passes authenticated actor context', async () => {
  let nfcLookupPayload = null;
  const routerModule = requireFresh('src/modules/api/bike-app/bike-app.routes.ts', {
    'src/modules/api/bike-app/bike-app.module.ts': {
      createBikeAppModule: () => ({
        controller: controllerProxy({
          nfcLookup: (req, res) => {
            nfcLookupPayload = {
              actorUserId: req.user.id,
              campId: req.query.campId,
              nfcData: req.query.nfcData,
            };
            return res.status(200).json({
              assetType: 'bicycle',
              asset: { id: 'bike-1', nfcCode: req.query.nfcData },
            });
          },
        }),
      }),
    },
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  });
  app.use('/api', routerModule.createApiBikeAppRouter({}));
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ code: error.code, message: error.message });
  });

  const server = await startServer(app);
  try {
    const campId = '11111111-1111-4111-8111-111111111111';
    const { response, body } = await requestJson(
      server.baseUrl,
      `/api/bike-app/nfc?campId=${campId}&nfcData=NFC-42`,
    );

    assert.equal(response.status, 200);
    assert.equal(body.assetType, 'bicycle');
    assert.deepEqual(nfcLookupPayload, {
      actorUserId: 'user-1',
      campId,
      nfcData: 'NFC-42',
    });
  } finally {
    await server.close();
  }
});

test('api bike app mutating routes require request DTO validation', async () => {
  const routerModule = requireFresh('src/modules/api/bike-app/bike-app.routes.ts', {
    'src/modules/api/bike-app/bike-app.module.ts': {
      createBikeAppModule: () => ({
        controller: controllerProxy({
          addBicycle: (_req, res) => res.status(200).json({ ok: true }),
        }),
      }),
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api', routerModule.createApiBikeAppRouter({}));
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ code: error.code, message: error.message });
  });

  const server = await startServer(app);
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/bike-app/bicycles', {
      method: 'POST',
      body: JSON.stringify({
        campId: '11111111-1111-4111-8111-111111111111',
        name: 'A',
        nfcCode: 'NFC-42',
      }),
    });

    assert.equal(response.status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  } finally {
    await server.close();
  }
});

test('api bike app bicycle list accepts server-side table query state', async () => {
  let listPayload = null;
  const routerModule = requireFresh('src/modules/api/bike-app/bike-app.routes.ts', {
    'src/modules/api/bike-app/bike-app.module.ts': {
      createBikeAppModule: () => ({
        controller: controllerProxy({
          bicycles: (req, res) => {
            listPayload = {
              campId: req.query.campId,
              page: req.query.page,
              limit: req.query.limit,
              filters: req.query.filters,
              sortColumn: req.query.sortColumn,
              sortDirection: req.query.sortDirection,
            };
            return res.status(200).json({ bicycles: [], table: { total: 0 } });
          },
        }),
      }),
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api', routerModule.createApiBikeAppRouter({}));
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ code: error.code, message: error.message });
  });

  const server = await startServer(app);
  try {
    const campId = '11111111-1111-4111-8111-111111111111';
    const filters = encodeURIComponent(JSON.stringify({ name: 'alpha', status: 'available' }));
    const { response } = await requestJson(
      server.baseUrl,
      `/api/bike-app/bicycles?campId=${campId}&page=2&limit=10&filters=${filters}&sortColumn=name&sortDirection=desc`,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(listPayload, {
      campId,
      page: 2,
      limit: 10,
      filters: { name: 'alpha', status: 'available' },
      sortColumn: 'name',
      sortDirection: 'desc',
    });
  } finally {
    await server.close();
  }
});

test('api bike app permissions route passes authenticated actor context', async () => {
  let permissionsPayload = null;
  const routerModule = requireFresh('src/modules/api/bike-app/bike-app.routes.ts', {
    'src/modules/api/bike-app/bike-app.module.ts': {
      createBikeAppModule: () => ({
        controller: controllerProxy({
          permissions: (req, res) => {
            permissionsPayload = { actorUserId: req.user.id };
            return res.status(200).json({ permissions: [{ name: 'Add bike' }] });
          },
        }),
      }),
    },
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  });
  app.use('/api', routerModule.createApiBikeAppRouter({}));

  const server = await startServer(app);
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/bike-app/permissions');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { permissions: [{ name: 'Add bike' }] });
    assert.deepEqual(permissionsPayload, { actorUserId: 'user-1' });
  } finally {
    await server.close();
  }
});

test('api bike app accepts legacy mobile mutation payloads that rely on asset lookup camp context', async () => {
  const calls = [];
  const routerModule = requireFresh('src/modules/api/bike-app/bike-app.routes.ts', {
    'src/modules/api/bike-app/bike-app.module.ts': {
      createBikeAppModule: () => ({
        controller: controllerProxy({
          legacyRentBicycle: (req, res) => {
            calls.push({ route: 'rent', body: req.body });
            return res.status(200).json({ ok: true });
          },
          legacyReturnBicycle: (req, res) => {
            calls.push({ route: 'return', body: req.body });
            return res.status(200).json({ ok: true });
          },
          legacyDeleteHelmet: (req, res) => {
            calls.push({ route: 'deleteHelmet', body: req.body });
            return res.status(200).json({ ok: true });
          },
        }),
      }),
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api', routerModule.createApiBikeAppRouter({}));
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ code: error.code, message: error.message });
  });

  const server = await startServer(app);
  try {
    const soldierId = '22222222-2222-4222-8222-222222222222';
    const helmetCode = '33333333-3333-4333-8333-333333333333';

    const rent = await requestJson(server.baseUrl, '/api/nfcRent', {
      method: 'POST',
      body: JSON.stringify({
        nfcData: 'NFC-BIKE-1',
        date: '2026-04-17',
        time: '10:30',
        selectClient: soldierId,
        helmetId: '',
      }),
    });
    const returned = await requestJson(server.baseUrl, '/api/nfcReturn', {
      method: 'POST',
      body: JSON.stringify({
        nfcData: 'NFC-BIKE-1',
        date: '2026-04-17',
        time: '11:30',
      }),
    });
    const deleted = await requestJson(server.baseUrl, '/api/bicycles/removeHelmet', {
      method: 'DELETE',
      body: JSON.stringify({ code: helmetCode }),
    });

    assert.equal(rent.response.status, 200);
    assert.equal(returned.response.status, 200);
    assert.equal(deleted.response.status, 200);
    assert.deepEqual(calls.map((call) => call.route), ['rent', 'return', 'deleteHelmet']);
  } finally {
    await server.close();
  }
});
