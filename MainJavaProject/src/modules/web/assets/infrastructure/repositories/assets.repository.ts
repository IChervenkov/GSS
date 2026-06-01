const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');
const {
  buildAllowedOrderBy,
  buildPagination,
  normalizeCount,
} = require('../../../../../infrastructure/db/repository-utils');

const INVENTORY_STATUS_VALUES_SQL = `
  VALUES
    ('undiscovered', 'Not found', 1),
    ('completed', 'Completed', 2),
    ('written_off', 'Written off', 3)
`;

const ASSET_LOCATION_SQL = `COALESCE(NULLIF(CONCAT_WS(' / ', b.name, r.name, k.name), ''), 'Unassigned')`;
const ASSET_INVENTORY_STATUS_SQL = `COALESCE(NULLIF(a.inventory_status, ''), 'undiscovered')`;
const ASSET_LOST_STATUS_SQL = `${ASSET_INVENTORY_STATUS_SQL} IN ('undiscovered', 'written_off')`;
const ASSET_INVENTORY_LABEL_SQL = `CASE ${ASSET_INVENTORY_STATUS_SQL}
  WHEN 'undiscovered' THEN 'Not found'
  WHEN 'completed' THEN 'Completed'
  WHEN 'written_off' THEN 'Written off'
  ELSE ${ASSET_INVENTORY_STATUS_SQL}
END`;

function textNumberSql(columnSql) {
  return `CASE
    WHEN replace(COALESCE(${columnSql}, ''), ',', '.') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$'
      THEN replace(${columnSql}, ',', '.')::numeric
    ELSE 0
  END`;
}

const ASSET_QUANTITY_NUMBER_SQL = textNumberSql('a.quantity');
const DISPLAY_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (?:AM|PM)$/i;

function dateDisplaySql(columnSql) {
  return `TO_CHAR(${columnSql}::date, 'YYYY-MM-DD')`;
}

function dateTimeDisplaySql(columnSql) {
  return `TO_CHAR(${columnSql} AT TIME ZONE 'Europe/Sofia', 'YYYY-MM-DD HH12:MI AM')`;
}

function localDateTimeDisplaySql(columnSql) {
  return `TO_CHAR(${columnSql}, 'YYYY-MM-DD HH12:MI AM')`;
}

function formatSofiaDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (DISPLAY_DATE_TIME_PATTERN.test(text)) {
    return text.replace(/(am|pm)$/i, (part) => part.toUpperCase());
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .formatToParts(date)
    .reduce((values, part) => {
      values[part.type] = part.value;
      return values;
    }, {});
  const dayPeriod = String(parts.dayPeriod || '').replaceAll('.', '').toUpperCase();
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${dayPeriod}`;
}

function mapAssetRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    rfidCode: row.rfid_code || null,
    name: row.name || null,
    typeId: row.type_id || null,
    typeName: row.asset_type_label || null,
    locationRoomId: row.location_room || null,
    locationRoomName: row.room_name || null,
    locationKeyId: row.location_key || null,
    locationKeyName: row.key_name || null,
    buildingName: row.building_name || null,
    category: row.category || null,
    quantity: row.quantity || null,
    mrah: row.mrah || null,
    owner: row.asset_owner || null,
    status: row.status || null,
    expandable: row.expandable || null,
    description: row.description || null,
    inventoryStatus: row.inventory_status || 'undiscovered',
    createdAt: formatSofiaDateTime(row.created_at),
    lastInventoryDate: formatSofiaDateTime(row.last_inventory_date),
    updatedAt: formatSofiaDateTime(row.updated_at),
    service: row.service || null,
    m2Inside: row.m2_inside || null,
    purchaseDate: row.date_purchase || null,
    writtenOffDate: row.date_written_off || null,
    purchasePrice: row.purchase_price || null,
    comments: row.comments || null,
    replacedOff: row.replaced_off || null,
    replacedBy: row.replaced_by || null,
    yearOfLifeCycle: row.year_of_life_cycle || null,
    restOfLifeCycle: row.rest_of_life_cycle || null,
    restValue: row.rest_value || null,
    isFixed: row.is_fixed === null || row.is_fixed === undefined ? null : Boolean(row.is_fixed),
    isQuantitative:
      row.is_quantity === null || row.is_quantity === undefined ? null : Boolean(row.is_quantity),
  };
}

function mapRoomRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    buildingName: row.building_name || null,
    buildingType: row.building_type || null,
  };
}

function mapKeyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id || null,
    roomName: row.room_name || null,
    buildingName: row.building_name || null,
    buildingType: row.building_type || null,
    status: row.status || (row.soldier_id ? 'Occupied' : 'Free'),
  };
}

function quantityNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

async function insertMonitoringEvent(client, actorUserId, message) {
  if (!actorUserId || !message) return;
  await client.query(
    `INSERT INTO app.user_monitoring_events (username, location)
      VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
    [actorUserId, message],
  );
}

