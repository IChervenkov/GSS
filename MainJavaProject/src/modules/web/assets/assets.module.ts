const { createAssetsPort } = require('./application/ports/assets.repositories');
const { createAssetsPageService } = require('./application/services/assets-page.service');
const { createGetAssetsViewUseCase } = require('./application/use-cases/get-assets-view.use-case');
const { createAssetsController } = require('./presentation/assets.controller');

function createAssetsModule({ repositories, eventBus, auditLog, env }) {
  const repository = createAssetsPort(repositories.assets);
  const assetsPageService = createAssetsPageService({
    repository,
    realtime: eventBus,
    auditLog,
    env,
  });

  return {
    controller: createAssetsController({
      useCases: {
        addAsset: assetsPageService.addAsset,
        addAssetType: assetsPageService.addAssetType,
        addCleanItem: assetsPageService.addCleanItem,
        bulkUpdateAssetTypes: assetsPageService.bulkUpdateAssetTypes,
        bulkUpdateAssets: assetsPageService.bulkUpdateAssets,
        bulkUpdateCleanItems: assetsPageService.bulkUpdateCleanItems,
        deleteAsset: assetsPageService.deleteAsset,
        deleteAssetType: assetsPageService.deleteAssetType,
        deleteCleanItem: assetsPageService.deleteCleanItem,
        downloadAssetTemplate: assetsPageService.downloadAssetTemplate,
        downloadAssetsMobileApp: assetsPageService.downloadAssetsMobileApp,
        downloadAssetTypeTemplate: assetsPageService.downloadAssetTypeTemplate,
        downloadCleanItemTemplate: assetsPageService.downloadCleanItemTemplate,
        editAsset: assetsPageService.editAsset,
        editAssetType: assetsPageService.editAssetType,
        editCleanItem: assetsPageService.editCleanItem,
        getAssetsView: createGetAssetsViewUseCase({ assetsPageService }),
        getAssetsData: (payload) => assetsPageService.getAssetsData(payload),
        importAssets: assetsPageService.importAssets,
        importAssetTypes: assetsPageService.importAssetTypes,
        importCleanItems: assetsPageService.importCleanItems,
        moveCleanItem: assetsPageService.moveCleanItem,
        restartInventory: assetsPageService.restartInventory,
      },
    }),
    permissionChecker: repository.userHasPermission,
  };
}

module.exports = { createAssetsModule };
