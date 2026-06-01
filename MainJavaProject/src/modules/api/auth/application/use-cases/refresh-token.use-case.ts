function createRefreshTokenUseCase({ tokenService }) {
  return async function execute(input) {
    return tokenService.refreshToken(input);
  };
}

module.exports = { createRefreshTokenUseCase };
