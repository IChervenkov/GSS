const { REALTIME_EVENT_NAMES } = require('../../../../../shared/realtime/event-names');

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isRentStatus(value) {
  return ['rented', 'long_term'].includes(normalizeStatus(value));
}

function isLateStatus(value) {
  return normalizeStatus(value) === 'late';
}

function createBicyclesEventBus({ emitRoomEvent } = {}) {
  function emitBicycleAdded() {
    return emitRoomEvent?.('ui:bicycle:list', REALTIME_EVENT_NAMES.BICYCLE_RECORD.CREATED);
  }

  function emitBicycleUpdated(identifier) {
    if (!identifier) return false;
    return emitRoomEvent?.('ui:bicycle:list', REALTIME_EVENT_NAMES.BICYCLE_RECORD.UPDATED, {
      identifier,
    });
  }

  function emitBicycleDeleted(identifier) {
    if (!identifier) return false;
    return emitRoomEvent?.('ui:bicycle:list', REALTIME_EVENT_NAMES.BICYCLE_RECORD.DELETED, {
      identifier,
    });
  }

  function emitBicycleStatusChanged(identifier, payload = {}) {
    if (!identifier) return false;
    const eventPayload = {
      identifier,
      ...payload,
    };
    const bicycleListEmitted = emitRoomEvent?.(
      'ui:bicycle:list',
      REALTIME_EVENT_NAMES.BICYCLE_RECORD.STATUS_CHANGED,
      eventPayload,
    );
    const shouldNotifyWorkspace = isRentStatus(payload.previousStatus) && isLateStatus(payload.status);
    const workspaceNotificationEmitted = shouldNotifyWorkspace
      ? emitRoomEvent?.(
          'ui:workspace:notifications',
          REALTIME_EVENT_NAMES.BICYCLE_RECORD.STATUS_CHANGED,
          eventPayload,
        )
      : false;
    return Boolean(bicycleListEmitted || workspaceNotificationEmitted);
  }

  function emitBicycleImportProgress(userId, payload = {}) {
    if (!userId) return false;
    return emitRoomEvent?.(`user:${userId}`, REALTIME_EVENT_NAMES.BICYCLE_IMPORT.PROGRESSED, {
      userId,
      ...payload,
    });
  }

  return {
    emitBicycleAdded,
    emitBicycleUpdated,
    emitBicycleDeleted,
    emitBicycleStatusChanged,
    emitBicycleImportProgress,
  };
}

module.exports = { createBicyclesEventBus };
