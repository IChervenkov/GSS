const test = require('node:test');
const assert = require('node:assert/strict');

const { Client } = require('pg');
const crypto = require('node:crypto');
const {
  createApprovalRequest,
  findApprovalRequest,
} = require('../../../src/modules/web/auth/infrastructure/repositories/approval-request.repository');

const connectionString =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || '';

async function withDb(fn) {
  if (!connectionString) return test.skip('TEST_DATABASE_URL / DATABASE_URL_TEST not configured');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}

test('approval request repository reuses an active pending request in a real Postgres database', async () => {
  await withDb(async (client) => {
    const userId = crypto.randomUUID();
    const username = `repo.integration.${userId}`;
    await client.query(`SET search_path TO app, public`);

    try {
      await client.query(
        `INSERT INTO app.users (id, username, password, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [userId, username, 'hash'],
      );

      const first = await createApprovalRequest({
        userId,
        requestType: 'show_qr',
        metadata: { source: 'integration-test' },
      });
      const second = await createApprovalRequest({
        userId,
        requestType: 'show_qr',
        metadata: { source: 'integration-test' },
      });

      assert.equal(second.reused, true);
      assert.equal(first.requestId, second.requestId);

      const found = await findApprovalRequest(first.requestId, userId, 'show_qr');
      assert.equal(found.requestId, first.requestId);
      assert.equal(found.userId, userId);
    } finally {
      await client.query(`DELETE FROM app.user_requests WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM app.users WHERE id = $1`, [userId]);
    }
  });
});
