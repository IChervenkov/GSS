// @ts-nocheck
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const ExcelJS = require('exceljs');
const { AppError } = require('../../../../../shared/errors/app-error');
const { invalid, success } = require('../../../../../shared/application/action-result');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');
const { buildHorizontalNavItems } = require('../../../../../shared/public/js/ui/navigation');
const { formatUtcDateTimeDisplay } = require('../../../../../shared/datetime/display-date-time');
const { LAUNDRY_PAGE } = require('../../domain/laundry.page');
const { LAUNDRY_PERMISSIONS } = require('../../domain/laundry.permissions');

const LAUNDRY_STATUSES = Object.freeze([
  'in_soldier',
  'drop_off',
  'laundry_facility',
  'ready_to_pick_up',
  'pick_up',
]);
const STORED_LAUNDRY_STATUSES = Object.freeze([
  'drop_off',
  'laundry_facility',
  'ready_to_pick_up',
  'pick_up',
]);
const ACTIVE_STATUSES = Object.freeze(['drop_off', 'laundry_facility', 'ready_to_pick_up']);
const OVERDUE_STATUS = 'overdue';
const OVERDUE_AFTER_DAYS = 7;
const OVERDUE_AFTER_MS = OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000;
const emittedOverdueNotificationKeys = new Set();
const STATUS_LABELS = Object.freeze({
  in_soldier: 'In soldier',
  drop_off: 'Drop-off',
  laundry_facility: 'Laundry facility',
  ready_to_pick_up: 'Ready to pick up',
  pick_up: 'Available',
  overdue: 'Overdue',
});
const STATUS_ALIASES = Object.freeze({
  available: 'pick_up',
  none: 'pick_up',
  pick_up: 'pick_up',
  picked_up: 'pick_up',
  in_soldier: 'in_soldier',
  drop_off: 'drop_off',
  laundry_facility: 'laundry_facility',
  transportation_to_laundry_facility: 'laundry_facility',
  ready_to_pick_up: 'ready_to_pick_up',
  transportation_to_pick_up: 'ready_to_pick_up',
});
const LAUNDRY_STATUS_TRANSITIONS = Object.freeze({
  in_soldier: ['drop_off', 'laundry_facility'],
  drop_off: ['laundry_facility', 'ready_to_pick_up'],
  laundry_facility: ['drop_off', 'ready_to_pick_up'],
  ready_to_pick_up: ['in_soldier'],
});
const BAG_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.:/-]+$/u;
const RFID_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const BAG_TYPE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAG_TEMPLATE_HEADERS = Object.freeze([
  'identifier',
  'bag code',
  'rfid code',
  'bag type',
  'max laundry count',
]);
const BAG_TEMPLATE_HEADER_ALIASES = Object.freeze([
  ['bag id'],
  ['code'],
  ['rfid', 'rfid tag', 'rfid identifier'],
  ['type'],
  ['max count', 'max count laundry'],
]);
const BAG_TEMPLATE_FILENAME = 'laundry-bag-template.xlsx';
const LAUNDRY_REPORT_FILENAME = 'laundry-report.xlsx';
const DEFAULT_LAUNDRY_APP_FILE_PATH = 'androidApp/gss-laundry-1.4.2-release.apk';
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_REPORT_FIELD_MESSAGE = 'No information';

