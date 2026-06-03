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
const {
  createEmptyBicyclesOverview,
  normalizeBicycleStatus,
} = require('../../domain/bicycle-status');
const { BICYCLE_PERMISSIONS } = require('../../domain/bicycle.permissions');

const BICYCLE_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const NFC_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const HELMET_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BICYCLE_TEMPLATE_HEADERS = Object.freeze([
  'identifier',
  'bicycle name',
  'nfc code',
  'status',
  'soldier',
  'helmet',
  'rental date and time',
]);
const HELMET_TEMPLATE_HEADERS = Object.freeze(['identifier', 'helmet code', 'nfc code']);
const HELMET_TEMPLATE_HEADER_ALIASES = Object.freeze([['helmet id'], [], []]);
const BICYCLE_TEMPLATE_FILENAME = 'bicycle-template.xlsx';
const HELMET_TEMPLATE_FILENAME = 'helmet-template.xlsx';
const BICYCLE_REPORT_FILENAME = 'bicycle-rental-report.xlsx';
const DEFAULT_BIKE_APP_FILE_PATH = 'androidApp/gss-bike-1.4.1-release.apk';
const EMPTY_REPORT_FIELD_MESSAGE = 'No information';
const EDITABLE_ASSIGNMENT_STATUSES = Object.freeze(new Set(['rented', 'repair', 'long_term']));
const BULK_RENTED_ASSIGNMENT_STATUSES = Object.freeze(new Set(['rented', 'late', 'long_term']));
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BULK_TEMPLATE_TIME_ZONE = 'Europe/Sofia';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeNfcCode(value) {
  return String(value || '').trim();
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

function readCellValue(cell) {
  if (!cell) return '';
  return cell.value instanceof Date ? cell.value : String(cell.text || cell.value || '').trim();
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

function parseDateTime(value, fieldName) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_DATE',
      message: `${fieldName} must be a valid date and time.`,
    });
  }
  return date;
}

function getTimeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return zonedAsUtc - date.getTime();
}

function createDateInTimeZone({ year, month, day, hour, minute, second = 0 }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = getTimeZoneOffset(new Date(utcGuess), timeZone);
  offset = getTimeZoneOffset(new Date(utcGuess - offset), timeZone);
  const date = new Date(utcGuess - offset);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = Number(part.value);
      return result;
    }, {});

  if (
    parts.year !== year ||
    parts.month !== month ||
    parts.day !== day ||
    parts.hour !== hour ||
    parts.minute !== minute ||
    parts.second !== second
  ) {
    return null;
  }

  return date;
}

function parseTemplateDateTimeText(value) {
  const text = String(value || '').trim();
  const match = text.match(
    /^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3]);
  const yearFirst = match[1].length === 4;
  const year = yearFirst ? first : third;
  const month = yearFirst ? second : first;
  const day = yearFirst ? third : second;
  let hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const secondPart = Number(match[6] || 0);
  const meridiem = String(match[7] || '').toUpperCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12;
    if (meridiem === 'PM') hour += 12;
  }

  if (
    year < 1900 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    secondPart < 0 ||
    secondPart > 59
  ) {
    return null;
  }

  return createDateInTimeZone(
    { year, month, day, hour, minute, second: secondPart },
    BULK_TEMPLATE_TIME_ZONE,
  );
}

function parseBulkTemplateDateTime(value, fieldName) {
  if (value instanceof Date) {
    const date = createDateInTimeZone(
      {
        year: value.getUTCFullYear(),
        month: value.getUTCMonth() + 1,
        day: value.getUTCDate(),
        hour: value.getUTCHours(),
        minute: value.getUTCMinutes(),
        second: value.getUTCSeconds(),
      },
      BULK_TEMPLATE_TIME_ZONE,
    );
    if (date) return date;
  }

  const textDate = parseTemplateDateTimeText(value);
  if (textDate) return textDate;

  return parseDateTime(value, fieldName);
}

function parseReportDate(value, fieldName) {
  const text = String(value || '').trim();
  if (!REPORT_DATE_PATTERN.test(text)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_REPORT_DATE',
      message: `${fieldName} must use YYYY-MM-DD format.`,
    });
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_REPORT_DATE',
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
      code: 'INVALID_BICYCLE_REPORT_RANGE',
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

function normalizeRentalReportPayload({ interval, report }) {
  const sourceTotals = new Map(
    (Array.isArray(report?.dailyTotals) ? report.dailyTotals : []).map((item) => [
      String(item.date),
      Number(item.rentalCount) || 0,
    ]),
  );
  const dailyTotals = listDateKeysInclusive(interval.fromDate, interval.toDate).map((date) => ({
    date,
    rentalCount: sourceTotals.get(date) || 0,
  }));
  const rows = normalizeRentalReportRows(report?.rows);

  return {
    fromDate: interval.fromDate,
    toDate: interval.toDate,
    totalRentals: dailyTotals.reduce((total, item) => total + item.rentalCount, 0),
    rows,
    dailyTotals,
  };
}

function normalizeRentalReportRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    assignmentId: row.assignmentId,
    identifier: row.identifier,
    bicycleName: row.bicycleName || null,
    bicycleNfcCode: row.bicycleNfcCode || null,
    soldierId: row.soldierId || null,
    soldierName: row.soldierName || null,
    soldierCountry: row.soldierCountry || null,
    soldierMealCard: row.soldierMealCard || null,
    helmetId: row.helmetId || null,
    helmetCode: row.helmetCode || null,
    helmetNfcCode: row.helmetNfcCode || null,
    rentedAt: toIsoStringOrNull(row.rentedAt),
    returnedAt: toIsoStringOrNull(row.returnedAt),
    status: normalizeBicycleStatus(row.status || 'rented'),
    rentalDate: row.rentalDate || toIsoStringOrNull(row.rentedAt)?.slice(0, 10) || null,
  }));
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

function applyServerTableState(rows = [], rawState = {}, config = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const state = normalizeTableState(rawState, config);
  const getColumnValue = config.getColumnValue || ((row, column) => row?.[column] ?? '');
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

function getBicycleTableColumnValue(row, column) {
  if (column === 'status') return formatReportStatus(row.status);
  if (column === 'assignedSoldier') return row.assignedSoldier || 'Unassigned';
  if (column === 'helmetCode') return row.helmetCode || 'None';
  if (column === 'rentedAt') return row.rentedAt ? formatReportDateTime(row.rentedAt) : 'None';
  return row[column] || '';
}

function getHelmetTableColumnValue(row, column) {
  if (column === 'status') return row.assignmentId ? formatReportStatus(row.status) : 'Available';
  if (column === 'bicycleName') return row.bicycleName || 'Unassigned';
  if (column === 'assignedSoldier') return row.assignedSoldier || 'Unassigned';
  return row[column] || '';
}

function getReportTableColumnValue(row, column) {
  if (column === 'status') return formatReportStatus(row.status || 'rented');
  if (column === 'rentedAt') return row.rentedAt ? formatReportDateTime(row.rentedAt) : 'None';
  if (column === 'returnedAt') return row.returnedAt ? formatReportDateTime(row.returnedAt) : 'Active';
  if (column === 'bicycleName') return row.bicycleName || 'Unknown';
  if (column === 'bicycleNfcCode') return row.bicycleNfcCode || '';
  if (column === 'soldierName') return row.soldierName || 'Unassigned';
  if (column === 'helmetCode') return row.helmetCode || 'None';
  if (column === 'helmetNfcCode') return row.helmetNfcCode || '';
  return row[column] || '';
}

function reportCellValue(value) {
  return value === undefined || value === null || value === '' ? EMPTY_REPORT_FIELD_MESSAGE : value;
}

function formatReportDateTime(value) {
  return formatUtcDateTimeDisplay(value);
}

function formatReportStatus(value) {
  const status = normalizeBicycleStatus(value || 'rented');
  if (status === 'long_term') return 'Long term';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function normalizeEditableAssignmentStatus(value) {
  const rawStatus = String(value || '').trim().toLowerCase();
  const status = rawStatus === 'long term' || rawStatus === 'long-term'
    ? 'long_term'
    : normalizeBicycleStatus(rawStatus);
  if (!EDITABLE_ASSIGNMENT_STATUSES.has(status)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_STATUS',
      message: 'Bicycle status can only be changed to Rented, Repair, or Long term.',
    });
  }
  return status;
}

