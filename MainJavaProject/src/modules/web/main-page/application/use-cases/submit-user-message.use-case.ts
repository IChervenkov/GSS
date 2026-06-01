function createSubmitUserMessageUseCase({ userService }) {
  return function submitUserMessage(input) {
    return userService.submitUserMessage(input);
  };
}

module.exports = { createSubmitUserMessageUseCase };
