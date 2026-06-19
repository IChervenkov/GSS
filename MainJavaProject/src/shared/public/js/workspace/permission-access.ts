import { createRequestClient } from '/assets/shared/js/core/request-client.ts';
import { bindForcedSignOut } from '/assets/shared/js/core/socket-client.ts';

declare global {
  interface Window {
    io?: (...args: any[]) => any;
  }
}

type PermissionRow = {
  name?: string;
};

type PermissionAccessPageData = {
  csrfToken?: string;
  campId?: string;
  currentCampId?: string | (() => string);
};

type WorkspacePermissionRenderOptions = {
  permissionNames?: Set<string>;
  csrfToken?: string;
  isAdmin?: boolean;
};

type WorkspacePermissionRefreshOptions = {
  socket?: any;
  pageData?: PermissionAccessPageData;
  isAdmin?: boolean;
};

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

function normalizePermissionsPayload(payload: any): PermissionRow[] {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.permissions)) return payload.permissions;
  if (payload.permissions && Array.isArray(payload.permissions.rows)) {
    return payload.permissions.rows;
  }
  return [];
}

function buildHorizontalNavItems(permissionNames = new Set<string>(), isAdmin = false) {
  if (permissionNames.has('Full permission')) {
    return [...NAV_ITEMS];
  }

  return NAV_ITEMS.filter(
    (item) => item.always || (((Array.isArray(item.permissions) && item.permissions.some((permission) => permissionNames.has(permission))) || (item.permission && permissionNames.has(item.permission)))),
  );
}

function getCsrfToken(pageData: PermissionAccessPageData = {}) {
  return document.querySelector<HTMLInputElement>('#csrf-token')?.value || pageData.csrfToken || '';
}

function getCurrentCampId(pageData: PermissionAccessPageData = {}) {
  const dynamicCampId =
    typeof pageData.currentCampId === 'function'
      ? pageData.currentCampId()
      : pageData.currentCampId;
  return String(
    dynamicCampId || pageData.campId || document.body?.dataset?.currentCampId || '',
  ).trim();
}

function setCurrentCampContext(pageData: PermissionAccessPageData = {}, campId = '', campName = '') {
  pageData.campId = campId;
  if (typeof pageData.currentCampId !== 'function') {
    pageData.currentCampId = campId;
  }
  if (document.body) {
    document.body.dataset.currentCampId = campId;
    document.body.dataset.currentCampName = campName;
  }
}

function dispatchCampAccessRefreshed(detail = {}) {
  document.dispatchEvent(new CustomEvent('workspace:camp-access:refreshed', { detail }));
}

function dispatchCampContextChanged(campId = '', campName = '') {
  document.dispatchEvent(
    new CustomEvent('gss:camp-context-changed', {
      detail: { campId, campName },
    }),
  );
}

function getCurrentNavName() {
  return String(
    document.querySelector<HTMLElement>('[data-workspace-nav]')?.dataset.currentNav || '',
  ).toLowerCase();
}

function resolveCurrentPagePermission() {
  return CURRENT_PAGE_PERMISSION_BY_NAV[getCurrentNavName()] || null;
}

function hasAccessToCurrentPage(permissionNames = new Set<string>()) {
  const requiredPermission = resolveCurrentPagePermission();
  if (!requiredPermission) return true;
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  return (
    permissionNames.has('Full permission') ||
    requiredPermissions.some((permissionName) => permissionNames.has(permissionName))
  );
}

function dispatchPermissionsRefreshed(permissionNames: Set<string>) {
  document.dispatchEvent(
    new CustomEvent('workspace:permissions:refreshed', {
      detail: {
        permissionNames: [...permissionNames],
        currentPagePermission: resolveCurrentPagePermission(),
      },
    }),
  );
}

function redirectIfCurrentPageAccessWasRevoked(permissionNames: Set<string>) {
  if (hasAccessToCurrentPage(permissionNames)) return;
  window.location.assign('/web/main-page');
}

function renderWorkspaceNavigation({
  permissionNames = new Set<string>(),
  csrfToken = '',
  isAdmin = false,
}: WorkspacePermissionRenderOptions = {}) {
  const nav = document.querySelector<HTMLElement>('[data-workspace-nav]');
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
}: WorkspacePermissionRefreshOptions = {}) {
  const client = createRequestClient();
  let refreshInFlight = null;
  let campRefreshInFlight = null;

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
    const handleCampAccessRefresh = () => {
      void refreshCampAccess();
    };

    socket.on('permission:access:changed', handlePermissionRefresh);
    socket.on('permission:access:updated', handlePermissionRefresh);
    socket.on('permission:self:refresh', handlePermissionRefresh);
    socket.on('permission:self:refreshed', handlePermissionRefresh);
    socket.on('camp:access:self:refresh', handleCampAccessRefresh);
    socket.on('camp:access:self:refreshed', handleCampAccessRefresh);
  }

  async function refreshCampAccess() {
    if (campRefreshInFlight) return campRefreshInFlight;

    const currentCampId = getCurrentCampId(pageData);
    if (!currentCampId) {
      dispatchCampAccessRefreshed({ currentCampId: '', hasAccess: false, revoked: false });
      return null;
    }

    campRefreshInFlight = client
      .getJson('/web/camp/data', {
        query: {
          page: 1,
          limit: 1,
          searchColumn: 'id',
          searchValue: currentCampId,
        },
      })
      .then(async (result) => {
        if (!result.ok) return null;

        const camps = Array.isArray(result.data?.camps) ? result.data.camps : [];
        const camp = camps.find((item) => String(item.id) === String(currentCampId)) || null;
        if (camp && camp.canAccess !== false) {
          setCurrentCampContext(pageData, camp.id || currentCampId, camp.name || '');
          dispatchCampAccessRefreshed({
            currentCampId,
            campId: camp.id || currentCampId,
            campName: camp.name || '',
            hasAccess: true,
            revoked: false,
          });
          return { hasAccess: true, camp };
        }

        await client.postJson('/web/camp/set', {
          csrfToken: getCsrfToken(pageData),
          body: { campId: '' },
        });
        setCurrentCampContext(pageData, '', '');
        dispatchCampContextChanged('', '');
        dispatchCampAccessRefreshed({
          previousCampId: currentCampId,
          currentCampId: '',
          campId: '',
          campName: '',
          hasAccess: false,
          revoked: true,
        });
        return { hasAccess: false, revoked: true };
      })
      .finally(() => {
        campRefreshInFlight = null;
      });

    return campRefreshInFlight;
  }

  return {
    bind,
    refreshCampAccess,
    refreshNavigation,
  };
}

export function initWorkspacePermissionAccessRefresh({
  pageData = {},
  isAdmin = false,
}: Omit<WorkspacePermissionRefreshOptions, 'socket'> = {}) {
  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const accessRefresh = createWorkspacePermissionAccessRefresh({ socket, pageData, isAdmin });
  accessRefresh.bind();
  return accessRefresh;
}
