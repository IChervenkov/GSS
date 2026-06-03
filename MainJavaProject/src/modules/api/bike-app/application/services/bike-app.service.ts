// @ts-nocheck
const { AppError } = require('../../../../../shared/errors/app-error');
const { success } = require('../../../../../shared/application/action-result');
const { buildRequestMeta } = require('../../../../../shared/security/audit-log');
const {
  createBicyclesService,
} = require('../../../../web/bicycles/application/services/bicycles.service');
const { BICYCLE_PERMISSIONS } = require('../../../../web/bicycles/domain/bicycle.permissions');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeText(value) {
  return String(value || '').trim();
}

function lower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeLimit(value, fallback = 50) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, 1), 100);
}

function normalizePage(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, 1), 100000);
}

function normalizeSortDirection(value) {
  return ['asc', 'desc'].includes(String(value || '').trim()) ? String(value).trim() : 'default';
}

function resultBody(result = {}) {
  return result?.body || {};
}

function normalizeStatus(value) {
  const status = lower(value);
  if (status === 'long term' || status === 'long-term') return 'long_term';
  return status || 'available';
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

function mapBicycle(row = {}) {
  return {
    id: row.id,
    name: row.name,
    nfcCode: row.nfcCode,
    status: normalizeStatus(row.status),
    assignedSoldierId: row.assignedSoldierId || null,
    assignedSoldier: row.assignedSoldier || null,
    helmetId: row.helmetId || null,
    helmetCode: row.helmetCode || null,
    assignmentId: row.assignmentId || null,
    rentedAt: row.rentedAt || null,
  };
}

function mapHelmet(row = {}) {
  return {
    id: row.id,
    code: row.code,
    nfcCode: row.nfcCode,
    status: normalizeStatus(row.status || (row.assignmentId ? 'rented' : 'available')),
    bicycleId: row.identifier || null,
    bicycleName: row.bicycleName || null,
    assignedSoldierId: row.assignedSoldierId || null,
    assignedSoldier: row.assignedSoldier || null,
    assignmentId: row.assignmentId || null,
    rentedAt: row.rentedAt || null,
  };
}

function mapSoldier(row = {}, activeAssignments = []) {
  const activeAssignmentCount = Number.isFinite(Number(activeAssignments))
    ? Number(activeAssignments)
    : Number(
        row.activeAssignmentCount ??
          row.active_assignment_count ??
          (Array.isArray(activeAssignments) ? activeAssignments.length : 0),
      ) || 0;

  return {
    id: row.id,
    name: row.name,
    country: row.country || null,
    mealCard: row.mealCard || null,
    activeAssignmentCount,
  };
}

function mapPermission(row = {}) {
  return {
    id: row.id || row.permissionId || null,
    name: row.name,
  };
}

function mapRental(row = {}) {
  return {
    assignmentId: row.assignmentId,
    bicycleId: row.identifier,
    bicycleName: row.bicycleName || null,
    bicycleNfcCode: row.bicycleNfcCode || null,
    soldierId: row.soldierId || null,
    soldierName: row.soldierName || null,
    helmetId: row.helmetId || null,
    helmetCode: row.helmetCode || null,
    helmetNfcCode: row.helmetNfcCode || null,
    rentedAt: row.rentedAt || null,
    returnedAt: row.returnedAt || null,
    status: normalizeStatus(row.status || 'rented'),
  };
}

function tableMeta(result) {
  return {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    sourceTotal: result.sourceTotal,
    filters: result.filters,
    sortColumn: result.sortColumn,
    sortDirection: result.sortDirection,
  };
}

function normalizeFilters(filters, columns) {
  let source = filters && typeof filters === 'object' ? filters : {};
  if (typeof filters === 'string' && filters.trim()) {
    try {
      const parsed = JSON.parse(filters);
      source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      source = {};
    }
  }
  return columns.reduce((result, column) => {
    const value = normalizeText(source[column]).slice(0, 128);
    if (value) result[column] = value;
    return result;
  }, {});
}

function applyMobileTableState(rows = [], state = {}, config = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const filterColumns = config.filterColumns || [];
  const sortColumns = config.sortColumns || filterColumns;
  const getColumnValue = config.getColumnValue || ((row, column) => row?.[column] ?? '');
  const getSearchValues =
    config.getSearchValues ||
    ((row) => filterColumns.map((column) => getColumnValue(row, column)));
  const filters = normalizeFilters(state.filters, filterColumns);
  const search = lower(state.search);
  const sortDirection = normalizeSortDirection(state.sortDirection);
  const requestedSortColumn = normalizeText(state.sortColumn);
  const sortColumn =
    sortDirection !== 'default' && sortColumns.includes(requestedSortColumn)
      ? requestedSortColumn
      : null;
  const limit = normalizeLimit(state.limit, 10);
  const requestedPage = normalizePage(state.page, 1);

  const filteredRows = sourceRows.filter((row) => {
    const matchesSearch =
      !search ||
      getSearchValues(row)
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    const matchesFilters = Object.entries(filters).every(([column, filter]) =>
      String(getColumnValue(row, column) ?? '')
        .toLowerCase()
        .includes(String(filter).toLowerCase()),
    );
    return matchesSearch && matchesFilters;
  });

  const sortedRows = sortColumn
    ? [...filteredRows].sort(
        (left, right) =>
          String(getColumnValue(left, sortColumn)).localeCompare(
            String(getColumnValue(right, sortColumn)),
            undefined,
            { numeric: true, sensitivity: 'base' },
          ) * (sortDirection === 'desc' ? -1 : 1),
      )
    : filteredRows;

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * limit;

  return {
    rows: sortedRows.slice(start, start + limit),
    page,
    limit,
    total,
    totalPages,
    sourceTotal: sourceRows.length,
    filters,
    sortColumn,
    sortDirection: sortColumn ? sortDirection : 'default',
  };
}

function bicycleColumnValue(row, column) {
  if (column === 'assignedSoldier') return row.assignedSoldier || 'Unassigned';
  if (column === 'helmetCode') return row.helmetCode || 'None';
  if (column === 'rentedAt') return row.rentedAt || 'None';
  return row[column] || '';
}

function helmetColumnValue(row, column) {
  if (column === 'bicycleName') return row.bicycleName || 'Unassigned';
  if (column === 'assignedSoldier') return row.assignedSoldier || 'Unassigned';
  return row[column] || '';
}

function createBikeAppService({ env, auditLog, repositories, eventBus }) {
  const repository = repositories.bicycles;
  const mainRepository = repositories.main;
  const bicyclesService = createBicyclesService({
    repository,
    realtime: eventBus,
    auditLog,
    env,
  });

  async function assertAnyPermission(actorUserId, permissionNames, message) {
    const names = [BICYCLE_PERMISSIONS.full, ...permissionNames];
    if (typeof repository.listUserPermissions === 'function') {
      const permissions = await repository.listUserPermissions({ userId: actorUserId });
      const granted = new Set((permissions || []).map((permission) => permission.name).filter(Boolean));
      if (names.some((permissionName) => granted.has(permissionName))) return;
      throw new AppError({ status: 403, code: 'PERMISSION_DENIED', message });
    }

    const checks = await Promise.all(
      names.map((permissionName) => repository.userHasPermission(actorUserId, permissionName)),
    );
    if (!checks.some(Boolean)) {
      throw new AppError({ status: 403, code: 'PERMISSION_DENIED', message });
    }
  }

  async function assertReadPermission(actorUserId) {
    await assertAnyPermission(
      actorUserId,
      [BICYCLE_PERMISSIONS.section],
      "You don't have permission to use the bicycle mobile app.",
    );
  }

  async function loadInventory({ actorUserId, campId }) {
    await assertReadPermission(actorUserId);
    const overview = resultBody(
      await bicyclesService.getBicyclesOverview({
        campId,
        tableState: {
          bicycle: { page: 1, limit: 100 },
          helmet: { page: 1, limit: 100 },
        },
      }),
    );

    return {
      summary: {
        available: overview.available || 0,
        rented: overview.rented || 0,
        repair: overview.repair || 0,
        late: overview.late || 0,
        longTerm: overview.longTerm || 0,
      },
      totalBicycles:
        (overview.lookups?.rows || overview.rows || []).length ||
        Number(overview.available || 0) +
          Number(overview.rented || 0) +
          Number(overview.repair || 0) +
          Number(overview.late || 0) +
          Number(overview.longTerm || 0),
      helmetPairingCount:
        overview.helmetPairingCount ??
        (overview.lookups?.rows || overview.rows || []).filter((row) => row.helmetCode).length,
      needsAttention: Number(overview.repair || 0) + Number(overview.late || 0),
      bicycles: (overview.lookups?.rows || overview.rows || []).map(mapBicycle),
      helmets: (overview.lookups?.helmets || overview.helmets || []).map(mapHelmet),
    };
  }

  async function listCamps({ actorUserId, page = 1, limit = 100 }) {
    const result = await mainRepository.listCampsAndPermissions({
      userId: actorUserId,
      page,
      limit,
      filters: [],
      sortColumn: 'name',
      sortDirection: 'asc',
    });

    return success({
      camps: result.camps.map((camp) => ({
        id: camp.id,
        name: camp.name,
        createdAt: camp.createdAt,
      })),
      total: result.total,
    });
  }

  async function currentPermissions({ actorUserId }) {
    const permissions =
      typeof repository.listUserPermissions === 'function'
        ? await repository.listUserPermissions({ userId: actorUserId })
        : [];
    return success({
      permissions: (permissions || []).map(mapPermission).filter((permission) => permission.name),
    });
  }

  async function inventory({ actorUserId, campId }) {
    return success(await loadInventory({ actorUserId, campId }));
  }

  async function listBicycles({
    actorUserId,
    campId,
    search = '',
    page = 1,
    limit = 50,
    filters = {},
    sortColumn = '',
    sortDirection = 'default',
  }) {
    await assertReadPermission(actorUserId);
    const bicycles = await repository.findOverviewByCamp({ campId });
    const result = applyMobileTableState((bicycles || []).map(mapBicycle), {
      search,
      page,
      limit,
      filters,
      sortColumn,
      sortDirection,
    }, {
      filterColumns: [
        'id',
        'name',
        'nfcCode',
        'status',
        'assignedSoldier',
        'helmetCode',
        'rentedAt',
      ],
      getColumnValue: bicycleColumnValue,
    });
    return success({
      bicycles: result.rows,
      table: tableMeta(result),
    });
  }

  async function listHelmets({
    actorUserId,
    campId,
    search = '',
    page = 1,
    limit = 50,
    filters = {},
    sortColumn = '',
    sortDirection = 'default',
  }) {
    await assertReadPermission(actorUserId);
    const helmets = await repository.listHelmetsByCamp({ campId });
    const result = applyMobileTableState((helmets || []).map(mapHelmet), {
      search,
      page,
      limit,
      filters,
      sortColumn,
      sortDirection,
    }, {
      filterColumns: ['id', 'code', 'nfcCode', 'status', 'bicycleName', 'assignedSoldier'],
      getColumnValue: helmetColumnValue,
    });
    return success({
      helmets: result.rows,
      table: tableMeta(result),
    });
  }

  async function listSoldiers({ actorUserId, campId, search = '', limit = 50 }) {
    await assertReadPermission(actorUserId);
    const searchText = normalizeText(search);
    const keySoldier =
      searchText && typeof repository.findSoldierByKeyNfcCode === 'function'
        ? await repository.findSoldierByKeyNfcCode({ campId, nfcCode: searchText })
        : null;
    const sourceSoldiers = keySoldier
      ? [keySoldier]
      : await repository.listSoldiers({ campId, search, limit });
    let assignmentCounts = null;
    if (keySoldier && typeof repository.listActiveAssignmentCountsBySoldierIds === 'function') {
      assignmentCounts = await repository.listActiveAssignmentCountsBySoldierIds({
        campId,
        soldierIds: [keySoldier.id],
      });
    }

    const soldiers = (sourceSoldiers || []).map((soldier) =>
      mapSoldier(
        soldier,
        assignmentCounts ? assignmentCounts.get(String(soldier.id)) || 0 : undefined,
      ),
    );
    return success({ soldiers });
  }

  async function lookupNfc({ actorUserId, campId, nfcData }) {
    const data = await loadInventory({ actorUserId, campId });
    const normalizedNfc = lower(nfcData);
    const bicycle = data.bicycles.find((row) => lower(row.nfcCode) === normalizedNfc);
    if (bicycle) {
      return success({ assetType: 'bicycle', asset: bicycle });
    }

    const helmet = data.helmets.find((row) => lower(row.nfcCode) === normalizedNfc);
    if (helmet) {
      return success({ assetType: 'helmet', asset: helmet });
    }

    throw new AppError({
      status: 404,
      code: 'NFC_ASSET_NOT_FOUND',
      message: 'No bicycle or helmet was found for this NFC code in the selected camp.',
    });
  }

  async function legacyLookupNfc({ actorUserId, campId = null, nfcData }) {
    await assertReadPermission(actorUserId);
    const [bicycle, helmet] = await Promise.all([
      repository.findBicycleByNfcCode({ nfcCode: nfcData }),
      repository.findHelmetByNfcCode({ nfcCode: nfcData, campId }),
    ]);

    const activeAssignment = bicycle
      ? await repository.findActiveAssignment({ identifier: bicycle.id })
      : null;

    return success({
      id: bicycle?.id || helmet?.id || null,
      namebike: bicycle?.name || 'None',
      fullBikeName: bicycle?.name || '',
      code: helmet?.code || activeAssignment?.helmetCode || 'None',
      fullHelmetName: helmet?.code || '',
      getBikeIdHelmet: activeAssignment?.helmetId || helmet?.id || '',
      getBikeHelmet: activeAssignment?.helmetCode || helmet?.code || 'None',
      status: normalizeStatus(bicycle?.status || helmet?.status || 'available'),
    });
  }

  async function legacyCheckBike({ actorUserId, nfcData }) {
    await assertReadPermission(actorUserId);
    const bicycle = await repository.findBicycleByNfcCode({ nfcCode: nfcData });
    if (!bicycle) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found.',
      });
    }
    const activeAssignment = await repository.findActiveAssignment({ identifier: bicycle.id });
    if (activeAssignment) {
      throw new AppError({
        status: 409,
        code: 'BICYCLE_ALREADY_RENTED',
        message: 'This bicycle already has an active rental.',
      });
    }
    return success({ success: true, bicycle: mapBicycle(bicycle) });
  }

  async function resolveHelmetIdFromLegacyValue({ campId, value }) {
    const text = normalizeText(value);
    if (!text) return null;
    const helmet =
      (await repository.findHelmetByNfcCode({ nfcCode: text, campId })) ||
      (isUuid(text) ? await repository.findHelmetById({ helmetId: text, campId }).catch(() => null) : null) ||
      (await repository.findHelmetByCode({ code: text, campId }).catch(() => null));
    return helmet?.id || null;
  }

  async function resolveLegacyBicycle({ campId, value }) {
    const text = normalizeText(value);
    if (!text) return null;

    const byNfc = await repository.findBicycleByNfcCode({ nfcCode: text });
    if (byNfc && (!campId || String(byNfc.campId || '') === String(campId))) return byNfc;
    if (!isUuid(text)) return null;
    return repository.findBicycleById({ identifier: text, campId: campId || null }).catch(() => null);
  }

  async function resolveLegacyHelmet({ campId, value }) {
    const text = normalizeText(value);
    if (!text) return null;

    const byNfc = await repository.findHelmetByNfcCode({ nfcCode: text, campId });
    if (byNfc) return byNfc;
    if (isUuid(text)) {
      const byId = await repository.findHelmetById({ helmetId: text, campId: campId || null }).catch(() => null);
      if (byId) return byId;
    }
    return repository.findHelmetByCode({ code: text, campId }).catch(() => null);
  }

  function resolveLegacyCampId(campId, asset) {
    return campId || asset?.campId || null;
  }

  function legacyDateTime(date, time) {
    return new Date(`${normalizeText(date)}T${normalizeText(time) || '00:00'}:00.000Z`).toISOString();
  }

  async function legacyRentBicycle({ actorUserId, campId, nfcData, date, time, selectClient, helmetId, req }) {
    const bicycle = await resolveLegacyBicycle({ campId, value: nfcData });
    if (!bicycle) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found.',
      });
    }
    const resolvedCampId = resolveLegacyCampId(campId, bicycle);

    return rentBicycle({
      actorUserId,
      campId: resolvedCampId,
      identifier: bicycle.id,
      soldierId: selectClient,
      helmetId: await resolveHelmetIdFromLegacyValue({ campId: resolvedCampId, value: helmetId }),
      rentedAt: legacyDateTime(date, time),
      repair: false,
      longTerm: false,
      req,
    });
  }

  async function legacyReturnBicycle({ actorUserId, campId, nfcData, date, time, req }) {
    const bicycle = await resolveLegacyBicycle({ campId, value: nfcData });
    if (!bicycle) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found.',
      });
    }

    return returnBicycle({
      actorUserId,
      campId: resolveLegacyCampId(campId, bicycle),
      identifier: bicycle.id,
      returnedAt: legacyDateTime(date, time),
      req,
    });
  }

  async function legacyAddBicycle({ actorUserId, campId, bikeName, bikeAddId, req }) {
    return addBicycle({ actorUserId, campId, name: bikeName, nfcCode: bikeAddId, req });
  }

  async function legacyAddHelmet({ actorUserId, campId, helmetName, helmetAddId, req }) {
    return addHelmet({ actorUserId, campId, code: helmetName, nfcCode: helmetAddId, req });
  }

  async function legacyEditBicycle({
    actorUserId,
    campId,
    oldNfcContent,
    newNfcContent,
    bikeName,
    req,
  }) {
    const bicycle = await repository.findBicycleByNfcCode({ nfcCode: oldNfcContent });
    if (!bicycle) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found.',
      });
    }
    return editBicycle({
      actorUserId,
      campId,
      identifier: bicycle.id,
      name: bikeName,
      nfcCode: newNfcContent,
      req,
    });
  }

  async function legacyEditHelmet({
    actorUserId,
    campId,
    oldNfcContent,
    newNfcContent,
    helmetName,
    req,
  }) {
    const helmet = await repository.findHelmetByNfcCode({ nfcCode: oldNfcContent, campId });
    if (!helmet) {
      throw new AppError({
        status: 404,
        code: 'HELMET_NOT_FOUND',
        message: 'The helmet was not found.',
      });
    }
    return editHelmet({
      actorUserId,
      campId,
      helmetId: helmet.id,
      code: helmetName,
      nfcCode: newNfcContent,
      req,
    });
  }

  async function legacyDeleteBicycle({ actorUserId, campId, bikeRemoveId, req }) {
    const bicycle = await resolveLegacyBicycle({ campId, value: bikeRemoveId });
    if (!bicycle) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found.',
      });
    }
    return deleteBicycle({
      actorUserId,
      campId: resolveLegacyCampId(campId, bicycle),
      identifier: bicycle.id,
      req,
    });
  }

  async function legacyDeleteHelmet({ actorUserId, campId, bikeRemoveId, helmetRemoveId, code, req }) {
    const helmet = await resolveLegacyHelmet({
      campId,
      value: helmetRemoveId || bikeRemoveId || code,
    });
    if (!helmet) {
      throw new AppError({
        status: 404,
        code: 'HELMET_NOT_FOUND',
        message: 'The helmet was not found.',
      });
    }
    return deleteHelmet({
      actorUserId,
      campId: resolveLegacyCampId(campId, helmet),
      helmetId: helmet.id,
      req,
    });
  }

  async function recentRentals({ actorUserId, campId, assetType, assetId, limit }) {
    await assertReadPermission(actorUserId);
    const result = resultBody(
      await bicyclesService.getRecentRentalsByAsset({ campId, assetType, assetId, limit }),
    );
    return success({ rentals: (result.rows || []).map(mapRental) });
  }

  async function activeAssignments({ actorUserId, campId, soldierId }) {
    await assertReadPermission(actorUserId);
    const result = resultBody(
      await bicyclesService.getActiveAssignmentsBySoldier({ campId, soldierId }),
    );
    return success({ assignments: (result.rows || []).map(mapRental) });
  }

  async function addBicycle({ actorUserId, campId, name, nfcCode, req }) {
    return bicyclesService.addBicycle({
      actorUserId,
      campId,
      name,
      nfcCode,
      requestMeta: buildRequestMeta(req),
    });
  }

  async function editBicycle(input) {
    return bicyclesService.editBicycle({
      ...input,
      requestMeta: buildRequestMeta(input.req),
    });
  }

  async function deleteBicycle({ actorUserId, campId, identifier, req }) {
    return bicyclesService.deleteBicycle({
      actorUserId,
      campId,
      identifier,
      requestMeta: buildRequestMeta(req),
    });
  }

  async function addHelmet({ actorUserId, campId, code, nfcCode, req }) {
    return bicyclesService.addHelmet({
      actorUserId,
      campId,
      code,
      nfcCode,
      requestMeta: buildRequestMeta(req),
    });
  }

  async function editHelmet({ actorUserId, campId, helmetId, code, nfcCode, req }) {
    return bicyclesService.editHelmet({
      actorUserId,
      campId,
      helmetId,
      code,
      nfcCode,
      requestMeta: buildRequestMeta(req),
    });
  }

  async function deleteHelmet({ actorUserId, campId, helmetId, req }) {
    return bicyclesService.deleteHelmet({
      actorUserId,
      campId,
      helmetId,
      requestMeta: buildRequestMeta(req),
    });
  }

  async function rentBicycle(input) {
    return bicyclesService.rentBicycle({
      ...input,
      requestMeta: buildRequestMeta(input.req),
    });
  }

  async function returnBicycle({ actorUserId, campId, identifier, returnedAt, req }) {
    return bicyclesService.returnBicycle({
      actorUserId,
      campId,
      identifier,
      returnedAt,
      requestMeta: buildRequestMeta(req),
    });
  }

  async function appVersion({ actorUserId }) {
    await assertAnyPermission(
      actorUserId,
      [BICYCLE_PERMISSIONS.downloadBikeApp],
      'You do not have permission to download the bicycle mobile app.',
    );

    return success({
      version: env?.APP_BIKE_VERSION || null,
      apkUrl: '/api/bike-app/mobile-app',
      sha256: env?.HASH_APP_BIKE || null,
    });
  }

  async function downloadMobileApp({ actorUserId, req }) {
    return bicyclesService.downloadBikeMobileApp({
      actorUserId,
      requestMeta: buildRequestMeta(req),
    });
  }

  return {
    activeAssignments,
    addBicycle,
    addHelmet,
    appVersion,
    currentPermissions,
    deleteBicycle,
    deleteHelmet,
    downloadMobileApp,
    editBicycle,
    editHelmet,
    inventory,
    legacyAddBicycle,
    legacyAddHelmet,
    legacyCheckBike,
    legacyDeleteBicycle,
    legacyDeleteHelmet,
    legacyEditBicycle,
    legacyEditHelmet,
    legacyLookupNfc,
    legacyRentBicycle,
    legacyReturnBicycle,
    listBicycles,
    listCamps,
    listHelmets,
    listSoldiers,
    lookupNfc,
    recentRentals,
    rentBicycle,
    returnBicycle,
  };
}

module.exports = { createBikeAppService };
