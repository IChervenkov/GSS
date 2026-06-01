function createDeleteCampUseCase({ campService }) {
  return async function execute(input) {
    return campService.removeCamp(input);
  };
}

module.exports = { createDeleteCampUseCase };
