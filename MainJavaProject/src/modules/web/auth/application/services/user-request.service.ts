const { AppError } = require('../../../../../shared/errors/app-error');
const { ERROR_CODES } = require('../../../../../shared/errors/error-codes');
const { checkSystemPermission } = require('../../domain/auth.policy');
const { accepted, success } = require('../../../../../shared/application/action-result');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');
const { METRIC_NAMES } = require('../../../../../shared/observability/metric-names');

function recordQrMetric(metrics, action, outcome) {
  metrics?.counter?.(METRIC_NAMES.AUTH_USER_REQUESTS_TOTAL, { action, outcome });
}

function createUserRequestService({ repository, eventBus, qrPayloadTtlSeconds, auditLog, metrics }) {
  function buildPublicAccessBody({ name, email, team, access, reason }) {
    const lines = [
      `Full name: ${name}`,
      `Work email: ${email}`,
      `Access need: ${access}`,
      `Reason: ${reason}`,
    ];
    if (team) lines.splice(2, 0, `Team: ${team}`);
    return lines.join('\n');
  }

  async function requestAccess({ name, email, team, access, reason, requestMeta }) {
    if (typeof repository.createPublicAccessMessage !== 'function') {
      throw new AppError({
        status: 500,
        code: 'REQUEST_ACCESS_NOT_CONFIGURED',
        message: 'Access request submission is not configured.',
      });
    }

    const created = await repository.createPublicAccessMessage({
      subject: `Access request: ${name}`,
      body: buildPublicAccessBody({ name, email, team, access, reason }),
    });

    eventBus.emitAdminInboxUpdated?.({
      kind: 'public_access_request',
      sourceId: created?.id,
      type: created?.type,
      status: created?.status,
    });

    auditLog?.(AUDIT_EVENT_NAMES.AUTH.PUBLIC_ACCESS_REQUESTED, {
      ...requestMeta,
      outcome: 'submitted',
      requestType: 'public_access_request',
    });

    return success({
      message: 'Access request sent. An administrator will review it in the user inbox.',
      id: created?.id,
    });
  }

  async function requestQr({ pendingUserId, challengeExpiresAt, requestMeta }) {
    if (!pendingUserId) {
      recordQrMetric(metrics, 'request', 'unauthorized');
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'You must sign in again before requesting the QR code.',
      });
    }
    if (!challengeExpiresAt || Number(challengeExpiresAt) <= Date.now()) {
      recordQrMetric(metrics, 'request', 'challenge_expired');
      throw new AppError({
        status: 410,
        code: ERROR_CODES.REQUEST_EXPIRED,
        message: 'The verification challenge expired. Reload and request a new QR code.',
      });
    }

    const createRequest = repository.createUserRequest || repository.createApprovalRequest;
    const approval = await createRequest({
      userId: pendingUserId,
      requestType: 'show_qr',
      metadata: { reason: 'show_one_time_qr' },
    });
    eventBus.emitUserRequestUpdated?.({
      requestId: approval.requestId,
      requestType: 'show_qr',
      status: 'pending',
      expiresAt: approval.expiresAt,
      userId: pendingUserId,
      version: 1,
    });

    recordQrMetric(metrics, 'request', approval.reused ? 'reused' : 'created');
    auditLog?.(AUDIT_EVENT_NAMES.AUTH.QR_REQUESTED, {
      ...requestMeta,
      targetUserId: pendingUserId,
      requestId: approval.requestId,
      reused: approval.reused,
      outcome: 'success',
    });

    return accepted({
      status: 'pending',
      message: 'Waiting for administrator approval.',
      requestId: approval.requestId,
      expiresAt: new Date(approval.expiresAt).toISOString(),
    });
  }

  async function getApprovedQrPayload({
    pendingUserId,
    qrCodeDataURL,
    requestId,
    qrRequestId,
    challengeExpiresAt,
    markQrPayloadConsumed,
    requestMeta,
  }) {
    if (!pendingUserId) {
      recordQrMetric(metrics, 'poll', 'unauthorized');
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'You must sign in again before loading the QR code.',
      });
    }
    if (!requestId) {
      recordQrMetric(metrics, 'poll', 'missing_request_id');
      throw new AppError({
        status: 400,
        code: ERROR_CODES.REQUEST_ID_REQUIRED,
        message: 'Request ID is required.',
      });
    }
    if (!challengeExpiresAt || Number(challengeExpiresAt) <= Date.now()) {
      recordQrMetric(metrics, 'poll', 'challenge_expired');
      throw new AppError({
        status: 410,
        code: ERROR_CODES.REQUEST_EXPIRED,
        message: 'The verification challenge expired. Reload and request a new QR code.',
      });
    }
    if (qrRequestId && qrRequestId !== requestId) {
      recordQrMetric(metrics, 'poll', 'request_mismatch');
      throw new AppError({
        status: 409,
        code: ERROR_CODES.QR_NOT_AVAILABLE,
        message: 'QR request does not match the active session challenge.',
      });
    }

    const findRequest = repository.findUserRequest || repository.findApprovalRequest;
    const userRequest = await findRequest(
      requestId,
      pendingUserId,
      'show_qr',
    );
    if (!userRequest) {
      recordQrMetric(metrics, 'poll', 'not_found');
      throw new AppError({
        status: 404,
        code: ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'QR approval request not found.',
      });
    }

    if (new Date(userRequest.expiresAt).getTime() <= Date.now()) {
      recordQrMetric(metrics, 'poll', 'request_expired');
      throw new AppError({
        status: 410,
        code: ERROR_CODES.REQUEST_EXPIRED,
        message: 'QR approval request expired.',
      });
    }

    if (userRequest.status === 'denied') {
      recordQrMetric(metrics, 'poll', 'denied');
      auditLog?.(AUDIT_EVENT_NAMES.AUTH.QR_DENIED, {
        ...requestMeta,
        targetUserId: pendingUserId,
        requestId,
        outcome: 'denied',
      });
      throw new AppError({
        status: 403,
        code: ERROR_CODES.REQUEST_DENIED,
        message: 'The administrator denied the QR code request.',
      });
    }

    if (userRequest.status !== 'approved') {
      recordQrMetric(metrics, 'poll', 'pending');
      return accepted({
        status: userRequest.status,
        requestId: userRequest.requestId,
        message: 'Approval is still pending.',
      });
    }

    if (!qrCodeDataURL) {
      recordQrMetric(metrics, 'reveal', 'missing_payload');
      throw new AppError({
        status: 409,
        code: ERROR_CODES.QR_NOT_AVAILABLE,
        message:
          'QR data is not available in this session. Reload the verification page and request again.',
      });
    }

    await markQrPayloadConsumed?.();
    recordQrMetric(metrics, 'reveal', 'success');
    auditLog?.(AUDIT_EVENT_NAMES.AUTH.QR_REVEALED, {
      ...requestMeta,
      targetUserId: pendingUserId,
      requestId,
      outcome: 'success',
    });

    return success({
      status: 'approved',
      requestId: userRequest.requestId,
      qrCodeDataURL,
      ttlSeconds: qrPayloadTtlSeconds,
    });
  }

  async function verifyAdminDecision({ userId, requestId, decision, requestMeta }) {
    const allowedDecisions = new Set(['approved', 'denied']);
    if (!allowedDecisions.has(decision)) {
      recordQrMetric(metrics, 'decision', 'invalid_decision');
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_DECISION,
        message: 'Invalid approval decision.',
      });
    }

    await checkSystemPermission(repository, userId);

    const resolveRequest = repository.resolveUserRequest || repository.resolveApprovalRequest;
    const resolved = await resolveRequest({
      requestId,
      decision,
      decidedBy: userId,
    });

    if (resolved.kind === 'not_found') {
      recordQrMetric(metrics, 'decision', 'not_found');
      throw new AppError({
        status: 404,
        code: ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'Request not found.',
      });
    }
    if (resolved.kind === 'expired') {
      recordQrMetric(metrics, 'decision', 'expired');
      throw new AppError({
        status: 410,
        code: ERROR_CODES.REQUEST_EXPIRED,
        message: 'Request expired.',
      });
    }
    if (resolved.kind === 'already_resolved') {
      recordQrMetric(metrics, 'decision', 'already_resolved');
      throw new AppError({
        status: 409,
        code: ERROR_CODES.REQUEST_ALREADY_RESOLVED,
        message: `Request already ${resolved.value.status}.`,
      });
    }

    const request = resolved.value;
    eventBus.emitUserRequestUpdated?.(request);
    const emitResolved = eventBus.emitUserRequestResolved || eventBus.emitApprovalResolved;
    emitResolved?.(request);
    recordQrMetric(metrics, 'decision', request.status);
    auditLog?.(AUDIT_EVENT_NAMES.AUTH.USER_REQUEST_RESOLVED, {
      ...requestMeta,
      actorUserId: userId,
      approverUserId: userId,
      requestId: request.requestId,
      decision: request.status,
      targetUserId: request.userId,
      requestType: request.requestType,
      outcome: request.status === 'approved' ? 'success' : 'denied',
    });

    return success({
      requestId: request.requestId,
      decision: request.status,
      requestType: request.requestType,
      userId: request.userId,
    });
  }

  return {
    requestAccess,
    requestQr,
    getApprovedQrPayload,
    verifyAdminDecision,
  };
}

module.exports = { createUserRequestService, createApprovalService: createUserRequestService };
module.exports = Object.assign(createUserRequestService, { createUserRequestService, createApprovalService: createUserRequestService });
