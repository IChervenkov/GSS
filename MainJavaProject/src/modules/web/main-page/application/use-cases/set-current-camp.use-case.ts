function createSetCurrentCampUseCase({ mainPageService }) {
  return async function execute(input) {
    return mainPageService.setCurrentCamp(input);
  };
}

module.exports = { createSetCurrentCampUseCase };
