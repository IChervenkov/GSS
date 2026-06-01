function createUpdateUserMessageStatusUseCase({ userService }) {
  return function updateUserMessageStatus(input) {
    return userService.updateUserMessageStatus(input);
  };
}

module.exports = { createUpdateUserMessageStatusUseCase };
