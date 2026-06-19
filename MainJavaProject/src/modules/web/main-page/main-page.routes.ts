// @ts-nocheck
const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const {
  buildGetRoute,
  buildPostRoute,
  buildDeleteRoute,
} = require('../../../shared/http/route-builders');
const { createMainModule } = require('./main.module');
const { requirePermission, requireAnyPermission } = require('../../../shared/http/permission-guard');
const { noCache } = require('../../../shared/http/no-cache');
const { MAIN_PERMISSIONS } = require('./domain/main.permissions');
const {
  campsDataRequestDto,
  campChangeRequestDto,
  campAddRequestDto,
  campEditRequestDto,
  campDeleteRequestDto,
  campImportRequestDto,
  permissionsDataRequestDto,
  permissionsSaveRequestDto,
  campAccessDataRequestDto,
  campAccessSaveRequestDto,
  usersDataRequestDto,
  addUserRequestDto,
  editUserRequestDto,
  deleteUserRequestDto,
  securityResetUserRequestDto,
  resolveUserRequestDto,
  submitUserMessageRequestDto,
  adminInboxRequestDto,
  updateUserMessageStatusRequestDto,
  deleteAdminInboxItemRequestDto,
  logoutRequestDto,
} = require('./presentation/http/main-page.request.dto');

function createCampPermissionGuard(permissionChecker, ...permissionNames) {
  return requireAnyPermission(permissionChecker, [MAIN_PERMISSIONS.full, ...permissionNames]);
}

function createWebMainRouter({ env, upload, ...moduleDependencies } = {}) {
  const router = express.Router();
  const { controller, permissionChecker } = createMainModule({ env, ...moduleDependencies });

  if (!controller) {
    return router;
  }

  buildGetRoute(router, '/main-page', null, noCache, controller.mainPage);

  buildGetRoute(router, '/camp/data', campsDataRequestDto, controller.campsData);
  buildGetRoute(
    router,
    '/camp/template',
    createCampPermissionGuard(permissionChecker, MAIN_PERMISSIONS.addCamp, MAIN_PERMISSIONS.editCamp),
    controller.downloadCampTemplate,
  );
  buildPostRoute(router, '/camp/set', campChangeRequestDto, controller.setCamp);
  buildPostRoute(
    router,
    '/camp/add',
    createCampPermissionGuard(permissionChecker, MAIN_PERMISSIONS.addCamp),
    campAddRequestDto,
    controller.addCamp,
  );
  buildPostRoute(
    router,
    '/camp/import',
    createCampPermissionGuard(permissionChecker, MAIN_PERMISSIONS.addCamp, MAIN_PERMISSIONS.editCamp),
    upload.single('file'),
    campImportRequestDto,
    controller.importCamps,
  );
  buildPostRoute(
    router,
    '/camp/edit',
    createCampPermissionGuard(permissionChecker, MAIN_PERMISSIONS.editCamp),
    campEditRequestDto,
    controller.editCamp,
  );
  buildPostRoute(
    router,
    '/camp/delete',
    createCampPermissionGuard(permissionChecker, MAIN_PERMISSIONS.deleteCamp),
    campDeleteRequestDto,
    controller.deleteCamp,
  );

  buildGetRoute(
    router,
    '/permissions/data',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    permissionsDataRequestDto,
    controller.permissionsData,
  );
  buildPostRoute(
    router,
    '/permissions/save',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    permissionsSaveRequestDto,
    controller.permissionsSave,
  );
  buildGetRoute(
    router,
    '/camp-access/data',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    campAccessDataRequestDto,
    controller.campAccessData,
  );
  buildPostRoute(
    router,
    '/camp-access/save',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    campAccessSaveRequestDto,
    controller.campAccessSave,
  );
  buildGetRoute(router, '/permission/current-user', controller.currentUserPermissions);

  buildGetRoute(
    router,
    '/user/data',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    usersDataRequestDto,
    controller.usersData,
  );
  buildPostRoute(
    router,
    '/user/add',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    addUserRequestDto,
    controller.addUser,
  );
  buildPostRoute(
    router,
    '/user/edit',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    editUserRequestDto,
    controller.editUser,
  );
  buildDeleteRoute(
    router,
    '/user/delete',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    deleteUserRequestDto,
    controller.deleteUser,
  );

  buildPostRoute(
    router,
    '/user/security-reset',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    securityResetUserRequestDto,
    controller.securityResetUser,
  );

  buildPostRoute(
    router,
    '/user/request/decision',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    resolveUserRequestDto,
    controller.resolveUserRequest,
  );

  buildPostRoute(
    router,
    '/user/message',
    submitUserMessageRequestDto,
    controller.submitUserMessage,
  );
  buildGetRoute(
    router,
    '/admin/inbox',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    adminInboxRequestDto,
    controller.adminInbox,
  );
  buildPostRoute(
    router,
    '/admin/message/status',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    updateUserMessageStatusRequestDto,
    controller.updateUserMessageStatus,
  );
  buildDeleteRoute(
    router,
    '/admin/inbox',
    requirePermission(permissionChecker, MAIN_PERMISSIONS.system),
    deleteAdminInboxItemRequestDto,
    controller.deleteAdminInboxItem,
  );

  buildPostRoute(router, '/logout', logoutRequestDto, controller.logoutApi);

  return router;
}

module.exports = { createWebMainRouter };
