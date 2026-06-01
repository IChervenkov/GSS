const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('deleteUser forwards request context to the delete users use case', async () => {
  const invocations = [];
  const { createMainController } = requireFresh(
    'src/modules/web/main-page/presentation/main.controller.ts',
    {
      'src/shared/utils/session-utils.ts': {
        destroySessionAndClearCookie: async () => {},
      },
      'src/shared/security/audit-log.ts': {
        buildRequestMeta: () => ({ requestId: 'req-1' }),
      },
      'src/modules/web/main-page/infrastructure/session/main.session.ts': {
        buildMainSession: () => ({ save: async () => {}, clearCurrentCamp: () => {} }),
      },
    },
  );

  const controller = createMainController({
    useCases: {
      deleteUsers: async (input) => {
        invocations.push(input);
        return {
          status: 200,
          body: {
            message: 'Users removed successfully',
            deletedUserIds: ['user-2'],
          },
        };
      },
    },
    env: {},
  });

  const req = {
    body: { codes: ['user-2'] },
    headers: {},
    method: 'DELETE',
    originalUrl: '/web/user/delete',
    path: '/web/user/delete',
    session: { userId: 'user-1' },
    sessionStore: { name: 'test-store' },
  };

  const result = await controller.deleteUser(req);

  assert.deepEqual(invocations, [
    {
      actorUserId: 'user-1',
      sessionUserId: 'user-1',
      userIds: ['user-2'],
      requestMeta: { requestId: 'req-1' },
      sessionStore: req.sessionStore,
    },
  ]);
  assert.deepEqual(result, {
    type: 'json',
    status: 200,
    body: {
      message: 'Users removed successfully',
      deletedUserIds: ['user-2'],
    },
  });
});

test('editUser forwards session store and payload to the edit user use case', async () => {
  const invocations = [];
  const { createMainController } = requireFresh(
    'src/modules/web/main-page/presentation/main.controller.ts',
    {
      'src/shared/utils/session-utils.ts': {
        destroySessionAndClearCookie: async () => {},
      },
      'src/shared/security/audit-log.ts': {
        buildRequestMeta: () => ({ requestId: 'req-2' }),
      },
      'src/modules/web/main-page/infrastructure/session/main.session.ts': {
        buildMainSession: () => ({ save: async () => {}, clearCurrentCamp: () => {} }),
      },
    },
  );

  const controller = createMainController({
    useCases: {
      editUser: async (input) => {
        invocations.push(input);
        return {
          status: 200,
          body: {
            message: 'User edited successfully',
            userId: 'user-2',
            locked: true,
            invalidateSessions: true,
          },
        };
      },
    },
    env: {},
  });

  const req = {
    body: { id: 'user-2', username: 'locked.user', locked: true },
    headers: {},
    method: 'POST',
    originalUrl: '/web/user/edit',
    path: '/web/user/edit',
    session: { userId: 'user-1' },
    sessionStore: { name: 'test-store' },
  };

  const result = await controller.editUser(req);

  assert.deepEqual(invocations, [
    {
      actorUserId: 'user-1',
      userId: 'user-2',
      username: 'locked.user',
      password: undefined,
      locked: true,
      requestMeta: { requestId: 'req-2' },
      sessionStore: req.sessionStore,
    },
  ]);
  assert.deepEqual(result, {
    type: 'json',
    status: 200,
    body: {
      message: 'User edited successfully',
      userId: 'user-2',
      locked: true,
      invalidateSessions: true,
    },
  });
});

function createLogoutController(modulePath = 'src/modules/web/main-page/presentation/main-page.controller.ts') {
  const destroyCalls = [];
  const { createMainController } = requireFresh(modulePath, {
    'src/shared/utils/session-utils.ts': {
      destroySessionAndClearCookie: async (...args) => {
        destroyCalls.push(args);
      },
    },
    'src/shared/security/audit-log.ts': {
      buildRequestMeta: () => ({ requestId: 'req-logout' }),
    },
    'src/modules/web/main-page/infrastructure/session/main.session.ts': {
      buildMainSession: () => ({ save: async () => {}, clearCurrentCamp: () => {} }),
    },
  });

  return {
    controller: createMainController({
      useCases: {},
      env: {},
    }),
    destroyCalls,
  };
}

test('logoutApi redirects browser form posts to the login page', async () => {
  const { controller, destroyCalls } = createLogoutController();
  const req = {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'content-type': 'application/x-www-form-urlencoded',
    },
    session: { userId: 'user-1' },
  };

  const result = await controller.logoutApi(req, {});

  assert.equal(destroyCalls.length, 1);
  assert.deepEqual(result, {
    type: 'redirect',
    status: 303,
    location: '/',
  });
});

test('logoutApi keeps json success contract for fetch callers', async () => {
  const { controller, destroyCalls } = createLogoutController();
  const req = {
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    session: { userId: 'user-1' },
  };

  const result = await controller.logoutApi(req, {});

  assert.equal(destroyCalls.length, 1);
  assert.deepEqual(result, {
    type: 'json',
    status: 200,
    body: { success: true },
  });
});
