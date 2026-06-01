function createGetBicyclesViewUseCase({ bicyclesService }) {
  return async function execute(input) {
    return bicyclesService.getBicyclesView(input);
  };
}

module.exports = { createGetBicyclesViewUseCase };
