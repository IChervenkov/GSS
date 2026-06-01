function createRequestAccessUseCase({ userRequestService }) {
  return function requestAccess(input) {
    return userRequestService.requestAccess(input);
  };
}

module.exports = { createRequestAccessUseCase };
