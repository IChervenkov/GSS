const ROOM_SUBSCRIPTION_EVENTS = Object.freeze({
  REQUESTED: 'rooms:subscribe',
  RELEASED: 'rooms:unsubscribe',
});

const FORCED_SIGN_OUT_CODES = new Set([
  'SOCKET_SESSION_INVALID',
  'SOCKET_TOKEN_REVOKED',
  'INVALID_SESSION_USER',
  'INVALID_TOKEN',
  'UNAUTHORIZED',
  'ACCOUNT_LOCKED',
]);

function safeAssign(maybeUrl, fallback = '/') {
  try {
    const url = new URL(maybeUrl || fallback, window.location.origin);
    if (url.origin !== window.location.origin) {
      window.location.assign(fallback);
      return;
    }
    window.location.assign(url.pathname + url.search + url.hash);
  } catch {
    window.location.assign(fallback);
  }
}

function resolveSocketErrorCode(error) {
  return String(error?.data?.code || error?.code || error?.message || '').trim();
}

export function createSocketRoomManager(socket) {
  const subscribedRooms = new Set();

  async function emitSubscription(eventName, rooms) {
    const normalizedRooms = [
      ...new Set(
        (rooms || [])
          .map((room) =>
            String(room || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];
    if (!socket || normalizedRooms.length === 0)
      return { ok: true, joined: [], left: [], rejected: [] };

    return new Promise((resolve) => {
      socket.emit(
        eventName,
        { rooms: normalizedRooms, subscriptionId: `${eventName}:${Date.now()}` },
        (response) => {
          resolve(response || { ok: false, code: 'NO_ACK' });
        },
      );
    });
  }

  return {
    async subscribe(rooms = []) {
      const roomsToSubscribe = rooms.filter(
        (room) =>
          !subscribedRooms.has(
            String(room || '')
              .trim()
              .toLowerCase(),
          ),
      );
      const response = await emitSubscription(ROOM_SUBSCRIPTION_EVENTS.REQUESTED, roomsToSubscribe);
      for (const room of response?.joined || []) subscribedRooms.add(room);
      return response;
    },
    async unsubscribe(rooms = []) {
      const roomsToUnsubscribe = rooms.filter((room) =>
        subscribedRooms.has(
          String(room || '')
            .trim()
            .toLowerCase(),
          ),
      );
      const response = await emitSubscription(ROOM_SUBSCRIPTION_EVENTS.RELEASED, roomsToUnsubscribe);
      for (const room of response?.left || []) subscribedRooms.delete(room);

      if (!response?.ok && Array.isArray(response?.rejected)) {
        for (const room of roomsToUnsubscribe) {
          subscribedRooms.delete(
            String(room || '')
              .trim()
              .toLowerCase(),
          );
        }
      }
      return response;
    },
    async resubscribeAll() {
      const rooms = [...subscribedRooms];
      return emitSubscription(ROOM_SUBSCRIPTION_EVENTS.REQUESTED, rooms);
    },
    clear() {
      subscribedRooms.clear();
    },
    getSubscribedRooms() {
      return [...subscribedRooms];
    },
  };
}

export function bindForcedSignOut(socket, { redirectTo = '/', fallback = '/' } = {}) {
  if (!socket || typeof socket.on !== 'function') return () => {};

  let redirected = false;
  const forceSignOut = () => {
    if (redirected) return;
    redirected = true;
    safeAssign(redirectTo, fallback);
  };
  const handleConnectError = (error) => {
    if (FORCED_SIGN_OUT_CODES.has(resolveSocketErrorCode(error))) forceSignOut();
  };

  socket.on('socket:access:changed', forceSignOut);
  socket.on('connect_error', handleConnectError);

  return () => {
    if (typeof socket.off !== 'function') return;
    socket.off('socket:access:changed', forceSignOut);
    socket.off('connect_error', handleConnectError);
  };
}
