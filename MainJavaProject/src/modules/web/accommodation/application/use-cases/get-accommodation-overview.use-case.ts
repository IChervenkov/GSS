function createGetAccommodationOverviewUseCase({ accommodationService }) {
  return async function execute(input) {
    return accommodationService.getAccommodationOverview(input);
  };
}

module.exports = { createGetAccommodationOverviewUseCase };
