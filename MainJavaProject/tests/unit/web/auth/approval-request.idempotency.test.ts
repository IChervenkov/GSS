const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApprovalService,
} = require('../../../../src/modules/web/auth/application/services/approval.service');

test('requestQr preserves the same request id when the repository reuses an active approval request', async () => {
  const service = createApprovalService({
    repository: {
      createApprovalRequest: async () => ({
        requestId: '22222222-2222-2222-2222-222222222222',
        expiresAt: new Date('2035-01-01T00:00:00.000Z'),
        reused: true,
      }),
    },
    eventBus: { emitUserRequestUpdated: () => {} },
    qrPayloadTtlSeconds: 30,
  });

  const challengeExpiresAt = Date.now() + 60_000;
  const first = await service.requestQr({
    pendingUserId: '11111111-1111-1111-1111-111111111111',
    challengeExpiresAt,
  });
  const second = await service.requestQr({
    pendingUserId: '11111111-1111-1111-1111-111111111111',
    challengeExpiresAt,
  });

  assert.equal(first.body.requestId, second.body.requestId);
  assert.equal(first.body.status, 'pending');
  assert.equal(second.body.status, 'pending');
});
