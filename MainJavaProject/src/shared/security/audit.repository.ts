const { withClient } = require('../../infrastructure/db/transaction');

async function insertAuditLog({ event, meta = {} }) {
  const {
    reqId = null,
    actorUserId = null,
    userId = null,
    pendingUserId = null,
    targetUserId = null,
    approverUserId = null,
    ip = null,
    userAgent = null,
    method = null,
    path = null,
    statusCode = null,
    ...metadata
  } = meta || {};

  await withClient((client) =>
    client.query(
      `INSERT INTO app.security_audit_logs (
      event_name,
      req_id,
      actor_user_id,
      pending_user_id,
      target_user_id,
      approver_user_id,
      ip_address,
      user_agent,
      request_method,
      request_path,
      status_code,
      metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::inet,$8,$9,$10,$11,$12::jsonb)`,
      [
        event,
        reqId,
        actorUserId || userId,
        pendingUserId,
        targetUserId,
        approverUserId,
        ip,
        userAgent,
        method,
        path,
        statusCode,
        JSON.stringify(metadata || {}),
      ],
    ),
  );
}

module.exports = {
  insertAuditLog,
};
