const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApprovalService,
} = require('../../../../src/modules/web/auth/application/services/approval.service');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

test('getApprovedQrPayload rejects expired QR approval requests', async () => {
  const service = createApprovalService({
    repository: {
      findApprovalRequest: async () => ({
        requestId: '22222222-2222-2222-2222-222222222222',
        userId: '11111111-1111-1111-1111-111111111111',
        status: 'approved',
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
    },
    eventBus: {},
    qrPayloadTtlSeconds: 30,
  });

  await assert.rejects(
    () =>
      service.getApprovedQrPayload({
        pendingUserId: '11111111-1111-1111-1111-111111111111',
        qrCodeDataURL: 'data:image/png;base64,abc',
        requestId: '22222222-2222-2222-2222-222222222222',
        qrRequestId: '22222222-2222-2222-2222-222222222222',
        challengeExpiresAt: Date.now() + 60_000,
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 410);
      assert.equal(error.code, ERROR_CODES.REQUEST_EXPIRED);
      return true;
    },
  );
});
