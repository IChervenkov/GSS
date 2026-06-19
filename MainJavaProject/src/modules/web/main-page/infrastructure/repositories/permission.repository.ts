const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');
const {
  mapRow,
  mapRows,
  normalizeCount,
  buildAllowedIlikeFilters,
  buildAllowedOrderBy,
  buildPagination,
} = require('../../../../../infrastructure/db/repository-utils');

const mapUserRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    username: 'username',
  });

const mapPermissionRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    name: 'name',
  });

const mapCampRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    name: 'name',
  });

const mapUserPermissionRowToEntity = (row) =>
  mapRow(row, {
    userId: 'user_id',
    permissionId: 'permission_id',
  });

const mapUserCampAccessRowToEntity = (row) =>
  mapRow(row, {
    userId: 'user_id',
    campId: 'camp_id',
  });

function buildPermissionFilters(filters = []) {
  return buildAllowedIlikeFilters({
    filters,
    allowedColumns: {
      name: 'name::text',
    },
  });
}

function buildPermissionSort(sort) {
  return buildAllowedOrderBy({
    sort,
    allowedSorts: {
      name: 'name',
      id: 'id',
    },
    defaultSql: 'name ASC',
  });
}

function buildCampFilters(filters = []) {
  return buildAllowedIlikeFilters({
    filters,
    allowedColumns: {
      name: 'name::text',
      id: 'id::text',
    },
  });
}

function buildCampSort(sort) {
  return buildAllowedOrderBy({
    sort,
    allowedSorts: {
      name: 'name',
      id: 'id',
    },
    defaultSql: 'name ASC',
  });
}

async function listPermissionMatrix({ adminUsername, page, limit, filters = [], sort }) {
  return withClient(async (client) => {
    const { params, whereSql } = buildPermissionFilters(filters);
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });
    const sortSql = `${buildPermissionSort(sort)}, name ASC`;

    const userParams = [];
    let usersWhereSql = '';
    if (adminUsername) {
      userParams.push(adminUsername);
      usersWhereSql = `WHERE username <> $${userParams.length}`;
    }

    const [countRes, usersRes, permissionsRes, userPermissionsRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS count FROM app.permissions ${whereSql}`, params),
      client.query(
        `SELECT id, username
           FROM app.users
           ${usersWhereSql}
           ORDER BY username ASC`,
        userParams,
      ),
      client.query(
        `SELECT id, name AS name
           FROM app.permissions
           ${whereSql}
           ORDER BY ${sortSql}
           LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`,
        [...params, pagination.limit, pagination.offset],
      ),
      client.query('SELECT user_id, permission_id AS permission_id FROM app.user_permissions'),
    ]);

    return {
      users: mapRows(usersRes.rows, mapUserRowToEntity),
      permissions: mapRows(permissionsRes.rows, mapPermissionRowToEntity),
      userPermissions: mapRows(userPermissionsRes.rows, mapUserPermissionRowToEntity),
      total: normalizeCount(countRes.rows[0]?.count),
    };
  });
}

async function listCampAccessMatrix({ adminUsername, page, limit, filters = [], sort }) {
  return withClient(async (client) => {
    const { params, whereSql } = buildCampFilters(filters);
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });
    const sortSql = `${buildCampSort(sort)}, name ASC`;

    const userParams = [];
    let usersWhereSql = '';
    if (adminUsername) {
      userParams.push(adminUsername);
      usersWhereSql = `WHERE username <> $${userParams.length}`;
    }

    const [countRes, usersRes, campsRes, userCampAccessRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS count FROM app.camps ${whereSql}`, params),
      client.query(
        `SELECT id, username
           FROM app.users
           ${usersWhereSql}
           ORDER BY username ASC`,
        userParams,
      ),
      client.query(
        `SELECT id, name AS name
           FROM app.camps
           ${whereSql}
           ORDER BY ${sortSql}
           LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`,
        [...params, pagination.limit, pagination.offset],
      ),
      client.query('SELECT user_id, camp_id FROM app.user_camp_access'),
    ]);

    return {
      users: mapRows(usersRes.rows, mapUserRowToEntity),
      camps: mapRows(campsRes.rows, mapCampRowToEntity),
      userCampAccess: mapRows(userCampAccessRes.rows, mapUserCampAccessRowToEntity),
      total: normalizeCount(countRes.rows[0]?.count),
    };
  });
}

