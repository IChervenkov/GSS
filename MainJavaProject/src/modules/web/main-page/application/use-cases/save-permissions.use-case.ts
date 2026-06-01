function createSavePermissionsUseCase({ permissionService }) {
  return async function execute(input) {
    return permissionService.savePermissions(input);
  };
}

module.exports = { createSavePermissionsUseCase };
