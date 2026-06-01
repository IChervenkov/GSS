const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapRow,
  buildAllowedIlikeFilters,
  buildAllowedOrderBy,
  buildPagination,
} = require('../../../src/infrastructure/db/repository-utils');

test('mapRow normalizes row objects with functions and direct column mappings', () => {
  const entity = mapRow(
    {
      id: '1',
      username: 'operator',
      is_locked: 1,
    },
    {
      id: 'id',
      username: 'username',
      isLocked: (row) => Boolean(row.is_locked),
    },
  );

  assert.deepEqual(entity, {
    id: '1',
    username: 'operator',
    isLocked: true,
  });
});

test('buildAllowedIlikeFilters ignores unsupported columns and blank values', () => {
  const result = buildAllowedIlikeFilters({
    filters: [
      { column: 'name', value: 'alpha' },
      { column: 'DROP TABLE users', value: 'x' },
      { column: 'name', value: '   ' },
    ],
    allowedColumns: {
      name: 'u.name::text',
    },
  });

  assert.deepEqual(result, {
    params: ['%alpha%'],
    where: ['u.name::text ILIKE $1'],
    whereSql: 'WHERE u.name::text ILIKE $1',
  });
});

test('buildAllowedOrderBy falls back to default for unsupported sort input', () => {
  assert.equal(
    buildAllowedOrderBy({
      sort: { column: 'username; DROP TABLE app.users', direction: 'asc' },
      allowedSorts: { username: 'u.username' },
      defaultSql: 'u.username ASC',
    }),
    'u.username ASC',
  );
});

test('buildPagination normalizes invalid page and limit values', () => {
  const pagination = buildPagination({ page: 0, limit: -5, baseParamCount: 2 });

  assert.deepEqual(pagination, {
    limit: 1,
    offset: 0,
    limitPlaceholder: '$3',
    offsetPlaceholder: '$4',
  });
});
