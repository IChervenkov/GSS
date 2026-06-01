const { destroySessionAndClearCookie } = require('../../../../shared/utils/session-utils');
const { buildRequestMeta } = require('../../../../shared/security/audit-log');
const { buildMainSession } = require('../infrastructure/session/main.session');
const {
  presentMainAction,
  presentFileResult,
  presentMainPageView,
  presentWebRedirect,
} = require('./main.presenter');
const {
  normalizeSearchQuery,
  readCurrentCampId,
  readMainPageSessionState,
  readSessionUserId,
} = require('./http/main.request-context');
const { success } = require('../../../../shared/application/action-result');
const { wantsJsonResponse } = require('../../../../shared/http/request-format');

function createMainController({ useCases, env }) {
  function respondWithJson(result) {
    return presentMainAction(result);
  }

  return {
    mainPage: async (req) => {
      const model = await useCases.getMainPage({
        userId: readSessionUserId(req),
        sessionState: readMainPageSessionState(req),
        mainSession: buildMainSession(req),
      });

      return presentMainPageView(model);
    },

    campsData: async (req) => {
      return respondWithJson(
        await useCases.getCamps({
          userId: readSessionUserId(req),
          ...normalizeSearchQuery(req.query),
        }),
      );
    },

    setCamp: async (req) => {
      return respondWithJson(
        await useCases.setCurrentCamp({
          campId: req.body?.campId,
          mainSession: buildMainSession(req),
        }),
      );
    },

    currentUserPermissions: async (req) => {
      return respondWithJson(
        await useCases.getCurrentUserPermissions({ userId: readSessionUserId(req) }),
      );
    },

    addCamp: async (req) => {
      return respondWithJson(
        await useCases.addCamp({
          actorUserId: readSessionUserId(req),
          campName: req.body?.campName,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    downloadCampTemplate: async () => {
      return presentFileResult(await useCases.downloadCampTemplate());
    },

    importCamps: async (req) => {
      return respondWithJson(
        await useCases.importCamps({
          actorUserId: readSessionUserId(req),
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    editCamp: async (req) => {
      return respondWithJson(
        await useCases.editCamp({
          actorUserId: readSessionUserId(req),
          campId: req.body?.campId,
          campName: req.body?.campName,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    deleteCamp: async (req) => {
      return respondWithJson(
        await useCases.deleteCamp({
          actorUserId: readSessionUserId(req),
          campId: req.body?.campId,
          currentCampId: readCurrentCampId(req),
          mainSession: buildMainSession(req),
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    permissionsData: async (req) => {
      return respondWithJson(await useCases.getPermissionMatrix(normalizeSearchQuery(req.query)));
    },

    permissionsSave: async (req) => {
      return respondWithJson(
        await useCases.savePermissions({
          actorUserId: readSessionUserId(req),
          changes: req.body?.permissions,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    usersData: async (req) => {
      return respondWithJson(await useCases.getUsers(normalizeSearchQuery(req.query)));
    },

    addUser: async (req) => {
      return respondWithJson(
        await useCases.addUser({
          actorUserId: readSessionUserId(req),
          username: req.body?.username,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    editUser: async (req) => {
      return respondWithJson(
        await useCases.editUser({
          actorUserId: readSessionUserId(req),
          userId: req.body?.id,
          username: req.body?.username,
          password: req.body?.password,
          locked: req.body?.locked,
          requestMeta: buildRequestMeta(req),
          sessionStore: req.sessionStore,
        }),
      );
    },

    deleteUser: async (req) => {
      return respondWithJson(
        await useCases.deleteUsers({
          actorUserId: readSessionUserId(req),
          sessionUserId: readSessionUserId(req),
          userIds: req.body?.codes || [],
          requestMeta: buildRequestMeta(req),
          sessionStore: req.sessionStore,
        }),
      );
    },

    securityResetUser: async (req) => {
      return respondWithJson(
        await useCases.securityResetUser({
          actorUserId: readSessionUserId(req),
          userId: req.body?.userId,
          requestMeta: buildRequestMeta(req),
          sessionStore: req.sessionStore,
        }),
      );
    },

    resolveUserRequest: async (req) => {
      return respondWithJson(
        await useCases.resolveUserRequest({
          actorUserId: readSessionUserId(req),
          requestId: req.body?.requestId,
          decision: req.body?.decision,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    logoutApi: async (req, res) => {
      await destroySessionAndClearCookie(req, res, env, { reason: 'logout' });
      if (!wantsJsonResponse(req)) {
        return presentWebRedirect('/');
      }
      return presentMainAction(success({ success: true }));
    },
  };
}

module.exports = { createMainController };
