function createVerifyAdminDecisionUseCase({ userRequestService }) {
  return async function execute(input) {
    return userRequestService.verifyAdminDecision(input);
  };
}

module.exports = { createVerifyAdminDecisionUseCase };
