const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const {
  buildDeleteRoute,
  buildGetRoute,
  buildPostRoute,
} = require('../../../shared/http/route-builders');
const { createAccommodationModule } = require('./accommodation.module');
const {
  accommodationDataRequestDto,
  accommodationLookupRequestDto,
  accommodationReportDownloadRequestDto,
  additionalItemAddRequestDto,
  additionalItemDeleteRequestDto,
  additionalItemEditRequestDto,
  additionalItemImportRequestDto,
  buildingAddRequestDto,
  buildingDeleteRequestDto,
  buildingEditRequestDto,
  buildingImportRequestDto,
  keyAddRequestDto,
  keyDeleteRequestDto,
  keyEditRequestDto,
  keyImportRequestDto,
  keyIssueRequestDto,
  keyReleaseRequestDto,
  multipleBuildingReleaseRequestDto,
  multipleRoomReleaseRequestDto,
  multipleSoldierAccommodationRequestDto,
  roomAddRequestDto,
  roomDeleteRequestDto,
  roomEditRequestDto,
  roomImportRequestDto,
  soldierAccommodationRequestDto,
  soldierAddRequestDto,
  soldierDeleteRequestDto,
  soldierDischargeRequestDto,
  soldierEditRequestDto,
  soldierImportRequestDto,
  soldierMoveRequestDto,
  soldierSwapRequestDto,
} = require('./presentation/http/accommodation.request.dto');

function registerGetRouteIfPresent(router, path, handler) {
  if (typeof handler === 'function') {
    buildGetRoute(router, path, handler);
  }
}

function createWebAccommodationRouter(dependencies = {}) {
  const router = express.Router();
  const { controller } = createAccommodationModule(dependencies);
  const uploadMiddleware =
    typeof dependencies.upload?.single === 'function'
      ? dependencies.upload.single('file')
      : (_req, _res, next) => next();

  if (!controller) {
    throw new AppError({ status: 500, message: 'Accommodation controller not wired' });
  }

  registerGetRouteIfPresent(router, '/accommodation', controller.accommodationPage);
  buildGetRoute(
    router,
    '/accommodation/data',
    accommodationDataRequestDto,
    controller.accommodationData,
  );
  buildGetRoute(
    router,
    '/accommodation/lookups',
    accommodationLookupRequestDto,
    controller.accommodationLookup,
  );
  registerGetRouteIfPresent(router, '/accommodation/upcoming-summary', controller.upcomingSummary);
  buildGetRoute(
    router,
    '/accommodation/report/download',
    accommodationReportDownloadRequestDto,
    controller.downloadAccommodationReport,
  );
  registerGetRouteIfPresent(
    router,
    '/accommodation/buildings/template',
    controller.downloadBuildingTemplate,
  );
  registerGetRouteIfPresent(router, '/accommodation/rooms/template', controller.downloadRoomTemplate);
  registerGetRouteIfPresent(router, '/accommodation/keys/template', controller.downloadKeyTemplate);
  registerGetRouteIfPresent(
    router,
    '/accommodation/soldiers/template',
    controller.downloadSoldierTemplate,
  );
  registerGetRouteIfPresent(
    router,
    '/accommodation/additional-items/template',
    controller.downloadAdditionalItemTemplate,
  );

  buildPostRoute(
    router,
    '/accommodation/buildings',
    buildingAddRequestDto,
    controller.addBuilding,
  );
  buildPostRoute(
    router,
    '/accommodation/buildings/edit',
    buildingEditRequestDto,
    controller.editBuilding,
  );
  buildPostRoute(
    router,
    '/accommodation/buildings/import',
    uploadMiddleware,
    buildingImportRequestDto,
    controller.importBuildings,
  );
  buildDeleteRoute(
    router,
    '/accommodation/buildings/delete',
    buildingDeleteRequestDto,
    controller.deleteBuilding,
  );
  buildPostRoute(router, '/accommodation/rooms', roomAddRequestDto, controller.addRoom);
  buildPostRoute(router, '/accommodation/rooms/edit', roomEditRequestDto, controller.editRoom);
  buildPostRoute(
    router,
    '/accommodation/rooms/import',
    uploadMiddleware,
    roomImportRequestDto,
    controller.importRooms,
  );
  buildDeleteRoute(
    router,
    '/accommodation/rooms/delete',
    roomDeleteRequestDto,
    controller.deleteRoom,
  );
  buildPostRoute(router, '/accommodation/keys', keyAddRequestDto, controller.addKey);
  buildPostRoute(router, '/accommodation/keys/edit', keyEditRequestDto, controller.editKey);
  buildPostRoute(
    router,
    '/accommodation/keys/import',
    uploadMiddleware,
    keyImportRequestDto,
    controller.importKeys,
  );
  buildDeleteRoute(
    router,
    '/accommodation/keys/delete',
    keyDeleteRequestDto,
    controller.deleteKey,
  );
  buildPostRoute(
    router,
    '/accommodation/keys/issue',
    keyIssueRequestDto,
    controller.issueKeyToSoldier,
  );
  buildPostRoute(
    router,
    '/accommodation/keys/release',
    keyReleaseRequestDto,
    controller.releaseKeyFromSoldier,
  );
  buildPostRoute(router, '/accommodation/soldiers', soldierAddRequestDto, controller.addSoldier);
  buildPostRoute(
    router,
    '/accommodation/soldiers/edit',
    soldierEditRequestDto,
    controller.editSoldier,
  );
  buildPostRoute(
    router,
    '/accommodation/soldiers/import',
    uploadMiddleware,
    soldierImportRequestDto,
    controller.importSoldiers,
  );
  buildDeleteRoute(
    router,
    '/accommodation/soldiers/delete',
    soldierDeleteRequestDto,
    controller.deleteSoldier,
  );
  buildPostRoute(
    router,
    '/accommodation/soldiers/accommodate',
    soldierAccommodationRequestDto,
    controller.accommodateSoldier,
  );
  buildPostRoute(
    router,
    '/accommodation/soldiers/accommodate/multiple',
    multipleSoldierAccommodationRequestDto,
    controller.accommodateSoldiers,
  );
  buildPostRoute(
    router,
    '/accommodation/soldiers/discharge',
    soldierDischargeRequestDto,
    controller.dischargeSoldier,
  );
  buildPostRoute(
    router,
    '/accommodation/rooms/release',
    multipleRoomReleaseRequestDto,
    controller.releaseRooms,
  );
  buildPostRoute(
    router,
    '/accommodation/buildings/release',
    multipleBuildingReleaseRequestDto,
    controller.releaseBuildings,
  );
  buildPostRoute(
    router,
    '/accommodation/soldiers/move',
    soldierMoveRequestDto,
    controller.moveSoldier,
  );
  buildPostRoute(
    router,
    '/accommodation/soldiers/swap',
    soldierSwapRequestDto,
    controller.swapSoldiers,
  );
  buildPostRoute(
    router,
    '/accommodation/additional-items',
    additionalItemAddRequestDto,
    controller.addAdditionalItem,
  );
  buildPostRoute(
    router,
    '/accommodation/additional-items/edit',
    additionalItemEditRequestDto,
    controller.editAdditionalItem,
  );
  buildPostRoute(
    router,
    '/accommodation/additional-items/import',
    uploadMiddleware,
    additionalItemImportRequestDto,
    controller.importAdditionalItems,
  );
  buildDeleteRoute(
    router,
    '/accommodation/additional-items/delete',
    additionalItemDeleteRequestDto,
    controller.deleteAdditionalItem,
  );

  return router;
}

module.exports = { createWebAccommodationRouter };
