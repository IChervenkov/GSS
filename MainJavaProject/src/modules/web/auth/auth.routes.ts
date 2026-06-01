const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const { noCache } = require('../../../shared/http/no-cache');
const { buildGetRoute, buildPostRoute } = require('../../../shared/http/route-builders');
const { createAuthModule } = require('./auth.module');
const {
  createRateLimitMiddleware,
  createSlowDownMiddleware,
  getClientIp,
} = require('../../../shared/http/rate-limit');
const { requirePermission } = require('../../../shared/http/permission-guard');
const { MAIN_PERMISSIONS } = require('../main-page/domain/main.permissions');
const {
  passwordChangeRequestDto,
  verifyAdminDecisionRequestDto,
  loginRequestDto,
  requestAccessRequestDto,
  verifyCodeRequestDto,
  approvedQrPayloadQueryDto,
  requestQrRequestDto,
  logoutRequestDto,
} = require('./presentation/http/auth.request.dto');
const { hasPendingTwoFactor } = require('../../../shared/session/web-session-state');
const { ERROR_CODES } = require('../../../shared/errors/error-codes');

function requirePendingTwoFactor() {
  return (req, _res, next) => {
    if (hasPendingTwoFactor(req)) return next();
    return next(
      new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Security check failed. Please sign in again.',
      }),
    );
  };
}

function createRateLimiters(env, rateLimitStore) {
  return {
    loginSlowDownByIp: createSlowDownMiddleware({
      windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
      delayAfter: 3,
      delayMs: 250,
      store: rateLimitStore,
    }),
    loginRateByIp: createRateLimitMiddleware({
      key: (req) => `login:ip:${getClientIp(req)}`,
      windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
      max: env.LOGIN_RATE_LIMIT_MAX_BY_IP,
      blockMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
      message: 'Too many sign-in attempts from this address. Please try again later.',
      store: rateLimitStore,
    }),
    loginRateByUsername: createRateLimitMiddleware({
      key: (req) =>
        `login:user:${
          String(req.body?.username || '')
            .trim()
            .toLowerCase() || 'unknown'
        }`,
      windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
      max: env.LOGIN_RATE_LIMIT_MAX_BY_USERNAME,
      blockMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
      message: 'Too many sign-in attempts for this account. Please try again later.',
      store: rateLimitStore,
    }),
    qrRequestRateLimit: createRateLimitMiddleware({
      key: (req) => `qr:${req.session?.pendingUserId || getClientIp(req)}`,
      windowMs: env.QR_REQUEST_RATE_LIMIT_WINDOW_MS,
      max: env.QR_REQUEST_RATE_LIMIT_MAX,
      blockMs: env.QR_REQUEST_RATE_LIMIT_WINDOW_MS,
      message: 'Too many QR requests. Please wait before requesting another one.',
      store: rateLimitStore,
    }),
    passwordChangeRateLimit: createRateLimitMiddleware({
      key: (req) =>
        `password-change:${
          String(req.body?.username || '')
            .trim()
            .toLowerCase() || getClientIp(req)
        }`,
      windowMs: env.PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS,
      max: env.PASSWORD_CHANGE_RATE_LIMIT_MAX,
      blockMs: env.PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS,
      message: 'Too many password change attempts. Please try again later.',
      store: rateLimitStore,
    }),
  };
}

function wirePublicRoutes(router, controller, limiters) {
  buildGetRoute(router, '/password/change/data', null, noCache, controller.changePasswordPage);
  buildPostRoute(
    router,
    '/password/change',
    limiters.passwordChangeRateLimit,
    passwordChangeRequestDto,
    controller.changePassword,
  );
  buildPostRoute(
    router,
    '/login',
    limiters.loginSlowDownByIp,
    limiters.loginRateByIp,
    limiters.loginRateByUsername,
    loginRequestDto,
    controller.login,
  );
  buildPostRoute(
    router,
    '/request-access',
    requestAccessRequestDto,
    controller.requestAccess,
  );
}

function wirePendingTwoFactorRoutes(router, controller, limiters) {
  const requirePending = requirePendingTwoFactor();
  buildGetRoute(router, '/login/verify/data', null, requirePending, noCache, controller.verifyPage);
  buildGetRoute(
    router,
    '/login/request-qr/payload',
    approvedQrPayloadQueryDto,
    requirePending,
    controller.getApprovedQrPayload,
  );
  buildPostRoute(
    router,
    '/login/request-qr',
    requirePending,
    limiters.qrRequestRateLimit,
    requestQrRequestDto,
    controller.requestQr,
  );
  buildPostRoute(router, '/verify', requirePending, verifyCodeRequestDto, controller.verifyCode);
}

function wireProtectedRoutes(router, controller, permissionChecker) {
  buildPostRoute(
    router,
    '/admin/verify',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    verifyAdminDecisionRequestDto,
    controller.verifyAdminDecision,
  );
  buildPostRoute(router, '/logout', logoutRequestDto, controller.logout);
}

function createRouteSet({ env, rateLimitStore, ...moduleDependencies }) {
  const { controller, permissionChecker } = createAuthModule({ env, ...moduleDependencies });

  if (!controller) {
    throw new AppError({ status: 500, message: 'Auth controller not wired' });
  }

  const publicRouter = express.Router();
  const protectedRouter = express.Router();
  const limiters = createRateLimiters(env, rateLimitStore);

  wirePublicRoutes(publicRouter, controller, limiters);
  wirePendingTwoFactorRoutes(publicRouter, controller, limiters);
  wireProtectedRoutes(protectedRouter, controller, permissionChecker);

  return { publicRouter, protectedRouter };
}

function createWebAuthRouter(options = {}) {
  const { publicRouter, protectedRouter } = createRouteSet(options);
  const router = express.Router();
  router.use(publicRouter);
  router.use(protectedRouter);
  return router;
}

function createWebAuthPublicRouter(options = {}) {
  return createRouteSet(options).publicRouter;
}

function createWebAuthProtectedRouter(options = {}) {
  return createRouteSet(options).protectedRouter;
}

module.exports = {
  createWebAuthRouter,
  createWebAuthPublicRouter,
  createWebAuthProtectedRouter,
};
