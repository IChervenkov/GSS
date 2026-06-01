const ASSETS_PAGE = Object.freeze({
  pageKey: 'assets-page',
  permissionName: 'Asset management',
  legacyPermissionName: 'Assets',
  currentNav: 'Assets',
  title: 'Assets',
  eyebrow: 'Asset desk',
  intro:
    'Review all tracked assets, inventory coverage, activity, and asset type totals for the selected camp.',
  highlights: ['All assets', 'Inventory tracking', 'Asset types'],
});

const ASSETS_PERMISSIONS = Object.freeze({
  full: 'Full permission',
  section: ASSETS_PAGE.permissionName,
  legacySection: ASSETS_PAGE.legacyPermissionName,
  pageAccess: Object.freeze([ASSETS_PAGE.permissionName, ASSETS_PAGE.legacyPermissionName]),
  addAsset: 'Add asset',
  editAsset: 'Edit asset',
  deleteAsset: 'Remove asset',
  saveInventory: 'Save inventory',
  addAssetType: 'Add asset type',
  editAssetType: 'Edit asset type',
  deleteAssetType: 'Remove asset type',
  addCleanItem: 'Add clean item',
  editCleanItem: 'Edit clean item',
  moveCleanItem: 'Move clean item',
  deleteCleanItem: 'Remove clean item',
  downloadAssetsApp: 'Download assets app',
});

module.exports = { ASSETS_PAGE, ASSETS_PERMISSIONS };
