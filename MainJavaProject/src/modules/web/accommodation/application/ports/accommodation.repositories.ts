function assertMethods(name, repository, methods) {
  for (const method of methods) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`${name} is missing required method: ${method}`);
    }
  }
  return repository;
}

function createAccommodationPort(repository) {
  return assertMethods('accommodationRepository', repository, [
    'accommodateSoldier',
    'addAdditionalItem',
    'addBuilding',
    'addKey',
    'addRoom',
    'addSoldier',
    'deleteAdditionalItem',
    'deleteBuilding',
    'deleteKey',
    'deleteRoom',
    'deleteSoldier',
    'dischargeSoldier',
    'editAdditionalItem',
    'editBuilding',
    'editKey',
    'editRoom',
    'editSoldier',
    'findAdditionalItemById',
    'findBuildingById',
    'findBuildingByName',
    'findKeyById',
    'findKeyByName',
    'findKeyByNfcCode',
    'findLaundryBagByCode',
    'findLaundryBagById',
    'findRoomById',
    'findRoomByName',
    'findSoldierDeletionBlockers',
    'findSoldierById',
    'findSoldierByName',
    'findUpcomingActionsByCamp',
    'getAccommodationOverviewData',
    'issueKeyToSoldier',
    'listUserPermissions',
    'moveSoldier',
    'releaseKeyFromSoldier',
    'swapSoldiers',
    'userHasPermission',
  ]);
}

module.exports = {
  createAccommodationPort,
};
