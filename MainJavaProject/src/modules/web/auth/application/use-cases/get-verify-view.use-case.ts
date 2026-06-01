const { presentRenderModel } = require('../../../../../shared/presenters/view.presenter');

function createGetVerifyViewUseCase({ twoFactorService }) {
  return async function execute(input) {
    const model = await twoFactorService.getVerifyView(input);
    return presentRenderModel(model);
  };
}

module.exports = { createGetVerifyViewUseCase };
