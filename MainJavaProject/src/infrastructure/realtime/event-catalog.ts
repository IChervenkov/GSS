const { REALTIME_EVENT_NAMES } = require('../../shared/realtime/event-names');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_STATUS = new Set(['pending', 'approved', 'denied', 'expired']);
const REQUEST_TYPE = new Set(['show_qr', 'password_change']);
const IMPORT_STAGE = new Set(['processing', 'completed', 'failed']);
const ROOM_PATTERN =
  /^(?:user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|ui:user:list|ui:permission:list|ui:camp:list|ui:assets:list|ui:bicycle:list|ui:workspace:notifications|ui:laundry:list|ui:accommodation:list|presence:authenticated)$/i;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function normalizeRoom(room) {
  return String(room || '')
    .trim()
    .toLowerCase();
}

function isRoomName(value) {
  return ROOM_PATTERN.test(normalizeRoom(value));
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateEmptyPayload(payload) {
  if (payload === undefined) return { ok: true, value: {} };
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  return { ok: true, value: payload };
}

function validateApprovalPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (!isUuid(payload.requestId)) return { ok: false, reason: 'requestId must be a UUID.' };
  if (!REQUEST_STATUS.has(payload.status)) return { ok: false, reason: 'status is invalid.' };
  if (!REQUEST_TYPE.has(payload.requestType)) {
    return { ok: false, reason: 'requestType is invalid.' };
  }
  if (!isUuid(payload.userId)) return { ok: false, reason: 'userId must be a UUID.' };
  if (!Number.isInteger(payload.version) || payload.version < 1) {
    return { ok: false, reason: 'version must be a positive integer.' };
  }
  return { ok: true, value: payload };
}

function validateRoomSubscriptionPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (!Array.isArray(payload.rooms) || payload.rooms.length === 0) {
    return { ok: false, reason: 'rooms must be a non-empty array.' };
  }

  const normalized = payload.rooms.map(normalizeRoom).filter(Boolean);
  if (normalized.length !== payload.rooms.length) {
    return { ok: false, reason: 'rooms contains invalid entries.' };
  }
  if (normalized.some((room) => !isRoomName(room))) {
    return { ok: false, reason: 'rooms contains invalid room names.' };
  }

  return {
    ok: true,
    value: {
      rooms: [...new Set(normalized)],
      subscriptionId: payload.subscriptionId ? String(payload.subscriptionId) : null,
    },
  };
}

function validatePermissionSelfRefreshPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (!isUuid(payload.userId)) return { ok: false, reason: 'userId must be a UUID.' };
  return { ok: true, value: payload };
}

function validateUserUpdatedPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (payload.userId !== undefined && !isUuid(payload.userId)) {
    return { ok: false, reason: 'userId must be a UUID.' };
  }
  if (payload.username !== undefined && String(payload.username || '').trim().length === 0) {
    return { ok: false, reason: 'username must be a non-empty string.' };
  }
  return { ok: true, value: payload };
}

function validateUserDeletedPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (!isUuid(payload.userId)) return { ok: false, reason: 'userId must be a UUID.' };
  return { ok: true, value: payload };
}

function validateUserDeletedListPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (!Array.isArray(payload.deletedUserIds)) {
    return { ok: false, reason: 'deletedUserIds must be an array.' };
  }
  if (payload.deletedUserIds.some((value) => !isUuid(value))) {
    return { ok: false, reason: 'deletedUserIds must contain UUID values.' };
  }
  return { ok: true, value: payload };
}

function validateAdminInboxUpdatedPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (payload.sourceId !== undefined && payload.sourceId !== null && !isUuid(payload.sourceId)) {
    return { ok: false, reason: 'sourceId must be a UUID.' };
  }
  if (payload.status !== undefined && typeof payload.status !== 'string') {
    return { ok: false, reason: 'status must be a string.' };
  }
  if (payload.kind !== undefined && typeof payload.kind !== 'string') {
    return { ok: false, reason: 'kind must be a string.' };
  }
  if (payload.type !== undefined && typeof payload.type !== 'string') {
    return { ok: false, reason: 'type must be a string.' };
  }
  return { ok: true, value: payload };
}

