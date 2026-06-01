function createRequestQrUseCase({ userRequestService }) {
  return async function execute(input) {
    return userRequestService.requestQr(input);
  };
}

module.exports = { createRequestQrUseCase };
