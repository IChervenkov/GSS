const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');
const {
  mapRow,
  mapRows,
  normalizeCount,
  buildAllowedIlikeFilters,
  buildAllowedOrderBy,
  buildPagination,
} = require('../../../../../infrastructure/db/repository-utils');

const mapUserListRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    username: 'username',
    isLocked: (source) => Boolean(source.is_locked),
    pendingRequestId: 'pending_request_id',
    pendingRequestType: 'pending_request_type',
    pendingRequestExpiresAt: 'pending_request_expires_at',
    status: 'status',
  });

const mapEditableUserRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    username: 'username',
    password: 'password',
    temporaryPassword: 'temporary_password',
    isLocked: (source) => Boolean(source.is_locked),
  });

const mapApprovalRequestRowToEntity = (row) =>
  mapRow(row, {
    requestId: 'request_id',
    userId: 'user_id',
    status: 'status',
    requestType: 'type',
    metadata: (source) => source.metadata || {},
  });

const mapAdminInboxRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    sourceId: 'source_id',
    kind: 'kind',
    type: 'type',
    status: 'status',
    subject: 'subject',
    body: 'body',
    userId: 'user_id',
    username: 'username',
    createdAt: 'created_at',
    expiresAt: 'expires_at',
  });

const accountSql = "CASE WHEN u.is_locked THEN 'Locked' ELSE 'Active' END";
const requestStatusSql = `COALESCE(
  pending_request.status,
  CASE
    WHEN latest_request.status = 'pending' AND latest_request.expires_at <= NOW()
      THEN 'expired'
    ELSE latest_request.status
  END,
  'none'
)`;

const requestJoinsSql = `LEFT JOIN LATERAL (
             SELECT r.request_id, r.type, r.status, r.expires_at
               FROM app.user_requests r
              WHERE r.user_id = u.id
                AND r.status = 'pending'
                AND r.expires_at > NOW()
              ORDER BY r.created_at DESC, r.request_id DESC
              LIMIT 1
           ) pending_request ON TRUE
      LEFT JOIN LATERAL (
             SELECT r.request_id, r.type, r.status, r.expires_at
               FROM app.user_requests r
              WHERE r.user_id = u.id
              ORDER BY r.created_at DESC, r.request_id DESC
              LIMIT 1
           ) latest_request ON TRUE`;

