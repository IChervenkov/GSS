function createAddUserUseCase({ userService }) {
  return async function execute(input) {
    return userService.addUser(input);
  };
}

module.exports = { createAddUserUseCase };
