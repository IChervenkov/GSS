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
    canAccess: 'can_access',
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
      name: 'c.name',
      id: 'c.id::text',
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
      name: 'c.name',
      id: 'c.id',
    },
    defaultSql: 'c.name ASC, c.created_at ASC',
  });
}

function shiftSqlParams(sql, offset) {
  if (!sql || !offset) return sql;
  return sql.replace(/\$(\d+)/g, (_, value) => `$${Number(value) + offset}`);
}

function buildAccessibleCampWhere({ userId = null, filters = [] } = { userId: null, filters: [] }) {
  const filterResult = buildCampFilters({ filters });
  const params = [userId, ...filterResult.params];
  const where = [
    'uca.user_id = $1',
    ...filterResult.where.map((clause) => shiftSqlParams(clause, 1)),
  ];

  return {
    params,
    whereSql: `WHERE ${where.join(' AND ')}`,
  };
}

async function findMainPageContext({ userId }) {
  return withClient(async (client) => {
    const [campsResult, permissionsResult, userResult] = await Promise.all([
      client.query(
        `SELECT c.id, c.name AS name, c.created_at
           FROM app.camps c
           JOIN app.user_camp_access uca ON uca.camp_id = c.id
          WHERE uca.user_id = $1
          ORDER BY c.name ASC, c.created_at ASC`,
        [userId],
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
    const filterResult = buildCampFilters({ filters });
    const params = [userId, ...filterResult.params];
    const countWhereSql = filterResult.where.length
      ? `WHERE ${filterResult.where.join(' AND ')}`
      : '';
    const campsWhereSql = filterResult.where.length
      ? `WHERE ${filterResult.where.map((clause) => shiftSqlParams(clause, 1)).join(' AND ')}`
      : '';
    const orderSql = buildCampOrder(sortColumn, sortDirection);
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });

    const [countResult, campsResult, permissionsResult] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS count
           FROM app.camps c
           ${countWhereSql}`,
        filterResult.params,
      ),
      client.query(
        `SELECT c.id, c.name AS name, c.created_at, (uca.user_id IS NOT NULL) AS can_access
           FROM app.camps c
           LEFT JOIN app.user_camp_access uca
            ON uca.camp_id = c.id
            AND uca.user_id = $1
           ${campsWhereSql}
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

async function campExists(campId, userId = null) {
  return withClient(async (client) => {
    const result = userId
      ? await client.query(
          `SELECT 1
             FROM app.camps c
             JOIN app.user_camp_access uca ON uca.camp_id = c.id
            WHERE c.id = $1
              AND uca.user_id = $2
            LIMIT 1`,
          [campId, userId],
        )
      : await client.query('SELECT 1 FROM app.camps WHERE id = $1 LIMIT 1', [campId]);
    return result.rowCount > 0;
  });
}

module.exports = {
  findMainPageContext,
  listCampsAndPermissions,
  campExists,
};
