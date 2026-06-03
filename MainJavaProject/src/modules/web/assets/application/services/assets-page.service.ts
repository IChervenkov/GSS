// @ts-nocheck
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { AppError } = require('../../../../../shared/errors/app-error');
const { invalid, success } = require('../../../../../shared/application/action-result');
const { buildHorizontalNavItems } = require('../../../../../shared/public/js/ui/navigation');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');
const { formatUtcDateTimeDisplay } = require('../../../../../shared/datetime/display-date-time');
const { ASSETS_PAGE, ASSETS_PERMISSIONS } = require('../../domain/assets.page');

const ASSET_TEMPLATE_FILENAME = 'asset-template.xlsx';
const ASSET_TYPE_TEMPLATE_FILENAME = 'asset-type-template.xlsx';
const CLEAN_ITEM_TEMPLATE_FILENAME = 'clean-item-template.xlsx';
const DEFAULT_ASSET_APP_FILE_PATH = 'androidApp/gss-asset-1.5.3-release.apk';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_TEMPLATE_HEADERS = Object.freeze([
  'identifier',
  'code',
  'rfid code',
  'name',
  'type',
  'room',
  'key',
  'category',
  'quantity',
  'mrah',
  'owner',
  'status',
  'inventory status',
  'service',
  'm2 inside',
  'purchase date',
  'purchase price',
  'comments',
  'replaced off',
  'replaced by',
  'year of life cycle',
  'rest of life cycle',
  'rest value',
  'fixed',
  'quantitative',
  'description',
]);

const INVENTORY_STATUS_LABELS = Object.freeze({
  undiscovered: 'Not found',
  completed: 'Completed',
  written_off: 'Written off',
});
const ASSET_STATUS_VALUES = Object.freeze(['Excellent', 'Good', 'Fair', 'Poor', 'Unacceptable']);
const BED_ASSET_TYPE_NAME = 'Bed';
const CLEAN_ITEM_WAREHOUSES = Object.freeze({
  large: 'Large warehouse',
  small: 'Small warehouse',
});
const ASSET_TYPE_BULK_HEADERS = Object.freeze(['identifier', 'name']);
const CLEAN_ITEM_BULK_HEADERS = Object.freeze(['identifier', 'item name', 'total amount']);

function toNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value, fallback = 'No information') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeRequiredText(value, fieldName, max = 128) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text || text.length > max) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_FIELD',
      message: `${fieldName} is required and must be ${max} characters or fewer.`,
    });
  }
  return text;
}

function normalizeOptionalText(value, max = 512) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  return text ? text.slice(0, max) : null;
}

function formatSqlDateTime(date) {
  return [
    formatLocalDate(date),
    `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(
      date.getSeconds(),
    )}`,
  ].join(' ');
}

function normalizeOptionalDateTime(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = text.match(
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i,
  );
  if (match) {
    let hour = Number(match[2] || 0);
    const minute = Number(match[3] || 0);
    const second = Number(match[4] || 0);
    const meridiem = (match[5] || '').toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    if (hour <= 23 && minute <= 59 && second <= 59) {
      return `${match[1]} ${padDatePart(hour)}:${padDatePart(minute)}:${padDatePart(second)}`;
    }
  }
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_DATE',
      message: `${fieldName} must be a valid date.`,
    });
  }
  return formatSqlDateTime(date);
}

function normalizeQuantityText(value) {
  const text = String(value || '')
    .trim()
    .replace(',', '.');
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_QUANTITY',
      message: 'Asset quantity must be a positive number.',
    });
  }
  return text;
}

function normalizeRequiredLookupId(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_FIELD',
      message: `${fieldName} is required.`,
    });
  }
  return text;
}

function normalizeDecimalText(value, fieldName) {
  const text = String(value || '')
    .trim()
    .replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_DECIMAL',
      message: `${fieldName} must be a non-negative decimal number.`,
    });
  }
  return number.toFixed(2);
}

function normalizeNumberText(value, fieldName, max = 64) {
  const text = String(value || '')
    .trim()
    .replace(',', '.');
  if (!text) return null;
  if (text.length > max) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_NUMBER',
      message: `${fieldName} must be ${max} characters or fewer.`,
    });
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_NUMBER',
      message: `${fieldName} must be a non-negative number.`,
    });
  }
  return text;
}

function normalizeRfidCode(value, { required = true } = {}) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text && !required) return null;
  if (
    !text ||
    text.length < 2 ||
    text.length > 128 ||
    !/^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u.test(text)
  ) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_RFID_CODE',
      message:
        'RFID code must be 2-128 characters and contain only letters, numbers, _, :, . or -.',
    });
  }
  return text;
}

function normalizeInventoryStatus(value) {
  const status = String(value || 'undiscovered')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!Object.prototype.hasOwnProperty.call(INVENTORY_STATUS_LABELS, status)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_INVENTORY_STATUS',
      message: 'Choose a valid inventory status.',
    });
  }
  return status;
}

function normalizeAssetStatus(value) {
  const text = normalizeRequiredText(value, 'Asset status', 96);
  const match = ASSET_STATUS_VALUES.find((status) => status.toLowerCase() === text.toLowerCase());
  if (!match) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_STATUS',
      message: 'Asset status must be Excellent, Good, Fair, Poor, or Unacceptable.',
    });
  }
  return match;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value || '')
    .trim()
    .toLowerCase();
  return ['true', 'yes', '1', 'fixed'].includes(text);
}

function isBedAssetTypeName(value) {
  return String(value || '').trim().toLowerCase() === BED_ASSET_TYPE_NAME.toLowerCase();
}

