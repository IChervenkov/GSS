const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');

function mapPasswordChangeRequestRowToEntity(row) {
  if (!row) return null;
  return {
    requestId: row.request_id,
    userId: row.user_id,
    status: row.status,
    expiresAt: row.expires_at,
    requestType: row.type,
    metadata: row.metadata || {},
  };
}

async function findPasswordChangeRequest(requestId) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT request_id, user_id, status, expires_at, type, metadata
         FROM app.user_requests
        WHERE request_id = $1
          AND type = 'password_change'
        LIMIT 1`,
      [requestId],
    );
    return mapPasswordChangeRequestRowToEntity(rows[0]);
  });
}

async function completePasswordChange({ userId, hashedNewPassword, requestId }) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE app.users
          SET password = $1,
              temporary_password = NULL,
              token_version = token_version + 1
        WHERE id = $2`,
      [hashedNewPassword, userId],
    );

    await client.query(
      `UPDATE app.user_sessions
          SET revoked = TRUE,
              updated_at = NOW()
        WHERE user_id = $1
          AND revoked = FALSE`,
      [userId],
    );

    await client.query(
      `UPDATE app.user_requests
          SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('completedAt', NOW()),
              updated_at = NOW()
        WHERE request_id = $1`,
      [requestId],
    );
  });
}

module.exports = {
  findPasswordChangeRequest,
  completePasswordChange,
};
