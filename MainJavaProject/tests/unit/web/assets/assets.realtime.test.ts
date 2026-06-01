const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateEventPayload,
  canEmitEventToRoom,
} = require('../../../../src/infrastructure/realtime/event-catalog');
const { parseRoom } = require('../../../../src/infrastructure/realtime/room-policy');
const {
  createAssetsEventBus,
} = require('../../../../src/modules/web/assets/infrastructure/realtime/assets.event-bus');

test('assets event bus can refresh accommodation key data for Bed asset key changes', () => {
  const emitted = [];
  const eventBus = createAssetsEventBus({
    emitRoomEvent(room, eventName, payload = {}) {
      emitted.push({ room, eventName, payload });
      return true;
    },
  });

  const payload = { campId: '11111111-1111-4111-8111-111111111111', source: 'assets' };

  assert.equal(validateEventPayload('accommodation:changed', payload).ok, true);
  assert.equal(canEmitEventToRoom('accommodation:changed', parseRoom('ui:accommodation:list')), true);
  assert.equal(eventBus.emitAccommodationChanged(payload.campId, { source: 'assets' }), true);
  assert.deepEqual(emitted, [
    {
      room: 'ui:accommodation:list',
      eventName: 'accommodation:changed',
      payload,
    },
  ]);
});
