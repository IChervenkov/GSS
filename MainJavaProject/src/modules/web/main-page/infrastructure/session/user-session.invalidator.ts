// @ts-nocheck
const { invalidateUserSessions } = require('../../../../../shared/utils/session-utils');

function normalizeUserIds(userIds = []) {
  return [...new Set(userIds.map((userId) => String(userId || '')).filter(Boolean))];
}

function createUserSessionInvalidator({ disconnectUserSockets } = {}) {
  return {
    invalidate: async ({ store, userIds = [], reason = 'admin_security_reset' } = {}) => {
      const targetUserIds = normalizeUserIds(userIds);
      const sessionResult = await invalidateUserSessions({
        store,
        userIds: targetUserIds,
        reason,
      }).catch(() => null);

      const disconnectedSocketCounts = {};
      if (typeof disconnectUserSockets === 'function') {
        await Promise.all(
          targetUserIds.map(async (userId) => {
            disconnectedSocketCounts[userId] = await disconnectUserSockets(userId, reason).catch(
              () => 0,
            );
          }),
        );
      }

      return {
        ...(sessionResult || { destroyedSessionIds: [], skipped: true }),
        disconnectedSocketCounts,
      };
    },
  };
}

module.exports = { createUserSessionInvalidator };
