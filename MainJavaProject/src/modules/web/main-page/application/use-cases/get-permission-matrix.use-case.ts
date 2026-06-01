function createGetPermissionMatrixUseCase({ permissionService }) {
  return async function execute(input) {
    return permissionService.getPermissionMatrix(input);
  };
}

module.exports = { createGetPermissionMatrixUseCase };
