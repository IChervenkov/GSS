const { createAccommodationPort } = require('./application/ports/accommodation.repositories');
const { createAccommodationService } = require('./application/services/accommodation.service');
const {
  createGetAccommodationOverviewUseCase,
} = require('./application/use-cases/get-accommodation-overview.use-case');
const {
  createGetAccommodationViewUseCase,
} = require('./application/use-cases/get-accommodation-view.use-case');
const { createAccommodationController } = require('./presentation/accommodation.controller');

function createAccommodationModule({ repositories = {}, eventBus } = {}) {
  const repository = createAccommodationPort(repositories.accommodation);

  const accommodationService = createAccommodationService({ repository, realtime: eventBus });

  const useCases = {
    accommodateSoldier: (payload) => accommodationService.accommodateSoldier(payload),
    accommodateSoldiers: (payload) => accommodationService.accommodateSoldiers(payload),
    addAdditionalItem: (payload) => accommodationService.addAdditionalItem(payload),
    addBuilding: (payload) => accommodationService.addBuilding(payload),
    addKey: (payload) => accommodationService.addKey(payload),
    addRoom: (payload) => accommodationService.addRoom(payload),
    addSoldier: (payload) => accommodationService.addSoldier(payload),
    deleteAdditionalItem: (payload) => accommodationService.deleteAdditionalItem(payload),
    deleteBuilding: (payload) => accommodationService.deleteBuilding(payload),
    deleteKey: (payload) => accommodationService.deleteKey(payload),
    deleteRoom: (payload) => accommodationService.deleteRoom(payload),
    deleteSoldier: (payload) => accommodationService.deleteSoldier(payload),
    dischargeSoldier: (payload) => accommodationService.dischargeSoldier(payload),
    downloadAdditionalItemTemplate: (payload) =>
      accommodationService.downloadAdditionalItemTemplate(payload),
    downloadAccommodationReport: (payload) =>
      accommodationService.downloadAccommodationReport(payload),
    downloadBuildingTemplate: (payload) => accommodationService.downloadBuildingTemplate(payload),
    downloadKeyTemplate: (payload) => accommodationService.downloadKeyTemplate(payload),
    downloadRoomTemplate: (payload) => accommodationService.downloadRoomTemplate(payload),
    downloadSoldierTemplate: (payload) => accommodationService.downloadSoldierTemplate(payload),
    editAdditionalItem: (payload) => accommodationService.editAdditionalItem(payload),
    editBuilding: (payload) => accommodationService.editBuilding(payload),
    editKey: (payload) => accommodationService.editKey(payload),
    editRoom: (payload) => accommodationService.editRoom(payload),
    editSoldier: (payload) => accommodationService.editSoldier(payload),
    getAccommodationView: createGetAccommodationViewUseCase({ accommodationService }),
    getAccommodationOverview: createGetAccommodationOverviewUseCase({ accommodationService }),
    getUpcomingSummary: (payload) => accommodationService.getUpcomingSummary(payload),
    importAdditionalItems: (payload) => accommodationService.importAdditionalItems(payload),
    importBuildings: (payload) => accommodationService.importBuildings(payload),
    importKeys: (payload) => accommodationService.importKeys(payload),
    importRooms: (payload) => accommodationService.importRooms(payload),
    importSoldiers: (payload) => accommodationService.importSoldiers(payload),
    issueKeyToSoldier: (payload) => accommodationService.issueKeyToSoldier(payload),
    moveSoldier: (payload) => accommodationService.moveSoldier(payload),
    releaseBuildings: (payload) => accommodationService.releaseBuildings(payload),
    releaseKeyFromSoldier: (payload) => accommodationService.releaseKeyFromSoldier(payload),
    releaseRooms: (payload) => accommodationService.releaseRooms(payload),
    listAccommodationLookupOptions: (payload) =>
      accommodationService.listAccommodationLookupOptions(payload),
    swapSoldiers: (payload) => accommodationService.swapSoldiers(payload),
  };

  return {
    controller: createAccommodationController({ useCases }),
  };
}

module.exports = { createAccommodationModule };
