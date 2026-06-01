const { createBicyclesPort } = require('./application/ports/bicycles.repositories');
const { createBicyclesService } = require('./application/services/bicycles.service');
const {
  createGetBicyclesOverviewUseCase,
} = require('./application/use-cases/get-bicycles-overview.use-case');
const {
  createGetBicyclesViewUseCase,
} = require('./application/use-cases/get-bicycles-view.use-case');
const { createBicyclesController } = require('./presentation/bicycles.controller');

function createBicyclesModule({ repositories, eventBus, auditLog, env }) {
  const repository = createBicyclesPort(repositories.bicycles);
  const bicyclesService = createBicyclesService({
    repository,
    realtime: eventBus,
    auditLog,
    env,
  });

  const useCases = {
    getBicyclesView: createGetBicyclesViewUseCase({ bicyclesService }),
    getBicyclesOverview: createGetBicyclesOverviewUseCase({ bicyclesService }),
    listSoldiers: bicyclesService.listSoldiers,
    listAvailableHelmets: bicyclesService.listAvailableHelmets,
    addBicycle: bicyclesService.addBicycle,
    addHelmet: bicyclesService.addHelmet,
    editBicycle: bicyclesService.editBicycle,
    editHelmet: bicyclesService.editHelmet,
    deleteBicycle: bicyclesService.deleteBicycle,
    deleteHelmet: bicyclesService.deleteHelmet,
    rentBicycle: bicyclesService.rentBicycle,
    returnBicycle: bicyclesService.returnBicycle,
    getActiveAssignmentsBySoldier: bicyclesService.getActiveAssignmentsBySoldier,
    getBicycleRentalReport: bicyclesService.getBicycleRentalReport,
    getRecentRentalsByAsset: bicyclesService.getRecentRentalsByAsset,
    listReportAssets: bicyclesService.listReportAssets,
    listReportSoldiers: bicyclesService.listReportSoldiers,
    downloadBicycleRentalReport: bicyclesService.downloadBicycleRentalReport,
    downloadBicycleTemplate: bicyclesService.downloadBicycleTemplate,
    downloadHelmetTemplate: bicyclesService.downloadHelmetTemplate,
    downloadBikeMobileApp: bicyclesService.downloadBikeMobileApp,
    importBicycles: bicyclesService.importBicycles,
    importHelmets: bicyclesService.importHelmets,
  };

  return {
    permissionChecker: repository.userHasPermission,
    controller: createBicyclesController({
      useCases,
    }),
  };
}

module.exports = { createBicyclesModule };
