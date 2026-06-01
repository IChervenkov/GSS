const { toActionPayload, toActionStatus } = require('../../../../../shared/application/action-result');

function createDeleteUsersUseCase({ userService, sessionInvalidator }) {
  return async function execute(input) {
    const result = await userService.deleteUsers(input);

    if (toActionStatus(result) >= 200 && toActionStatus(result) < 300) {
      await sessionInvalidator?.invalidate({
        store: input?.sessionStore,
        userIds: toActionPayload(result)?.deletedUserIds || [],
        reason: 'admin_user_deleted',
      });
    }

    return result;
  };
}

module.exports = { createDeleteUsersUseCase };
