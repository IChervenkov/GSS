const { createBikeAppService } = require('./application/services/bike-app.service');
const { createBikeAppController } = require('./presentation/bike-app.controller');

function createBikeAppModule({ env, auditLog, repositories, eventBus }) {
  const bikeAppService = createBikeAppService({
    env,
    auditLog,
    repositories,
    eventBus,
  });

  return {
    controller: createBikeAppController({
      useCases: bikeAppService,
    }),
  };
}

module.exports = { createBikeAppModule };