async function loadLaundryMobileAppFile({ env }) {
  const configuredPath =
    String(env?.APP_LAUNDRY_FILE_PATH || '').trim() || DEFAULT_LAUNDRY_APP_FILE_PATH;
  const resolvedPath = path.resolve(process.cwd(), configuredPath);
  const fileName = path.basename(resolvedPath);

  let buffer;
  try {
    buffer = await fs.readFile(resolvedPath);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') {
      throw new AppError({
        status: 404,
        code: 'LAUNDRY_MOBILE_APP_NOT_FOUND',
        message: 'The laundry mobile application package is not available.',
      });
    }
    throw error;
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hash !== env?.HASH_APP_LAUNDRY) {
    throw new AppError({
      status: 409,
      code: 'LAUNDRY_MOBILE_APP_HASH_MISMATCH',
      message: 'The laundry mobile application package failed integrity verification.',
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

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseReportDate(value, fieldName) {
  const text = String(value || '').trim();
  if (!REPORT_DATE_PATTERN.test(text)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_LAUNDRY_REPORT_DATE',
      message: `${fieldName} must use YYYY-MM-DD format.`,
    });
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new AppError({
      status: 400,
      code: 'INVALID_LAUNDRY_REPORT_DATE',
      message: `${fieldName} must be a valid calendar date.`,
    });
  }

  return { label: text, date };
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildReportInterval({ fromDate, toDate }) {
  const from = parseReportDate(fromDate, 'From date');
  const to = parseReportDate(toDate, 'To date');

  if (from.date.getTime() > to.date.getTime()) {
    throw new AppError({
      status: 400,
      code: 'INVALID_LAUNDRY_REPORT_RANGE',
      message: 'From date cannot be after To date.',
    });
  }

  return {
    fromDate: from.label,
    toDate: to.label,
    from: from.date,
    to: addUtcDays(to.date, 1),
  };
}

function listDateKeysInclusive(fromDate, toDate) {
  const keys = [];
  let cursor = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor = addUtcDays(cursor, 1);
  }

  return keys;
}

function toIsoStringOrNull(value) {
  const date = value instanceof Date ? value : new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function formatReportDateTime(value) {
  return formatUtcDateTimeDisplay(value);
}

function reportCellValue(value) {
  return value === undefined || value === null || value === '' ? EMPTY_REPORT_FIELD_MESSAGE : value;
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function readCellText(cell) {
  if (!cell) return '';
  if (cell.value instanceof Date) return cell.value.toISOString();
  return String(cell.text || cell.value || '').trim();
}

function normalizePositiveInteger(value, fallback, { min = 1, max = 100000 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeSortDirection(value) {
  return ['asc', 'desc'].includes(String(value || '').trim()) ? String(value).trim() : 'default';
}

function canonicalStatus(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return STATUS_ALIASES[key] || null;
}

function normalizeStatus(value) {
  const status = canonicalStatus(value) || 'pick_up';
  return LAUNDRY_STATUSES.includes(status) ? status : 'pick_up';
}

function isLaundryStatus(value) {
  const status = canonicalStatus(value);
  return LAUNDRY_STATUSES.includes(status);
}

function normalizeStoredStatus(value) {
  const status = canonicalStatus(value) || 'pick_up';
  return STORED_LAUNDRY_STATUSES.includes(status) ? status : 'pick_up';
}

function effectiveBagStatus(row = {}) {
  const storedStatus = normalizeStoredStatus(row.status);
  if (!row.soldierId) return 'pick_up';
  return storedStatus === 'pick_up' ? 'in_soldier' : storedStatus;
}

function formatStatus(status) {
  if (String(status || '').trim().toLowerCase() === OVERDUE_STATUS) return STATUS_LABELS.overdue;
  return STATUS_LABELS[normalizeStatus(status)] || 'Available';
}

function isBagOverdue(row = {}, now = new Date()) {
  if (!ACTIVE_STATUSES.includes(row.status)) return false;
  const dropOffDate = row.dateDropOff instanceof Date ? row.dateDropOff : new Date(row.dateDropOff);
  if (!row.dateDropOff || !Number.isFinite(dropOffDate.getTime())) return false;
  return now.getTime() - dropOffDate.getTime() > OVERDUE_AFTER_MS;
}

function applyOverdueDisplayStatus(row = {}, now = new Date()) {
  const overdue = isBagOverdue(row, now);
  return {
    ...row,
    statusLabel: overdue ? STATUS_LABELS.overdue : row.statusLabel,
    displayStatus: overdue ? OVERDUE_STATUS : row.displayStatus || row.status,
    isOverdue: overdue,
    overdueSince: overdue ? row.dateDropOff : null,
  };
}

function buildOverdueNotification(row = {}) {
  return {
    type: 'laundry_overdue',
    bagId: row.id,
    identifier: row.id,
    bagCode: row.code || 'Laundry bag',
    status: OVERDUE_STATUS,
    statusLabel: STATUS_LABELS.overdue,
    previousStatus: row.status,
    previousStatusLabel: formatStatus(row.status),
    soldierId: row.soldierId || null,
    soldierName: row.soldierName || null,
    campId: row.campId || null,
    dateDropOff: toIsoStringOrNull(row.dateDropOff),
    overdueSince: toIsoStringOrNull(row.overdueSince || row.dateDropOff),
    message: `${row.code || 'Laundry bag'} is overdue${row.soldierName ? ` for ${row.soldierName}` : ''}.`,
  };
}

function overdueNotificationKey(row = {}) {
  const identity = String(row.id || row.code || '').trim();
  const dropOff = toIsoStringOrNull(row.dateDropOff) || '';
  return `${identity}|${dropOff}`;
}

function takeNewOverdueNotifications(rows = []) {
  const notifications = [];
  rows.forEach((row) => {
    if (!row?.isOverdue) return;
    const key = overdueNotificationKey(row);
    if (!key.trim()) return;
    if (emittedOverdueNotificationKeys.has(key)) return;
    emittedOverdueNotificationKeys.add(key);
    notifications.push(buildOverdueNotification(row));
  });

  return notifications;
}

function formatStatusList(statuses = []) {
  return statuses.map(formatStatus).join(', ');
}

function assertStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    throw new AppError({
      status: 409,
      code: 'LAUNDRY_STATUS_ALREADY_SET',
      message: `This bag is already set to ${formatStatus(currentStatus)}.`,
    });
  }

  const allowedStatuses = LAUNDRY_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedStatuses.includes(nextStatus)) {
    throw new AppError({
      status: 409,
      code: 'LAUNDRY_STATUS_TRANSITION_BLOCKED',
      message: allowedStatuses.length
        ? `Bags in ${formatStatus(currentStatus)} can only be moved to ${formatStatusList(
            allowedStatuses,
          )}.`
        : `Bags in ${formatStatus(currentStatus)} cannot be moved to ${formatStatus(nextStatus)}.`,
    });
  }
}

function assertCampSelected(campId) {
  if (!campId) {
    throw new AppError({
      status: 400,
      code: 'CAMP_REQUIRED',
      message: 'Select an active camp before managing laundry bags.',
    });
  }
}

function assertSavedSelection(result, code, message) {
  if (result) return result;

  throw new AppError({
    status: 409,
    code,
    message,
  });
}

function validateBagCode(code) {
  if (!code || code.length < 2 || code.length > 64 || !BAG_CODE_PATTERN.test(code)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_LAUNDRY_BAG_CODE',
      message: 'Bag code must be 2-64 characters and contain only supported characters.',
    });
  }
}

function validateBagType(type) {
  if (type && (type.length > 64 || !BAG_TYPE_PATTERN.test(type))) {
    throw new AppError({
      status: 400,
      code: 'INVALID_LAUNDRY_BAG_TYPE',
      message: 'Bag type must be 64 characters or fewer and contain supported characters.',
    });
  }
}

function validateRfidCode(rfidCode) {
  if (
    !rfidCode ||
    rfidCode.length < 2 ||
    rfidCode.length > 128 ||
    !RFID_CODE_PATTERN.test(rfidCode)
  ) {
    throw new AppError({
      status: 400,
      code: 'INVALID_LAUNDRY_BAG_RFID_CODE',
      message:
        'RFID code must be 2-128 characters and contain only letters, numbers, _, :, . or -.',
    });
  }
}

function normalizeBagInput({ code, rfidCode, type, status, maxCountLaundry }) {
  const normalizedCode = normalizeText(code);
  const normalizedRfidCode = normalizeText(rfidCode);
  const normalizedType = normalizeText(type);
  validateBagCode(normalizedCode);
  validateRfidCode(normalizedRfidCode);
  validateBagType(normalizedType);

  return {
    code: normalizedCode,
    rfidCode: normalizedRfidCode,
    type: normalizedType || null,
    status: normalizeStatus(status),
    maxCountLaundry: normalizePositiveInteger(maxCountLaundry, 1, { min: 1, max: 100000 }),
  };
}

function normalizeTableState(rawState = {}, { filterColumns = [], sortColumns = [] } = {}) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const sourceFilters = source.filters && typeof source.filters === 'object' ? source.filters : {};
  const filters = {};

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