async function recordAssetAction(client, campId, column, amount) {
  const allowedColumns = new Set([
    'change_asset_quantity',
    'change_remove_asset_quantity',
    'change_lost_asset_quantity',
    'change_modificate_asset_quantity',
  ]);
  if (!campId || !allowedColumns.has(column) || Number(amount) <= 0) return;

  const current = await client.query(
    `SELECT id
       FROM app.asset_actions
      WHERE camp_id = $1
        AND changed_at = CURRENT_DATE
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [campId],
  );

  if (current.rows[0]) {
    await client.query(
      `UPDATE app.asset_actions
          SET ${column} = (
            COALESCE(NULLIF(replace(${column}, ',', '.'), ''), '0')::numeric + $2::numeric
          )::text
        WHERE id = $1`,
      [current.rows[0].id, amount],
    );
    return;
  }

  await client.query(
    `INSERT INTO app.asset_actions (changed_at, ${column}, camp_id)
      VALUES (CURRENT_DATE, $1::text, $2)`,
    [String(amount), campId],
  );
}

function mapAssetTypeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    assetCount: Number(row.asset_count) || 0,
    notFoundCount: Number(row.not_found_count) || 0,
    completedCount: Number(row.completed_count) || 0,
  };
}

function mapInventoryEventRow(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    changedAt: row.changed_at || null,
    addedQuantity: row.change_asset_quantity || null,
    removedQuantity: row.change_remove_asset_quantity || null,
    lostQuantity: row.change_lost_asset_quantity || null,
    modifiedQuantity: row.change_modificate_asset_quantity || null,
    createdAt: formatSofiaDateTime(row.created_at),
  };
}

function mapCleanItemRow(row) {
  if (!row) return null;
  const totalAmount = Number(row.total_amount) || 0;
  const countGetItem = Number(row.count_get_item) || 0;
  return {
    id: row.id,
    itemName: row.item_name,
    totalAmount,
    countGetItem,
    availableAmount: Math.max(0, totalAmount - countGetItem),
    warehouse: row.warehouse || 'large',
    campId: row.camp_id || null,
    createdAt: formatSofiaDateTime(row.created_at),
    updatedAt: formatSofiaDateTime(row.updated_at),
  };
}

function mapCleanItemSummaryRow(row = {}) {
  return {
    totalItems: Number(row.total_items) || 0,
    totalAmount: String(row.total_amount ?? '0'),
    largeTotalAmount: String(row.large_total_amount ?? '0'),
    smallTotalAmount: String(row.small_total_amount ?? '0'),
    checkedOutAmount: String(row.checked_out_amount ?? '0'),
    largeCheckedOutAmount: String(row.large_checked_out_amount ?? '0'),
    smallCheckedOutAmount: String(row.small_checked_out_amount ?? '0'),
  };
}

function mapAssetSummaryRow(row = {}) {
  return {
    totalAssets: Number(row.total_assets) || 0,
    totalQuantity: String(row.total_quantity ?? '0'),
    notFoundAssets: Number(row.not_found_assets) || 0,
    completedAssets: Number(row.completed_assets) || 0,
    typeCount: Number(row.type_count) || 0,
  };
}

function buildIlikeFilters({ filters = [], allowedColumns = {}, startIndex = 1 }) {
  const params = [];
  const where = [];

  for (const filter of filters) {
    const columnSql = allowedColumns[filter?.column];
    const rawValue = typeof filter?.value === 'string' ? filter.value.trim() : '';
    if (!columnSql || rawValue.length === 0) continue;

    params.push(`%${rawValue}%`);
    where.push(`${columnSql} ILIKE $${startIndex + params.length - 1}`);
  }

  return { params, where };
}

function tableResult({ rows, total, sourceTotal, page, limit, sortColumn, sortDirection, filters }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    rows,
    total,
    sourceTotal,
    page,
    limit,
    totalPages,
    sortColumn: sortColumn || null,
    sortDirection: sortColumn ? sortDirection : 'default',
    filters,
  };
}

function filtersToObject(filters = []) {
  return filters.reduce((acc, filter) => {
    if (filter?.column && filter?.value) acc[filter.column] = filter.value;
    return acc;
  }, {});
}

async function listPagedBaseQuery({
  client,
  selectSql,
  fromSql,
  baseWhere,
  sourceCountSql,
  campId,
  filters = [],
  allowedFilters,
  sort = {},
  allowedSorts,
  defaultSort,
  mapRow,
}) {
  const filterResult = buildIlikeFilters({
    filters,
    allowedColumns: allowedFilters,
    startIndex: 2,
  });
  const params = [campId, ...filterResult.params];
  const whereSql = [baseWhere, ...filterResult.where].filter(Boolean).join(' AND ');
  const requestedPage = Math.max(1, Number(sort.page) || 1);
  const limit = Math.min(Math.max(Number(sort.limit) || 10, 1), 100);
  const countSql = `SELECT COUNT(*)::int AS count ${fromSql} WHERE ${whereSql}`;

  const [countResult, sourceCountResult] = await Promise.all([
    client.query(countSql, params),
    client.query(sourceCountSql, [campId]),
  ]);

  const total = normalizeCount(countResult.rows[0]?.count);
  const sourceTotal = normalizeCount(sourceCountResult.rows[0]?.count);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const pagination = buildPagination({ page, limit, baseParamCount: params.length });
  const sortSql = buildAllowedOrderBy({
    sort,
    allowedSorts,
    defaultSql: defaultSort,
  });

  const dataResult = await client.query(
    `${selectSql}
       ${fromSql}
      WHERE ${whereSql}
      ORDER BY ${sortSql}
      LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`,
    [...params, pagination.limit, pagination.offset],
  );

  return tableResult({
    rows: dataResult.rows.map(mapRow),
    total,
    sourceTotal,
    page,
    limit,
    sortColumn: sort.column,
    sortDirection: sort.direction,
    filters: filtersToObject(filters),
  });
}

async function listUserPermissions({ userId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT p.name AS name
         FROM app.user_permissions up
         JOIN app.permissions p ON p.id = up.permission_id
        WHERE up.user_id = $1
        ORDER BY p.name ASC`,
      [userId],
    );

    return result.rows;
  });
}

async function listAssetsByCamp({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          a.id,
          a.code,
          a.rfid_code,
          a.name,
          a.type_id,
          at.name AS asset_type_label,
          a.location_room,
          r.name AS room_name,
          a.location_key,
          k.name AS key_name,
          b.name AS building_name,
          a.category,
          a.quantity,
          a.mrah,
          a.asset_owner,
          a.status,
          a.expandable,
          a.description,
          COALESCE(NULLIF(a.inventory_status, ''), 'undiscovered') AS inventory_status,
          ${dateTimeDisplaySql('a.created_at')} AS created_at,
          ${dateTimeDisplaySql('a.last_inventory_date')} AS last_inventory_date,
          ${dateTimeDisplaySql('a.updated_at')} AS updated_at,
          a.service,
          a.m2_inside,
          a.date_purchase,
          a.date_written_off,
          a.purchase_price,
          a.comments,
          a.replaced_off,
          a.replaced_by,
          a.year_of_life_cycle,
          a.rest_of_life_cycle,
          a.rest_value,
          a.is_fixed,
          a.is_quantity
         FROM app.assets a
         LEFT JOIN app.asset_types at ON at.id = a.type_id
         LEFT JOIN app.rooms r ON r.id = a.location_room
         LEFT JOIN app.keys k ON k.id = a.location_key
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
        WHERE a.camp_id = $1
        ORDER BY a.code ASC, a.id ASC`,
      [campId],
    );

    return result.rows.map(mapAssetRow);
  });
}

async function findAssetById({ assetId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          a.id,
          a.code,
          a.rfid_code,
          a.name,
          a.type_id,
          at.name AS asset_type_label,
          a.location_room,
          r.name AS room_name,
          a.location_key,
          k.name AS key_name,
          b.name AS building_name,
          a.category,
          a.quantity,
          a.mrah,
          a.asset_owner,
          a.status,
          a.expandable,
          a.description,
          ${ASSET_INVENTORY_STATUS_SQL} AS inventory_status,
          ${dateTimeDisplaySql('a.created_at')} AS created_at,
          ${dateTimeDisplaySql('a.last_inventory_date')} AS last_inventory_date,
          ${dateTimeDisplaySql('a.updated_at')} AS updated_at,
          a.service,
          a.m2_inside,
          a.date_purchase,
          a.date_written_off,
          a.purchase_price,
          a.comments,
          a.replaced_off,
          a.replaced_by,
          a.year_of_life_cycle,
          a.rest_of_life_cycle,
          a.rest_value,
          a.is_fixed,
          a.is_quantity
         FROM app.assets a
         LEFT JOIN app.asset_types at ON at.id = a.type_id
         LEFT JOIN app.rooms r ON r.id = a.location_room
         LEFT JOIN app.keys k ON k.id = a.location_key
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
        WHERE a.id = $1
          AND a.camp_id = $2
        LIMIT 1`,
      [assetId, campId],
    );

    return mapAssetRow(result.rows[0]);
  });
}

