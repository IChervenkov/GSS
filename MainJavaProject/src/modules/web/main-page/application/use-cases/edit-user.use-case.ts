const { toActionPayload, toActionStatus } = require('../../../../../shared/application/action-result');

function createEditUserUseCase({ userService, sessionInvalidator }) {
  return async function execute(input) {
    const result = await userService.editUser(input);

    if (
      toActionStatus(result) >= 200 &&
      toActionStatus(result) < 300 &&
      toActionPayload(result)?.invalidateSessions
    ) {
      await sessionInvalidator?.invalidate({
        store: input?.sessionStore,
        userIds: [toActionPayload(result)?.userId].filter(Boolean),
        reason: 'admin_account_locked',
      });
    }

    return result;
  };
}

module.exports = { createEditUserUseCase };
