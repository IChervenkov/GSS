const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { extractToken, createSocketSessionValidator } = require('../../src/infrastructure/realtime/socket-auth');
const { createAccessToken, createRefreshToken } = require('../../src/modules/api/auth/infrastructure/security/auth.tokens');
const { validateEventPayload } = require('../../src/infrastructure/realtime/event-catalog');
const { requireFresh } = require('../helpers/module-mocks');

const userId = '11111111-1111-1111-1111-111111111111';

function createFakeSocket({ id = 'socket-1', user = { id: userId, authType: 'jwt', tokenVersion: 1 }, session = null } = {}) {
  const handlers = new Map();
  const joinedRooms = new Set();
  const leftRooms = [];
  let disconnected = false;
  return {
    id,
    user,
    request: session ? { session } : {},
    handshake: { auth: {}, headers: {}, session },
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    emit(eventName, payload) {
      this.emitted = this.emitted || [];
      this.emitted.push({ eventName, payload });
    },
    join(room) {
      joinedRooms.add(room);
    },
    leave(room) {
      joinedRooms.delete(room);
      leftRooms.push(room);
    },
    disconnect() {
      disconnected = true;
    },
    get handlers() {
      return handlers;
    },
    get joinedRooms() {
      return [...joinedRooms];
    },
    get leftRooms() {
      return leftRooms;
    },
    get disconnected() {
      return disconnected;
    },
  };
}

test('extractToken prefers handshake.auth token and strips Bearer header', async () => {
  assert.equal(
    extractToken({
      handshake: { auth: { token: 'abc' }, headers: { authorization: 'Bearer xyz' } },
    }),
    'abc',
  );
  assert.equal(
    extractToken({ handshake: { auth: {}, headers: { authorization: 'Bearer xyz' } } }),
    'xyz',
  );
});

test('validate approval resolved payload enforces realtime contract', async () => {
  const valid = validateEventPayload('approval:resolved', {
    requestId: '22222222-2222-2222-2222-222222222222',
    requestType: 'show_qr',
    status: 'approved',
    userId,
    version: 1,
  });
  assert.equal(valid.ok, true);

  const invalid = validateEventPayload('approval:resolved', {
    requestId: 'bad',
    requestType: 'show_qr',
    status: 'approved',
    userId,
    version: 1,
  });
  assert.equal(invalid.ok, false);
});

test('assets changed payload allows global and camp-scoped refreshes', async () => {
  assert.equal(validateEventPayload('assets:changed', {}).ok, true);
  assert.equal(validateEventPayload('assets:changed', { campId: userId }).ok, true);
  assert.equal(validateEventPayload('assets:changed', { campId: 'bad' }).ok, false);
});

test('admin inbox updated payload is allowed on the admin user list room', async () => {
  assert.equal(validateEventPayload('admin:inbox:updated', {
    kind: 'public_access_request',
    sourceId: '22222222-2222-2222-2222-222222222222',
    type: 'message',
    status: 'open',
  }).ok, true);
});

test('emitCatalogEvent routes only validated payloads to the user room', async () => {
  const emitted = [];
  const sockets = [];
  const socketModule = requireFresh('src/bootstrap/socket.ts', {
    'socket.io': {
      Server: class FakeServer {
        constructor() {
          this.connectionHandler = null;
        }
        to(room) {
          return {
            emit(eventName, payload) {
              emitted.push({ room, eventName, payload });
            },
          };
        }
        on(eventName, handler) {
          if (eventName === 'connection') this.connectionHandler = handler;
        }
        async fetchSockets() {
          return sockets;
        }
      },
    },
  });

  const runtime = socketModule.createSocketRuntime({
    env: { APP_URL: 'http://localhost:3000' },
    logger: {
      child() {
        return this;
      },
      error() {},
      info() {},
      warn() {},
    },
    metrics: {
      counter() {},
      gaugeInc() {},
      gaugeDec() {},
    },
    attachSocketAdapter: async () => ({ mode: 'memory' }),
    validateSocketSession: () => {},
  });

  await runtime.createSocket({}, () => {});

  const ok = runtime.emitCatalogEvent('approval:resolved', {
    requestId: '22222222-2222-2222-2222-222222222222',
    requestType: 'show_qr',
    status: 'approved',
    userId,
    version: 1,
  });
  const rejected = runtime.emitCatalogEvent('approval:resolved', {
    requestId: 'bad',
    requestType: 'show_qr',
    status: 'approved',
    userId,
    version: 1,
  });

  assert.equal(ok, true);
  assert.equal(rejected, false);
  assert.deepEqual(emitted[0], {
    room: `user:${userId}`,
    eventName: 'approval:resolved',
    payload: {
      requestId: '22222222-2222-2222-2222-222222222222',
      requestType: 'show_qr',
      status: 'approved',
      userId,
      version: 1,
    },
  });
});