async function findAssetByCode({ code, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, code, name, quantity, camp_id, created_at, updated_at
         FROM app.assets
        WHERE LOWER(code) = LOWER($1)
          AND camp_id = $2
        LIMIT 1`,
      [code, campId],
    );

    return mapAssetRow(result.rows[0]);
  });
}

async function findAssetByRfid({ rfidCode, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          a.id,
          a.code,
          a.rfid_code,
          a.name,
          a.type_id,
          at.name AS asset_type_label,
          a.location_room,
          r.name AS room_name,
          a.location_key,
          k.name AS key_name,
          b.name AS building_name,
          a.category,
          a.quantity,
          a.mrah,
          a.asset_owner,
          a.status,
          a.expandable,
          a.description,
          ${ASSET_INVENTORY_STATUS_SQL} AS inventory_status,
          ${dateTimeDisplaySql('a.created_at')} AS created_at,
          ${dateTimeDisplaySql('a.last_inventory_date')} AS last_inventory_date,
          ${dateTimeDisplaySql('a.updated_at')} AS updated_at,
          a.service,
          a.m2_inside,
          a.date_purchase,
          a.date_written_off,
          a.purchase_price,
          a.comments,
          a.replaced_off,
          a.replaced_by,
          a.year_of_life_cycle,
          a.rest_of_life_cycle,
          a.rest_value,
          a.is_fixed,
          a.is_quantity
         FROM app.assets a
         LEFT JOIN app.asset_types at ON at.id = a.type_id
         LEFT JOIN app.rooms r ON r.id = a.location_room
         LEFT JOIN app.keys k ON k.id = a.location_key
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
        WHERE LOWER(a.rfid_code) = LOWER($1)
          AND a.camp_id = $2
        LIMIT 1`,
      [rfidCode, campId],
    );

    return mapAssetRow(result.rows[0]);
  });
}

async function listRoomsByCamp({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          r.id,
          r.name,
          b.name AS building_name,
          b.type AS building_type
         FROM app.rooms r
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
        WHERE r.camp_id = $1
        ORDER BY b.name ASC NULLS LAST, r.name ASC`,
      [campId],
    );

    return result.rows.map(mapRoomRow);
  });
}

async function listKeysByCamp({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          k.id,
          k.name,
          r.id AS room_id,
          r.name AS room_name,
          b.name AS building_name,
          b.type AS building_type,
          CASE WHEN k.soldier_id IS NULL THEN 'Free' ELSE 'Occupied' END AS status
         FROM app.keys k
         LEFT JOIN app.room_keys rk ON rk.key_id = k.id
         LEFT JOIN app.rooms r ON r.id = rk.room_id
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id
        WHERE k.camp_id = $1
        ORDER BY b.name ASC NULLS LAST, r.name ASC NULLS LAST, k.name ASC`,
      [campId],
    );

    return result.rows.map(mapKeyRow);
  });
}

async function getAssetSummary({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          COUNT(a.id)::int AS total_assets,
          COALESCE(SUM(${ASSET_QUANTITY_NUMBER_SQL}), 0)::text AS total_quantity,
          COUNT(a.id) FILTER (WHERE ${ASSET_LOST_STATUS_SQL})::int AS not_found_assets,
          COUNT(a.id) FILTER (WHERE ${ASSET_INVENTORY_STATUS_SQL} = 'completed')::int AS completed_assets,
          (SELECT COUNT(*)::int FROM app.asset_types) AS type_count
         FROM app.assets a
        WHERE a.camp_id = $1`,
      [campId],
    );

    return mapAssetSummaryRow(result.rows[0]);
  });
}

function buildAssetTableOptions({ campId, state = {}, notFoundOnly = false }) {
  const fromSql = `FROM app.assets a
         LEFT JOIN app.asset_types at ON at.id = a.type_id
         LEFT JOIN app.rooms r ON r.id = a.location_room
         LEFT JOIN app.keys k ON k.id = a.location_key
         LEFT JOIN app.building_rooms br ON br.room_id = r.id
         LEFT JOIN app.buildings b ON b.id = br.build_id`;
  const selectSql = `SELECT
          a.id,
          a.code,
          a.rfid_code,
          a.name,
          a.type_id,
          at.name AS asset_type_label,
          a.location_room,
          r.name AS room_name,
          a.location_key,
          k.name AS key_name,
          b.name AS building_name,
          a.category,
          a.quantity,
          a.mrah,
          a.asset_owner,
          a.status,
          a.expandable,
          a.description,
          ${ASSET_INVENTORY_STATUS_SQL} AS inventory_status,
          ${dateTimeDisplaySql('a.created_at')} AS created_at,
          ${dateTimeDisplaySql('a.last_inventory_date')} AS last_inventory_date,
          ${dateTimeDisplaySql('a.updated_at')} AS updated_at,
          a.service,
          a.m2_inside,
          a.date_purchase,
          a.date_written_off,
          a.purchase_price,
          a.comments,
          a.replaced_off,
          a.replaced_by,
          a.year_of_life_cycle,
          a.rest_of_life_cycle,
          a.rest_value,
          a.is_fixed,
          a.is_quantity`;
  const baseWhere = notFoundOnly ? `a.camp_id = $1 AND ${ASSET_LOST_STATUS_SQL}` : 'a.camp_id = $1';
  const sourceCountSql = notFoundOnly
    ? `SELECT COUNT(*)::int AS count
         FROM app.assets a
        WHERE a.camp_id = $1
          AND ${ASSET_LOST_STATUS_SQL}`
    : 'SELECT COUNT(*)::int AS count FROM app.assets a WHERE a.camp_id = $1';
  const allowedFilters = {
    id: 'a.id::text',
    code: 'a.code::text',
    rfidCode: 'a.rfid_code::text',
    name: 'a.name::text',
    typeName: 'at.name::text',
    location: ASSET_LOCATION_SQL,
    status: 'a.status::text',
    inventoryStatus: `(${ASSET_INVENTORY_LABEL_SQL} || ' ' || ${ASSET_INVENTORY_STATUS_SQL})`,
    lastInventoryDate: dateTimeDisplaySql('a.last_inventory_date'),
    owner: 'a.asset_owner::text',
    category: 'a.category::text',
    service: 'a.service::text',
    expandable: 'a.expandable::text',
    isFixedLabel: "CASE WHEN COALESCE(a.is_fixed, false) THEN 'Yes' ELSE 'No' END",
    isQuantitativeLabel: "CASE WHEN COALESCE(a.is_quantity, false) THEN 'Yes' ELSE 'No' END",
    description: 'a.description::text',
    mrah: 'a.mrah::text',
    m2Inside: 'a.m2_inside::text',
    comments: 'a.comments::text',
    replacedOff: 'a.replaced_off::text',
    replacedBy: 'a.replaced_by::text',
    yearOfLifeCycle: 'a.year_of_life_cycle::text',
    restOfLifeCycle: 'a.rest_of_life_cycle::text',
    restValue: 'a.rest_value::text',
    purchaseDate: localDateTimeDisplaySql('a.date_purchase'),
    writtenOffDate: localDateTimeDisplaySql('a.date_written_off'),
    purchasePrice: 'a.purchase_price::text',
    createdAt: dateTimeDisplaySql('a.created_at'),
    updatedAt: dateTimeDisplaySql('a.updated_at'),
  };
  const allowedSorts = {
    id: 'a.id',
    code: 'a.code',
    rfidCode: 'a.rfid_code',
    name: 'a.name',
    typeName: 'at.name',
    location: ASSET_LOCATION_SQL,
    quantity: ASSET_QUANTITY_NUMBER_SQL,
    status: 'a.status',
    inventoryStatus: ASSET_INVENTORY_LABEL_SQL,
    lastInventoryDate: 'a.last_inventory_date',
    owner: 'a.asset_owner',
    category: 'a.category',
    service: 'a.service',
    expandable: 'a.expandable',
    isFixedLabel: 'a.is_fixed',
    isQuantitativeLabel: 'a.is_quantity',
    description: 'a.description',
    mrah: 'a.mrah',
    m2Inside: 'a.m2_inside',
    comments: 'a.comments',
    replacedOff: 'a.replaced_off',
    replacedBy: 'a.replaced_by',
    yearOfLifeCycle: 'a.year_of_life_cycle',
    restOfLifeCycle: 'a.rest_of_life_cycle',
    restValue: 'a.rest_value',
    purchaseDate: 'a.date_purchase',
    writtenOffDate: 'a.date_written_off',
    purchasePrice: 'a.purchase_price',
    createdAt: 'a.created_at',
    updatedAt: 'a.updated_at',
  };

  return {
    campId,
    selectSql,
    fromSql,
    baseWhere,
    sourceCountSql,
    filters: state.filters,
    allowedFilters,
    sort: {
      page: state.page,
      limit: state.limit,
      column: state.sortColumn,
      direction: state.sortDirection,
    },
    allowedSorts,
    defaultSort: 'a.code ASC, a.id ASC',
    mapRow: mapAssetRow,
  };
}

async function listAssetsTable({ campId, state = {} }) {
  return withClient((client) =>
    listPagedBaseQuery({
      client,
      ...buildAssetTableOptions({ campId, state, notFoundOnly: false }),
    }),
  );
}

async function listNotFoundAssetsTable({ campId, state = {} }) {
  return withClient((client) =>
    listPagedBaseQuery({
      client,
      ...buildAssetTableOptions({ campId, state, notFoundOnly: true }),
    }),
  );
}

async function listAssetTypesByCamp({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          at.id,
          at.name,
          COUNT(a.id)::int AS asset_count,
          COUNT(a.id) FILTER (
            WHERE COALESCE(NULLIF(a.inventory_status, ''), 'undiscovered') IN ('undiscovered', 'written_off')
          )::int AS not_found_count,
          COUNT(a.id) FILTER (
            WHERE COALESCE(NULLIF(a.inventory_status, ''), 'undiscovered') = 'completed'
          )::int AS completed_count
         FROM app.asset_types at
         LEFT JOIN app.assets a
           ON a.type_id = at.id
          AND a.camp_id = $1
        GROUP BY at.id, at.name
        ORDER BY at.name ASC`,
      [campId],
    );

    return result.rows.map(mapAssetTypeRow);
  });
}

