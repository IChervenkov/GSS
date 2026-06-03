// @ts-nocheck
const { MAIN_PERMISSIONS } = require('../../modules/web/main-page/domain/main.permissions');
const {
  BICYCLE_PERMISSIONS,
} = require('../../modules/web/bicycles/domain/bicycle.permissions');
const {
  LAUNDRY_PERMISSIONS,
} = require('../../modules/web/laundry/domain/laundry.permissions');
const {
  ACCOMMODATION_PERMISSIONS,
} = require('../../modules/web/accommodation/domain/accommodation.permissions');
const { ASSETS_PAGE } = require('../../modules/web/assets/domain/assets.page');
const { normalizeRoom, isUuid, isRoomName } = require('./event-catalog');


const LEGACY_ROOM_ALIASES = Object.freeze({
  'user:list': 'ui:user:list',
  'permission:list': 'ui:permission:list',
  'camp:list': 'ui:camp:list',
  'assets:list': 'ui:assets:list',
  'bicycle:list': 'ui:bicycle:list',
  'workspace:notifications': 'ui:workspace:notifications',
  'laundry:list': 'ui:laundry:list',
  'accommodation:list': 'ui:accommodation:list',
});

function normalizeRequestedRoomName(room) {
  const normalized = normalizeRoom(room);
  return LEGACY_ROOM_ALIASES[normalized] || normalized;
}

const ROOM_KEYS = Object.freeze({
  PRESENCE_AUTHENTICATED: 'presence.authenticated',
  USER_SELF: 'user.self',
  UI_USER_LIST: 'ui.user.list',
  UI_PERMISSION_LIST: 'ui.permission.list',
  UI_CAMP_LIST: 'ui.camp.list',
  UI_ASSETS_LIST: 'ui.assets.list',
  UI_BICYCLE_LIST: 'ui.bicycle.list',
  UI_WORKSPACE_NOTIFICATIONS: 'ui.workspace.notifications',
  UI_LAUNDRY_LIST: 'ui.laundry.list',
  UI_ACCOMMODATION_LIST: 'ui.accommodation.list',
});

const ROOM_DEFINITIONS = Object.freeze({
  [ROOM_KEYS.PRESENCE_AUTHENTICATED]: Object.freeze({
    key: ROOM_KEYS.PRESENCE_AUTHENTICATED,
    roomKind: 'presence',
    roomName: 'presence:authenticated',
    isDefault: true,
    manualUnsubscribeAllowed: false,
    authorize: async ({ principal }) => isUuid(principal?.id),
  }),
  [ROOM_KEYS.USER_SELF]: Object.freeze({
    key: ROOM_KEYS.USER_SELF,
    roomKind: 'user',
    matcher: (room) => {
      const normalizedRoom = normalizeRoom(room);
      if (!normalizedRoom.startsWith('user:')) return null;
      const ownerUserId = normalizedRoom.slice('user:'.length);
      if (!isUuid(ownerUserId)) return null;
      return {
        key: ROOM_KEYS.USER_SELF,
        roomKind: 'user',
        roomName: normalizedRoom,
        ownerUserId,
        isDefault: true,
        manualUnsubscribeAllowed: false,
      };
    },
    authorize: async ({ principal, descriptor }) =>
      isUuid(principal?.id) && descriptor?.ownerUserId === String(principal.id).toLowerCase(),
  }),
  [ROOM_KEYS.UI_USER_LIST]: Object.freeze({
    key: ROOM_KEYS.UI_USER_LIST,
    roomKind: 'ui.user.list',
    roomName: 'ui:user:list',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    requiredPermissions: Object.freeze([MAIN_PERMISSIONS.system]),
  }),
  [ROOM_KEYS.UI_PERMISSION_LIST]: Object.freeze({
    key: ROOM_KEYS.UI_PERMISSION_LIST,
    roomKind: 'ui.permission.list',
    roomName: 'ui:permission:list',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    requiredPermissions: Object.freeze([MAIN_PERMISSIONS.system]),
  }),
  [ROOM_KEYS.UI_CAMP_LIST]: Object.freeze({
    key: ROOM_KEYS.UI_CAMP_LIST,
    roomKind: 'ui.camp.list',
    roomName: 'ui:camp:list',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    authorize: async ({ principal }) => isUuid(principal?.id),
  }),
  [ROOM_KEYS.UI_ASSETS_LIST]: Object.freeze({
    key: ROOM_KEYS.UI_ASSETS_LIST,
    roomKind: 'ui.assets.list',
    roomName: 'ui:assets:list',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    requiredPermissions: Object.freeze(['Full permission', ASSETS_PAGE.permissionName, ASSETS_PAGE.legacyPermissionName]),
  }),
  [ROOM_KEYS.UI_BICYCLE_LIST]: Object.freeze({
    key: ROOM_KEYS.UI_BICYCLE_LIST,
    roomKind: 'ui.bicycle.list',
    roomName: 'ui:bicycle:list',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    requiredPermissions: Object.freeze([BICYCLE_PERMISSIONS.full, BICYCLE_PERMISSIONS.section]),
  }),
  [ROOM_KEYS.UI_WORKSPACE_NOTIFICATIONS]: Object.freeze({
    key: ROOM_KEYS.UI_WORKSPACE_NOTIFICATIONS,
    roomKind: 'ui.workspace.notifications',
    roomName: 'ui:workspace:notifications',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    authorize: async ({ principal }) => isUuid(principal?.id),
  }),
  [ROOM_KEYS.UI_LAUNDRY_LIST]: Object.freeze({
    key: ROOM_KEYS.UI_LAUNDRY_LIST,
    roomKind: 'ui.laundry.list',
    roomName: 'ui:laundry:list',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    requiredPermissions: Object.freeze([LAUNDRY_PERMISSIONS.full, LAUNDRY_PERMISSIONS.section]),
  }),
  [ROOM_KEYS.UI_ACCOMMODATION_LIST]: Object.freeze({
    key: ROOM_KEYS.UI_ACCOMMODATION_LIST,
    roomKind: 'ui.accommodation.list',
    roomName: 'ui:accommodation:list',
    isDefault: false,
    manualUnsubscribeAllowed: true,
    requiredPermissions: Object.freeze([
      ACCOMMODATION_PERMISSIONS.full,
      ACCOMMODATION_PERMISSIONS.section,
    ]),
  }),
});

