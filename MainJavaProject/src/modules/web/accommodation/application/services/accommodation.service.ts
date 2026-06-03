// @ts-nocheck
const { AppError } = require('../../../../../shared/errors/app-error');
const ExcelJS = require('exceljs');
const { invalid, success } = require('../../../../../shared/application/action-result');
const { buildHorizontalNavItems } = require('../../../../../shared/public/js/ui/navigation');
const { formatUtcDateTimeDisplay } = require('../../../../../shared/datetime/display-date-time');
const { ACCOMMODATION_PAGE } = require('../../domain/accommodation.page');
const { ACCOMMODATION_PERMISSIONS } = require('../../domain/accommodation.permissions');
const {
  toDateOnly,
  buildAccommodationTargetWindow,
  isWithinAccommodationTargetWindow,
} = require('../../domain/accommodation-window.policy');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SAFE_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.:/-]+$/u;
const NFC_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const BUILDING_TEMPLATE_HEADERS = Object.freeze(['identifier', 'building name', 'building type']);
const ROOM_TEMPLATE_HEADERS = Object.freeze(['identifier', 'room name', 'building']);
const KEY_TEMPLATE_HEADERS = Object.freeze(['identifier', 'key name', 'nfc code', 'room']);
const SOLDIER_TEMPLATE_HEADERS = Object.freeze([
  'identifier',
  'soldier name',
  'country',
  'meal card',
  'laundry bag',
  'upcoming accommodation',
  'upcoming release',
  'upcoming key',
]);
const ADDITIONAL_ITEM_TEMPLATE_HEADERS = Object.freeze([
  'identifier',
  'soldier',
  'description',
  'quantity',
  'laundry bag',
]);
const BUILDING_TEMPLATE_HEADER_ALIASES = Object.freeze([['building id'], [], []]);
const ROOM_TEMPLATE_HEADER_ALIASES = Object.freeze([['room id'], [], []]);
const KEY_TEMPLATE_HEADER_ALIASES = Object.freeze([['key id'], [], [], []]);
const SOLDIER_TEMPLATE_HEADER_ALIASES = Object.freeze([['soldier id'], [], [], [], [], [], [], []]);
const ADDITIONAL_ITEM_TEMPLATE_HEADER_ALIASES = Object.freeze([['item id'], [], [], [], []]);
const BUILDING_TEMPLATE_FILENAME = 'accommodation-buildings-template.xlsx';
const ROOM_TEMPLATE_FILENAME = 'accommodation-rooms-template.xlsx';
const KEY_TEMPLATE_FILENAME = 'accommodation-keys-template.xlsx';
const SOLDIER_TEMPLATE_FILENAME = 'accommodation-soldiers-template.xlsx';
const ADDITIONAL_ITEM_TEMPLATE_FILENAME = 'accommodation-additional-items-template.xlsx';
const ACCOMMODATION_REPORT_FILENAME = 'accommodation-report.xlsx';
const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EMPTY_REPORT_FIELD_MESSAGE = 'None';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeLaundryBagStatus(value) {
  return String(value || 'pick_up').trim() || 'pick_up';
}

function isLaundryBagAvailableForSoldier(bag, currentSoldierId = null) {
  if (!bag) return false;
  const assignedSoldierId = String(bag.soldierId || '');
  const currentId = String(currentSoldierId || '');
  if (currentId && assignedSoldierId === currentId) return true;
  return (
    normalizeLaundryBagStatus(bag.status) === 'pick_up' &&
    !assignedSoldierId
  );
}

function formatUpcomingAccommodationSummary(row) {
  const soldier = normalizeName(row?.soldierName) || 'Unknown soldier';
  const key =
    normalizeName(row?.upcomingAccommodationKeyName) ||
    normalizeName(row?.upcomingAccommodationKey) ||
    'None';
  return `${soldier} - Upcoming key: ${key}`;
}

function formatUpcomingReleaseSummary(row) {
  const soldier = normalizeName(row?.soldierName) || 'Unknown soldier';
  const key = normalizeName(row?.keyName) || normalizeName(row?.keyId) || 'None';
  return `${soldier} - Key: ${key}`;
}

function reportCellValue(value) {
  return value === undefined || value === null || value === '' ? EMPTY_REPORT_FIELD_MESSAGE : value;
}

function formatReportDateTime(value) {
  return formatUtcDateTimeDisplay(value);
}

function getReportDateOnly(value) {
  const dateTime = formatReportDateTime(value);
  return dateTime ? dateTime.slice(0, 10) : '';
}

