const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Joi = require('joi');

const { requireFresh } = require('../../helpers/module-mocks');
const { startServer, requestJson } = require('../../helpers/http');

function createTestApp(router) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    req.session = {
      userId: '11111111-1111-1111-1111-111111111111',
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
    mainPage: ok,
    campsData: ok,
    downloadCampTemplate: ok,
    setCamp: ok,
    addCamp: ok,
    importCamps: ok,
    editCamp: ok,
    deleteCamp: ok,
    permissionsData: (_req, res) => res.status(200).json({ section: 'permissions' }),
    permissionsSave: ok,
    currentUserPermissions: ok,
    usersData: (_req, res) => res.status(200).json({ section: 'users' }),
    addUser: ok,
    editUser: ok,
    deleteUser: ok,
    securityResetUser: ok,
    resolveUserRequest: ok,
    logoutApi: ok,
  };
}

function createRouterWithPermission(permissionChecker) {
  const routerModule = requireFresh('src/modules/web/main-page/main.routes.ts', {
    'src/modules/web/main-page/main.module.ts': {
      createMainModule: () => ({
        controller: createController(),
        permissionChecker,
      }),
    },
    'src/modules/web/main-page/presentation/http/main.request.dto.ts': {
      campsDataRequestDto: Joi.object({}).unknown(true),
      campChangeRequestDto: Joi.object({ campId: Joi.string().required() }).required(),
      campAddRequestDto: Joi.object({ campName: Joi.string().required() }).required(),
      campEditRequestDto: Joi.object({ campId: Joi.string().required(), campName: Joi.string().required() }).required(),
      campDeleteRequestDto: Joi.object({ campId: Joi.string().required() }).required(),
      campImportRequestDto: Joi.object({}).required(),
      permissionsDataRequestDto: Joi.object({}).unknown(true),
      permissionsSaveRequestDto: Joi.object({ permissions: Joi.array().required() }).required(),
      usersDataRequestDto: Joi.object({}).unknown(true),
      addUserRequestDto: Joi.object({ username: Joi.string().required() }).required(),
      editUserRequestDto: Joi.object({ id: Joi.string().required(), username: Joi.string().required() }).required(),
      deleteUserRequestDto: Joi.object({ codes: Joi.array().required() }).required(),
      securityResetUserRequestDto: Joi.object({ userId: Joi.string().required() }).required(),
      resolveUserRequestDto: Joi.object({ requestId: Joi.string().required(), decision: Joi.string().required() }).required(),
      logoutRequestDto: Joi.object({}).required().unknown(false),
    },
  });

  return routerModule.createWebMainRouter({
    env: {},
    upload: {
      single: () => (_req, _res, next) => next(),
    },
  });
}

test('web main route GET /web/user/data returns 403 on denied permission', async () => {
  const app = createTestApp(createRouterWithPermission(async () => false));
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/user/data');

    assert.equal(response.status, 403);
    assert.equal(body.code, 'PERMISSION_DENIED');
  } finally {
    await server.close();
  }
});

test('web main route GET /web/user/data rejects Full permission without Admin permission', async () => {
  const checkedPermissions = [];
  const app = createTestApp(
    createRouterWithPermission(async (_userId, permissionName) => {
      checkedPermissions.push(permissionName);
      return permissionName === 'Full permission';
    }),
  );
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/user/data');

    assert.equal(response.status, 403);
    assert.equal(body.code, 'PERMISSION_DENIED');
    assert.deepEqual(checkedPermissions, ['Admin permission']);
  } finally {
    await server.close();
  }
});

test('web main route GET /web/permissions/data returns 403 on denied permission', async () => {
  const app = createTestApp(createRouterWithPermission(async () => false));
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/permissions/data');

    assert.equal(response.status, 403);
    assert.equal(body.code, 'PERMISSION_DENIED');
  } finally {
    await server.close();
  }
});

test('web main route GET /web/user/data returns controller data when permission is granted', async () => {
  const app = createTestApp(createRouterWithPermission(async () => true));
  const server = await startServer(app);

  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/user/data');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { section: 'users' });
  } finally {
    await server.close();
  }
});

test('web main route POST /web/camp/import accepts an unparsed empty multipart body before upload middleware', async () => {
  const routerModule = requireFresh('src/modules/web/main-page/main-page.routes.ts', {
    'src/modules/web/main-page/main-page.module.ts': {
      createMainModule: () => ({
        controller: {
          ...createController(),
          importCamps: (req, res) =>
            res.status(200).json({ uploadReached: req.uploadMiddlewareReached, body: req.body }),
        },
        permissionChecker: async () => true,
      }),
    },
  });

  const app = createTestApp(
    routerModule.createWebMainRouter({
      env: {},
      upload: {
        single: () => (req, _res, next) => {
          req.uploadMiddlewareReached = true;
          next();
        },
      },
    }),
  );
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/web/camp/import`, {
      method: 'POST',
      redirect: 'manual',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { uploadReached: true, body: {} });
  } finally {
    await server.close();
  }
});

test('web main route POST /web/logout accepts csrf-only form posts', async () => {
  const app = createTestApp(createRouterWithPermission(async () => true));
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/web/logout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ _csrf: 'csrf-token' }).toString(),
      redirect: 'manual',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});