function validateEntityChangedPayload(idFieldName) {
  return (payload) => {
    if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
    if (!isUuid(payload[idFieldName])) return { ok: false, reason: `${idFieldName} must be a UUID.` };
    return { ok: true, value: payload };
  };
}

function validateOptionalCampChangedPayload(payload) {
  if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
  if (payload.campId !== undefined && !isUuid(payload.campId)) {
    return { ok: false, reason: 'campId must be a UUID.' };
  }
  return { ok: true, value: payload };
}

const validateCampChangedPayload = validateEntityChangedPayload('campId');
const validateBicycleChangedPayload = validateEntityChangedPayload('identifier');
const validateAssetsChangedPayload = validateOptionalCampChangedPayload;
const validateLaundryChangedPayload = validateCampChangedPayload;
const validateAccommodationChangedPayload = validateCampChangedPayload;
const validateSoldierChangedPayload = validateCampChangedPayload;

function validateImportProgressPayload({ idFieldName = 'userId' } = {}) {
  return (payload) => {
    if (!isObject(payload)) return { ok: false, reason: 'Payload must be an object.' };
    if (!isUuid(payload[idFieldName])) return { ok: false, reason: `${idFieldName} must be a UUID.` };
    if (!IMPORT_STAGE.has(payload.stage)) return { ok: false, reason: 'stage is invalid.' };

    const counters = [
      payload.totalRows,
      payload.processedRows,
      payload.addedCount,
      payload.updatedCount,
      payload.skippedCount,
      payload.errorCount,
    ];
    if (counters.some((value) => !isPositiveInteger(value))) {
      return { ok: false, reason: 'progress counters must be non-negative integers.' };
    }

    if (
      payload.progressPercent !== undefined &&
      (!Number.isInteger(payload.progressPercent) ||
        payload.progressPercent < 0 ||
        payload.progressPercent > 100)
    ) {
      return { ok: false, reason: 'progressPercent must be an integer between 0 and 100.' };
    }

    if (payload.message !== undefined && typeof payload.message !== 'string') {
      return { ok: false, reason: 'message must be a string.' };
    }

    if (payload.errors !== undefined) {
      if (!Array.isArray(payload.errors)) return { ok: false, reason: 'errors must be an array.' };
      for (const error of payload.errors) {
        if (!isObject(error)) return { ok: false, reason: 'errors entries must be objects.' };
        if (!isPositiveInteger(error.rowNumber)) {
          return { ok: false, reason: 'errors.rowNumber must be a non-negative integer.' };
        }
        if (typeof error.message !== 'string' || error.message.trim().length === 0) {
          return { ok: false, reason: 'errors.message must be a non-empty string.' };
        }
      }
    }

    return { ok: true, value: payload };
  };
}

const validateCampImportProgressPayload = validateImportProgressPayload({ idFieldName: 'userId' });
const validateBicycleImportProgressPayload = validateImportProgressPayload({ idFieldName: 'userId' });

function createServerEvent({ resolveRooms, validatePayload, allowedRoomKinds }) {
  return Object.freeze({
    source: 'server',
    resolveRooms,
    validatePayload,
    allowedRoomKinds: Object.freeze([...(allowedRoomKinds || [])]),
  });
}

function createClientEvent({ validatePayload, ackRequired = true }) {
  return Object.freeze({
    source: 'client',
    resolveRooms: () => ['server-command'],
    validatePayload,
    ackRequired,
  });
}