function assertNotFutureDate(date, fieldName) {
  if (date.getTime() > Date.now()) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_DATE',
      message: `${fieldName} cannot be in the future.`,
    });
  }
}

function assertCampSelected(campId) {
  if (!campId) {
    throw new AppError({
      status: 400,
      code: 'CAMP_REQUIRED',
      message: 'Select an active camp before managing bicycles.',
    });
  }
}

function validateBicycleName(name) {
  if (!name || name.length < 2 || name.length > 64 || !BICYCLE_NAME_PATTERN.test(name)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_NAME',
      message: 'Bicycle name must be 2-64 characters and contain only supported characters.',
    });
  }
}

function validateNfcCode(nfcCode) {
  if (!nfcCode || nfcCode.length < 2 || nfcCode.length > 128 || !NFC_CODE_PATTERN.test(nfcCode)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_NFC_CODE',
      message: 'NFC code must be 2-128 characters and contain only letters, numbers, _, :, . or -.',
    });
  }
}


function validateHelmetCode(code) {
  if (!code || code.length < 2 || code.length > 64 || !HELMET_CODE_PATTERN.test(code)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_HELMET_CODE',
      message: 'Helmet code must be 2-64 characters and contain only letters, numbers, _, :, . or -.',
    });
  }
}

async function loadBikeMobileAppFile({ env }) {
  const configuredPath = String(env?.APP_BIKE_FILE_PATH || '').trim() || DEFAULT_BIKE_APP_FILE_PATH;
  const resolvedPath = path.resolve(process.cwd(), configuredPath);
  const fileName = path.basename(resolvedPath);

  let buffer;
  try {
    buffer = await fs.readFile(resolvedPath);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') {
      throw new AppError({
        status: 404,
        code: 'BIKE_MOBILE_APP_NOT_FOUND',
        message: 'The bicycle mobile application package is not available.',
      });
    }
    throw error;
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hash !== env?.HASH_APP_BIKE) {
    throw new AppError({
      status: 409,
      code: 'BIKE_MOBILE_APP_HASH_MISMATCH',
      message: 'The bicycle mobile application package failed integrity verification.',
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

function emitBicycleImportProgress(realtime, actorUserId, stage, summary, message) {
  realtime?.emitBicycleImportProgress?.(actorUserId, {
    resource: 'bicycles',
    stage,
    totalRows: summary.totalRows,
    processedRows: summary.processedRows,
    addedCount: summary.addedCount,
    updatedCount: summary.updatedCount,
    skippedCount: summary.skippedCount,
    errorCount: summary.errorCount,
    progressPercent:
      summary.totalRows > 0 ? Math.round((summary.processedRows / summary.totalRows) * 100) : 0,
    message,
    errors: summary.errors.slice(-5),
  });
}

function emitHelmetImportProgress(realtime, actorUserId, stage, summary, message) {
  realtime?.emitBicycleImportProgress?.(actorUserId, {
    resource: 'helmets',
    stage,
    totalRows: summary.totalRows,
    processedRows: summary.processedRows,
    addedCount: summary.addedCount,
    updatedCount: summary.updatedCount,
    skippedCount: summary.skippedCount,
    errorCount: summary.errorCount,
    progressPercent:
      summary.totalRows > 0 ? Math.round((summary.processedRows / summary.totalRows) * 100) : 0,
    message,
    errors: summary.errors.slice(-5),
  });
}

async function readBicycleTemplateRows(fileBuffer) {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_TEMPLATE',
      message: 'The uploaded file must be a valid .xlsx bicycle template.',
    });
  }

  const worksheet = workbook.getWorksheet('Bicycles') || workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_TEMPLATE',
      message: 'The uploaded template does not contain a Bicycles worksheet.',
    });
  }

  const headerRow = worksheet.getRow(1);
  const normalizedHeaders = BICYCLE_TEMPLATE_HEADERS.map((_, index) =>
    normalizeHeader(headerRow.getCell(index + 1).text),
  );

  if (normalizedHeaders.some((header, index) => header !== BICYCLE_TEMPLATE_HEADERS[index])) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BICYCLE_TEMPLATE',
      message: 'The bicycle template headers are invalid. Download a fresh template and try again.',
    });
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const identifier = String(readCellText(row.getCell(1)) || '')
      .trim()
      .toLowerCase();
    const name = normalizeText(readCellText(row.getCell(2)));
    const nfcCode = normalizeNfcCode(readCellText(row.getCell(3)));
    const status = normalizeText(readCellText(row.getCell(4)));
    const soldier = normalizeText(readCellText(row.getCell(5)));
    const helmet = normalizeText(readCellText(row.getCell(6)));
    const rentedAt = readCellValue(row.getCell(7));

    if (!identifier && !name && !nfcCode && !status && !soldier && !helmet && !rentedAt) return;
    rows.push({ rowNumber, identifier, name, nfcCode, status, soldier, helmet, rentedAt });
  });

  return rows;
}

async function readHelmetTemplateRows(fileBuffer) {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError({
      status: 400,
      code: 'INVALID_HELMET_TEMPLATE',
      message: 'The uploaded file must be a valid .xlsx helmet template.',
    });
  }

  const worksheet = workbook.getWorksheet('Helmets') || workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError({
      status: 400,
      code: 'INVALID_HELMET_TEMPLATE',
      message: 'The uploaded template does not contain a Helmets worksheet.',
    });
  }

  const headerRow = worksheet.getRow(1);
  const normalizedHeaders = HELMET_TEMPLATE_HEADERS.map((_, index) =>
    normalizeHeader(headerRow.getCell(index + 1).text),
  );

  if (
    normalizedHeaders.some(
      (header, index) =>
        header !== HELMET_TEMPLATE_HEADERS[index] &&
        !HELMET_TEMPLATE_HEADER_ALIASES[index]?.includes(header),
    )
  ) {
    throw new AppError({
      status: 400,
      code: 'INVALID_HELMET_TEMPLATE',
      message: 'The helmet template headers are invalid. Download a fresh template and try again.',
    });
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const helmetId = String(readCellText(row.getCell(1)) || '')
      .trim()
      .toLowerCase();
    const code = normalizeNfcCode(readCellText(row.getCell(2)));
    const nfcCode = normalizeNfcCode(readCellText(row.getCell(3)));

    if (!helmetId && !code && !nfcCode) return;
    rows.push({ rowNumber, helmetId, code, nfcCode });
  });

  return rows;
}

