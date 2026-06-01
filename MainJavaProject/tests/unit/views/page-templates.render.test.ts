const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');

const projectRoot = path.resolve(__dirname, '../../..');

async function render(relativePath, data) {
  return ejs.renderFile(path.join(projectRoot, relativePath), data, {
    async: true,
    views: [projectRoot],
    root: projectRoot,
  });
}

test('auth views render shared shell and accessibility primitives', async () => {
  const html = await render('src/modules/web/auth/views/login.ejs', {
    title: 'Sign in',
    csrfToken: 'csrf-token',
  });

  assert.match(html, /Skip to main content/);
  assert.match(html, /id="main-content"/);
  assert.match(html, /data-global-status/);
  assert.doesNotMatch(html, /\[object Promise\]/);
});

test('workspace views render shared shell and CSP-safe page data', async () => {
  const html = await render('src/modules/web/assets/views/assets-page.ejs', {
    title: 'Assets',
    eyebrow: 'Operations',
    intro: 'Intro text',
    highlights: ['Shared shell', 'Reusable partials'],
    migrationNotice: 'Feature module is in place.',
    pageKey: 'assets-page',
    campId: 'camp-1',
    csrfToken: 'csrf-token',
    currentNav: 'Assets',
    horizontalNavItems: [
      { name: 'Main Page', href: '/web/main_page' },
      { name: 'Assets', href: '/web/assets' },
    ],
    totalAssets: 1,
    totalQuantity: '2',
    notFoundAssets: 1,
    completedAssets: 0,
    typeCount: 1,
    allAssets: [
      {
        code: 'A-001',
        name: 'Chair',
        typeName: 'Furniture',
        location: 'Building A / Room 1',
        quantity: '2',
        status: 'New',
        inventoryStatus: 'undiscovered',
        inventoryStatusLabel: 'Not found',
        lastInventoryDate: 'Not recorded',
      },
    ],
    inventoryStatusRows: [
      {
        status: 'undiscovered',
        label: 'Not found',
        assetCount: 1,
        quantity: '2',
        lastInventoryDate: 'Not recorded',
      },
    ],
    assetTypes: [{ name: 'Furniture', assetCount: 1, notFoundCount: 1, completedCount: 0 }],
    inventoryEvents: [],
  });

  assert.match(html, /Skip to main content/);
  assert.match(html, /<template data-page-data>/);
  assert.match(html, /"pageKey":"assets-page"/);
  assert.match(html, /role="tablist" aria-label="Asset sections"/);
  assert.match(html, /data-tab-trigger="all-assets"/);
  assert.match(html, /data-tab-panel="asset-types" role="tabpanel" hidden/);
  assert.match(html, /All assets/);
  assert.doesNotMatch(html, /Assets not found/);
  assert.match(html, /Inventory tracking/);
  assert.doesNotMatch(html, /data-tab-trigger="inventory-activity"/);
  assert.match(html, /Restart inventory/);
  assert.match(html, /Asset types/);
  assert.match(html, /id="main-content"/);
  assert.doesNotMatch(html, /\[object Promise\]/);
});

test('asset type delete buttons render disabled for missing permission or Bed only', async () => {
  const baseData = {
    title: 'Assets',
    eyebrow: 'Operations',
    intro: 'Intro text',
    highlights: [],
    migrationNotice: '',
    pageKey: 'assets-page',
    campId: 'camp-1',
    csrfToken: 'csrf-token',
    currentNav: 'Assets',
    horizontalNavItems: [],
    totalAssets: 1,
    totalQuantity: '1',
    notFoundAssets: 0,
    completedAssets: 0,
    typeCount: 1,
    allAssets: [],
    inventoryStatusRows: [],
    inventoryEvents: [],
    assetTypes: [
      {
        id: 'type-bed',
        name: 'Bed',
        assetCount: 1,
        notFoundCount: 0,
        completedCount: 1,
        isProtected: true,
      },
      {
        id: 'type-chair',
        name: 'Chair',
        assetCount: 1,
        notFoundCount: 1,
        completedCount: 0,
        isProtected: false,
      },
    ],
  };

  const permittedHtml = await render('src/modules/web/assets/views/assets-page.ejs', {
    ...baseData,
    permissionNames: ['Remove asset type'],
  });
  assert.match(
    permittedHtml,
    /class="btn btn-danger js-delete-asset-type"[^>]*data-type-id="type-bed"/,
  );
  assert.match(
    permittedHtml,
    /class="btn btn-danger js-delete-asset-type"[^>]*data-type-id="type-bed"[^>]*disabled/,
  );
  assert.match(
    permittedHtml,
    /class="btn btn-danger js-delete-asset-type"[^>]*data-type-id="type-chair"/,
  );
  assert.doesNotMatch(
    permittedHtml,
    /class="btn btn-danger js-delete-asset-type"[^>]*data-type-id="type-chair"[^>]*disabled/,
  );

  const blockedHtml = await render('src/modules/web/assets/views/assets-page.ejs', baseData);
  assert.match(
    blockedHtml,
    /class="btn btn-danger js-delete-asset-type"[^>]*data-type-id="type-bed"[^>]*disabled/,
  );
  assert.match(
    blockedHtml,
    /class="btn btn-danger js-delete-asset-type"[^>]*data-type-id="type-chair"[^>]*disabled/,
  );
});