const EVENT_CATALOG = Object.freeze({
  [REALTIME_EVENT_NAMES.USER_REQUEST.RESOLVED]: createServerEvent({
    resolveRooms: (payload) => [`user:${String(payload.userId).toLowerCase()}`],
    validatePayload: validateApprovalPayload,
    allowedRoomKinds: ['user'],
  }),
  [REALTIME_EVENT_NAMES.CAMP_RECORD.CREATED]: createServerEvent({
    resolveRooms: () => ['ui:camp:list'],
    validatePayload: validateEmptyPayload,
    allowedRoomKinds: ['ui.camp.list'],
  }),
  [REALTIME_EVENT_NAMES.CAMP_RECORD.UPDATED]: createServerEvent({
    resolveRooms: () => ['ui:camp:list'],
    validatePayload: validateCampChangedPayload,
    allowedRoomKinds: ['ui.camp.list'],
  }),
  [REALTIME_EVENT_NAMES.CAMP_RECORD.DELETED]: createServerEvent({
    resolveRooms: () => ['ui:camp:list'],
    validatePayload: validateCampChangedPayload,
    allowedRoomKinds: ['ui.camp.list'],
  }),
  [REALTIME_EVENT_NAMES.CAMP_RECORD.ACCESS_CHANGED]: createServerEvent({
    resolveRooms: () => ['ui:camp:list', 'ui:permission:list'],
    validatePayload: validateEmptyPayload,
    allowedRoomKinds: ['ui.camp.list', 'ui.permission.list'],
  }),
  [REALTIME_EVENT_NAMES.CAMP_RECORD.ACCESS_SELF_REFRESHED]: createServerEvent({
    resolveRooms: (payload) => [`user:${String(payload.userId).toLowerCase()}`],
    validatePayload: validatePermissionSelfRefreshPayload,
    allowedRoomKinds: ['user'],
  }),
  [REALTIME_EVENT_NAMES.CAMP_IMPORT.PROGRESSED]: createServerEvent({
    resolveRooms: (payload) => [`user:${String(payload.userId).toLowerCase()}`],
    validatePayload: validateCampImportProgressPayload,
    allowedRoomKinds: ['user'],
  }),
  [REALTIME_EVENT_NAMES.BICYCLE_RECORD.CREATED]: createServerEvent({
    resolveRooms: () => ['ui:bicycle:list'],
    validatePayload: validateEmptyPayload,
    allowedRoomKinds: ['ui.bicycle.list'],
  }),
  [REALTIME_EVENT_NAMES.BICYCLE_RECORD.UPDATED]: createServerEvent({
    resolveRooms: () => ['ui:bicycle:list'],
    validatePayload: validateBicycleChangedPayload,
    allowedRoomKinds: ['ui.bicycle.list'],
  }),
  [REALTIME_EVENT_NAMES.BICYCLE_RECORD.DELETED]: createServerEvent({
    resolveRooms: () => ['ui:bicycle:list'],
    validatePayload: validateBicycleChangedPayload,
    allowedRoomKinds: ['ui.bicycle.list'],
  }),
  [REALTIME_EVENT_NAMES.BICYCLE_RECORD.STATUS_CHANGED]: createServerEvent({
    resolveRooms: () => ['ui:bicycle:list', 'ui:workspace:notifications'],
    validatePayload: validateBicycleChangedPayload,
    allowedRoomKinds: ['ui.bicycle.list', 'ui.workspace.notifications'],
  }),
  [REALTIME_EVENT_NAMES.BICYCLE_IMPORT.PROGRESSED]: createServerEvent({
    resolveRooms: (payload) => [`user:${String(payload.userId).toLowerCase()}`],
    validatePayload: validateBicycleImportProgressPayload,
    allowedRoomKinds: ['user'],
  }),
  [REALTIME_EVENT_NAMES.ASSET_RECORD.CHANGED]: createServerEvent({
    resolveRooms: () => ['ui:assets:list'],
    validatePayload: validateAssetsChangedPayload,
    allowedRoomKinds: ['ui.assets.list'],
  }),
  [REALTIME_EVENT_NAMES.LAUNDRY_RECORD.CHANGED]: createServerEvent({
    resolveRooms: () => ['ui:laundry:list'],
    validatePayload: validateLaundryChangedPayload,
    allowedRoomKinds: ['ui.laundry.list'],
  }),
  [REALTIME_EVENT_NAMES.LAUNDRY_RECORD.OVERDUE]: createServerEvent({
    resolveRooms: () => ['ui:laundry:list', 'ui:workspace:notifications'],
    validatePayload: validateEmptyPayload,
    allowedRoomKinds: ['ui.laundry.list', 'ui.workspace.notifications'],
  }),
  [REALTIME_EVENT_NAMES.ACCOMMODATION_RECORD.CHANGED]: createServerEvent({
    resolveRooms: () => ['ui:accommodation:list', 'ui:assets:list'],
    validatePayload: validateAccommodationChangedPayload,
    allowedRoomKinds: ['ui.accommodation.list', 'ui.assets.list'],
  }),
  [REALTIME_EVENT_NAMES.SOLDIER_RECORD.CHANGED]: createServerEvent({
    resolveRooms: () => [
      'ui:accommodation:list',
      'ui:assets:list',
      'ui:laundry:list',
      'ui:bicycle:list',
      'ui:camp:list',
    ],
    validatePayload: validateSoldierChangedPayload,
    allowedRoomKinds: [
      'ui.accommodation.list',
      'ui.assets.list',
      'ui.laundry.list',
      'ui.bicycle.list',
      'ui.camp.list',
    ],
  }),
  [REALTIME_EVENT_NAMES.PERMISSION.CATALOG_UPDATED]: createServerEvent({
    resolveRooms: () => ['ui:permission:list'],
    validatePayload: validateEmptyPayload,
    allowedRoomKinds: ['ui.permission.list'],
  }),
  [REALTIME_EVENT_NAMES.PERMISSION.ACCESS_CHANGED]: createServerEvent({
    resolveRooms: () => ['presence:authenticated'],
    validatePayload: validateEmptyPayload,
    allowedRoomKinds: ['presence'],
  }),
  [REALTIME_EVENT_NAMES.PERMISSION.SELF_REFRESHED]: createServerEvent({
    resolveRooms: (payload) => [`user:${String(payload.userId).toLowerCase()}`],
    validatePayload: validatePermissionSelfRefreshPayload,
    allowedRoomKinds: ['user'],
  }),
  [REALTIME_EVENT_NAMES.USER_RECORD.CREATED]: createServerEvent({
    resolveRooms: () => ['ui:user:list'],
    validatePayload: validateEmptyPayload,
    allowedRoomKinds: ['ui.user.list'],
  }),
  [REALTIME_EVENT_NAMES.USER_RECORD.UPDATED]: createServerEvent({
    resolveRooms: () => ['ui:user:list'],
    validatePayload: validateUserUpdatedPayload,
    allowedRoomKinds: ['ui.user.list'],
  }),
  [REALTIME_EVENT_NAMES.USER_RECORD.DELETED]: createServerEvent({
    resolveRooms: (payload) => [`user:${String(payload.userId).toLowerCase()}`],
    validatePayload: validateUserDeletedPayload,
    allowedRoomKinds: ['user'],
  }),
  [REALTIME_EVENT_NAMES.USER_RECORD.BULK_DELETED]: createServerEvent({
    resolveRooms: () => ['ui:user:list'],
    validatePayload: validateUserDeletedListPayload,
    allowedRoomKinds: ['ui.user.list'],
  }),
  [REALTIME_EVENT_NAMES.USER_REQUEST.UPDATED]: createServerEvent({
    resolveRooms: () => ['ui:user:list'],
    validatePayload: validateApprovalPayload,
    allowedRoomKinds: ['ui.user.list'],
  }),
  [REALTIME_EVENT_NAMES.ADMIN_INBOX.UPDATED]: createServerEvent({
    resolveRooms: () => ['ui:user:list'],
    validatePayload: validateAdminInboxUpdatedPayload,
    allowedRoomKinds: ['ui.user.list'],
  }),
  [REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_REQUESTED]: createClientEvent({
    validatePayload: validateRoomSubscriptionPayload,
  }),
  [REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_RELEASED]: createClientEvent({
    validatePayload: validateRoomSubscriptionPayload,
  }),
});