async function savePermissions({ actorUserId, changes = [] }) {
  return withTransaction(async (client) => {
    const grants = changes.filter((change) => change.isChecked);
    const revokes = changes.filter((change) => !change.isChecked);

    if (grants.length > 0) {
      const grantValues = [];
      const grantParams = [];
      let index = 1;
      for (const grant of grants) {
        grantValues.push(`($${index++}, $${index++})`);
        grantParams.push(grant.userId, grant.permissionId);
      }
      await client.query(
        `INSERT INTO app.user_permissions (user_id, permission_id)
         VALUES ${grantValues.join(', ')}
         ON CONFLICT (user_id, permission_id) DO NOTHING`,
        grantParams,
      );
    }

    if (revokes.length > 0) {
      const revokeValues = [];
      const revokeParams = [];
      let index = 1;
      for (const revoke of revokes) {
        revokeValues.push(`($${index++}, $${index++})`);
        revokeParams.push(revoke.userId, revoke.permissionId);
      }
      await client.query(
        `DELETE FROM app.user_permissions
          WHERE (user_id, permission_id) IN (${revokeValues.join(', ')})`,
        revokeParams,
      );
    }

    if (changes.length > 0) {
      const auditValues = [];
      const auditParams = [];
      let index = 1;
      for (const change of changes) {
        const verb = change.isChecked ? 'Grant' : 'Revoke';
        auditValues.push(`($${index++}, $${index++})`);
        auditParams.push(
          actorUserId,
          `${verb} permission ${change.permissionId} for user ${change.userId}`,
        );
      }
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
         SELECT actor.username, audit.location
           FROM (VALUES ${auditValues.join(', ')}) AS audit(actor_id, location)
           JOIN app.users actor ON actor.id = audit.actor_id::uuid`,
        auditParams,
      );
    }

    return { affectedUserIds: [...new Set(changes.map((change) => change.userId))] };
  });
}

async function saveCampAccess({ actorUserId, changes = [] }) {
  return withTransaction(async (client) => {
    const grants = changes.filter((change) => change.isChecked);
    const revokes = changes.filter((change) => !change.isChecked);

    if (grants.length > 0) {
      const grantValues = [];
      const grantParams = [];
      let index = 1;
      for (const grant of grants) {
        grantValues.push(`($${index++}, $${index++}, $${index++})`);
        grantParams.push(grant.userId, grant.campId, actorUserId);
      }
      await client.query(
        `INSERT INTO app.user_camp_access (user_id, camp_id, created_by)
         VALUES ${grantValues.join(', ')}
         ON CONFLICT (user_id, camp_id) DO NOTHING`,
        grantParams,
      );
    }

    if (revokes.length > 0) {
      const revokeValues = [];
      const revokeParams = [];
      let index = 1;
      for (const revoke of revokes) {
        revokeValues.push(`($${index++}, $${index++})`);
        revokeParams.push(revoke.userId, revoke.campId);
      }
      await client.query(
        `DELETE FROM app.user_camp_access
          WHERE (user_id, camp_id) IN (${revokeValues.join(', ')})`,
        revokeParams,
      );
    }

    if (changes.length > 0) {
      const auditValues = [];
      const auditParams = [];
      let index = 1;
      for (const change of changes) {
        const verb = change.isChecked ? 'Grant' : 'Revoke';
        auditValues.push(`($${index++}, $${index++})`);
        auditParams.push(actorUserId, `${verb} camp ${change.campId} for user ${change.userId}`);
      }
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
         SELECT actor.username, audit.location
           FROM (VALUES ${auditValues.join(', ')}) AS audit(actor_id, location)
           JOIN app.users actor ON actor.id = audit.actor_id::uuid`,
        auditParams,
      );
    }

    return { affectedUserIds: [...new Set(changes.map((change) => change.userId))] };
  });
}

async function listCurrentUserPermissions({ userId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT p.name AS name
         FROM app.user_permissions up
         JOIN app.permissions p ON p.id = permission_id
        WHERE up.user_id = $1
        ORDER BY p.name ASC`,
      [userId],
    );

    return mapRows(result.rows, (row) => mapRow(row, { name: 'name' }));
  });
}

async function userHasPermission(userId, permissionName) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1
         FROM app.user_permissions up
         JOIN app.permissions p ON p.id = permission_id
        WHERE up.user_id = $1
          AND p.name = $2
        LIMIT 1`,
      [userId, permissionName],
    );

    return result.rowCount > 0;
  });
}

module.exports = {
  listPermissionMatrix,
  listCampAccessMatrix,
  savePermissions,
  saveCampAccess,
  listCurrentUserPermissions,
  userHasPermission,
};
