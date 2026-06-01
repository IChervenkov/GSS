import { createRequestClient } from '/assets/shared/js/core/request-client.ts';
import { bindForcedSignOut } from '/assets/shared/js/core/socket-client.ts';

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

const NAV_ICON_BY_NAME = Object.freeze({
  'main page': 'icon-house-door',
  assets: 'icon-box',
  laundry: 'icon-water',
  'accommodation and keys': 'icon-key',
  bicycles: 'icon-bicycle',
  logout: 'icon-box-arrow-right',
});

const CURRENT_PAGE_PERMISSION_BY_NAV = Object.freeze({
  assets: ['Asset management', 'Assets'],
  laundry: 'Laundry',
  'accommodation and keys': 'Accommodation and keys',
  bicycles: 'Bicycles',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function normalizePermissionsPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.permissions)) return payload.permissions;
  if (payload.permissions && Array.isArray(payload.permissions.rows)) {
    return payload.permissions.rows;
  }
  return [];
}

function buildHorizontalNavItems(permissionNames = new Set(), isAdmin = false) {
  if (permissionNames.has('Full permission')) {
    return [...NAV_ITEMS];
  }

  return NAV_ITEMS.filter(
    (item) => item.always || (((Array.isArray(item.permissions) && item.permissions.some((permission) => permissionNames.has(permission))) || (item.permission && permissionNames.has(item.permission)))),
  );
}

function getCsrfToken(pageData = {}) {
  return document.querySelector('#csrf-token')?.value || pageData.csrfToken || '';
}

function getCurrentNavName() {
  return String(document.querySelector('[data-workspace-nav]')?.dataset.currentNav || '').toLowerCase();
}

function resolveCurrentPagePermission() {
  return CURRENT_PAGE_PERMISSION_BY_NAV[getCurrentNavName()] || null;
}

function hasAccessToCurrentPage(permissionNames = new Set()) {
  const requiredPermission = resolveCurrentPagePermission();
  if (!requiredPermission) return true;
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  return (
    permissionNames.has('Full permission') ||
    requiredPermissions.some((permissionName) => permissionNames.has(permissionName))
  );
}

function dispatchPermissionsRefreshed(permissionNames) {
  document.dispatchEvent(
    new CustomEvent('workspace:permissions:refreshed', {
      detail: {
        permissionNames: [...permissionNames],
        currentPagePermission: resolveCurrentPagePermission(),
      },
    }),
  );
}

function redirectIfCurrentPageAccessWasRevoked(permissionNames) {
  if (hasAccessToCurrentPage(permissionNames)) return;
  window.location.assign('/web/main-page');
}

function renderWorkspaceNavigation({ permissionNames, csrfToken = '', isAdmin = false } = {}) {
  const nav = document.querySelector('[data-workspace-nav]');
  if (!nav) return;

  const navItems = buildHorizontalNavItems(permissionNames, isAdmin);
  const currentNav = String(nav.dataset.currentNav || '').toLowerCase();
  const csrfValue = escapeAttr(csrfToken);

  nav.innerHTML = navItems
    .map((item) => {
      const normalizedName = String(item.name || '').toLowerCase();
      const currentClass = normalizedName === currentNav ? ' is-current' : '';
      const iconId = NAV_ICON_BY_NAME[normalizedName] || 'icon-house-door';

      if (String(item.method || 'get').toLowerCase() === 'post') {
        return `
          <form class="nav-pill-form" action="${escapeAttr(item.href)}" method="post">
            <input type="hidden" name="_csrf" value="${csrfValue}">
            <button class="nav-pill${currentClass}" type="submit">
              <svg class="icon" aria-hidden="true"><use href="#${escapeAttr(iconId)}"></use></svg>
              <span>${escapeHtml(item.name)}</span>
            </button>
          </form>
        `;
      }

      return `
        <a class="nav-pill${currentClass}" href="${escapeAttr(item.href)}">
          <svg class="icon" aria-hidden="true"><use href="#${escapeAttr(iconId)}"></use></svg>
          <span>${escapeHtml(item.name)}</span>
        </a>
      `;
    })
    .join('');
}

export function createWorkspacePermissionAccessRefresh({
  socket = null,
  pageData = {},
  isAdmin = false,
} = {}) {
  const client = createRequestClient();
  let refreshInFlight = null;

  async function refreshNavigation() {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = client
      .getJson('/web/permission/current-user')
      .then((result) => {
        if (!result.ok) return null;

        const permissions = normalizePermissionsPayload(result.data || result.body || {});
        const permissionNames = new Set(permissions.map((item) => item.name).filter(Boolean));
        renderWorkspaceNavigation({
          permissionNames,
          csrfToken: getCsrfToken(pageData),
          isAdmin,
        });
        dispatchPermissionsRefreshed(permissionNames);
        redirectIfCurrentPageAccessWasRevoked(permissionNames);
        return permissionNames;
      })
      .finally(() => {
        refreshInFlight = null;
      });

    return refreshInFlight;
  }

  function bind() {
    if (!socket) return;
    const handlePermissionRefresh = () => {
      void refreshNavigation();
    };

    socket.on('permission:access:changed', handlePermissionRefresh);
    socket.on('permission:access:updated', handlePermissionRefresh);
    socket.on('permission:self:refresh', handlePermissionRefresh);
    socket.on('permission:self:refreshed', handlePermissionRefresh);
  }

  return {
    bind,
    refreshNavigation,
  };
}

export function initWorkspacePermissionAccessRefresh({ pageData = {}, isAdmin = false } = {}) {
  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const accessRefresh = createWorkspacePermissionAccessRefresh({ socket, pageData, isAdmin });
  accessRefresh.bind();
  return accessRefresh;
}
