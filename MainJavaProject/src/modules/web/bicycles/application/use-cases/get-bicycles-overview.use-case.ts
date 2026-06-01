function createGetBicyclesOverviewUseCase({ bicyclesService }) {
  return async function execute(input) {
    return bicyclesService.getBicyclesOverview(input);
  };
}

module.exports = { createGetBicyclesOverviewUseCase };
