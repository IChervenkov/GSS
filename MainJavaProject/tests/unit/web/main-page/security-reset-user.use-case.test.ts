const test = require('node:test');
const assert = require('node:assert/strict');

const { createSecurityResetUserUseCase } = require('../../../../src/modules/web/main-page/application/use-cases/security-reset-user.use-case');

test('security reset invalidates target user sessions after success', async () => {
  const calls = [];
  const useCase = createSecurityResetUserUseCase({
    userService: {
      securityResetUser: async () => ({
        status: 200,
        body: { message: 'ok', userId: 'user-2', invalidateSessions: true, tokenVersion: 4 },
      }),
    },
    sessionInvalidator: {
      invalidate: async (payload) => calls.push(payload),
    },
  });

  const result = await useCase({ sessionStore: { name: 'store' } });
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [
    { store: { name: 'store' }, userIds: ['user-2'], reason: 'admin_security_reset' },
  ]);
});
