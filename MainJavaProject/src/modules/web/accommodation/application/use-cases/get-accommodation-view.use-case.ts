function createGetAccommodationViewUseCase({ accommodationService }) {
  return async function execute(input) {
    return accommodationService.getAccommodationView(input);
  };
}

module.exports = { createGetAccommodationViewUseCase };