const STATIC_ROOM_INDEX = new Map(
  Object.values(ROOM_DEFINITIONS)
    .filter((definition) => definition.roomName)
    .map((definition) => [definition.roomName, definition]),
);

function parseRoom(room) {
  const normalizedRoom = normalizeRoom(room);
  if (!normalizedRoom || !isRoomName(normalizedRoom)) return null;

  const staticDefinition = STATIC_ROOM_INDEX.get(normalizedRoom);
  if (staticDefinition) {
    return {
      key: staticDefinition.key,
      roomKind: staticDefinition.roomKind,
      roomName: normalizedRoom,
      ownerUserId: null,
      isDefault: Boolean(staticDefinition.isDefault),
      manualUnsubscribeAllowed: Boolean(staticDefinition.manualUnsubscribeAllowed),
      requiredPermissions: staticDefinition.requiredPermissions || [],
    };
  }

  const selfRoomDescriptor = ROOM_DEFINITIONS[ROOM_KEYS.USER_SELF].matcher?.(normalizedRoom);
  if (selfRoomDescriptor) return selfRoomDescriptor;

  return null;
}

async function checkPermissionSet({ principal, descriptor, permissionRepository, cache }) {
  const requiredPermissions = descriptor?.requiredPermissions || [];
  if (!requiredPermissions.length) return true;
  if (!isUuid(principal?.id)) return false;
  if (typeof permissionRepository?.userHasPermission !== 'function') return false;

  const cacheKey = `${principal.id}:${requiredPermissions.join('|')}`;
  if (cache?.has(cacheKey)) return cache.get(cacheKey);

  let allowed = false;
  for (const permissionName of requiredPermissions) {
    // Sequential is intentional to keep repository interface simple and deterministic.
    // The result is cached for the whole authorization pass.
    /* eslint-disable no-await-in-loop */
    if (await permissionRepository.userHasPermission(principal.id, permissionName)) {
      allowed = true;
      break;
    }
    /* eslint-enable no-await-in-loop */
  }

  cache?.set(cacheKey, allowed);
  return allowed;
}

