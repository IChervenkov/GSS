const { withClient, withTransaction } = require('../../../../../infrastructure/db/transaction');
const { REVOCATION_REASONS } = require('../../domain/refresh-session.constants');

function mapSessionRowToEntity(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token,
    refreshJti: row.refresh_jti || null,
    deviceId: row.device_id,
    deviceName: row.device_name || null,
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    lastIpAddress: row.last_ip_address || null,
    lastUserAgent: row.last_user_agent || null,
    clientFingerprintHash: row.client_fingerprint_hash || null,
    sessionFamilyId: row.session_family_id || null,
    lastUsedAt: row.last_used_at || null,
    revokedReason: row.revoked_reason || null,
    expiresAt: row.expires_at,
    revoked: Boolean(row.revoked),
    tokenVersion: Number.isInteger(row.token_version) ? row.token_version : Number(row.token_version || 0),
    currentTokenVersion: Number.isInteger(row.current_token_version)
      ? row.current_token_version
      : Number(row.current_token_version || 0),
  };
}

function mapUserRowToEntity(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    temporaryPassword: row.temporary_password,
    totpSecret: row.totp_secret,
    isLocked: Boolean(row.is_locked),
    tokenVersion: Number(row.token_version || 0),
  };
}

async function findUserByUsername(username) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT id, username, password, temporary_password, totp_secret, is_locked, token_version
         FROM app.users
        WHERE username = $1
        LIMIT 1`,
      [username],
    );
    return mapUserRowToEntity(rows[0]);
  });
}

async function updateUserTotpSecret(userId, secret) {
  return withClient(async (client) => {
    await client.query('UPDATE app.users SET totp_secret = $1 WHERE id = $2', [secret, userId]);
  });
}

async function createRefreshSession({
  userId,
  refreshTokenHash,
  refreshJti,
  deviceId,
  deviceName,
  tokenVersion,
  ttlDays,
  requestMeta,
}) {
  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO app.user_sessions (
          user_id,
          refresh_token,
          refresh_jti,
          device_id,
          device_name,
          token_version,
          ip_address,
          user_agent,
          last_ip_address,
          last_user_agent,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $7::inet, $8, NOW() + ($9::int * interval '1 day'))
        RETURNING id`,
      [
        userId,
        refreshTokenHash,
        refreshJti || null,
        deviceId || 'unknown-device',
        deviceName || null,
        Number(tokenVersion || 0),
        requestMeta?.ip || null,
        requestMeta?.userAgent || null,
        String(ttlDays),
      ],
    );
    return { id: result.rows[0]?.id || null };
  });
}

async function applyRefreshSessionConcurrencyPolicy({
  client,
  userId,
  deviceId,
  keepSessionId,
  maxActivePerUser,
  maxActivePerDevice,
}) {
  if (Number.isInteger(maxActivePerUser) && maxActivePerUser > 0) {
    await client.query(
      `WITH ranked AS (
         SELECT id,
                ROW_NUMBER() OVER (
                  PARTITION BY user_id
                  ORDER BY COALESCE(last_used_at, updated_at, created_at) DESC, updated_at DESC, created_at DESC
                ) AS session_rank
           FROM app.user_sessions
          WHERE user_id = $1
            AND revoked = FALSE
            AND expires_at > NOW()
        )
        UPDATE app.user_sessions AS sessions
           SET revoked = TRUE,
               revoked_reason = $2,
               updated_at = NOW()
          FROM ranked
         WHERE sessions.id = ranked.id
           AND ranked.session_rank > $3
           AND sessions.id <> $4`,
      [userId, REVOCATION_REASONS.CONCURRENCY_LIMIT, maxActivePerUser, keepSessionId],
    );
  }

  if (deviceId && Number.isInteger(maxActivePerDevice) && maxActivePerDevice > 0) {
    await client.query(
      `WITH ranked AS (
         SELECT id,
                ROW_NUMBER() OVER (
                  PARTITION BY user_id, device_id
                  ORDER BY COALESCE(last_used_at, updated_at, created_at) DESC, updated_at DESC, created_at DESC
                ) AS session_rank
           FROM app.user_sessions
          WHERE user_id = $1
            AND device_id = $2
            AND revoked = FALSE
            AND expires_at > NOW()
        )
        UPDATE app.user_sessions AS sessions
           SET revoked = TRUE,
               revoked_reason = $3,
               updated_at = NOW()
          FROM ranked
         WHERE sessions.id = ranked.id
           AND ranked.session_rank > $4
           AND sessions.id <> $5`,
      [userId, deviceId, REVOCATION_REASONS.CONCURRENCY_LIMIT, maxActivePerDevice, keepSessionId],
    );
  }
}

