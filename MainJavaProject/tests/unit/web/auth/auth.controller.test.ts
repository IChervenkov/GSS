const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');
const {
  createAuthController,
} = require('../../../../src/modules/web/auth/presentation/auth.controller');

test('change password page forwards the current csrf token to the rendered view', async () => {
  const controller = createAuthController({
    useCases: {
      getChangePasswordView: async () => ({ title: 'Change Password' }),
    },
    env: {},
  });
  const res = { locals: { csrfToken: 'csrf-from-locals' } };
  const req = { method: 'GET', headers: {}, session: {} };

  const result = await controller.changePasswordPage(req, res);

  assert.deepEqual(result, {
    type: 'render',
    status: 200,
    view: 'change-password',
    model: { title: 'Change Password', csrfToken: 'csrf-from-locals' },
  });
});

test('verify page forwards the current csrf token to the rendered view', async () => {
  const controller = createAuthController({
    useCases: {
      getVerifyView: async () => ({
        title: 'Verify',
        qrCodeDataURL: 'data:image/png;base64,abc',
      }),
    },
    env: {},
  });
  const res = { locals: {} };
  const req = {
    method: 'GET',
    headers: {},
    session: { csrfToken: 'csrf-from-session', pendingUserId: 'user-1' },
  };

  const result = await controller.verifyPage(req, res);

  assert.deepEqual(result, {
    type: 'render',
    status: 200,
    view: 'verify-qr-code',
    model: {
      title: 'Verify',
      qrCodeDataURL: 'data:image/png;base64,abc',
      csrfToken: 'csrf-from-session',
    },
  });
});

function createLogoutController() {
  const destroyCalls = [];
  const auditCalls = [];
  const { createAuthController: createController } = requireFresh(
    'src/modules/web/auth/presentation/auth.controller.ts',
    {
      'src/shared/utils/session-utils.ts': {
        destroySessionAndClearCookie: async (...args) => {
          destroyCalls.push(args);
        },
      },
      'src/shared/security/audit-log.ts': {
        buildRequestMeta: () => ({ requestId: 'req-logout' }),
      },
    },
  );

  return {
    controller: createController({
      useCases: {},
      env: {},
      auditLog: (...args) => auditCalls.push(args),
    }),
    destroyCalls,
    auditCalls,
  };
}

test('logout redirects browser form posts to the login page', async () => {
  const { controller, destroyCalls } = createLogoutController();
  const req = {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'content-type': 'application/x-www-form-urlencoded',
    },
    session: { userId: 'user-1' },
  };

  const result = await controller.logout(req, {});

  assert.equal(destroyCalls.length, 1);
  assert.deepEqual(result, {
    type: 'redirect',
    status: 303,
    location: '/',
  });
});

test('logout keeps json redirect contract for fetch callers', async () => {
  const { controller, destroyCalls } = createLogoutController();
  const req = {
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    session: { userId: 'user-1' },
  };

  const result = await controller.logout(req, {});

  assert.equal(destroyCalls.length, 1);
  assert.deepEqual(result, {
    type: 'json',
    status: 200,
    body: { redirectTo: '/' },
  });
});
