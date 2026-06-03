// @ts-nocheck
const { REALTIME_EVENT_NAMES } = require('../../../../../shared/realtime/event-names');

function createAccommodationEventBus({ emitRoomEvent } = {}) {
  function buildCampPayload(campId, payload = {}) {
    if (!campId) return null;
    return { ...(payload && typeof payload === 'object' ? payload : {}), campId };
  }

  function emitToRooms(rooms, eventName, payload) {
    return rooms.map((room) => emitRoomEvent?.(room, eventName, payload)).some(Boolean);
  }

  function emitAccommodationChanged(campId, payload = {}) {
    const eventPayload = buildCampPayload(campId, payload);
    if (!eventPayload) return false;
    return emitToRooms(
      ['ui:accommodation:list', 'ui:assets:list'],
      REALTIME_EVENT_NAMES.ACCOMMODATION_RECORD.CHANGED,
      eventPayload,
    );
  }

  function emitSoldierChanged(campId, payload = {}) {
    const eventPayload = buildCampPayload(campId, payload);
    if (!eventPayload) return false;
    const accommodationEmitted = emitRoomEvent?.(
      'ui:accommodation:list',
      REALTIME_EVENT_NAMES.ACCOMMODATION_RECORD.CHANGED,
      eventPayload,
    );
    const dependentEmitted = emitToRooms(
      ['ui:assets:list', 'ui:laundry:list', 'ui:bicycle:list', 'ui:camp:list'],
      REALTIME_EVENT_NAMES.SOLDIER_RECORD.CHANGED,
      eventPayload,
    );
    return [accommodationEmitted, dependentEmitted].some(Boolean);
  }

  return {
    emitAccommodationChanged,
    emitSoldierChanged,
  };
}

module.exports = { createAccommodationEventBus };
