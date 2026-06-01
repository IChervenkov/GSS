const { Server } = require('socket.io');
const {
  validateEventPayload,
  resolveEventRooms,
  canEmitEventToRoom,
  resolveCatalogEventName,
} = require('../infrastructure/realtime/event-catalog');
const { REALTIME_EVENT_NAMES } = require('../shared/realtime/event-names');
const { AUDIT_EVENT_NAMES } = require('../shared/security/audit-event-names');
const { METRIC_NAMES } = require('../shared/observability/metric-names');
const { createRoomPolicy, parseRoom } = require('../infrastructure/realtime/room-policy');

function createSocketRuntime({
  env,
  logger,
  metrics,
  auditLog,
  attachSocketAdapter,
  validateSocketSession,
  permissionRepository,
  tokenStateRepository,
} = {}) {
  const socketLogger = logger?.child?.({ component: 'socket' }) || logger;
  const roomPolicy = createRoomPolicy({ permissionRepository });
  const socketStateById = new Map();
  let ioServer = null;
  let adapterMode = 'uninitialized';

  function getSocketPrincipal(socket) {
    return socket?.user || socket?.data?.user || null;
  }

  function getSocketState(socket) {
    return socketStateById.get(socket.id) || null;
  }

  function ensureSocketState(socket) {
    let state = getSocketState(socket);
    if (state) return state;

    const principal = getSocketPrincipal(socket);
    const defaultRooms = new Set(roomPolicy.getDefaultRoomsForPrincipal(principal));
    state = {
      socketId: socket.id,
      principalId: principal?.id || null,
      authType: principal?.authType || 'unknown',
      defaultRooms,
      optionalRooms: new Set(),
      connectedAt: new Date().toISOString(),
      tokenVersion: Number(principal?.tokenVersion || 0),
    };
    socketStateById.set(socket.id, state);
    return state;
  }

  function audit(eventType, meta = {}) {
    auditLog?.(meta.auditEventName || `realtime:${eventType.replace(/_/g, ':')}`, {
      eventName: meta.auditEventName || `realtime:${eventType.replace(/_/g, ':')}`,
      outcome: meta.outcome,
      actorUserId: meta.actorUserId,
      targetUserId: meta.targetUserId,
      socketId: meta.socketId,
      authType: meta.authType,
      code: meta.code,
      requestedRooms: meta.requestedRooms,
      rejectedRooms: meta.rejectedRooms,
      reason: meta.reason,
    });
  }

  function forceDisconnect(socket, reason, code) {
    const principal = getSocketPrincipal(socket);
    metrics?.counter?.(METRIC_NAMES.SOCKET_FORCED_DISCONNECTS_TOTAL, { reason: code || reason || 'unknown' });
    socketLogger?.warn?.('socket_forced_disconnect', {
      socketId: socket.id,
      userId: principal?.id,
      reason,
      code,
    });
    audit('forced_disconnect', { auditEventName: AUDIT_EVENT_NAMES.REALTIME.FORCED_DISCONNECT,
      outcome: 'failure',
      actorUserId: principal?.id,
      socketId: socket.id,
      authType: principal?.authType || 'unknown',
      code: code || 'SOCKET_SESSION_INVALID',
      reason,
    });
    socket.emit?.('socket:access:changed', { reason: code || reason || 'SOCKET_SESSION_INVALID' });
    socket.disconnect(true);
  }

  async function isPrincipalStillValid(socket) {
    const principal = getSocketPrincipal(socket);
    if (!principal?.id) {
      return { ok: false, code: 'SOCKET_SESSION_INVALID', reason: 'missing_principal' };
    }

    if (principal.authType === 'session') {
      const session = socket.request?.session || socket.handshake?.session;
      const sessionUserId =
        session?.userId || session?.pendingUserId || session?.pendingPasswordChangeUserId || null;
      if (!sessionUserId || String(sessionUserId) !== String(principal.id)) {
        return { ok: false, code: 'SOCKET_SESSION_INVALID', reason: 'session_principal_missing' };
      }
      return { ok: true };
    }

    if (principal.authType === 'jwt' && typeof tokenStateRepository?.getUserTokenState === 'function') {
      const tokenState = await tokenStateRepository.getUserTokenState(principal.id);
      if (!tokenState) {
        return { ok: false, code: 'SOCKET_TOKEN_REVOKED', reason: 'missing_token_state' };
      }
      if (Number(tokenState.tokenVersion || 0) !== Number(principal.tokenVersion || 0)) {
        return { ok: false, code: 'SOCKET_TOKEN_REVOKED', reason: 'token_version_mismatch' };
      }
    }

    return { ok: true };
  }

  function joinTrackedRoom(socket, room, source) {
    const state = ensureSocketState(socket);
    const normalizedRoom = String(room || '').trim().toLowerCase();
    if (!normalizedRoom) return false;
    if (!state.defaultRooms.has(normalizedRoom) && state.optionalRooms.has(normalizedRoom)) {
      return true;
    }

    socket.join(normalizedRoom);
    if (!state.defaultRooms.has(normalizedRoom)) {
      state.optionalRooms.add(normalizedRoom);
    }
    const descriptor = parseRoom(normalizedRoom);
    metrics?.counter?.(METRIC_NAMES.SOCKET_ROOM_JOINS_TOTAL, {
      roomKind: descriptor?.roomKind || 'unknown',
      source: source || 'unknown',
    });
    socketLogger?.info?.('socket_room_joined', {
      socketId: socket.id,
      userId: state.principalId,
      room: normalizedRoom,
      source,
    });
    return true;
  }

  function leaveTrackedRoom(socket, room, source) {
    const state = ensureSocketState(socket);
    const normalizedRoom = String(room || '').trim().toLowerCase();
    if (!normalizedRoom) return false;
    if (state.defaultRooms.has(normalizedRoom)) return false;
    if (!state.optionalRooms.has(normalizedRoom)) return true;

    socket.leave(normalizedRoom);
    state.optionalRooms.delete(normalizedRoom);
    const descriptor = parseRoom(normalizedRoom);
    metrics?.counter?.(METRIC_NAMES.SOCKET_ROOM_LEAVES_TOTAL, {
      roomKind: descriptor?.roomKind || 'unknown',
      source: source || 'unknown',
    });
    socketLogger?.info?.('socket_room_left', {
      socketId: socket.id,
      userId: state.principalId,
      room: normalizedRoom,
      source,
    });
    return true;
  }

  function emitValidatedToRooms(rooms, eventName, payload) {
    for (const room of rooms) {
      ioServer.to(room).emit(eventName, payload);
    }
  }

  function emitCatalogEvent(eventName, payload = {}) {
    if (!ioServer) {
      socketLogger?.warn?.('socket_emit_skipped', { eventName, reason: 'io_not_initialized' });
      return false;
    }

    const validation = validateEventPayload(eventName, payload);
    if (!validation.ok) {
      metrics?.counter?.(METRIC_NAMES.SOCKET_EMIT_VALIDATION_FAILURES_TOTAL, { eventName });
      socketLogger?.error?.('socket_emit_validation_failed', {
        eventName,
        reason: validation.reason,
        payload,
      });
      return false;
    }

    const rooms = resolveEventRooms(eventName, validation.value || payload);
    if (rooms.length === 0) {
      socketLogger?.warn?.('socket_emit_skipped', {
        eventName,
        reason: 'no_destination_rooms',
        payload,
      });
      return false;
    }

    emitValidatedToRooms(rooms, eventName, validation.value || payload);
    return true;
  }

  async function applySubscriptionChange(socket, eventName, payload = {}, ack = undefined) {
    const principal = getSocketPrincipal(socket);
    const state = ensureSocketState(socket);

    metrics?.counter?.(METRIC_NAMES.SOCKET_SUBSCRIPTION_ATTEMPTS_TOTAL, { eventName });

    const validity = await isPrincipalStillValid(socket);
    if (!validity.ok) {
      ack?.({ ok: false, code: validity.code, message: validity.reason });
      forceDisconnect(socket, validity.reason, validity.code);
      return;
    }

    const validation = validateEventPayload(eventName, payload);
    if (!validation.ok) {
      metrics?.counter?.(METRIC_NAMES.SOCKET_SUBSCRIPTION_REJECTIONS_TOTAL, {
        eventName,
        reason: 'invalid_payload',
      });
      ack?.({ ok: false, code: 'INVALID_SOCKET_PAYLOAD', message: validation.reason });
      socketLogger?.warn?.('socket_subscription_rejected', {
        socketId: socket.id,
        userId: principal?.id,
        eventName,
        reason: validation.reason,
      });
      audit('subscription_rejected', { auditEventName: AUDIT_EVENT_NAMES.REALTIME.SUBSCRIPTION_REJECTED,
        outcome: 'failure',
        actorUserId: principal?.id,
        socketId: socket.id,
        authType: principal?.authType || 'unknown',
        code: 'INVALID_SOCKET_PAYLOAD',
        requestedRooms: payload?.rooms,
        reason: validation.reason,
      });
      return;
    }

    const roomAuthorization = await roomPolicy.filterAuthorizedRooms({
      principal,
      rooms: validation.value.rooms,
    });
    const requestedRooms = validation.value.rooms;
    const rejected = [...roomAuthorization.rejected];
    const changedRooms = [];

    if (resolveCatalogEventName(eventName) === REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_REQUESTED) {
      for (const room of roomAuthorization.allowed) {
        if (joinTrackedRoom(socket, room, 'client')) changedRooms.push(room);
      }
    } else {
      for (const room of roomAuthorization.allowed) {
        const descriptor = parseRoom(room);
        if (!descriptor) {
          rejected.push({ room, code: 'ROOM_NOT_REGISTERED' });
          continue;
        }
        if (!descriptor.manualUnsubscribeAllowed) {
          rejected.push({ room, code: 'ROOM_LEAVE_FORBIDDEN' });
          continue;
        }
        if (leaveTrackedRoom(socket, room, 'client')) changedRooms.push(room);
      }
    }

    if (rejected.length > 0) {
      metrics?.counter?.(
        METRIC_NAMES.SOCKET_SUBSCRIPTION_REJECTIONS_TOTAL,
        { eventName, reason: 'unauthorized_room' },
        rejected.length,
      );
      socketLogger?.warn?.('socket_room_authorization_rejected', {
        socketId: socket.id,
        userId: principal?.id,
        rejected,
        eventName,
      });
      audit('room_request_rejected', { auditEventName: AUDIT_EVENT_NAMES.REALTIME.ROOM_REQUEST_REJECTED,
        outcome: 'denied',
        actorUserId: principal?.id,
        socketId: socket.id,
        authType: principal?.authType || 'unknown',
        code: rejected[0]?.code || 'ROOM_ACCESS_DENIED',
        requestedRooms,
        rejectedRooms: rejected.map((entry) => entry.room),
      });
    }

    if (changedRooms.length > 0) {
      metrics?.counter?.(METRIC_NAMES.SOCKET_ROOM_SUBSCRIPTIONS_TOTAL, {
        eventName,
        outcome: 'success',
      }, changedRooms.length);
    }

    ack?.({
      ok: rejected.length === 0,
      joined: resolveCatalogEventName(eventName) === REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_REQUESTED ? changedRooms : undefined,
      left: resolveCatalogEventName(eventName) === REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_RELEASED ? changedRooms : undefined,
      rejected,
      subscriptionId: validation.value.subscriptionId,
    });

    state.lastSubscriptionChangeAt = new Date().toISOString();
  }

  function bindRoomSubscriptionHandlers(socket) {
    const handleSubscribe = (payload = {}, ack = undefined) =>
      applySubscriptionChange(socket, REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_REQUESTED, payload, ack);
    const handleUnsubscribe = (payload = {}, ack = undefined) =>
      applySubscriptionChange(socket, REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_RELEASED, payload, ack);

    socket.on(REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_REQUESTED, handleSubscribe);
    socket.on(REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_RELEASED, handleUnsubscribe);
    socket.on(REALTIME_EVENT_NAMES.ROOM.LEGACY_SUBSCRIBE, handleSubscribe);
    socket.on(REALTIME_EVENT_NAMES.ROOM.LEGACY_UNSUBSCRIBE, handleUnsubscribe);
  }

  async function reevaluateSocketAccess(socket, reason = 'permissions_changed') {
    const principal = getSocketPrincipal(socket);
    const state = ensureSocketState(socket);
    const validity = await isPrincipalStillValid(socket);

    metrics?.counter?.(METRIC_NAMES.SOCKET_PRINCIPAL_REEVALUATIONS_TOTAL, {
      reason,
      outcome: validity.ok ? 'checked' : 'disconnected',
    });

    if (!validity.ok) {
      forceDisconnect(socket, validity.reason, validity.code);
      return { disconnected: true, removedRooms: [] };
    }

    const joinedOptionalRooms = [...state.optionalRooms];
    const authorization = await roomPolicy.filterAuthorizedRooms({
      principal,
      rooms: joinedOptionalRooms,
    });
    const rejectedRooms = authorization.rejected.map((entry) => entry.room);

    for (const room of rejectedRooms) {
      leaveTrackedRoom(socket, room, 'policy-reevaluation');
    }

    if (rejectedRooms.length > 0) {
      socket.emit?.(REALTIME_EVENT_NAMES.PERMISSION.SELF_REFRESHED, { userId: principal?.id });
      audit('room_access_downgraded', { auditEventName: AUDIT_EVENT_NAMES.REALTIME.ROOM_ACCESS_DOWNGRADED,
        outcome: 'info',
        actorUserId: principal?.id,
        socketId: socket.id,
        authType: principal?.authType || 'unknown',
        requestedRooms: joinedOptionalRooms,
        rejectedRooms,
        reason,
      });
    }

    return {
      disconnected: false,
      removedRooms: rejectedRooms,
    };
  }

  async function reevaluateUserSockets(userId, reason = 'permissions_changed') {
    if (!ioServer || !userId) return { affectedSocketIds: [], removedRoomsBySocket: {} };

    const affectedSockets = [];
    const removedRoomsBySocket = {};
    for (const socket of await ioServer.fetchSockets()) {
      if (String(getSocketPrincipal(socket)?.id || '') !== String(userId)) continue;
      const result = await reevaluateSocketAccess(socket, reason);
      affectedSockets.push(socket.id);
      removedRoomsBySocket[socket.id] = result.removedRooms;
    }

    return { affectedSocketIds: affectedSockets, removedRoomsBySocket };
  }

  async function disconnectUserSockets(userId, reason = 'session_invalid') {
    if (!ioServer || !userId) return 0;

    let disconnectedCount = 0;
    for (const socket of await ioServer.fetchSockets()) {
      if (String(getSocketPrincipal(socket)?.id || '') !== String(userId)) continue;
      disconnectedCount += 1;
      forceDisconnect(socket, reason, 'SOCKET_SESSION_INVALID');
    }
    return disconnectedCount;
  }

  async function createSocket(httpServer, sessionMiddleware) {
    const io = new Server(httpServer, {
      cors: {
        origin: env.APP_URL,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    const adapterStatus = await attachSocketAdapter?.(io);
    adapterMode = adapterStatus?.mode || 'memory';
    ioServer = io;
    validateSocketSession?.(io, sessionMiddleware);

    io.on('connection', (socket) => {
      const principal = getSocketPrincipal(socket);
      const userId = principal?.id;
      if (!userId) {
        socket.disconnect(true);
        return;
      }
      socket.data = socket.data || {};
      socket.data.user = principal;

      const state = ensureSocketState(socket);
      for (const room of state.defaultRooms) {
        joinTrackedRoom(socket, room, 'default');
      }

      metrics?.counter?.(METRIC_NAMES.SOCKET_CONNECTIONS_TOTAL, {
        authType: principal?.authType || 'unknown',
      });
      metrics?.gaugeInc?.(METRIC_NAMES.SOCKET_ACTIVE_CONNECTIONS, {});
      socketLogger?.info?.('socket_connected', {
        socketId: socket.id,
        userId,
        via: principal?.via,
        authType: principal?.authType,
      });

      bindRoomSubscriptionHandlers(socket);

      socket.on('disconnect', (reason) => {
        socketStateById.delete(socket.id);
        metrics?.counter?.(METRIC_NAMES.SOCKET_DISCONNECTS_TOTAL, { reason: reason || 'unknown' });
        metrics?.gaugeDec?.(METRIC_NAMES.SOCKET_ACTIVE_CONNECTIONS, {});
        socketLogger?.info?.('socket_disconnected', { socketId: socket.id, userId, reason });
      });
    });

    return io;
  }

  function emitRoomEvent(room, eventName, payload = {}) {
    if (!ioServer) {
      socketLogger?.warn?.('socket_emit_skipped', {
        reason: 'io_not_initialized',
        room,
        eventName,
      });
      return false;
    }

    const normalizedRoom = String(room || '')
      .trim()
      .toLowerCase();
    const normalizedEventName = String(eventName || '').trim();
    const descriptor = parseRoom(normalizedRoom);
    if (!normalizedRoom || !normalizedEventName || !descriptor) {
      socketLogger?.warn?.('socket_emit_skipped', {
        reason: 'invalid_room_or_signal',
        room,
        eventName,
        normalizedRoom,
        normalizedEventName,
      });
      return false;
    }

    if (!canEmitEventToRoom(normalizedEventName, descriptor)) {
      socketLogger?.warn?.('socket_emit_skipped', {
        reason: 'event_room_policy_mismatch',
        room: normalizedRoom,
        eventName: normalizedEventName,
        roomKind: descriptor.roomKind,
      });
      return false;
    }

    const validation = validateEventPayload(normalizedEventName, payload);
    if (!validation.ok) {
      metrics?.counter?.(METRIC_NAMES.SOCKET_EMIT_VALIDATION_FAILURES_TOTAL, {
        eventName: normalizedEventName,
      });
      socketLogger?.error?.('socket_emit_validation_failed', {
        eventName: normalizedEventName,
        reason: validation.reason,
        room: normalizedRoom,
        payload,
      });
      return false;
    }

    socketLogger?.info?.('socket_event_emitted', {
      room: normalizedRoom,
      eventName: normalizedEventName,
      payload: validation.value || payload,
    });

    ioServer.to(normalizedRoom).emit(normalizedEventName, validation.value || payload);
    return true;
  }

  function getAdapterMode() {
    return adapterMode;
  }

  return {
    createSocket,
    emitCatalogEvent,
    emitRoomEvent,
    getAdapterMode,
    reevaluateSocketAccess,
    reevaluateUserSockets,
    disconnectUserSockets,
  };
}

module.exports = { createSocketRuntime };
