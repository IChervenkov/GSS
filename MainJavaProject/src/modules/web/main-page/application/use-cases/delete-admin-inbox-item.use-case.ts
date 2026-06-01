function createDeleteAdminInboxItemUseCase({ userService }) {
  return function deleteAdminInboxItem(input) {
    return userService.deleteAdminInboxItem(input);
  };
}

module.exports = { createDeleteAdminInboxItemUseCase };
