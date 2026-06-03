// @ts-nocheck
function mapRow(row, fieldMap) {
  if (!row) return null;

  return Object.entries(fieldMap).reduce((entity, [key, mapper]) => {
    entity[key] = typeof mapper === 'function' ? mapper(row) : row[mapper];
    return entity;
  }, {});
}

function mapRows(rows, mapper) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map(mapper);
}

function normalizeCount(value) {
  return Number(value || 0);
}

function buildAllowedIlikeFilters({ filters = [], allowedColumns = {} }) {
  const params = [];
  const where = [];

  for (const filter of filters) {
    const columnSql = allowedColumns[filter?.column];
    const rawValue = typeof filter?.value === 'string' ? filter.value.trim() : '';
    if (!columnSql || rawValue.length === 0) continue;

    params.push(`%${rawValue}%`);
    where.push(`${columnSql} ILIKE $${params.length}`);
  }

  return {
    params,
    where,
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
}

function buildAllowedOrderBy({ sort, allowedSorts = {}, defaultSql }) {
  const columnSql = allowedSorts[sort?.column];
  const direction = typeof sort?.direction === 'string' ? sort.direction.toLowerCase() : 'default';

  if (!columnSql || !['asc', 'desc'].includes(direction)) {
    return defaultSql;
  }

  return `${columnSql} ${direction.toUpperCase()}`;
}

function buildPagination({ page, limit, baseParamCount = 0 }) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.max(1, Number(limit) || 1);
  const offset = (normalizedPage - 1) * normalizedLimit;

  return {
    limit: normalizedLimit,
    offset,
    limitPlaceholder: `$${baseParamCount + 1}`,
    offsetPlaceholder: `$${baseParamCount + 2}`,
  };
}

module.exports = {
  mapRow,
  mapRows,
  normalizeCount,
  buildAllowedIlikeFilters,
  buildAllowedOrderBy,
  buildPagination,
};