function getBagColumnValue(row, column) {
  if (column === 'status') return row.statusLabel || formatStatus(row.status);
  if (column === 'soldierName') return row.soldierName || 'Unassigned';
  if (column === 'type') return row.type || 'Unspecified';
  if (column === 'rfidCode') return row.rfidCode || '';
  if (column === 'createdAt') return row.createdAt ? formatReportDateTime(row.createdAt) : '';
  if (column === 'updatedAt') return row.updatedAt ? formatReportDateTime(row.updatedAt) : '';
  return row[column] || '';
}

function getBagSortValue(row, column) {
  if (column === 'status') return row.statusLabel || formatStatus(row.status);
  if (column === 'soldierName') return row.soldierName || 'Unassigned';
  if (column === 'type') return row.type || 'Unspecified';
  if (column === 'rfidCode') return row.rfidCode || '';
  if (column === 'laundryCount') return Number(row.laundryCount) || 0;
  if (column === 'maxCountLaundry') return Number(row.maxCountLaundry) || 0;
  if (column === 'createdAt') {
    const value = row.createdAt ? new Date(row.createdAt).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
  }
  if (column === 'updatedAt') {
    const value = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
  }
  return row[column] || '';
}

function compareValues(left, right) {
  const leftNumber = typeof left === 'number' ? left : Number.NaN;
  const rightNumber = typeof right === 'number' ? right : Number.NaN;
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    if (leftNumber === rightNumber) return 0;
    return leftNumber > rightNumber ? 1 : -1;
  }

  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function applyServerTableState(rows = [], rawState = {}, config = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const state = normalizeTableState(rawState, config);
  const getColumnValue = config.getColumnValue || ((row, column) => row?.[column] ?? '');
  const getSortValue = config.getSortValue || getColumnValue;
  const filteredRows = sourceRows.filter((row) =>
    Object.entries(state.filters).every(([column, search]) =>
      String(getColumnValue(row, column) ?? '')
        .toLowerCase()
        .includes(String(search).toLowerCase()),
    ),
  );
  const sortedRows =
    state.sortColumn && state.sortDirection !== 'default'
      ? [...filteredRows].sort(
          (left, right) =>
            compareValues(
              getSortValue(left, state.sortColumn),
              getSortValue(right, state.sortColumn),
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

function buildTypeBreakdown(rows = []) {
  const counts = new Map();
  rows.forEach((row) => {
    const type = row.type || 'Unspecified';
    counts.set(type, (counts.get(type) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) =>
      String(left.type).localeCompare(String(right.type), undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );
}

function normalizeLaundryReportRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const dateDropOff = toIsoStringOrNull(row.dateDropOff);
    const dateReadyToPickUp = toIsoStringOrNull(row.dateReadyToPickUp);
    const isLinenExchange =
      Boolean(row.isLinenExchange) ||
      (dateDropOff && dateReadyToPickUp && dateDropOff === dateReadyToPickUp);
    const status = dateReadyToPickUp ? 'washed' : 'being_washed';

    return {
      id: row.id,
      bagId: row.bagId || null,
      bagCode: row.bagCode || null,
      rfidCode: row.rfidCode || null,
      type: row.type || null,
      soldierId: row.soldierId || null,
      soldierName: row.soldierName || null,
      soldierCountry: row.soldierCountry || null,
      soldierMealCard: row.soldierMealCard || null,
      dateDropOff,
      dateReadyToPickUp,
      reportDate: row.reportDate || dateDropOff?.slice(0, 10) || null,
      status,
      statusLabel: status === 'washed' ? 'Washed' : 'Being washed',
      flowType: isLinenExchange ? 'Linen exchange' : 'Laundry wash',
      isLinenExchange,
    };
  });
}

function buildDailyLaundryTotals({ interval, rows }) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = row.reportDate;
    if (!key) return;
    const current = counts.get(key) || {
      date: key,
      totalCount: 0,
      beingWashedCount: 0,
      washedCount: 0,
      linenExchangeCount: 0,
    };
    current.totalCount += 1;
    if (row.status === 'washed') current.washedCount += 1;
    else current.beingWashedCount += 1;
    if (row.isLinenExchange) current.linenExchangeCount += 1;
    counts.set(key, current);
  });

  return listDateKeysInclusive(interval.fromDate, interval.toDate).map((date) => ({
    date,
    totalCount: counts.get(date)?.totalCount || 0,
    beingWashedCount: counts.get(date)?.beingWashedCount || 0,
    washedCount: counts.get(date)?.washedCount || 0,
    linenExchangeCount: counts.get(date)?.linenExchangeCount || 0,
  }));
}

