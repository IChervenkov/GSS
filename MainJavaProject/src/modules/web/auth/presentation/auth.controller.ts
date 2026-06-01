const { destroySessionAndClearCookie } = require('../../../../shared/utils/session-utils');
const {
  presentAuthAction,
  presentAuthRedirect,
  presentVerifyView,
  presentChangePasswordView,
} = require('./auth.presenter');
const { AUDIT_EVENT_NAMES } = require('../../../../shared/security/audit-event-names');
const { buildRequestMeta } = require('../../../../shared/security/audit-log');
const { buildAuthRequestContext } = require('./http/auth.request-context');
const { authSuccess } = require('../../../../shared/application/action-result');
const { wantsJsonResponse } = require('../../../../shared/http/request-format');

function createAuthController({ useCases, env, auditLog }) {
  return {
    login: async (req) => {
      const { authSession, attemptTracker } = buildAuthRequestContext(req);
      const result = await useCases.login({
        authSession,
        attemptTracker,
        requestMeta: buildRequestMeta(req),
        ...req.body,
      });
      return presentAuthAction(result);
    },

    requestAccess: async (req) => {
      const result = await useCases.requestAccess({
        requestMeta: buildRequestMeta(req),
        name: req.body?.name,
        email: req.body?.email,
        team: req.body?.team,
        access: req.body?.access,
        reason: req.body?.reason,
      });
      return presentAuthAction(result);
    },

    verifyPage: async (req, res) => {
      const { authSession } = buildAuthRequestContext(req);
      const model = await useCases.getVerifyView({
        pendingUserId: authSession.getPendingUserId(),
        authSession,
        requestMeta: buildRequestMeta(req),
      });
      return presentVerifyView({
        ...model,
        csrfToken: res.locals?.csrfToken || req.session?.csrfToken || null,
      });
    },

    requestQr: async (req) => {
      const { authSession } = buildAuthRequestContext(req);
      const verifyChallenge = authSession.getVerifyChallenge();
      const result = await useCases.requestQr({
        pendingUserId: authSession.getPendingUserId(),
        challengeExpiresAt: verifyChallenge.expiresAt,
        requestMeta: buildRequestMeta(req),
      });
      return presentAuthAction(result);
    },

    getApprovedQrPayload: async (req) => {
      const { authSession } = buildAuthRequestContext(req);
      const verifyChallenge = authSession.getVerifyChallenge();
      const result = await useCases.getApprovedQrPayload({
        pendingUserId: authSession.getPendingUserId(),
        qrCodeDataURL: verifyChallenge.qrCodeDataURL,
        qrRequestId: verifyChallenge.qrRequestId,
        challengeExpiresAt: verifyChallenge.expiresAt,
        markQrPayloadConsumed: () => authSession.consumeApprovedQrPayload(),
        requestId: String(req.query?.requestId || '').trim(),
        requestMeta: buildRequestMeta(req),
      });
      return presentAuthAction(result);
    },

    verifyCode: async (req) => {
      const { authSession, attemptTracker } = buildAuthRequestContext(req);
      const verifyChallenge = authSession.getVerifyChallenge();
      const result = await useCases.verifyCode({
        authSession,
        attemptTracker,
        pendingUserId: authSession.getPendingUserId(),
        userSecret: verifyChallenge.secret,
        challengeExpiresAt: verifyChallenge.expiresAt,
        code: req.body?.code,
        requestMeta: buildRequestMeta(req),
      });
      return presentAuthAction(result);
    },

    changePasswordPage: async (req, res) => {
      const model = await useCases.getChangePasswordView();
      return presentChangePasswordView({
        ...model,
        csrfToken: res.locals?.csrfToken || req.session?.csrfToken || null,
      });
    },

    changePassword: async (req) => {
      const { authSession, attemptTracker } = buildAuthRequestContext(req);
      const result = await useCases.changePassword({
        authSession,
        attemptTracker,
        passwordChangeRequestId: authSession.getPendingPasswordChangeRequestId(),
        requestMeta: buildRequestMeta(req),
        username: req.body?.username,
        currentPassword: req.body?.currentPassword,
        newPassword: req.body?.newPassword,
      });
      return presentAuthAction(result);
    },

    verifyAdminDecision: async (req) => {
      const result = await useCases.verifyAdminDecision({
        actorUserId: req.session?.userId,
        requestMeta: buildRequestMeta(req),
        ...req.body,
      });
      return presentAuthAction(result);
    },

    logout: async (req, res) => {
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.LOGOUT_COMPLETED, { ...buildRequestMeta(req), actorUserId: req.session?.userId || req.user?.id || null });
      await destroySessionAndClearCookie(req, res, env, { reason: 'logout' });
      if (!wantsJsonResponse(req)) {
        return presentAuthRedirect('/');
      }
      return presentAuthAction(authSuccess('login'));
    },
  };
}

module.exports = { createAuthController };
