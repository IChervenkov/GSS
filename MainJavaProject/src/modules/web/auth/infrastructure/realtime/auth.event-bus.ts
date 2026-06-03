// @ts-nocheck
const { REALTIME_EVENT_NAMES } = require('../../../../../shared/realtime/event-names');

function createAuthEventBus({ emitRoomEvent } = {}) {
  function emitUserRequestUpdated(request) {
    const requestId = request?.request_id || request?.requestId;
    const requestType = request?.requestType || request?.type || request?.request_type || null;
    const userId = request?.user_id || request?.userId;
    const status = request?.status;
    const expiresAt = request?.expires_at || request?.expiresAt || null;

    if (!requestType || !userId || !requestId || !status) {
      return false;
    }

    return emitRoomEvent?.('ui:user:list', REALTIME_EVENT_NAMES.USER_REQUEST.UPDATED, {
      requestId,
      requestType,
      status,
      expiresAt,
      userId,
      version: Number(request.version || 1),
    });
  }

  function emitUserRequestResolved(request) {
    const requestId = request?.request_id || request?.requestId;
    const requestType = request?.requestType || request?.type || request?.request_type || null;
    const userId = request?.user_id || request?.userId;

    if (!requestType || !userId || !requestId) {
      return false;
    }

    return emitRoomEvent?.(`user:${userId}`, REALTIME_EVENT_NAMES.USER_REQUEST.RESOLVED, {
      requestId,
      requestType,
      status: request.status,
      userId,
      version: Number(request.version || 1),
    });
  }

  function emitAdminInboxUpdated(payload = {}) {
    return emitRoomEvent?.('ui:user:list', REALTIME_EVENT_NAMES.ADMIN_INBOX.UPDATED, payload);
  }

  return {
    emitUserRequestUpdated,
    emitUserRequestResolved,
    emitAdminInboxUpdated,
    emitApprovalResolved: emitUserRequestResolved,
  };
}

module.exports = { createAuthEventBus };
