const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const { buildGetRoute, buildPostRoute } = require('../../../shared/http/route-builders');
const { createAuthModule } = require('./auth.module');
const {
  logoutRequestDto,
  mobileLoginRequestDto,
  mobileTwoFactorQueryDto,
  mobileVerifyDeviceRequestDto,
  refreshTokenRequestDto,
} = require('./presentation/http/auth.request.dto');

function createApiAuthRouter({ env, ...moduleDependencies }) {
  const router = express.Router();
  const { controller } = createAuthModule({ env, ...moduleDependencies });

  if (!controller) {
    throw new AppError({ status: 500, message: 'Auth controller not wired' });
  }

  buildPostRoute(router, '/checkLogInApp', mobileLoginRequestDto, controller.checkLoginApp);
  buildGetRoute(router, '/2fa-verificated-device', mobileTwoFactorQueryDto, controller.twoFactorVerifiedDevice);
  buildGetRoute(router, '/requestShowQr', mobileTwoFactorQueryDto, controller.requestShowQr);
  buildPostRoute(router, '/verify-device', mobileVerifyDeviceRequestDto, controller.verifyDevice);
  buildPostRoute(router, '/token', refreshTokenRequestDto, controller.token);
  buildPostRoute(router, '/logout', logoutRequestDto, controller.logout);

  return router;
}

module.exports = { createApiAuthRouter };
