function createChangePasswordUseCase({ passwordChangeService }) {
  return async function execute(input) {
    return passwordChangeService.changePassword(input);
  };
}

module.exports = { createChangePasswordUseCase };
