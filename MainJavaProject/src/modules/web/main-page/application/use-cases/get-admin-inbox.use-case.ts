function createGetAdminInboxUseCase({ userService }) {
  return function getAdminInbox(input) {
    return userService.getAdminInbox(input);
  };
}

module.exports = { createGetAdminInboxUseCase };
