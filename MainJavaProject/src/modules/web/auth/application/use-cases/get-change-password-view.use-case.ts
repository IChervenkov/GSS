const { presentRenderModel } = require('../../../../../shared/presenters/view.presenter');

function createGetChangePasswordViewUseCase({ passwordChangeService }) {
  return async function execute() {
    const model = await passwordChangeService.getChangePasswordView();
    return presentRenderModel(model);
  };
}

module.exports = { createGetChangePasswordViewUseCase };
