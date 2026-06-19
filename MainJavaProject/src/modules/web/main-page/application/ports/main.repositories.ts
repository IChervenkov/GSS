function assertMethods(name, repository, methods) {
  for (const method of methods) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`${name} is missing required method: ${method}`);
    }
  }
  return repository;
}

function createMainPagePort(repository) {
  return assertMethods('mainPageRepository', repository, [
    'findMainPageContext',
    'listCampsAndPermissions',
    'campExists',
  ]);
}

function createPermissionPort(repository) {
  return assertMethods('permissionRepository', repository, [
    'listPermissionMatrix',
    'listCampAccessMatrix',
    'savePermissions',
    'saveCampAccess',
    'listCurrentUserPermissions',
    'userHasPermission',
  ]);
}

function createUserPort(repository) {
  return assertMethods('userRepository', repository, [
    'listUsers',
    'createUser',
    'findUserForEdit',
    'updateUser',
    'deleteUsers',
    'resolveApprovalRequest',
    'createUserMessage',
    'listAdminInbox',
    'updateUserMessageStatus',
    'deleteAdminInboxItem',
    'securityResetUser',
    'hashPassword',
  ]);
}

function createCampPort(repository) {
  return assertMethods('campRepository', repository, [
    'addCamp',
    'editCamp',
    'findCampById',
    'findCampByName',
    'getCampDependencySummary',
    'deleteCamp',
  ]);
}

module.exports = {
  createMainPagePort,
  createPermissionPort,
  createUserPort,
  createCampPort,
};
