// @ts-nocheck
const {
  createMainPagePort,
  createPermissionPort,
  createUserPort,
  createCampPort,
} = require('./application/ports/main.repositories');
const { createMainPageService } = require('./application/services/main-page.service');
const { createCampService } = require('./application/services/camp.service');
const { createPermissionService } = require('./application/services/permission.service');
const { createUserService } = require('./application/services/user.service');
const { createGetMainPageUseCase } = require('./application/use-cases/get-main-page.use-case');
const { createGetCampsUseCase } = require('./application/use-cases/get-camps.use-case');
const {
  createSetCurrentCampUseCase,
} = require('./application/use-cases/set-current-camp.use-case');
const { createAddCampUseCase } = require('./application/use-cases/add-camp.use-case');
const { createEditCampUseCase } = require('./application/use-cases/edit-camp.use-case');
const { createDeleteCampUseCase } = require('./application/use-cases/delete-camp.use-case');
const {
  createDownloadCampTemplateUseCase,
} = require('./application/use-cases/download-camp-template.use-case');
const { createImportCampsUseCase } = require('./application/use-cases/import-camps.use-case');
const {
  createGetPermissionMatrixUseCase,
} = require('./application/use-cases/get-permission-matrix.use-case');
const {
  createSavePermissionsUseCase,
} = require('./application/use-cases/save-permissions.use-case');
const {
  createGetCampAccessMatrixUseCase,
} = require('./application/use-cases/get-camp-access-matrix.use-case');
const {
  createSaveCampAccessUseCase,
} = require('./application/use-cases/save-camp-access.use-case');
const {
  createGetCurrentUserPermissionsUseCase,
} = require('./application/use-cases/get-current-user-permissions.use-case');
const { createGetUsersUseCase } = require('./application/use-cases/get-users.use-case');
const { createAddUserUseCase } = require('./application/use-cases/add-user.use-case');
const { createEditUserUseCase } = require('./application/use-cases/edit-user.use-case');
const { createDeleteUsersUseCase } = require('./application/use-cases/delete-users.use-case');
const { createSecurityResetUserUseCase } = require('./application/use-cases/security-reset-user.use-case');
const {
  createResolveUserRequestUseCase,
} = require('./application/use-cases/resolve-user-request.use-case');
const {
  createSubmitUserMessageUseCase,
} = require('./application/use-cases/submit-user-message.use-case');
const { createGetAdminInboxUseCase } = require('./application/use-cases/get-admin-inbox.use-case');
const {
  createUpdateUserMessageStatusUseCase,
} = require('./application/use-cases/update-user-message-status.use-case');
const {
  createDeleteAdminInboxItemUseCase,
} = require('./application/use-cases/delete-admin-inbox-item.use-case');
const { createMainController } = require('./presentation/main-page.controller');

function createMainModule({ env, auditLog, eventBus, repositories = {}, sessionInvalidator } = {}) {
  if (!repositories.main || !repositories.permissions || !repositories.users || !repositories.camps) {
    return { controller: null, permissionChecker: async () => false };
  }

  const mainPageRepository = createMainPagePort(repositories.main);
  const permissionsRepository = createPermissionPort(repositories.permissions);
  const usersRepository = createUserPort(repositories.users);
  const campsRepository = createCampPort(repositories.camps);

  const mainPageService = createMainPageService({
    env,
    repository: {
      findMainPageContext: mainPageRepository.findMainPageContext,
      listCampsAndPermissions: mainPageRepository.listCampsAndPermissions,
      campExists: mainPageRepository.campExists,
    },
  });

  const campService = createCampService({
    repository: {
      addCamp: campsRepository.addCamp,
      editCamp: campsRepository.editCamp,
      findCampById: campsRepository.findCampById,
      findCampByName: campsRepository.findCampByName,
      getCampDependencySummary: campsRepository.getCampDependencySummary,
      deleteCamp: campsRepository.deleteCamp,
    },
    permissionRepository: {
      userHasPermission: permissionsRepository.userHasPermission,
    },
    realtime: eventBus,
    auditLog,
  });

  const permissionService = createPermissionService({
    env,
    repository: {
      listPermissionMatrix: permissionsRepository.listPermissionMatrix,
      listCampAccessMatrix: permissionsRepository.listCampAccessMatrix,
      savePermissions: permissionsRepository.savePermissions,
      saveCampAccess: permissionsRepository.saveCampAccess,
      listCurrentUserPermissions: permissionsRepository.listCurrentUserPermissions,
      userHasPermission: permissionsRepository.userHasPermission,
    },
    realtime: eventBus,
    auditLog,
  });

  const userService = createUserService({
    env,
    repository: {
      listUsers: usersRepository.listUsers,
      createUser: usersRepository.createUser,
      findUserForEdit: usersRepository.findUserForEdit,
      updateUser: usersRepository.updateUser,
      deleteUsers: usersRepository.deleteUsers,
      resolveUserRequest: usersRepository.resolveUserRequest || usersRepository.resolveApprovalRequest,
      createUserMessage: usersRepository.createUserMessage,
      listAdminInbox: usersRepository.listAdminInbox,
      updateUserMessageStatus: usersRepository.updateUserMessageStatus,
      deleteAdminInboxItem: usersRepository.deleteAdminInboxItem,
      securityResetUser: usersRepository.securityResetUser,
      hashPassword: usersRepository.hashPassword,
    },
    permissionRepository: {
      userHasPermission: permissionsRepository.userHasPermission,
    },
    realtime: eventBus,
    auditLog,
  });

  const useCases = {
    getMainPage: createGetMainPageUseCase({ mainPageService }),
    getCamps: createGetCampsUseCase({ mainPageService }),
    setCurrentCamp: createSetCurrentCampUseCase({ mainPageService }),
    addCamp: createAddCampUseCase({ campService }),
    editCamp: createEditCampUseCase({ campService }),
    deleteCamp: createDeleteCampUseCase({ campService }),
    downloadCampTemplate: createDownloadCampTemplateUseCase({ campService }),
    importCamps: createImportCampsUseCase({ campService }),
    getPermissionMatrix: createGetPermissionMatrixUseCase({ permissionService }),
    savePermissions: createSavePermissionsUseCase({ permissionService }),
    getCampAccessMatrix: createGetCampAccessMatrixUseCase({ permissionService }),
    saveCampAccess: createSaveCampAccessUseCase({ permissionService }),
    getCurrentUserPermissions: createGetCurrentUserPermissionsUseCase({ permissionService }),
    getUsers: createGetUsersUseCase({ userService }),
    addUser: createAddUserUseCase({ userService }),
    editUser: createEditUserUseCase({ userService, sessionInvalidator }),
    deleteUsers: createDeleteUsersUseCase({ userService, sessionInvalidator }),
    securityResetUser: createSecurityResetUserUseCase({ userService, sessionInvalidator }),
    resolveUserRequest: createResolveUserRequestUseCase({ userService }),
    submitUserMessage: createSubmitUserMessageUseCase({ userService }),
    getAdminInbox: createGetAdminInboxUseCase({ userService }),
    updateUserMessageStatus: createUpdateUserMessageStatusUseCase({ userService }),
    deleteAdminInboxItem: createDeleteAdminInboxItemUseCase({ userService }),
  };

  return {
    controller: createMainController({ useCases, env }),
    permissionChecker: permissionsRepository.userHasPermission,
  };
}

module.exports = { createMainModule };