function resolveCatalogEventName(eventName) {
  switch (eventName) {
    case 'room:subscription:requested':
      return REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_REQUESTED;
    case 'room:subscription:released':
      return REALTIME_EVENT_NAMES.ROOM.SUBSCRIPTION_RELEASED;
    case 'user:request:resolved':
      return REALTIME_EVENT_NAMES.USER_REQUEST.RESOLVED;
    case 'user:record:created':
      return REALTIME_EVENT_NAMES.USER_RECORD.CREATED;
    case 'user:record:updated':
      return REALTIME_EVENT_NAMES.USER_RECORD.UPDATED;
    case 'user:record:deleted':
      return REALTIME_EVENT_NAMES.USER_RECORD.DELETED;
    case 'user:record:bulk_deleted':
      return REALTIME_EVENT_NAMES.USER_RECORD.BULK_DELETED;
    case 'camp:record:created':
      return REALTIME_EVENT_NAMES.CAMP_RECORD.CREATED;
    case 'camp:record:updated':
      return REALTIME_EVENT_NAMES.CAMP_RECORD.UPDATED;
    case 'camp:record:deleted':
      return REALTIME_EVENT_NAMES.CAMP_RECORD.DELETED;
    case 'camp:access:updated':
      return REALTIME_EVENT_NAMES.CAMP_RECORD.ACCESS_CHANGED;
    case 'camp:access:self:refreshed':
      return REALTIME_EVENT_NAMES.CAMP_RECORD.ACCESS_SELF_REFRESHED;
    case 'camp:import:progressed':
      return REALTIME_EVENT_NAMES.CAMP_IMPORT.PROGRESSED;
    case 'bicycle:record:created':
      return REALTIME_EVENT_NAMES.BICYCLE_RECORD.CREATED;
    case 'bicycle:record:updated':
      return REALTIME_EVENT_NAMES.BICYCLE_RECORD.UPDATED;
    case 'bicycle:record:deleted':
      return REALTIME_EVENT_NAMES.BICYCLE_RECORD.DELETED;
    case 'bicycle:record:status_changed':
      return REALTIME_EVENT_NAMES.BICYCLE_RECORD.STATUS_CHANGED;
    case 'bicycle:import:progressed':
      return REALTIME_EVENT_NAMES.BICYCLE_IMPORT.PROGRESSED;
    case 'asset:record:changed':
    case 'assets:record:changed':
      return REALTIME_EVENT_NAMES.ASSET_RECORD.CHANGED;
    case 'laundry:record:changed':
      return REALTIME_EVENT_NAMES.LAUNDRY_RECORD.CHANGED;
    case 'accommodation:record:changed':
      return REALTIME_EVENT_NAMES.ACCOMMODATION_RECORD.CHANGED;
    case 'soldier:record:changed':
      return REALTIME_EVENT_NAMES.SOLDIER_RECORD.CHANGED;
    case 'permission:catalog:updated':
      return REALTIME_EVENT_NAMES.PERMISSION.CATALOG_UPDATED;
    case 'permission:access:updated':
      return REALTIME_EVENT_NAMES.PERMISSION.ACCESS_CHANGED;
    case 'permission:access:changed':
      return REALTIME_EVENT_NAMES.PERMISSION.ACCESS_CHANGED;
    case 'permission:self:refreshed':
      return REALTIME_EVENT_NAMES.PERMISSION.SELF_REFRESHED;
    default:
      return eventName;
  }
}

function validateEventPayload(eventName, payload) {
  const contract = EVENT_CATALOG[resolveCatalogEventName(eventName)];
  if (!contract) return { ok: false, reason: `Unknown realtime event: ${eventName}` };
  return contract.validatePayload(payload);
}

function resolveEventRooms(eventName, payload = {}) {
  const contract = EVENT_CATALOG[resolveCatalogEventName(eventName)];
  if (!contract) return [];
  return contract.resolveRooms(payload).map(normalizeRoom).filter(Boolean);
}

function getEventContract(eventName) {
  return EVENT_CATALOG[resolveCatalogEventName(eventName)] || null;
}

function canEmitEventToRoom(eventName, roomDescriptor) {
  const contract = getEventContract(eventName);
  if (!contract || contract.source !== 'server') return false;
  const allowedRoomKinds = contract.allowedRoomKinds || [];
  if (allowedRoomKinds.length === 0) return false;
  return allowedRoomKinds.includes(roomDescriptor?.roomKind);
}

module.exports = {
  EVENT_CATALOG,
  normalizeRoom,
  isRoomName,
  isUuid,
  validateEventPayload,
  resolveEventRooms,
  getEventContract,
  canEmitEventToRoom,
  resolveCatalogEventName,
};