function createBicyclesService({ repository, realtime, auditLog, env }) {
  async function assertBicyclePermission(actorUserId, permissionName, deniedMessage) {
    const [hasFullPermission, hasSpecificPermission] = await Promise.all([
      repository.userHasPermission(actorUserId, BICYCLE_PERMISSIONS.full),
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

  async function assertAnyBicyclePermission(actorUserId, permissionNames, deniedMessage) {
    const names = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
    const results = await Promise.all(
      [BICYCLE_PERMISSIONS.full, ...names].map((permissionName) =>
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

  async function canAddOrEdit(actorUserId, addPermission, editPermission) {
    const [full, add, edit] = await Promise.all([
      repository.userHasPermission(actorUserId, BICYCLE_PERMISSIONS.full),
      repository.userHasPermission(actorUserId, addPermission),
      repository.userHasPermission(actorUserId, editPermission),
    ]);
    return { canAdd: full || add, canEdit: full || edit };
  }

  async function markOverdueRentalsLate({ campId }) {
    if (typeof repository.markOverdueRentalsLate !== 'function') return [];

    const changes = await repository.markOverdueRentalsLate({ campId });
    const uniqueChanges = new Map();
    for (const change of changes || []) {
      const identifier = typeof change === 'object' ? change.identifier : change;
      if (!identifier) continue;
      uniqueChanges.set(String(identifier), {
        identifier,
        ...(typeof change === 'object' ? change : {}),
      });
    }
    for (const change of uniqueChanges.values()) {
      realtime?.emitBicycleStatusChanged?.(change.identifier, change);
    }
    return [...uniqueChanges.keys()];
  }

  async function assertUniqueBicycleFields({ campId, name, nfcCode, currentidentifier = null }) {
    const [duplicateName, duplicateNfc] = await Promise.all([
      repository.findBicycleByName({ name, campId }),
      repository.findBicycleByNfcCode({ nfcCode }),
    ]);

    if (duplicateName && String(duplicateName.id) !== String(currentidentifier || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_DATA',
        message: `Bicycle name "${name}" already exists in the selected camp.`,
      });
    }

    if (duplicateNfc && String(duplicateNfc.id) !== String(currentidentifier || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_DATA',
        message: `NFC code "${nfcCode}" is already assigned to another bicycle.`,
      });
    }
  }

  async function assertUniqueHelmetFields({ campId, code, nfcCode, currentHelmetId = null }) {
    const [duplicateCode, duplicateNfc] = await Promise.all([
      repository.findHelmetByCode({ code, campId }),
      repository.findHelmetByNfcCode({ nfcCode }),
    ]);

    if (duplicateCode && String(duplicateCode.id) !== String(currentHelmetId || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_DATA',
        message: `Helmet code "${code}" already exists in the selected camp.`,
      });
    }

    if (duplicateNfc && String(duplicateNfc.id) !== String(currentHelmetId || '')) {
      throw new AppError({
        status: 409,
        code: 'DUPLICATE_DATA',
        message: `NFC code "${nfcCode}" is already assigned to another helmet.`,
      });
    }
  }

  async function resolveBulkSoldierReference({ campId, value }) {
    const soldierValue = normalizeText(value);
    if (!soldierValue) return null;

    const soldier = isUuid(soldierValue)
      ? await repository.findSoldierById({ soldierId: soldierValue, campId })
      : await repository.findSoldierByName({ name: soldierValue, campId });

    if (!soldier) {
      throw new Error(`Soldier "${soldierValue}" was not found in the selected camp.`);
    }
    return soldier.id;
  }

  async function resolveBulkHelmetReference({ campId, value }) {
    const helmetValue = normalizeNfcCode(value);
    if (!helmetValue) return null;

    let helmet = null;
    if (isUuid(helmetValue)) {
      helmet = await repository.findHelmetById({ helmetId: helmetValue, campId });
    } else {
      helmet =
        (await repository.findHelmetByCode({ code: helmetValue, campId })) ||
        (await repository.findHelmetByNfcCode({ nfcCode: helmetValue, campId }));
    }

    if (!helmet) {
      throw new Error(`Helmet "${helmetValue}" was not found in the selected camp.`);
    }
    return helmet.id;
  }

  async function buildBulkAssignmentUpdate({ campId, identifier, existing, row }) {
    const assignmentEditRequested = Boolean(row.status || row.soldier || row.helmet || row.rentedAt);
    if (!assignmentEditRequested) return null;

    const existingStatus = normalizeBicycleStatus(existing.status);
    if (!BULK_RENTED_ASSIGNMENT_STATUSES.has(existingStatus)) {
      throw new Error('Status, soldier, helmet and rental date can only be bulk updated for rented bikes.');
    }

    const activeAssignment = await repository.findActiveAssignment({ identifier });
    if (!activeAssignment) {
      throw new Error('This bicycle does not have an active rental to update.');
    }

    const nextStatus = row.status
      ? normalizeEditableAssignmentStatus(row.status)
      : normalizeBicycleStatus(activeAssignment.status || existingStatus);
    const nextSoldierId = row.soldier
      ? await resolveBulkSoldierReference({ campId, value: row.soldier })
      : activeAssignment.soldierId || null;
    const nextHelmetId = row.helmet
      ? await resolveBulkHelmetReference({ campId, value: row.helmet })
      : activeAssignment.helmetId || null;
    const nextRentedAt = row.rentedAt
      ? parseBulkTemplateDateTime(row.rentedAt, 'Rental date')
      : parseDateTime(activeAssignment.rentedAt, 'Rental date');

    assertNotFutureDate(nextRentedAt, 'Rental date');

    if (nextStatus !== 'repair' && !nextSoldierId) {
      throw new Error('Soldier is required when bulk updating a rented bike assignment.');
    }

    const helmetInUse = nextHelmetId
      ? await repository.helmetHasActiveAssignment({
          helmetId: nextHelmetId,
          excludeAssignmentId: activeAssignment.id,
        })
      : false;
    if (helmetInUse) {
      throw new Error('The selected helmet is already assigned to another active rental.');
    }

    return {
      assignmentId: activeAssignment.id,
      status: nextStatus,
      soldierId: nextStatus === 'repair' ? null : nextSoldierId,
      helmetId: nextStatus === 'repair' ? null : nextHelmetId,
      rentedAt: nextRentedAt,
    };
  }

  async function getBicyclesOverview({ campId, tableState = {} }) {
    if (!campId) {
      return success(createEmptyBicyclesOverview());
    }

    await markOverdueRentalsLate({ campId });

    const [rows, helmets] = await Promise.all([
      repository.findOverviewByCamp({ campId }),
      typeof repository.listHelmetsByCamp === 'function'
        ? repository.listHelmetsByCamp({ campId })
        : Promise.resolve(null),
    ]);
    const summary = createEmptyBicyclesOverview();

    const allRows = rows.map((row) => {
      const normalizedStatus = normalizeBicycleStatus(row.status);
      if (normalizedStatus === 'rented') summary.rented += 1;
      else if (normalizedStatus === 'repair') summary.repair += 1;
      else if (normalizedStatus === 'late') summary.late += 1;
      else if (normalizedStatus === 'long_term') summary.longTerm += 1;
      else summary.available += 1;

      return {
        id: row.id,
        name: row.name,
        nfcCode: row.nfcCode,
        status: normalizedStatus,
        assignedSoldierId: row.assignedSoldierId || null,
        assignedSoldier: row.assignedSoldier || null,
        helmetId: row.helmetId || null,
        helmetCode: row.helmetCode || null,
        assignmentId: row.assignmentId || null,
        rentedAt: row.rentedAt || null,
      };
    });

    let allHelmets = [];
    if (Array.isArray(helmets)) {
      allHelmets = helmets.map((helmet) => ({
        id: helmet.id,
        code: helmet.code,
        nfcCode: helmet.nfcCode,
        identifier: helmet.identifier || null,
        bicycleName: helmet.bicycleName || null,
        assignedSoldierId: helmet.assignedSoldierId || null,
        assignedSoldier: helmet.assignedSoldier || null,
        assignmentId: helmet.assignmentId || null,
        status: normalizeBicycleStatus(helmet.status || 'available'),
        rentedAt: helmet.rentedAt || null,
      }));
    }

    const stateSource = tableState && typeof tableState === 'object' ? tableState : {};
    const bicycleTable = applyServerTableState(allRows, stateSource.bicycle, {
      filterColumns: [
        'name',
        'id',
        'nfcCode',
        'status',
        'assignedSoldier',
        'helmetCode',
        'rentedAt',
      ],
      sortColumns: [
        'name',
        'id',
        'nfcCode',
        'status',
        'assignedSoldier',
        'helmetCode',
        'rentedAt',
      ],
      getColumnValue: getBicycleTableColumnValue,
    });
    const helmetTable = applyServerTableState(allHelmets, stateSource.helmet, {
      filterColumns: ['code', 'nfcCode', 'id', 'bicycleName', 'assignedSoldier', 'status'],
      sortColumns: ['code', 'nfcCode', 'id', 'bicycleName', 'assignedSoldier', 'status'],
      getColumnValue: getHelmetTableColumnValue,
    });

    summary.rows = bicycleTable.rows;
    summary.helmets = helmetTable.rows;
    summary.lookups = {
      rows: allRows,
      helmets: allHelmets,
    };
    summary.tables = {
      bicycles: tableMeta(bicycleTable),
      helmets: tableMeta(helmetTable),
    };
    summary.helmetPairingCount = allRows.filter((row) => row.helmetCode).length;

    return success(summary);
  }

  async function loadBicycleRentalReport({ campId, fromDate, toDate, tableState = {} }) {
    assertCampSelected(campId);
    const interval = buildReportInterval({ fromDate, toDate });
    const report = await repository.listRentalReport({
      campId,
      from: interval.from,
      to: interval.to,
    });

    const payload = normalizeRentalReportPayload({ interval, report });
    const stateSource = tableState && typeof tableState === 'object' ? tableState : {};
    const historyTable = applyServerTableState(payload.rows, stateSource.history, {
      filterColumns: [
        'rentedAt',
        'returnedAt',
        'status',
        'bicycleName',
        'bicycleNfcCode',
        'soldierName',
        'helmetCode',
        'helmetNfcCode',
      ],
      sortColumns: [
        'rentedAt',
        'returnedAt',
        'status',
        'bicycleName',
        'bicycleNfcCode',
        'soldierName',
        'helmetCode',
        'helmetNfcCode',
      ],
      getColumnValue: getReportTableColumnValue,
    });
    const dailyTable = applyServerTableState(payload.dailyTotals, stateSource.daily, {
      filterColumns: [],
      sortColumns: [],
      getColumnValue: (row, column) => row[column] ?? '',
    });

    return {
      ...payload,
      rows: historyTable.rows,
      dailyTotals: dailyTable.rows,
      lookups: {
        rows: historyTable.allRows,
        dailyTotals: dailyTable.allRows,
      },
      tables: {
        history: tableMeta(historyTable),
        daily: tableMeta(dailyTable),
      },
      helmetRentalCount: historyTable.allRows.filter((row) => row.helmetCode).length,
    };
  }

  async function getBicycleRentalReport({ campId, fromDate, toDate, tableState = {} }) {
    return success(await loadBicycleRentalReport({ campId, fromDate, toDate, tableState }));
  }

  async function getRecentRentalsByAsset({ campId, assetType, assetId, limit = 2 }) {
    assertCampSelected(campId);
    const normalizedAssetType = String(assetType || '').trim().toLowerCase();
    if (!['bicycle', 'helmet'].includes(normalizedAssetType)) {
      throw new AppError({
        status: 400,
        code: 'INVALID_BICYCLE_REPORT_ASSET_TYPE',
        message: 'Report asset type must be bicycle or helmet.',
      });
    }
    if (!isUuid(assetId)) {
      throw new AppError({
        status: 400,
        code: 'INVALID_BICYCLE_REPORT_ASSET',
        message: 'Select a valid bike or helmet before loading recent rentals.',
      });
    }

    const rows = await repository.listRecentRentalsByAsset({
      campId,
      assetType: normalizedAssetType,
      assetId,
      limit,
    });

    return success({ rows: normalizeRentalReportRows(rows) });
  }

  async function getActiveAssignmentsBySoldier({ campId, soldierId }) {
    assertCampSelected(campId);
    if (!isUuid(soldierId)) {
      throw new AppError({
        status: 400,
        code: 'INVALID_BICYCLE_REPORT_SOLDIER',
        message: 'Select a valid soldier before loading active assignments.',
      });
    }

    const rows = await repository.listActiveAssignmentsBySoldier({ campId, soldierId });
    return success({ rows: normalizeRentalReportRows(rows) });
  }

  async function listReportAssets({ campId, assetType, search = '', limit = 20 }) {
    assertCampSelected(campId);
    const normalizedAssetType = String(assetType || '').trim().toLowerCase();
    if (!['bicycle', 'helmet'].includes(normalizedAssetType)) {
      throw new AppError({
        status: 400,
        code: 'INVALID_BICYCLE_REPORT_ASSET_TYPE',
        message: 'Report asset type must be bicycle or helmet.',
      });
    }

    const sourceRows =
      normalizedAssetType === 'helmet'
        ? await repository.listHelmetsByCamp({ campId })
        : await repository.findOverviewByCamp({ campId });
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) =>
      normalizedAssetType === 'helmet'
        ? {
            id: row.id,
            code: row.code,
            nfcCode: row.nfcCode,
            identifier: row.identifier || null,
            status: normalizeBicycleStatus(row.status || 'available'),
          }
        : {
            id: row.id,
            name: row.name,
            nfcCode: row.nfcCode,
            status: normalizeBicycleStatus(row.status || 'available'),
          },
    );

    return success({
      assets: applyLookupState(rows, search, {
        limit,
        getValues:
          normalizedAssetType === 'helmet'
            ? (row) => [row.code, row.nfcCode, row.id]
            : (row) => [row.name, row.nfcCode, row.id],
        getSortValue: (row) => row.code || row.name || row.id,
      }),
    });
  }

  async function listReportSoldiers({ campId, search = '', limit = 20 }) {
    assertCampSelected(campId);
    const rows = await repository.findOverviewByCamp({ campId });
    const soldiersById = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row.assignedSoldierId || !row.assignedSoldier) return;
      if (!soldiersById.has(row.assignedSoldierId)) {
        soldiersById.set(row.assignedSoldierId, {
          id: row.assignedSoldierId,
          name: row.assignedSoldier,
        });
      }
    });

    return success({
      soldiers: applyLookupState([...soldiersById.values()], search, {
        limit,
        getValues: (soldier) => [soldier.name, soldier.id],
        getSortValue: (soldier) => soldier.name || soldier.id,
      }),
    });
  }

  async function getBicyclesView({ campId, csrfToken, userId }) {
    const permissionRows = userId ? await repository.listUserPermissions({ userId }) : [];
    const permissionNames = new Set(
      (Array.isArray(permissionRows) ? permissionRows : [])
        .map((permission) => String(permission?.name || '').trim())
        .filter(Boolean),
    );
    const canDownloadBikeMobileApp =
      permissionNames.has(BICYCLE_PERMISSIONS.full) ||
      permissionNames.has(BICYCLE_PERMISSIONS.downloadBikeApp);

    return {
      title: 'Bicycles',
      campId,
      csrfToken,
      horizontalNavItems: buildHorizontalNavItems(permissionRows, false),
      canDownloadBikeMobileApp,
      bikeMobileAppDownloadUrl: '/web/bicycles/mobile-app',
    };
  }

  async function listSoldiers({ actorUserId, campId, search, limit }) {
    assertCampSelected(campId);
    await assertAnyBicyclePermission(
      actorUserId,
      [BICYCLE_PERMISSIONS.saveBikeStatus, BICYCLE_PERMISSIONS.editBike],
      "You don't have permission to search bicycle assignment options.",
    );
    return success({ soldiers: await repository.listSoldiers({ campId, search, limit }) });
  }

  async function listAvailableHelmets({ actorUserId, campId, search, limit, identifier }) {
    assertCampSelected(campId);
    await assertAnyBicyclePermission(
      actorUserId,
      [BICYCLE_PERMISSIONS.saveBikeStatus, BICYCLE_PERMISSIONS.editBike],
      "You don't have permission to search bicycle assignment options.",
    );
    return success({
      helmets: await repository.listAvailableHelmets({ campId, search, limit, identifier }),
    });
  }

  async function addHelmet({ actorUserId, campId, code, nfcCode, requestMeta }) {
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.addHelmet,
      "You don't have permission to add helmets.",
    );

    const normalizedCode = normalizeNfcCode(code);
    const normalizedNfcCode = normalizeNfcCode(nfcCode);
    validateHelmetCode(normalizedCode);
    validateNfcCode(normalizedNfcCode);
    await assertUniqueHelmetFields({
      campId,
      code: normalizedCode,
      nfcCode: normalizedNfcCode,
    });

    const helmet = await repository.addHelmet({
      actorUserId,
      campId,
      code: normalizedCode,
      nfcCode: normalizedNfcCode,
    });
    realtime?.emitBicycleAdded?.();
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.HELMET_CREATED, {
      ...requestMeta,
      actorUserId,
      helmetId: helmet.id,
      code: helmet.code,
      nfcCode: helmet.nfcCode,
    });

    return success({ message: 'Helmet added successfully.', helmet });
  }

  async function editHelmet({ actorUserId, campId, helmetId, code, nfcCode, requestMeta }) {
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.editHelmet,
      "You don't have permission to edit helmets.",
    );

    const existing = await repository.findHelmetById({ helmetId, campId });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: 'HELMET_NOT_FOUND',
        message: 'The helmet was not found in the selected camp.',
      });
    }

    const normalizedCode = normalizeNfcCode(code);
    const normalizedNfcCode = normalizeNfcCode(nfcCode);
    validateHelmetCode(normalizedCode);
    validateNfcCode(normalizedNfcCode);
    await assertUniqueHelmetFields({
      campId,
      code: normalizedCode,
      nfcCode: normalizedNfcCode,
      currentHelmetId: helmetId,
    });

    const helmet = await repository.editHelmet({
      actorUserId,
      campId,
      helmetId,
      code: normalizedCode,
      nfcCode: normalizedNfcCode,
    });
    realtime?.emitBicycleUpdated?.(helmetId);
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.HELMET_UPDATED, {
      ...requestMeta,
      actorUserId,
      helmetId,
      code: helmet.code,
      nfcCode: helmet.nfcCode,
    });

    return success({ message: 'Helmet updated successfully.', helmet });
  }

  async function deleteHelmet({ actorUserId, campId, helmetId, requestMeta }) {
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.deleteHelmet,
      "You don't have permission to remove helmets.",
    );

    const existing = await repository.findHelmetById({ helmetId, campId });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: 'HELMET_NOT_FOUND',
        message: 'The helmet was not found in the selected camp.',
      });
    }

    const activeAssignment = await repository.helmetHasActiveAssignment({ helmetId });
    if (activeAssignment) {
      throw new AppError({
        status: 409,
        code: 'HELMET_DELETE_BLOCKED',
        message: 'This helmet is assigned to an active rental and cannot be deleted until it is returned.',
      });
    }

    const deleted = await repository.deleteHelmet({ actorUserId, campId, helmetId });
    if (!deleted) {
      throw new AppError({
        status: 409,
        code: 'HELMET_DELETE_BLOCKED',
        message: 'This helmet is assigned to an active rental and cannot be deleted until it is returned.',
      });
    }

    realtime?.emitBicycleDeleted?.(helmetId);
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.HELMET_DELETED, {
      ...requestMeta,
      actorUserId,
      helmetId,
    });

    return success({ message: 'Helmet removed successfully.' });
  }

  async function addBicycle({ actorUserId, campId, name, nfcCode, requestMeta }) {
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.addBike,
      "You don't have permission to add bicycles.",
    );

    const normalizedName = normalizeText(name);
    const normalizedNfcCode = normalizeNfcCode(nfcCode);
    validateBicycleName(normalizedName);
    validateNfcCode(normalizedNfcCode);
    await assertUniqueBicycleFields({ campId, name: normalizedName, nfcCode: normalizedNfcCode });

    const bicycle = await repository.addBicycle({
      actorUserId,
      campId,
      name: normalizedName,
      nfcCode: normalizedNfcCode,
    });
    realtime?.emitBicycleAdded?.();
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.BIKE_CREATED, {
      ...requestMeta,
      actorUserId,
      identifier: bicycle.id,
      nfcCode: bicycle.nfcCode,
    });

    return success({ message: 'Bicycle added successfully.', bicycle });
  }

  async function editBicycle(input) {
    const {
      actorUserId,
      campId,
      identifier,
      name,
      nfcCode,
      status,
      soldierId,
      helmetId,
      rentedAt,
      requestMeta,
    } = input || {};
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.editBike,
      "You don't have permission to edit bicycles.",
    );

    const existing = await repository.findBicycleById({ identifier, campId });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found in the selected camp.',
      });
    }

    const normalizedName = normalizeText(name);
    const normalizedNfcCode = normalizeNfcCode(nfcCode);
    validateBicycleName(normalizedName);
    validateNfcCode(normalizedNfcCode);
    await assertUniqueBicycleFields({
      campId,
      name: normalizedName,
      nfcCode: normalizedNfcCode,
      currentidentifier: identifier,
    });

    const existingStatus = normalizeBicycleStatus(existing.status);
    const hasAssignmentEditValue = (value) =>
      value !== undefined && String(value || '').trim() !== '';
    const assignmentEditRequested =
      hasAssignmentEditValue(status) ||
      hasAssignmentEditValue(soldierId) ||
      hasAssignmentEditValue(helmetId) ||
      hasAssignmentEditValue(rentedAt);

    let assignmentUpdate = null;
    if (assignmentEditRequested) {
      if (existingStatus === 'available') {
        throw new AppError({
          status: 400,
          code: 'BICYCLE_ASSIGNMENT_EDIT_NOT_ALLOWED',
          message: 'Assignment fields can only be edited for bicycles that are not available.',
        });
      }

      const nextStatus = status ? normalizeEditableAssignmentStatus(status) : existingStatus;
      const activeAssignment = await repository.findActiveAssignment({ identifier });
      if (!activeAssignment) {
        throw new AppError({
          status: 409,
          code: 'BICYCLE_ASSIGNMENT_NOT_FOUND',
          message: 'This bicycle does not have an active assignment to edit.',
        });
      }

      const nextSoldierId = soldierId !== undefined
        ? String(soldierId || '').trim() || null
        : activeAssignment.soldierId || null;
      const nextHelmetId = helmetId !== undefined
        ? String(helmetId || '').trim() || null
        : activeAssignment.helmetId || null;
      const nextRentedAt = rentedAt !== undefined
        ? parseDateTime(rentedAt, 'Rental date')
        : parseDateTime(activeAssignment.rentedAt, 'Rental date');

      assertNotFutureDate(nextRentedAt, 'Rental date');

      if (nextStatus !== 'repair' && !nextSoldierId) {
        throw new AppError({
          status: 400,
          code: 'SOLDIER_REQUIRED',
          message: 'Select a soldier before saving a rented bicycle assignment.',
        });
      }

      const [soldier, helmet, helmetInUse] = await Promise.all([
        nextSoldierId ? repository.findSoldierById({ soldierId: nextSoldierId, campId }) : null,
        nextHelmetId ? repository.findHelmetById({ helmetId: nextHelmetId, campId }) : null,
        nextHelmetId
          ? repository.helmetHasActiveAssignment({
              helmetId: nextHelmetId,
              excludeAssignmentId: activeAssignment.id,
            })
          : false,
      ]);

      if (nextSoldierId && !soldier) {
        throw new AppError({
          status: 404,
          code: 'SOLDIER_NOT_FOUND',
          message: 'The selected soldier was not found in the selected camp.',
        });
      }
      if (nextHelmetId && !helmet) {
        throw new AppError({
          status: 404,
          code: 'HELMET_NOT_FOUND',
          message: 'The selected helmet was not found in the selected camp.',
        });
      }
      if (helmetInUse) {
        throw new AppError({
          status: 409,
          code: 'HELMET_ALREADY_RENTED',
          message: 'The selected helmet is already assigned to another active rental.',
        });
      }

      assignmentUpdate = {
        assignmentId: activeAssignment.id,
        status: nextStatus,
        soldierId: nextSoldierId,
        helmetId: nextHelmetId,
        rentedAt: nextRentedAt,
      };
    }

    const bicycle = await repository.editBicycle({
      actorUserId,
      campId,
      identifier,
      name: normalizedName,
      nfcCode: normalizedNfcCode,
      assignment: assignmentUpdate,
    });
    realtime?.emitBicycleUpdated?.(identifier);
    if (assignmentUpdate) realtime?.emitBicycleStatusChanged?.(identifier);
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.BIKE_UPDATED, {
      ...requestMeta,
      actorUserId,
      identifier,
      nfcCode: bicycle.nfcCode,
      status: assignmentUpdate?.status,
    });

    return success({ message: 'Bicycle updated successfully.', bicycle });
  }

  async function deleteBicycle({ actorUserId, campId, identifier, requestMeta }) {
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.deleteBike,
      "You don't have permission to remove bicycles.",
    );

    const existing = await repository.findBicycleById({ identifier, campId });
    if (!existing) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found in the selected camp.',
      });
    }

    const activeAssignment = await repository.findActiveAssignment({ identifier });
    if (activeAssignment) {
      throw new AppError({
        status: 409,
        code: 'BICYCLE_DELETE_BLOCKED',
        message:
          'This bicycle has an active rental or repair assignment and cannot be deleted until it is returned.',
      });
    }
    if (normalizeBicycleStatus(existing.status) !== 'available') {
      throw new AppError({
        status: 409,
        code: 'BICYCLE_DELETE_BLOCKED',
        message: 'This bicycle must be returned to Available status before it can be deleted.',
      });
    }

    const deleted = await repository.deleteBicycle({ actorUserId, campId, identifier });
    if (!deleted) {
      throw new AppError({
        status: 409,
        code: 'BICYCLE_DELETE_BLOCKED',
        message:
          'This bicycle has an active rental or repair assignment and cannot be deleted until it is returned.',
      });
    }

    realtime?.emitBicycleDeleted?.(identifier);
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.BIKE_DELETED, {
      ...requestMeta,
      actorUserId,
      identifier,
    });

    return success({ message: 'Bicycle removed successfully.' });
  }

  async function rentBicycle({
    actorUserId,
    campId,
    identifier,
    soldierId,
    helmetId,
    rentedAt,
    repair,
    longTerm,
    requestMeta,
  }) {
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.saveBikeStatus,
      "You don't have permission to rent bicycles.",
    );

    const isRepair = Boolean(repair);
    const rentedDate = parseDateTime(rentedAt, 'Rental date');
    assertNotFutureDate(rentedDate, 'Rental date');

    if (!isRepair && !soldierId) {
      throw new AppError({
        status: 400,
        code: 'SOLDIER_REQUIRED',
        message: 'Select a soldier before renting the bicycle.',
      });
    }

    const [bicycle, soldier, helmet, activeAssignment, helmetInUse] = await Promise.all([
      repository.findBicycleById({ identifier, campId }),
      isRepair ? null : repository.findSoldierById({ soldierId, campId }),
      !isRepair && helmetId ? repository.findHelmetById({ helmetId, campId }) : null,
      repository.findActiveAssignment({ identifier }),
      !isRepair && helmetId ? repository.helmetHasActiveAssignment({ helmetId }) : false,
    ]);

    if (!bicycle) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found in the selected camp.',
      });
    }
    if (normalizeBicycleStatus(bicycle.status) !== 'available') {
      throw new AppError({
        status: 409,
        code: 'BICYCLE_NOT_AVAILABLE',
        message: 'Only available bicycles can be rented.',
      });
    }
    if (activeAssignment) {
      throw new AppError({
        status: 409,
        code: 'BICYCLE_ALREADY_RENTED',
        message: 'The bicycle is already rented.',
      });
    }
    if (!isRepair && !soldier) {
      throw new AppError({
        status: 404,
        code: 'SOLDIER_NOT_FOUND',
        message: 'The selected soldier was not found in the selected camp.',
      });
    }
    if (!isRepair && helmetId && !helmet) {
      throw new AppError({
        status: 404,
        code: 'HELMET_NOT_FOUND',
        message: 'The selected helmet was not found in the selected camp.',
      });
    }
    if (!isRepair && helmetInUse) {
      throw new AppError({
        status: 409,
        code: 'HELMET_ALREADY_RENTED',
        message: 'The selected helmet is already assigned to another active rental.',
      });
    }

    if (isRepair) {
      const bicycleRepair = await repository.markBicycleRepair({
        actorUserId,
        campId,
        identifier,
        markedAt: rentedDate,
      });

      realtime?.emitBicycleStatusChanged?.(identifier);
      auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.BIKE_UPDATED, {
        ...requestMeta,
        actorUserId,
        identifier,
        repair: true,
      });

      return success({ message: 'Bicycle marked for repair.', bicycle: bicycleRepair });
    }

    const assignment = await repository.rentBicycle({
      actorUserId,
      campId,
      identifier,
      soldierId,
      helmetId: helmetId || null,
      rentedAt: rentedDate,
      longTerm: Boolean(longTerm),
    });

    realtime?.emitBicycleStatusChanged?.(identifier);
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.BIKE_RENTED, {
      ...requestMeta,
      actorUserId,
      identifier,
      soldierId,
      helmetId: helmetId || null,
      longTerm: Boolean(longTerm),
    });

    return success({ message: 'Bicycle rented successfully.', assignment });
  }

  async function returnBicycle({ actorUserId, campId, identifier, returnedAt, requestMeta }) {
    assertCampSelected(campId);
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.saveBikeStatus,
      "You don't have permission to return bicycles.",
    );

    const [bicycle, activeAssignment] = await Promise.all([
      repository.findBicycleById({ identifier, campId }),
      repository.findActiveAssignment({ identifier }),
    ]);

    if (!bicycle) {
      throw new AppError({
        status: 404,
        code: 'BICYCLE_NOT_FOUND',
        message: 'The bicycle was not found in the selected camp.',
      });
    }
    if (!activeAssignment) {
      throw new AppError({
        status: 409,
        code: 'BICYCLE_NOT_RENTED',
        message: 'The bicycle does not have an active rental to return.',
      });
    }

    const returnedDate = parseDateTime(returnedAt, 'Return date');
    if (new Date(activeAssignment.rentedAt).getTime() > returnedDate.getTime()) {
      throw new AppError({
        status: 400,
        code: 'INVALID_RETURN_DATE',
        message: 'Return date cannot be before the rental date.',
      });
    }

    const assignment = await repository.returnBicycle({
      actorUserId,
      campId,
      identifier,
      returnedAt: returnedDate,
    });

    realtime?.emitBicycleStatusChanged?.(identifier);
    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.BIKE_RETURNED, {
      ...requestMeta,
      actorUserId,
      identifier,
    });

    return success({ message: 'Bicycle returned successfully.', assignment });
  }

  async function downloadBicycleTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Support System';
    workbook.created = new Date();

    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ width: 112 }];
    instructionsSheet.addRows([
      ['Use the Bicycles sheet to add or update bicycles in bulk.'],
      ['Leave Identifier blank only when creating a new bicycle.'],
      ['Provide an existing Identifier to update that bicycle name or NFC code.'],
      ['For existing rented bikes, Status, Soldier, Helmet, and Rental Date and Time can also be updated.'],
      ['Status accepts Rented, Repair, or Long term. Assignment fields cannot be used for new bicycles.'],
      ['Soldier accepts an exact soldier name or soldier UUID. Helmet accepts a helmet code, NFC code, or UUID.'],
      ['Rental Date and Time is read as Europe/Sofia local time.'],
      ['NFC Code is required and must be unique across all bicycles.'],
      ['Do not rename sheets, reorder columns, or change the header row in the Bicycles sheet.'],
      ['Save the completed file as .xlsx before uploading it back to the system.'],
    ]);

    const bicyclesSheet = workbook.addWorksheet('Bicycles');
    bicyclesSheet.columns = [
      { header: 'Identifier', key: 'identifier', width: 40 },
      { header: 'Bicycle Name', key: 'name', width: 32 },
      { header: 'NFC Code', key: 'nfcCode', width: 32 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Soldier', key: 'soldier', width: 32 },
      { header: 'Helmet', key: 'helmet', width: 24 },
      { header: 'Rental Date and Time', key: 'rentedAt', width: 24 },
    ];
    bicyclesSheet.getRow(1).font = { bold: true };

    return {
      status: 200,
      fileName: BICYCLE_TEMPLATE_FILENAME,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbook.xlsx.writeBuffer(),
    };
  }

  async function downloadHelmetTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Support System';
    workbook.created = new Date();

    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ width: 104 }];
    instructionsSheet.addRows([
      ['Use the Helmets sheet to add or update helmets in bulk.'],
      ['Leave Identifier blank only when creating a new helmet.'],
      ['Provide an existing Identifier to update that helmet code or NFC code.'],
      ['Helmet Code is required and must be unique inside the selected camp.'],
      ['NFC Code is required and must be unique across all helmets.'],
      ['Do not rename sheets, reorder columns, or change the header row in the Helmets sheet.'],
      ['Save the completed file as .xlsx before uploading it back to the system.'],
    ]);

    const helmetsSheet = workbook.addWorksheet('Helmets');
    helmetsSheet.columns = [
      { header: 'Identifier', key: 'helmetId', width: 40 },
      { header: 'Helmet Code', key: 'code', width: 32 },
      { header: 'NFC Code', key: 'nfcCode', width: 32 },
    ];
    helmetsSheet.getRow(1).font = { bold: true };

    return {
      status: 200,
      fileName: HELMET_TEMPLATE_FILENAME,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbook.xlsx.writeBuffer(),
    };
  }

  async function downloadBikeMobileApp({ actorUserId, requestMeta } = {}) {
    await assertBicyclePermission(
      actorUserId,
      BICYCLE_PERMISSIONS.downloadBikeApp,
      'You do not have permission to download the bicycle mobile app.',
    );

    const file = await loadBikeMobileAppFile({ env });

    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.MOBILE_APP_DOWNLOADED, {
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

  async function downloadBicycleRentalReport({ campId, fromDate, toDate, tableState = {} }) {
    const report = await loadBicycleRentalReport({ campId, fromDate, toDate, tableState });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Support System';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Daily totals');
    summarySheet.columns = [
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Total rentals by days', key: 'rentalCount', width: 18 },
    ];
    summarySheet.getRow(1).font = { bold: true };
    const dailyTotals = Array.isArray(report.lookups?.dailyTotals)
      ? report.lookups.dailyTotals
      : report.dailyTotals;
    const reportRows = Array.isArray(report.lookups?.rows) ? report.lookups.rows : report.rows;
    dailyTotals.forEach((row) => summarySheet.addRow(row));
    const totalRow = summarySheet.addRow({
      date: 'Total rentals in period',
      rentalCount: report.totalRentals,
    });
    totalRow.font = { bold: true };

    const historySheet = workbook.addWorksheet('Rental history');
    historySheet.columns = [
      { header: 'Rented At', key: 'rentedAt', width: 24 },
      { header: 'Returned At', key: 'returnedAt', width: 24 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Bicycle', key: 'bicycleName', width: 24 },
      { header: 'Identifier', key: 'identifier', width: 40 },
      { header: 'Bicycle NFC', key: 'bicycleNfcCode', width: 24 },
      { header: 'Soldier', key: 'soldierName', width: 28 },
      { header: 'Soldier ID', key: 'soldierId', width: 40 },
      { header: 'Country', key: 'soldierCountry', width: 18 },
      { header: 'Meal Card', key: 'soldierMealCard', width: 18 },
      { header: 'Helmet', key: 'helmetCode', width: 18 },
      { header: 'Helmet Identifier', key: 'helmetId', width: 40 },
      { header: 'Helmet NFC', key: 'helmetNfcCode', width: 24 },
    ];
    historySheet.getRow(1).font = { bold: true };
    reportRows.forEach((row) =>
      historySheet.addRow({
        rentedAt: reportCellValue(formatReportDateTime(row.rentedAt)),
        returnedAt: reportCellValue(formatReportDateTime(row.returnedAt)),
        status: reportCellValue(formatReportStatus(row.status)),
        bicycleName: reportCellValue(row.bicycleName),
        identifier: reportCellValue(row.identifier),
        bicycleNfcCode: reportCellValue(row.bicycleNfcCode),
        soldierName: reportCellValue(row.soldierName),
        soldierId: reportCellValue(row.soldierId),
        soldierCountry: reportCellValue(row.soldierCountry),
        soldierMealCard: reportCellValue(row.soldierMealCard),
        helmetCode: reportCellValue(row.helmetCode),
        helmetId: reportCellValue(row.helmetId),
        helmetNfcCode: reportCellValue(row.helmetNfcCode),
      }),
    );

    return {
      status: 200,
      fileName: `${BICYCLE_REPORT_FILENAME.replace(/\.xlsx$/i, '')}-${report.fromDate}-to-${
        report.toDate
      }.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbook.xlsx.writeBuffer(),
    };
  }

  async function importBicycles({ actorUserId, campId, fileBuffer, fileName, requestMeta }) {
    assertCampSelected(campId);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError({
        status: 400,
        code: 'BICYCLE_TEMPLATE_REQUIRED',
        message: 'Select a bicycle template file before uploading.',
      });
    }

    if (!String(fileName || '').toLowerCase().endsWith('.xlsx')) {
      throw new AppError({
        status: 400,
        code: 'INVALID_BICYCLE_TEMPLATE',
        message: 'Only .xlsx bicycle template files are supported.',
      });
    }

    const permissions = await canAddOrEdit(
      actorUserId,
      BICYCLE_PERMISSIONS.addBike,
      BICYCLE_PERMISSIONS.editBike,
    );
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import bicycle changes.",
      });
    }

    const rows = await readBicycleTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_BICYCLE_TEMPLATE',
        message: 'The uploaded template does not contain any bicycle rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenidentifiers = new Set();
    const seenNewNames = new Set();
    const seenNfcCodes = new Set();
    emitBicycleImportProgress(realtime, actorUserId, 'processing', summary, 'Preparing import...');

    for (const row of rows) {
      const identifier = String(row.identifier || '').trim().toLowerCase();
      const name = normalizeText(row.name);
      const nfcCode = normalizeNfcCode(row.nfcCode);
      let rowMessage = '';

      try {
        if (!name) throw new Error('Bicycle Name is required.');
        validateBicycleName(name);
        validateNfcCode(nfcCode);
        if (identifier && !isUuid(identifier)) throw new Error('Identifier must be a valid UUID.');
        if (identifier && seenidentifiers.has(identifier)) {
          throw new Error(`Identifier ${identifier} is duplicated in the uploaded file.`);
        }
        if (!identifier && seenNewNames.has(name.toLowerCase())) {
          throw new Error(`Bicycle Name "${name}" is duplicated in the uploaded file.`);
        }
        if (seenNfcCodes.has(nfcCode.toLowerCase())) {
          throw new Error(`NFC Code "${nfcCode}" is duplicated in the uploaded file.`);
        }

        seenNfcCodes.add(nfcCode.toLowerCase());

        if (identifier) {
          seenidentifiers.add(identifier);
          if (!permissions.canEdit) throw new Error('You do not have permission to edit bicycles.');
          const existing = await repository.findBicycleById({ identifier, campId });
          if (!existing) throw new Error(`Bicycle ${identifier} was not found.`);
          await assertUniqueBicycleFields({
            campId,
            name,
            nfcCode,
            currentidentifier: identifier,
          });
          const assignment = await buildBulkAssignmentUpdate({
            campId,
            identifier,
            existing,
            row,
          });

          if (existing.name === name && existing.nfcCode === nfcCode && !assignment) {
            summary.skippedCount += 1;
            rowMessage = `Row ${row.rowNumber} skipped. Bicycle "${name}" was unchanged.`;
          } else {
            await repository.editBicycle({ actorUserId, campId, identifier, name, nfcCode, assignment });
            if (assignment) realtime?.emitBicycleStatusChanged?.(identifier);
            summary.updatedCount += 1;
            rowMessage = `Row ${row.rowNumber} updated "${name}".`;
          }
        } else {
          seenNewNames.add(name.toLowerCase());
          if (row.status || row.soldier || row.helmet || row.rentedAt) {
            throw new Error('Assignment fields can only be used with an existing rented bicycle.');
          }
          if (!permissions.canAdd) throw new Error('You do not have permission to add bicycles.');
          await assertUniqueBicycleFields({ campId, name, nfcCode });
          await repository.addBicycle({ actorUserId, campId, name, nfcCode });
          summary.addedCount += 1;
          rowMessage = `Row ${row.rowNumber} added "${name}".`;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: error?.message || 'The bicycle could not be processed.',
        });
      }

      summary.processedRows += 1;
      emitBicycleImportProgress(
        realtime,
        actorUserId,
        'processing',
        summary,
        rowMessage || `Processed row ${summary.processedRows} of ${summary.totalRows}.`,
      );
    }

    if (summary.addedCount > 0 || summary.updatedCount > 0) {
      realtime?.emitBicycleAdded?.();
    }

    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.BIKE_IMPORTED, {
      ...requestMeta,
      actorUserId,
      totalRows: summary.totalRows,
      addedCount: summary.addedCount,
      updatedCount: summary.updatedCount,
      skippedCount: summary.skippedCount,
      errorCount: summary.errorCount,
    });

    const message = summarizeImportMessage(summary);
    const stage =
      summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0
        ? 'failed'
        : 'completed';
    emitBicycleImportProgress(realtime, actorUserId, stage, summary, message);

    return (stage === 'failed' ? invalid : success)({
      message,
      summary,
    });
  }

  async function importHelmets({ actorUserId, campId, fileBuffer, fileName, requestMeta }) {
    assertCampSelected(campId);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError({
        status: 400,
        code: 'HELMET_TEMPLATE_REQUIRED',
        message: 'Select a helmet template file before uploading.',
      });
    }

    if (!String(fileName || '').toLowerCase().endsWith('.xlsx')) {
      throw new AppError({
        status: 400,
        code: 'INVALID_HELMET_TEMPLATE',
        message: 'Only .xlsx helmet template files are supported.',
      });
    }

    const permissions = await canAddOrEdit(
      actorUserId,
      BICYCLE_PERMISSIONS.addHelmet,
      BICYCLE_PERMISSIONS.editHelmet,
    );
    if (!permissions.canAdd && !permissions.canEdit) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to import helmet changes.",
      });
    }

    const rows = await readHelmetTemplateRows(fileBuffer);
    if (!rows.length) {
      throw new AppError({
        status: 400,
        code: 'EMPTY_HELMET_TEMPLATE',
        message: 'The uploaded template does not contain any helmet rows to process.',
      });
    }

    const summary = buildImportSummary(rows.length);
    const seenHelmetIds = new Set();
    const seenCodes = new Set();
    const seenNfcCodes = new Set();
    emitHelmetImportProgress(realtime, actorUserId, 'processing', summary, 'Preparing import...');

    for (const row of rows) {
      const helmetId = String(row.helmetId || '').trim().toLowerCase();
      const code = normalizeNfcCode(row.code);
      const nfcCode = normalizeNfcCode(row.nfcCode);
      let rowMessage = '';

      try {
        if (!code) throw new Error('Helmet Code is required.');
        if (!nfcCode) throw new Error('NFC Code is required.');
        validateHelmetCode(code);
        validateNfcCode(nfcCode);
        if (helmetId && !isUuid(helmetId)) throw new Error('Identifier must be a valid UUID.');
        if (helmetId && seenHelmetIds.has(helmetId)) {
          throw new Error(`Identifier ${helmetId} is duplicated in the uploaded file.`);
        }
        if (seenCodes.has(code.toLowerCase())) {
          throw new Error(`Helmet Code "${code}" is duplicated in the uploaded file.`);
        }
        if (seenNfcCodes.has(nfcCode.toLowerCase())) {
          throw new Error(`NFC Code "${nfcCode}" is duplicated in the uploaded file.`);
        }

        seenCodes.add(code.toLowerCase());
        seenNfcCodes.add(nfcCode.toLowerCase());

        if (helmetId) {
          seenHelmetIds.add(helmetId);
          if (!permissions.canEdit) throw new Error('You do not have permission to edit helmets.');
          const existing = await repository.findHelmetById({ helmetId, campId });
          if (!existing) throw new Error(`Helmet ${helmetId} was not found.`);
          await assertUniqueHelmetFields({
            campId,
            code,
            nfcCode,
            currentHelmetId: helmetId,
          });

          if (existing.code === code && existing.nfcCode === nfcCode) {
            summary.skippedCount += 1;
            rowMessage = `Row ${row.rowNumber} skipped. Helmet "${code}" was unchanged.`;
          } else {
            await repository.editHelmet({ actorUserId, campId, helmetId, code, nfcCode });
            summary.updatedCount += 1;
            rowMessage = `Row ${row.rowNumber} updated "${code}".`;
          }
        } else {
          if (!permissions.canAdd) throw new Error('You do not have permission to add helmets.');
          await assertUniqueHelmetFields({ campId, code, nfcCode });
          await repository.addHelmet({ actorUserId, campId, code, nfcCode });
          summary.addedCount += 1;
          rowMessage = `Row ${row.rowNumber} added "${code}".`;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          message: error?.message || 'The helmet could not be processed.',
        });
      }

      summary.processedRows += 1;
      emitHelmetImportProgress(
        realtime,
        actorUserId,
        'processing',
        summary,
        rowMessage || `Processed row ${summary.processedRows} of ${summary.totalRows}.`,
      );
    }

    if (summary.addedCount > 0 || summary.updatedCount > 0) {
      realtime?.emitBicycleAdded?.();
    }

    auditLog?.(AUDIT_EVENT_NAMES.BICYCLES.HELMET_IMPORTED, {
      ...requestMeta,
      actorUserId,
      totalRows: summary.totalRows,
      addedCount: summary.addedCount,
      updatedCount: summary.updatedCount,
      skippedCount: summary.skippedCount,
      errorCount: summary.errorCount,
    });

    const message = summarizeImportMessage(summary);
    const stage =
      summary.errorCount > 0 && summary.addedCount === 0 && summary.updatedCount === 0
        ? 'failed'
        : 'completed';
    emitHelmetImportProgress(realtime, actorUserId, stage, summary, message);

    return (stage === 'failed' ? invalid : success)({
      message,
      summary,
    });
  }

  return {
    addBicycle,
    addHelmet,
    deleteBicycle,
    deleteHelmet,
    downloadBicycleTemplate,
    downloadBicycleRentalReport,
    downloadHelmetTemplate,
    downloadBikeMobileApp,
    editBicycle,
    editHelmet,
    getBicyclesOverview,
    getBicyclesView,
    getActiveAssignmentsBySoldier,
    getBicycleRentalReport,
    getRecentRentalsByAsset,
    importBicycles,
    importHelmets,
    listAvailableHelmets,
    listReportAssets,
    listReportSoldiers,
    listSoldiers,
    rentBicycle,
    returnBicycle,
  };
}

module.exports = {
  BICYCLE_REPORT_FILENAME,
  BICYCLE_TEMPLATE_FILENAME,
  HELMET_TEMPLATE_FILENAME,
  createBicyclesService,
};
