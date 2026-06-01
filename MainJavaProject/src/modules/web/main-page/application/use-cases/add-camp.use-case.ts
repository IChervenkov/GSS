function createAddCampUseCase({ campService }) {
  return async function execute(input) {
    return campService.addCamp(input);
  };
}

module.exports = { createAddCampUseCase };
