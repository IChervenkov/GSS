const { toActionPayload } = require('../../../../../shared/application/action-result');

function toMainPageViewResponseDto(model = {}) {
  return {
    title: model.title || 'Main Page Layout',
    startMessage: model.startMessage || 'Welcome to Global Support System (GSS)',
    horizontalNavItems: Array.isArray(model.horizontalNavItems) ? model.horizontalNavItems : [],
    permissions: Array.isArray(model.permissions) ? model.permissions : [],
    isAdmin: Boolean(model.isAdmin),
    firstLogin: Boolean(model.firstLogin),
    campId: model.campId || null,
    currentCampName: model.currentCampName || null,
  };
}

function toMainActionResponseDto(result = {}) {
  return { ...toActionPayload(result) };
}

module.exports = {
  toMainActionResponseDto,
  toMainPageViewResponseDto,
};
