function createDownloadCampTemplateUseCase({ campService }) {
  return async function execute(input) {
    return campService.downloadCampTemplate(input);
  };
}

module.exports = { createDownloadCampTemplateUseCase };
