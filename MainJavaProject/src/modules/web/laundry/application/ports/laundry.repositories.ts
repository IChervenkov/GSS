function assertMethods(name, repository, methods) {
  for (const method of methods) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`${name} is missing required method: ${method}`);
    }
  }

  return repository;
}

function createLaundryPort(repository) {
  return assertMethods('laundryRepository', repository, [
    'addBag',
    'bulkUpsertBags',
    'deleteBag',
    'editBag',
    'findBagByCode',
    'findBagById',
    'findBagByRfid',
    'getBagDeletionBlockers',
    'listBagsByCamp',
    'listAvailableBags',
    'listLaundryReport',
    'listUserPermissions',
    'recordLinenExchange',
    'setBagStatus',
    'userHasPermission',
  ]);
}

module.exports = { createLaundryPort };