function buildCountryLaundryTotals(rows = []) {
  const counts = new Map();
  rows.forEach((row) => {
    const country = row.soldierCountry || 'Unknown';
    const current = counts.get(country) || {
      country,
      totalCount: 0,
      beingWashedCount: 0,
      washableCount: 0,
      linenExchangeCount: 0,
    };
    current.totalCount += 1;
    if (row.status === 'being_washed') current.beingWashedCount += 1;
    else if (row.isLinenExchange) current.linenExchangeCount += 1;
    else current.washableCount += 1;
    counts.set(country, current);
  });

  return Array.from(counts.values()).sort((left, right) =>
    String(left.country).localeCompare(String(right.country), undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}

function getLaundryReportColumnValue(row, column) {
  if (column === 'dateDropOff') return row.dateDropOff ? formatReportDateTime(row.dateDropOff) : '';
  if (column === 'dateReadyToPickUp') {
    return row.dateReadyToPickUp ? formatReportDateTime(row.dateReadyToPickUp) : 'Active';
  }
  if (column === 'status') return row.statusLabel || '';
  if (column === 'flowType') return row.flowType || '';
  if (column === 'bagCode') return row.bagCode || 'Unknown';
  if (column === 'type') return row.type || 'Unspecified';
  if (column === 'soldierName') return row.soldierName || 'Unassigned';
  if (column === 'soldierCountry') return row.soldierCountry || 'Unknown';
  return row[column] || '';
}

function createEmptyOverview() {
  return {
    total: 0,
    pickUp: 0,
    inSoldier: 0,
    dropOff: 0,
    laundryFacility: 0,
    readyToPickUp: 0,
    active: 0,
    rows: [],
    availableRows: [],
    statusRows: {
      drop_off: [],
      laundry_facility: [],
      ready_to_pick_up: [],
    },
    statusTypeBreakdown: {
      drop_off: [],
      laundry_facility: [],
      ready_to_pick_up: [],
    },
    tables: {},
    lookups: {
      rows: [],
    },
    notifications: [],
  };
}

function normalizeBagRow(row) {
  const status = effectiveBagStatus(row);
  return {
    id: row.id,
    code: row.code,
    rfidCode: row.rfidCode || null,
    type: row.type || null,
    status,
    statusLabel: formatStatus(status),
    displayStatus: status,
    dateDropOff: row.dateDropOff || null,
    isOverdue: false,
    overdueSince: null,
    laundryCount: Number(row.laundryCount) || 0,
    maxCountLaundry: Number(row.maxCountLaundry) || 1,
    soldierId: row.soldierId || null,
    soldierName: row.soldierName || null,
    hasLaundryReportHistory: Boolean(row.hasLaundryReportHistory),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function parseBulkRows(payload) {
  const text = String(payload || '').trim();
  if (!text) {
    throw new AppError({
      status: 400,
      code: 'EMPTY_LAUNDRY_BULK_UPDATE',
      message: 'Paste at least one bag row before running a bulk update.',
    });
  }

  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), rowNumber: index + 1 }))
    .filter((row) => row.line && !row.line.startsWith('#'))
    .map(({ line, rowNumber }) => {
      const parts = line.split(',').map((part) => part.trim());
      if (parts.length < 3 || parts.length > 5) {
        throw new AppError({
          status: 400,
          code: 'INVALID_LAUNDRY_BULK_ROW',
          message: `Row ${rowNumber} must use identifier, code, RFID code, type, max count.`,
        });
      }

      const [id, code, rfidCode, type, maxCountLaundry] = parts;
      if (id && !UUID_PATTERN.test(id)) {
        throw new AppError({
          status: 400,
          code: 'INVALID_LAUNDRY_BULK_IDENTIFIER',
          message: `Row ${rowNumber} has an invalid identifier.`,
        });
      }

      const normalized = normalizeBagInput({
        code,
        rfidCode,
        type,
        maxCountLaundry: maxCountLaundry || 1,
        status: 'pick_up',
      });

      return {
        rowNumber,
        id: id || null,
        ...normalized,
      };
    });
}

function validateTemplateHeaders(headerRow, expectedHeaders, headerAliases = []) {
  expectedHeaders.forEach((header, index) => {
    const actual = normalizeHeader(readCellText(headerRow.getCell(index + 1)));
    const allowed = [header, ...(Array.isArray(headerAliases[index]) ? headerAliases[index] : [])];
    if (!allowed.includes(actual)) {
      throw new AppError({
        status: 400,
        code: 'INVALID_LAUNDRY_TEMPLATE_HEADERS',
        message:
          'The laundry bag template headers are invalid. Download a fresh template and try again.',
      });
    }
  });
}

async function readBagTemplateRows(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError({
      status: 400,
      code: 'INVALID_LAUNDRY_TEMPLATE_FILE',
      message: 'The uploaded file must be a valid .xlsx laundry bag template.',
    });
  }

  const worksheet =
    workbook.getWorksheet('Laundry Bags') ||
    workbook.worksheets.find((sheet) => normalizeHeader(sheet.name) !== 'instructions') ||
    workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError({
      status: 400,
      code: 'LAUNDRY_TEMPLATE_WORKSHEET_MISSING',
      message: 'The uploaded template does not contain a Laundry Bags worksheet.',
    });
  }

  validateTemplateHeaders(worksheet.getRow(1), BAG_TEMPLATE_HEADERS, BAG_TEMPLATE_HEADER_ALIASES);

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const identifier = readCellText(row.getCell(1));
    const code = readCellText(row.getCell(2));
    const rfidCode = readCellText(row.getCell(3));
    const type = readCellText(row.getCell(4));
    const maxCountLaundry = readCellText(row.getCell(5));

    if (![identifier, code, rfidCode, type, maxCountLaundry].some(Boolean)) return;

    rows.push({
      rowNumber,
      id: identifier || null,
      code,
      rfidCode,
      type,
      maxCountLaundry: maxCountLaundry || 1,
      status: 'pick_up',
    });
  });

  return rows;
}

async function applyBulkRows({
  repository,
  actorUserId,
  campId,
  rows,
  permissions,
  assertUniqueBagFields,
}) {
  const seenCodes = new Set();
  const seenRfidCodes = new Set();
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
          code: 'INVALID_LAUNDRY_TEMPLATE_IDENTIFIER',
          message: 'Identifier must be a valid UUID.',
        });
      }

      if (id) {
        if (!permissions?.canEdit) {
          throw new AppError({
            status: 403,
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to edit laundry bags.',
          });
        }
        if (seenIds.has(id)) {
          throw new AppError({
            status: 400,
            code: 'DUPLICATE_LAUNDRY_BULK_ID',
            message: `Identifier ${id} is duplicated in the uploaded file.`,
          });
        }
        seenIds.add(id);
      } else if (!permissions?.canAdd) {
        throw new AppError({
          status: 403,
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to add laundry bags.',
        });
      }

      const normalized = normalizeBagInput({
        code: row.code,
        rfidCode: row.rfidCode,
        type: row.type,
        maxCountLaundry: row.maxCountLaundry || 1,
        status: 'pick_up',
      });

      const codeKey = normalized.code.toLowerCase();
      if (seenCodes.has(codeKey)) {
        throw new AppError({
          status: 400,
          code: 'DUPLICATE_LAUNDRY_BULK_CODE',
          message: `Bag code "${normalized.code}" appears more than once in the uploaded file.`,
        });
      }

      const rfidCodeKey = normalized.rfidCode.toLowerCase();
      if (seenRfidCodes.has(rfidCodeKey)) {
        throw new AppError({
          status: 400,
          code: 'DUPLICATE_LAUNDRY_BULK_RFID_CODE',
          message: `RFID code "${normalized.rfidCode}" appears more than once in the uploaded file.`,
        });
      }

      await assertUniqueBagFields({
        campId,
        code: normalized.code,
        rfidCode: normalized.rfidCode,
        currentBagId: id,
      });

      seenCodes.add(codeKey);
      seenRfidCodes.add(rfidCodeKey);
      validRows.push({ rowNumber: row.rowNumber, id: id || null, ...normalized });
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        status: error?.status || 400,
        code: error?.code || 'LAUNDRY_BULK_ROW_INVALID',
        message: error?.message || 'The laundry bag row could not be processed.',
      });
    }
    /* eslint-enable no-await-in-loop */
  }

  if (!validRows.length) {
    return summarizeLaundryImportRows({
      totalRows: rows.length,
      rows: validRows,
      results: [],
      errors,
    });
  }

  const results = await repository.bulkUpsertBags({ actorUserId, campId, rows: validRows });

  return summarizeLaundryImportRows({ totalRows: rows.length, rows: validRows, results, errors });
}

