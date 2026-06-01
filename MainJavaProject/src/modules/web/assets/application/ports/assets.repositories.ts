function assertMethods(name, repository, methods) {
  for (const method of methods) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`${name} is missing required method: ${method}`);
    }
  }

  return repository;
}

function createAssetsPort(repository) {
  return assertMethods('assetsRepository', repository, [
    'addAsset',
    'addAssetType',
    'addCleanItem',
    'bulkUpsertAssets',
    'bulkUpsertAssetTypes',
    'bulkUpsertCleanItems',
    'deleteAsset',
    'deleteAssetType',
    'deleteCleanItem',
    'editAsset',
    'editAssetType',
    'editCleanItem',
    'findAssetTypeById',
    'findAssetTypeByName',
    'findAssetByCode',
    'findAssetById',
    'findAssetByRfid',
    'findCleanItemById',
    'findCleanItemByNameAndWarehouse',
    'getCleanItemSummary',
    'getAssetSummary',
    'listAssetsByCamp',
    'listAssetsTable',
    'listAssetTypesByCamp',
    'listAssetTypesTable',
    'listCleanItemsTable',
    'listKeysByCamp',
    'listInventoryEventsByCamp',
    'listInventoryEventsTable',
    'listInventoryStatusTable',
    'listNotFoundAssetsTable',
    'listRoomsByCamp',
    'listUserPermissions',
    'moveCleanItem',
    'restartInventory',
    'userHasPermission',
  ]);
}

module.exports = { createAssetsPort };
