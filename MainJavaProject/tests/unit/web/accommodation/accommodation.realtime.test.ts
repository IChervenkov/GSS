const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateEventPayload,
  canEmitEventToRoom,
} = require('../../../../src/infrastructure/realtime/event-catalog');
const { parseRoom } = require('../../../../src/infrastructure/realtime/room-policy');
const {
  createAccommodationEventBus,
} = require('../../../../src/modules/web/accommodation/infrastructure/realtime/accommodation.event-bus');

test('soldier changed realtime contract is valid for dependent UI rooms', () => {
  const payload = { campId: '11111111-1111-4111-8111-111111111111' };

  assert.equal(validateEventPayload('soldier:changed', payload).ok, true);
  assert.equal(canEmitEventToRoom('soldier:changed', parseRoom('ui:accommodation:list')), true);
  assert.equal(canEmitEventToRoom('soldier:changed', parseRoom('ui:assets:list')), true);
  assert.equal(canEmitEventToRoom('soldier:changed', parseRoom('ui:laundry:list')), true);
  assert.equal(canEmitEventToRoom('soldier:changed', parseRoom('ui:bicycle:list')), true);
  assert.equal(canEmitEventToRoom('soldier:changed', parseRoom('ui:camp:list')), true);
  assert.equal(canEmitEventToRoom('soldier:changed', parseRoom('ui:user:list')), false);
});

test('accommodation changes refresh accommodation and asset location data', () => {
  const payload = { campId: '11111111-1111-4111-8111-111111111111' };
  const emitted = [];
  const eventBus = createAccommodationEventBus({
    emitRoomEvent(room, eventName, eventPayload = {}) {
      emitted.push({ room, eventName, payload: eventPayload });
      return true;
    },
  });

  assert.equal(validateEventPayload('accommodation:changed', payload).ok, true);
  assert.equal(canEmitEventToRoom('accommodation:changed', parseRoom('ui:accommodation:list')), true);
  assert.equal(canEmitEventToRoom('accommodation:changed', parseRoom('ui:assets:list')), true);
  assert.equal(eventBus.emitAccommodationChanged(payload.campId), true);

  assert.deepEqual(emitted, [
    {
      room: 'ui:accommodation:list',
      eventName: 'accommodation:changed',
      payload,
    },
    {
      room: 'ui:assets:list',
      eventName: 'accommodation:changed',
      payload,
    },
  ]);
});

test('accommodation event bus fans soldier changes out to soldier-dependent pages', () => {
  const emitted = [];
  const eventBus = createAccommodationEventBus({
    emitRoomEvent(room, eventName, payload = {}) {
      emitted.push({ room, eventName, payload });
      return true;
    },
  });

  assert.equal(eventBus.emitSoldierChanged('11111111-1111-4111-8111-111111111111'), true);

  assert.deepEqual(emitted, [
    {
      room: 'ui:accommodation:list',
      eventName: 'accommodation:changed',
      payload: { campId: '11111111-1111-4111-8111-111111111111' },
    },
    {
      room: 'ui:assets:list',
      eventName: 'soldier:changed',
      payload: { campId: '11111111-1111-4111-8111-111111111111' },
    },
    {
      room: 'ui:laundry:list',
      eventName: 'soldier:changed',
      payload: { campId: '11111111-1111-4111-8111-111111111111' },
    },
    {
      room: 'ui:bicycle:list',
      eventName: 'soldier:changed',
      payload: { campId: '11111111-1111-4111-8111-111111111111' },
    },
    {
      room: 'ui:camp:list',
      eventName: 'soldier:changed',
      payload: { campId: '11111111-1111-4111-8111-111111111111' },
    },
  ]);
});