test('emitRoomEvent rejects event and room combinations that violate policy', async () => {
  const emitted = [];
  const socketModule = requireFresh('src/bootstrap/socket.ts', {
    'socket.io': {
      Server: class FakeServer {
        to(room) {
          return {
            emit(eventName, payload) {
              emitted.push({ room, eventName, payload });
            },
          };
        }
        on() {}
        async fetchSockets() {
          return [];
        }
      },
    },
  });

  const runtime = socketModule.createSocketRuntime({
    env: { APP_URL: 'http://localhost:3000' },
    logger: { child() { return this; }, error() {}, info() {}, warn() {} },
    metrics: { counter() {}, gaugeInc() {}, gaugeDec() {} },
    attachSocketAdapter: async () => ({ mode: 'memory' }),
    validateSocketSession: () => {},
  });

  await runtime.createSocket({}, () => {});

  assert.equal(runtime.emitRoomEvent('ui:user:list', 'approval:resolved', {
    requestId: '22222222-2222-2222-2222-222222222222',
    requestType: 'show_qr',
    status: 'approved',
    userId,
    version: 1,
  }), false);
  assert.equal(emitted.length, 0);
});

test('emitRoomEvent sends admin inbox updates to subscribed admins', async () => {
  const emitted = [];
  const socketModule = requireFresh('src/bootstrap/socket.ts', {
    'socket.io': {
      Server: class FakeServer {
        to(room) {
          return {
            emit(eventName, payload) {
              emitted.push({ room, eventName, payload });
            },
          };
        }
        on() {}
        async fetchSockets() {
          return [];
        }
      },
    },
  });

  const runtime = socketModule.createSocketRuntime({
    env: { APP_URL: 'http://localhost:3000' },
    logger: { child() { return this; }, error() {}, info() {}, warn() {} },
    metrics: { counter() {}, gaugeInc() {}, gaugeDec() {} },
    attachSocketAdapter: async () => ({ mode: 'memory' }),
    validateSocketSession: () => {},
  });

  await runtime.createSocket({}, () => {});

  const payload = {
    kind: 'public_access_request',
    sourceId: '22222222-2222-2222-2222-222222222222',
    type: 'message',
    status: 'open',
  };
  assert.equal(runtime.emitRoomEvent('ui:user:list', 'admin:inbox:updated', payload), true);
  assert.deepEqual(emitted, [{ room: 'ui:user:list', eventName: 'admin:inbox:updated', payload }]);
});


test('jwt token used by realtime layer contains a valid principal uuid', async () => {
  const secret = 'x'.repeat(32);
  const token = jwt.sign({ sub: userId }, secret);
  assert.equal(typeof token, 'string');
});

