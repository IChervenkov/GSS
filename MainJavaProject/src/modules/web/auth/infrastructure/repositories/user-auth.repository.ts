const { withClient } = require('../../../../../infrastructure/db/transaction');
const { mapRow } = require('../../../../../infrastructure/db/repository-utils');

const mapUserRowToEntity = (row) =>
  mapRow(row, {
    id: 'id',
    username: 'username',
    password: 'password',
    temporaryPassword: 'temporary_password',
    totpSecret: 'totp_secret',
    isLocked: (source) => Boolean(source.is_locked),
  });

async function findUserByUsername(username) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT id, username, password, temporary_password, totp_secret, is_locked
         FROM app.users
        WHERE username = $1
        LIMIT 1`,
      [username],
    );
    return mapUserRowToEntity(rows[0]);
  });
}

async function findUserTotpSecretById(userId) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT id, username, totp_secret, is_locked
         FROM app.users
        WHERE id = $1
        LIMIT 1`,
      [userId],
    );
    return mapUserRowToEntity(rows[0]);
  });
}

async function updateUserTotpSecret(userId, secret) {
  return withClient(async (client) => {
    await client.query('UPDATE app.users SET totp_secret = $1 WHERE id = $2', [secret, userId]);
  });
}

async function updateUserPassword({ userId, hashedPassword, clearTemporaryPassword = true }) {
  return withClient(async (client) => {
    await client.query(
      `UPDATE app.users
          SET password = $1,
              temporary_password = CASE WHEN $3::boolean THEN NULL ELSE temporary_password END
        WHERE id = $2`,
      [hashedPassword, userId, clearTemporaryPassword],
    );
  });
}

async function userHasPermission(userId, permissionName) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT EXISTS (
        SELECT 1
          FROM app.user_permissions up
          JOIN app.permissions p ON p.id = up.permission_id
         WHERE up.user_id = $1
           AND p.name = $2
      ) AS ok`,
      [userId, permissionName],
    );
    return Boolean(rows[0]?.ok);
  });
}

module.exports = {
  findUserByUsername,
  findUserTotpSecretById,
  updateUserTotpSecret,
  updateUserPassword,
  userHasPermission,
};
