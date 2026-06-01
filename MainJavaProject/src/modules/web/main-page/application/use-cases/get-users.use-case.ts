function createGetUsersUseCase({ userService }) {
  return async function execute(input) {
    return userService.getUsers(input);
  };
}

module.exports = { createGetUsersUseCase };
