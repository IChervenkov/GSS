function createGetCurrentUserPermissionsUseCase({ permissionService }) {
  return async function execute(input) {
    return permissionService.getCurrentUserPermissions(input);
  };
}

module.exports = { createGetCurrentUserPermissionsUseCase };
