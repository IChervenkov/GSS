const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApprovalService,
} = require('../../../../src/modules/web/auth/application/services/approval.service');
const { AppError } = require('../../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../../src/shared/errors/error-codes');

const validUserId = '11111111-1111-1111-1111-111111111111';
const validRequestId = '22222222-2222-2222-2222-222222222222';

test('requestQr returns pending approval payload', async () => {
  const emitted = [];
  const service = createApprovalService({
    repository: {
      createApprovalRequest: async () => ({
        requestId: validRequestId,
        expiresAt: new Date('2035-01-01T00:00:00.000Z'),
        reused: false,
      }),
    },
    eventBus: {
      emitApprovalResolved: () => {},
      emitUserRequestUpdated: (payload) => emitted.push(payload),
    },
    qrPayloadTtlSeconds: 30,
  });

  const result = await service.requestQr({
    pendingUserId: validUserId,
    challengeExpiresAt: Date.now() + 60_000,
  });
  assert.equal(result.status, 202);
  assert.equal(result.body.status, 'pending');
  assert.equal(result.body.requestId, validRequestId);
  assert.equal(result.body.message, 'Waiting for administrator approval.');
  assert.deepEqual(emitted, [
    {
      requestId: validRequestId,
      requestType: 'show_qr',
      status: 'pending',
      expiresAt: new Date('2035-01-01T00:00:00.000Z'),
      userId: validUserId,
      version: 1,
    },
  ]);
});

test('getApprovedQrPayload returns 202 while approval is still pending', async () => {
  const service = createApprovalService({
    repository: {
      findApprovalRequest: async () => ({
        requestId: validRequestId,
        userId: validUserId,
        status: 'pending',
        expiresAt: '2035-01-01T00:00:00.000Z',
      }),
    },
    eventBus: { emitApprovalResolved: () => {} },
    qrPayloadTtlSeconds: 30,
  });

  const result = await service.getApprovedQrPayload({
    pendingUserId: validUserId,
    requestId: validRequestId,
    qrRequestId: validRequestId,
    challengeExpiresAt: Date.now() + 60_000,
    qrCodeDataURL: 'data:image/png;base64,abc',
  });

  assert.deepEqual(result, {
    status: 202,
    body: {
      status: 'pending',
      requestId: validRequestId,
      message: 'Approval is still pending.',
    },
  });
});

test('verifyAdminDecision rejects invalid decision', async () => {
  const service = createApprovalService({
    repository: {
      userHasPermission: async () => true,
      resolveApprovalRequest: async () => ({ kind: 'resolved', value: {} }),
    },
    eventBus: { emitApprovalResolved: () => {} },
    qrPayloadTtlSeconds: 30,
  });

  await assert.rejects(
    () =>
      service.verifyAdminDecision({
        userId: validUserId,
        requestId: validRequestId,
        decision: 'maybe',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 400);
      assert.equal(error.code, ERROR_CODES.INVALID_DECISION);
      return true;
    },
  );
});

test('verifyAdminDecision emits resolved event and returns normalized response', async () => {
  let emittedRequest = null;
  let emittedUserRequest = null;
  const service = createApprovalService({
    repository: {
      userHasPermission: async () => true,
      resolveApprovalRequest: async () => ({
        kind: 'resolved',
        value: {
          requestId: validRequestId,
          userId: validUserId,
          status: 'approved',
          requestType: 'show_qr',
        },
      }),
    },
    eventBus: {
      emitUserRequestUpdated: (request) => {
        emittedUserRequest = request;
      },
      emitApprovalResolved: (request) => {
        emittedRequest = request;
      },
    },
    qrPayloadTtlSeconds: 30,
  });

  const result = await service.verifyAdminDecision({
    userId: validUserId,
    requestId: validRequestId,
    decision: 'approved',
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.requestId, validRequestId);
  assert.equal(result.body.decision, 'approved');
  assert.deepEqual(emittedRequest, {
    requestId: validRequestId,
    userId: validUserId,
    status: 'approved',
    requestType: 'show_qr',
  });
  assert.deepEqual(emittedUserRequest, {
    requestId: validRequestId,
    userId: validUserId,
    status: 'approved',
    requestType: 'show_qr',
  });
});

test('verifyAdminDecision emits one resolved event when both realtime aliases are present', async () => {
  let resolvedCount = 0;
  const service = createApprovalService({
    repository: {
      userHasPermission: async () => true,
      resolveApprovalRequest: async () => ({
        kind: 'resolved',
        value: {
          requestId: validRequestId,
          userId: validUserId,
          status: 'approved',
          requestType: 'show_qr',
        },
      }),
    },
    eventBus: {
      emitUserRequestUpdated: () => {},
      emitUserRequestResolved: () => {
        resolvedCount += 1;
      },
      emitApprovalResolved: () => {
        resolvedCount += 1;
      },
    },
    qrPayloadTtlSeconds: 30,
  });

  await service.verifyAdminDecision({
    userId: validUserId,
    requestId: validRequestId,
    decision: 'approved',
  });

  assert.equal(resolvedCount, 1);
});

test('verifyAdminDecision returns 404 when the request no longer exists', async () => {
  const service = createApprovalService({
    repository: {
      userHasPermission: async () => true,
      resolveApprovalRequest: async () => ({ kind: 'not_found' }),
    },
    eventBus: { emitApprovalResolved: () => {} },
    qrPayloadTtlSeconds: 30,
  });

  await assert.rejects(
    () =>
      service.verifyAdminDecision({
        userId: validUserId,
        requestId: validRequestId,
        decision: 'approved',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 404);
      assert.equal(error.code, ERROR_CODES.REQUEST_NOT_FOUND);
      return true;
    },
  );
});

test('verifyAdminDecision returns 410 when the request expired before the decision', async () => {
  const service = createApprovalService({
    repository: {
      userHasPermission: async () => true,
      resolveApprovalRequest: async () => ({ kind: 'expired' }),
    },
    eventBus: { emitApprovalResolved: () => {} },
    qrPayloadTtlSeconds: 30,
  });

  await assert.rejects(
    () =>
      service.verifyAdminDecision({
        userId: validUserId,
        requestId: validRequestId,
        decision: 'approved',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 410);
      assert.equal(error.code, ERROR_CODES.REQUEST_EXPIRED);
      return true;
    },
  );
});

test('verifyAdminDecision returns 409 when the request was already resolved', async () => {
  const service = createApprovalService({
    repository: {
      userHasPermission: async () => true,
      resolveApprovalRequest: async () => ({
        kind: 'already_resolved',
        value: { status: 'denied' },
      }),
    },
    eventBus: { emitApprovalResolved: () => {} },
    qrPayloadTtlSeconds: 30,
  });

  await assert.rejects(
    () =>
      service.verifyAdminDecision({
        userId: validUserId,
        requestId: validRequestId,
        decision: 'approved',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 409);
      assert.equal(error.code, ERROR_CODES.REQUEST_ALREADY_RESOLVED);
      return true;
    },
  );
});
