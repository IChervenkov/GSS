const NAV_ITEMS = Object.freeze([
  { key: 'main-page', href: '/web/main-page', name: 'Main Page', always: true },
  { key: 'assets', href: '/web/assets', name: 'Assets', permissions: ['Asset management', 'Assets'] },
  { key: 'laundry', href: '/web/laundry', name: 'Laundry', permission: 'Laundry' },
  {
    key: 'accommodation',
    href: '/web/accommodation',
    name: 'Accommodation and keys',
    permission: 'Accommodation and keys',
  },
  { key: 'bicycles', href: '/web/bicycles', name: 'Bicycles', permission: 'Bicycles' },
  { key: 'logout', href: '/web/logout', name: 'Logout', method: 'post', always: true },
]);

function normalizePermissionRows(rows = []) {
  return rows
    .map((row) => ({ name: String(row?.name || '').trim() }))
    .filter((row) => row.name.length > 0);
}

function buildHorizontalNavItems(userPermissions = [], isAdmin = false) {
  const normalizedPermissions = normalizePermissionRows(userPermissions);
  const permissionNames = new Set(normalizedPermissions.map((permission) => permission.name));
  const hasFullPermission = permissionNames.has('Full permission');

  if (hasFullPermission) {
    return [...NAV_ITEMS];
  }

  return NAV_ITEMS.filter(
    (item) => item.always || (((Array.isArray(item.permissions) && item.permissions.some((permission) => permissionNames.has(permission))) || (item.permission && permissionNames.has(item.permission)))),
  );
}

module.exports = {
  NAV_ITEMS,
  normalizePermissionRows,
  buildHorizontalNavItems,
};
