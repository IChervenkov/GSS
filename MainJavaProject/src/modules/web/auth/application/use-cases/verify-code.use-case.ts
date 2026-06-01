function createVerifyCodeUseCase({ twoFactorService }) {
  return async function execute(input) {
    return twoFactorService.verifyCode(input);
  };
}

module.exports = { createVerifyCodeUseCase };
