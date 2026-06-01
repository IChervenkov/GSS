const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canEmitEventToRoom,
  validateEventPayload,
} = require('../../../../src/infrastructure/realtime/event-catalog');
const { parseRoom } = require('../../../../src/infrastructure/realtime/room-policy');
const {
  createLaundryEventBus,
} = require('../../../../src/modules/web/laundry/infrastructure/realtime/laundry.event-bus');

test('laundry changes refresh laundry tables and accommodation bag picklists', () => {
  const campId = '11111111-1111-4111-8111-111111111111';
  const emitted = [];
  const eventBus = createLaundryEventBus({
    emitRoomEvent(room, eventName, payload = {}) {
      emitted.push({ room, eventName, payload });
      return true;
    },
  });

  assert.equal(validateEventPayload('laundry:changed', { campId }).ok, true);
  assert.equal(validateEventPayload('accommodation:changed', { campId }).ok, true);
  assert.equal(canEmitEventToRoom('laundry:changed', parseRoom('ui:laundry:list')), true);
  assert.equal(canEmitEventToRoom('accommodation:changed', parseRoom('ui:accommodation:list')), true);
  assert.equal(eventBus.emitLaundryChanged(campId), true);

  assert.deepEqual(emitted, [
    {
      room: 'ui:laundry:list',
      eventName: 'laundry:changed',
      payload: { campId },
    },
    {
      room: 'ui:accommodation:list',
      eventName: 'accommodation:changed',
      payload: { campId },
    },
  ]);
});
