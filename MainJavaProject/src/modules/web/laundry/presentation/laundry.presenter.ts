const {
  fileResponse,
  jsonResponse,
  renderResponse,
} = require('../../../../shared/http/response-contract');

function presentLaundryView(model = {}) {
  return renderResponse(
    'laundry-page',
    {
      title: model.title || 'Laundry',
      pageKey: model.pageKey || 'laundry-page',
      currentNav: model.currentNav || 'Laundry',
      horizontalNavItems: Array.isArray(model.horizontalNavItems) ? model.horizontalNavItems : [],
      campId: model.campId || null,
      csrfToken: model.csrfToken || '',
      canDownloadLaundryMobileApp: Boolean(model.canDownloadLaundryMobileApp),
      laundryMobileAppDownloadUrl: model.laundryMobileAppDownloadUrl || '/web/laundry/mobile-app',
    },
    200,
  );
}

function presentLaundryResult(result = {}) {
  return jsonResponse(
    { ...(result?.body || result || {}) },
    Number.isInteger(result?.status) ? result.status : 200,
  );
}

function presentLaundryFileResult(result = {}) {
  return fileResponse(result);
}

module.exports = { presentLaundryFileResult, presentLaundryResult, presentLaundryView };
