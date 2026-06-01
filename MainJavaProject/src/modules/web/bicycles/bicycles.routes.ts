const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const {
  buildDeleteRoute,
  buildGetRoute,
  buildPostRoute,
} = require('../../../shared/http/route-builders');
const { requireAnyPermission } = require('../../../shared/http/permission-guard');
const { createBicyclesModule } = require('./bicycles.module');
const { BICYCLE_PERMISSIONS } = require('./domain/bicycle.permissions');
const {
  bicycleAddRequestDto,
  bicycleDeleteRequestDto,
  bicycleEditRequestDto,
  bicycleImportRequestDto,
  bicycleOverviewRequestDto,
  bicycleReportAssetLookupRequestDto,
  bicycleReportAssetRequestDto,
  bicycleReportRequestDto,
  bicycleReportSoldierLookupRequestDto,
  bicycleReportSoldierRequestDto,
  bicycleRentRequestDto,
  bicycleReturnRequestDto,
  helmetAddRequestDto,
  helmetDeleteRequestDto,
  helmetEditRequestDto,
  helmetImportRequestDto,
  listLookupRequestDto,
} = require('./presentation/http/bicycles.request.dto');

function createBicyclePermissionGuard(permissionChecker, ...permissionNames) {
  return requireAnyPermission(permissionChecker, [BICYCLE_PERMISSIONS.full, ...permissionNames]);
}

function createWebBicyclesRouter(dependencies = {}) {
  const router = express.Router();
  const { controller, permissionChecker } = createBicyclesModule(dependencies);
  const uploadMiddleware =
    typeof dependencies.upload?.single === 'function'
      ? dependencies.upload.single('file')
      : (_req, _res, next) => next();

  if (!controller) {
    throw new AppError({ status: 500, message: 'Bicycles controller not wired' });
  }

  buildGetRoute(
    router,
    '/bicycles',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    controller.bicyclesPage,
  );
  buildGetRoute(
    router,
    '/bicycles/data',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    bicycleOverviewRequestDto,
    controller.bicyclesData,
  );
  buildGetRoute(
    router,
    '/bicycles/report',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    bicycleReportRequestDto,
    controller.bicycleRentalReport,
  );
  buildGetRoute(
    router,
    '/bicycles/report/recent-rentals',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    bicycleReportAssetRequestDto,
    controller.recentRentalsByAsset,
  );
  buildGetRoute(
    router,
    '/bicycles/report/assets',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    bicycleReportAssetLookupRequestDto,
    controller.reportAssets,
  );
  buildGetRoute(
    router,
    '/bicycles/report/soldiers',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    bicycleReportSoldierLookupRequestDto,
    controller.reportSoldiers,
  );
  buildGetRoute(
    router,
    '/bicycles/report/active-assignments',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    bicycleReportSoldierRequestDto,
    controller.activeAssignmentsBySoldier,
  );
  buildGetRoute(
    router,
    '/bicycles/report/download',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.section),
    bicycleReportRequestDto,
    controller.downloadBicycleRentalReport,
  );
  buildGetRoute(
    router,
    '/bicycles/soldiers',
    createBicyclePermissionGuard(
      permissionChecker,
      BICYCLE_PERMISSIONS.saveBikeStatus,
      BICYCLE_PERMISSIONS.editBike,
    ),
    listLookupRequestDto,
    controller.soldiersData,
  );
  buildGetRoute(
    router,
    '/bicycles/helmets',
    createBicyclePermissionGuard(
      permissionChecker,
      BICYCLE_PERMISSIONS.saveBikeStatus,
      BICYCLE_PERMISSIONS.editBike,
    ),
    listLookupRequestDto,
    controller.helmetsData,
  );
  buildGetRoute(
    router,
    '/bicycles/template',
    createBicyclePermissionGuard(
      permissionChecker,
      BICYCLE_PERMISSIONS.addBike,
      BICYCLE_PERMISSIONS.editBike,
    ),
    controller.downloadBicycleTemplate,
  );
  buildGetRoute(
    router,
    '/bicycles/helmets/template',
    createBicyclePermissionGuard(
      permissionChecker,
      BICYCLE_PERMISSIONS.addHelmet,
      BICYCLE_PERMISSIONS.editHelmet,
    ),
    controller.downloadHelmetTemplate,
  );

  buildGetRoute(
    router,
    '/bicycles/mobile-app',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.downloadBikeApp),
    controller.downloadBikeMobileApp,
  );
  buildPostRoute(
    router,
    '/bicycles/add',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.addBike),
    bicycleAddRequestDto,
    controller.addBicycle,
  );
  buildPostRoute(
    router,
    '/bicycles/helmets/add',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.addHelmet),
    helmetAddRequestDto,
    controller.addHelmet,
  );
  buildPostRoute(
    router,
    '/bicycles/edit',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.editBike),
    bicycleEditRequestDto,
    controller.editBicycle,
  );
  buildPostRoute(
    router,
    '/bicycles/helmets/edit',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.editHelmet),
    helmetEditRequestDto,
    controller.editHelmet,
  );
  buildDeleteRoute(
    router,
    '/bicycles/delete',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.deleteBike),
    bicycleDeleteRequestDto,
    controller.deleteBicycle,
  );
  buildDeleteRoute(
    router,
    '/bicycles/helmets/delete',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.deleteHelmet),
    helmetDeleteRequestDto,
    controller.deleteHelmet,
  );
  buildPostRoute(
    router,
    '/bicycles/rent',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.saveBikeStatus),
    bicycleRentRequestDto,
    controller.rentBicycle,
  );
  buildPostRoute(
    router,
    '/bicycles/return',
    createBicyclePermissionGuard(permissionChecker, BICYCLE_PERMISSIONS.saveBikeStatus),
    bicycleReturnRequestDto,
    controller.returnBicycle,
  );
  buildPostRoute(
    router,
    '/bicycles/import',
    createBicyclePermissionGuard(
      permissionChecker,
      BICYCLE_PERMISSIONS.addBike,
      BICYCLE_PERMISSIONS.editBike,
    ),
    uploadMiddleware,
    bicycleImportRequestDto,
    controller.importBicycles,
  );
  buildPostRoute(
    router,
    '/bicycles/helmets/import',
    createBicyclePermissionGuard(
      permissionChecker,
      BICYCLE_PERMISSIONS.addHelmet,
      BICYCLE_PERMISSIONS.editHelmet,
    ),
    uploadMiddleware,
    helmetImportRequestDto,
    controller.importHelmets,
  );

  return router;
}

module.exports = { createWebBicyclesRouter };
