const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

test('createApprovalRequest reuses an active pending request inside one transaction', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/auth/infrastructure/repositories/approval-request.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query() {
              return { rows: [] };
            },
          }),
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('SELECT pg_advisory_xact_lock')) {
                return { rows: [] };
              }
              if (sql.includes('FROM app.user_requests') && sql.includes("status = 'pending'")) {
                return {
                  rows: [
                    {
                      request_id: 'request-1',
                      user_id: 'user-1',
                      status: 'pending',
                      expires_at: '2035-01-01T00:00:00.000Z',
                      type: 'show_qr',
                      metadata: { scope: 'qr' },
                    },
                  ],
                };
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
          }),
      },
      crypto: {
        randomUUID: () => 'generated-request-id',
      },
    },
  );

  const result = await repository.createApprovalRequest({
    userId: 'user-1',
    requestType: 'show_qr',
    metadata: { scope: 'qr' },
  });

  assert.deepEqual(result, {
    requestId: 'request-1',
    expiresAt: '2035-01-01T00:00:00.000Z',
    reused: true,
  });

  const lockQuery = queries.find((entry) => entry.sql.includes('SELECT pg_advisory_xact_lock'));
  assert.ok(lockQuery);
  assert.deepEqual(lockQuery.params, ['approval:user-1:show_qr']);
});