function createRoomPolicy({ permissionRepository } = {}) {
  async function canAccessRoom({ principal, room, authorizationCache } = {}) {
    const descriptor = parseRoom(room);
    if (!descriptor) {
      return {
        ok: false,
        code: 'ROOM_NOT_REGISTERED',
        descriptor: null,
      };
    }

    const definition = ROOM_DEFINITIONS[descriptor.key];
    if (!definition) {
      return {
        ok: false,
        code: 'ROOM_NOT_REGISTERED',
        descriptor,
      };
    }

    if (typeof definition.authorize === 'function') {
      const allowed = await definition.authorize({ principal, descriptor, permissionRepository });
      return {
        ok: Boolean(allowed),
        code: allowed ? null : 'ROOM_ACCESS_DENIED',
        descriptor,
      };
    }

    const allowed = await checkPermissionSet({
      principal,
      descriptor,
      permissionRepository,
      cache: authorizationCache,
    });

    return {
      ok: Boolean(allowed),
      code: allowed ? null : 'ROOM_ACCESS_DENIED',
      descriptor,
    };
  }

  async function filterAuthorizedRooms({ principal, rooms = [] } = {}) {
    const allowed = [];
    const rejected = [];
    const authorizationCache = new Map();

    for (const room of rooms.map(normalizeRequestedRoomName)) {
      const result = await canAccessRoom({ principal, room, authorizationCache });
      if (result.ok) {
        allowed.push(result.descriptor.roomName);
        continue;
      }
      rejected.push({
        room: normalizeRequestedRoomName(room),
        code: result.code || 'ROOM_ACCESS_DENIED',
      });
    }

    return {
      allowed: [...new Set(allowed)],
      rejected: rejected.reduce((accumulator, entry) => {
        if (!accumulator.some((existing) => existing.room === entry.room && existing.code === entry.code)) {
          accumulator.push(entry);
        }
        return accumulator;
      }, []),
    };
  }

  function getDefaultRoomsForPrincipal(principal) {
    if (!isUuid(principal?.id)) return [];
    const userId = String(principal.id).toLowerCase();
    return [`user:${userId}`, 'presence:authenticated', 'ui:workspace:notifications'];
  }

  function isDefaultRoomForPrincipal(principal, room) {
    return getDefaultRoomsForPrincipal(principal).includes(normalizeRoom(room));
  }

  return {
    ROOM_KEYS,
    ROOM_DEFINITIONS,
    parseRoom,
    canAccessRoom,
    filterAuthorizedRooms,
    getDefaultRoomsForPrincipal,
    isDefaultRoomForPrincipal,
  };
}

const defaultRoomPolicy = createRoomPolicy();

function getDefaultRoomsForUser(userId) {
  return defaultRoomPolicy.getDefaultRoomsForPrincipal({ id: userId });
}

async function canAccessRoom(args) {
  const result = await defaultRoomPolicy.canAccessRoom({
    principal: args?.principal || { id: args?.userId },
    room: args?.room,
  });
  return result.ok;
}

async function filterAuthorizedRooms(args) {
  const originalRooms = args?.rooms || args?.requestedRooms || [];

  if (typeof args?.hasPermission === 'function') {
    const allowed = [];
    const rejected = [];
    const seenAllowed = new Set();
    const seenRejected = new Set();

    for (const requestedRoom of originalRooms) {
      const room = normalizeRequestedRoomName(requestedRoom);
      const descriptor = parseRoom(room);
      if (!descriptor) {
        const key = `${requestedRoom}:room_not_registered`;
        if (!seenRejected.has(key)) {
          seenRejected.add(key);
          rejected.push({ room: requestedRoom, code: 'ROOM_NOT_REGISTERED', reasonCode: 'room_not_registered' });
        }
        continue;
      }

      if (!descriptor.requiredPermissions?.length) {
        if (!seenAllowed.has(requestedRoom)) {
          seenAllowed.add(requestedRoom);
          allowed.push(requestedRoom);
        }
        continue;
      }

      let granted = false;
      for (const permissionName of descriptor.requiredPermissions) {
        /* eslint-disable no-await-in-loop */
        if (await args.hasPermission(args?.principal || { id: args?.userId }, permissionName)) {
          granted = true;
          break;
        }
        /* eslint-enable no-await-in-loop */
      }

      if (granted) {
        if (!seenAllowed.has(requestedRoom)) {
          seenAllowed.add(requestedRoom);
          allowed.push(requestedRoom);
        }
        continue;
      }

      const rejectKey = `${requestedRoom}:missing_permission`;
      if (!seenRejected.has(rejectKey)) {
        seenRejected.add(rejectKey);
        rejected.push({
          room: requestedRoom,
          code: 'ROOM_ACCESS_DENIED',
          reasonCode: 'missing_permission',
        });
      }
    }

    return { allowed, rejected };
  }

  return defaultRoomPolicy.filterAuthorizedRooms({
    principal: args?.principal || { id: args?.userId },
    rooms: originalRooms.map(normalizeRequestedRoomName),
  });
}

module.exports = {
  ROOM_KEYS,
  ROOM_DEFINITIONS,
  createRoomPolicy,
  parseRoom,
  getDefaultRoomsForUser,
  canAccessRoom,
  filterAuthorizedRooms,
};
