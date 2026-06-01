function createGetCampsUseCase({ mainPageService }) {
  return async function execute(input) {
    return mainPageService.getCampSelectorData(input);
  };
}

module.exports = { createGetCampsUseCase };