async function listInventoryStatusTable({ campId, state = {} }) {
  return withClient(async (client) => {
    const filterResult = buildIlikeFilters({
      filters: state.filters,
      allowedColumns: {
        status: "(status_label || ' ' || status)",
        lastInventoryDate: dateTimeDisplaySql('last_inventory_date'),
      },
      startIndex: 2,
    });
    const params = [campId, ...filterResult.params];
    const cteSql = `WITH statuses(status, status_label, sort_order) AS (${INVENTORY_STATUS_VALUES_SQL}),
      counts AS (
        SELECT
          ${ASSET_INVENTORY_STATUS_SQL} AS status,
          COUNT(a.id)::int AS asset_count,
          COALESCE(SUM(${ASSET_QUANTITY_NUMBER_SQL}), 0) AS quantity,
          MAX(a.last_inventory_date) AS last_inventory_date
         FROM app.assets a
        WHERE a.camp_id = $1
        GROUP BY ${ASSET_INVENTORY_STATUS_SQL}
      ),
      rows AS (
        SELECT
          s.status,
          s.status_label,
          s.sort_order,
          COALESCE(c.asset_count, 0)::int AS asset_count,
          COALESCE(c.quantity, 0)::text AS quantity,
          c.last_inventory_date
         FROM statuses s
         LEFT JOIN counts c ON c.status = s.status
      )`;
    const whereSql = filterResult.where.length ? `WHERE ${filterResult.where.join(' AND ')}` : '';
    const countResult = await client.query(
      `${cteSql} SELECT COUNT(*)::int AS count FROM rows ${whereSql}`,
      params,
    );
    const total = normalizeCount(countResult.rows[0]?.count);
    const limit = Math.min(Math.max(Number(state.limit) || 10, 1), 100);
    const requestedPage = Math.max(1, Number(state.page) || 1);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });
    const quantitySortSql = `CASE
      WHEN replace(COALESCE(quantity, ''), ',', '.') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$'
        THEN replace(quantity, ',', '.')::numeric
      ELSE 0
    END`;
    const sortSql = buildAllowedOrderBy({
      sort: { column: state.sortColumn, direction: state.sortDirection },
      allowedSorts: {
        status: 'status_label',
        assetCount: 'asset_count',
        quantity: quantitySortSql,
        lastInventoryDate: 'last_inventory_date',
      },
      defaultSql: 'sort_order ASC',
    });
    const dataResult = await client.query(
      `${cteSql}
       SELECT
          status,
          status_label,
          asset_count,
          quantity,
          ${dateTimeDisplaySql('last_inventory_date')} AS last_inventory_date
         FROM rows
         ${whereSql}
        ORDER BY ${sortSql}
        LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`,
      [...params, pagination.limit, pagination.offset],
    );

    return tableResult({
      rows: dataResult.rows.map((row) => ({
        status: row.status,
        label: row.status_label,
        assetCount: Number(row.asset_count) || 0,
        quantity: row.quantity || '0',
        lastInventoryDate: row.last_inventory_date || null,
      })),
      total,
      sourceTotal: 3,
      page,
      limit,
      sortColumn: state.sortColumn,
      sortDirection: state.sortDirection,
      filters: filtersToObject(state.filters),
    });
  });
}

