// @ts-nocheck
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function importSocketClient() {
  const source = await fs.readFile(
    path.join(__dirname, '../../../src/shared/public/js/core/socket-client.ts'),
    'utf8',
  );
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('socket room manager records rooms joined from partial subscription acks', async () => {
  const { createSocketRoomManager } = await importSocketClient();
  const emitted = [];
  const socket = {
    emit(eventName, payload, ack) {
      emitted.push({ eventName, payload });
      ack({
        ok: false,
        joined: ['ui:user:list'],
        rejected: [{ room: 'ui:permission:list', code: 'ROOM_ACCESS_DENIED' }],
      });
    },
  };

  const manager = createSocketRoomManager(socket);
  await manager.subscribe(['ui:user:list', 'ui:permission:list']);
  await manager.subscribe(['ui:user:list']);

  assert.deepEqual(manager.getSubscribedRooms(), ['ui:user:list']);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].eventName, 'rooms:subscribe');
});

test('socket room manager forgets optional rooms when unsubscribe is rejected after downgrade', async () => {
  const { createSocketRoomManager } = await importSocketClient();
  let callCount = 0;
  const socket = {
    emit(_eventName, _payload, ack) {
      callCount += 1;
      if (callCount === 1) {
        ack({ ok: true, joined: ['ui:user:list'], rejected: [] });
        return;
      }
      ack({
        ok: false,
        left: [],
        rejected: [{ room: 'ui:user:list', code: 'ROOM_ACCESS_DENIED' }],
      });
    },
  };

  const manager = createSocketRoomManager(socket);
  await manager.subscribe(['ui:user:list']);
  await manager.unsubscribe(['ui:user:list']);

  assert.deepEqual(manager.getSubscribedRooms(), []);
});

test('forced sign-out redirects when socket access is revoked', async () => {
  const { bindForcedSignOut } = await importSocketClient();
  const originalWindow = global.window;
  const assigned = [];
  const handlers = {};
  const socket = {
    on(eventName, handler) {
      handlers[eventName] = handler;
    },
    off(eventName, handler) {
      if (handlers[eventName] === handler) delete handlers[eventName];
    },
  };

  global.window = {
    location: {
      origin: 'http://localhost:3000',
      assign(value) {
        assigned.push(value);
      },
    },
  };

  try {
    const unbind = bindForcedSignOut(socket, { redirectTo: '/login' });
    handlers['socket:access:changed']({ reason: 'admin_account_locked' });
    handlers['socket:access:changed']({ reason: 'admin_user_deleted' });

    assert.deepEqual(assigned, ['/login']);

    unbind();
    assert.equal(handlers['socket:access:changed'], undefined);
    assert.equal(handlers.connect_error, undefined);
  } finally {
    global.window = originalWindow;
  }
});

test('forced sign-out redirects on reconnect auth failures', async () => {
  const { bindForcedSignOut } = await importSocketClient();
  const originalWindow = global.window;
  const assigned = [];
  const handlers = {};
  const socket = {
    on(eventName, handler) {
      handlers[eventName] = handler;
    },
  };

  global.window = {
    location: {
      origin: 'http://localhost:3000',
      assign(value) {
        assigned.push(value);
      },
    },
  };

  try {
    bindForcedSignOut(socket);
    handlers.connect_error({ data: { code: 'SOCKET_SESSION_INVALID' } });

    assert.deepEqual(assigned, ['/']);
  } finally {
    global.window = originalWindow;
  }
});
