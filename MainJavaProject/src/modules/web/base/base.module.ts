const { createLoginService } = require('./application/services/login.service');
const {
  createCreateLoginViewUseCase,
} = require('./application/use-cases/create-login-view.use-case');
const { createBaseController } = require('./presentation/base.controller');

function createBaseModule() {
  const loginService = createLoginService();
  const useCases = {
    createBaseView: createCreateLoginViewUseCase({ loginService }),
  };

  return {
    controller: createBaseController({ useCases }),
  };
}

module.exports = { createBaseModule };