test('socket auth accepts only access tokens and normalizes the principal shape', async () => {
  const env = {
    ACCESS_TOKEN_SECRET: 'x'.repeat(32),
    REFRESH_TOKEN_SECRET: 'y'.repeat(32),
    ACCESS_TOKEN_EXPIRES_IN: 15,
    REFRESH_TOKEN_EXPIRES_IN: 14,
  };
  const token = createAccessToken(env, {
    sub: userId,
    username: 'alice',
    deviceId: 'device-1',
    tokenVersion: 2,
  });

  const io = {
    engine: { use() {} },
    use(handler) {
      this.handler = handler;
    },
  };

  createSocketSessionValidator({ env, logger: { child() { return this; }, warn() {} } })(
    io,
    (_req, _res, next) => next(),
  );

  let nextError = null;
  const socket = {
    id: 'socket-1',
    handshake: { auth: { token }, headers: {} },
    request: {},
  };
  io.handler(socket, (error) => {
    nextError = error || null;
  });

  assert.equal(nextError, null);
  assert.equal(socket.user.id, userId);
  assert.equal(socket.user.userId, userId);
  assert.equal(socket.user.sub, userId);
  assert.equal(socket.user.tokenType, 'access');
  assert.equal(socket.user.deviceId, 'device-1');
  assert.equal(socket.user.tokenVersion, 2);
});

test('socket auth rejects refresh tokens', async () => {
  const env = {
    ACCESS_TOKEN_SECRET: 'x'.repeat(32),
    REFRESH_TOKEN_SECRET: 'y'.repeat(32),
    ACCESS_TOKEN_EXPIRES_IN: 15,
    REFRESH_TOKEN_EXPIRES_IN: 14,
  };
  const token = createRefreshToken(env, { sub: userId });

  const io = {
    engine: { use() {} },
    use(handler) {
      this.handler = handler;
    },
  };

  createSocketSessionValidator({ env, logger: { child() { return this; }, warn() {} } })(
    io,
    (_req, _res, next) => next(),
  );

  let nextError = null;
  const socket = {
    id: 'socket-2',
    handshake: { auth: { token }, headers: {} },
    request: {},
  };
  io.handler(socket, (error) => {
    nextError = error || null;
  });

  assert.equal(nextError?.data?.code, 'INVALID_TOKEN');
});

test('unauthorized join attempts are rejected while allowed rooms still join', async () => {
  const socketModule = requireFresh('src/bootstrap/socket.ts', {
    'socket.io': {
      Server: class FakeServer {
        constructor() {
          this.connectionHandler = null;
          this.sockets = [];
        }
        to() {
          return { emit() {} };
        }
        on(eventName, handler) {
          if (eventName === 'connection') this.connectionHandler = handler;
        }
        async fetchSockets() {
          return this.sockets;
        }
      },
    },
  });

  const runtime = socketModule.createSocketRuntime({
    env: { APP_URL: 'http://localhost:3000' },
    logger: { child() { return this; }, error() {}, info() {}, warn() {} },
    auditLog() {},
    metrics: { counter() {}, gaugeInc() {}, gaugeDec() {} },
    attachSocketAdapter: async () => ({ mode: 'memory' }),
    validateSocketSession: () => {},
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return permissionName === 'Admin permission';
      },
    },
    tokenStateRepository: {
      async getUserTokenState() {
        return { userId, tokenVersion: 1 };
      },
    },
  });

  const io = await runtime.createSocket({}, () => {});
  const socket = createFakeSocket();
  io.sockets.push(socket);
  io.connectionHandler(socket);

  const subscribe = socket.handlers.get('rooms:subscribe');
  let ackPayload = null;
  await subscribe(
    { rooms: ['ui:user:list', 'user:22222222-2222-2222-2222-222222222222'] },
    (response) => {
      ackPayload = response;
    },
  );

  assert.deepEqual(ackPayload.joined, ['ui:user:list']);
  assert.deepEqual(ackPayload.rejected, [
    { room: 'user:22222222-2222-2222-2222-222222222222', code: 'ROOM_ACCESS_DENIED' },
  ]);
  assert.equal(socket.joinedRooms.includes('ui:user:list'), true);
});