function normalizePositiveInteger(value, fallback, { min = 1, max = 100 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeSortDirection(value) {
  const direction = String(value || 'default').toLowerCase();
  return ['asc', 'desc', 'default'].includes(direction) ? direction : 'default';
}

function normalizeTableState(rawState = {}, { filterColumns = [], sortColumns = [] } = {}) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const filters = {};
  const rawFilters = source.filters && typeof source.filters === 'object' ? source.filters : {};

  filterColumns.forEach((column) => {
    const search = normalizeText(rawFilters[column], '').slice(0, 128);
    if (search) filters[column] = search;
  });

  const sortDirection = normalizeSortDirection(source.sortDirection || source.direction);
  const requestedSortColumn = normalizeText(source.sortColumn || source.column, '');
  const sortColumn =
    sortDirection !== 'default' && sortColumns.includes(requestedSortColumn)
      ? requestedSortColumn
      : null;

  return {
    page: normalizePositiveInteger(source.page, 1, { min: 1, max: 100000 }),
    limit: normalizePositiveInteger(source.limit, 10, { min: 1, max: 100 }),
    filters,
    filterList: Object.entries(filters).map(([column, value]) => ({ column, value })),
    sortColumn,
    sortDirection: sortColumn ? sortDirection : 'default',
  };
}

function toIsoStringOrNull(value) {
  const date = value instanceof Date ? value : new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDate(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

function formatDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return value.trim().slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  return value && Number.isFinite(date.getTime()) ? formatLocalDate(date) : 'Not recorded';
}

function formatDateTime(value) {
  return formatUtcDateTimeDisplay(value, 'Not recorded');
}

function formatAssetDateTime(value) {
  if (typeof value === 'string') {
    const text = value.trim();
    const match = text.match(
      /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?)?/i,
    );
    if (match) {
      let hour = Number(match[2] || 0);
      const minute = match[3] || '00';
      const meridiem = (match[4] || '').toUpperCase();
      if (meridiem === 'PM' && hour < 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;
      const outputMeridiem = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${match[1]} ${padDatePart(hour12)}:${minute} ${outputMeridiem}`;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return 'Not recorded';
  const hour24 = date.getHours();
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return [
    formatLocalDate(date),
    `${padDatePart(hour12)}:${padDatePart(date.getMinutes())} ${meridiem}`,
  ].join(' ');
}

function formatLocation(asset = {}) {
  return (
    [asset.buildingName, asset.locationRoomName, asset.locationKeyName]
      .filter(Boolean)
      .join(' / ') || 'Unassigned'
  );
}

function normalizeAsset(asset = {}) {
  const inventoryStatus = String(asset.inventoryStatus || 'undiscovered').trim() || 'undiscovered';
  return {
    id: asset.id,
    code: normalizeText(asset.code, 'No code'),
    rfidCode: normalizeText(asset.rfidCode, 'No RFID'),
    name: normalizeText(asset.name),
    typeName: normalizeText(asset.typeName, 'Unassigned type'),
    location: formatLocation(asset),
    quantity: normalizeText(asset.quantity, '0'),
    quantityNumber: toNumber(asset.quantity),
    owner: normalizeText(asset.owner),
    status: normalizeText(asset.status),
    category: normalizeText(asset.category),
    service: normalizeText(asset.service),
    description: normalizeText(asset.description),
    mrah: normalizeText(asset.mrah),
    m2Inside: normalizeText(asset.m2Inside),
    comments: normalizeText(asset.comments),
    replacedOff: normalizeText(asset.replacedOff),
    replacedBy: normalizeText(asset.replacedBy),
    yearOfLifeCycle: normalizeText(asset.yearOfLifeCycle),
    restOfLifeCycle: normalizeText(asset.restOfLifeCycle),
    restValue: normalizeText(asset.restValue),
    purchasePrice: normalizeText(asset.purchasePrice),
    typeId: asset.typeId || null,
    locationRoomId: asset.locationRoomId || null,
    locationRoomName: asset.locationRoomName || null,
    locationKeyId: asset.locationKeyId || null,
    locationKeyName: asset.locationKeyName || null,
    expandable: normalizeText(asset.expandable, 'Non Expandable'),
    isFixed: Boolean(asset.isFixed),
    isQuantitative: Boolean(asset.isQuantitative),
    isFixedLabel: asset.isFixed ? 'Yes' : 'No',
    isQuantitativeLabel: asset.isQuantitative ? 'Yes' : 'No',
    inventoryStatus,
    inventoryStatusLabel: INVENTORY_STATUS_LABELS[inventoryStatus] || inventoryStatus,
    lastInventoryDate: formatDateTime(asset.lastInventoryDate),
    purchaseDate: formatAssetDateTime(asset.purchaseDate),
    writtenOffDate: formatAssetDateTime(asset.writtenOffDate),
    createdAt: formatDateTime(asset.createdAt),
    updatedAt: formatDateTime(asset.updatedAt),
  };
}

function buildInventoryStatusRows(assets = []) {
  const counts = new Map(
    Object.keys(INVENTORY_STATUS_LABELS).map((status) => [
      status,
      {
        status,
        label: INVENTORY_STATUS_LABELS[status],
        assetCount: 0,
        quantity: 0,
        lastInventoryDate: null,
      },
    ]),
  );

  assets.forEach((asset) => {
    const status = asset.inventoryStatus || 'undiscovered';
    if (!counts.has(status)) {
      counts.set(status, {
        status,
        label: INVENTORY_STATUS_LABELS[status] || status,
        assetCount: 0,
        quantity: 0,
        lastInventoryDate: null,
      });
    }
    const row = counts.get(status);
    row.assetCount += 1;
    row.quantity += asset.quantityNumber;
    const inventoryTimestamp = asset.lastInventoryDate
      ? new Date(asset.lastInventoryDate).getTime()
      : Number.NaN;
    if (
      Number.isFinite(inventoryTimestamp) &&
      (!Number.isFinite(row.lastInventoryTimestamp) ||
        inventoryTimestamp > row.lastInventoryTimestamp)
    ) {
      row.lastInventoryTimestamp = inventoryTimestamp;
      row.lastInventoryDate = formatDateTime(asset.lastInventoryDate);
    }
  });

  return Array.from(counts.values()).map((row) => {
    const output = { ...row };
    delete output.lastInventoryTimestamp;
    return {
      ...output,
      quantity: String(output.quantity),
      lastInventoryDate: output.lastInventoryDate || 'Not recorded',
    };
  });
}

function normalizeAssetType(row = {}) {
  return {
    id: row.id,
    name: normalizeText(row.name, 'Unnamed type'),
    assetCount: Number(row.assetCount) || 0,
    notFoundCount: Number(row.notFoundCount) || 0,
    completedCount: Number(row.completedCount) || 0,
    isProtected: isBedAssetTypeName(row.name),
  };
}

function normalizeCleanItem(row = {}) {
  const warehouse = String(row.warehouse || 'large').trim() || 'large';
  const totalAmount = Number(row.totalAmount) || 0;
  const countGetItem = Number(row.countGetItem) || 0;
  return {
    id: row.id,
    itemName: normalizeText(row.itemName, 'Unnamed item'),
    totalAmount,
    countGetItem,
    availableAmount: Number(row.availableAmount ?? totalAmount - countGetItem) || 0,
    warehouse,
    warehouseLabel: CLEAN_ITEM_WAREHOUSES[warehouse] || warehouse,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

function normalizeInventoryEvent(row = {}) {
  return {
    id: row.id || `${row.changedAt || 'event'}-${row.createdAt || ''}`,
    changedAt: formatDate(row.changedAt),
    addedQuantity: normalizeText(row.addedQuantity, '0'),
    removedQuantity: normalizeText(row.removedQuantity, '0'),
    lostQuantity: normalizeText(row.lostQuantity, '0'),
    modifiedQuantity: normalizeText(row.modifiedQuantity, '0'),
  };
}

function normalizeRoom(row = {}) {
  const buildingName = normalizeText(row.buildingName, '');
  const buildingType = normalizeText(row.buildingType, '');
  return {
    id: row.id,
    name: normalizeText(row.name, 'Unnamed room'),
    buildingName,
    buildingType,
    label: normalizeText(row.name, 'Unnamed room'),
    meta: [buildingName, buildingType].filter(Boolean).join(' | '),
  };
}

function normalizeKey(row = {}) {
  const buildingName = normalizeText(row.buildingName, '');
  const roomName = normalizeText(row.roomName, '');
  const status = normalizeText(row.status, row.soldierId ? 'Occupied' : 'Free');
  return {
    id: row.id,
    name: normalizeText(row.name, 'Unnamed key'),
    roomId: row.roomId || null,
    roomName: roomName || null,
    buildingName: buildingName || null,
    buildingType: normalizeText(row.buildingType, '') || null,
    status,
    label: normalizeText(row.name, 'Unnamed key'),
    meta: [buildingName, roomName, status].filter(Boolean).join(' | '),
  };
}

function normalizeAssetLookup(row = {}) {
  const code = normalizeText(row.code, '');
  const name = normalizeText(row.name, '');
  return {
    id: row.id,
    code,
    name,
    label: [code, name].filter(Boolean).join(' - ') || normalizeText(row.id, 'Unnamed asset'),
    meta: [row.typeName, formatLocation(row)].filter(Boolean).join(' | '),
  };
}

function normalizeInventoryStatusRow(row = {}) {
  const status = String(row.status || 'undiscovered').trim() || 'undiscovered';
  return {
    status,
    label: row.label || INVENTORY_STATUS_LABELS[status] || status,
    assetCount: Number(row.assetCount) || 0,
    quantity: normalizeText(row.quantity, '0'),
    lastInventoryDate: formatDateTime(row.lastInventoryDate),
  };
}

function tableMeta(result = {}) {
  return {
    page: Number(result.page) || 1,
    limit: Number(result.limit) || 10,
    total: Number(result.total) || 0,
    totalPages: Number(result.totalPages) || 1,
    sourceTotal: Number(result.sourceTotal) || 0,
    filters: result.filters && typeof result.filters === 'object' ? result.filters : {},
    sortColumn: result.sortColumn || null,
    sortDirection: result.sortDirection || 'default',
  };
}

function buildEmptyAssetsOverview() {
  return {
    totalAssets: 0,
    totalQuantity: '0',
    notFoundAssets: 0,
    completedAssets: 0,
    typeCount: 0,
    allAssets: [],
    notFoundRows: [],
    inventoryStatusRows: buildInventoryStatusRows([]),
    assetTypes: [],
    cleanItems: [],
    inventoryEvents: [],
    cleanItemSummary: {
      totalItems: 0,
      totalAmount: '0',
      largeTotalAmount: '0',
      smallTotalAmount: '0',
      checkedOutAmount: '0',
      largeCheckedOutAmount: '0',
      smallCheckedOutAmount: '0',
    },
    lookups: {
      assetTypes: [],
      rooms: [],
      keys: [],
      assets: [],
    },
    tables: {
      allAssets: tableMeta(),
      notFoundRows: tableMeta(),
      inventoryStatusRows: {
        ...tableMeta(),
        sourceTotal: Object.keys(INVENTORY_STATUS_LABELS).length,
      },
      inventoryEvents: tableMeta(),
      assetTypes: tableMeta(),
      cleanItems: tableMeta(),
    },
  };
}

async function buildAssetLookups({ repository, campId }) {
  if (!campId) {
    return { assetTypes: [], rooms: [], keys: [] };
  }

  const [assetTypes, rooms, keys, assets] = await Promise.all([
    typeof repository.listAssetTypesByCamp === 'function'
      ? repository.listAssetTypesByCamp({ campId })
      : [],
    typeof repository.listRoomsByCamp === 'function' ? repository.listRoomsByCamp({ campId }) : [],
    typeof repository.listKeysByCamp === 'function' ? repository.listKeysByCamp({ campId }) : [],
    typeof repository.listAssetsByCamp === 'function'
      ? repository.listAssetsByCamp({ campId })
      : [],
  ]);

  return {
    assetTypes: (Array.isArray(assetTypes) ? assetTypes : []).map(normalizeAssetType),
    rooms: (Array.isArray(rooms) ? rooms : []).map(normalizeRoom),
    keys: (Array.isArray(keys) ? keys : []).map(normalizeKey),
    assets: (Array.isArray(assets) ? assets : []).map(normalizeAssetLookup),
  };
}

function normalizeTableStates(tableState = {}) {
  const stateSource = tableState && typeof tableState === 'object' ? tableState : {};
  const assetSortColumns = [
    'id',
    'code',
    'rfidCode',
    'name',
    'typeName',
    'location',
    'quantity',
    'status',
    'inventoryStatus',
    'lastInventoryDate',
    'owner',
    'category',
    'service',
    'expandable',
    'isFixedLabel',
    'isQuantitativeLabel',
    'description',
    'mrah',
    'm2Inside',
    'comments',
    'replacedOff',
    'replacedBy',
    'yearOfLifeCycle',
    'restOfLifeCycle',
    'restValue',
    'purchaseDate',
    'writtenOffDate',
    'purchasePrice',
    'createdAt',
    'updatedAt',
  ];

  return {
    allAssets: normalizeTableState(stateSource.allAssets, {
      filterColumns: [
        'id',
        'code',
        'rfidCode',
        'name',
        'typeName',
        'location',
        'status',
        'inventoryStatus',
        'lastInventoryDate',
        'owner',
        'category',
        'service',
        'expandable',
        'isFixedLabel',
        'isQuantitativeLabel',
        'description',
        'mrah',
        'comments',
        'replacedOff',
        'replacedBy',
        'purchaseDate',
        'writtenOffDate',
        'createdAt',
        'updatedAt',
      ],
      sortColumns: assetSortColumns,
    }),
    notFoundRows: normalizeTableState(stateSource.notFoundRows, {
      filterColumns: [
        'id',
        'code',
        'rfidCode',
        'name',
        'typeName',
        'location',
        'status',
        'inventoryStatus',
        'lastInventoryDate',
        'owner',
        'category',
        'service',
        'expandable',
        'isFixedLabel',
        'isQuantitativeLabel',
        'description',
        'mrah',
        'comments',
        'replacedOff',
        'replacedBy',
        'purchaseDate',
        'writtenOffDate',
        'createdAt',
        'updatedAt',
      ],
      sortColumns: assetSortColumns,
    }),
    inventoryStatusRows: normalizeTableState(stateSource.inventoryStatusRows, {
      filterColumns: ['status', 'lastInventoryDate'],
      sortColumns: ['status', 'assetCount', 'lastInventoryDate', 'quantity'],
    }),
    inventoryEvents: normalizeTableState(stateSource.inventoryEvents, {
      filterColumns: ['changedAt'],
      sortColumns: [
        'changedAt',
        'addedQuantity',
        'removedQuantity',
        'lostQuantity',
        'modifiedQuantity',
      ],
    }),
    assetTypes: normalizeTableState(stateSource.assetTypes, {
      filterColumns: ['id', 'name'],
      sortColumns: ['id', 'name', 'assetCount', 'notFoundCount', 'completedCount'],
    }),
    cleanItems: normalizeTableState(stateSource.cleanItems, {
      filterColumns: ['id', 'itemName', 'warehouse'],
      sortColumns: [
        'id',
        'itemName',
        'totalAmount',
        'countGetItem',
        'availableAmount',
        'warehouse',
      ],
    }),
  };
}

function repositoryState(state) {
  return {
    page: state.page,
    limit: state.limit,
    filters: state.filterList,
    sortColumn: state.sortColumn,
    sortDirection: state.sortDirection,
  };
}

async function buildAssetsOverview({ repository, campId, tableState = {} }) {
  if (!campId) return buildEmptyAssetsOverview();

  const states = normalizeTableStates(tableState);
  const [
    summary,
    allAssetsTable,
    notFoundTable,
    inventoryStatusTable,
    assetTypesTable,
    cleanItemsTable,
    cleanItemSummary,
    inventoryEventsTable,
    lookups,
  ] = await Promise.all([
    repository.getAssetSummary({ campId }),
    repository.listAssetsTable({ campId, state: repositoryState(states.allAssets) }),
    repository.listNotFoundAssetsTable({ campId, state: repositoryState(states.notFoundRows) }),
    repository.listInventoryStatusTable({
      campId,
      state: repositoryState(states.inventoryStatusRows),
    }),
    repository.listAssetTypesTable({ campId, state: repositoryState(states.assetTypes) }),
    typeof repository.listCleanItemsTable === 'function'
      ? repository.listCleanItemsTable({ campId, state: repositoryState(states.cleanItems) })
      : { rows: [], total: 0, sourceTotal: 0, page: 1, limit: 10, totalPages: 1 },
    typeof repository.getCleanItemSummary === 'function'
      ? repository.getCleanItemSummary({ campId })
      : {
          totalItems: 0,
          totalAmount: '0',
          largeTotalAmount: '0',
          smallTotalAmount: '0',
          checkedOutAmount: '0',
          largeCheckedOutAmount: '0',
          smallCheckedOutAmount: '0',
        },
    repository.listInventoryEventsTable({
      campId,
      state: repositoryState(states.inventoryEvents),
    }),
    buildAssetLookups({ repository, campId }),
  ]);

  return {
    totalAssets: summary.totalAssets,
    totalQuantity: summary.totalQuantity,
    notFoundAssets: summary.notFoundAssets,
    completedAssets: summary.completedAssets,
    typeCount: summary.typeCount,
    allAssets: allAssetsTable.rows.map(normalizeAsset),
    notFoundRows: notFoundTable.rows.map(normalizeAsset),
    inventoryStatusRows: inventoryStatusTable.rows.map(normalizeInventoryStatusRow),
    assetTypes: assetTypesTable.rows.map(normalizeAssetType),
    cleanItems: cleanItemsTable.rows.map(normalizeCleanItem),
    cleanItemSummary,
    inventoryEvents: inventoryEventsTable.rows.map(normalizeInventoryEvent),
    lookups,
    tables: {
      allAssets: tableMeta(allAssetsTable),
      notFoundRows: tableMeta(notFoundTable),
      inventoryStatusRows: tableMeta(inventoryStatusTable),
      assetTypes: tableMeta(assetTypesTable),
      cleanItems: tableMeta(cleanItemsTable),
      inventoryEvents: tableMeta(inventoryEventsTable),
    },
  };
}

function assertCampSelected(campId) {
  if (!campId) {
    throw new AppError({
      status: 400,
      code: 'CAMP_REQUIRED',
      message: 'Select an active camp before managing assets.',
    });
  }
}

function assertImportFile({ fileBuffer, fileName, resourceName, code }) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new AppError({
      status: 400,
      code,
      message: `Select a ${resourceName} template file before uploading.`,
    });
  }

  if (!String(fileName || '').toLowerCase().endsWith('.xlsx')) {
    throw new AppError({
      status: 400,
      code,
      message: `Only .xlsx ${resourceName} template files are supported.`,
    });
  }
}

function normalizeAssetInput(payload = {}) {
  const isQuantitative = normalizeBoolean(payload.isQuantitative);
  const fallbackRfidCode = payload.code ? String(payload.code).trim() : '';
  const normalizedQuantity = normalizeQuantityText(payload.quantity);
  return {
    code: normalizeRequiredText(payload.code, 'Asset code', 64),
    rfidCode: isQuantitative
      ? normalizeRfidCode(payload.rfidCode, { required: false })
      : normalizeRfidCode(payload.rfidCode || fallbackRfidCode),
    name: normalizeRequiredText(payload.name, 'Asset name', 128),
    typeId: normalizeRequiredLookupId(payload.typeId, 'Asset type'),
    locationRoomId: normalizeRequiredLookupId(payload.locationRoomId, 'Room'),
    locationKeyId: payload.locationKeyId || null,
    category: normalizeOptionalText(payload.category, 96),
    quantity: isQuantitative ? normalizedQuantity : '1',
    owner: normalizeOptionalText(payload.owner, 96) || 'Global RTS',
    status: normalizeAssetStatus(payload.status),
    expandable: payload.expandable === 'Expandable' ? 'Expandable' : 'Non Expandable',
    description: normalizeOptionalText(payload.description, 512),
    service: normalizeOptionalText(payload.service, 96) || 'Billeting',
    mrah: normalizeOptionalText(payload.mrah, 96) || 'Global RTS',
    m2Inside: normalizeDecimalText(payload.m2Inside, 'M2 inside'),
    purchaseDate: normalizeOptionalDateTime(payload.purchaseDate, 'Purchase date'),
    writtenOffDate: null,
    purchasePrice: normalizeDecimalText(payload.purchasePrice, 'Purchase price'),
    lastInventoryDate: null,
    comments: normalizeOptionalText(payload.comments, 512),
    replacedOff: normalizeOptionalText(payload.replacedOff, 256),
    replacedBy: normalizeOptionalText(payload.replacedBy, 256),
    yearOfLifeCycle: normalizeNumberText(payload.yearOfLifeCycle, 'Lifecycle year'),
    restOfLifeCycle: normalizeNumberText(payload.restOfLifeCycle, 'Lifecycle rest'),
    restValue: normalizeNumberText(payload.restValue, 'Rest value'),
    inventoryStatus: normalizeInventoryStatus(payload.inventoryStatus),
    isFixed: normalizeBoolean(payload.isFixed),
    isQuantitative,
  };
}

function normalizeAssetTypeInput(value) {
  const name = normalizeRequiredText(value, 'Asset type name', 96);
  if (isBedAssetTypeName(name)) return BED_ASSET_TYPE_NAME;
  return name;
}

function normalizeWarehouse(value) {
  const warehouse = String(value || 'large')
    .trim()
    .toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(CLEAN_ITEM_WAREHOUSES, warehouse)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CLEAN_ITEM_WAREHOUSE',
      message: 'Warehouse must be large or small.',
    });
  }
  return warehouse;
}

function normalizeCleanItemAmount(value, fieldName) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CLEAN_ITEM_AMOUNT',
      message: `${fieldName} must be a non-negative number.`,
    });
  }
  return number;
}

function normalizeCleanItemMoveQuantity(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isInteger(number) || number <= 0) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CLEAN_ITEM_MOVE_QUANTITY',
      message: 'Move quantity must be a positive whole number.',
    });
  }
  return number;
}

function normalizeCleanItemInput(payload = {}) {
  const totalAmount = normalizeCleanItemAmount(payload.totalAmount, 'Total amount');
  const countGetItem = normalizeCleanItemAmount(payload.countGetItem || 0, 'Checked out amount');
  if (countGetItem > totalAmount) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CLEAN_ITEM_AMOUNT',
      message: 'Checked out amount cannot be greater than total amount.',
    });
  }
  return {
    itemName: normalizeRequiredText(payload.itemName, 'Clean item name', 128),
    totalAmount,
    countGetItem,
    warehouse: normalizeWarehouse(payload.warehouse),
  };
}

function normalizeCleanItemEditInput(payload = {}, existing = {}) {
  const quantity = normalizeCleanItemAmount(payload.totalAmount, 'Quantity');
  const warehouse = normalizeWarehouse(existing.warehouse);
  const currentQuantity = Number(
    existing.availableAmount ?? Number(existing.totalAmount || 0) - Number(existing.countGetItem || 0),
  ) || 0;

  if (warehouse === 'large' && quantity < currentQuantity) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CLEAN_ITEM_AMOUNT',
      message: 'Large warehouse quantity can only be increased.',
    });
  }

  if (warehouse === 'small' && quantity > currentQuantity) {
    throw new AppError({
      status: 400,
      code: 'INVALID_CLEAN_ITEM_AMOUNT',
      message: 'Small warehouse quantity can only be reduced.',
    });
  }

  return {
    itemName: normalizeRequiredText(payload.itemName, 'Clean item name', 128),
    totalAmount: quantity,
    warehouse,
  };
}

function parseSimpleCsvRows(payload, headers, { emptyCode, invalidCode, invalidMessage }) {
  const text = String(payload || '').trim();
  if (!text) {
    throw new AppError({
      status: 400,
      code: emptyCode,
      message: 'Paste at least one row before running a bulk update.',
    });
  }

  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), rowNumber: index + 1 }))
    .filter((row) => row.line && !row.line.startsWith('#'))
    .map(({ line, rowNumber }) => {
      const parts = line.split(',').map((part) => part.trim());
      const offset = normalizeHeader(parts[0]) === headers[0] ? 1 : 0;
      if (offset) return null;
      if (parts.length !== headers.length) {
        throw new AppError({
          status: 400,
          code: invalidCode,
          message: invalidMessage,
        });
      }
      const values = headers.reduce((acc, header, index) => {
        acc[header] = parts[index] || '';
        return acc;
      }, {});
      const id = values.identifier;
      if (id && !UUID_PATTERN.test(id)) {
        throw new AppError({
          status: 400,
          code: invalidCode,
          message: `Row ${rowNumber} has an invalid identifier.`,
        });
      }
      return { rowNumber, id: id || null, values };
    })
    .filter(Boolean);
}

function parseAssetTypeBulkRows(payload) {
  return parseSimpleCsvRows(payload, ASSET_TYPE_BULK_HEADERS, {
    emptyCode: 'EMPTY_ASSET_TYPE_BULK_UPDATE',
    invalidCode: 'INVALID_ASSET_TYPE_BULK_ROW',
    invalidMessage: 'Asset type rows must use identifier, name.',
  }).map((row) => ({
    rowNumber: row.rowNumber,
    id: row.id,
    name: normalizeAssetTypeInput(row.values.name),
  }));
}

function parseCleanItemBulkRows(payload) {
  return parseSimpleCsvRows(payload, CLEAN_ITEM_BULK_HEADERS, {
    emptyCode: 'EMPTY_CLEAN_ITEM_BULK_UPDATE',
    invalidCode: 'INVALID_CLEAN_ITEM_BULK_ROW',
    invalidMessage: 'Clean item rows must use identifier, item name, total amount.',
  }).map((row) => ({
    rowNumber: row.rowNumber,
    id: row.id,
    ...normalizeCleanItemInput({
      itemName: row.values['item name'],
      totalAmount: row.values['total amount'],
      countGetItem: 0,
      warehouse: 'large',
    }),
  }));
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function readCellText(cell) {
  if (!cell) return '';
  if (cell.value instanceof Date) return formatSqlDateTime(cell.value);
  return String(cell.text || cell.value || '').trim();
}

function findLookupByIdOrName(rows = [], value, { fieldName }) {
  const match = findLookupRowByIdOrName(rows, value, { fieldName });
  return match?.id || null;
}

function findLookupRowByIdOrName(rows = [], value, { fieldName }) {
  const text = String(value || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const match = rows.find(
    (row) =>
      String(row.id || '').toLowerCase() === lower ||
      String(row.code || '').toLowerCase() === lower ||
      String(row.name || '').toLowerCase() === lower ||
      String(row.label || '').toLowerCase() === lower,
  );
  if (!match) {
    throw new AppError({
      status: 400,
      code: 'ASSET_LOOKUP_NOT_FOUND',
      message: `${fieldName} "${text}" was not found in the selected camp.`,
    });
  }
  return match;
}

function normalizeAssetReference(value, rows = [], fieldName) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = findLookupRowByIdOrName(rows, text, { fieldName });
  return match.label || match.code || match.name || match.id;
}

function assetHasBedKey(asset = {}, assetTypes = []) {
  if (!asset?.locationKeyId) return false;
  if (isBedAssetTypeName(asset.typeName)) return true;
  const assetType = assetTypes.find((type) => String(type.id || '') === String(asset.typeId || ''));
  return isBedAssetTypeName(assetType?.name);
}

function assertQuantitativeAssetTypeAllowed(asset = {}, assetTypes = []) {
  if (!asset?.isQuantitative) return;
  if (isBedAssetTypeName(asset.typeName)) {
    throw new AppError({
      status: 400,
      code: 'ASSET_QUANTITATIVE_BED_TYPE_NOT_ALLOWED',
      message: 'Quantitative assets cannot use the Bed asset type.',
    });
  }
  const assetType = assetTypes.find((type) => String(type.id || '') === String(asset.typeId || ''));
  if (isBedAssetTypeName(assetType?.name)) {
    throw new AppError({
      status: 400,
      code: 'ASSET_QUANTITATIVE_BED_TYPE_NOT_ALLOWED',
      message: 'Quantitative assets cannot use the Bed asset type.',
    });
  }
}

function parseBulkRows(payload) {
  const text = String(payload || '').trim();
  if (!text) {
    throw new AppError({
      status: 400,
      code: 'EMPTY_ASSET_BULK_UPDATE',
      message: 'Paste at least one asset row before running a bulk update.',
    });
  }

  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), rowNumber: index + 1 }))
    .filter((row) => row.line && !row.line.startsWith('#'))
    .map(({ line, rowNumber }) => {
      const parts = line.split(',').map((part) => part.trim());
      if (parts.length < 8 || parts.length > ASSET_TEMPLATE_HEADERS.length) {
        throw new AppError({
          status: 400,
          code: 'INVALID_ASSET_BULK_ROW',
          message:
            `Asset rows must use ${ASSET_TEMPLATE_HEADERS.join(', ')}.`,
        });
      }
      let rowValues = {};
      if (parts.length === ASSET_TEMPLATE_HEADERS.length) {
        rowValues = ASSET_TEMPLATE_HEADERS.reduce((acc, header, index) => {
          acc[header] = parts[index] || '';
          return acc;
        }, {});
      } else {
        const hasRfidColumn = parts.length > 14;
        const offset = hasRfidColumn ? 1 : 0;
        rowValues = {
          identifier: parts[0] || '',
          code: parts[1] || '',
          'rfid code': hasRfidColumn ? parts[2] || '' : '',
          name: parts[2 + offset] || '',
          type: parts[3 + offset] || '',
          room: parts[4 + offset] || '',
          key: parts[5 + offset] || '',
          category: parts[6 + offset] || '',
          quantity: parts[7 + offset] || '',
          mrah: '',
          owner: parts[8 + offset] || '',
          status: parts[9 + offset] || '',
          'inventory status': parts[10 + offset] || '',
          service: parts[11 + offset] || '',
          'm2 inside': '',
          'purchase date': '',
          'written off date': '',
          'purchase price': '',
          'last inventory date': '',
          comments: '',
          'replaced off': '',
          'replaced by': '',
          'year of life cycle': '',
          'rest of life cycle': '',
          'rest value': '',
          fixed: parts[12 + offset] || '',
          quantitative: hasRfidColumn ? parts[14] || '' : '',
          description: parts[13 + (hasRfidColumn ? 2 : 0)] || '',
        };
      }
      const id = rowValues.identifier;
      if (id && !UUID_PATTERN.test(id)) {
        throw new AppError({
          status: 400,
          code: 'INVALID_ASSET_BULK_IDENTIFIER',
          message: `Row ${rowNumber} has an invalid identifier.`,
        });
      }
      return {
        rowNumber,
        id: id || null,
        code: rowValues.code,
        rfidCode: rowValues['rfid code'],
        name: rowValues.name,
        type: rowValues.type,
        room: rowValues.room,
        key: rowValues.key,
        category: rowValues.category,
        quantity: rowValues.quantity,
        mrah: rowValues.mrah,
        owner: rowValues.owner,
        status: rowValues.status,
        inventoryStatus: rowValues['inventory status'],
        service: rowValues.service,
        m2Inside: rowValues['m2 inside'],
        purchaseDate: rowValues['purchase date'],
        writtenOffDate: rowValues['written off date'],
        purchasePrice: rowValues['purchase price'],
        lastInventoryDate: rowValues['last inventory date'],
        comments: rowValues.comments,
        replacedOff: rowValues['replaced off'],
        replacedBy: rowValues['replaced by'],
        yearOfLifeCycle: rowValues['year of life cycle'],
        restOfLifeCycle: rowValues['rest of life cycle'],
        restValue: rowValues['rest value'],
        isFixed: rowValues.fixed,
        isQuantitative: rowValues.quantitative,
        description: rowValues.description,
      };
    });
}

async function readAssetTemplateRows(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_TEMPLATE_FILE',
      message: 'The uploaded file must be a valid .xlsx asset template.',
    });
  }

  const worksheet =
    workbook.getWorksheet('Assets') ||
    workbook.worksheets.find((sheet) => normalizeHeader(sheet.name) !== 'instructions') ||
    workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError({
      status: 400,
      code: 'ASSET_TEMPLATE_WORKSHEET_MISSING',
      message: 'The uploaded template does not contain an Assets worksheet.',
    });
  }

  const headerRow = worksheet.getRow(1);
  ASSET_TEMPLATE_HEADERS.forEach((header, index) => {
    if (normalizeHeader(readCellText(headerRow.getCell(index + 1))) !== header) {
      throw new AppError({
        status: 400,
        code: 'INVALID_ASSET_TEMPLATE_HEADERS',
        message: 'The asset template headers are invalid. Download a fresh template and try again.',
      });
    }
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = ASSET_TEMPLATE_HEADERS.map((_, index) => readCellText(row.getCell(index + 1)));
    if (values.every((value) => !String(value || '').trim())) return;
    const rowValues = ASSET_TEMPLATE_HEADERS.reduce((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});
    rows.push({
      rowNumber,
      id: rowValues.identifier || null,
      code: rowValues.code,
      rfidCode: rowValues['rfid code'],
      name: rowValues.name,
      type: rowValues.type,
      room: rowValues.room,
      key: rowValues.key,
      category: rowValues.category,
      quantity: rowValues.quantity,
      mrah: rowValues.mrah,
      owner: rowValues.owner,
      status: rowValues.status,
      inventoryStatus: rowValues['inventory status'],
      service: rowValues.service,
      m2Inside: rowValues['m2 inside'],
      purchaseDate: rowValues['purchase date'],
      writtenOffDate: rowValues['written off date'],
      purchasePrice: rowValues['purchase price'],
      lastInventoryDate: rowValues['last inventory date'],
      comments: rowValues.comments,
      replacedOff: rowValues['replaced off'],
      replacedBy: rowValues['replaced by'],
      yearOfLifeCycle: rowValues['year of life cycle'],
      restOfLifeCycle: rowValues['rest of life cycle'],
      restValue: rowValues['rest value'],
      isFixed: rowValues.fixed,
      isQuantitative: rowValues.quantitative,
      description: rowValues.description,
    });
  });
  return rows;
}

async function readSimpleTemplateRows(fileBuffer, { worksheetName, headers, errorPrefix, label }) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError({
      status: 400,
      code: `INVALID_${errorPrefix}_TEMPLATE_FILE`,
      message: `The uploaded file must be a valid .xlsx ${label} template.`,
    });
  }

  const worksheet =
    workbook.getWorksheet(worksheetName) ||
    workbook.worksheets.find((sheet) => normalizeHeader(sheet.name) !== 'instructions') ||
    workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError({
      status: 400,
      code: `${errorPrefix}_TEMPLATE_WORKSHEET_MISSING`,
      message: `The uploaded template does not contain a ${worksheetName} worksheet.`,
    });
  }

  const headerRow = worksheet.getRow(1);
  headers.forEach((header, index) => {
    if (normalizeHeader(readCellText(headerRow.getCell(index + 1))) !== header) {
      throw new AppError({
        status: 400,
        code: `INVALID_${errorPrefix}_TEMPLATE_HEADERS`,
        message: `The ${label} template headers are invalid. Download a fresh template and try again.`,
      });
    }
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = headers.map((_, index) => readCellText(row.getCell(index + 1)));
    if (values.every((value) => !String(value || '').trim())) return;
    const rowValues = headers.reduce((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});
    const id = rowValues.identifier;
    if (id && !UUID_PATTERN.test(id)) {
      throw new AppError({
        status: 400,
        code: `INVALID_${errorPrefix}_TEMPLATE_IDENTIFIER`,
        message: `Row ${rowNumber} has an invalid identifier.`,
      });
    }
    rows.push({ rowNumber, id: id || null, values: rowValues });
  });
  return rows;
}

async function readAssetTypeTemplateRows(fileBuffer) {
  const rows = await readSimpleTemplateRows(fileBuffer, {
    worksheetName: 'Asset Types',
    headers: ASSET_TYPE_BULK_HEADERS,
    errorPrefix: 'ASSET_TYPE',
    label: 'asset type',
  });
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    id: row.id,
    name: row.values.name,
  }));
}

async function readCleanItemTemplateRows(fileBuffer) {
  const rows = await readSimpleTemplateRows(fileBuffer, {
    worksheetName: 'Clean Items',
    headers: CLEAN_ITEM_BULK_HEADERS,
    errorPrefix: 'CLEAN_ITEM',
    label: 'clean item',
  });
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    id: row.id,
    itemName: row.values['item name'],
    totalAmount: row.values['total amount'],
    countGetItem: 0,
    warehouse: 'large',
  }));
}

function summarizeBulkRows({ totalRows, rows, results = [], errors = [] }) {
  const addedCount = results.filter((result) => result.action === 'added').length;
  const updatedCount = results.filter((result) => result.action === 'updated').length;
  const missingCount = results.filter((result) => result.action === 'missing').length;
  const errorCount = errors.length;
  const hasFailures = missingCount > 0 || errorCount > 0;
  const messageParts = [
    `${addedCount} added`,
    `${updatedCount} updated`,
    `${missingCount} missing`,
  ];
  if (errorCount > 0) messageParts.push(`${errorCount} errors`);

  return (hasFailures ? invalid : success)({
    message: `${messageParts.join(', ')}.`,
    summary: {
      totalRows: Number(totalRows) || rows.length + errorCount,
      processedRows: Number(totalRows) || rows.length + errorCount,
      addedCount,
      updatedCount,
      missingCount,
      skippedCount: missingCount,
      errorCount,
      errors,
    },
    rows: results.map((result, index) => ({
      rowNumber: rows[index]?.rowNumber || index + 1,
      action: result.action,
      asset: result.asset ? normalizeAsset(result.asset) : null,
    })),
  });
}

async function loadAssetsMobileAppFile({ env }) {
  const configuredPath =
    String(env?.APP_ASSET_FILE_PATH || '').trim() || DEFAULT_ASSET_APP_FILE_PATH;
  const resolvedPath = path.resolve(process.cwd(), configuredPath);
  const fileName = path.basename(resolvedPath);

  let buffer;
  try {
    buffer = await fs.readFile(resolvedPath);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') {
      throw new AppError({
        status: 404,
        code: 'ASSETS_MOBILE_APP_NOT_FOUND',
        message: 'The assets mobile application package is not available.',
      });
    }
    throw error;
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hash !== env?.HASH_APP_ASSET) {
    throw new AppError({
      status: 409,
      code: 'ASSETS_MOBILE_APP_HASH_MISMATCH',
      message: 'The assets mobile application package failed integrity verification.',
    });
  }

  return {
    buffer,
    fileName,
    resolvedPath,
    hash,
    contentType: 'application/vnd.android.package-archive',
  };
}

function createAssetsPageService({ repository, realtime, auditLog, env } = {}) {
  async function assertAssetsPermission(actorUserId, permissionNames, deniedMessage) {
    const names = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
    const accessPermissions = [ASSETS_PERMISSIONS.full, ...names.filter(Boolean)];
    const accessChecks = await Promise.all(
      accessPermissions.map((permissionName) => repository.userHasPermission(actorUserId, permissionName)),
    );

    if (!accessChecks.some(Boolean)) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: deniedMessage,
      });
    }
  }

  async function assertUniqueAssetCode({ campId, code, currentAssetId = null }) {
    const existing = await repository.findAssetByCode({ campId, code });
    if (existing && String(existing.id) !== String(currentAssetId || '')) {
      throw new AppError({
        status: 409,
        code: 'ASSET_CODE_EXISTS',
        message: 'An asset with this code already exists in the selected camp.',
      });
    }
  }

  async function assertUniqueAssetRfid({ campId, rfidCode, currentAssetId = null }) {
    const existing = await repository.findAssetByRfid({ campId, rfidCode });
    if (existing && String(existing.id) !== String(currentAssetId || '')) {
      throw new AppError({
        status: 409,
        code: 'ASSET_RFID_EXISTS',
        message: 'An asset with this RFID code already exists in the selected camp.',
      });
    }
  }

  async function assertUniqueAssetTypeName({ name, currentTypeId = null }) {
    const existing = await repository.findAssetTypeByName({ name });
    if (existing && String(existing.id) !== String(currentTypeId || '')) {
      throw new AppError({
        status: 409,
        code: 'ASSET_TYPE_EXISTS',
        message: 'An asset type with this name already exists.',
      });
    }
  }

  function assertAssetTypeEditable(type) {
    if (!type) {
      throw new AppError({
        status: 404,
        code: 'ASSET_TYPE_NOT_FOUND',
        message: 'The asset type was not found.',
      });
    }
    if (isBedAssetTypeName(type.name)) {
      throw new AppError({
        status: 409,
        code: 'ASSET_TYPE_PROTECTED',
        message: 'The Bed asset type cannot be changed or deleted.',
      });
    }
  }

  function assertAssetTypeDeleteAllowed(type) {
    assertAssetTypeEditable(type);
    if (Number(type.assetCount) > 0) {
      throw new AppError({
        status: 409,
        code: 'ASSET_TYPE_IN_USE',
        message: 'The asset type cannot be deleted while assets of that type exist.',
      });
    }
  }

  async function assertUniqueCleanItem({ campId, itemName, warehouse, currentItemId = null }) {
    const existing = await repository.findCleanItemByNameAndWarehouse({
      campId,
      itemName,
      warehouse,
    });
    if (existing && String(existing.id) !== String(currentItemId || '')) {
      throw new AppError({
        status: 409,
        code: 'CLEAN_ITEM_EXISTS',
        message: 'A clean item with this name already exists in that warehouse.',
      });
    }
  }

  async function findCleanItemPairByName({ campId, itemName }) {
    const rows = await Promise.all(
      Object.keys(CLEAN_ITEM_WAREHOUSES).map((warehouse) =>
        repository.findCleanItemByNameAndWarehouse({ campId, itemName, warehouse }),
      ),
    );
    return rows.filter(Boolean);
  }

  async function assertUniqueCleanItemPair({ campId, itemName, currentItemIds = [] }) {
    const allowedIds = new Set(currentItemIds.map((id) => String(id)));
    const existingRows = await findCleanItemPairByName({ campId, itemName });
    const conflict = existingRows.find((row) => !allowedIds.has(String(row.id)));
    if (conflict) {
      throw new AppError({
        status: 409,
        code: 'CLEAN_ITEM_EXISTS',
        message: 'A clean item with this name already exists.',
      });
    }
  }

  async function generateUniqueAssetRfid({ campId }) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const rfidCode = `RFID-ASSET-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      const existing = await repository.findAssetByRfid({ campId, rfidCode });
      if (!existing) return rfidCode;
    }
    throw new AppError({
      status: 500,
      code: 'ASSET_RFID_GENERATION_FAILED',
      message: 'A unique RFID code could not be generated. Try saving again.',
    });
  }

  async function prepareAssetPayload({
    campId,
    payload,
    currentAssetId = null,
    existingAsset = null,
    lookups = null,
  }) {
    const hasQuantitativeValue =
      payload &&
      payload.isQuantitative !== undefined &&
      String(payload.isQuantitative).trim() !== '';
    const normalizedPayload = normalizeAssetInput({
      ...payload,
      isQuantitative: hasQuantitativeValue ? payload.isQuantitative : existingAsset?.isQuantitative,
    });
    if (normalizedPayload.isQuantitative) {
      normalizedPayload.rfidCode =
        existingAsset?.rfidCode || (await generateUniqueAssetRfid({ campId }));
    }
    const lookupData =
      lookups ||
      (normalizedPayload.replacedOff ||
      normalizedPayload.replacedBy ||
      normalizedPayload.locationKeyId ||
      normalizedPayload.isQuantitative
        ? await buildAssetLookups({ repository, campId })
        : { assetTypes: [], assets: [] });
    assertQuantitativeAssetTypeAllowed(normalizedPayload, lookupData.assetTypes || []);
    normalizedPayload.replacedOff = normalizeAssetReference(
      normalizedPayload.replacedOff,
      lookupData.assets,
      'Replaced off',
    );
    normalizedPayload.replacedBy = normalizeAssetReference(
      normalizedPayload.replacedBy,
      lookupData.assets,
      'Replaced by',
    );
    if (normalizedPayload.locationKeyId) {
      const assetTypes =
        lookupData.assetTypes && lookupData.assetTypes.length
          ? lookupData.assetTypes
          : typeof repository.listAssetTypesByCamp === 'function'
            ? await repository.listAssetTypesByCamp({ campId })
            : [];
      const selectedType = (Array.isArray(assetTypes) ? assetTypes : []).find(
        (type) => String(type.id || '') === String(normalizedPayload.typeId || ''),
      );
      if (!isBedAssetTypeName(selectedType?.name)) {
        throw new AppError({
          status: 400,
          code: 'ASSET_KEY_REQUIRES_BED_TYPE',
          message: 'Keys can only be assigned to assets of type Bed.',
        });
      }
      normalizedPayload.typeName = selectedType.name;
    }
    await assertUniqueAssetRfid({
      campId,
      rfidCode: normalizedPayload.rfidCode,
      currentAssetId,
    });
    return normalizedPayload;
  }

  async function resolveBulkRows({ campId, rows }) {
    const lookups = await buildAssetLookups({ repository, campId });
    const seenCodes = new Set();
    const seenRfidCodes = new Set();
    const seenIds = new Set();
    const resolvedRows = [];
    const errors = [];

    for (const row of rows) {
      /* eslint-disable no-await-in-loop */
      try {
        const codeKey = String(row.code || '')
          .trim()
          .toLowerCase();
        if (codeKey && seenCodes.has(codeKey)) {
          throw new AppError({
            status: 400,
            code: 'DUPLICATE_ASSET_BULK_CODE',
            message: `Asset code "${row.code}" appears more than once in the bulk update.`,
          });
        }

        const idKey = String(row.id || '').trim().toLowerCase();
        if (idKey && !UUID_PATTERN.test(idKey)) {
          throw new AppError({
            status: 400,
            code: 'INVALID_ASSET_TEMPLATE_IDENTIFIER',
            message: 'Identifier must be a valid UUID.',
          });
        }
        if (idKey) {
          if (seenIds.has(idKey)) {
            throw new AppError({
              status: 400,
              code: 'DUPLICATE_ASSET_BULK_ID',
              message: `Asset identifier "${row.id}" appears more than once in the bulk update.`,
            });
          }
          seenIds.add(idKey);
        }

        const existingAsset = row.id
          ? await repository.findAssetById({ assetId: row.id, campId })
          : null;
        if (row.id && String(row.isQuantitative || '').trim()) {
          throw new AppError({
            status: 400,
            code: 'ASSET_BULK_QUANTITATIVE_CREATE_ONLY',
            message:
              'Quantitative can only be set when adding a new asset. Leave Quantitative blank when updating an existing asset.',
          });
        }
        const resolved = await prepareAssetPayload({
          campId,
          payload: {
            ...row,
            typeId: findLookupByIdOrName(lookups.assetTypes, row.type, { fieldName: 'Asset type' }),
            locationRoomId: findLookupByIdOrName(lookups.rooms, row.room, { fieldName: 'Room' }),
            locationKeyId: row.key
              ? findLookupByIdOrName(lookups.keys, row.key, { fieldName: 'Key' })
              : null,
          },
          currentAssetId: row.id,
          existingAsset,
          lookups,
        });
        const rfidKey = String(resolved.rfidCode || '')
          .trim()
          .toLowerCase();
        if (rfidKey && seenRfidCodes.has(rfidKey)) {
          throw new AppError({
            status: 400,
            code: 'DUPLICATE_ASSET_BULK_RFID',
            message: `Asset RFID code "${resolved.rfidCode}" appears more than once in the bulk update.`,
          });
        }

        if (codeKey) seenCodes.add(codeKey);
        if (rfidKey) seenRfidCodes.add(rfidKey);
        resolvedRows.push({
          rowNumber: row.rowNumber,
          id: row.id,
          ...resolved,
          affectsAccommodationKeys:
            assetHasBedKey(existingAsset, lookups.assetTypes) ||
            assetHasBedKey(resolved, lookups.assetTypes),
        });
      } catch (error) {
        errors.push({
          rowNumber: row.rowNumber,
          status: error?.status || 400,
          code: error?.code || 'ASSET_BULK_ROW_INVALID',
          message: error?.message || 'The asset row could not be processed.',
        });
      }
      /* eslint-enable no-await-in-loop */
    }

    return { resolvedRows, errors };
  }

  async function applyBulkRows({ actorUserId, campId, rows }) {
    const { resolvedRows, errors } = await resolveBulkRows({ campId, rows });
    const validRows = [];

    for (const row of resolvedRows) {
      /* eslint-disable no-await-in-loop */
      try {
        await assertUniqueAssetCode({
          campId,
          code: row.code,
          currentAssetId: row.id,
        });
        validRows.push(row);
      } catch (error) {
        errors.push({
          rowNumber: row.rowNumber,
          status: error?.status || 400,
          code: error?.code || 'ASSET_BULK_ROW_INVALID',
          message: error?.message || 'The asset row could not be processed.',
        });
      }
      /* eslint-enable no-await-in-loop */
    }

    if (!validRows.length) {
      return summarizeBulkRows({ totalRows: rows.length, rows: validRows, results: [], errors });
    }

    const results = await repository.bulkUpsertAssets({ actorUserId, campId, rows: validRows });
    realtime?.emitAssetsChanged?.(campId);
    if (validRows.some((row) => row.affectsAccommodationKeys)) {
      realtime?.emitAccommodationChanged?.(campId, { source: 'assets' });
    }
    return summarizeBulkRows({ totalRows: rows.length, rows: validRows, results, errors });
  }

  function summarizeTypeBulkRows(rows, results, errors = [], totalRows = rows.length + errors.length) {
    const addedCount = results.filter((result) => result.action === 'added').length;
    const updatedCount = results.filter((result) => result.action === 'updated').length;
    const missingCount = results.filter((result) => result.action === 'missing').length;
    const errorCount = errors.length;
    const hasFailures = missingCount > 0 || errorCount > 0;
    const messageParts = [
      `${addedCount} added`,
      `${updatedCount} updated`,
      `${missingCount} missing`,
    ];
    if (errorCount > 0) messageParts.push(`${errorCount} errors`);

    return (hasFailures ? invalid : success)({
      message: `${messageParts.join(', ')}.`,
      summary: {
        totalRows,
        processedRows: totalRows,
        addedCount,
        updatedCount,
        missingCount,
        skippedCount: missingCount,
        errorCount,
        errors,
      },
    });
  }

  async function applyAssetTypeBulkRows({ actorUserId, rows }) {
    const seenNames = new Set();
    const seenIds = new Set();
    const validRows = [];
    const errors = [];

    for (const row of rows) {
      /* eslint-disable no-await-in-loop */
      try {
        const id = String(row.id || '').trim().toLowerCase();
        if (id && !UUID_PATTERN.test(id)) {
          throw new AppError({
            status: 400,
            code: 'INVALID_ASSET_TYPE_TEMPLATE_IDENTIFIER',
            message: 'Identifier must be a valid UUID.',
          });
        }

        const name = normalizeAssetTypeInput(row.name);
        const nameKey = name.toLowerCase();
        if (seenNames.has(nameKey)) {
          throw new AppError({
            status: 400,
            code: 'DUPLICATE_ASSET_TYPE_BULK_NAME',
            message: `Asset type "${name}" appears more than once in the uploaded file.`,
          });
        }

        if (id) {
          if (seenIds.has(id)) {
            throw new AppError({
              status: 400,
              code: 'DUPLICATE_ASSET_TYPE_BULK_ID',
              message: `Identifier ${id} is duplicated in the uploaded file.`,
            });
          }
          seenIds.add(id);
          const existing = await repository.findAssetTypeById({ typeId: id });
          assertAssetTypeEditable(existing);
        }

        await assertUniqueAssetTypeName({ name, currentTypeId: id });
        seenNames.add(nameKey);
        validRows.push({ rowNumber: row.rowNumber, id: id || null, name });
      } catch (error) {
        errors.push({
          rowNumber: row.rowNumber,
          status: error?.status || 400,
          code: error?.code || 'ASSET_TYPE_BULK_ROW_INVALID',
          message: error?.message || 'The asset type row could not be processed.',
        });
      }
      /* eslint-enable no-await-in-loop */
    }

    if (!validRows.length) {
      return summarizeTypeBulkRows(validRows, [], errors, rows.length);
    }

    const results = await repository.bulkUpsertAssetTypes({ actorUserId, rows: validRows });
    realtime?.emitAssetsChanged?.();
    return summarizeTypeBulkRows(validRows, results, errors, rows.length);
  }

  async function applyCleanItemBulkRows({ actorUserId, campId, rows }) {
    const seenKeys = new Set();
    const seenIds = new Set();
    const validRows = [];
    const errors = [];

    for (const row of rows) {
      /* eslint-disable no-await-in-loop */
      try {
        const id = String(row.id || '').trim().toLowerCase();
        if (id && !UUID_PATTERN.test(id)) {
          throw new AppError({
            status: 400,
            code: 'INVALID_CLEAN_ITEM_TEMPLATE_IDENTIFIER',
            message: 'Identifier must be a valid UUID.',
          });
        }

        const normalized = normalizeCleanItemInput({
          itemName: row.itemName,
          totalAmount: row.totalAmount,
          countGetItem: 0,
          warehouse: 'large',
        });

        if (id) {
          if (seenIds.has(id)) {
            throw new AppError({
              status: 400,
              code: 'DUPLICATE_CLEAN_ITEM_BULK_ID',
              message: `Identifier ${id} is duplicated in the uploaded file.`,
            });
          }
          seenIds.add(id);
          const existing = await repository.findCleanItemById({ itemId: id, campId });
          if (existing) {
            normalized.warehouse = existing.warehouse;
            Object.assign(normalized, normalizeCleanItemEditInput(normalized, existing));
          }
        }

        const itemKey = `${normalized.itemName.toLowerCase()}::${normalized.warehouse}`;
        if (seenKeys.has(itemKey)) {
          throw new AppError({
            status: 400,
            code: 'DUPLICATE_CLEAN_ITEM_BULK_NAME',
            message: `Clean item "${normalized.itemName}" appears more than once for ${normalized.warehouse} warehouse in the uploaded file.`,
          });
        }

        await assertUniqueCleanItem({
          campId,
          itemName: normalized.itemName,
          warehouse: normalized.warehouse,
          currentItemId: id,
        });
        seenKeys.add(itemKey);
        validRows.push({ rowNumber: row.rowNumber, id: id || null, ...normalized });
      } catch (error) {
        errors.push({
          rowNumber: row.rowNumber,
          status: error?.status || 400,
          code: error?.code || 'CLEAN_ITEM_BULK_ROW_INVALID',
          message: error?.message || 'The clean item row could not be processed.',
        });
      }
      /* eslint-enable no-await-in-loop */
    }

    if (!validRows.length) {
      return summarizeTypeBulkRows(validRows, [], errors, rows.length);
    }

    const results = await repository.bulkUpsertCleanItems({ actorUserId, campId, rows: validRows });
    realtime?.emitAssetsChanged?.(campId);
    return summarizeTypeBulkRows(validRows, results, errors, rows.length);
  }

  return {
    async getAssetsView({ userId, campId, csrfToken }) {
      const permissions = userId ? await repository.listUserPermissions({ userId }) : [];
      const permissionNames = new Set(
        (Array.isArray(permissions) ? permissions : [])
          .map((permission) => String(permission?.name || '').trim())
          .filter(Boolean),
      );
      const canDownloadAssetsMobileApp =
        permissionNames.has(ASSETS_PERMISSIONS.full) ||
        permissionNames.has(ASSETS_PERMISSIONS.downloadAssetsApp);
      const overview = await buildAssetsOverview({ repository, campId });

      return {
        ...ASSETS_PAGE,
        ...overview,
        campId,
        csrfToken,
        campRequired: !campId,
        horizontalNavItems: buildHorizontalNavItems(permissions, false),
        permissionNames: [...permissionNames],
        canDownloadAssetsMobileApp,
        assetsMobileAppDownloadUrl: '/web/assets/mobile-app',
      };
    },

    async getAssetsData({ campId, tableState = {} }) {
      return buildAssetsOverview({ repository, campId, tableState });
    },

    async addAsset({ actorUserId, campId, payload }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.addAsset,
        "You don't have permission to add assets.",
      );
      const assetPayload = await prepareAssetPayload({ campId, payload });
      await assertUniqueAssetCode({ campId, code: assetPayload.code });
      const asset = await repository.addAsset({ actorUserId, campId, payload: assetPayload });
      realtime?.emitAssetsChanged?.(campId);
      if (assetHasBedKey(assetPayload)) {
        realtime?.emitAccommodationChanged?.(campId, { source: 'assets' });
      }
      return success({ message: 'Asset added successfully.', asset: normalizeAsset(asset) });
    },

    async addAssetType({ actorUserId, name }) {
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.addAssetType,
        "You don't have permission to add asset types.",
      );
      const typeName = normalizeAssetTypeInput(name);
      await assertUniqueAssetTypeName({ name: typeName });
      const type = await repository.addAssetType({ actorUserId, name: typeName });
      realtime?.emitAssetsChanged?.();
      return success({ message: 'Asset type added successfully.', type: normalizeAssetType(type) });
    },

    async editAssetType({ actorUserId, typeId, name }) {
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.editAssetType,
        "You don't have permission to edit asset types.",
      );
      const existing = await repository.findAssetTypeById({ typeId });
      assertAssetTypeEditable(existing);
      const typeName = normalizeAssetTypeInput(name);
      await assertUniqueAssetTypeName({ name: typeName, currentTypeId: typeId });
      const type = await repository.editAssetType({ actorUserId, typeId, name: typeName });
      realtime?.emitAssetsChanged?.();
      return success({ message: 'Asset type updated successfully.', type: normalizeAssetType(type) });
    },

    async deleteAssetType({ actorUserId, typeId }) {
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.deleteAssetType,
        "You don't have permission to delete asset types.",
      );
      const existing = await repository.findAssetTypeById({ typeId });
      assertAssetTypeDeleteAllowed(existing);
      const deleted = await repository.deleteAssetType({ actorUserId, typeId });
      if (deleted?.blocked) {
        throw new AppError({
          status: 409,
          code: 'ASSET_TYPE_IN_USE',
          message: 'The asset type cannot be deleted while assets of that type exist.',
        });
      }
      if (!deleted) return invalid({ message: 'The asset type could not be removed.' });
      realtime?.emitAssetsChanged?.();
      return success({ message: 'Asset type removed successfully.', type: deleted });
    },

    async editAsset({ actorUserId, campId, assetId, payload }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.editAsset,
        "You don't have permission to edit assets.",
      );
      const existing = await repository.findAssetById({ assetId, campId });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: 'ASSET_NOT_FOUND',
          message: 'The asset was not found in the selected camp.',
        });
      }
      const assetPayload = await prepareAssetPayload({
        campId,
        payload,
        currentAssetId: assetId,
        existingAsset: existing,
      });
      await assertUniqueAssetCode({ campId, code: assetPayload.code, currentAssetId: assetId });
      const asset = await repository.editAsset({
        actorUserId,
        campId,
        assetId,
        payload: assetPayload,
      });
      realtime?.emitAssetsChanged?.(campId);
      if (assetHasBedKey(existing) || assetHasBedKey(assetPayload)) {
        realtime?.emitAccommodationChanged?.(campId, { source: 'assets' });
      }
      return success({ message: 'Asset updated successfully.', asset: normalizeAsset(asset) });
    },

    async deleteAsset({ actorUserId, campId, assetId }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.deleteAsset,
        "You don't have permission to remove assets.",
      );
      const existing = await repository.findAssetById({ assetId, campId });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: 'ASSET_NOT_FOUND',
          message: 'The asset was not found in the selected camp.',
        });
      }
      const deleted = await repository.deleteAsset({ actorUserId, campId, assetId });
      if (!deleted) return invalid({ message: 'The asset could not be removed.' });
      realtime?.emitAssetsChanged?.(campId);
      if (assetHasBedKey(existing)) {
        realtime?.emitAccommodationChanged?.(campId, { source: 'assets' });
      }
      return success({ message: 'Asset removed successfully.', asset: deleted });
    },

    async restartInventory({ actorUserId, campId, locationRoomId = null }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.saveInventory,
        "You don't have permission to restart inventory.",
      );
      const result = await repository.restartInventory({
        actorUserId,
        campId,
        locationRoomId: locationRoomId ? String(locationRoomId).trim() : null,
      });
      realtime?.emitAssetsChanged?.(campId);
      return success({
        message: 'Inventory restarted successfully.',
        updatedCount: Number(result?.updatedCount) || 0,
      });
    },

    async bulkUpdateAssets({ actorUserId, campId, payload }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addAsset, ASSETS_PERMISSIONS.editAsset],
        "You don't have permission to bulk update assets.",
      );
      const rows = parseBulkRows(payload);
      return applyBulkRows({ actorUserId, campId, rows });
    },

    async bulkUpdateAssetTypes({ actorUserId, payload }) {
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addAssetType, ASSETS_PERMISSIONS.editAssetType],
        "You don't have permission to bulk update asset types.",
      );
      const rows = parseAssetTypeBulkRows(payload);
      return applyAssetTypeBulkRows({ actorUserId, rows });
    },

    async addCleanItem({ actorUserId, campId, payload }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.addCleanItem,
        "You don't have permission to add clean items.",
      );
      const itemPayload = normalizeCleanItemInput({
        ...payload,
        countGetItem: 0,
        warehouse: 'large',
      });
      await assertUniqueCleanItemPair({ campId, itemName: itemPayload.itemName });
      const item = await repository.addCleanItem({
        actorUserId,
        campId,
        payload: itemPayload,
      });
      realtime?.emitAssetsChanged?.(campId);
      return success({ message: 'Clean item added successfully.', item: normalizeCleanItem(item) });
    },

    async editCleanItem({ actorUserId, campId, itemId, payload }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.editCleanItem,
        "You don't have permission to edit clean items.",
      );
      const existing = await repository.findCleanItemById({ itemId, campId });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: 'CLEAN_ITEM_NOT_FOUND',
          message: 'The clean item was not found in the selected camp.',
        });
      }
      const currentPair = await findCleanItemPairByName({
        campId,
        itemName: existing.itemName,
      });
      const itemPayload = normalizeCleanItemEditInput(payload, existing);
      await assertUniqueCleanItemPair({
        campId,
        itemName: itemPayload.itemName,
        currentItemIds: currentPair.map((row) => row.id),
      });
      const item = await repository.editCleanItem({
        actorUserId,
        campId,
        itemId,
        payload: itemPayload,
      });
      realtime?.emitAssetsChanged?.(campId);
      return success({ message: 'Clean item updated successfully.', item: normalizeCleanItem(item) });
    },

    async moveCleanItem({ actorUserId, campId, itemId, warehouse, quantity }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.moveCleanItem,
        "You don't have permission to move clean items.",
      );
      const existing = await repository.findCleanItemById({ itemId, campId });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: 'CLEAN_ITEM_NOT_FOUND',
          message: 'The clean item was not found in the selected camp.',
        });
      }
      const nextWarehouse = normalizeWarehouse(warehouse);
      if (nextWarehouse === existing.warehouse) {
        throw new AppError({
          status: 400,
          code: 'INVALID_CLEAN_ITEM_MOVE_TARGET',
          message: 'Choose the other warehouse before moving clean item quantity.',
        });
      }
      const moveQuantity = normalizeCleanItemMoveQuantity(quantity);
      if (moveQuantity > Number(existing.availableAmount || 0)) {
        throw new AppError({
          status: 400,
          code: 'INVALID_CLEAN_ITEM_MOVE_QUANTITY',
          message: 'Move quantity cannot be greater than the available amount.',
        });
      }
      const item = await repository.moveCleanItem({
        actorUserId,
        campId,
        itemId,
        warehouse: nextWarehouse,
        quantity: moveQuantity,
      });
      realtime?.emitAssetsChanged?.(campId);
      return success({
        message: `Moved ${moveQuantity} to ${CLEAN_ITEM_WAREHOUSES[nextWarehouse]}.`,
        item: normalizeCleanItem(item),
      });
    },

    async deleteCleanItem({ actorUserId, campId, itemId }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        ASSETS_PERMISSIONS.deleteCleanItem,
        "You don't have permission to delete clean items.",
      );
      const existing = await repository.findCleanItemById({ itemId, campId });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: 'CLEAN_ITEM_NOT_FOUND',
          message: 'The clean item was not found in the selected camp.',
        });
      }
      const deleted = await repository.deleteCleanItem({ actorUserId, campId, itemId });
      if (!deleted) return invalid({ message: 'The clean item could not be removed.' });
      realtime?.emitAssetsChanged?.(campId);
      return success({ message: 'Clean item removed successfully.', item: deleted });
    },

    async bulkUpdateCleanItems({ actorUserId, campId, payload }) {
      assertCampSelected(campId);
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addCleanItem, ASSETS_PERMISSIONS.editCleanItem],
        "You don't have permission to bulk update clean items.",
      );
      const rows = parseCleanItemBulkRows(payload);
      return applyCleanItemBulkRows({ actorUserId, campId, rows });
    },

    async downloadAssetsMobileApp({ actorUserId, requestMeta } = {}) {
      const [hasFullPermission, canDownload] = await Promise.all([
        repository.userHasPermission(actorUserId, ASSETS_PERMISSIONS.full),
        repository.userHasPermission(actorUserId, ASSETS_PERMISSIONS.downloadAssetsApp),
      ]);

      if (!canDownload && !hasFullPermission) {
        throw new AppError({
          status: 403,
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to download the assets mobile app.',
        });
      }

      const file = await loadAssetsMobileAppFile({ env });

      auditLog?.(AUDIT_EVENT_NAMES.ASSETS.MOBILE_APP_DOWNLOADED, {
        ...requestMeta,
        actorUserId,
        fileName: file.fileName,
        hash: file.hash,
        resolvedPath: file.resolvedPath,
      });

      return {
        status: 200,
        fileName: file.fileName,
        contentType: file.contentType,
        buffer: file.buffer,
      };
    },

    async downloadAssetTemplate({ actorUserId } = {}) {
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addAsset, ASSETS_PERMISSIONS.editAsset],
        "You don't have permission to download asset templates.",
      );
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Global Support System';
      workbook.created = new Date();

      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [{ width: 116 }];
      instructionsSheet.addRows([
        ['Use the Assets sheet to add or update assets in bulk.'],
        [
          'Leave Identifier blank only when creating a new asset. Provide an existing Identifier to update that asset.',
        ],
        [
          'Type, Room, and Key accept either the identifier or the visible name from the selected camp.',
        ],
        ['Type, Room, Quantity, and Status are required for every asset row.'],
        [
          'RFID Code is required for non-quantitative assets. Quantitative assets receive a generated RFID code.',
        ],
        [
          'Quantitative accepts true, yes, or 1 only when Identifier is blank. Leave Quantitative blank when updating an existing asset.',
        ],
        [
          'M2 inside must be a non-negative decimal number such as 0.01, 1.00, or 10.10.',
        ],
        ['Purchase Price must be a decimal number such as 0.00, 0.01, or 10.10.'],
        ['Lifecycle Year, Lifecycle Rest, and Rest Value must be numbers.'],
        ['Replaced Off and Replaced By must match an existing asset identifier, code, name, or label.'],
        [
          'Written off date and Last inventory date are filled by the system and are not part of the template.',
        ],
        [
          'Dates use YYYY-MM-DD HH:MM AM/PM. Leave lifecycle, purchase, replacement, and comment fields blank when they do not apply.',
        ],
        ['Inventory Status accepts undiscovered, completed, or written_off.'],
        ['Do not rename sheets, reorder columns, or change the header row in the Assets sheet.'],
        ['Save the completed file as .xlsx before uploading it back to the system.'],
      ]);

      const assetsSheet = workbook.addWorksheet('Assets');
      assetsSheet.columns = ASSET_TEMPLATE_HEADERS.map((header) => ({
        header,
        key: header.replace(/\s+/g, '_'),
        width: ['description', 'comments'].includes(header) ? 48 : 24,
      }));
      assetsSheet.getRow(1).font = { bold: true };

      return {
        status: 200,
        fileName: ASSET_TEMPLATE_FILENAME,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: await workbook.xlsx.writeBuffer(),
      };
    },

    async downloadAssetTypeTemplate({ actorUserId } = {}) {
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addAssetType, ASSETS_PERMISSIONS.editAssetType],
        "You don't have permission to download asset type templates.",
      );
      return buildTemplateWorkbook({
        fileName: ASSET_TYPE_TEMPLATE_FILENAME,
        worksheetName: 'Asset Types',
        headers: ASSET_TYPE_BULK_HEADERS,
        instructions: [
          'Use the Asset Types sheet to add or update asset types in bulk.',
          'Leave Identifier blank only when creating a new asset type. Provide an existing Identifier to update that type.',
          'Name is required.',
          'The protected Bed type cannot be updated through bulk import.',
          'Do not rename sheets, reorder columns, or change the header row in the Asset Types sheet.',
          'Save the completed file as .xlsx before uploading it back to the system.',
        ],
      });
    },

    async downloadCleanItemTemplate({ actorUserId } = {}) {
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addCleanItem, ASSETS_PERMISSIONS.editCleanItem],
        "You don't have permission to download clean item templates.",
      );
      return buildTemplateWorkbook({
        fileName: CLEAN_ITEM_TEMPLATE_FILENAME,
        worksheetName: 'Clean Items',
        headers: CLEAN_ITEM_BULK_HEADERS,
        instructions: [
          'Use the Clean Items sheet to add or update clean items in bulk.',
          'Leave Identifier blank only when creating a new clean item. Provide an existing Identifier to update that item.',
          'New clean items are added to the large warehouse and receive a matching small warehouse row with quantity 0.',
          'Existing rows keep their current warehouse. Quantity must be a non-negative number.',
          'Do not rename sheets, reorder columns, or change the header row in the Clean Items sheet.',
          'Save the completed file as .xlsx before uploading it back to the system.',
        ],
      });
    },

    async importAssets({ actorUserId, campId, fileBuffer, fileName }) {
      assertCampSelected(campId);
      assertImportFile({
        fileBuffer,
        fileName,
        resourceName: 'asset',
        code: 'INVALID_ASSET_TEMPLATE',
      });
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addAsset, ASSETS_PERMISSIONS.editAsset],
        "You don't have permission to import assets.",
      );
      const rows = await readAssetTemplateRows(fileBuffer);
      if (!rows.length) {
        throw new AppError({
          status: 400,
          code: 'EMPTY_ASSET_TEMPLATE',
          message: 'The uploaded template does not contain any asset rows to process.',
        });
      }
      return applyBulkRows({ actorUserId, campId, rows });
    },

    async importAssetTypes({ actorUserId, fileBuffer, fileName }) {
      assertImportFile({
        fileBuffer,
        fileName,
        resourceName: 'asset type',
        code: 'INVALID_ASSET_TYPE_TEMPLATE',
      });
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addAssetType, ASSETS_PERMISSIONS.editAssetType],
        "You don't have permission to import asset types.",
      );
      const rows = await readAssetTypeTemplateRows(fileBuffer);
      if (!rows.length) {
        throw new AppError({
          status: 400,
          code: 'EMPTY_ASSET_TYPE_TEMPLATE',
          message: 'The uploaded template does not contain any asset type rows to process.',
        });
      }
      return applyAssetTypeBulkRows({ actorUserId, rows });
    },

    async importCleanItems({ actorUserId, campId, fileBuffer, fileName }) {
      assertCampSelected(campId);
      assertImportFile({
        fileBuffer,
        fileName,
        resourceName: 'clean item',
        code: 'INVALID_CLEAN_ITEM_TEMPLATE',
      });
      await assertAssetsPermission(
        actorUserId,
        [ASSETS_PERMISSIONS.addCleanItem, ASSETS_PERMISSIONS.editCleanItem],
        "You don't have permission to import clean items.",
      );
      const rows = await readCleanItemTemplateRows(fileBuffer);
      if (!rows.length) {
        throw new AppError({
          status: 400,
          code: 'EMPTY_CLEAN_ITEM_TEMPLATE',
          message: 'The uploaded template does not contain any clean item rows to process.',
        });
      }
      return applyCleanItemBulkRows({ actorUserId, campId, rows });
    },
  };
}

async function buildTemplateWorkbook({ fileName, worksheetName, headers, instructions }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Global Support System';
  workbook.created = new Date();

  const instructionsSheet = workbook.addWorksheet('Instructions');
  instructionsSheet.columns = [{ width: 116 }];
  instructionsSheet.addRows(instructions.map((instruction) => [instruction]));

  const sheet = workbook.addWorksheet(worksheetName);
  sheet.columns = headers.map((header) => ({
    header,
    key: header.replace(/\s+/g, '_'),
    width: header === 'identifier' ? 40 : 24,
  }));
  sheet.getRow(1).font = { bold: true };

  return {
    status: 200,
    fileName,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await workbook.xlsx.writeBuffer(),
  };
}

module.exports = {
  ASSET_TEMPLATE_FILENAME,
  ASSET_TYPE_TEMPLATE_FILENAME,
  CLEAN_ITEM_TEMPLATE_FILENAME,
  INVENTORY_STATUS_LABELS,
  createAssetsPageService,
};
