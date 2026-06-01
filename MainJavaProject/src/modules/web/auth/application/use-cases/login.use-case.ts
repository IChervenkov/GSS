function createLoginUseCase({ loginService }) {
  return async function execute(input) {
    return loginService.login(input);
  };
}

module.exports = { createLoginUseCase };