function summarizeLaundryImportRows({ totalRows, rows, results = [], errors = [] }) {
  const addedCount = results.filter((result) => result.action === 'added').length;
  const updatedCount = results.filter((result) => result.action === 'updated').length;
  const missingCount = results.filter((result) => result.action === 'missing').length;
  const errorCount = errors.length;
  const hasFailures = missingCount > 0 || errorCount > 0;
  const messageParts = [`${addedCount} added`, `${updatedCount} updated`, `${missingCount} missing`];
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
      bag: result.bag ? normalizeBagRow(result.bag) : null,
    })),
  });
}

function createLaundryPageService({ repository, realtime, auditLog, env } = {}) {
  async function assertLaundryPermission(actorUserId, permissionName, deniedMessage) {
    const [hasFullPermission, hasSpecificPermission] = await Promise.all([
      repository.userHasPermission(actorUserId, LAUNDRY_PERMISSIONS.full),
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

  async function assertAnyLaundryPermission(actorUserId, permissionNames, deniedMessage) {
    const names = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
    const results = await Promise.all(
      [LAUNDRY_PERMISSIONS.full, ...names].map((permissionName) =>
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

  async function canAddOrEdit(actorUserId) {
    const [full, add, edit] = await Promise.all([
      repository.userHasPermission(actorUserId, LAUNDRY_PERMISSIONS.full),
      repository.userHasPermission(actorUserId, LAUNDRY_PERMISSIONS.addBag),
      repository.userHasPermission(actorUserId, LAUNDRY_PERMISSIONS.editBag),
    ]);
    return { canAdd: full || add, canEdit: full || edit };
  }

  async function getLaundryView({ userId, campId, csrfToken }) {
    const permissions = userId ? await repository.listUserPermissions({ userId }) : [];
    const permissionNames = new Set(
      (Array.isArray(permissions) ? permissions : [])
        .map((permission) => String(permission?.name || '').trim())
        .filter(Boolean),
    );
    const canDownloadLaundryMobileApp =
      permissionNames.has(LAUNDRY_PERMISSIONS.full) ||
      permissionNames.has(LAUNDRY_PERMISSIONS.downloadLaundryApp);

    return {
      ...LAUNDRY_PAGE,
      campId,
      csrfToken,
      horizontalNavItems: buildHorizontalNavItems(permissions, false),
      canDownloadLaundryMobileApp,
      laundryMobileAppDownloadUrl: '/web/laundry/mobile-app',
    };
  }

  async function getLaundryOverview({ campId, tableState = {} }) {
    if (!campId) return success(createEmptyOverview());

    const now = new Date();
    const rows = (await repository.listBagsByCamp({ campId }))
      .map(normalizeBagRow)
      .map((row) => applyOverdueDisplayStatus(row, now));
    const overview = createEmptyOverview();
    overview.total = rows.length;

    for (const row of rows) {
      if (row.status === 'in_soldier') overview.inSoldier += 1;
      else if (row.status === 'drop_off') overview.dropOff += 1;
      else if (row.status === 'laundry_facility') overview.laundryFacility += 1;
      else if (row.status === 'ready_to_pick_up') overview.readyToPickUp += 1;
      else overview.pickUp += 1;
    }
    overview.active = overview.dropOff + overview.laundryFacility + overview.readyToPickUp;

    const tableColumns = [
      'id',
      'code',
      'rfidCode',
      'type',
      'status',
      'soldierName',
      'createdAt',
      'updatedAt',
      'laundryCount',
      'maxCountLaundry',
    ];
    const stateSource = tableState && typeof tableState === 'object' ? tableState : {};
    const allTable = applyServerTableState(rows, stateSource.all, {
      filterColumns: tableColumns,
      sortColumns: tableColumns,
      getColumnValue: getBagColumnValue,
      getSortValue: getBagSortValue,
    });
    const availableTable = applyServerTableState(
      rows.filter((row) => row.status === 'pick_up'),
      stateSource.available,
      {
        filterColumns: tableColumns,
        sortColumns: tableColumns,
        getColumnValue: getBagColumnValue,
        getSortValue: getBagSortValue,
      },
    );

    overview.rows = allTable.rows;
    overview.availableRows = availableTable.rows;
    overview.tables.all = tableMeta(allTable);
    overview.tables.available = tableMeta(availableTable);

    for (const status of ACTIVE_STATUSES) {
      const statusRows = rows.filter((row) => row.status === status);
      const statusTable = applyServerTableState(statusRows, stateSource[status], {
        filterColumns: tableColumns,
        sortColumns: tableColumns,
        getColumnValue: getBagColumnValue,
        getSortValue: getBagSortValue,
      });
      overview.statusRows[status] = statusTable.rows;
      overview.statusTypeBreakdown[status] = buildTypeBreakdown(statusRows);
      overview.tables[status] = tableMeta(statusTable);
    }

    overview.lookups.rows = rows;
    overview.notifications = takeNewOverdueNotifications(rows);
    overview.notifications.forEach((notification) => {
      realtime?.emitLaundryOverdue?.(notification);
    });
    return success(overview);
  }

  async function listAvailableBags({ campId, search = '', limit = 20 }) {
    assertCampSelected(campId);
    const rows = await repository.listAvailableBags({ campId, search, limit });
    return success({ rows: rows.map(normalizeBagRow) });
  }

  async function assertUniqueBagFields({ campId, code, rfidCode, currentBagId = null }) {
    const [existingCode, existingRfid] = await Promise.all([
      repository.findBagByCode({ campId, code }),
      repository.findBagByRfid({ rfidCode }),
    ]);
    if (existingCode && String(existingCode.id) !== String(currentBagId || '')) {
      throw new AppError({
        status: 409,
        code: 'LAUNDRY_BAG_CODE_EXISTS',
        message: 'A bag with this code already exists in the selected camp.',
      });
    }
    if (existingRfid && String(existingRfid.id) !== String(currentBagId || '')) {
      throw new AppError({
        status: 409,
        code: 'LAUNDRY_BAG_RFID_EXISTS',
        message: 'A bag with this RFID code already exists.',
      });
    }
  }

  async function addBag({ actorUserId, campId, code, rfidCode, type, maxCountLaundry }) {
    assertCampSelected(campId);
    await assertLaundryPermission(
      actorUserId,
      LAUNDRY_PERMISSIONS.addBag,
      "You don't have permission to add laundry bags.",
    );
    const payload = normalizeBagInput({ code, rfidCode, type, status: 'pick_up', maxCountLaundry });
    await assertUniqueBagFields({ campId, code: payload.code, rfidCode: payload.rfidCode });
    const bag = await repository.addBag({ actorUserId, campId, ...payload });
    realtime?.emitLaundryChanged?.(campId);
    return success({ message: 'Laundry bag added successfully.', bag: normalizeBagRow(bag) });
  }

  async function editBag({ actorUserId, campId, bagId, code, rfidCode, type, maxCountLaundry }) {
    assertCampSelected(campId);
    await assertLaundryPermission(
      actorUserId,
      LAUNDRY_PERMISSIONS.editBag,
      "You don't have permission to edit laundry bags.",
    );
    const existing = await repository.findBagById({ bagId, campId });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: 'LAUNDRY_BAG_NOT_FOUND',
        message: 'The laundry bag was not found in the selected camp.',
      });
    }

    const payload = normalizeBagInput({
      code,
      rfidCode,
      type,
      status: existing.status,
      maxCountLaundry,
    });
    await assertUniqueBagFields({
      campId,
      code: payload.code,
      rfidCode: payload.rfidCode,
      currentBagId: bagId,
    });
    const bag = assertSavedSelection(
      await repository.editBag({ actorUserId, campId, bagId, ...payload }),
      'LAUNDRY_BAG_SAVE_CONFLICT',
      'The laundry bag could not be updated because it changed or was removed. Refresh and try again.',
    );
    realtime?.emitLaundryChanged?.(campId);
    return success({ message: 'Laundry bag updated successfully.', bag: normalizeBagRow(bag) });
  }

  async function deleteBag({ actorUserId, campId, bagId }) {
    assertCampSelected(campId);
    await assertLaundryPermission(
      actorUserId,
      LAUNDRY_PERMISSIONS.deleteBag,
      "You don't have permission to remove laundry bags.",
    );
    const bag = await repository.findBagById({ bagId, campId });
    if (!bag) {
      throw new AppError({
        status: 404,
        code: 'LAUNDRY_BAG_NOT_FOUND',
        message: 'The laundry bag was not found in the selected camp.',
      });
    }
    const blockers = repository.getBagDeletionBlockers
      ? await repository.getBagDeletionBlockers({ bagId, campId })
      : {
          hasSoldierAssignment: Boolean(bag.soldierId),
          hasLaundryReportHistory: false,
          hasAdditionalItemReferences: false,
        };

    if (blockers.hasSoldierAssignment || bag.soldierId) {
      throw new AppError({
        status: 409,
        code: 'LAUNDRY_BAG_DELETE_BLOCKED',
        message:
          'This laundry bag is assigned to a soldier and cannot be deleted until it is unassigned.',
      });
    }
    if (blockers.hasAdditionalItemReferences) {
      throw new AppError({
        status: 409,
        code: 'LAUNDRY_BAG_DELETE_BLOCKED',
        message:
          'This laundry bag is linked to accommodation items and cannot be deleted without losing item data.',
      });
    }
    if (normalizeStoredStatus(bag.status) !== 'pick_up') {
      throw new AppError({
        status: 409,
        code: 'LAUNDRY_BAG_DELETE_BLOCKED',
        message: 'This laundry bag must be Available before it can be deleted.',
      });
    }

    const deleted = await repository.deleteBag({ actorUserId, campId, bagId });
    if (!deleted) {
      return invalid({ message: 'The bag could not be removed.' });
    }
    realtime?.emitLaundryChanged?.(campId);
    return success({ message: 'Laundry bag removed successfully.', bag: deleted });
  }

  async function addBagToStatus({ actorUserId, campId, bagId, status }) {
    void actorUserId;
    void bagId;
    void status;
    assertCampSelected(campId);
    throw new AppError({
      status: 409,
      code: 'LAUNDRY_STATUS_MOVE_REQUIRED',
      message: 'Use Move to change the status of a laundry bag.',
    });
  }

  async function moveBag({ actorUserId, campId, bagId, status }) {
    assertCampSelected(campId);
    await assertLaundryPermission(
      actorUserId,
      LAUNDRY_PERMISSIONS.saveBagStatus,
      "You don't have permission to move laundry bags.",
    );
    if (!isLaundryStatus(status)) {
      throw new AppError({
        status: 400,
        code: 'INVALID_LAUNDRY_STATUS',
        message: 'Choose a valid laundry status.',
      });
    }
    const requestedStatus = normalizeStatus(status);
    const bag = await repository.findBagById({ bagId, campId });
    if (!bag) {
      throw new AppError({
        status: 404,
        code: 'LAUNDRY_BAG_NOT_FOUND',
        message: 'The laundry bag was not found in the selected camp.',
      });
    }
    if (!bag.soldierId) {
      throw new AppError({
        status: 409,
        code: 'LAUNDRY_BAG_SOLDIER_REQUIRED',
        message: 'Only bags assigned to a soldier can be moved between laundry statuses.',
      });
    }

    const nextStatus = requestedStatus === 'pick_up' ? 'in_soldier' : requestedStatus;
    const currentStatus = effectiveBagStatus(bag);
    assertStatusTransition(currentStatus, nextStatus);
    const storedStatus = nextStatus === 'in_soldier' ? 'pick_up' : nextStatus;
    const updated = assertSavedSelection(
      await repository.setBagStatus({
        actorUserId,
        campId,
        bagId,
        status: storedStatus,
        expectedStatus: normalizeStoredStatus(bag.status),
      }),
      'LAUNDRY_BAG_STATUS_CONFLICT',
      'The laundry bag status changed before it could be moved. Refresh and try again.',
    );
    realtime?.emitLaundryChanged?.(campId);
    return success({
      message: `Bag moved to ${formatStatus(nextStatus)}.`,
      bag: normalizeBagRow(updated),
    });
  }

  async function recordLinenExchange({ actorUserId, campId, bagId }) {
    assertCampSelected(campId);
    await assertLaundryPermission(
      actorUserId,
      LAUNDRY_PERMISSIONS.saveBagStatus,
      "You don't have permission to record linen exchanges.",
    );
    const bag = await repository.findBagById({ bagId, campId });
    if (!bag) {
      throw new AppError({
        status: 404,
        code: 'LAUNDRY_BAG_NOT_FOUND',
        message: 'The laundry bag was not found in the selected camp.',
      });
    }
    if (!bag.soldierId) {
      throw new AppError({
        status: 409,
        code: 'LAUNDRY_BAG_SOLDIER_REQUIRED',
        message: 'Only bags assigned to a soldier can be used for linen exchange.',
      });
    }
    const updated = assertSavedSelection(
      await repository.recordLinenExchange({ actorUserId, campId, bagId }),
      'LAUNDRY_LINEN_EXCHANGE_CONFLICT',
      'The laundry bag changed before the linen exchange could be recorded. Refresh and try again.',
    );
    realtime?.emitLaundryChanged?.(campId);
    return success({
      message: 'Linen exchange recorded successfully.',
      bag: normalizeBagRow(updated),
    });
  }

  async function removeBagFromStatus({ actorUserId, campId, bagId }) {
    void actorUserId;
    void bagId;
    assertCampSelected(campId);
    throw new AppError({
      status: 409,
      code: 'LAUNDRY_STATUS_MOVE_REQUIRED',
      message: 'Use Move to change the status of a laundry bag.',
    });
  }

  async function bulkUpdateBags({ actorUserId, campId, payload }) {
    assertCampSelected(campId);
    const rows = parseBulkRows(payload);
    const permissions = await canAddOrEdit(actorUserId);
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to bulk update laundry bags.",
      });
    }
    const result = await applyBulkRows({
      repository,
      actorUserId,
      campId,
      rows,
      permissions,
      assertUniqueBagFields,
    });
    const summary = result?.body?.summary || result?.data?.summary || result?.summary;
    if ((Number(summary?.addedCount) || 0) > 0 || (Number(summary?.updatedCount) || 0) > 0) {
      realtime?.emitLaundryChanged?.(campId);
    }
    return result;
  }

  async function loadLaundryReport({ actorUserId, campId, fromDate, toDate, tableState = {} }) {
    assertCampSelected(campId);
    await assertAnyLaundryPermission(
      actorUserId,
      LAUNDRY_PERMISSIONS.section,
      "You don't have permission to view laundry reports.",
    );

    const interval = buildReportInterval({ fromDate, toDate });
    const rows = normalizeLaundryReportRows(
      await repository.listLaundryReport({
        campId,
        from: interval.from,
        to: interval.to,
      }),
    );
    const dailyTotals = buildDailyLaundryTotals({ interval, rows });
    const countryTotals = buildCountryLaundryTotals(rows);
    const stateSource = tableState && typeof tableState === 'object' ? tableState : {};
    const historyColumns = [
      'dateDropOff',
      'dateReadyToPickUp',
      'status',
      'flowType',
      'bagCode',
      'rfidCode',
      'type',
      'soldierName',
      'soldierCountry',
    ];
    const historyTable = applyServerTableState(rows, stateSource.history, {
      filterColumns: historyColumns,
      sortColumns: historyColumns,
      getColumnValue: getLaundryReportColumnValue,
    });
    const dailyTable = applyServerTableState(dailyTotals, stateSource.daily, {
      filterColumns: [],
      sortColumns: [],
      getColumnValue: (row, column) => row[column] ?? '',
    });
    const countryTable = applyServerTableState(countryTotals, stateSource.country, {
      filterColumns: ['country'],
      sortColumns: [
        'country',
        'totalCount',
        'beingWashedCount',
        'washableCount',
        'linenExchangeCount',
      ],
      getColumnValue: (row, column) => row[column] ?? '',
      getSortValue: (row, column) =>
        column === 'totalCount' ||
        column === 'beingWashedCount' ||
        column === 'washableCount' ||
        column === 'linenExchangeCount'
          ? Number(row[column]) || 0
          : row[column] || '',
    });

    return {
      fromDate: interval.fromDate,
      toDate: interval.toDate,
      totalBags: rows.length,
      beingWashedCount: rows.filter((row) => row.status === 'being_washed').length,
      washedCount: rows.filter((row) => row.status === 'washed').length,
      linenExchangeCount: rows.filter((row) => row.isLinenExchange).length,
      rows: historyTable.rows,
      dailyTotals: dailyTable.rows,
      countryTotals: countryTable.rows,
      lookups: {
        rows: historyTable.allRows,
        dailyTotals: dailyTable.allRows,
        countryTotals: countryTable.allRows,
      },
      tables: {
        history: tableMeta(historyTable),
        daily: tableMeta(dailyTable),
        country: tableMeta(countryTable),
      },
    };
  }

  async function getLaundryReport({ actorUserId, campId, fromDate, toDate, tableState = {} }) {
    return success(await loadLaundryReport({ actorUserId, campId, fromDate, toDate, tableState }));
  }

  async function downloadLaundryReport({ actorUserId, campId, fromDate, toDate, tableState = {} }) {
    const report = await loadLaundryReport({ actorUserId, campId, fromDate, toDate, tableState });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Support System';
    workbook.created = new Date();

    const countrySheet = workbook.addWorksheet('Washed by country');
    countrySheet.columns = [
      { header: 'Country', key: 'country', width: 24 },
      { header: 'Total count', key: 'totalCount', width: 16 },
      { header: 'Being washed', key: 'beingWashedCount', width: 18 },
      { header: 'Washable bags', key: 'washableCount', width: 18 },
      { header: 'Linen exchange', key: 'linenExchangeCount', width: 18 },
    ];
    countrySheet.getRow(1).font = { bold: true };
    (report.lookups.countryTotals || report.countryTotals).forEach((row) =>
      countrySheet.addRow(row),
    );

    const historySheet = workbook.addWorksheet('Laundry history');
    historySheet.columns = [
      { header: 'Drop-off At', key: 'dateDropOff', width: 24 },
      { header: 'Ready At', key: 'dateReadyToPickUp', width: 24 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Flow Type', key: 'flowType', width: 18 },
      { header: 'Bag Code', key: 'bagCode', width: 20 },
      { header: 'Bag ID', key: 'bagId', width: 40 },
      { header: 'RFID code', key: 'rfidCode', width: 24 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Soldier', key: 'soldierName', width: 28 },
      { header: 'Soldier ID', key: 'soldierId', width: 40 },
      { header: 'Country', key: 'soldierCountry', width: 18 },
      { header: 'Meal Card', key: 'soldierMealCard', width: 18 },
    ];
    historySheet.getRow(1).font = { bold: true };
    const reportRows = report.lookups.rows || report.rows;
    reportRows.forEach((row) => {
      const excelRow = historySheet.addRow({
        dateDropOff: reportCellValue(formatReportDateTime(row.dateDropOff)),
        dateReadyToPickUp: reportCellValue(formatReportDateTime(row.dateReadyToPickUp)),
        status: reportCellValue(row.statusLabel),
        flowType: reportCellValue(row.flowType),
        bagCode: reportCellValue(row.bagCode),
        bagId: reportCellValue(row.bagId),
        rfidCode: reportCellValue(row.rfidCode),
        type: reportCellValue(row.type),
        soldierName: reportCellValue(row.soldierName),
        soldierId: reportCellValue(row.soldierId),
        soldierCountry: reportCellValue(row.soldierCountry),
        soldierMealCard: reportCellValue(row.soldierMealCard),
      });
      if (row.isLinenExchange) {
        excelRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF2CC' },
          };
        });
      }
    });

    return {
      status: 200,
      fileName: `${LAUNDRY_REPORT_FILENAME.replace(/\.xlsx$/i, '')}-${report.fromDate}-to-${
        report.toDate
      }.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbook.xlsx.writeBuffer(),
    };
  }

  async function downloadBagTemplate({ actorUserId } = {}) {
    await assertAnyLaundryPermission(
      actorUserId,
      [LAUNDRY_PERMISSIONS.addBag, LAUNDRY_PERMISSIONS.editBag],
      "You don't have permission to download the laundry bag template.",
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Support System';
    workbook.created = new Date();

    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ width: 108 }];
    instructionsSheet.addRows([
      ['Use the Laundry Bags sheet to add or update bags in bulk.'],
      ['Leave Identifier blank only when creating a new bag.'],
      [
        'Provide an existing Identifier to update that bag code, RFID code, type, or max laundry count.',
      ],
      ['Status is not editable in bulk. Use Move for bags assigned to soldiers.'],
      [
        'Bag Code is required and must be unique inside the selected camp. RFID Code is required and must be unique.',
      ],
      ['Do not rename sheets, reorder columns, or change the header row in the Laundry Bags sheet.'],
      ['Save the completed file as .xlsx before uploading it back to the system.'],
    ]);

    const bagsSheet = workbook.addWorksheet('Laundry Bags');
    bagsSheet.columns = [
      { header: 'Identifier', key: 'identifier', width: 40 },
      { header: 'Bag Code', key: 'code', width: 28 },
      { header: 'RFID Code', key: 'rfidCode', width: 32 },
      { header: 'Bag Type', key: 'type', width: 28 },
      { header: 'Max Laundry Count', key: 'maxCountLaundry', width: 20 },
    ];
    bagsSheet.getRow(1).font = { bold: true };

    return {
      status: 200,
      fileName: BAG_TEMPLATE_FILENAME,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbook.xlsx.writeBuffer(),
    };
  }

  async function downloadLaundryMobileApp({ actorUserId, requestMeta } = {}) {
    await assertAnyLaundryPermission(
      actorUserId,
      LAUNDRY_PERMISSIONS.downloadLaundryApp,
      'You do not have permission to download the laundry mobile app.',
    );

    const file = await loadLaundryMobileAppFile({ env });

    auditLog?.(AUDIT_EVENT_NAMES.LAUNDRY.MOBILE_APP_DOWNLOADED, {
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
  }

  async function importBags({ actorUserId, campId, fileBuffer, fileName }) {
    assertCampSelected(campId);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError({
        status: 400,
        code: 'LAUNDRY_TEMPLATE_REQUIRED',
        message: 'Select a laundry bag template file before uploading.',
      });
    }

    if (
      !String(fileName || '')
        .toLowerCase()
        .endsWith('.xlsx')
    ) {
      throw new AppError({
        status: 400,
        code: 'INVALID_LAUNDRY_TEMPLATE',
        message: 'Only .xlsx laundry bag template files are supported.',
      });
    }

    const rows = await readBagTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_LAUNDRY_TEMPLATE',
        message: 'The uploaded template does not contain any laundry bag rows to process.',
      });
    }

    const permissions = await canAddOrEdit(actorUserId);
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import laundry bag changes.",
      });
    }

    const result = await applyBulkRows({
      repository,
      actorUserId,
      campId,
      rows,
      permissions,
      assertUniqueBagFields,
    });
    const summary = result?.body?.summary || result?.data?.summary || result?.summary;
    if ((Number(summary?.addedCount) || 0) > 0 || (Number(summary?.updatedCount) || 0) > 0) {
      realtime?.emitLaundryChanged?.(campId);
    }
    return result;
  }

  return {
    addBag,
    addBagToStatus,
    bulkUpdateBags,
    deleteBag,
    downloadBagTemplate,
    downloadLaundryMobileApp,
    downloadLaundryReport,
    editBag,
    getLaundryOverview,
    getLaundryReport,
    getLaundryView,
    importBags,
    listAvailableBags,
    moveBag,
    recordLinenExchange,
    removeBagFromStatus,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  LAUNDRY_REPORT_FILENAME,
  LAUNDRY_STATUSES,
  LAUNDRY_STATUS_TRANSITIONS,
  STATUS_LABELS,
  createLaundryPageService,
};
