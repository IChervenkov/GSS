const { presentRenderModel } = require('../../../../../shared/presenters/view.presenter');

function createGetMainPageUseCase({ mainPageService }) {
  return async function execute(input) {
    const result = await mainPageService.getMainPage(input);
    return presentRenderModel(result);
  };
}

module.exports = { createGetMainPageUseCase };
