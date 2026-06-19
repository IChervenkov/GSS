const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Joi = require('joi');

const { requireFresh } = require('../../helpers/module-mocks');
const { startServer, requestJson } = require('../../helpers/http');

const emptyBodyDto = Joi.object({}).required().unknown(false);

function createErrorApp(router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = {};
    next();
  });
  app.use('/web', router);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ code: error.code || 'INTERNAL_ERROR', message: error.message });
  });
  return app;
}

test('route builders require DTO validation for mutating routes', async () => {
  const express = require('express');
  const { buildPostRoute } = require('../../../src/shared/http/route-builders');
  const router = express.Router();

  assert.throws(
    () => buildPostRoute(router, '/mutate', (_req, res) => res.status(200).json({ ok: true })),
    /Validation schema is required for mutating route POST \/mutate/,
  );
});

test('GET /web/logout is no longer exposed as a mutating endpoint', async () => {
  const routerModule = requireFresh('src/modules/web/main-page/main.routes.ts', {
    'src/modules/web/main-page/main.module.ts': {
      createMainModule: () => ({
        controller: {
          mainPage: (_req, res) => res.status(200).json({ ok: true }),
          campsData: (_req, res) => res.status(200).json({ ok: true }),
          downloadCampTemplate: (_req, res) => res.status(200).json({ ok: true }),
          setCamp: (_req, res) => res.status(200).json({ ok: true }),
          addCamp: (_req, res) => res.status(200).json({ ok: true }),
          importCamps: (_req, res) => res.status(200).json({ ok: true }),
          editCamp: (_req, res) => res.status(200).json({ ok: true }),
          deleteCamp: (_req, res) => res.status(200).json({ ok: true }),
          permissionsData: (_req, res) => res.status(200).json({ ok: true }),
          permissionsSave: (_req, res) => res.status(200).json({ ok: true }),
          campAccessData: (_req, res) => res.status(200).json({ ok: true }),
          campAccessSave: (_req, res) => res.status(200).json({ ok: true }),
          currentUserPermissions: (_req, res) => res.status(200).json({ ok: true }),
          usersData: (_req, res) => res.status(200).json({ ok: true }),
          addUser: (_req, res) => res.status(200).json({ ok: true }),
          editUser: (_req, res) => res.status(200).json({ ok: true }),
          deleteUser: (_req, res) => res.status(200).json({ ok: true }),
          securityResetUser: (_req, res) => res.status(200).json({ ok: true }),
          resolveUserRequest: (_req, res) => res.status(200).json({ ok: true }),
          logoutApi: (_req, res) => res.status(200).json({ ok: true }),
        },
        permissionChecker: async () => true,
      }),
    },
    'src/modules/web/main-page/presentation/http/main.request.dto.ts': {
      campsDataRequestDto: Joi.object({}).unknown(true),
      campChangeRequestDto: Joi.object({ campId: Joi.string().required() }).required(),
      campAddRequestDto: Joi.object({ campName: Joi.string().required() }).required(),
      campEditRequestDto: Joi.object({ campId: Joi.string().required(), campName: Joi.string().required() }).required(),
      campDeleteRequestDto: Joi.object({ campId: Joi.string().required() }).required(),
      campImportRequestDto: emptyBodyDto,
      permissionsDataRequestDto: Joi.object({}).unknown(true),
      permissionsSaveRequestDto: Joi.object({ permissions: Joi.array().required() }).required(),
      campAccessDataRequestDto: Joi.object({}).unknown(true),
      campAccessSaveRequestDto: Joi.object({ campAccess: Joi.array().required() }).required(),
      usersDataRequestDto: Joi.object({}).unknown(true),
      addUserRequestDto: Joi.object({ username: Joi.string().required() }).required(),
      editUserRequestDto: Joi.object({ id: Joi.string().required(), username: Joi.string().required() }).required(),
      deleteUserRequestDto: Joi.object({ codes: Joi.array().required() }).required(),
      securityResetUserRequestDto: Joi.object({ userId: Joi.string().required() }).required(),
      resolveUserRequestDto: Joi.object({ requestId: Joi.string().required(), decision: Joi.string().required() }).required(),
      logoutRequestDto: emptyBodyDto,
    },
  });

  const app = createErrorApp(routerModule.createWebMainRouter({ env: {}, upload: { single: () => (_req, _res, next) => next() } }));
  const server = await startServer(app);
  try {
    const response = await fetch(`${server.baseUrl}/web/logout`);
    assert.equal(response.status, 404);
  } finally {
    await server.close();
  }
});

test('auth public login route stays reachable without an authenticated session', async () => {
  const routerModule = requireFresh('src/modules/web/auth/auth.routes.ts', {
    'src/modules/web/auth/auth.module.ts': {
      createAuthModule: () => ({
        controller: {
          changePasswordPage: (_req, res) => res.status(200).json({ ok: true }),
          verifyPage: (_req, res) => res.status(200).json({ ok: true }),
          getApprovedQrPayload: (_req, res) => res.status(200).json({ ok: true }),
          changePassword: (_req, res) => res.status(200).json({ ok: true }),
          verifyAdminDecision: (_req, res) => res.status(200).json({ ok: true }),
          login: (_req, res) => res.status(200).json({ ok: true }),
          requestAccess: (_req, res) => res.status(200).json({ ok: true }),
          requestQr: (_req, res) => res.status(200).json({ ok: true }),
          verifyCode: (_req, res) => res.status(200).json({ ok: true }),
          logout: (_req, res) => res.status(200).json({ ok: true }),
        },
        permissionChecker: async () => true,
      }),
    },
    'src/modules/web/auth/presentation/http/auth.request.dto.ts': {
      passwordChangeRequestDto: Joi.object({ username: Joi.string().required(), currentPassword: Joi.string().required(), newPassword: Joi.string().required() }).required(),
      verifyAdminDecisionRequestDto: Joi.object({ requestId: Joi.string().required(), decision: Joi.string().required() }).required(),
      loginRequestDto: Joi.object({ username: Joi.string().required(), password: Joi.string().required() }).required(),
      requestAccessRequestDto: Joi.object({ name: Joi.string().required(), email: Joi.string().required(), team: Joi.string().required(), access: Joi.string().required(), reason: Joi.string().required() }).required(),
      verifyCodeRequestDto: Joi.object({ code: Joi.string().required() }).required(),
      approvedQrPayloadQueryDto: Joi.object({ requestId: Joi.string().required() }).required(),
      requestQrRequestDto: emptyBodyDto,
      logoutRequestDto: emptyBodyDto,
    },
    'src/shared/http/rate-limit.ts': {
      getClientIp: () => '127.0.0.1',
      createRateLimitMiddleware: () => (_req, _res, next) => next(),
      createSlowDownMiddleware: () => (_req, _res, next) => next(),
    },
  });

  const app = createErrorApp(routerModule.createWebAuthPublicRouter({ env: {
    LOGIN_RATE_LIMIT_WINDOW_MS: 1,
    LOGIN_RATE_LIMIT_MAX_BY_IP: 10,
    LOGIN_RATE_LIMIT_MAX_BY_USERNAME: 10,
    QR_REQUEST_RATE_LIMIT_WINDOW_MS: 1,
    QR_REQUEST_RATE_LIMIT_MAX: 10,
    PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS: 1,
    PASSWORD_CHANGE_RATE_LIMIT_MAX: 10,
  } }));
  const server = await startServer(app);
  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'user', password: 'Secret123!' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await server.close();
  }
});