async function listAssetTypesTable({ campId, state = {} }) {
  return withClient(async (client) => {
    const filterResult = buildIlikeFilters({
      filters: state.filters,
      allowedColumns: { id: 'id::text', name: 'name::text' },
      startIndex: 2,
    });
    const params = [campId, ...filterResult.params];
    const cteSql = `WITH rows AS (
        SELECT
          at.id,
          at.name,
          COUNT(a.id)::int AS asset_count,
          COUNT(a.id) FILTER (
            WHERE ${ASSET_LOST_STATUS_SQL}
          )::int AS not_found_count,
          COUNT(a.id) FILTER (
            WHERE ${ASSET_INVENTORY_STATUS_SQL} = 'completed'
          )::int AS completed_count
         FROM app.asset_types at
         LEFT JOIN app.assets a
           ON a.type_id = at.id
          AND a.camp_id = $1
        GROUP BY at.id, at.name
      )`;
    const whereSql = filterResult.where.length ? `WHERE ${filterResult.where.join(' AND ')}` : '';
    const [countResult, sourceCountResult] = await Promise.all([
      client.query(`${cteSql} SELECT COUNT(*)::int AS count FROM rows ${whereSql}`, params),
      client.query('SELECT COUNT(*)::int AS count FROM app.asset_types'),
    ]);
    const total = normalizeCount(countResult.rows[0]?.count);
    const sourceTotal = normalizeCount(sourceCountResult.rows[0]?.count);
    const limit = Math.min(Math.max(Number(state.limit) || 10, 1), 100);
    const requestedPage = Math.max(1, Number(state.page) || 1);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });
    const sortSql = buildAllowedOrderBy({
      sort: { column: state.sortColumn, direction: state.sortDirection },
      allowedSorts: {
        id: 'id',
        name: 'name',
        assetCount: 'asset_count',
        notFoundCount: 'not_found_count',
        completedCount: 'completed_count',
      },
      defaultSql: 'name ASC',
    });
    const dataResult = await client.query(
      `${cteSql}
       SELECT id, name, asset_count, not_found_count, completed_count
         FROM rows
         ${whereSql}
        ORDER BY ${sortSql}
        LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`,
      [...params, pagination.limit, pagination.offset],
    );

    return tableResult({
      rows: dataResult.rows.map(mapAssetTypeRow),
      total,
      sourceTotal,
      page,
      limit,
      sortColumn: state.sortColumn,
      sortDirection: state.sortDirection,
      filters: filtersToObject(state.filters),
    });
  });
}

async function findAssetTypeById({ typeId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          at.id,
          at.name,
          COUNT(a.id)::int AS asset_count,
          COUNT(a.id) FILTER (
            WHERE ${ASSET_LOST_STATUS_SQL}
          )::int AS not_found_count,
          COUNT(a.id) FILTER (
            WHERE ${ASSET_INVENTORY_STATUS_SQL} = 'completed'
          )::int AS completed_count
         FROM app.asset_types at
         LEFT JOIN app.assets a ON a.type_id = at.id
        WHERE at.id = $1
        GROUP BY at.id, at.name
        LIMIT 1`,
      [typeId],
    );

    return mapAssetTypeRow(result.rows[0]);
  });
}

async function findAssetTypeByName({ name }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          at.id,
          at.name,
          COUNT(a.id)::int AS asset_count,
          COUNT(a.id) FILTER (
            WHERE ${ASSET_LOST_STATUS_SQL}
          )::int AS not_found_count,
          COUNT(a.id) FILTER (
            WHERE ${ASSET_INVENTORY_STATUS_SQL} = 'completed'
          )::int AS completed_count
         FROM app.asset_types at
         LEFT JOIN app.assets a ON a.type_id = at.id
        WHERE LOWER(at.name) = LOWER($1)
        GROUP BY at.id, at.name
        LIMIT 1`,
      [name],
    );

    return mapAssetTypeRow(result.rows[0]);
  });
}

async function addAssetType({ actorUserId, name }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.asset_types (name)
        VALUES ($1)
        RETURNING id, name, 0::int AS asset_count, 0::int AS not_found_count, 0::int AS completed_count`,
      [name],
    );
    await insertMonitoringEvent(client, actorUserId, `Asset type ${name} added`);
    return mapAssetTypeRow(result.rows[0]);
  });
}

async function editAssetType({ actorUserId, typeId, name }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.asset_types
          SET name = $2
        WHERE id = $1
        RETURNING id, name`,
      [typeId, name],
    );
    if (result.rows[0]) {
      await insertMonitoringEvent(client, actorUserId, `Asset type ${name} updated`);
    }
    if (!result.rows[0]) return null;
    return mapAssetTypeRow({
      ...result.rows[0],
      asset_count: 0,
      not_found_count: 0,
      completed_count: 0,
    });
  });
}

async function deleteAssetType({ actorUserId, typeId }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT
          at.id,
          at.name,
          COUNT(a.id)::int AS asset_count
         FROM app.asset_types at
         LEFT JOIN app.assets a ON a.type_id = at.id
        WHERE at.id = $1
        GROUP BY at.id, at.name
        LIMIT 1`,
      [typeId],
    );
    if (!current.rows[0]) return null;

    if (Number(current.rows[0].asset_count) > 0) {
      return {
        blocked: true,
        id: current.rows[0].id,
        name: current.rows[0].name,
        assetCount: Number(current.rows[0].asset_count) || 0,
      };
    }

    const deleted = await client.query(
      `DELETE FROM app.asset_types at
        WHERE at.id = $1
          AND NOT EXISTS (
            SELECT 1
              FROM app.assets a
             WHERE a.type_id = at.id
          )
        RETURNING at.id`,
      [typeId],
    );
    if (!deleted.rows[0]) {
      return { blocked: true, id: current.rows[0].id, name: current.rows[0].name, assetCount: 1 };
    }

    await insertMonitoringEvent(
      client,
      actorUserId,
      `Asset type ${current.rows[0].name} deleted`,
    );
    return { id: current.rows[0].id, name: current.rows[0].name };
  });
}

async function bulkUpsertAssetTypes({ actorUserId, rows }) {
  const results = [];
  for (const row of rows) {
    /* eslint-disable no-await-in-loop */
    if (row.id) {
      const type = await editAssetType({ actorUserId, typeId: row.id, name: row.name });
      results.push({ action: type ? 'updated' : 'missing', type });
    } else {
      const type = await addAssetType({ actorUserId, name: row.name });
      results.push({ action: 'added', type });
    }
    /* eslint-enable no-await-in-loop */
  }
  return results;
}

async function getCleanItemSummary({ campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          COUNT(id)::int AS total_items,
          COALESCE(SUM(total_amount), 0)::text AS total_amount,
          COALESCE(SUM(total_amount) FILTER (WHERE warehouse = 'large'), 0)::text AS large_total_amount,
          COALESCE(SUM(total_amount) FILTER (WHERE warehouse = 'small'), 0)::text AS small_total_amount,
          COALESCE(SUM(count_get_item), 0)::text AS checked_out_amount,
          COALESCE(SUM(count_get_item) FILTER (WHERE warehouse = 'large'), 0)::text AS large_checked_out_amount,
          COALESCE(SUM(count_get_item) FILTER (WHERE warehouse = 'small'), 0)::text AS small_checked_out_amount
         FROM app.clean_items
        WHERE camp_id = $1`,
      [campId],
    );

    return mapCleanItemSummaryRow(result.rows[0]);
  });
}

