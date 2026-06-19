const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canEmitEventToRoom,
  resolveEventRooms,
  validateEventPayload,
} = require('../../../src/infrastructure/realtime/event-catalog');
const { parseRoom } = require('../../../src/infrastructure/realtime/room-policy');

const userId = '11111111-1111-1111-1111-111111111111';

test('camp access matrix updates can be emitted to camp and permission list rooms', () => {
  assert.equal(validateEventPayload('camp:access:changed', {}).ok, true);
  assert.deepEqual(resolveEventRooms('camp:access:changed', {}), [
    'ui:camp:list',
    'ui:permission:list',
  ]);
  assert.equal(canEmitEventToRoom('camp:access:changed', parseRoom('ui:camp:list')), true);
  assert.equal(canEmitEventToRoom('camp:access:changed', parseRoom('ui:permission:list')), true);
  assert.equal(canEmitEventToRoom('camp:access:changed', parseRoom('ui:user:list')), false);
});

test('camp access self refresh targets only the affected user room', () => {
  const payload = { userId };

  assert.equal(validateEventPayload('camp:access:self:refresh', payload).ok, true);
  assert.equal(validateEventPayload('camp:access:self:refresh', { userId: 'bad' }).ok, false);
  assert.deepEqual(resolveEventRooms('camp:access:self:refresh', payload), [`user:${userId}`]);
  assert.equal(canEmitEventToRoom('camp:access:self:refresh', parseRoom(`user:${userId}`)), true);
  assert.equal(canEmitEventToRoom('camp:access:self:refresh', parseRoom('ui:permission:list')), false);
});