async function rotateRefreshSession({
  userId,
  refreshTokenHash,
  refreshJti,
  deviceId,
  expectedTokenVersion,
  nextRefreshHash,
  nextRefreshJti,
  ttlDays,
  clientFingerprintHash,
  requestMeta,
  maxActivePerUser,
  maxActivePerDevice,
}) {
  return withTransaction(async (client) => {
    const sessionRes = await client.query(
      `SELECT sessions.id,
              sessions.user_id,
              sessions.refresh_token,
              sessions.refresh_jti,
              sessions.device_id,
              sessions.device_name,
              sessions.ip_address,
              sessions.user_agent,
              sessions.last_ip_address,
              sessions.last_user_agent,
              sessions.client_fingerprint_hash,
              sessions.session_family_id,
              sessions.last_used_at,
              sessions.revoked_reason,
              sessions.expires_at,
              sessions.revoked,
              sessions.token_version,
              users.token_version AS current_token_version
         FROM app.user_sessions AS sessions
         JOIN app.users AS users ON users.id = sessions.user_id
        WHERE sessions.user_id = $1
          AND (sessions.refresh_token = $2 OR ($3::text IS NOT NULL AND sessions.refresh_jti = $3))
        ORDER BY (sessions.refresh_token = $2) DESC,
                 (sessions.refresh_jti = $3) DESC,
                 sessions.updated_at DESC,
                 sessions.created_at DESC
        LIMIT 1
        FOR UPDATE OF sessions, users`,
      [userId, refreshTokenHash, refreshJti || null],
    );

    if (sessionRes.rowCount === 0) {
      return { ok: false, reason: REVOCATION_REASONS.NOT_FOUND };
    }

    const session = mapSessionRowToEntity(sessionRes.rows[0]);

    if (session.refreshTokenHash !== refreshTokenHash) {
      await client.query(
        `UPDATE app.user_sessions
            SET revoked = TRUE,
                revoked_reason = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [session.id, REVOCATION_REASONS.HASH_MISMATCH],
      );
      return { ok: false, reason: REVOCATION_REASONS.HASH_MISMATCH, session };
    }

    if (session.revoked) {
      return {
        ok: false,
        reason: session.revokedReason || REVOCATION_REASONS.REVOKED,
        session,
      };
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await client.query(
        `UPDATE app.user_sessions
            SET revoked = TRUE,
                revoked_reason = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [session.id, REVOCATION_REASONS.EXPIRED],
      );
      return { ok: false, reason: REVOCATION_REASONS.EXPIRED, session };
    }

    if (deviceId && session.deviceId && String(deviceId) !== String(session.deviceId)) {
      await client.query(
        `UPDATE app.user_sessions
            SET revoked = TRUE,
                revoked_reason = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [session.id, REVOCATION_REASONS.DEVICE_MISMATCH],
      );
      return { ok: false, reason: REVOCATION_REASONS.DEVICE_MISMATCH, session };
    }

    if (
      clientFingerprintHash &&
      session.clientFingerprintHash &&
      String(clientFingerprintHash) !== String(session.clientFingerprintHash)
    ) {
      await client.query(
        `UPDATE app.user_sessions
            SET revoked = TRUE,
                revoked_reason = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [session.id, REVOCATION_REASONS.FINGERPRINT_MISMATCH],
      );
      return { ok: false, reason: REVOCATION_REASONS.FINGERPRINT_MISMATCH, session };
    }

    if (session.currentTokenVersion !== Number(expectedTokenVersion || 0)) {
      await client.query(
        `UPDATE app.user_sessions
            SET revoked = TRUE,
                revoked_reason = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [session.id, REVOCATION_REASONS.TOKEN_VERSION_MISMATCH],
      );
      return { ok: false, reason: REVOCATION_REASONS.TOKEN_VERSION_MISMATCH, session };
    }

    await client.query(
      `UPDATE app.user_sessions
          SET refresh_token = $1,
              refresh_jti = $2,
              token_version = $3,
              last_used_at = NOW(),
              updated_at = NOW(),
              expires_at = NOW() + ($4::int * interval '1 day'),
              revoked = FALSE,
              revoked_reason = NULL,
              ip_address = COALESCE(ip_address, $5::inet),
              user_agent = COALESCE(user_agent, $6),
              last_ip_address = $5::inet,
              last_user_agent = $6,
              client_fingerprint_hash = COALESCE($7, client_fingerprint_hash)
        WHERE id = $8`,
      [
        nextRefreshHash,
        nextRefreshJti || null,
        session.currentTokenVersion,
        String(ttlDays),
        requestMeta?.ip || null,
        requestMeta?.userAgent || null,
        clientFingerprintHash || null,
        session.id,
      ],
    );

    await applyRefreshSessionConcurrencyPolicy({
      client,
      userId,
      deviceId: deviceId || session.deviceId,
      keepSessionId: session.id,
      maxActivePerUser,
      maxActivePerDevice,
    });

    return {
      ok: true,
      session: {
        ...session,
        tokenVersion: session.currentTokenVersion,
        refreshJti: nextRefreshJti || null,
        lastUsedAt: new Date().toISOString(),
        lastIpAddress: requestMeta?.ip || session.lastIpAddress,
        lastUserAgent: requestMeta?.userAgent || session.lastUserAgent,
        clientFingerprintHash: clientFingerprintHash || session.clientFingerprintHash,
      },
    };
  });
}

async function getUserTokenState(userId) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, token_version
         FROM app.users
        WHERE id = $1`,
      [userId],
    );

    if (result.rowCount === 0) return null;
    return {
      userId: result.rows[0].id,
      tokenVersion: Number(result.rows[0].token_version || 0),
    };
  });
}

async function revokeRefreshSessionForCurrentDevice({ userId, deviceId, reason = REVOCATION_REASONS.CURRENT_DEVICE_REVOKED }) {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE app.user_sessions
          SET revoked = TRUE,
              revoked_reason = $3,
              updated_at = NOW()
        WHERE user_id = $1
          AND device_id = $2
          AND revoked = FALSE`,
      [userId, deviceId, reason],
    );
    return { revokedCount: result.rowCount };
  });
}

async function revokeAllRefreshSessionsForUser({ userId, reason = REVOCATION_REASONS.USER_REVOKED, excludeSessionId = null }) {
  return withClient(async (client) => {
    const params = [userId, reason];
    let exclusionSql = '';
    if (excludeSessionId) {
      params.push(excludeSessionId);
      exclusionSql = ` AND id <> $${params.length}`;
    }

    const result = await client.query(
      `UPDATE app.user_sessions
          SET revoked = TRUE,
              revoked_reason = $2,
              updated_at = NOW()
        WHERE user_id = $1
          AND revoked = FALSE${exclusionSql}`,
      params,
    );
    return { revokedCount: result.rowCount };
  });
}

async function revokeRefreshSessionsByAdmin({ targetUserId, adminUserId = null, reason = REVOCATION_REASONS.ADMIN_REVOKED }) {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE app.user_sessions
          SET revoked = TRUE,
              revoked_reason = $2,
              updated_at = NOW()
        WHERE user_id = $1
          AND revoked = FALSE`,
      [targetUserId, reason],
    );
    return { revokedCount: result.rowCount, targetUserId, adminUserId };
  });
}

module.exports = {
  REVOCATION_REASONS,
  createRefreshSession,
  findUserByUsername,
  rotateRefreshSession,
  getUserTokenState,
  revokeRefreshSessionForCurrentDevice,
  revokeAllRefreshSessionsForUser,
  revokeRefreshSessionsByAdmin,
  updateUserTotpSecret,
};
