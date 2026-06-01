const { presentRenderModel } = require('../../../../../shared/presenters/view.presenter');

function createGetLaundryViewUseCase({ laundryPageService }) {
  return async function execute(input) {
    return presentRenderModel(await laundryPageService.getLaundryView(input));
  };
}

module.exports = { createGetLaundryViewUseCase };
