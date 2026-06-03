// @ts-nocheck
const { REALTIME_EVENT_NAMES } = require('../../../../../shared/realtime/event-names');

function createAssetsEventBus({ emitRoomEvent } = {}) {
  function emitAssetsChanged(campId) {
    return emitRoomEvent?.('ui:assets:list', REALTIME_EVENT_NAMES.ASSET_RECORD.CHANGED, {
      ...(campId ? { campId } : {}),
    });
  }

  function emitAccommodationChanged(campId, payload = {}) {
    if (!campId) return false;
    const eventPayload = {
      ...(payload && typeof payload === 'object' ? payload : {}),
      campId,
    };
    return emitRoomEvent?.(
      'ui:accommodation:list',
      REALTIME_EVENT_NAMES.ACCOMMODATION_RECORD.CHANGED,
      eventPayload,
    );
  }

  return {
    emitAccommodationChanged,
    emitAssetsChanged,
  };
}

module.exports = { createAssetsEventBus };
