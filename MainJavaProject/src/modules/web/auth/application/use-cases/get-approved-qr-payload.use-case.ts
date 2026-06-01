function createGetApprovedQrPayloadUseCase({ userRequestService }) {
  return async function execute(input) {
    return userRequestService.getApprovedQrPayload(input);
  };
}

module.exports = { createGetApprovedQrPayloadUseCase };