async function listUsers({ adminUsername, page, limit, filters, sort }) {
  return withClient(async (client) => {
    const filterResult = buildAllowedIlikeFilters({
      filters,
      allowedColumns: {
        'u.username': 'u.username::text',
        username: 'u.username::text',
        'u.id': 'u.id::text',
        id: 'u.id::text',
        account: accountSql,
        status: requestStatusSql,
      },
    });
    const params = [adminUsername, ...filterResult.params];
    const where = ['u.username <> $1', ...filterResult.where.map((clause, index) => clause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`))];
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });
    const sortSql = `${buildAllowedOrderBy({
      sort,
      allowedSorts: {
        'u.username': 'u.username',
        username: 'u.username',
        'u.id': 'u.id',
        id: 'u.id',
        account: accountSql,
        status: requestStatusSql,
      },
      defaultSql: 'u.username ASC',
    })}, u.username ASC`;

    const [dataResult, countResult] = await Promise.all([
      client.query(
        `SELECT u.id,
                u.username,
                u.is_locked,
                COALESCE(
                  pending_request.request_id,
                  CASE
                    WHEN latest_request.status = 'pending' AND latest_request.expires_at > NOW()
                      THEN latest_request.request_id
                    ELSE NULL
                  END
                ) AS pending_request_id,
                COALESCE(
                  pending_request.type,
                  CASE
                    WHEN latest_request.status = 'pending' AND latest_request.expires_at > NOW()
                      THEN latest_request.type
                    ELSE NULL
                  END
                ) AS pending_request_type,
                COALESCE(
                  pending_request.expires_at,
                  CASE
                    WHEN latest_request.status = 'pending' AND latest_request.expires_at > NOW()
                      THEN latest_request.expires_at
                    ELSE NULL
                  END
                ) AS pending_request_expires_at,
                COALESCE(
                  pending_request.status,
                  CASE
                    WHEN latest_request.status = 'pending' AND latest_request.expires_at <= NOW()
                      THEN 'expired'
                    ELSE latest_request.status
                  END
                ) AS status
           FROM app.users u
      ${requestJoinsSql}
           ${whereSql}
           ORDER BY ${sortSql}
           LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`,
        [...params, pagination.limit, pagination.offset],
      ),
      client.query(
        `SELECT COUNT(*)::int AS count
           FROM app.users u
           ${requestJoinsSql}
           ${whereSql}`,
        params,
      ),
    ]);

    return {
      users: mapRows(dataResult.rows, mapUserListRowToEntity),
      total: normalizeCount(countResult.rows[0]?.count),
    };
  });
}

async function resolveApprovalRequest({ requestId, decision, decidedBy }) {
  return withTransaction(async (client) => {
    const updatedRequest = await client.query(
      `UPDATE app.user_requests
          SET status = $2,
              decided_at = NOW(),
              decided_by = $3,
              updated_at = NOW()
        WHERE request_id = $1
          AND status = 'pending'
          AND expires_at > NOW()
        RETURNING request_id, user_id, status, type, metadata`,
      [requestId, decision, decidedBy],
    );

    if (updatedRequest.rowCount > 0) {
      return { kind: 'resolved', value: mapApprovalRequestRowToEntity(updatedRequest.rows[0]) };
    }

    const exists = await client.query(
      `SELECT status, expires_at
         FROM app.user_requests
        WHERE request_id = $1`,
      [requestId],
    );

    if (exists.rowCount === 0) return { kind: 'not_found' };

    const row = exists.rows[0];
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { kind: 'expired' };
    }

    return {
      kind: 'already_resolved',
      value: {
        status: row.status,
        expiresAt: row.expires_at,
      },
    };
  });
}

async function createUserMessage({ userId, type, subject, body }) {
  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO app.user_messages (user_id, type, subject, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, type, subject, body, status, created_at`,
      [userId, type, subject, body],
    );

    return mapAdminInboxRowToEntity({
      id: `message:${result.rows[0].id}`,
      source_id: result.rows[0].id,
      kind: 'user_message',
      type: result.rows[0].type,
      status: result.rows[0].status,
      subject: result.rows[0].subject,
      body: result.rows[0].body,
      user_id: result.rows[0].user_id,
      username: null,
      created_at: result.rows[0].created_at,
      expires_at: null,
    });
  });
}

async function listAdminInbox({ page, limit, filters, sort }) {
  return withClient(async (client) => {
    const filterResult = buildAllowedIlikeFilters({
      filters,
      allowedColumns: {
        type: 'type_label',
        username: 'username',
        subject: 'subject',
        status: 'status',
        createdAt: 'created_at_display',
      },
    });
    const params = filterResult.params;
    const whereSql = filterResult.where.length
      ? `WHERE ${filterResult.where.join(' AND ')}`
      : '';
    const pagination = buildPagination({ page, limit, baseParamCount: params.length });
    const sortSql = `${buildAllowedOrderBy({
      sort,
      allowedSorts: {
        type: 'type_label',
        username: 'username',
        subject: 'subject',
        status: 'status',
        createdAt: 'created_at',
      },
      defaultSql: 'created_at DESC',
    })}, id DESC`;

    const inboxSql = `
      WITH inbox AS (
        SELECT
          ('message:' || m.id::text) AS id,
          m.id AS source_id,
          'user_message' AS kind,
          m.type AS type,
          CASE
            WHEN m.type = 'issue' THEN 'Issue'
            WHEN m.type = 'message' THEN 'Message'
            WHEN m.type = 'other' THEN 'Other'
            ELSE 'Suggestion'
          END AS type_label,
          m.status AS status,
          m.subject AS subject,
          m.body AS body,
          m.user_id AS user_id,
          u.username AS username,
          m.created_at AS created_at,
          to_char(m.created_at, 'YYYY-MM-DD HH12-MI AM') AS created_at_display,
          NULL::timestamptz AS expires_at
        FROM app.user_messages m
        LEFT JOIN app.users u ON u.id = m.user_id
        UNION ALL
        SELECT
          ('request:' || r.request_id::text) AS id,
          r.request_id AS source_id,
          'access_request' AS kind,
          r.type AS type,
          CASE
            WHEN r.type = 'show_qr' THEN 'QR access'
            WHEN r.type = 'password_change' THEN 'Password change'
            ELSE 'Access request'
          END AS type_label,
          CASE
            WHEN r.status = 'pending' AND r.expires_at <= NOW() THEN 'expired'
            ELSE r.status
          END AS status,
          CASE
            WHEN r.type = 'show_qr' THEN 'QR access request'
            WHEN r.type = 'password_change' THEN 'Password change request'
            ELSE 'Access request'
          END AS subject,
          COALESCE(r.metadata->>'message', '') AS body,
          r.user_id AS user_id,
          u.username AS username,
          r.created_at AS created_at,
          to_char(r.created_at, 'YYYY-MM-DD HH12-MI AM') AS created_at_display,
          r.expires_at AS expires_at
        FROM app.user_requests r
        JOIN app.users u ON u.id = r.user_id
      )
      SELECT *
      FROM inbox
      ${whereSql}
      ORDER BY ${sortSql}
      LIMIT ${pagination.limitPlaceholder} OFFSET ${pagination.offsetPlaceholder}`;

    const countSql = `
      WITH inbox AS (
        SELECT
          CASE
            WHEN m.type = 'issue' THEN 'Issue'
            WHEN m.type = 'message' THEN 'Message'
            WHEN m.type = 'other' THEN 'Other'
            ELSE 'Suggestion'
          END AS type_label,
          m.status AS status,
          m.subject AS subject,
          u.username AS username,
          to_char(m.created_at, 'YYYY-MM-DD HH12-MI AM') AS created_at_display
        FROM app.user_messages m
        LEFT JOIN app.users u ON u.id = m.user_id
        UNION ALL
        SELECT
          CASE
            WHEN r.type = 'show_qr' THEN 'QR access'
            WHEN r.type = 'password_change' THEN 'Password change'
            ELSE 'Access request'
          END AS type_label,
          CASE
            WHEN r.status = 'pending' AND r.expires_at <= NOW() THEN 'expired'
            ELSE r.status
          END AS status,
          CASE
            WHEN r.type = 'show_qr' THEN 'QR access request'
            WHEN r.type = 'password_change' THEN 'Password change request'
            ELSE 'Access request'
          END AS subject,
          u.username AS username,
          to_char(r.created_at, 'YYYY-MM-DD HH12-MI AM') AS created_at_display
        FROM app.user_requests r
        JOIN app.users u ON u.id = r.user_id
      )
      SELECT COUNT(*)::int AS count
      FROM inbox
      ${whereSql}`;

    const [dataResult, countResult] = await Promise.all([
      client.query(inboxSql, [...params, pagination.limit, pagination.offset]),
      client.query(countSql, params),
    ]);

    return {
      items: mapRows(dataResult.rows, mapAdminInboxRowToEntity),
      total: normalizeCount(countResult.rows[0]?.count),
    };
  });
}

async function updateUserMessageStatus({ messageId, status, actorUserId }) {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE app.user_messages
          SET status = $2,
              updated_at = NOW(),
              closed_at = CASE WHEN $2 = 'closed' THEN NOW() ELSE NULL END,
              closed_by = CASE WHEN $2 = 'closed' THEN $3::uuid ELSE NULL::uuid END
        WHERE id = $1
        RETURNING id, user_id, type, subject, body, status, created_at`,
      [messageId, status, actorUserId],
    );

    if (result.rowCount === 0) return null;
    return mapAdminInboxRowToEntity({
      id: `message:${result.rows[0].id}`,
      source_id: result.rows[0].id,
      kind: 'user_message',
      type: result.rows[0].type,
      status: result.rows[0].status,
      subject: result.rows[0].subject,
      body: result.rows[0].body,
      user_id: result.rows[0].user_id,
      username: null,
      created_at: result.rows[0].created_at,
      expires_at: null,
    });
  });
}

async function deleteAdminInboxItem({ itemId, itemKind }) {
  return withClient(async (client) => {
    if (itemKind === 'user_message') {
      const result = await client.query(
        `DELETE FROM app.user_messages
        WHERE id = $1
        RETURNING id, user_id, type, subject, body, status, created_at`,
        [itemId],
      );

      if (result.rowCount === 0) return null;
      return mapAdminInboxRowToEntity({
        id: `message:${result.rows[0].id}`,
        source_id: result.rows[0].id,
        kind: 'user_message',
        type: result.rows[0].type,
        status: result.rows[0].status,
        subject: result.rows[0].subject,
        body: result.rows[0].body,
        user_id: result.rows[0].user_id,
        username: null,
        created_at: result.rows[0].created_at,
        expires_at: null,
      });
    }

    if (itemKind === 'access_request') {
      const result = await client.query(
        `DELETE FROM app.user_requests
        WHERE request_id = $1
        RETURNING request_id, user_id, type, status, metadata, created_at, expires_at`,
        [itemId],
      );

      if (result.rowCount === 0) return null;
      return mapAdminInboxRowToEntity({
        id: `request:${result.rows[0].request_id}`,
        source_id: result.rows[0].request_id,
        kind: 'access_request',
        type: result.rows[0].type,
        status: result.rows[0].status,
        subject: 'Access request',
        body: result.rows[0].metadata?.message || '',
        user_id: result.rows[0].user_id,
        username: null,
        created_at: result.rows[0].created_at,
        expires_at: result.rows[0].expires_at,
      });
    }

    return null;
  });
}

async function createUser({ actorUserId, username, temporaryPasswordHash }) {
  return withTransaction(async (client) => {
    const insertResult = await client.query(
      `INSERT INTO app.users (username, password, temporary_password)
       VALUES ($1, NULL, $2)
       RETURNING id, username`,
      [username, temporaryPasswordHash],
    );
    const createdUserId = insertResult.rows[0]?.id;

    await client.query(
      `INSERT INTO app.user_camp_access (user_id, camp_id, created_by)
       SELECT $1, c.id, $2
         FROM app.camps c
       ON CONFLICT (user_id, camp_id) DO NOTHING`,
      [createdUserId, actorUserId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
       VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `User ${username} added`],
    );

    return {
      id: createdUserId,
      username: insertResult.rows[0]?.username,
    };
  });
}

async function findUserForEdit(userId) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, username, password, temporary_password, is_locked
         FROM app.users
        WHERE id = $1`,
      [userId],
    );
    return mapEditableUserRowToEntity(result.rows[0]);
  });
}

