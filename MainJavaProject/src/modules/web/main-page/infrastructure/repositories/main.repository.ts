const { withClient } = require('../../../../../infrastructure/db/transaction');
const {
  mapRow,
  mapRows,
  normalizeCount,
  buildAllowedIlikeFilters,
  buildAllowedOrderBy,
  buildPagination,
} = require('../../../../../infrastructure/db/repository-utils');

const mapCampRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    name: 'name',
    createdAt: 'created_at',
  });

const mapPermissionRowToEntity = (row) =>
  mapRow(row, {
    name: 'name',
  });

const mapUserRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    username: 'username',
  });

function buildCampFilters({ filters = [] } = {}) {
  return buildAllowedIlikeFilters({
    filters,
    allowedColumns: {
      name: 'name',
      id: 'id::text',
    },
  });
}

function buildCampOrder(sortColumn, sortDirection) {
  return buildAllowedOrderBy({
    sort: {
      column: sortColumn,
      direction: sortDirection,
    },
    allowedSorts: {
      name: 'name',
      id: 'id',
    },
    defaultSql: 'name ASC, created_at ASC',
  });
}

async function findMainPageContext({ userId }) {
  return withClient(async (client) => {
    const [campsResult, permissionsResult, userResult] = await Promise.all([
      client.query(
        'SELECT id, name AS name, created_at FROM app.camps ORDER BY name ASC, created_at ASC',
      ),
      client.query(
        `SELECT p.name AS name
           FROM app.permissions p
           JOIN app.user_permissions up ON permission_id = p.id
          WHERE up.user_id = $1
          ORDER BY p.name ASC`,
        [userId],
      ),
      client.query('SELECT id, username FROM app.users WHERE id = $1 LIMIT 1', [userId]),
    ]);

    return {
      camps: mapRows(campsResult.rows, mapCampRowToEntity),
      permissions: mapRows(permissionsResult.rows, mapPermissionRowToEntity),
      user: mapUserRowToEntity(userResult.rows[0]),
    };
  });
}

async function listCampsAndPermissions({
  userId,
  page,
  limit,
  filters = [],
  sortColumn = undefined,
  sortDirection = 'default',
}) {
  return withClient(async (client) => {
    const { params, whereSql } = buildCampFilters({ filters });
    const orderSql = buildCampOrder(sortColumn, sortDirection);
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });

    const [countResult, campsResult, permissionsResult] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS count FROM app.camps ${whereSql}`, params),
      client.query(
        `SELECT id, name AS name, created_at
           FROM app.camps
           ${whereSql}
           ORDER BY ${orderSql}
           LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`,
        [...params, pagination.limit, pagination.offset],
      ),
      client.query(
        `SELECT p.name AS name
           FROM app.permissions p
           JOIN app.user_permissions up ON permission_id = p.id
          WHERE up.user_id = $1
          ORDER BY p.name ASC`,
        [userId],
      ),
    ]);

    return {
      camps: mapRows(campsResult.rows, mapCampRowToEntity),
      permissions: mapRows(permissionsResult.rows, mapPermissionRowToEntity),
      total: normalizeCount(countResult.rows[0]?.count),
    };
  });
}

async function campExists(campId) {
  return withClient(async (client) => {
    const result = await client.query('SELECT 1 FROM app.camps WHERE id = $1 LIMIT 1', [campId]);
    return result.rowCount > 0;
  });
}

module.exports = {
  findMainPageContext,
  listCampsAndPermissions,
  campExists,
};
