function createGetCampAccessMatrixUseCase({ permissionService }) {
  return function getCampAccessMatrix(input) {
    return permissionService.getCampAccessMatrix(input);
  };
}

module.exports = { createGetCampAccessMatrixUseCase };
