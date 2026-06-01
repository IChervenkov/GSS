function assertMethods(name, value, methods) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${name} must be an object.`);
  }

  for (const method of methods) {
    if (typeof value[method] !== 'function') {
      throw new Error(`${name}.${method} must be a function.`);
    }
  }

  return value;
}

function createBicyclesPort(repository) {
  return assertMethods('bicyclesRepository', repository, [
    'addBicycle',
    'deleteBicycle',
    'editBicycle',
    'findActiveAssignment',
    'findBicycleById',
    'findBicycleByName',
    'findBicycleByNfcCode',
    'findHelmetByCode',
    'findHelmetById',
    'findHelmetByNfcCode',
    'findOverviewByCamp',
    'findSoldierById',
    'findSoldierByName',
    'hasAssignmentHistory',
    'helmetHasAssignmentHistory',
    'helmetHasActiveAssignment',
    'addHelmet',
    'deleteHelmet',
    'editHelmet',
    'listHelmetsByCamp',
    'listActiveAssignmentsBySoldier',
    'listAvailableHelmets',
    'listRecentRentalsByAsset',
    'listRentalReport',
    'listSoldiers',
    'listUserPermissions',
    'markOverdueRentalsLate',
    'rentBicycle',
    'returnBicycle',
    'userHasPermission',
  ]);
}

module.exports = {
  createBicyclesPort,
};
