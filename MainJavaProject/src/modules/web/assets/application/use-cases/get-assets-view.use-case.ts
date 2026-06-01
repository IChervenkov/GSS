const { presentRenderModel } = require('../../../../../shared/presenters/view.presenter');

function createGetAssetsViewUseCase({ assetsPageService }) {
  return async function execute(input) {
    return presentRenderModel(await assetsPageService.getAssetsView(input));
  };
}

module.exports = { createGetAssetsViewUseCase };