async function updateUser({ actorUserId, userId, username, passwordHash, locked }) {
  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT id, username, password, temporary_password, is_locked
         FROM app.users
        WHERE id = $1
        FOR UPDATE`,
      [userId],
    );

    const currentUser = mapEditableUserRowToEntity(currentResult.rows[0]);
    if (!currentUser) return null;

    const setClauses = ['username = $2'];
    const params = [userId, username];
    let shouldRotateTokenVersion = false;

    if (passwordHash) {
      const passwordHashIndex = params.push(passwordHash);
      const shouldUpdatePassword =
        currentUser.password !== null || currentUser.temporaryPassword === null;
      const shouldUpdateTemporaryPassword = currentUser.temporaryPassword !== null;

      if (shouldUpdatePassword) {
        setClauses.push(`password = $${passwordHashIndex}`);
      }

      if (shouldUpdateTemporaryPassword) {
        setClauses.push(`temporary_password = $${passwordHashIndex}`);
      }

      shouldRotateTokenVersion = shouldUpdatePassword || shouldUpdateTemporaryPassword;
    }

    if (typeof locked === 'boolean') {
      const lockedIndex = params.push(locked);
      setClauses.push(`is_locked = $${lockedIndex}`);
      shouldRotateTokenVersion = shouldRotateTokenVersion || Boolean(locked) !== Boolean(currentUser.isLocked);
    }

    if (shouldRotateTokenVersion) {
      setClauses.push('token_version = token_version + 1');
    }

    await client.query(
      `UPDATE app.users
          SET ${setClauses.join(',\n              ')}
        WHERE id = $1`,
      params,
    );

    if (shouldRotateTokenVersion) {
      await client.query(
        `UPDATE app.user_sessions
            SET revoked = TRUE,
                updated_at = NOW()
          WHERE user_id = $1
            AND revoked = FALSE`,
        [userId],
      );
    }

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
       VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [
        actorUserId,
        `Edited user ${userId}: username "${currentUser.username}" -> "${username}"${passwordHash ? ' (password changed)' : ''}${typeof locked === 'boolean' ? ` (${locked ? 'locked' : 'unlocked'})` : ''}`,
      ],
    );

    return currentUser;
  });
}

async function deleteUsers({ actorUserId, userIds }) {
  return withTransaction(async (client) => {
    const deletedUsersResult = await client.query(
      `DELETE FROM app.users
        WHERE id = ANY($1::uuid[])
      RETURNING id, username`,
      [userIds],
    );

    const deletedUsers = deletedUsersResult.rows;

    if (deletedUsers.length > 0) {
      const values = [];
      const params = [];
      let index = 1;
      for (const deletedUser of deletedUsers) {
        values.push(`((SELECT username FROM app.users WHERE id = $${index++}), $${index++})`);
        params.push(actorUserId, `User ${deletedUser.username} was removed`);
      }
      await client.query(
        `INSERT INTO app.user_monitoring_events (username, location)
         VALUES ${values.join(', ')}`,
        params,
      );
    }

    return deletedUsers;
  });
}


async function securityResetUser({ actorUserId, userId }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE app.users
          SET token_version = token_version + 1
        WHERE id = $1
    RETURNING id, username, token_version`,
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    await client.query(
      `UPDATE app.user_sessions
          SET revoked = TRUE,
              updated_at = NOW()
        WHERE user_id = $1
          AND revoked = FALSE`,
      [userId],
    );

    await client.query(
      `INSERT INTO app.user_monitoring_events (username, location)
       VALUES ((SELECT username FROM app.users WHERE id = $1), $2)`,
      [actorUserId, `Security reset executed for user ${userId}`],
    );

    return {
      id: result.rows[0].id,
      username: result.rows[0].username,
      tokenVersion: Number(result.rows[0].token_version || 0),
    };
  });
}

async function hashPassword(value, rounds) {
  const bcrypt = require('bcryptjs');
  return bcrypt.hash(value, rounds);
}

module.exports = {
  resolveUserRequest: resolveApprovalRequest,
  listUsers,
  createUser,
  findUserForEdit,
  updateUser,
  deleteUsers,
  resolveApprovalRequest,
  createUserMessage,
  listAdminInbox,
  updateUserMessageStatus,
  deleteAdminInboxItem,
  securityResetUser,
  hashPassword,
};
