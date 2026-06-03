// @ts-nocheck
function toBicyclesOverviewResponseDto(result = {}) {
  return { ...(result?.body || result || {}) };
}

function toBicyclesViewResponseDto(model = {}) {
  return {
    title: model.title || 'Bicycles',
    horizontalNavItems: Array.isArray(model.horizontalNavItems) ? model.horizontalNavItems : [],
    campId: model.campId || null,
    csrfToken: model.csrfToken || '',
    canDownloadBikeMobileApp: Boolean(model.canDownloadBikeMobileApp),
    bikeMobileAppDownloadUrl: model.bikeMobileAppDownloadUrl || '/web/bicycles/mobile-app',
  };
}

module.exports = {
  toBicyclesOverviewResponseDto,
  toBicyclesViewResponseDto,
};
