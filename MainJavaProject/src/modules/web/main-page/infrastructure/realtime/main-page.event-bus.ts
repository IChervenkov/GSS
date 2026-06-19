// @ts-nocheck
const { REALTIME_EVENT_NAMES } = require('../../../../../shared/realtime/event-names');
function createMainEventBus({ emitRoomEvent } = {}) {
  function emitPermissionListUpdated() {
    return emitRoomEvent?.('ui:permission:list', REALTIME_EVENT_NAMES.PERMISSION.CATALOG_UPDATED);
  }

  function emitPermissionAccessChanged() {
    return emitRoomEvent?.('presence:authenticated', REALTIME_EVENT_NAMES.PERMISSION.ACCESS_CHANGED);
  }

  function emitPermissionSelfRefresh(userId) {
    if (!userId) return false;
    return emitRoomEvent?.(`user:${userId}`, REALTIME_EVENT_NAMES.PERMISSION.SELF_REFRESHED, { userId });
  }

  function emitUserListAdded() {
    return emitRoomEvent?.('ui:user:list', REALTIME_EVENT_NAMES.USER_RECORD.CREATED);
  }

  function emitUserListUpdated() {
    return emitRoomEvent?.('ui:user:list', REALTIME_EVENT_NAMES.USER_RECORD.UPDATED);
  }

  function emitUserUpdated(userId, username) {
    if (!userId || !username) return false;
    return emitRoomEvent?.('ui:user:list', REALTIME_EVENT_NAMES.USER_RECORD.UPDATED, { userId, username });
  }

  function emitUserDeletedList(deletedUserIds) {
    if (!deletedUserIds) return false;
    return emitRoomEvent?.('ui:user:list', REALTIME_EVENT_NAMES.USER_RECORD.BULK_DELETED, { deletedUserIds });
  }

  function emitUserDeleted(userId) {
    if (!userId) return false;
    return emitRoomEvent?.(`user:${userId}`, REALTIME_EVENT_NAMES.USER_RECORD.DELETED, { userId });
  }

  function emitCampAdded() {
    return emitRoomEvent?.('ui:camp:list', REALTIME_EVENT_NAMES.CAMP_RECORD.CREATED);
  }

  function emitCampEdited(campId) {
    if (!campId) return false;
    return emitRoomEvent?.('ui:camp:list', REALTIME_EVENT_NAMES.CAMP_RECORD.UPDATED, { campId });
  }

  function emitCampDeleted(campId) {
    if (!campId) return false;
    return emitRoomEvent?.('ui:camp:list', REALTIME_EVENT_NAMES.CAMP_RECORD.DELETED, { campId });
  }

  function emitCampAccessChanged() {
    emitRoomEvent?.('ui:camp:list', REALTIME_EVENT_NAMES.CAMP_RECORD.ACCESS_CHANGED);
    return emitRoomEvent?.('ui:permission:list', REALTIME_EVENT_NAMES.CAMP_RECORD.ACCESS_CHANGED);
  }

  function emitCampAccessSelfRefresh(userId) {
    if (!userId) return false;
    return emitRoomEvent?.(`user:${userId}`, REALTIME_EVENT_NAMES.CAMP_RECORD.ACCESS_SELF_REFRESHED, { userId });
  }

  function emitCampImportProgress(userId, payload = {}) {
    if (!userId) return false;
    return emitRoomEvent?.(`user:${userId}`, REALTIME_EVENT_NAMES.CAMP_IMPORT.PROGRESSED, { userId, ...payload });
  }

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
    emitPermissionListUpdated,
    emitPermissionAccessChanged,
    emitPermissionSelfRefresh,
    emitUserListAdded,
    emitUserListUpdated,
    emitUserUpdated,
    emitUserDeletedList,
    emitUserDeleted,
    emitCampAdded,
    emitCampEdited,
    emitCampDeleted,
    emitCampAccessChanged,
    emitCampAccessSelfRefresh,
    emitCampImportProgress,
    emitUserRequestUpdated,
    emitUserRequestResolved,
    emitAdminInboxUpdated,
    emitApprovalResolved: emitUserRequestResolved,
  };
}

module.exports = { createMainEventBus };
