const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createEditUserUseCase,
} = require('../../../../src/modules/web/main-page/application/use-cases/edit-user.use-case');
const {
  createDeleteUsersUseCase,
} = require('../../../../src/modules/web/main-page/application/use-cases/delete-users.use-case');

test('edit user use case invalidates sessions after a successful lock change', async () => {
  const invalidations = [];
  const execute = createEditUserUseCase({
    userService: {
      editUser: async () => ({
        status: 200,
        body: {
          message: 'User edited successfully',
          userId: 'user-2',
          locked: true,
          invalidateSessions: true,
        },
      }),
    },
    sessionInvalidator: {
      invalidate: async (payload) => {
        invalidations.push(payload);
      },
    },
  });

  const response = await execute({ sessionStore: { name: 'store-1' } });

  assert.deepEqual(invalidations, [
    {
      store: { name: 'store-1' },
      userIds: ['user-2'],
      reason: 'admin_account_locked',
    },
  ]);
  assert.deepEqual(response, {
    status: 200,
    body: {
      message: 'User edited successfully',
      userId: 'user-2',
      locked: true,
      invalidateSessions: true,
    },
  });
});

test('delete users use case invalidates deleted user sessions on success', async () => {
  const invalidations = [];
  const execute = createDeleteUsersUseCase({
    userService: {
      deleteUsers: async () => ({
        status: 200,
        body: {
          message: 'Users removed successfully',
          deletedUserIds: ['user-2', 'user-3'],
        },
      }),
    },
    sessionInvalidator: {
      invalidate: async (payload) => {
        invalidations.push(payload);
      },
    },
  });

  const response = await execute({ sessionStore: { name: 'store-2' } });

  assert.deepEqual(invalidations, [
    {
      store: { name: 'store-2' },
      userIds: ['user-2', 'user-3'],
      reason: 'admin_user_deleted',
    },
  ]);
  assert.deepEqual(response, {
    status: 200,
    body: {
      message: 'Users removed successfully',
      deletedUserIds: ['user-2', 'user-3'],
    },
  });
});