async function listCleanItemsTable({ campId, state = {} }) {
  return withClient((client) =>
    listPagedBaseQuery({
      client,
      campId,
      selectSql: `SELECT
          ci.id,
          ci.item_name,
          ci.total_amount,
          ci.count_get_item,
          ci.warehouse,
          ci.camp_id,
          ${dateTimeDisplaySql('ci.created_at')} AS created_at,
          ${dateTimeDisplaySql('ci.updated_at')} AS updated_at`,
      fromSql: 'FROM app.clean_items ci',
      baseWhere: 'ci.camp_id = $1',
      sourceCountSql: 'SELECT COUNT(*)::int AS count FROM app.clean_items ci WHERE ci.camp_id = $1',
      filters: state.filters,
      allowedFilters: {
        id: 'ci.id::text',
        itemName: 'ci.item_name::text',
        warehouse: `CASE ci.warehouse WHEN 'large' THEN 'Large warehouse' WHEN 'small' THEN 'Small warehouse' ELSE ci.warehouse END`,
        createdAt: dateTimeDisplaySql('ci.created_at'),
        updatedAt: dateTimeDisplaySql('ci.updated_at'),
      },
      sort: {
        page: state.page,
        limit: state.limit,
        column: state.sortColumn,
        direction: state.sortDirection,
      },
      allowedSorts: {
        id: 'ci.id',
        itemName: 'ci.item_name',
        totalAmount: 'ci.total_amount',
        countGetItem: 'ci.count_get_item',
        availableAmount: '(ci.total_amount - ci.count_get_item)',
        warehouse: 'ci.warehouse',
        createdAt: 'ci.created_at',
        updatedAt: 'ci.updated_at',
      },
      defaultSort: 'ci.warehouse ASC, ci.item_name ASC, ci.id ASC',
      mapRow: mapCleanItemRow,
    }),
  );
}

async function findCleanItemById({ itemId, campId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, item_name, total_amount, count_get_item, warehouse, camp_id, created_at, updated_at
         FROM app.clean_items
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );

    return mapCleanItemRow(result.rows[0]);
  });
}

async function findCleanItemByNameAndWarehouse({ campId, itemName, warehouse }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, item_name, total_amount, count_get_item, warehouse, camp_id, created_at, updated_at
         FROM app.clean_items
        WHERE camp_id = $1
          AND LOWER(item_name) = LOWER($2)
          AND warehouse = $3
        LIMIT 1`,
      [campId, itemName, warehouse],
    );

    return mapCleanItemRow(result.rows[0]);
  });
}

async function addCleanItem({ actorUserId, campId, payload }) {
  return withTransaction(async (client) => {
    const largeResult = await client.query(
      `INSERT INTO app.clean_items (item_name, total_amount, count_get_item, warehouse, camp_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, item_name, total_amount, count_get_item, warehouse, camp_id, created_at, updated_at`,
      [payload.itemName, payload.totalAmount, payload.countGetItem, 'large', campId],
    );
    await client.query(
      `INSERT INTO app.clean_items (item_name, total_amount, count_get_item, warehouse, camp_id)
        VALUES ($1, 0, 0, 'small', $2)
        ON CONFLICT (item_name, camp_id, warehouse) DO NOTHING`,
      [payload.itemName, campId],
    );
    await client.query(
      `INSERT INTO app.clean_item_events (item_name, amount, changed_at, description, camp_id)
        VALUES ($1, $2, NOW(), $3, $4)`,
      [payload.itemName, payload.totalAmount, 'Added to large warehouse', campId],
    );
    await insertMonitoringEvent(client, actorUserId, `Clean item ${payload.itemName} added`);
    return mapCleanItemRow(largeResult.rows[0]);
  });
}

async function editCleanItem({ actorUserId, campId, itemId, payload }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, item_name, total_amount, count_get_item, warehouse
         FROM app.clean_items
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );
    if (!current.rows[0]) return null;

    const currentTotal = Number(current.rows[0].total_amount) || 0;
    const currentCheckedOut = Number(current.rows[0].count_get_item) || 0;
    const currentQuantity = Math.max(0, currentTotal - currentCheckedOut);
    const requestedQuantity = Number(payload.totalAmount) || 0;
    const isLargeWarehouse = current.rows[0].warehouse === 'large';
    const nextTotal = isLargeWarehouse
      ? currentTotal + Math.max(0, requestedQuantity - currentQuantity)
      : currentTotal;
    const nextCheckedOut = isLargeWarehouse
      ? currentCheckedOut
      : currentCheckedOut + Math.max(0, currentQuantity - requestedQuantity);

    await client.query(
      `UPDATE app.clean_items
          SET item_name = $3,
              updated_at = NOW()
        WHERE camp_id = $1
          AND LOWER(item_name) = LOWER($2)`,
      [campId, current.rows[0].item_name, payload.itemName],
    );

    const result = await client.query(
      `UPDATE app.clean_items
          SET item_name = $3,
              total_amount = $4,
              count_get_item = $5,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING id, item_name, total_amount, count_get_item, warehouse, camp_id, created_at, updated_at`,
      [itemId, campId, payload.itemName, nextTotal, nextCheckedOut],
    );
    if (result.rows[0]) {
      await client.query(
        `INSERT INTO app.clean_item_events (item_name, amount, changed_at, description, camp_id)
          VALUES ($1, $2, NOW(), $3, $4)`,
        [payload.itemName, requestedQuantity, 'Clean item updated', campId],
      );
      await insertMonitoringEvent(client, actorUserId, `Clean item ${payload.itemName} updated`);
    }
    return mapCleanItemRow(result.rows[0]);
  });
}

async function moveCleanItem({ actorUserId, campId, itemId, warehouse, quantity }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, item_name, total_amount, count_get_item, warehouse
         FROM app.clean_items
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );
    if (!current.rows[0]) return null;

    await client.query(
      `UPDATE app.clean_items
          SET count_get_item = count_get_item + $3,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2`,
      [itemId, campId, quantity],
    );
    if (warehouse === 'small') {
      await client.query(
        `INSERT INTO app.clean_items (item_name, total_amount, count_get_item, warehouse, camp_id)
          VALUES ($1, 0, 0, 'small', $2)
          ON CONFLICT (item_name, camp_id, warehouse) DO NOTHING`,
        [current.rows[0].item_name, campId],
      );
      await client.query(
        `UPDATE app.clean_items
            SET total_amount = total_amount + $4,
                updated_at = NOW()
          WHERE camp_id = $1
            AND LOWER(item_name) = LOWER($2)
            AND warehouse = $3`,
        [campId, current.rows[0].item_name, warehouse, quantity],
      );
    } else {
      await client.query(
        `INSERT INTO app.clean_items (item_name, total_amount, count_get_item, warehouse, camp_id)
          VALUES ($1, $2, 0, 'large', $3)
          ON CONFLICT (item_name, camp_id, warehouse) DO NOTHING`,
        [current.rows[0].item_name, quantity, campId],
      );
      await client.query(
        `UPDATE app.clean_items
            SET total_amount = total_amount + GREATEST($4::numeric - count_get_item, 0),
                count_get_item = GREATEST(count_get_item - $4::numeric, 0),
                updated_at = NOW()
          WHERE camp_id = $1
            AND LOWER(item_name) = LOWER($2)
            AND warehouse = $3`,
        [campId, current.rows[0].item_name, warehouse, quantity],
      );
    }

    const result = await client.query(
      `SELECT id, item_name, total_amount, count_get_item, warehouse, camp_id, created_at, updated_at
         FROM app.clean_items
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );
    await client.query(
      `INSERT INTO app.clean_item_events (item_name, amount, changed_at, description, camp_id)
        VALUES ($1, $2, NOW(), $3, $4)`,
      [
        current.rows[0].item_name,
        quantity,
        `Moved to ${warehouse} warehouse`,
        campId,
      ],
    );
    await insertMonitoringEvent(client, actorUserId, `Clean item ${current.rows[0].item_name} moved`);
    return mapCleanItemRow(result.rows[0]);
  });
}

