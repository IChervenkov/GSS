const { createLoginService } = require('./application/services/login.service');
const { createTwoFactorService } = require('./application/services/two-factor.service');
const { createUserRequestService } = require('./application/services/user-request.service');
const { createPasswordChangeService } = require('./application/services/password-change.service');
const {
  createUserAuthPort,
  createUserRequestPort,
  createPasswordChangePort,
} = require('./application/ports/auth.repositories');
const { createLoginUseCase } = require('./application/use-cases/login.use-case');
const { createGetVerifyViewUseCase } = require('./application/use-cases/get-verify-view.use-case');
const { createRequestQrUseCase } = require('./application/use-cases/request-qr.use-case');
const { createRequestAccessUseCase } = require('./application/use-cases/request-access.use-case');
const {
  createGetApprovedQrPayloadUseCase,
} = require('./application/use-cases/get-approved-qr-payload.use-case');
const { createVerifyCodeUseCase } = require('./application/use-cases/verify-code.use-case');
const {
  createGetChangePasswordViewUseCase,
} = require('./application/use-cases/get-change-password-view.use-case');
const { createChangePasswordUseCase } = require('./application/use-cases/change-password.use-case');
const {
  createVerifyAdminDecisionUseCase,
} = require('./application/use-cases/verify-admin-decision.use-case');
const { createAuthController } = require('./presentation/auth.controller');

function createAuthModule({ env, auditLog, eventBus, repositories, metrics }) {
  const userRepository = createUserAuthPort(repositories.users);
  const userRequestRepository = createUserRequestPort(repositories.userRequests);
  const passwordRepository = createPasswordChangePort(repositories.passwordChanges);

  const loginService = createLoginService({
    repository: {
      findUserByUsername: userRepository.findUserByUsername,
    },
    auditLog,
    metrics,
  });

  const twoFactorService = createTwoFactorService({
    env,
    repository: {
      findUserTotpSecretById: userRepository.findUserTotpSecretById,
      updateUserTotpSecret: userRepository.updateUserTotpSecret,
    },
    auditLog,
    metrics,
  });

  const userRequestService = createUserRequestService({
    repository: {
      userHasPermission: userRepository.userHasPermission,
      createUserRequest: userRequestRepository.createUserRequest,
      resolveUserRequest: userRequestRepository.resolveUserRequest,
      findUserRequest: userRequestRepository.findUserRequest,
      createPublicAccessMessage: repositories.userRequests.createPublicAccessMessage,
    },
    eventBus,
    qrPayloadTtlSeconds: env.ONE_TIME_QR_TTL_SECONDS,
    auditLog,
    metrics,
  });

  const passwordChangeService = createPasswordChangeService({
    env,
    repository: {
      findUserByUsername: userRepository.findUserByUsername,
      createUserRequest: userRequestRepository.createUserRequest,
      findPasswordChangeRequest: passwordRepository.findPasswordChangeRequest,
      completePasswordChange: passwordRepository.completePasswordChange,
    },
    eventBus,
    auditLog,
    metrics,
  });

  const useCases = {
    login: createLoginUseCase({ loginService }),
    requestAccess: createRequestAccessUseCase({ userRequestService }),
    getVerifyView: createGetVerifyViewUseCase({ twoFactorService }),
    requestQr: createRequestQrUseCase({ userRequestService }),
    getApprovedQrPayload: createGetApprovedQrPayloadUseCase({ userRequestService }),
    verifyCode: createVerifyCodeUseCase({ twoFactorService }),
    getChangePasswordView: createGetChangePasswordViewUseCase({ passwordChangeService }),
    changePassword: createChangePasswordUseCase({ passwordChangeService }),
    verifyAdminDecision: createVerifyAdminDecisionUseCase({ userRequestService }),
  };

  return {
    controller: createAuthController({ useCases, env, auditLog }),
    permissionChecker: userRepository.userHasPermission,
  };
}

module.exports = { createAuthModule };
