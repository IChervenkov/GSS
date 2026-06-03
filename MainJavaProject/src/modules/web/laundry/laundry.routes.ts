// @ts-nocheck
const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const {
  buildDeleteRoute,
  buildGetRoute,
  buildPostRoute,
} = require('../../../shared/http/route-builders');
const { noCache } = require('../../../shared/http/no-cache');
const { requireAnyPermission } = require('../../../shared/http/permission-guard');
const { createLaundryModule } = require('./laundry.module');
const { LAUNDRY_PERMISSIONS } = require('./domain/laundry.permissions');
const {
  laundryBagAddRequestDto,
  laundryBagAddToStatusRequestDto,
  laundryBagBulkUpdateRequestDto,
  laundryBagImportRequestDto,
  laundryBagDeleteRequestDto,
  laundryBagEditRequestDto,
  laundryBagLinenExchangeRequestDto,
  laundryBagRemoveFromStatusRequestDto,
  laundryBagStatusRequestDto,
  laundryLookupRequestDto,
  laundryOverviewRequestDto,
  laundryReportRequestDto,
} = require('./presentation/http/laundry.request.dto');

function createLaundryPermissionGuard(permissionChecker, ...permissionNames) {
  return requireAnyPermission(permissionChecker, [LAUNDRY_PERMISSIONS.full, ...permissionNames]);
}

function createWebLaundryRouter(dependencies = {}) {
  const router = express.Router();
  const { controller, permissionChecker } = createLaundryModule(dependencies);
  const uploadMiddleware =
    typeof dependencies.upload?.single === 'function'
      ? dependencies.upload.single('file')
      : (_req, _res, next) => next();

  if (!controller) {
    throw new AppError({ status: 500, message: 'Laundry controller not wired' });
  }

  buildGetRoute(
    router,
    '/laundry',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.section),
    noCache,
    controller.laundryPage,
  );
  buildGetRoute(
    router,
    '/laundry/data',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.section),
    laundryOverviewRequestDto,
    controller.laundryData,
  );
  buildGetRoute(
    router,
    '/laundry/report',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.section),
    laundryReportRequestDto,
    controller.laundryReport,
  );
  buildGetRoute(
    router,
    '/laundry/report/download',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.section),
    laundryReportRequestDto,
    controller.downloadLaundryReport,
  );
  buildGetRoute(
    router,
    '/laundry/available-bags',
    createLaundryPermissionGuard(
      permissionChecker,
      LAUNDRY_PERMISSIONS.section,
      LAUNDRY_PERMISSIONS.saveBagStatus,
    ),
    laundryLookupRequestDto,
    controller.availableBags,
  );
  buildGetRoute(
    router,
    '/laundry/template',
    createLaundryPermissionGuard(
      permissionChecker,
      LAUNDRY_PERMISSIONS.addBag,
      LAUNDRY_PERMISSIONS.editBag,
    ),
    controller.downloadBagTemplate,
  );
  buildGetRoute(
    router,
    '/laundry/mobile-app',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.downloadLaundryApp),
    controller.downloadLaundryMobileApp,
  );
  buildPostRoute(
    router,
    '/laundry/bags',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.addBag),
    laundryBagAddRequestDto,
    controller.addBag,
  );
  buildPostRoute(
    router,
    '/laundry/bags/edit',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.editBag),
    laundryBagEditRequestDto,
    controller.editBag,
  );
  buildDeleteRoute(
    router,
    '/laundry/bags',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.deleteBag),
    laundryBagDeleteRequestDto,
    controller.deleteBag,
  );
  buildPostRoute(
    router,
    '/laundry/bags/add-to-status',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.saveBagStatus),
    laundryBagAddToStatusRequestDto,
    controller.addBagToStatus,
  );
  buildPostRoute(
    router,
    '/laundry/bags/move',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.saveBagStatus),
    laundryBagStatusRequestDto,
    controller.moveBag,
  );
  buildPostRoute(
    router,
    '/laundry/bags/linen-exchange',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.saveBagStatus),
    laundryBagLinenExchangeRequestDto,
    controller.recordLinenExchange,
  );
  buildPostRoute(
    router,
    '/laundry/bags/remove-from-status',
    createLaundryPermissionGuard(permissionChecker, LAUNDRY_PERMISSIONS.saveBagStatus),
    laundryBagRemoveFromStatusRequestDto,
    controller.removeBagFromStatus,
  );
  buildPostRoute(
    router,
    '/laundry/bags/bulk',
    createLaundryPermissionGuard(
      permissionChecker,
      LAUNDRY_PERMISSIONS.addBag,
      LAUNDRY_PERMISSIONS.editBag,
    ),
    laundryBagBulkUpdateRequestDto,
    controller.bulkUpdateBags,
  );
  buildPostRoute(
    router,
    '/laundry/bags/import',
    createLaundryPermissionGuard(
      permissionChecker,
      LAUNDRY_PERMISSIONS.addBag,
      LAUNDRY_PERMISSIONS.editBag,
    ),
    uploadMiddleware,
    laundryBagImportRequestDto,
    controller.importBags,
  );

  return router;
}

module.exports = { createWebLaundryRouter };
