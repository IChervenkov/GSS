const { createLaundryPort } = require('./application/ports/laundry.repositories');
const { createLaundryPageService } = require('./application/services/laundry-page.service');
const {
  createGetLaundryViewUseCase,
} = require('./application/use-cases/get-laundry-view.use-case');
const { createLaundryController } = require('./presentation/laundry.controller');

function createLaundryModule({ repositories, eventBus, auditLog, env }) {
  const repository = createLaundryPort(repositories.laundry);
  const laundryPageService = createLaundryPageService({
    repository,
    realtime: eventBus,
    auditLog,
    env,
  });

  return {
    controller: createLaundryController({
      useCases: {
        addBag: laundryPageService.addBag,
        addBagToStatus: laundryPageService.addBagToStatus,
        bulkUpdateBags: laundryPageService.bulkUpdateBags,
        deleteBag: laundryPageService.deleteBag,
        downloadBagTemplate: laundryPageService.downloadBagTemplate,
        downloadLaundryMobileApp: laundryPageService.downloadLaundryMobileApp,
        downloadLaundryReport: laundryPageService.downloadLaundryReport,
        editBag: laundryPageService.editBag,
        getLaundryOverview: laundryPageService.getLaundryOverview,
        getLaundryReport: laundryPageService.getLaundryReport,
        getLaundryView: createGetLaundryViewUseCase({ laundryPageService }),
        importBags: laundryPageService.importBags,
        listAvailableBags: laundryPageService.listAvailableBags,
        moveBag: laundryPageService.moveBag,
        recordLinenExchange: laundryPageService.recordLinenExchange,
        removeBagFromStatus: laundryPageService.removeBagFromStatus,
      },
    }),
    permissionChecker: repository.userHasPermission,
  };
}

module.exports = { createLaundryModule };
