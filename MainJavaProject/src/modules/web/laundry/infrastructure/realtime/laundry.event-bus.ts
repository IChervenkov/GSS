// @ts-nocheck
const { REALTIME_EVENT_NAMES } = require('../../../../../shared/realtime/event-names');

function createLaundryEventBus({ emitRoomEvent } = {}) {
  function emitLaundryChanged(campId) {
    if (!campId) return false;
    const payload = { campId };
    const laundryEmitted = emitRoomEvent?.(
      'ui:laundry:list',
      REALTIME_EVENT_NAMES.LAUNDRY_RECORD.CHANGED,
      payload,
    );
    const accommodationEmitted = emitRoomEvent?.(
      'ui:accommodation:list',
      REALTIME_EVENT_NAMES.ACCOMMODATION_RECORD.CHANGED,
      payload,
    );
    return [laundryEmitted, accommodationEmitted].some(Boolean);
  }



  function emitLaundryOverdue(notification = {}) {
    const payload = { ...notification };
    const laundryEmitted = emitRoomEvent?.(
      'ui:laundry:list',
      REALTIME_EVENT_NAMES.LAUNDRY_RECORD.OVERDUE,
      payload,
    );
    const workspaceEmitted = emitRoomEvent?.(
      'ui:workspace:notifications',
      REALTIME_EVENT_NAMES.LAUNDRY_RECORD.OVERDUE,
      payload,
    );
    return [laundryEmitted, workspaceEmitted].some(Boolean);
  }

  return {
    emitLaundryChanged,
    emitLaundryOverdue,
  };
}

module.exports = { createLaundryEventBus };
