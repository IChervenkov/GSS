const { AppError } = require('../../../../../shared/errors/app-error');
const { MAIN_PERMISSIONS } = require('../../domain/main.permissions');
const { AUDIT_EVENT_NAMES } = require('../../../../../shared/security/audit-event-names');

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function normalizeChanges(changes = []) {
  const deduped = new Map();
  for (const change of changes) {
    const normalized = {
      userId: String(change.userId),
      permissionId: String(change.permId),
      isChecked: Boolean(change.isCheck),
    };
    deduped.set(`${normalized.userId}:${normalized.permissionId}`, normalized);
  }
  return [...deduped.values()];
}

function normalizeCampAccessChanges(changes = []) {
  const deduped = new Map();
  for (const change of changes) {
    const normalized = {
      userId: String(change.userId),
      campId: String(change.campId),
      isChecked: Boolean(change.isCheck),
    };
    deduped.set(`${normalized.userId}:${normalized.campId}`, normalized);
  }
  return [...deduped.values()];
}

const { success } = require('../../../../../shared/application/action-result');

function createPermissionService({ env, repository, realtime, auditLog }) {
  async function reevaluatePermissionAccess(userId) {
    if (!userId || typeof realtime?.reevaluateUserSockets !== 'function') return;

    try {
      await realtime.reevaluateUserSockets(userId, 'permissions_changed');
    } catch {
      // Access re-evaluation is best-effort; permission data is already persisted.
    }
  }

  async function getPermissionMatrix({
    page,
    limit,
    searchColumns = [],
    searchValues = [],
    sortColumn,
    sortDirection,
  }) {
    const normalizedSearchColumns = toArray(searchColumns);
    const normalizedSearchValues = toArray(searchValues);
    const filters = normalizedSearchColumns.map((column, index) => ({
      column,
      value: normalizedSearchValues[index],
    }));
    const result = await repository.listPermissionMatrix({
      adminUsername: env.ADMIN_USERNAME,
      page,
      limit,
      filters,
      sort: { column: sortColumn, direction: sortDirection },
    });

    return success({
      users: result.users,
      permissions: result.permissions,
      userPermissions: result.userPermissions,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    });
  }

  async function getCampAccessMatrix({
    page,
    limit,
    searchColumns = [],
    searchValues = [],
    sortColumn,
    sortDirection,
  }) {
    const normalizedSearchColumns = toArray(searchColumns);
    const normalizedSearchValues = toArray(searchValues);
    const filters = normalizedSearchColumns.map((column, index) => ({
      column,
      value: normalizedSearchValues[index],
    }));
    const result = await repository.listCampAccessMatrix({
      adminUsername: env.ADMIN_USERNAME,
      page,
      limit,
      filters,
      sort: { column: sortColumn, direction: sortDirection },
    });

    return success({
      users: result.users,
      camps: result.camps,
      userCampAccess: result.userCampAccess,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    });
  }

  async function savePermissions({ actorUserId, changes, requestMeta }) {
    const normalizedChanges = normalizeChanges(changes);
    const allowed = await repository.userHasPermission(actorUserId, MAIN_PERMISSIONS.system);
    if (!allowed) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to change permissions.",
      });
    }

    const result = await repository.savePermissions({ actorUserId, changes: normalizedChanges });
    realtime.emitPermissionListUpdated();
    realtime.emitPermissionAccessChanged?.();
    for (const userId of result.affectedUserIds) {
      realtime.emitPermissionSelfRefresh(userId);
      await reevaluatePermissionAccess(userId);
    }
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.PERMISSION_UPDATED, {
      ...requestMeta,
      actorUserId,
      affectedUserIds: result.affectedUserIds,
      changeCount: normalizedChanges.length,
    });

    return success({ message: 'Permissions set successfully' });
  }

  async function saveCampAccess({ actorUserId, changes, requestMeta }) {
    const normalizedChanges = normalizeCampAccessChanges(changes);
    const allowed = await repository.userHasPermission(actorUserId, MAIN_PERMISSIONS.system);
    if (!allowed) {
      throw new AppError({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: "You don't have permission to change camp access.",
      });
    }

    const result = await repository.saveCampAccess({ actorUserId, changes: normalizedChanges });
    realtime.emitCampAccessChanged?.();
    for (const userId of result.affectedUserIds) {
      realtime.emitCampAccessSelfRefresh?.(userId);
      await reevaluatePermissionAccess(userId);
    }
    auditLog?.(AUDIT_EVENT_NAMES.MAIN.CAMP_ACCESS_UPDATED, {
      ...requestMeta,
      actorUserId,
      affectedUserIds: result.affectedUserIds,
      changeCount: normalizedChanges.length,
    });

    return success({ message: 'Camp access updated successfully' });
  }

  async function getCurrentUserPermissions({ userId }) {
    const permissions = await repository.listCurrentUserPermissions({ userId });
    return success({
      permissions,
    });
  }

  return {
    getPermissionMatrix,
    getCampAccessMatrix,
    savePermissions,
    saveCampAccess,
    getCurrentUserPermissions,
  };
}

module.exports = { createPermissionService };
