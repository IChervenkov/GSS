const {
  fileResponse,
  jsonResponse,
  renderResponse,
} = require('../../../../shared/http/response-contract');

function presentAssetsView(model = {}) {
  return renderResponse(
    'assets-page',
    {
      title: model.title || 'Assets',
      pageKey: model.pageKey || 'assets-page',
      currentNav: model.currentNav || 'Assets',
      eyebrow: model.eyebrow || 'Asset desk',
      intro: model.intro || '',
      highlights: Array.isArray(model.highlights) ? model.highlights : [],
      horizontalNavItems: Array.isArray(model.horizontalNavItems) ? model.horizontalNavItems : [],
      campId: model.campId || null,
      csrfToken: model.csrfToken || '',
      campRequired: Boolean(model.campRequired),
      permissionNames: Array.isArray(model.permissionNames) ? model.permissionNames : [],
      canDownloadAssetsMobileApp: Boolean(model.canDownloadAssetsMobileApp),
      assetsMobileAppDownloadUrl: model.assetsMobileAppDownloadUrl || '/web/assets/mobile-app',
      totalAssets: Number(model.totalAssets) || 0,
      totalQuantity: model.totalQuantity || '0',
      notFoundAssets: Number(model.notFoundAssets) || 0,
      completedAssets: Number(model.completedAssets) || 0,
      typeCount: Number(model.typeCount) || 0,
      allAssets: Array.isArray(model.allAssets) ? model.allAssets : [],
      notFoundRows: Array.isArray(model.notFoundRows) ? model.notFoundRows : [],
      inventoryStatusRows: Array.isArray(model.inventoryStatusRows)
        ? model.inventoryStatusRows
        : [],
      assetTypes: Array.isArray(model.assetTypes) ? model.assetTypes : [],
      inventoryEvents: Array.isArray(model.inventoryEvents) ? model.inventoryEvents : [],
      cleanItems: Array.isArray(model.cleanItems) ? model.cleanItems : [],
      cleanItemSummary:
        model.cleanItemSummary && typeof model.cleanItemSummary === 'object'
          ? model.cleanItemSummary
          : {},
      tables: model.tables && typeof model.tables === 'object' ? model.tables : {},
    },
    200,
  );
}

function presentAssetsResult(result = {}) {
  return jsonResponse(
    { ...(result?.body || result || {}) },
    Number.isInteger(result?.status) ? result.status : 200,
  );
}

function presentAssetsFileResult(result = {}) {
  return fileResponse(result);
}

module.exports = { presentAssetsFileResult, presentAssetsResult, presentAssetsView };
