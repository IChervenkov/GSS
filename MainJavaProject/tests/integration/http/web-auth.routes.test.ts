const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Joi = require('joi');

const { requireFresh } = require('../../helpers/module-mocks');
const { startServer, requestJson } = require('../../helpers/http');

const env = {
  LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
  LOGIN_RATE_LIMIT_MAX_BY_IP: 10,
  LOGIN_RATE_LIMIT_MAX_BY_USERNAME: 10,
  QR_REQUEST_RATE_LIMIT_WINDOW_MS: 60_000,
  QR_REQUEST_RATE_LIMIT_MAX: 10,
  PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS: 60_000,
  PASSWORD_CHANGE_RATE_LIMIT_MAX: 10,
};

const emptyBodyDto = Joi.object({}).required().unknown(false);

function createTestApp(router) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    req.session = {
      userId: '11111111-1111-1111-1111-111111111111',
      pendingUserId: '11111111-1111-1111-1111-111111111111',
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

test('web auth route POST /web/login returns controller result', async () => {
  const routerModule = requireFresh('src/modules/web/auth/auth.routes.ts', {
    'src/modules/web/auth/auth.module.ts': {
      createAuthModule: () => ({
        controller: {
          changePasswordPage: (_req, res) => res.status(200).json({ ok: true }),
          verifyPage: (_req, res) => res.status(200).json({ ok: true }),
          getApprovedQrPayload: (_req, res) => res.status(200).json({ ok: true }),
          changePassword: (_req, res) => res.status(200).json({ ok: true }),
          verifyAdminDecision: (_req, res) => res.status(200).json({ ok: true }),
          login: (_req, res) => res.status(200).json({ redirectTo: '/web/login/verify/data' }),
          requestAccess: (_req, res) => res.status(200).json({ ok: true }),
          requestQr: (_req, res) => res.status(202).json({ status: 'pending' }),
          verifyCode: (_req, res) => res.status(200).json({ redirectTo: '/web/main-page' }),
          logout: (_req, res) => res.status(200).json({ redirectTo: '/' }),
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

  const app = createTestApp(routerModule.createWebAuthRouter({ env }));
  const server = await startServer(app);
  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'Secret123!' }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, { redirectTo: '/web/login/verify/data' });
  } finally {
    await server.close();
  }
});

test('web auth route POST /web/admin/verify returns 403 on denied permission', async () => {
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
        permissionChecker: async () => false,
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

  const app = createTestApp(routerModule.createWebAuthRouter({ env }));
  const server = await startServer(app);
  try {
    const { response, body } = await requestJson(server.baseUrl, '/web/admin/verify', {
      method: 'POST',
      body: JSON.stringify({
        requestId: '22222222-2222-2222-2222-222222222222',
        decision: 'approved',
      }),
    });

    assert.equal(response.status, 403);
    assert.equal(body.code, 'PERMISSION_DENIED');
  } finally {
    await server.close();
  }
});

test('web auth route POST /web/logout accepts csrf-only form posts', async () => {
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

  const app = createTestApp(routerModule.createWebAuthRouter({ env }));
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