function isInReportDateRange(value, { fromDate = '', toDate = '' } = {}) {
  const date = getReportDateOnly(value);
  if (!date) return !fromDate && !toDate;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function isOnOrAfterDate(value, target) {
  const date = toDateOnly(value);
  const targetDate = toDateOnly(target);
  return Boolean(date && targetDate && date >= targetDate);
}

function hasActiveAccommodation(row) {
  return Boolean(
    row?.keyId ||
      row?.usedKey ||
      normalizeName(row?.keyName) ||
      (row?.dateAccommodation && !row?.dateFree),
  );
}

function isPendingUpcomingAccommodation(row, targetWindow) {
  return (
    isWithinAccommodationTargetWindow(row?.upcomingAccommodation, targetWindow) &&
    !hasActiveAccommodation(row) &&
    !isOnOrAfterDate(row?.dateAccommodation, row?.upcomingAccommodation) &&
    !isOnOrAfterDate(row?.dateFree, row?.upcomingAccommodation)
  );
}

function isPendingUpcomingRelease(row, targetWindow) {
  return (
    isWithinAccommodationTargetWindow(row?.upcomingRelease, targetWindow) &&
    hasActiveAccommodation(row) &&
    !isOnOrAfterDate(row?.dateFree, row?.upcomingRelease)
  );
}

function normalizeNfcCode(value) {
  return String(value || '').trim();
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDateOnly(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error('Date must be a valid ISO date or spreadsheet date value.');
  }

  return [
    value.getFullYear(),
    padDatePart(value.getMonth() + 1),
    padDatePart(value.getDate()),
  ].join('-');
}

function isValidDateOnly(value) {
  const match = ISO_DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeOptionalDate(value) {
  if (value instanceof Date) return formatLocalDateOnly(value);

  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (ISO_DATE_ONLY_PATTERN.test(normalized)) {
    if (isValidDateOnly(normalized)) return normalized;
    throw new Error('Date must be a valid ISO date or spreadsheet date value.');
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Date must be a valid ISO date or spreadsheet date value.');
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeSoldierScheduleDates({ upcomingAccommodation, upcomingRelease } = {}) {
  const normalizedUpcomingAccommodation = normalizeOptionalDate(upcomingAccommodation);
  const normalizedUpcomingRelease = normalizeOptionalDate(upcomingRelease);

  if (
    normalizedUpcomingAccommodation &&
    normalizedUpcomingRelease &&
    normalizedUpcomingRelease < normalizedUpcomingAccommodation
  ) {
    throw new AppError({
      status: 400,
      code: 'ACCOMMODATION_INVALID_UPCOMING_SCHEDULE',
      message: 'Upcoming release must be the same day as or after upcoming accommodation.',
    });
  }

  return {
    upcomingAccommodation: normalizedUpcomingAccommodation,
    upcomingRelease: normalizedUpcomingRelease,
  };
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function readCellText(cell) {
  if (!cell) return '';
  if (cell.value instanceof Date) return formatLocalDateOnly(cell.value);
  return String(cell.text || cell.value || '').trim();
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

function assertCampSelected(campId) {
  if (!campId) {
    throw new AppError({
      status: 400,
      code: 'CAMP_CONTEXT_REQUIRED',
      message: 'Camp context is required to manage accommodation data.',
    });
  }
}

function validateName(value, fieldName, maxLength = 96) {
  if (!value || value.length < 1 || value.length > maxLength || !SAFE_NAME_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be 1-${maxLength} characters and contain only supported characters.`);
  }
}

function validateNfcCode(value, fieldName = 'NFC Code') {
  if (!value || value.length < 2 || value.length > 128 || !NFC_CODE_PATTERN.test(value)) {
    throw new Error(
      `${fieldName} must be 2-128 characters and contain only letters, numbers, _, :, . or -.`,
    );
  }
}

function validatePositiveIntegerText(value, fieldName, maxLength = 64) {
  if (value && (value.length > maxLength || !POSITIVE_INTEGER_PATTERN.test(value))) {
    throw new Error(`${fieldName} must be a whole number starting from 1.`);
  }
}

function buildImportSummary(totalRows) {
  return {
    totalRows,
    processedRows: 0,
    addedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };
}

function summarizeImportMessage(summary) {
  return [
    `${summary.addedCount} added`,
    `${summary.updatedCount} updated`,
    `${summary.skippedCount} skipped`,
    `${summary.errorCount} errors`,
  ].join(', ');
}

function getAccommodationOccupancyStatus({ freeKeys = 0, occupiedKeys = 0 } = {}) {
  if (Number(occupiedKeys) <= 0) return 'Fully free';
  if (Number(freeKeys) > 0) return 'Free';
  return 'Occupied';
}

function normalizeStatusLabel(value) {
  const status = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (status === 'fully-free') return 'Fully free';
  if (status === 'free') return 'Free';
  if (status === 'occupied') return 'Occupied';
  if (status === 'accommodated') return 'Accommodated';
  if (status === 'not-accommodated') return 'Not accommodated';
  return normalizeText(value) || 'Unknown';
}

function normalizePositiveInteger(value, fallback, { min = 1, max = 100 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeSortDirection(value) {
  return ['asc', 'desc'].includes(String(value || '').trim()) ? String(value).trim() : 'default';
}

function normalizeTableState(rawState = {}, { filterColumns = [], sortColumns = [] } = {}) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const filters = {};
  const sourceFilters = source.filters && typeof source.filters === 'object' ? source.filters : {};

  filterColumns.forEach((column) => {
    const value = normalizeText(sourceFilters[column]).slice(0, 128);
    if (value) filters[column] = value;
  });

  const sortDirection = normalizeSortDirection(source.sortDirection || source.direction);
  const requestedSortColumn = normalizeText(source.sortColumn || source.column);
  const sortColumn =
    sortDirection !== 'default' && sortColumns.includes(requestedSortColumn)
      ? requestedSortColumn
      : null;

  return {
    page: normalizePositiveInteger(source.page, 1, { min: 1, max: 100000 }),
    limit: normalizePositiveInteger(source.limit, 10, { min: 1, max: 100 }),
    filters,
    sortColumn,
    sortDirection: sortColumn ? sortDirection : 'default',
  };
}

function getTextColumnValue(row, column, getColumnValue) {
  return String(getColumnValue(row, column) ?? '').toLowerCase();
}

function applyServerTableState(rows = [], rawState = {}, config = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const state = normalizeTableState(rawState, config);
  const getColumnValue = config.getColumnValue || ((row, column) => row?.[column] ?? '');
  const filteredRows = sourceRows.filter((row) =>
    Object.entries(state.filters).every(([column, value]) =>
      getTextColumnValue(row, column, getColumnValue).includes(String(value).toLowerCase()),
    ),
  );

  const sortedRows =
    state.sortColumn && state.sortDirection !== 'default'
      ? [...filteredRows].sort(
          (left, right) =>
            String(getColumnValue(left, state.sortColumn)).localeCompare(
              String(getColumnValue(right, state.sortColumn)),
              undefined,
              { numeric: true, sensitivity: 'base' },
            ) * (state.sortDirection === 'desc' ? -1 : 1),
        )
      : filteredRows;

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.limit));
  const page = Math.min(state.page, totalPages);
  const start = (page - 1) * state.limit;

  return {
    rows: sortedRows.slice(start, start + state.limit),
    allRows: sortedRows,
    page,
    limit: state.limit,
    total,
    totalPages,
    sourceTotal: sourceRows.length,
    filters: state.filters,
    sortColumn: state.sortColumn,
    sortDirection: state.sortDirection,
  };
}

function applyLookupState(rows = [], search = '', options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const limit = normalizePositiveInteger(options.limit, 20, { min: 1, max: 50 });
  const query = normalizeText(search).toLowerCase();
  const getValues = typeof options.getValues === 'function' ? options.getValues : (row) => [row?.name];
  const getSortValue =
    typeof options.getSortValue === 'function' ? options.getSortValue : (row) => getValues(row).join(' ');

  const filteredRows = query
    ? sourceRows.filter((row) =>
        getValues(row)
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : sourceRows;

  return [...filteredRows]
    .sort((left, right) =>
      String(getSortValue(left) || '').localeCompare(String(getSortValue(right) || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    )
    .slice(0, limit);
}

function getBuildingTableColumnValue(row, column) {
  if (column === 'status') return normalizeStatusLabel(row.status);
  if (column === 'type') return row.type || 'Unspecified';
  return row[column] ?? '';
}

function getRoomTableColumnValue(row, column) {
  if (column === 'buildingName') return row.buildingName || 'Unmapped';
  if (column === 'status') return normalizeStatusLabel(row.status);
  if (column === 'keyNames') return (row.keyNames || []).join(', ');
  return row[column] ?? '';
}

function getKeyTableColumnValue(row, column) {
  if (column === 'buildingName') return row.buildingName || 'Unmapped';
  if (column === 'roomName') return row.roomName || 'Unmapped';
  if (column === 'soldierName') return row.soldierName || 'Unassigned';
  if (column === 'status') return normalizeStatusLabel(row.status);
  return row[column] ?? '';
}

function getSoldierTableColumnValue(row, column) {
  if (column === 'keyName') return row.keyName || 'Unassigned';
  if (column === 'roomName') return row.roomName || 'Unassigned';
  if (column === 'laundryBagCode') return row.laundryBagCode || 'None';
  if (column === 'mealCard') return row.mealCard || 'None';
  if (column === 'status') return normalizeStatusLabel(row.status || 'not accommodated');
  return row[column] ?? '';
}

function getAdditionalItemTableColumnValue(row, column) {
  if (column === 'laundryBagCode') return row.laundryBagCode || 'None';
  return row[column] ?? '';
}

function getReportCheckKeyName(row) {
  return row.eventType === 'check-in' ? row.newKeyName || '' : row.previousKeyName || '';
}

function getReportColumnValue(row, table, column) {
  if (column === 'eventLabel') return row.eventType === 'check-in' ? 'Check-in' : 'Check-out';
  if (column === 'keyName') return getReportCheckKeyName(row);
  if (column === 'createdAt' || column === 'happenedAt') return formatReportDateTime(row[column]);
  return row[column] ?? '';
}

function applyReportTableState(rows = [], table, rawState = {}, fallbackDateFilters = {}) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const dateFilters = {
    fromDate: normalizeText(source.dateFilters?.fromDate || fallbackDateFilters.fromDate).slice(
      0,
      10,
    ),
    toDate: normalizeText(source.dateFilters?.toDate || fallbackDateFilters.toDate).slice(0, 10),
  };
  const dateColumn = table === 'item' ? 'createdAt' : 'happenedAt';
  const dateFilteredRows = (Array.isArray(rows) ? rows : []).filter((row) =>
    isInReportDateRange(row[dateColumn], dateFilters),
  );
  const configByTable = {
    check: {
      filterColumns: [
        'happenedAt',
        'eventLabel',
        'soldierName',
        'soldierMealCard',
        'laundryBagCode',
        'keyName',
      ],
      sortColumns: [
        'happenedAt',
        'eventLabel',
        'soldierName',
        'soldierMealCard',
        'laundryBagCode',
        'keyName',
      ],
    },
    move: {
      filterColumns: ['happenedAt', 'soldierName', 'previousKeyName', 'newKeyName'],
      sortColumns: ['happenedAt', 'soldierName', 'previousKeyName', 'newKeyName'],
    },
    item: {
      filterColumns: ['createdAt', 'soldierName', 'description', 'laundryBagCode'],
      sortColumns: ['createdAt', 'soldierName', 'description', 'quantity', 'laundryBagCode'],
    },
  };

  return {
    ...applyServerTableState(dateFilteredRows, source, {
      ...configByTable[table],
      getColumnValue: (row, column) => getReportColumnValue(row, table, column),
    }),
    dateFilters,
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

async function readTemplateRows({
  fileBuffer,
  worksheetName,
  headers,
  headerAliases = [],
  invalidCode,
  invalidMessage,
  mapRow,
}) {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError({
      status: 400,
      code: invalidCode,
      message: invalidMessage,
    });
  }

  const worksheet = workbook.getWorksheet(worksheetName) || workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError({
      status: 400,
      code: invalidCode,
      message: `The uploaded template does not contain a ${worksheetName} worksheet.`,
    });
  }

  const headerRow = worksheet.getRow(1);
  const normalizedHeaders = headers.map((_, index) =>
    normalizeHeader(headerRow.getCell(index + 1).text),
  );

  if (
    normalizedHeaders.some(
      (header, index) => header !== headers[index] && !headerAliases[index]?.includes(header),
    )
  ) {
    throw new AppError({
      status: 400,
      code: invalidCode,
      message: `The ${worksheetName.toLowerCase()} template headers are invalid. Download a fresh template and try again.`,
    });
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const mapped = mapRow(row, rowNumber);
    if (Object.entries(mapped).some(([key, value]) => key !== 'rowNumber' && value)) rows.push(mapped);
  });

  return rows;
}

async function readBuildingTemplateRows(fileBuffer) {
  return readTemplateRows({
    fileBuffer,
    worksheetName: 'Buildings',
    headers: BUILDING_TEMPLATE_HEADERS,
    headerAliases: BUILDING_TEMPLATE_HEADER_ALIASES,
    invalidCode: 'INVALID_ACCOMMODATION_BUILDING_TEMPLATE',
    invalidMessage: 'The uploaded file must be a valid .xlsx building template.',
    mapRow: (row, rowNumber) => ({
      rowNumber,
      buildingId: String(readCellText(row.getCell(1)) || '')
        .trim()
        .toLowerCase(),
      name: normalizeName(readCellText(row.getCell(2))),
      type: normalizeName(readCellText(row.getCell(3))),
    }),
  });
}

async function readRoomTemplateRows(fileBuffer) {
  return readTemplateRows({
    fileBuffer,
    worksheetName: 'Rooms',
    headers: ROOM_TEMPLATE_HEADERS,
    headerAliases: ROOM_TEMPLATE_HEADER_ALIASES,
    invalidCode: 'INVALID_ACCOMMODATION_ROOM_TEMPLATE',
    invalidMessage: 'The uploaded file must be a valid .xlsx room template.',
    mapRow: (row, rowNumber) => ({
      rowNumber,
      roomId: String(readCellText(row.getCell(1)) || '')
        .trim()
        .toLowerCase(),
      name: normalizeName(readCellText(row.getCell(2))),
      building: normalizeName(readCellText(row.getCell(3))),
    }),
  });
}

async function readKeyTemplateRows(fileBuffer) {
  return readTemplateRows({
    fileBuffer,
    worksheetName: 'Keys',
    headers: KEY_TEMPLATE_HEADERS,
    headerAliases: KEY_TEMPLATE_HEADER_ALIASES,
    invalidCode: 'INVALID_ACCOMMODATION_KEY_TEMPLATE',
    invalidMessage: 'The uploaded file must be a valid .xlsx key template.',
    mapRow: (row, rowNumber) => ({
      rowNumber,
      keyId: String(readCellText(row.getCell(1)) || '')
        .trim()
        .toLowerCase(),
      name: normalizeName(readCellText(row.getCell(2))),
      nfcCode: normalizeNfcCode(readCellText(row.getCell(3))),
      room: normalizeName(readCellText(row.getCell(4))),
    }),
  });
}

async function readSoldierTemplateRows(fileBuffer) {
  return readTemplateRows({
    fileBuffer,
    worksheetName: 'Soldiers',
    headers: SOLDIER_TEMPLATE_HEADERS,
    headerAliases: SOLDIER_TEMPLATE_HEADER_ALIASES,
    invalidCode: 'INVALID_ACCOMMODATION_SOLDIER_TEMPLATE',
    invalidMessage: 'The uploaded file must be a valid .xlsx soldier template.',
    mapRow: (row, rowNumber) => ({
      rowNumber,
      soldierId: String(readCellText(row.getCell(1)) || '')
        .trim()
        .toLowerCase(),
      name: normalizeName(readCellText(row.getCell(2))),
      country: normalizeName(readCellText(row.getCell(3))),
      mealCard: normalizeName(readCellText(row.getCell(4))),
      laundryBag: normalizeName(readCellText(row.getCell(5))),
      upcomingAccommodation: normalizeText(readCellText(row.getCell(6))),
      upcomingRelease: normalizeText(readCellText(row.getCell(7))),
      upcomingKey: normalizeName(readCellText(row.getCell(8))),
    }),
  });
}

async function readAdditionalItemTemplateRows(fileBuffer) {
  return readTemplateRows({
    fileBuffer,
    worksheetName: 'Additional Items',
    headers: ADDITIONAL_ITEM_TEMPLATE_HEADERS,
    headerAliases: ADDITIONAL_ITEM_TEMPLATE_HEADER_ALIASES,
    invalidCode: 'INVALID_ACCOMMODATION_ADDITIONAL_ITEM_TEMPLATE',
    invalidMessage: 'The uploaded file must be a valid .xlsx additional item template.',
    mapRow: (row, rowNumber) => ({
      rowNumber,
      itemId: String(readCellText(row.getCell(1)) || '')
        .trim()
        .toLowerCase(),
      soldier: normalizeName(readCellText(row.getCell(2))),
      description: normalizeName(readCellText(row.getCell(3))),
      quantity: normalizeName(readCellText(row.getCell(4))),
      laundryBag: normalizeName(readCellText(row.getCell(5))),
    }),
  });
}

function createAccommodationService({ repository, realtime, now = () => new Date() }) {
  function emitAccommodationChanged(campId) {
    realtime?.emitAccommodationChanged?.(campId);
  }

  function emitSoldierChanged(campId, payload = {}) {
    if (typeof realtime?.emitSoldierChanged === 'function') {
      realtime.emitSoldierChanged(campId, payload);
      return;
    }
    emitAccommodationChanged(campId);
  }

  function emitAdditionalItemChanged(campId, { soldierId = null, hasLaundryBag = false } = {}) {
    if (hasLaundryBag) {
      emitSoldierChanged(campId, { action: 'additional-item-bag', soldierId });
      return;
    }
    emitAccommodationChanged(campId);
  }

  function hasImportChanges(summary) {
    return (Number(summary?.addedCount) || 0) > 0 || (Number(summary?.updatedCount) || 0) > 0;
  }

  async function assertAccommodationPermission(actorUserId, permissionName, deniedMessage) {
    const [hasFullPermission, hasSpecificPermission] = await Promise.all([
      repository.userHasPermission(actorUserId, ACCOMMODATION_PERMISSIONS.full),
      repository.userHasPermission(actorUserId, permissionName),
    ]);

    if (!hasFullPermission && !hasSpecificPermission) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: deniedMessage,
      });
    }
  }

  async function canAddOrEdit(actorUserId, addPermission, editPermission) {
    const [full, add, edit] = await Promise.all([
      repository.userHasPermission(actorUserId, ACCOMMODATION_PERMISSIONS.full),
      repository.userHasPermission(actorUserId, addPermission),
      repository.userHasPermission(actorUserId, editPermission),
    ]);
    return { canAdd: full || add, canEdit: full || edit };
  }

  async function assertAnyAccommodationPermission(actorUserId, permissionNames, deniedMessage) {
    const names = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
    const results = await Promise.all(
      [ACCOMMODATION_PERMISSIONS.full, ...names].map((permissionName) =>
        repository.userHasPermission(actorUserId, permissionName),
      ),
    );

    if (!results.some(Boolean)) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: deniedMessage,
      });
    }
  }

  async function assertUniqueBuildingName({ campId, name, currentBuildingId = null }) {
    const duplicate = await repository.findBuildingByName({ campId, name });
    if (duplicate && String(duplicate.id) !== String(currentBuildingId || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_ACCOMMODATION_BUILDING',
        message: `Building "${name}" already exists in the selected camp.`,
      });
    }
  }

  async function assertUniqueRoomName({ campId, name, currentRoomId = null }) {
    const duplicate = await repository.findRoomByName({ campId, name });
    if (duplicate && String(duplicate.id) !== String(currentRoomId || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_ACCOMMODATION_ROOM',
        message: `Room "${name}" already exists in the selected camp.`,
      });
    }
  }

  async function assertUniqueKeyFields({ campId, name, nfcCode, currentKeyId = null }) {
    const [duplicateName, duplicateNfc] = await Promise.all([
      repository.findKeyByName({ campId, name }),
      repository.findKeyByNfcCode({ nfcCode }),
    ]);

    if (duplicateName && String(duplicateName.id) !== String(currentKeyId || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_ACCOMMODATION_KEY',
        message: `Key "${name}" already exists in the selected camp.`,
      });
    }

    if (duplicateNfc && String(duplicateNfc.id) !== String(currentKeyId || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_ACCOMMODATION_KEY_NFC_CODE',
        message: `NFC code "${nfcCode}" is already assigned to another key.`,
      });
    }
  }

  async function assertUniqueSoldierName({ campId, name, currentSoldierId = null }) {
    const duplicate = await repository.findSoldierByName({ campId, name });
    if (duplicate && String(duplicate.id) !== String(currentSoldierId || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_ACCOMMODATION_SOLDIER',
        message: `Soldier "${name}" already exists in the selected camp.`,
      });
    }
  }

  async function resolveOptionalLaundryBagReference({ campId, value }) {
    const bagValue = normalizeName(value);
    if (!bagValue) return null;

    const bag = isUuid(bagValue)
      ? await repository.findLaundryBagById({ laundryBagId: bagValue, campId })
      : (await repository.findLaundryBagByCode({ code: bagValue, campId })) ||
        (await repository.findLaundryBagByRfid({ rfidCode: bagValue }));

    if (!bag) throw new Error(`Laundry bag "${bagValue}" was not found in the selected camp.`);
    return bag.id;
  }

  function assertLaundryBagCanBeAssigned(bag, currentSoldierId = null) {
    if (isLaundryBagAvailableForSoldier(bag, currentSoldierId)) return;

    throw new AppError({
      status: 409,
      code: 'ACCOMMODATION_LAUNDRY_BAG_NOT_AVAILABLE',
      message: 'Only Available laundry bags can be assigned.',
    });
  }

  function assertSavedSelection(result, code, message) {
    if (result) return result;

    throw new AppError({
      status: 409,
      code,
      message,
    });
  }

  async function resolveOptionalKeyReference({ campId, value }) {
    const keyValue = normalizeName(value);
    if (!keyValue) return null;

    const key = isUuid(keyValue)
      ? await repository.findKeyById({ keyId: keyValue, campId })
      : await repository.findKeyByName({ name: keyValue, campId });

    if (!key) throw new Error(`Key "${keyValue}" was not found in the selected camp.`);
    return key.id;
  }

  async function resolveBulkSoldierReference({ campId, value }) {
    const soldierValue = normalizeName(value);
    if (!soldierValue) throw new Error('Soldier is required.');

    const soldier = isUuid(soldierValue)
      ? await repository.findSoldierById({ soldierId: soldierValue, campId })
      : await repository.findSoldierByName({ name: soldierValue, campId });

    if (!soldier) throw new Error(`Soldier "${soldierValue}" was not found in the selected camp.`);
    return soldier.id;
  }

  async function resolveBulkBuildingReference({ campId, value }) {
    const buildingValue = normalizeName(value);
    if (!buildingValue) throw new Error('Building is required.');

    const building = isUuid(buildingValue)
      ? await repository.findBuildingById({ buildingId: buildingValue, campId })
      : await repository.findBuildingByName({ name: buildingValue, campId });

    if (!building) throw new Error(`Building "${buildingValue}" was not found in the selected camp.`);
    return building.id;
  }

  async function resolveBulkRoomReference({ campId, value }) {
    const roomValue = normalizeName(value);
    if (!roomValue) throw new Error('Room is required.');

    const room = isUuid(roomValue)
      ? await repository.findRoomById({ roomId: roomValue, campId })
      : await repository.findRoomByName({ name: roomValue, campId });

    if (!room) throw new Error(`Room "${roomValue}" was not found in the selected camp.`);
    return room.id;
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

  function normalizeIdList(values, fieldName) {
    const ids = Array.isArray(values)
      ? values
          .map((value) => normalizeText(value))
          .filter(Boolean)
      : [];
    if (!ids.length) {
      throw new AppError({
        status: 400,
        code: 'ACCOMMODATION_BULK_SELECTION_REQUIRED',
        message: `Select at least one ${fieldName} before continuing.`,
      });
    }
    return [...new Set(ids)];
  }

  function findDuplicateIds(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
      const id = normalizeText(value);
      if (!id) continue;
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    return [...duplicates];
  }

  function normalizeMoveKeyIds({ keyId, keyIds } = {}) {
    const ids = Array.isArray(keyIds)
      ? keyIds.map((value) => normalizeText(value)).filter(Boolean)
      : [normalizeText(keyId)].filter(Boolean);
    if (!ids.length) {
      throw new AppError({
        status: 400,
        code: 'ACCOMMODATION_MOVE_DESTINATION_REQUIRED',
        message: 'Choose at least one destination key before moving soldiers.',
      });
    }
    return ids;
  }

  async function getSoldierForMoveKey({ campId, key }) {
    if (!key?.soldierId) return null;
    const soldier = await repository.findSoldierById({ soldierId: key.soldierId, campId });
    if (!soldier?.keyId && !soldier?.usedKey) {
      throw new AppError({
        status: 409,
        code: 'ACCOMMODATION_MOVE_CHAIN_INVALID',
        message: 'A selected occupied key is not linked to an accommodated soldier.',
      });
    }
    return soldier;
  }

  function isAccommodationBuildingType(value) {
    return normalizeName(value).toLowerCase() === 'accommodation';
  }

  function assertKeyCanAccommodateSoldier(key, keyLabel = 'selected key') {
    if (isAccommodationBuildingType(key?.buildingType) && key?.hasBedAsset) return;

    throw new AppError({
      status: 409,
      code: 'ACCOMMODATION_KEY_NOT_ACCOMMODATION_BED',
      message: `The ${keyLabel} must be in an Accommodation building and linked to a Bed asset before soldiers can be accommodated there.`,
    });
  }

  function buildSoldierDeletionBlockers(soldier = {}, usage = {}) {
    const blockers = [];
    const pushBlocker = (code, label, message, count = null) => {
      blockers.push({
        code,
        label,
        message,
        ...(count === null || count === undefined ? {} : { count: Number(count) || 0 }),
      });
    };

    if (soldier.keyId || soldier.usedKey || Number(usage.keyAssignmentCount) > 0) {
      pushBlocker(
        'active_accommodation',
        'active accommodation',
        'Discharge the soldier from their key first.',
        usage.keyAssignmentCount,
      );
    }
    if (Number(usage.additionalItemCount) > 0) {
      pushBlocker(
        'additional_items',
        'additional items',
        'Delete or reassign the soldier additional items first.',
        usage.additionalItemCount,
      );
    }
    if (Number(usage.activeBicycleAssignmentCount) > 0) {
      pushBlocker(
        'active_bicycle_rentals',
        'active bicycle rentals',
        'Return active bicycle rentals first.',
        usage.activeBicycleAssignmentCount,
      );
    }

    return blockers;
  }

  function assertSoldierCanBeDeleted({ soldier, usage }) {
    const blockers = buildSoldierDeletionBlockers(soldier, usage);
    if (!blockers.length) return;

    throw new AppError({
      status: 409,
      code: 'ACCOMMODATION_SOLDIER_DELETE_BLOCKED',
      message: `Soldier cannot be deleted while active linked data exists: ${blockers
        .map((blocker) => blocker.label)
        .join(', ')}.`,
      details: blockers,
    });
  }

  async function buildMoveChainPlan({ campId, soldierId, keyIds }) {
    const source = await repository.findSoldierById({ soldierId, campId });
    const sourceKeyId = source?.keyId || source?.usedKey || '';
    if (!source || !sourceKeyId) {
      throw new AppError({
        status: 409,
        code: 'ACCOMMODATION_SOLDIER_NOT_ACCOMMODATED',
        message: 'The soldier must be accommodated before moving.',
      });
    }

    const duplicateKeyIds = findDuplicateIds(keyIds);
    if (duplicateKeyIds.length) {
      throw new AppError({
        status: 400,
        code: 'ACCOMMODATION_MOVE_CHAIN_DUPLICATE_KEY',
        message: 'Each destination key can only appear once in the move chain.',
      });
    }

    const keyResults = await Promise.all(
      keyIds.map((destinationKeyId) =>
        repository.findKeyById({ keyId: destinationKeyId, campId }),
      ),
    );
    const missingKeyIndex = keyResults.findIndex((key) => !key);
    if (missingKeyIndex >= 0) {
      throw new AppError({
        status: 404,
        code: 'ACCOMMODATION_KEY_NOT_FOUND',
        message: 'Choose existing destination keys.',
      });
    }
    keyResults.forEach((key) => assertKeyCanAccommodateSoldier(key, key.name || 'destination key'));

    const assignments = [];
    let actor = source;
    let mode = '';

    for (let index = 0; index < keyResults.length; index += 1) {
      const destinationKey = keyResults[index];
      const destinationKeyId = String(destinationKey.id);
      const actorKeyId = String(actor.keyId || actor.usedKey || '');
      const closesCycle = destinationKeyId === String(sourceKeyId);
      const isFree = !destinationKey.soldierId;

      if (destinationKeyId === actorKeyId) {
        throw new AppError({
          status: 400,
          code: 'ACCOMMODATION_MOVE_REQUIRES_DIFFERENT_KEY',
          message: 'Choose a different destination key for each soldier.',
        });
      }
      if (closesCycle && index === 0) {
        throw new AppError({
          status: 400,
          code: 'ACCOMMODATION_MOVE_REQUIRES_DIFFERENT_KEY',
          message: 'Choose a different destination key before closing the chain.',
        });
      }

      assignments.push({
        soldierId: actor.id,
        soldierName: actor.name,
        previousKeyId: actor.keyId || actor.usedKey,
        keyId: destinationKey.id,
        keyName: destinationKey.name,
      });

      if (isFree || closesCycle) {
        if (index < keyResults.length - 1) {
          throw new AppError({
            status: 400,
            code: 'ACCOMMODATION_MOVE_CHAIN_ALREADY_COMPLETE',
            message: 'The move chain must stop when it reaches a free key or the first key.',
          });
        }
        mode = isFree ? 'move' : 'swap';
        break;
      }

      actor = await getSoldierForMoveKey({ campId, key: destinationKey });
      const actorAlreadyMoving = assignments.some(
        (assignment) => String(assignment.soldierId) === String(actor.id),
      );
      if (actorAlreadyMoving) {
        throw new AppError({
          status: 400,
          code: 'ACCOMMODATION_MOVE_CHAIN_CYCLE_INVALID',
          message: 'Move chains can only close by selecting the first soldier key.',
        });
      }
    }

    if (!mode) {
      throw new AppError({
        status: 400,
        code: 'ACCOMMODATION_MOVE_CHAIN_INCOMPLETE',
        message: 'Choose a destination for each displaced soldier.',
      });
    }

    return { assignments, mode };
  }

  async function getAccommodationDataForRelease(campId) {
    const source = await repository.getAccommodationOverviewData({ campId });
    return {
      buildings: Array.isArray(source?.buildings) ? source.buildings : [],
      rooms: Array.isArray(source?.rooms) ? source.rooms : [],
      keys: Array.isArray(source?.keys) ? source.keys : [],
      soldiers: Array.isArray(source?.soldiers) ? source.soldiers : [],
    };
  }

  function getActiveAccommodationKeyIds(soldiers = []) {
    return new Set(
      soldiers
        .map((soldier) => soldier?.usedKey || soldier?.keyId)
        .filter(Boolean)
        .map(String),
    );
  }

  function getIssuedKeysToRelease({ keys = [], activeAccommodationKeyIds, selectedIdSet, scope }) {
    const seenKeyIds = new Set();
    return keys.filter((key) => {
      const keyId = String(key?.id || '');
      if (!keyId || seenKeyIds.has(keyId) || !key?.soldierId) return false;
      if (activeAccommodationKeyIds.has(keyId)) return false;
      const scopedId = scope === 'building' ? key.buildingId : key.roomId;
      if (!selectedIdSet.has(String(scopedId || ''))) return false;
      seenKeyIds.add(keyId);
      return true;
    });
  }

  function formatReleaseMessage({ dischargeCount, keyReleaseCount, scopeLabel }) {
    if (!dischargeCount && !keyReleaseCount) {
      return `No accommodated soldiers or issued keys were found in the selected ${scopeLabel}.`;
    }
    const soldierLabel = dischargeCount === 1 ? 'soldier' : 'soldiers';
    const keyLabel = keyReleaseCount === 1 ? 'issued key' : 'issued keys';
    return `${dischargeCount} ${soldierLabel} and ${keyReleaseCount} ${keyLabel} released from selected ${scopeLabel}.`;
  }

  async function importBuildings({ actorUserId, campId, fileBuffer, fileName }) {
    assertCampSelected(campId);
    assertImportFile({
      fileBuffer,
      fileName,
      resourceName: 'building',
      code: 'INVALID_ACCOMMODATION_BUILDING_TEMPLATE',
    });

    const permissions = await canAddOrEdit(
      actorUserId,
      ACCOMMODATION_PERMISSIONS.addBuilding,
      ACCOMMODATION_PERMISSIONS.editBuilding,
    );
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import building changes.",
      });
    }

    const rows = await readBuildingTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_ACCOMMODATION_BUILDING_TEMPLATE',
        message: 'The uploaded template does not contain any building rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenIds = new Set();
    let importTouchedLaundryBags = false;
    const seenNewNames = new Set();

    for (const row of rows) {
      const buildingId = String(row.buildingId || '').trim().toLowerCase();
      const name = normalizeName(row.name);
      const type = normalizeName(row.type);

      try {
        if (!name) throw new Error('Building Name is required.');
        validateName(name, 'Building Name', 96);
        if (type) validateName(type, 'Building Type', 64);
        if (buildingId && !isUuid(buildingId)) throw new Error('Identifier must be a valid UUID.');
        if (buildingId && seenIds.has(buildingId)) {
          throw new Error(`Identifier ${buildingId} is duplicated in the uploaded file.`);
        }
        if (!buildingId && seenNewNames.has(name.toLowerCase())) {
          throw new Error(`Building Name "${name}" is duplicated in the uploaded file.`);
        }

        if (buildingId) {
          seenIds.add(buildingId);
          if (!permissions.canEdit) throw new Error('You do not have permission to edit buildings.');
          const existing = await repository.findBuildingById({ buildingId, campId });
          if (!existing) throw new Error(`Building ${buildingId} was not found.`);
          await assertUniqueBuildingName({ campId, name, currentBuildingId: buildingId });

          if (
            normalizeName(existing.name).toLowerCase() === name.toLowerCase() &&
            normalizeName(existing.type).toLowerCase() === type.toLowerCase()
          ) {
            summary.skippedCount += 1;
          } else {
            await repository.editBuilding({ actorUserId, campId, buildingId, name, type });
            summary.updatedCount += 1;
          }
        } else {
          seenNewNames.add(name.toLowerCase());
          if (!permissions.canAdd) throw new Error('You do not have permission to add buildings.');
          await assertUniqueBuildingName({ campId, name });
          await repository.addBuilding({ actorUserId, campId, name, type });
          summary.addedCount += 1;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: error?.message || 'The building could not be processed.',
        });
      }

      summary.processedRows += 1;
    }

    const message = summarizeImportMessage(summary);
    const failed = summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0;
    if (hasImportChanges(summary)) emitAccommodationChanged(campId);
    return (failed ? invalid : success)({ message, summary });
  }

  async function importRooms({ actorUserId, campId, fileBuffer, fileName }) {
    assertCampSelected(campId);
    assertImportFile({
      fileBuffer,
      fileName,
      resourceName: 'room',
      code: 'INVALID_ACCOMMODATION_ROOM_TEMPLATE',
    });

    const permissions = await canAddOrEdit(
      actorUserId,
      ACCOMMODATION_PERMISSIONS.addRoom,
      ACCOMMODATION_PERMISSIONS.editRoom,
    );
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import room changes.",
      });
    }

    const rows = await readRoomTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_ACCOMMODATION_ROOM_TEMPLATE',
        message: 'The uploaded template does not contain any room rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenIds = new Set();
    const seenNewNames = new Set();

    for (const row of rows) {
      const roomId = String(row.roomId || '').trim().toLowerCase();
      const name = normalizeName(row.name);

      try {
        if (!name) throw new Error('Room Name is required.');
        validateName(name, 'Room Name', 96);
        if (roomId && !isUuid(roomId)) throw new Error('Identifier must be a valid UUID.');
        if (roomId && seenIds.has(roomId)) {
          throw new Error(`Identifier ${roomId} is duplicated in the uploaded file.`);
        }
        if (!roomId && seenNewNames.has(name.toLowerCase())) {
          throw new Error(`Room Name "${name}" is duplicated in the uploaded file.`);
        }

        const buildingId = await resolveBulkBuildingReference({ campId, value: row.building });

        if (roomId) {
          seenIds.add(roomId);
          if (!permissions.canEdit) throw new Error('You do not have permission to edit rooms.');
          const existing = await repository.findRoomById({ roomId, campId });
          if (!existing) throw new Error(`Room ${roomId} was not found.`);
          await assertUniqueRoomName({ campId, name, currentRoomId: roomId });

          if (
            normalizeName(existing.name).toLowerCase() === name.toLowerCase() &&
            String(existing.buildingId || '') === String(buildingId)
          ) {
            summary.skippedCount += 1;
          } else {
            await repository.editRoom({ actorUserId, campId, roomId, name, buildingId });
            summary.updatedCount += 1;
          }
        } else {
          seenNewNames.add(name.toLowerCase());
          if (!permissions.canAdd) throw new Error('You do not have permission to add rooms.');
          await assertUniqueRoomName({ campId, name });
          await repository.addRoom({ actorUserId, campId, name, buildingId });
          summary.addedCount += 1;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: error?.message || 'The room could not be processed.',
        });
      }

      summary.processedRows += 1;
    }

    const message = summarizeImportMessage(summary);
    const failed = summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0;
    if (hasImportChanges(summary)) emitAccommodationChanged(campId);
    return (failed ? invalid : success)({ message, summary });
  }

  async function importKeys({ actorUserId, campId, fileBuffer, fileName }) {
    assertCampSelected(campId);
    assertImportFile({
      fileBuffer,
      fileName,
      resourceName: 'key',
      code: 'INVALID_ACCOMMODATION_KEY_TEMPLATE',
    });

    const permissions = await canAddOrEdit(
      actorUserId,
      ACCOMMODATION_PERMISSIONS.addKey,
      ACCOMMODATION_PERMISSIONS.editKey,
    );
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import key changes.",
      });
    }

    const rows = await readKeyTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_ACCOMMODATION_KEY_TEMPLATE',
        message: 'The uploaded template does not contain any key rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenIds = new Set();
    const seenNewNames = new Set();
    const seenNfcCodes = new Set();

    for (const row of rows) {
      const keyId = String(row.keyId || '').trim().toLowerCase();
      const name = normalizeName(row.name);
      const nfcCode = normalizeNfcCode(row.nfcCode);

      try {
        if (!name) throw new Error('Key Name is required.');
        validateName(name, 'Key Name', 128);
        if (!nfcCode) throw new Error('NFC Code is required.');
        validateNfcCode(nfcCode);
        if (keyId && !isUuid(keyId)) throw new Error('Identifier must be a valid UUID.');
        if (keyId && seenIds.has(keyId)) {
          throw new Error(`Identifier ${keyId} is duplicated in the uploaded file.`);
        }
        if (!keyId && seenNewNames.has(name.toLowerCase())) {
          throw new Error(`Key Name "${name}" is duplicated in the uploaded file.`);
        }
        if (seenNfcCodes.has(nfcCode.toLowerCase())) {
          throw new Error(`NFC Code "${nfcCode}" is duplicated in the uploaded file.`);
        }

        seenNfcCodes.add(nfcCode.toLowerCase());

        const roomId = await resolveBulkRoomReference({ campId, value: row.room });

        if (keyId) {
          seenIds.add(keyId);
          if (!permissions.canEdit) throw new Error('You do not have permission to edit keys.');
          const existing = await repository.findKeyById({ keyId, campId });
          if (!existing) throw new Error(`Key ${keyId} was not found.`);
          await assertUniqueKeyFields({ campId, name, nfcCode, currentKeyId: keyId });

          if (
            normalizeName(existing.name).toLowerCase() === name.toLowerCase() &&
            normalizeNfcCode(existing.nfcCode).toLowerCase() === nfcCode.toLowerCase() &&
            String(existing.roomId || '') === String(roomId)
          ) {
            summary.skippedCount += 1;
          } else {
            await repository.editKey({ actorUserId, campId, keyId, name, nfcCode, roomId });
            summary.updatedCount += 1;
          }
        } else {
          seenNewNames.add(name.toLowerCase());
          if (!permissions.canAdd) throw new Error('You do not have permission to add keys.');
          await assertUniqueKeyFields({ campId, name, nfcCode });
          await repository.addKey({ actorUserId, campId, name, nfcCode, roomId });
          summary.addedCount += 1;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: error?.message || 'The key could not be processed.',
        });
      }

      summary.processedRows += 1;
    }

    const message = summarizeImportMessage(summary);
    const failed = summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0;
    if (hasImportChanges(summary)) emitAccommodationChanged(campId);
    return (failed ? invalid : success)({ message, summary });
  }

  async function importSoldiers({ actorUserId, campId, fileBuffer, fileName }) {
    assertCampSelected(campId);
    assertImportFile({
      fileBuffer,
      fileName,
      resourceName: 'soldier',
      code: 'INVALID_ACCOMMODATION_SOLDIER_TEMPLATE',
    });

    const permissions = await canAddOrEdit(
      actorUserId,
      ACCOMMODATION_PERMISSIONS.addSoldier,
      ACCOMMODATION_PERMISSIONS.editSoldier,
    );
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import soldier changes.",
      });
    }

    const rows = await readSoldierTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_ACCOMMODATION_SOLDIER_TEMPLATE',
        message: 'The uploaded template does not contain any soldier rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenIds = new Set();
    const seenNewNames = new Set();

    for (const row of rows) {
      const soldierId = String(row.soldierId || '').trim().toLowerCase();
      const name = normalizeName(row.name);
      const country = normalizeName(row.country);
      const mealCard = normalizeName(row.mealCard);

      try {
        if (!name) throw new Error('Soldier Name is required.');
        validateName(name, 'Soldier Name', 128);
        if (country) validateName(country, 'Country', 96);
        if (mealCard) validateName(mealCard, 'Meal Card', 96);
        if (soldierId && !isUuid(soldierId)) throw new Error('Identifier must be a valid UUID.');
        if (soldierId && seenIds.has(soldierId)) {
          throw new Error(`Identifier ${soldierId} is duplicated in the uploaded file.`);
        }
        if (!soldierId && seenNewNames.has(name.toLowerCase())) {
          throw new Error(`Soldier Name "${name}" is duplicated in the uploaded file.`);
        }

        const laundryBagId = await resolveOptionalLaundryBagReference({
          campId,
          value: row.laundryBag,
        });
        const upcomingAccommodationKey = await resolveOptionalKeyReference({
          campId,
          value: row.upcomingKey,
        });
        const { upcomingAccommodation, upcomingRelease } = normalizeSoldierScheduleDates({
          upcomingAccommodation: row.upcomingAccommodation,
          upcomingRelease: row.upcomingRelease,
        });

        if (soldierId) {
          seenIds.add(soldierId);
          if (!permissions.canEdit) throw new Error('You do not have permission to edit soldiers.');
          const existing = await repository.findSoldierById({ soldierId, campId });
          if (!existing) throw new Error(`Soldier ${soldierId} was not found.`);
          await assertUniqueSoldierName({ campId, name, currentSoldierId: soldierId });
          if (laundryBagId) {
            const bag = await repository.findLaundryBagById({ laundryBagId, campId });
            assertLaundryBagCanBeAssigned(bag, soldierId);
          }

          const unchanged =
            normalizeName(existing.name).toLowerCase() === name.toLowerCase() &&
            normalizeName(existing.country).toLowerCase() === country.toLowerCase() &&
            normalizeName(existing.mealCard).toLowerCase() === mealCard.toLowerCase() &&
            String(existing.laundryBagId || '') === String(laundryBagId || '') &&
            String(existing.upcomingAccommodation || '').slice(0, 10) ===
              String(upcomingAccommodation || '') &&
            String(existing.upcomingRelease || '').slice(0, 10) === String(upcomingRelease || '') &&
            String(existing.upcomingAccommodationKey || '') ===
              String(upcomingAccommodationKey || '');

          if (unchanged) {
            summary.skippedCount += 1;
          } else {
            await repository.editSoldier({
              actorUserId,
              campId,
              soldierId,
              name,
              country,
              mealCard,
              laundryBagId,
              upcomingAccommodation,
              upcomingRelease,
              upcomingAccommodationKey,
            });
            summary.updatedCount += 1;
            if (laundryBagId || existing.laundryBagId) importTouchedLaundryBags = true;
          }
        } else {
          seenNewNames.add(name.toLowerCase());
          if (!permissions.canAdd) throw new Error('You do not have permission to add soldiers.');
          await assertUniqueSoldierName({ campId, name });
          if (laundryBagId) {
            const bag = await repository.findLaundryBagById({ laundryBagId, campId });
            assertLaundryBagCanBeAssigned(bag);
          }
          await repository.addSoldier({
            actorUserId,
            campId,
            name,
            country,
            mealCard,
            laundryBagId,
            upcomingAccommodation,
            upcomingRelease,
            upcomingAccommodationKey,
          });
          summary.addedCount += 1;
          if (laundryBagId) importTouchedLaundryBags = true;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: error?.message || 'The soldier could not be processed.',
        });
      }

      summary.processedRows += 1;
    }

    const message = summarizeImportMessage(summary);
    const failed = summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0;
    if (hasImportChanges(summary)) emitSoldierChanged(campId, { action: 'import' });
    return (failed ? invalid : success)({ message, summary });
  }

  async function importAdditionalItems({ actorUserId, campId, fileBuffer, fileName }) {
    assertCampSelected(campId);
    assertImportFile({
      fileBuffer,
      fileName,
      resourceName: 'additional item',
      code: 'INVALID_ACCOMMODATION_ADDITIONAL_ITEM_TEMPLATE',
    });

    const permissions = await canAddOrEdit(
      actorUserId,
      ACCOMMODATION_PERMISSIONS.addAdditionalItem,
      ACCOMMODATION_PERMISSIONS.editAdditionalItem,
    );
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import additional item changes.",
      });
    }

    const rows = await readAdditionalItemTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_ACCOMMODATION_ADDITIONAL_ITEM_TEMPLATE',
        message: 'The uploaded template does not contain any additional item rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenIds = new Set();
    let importTouchedLaundryBags = false;

    for (const row of rows) {
      const itemId = String(row.itemId || '').trim().toLowerCase();
      const description = normalizeName(row.description);
      let quantity = normalizeName(row.quantity);

      try {
        if (!description) throw new Error('Description is required.');
        validateName(description, 'Description', 160);
        if (itemId && !isUuid(itemId)) throw new Error('Identifier must be a valid UUID.');
        if (itemId && seenIds.has(itemId)) {
          throw new Error(`Identifier ${itemId} is duplicated in the uploaded file.`);
        }

        const soldierId = await resolveBulkSoldierReference({ campId, value: row.soldier });
        const laundryBagId = await resolveOptionalLaundryBagReference({
          campId,
          value: row.laundryBag,
        });
        if (laundryBagId) {
          const bag = await repository.findLaundryBagById({ laundryBagId, campId });
          assertLaundryBagCanBeAssigned(bag, soldierId);
          quantity = '1';
        }
        validatePositiveIntegerText(quantity, 'Quantity', 64);

        if (itemId) {
          seenIds.add(itemId);
          if (!permissions.canEdit) {
            throw new Error('You do not have permission to edit additional items.');
          }
          const existing = await repository.findAdditionalItemById({ itemId, campId });
          if (!existing) throw new Error(`Additional item ${itemId} was not found.`);

          if (
            String(existing.soldierId || '') === String(soldierId) &&
            normalizeName(existing.description).toLowerCase() === description.toLowerCase() &&
            normalizeName(existing.quantity).toLowerCase() === quantity.toLowerCase() &&
            String(existing.laundryBagId || '') === String(laundryBagId || '')
          ) {
            summary.skippedCount += 1;
          } else {
            await repository.editAdditionalItem({
              actorUserId,
              campId,
              itemId,
              soldierId,
              description,
              quantity,
              laundryBagId,
            });
            summary.updatedCount += 1;
          }
        } else {
          if (!permissions.canAdd) {
            throw new Error('You do not have permission to add additional items.');
          }
          await repository.addAdditionalItem({
            actorUserId,
            campId,
            soldierId,
            description,
            quantity,
            laundryBagId,
          });
          summary.addedCount += 1;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: error?.message || 'The additional item could not be processed.',
        });
      }

      summary.processedRows += 1;
    }

    const message = summarizeImportMessage(summary);
    const failed = summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0;
    if (hasImportChanges(summary)) {
      if (importTouchedLaundryBags) {
        emitSoldierChanged(campId, { action: 'additional-item-import' });
      } else {
        emitAccommodationChanged(campId);
      }
    }
    return (failed ? invalid : success)({ message, summary });
  }

  async function getUpcomingSummary({ campId }) {
    if (!campId) {
      throw new AppError({
        status: 400,
        code: 'CAMP_CONTEXT_REQUIRED',
        message: 'Camp context is required to load accommodation updates.',
      });
    }

    const rows = await repository.findUpcomingActionsByCamp(campId);
    const targetWindow = buildAccommodationTargetWindow(now());

    const accommodationList = rows
      .filter((row) => isPendingUpcomingAccommodation(row, targetWindow))
      .map(formatUpcomingAccommodationSummary);

    const releaseList = rows
      .filter((row) => isPendingUpcomingRelease(row, targetWindow))
      .map(formatUpcomingReleaseSummary);

    return {
      isAccommodation: accommodationList.length > 0,
      isRelease: releaseList.length > 0,
      accommodationList,
      releaseList,
    };
  }

  return {
    async getAccommodationView({ userId, campId, csrfToken }) {
      const permissions = userId ? await repository.listUserPermissions({ userId }) : [];
      return {
        ...ACCOMMODATION_PAGE,
        campId,
        csrfToken,
        permissionNames: permissions.map((permission) => permission.name).filter(Boolean),
        horizontalNavItems: buildHorizontalNavItems(permissions, false),
      };
    },

    async getAccommodationOverview({ campId, tableState = {} }) {
      if (!campId) {
        throw new AppError({
          status: 400,
          code: 'CAMP_CONTEXT_REQUIRED',
          message: 'Camp context is required to load accommodation data.',
        });
      }

      const source = await repository.getAccommodationOverviewData({ campId });
      const upcomingSummary = await getUpcomingSummary({ campId });

      const keyRows = (Array.isArray(source?.keys) ? source.keys : []).map((row) => {
        const soldierName = normalizeText(row.soldierName);
        const status = soldierName ? 'occupied' : 'free';
        return {
          id: row.id,
          name: normalizeText(row.name),
          nfcCode: normalizeNfcCode(row.nfcCode),
          roomId: row.roomId,
          roomName: normalizeText(row.roomName),
          buildingId: row.buildingId,
          buildingName: normalizeText(row.buildingName),
          buildingType: normalizeText(row.buildingType),
          soldierId: row.soldierId,
          soldierName: soldierName || null,
          hasBedAsset: Boolean(row.hasBedAsset),
          status,
        };
      });

      const roomMap = new Map();
      for (const row of Array.isArray(source?.rooms) ? source.rooms : []) {
        roomMap.set(row.id, {
          id: row.id,
          name: normalizeText(row.name),
          buildingId: row.buildingId,
          buildingName: normalizeText(row.buildingName),
          keys: [],
        });
      }

      for (const key of keyRows) {
        const room = roomMap.get(key.roomId);
        if (room) room.keys.push(key);
      }

      const rooms = Array.from(roomMap.values()).map((room) => {
        const totalKeys = room.keys.length;
        const occupiedKeys = room.keys.filter((key) => key.status === 'occupied').length;
        const freeKeys = room.keys.filter((key) => key.status === 'free').length;
        return {
          id: room.id,
          name: room.name,
          buildingId: room.buildingId,
          buildingName: room.buildingName,
          totalKeys,
          occupiedKeys,
          freeKeys,
          status: getAccommodationOccupancyStatus({ freeKeys, occupiedKeys }),
          keyNames: room.keys.map((key) => key.name),
        };
      });

      const buildingMap = new Map();
      for (const row of Array.isArray(source?.buildings) ? source.buildings : []) {
        buildingMap.set(row.id, {
          id: row.id,
          name: normalizeText(row.name),
          type: normalizeText(row.type),
          rooms: [],
        });
      }

      for (const room of rooms) {
        const building = buildingMap.get(room.buildingId);
        if (building) building.rooms.push(room);
      }

      const buildings = Array.from(buildingMap.values()).map((building) => {
        const roomCount = building.rooms.length;
        const totalKeys = building.rooms.reduce((sum, room) => sum + room.totalKeys, 0);
        const occupiedKeys = building.rooms.reduce((sum, room) => sum + room.occupiedKeys, 0);
        const freeKeys = building.rooms.reduce((sum, room) => sum + room.freeKeys, 0);
        return {
          id: building.id,
          name: building.name,
          type: building.type || null,
          roomCount,
          totalKeys,
          occupiedKeys,
          freeKeys,
          status: getAccommodationOccupancyStatus({ freeKeys, occupiedKeys }),
        };
      });

      const soldiers = (Array.isArray(source?.soldiers) ? source.soldiers : []).map((row) => ({
        id: row.id,
        name: normalizeText(row.name),
        country: normalizeText(row.country),
        mealCard: normalizeText(row.mealCard),
        dateAccommodation: row.dateAccommodation || null,
        dateFree: row.dateFree || null,
        laundryBagId: row.laundryBagId || null,
        laundryBagCode: normalizeText(row.laundryBagCode) || null,
        keyId: row.keyId || row.usedKey || null,
        keyName: normalizeText(row.keyName) || null,
        roomId: row.roomId || null,
        roomName: normalizeText(row.roomName) || null,
        buildingId: row.buildingId || null,
        buildingName: normalizeText(row.buildingName) || null,
        upcomingAccommodation: row.upcomingAccommodation || null,
        upcomingRelease: row.upcomingRelease || null,
        upcomingAccommodationKey: row.upcomingAccommodationKey || null,
        upcomingAccommodationKeyName: normalizeText(row.upcomingAccommodationKeyName) || null,
        activeBikeRentalCount: Number(row.activeBikeRentalCount) || 0,
        status: row.keyId || row.usedKey ? 'accommodated' : 'not accommodated',
      }));

      const laundryBags = (Array.isArray(source?.laundryBags) ? source.laundryBags : []).map(
        (row) => ({
          id: row.id,
          code: normalizeText(row.code),
          rfidCode: normalizeText(row.rfidCode) || null,
          type: normalizeText(row.type),
          status: normalizeText(row.status),
          soldierId: row.soldierId || null,
          soldierName: normalizeText(row.soldierName) || null,
        }),
      );

      const additionalItems = (
        Array.isArray(source?.additionalItems) ? source.additionalItems : []
      ).map((row) => ({
        id: row.id,
        soldierId: row.soldierId || null,
        soldierName: normalizeText(row.soldierName),
        description: normalizeText(row.description),
        quantity: normalizeText(row.quantity),
        laundryBagId: row.laundryBagId || null,
        laundryBagCode: normalizeText(row.laundryBagCode) || null,
      }));

      const movementReport = (
        Array.isArray(source?.movementReport) ? source.movementReport : []
      ).map((row) => ({
        id: row.id,
        eventType: normalizeText(row.eventType) || 'move',
        happenedAt: row.happenedAt || null,
        soldierId: row.soldierId || null,
        soldierName: normalizeText(row.soldierName) || 'Unknown soldier',
        soldierMealCard: normalizeText(row.soldierMealCard) || null,
        laundryBagCode: normalizeText(row.laundryBagCode) || null,
        previousKeyId: row.previousKeyId || null,
        previousKeyName: normalizeText(row.previousKeyName) || null,
        newKeyId: row.newKeyId || null,
        newKeyName: normalizeText(row.newKeyName) || null,
      }));
      const checkEvents = movementReport.filter((row) =>
        ['check-in', 'check-out'].includes(row.eventType),
      );
      const moveEvents = movementReport.filter((row) => row.eventType === 'move');
      const additionalItemReport = (
        Array.isArray(source?.additionalItemReport) ? source.additionalItemReport : []
      ).map((row) => ({
        id: row.id,
        soldierId: row.soldierId || null,
        soldierName: normalizeText(row.soldierName) || 'Unknown soldier',
        description: normalizeText(row.description),
        quantity: normalizeText(row.quantity),
        laundryBagId: row.laundryBagId || null,
        laundryBagCode: normalizeText(row.laundryBagCode) || null,
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      }));

      const overview = {
        totalBuildings: buildings.length,
        totalRooms: rooms.length,
        totalKeys: keyRows.length,
        totalSoldiers: soldiers.length,
        accommodatedSoldiers: soldiers.filter((soldier) => soldier.status === 'accommodated')
          .length,
        totalAdditionalItems: additionalItems.length,
        assignedLaundryBags: laundryBags.filter((bag) => bag.soldierId).length,
        occupiedKeys: keyRows.filter((key) => key.status === 'occupied').length,
        freeKeys: keyRows.filter((key) => key.status === 'free').length,
        roomsWithoutKeys: rooms.filter((room) => room.totalKeys === 0).length,
        buildingsWithoutRooms: buildings.filter((building) => building.roomCount === 0).length,
        upcomingAccommodationCount: upcomingSummary.accommodationList.length,
        upcomingReleaseCount: upcomingSummary.releaseList.length,
      };

      const stateSource = tableState && typeof tableState === 'object' ? tableState : {};
      const buildingTable = applyServerTableState(buildings, stateSource.building, {
        filterColumns: ['id', 'name', 'type', 'status'],
        sortColumns: [
          'id',
          'name',
          'type',
          'roomCount',
          'totalKeys',
          'freeKeys',
          'occupiedKeys',
          'status',
        ],
        getColumnValue: getBuildingTableColumnValue,
      });
      const roomTable = applyServerTableState(rooms, stateSource.room, {
        filterColumns: ['id', 'name', 'buildingName', 'status'],
        sortColumns: [
          'id',
          'name',
          'buildingName',
          'totalKeys',
          'freeKeys',
          'occupiedKeys',
          'status',
        ],
        getColumnValue: getRoomTableColumnValue,
      });
      const keyTable = applyServerTableState(keyRows, stateSource.key, {
        filterColumns: ['id', 'name', 'nfcCode', 'roomName', 'buildingName', 'status', 'soldierName'],
        sortColumns: [
          'id',
          'name',
          'nfcCode',
          'roomName',
          'buildingName',
          'status',
          'soldierName',
        ],
        getColumnValue: getKeyTableColumnValue,
      });
      const soldierTable = applyServerTableState(soldiers, stateSource.soldier, {
        filterColumns: [
          'country',
          'id',
          'keyName',
          'laundryBagCode',
          'mealCard',
          'name',
          'roomName',
          'status',
        ],
        sortColumns: [
          'country',
          'id',
          'keyName',
          'laundryBagCode',
          'mealCard',
          'name',
          'roomName',
          'status',
        ],
        getColumnValue: getSoldierTableColumnValue,
      });
      const additionalItemTable = applyServerTableState(
        additionalItems,
        stateSource.additionalItem,
        {
          filterColumns: ['description', 'id', 'laundryBagCode', 'quantity', 'soldierName'],
          sortColumns: ['description', 'id', 'laundryBagCode', 'quantity', 'soldierName'],
          getColumnValue: getAdditionalItemTableColumnValue,
        },
      );
      const reportState = stateSource.report && typeof stateSource.report === 'object'
        ? stateSource.report
        : {};
      const checkTable = applyReportTableState(checkEvents, 'check', reportState.check);
      const moveTable = applyReportTableState(moveEvents, 'move', reportState.move);
      const itemTable = applyReportTableState(additionalItemReport, 'item', reportState.item);

      return {
        overview,
        buildings: buildingTable.rows,
        rooms: roomTable.rows,
        keys: keyTable.rows,
        soldiers: soldierTable.rows,
        laundryBags,
        additionalItems: additionalItemTable.rows,
        upcoming: upcomingSummary,
        lookups: {
          buildings,
          rooms,
          keys: keyRows,
          soldiers,
          laundryBags,
          additionalItems,
        },
        tables: {
          buildings: tableMeta(buildingTable),
          rooms: tableMeta(roomTable),
          keys: tableMeta(keyTable),
          soldiers: tableMeta(soldierTable),
          additionalItems: tableMeta(additionalItemTable),
        },
        report: {
          checkEvents: checkTable.rows,
          moveEvents: moveTable.rows,
          additionalItems: itemTable.rows,
          totals: {
            checkEvents: checkTable.total,
            moveEvents: moveTable.total,
            additionalItems: itemTable.total,
          },
          tables: {
            check: { ...tableMeta(checkTable), dateFilters: checkTable.dateFilters },
            move: { ...tableMeta(moveTable), dateFilters: moveTable.dateFilters },
            item: { ...tableMeta(itemTable), dateFilters: itemTable.dateFilters },
          },
        },
      };
    },

    async listAccommodationLookupOptions({
      campId,
      type,
      search = '',
      limit = 20,
      onlyFree = false,
      onlyOccupied = false,
      excludedSoldierId = '',
      excludedKeyIds = '',
    } = {}) {
      assertCampSelected(campId);

      const source = await repository.getAccommodationOverviewData({ campId });
      const lookupType = normalizeText(type);
      const excludedKeyIdSet = new Set(
        String(excludedKeyIds || '')
          .split(',')
          .map((id) => normalizeText(id))
          .filter(Boolean),
      );
      const keyRows = (Array.isArray(source?.keys) ? source.keys : []).map((row) => {
        const soldierName = normalizeText(row.soldierName);
        return {
          id: row.id,
          name: normalizeText(row.name),
          nfcCode: normalizeNfcCode(row.nfcCode),
          roomId: row.roomId,
          roomName: normalizeText(row.roomName),
          buildingId: row.buildingId,
          buildingName: normalizeText(row.buildingName),
          buildingType: normalizeText(row.buildingType),
          soldierId: row.soldierId || null,
          soldierName: soldierName || null,
          hasBedAsset: Boolean(row.hasBedAsset),
          status: soldierName ? 'occupied' : 'free',
        };
      });

      const lookups = {
        building: {
          rows: (Array.isArray(source?.buildings) ? source.buildings : []).map((row) => ({
            id: row.id,
            name: normalizeText(row.name),
            type: normalizeText(row.type),
          })),
          getValues: (building) => [building.name, building.type, building.id],
          getSortValue: (building) => building.name || building.id,
        },
        room: {
          rows: (Array.isArray(source?.rooms) ? source.rooms : []).map((row) => ({
            id: row.id,
            name: normalizeText(row.name),
            buildingId: row.buildingId,
            buildingName: normalizeText(row.buildingName),
          })),
          getValues: (room) => [room.buildingName, room.name, room.id],
          getSortValue: (room) => [room.buildingName, room.name].filter(Boolean).join(' '),
        },
        soldier: {
          rows: (Array.isArray(source?.soldiers) ? source.soldiers : []).map((row) => ({
            id: row.id,
            name: normalizeText(row.name),
            country: normalizeText(row.country),
            mealCard: normalizeText(row.mealCard),
            laundryBagId: row.laundryBagId || null,
            laundryBagCode: normalizeText(row.laundryBagCode) || null,
            keyId: row.keyId || row.usedKey || null,
            keyName: normalizeText(row.keyName) || null,
            roomId: row.roomId || null,
            roomName: normalizeText(row.roomName) || null,
            buildingId: row.buildingId || null,
            buildingName: normalizeText(row.buildingName) || null,
            upcomingAccommodation: row.upcomingAccommodation || null,
            upcomingRelease: row.upcomingRelease || null,
            upcomingAccommodationKey: row.upcomingAccommodationKey || null,
            upcomingAccommodationKeyName: normalizeText(row.upcomingAccommodationKeyName) || null,
            activeBikeRentalCount: Number(row.activeBikeRentalCount) || 0,
            status: row.keyId || row.usedKey ? 'accommodated' : 'not accommodated',
          })),
          getValues: (soldier) => [
            soldier.name,
            soldier.country,
            soldier.mealCard,
            soldier.laundryBagCode,
            soldier.id,
          ],
          getSortValue: (soldier) => soldier.name || soldier.id,
        },
        laundryBag: {
          rows: (Array.isArray(source?.laundryBags) ? source.laundryBags : [])
            .map((row) => ({
              id: row.id,
              code: normalizeText(row.code),
              rfidCode: normalizeText(row.rfidCode) || null,
              type: normalizeText(row.type),
              status: normalizeLaundryBagStatus(row.status),
              soldierId: row.soldierId || null,
              soldierName: normalizeText(row.soldierName) || null,
            }))
            .filter((bag) => !onlyFree || isLaundryBagAvailableForSoldier(bag)),
          getValues: (bag) => [bag.code, bag.rfidCode, bag.soldierName, bag.id],
          getSortValue: (bag) => bag.code || bag.id,
        },
        key: {
          rows: keyRows.filter((key) => {
            if (onlyFree && key.soldierId) return false;
            if (!isAccommodationBuildingType(key.buildingType) || !key.hasBedAsset) return false;
            if (
              onlyOccupied &&
              (!key.soldierId || String(key.soldierId) === String(excludedSoldierId || ''))
            ) {
              return false;
            }
            if (excludedKeyIdSet.has(String(key.id || ''))) return false;
            return true;
          }),
          getValues: (key) => [
            key.name,
            key.roomName,
            key.buildingName,
            key.soldierName,
            key.nfcCode,
            key.id,
          ],
          getSortValue: (key) => [key.buildingName, key.roomName, key.name].filter(Boolean).join(' '),
        },
      };

      const lookup = lookups[lookupType];
      if (!lookup) {
        throw new AppError({
          status: 400,
          code: 'ACCOMMODATION_INVALID_LOOKUP_TYPE',
          message: 'Choose a valid accommodation lookup type.',
        });
      }

      return success({
        rows: applyLookupState(lookup.rows, search, {
          limit,
          getValues: lookup.getValues,
          getSortValue: lookup.getSortValue,
        }),
      });
    },

    async addSoldier({
      actorUserId,
      campId,
      name,
      country,
      mealCard,
      laundryBagId,
      upcomingAccommodation,
      upcomingRelease,
      upcomingAccommodationKey,
    }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.addSoldier,
        "You don't have permission to add soldiers.",
      );

      const soldierName = normalizeName(name);
      const soldierCountry = normalizeName(country);
      const soldierMealCard = normalizeName(mealCard);
      validateName(soldierName, 'Soldier Name', 128);
      if (soldierCountry) validateName(soldierCountry, 'Country', 96);
      if (soldierMealCard) validateName(soldierMealCard, 'Meal Card', 96);
      await assertUniqueSoldierName({ campId, name: soldierName });
      if (laundryBagId) {
        const bag = await repository.findLaundryBagById({ laundryBagId, campId });
        if (!bag) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_LAUNDRY_BAG_NOT_FOUND',
            message: 'Choose an existing laundry bag before saving the soldier.',
          });
        }
        assertLaundryBagCanBeAssigned(bag);
      }
      if (upcomingAccommodationKey) {
        const key = await repository.findKeyById({ keyId: upcomingAccommodationKey, campId });
        if (!key) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_KEY_NOT_FOUND',
            message: 'Choose an existing upcoming key before saving the soldier.',
          });
        }
        assertKeyCanAccommodateSoldier(key, key.name || 'upcoming key');
      }
      const scheduleDates = normalizeSoldierScheduleDates({
        upcomingAccommodation,
        upcomingRelease,
      });

      const soldier = assertSavedSelection(
        await repository.addSoldier({
          actorUserId,
          campId,
          name: soldierName,
          country: soldierCountry,
          mealCard: soldierMealCard,
          laundryBagId: laundryBagId || null,
          upcomingAccommodation: scheduleDates.upcomingAccommodation,
          upcomingRelease: scheduleDates.upcomingRelease,
          upcomingAccommodationKey: upcomingAccommodationKey || null,
        }),
        'ACCOMMODATION_SOLDIER_SAVE_CONFLICT',
        'The soldier could not be saved because the selected data changed. Refresh and try again.',
      );
      emitSoldierChanged(campId, { action: 'created', soldierId: soldier?.id });

      return success({ message: 'Soldier added successfully.', soldier });
    },

    async editSoldier({
      actorUserId,
      campId,
      soldierId,
      name,
      country,
      mealCard,
      laundryBagId,
      upcomingAccommodation,
      upcomingRelease,
      upcomingAccommodationKey,
    }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.editSoldier,
        "You don't have permission to edit soldiers.",
      );

      const existing = await repository.findSoldierById({ soldierId, campId });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
          message: 'The soldier was not found in the selected camp.',
        });
      }

      const soldierName = normalizeName(name);
      const soldierCountry = normalizeName(country);
      const soldierMealCard = normalizeName(mealCard);
      validateName(soldierName, 'Soldier Name', 128);
      if (soldierCountry) validateName(soldierCountry, 'Country', 96);
      if (soldierMealCard) validateName(soldierMealCard, 'Meal Card', 96);
      await assertUniqueSoldierName({ campId, name: soldierName, currentSoldierId: soldierId });
      if (laundryBagId) {
        const bag = await repository.findLaundryBagById({ laundryBagId, campId });
        if (!bag) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_LAUNDRY_BAG_NOT_FOUND',
            message: 'Choose an existing laundry bag before saving the soldier.',
          });
        }
        assertLaundryBagCanBeAssigned(bag, soldierId);
      }
      if (upcomingAccommodationKey) {
        const key = await repository.findKeyById({ keyId: upcomingAccommodationKey, campId });
        if (!key) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_KEY_NOT_FOUND',
            message: 'Choose an existing upcoming key before saving the soldier.',
          });
        }
        assertKeyCanAccommodateSoldier(key, key.name || 'upcoming key');
      }
      const scheduleDates = normalizeSoldierScheduleDates({
        upcomingAccommodation,
        upcomingRelease,
      });

      const soldier = assertSavedSelection(
        await repository.editSoldier({
          actorUserId,
          campId,
          soldierId,
          name: soldierName,
          country: soldierCountry,
          mealCard: soldierMealCard,
          laundryBagId: laundryBagId || null,
          upcomingAccommodation: scheduleDates.upcomingAccommodation,
          upcomingRelease: scheduleDates.upcomingRelease,
          upcomingAccommodationKey: upcomingAccommodationKey || null,
        }),
        'ACCOMMODATION_SOLDIER_SAVE_CONFLICT',
        'The soldier could not be updated because the selected data changed. Refresh and try again.',
      );
      emitSoldierChanged(campId, { action: 'updated', soldierId });

      return success({ message: 'Soldier updated successfully.', soldier });
    },

    async deleteSoldier({ actorUserId, campId, soldierId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.deleteSoldier,
        "You don't have permission to remove soldiers.",
      );

      const soldier = await repository.findSoldierById({ soldierId, campId });
      if (!soldier) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
          message: 'The soldier was not found in the selected camp.',
        });
      }
      if (soldier.keyId || soldier.usedKey) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_SOLDIER_ACTIVE',
          message: 'Discharge the soldier before deleting the record.',
        });
      }
      assertSoldierCanBeDeleted({
        soldier,
        usage: await repository.findSoldierDeletionBlockers({ soldierId, campId }),
      });

      const deleted = await repository.deleteSoldier({ actorUserId, campId, soldierId });
      if (!deleted) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_SOLDIER_DELETE_BLOCKED',
          message: 'The soldier could not be removed while active linked data exists.',
        });
      }
      emitSoldierChanged(campId, { action: 'deleted', soldierId });

      return success({ message: 'Soldier removed successfully.', soldier: deleted });
    },

    async accommodateSoldier({ actorUserId, campId, soldierId, keyId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to accommodate soldiers.",
      );

      const [soldier, key] = await Promise.all([
        repository.findSoldierById({ soldierId, campId }),
        repository.findKeyById({ keyId, campId }),
      ]);
      if (!soldier) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
          message: 'The soldier was not found in the selected camp.',
        });
      }
      if (!key) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_KEY_NOT_FOUND',
          message: 'Choose an existing key before accommodating the soldier.',
        });
      }
      if (soldier.keyId || soldier.usedKey) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_SOLDIER_ALREADY_ACCOMMODATED',
          message: 'Discharge or move the soldier from the current key first.',
        });
      }
      if (key.soldierId) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_KEY_OCCUPIED',
          message: 'Choose a free key before accommodating the soldier.',
        });
      }
      assertKeyCanAccommodateSoldier(key, key.name || 'selected key');

      const accommodation = assertSavedSelection(
        await repository.accommodateSoldier({
          actorUserId,
          campId,
          soldierId,
          keyId,
        }),
        'ACCOMMODATION_ACCOMMODATION_CONFLICT',
        'The selected soldier or key is no longer available. Refresh and try again.',
      );
      emitSoldierChanged(campId, { action: 'accommodated', soldierId, keyId });

      return success({ message: 'Soldier accommodated successfully.', accommodation });
    },

    async accommodateSoldiers({ actorUserId, campId, assignments = [] }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to accommodate soldiers.",
      );

      const normalizedAssignments = (Array.isArray(assignments) ? assignments : [])
        .map((assignment) => ({
          soldierId: normalizeText(assignment?.soldierId),
          keyId: normalizeText(assignment?.keyId),
        }))
        .filter((assignment) => assignment.soldierId && assignment.keyId);
      if (!normalizedAssignments.length) {
        throw new AppError({
          status: 400,
          code: 'ACCOMMODATION_BULK_ASSIGNMENTS_REQUIRED',
          message: 'Choose soldiers and free keys before accommodating them.',
        });
      }

      const duplicateSoldiers = findDuplicateIds(
        normalizedAssignments.map((assignment) => assignment.soldierId),
      );
      const duplicateKeys = findDuplicateIds(normalizedAssignments.map((assignment) => assignment.keyId));
      if (duplicateSoldiers.length || duplicateKeys.length) {
        throw new AppError({
          status: 400,
          code: 'ACCOMMODATION_BULK_DUPLICATE_ASSIGNMENTS',
          message: 'Each soldier and key can only be used once in a multiple accommodation.',
        });
      }

      const [soldiers, keys] = await Promise.all([
        Promise.all(
          normalizedAssignments.map((assignment) =>
            repository.findSoldierById({ soldierId: assignment.soldierId, campId }),
          ),
        ),
        Promise.all(
          normalizedAssignments.map((assignment) =>
            repository.findKeyById({ keyId: assignment.keyId, campId }),
          ),
        ),
      ]);

      for (let index = 0; index < normalizedAssignments.length; index += 1) {
        const soldier = soldiers[index];
        const key = keys[index];
        if (!soldier) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
            message: 'One selected soldier was not found in the selected camp.',
          });
        }
        if (!key) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_KEY_NOT_FOUND',
            message: 'One selected key was not found in the selected camp.',
          });
        }
        if (soldier.keyId || soldier.usedKey) {
          throw new AppError({
            status: 409,
            code: 'ACCOMMODATION_SOLDIER_ALREADY_ACCOMMODATED',
            message: `Discharge or move ${soldier.name || 'a selected soldier'} first.`,
          });
        }
        if (key.soldierId) {
          throw new AppError({
            status: 409,
            code: 'ACCOMMODATION_KEY_OCCUPIED',
            message: `Choose a free key instead of ${key.name || 'one selected key'}.`,
          });
        }
        assertKeyCanAccommodateSoldier(key, key.name || 'one selected key');
      }

      const accommodations = [];
      for (const assignment of normalizedAssignments) {
        const accommodation = await repository.accommodateSoldier({
          actorUserId,
          campId,
          soldierId: assignment.soldierId,
          keyId: assignment.keyId,
        });
        if (!accommodation) {
          throw new AppError({
            status: 409,
            code: 'ACCOMMODATION_BULK_ACCOMMODATION_CONFLICT',
            message: 'One accommodation could not be completed because the data changed.',
          });
        }
        accommodations.push(accommodation);
      }

      emitSoldierChanged(campId, {
        action: 'accommodated-multiple',
        soldierIds: normalizedAssignments.map((assignment) => assignment.soldierId),
        keyIds: normalizedAssignments.map((assignment) => assignment.keyId),
      });

      return success({
        message: `${accommodations.length} soldiers accommodated successfully.`,
        accommodations,
      });
    },

    async dischargeSoldier({ actorUserId, campId, soldierId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to discharge soldiers.",
      );

      const soldier = await repository.findSoldierById({ soldierId, campId });
      if (!soldier) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
          message: 'The soldier was not found in the selected camp.',
        });
      }
      if (!soldier.keyId && !soldier.usedKey) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_SOLDIER_NOT_ACCOMMODATED',
          message: 'The soldier is not currently accommodated.',
        });
      }

      const discharge = assertSavedSelection(
        await repository.dischargeSoldier({ actorUserId, campId, soldierId }),
        'ACCOMMODATION_DISCHARGE_CONFLICT',
        'The soldier could not be discharged because the accommodation changed. Refresh and try again.',
      );
      emitSoldierChanged(campId, {
        action: 'discharged',
        soldierId,
        keyId: discharge?.previousKeyId,
      });

      return success({ message: 'Soldier discharged successfully.', discharge });
    },

    async releaseRooms({ actorUserId, campId, roomIds = [] }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to release rooms.",
      );

      const selectedRoomIds = normalizeIdList(roomIds, 'room');
      const data = await getAccommodationDataForRelease(campId);
      const knownRoomIds = new Set(data.rooms.map((room) => String(room.id)));
      if (selectedRoomIds.some((roomId) => !knownRoomIds.has(String(roomId)))) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_ROOM_NOT_FOUND',
          message: 'One selected room was not found in the selected camp.',
        });
      }

      const selectedIdSet = new Set(selectedRoomIds.map(String));
      const soldiersToRelease = data.soldiers.filter(
        (soldier) =>
          (soldier.keyId || soldier.usedKey) && selectedIdSet.has(String(soldier.roomId || '')),
      );
      const issuedKeysToRelease = getIssuedKeysToRelease({
        keys: data.keys,
        activeAccommodationKeyIds: getActiveAccommodationKeyIds(data.soldiers),
        selectedIdSet,
        scope: 'room',
      });
      const discharges = [];
      for (const soldier of soldiersToRelease) {
        const discharge = await repository.dischargeSoldier({
          actorUserId,
          campId,
          soldierId: soldier.id,
        });
        if (discharge) discharges.push(discharge);
      }
      const keyReleases = [];
      for (const key of issuedKeysToRelease) {
        const release = await repository.releaseKeyFromSoldier({
          actorUserId,
          campId,
          keyId: key.id,
        });
        if (release) keyReleases.push(release);
      }
      if (discharges.length || keyReleases.length) emitAccommodationChanged(campId);

      return success({
        message: formatReleaseMessage({
          dischargeCount: discharges.length,
          keyReleaseCount: keyReleases.length,
          scopeLabel: 'rooms',
        }),
        discharges,
        keyReleases,
      });
    },

    async releaseBuildings({ actorUserId, campId, buildingIds = [] }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to release buildings.",
      );

      const selectedBuildingIds = normalizeIdList(buildingIds, 'building');
      const data = await getAccommodationDataForRelease(campId);
      const knownBuildingIds = new Set(data.buildings.map((building) => String(building.id)));
      if (selectedBuildingIds.some((buildingId) => !knownBuildingIds.has(String(buildingId)))) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_BUILDING_NOT_FOUND',
          message: 'One selected building was not found in the selected camp.',
        });
      }

      const selectedIdSet = new Set(selectedBuildingIds.map(String));
      const soldiersToRelease = data.soldiers.filter(
        (soldier) =>
          (soldier.keyId || soldier.usedKey) &&
          selectedIdSet.has(String(soldier.buildingId || '')),
      );
      const issuedKeysToRelease = getIssuedKeysToRelease({
        keys: data.keys,
        activeAccommodationKeyIds: getActiveAccommodationKeyIds(data.soldiers),
        selectedIdSet,
        scope: 'building',
      });
      const discharges = [];
      for (const soldier of soldiersToRelease) {
        const discharge = await repository.dischargeSoldier({
          actorUserId,
          campId,
          soldierId: soldier.id,
        });
        if (discharge) discharges.push(discharge);
      }
      const keyReleases = [];
      for (const key of issuedKeysToRelease) {
        const release = await repository.releaseKeyFromSoldier({
          actorUserId,
          campId,
          keyId: key.id,
        });
        if (release) keyReleases.push(release);
      }
      if (discharges.length || keyReleases.length) emitAccommodationChanged(campId);

      return success({
        message: formatReleaseMessage({
          dischargeCount: discharges.length,
          keyReleaseCount: keyReleases.length,
          scopeLabel: 'buildings',
        }),
        discharges,
        keyReleases,
      });
    },

    async moveSoldier({ actorUserId, campId, soldierId, keyId, keyIds }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to move soldiers.",
      );

      const normalizedKeyIds = normalizeMoveKeyIds({ keyId, keyIds });
      const plan = await buildMoveChainPlan({
        campId,
        soldierId,
        keyIds: normalizedKeyIds,
      });
      const move = assertSavedSelection(
        await repository.moveSoldier({
          actorUserId,
          campId,
          soldierId,
          keyIds: normalizedKeyIds,
          assignments: plan.assignments,
        }),
        'ACCOMMODATION_MOVE_CONFLICT',
        'The selected accommodation path changed. Refresh and choose the keys again.',
      );
      emitSoldierChanged(campId, {
        action: 'moved',
        soldierId,
        keyIds: normalizedKeyIds,
      });

      const movedCount = plan.assignments.length;
      const message =
        movedCount > 1
          ? `${movedCount} soldiers moved successfully.`
          : 'Soldier moved successfully.';
      return success({ message, move });
    },

    async swapSoldiers({ actorUserId, campId, soldierId, targetSoldierId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to swap soldiers.",
      );

      if (String(soldierId) === String(targetSoldierId)) {
        throw new AppError({
          status: 400,
          code: 'ACCOMMODATION_SWAP_REQUIRES_TWO_SOLDIERS',
          message: 'Choose two different accommodated soldiers before swapping.',
        });
      }

      const [soldier, targetSoldier] = await Promise.all([
        repository.findSoldierById({ soldierId, campId }),
        repository.findSoldierById({ soldierId: targetSoldierId, campId }),
      ]);
      if (!soldier?.keyId || !targetSoldier?.keyId) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_SWAP_REQUIRES_ACTIVE_SOLDIERS',
          message: 'Both soldiers must be accommodated before swapping.',
        });
      }

      const swap = assertSavedSelection(
        await repository.swapSoldiers({
          actorUserId,
          campId,
          soldierId,
          targetSoldierId,
        }),
        'ACCOMMODATION_SWAP_CONFLICT',
        'The selected soldiers could not be swapped because the accommodation changed. Refresh and try again.',
      );
      emitAccommodationChanged(campId);

      return success({ message: 'Soldiers swapped successfully.', swap });
    },

    async addBuilding({ actorUserId, campId, name, type }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.addBuilding,
        "You don't have permission to add buildings.",
      );

      const buildingName = normalizeName(name);
      const buildingType = normalizeName(type);
      await assertUniqueBuildingName({ campId, name: buildingName });
      const building = await repository.addBuilding({
        actorUserId,
        campId,
        name: buildingName,
        type: buildingType,
      });
      emitAccommodationChanged(campId);

      return success({ message: 'Building added successfully.', building });
    },

    async downloadAccommodationReport({
      campId,
      section = 'all',
      fromDate = '',
      toDate = '',
      tableState = {},
    }) {
      assertCampSelected(campId);
      const normalizedSection = ['check', 'move', 'items', 'all'].includes(
        String(section || '').trim(),
      )
        ? String(section || '').trim()
        : 'all';
      const source = await repository.getAccommodationOverviewData({ campId });
      const movementRows = (Array.isArray(source?.movementReport) ? source.movementReport : []).map(
        (row) => ({
          id: row.id,
          eventType: normalizeText(row.eventType) || 'move',
          happenedAt: row.happenedAt || null,
          soldierName: normalizeText(row.soldierName) || 'Unknown soldier',
          soldierMealCard: normalizeText(row.soldierMealCard) || null,
          laundryBagCode: normalizeText(row.laundryBagCode) || null,
          previousKeyName: normalizeText(row.previousKeyName) || null,
          newKeyName: normalizeText(row.newKeyName) || null,
        }),
      );
      const rawCheckRows = movementRows.filter((row) =>
        ['check-in', 'check-out'].includes(row.eventType),
      );
      const rawMoveRows = movementRows.filter((row) => row.eventType === 'move');
      const rawItemRows = (
        Array.isArray(source?.additionalItemReport) ? source.additionalItemReport : []
      ).map((row) => ({
        soldierName: normalizeText(row.soldierName) || 'Unknown soldier',
        description: normalizeText(row.description),
        quantity: normalizeText(row.quantity),
        laundryBagCode: normalizeText(row.laundryBagCode) || null,
        createdAt: row.createdAt || null,
      }));
      const reportState =
        tableState?.report && typeof tableState.report === 'object' ? tableState.report : {};
      const fallbackDateFilters = { fromDate, toDate };
      const checkRows = applyReportTableState(
        rawCheckRows,
        'check',
        reportState.check,
        fallbackDateFilters,
      ).allRows;
      const moveRows = applyReportTableState(
        rawMoveRows,
        'move',
        reportState.move,
        fallbackDateFilters,
      ).allRows;
      const itemRows = applyReportTableState(
        rawItemRows,
        'item',
        reportState.item,
        fallbackDateFilters,
      ).allRows;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Global Support System';
      workbook.created = new Date();

      const addCheckSheet = () => {
        const sheet = workbook.addWorksheet('Check-ins check-outs');
        sheet.columns = [
          { header: 'Time', key: 'happenedAt', width: 22 },
          { header: 'Action', key: 'action', width: 14 },
          { header: 'Soldier', key: 'soldierName', width: 28 },
          { header: 'Meal Card', key: 'soldierMealCard', width: 18 },
          { header: 'Bag', key: 'laundryBagCode', width: 18 },
          { header: 'Key', key: 'keyName', width: 32 },
        ];
        sheet.getRow(1).font = { bold: true };
        checkRows.forEach((row) =>
          sheet.addRow({
            happenedAt: reportCellValue(formatReportDateTime(row.happenedAt)),
            action: row.eventType === 'check-in' ? 'Check-in' : 'Check-out',
            soldierName: reportCellValue(row.soldierName),
            soldierMealCard: reportCellValue(row.soldierMealCard),
            laundryBagCode: reportCellValue(row.laundryBagCode),
            keyName: reportCellValue(
              row.eventType === 'check-in' ? row.newKeyName : row.previousKeyName,
            ),
          }),
        );
      };

      const addMoveSheet = () => {
        const sheet = workbook.addWorksheet('Moves');
        sheet.columns = [
          { header: 'Time', key: 'happenedAt', width: 22 },
          { header: 'Soldier', key: 'soldierName', width: 28 },
          { header: 'Previous Key', key: 'previousKeyName', width: 32 },
          { header: 'New Key', key: 'newKeyName', width: 32 },
        ];
        sheet.getRow(1).font = { bold: true };
        moveRows.forEach((row) =>
          sheet.addRow({
            happenedAt: reportCellValue(formatReportDateTime(row.happenedAt)),
            soldierName: reportCellValue(row.soldierName),
            previousKeyName: reportCellValue(row.previousKeyName),
            newKeyName: reportCellValue(row.newKeyName),
          }),
        );
      };

      const addItemSheet = () => {
        const sheet = workbook.addWorksheet('Additional items');
        sheet.columns = [
          { header: 'Given At', key: 'createdAt', width: 22 },
          { header: 'Soldier', key: 'soldierName', width: 28 },
          { header: 'Description', key: 'description', width: 34 },
          { header: 'Quantity', key: 'quantity', width: 14 },
          { header: 'Bag', key: 'laundryBagCode', width: 18 },
        ];
        sheet.getRow(1).font = { bold: true };
        itemRows.forEach((row) =>
          sheet.addRow({
            createdAt: reportCellValue(formatReportDateTime(row.createdAt)),
            soldierName: reportCellValue(row.soldierName),
            description: reportCellValue(row.description),
            quantity: reportCellValue(row.quantity),
            laundryBagCode: reportCellValue(row.laundryBagCode),
          }),
        );
      };

      if (normalizedSection === 'all' || normalizedSection === 'check') addCheckSheet();
      if (normalizedSection === 'all' || normalizedSection === 'move') addMoveSheet();
      if (normalizedSection === 'all' || normalizedSection === 'items') addItemSheet();

      const dateSuffix = fromDate || toDate ? `-${fromDate || 'start'}-to-${toDate || 'end'}` : '';
      const sectionSuffix = normalizedSection === 'all' ? '' : `-${normalizedSection}`;
      return {
        status: 200,
        fileName: `${ACCOMMODATION_REPORT_FILENAME.replace(/\.xlsx$/i, '')}${sectionSuffix}${dateSuffix}.xlsx`,
        contentType: EXCEL_CONTENT_TYPE,
        buffer: await workbook.xlsx.writeBuffer(),
      };
    },

    async downloadBuildingTemplate({ actorUserId } = {}) {
      await assertAnyAccommodationPermission(
        actorUserId,
        [ACCOMMODATION_PERMISSIONS.addBuilding, ACCOMMODATION_PERMISSIONS.editBuilding],
        "You don't have permission to download the building template.",
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Global Support System';
      workbook.created = new Date();

      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [{ width: 112 }];
      instructionsSheet.addRows([
        ['Use the Buildings sheet to add or update buildings in bulk.'],
        ['Leave Identifier blank only when creating a new building.'],
        ['Provide an existing Identifier to update that building.'],
        ['Building Name is required and must be unique inside the selected camp.'],
        ['Do not rename sheets, reorder columns, or change the header row in the Buildings sheet.'],
        ['Save the completed file as .xlsx before uploading it back to the system.'],
      ]);

      const buildingsSheet = workbook.addWorksheet('Buildings');
      buildingsSheet.columns = [
        { header: 'Identifier', key: 'buildingId', width: 40 },
        { header: 'Building Name', key: 'name', width: 36 },
        { header: 'Building Type', key: 'type', width: 28 },
      ];
      buildingsSheet.getRow(1).font = { bold: true };

      return {
        status: 200,
        fileName: BUILDING_TEMPLATE_FILENAME,
        contentType: EXCEL_CONTENT_TYPE,
        buffer: await workbook.xlsx.writeBuffer(),
      };
    },

    async downloadRoomTemplate({ actorUserId } = {}) {
      await assertAnyAccommodationPermission(
        actorUserId,
        [ACCOMMODATION_PERMISSIONS.addRoom, ACCOMMODATION_PERMISSIONS.editRoom],
        "You don't have permission to download the room template.",
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Global Support System';
      workbook.created = new Date();

      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [{ width: 112 }];
      instructionsSheet.addRows([
        ['Use the Rooms sheet to add or update rooms in bulk.'],
        ['Leave Identifier blank only when creating a new room.'],
        ['Provide an existing Identifier to update that room.'],
        ['Building accepts an exact building name or building UUID.'],
        ['Room Name is required and must be unique inside the selected camp.'],
        ['Do not rename sheets, reorder columns, or change the header row in the Rooms sheet.'],
        ['Save the completed file as .xlsx before uploading it back to the system.'],
      ]);

      const roomsSheet = workbook.addWorksheet('Rooms');
      roomsSheet.columns = [
        { header: 'Identifier', key: 'roomId', width: 40 },
        { header: 'Room Name', key: 'name', width: 36 },
        { header: 'Building', key: 'building', width: 36 },
      ];
      roomsSheet.getRow(1).font = { bold: true };

      return {
        status: 200,
        fileName: ROOM_TEMPLATE_FILENAME,
        contentType: EXCEL_CONTENT_TYPE,
        buffer: await workbook.xlsx.writeBuffer(),
      };
    },

    async downloadKeyTemplate({ actorUserId } = {}) {
      await assertAnyAccommodationPermission(
        actorUserId,
        [ACCOMMODATION_PERMISSIONS.addKey, ACCOMMODATION_PERMISSIONS.editKey],
        "You don't have permission to download the key template.",
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Global Support System';
      workbook.created = new Date();

      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [{ width: 112 }];
      instructionsSheet.addRows([
        ['Use the Keys sheet to add or update keys in bulk.'],
        ['Leave Identifier blank only when creating a new key.'],
        ['Provide an existing Identifier to update that key.'],
        ['Room accepts an exact room name or room UUID.'],
        ['Key Name is required and must be unique inside the selected camp.'],
        ['NFC Code is required and must be unique across all keys.'],
        ['Do not rename sheets, reorder columns, or change the header row in the Keys sheet.'],
        ['Save the completed file as .xlsx before uploading it back to the system.'],
      ]);

      const keysSheet = workbook.addWorksheet('Keys');
      keysSheet.columns = [
        { header: 'Identifier', key: 'keyId', width: 40 },
        { header: 'Key Name', key: 'name', width: 42 },
        { header: 'NFC Code', key: 'nfcCode', width: 32 },
        { header: 'Room', key: 'room', width: 36 },
      ];
      keysSheet.getRow(1).font = { bold: true };

      return {
        status: 200,
        fileName: KEY_TEMPLATE_FILENAME,
        contentType: EXCEL_CONTENT_TYPE,
        buffer: await workbook.xlsx.writeBuffer(),
      };
    },

    async downloadSoldierTemplate({ actorUserId } = {}) {
      await assertAnyAccommodationPermission(
        actorUserId,
        [ACCOMMODATION_PERMISSIONS.addSoldier, ACCOMMODATION_PERMISSIONS.editSoldier],
        "You don't have permission to download the soldier template.",
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Global Support System';
      workbook.created = new Date();

      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [{ width: 112 }];
      instructionsSheet.addRows([
        ['Use the Soldiers sheet to add or update soldiers in bulk.'],
        ['Leave Identifier blank only when creating a new soldier.'],
        ['Provide an existing Identifier to update that soldier.'],
        ['Laundry Bag accepts an exact bag code or UUID. Upcoming Key accepts an exact key name or UUID.'],
        ['Dates should use ISO date format, for example 2026-04-22.'],
        ['Do not rename sheets, reorder columns, or change the header row in the Soldiers sheet.'],
        ['Save the completed file as .xlsx before uploading it back to the system.'],
      ]);

      const soldiersSheet = workbook.addWorksheet('Soldiers');
      soldiersSheet.columns = [
        { header: 'Identifier', key: 'soldierId', width: 40 },
        { header: 'Soldier Name', key: 'name', width: 36 },
        { header: 'Country', key: 'country', width: 24 },
        { header: 'Meal Card', key: 'mealCard', width: 24 },
        { header: 'Laundry Bag', key: 'laundryBag', width: 28 },
        { header: 'Upcoming Accommodation', key: 'upcomingAccommodation', width: 26 },
        { header: 'Upcoming Release', key: 'upcomingRelease', width: 22 },
        { header: 'Upcoming Key', key: 'upcomingKey', width: 36 },
      ];
      soldiersSheet.getRow(1).font = { bold: true };

      return {
        status: 200,
        fileName: SOLDIER_TEMPLATE_FILENAME,
        contentType: EXCEL_CONTENT_TYPE,
        buffer: await workbook.xlsx.writeBuffer(),
      };
    },

    async downloadAdditionalItemTemplate({ actorUserId } = {}) {
      await assertAnyAccommodationPermission(
        actorUserId,
        [
          ACCOMMODATION_PERMISSIONS.addAdditionalItem,
          ACCOMMODATION_PERMISSIONS.editAdditionalItem,
        ],
        "You don't have permission to download the additional item template.",
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Global Support System';
      workbook.created = new Date();

      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [{ width: 112 }];
      instructionsSheet.addRows([
        ['Use the Additional Items sheet to add or update additional items in bulk.'],
        ['Leave Identifier blank only when creating a new item.'],
        ['Provide an existing Identifier to update that item.'],
        ['Soldier accepts an exact soldier name or UUID. Laundry Bag accepts an exact bag code or UUID.'],
        ['Quantity must be a non-negative whole number.'],
        ['Do not rename sheets, reorder columns, or change the header row in the Additional Items sheet.'],
        ['Save the completed file as .xlsx before uploading it back to the system.'],
      ]);

      const itemsSheet = workbook.addWorksheet('Additional Items');
      itemsSheet.columns = [
        { header: 'Identifier', key: 'itemId', width: 40 },
        { header: 'Soldier', key: 'soldier', width: 36 },
        { header: 'Description', key: 'description', width: 44 },
        { header: 'Quantity', key: 'quantity', width: 18 },
        { header: 'Laundry Bag', key: 'laundryBag', width: 28 },
      ];
      itemsSheet.getRow(1).font = { bold: true };

      return {
        status: 200,
        fileName: ADDITIONAL_ITEM_TEMPLATE_FILENAME,
        contentType: EXCEL_CONTENT_TYPE,
        buffer: await workbook.xlsx.writeBuffer(),
      };
    },

    async addAdditionalItem({ actorUserId, campId, soldierId, description, quantity, laundryBagId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.addAdditionalItem,
        "You don't have permission to add additional items.",
      );

      const itemDescription = normalizeName(description);
      const selectedLaundryBagId = laundryBagId || null;
      const itemQuantity = selectedLaundryBagId ? '1' : normalizeName(quantity);
      validateName(itemDescription, 'Description', 160);
      validatePositiveIntegerText(itemQuantity, 'Quantity', 64);
      const soldier = await repository.findSoldierById({ soldierId, campId });
      if (!soldier) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
          message: 'Choose an existing soldier before saving the item.',
        });
      }
      if (selectedLaundryBagId) {
        const bag = await repository.findLaundryBagById({ laundryBagId: selectedLaundryBagId, campId });
        if (!bag) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_LAUNDRY_BAG_NOT_FOUND',
            message: 'Choose an existing laundry bag before saving the item.',
          });
        }
        assertLaundryBagCanBeAssigned(bag, soldierId);
      }

      const item = assertSavedSelection(
        await repository.addAdditionalItem({
          actorUserId,
          campId,
          soldierId,
          description: itemDescription,
          quantity: itemQuantity,
          laundryBagId: selectedLaundryBagId,
        }),
        'ACCOMMODATION_ADDITIONAL_ITEM_SAVE_CONFLICT',
        'The item could not be saved because the selected soldier or laundry bag changed. Refresh and try again.',
      );
      emitAdditionalItemChanged(campId, {
        soldierId,
        hasLaundryBag: Boolean(selectedLaundryBagId),
      });

      return success({ message: 'Additional item added successfully.', item });
    },

    async editAdditionalItem({
      actorUserId,
      campId,
      itemId,
      soldierId,
      description,
      quantity,
      laundryBagId,
    }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.editAdditionalItem,
        "You don't have permission to edit additional items.",
      );

      const existing = await repository.findAdditionalItemById({ itemId, campId });
      if (!existing) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_ADDITIONAL_ITEM_NOT_FOUND',
          message: 'The additional item was not found in the selected camp.',
        });
      }

      const itemDescription = normalizeName(description);
      const selectedLaundryBagId = laundryBagId || null;
      const itemQuantity = selectedLaundryBagId ? '1' : normalizeName(quantity);
      validateName(itemDescription, 'Description', 160);
      validatePositiveIntegerText(itemQuantity, 'Quantity', 64);
      const soldier = await repository.findSoldierById({ soldierId, campId });
      if (!soldier) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
          message: 'Choose an existing soldier before saving the item.',
        });
      }
      if (selectedLaundryBagId) {
        const bag = await repository.findLaundryBagById({ laundryBagId: selectedLaundryBagId, campId });
        if (!bag) {
          throw new AppError({
            status: 404,
            code: 'ACCOMMODATION_LAUNDRY_BAG_NOT_FOUND',
            message: 'Choose an existing laundry bag before saving the item.',
          });
        }
        assertLaundryBagCanBeAssigned(bag, soldierId);
      }

      const item = assertSavedSelection(
        await repository.editAdditionalItem({
          actorUserId,
          campId,
          itemId,
          soldierId,
          description: itemDescription,
          quantity: itemQuantity,
          laundryBagId: selectedLaundryBagId,
        }),
        'ACCOMMODATION_ADDITIONAL_ITEM_SAVE_CONFLICT',
        'The item could not be updated because the selected item, soldier, or laundry bag changed. Refresh and try again.',
      );
      emitAdditionalItemChanged(campId, {
        soldierId,
        hasLaundryBag: Boolean(selectedLaundryBagId || existing.laundryBagId),
      });

      return success({ message: 'Additional item updated successfully.', item });
    },

    async deleteAdditionalItem({ actorUserId, campId, itemId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.deleteAdditionalItem,
        "You don't have permission to remove additional items.",
      );

      const item = await repository.findAdditionalItemById({ itemId, campId });
      if (!item) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_ADDITIONAL_ITEM_NOT_FOUND',
          message: 'The additional item was not found in the selected camp.',
        });
      }

      const deleted = assertSavedSelection(
        await repository.deleteAdditionalItem({ actorUserId, campId, itemId }),
        'ACCOMMODATION_ADDITIONAL_ITEM_DELETE_CONFLICT',
        'The additional item was already changed or removed. Refresh and try again.',
      );
      emitAdditionalItemChanged(campId, {
        soldierId: item.soldierId,
        hasLaundryBag: Boolean(item.laundryBagId),
      });

      return success({ message: 'Additional item removed successfully.', item: deleted });
    },

    async editBuilding({ actorUserId, campId, buildingId, name, type }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.editBuilding,
        "You don't have permission to edit buildings.",
      );

      const building = await repository.findBuildingById({ buildingId, campId });
      if (!building) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_BUILDING_NOT_FOUND',
          message: 'The building was not found in the selected camp.',
        });
      }

      const buildingName = normalizeName(name);
      const buildingType = normalizeName(type);
      await assertUniqueBuildingName({ campId, name: buildingName, currentBuildingId: buildingId });
      const updated = assertSavedSelection(
        await repository.editBuilding({
          actorUserId,
          campId,
          buildingId,
          name: buildingName,
          type: buildingType,
        }),
        'ACCOMMODATION_BUILDING_SAVE_CONFLICT',
        'The building could not be updated because it changed or was removed. Refresh and try again.',
      );
      emitAccommodationChanged(campId);

      return success({ message: 'Building updated successfully.', building: updated });
    },

    async deleteBuilding({ actorUserId, campId, buildingId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.deleteBuilding,
        "You don't have permission to remove buildings.",
      );

      const building = await repository.findBuildingById({ buildingId, campId });
      if (!building) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_BUILDING_NOT_FOUND',
          message: 'The building was not found in the selected camp.',
        });
      }
      if (building.roomCount > 0) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_BUILDING_HAS_ROOMS',
          message: 'Remove or move all rooms before deleting this building.',
        });
      }

      const deleted = await repository.deleteBuilding({ actorUserId, campId, buildingId });
      if (!deleted) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_BUILDING_DELETE_BLOCKED',
          message: 'The building could not be removed while rooms are mapped to it.',
        });
      }
      emitAccommodationChanged(campId);

      return success({ message: 'Building removed successfully.', building: deleted });
    },

    async addRoom({ actorUserId, campId, name, buildingId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.addRoom,
        "You don't have permission to add rooms.",
      );

      const building = await repository.findBuildingById({ buildingId, campId });
      if (!building) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_BUILDING_NOT_FOUND',
          message: 'Choose an existing building before saving the room.',
        });
      }

      const roomName = normalizeName(name);
      await assertUniqueRoomName({ campId, name: roomName });
      const room = assertSavedSelection(
        await repository.addRoom({ actorUserId, campId, name: roomName, buildingId }),
        'ACCOMMODATION_ROOM_SAVE_CONFLICT',
        'The room could not be saved because the selected building changed. Refresh and try again.',
      );
      emitAccommodationChanged(campId);

      return success({ message: 'Room added successfully.', room });
    },

    async editRoom({ actorUserId, campId, roomId, name, buildingId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.editRoom,
        "You don't have permission to edit rooms.",
      );

      const [room, building] = await Promise.all([
        repository.findRoomById({ roomId, campId }),
        repository.findBuildingById({ buildingId, campId }),
      ]);
      if (!room) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_ROOM_NOT_FOUND',
          message: 'The room was not found in the selected camp.',
        });
      }
      if (!building) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_BUILDING_NOT_FOUND',
          message: 'Choose an existing building before saving the room.',
        });
      }

      const roomName = normalizeName(name);
      await assertUniqueRoomName({ campId, name: roomName, currentRoomId: roomId });
      const updated = assertSavedSelection(
        await repository.editRoom({
          actorUserId,
          campId,
          roomId,
          name: roomName,
          buildingId,
        }),
        'ACCOMMODATION_ROOM_SAVE_CONFLICT',
        'The room could not be updated because the selected room or building changed. Refresh and try again.',
      );
      emitAccommodationChanged(campId);

      return success({ message: 'Room updated successfully.', room: updated });
    },

    async deleteRoom({ actorUserId, campId, roomId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.deleteRoom,
        "You don't have permission to remove rooms.",
      );

      const room = await repository.findRoomById({ roomId, campId });
      if (!room) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_ROOM_NOT_FOUND',
          message: 'The room was not found in the selected camp.',
        });
      }
      if (room.keyCount > 0) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_ROOM_HAS_KEYS',
          message: 'Remove or move all keys before deleting this room.',
        });
      }

      const deleted = await repository.deleteRoom({ actorUserId, campId, roomId });
      if (!deleted) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_ROOM_DELETE_BLOCKED',
          message: 'The room could not be removed while keys are mapped to it.',
        });
      }
      emitAccommodationChanged(campId);

      return success({ message: 'Room removed successfully.', room: deleted });
    },

    async addKey({ actorUserId, campId, name, nfcCode, roomId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.addKey,
        "You don't have permission to add keys.",
      );

      const room = await repository.findRoomById({ roomId, campId });
      if (!room) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_ROOM_NOT_FOUND',
          message: 'Choose an existing room before saving the key.',
        });
      }

      const keyName = normalizeName(name);
      const keyNfcCode = normalizeNfcCode(nfcCode);
      validateName(keyName, 'Key Name', 128);
      validateNfcCode(keyNfcCode);
      await assertUniqueKeyFields({ campId, name: keyName, nfcCode: keyNfcCode });
      const key = assertSavedSelection(
        await repository.addKey({
          actorUserId,
          campId,
          name: keyName,
          nfcCode: keyNfcCode,
          roomId,
        }),
        'ACCOMMODATION_KEY_SAVE_CONFLICT',
        'The key could not be saved because the selected room changed. Refresh and try again.',
      );
      emitAccommodationChanged(campId);

      return success({ message: 'Key added successfully.', key });
    },

    async editKey({ actorUserId, campId, keyId, name, nfcCode, roomId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.editKey,
        "You don't have permission to edit keys.",
      );

      const [key, room] = await Promise.all([
        repository.findKeyById({ keyId, campId }),
        repository.findRoomById({ roomId, campId }),
      ]);
      if (!key) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_KEY_NOT_FOUND',
          message: 'The key was not found in the selected camp.',
        });
      }
      if (!room) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_ROOM_NOT_FOUND',
          message: 'Choose an existing room before saving the key.',
        });
      }

      const keyName = normalizeName(name);
      const keyNfcCode = normalizeNfcCode(nfcCode);
      validateName(keyName, 'Key Name', 128);
      validateNfcCode(keyNfcCode);
      await assertUniqueKeyFields({
        campId,
        name: keyName,
        nfcCode: keyNfcCode,
        currentKeyId: keyId,
      });
      const updated = assertSavedSelection(
        await repository.editKey({
          actorUserId,
          campId,
          keyId,
          name: keyName,
          nfcCode: keyNfcCode,
          roomId,
        }),
        'ACCOMMODATION_KEY_SAVE_CONFLICT',
        'The key could not be updated because the selected key or room changed. Refresh and try again.',
      );
      emitAccommodationChanged(campId);

      return success({ message: 'Key updated successfully.', key: updated });
    },

    async deleteKey({ actorUserId, campId, keyId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.deleteKey,
        "You don't have permission to remove keys.",
      );

      const key = await repository.findKeyById({ keyId, campId });
      if (!key) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_KEY_NOT_FOUND',
          message: 'The key was not found in the selected camp.',
        });
      }
      if (key.soldierId) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_KEY_OCCUPIED',
          message: 'Release the assigned soldier before deleting this key.',
        });
      }

      const deleted = await repository.deleteKey({ actorUserId, campId, keyId });
      if (!deleted) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_KEY_DELETE_BLOCKED',
          message: 'The key could not be removed while it is occupied.',
        });
      }
      emitAccommodationChanged(campId);

      return success({ message: 'Key removed successfully.', key: deleted });
    },

    async issueKeyToSoldier({ actorUserId, campId, keyId, soldierId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to issue keys.",
      );

      const [key, soldier] = await Promise.all([
        repository.findKeyById({ keyId, campId }),
        repository.findSoldierById({ soldierId, campId }),
      ]);
      if (!key) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_KEY_NOT_FOUND',
          message: 'Choose an existing key before issuing it.',
        });
      }
      if (!soldier) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_SOLDIER_NOT_FOUND',
          message: 'Choose an existing soldier before issuing the key.',
        });
      }
      if (key.soldierId) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_KEY_OCCUPIED',
          message: 'Release the key from its current soldier before issuing it.',
        });
      }

      const assignment = assertSavedSelection(
        await repository.issueKeyToSoldier({ actorUserId, campId, keyId, soldierId }),
        'ACCOMMODATION_KEY_ISSUE_CONFLICT',
        'The key could not be issued because the selected key or soldier changed. Refresh and try again.',
      );
      emitSoldierChanged(campId, { action: 'key-issued', soldierId, keyId });

      return success({ message: 'Key issued successfully.', assignment });
    },

    async releaseKeyFromSoldier({ actorUserId, campId, keyId }) {
      assertCampSelected(campId);
      await assertAccommodationPermission(
        actorUserId,
        ACCOMMODATION_PERMISSIONS.manageAccommodation,
        "You don't have permission to release keys.",
      );

      const key = await repository.findKeyById({ keyId, campId });
      if (!key) {
        throw new AppError({
          status: 404,
          code: 'ACCOMMODATION_KEY_NOT_FOUND',
          message: 'Choose an existing key before releasing it.',
        });
      }
      if (!key.soldierId) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_KEY_NOT_ISSUED',
          message: 'The key is not currently issued to a soldier.',
        });
      }
      const holder = await repository.findSoldierById({ soldierId: key.soldierId, campId });
      if (holder && String(holder.usedKey || holder.keyId || '') === String(keyId)) {
        throw new AppError({
          status: 409,
          code: 'ACCOMMODATION_KEY_IS_ACTIVE_ACCOMMODATION',
          message: 'Use discharge or move to release an active accommodation key.',
        });
      }

      const release = assertSavedSelection(
        await repository.releaseKeyFromSoldier({ actorUserId, campId, keyId }),
        'ACCOMMODATION_KEY_RELEASE_CONFLICT',
        'The key could not be released because its assignment changed. Refresh and try again.',
      );
      emitSoldierChanged(campId, {
        action: 'key-released',
        soldierId: release?.soldierId,
        keyId,
      });

      return success({ message: 'Key released successfully.', release });
    },

    importAdditionalItems,
    importBuildings,
    importKeys,
    importRooms,
    importSoldiers,
    getUpcomingSummary,
  };
}

module.exports = { createAccommodationService };
