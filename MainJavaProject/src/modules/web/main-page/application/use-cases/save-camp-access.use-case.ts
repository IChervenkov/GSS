function createSaveCampAccessUseCase({ permissionService }) {
  return function saveCampAccess(input) {
    return permissionService.saveCampAccess(input);
  };
}

module.exports = { createSaveCampAccessUseCase };
