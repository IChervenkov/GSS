const { presentLogoutResponse, presentTokenResponse } = require('./auth.presenter');
const { buildRequestMeta } = require('../../../../shared/security/audit-log');
const { jsonResponse } = require('../../../../shared/http/response-contract');

function createAuthController({ useCases }) {
  return {
    checkLoginApp: async (req) => {
      return jsonResponse(
        await useCases.checkLoginApp({
          ...(req.body || {}),
          requestMeta: buildRequestMeta(req),
        }),
      );
    },
    logout: async (req) => {
      return presentLogoutResponse(
        await useCases.logout({
          refreshToken: req.body?.refreshToken,
          deviceId: req.body?.deviceId,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },
    token: async (req) => {
      const model = await useCases.refreshToken({
        ...(req.body || {}),
        clientFingerprint:
          req?.body?.clientFingerprint || req?.headers?.['x-client-fingerprint'] || null,
        requestMeta: buildRequestMeta(req),
      });
      return presentTokenResponse(model);
    },
    twoFactorVerifiedDevice: async (req) => {
      return jsonResponse(
        await useCases.twoFactorVerifiedDevice({
          ...(req.query || {}),
          requestMeta: buildRequestMeta(req),
        }),
      );
    },
    requestShowQr: async (req) => {
      return jsonResponse(
        await useCases.requestShowQr({
          ...(req.query || {}),
          requestMeta: buildRequestMeta(req),
        }),
      );
    },
    verifyDevice: async (req) => {
      return presentTokenResponse(
        await useCases.verifyDevice({
          ...(req.body || {}),
          requestMeta: buildRequestMeta(req),
        }),
      );
    },
  };
}

module.exports = { createAuthController };
