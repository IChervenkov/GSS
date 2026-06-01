const { presentRenderModel } = require('../../../../../shared/presenters/view.presenter');

function createCreateLoginViewUseCase({ loginService }) {
  return async function execute(input) {
    const model = await loginService.createLoginView(input);
    return presentRenderModel(model);
  };
}

module.exports = { createCreateLoginViewUseCase };
