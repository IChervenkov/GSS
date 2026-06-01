const { toActionPayload, toActionStatus } = require('../../../../../shared/application/action-result');

function createSecurityResetUserUseCase({ userService, sessionInvalidator }) {
  return async function execute(input) {
    const result = await userService.securityResetUser(input);

    if (
      toActionStatus(result) >= 200 &&
      toActionStatus(result) < 300 &&
      toActionPayload(result)?.userId
    ) {
      await sessionInvalidator?.invalidate({
        store: input?.sessionStore,
        userIds: [toActionPayload(result).userId],
        reason: 'admin_security_reset',
      });
    }

    return result;
  };
}

module.exports = { createSecurityResetUserUseCase };
