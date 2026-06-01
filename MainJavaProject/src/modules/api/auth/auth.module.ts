const { createMobileAuthService } = require('./application/services/mobile-auth.service');
const { createTokenService } = require('./application/services/token.service');
const { createRefreshTokenUseCase } = require('./application/use-cases/refresh-token.use-case');
const { createAuthController } = require('./presentation/auth.controller');

function createAuthModule({ env, auditLog, repositories, tokens, metrics }) {
  const tokenService = createTokenService({
    env,
    repository: repositories.auth,
    tokens,
    auditLog,
    metrics,
  });
  const mobileAuthService = createMobileAuthService({
    env,
    repository: repositories.auth,
    tokens,
    auditLog,
  });
  const useCases = {
    checkLoginApp: mobileAuthService.checkLoginApp,
    logout: tokenService.logout,
    requestShowQr: mobileAuthService.requestShowQr,
    refreshToken: createRefreshTokenUseCase({ tokenService }),
    twoFactorVerifiedDevice: mobileAuthService.twoFactorVerifiedDevice,
    verifyDevice: mobileAuthService.verifyDevice,
  };

  return {
    controller: createAuthController({ useCases }),
  };
}

module.exports = { createAuthModule };
