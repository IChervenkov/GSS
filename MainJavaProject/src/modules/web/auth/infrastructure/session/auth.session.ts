const state = require('../../../../../shared/session/web-session-state');

function buildAuthSession(req, sessionUtils) {
  const save = () => sessionUtils.saveSession(req);
  const regenerate = () => sessionUtils.regenerateSession(req);

  return {
    save,
    regenerate,
    getAuthenticatedUserId: () => state.getAuthenticatedUserId(req),
    getPendingUserId: () => state.getPendingUserId(req),
    getPendingPasswordChangeRequestId: () => state.getPendingPasswordChangeRequestId(req),
    getVerifyChallenge: () => state.getVerifyChallenge(req),
    isAuthenticated: () => state.isAuthenticated(req),
    hasPendingTwoFactor: () => state.hasPendingTwoFactor(req),

    clearPendingAuth: () => state.clearPendingAuth(req),
    clearPendingPasswordChange: () => state.clearPendingPasswordChange(req),
    clearAllAuthState: () => state.clearAllAuthState(req),

    transitionToPendingTwoFactor: async ({ userId }) => {
      await regenerate();
      state.beginPendingLogin(req, { userId });
      await save();
    },

    issueVerifyChallenge: async (verifyParams) => {
      state.beginVerifyChallenge(req, verifyParams);
      await save();
    },

    consumeApprovedQrPayload: async () => {
      state.consumeQrPayload(req);
      await save();
    },

    completeTwoFactorAuthentication: async ({ userId }) => {
      await regenerate();
      state.completeTwoFactorLogin(req, { userId });
      await save();
    },

    beginPasswordChangeApproval: async ({ userId, requestId }) => {
      state.beginPasswordChangeApproval(req, { userId, requestId });
      await save();
    },

    clearPasswordChangeApproval: async () => {
      state.clearPendingPasswordChange(req);
      await save();
    },

    finalizePasswordChange: async () => {
      await regenerate();
      state.clearAllAuthState(req);
      await save();
    },

    rotateAfterPrivilegeChange: async ({ userId }) => {
      await regenerate();
      state.completeTwoFactorLogin(req, { userId });
      await save();
    },
  };
}

module.exports = {
  buildAuthSession,
};