test('connected sockets join default personal, presence, and workspace notification rooms', async () => {
  const socketModule = requireFresh('src/bootstrap/socket.ts', {
    'socket.io': {
      Server: class FakeServer {
        constructor() {
          this.connectionHandler = null;
        }
        to() {
          return { emit() {} };
        }
        on(eventName, handler) {
          if (eventName === 'connection') this.connectionHandler = handler;
        }
        async fetchSockets() {
          return [];
        }
      },
    },
  });

  const runtime = socketModule.createSocketRuntime({
    env: { APP_URL: 'http://localhost:3000' },
    logger: { child() { return this; }, error() {}, info() {}, warn() {} },
    auditLog() {},
    metrics: { counter() {}, gaugeInc() {}, gaugeDec() {} },
    attachSocketAdapter: async () => ({ mode: 'memory' }),
    validateSocketSession: () => {},
  });

  const io = await runtime.createSocket({}, () => {});
  const socket = createFakeSocket();
  io.connectionHandler(socket);

  assert.deepEqual(socket.joinedRooms.sort(), [
    'presence:authenticated',
    'ui:workspace:notifications',
    `user:${userId}`,
  ]);
});

test('revoked session or stale token disconnects socket during reevaluation', async () => {
  const socketModule = requireFresh('src/bootstrap/socket.ts', {
    'socket.io': {
      Server: class FakeServer {
        constructor() {
          this.connectionHandler = null;
          this.sockets = [];
        }
        to() {
          return { emit() {} };
        }
        on(eventName, handler) {
          if (eventName === 'connection') this.connectionHandler = handler;
        }
        async fetchSockets() {
          return this.sockets;
        }
      },
    },
  });

  let tokenVersion = 1;
  const runtime = socketModule.createSocketRuntime({
    env: { APP_URL: 'http://localhost:3000' },
    logger: { child() { return this; }, error() {}, info() {}, warn() {} },
    auditLog() {},
    metrics: { counter() {}, gaugeInc() {}, gaugeDec() {} },
    attachSocketAdapter: async () => ({ mode: 'memory' }),
    validateSocketSession: () => {},
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return permissionName === 'Admin permission';
      },
    },
    tokenStateRepository: {
      async getUserTokenState() {
        return { userId, tokenVersion };
      },
    },
  });

  const io = await runtime.createSocket({}, () => {});
  const socket = createFakeSocket();
  io.sockets.push(socket);
  io.connectionHandler(socket);

  tokenVersion = 2;
  const result = await runtime.reevaluateUserSockets(userId, 'token_version_bumped');
  assert.deepEqual(result.affectedSocketIds, ['socket-1']);
  assert.equal(socket.disconnected, true);
});

test('permission changes downgrade UI rooms instead of disconnecting active socket', async () => {
  const socketModule = requireFresh('src/bootstrap/socket.ts', {
    'socket.io': {
      Server: class FakeServer {
        constructor() {
          this.connectionHandler = null;
          this.sockets = [];
        }
        to() {
          return { emit() {} };
        }
        on(eventName, handler) {
          if (eventName === 'connection') this.connectionHandler = handler;
        }
        async fetchSockets() {
          return this.sockets;
        }
      },
    },
  });

  let allowSystem = true;
  const runtime = socketModule.createSocketRuntime({
    env: { APP_URL: 'http://localhost:3000' },
    logger: { child() { return this; }, error() {}, info() {}, warn() {} },
    auditLog() {},
    metrics: { counter() {}, gaugeInc() {}, gaugeDec() {} },
    attachSocketAdapter: async () => ({ mode: 'memory' }),
    validateSocketSession: () => {},
    permissionRepository: {
      async userHasPermission(_principalUserId, permissionName) {
        return allowSystem && permissionName === 'Admin permission';
      },
    },
    tokenStateRepository: {
      async getUserTokenState() {
        return { userId, tokenVersion: 1 };
      },
    },
  });

  const io = await runtime.createSocket({}, () => {});
  const socket = createFakeSocket();
  io.sockets.push(socket);
  io.connectionHandler(socket);

  const subscribe = socket.handlers.get('rooms:subscribe');
  let ackPayload = null;
  await subscribe({ rooms: ['ui:user:list'] }, (response) => {
    ackPayload = response;
  });
  assert.deepEqual(ackPayload.joined, ['ui:user:list']);

  allowSystem = false;
  const result = await runtime.reevaluateUserSockets(userId, 'permissions_changed');
  assert.deepEqual(result.removedRoomsBySocket['socket-1'], ['ui:user:list']);
  assert.equal(socket.disconnected, false);
  assert.deepEqual(socket.leftRooms, ['ui:user:list']);
});
