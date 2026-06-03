// @ts-nocheck
const { AppError } = require('../../../../../shared/errors/app-error');
const { buildHorizontalNavItems } = require('../../../../../shared/public/js/ui/navigation');
const { success } = require('../../../../../shared/application/action-result');

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function getFirstCreatedCamp(camps = []) {
  return camps.reduce((oldestCamp, camp) => {
    if (!camp) return oldestCamp;
    if (!oldestCamp) return camp;

    const campCreatedAt = Date.parse(camp.createdAt);
    const oldestCreatedAt = Date.parse(oldestCamp.createdAt);

    if (Number.isNaN(oldestCreatedAt)) return camp;
    if (Number.isNaN(campCreatedAt)) return oldestCamp;
    if (campCreatedAt < oldestCreatedAt) return camp;
    if (campCreatedAt > oldestCreatedAt) return oldestCamp;

    return String(camp.id) < String(oldestCamp.id) ? camp : oldestCamp;
  }, null);
}

function createMainPageService({ env, repository }) {
  async function getMainPage({ userId, sessionState = {}, mainSession = null }) {
    const context = await repository.findMainPageContext({ userId });
    if (!context.user) {
      throw new AppError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'The authenticated user no longer exists.',
      });
    }

    const defaultCamp = getFirstCreatedCamp(context.camps);
    const requestedCampId = sessionState.currentCampId || defaultCamp?.id || null;
    const selectedCamp =
      context.camps.find((camp) => String(camp.id) === String(requestedCampId)) || null;
    const nextCampId = selectedCamp?.id || null;
    const isAdmin = Boolean(env.ADMIN_USERNAME) && context.user.username === env.ADMIN_USERNAME;
    const navItems = buildHorizontalNavItems(context.permissions, isAdmin);

    if (mainSession) {
      if (nextCampId) {
        mainSession.setCurrentCamp(nextCampId);
      } else {
        mainSession.clearCurrentCamp();
      }
      await mainSession.save();
    }

    return {
      title: 'Main Page Layout',
      startMessage: 'Welcome to Global Support System (GSS)',
      horizontalNavItems: navItems,
      permissions: context.permissions,
      isAdmin,
      firstLogin: false,
      campId: nextCampId,
      currentCampName: selectedCamp?.name || null,
    };
  }

  async function getCampSelectorData({
    userId,
    page = 1,
    limit = 10,
    searchColumns = [],
    searchValues = [],
    sortColumn = undefined,
    sortDirection = 'default',
  }) {
    const normalizedSearchColumns = toArray(searchColumns);
    const normalizedSearchValues = toArray(searchValues);
    const filters = normalizedSearchColumns.map((column, index) => ({
      column,
      value: normalizedSearchValues[index],
    }));
    const { camps, permissions, total } = await repository.listCampsAndPermissions({
      userId,
      page,
      limit,
      filters,
      sortColumn,
      sortDirection,
    });

    const permissionNames = permissions.map((item) => item.name);
    const canEditCamp =
      permissionNames.includes('Full permission') || permissionNames.includes('Edit camp');
    const canDeleteCamp =
      permissionNames.includes('Full permission') || permissionNames.includes('Delete camp');

    return success({
      camps: camps.map((camp) => ({
        id: camp.id,
        name: camp.name,
        createdAt: camp.createdAt,
        canEdit: canEditCamp,
        canDelete: canDeleteCamp,
      })),
      permissions,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      sortColumn: sortColumn || null,
      sortDirection: sortDirection || 'default',
    });
  }

  async function setCurrentCamp({ campId, mainSession = null }) {
    const exists = await repository.campExists(campId);
    if (!exists) {
      throw new AppError({ status: 404, code: 'CAMP_NOT_FOUND', message: 'Camp not found.' });
    }

    if (mainSession) {
      mainSession.setCurrentCamp(campId);
      await mainSession.save();
    }

    return success({
      success: true,
      campId,
    });
  }

  return {
    getMainPage,
    getCampSelectorData,
    setCurrentCamp,
  };
}

module.exports = { createMainPageService, getFirstCreatedCamp };
