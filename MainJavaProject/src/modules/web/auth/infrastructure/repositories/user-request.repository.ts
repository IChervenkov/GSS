const crypto = require('crypto');
const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');
const { mapRow } = require('../../../../../infrastructure/db/repository-utils');

const REQUEST_TTL_MS = 5 * 60 * 1000;

const mapUserRequestRowToEntity = (row) =>
  mapRow(row, {
    requestId: 'request_id',
    userId: 'user_id',
    status: 'status',
    expiresAt: 'expires_at',
    requestType: 'type',
    metadata: (source) => source.metadata || {},
  });

const mapPublicAccessMessageRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    type: 'type',
    subject: 'subject',
    body: 'body',
    status: 'status',
    createdAt: 'created_at',
  });

async function findActiveUserRequest({ userId, requestType, client: existingClient = null }) {
  const run = async (client) => {
    const { rows } = await client.query(
      `SELECT request_id, user_id, status, expires_at, type, metadata
         FROM app.user_requests
        WHERE user_id = $1
          AND type = $2
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId, requestType],
    );
    return mapUserRequestRowToEntity(rows[0]);
  };

  if (existingClient) return run(existingClient);
  return withClient(run);
}

async function createUserRequest({ userId, requestType, metadata = {} }) {
  const requestId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `approval:${userId}:${requestType}`,
    ]);

    const existing = await findActiveUserRequest({ userId, requestType, client });
    if (existing) {
      return { requestId: existing.requestId, expiresAt: existing.expiresAt, reused: true };
    }

    await client.query(
      `INSERT INTO app.user_requests (
        request_id,
        user_id,
        status,
        expires_at,
        created_at,
        updated_at,
        type,
        metadata
      ) VALUES ($1, $2, 'pending', $3, NOW(), NOW(), $4, $5::jsonb)`,
      [requestId, userId, expiresAt, requestType, JSON.stringify(metadata)],
    );

    return { requestId, expiresAt, reused: false };
  });
}

async function findUserRequest(requestId, userId, requestType) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT request_id, user_id, status, expires_at, type, metadata
         FROM app.user_requests
        WHERE request_id = $1
          AND user_id = $2
          AND type = $3
        LIMIT 1`,
      [requestId, userId, requestType],
    );
    return mapUserRequestRowToEntity(rows[0]);
  });
}

async function resolveUserRequest({ requestId, decision, decidedBy }) {
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
      return { kind: 'resolved', value: mapUserRequestRowToEntity(updatedRequest.rows[0]) };
    }

    const exists = await client.query(
      `SELECT status, expires_at
         FROM app.user_requests
        WHERE request_id = $1`,
      [requestId],
    );

    if (exists.rowCount === 0) return { kind: 'not_found' };

    const request = mapUserRequestRowToEntity(exists.rows[0]);
    if (new Date(request.expiresAt).getTime() <= Date.now()) {
      return { kind: 'expired' };
    }

    return { kind: 'already_resolved', value: request };
  });
}

async function createPublicAccessMessage({ subject, body }) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO app.user_messages (user_id, type, subject, body)
       VALUES (NULL, 'message', $1, $2)
       RETURNING id, type, subject, body, status, created_at`,
      [subject, body],
    );
    return mapPublicAccessMessageRowToEntity(rows[0]);
  });
}

module.exports = {
  REQUEST_TTL_MS,
  findActiveUserRequest,
  createUserRequest,
  createApprovalRequest: createUserRequest,
  findUserRequest,
  findApprovalRequest: findUserRequest,
  resolveUserRequest,
  resolveApprovalRequest: resolveUserRequest,
  createPublicAccessMessage,
};
