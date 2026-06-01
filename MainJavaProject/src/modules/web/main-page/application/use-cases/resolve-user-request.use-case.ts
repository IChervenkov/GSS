function createResolveUserRequestUseCase({ userService }) {
  return async function execute(input) {
    return userService.resolveUserRequest(input);
  };
}

module.exports = { createResolveUserRequestUseCase };