async function deleteCleanItem({ actorUserId, campId, itemId }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, item_name, total_amount
         FROM app.clean_items
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [itemId, campId],
    );
    if (!current.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.clean_items
        WHERE camp_id = $1
          AND LOWER(item_name) = LOWER($2)
        RETURNING id`,
      [campId, current.rows[0].item_name],
    );
    if (!deleted.rows[0]) return null;

    await client.query(
      `INSERT INTO app.clean_item_events (item_name, amount, changed_at, description, camp_id)
        VALUES ($1, $2, NOW(), $3, $4)`,
      [current.rows[0].item_name, current.rows[0].total_amount, 'Clean item deleted', campId],
    );
    await insertMonitoringEvent(client, actorUserId, `Clean item ${current.rows[0].item_name} deleted`);
    return { id: current.rows[0].id, itemName: current.rows[0].item_name };
  });
}

async function bulkUpsertCleanItems({ actorUserId, campId, rows }) {
  const results = [];
  for (const row of rows) {
    /* eslint-disable no-await-in-loop */
    if (row.id) {
      const item = await editCleanItem({ actorUserId, campId, itemId: row.id, payload: row });
      results.push({ action: item ? 'updated' : 'missing', item });
    } else {
      const item = await addCleanItem({ actorUserId, campId, payload: row });
      results.push({ action: 'added', item });
    }
    /* eslint-enable no-await-in-loop */
  }
  return results;
}

async function listInventoryEventsByCamp({ campId, limit = 20 }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
          id,
          ${dateDisplaySql('changed_at')} AS changed_at,
          change_asset_quantity,
          change_remove_asset_quantity,
          change_lost_asset_quantity,
          change_modificate_asset_quantity,
          created_at
         FROM app.asset_actions
        WHERE camp_id = $1
        ORDER BY changed_at DESC, created_at DESC, id DESC
        LIMIT $2`,
      [campId, Math.min(Math.max(Number(limit) || 20, 1), 50)],
    );

    return result.rows.map(mapInventoryEventRow);
  });
}

async function listInventoryEventsTable({ campId, state = {} }) {
  return withClient((client) =>
    listPagedBaseQuery({
      client,
      campId,
      selectSql: `SELECT
          id,
          ${dateDisplaySql('aa.changed_at')} AS changed_at,
          change_asset_quantity,
          change_remove_asset_quantity,
          change_lost_asset_quantity,
          change_modificate_asset_quantity,
          created_at`,
      fromSql: 'FROM app.asset_actions aa',
      baseWhere: 'aa.camp_id = $1',
      sourceCountSql: 'SELECT COUNT(*)::int AS count FROM app.asset_actions aa WHERE aa.camp_id = $1',
      filters: state.filters,
      allowedFilters: {
        changedAt: dateDisplaySql('aa.changed_at'),
        createdAt: dateTimeDisplaySql('aa.created_at'),
      },
      sort: {
        page: state.page,
        limit: state.limit,
        column: state.sortColumn,
        direction: state.sortDirection,
      },
      allowedSorts: {
        changedAt: 'aa.changed_at',
        addedQuantity: textNumberSql('aa.change_asset_quantity'),
        removedQuantity: textNumberSql('aa.change_remove_asset_quantity'),
        lostQuantity: textNumberSql('aa.change_lost_asset_quantity'),
        modifiedQuantity: textNumberSql('aa.change_modificate_asset_quantity'),
      },
      defaultSort: 'aa.changed_at DESC, aa.created_at DESC, aa.id DESC',
      mapRow: mapInventoryEventRow,
    }),
  );
}

function mutationParams({ campId, payload }) {
  return [
    payload.code,
    payload.rfidCode,
    payload.name,
    payload.typeId || null,
    payload.locationRoomId || null,
    payload.locationKeyId || null,
    payload.category || null,
    payload.quantity,
    payload.mrah || null,
    payload.owner || null,
    payload.status || null,
    payload.expandable || null,
    payload.description || null,
    campId,
    payload.inventoryStatus || 'undiscovered',
    payload.service || null,
    payload.m2Inside || null,
    payload.isFixed === null || payload.isFixed === undefined ? null : Boolean(payload.isFixed),
    payload.purchaseDate || null,
    null,
    payload.purchasePrice || null,
    payload.comments || null,
    payload.replacedOff || null,
    payload.replacedBy || null,
    payload.yearOfLifeCycle || null,
    payload.restOfLifeCycle || null,
    payload.restValue || null,
    payload.isQuantitative === null || payload.isQuantitative === undefined
      ? null
      : Boolean(payload.isQuantitative),
    null,
  ];
}

