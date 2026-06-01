const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const {
  buildDeleteRoute,
  buildGetRoute,
  buildPostRoute,
} = require('../../../shared/http/route-builders');
const { requireAnyPermission } = require('../../../shared/http/permission-guard');
const { createAssetsModule } = require('./assets.module');
const { ASSETS_PAGE, ASSETS_PERMISSIONS } = require('./domain/assets.page');
const {
  assetAddRequestDto,
  assetBulkUpdateRequestDto,
  assetDeleteRequestDto,
  assetEditRequestDto,
  assetImportRequestDto,
  assetRestartInventoryRequestDto,
  assetTypeAddRequestDto,
  assetTypeBulkUpdateRequestDto,
  assetTypeDeleteRequestDto,
  assetTypeEditRequestDto,
  assetsDataRequestDto,
  cleanItemAddRequestDto,
  cleanItemBulkUpdateRequestDto,
  cleanItemDeleteRequestDto,
  cleanItemEditRequestDto,
  cleanItemMoveRequestDto,
} = require('./presentation/http/assets.request.dto');

const FULL_PERMISSION = 'Full permission';

function createAssetsPermissionGuard(permissionChecker, ...permissionNames) {
  return requireAnyPermission(permissionChecker, [FULL_PERMISSION, ...permissionNames]);
}

function createWebAssetsRouter(dependencies = {}) {
  const router = express.Router();
  const { controller, permissionChecker } = createAssetsModule(dependencies);
  const uploadMiddleware =
    typeof dependencies.upload?.single === 'function'
      ? dependencies.upload.single('file')
      : (_req, _res, next) => next();

  if (!controller) {
    throw new AppError({ status: 500, message: 'Assets controller not wired' });
  }

  buildGetRoute(
    router,
    '/assets',
    createAssetsPermissionGuard(permissionChecker, ...ASSETS_PERMISSIONS.pageAccess),
    controller.assetsPage,
  );
  buildGetRoute(
    router,
    '/assets/data',
    createAssetsPermissionGuard(permissionChecker, ...ASSETS_PERMISSIONS.pageAccess),
    assetsDataRequestDto,
    controller.assetsData,
  );
  buildGetRoute(
    router,
    '/assets/template',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addAsset,
      ASSETS_PERMISSIONS.editAsset,
    ),
    controller.downloadAssetTemplate,
  );
  buildGetRoute(
    router,
    '/assets/types/template',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addAssetType,
      ASSETS_PERMISSIONS.editAssetType,
    ),
    controller.downloadAssetTypeTemplate,
  );
  buildGetRoute(
    router,
    '/assets/clean-items/template',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addCleanItem,
      ASSETS_PERMISSIONS.editCleanItem,
    ),
    controller.downloadCleanItemTemplate,
  );
  buildGetRoute(
    router,
    '/assets/mobile-app',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.downloadAssetsApp),
    controller.downloadAssetsMobileApp,
  );
  buildPostRoute(
    router,
    '/assets',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.addAsset),
    assetAddRequestDto,
    controller.addAsset,
  );
  buildPostRoute(
    router,
    '/assets/edit',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.editAsset),
    assetEditRequestDto,
    controller.editAsset,
  );
  buildDeleteRoute(
    router,
    '/assets',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.deleteAsset),
    assetDeleteRequestDto,
    controller.deleteAsset,
  );
  buildPostRoute(
    router,
    '/assets/inventory/restart',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.saveInventory),
    assetRestartInventoryRequestDto,
    controller.restartInventory,
  );
  buildPostRoute(
    router,
    '/assets/bulk',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addAsset,
      ASSETS_PERMISSIONS.editAsset,
    ),
    assetBulkUpdateRequestDto,
    controller.bulkUpdateAssets,
  );
  buildPostRoute(
    router,
    '/assets/types',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.addAssetType),
    assetTypeAddRequestDto,
    controller.addAssetType,
  );
  buildPostRoute(
    router,
    '/assets/types/edit',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.editAssetType),
    assetTypeEditRequestDto,
    controller.editAssetType,
  );
  buildDeleteRoute(
    router,
    '/assets/types',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.deleteAssetType),
    assetTypeDeleteRequestDto,
    controller.deleteAssetType,
  );
  buildPostRoute(
    router,
    '/assets/types/bulk',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addAssetType,
      ASSETS_PERMISSIONS.editAssetType,
    ),
    assetTypeBulkUpdateRequestDto,
    controller.bulkUpdateAssetTypes,
  );
  buildPostRoute(
    router,
    '/assets/clean-items',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.addCleanItem),
    cleanItemAddRequestDto,
    controller.addCleanItem,
  );
  buildPostRoute(
    router,
    '/assets/clean-items/edit',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.editCleanItem),
    cleanItemEditRequestDto,
    controller.editCleanItem,
  );
  buildPostRoute(
    router,
    '/assets/clean-items/move',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.moveCleanItem),
    cleanItemMoveRequestDto,
    controller.moveCleanItem,
  );
  buildDeleteRoute(
    router,
    '/assets/clean-items',
    createAssetsPermissionGuard(permissionChecker, ASSETS_PERMISSIONS.deleteCleanItem),
    cleanItemDeleteRequestDto,
    controller.deleteCleanItem,
  );
  buildPostRoute(
    router,
    '/assets/clean-items/bulk',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addCleanItem,
      ASSETS_PERMISSIONS.editCleanItem,
    ),
    cleanItemBulkUpdateRequestDto,
    controller.bulkUpdateCleanItems,
  );
  buildPostRoute(
    router,
    '/assets/import',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addAsset,
      ASSETS_PERMISSIONS.editAsset,
    ),
    uploadMiddleware,
    assetImportRequestDto,
    controller.importAssets,
  );
  buildPostRoute(
    router,
    '/assets/types/import',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addAssetType,
      ASSETS_PERMISSIONS.editAssetType,
    ),
    uploadMiddleware,
    assetImportRequestDto,
    controller.importAssetTypes,
  );
  buildPostRoute(
    router,
    '/assets/clean-items/import',
    createAssetsPermissionGuard(
      permissionChecker,
      ASSETS_PERMISSIONS.addCleanItem,
      ASSETS_PERMISSIONS.editCleanItem,
    ),
    uploadMiddleware,
    assetImportRequestDto,
    controller.importCleanItems,
  );

  return router;
}

module.exports = { createWebAssetsRouter };
