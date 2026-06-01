const REALTIME_EVENT_NAMES = Object.freeze({
  ROOM: Object.freeze({
    SUBSCRIPTION_REQUESTED: 'rooms:subscribe',
    SUBSCRIPTION_RELEASED: 'rooms:unsubscribe',
    LEGACY_SUBSCRIBE: 'room:subscription:requested',
    LEGACY_UNSUBSCRIBE: 'room:subscription:released',
  }),
  USER_REQUEST: Object.freeze({
    UPDATED: 'user:request:updated',
    RESOLVED: 'approval:resolved',
  }),
  USER_RECORD: Object.freeze({
    CREATED: 'user:add',
    UPDATED: 'user:updated',
    DELETED: 'user:deleted',
    BULK_DELETED: 'user:deleted:list',
  }),
  ADMIN_INBOX: Object.freeze({
    UPDATED: 'admin:inbox:updated',
  }),
  CAMP_RECORD: Object.freeze({
    CREATED: 'camp:add',
    UPDATED: 'camp:updated',
    DELETED: 'camp:deleted',
  }),
  CAMP_IMPORT: Object.freeze({
    PROGRESSED: 'camp:import:progress',
  }),
  BICYCLE_RECORD: Object.freeze({
    CREATED: 'bicycle:add',
    UPDATED: 'bicycle:updated',
    DELETED: 'bicycle:deleted',
    STATUS_CHANGED: 'bicycle:status:changed',
  }),
  BICYCLE_IMPORT: Object.freeze({
    PROGRESSED: 'bicycle:import:progress',
  }),
  ASSET_RECORD: Object.freeze({
    CHANGED: 'assets:changed',
  }),
  LAUNDRY_RECORD: Object.freeze({
    CHANGED: 'laundry:changed',
    OVERDUE: 'laundry:overdue',
  }),
  ACCOMMODATION_RECORD: Object.freeze({
    CHANGED: 'accommodation:changed',
  }),
  SOLDIER_RECORD: Object.freeze({
    CHANGED: 'soldier:changed',
  }),
  PERMISSION: Object.freeze({
    CATALOG_UPDATED: 'permission:updated',
    ACCESS_CHANGED: 'permission:access:changed',
    SELF_REFRESHED: 'permission:self:refresh',
  }),
});

module.exports = { REALTIME_EVENT_NAMES };
