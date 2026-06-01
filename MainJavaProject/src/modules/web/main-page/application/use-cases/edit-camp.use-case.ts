function createEditCampUseCase({ campService }) {
  return async function execute(input) {
    return campService.editCamp(input);
  };
}

module.exports = { createEditCampUseCase };