async function addAsset({ actorUserId, campId, payload }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app.assets (
          code,
          rfid_code,
          name,
          type_id,
          location_room,
          location_key,
          category,
          quantity,
          mrah,
          asset_owner,
          status,
          expandable,
          description,
          camp_id,
          inventory_status,
          service,
          m2_inside,
          is_fixed,
          date_purchase,
          date_written_off,
          purchase_price,
          comments,
          replaced_off,
          replaced_by,
          year_of_life_cycle,
          rest_of_life_cycle,
          rest_value,
          is_quantity,
          last_inventory_date
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          CASE WHEN $15 = 'written_off' THEN COALESCE($20::timestamp, NOW()) ELSE NULL END,
          $21, $22, $23, $24, $25, $26, $27, $28,
          CASE WHEN $15 <> 'undiscovered' THEN COALESCE($29::timestamptz, NOW()) ELSE NULL END
        )
        RETURNING *`,
      mutationParams({ campId, payload }),
    );

    await recordAssetAction(client, campId, 'change_asset_quantity', quantityNumber(payload.quantity));
    await insertMonitoringEvent(client, actorUserId, `Asset ${payload.code} added`);
    return mapAssetRow(result.rows[0]);
  });
}

async function editAsset({ actorUserId, campId, assetId, payload }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, code, quantity, COALESCE(NULLIF(inventory_status, ''), 'undiscovered') AS inventory_status
         FROM app.assets
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [assetId, campId],
    );
    if (!current.rows[0]) return null;

    const result = await client.query(
      `UPDATE app.assets
          SET code = $3,
              rfid_code = $4,
              name = $5,
              type_id = $6,
              location_room = $7,
              location_key = $8,
              category = $9,
              quantity = $10,
              mrah = $11,
              asset_owner = $12,
              status = $13,
              expandable = $14,
              description = $15,
              inventory_status = $16,
              service = $17,
              m2_inside = $18,
              is_fixed = $19,
              date_purchase = $20,
              date_written_off = CASE
                WHEN $16 = 'written_off'
                  THEN COALESCE(date_written_off, $21::timestamp, NOW())
                ELSE NULL
              END,
              purchase_price = $22,
              comments = $23,
              replaced_off = $24,
              replaced_by = $25,
              year_of_life_cycle = $26,
              rest_of_life_cycle = $27,
              rest_value = $28,
              is_quantity = $29,
              last_inventory_date = CASE
                WHEN $16 = 'undiscovered' THEN NULL
                WHEN COALESCE(NULLIF(inventory_status, ''), 'undiscovered') <> $16
                  THEN COALESCE($30::timestamptz, NOW())
                ELSE last_inventory_date
              END,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING *`,
      [assetId, campId, ...mutationParams({ campId, payload }).filter((_, index) => index !== 13)],
    );

    const oldQuantity = quantityNumber(current.rows[0].quantity);
    const nextQuantity = quantityNumber(payload.quantity);
    const previousInventoryStatus = current.rows[0].inventory_status || 'undiscovered';
    const nextInventoryStatus = payload.inventoryStatus || 'undiscovered';
    if (previousInventoryStatus !== 'written_off' && nextInventoryStatus === 'written_off') {
      await recordAssetAction(client, campId, 'change_lost_asset_quantity', nextQuantity);
    } else if (previousInventoryStatus === 'written_off' && nextInventoryStatus !== 'written_off') {
      await recordAssetAction(client, campId, 'change_asset_quantity', nextQuantity);
    } else if (nextQuantity > oldQuantity) {
      await recordAssetAction(client, campId, 'change_asset_quantity', nextQuantity - oldQuantity);
    } else if (nextQuantity < oldQuantity) {
      await recordAssetAction(client, campId, 'change_lost_asset_quantity', oldQuantity - nextQuantity);
    } else {
      await recordAssetAction(client, campId, 'change_modificate_asset_quantity', nextQuantity);
    }
    await insertMonitoringEvent(client, actorUserId, `Asset ${payload.code} updated`);
    return mapAssetRow(result.rows[0]);
  });
}

async function deleteAsset({ actorUserId, campId, assetId }) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, code, quantity
         FROM app.assets
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [assetId, campId],
    );
    if (!current.rows[0]) return null;

    const deleted = await client.query(
      `DELETE FROM app.assets
        WHERE id = $1
          AND camp_id = $2
        RETURNING id`,
      [assetId, campId],
    );
    if (!deleted.rows[0]) return null;

    await recordAssetAction(
      client,
      campId,
      'change_remove_asset_quantity',
      quantityNumber(current.rows[0].quantity),
    );
    await insertMonitoringEvent(client, actorUserId, `Asset ${current.rows[0].code} deleted`);
    return { id: current.rows[0].id, code: current.rows[0].code };
  });
}

async function restartInventory({ actorUserId, campId, locationRoomId = null }) {
  return withTransaction(async (client) => {
    const params = [campId];
    const roomFilter = locationRoomId ? 'AND a.location_room = $2' : '';
    if (locationRoomId) params.push(locationRoomId);
    const result = await client.query(
      `UPDATE app.assets a
          SET inventory_status = 'undiscovered',
              last_inventory_date = NULL,
              updated_at = NOW()
        WHERE a.camp_id = $1
          ${roomFilter}
          AND ${ASSET_INVENTORY_STATUS_SQL} = 'completed'
        RETURNING id`,
      params,
    );

    await insertMonitoringEvent(
      client,
      actorUserId,
      locationRoomId ? 'Room asset inventory restarted' : 'Asset inventory restarted',
    );
    return { updatedCount: result.rowCount };
  });
}

async function recordAssetInventory({
  actorUserId,
  campId,
  assetId,
  locationRoomId = null,
  locationKeyId = null,
  inventoryStatus = 'completed',
}) {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id, quantity, COALESCE(NULLIF(inventory_status, ''), 'undiscovered') AS inventory_status
         FROM app.assets
        WHERE id = $1
          AND camp_id = $2
        LIMIT 1`,
      [assetId, campId],
    );
    if (!current.rows[0]) return null;

    const result = await client.query(
      `UPDATE app.assets
          SET location_room = COALESCE($3::uuid, location_room),
              location_key = CASE
                WHEN $3::uuid IS NULL THEN location_key
                WHEN $5::uuid IS NOT NULL THEN $5::uuid
                WHEN location_room = $3::uuid THEN location_key
                ELSE NULL
              END,
              inventory_status = $4::text,
              date_written_off = CASE
                WHEN $4::text = 'written_off'
                  THEN COALESCE(date_written_off, NOW())
                ELSE NULL
              END,
              last_inventory_date = CASE
                WHEN $4::text = 'undiscovered' THEN NULL
                ELSE NOW()
              END,
              updated_at = NOW()
        WHERE id = $1
          AND camp_id = $2
        RETURNING *`,
      [assetId, campId, locationRoomId, inventoryStatus, locationKeyId],
    );
    const asset = mapAssetRow(result.rows[0]);
    if (!asset) return null;
    if (current.rows[0].inventory_status !== 'written_off' && inventoryStatus === 'written_off') {
      await recordAssetAction(
        client,
        campId,
        'change_lost_asset_quantity',
        quantityNumber(current.rows[0].quantity),
      );
    }
    await insertMonitoringEvent(client, actorUserId, `Asset ${asset.code} inventory marked ${inventoryStatus}`);
    return asset;
  });
}

async function bulkUpsertAssets({ actorUserId, campId, rows }) {
  const results = [];
  for (const row of rows) {
    /* eslint-disable no-await-in-loop */
    if (row.id) {
      const asset = await editAsset({ actorUserId, campId, assetId: row.id, payload: row });
      results.push({ action: asset ? 'updated' : 'missing', asset });
    } else {
      const asset = await addAsset({ actorUserId, campId, payload: row });
      results.push({ action: 'added', asset });
    }
    /* eslint-enable no-await-in-loop */
  }
  return results;
}

async function userHasPermission(userId, permissionName) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1
         FROM app.user_permissions up
         JOIN app.permissions p ON p.id = up.permission_id
        WHERE up.user_id = $1
          AND p.name = $2
        LIMIT 1`,
      [userId, permissionName],
    );

    return result.rowCount > 0;
  });
}

module.exports = {
  addAsset,
  addAssetType,
  addCleanItem,
  bulkUpsertAssets,
  bulkUpsertAssetTypes,
  bulkUpsertCleanItems,
  deleteAsset,
  deleteAssetType,
  deleteCleanItem,
  editAsset,
  editAssetType,
  editCleanItem,
  findAssetTypeById,
  findAssetTypeByName,
  findAssetByCode,
  findAssetByRfid,
  findAssetById,
  findCleanItemById,
  findCleanItemByNameAndWarehouse,
  getAssetSummary,
  getCleanItemSummary,
  listAssetsByCamp,
  listAssetsTable,
  listAssetTypesByCamp,
  listAssetTypesTable,
  listCleanItemsTable,
  listKeysByCamp,
  listInventoryEventsByCamp,
  listInventoryEventsTable,
  listInventoryStatusTable,
  listNotFoundAssetsTable,
  listRoomsByCamp,
  listUserPermissions,
  moveCleanItem,
  recordAssetInventory,
  restartInventory,
  userHasPermission,
};
