function createImportCampsUseCase({ campService }) {
  return async function execute(input) {
    return campService.importCamps(input);
  };
}

module.exports = { createImportCampsUseCase };
