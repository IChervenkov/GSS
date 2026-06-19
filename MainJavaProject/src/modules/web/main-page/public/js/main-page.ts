// @ts-nocheck
import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import { byId, debounce, safeRedirect, setProgressValue } from '/assets/shared/js/core/dom.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { createModalController } from '/assets/shared/js/ui/modal.ts';
import {
  bindForcedSignOut,
  createSocketRoomManager,
} from '/assets/shared/js/core/socket-client.ts';
import { confirmAction, initConfirmModal } from '/assets/shared/js/core/confirm.ts';
import { createMainPageApi } from '/assets/main/js/main-page.api.ts';
import {
  bindLateBicycleToast,
  bindUpcomingAccommodationToasts,
  createToastManager,
  initWorkspacePage,
  syncTabPanels,
} from '/assets/shared/js/workspace/page-shell.ts';

function normalizePermissionsPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.permissions)) return payload.permissions;
  if (payload.permissions && Array.isArray(payload.permissions.rows))
    return payload.permissions.rows;
  return [];
}

function getNextSortDirection(currentDirection = 'default') {
  if (currentDirection === 'default') return 'asc';
  if (currentDirection === 'asc') return 'desc';
  return 'default';
}

function appendSearchFilters(query, filters = {}) {
  const searchColumns = [];
  const searchValues = [];

  Object.entries(filters).forEach(([column, value]) => {
    const searchValue = String(value || '').trim();
    if (!searchValue) return;
    searchColumns.push(column);
    searchValues.push(searchValue);
  });

  if (searchColumns.length > 0) {
    query.searchColumn = searchColumns;
    query.searchValue = searchValues;
  }

  return query;
}

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

const MAIN_PERMISSION_NAMES = Object.freeze({
  full: 'Full permission',
  system: 'Admin permission',
  addCamp: 'Add camp',
  editCamp: 'Edit camp',
  deleteCamp: 'Delete camp',
});

const USER_MESSAGE_TYPE_OPTIONS = Object.freeze([
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'issue', label: 'Issue' },
  { id: 'message', label: 'Message' },
  { id: 'other', label: 'Other' },
]);

function buildHorizontalNavItems(permissionNames = new Set(), isAdmin = false) {
  if (permissionNames.has(MAIN_PERMISSION_NAMES.full)) {
    return [...NAV_ITEMS];
  }

  return NAV_ITEMS.filter(
    (item) => item.always || (((Array.isArray(item.permissions) && item.permissions.some((permission) => permissionNames.has(permission))) || (item.permission && permissionNames.has(item.permission)))),
  );
}

bootstrapPage(() => {
  initWorkspacePage();
  initConfirmModal();

  const root = byId('main-page-root');
  const csrfToken = byId('csrf-token')?.value || '';
  const api = createMainPageApi({ csrfToken });
  const toast = createToastManager(byId('toast-stack'));
  const pageState = createPageStateController({
    root,
    disableTargets: [
      byId('refresh-camps-button'),
      byId('refresh-users-button'),
      byId('refresh-permissions-button'),
      byId('refresh-camp-access-button'),
      byId('refresh-admin-inbox-button'),
    ],
  });
  const currentUserPermissionsScope = createRequestScope();
  const campsLoadScope = createRequestScope();
  const usersLoadScope = createRequestScope();
  const permissionsLoadScope = createRequestScope();
  const campAccessLoadScope = createRequestScope();
  const adminInboxLoadScope = createRequestScope();

  const pageDataset = root?.dataset || document.body?.dataset || {};

  const state = {
    currentCampId: pageDataset.currentCampId || '',
    currentCampName: pageDataset.currentCampName || '',
    isAdmin: pageDataset.isAdmin === 'true',
    currentUserPermissions: new Set(),
    camps: [],
    campTable: {
      page: 1,
      totalPages: 1,
      filters: {
        name: '',
        id: '',
      },
      limit: 10,
      total: 0,
      sortColumn: null,
      sortDirection: 'default',
    },
    campImport: {
      fileName: '',
      uploadPercent: 0,
      processingPercent: 0,
      statusMessage: 'Download the template to begin.',
      summary: null,
      errors: [],
      isBusy: false,
      visible: false,
    },
    users: {
      page: 1,
      totalPages: 1,
      filters: {
        username: '',
        account: '',
      },
      rows: [],
      sortColumn: null,
      sortDirection: 'default',
    },
    permissions: {
      page: 1,
      totalPages: 1,
      searchValue: '',
      sortColumn: null,
      sortDirection: 'default',
      users: [],
      permissions: [],
      userPermissions: [],
      pending: new Set(),
    },
    campAccess: {
      page: 1,
      totalPages: 1,
      searchValue: '',
      sortColumn: null,
      sortDirection: 'default',
      users: [],
      camps: [],
      userCampAccess: [],
      pending: new Set(),
    },
    adminInbox: {
      page: 1,
      totalPages: 1,
      filters: {
        type: '',
        username: '',
        subject: '',
        status: '',
        createdAt: '',
      },
      sortColumn: null,
      sortDirection: 'default',
      items: [],
    },
    activeTab: 'overview',
  };

  const tabButtons = Array.from(document.querySelectorAll('[data-tab-trigger]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));

  const bulkCampImportModal = createModalController({
    root: byId('bulk-camp-import-modal'),
    dialog: byId('bulk-camp-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => clearBulkCampImportModal(),
  });
  const addCampModal = createModalController({
    root: byId('add-camp-modal'),
    dialog: byId('add-camp-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const editCampModal = createModalController({
    root: byId('edit-camp-modal'),
    dialog: byId('edit-camp-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const userModal = createModalController({
    root: byId('user-modal'),
    dialog: byId('user-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const tempPasswordModal = createModalController({
    root: byId('temp-password-modal'),
    dialog: byId('temp-password-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });

  const addCampModalState = createPageStateController({
    root: byId('add-camp-modal'),
    disableTargets: [byId('add-camp-name-input')],
  });
  const editCampModalState = createPageStateController({
    root: byId('edit-camp-modal'),
    disableTargets: [byId('edit-camp-name-input')],
  });
  const userModalState = createPageStateController({
    root: byId('user-modal'),
    disableTargets: [byId('user-name-input'), byId('user-password-input')],
  });
  const tempPasswordModalState = createPageStateController({
    root: byId('temp-password-modal'),
    disableTargets: [byId('copy-temp-password-button')],
  });

  function showMissingInformation(_stateController, message, focusId) {
    toast.show({
      title: 'Missing information',
      message,
      variant: 'warning',
    });
    const field = byId(focusId);
    if (field && typeof field.focus === 'function') field.focus();
  }

  function hasPermission(name) {
    return (
      state.currentUserPermissions.has(name) ||
      state.currentUserPermissions.has(MAIN_PERMISSION_NAMES.full)
    );
  }

  function canAddCamps() {
    return hasPermission(MAIN_PERMISSION_NAMES.addCamp);
  }

  function canEditCamps() {
    return hasPermission(MAIN_PERMISSION_NAMES.editCamp);
  }

  function canDeleteCamps() {
    return hasPermission(MAIN_PERMISSION_NAMES.deleteCamp);
  }

  function canImportCamps() {
    return canAddCamps() || canEditCamps();
  }

  function canAccessSystemManagement() {
    return state.currentUserPermissions.has(MAIN_PERMISSION_NAMES.system);
  }

  function setDisabled(element, disabled) {
    if (!element || !('disabled' in element)) return;
    element.disabled = Boolean(disabled);
  }

  function setDisabledById(id, disabled) {
    setDisabled(byId(id), disabled);
  }

  function setDisabledBySelector(selector, disabled) {
    document.querySelectorAll(selector).forEach((element) => setDisabled(element, disabled));
  }

  function setFormActionDisabled(formId, disabled) {
    const form = byId(formId);
    if (!form) return;
    form
      .querySelectorAll('input, select, textarea, button[type="submit"]')
      .forEach((element) => setDisabled(element, disabled));
  }

  function markPanelAccess(tab, canAccess) {
    const panel = document.querySelector(`[data-tab-panel="${tab}"]`);
    if (!panel) return;
    panel.dataset.permissionLocked = canAccess ? 'false' : 'true';
    panel.setAttribute('aria-disabled', canAccess ? 'false' : 'true');
  }

  function canAccessTab(tab) {
    if (tab === 'admin') {
      return canAccessSystemManagement();
    }
    return true;
  }

  function updateSystemManagementVisibility() {
    const canAccess = canAccessSystemManagement();
    const gatedSelectors = ['[data-tab-trigger="admin"]'];

    gatedSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if ('disabled' in element) {
          element.disabled = !canAccess;
        }
      });
    });

    markPanelAccess('admin', canAccess);
    setDisabledById('refresh-users-button', !canAccess);
    setDisabledById('open-add-user-modal', !canAccess);
    setDisabledBySelector('[data-main-search-table="users"]', !canAccess);
    setDisabledBySelector('[data-main-sort-table="users"]', !canAccess);
    setDisabledById('users-prev-button', !canAccess || state.users.page <= 1);
    setDisabledById('users-next-button', !canAccess || state.users.page >= state.users.totalPages);
    setDisabledById('refresh-permissions-button', !canAccess);
    setDisabledById('permission-search-input', !canAccess);
    setDisabledBySelector('[data-main-sort-table="permissions"]', !canAccess);
    setDisabledById('refresh-camp-access-button', !canAccess);
    setDisabledById('camp-access-search-input', !canAccess);
    setDisabledBySelector('[data-main-sort-table="campAccess"]', !canAccess);
    setDisabledById('camp-access-prev-button', !canAccess || state.campAccess.page <= 1);
    setDisabledById(
      'camp-access-next-button',
      !canAccess || state.campAccess.page >= state.campAccess.totalPages,
    );
    setDisabledById('refresh-admin-inbox-button', !canAccess);
    setDisabledBySelector('[data-main-search-table="adminInbox"]', !canAccess);
    setDisabledBySelector('[data-main-sort-table="adminInbox"]', !canAccess);
    setDisabledById('admin-inbox-prev-button', !canAccess || state.adminInbox.page <= 1);
    setDisabledById(
      'admin-inbox-next-button',
      !canAccess || state.adminInbox.page >= state.adminInbox.totalPages,
    );
    setDisabledById('permissions-prev-button', !canAccess || state.permissions.page <= 1);
    setDisabledById(
      'permissions-next-button',
      !canAccess || state.permissions.page >= state.permissions.totalPages,
    );
    setDisabledBySelector(
      '.js-edit-user, .js-toggle-user-lock, .js-delete-user, .js-resolve-user-request, .js-update-user-message, .js-delete-admin-inbox-item',
      !canAccess,
    );
    if (!canAccess) setDisabledBySelector('.js-permission-toggle', true);
    if (!canAccess) setDisabledBySelector('.js-camp-access-toggle', true);
    setFormActionDisabled('user-form', !canAccess);
    setDisabledById('copy-temp-password-button', !canAccess);

    if (!canAccess) {
      usersLoadScope.abort();
      permissionsLoadScope.abort();
      adminInboxLoadScope.abort();
      state.permissions.pending.clear();
      campAccessLoadScope.abort();
      state.campAccess.pending.clear();
      renderPermissionBanner();
      renderCampAccessBanner();
      clearUserRequestExpiryTimer();
    }

    if (!canAccessTab(state.activeTab)) {
      setActiveTab('overview');
    }
  }

  function setActiveTab(tab) {
    if (!canAccessTab(tab)) {
      tab = 'overview';
    }

    state.activeTab = tab;
    syncTabPanels({ activeTab: tab, tabButtons, tabPanels });

    if (tab === 'camps') loadCamps();
    if (tab === 'admin') {
      loadAdminInbox();
      loadUsers();
      loadPermissions();
      loadCampAccess();
    }
    void syncSocketSubscriptions();
  }

  function notifyCampContextChanged() {
    document.dispatchEvent(
      new CustomEvent('gss:camp-context-changed', {
        detail: { campId: state.currentCampId || '', campName: state.currentCampName || '' },
      }),
    );
  }

  function updateSummaries() {
    const campLabel = state.currentCampName || state.currentCampId || '';
    byId('camp-summary-value').textContent = campLabel || 'Not selected';
    byId('current-camp-chip').textContent = campLabel || 'No camp selected';
    byId('camp-summary-value').title = campLabel;
    if (root) {
      root.dataset.currentCampId = state.currentCampId || '';
      root.dataset.currentCampName = state.currentCampName || '';
    }
    if (document.body) {
      document.body.dataset.currentCampId = state.currentCampId || '';
      document.body.dataset.currentCampName = state.currentCampName || '';
    }
    byId('permission-summary-value').textContent = String(state.currentUserPermissions.size);
    const permissionHeroCount = byId('permission-hero-count');
    if (permissionHeroCount) {
      const count = state.currentUserPermissions.size;
      permissionHeroCount.textContent = `${count} permission${count === 1 ? '' : 's'}`;
    }
  }

  function clearCurrentCampSelection() {
    state.currentCampId = '';
    state.currentCampName = '';
    updateSummaries();
  }

  async function clearCurrentCampSelectionAndPersist() {
    const previousCampId = state.currentCampId;
    clearCurrentCampSelection();
    renderCamps();
    notifyCampContextChanged();
    if (previousCampId) {
      await api.setCamp('');
    }
  }

  function renderCurrentUserNavigation() {
    const navItems = buildHorizontalNavItems(state.currentUserPermissions, state.isAdmin);
    const nav = document.querySelector('[data-workspace-nav]');
    const currentNav = String(nav?.dataset.currentNav || '').toLowerCase();
    const csrfValue = escapeAttr(csrfToken);

    if (nav) {
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

    const activeModules = byId('current-user-nav-list');
    if (!activeModules) return;
    activeModules.innerHTML = navItems
      .map((item) => `<span class="token">${escapeHtml(item.name)}</span>`)
      .join('');
  }

  function renderCurrentUserPermissionList() {
    const container = byId('current-user-permission-list');
    if (!container) return;

    const permissionNames = [...state.currentUserPermissions].sort((left, right) =>
      left.localeCompare(right),
    );

    if (!permissionNames.length) {
      container.innerHTML = '<span class="token token--soft">No permissions granted</span>';
      return;
    }

    container.innerHTML = permissionNames
      .map((name) => `<span class="token token--soft">${escapeHtml(name)}</span>`)
      .join('');
  }

  function showRequestFailureToast(result) {
    toast.show({
      title: 'Request failed',
      message: result?.message || 'The request could not be completed.',
      variant: 'danger',
    });
  }

  function handleResult(result, successMessage = '') {
    if (result?.ok) {
      if (successMessage) pageState.set('success', successMessage);
      return true;
    }

    pageState.set(
      result?.pageState || 'error',
      result?.message || 'The request could not be completed.',
    );
    toast.show({
      title: 'Request failed',
      message: result?.message || 'The request could not be completed.',
      variant: 'danger',
    });
    return false;
  }

  function createUserMessageTypeLookup() {
    const input = byId('user-message-type-input');
    const hiddenInput = byId('user-message-type-value');
    const listbox = byId('user-message-type-options');
    const root = input?.closest('[data-user-message-type-combobox]');
    const lookupState = { options: [], activeIndex: -1 };

    if (!input || !hiddenInput || !listbox || !root) {
      return {
        clear() {},
        getValue() {
          return '';
        },
      };
    }

    function setActiveIndex(index) {
      lookupState.activeIndex = index;
      Array.from(listbox.querySelectorAll('[data-lookup-option]')).forEach((option) => {
        const active = Number(option.dataset.index) === index;
        option.classList.toggle('is-active', active);
        option.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      if (index >= 0) {
        input.setAttribute('aria-activedescendant', `user-message-type-options-option-${index}`);
        byId(`user-message-type-options-option-${index}`)?.scrollIntoView({ block: 'nearest' });
        return;
      }

      input.removeAttribute('aria-activedescendant');
    }

    function setOpen(open) {
      const nextOpen = Boolean(open && !input.disabled);
      listbox.hidden = !nextOpen;
      input.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      root.classList.toggle('is-open', nextOpen);
      if (!nextOpen) setActiveIndex(-1);
    }

    function renderOptions(search = '', { open = true } = {}) {
      const query = String(search || '').trim().toLowerCase();
      lookupState.options = USER_MESSAGE_TYPE_OPTIONS.filter((option) =>
        option.label.toLowerCase().includes(query),
      ).map((option, index) => ({ ...option, index }));

      if (!lookupState.options.length) {
        listbox.innerHTML = `
          <div class="lookup-option lookup-option--status" role="option" aria-disabled="true">
            <span class="lookup-option__title">No message types match that search.</span>
          </div>
        `;
        setOpen(open);
        return;
      }

      listbox.innerHTML = lookupState.options
        .map(
          (option) => `
            <div
              class="lookup-option"
              id="${escapeAttr(`user-message-type-options-option-${option.index}`)}"
              role="option"
              aria-selected="false"
              data-lookup-option="true"
              data-index="${escapeAttr(option.index)}"
            >
              <span class="lookup-option__title">${escapeHtml(option.label)}</span>
            </div>
          `,
        )
        .join('');
      setOpen(open);
      setActiveIndex(-1);
    }

    function selectOption(index) {
      const option = lookupState.options[index];
      if (!option) return;
      input.value = option.label;
      hiddenInput.value = option.id;
      setOpen(false);
      input.focus();
    }

    function syncExactMatch() {
      const query = String(input.value || '').trim().toLowerCase();
      const matched = USER_MESSAGE_TYPE_OPTIONS.find(
        (option) => option.label.toLowerCase() === query || option.id === query,
      );
      if (!matched) return '';
      input.value = matched.label;
      hiddenInput.value = matched.id;
      return matched.id;
    }

    const debouncedRender = debounce(() => renderOptions(input.value), 120);

    input.addEventListener('focus', () => renderOptions(input.value));
    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!root.contains(document.activeElement)) setOpen(false);
      }, 0);
    });
    input.addEventListener('input', () => {
      hiddenInput.value = '';
      debouncedRender();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (listbox.hidden) renderOptions(input.value);
        if (!lookupState.options.length) return;
        setActiveIndex(
          lookupState.activeIndex < lookupState.options.length - 1
            ? lookupState.activeIndex + 1
            : 0,
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (listbox.hidden) renderOptions(input.value);
        if (!lookupState.options.length) return;
        setActiveIndex(
          lookupState.activeIndex > 0
            ? lookupState.activeIndex - 1
            : lookupState.options.length - 1,
        );
        return;
      }

      if (event.key === 'Enter' && !listbox.hidden && lookupState.activeIndex >= 0) {
        event.preventDefault();
        selectOption(lookupState.activeIndex);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    });

    listbox.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    listbox.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const option = target.closest('[data-lookup-option]');
      if (!(option instanceof HTMLElement)) return;
      selectOption(Number(option.dataset.index));
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
    });

    return {
      clear() {
        input.value = '';
        hiddenInput.value = '';
        lookupState.options = [];
        listbox.innerHTML = '';
        setOpen(false);
      },
      getValue() {
        return hiddenInput.value || syncExactMatch();
      },
    };
  }

  const userMessageTypeLookup = createUserMessageTypeLookup();

  async function loadCurrentUserPermissions() {
    const request = currentUserPermissionsScope.next();
    const result = await api.getCurrentUserPermissions(request.signal);
    if (result.aborted || !currentUserPermissionsScope.isCurrent(request.token)) return;
    if (!result.ok) {
      handleResult(result);
      return;
    }

    const permissions = normalizePermissionsPayload(result.data || result.body || {});
    state.currentUserPermissions = new Set(permissions.map((item) => item.name).filter(Boolean));
    updateSummaries();
    renderCurrentUserNavigation();
    renderCurrentUserPermissionList();
    updateControlVisibility();
    await syncSocketSubscriptions();
    refreshPermissionDrivenViews();
  }

  function refreshPermissionDrivenViews() {
    if (state.activeTab === 'camps') {
      renderCamps();
      return;
    }

    if (state.activeTab === 'admin') {
      renderAdminInbox();
      renderUsers();
      renderPermissions();
      renderCampAccess();
    }
  }

  function updateControlVisibility() {
    const canAddCamp = canAddCamps();
    const canEditCamp = canEditCamps();
    const canDeleteCamp = canDeleteCamps();
    const canImportCampRows = canImportCamps();

    setDisabledById('open-add-camp-modal', !canAddCamp);
    setDisabledById('open-bulk-camp-import-modal', !canImportCampRows);
    setDisabledById('download-camp-template-button', !canImportCampRows);
    setDisabledById('camp-template-file-input', !canImportCampRows);
    setDisabledById('upload-camp-template-button', !canImportCampRows || state.campImport.isBusy);
    setDisabledBySelector('.js-edit-camp', !canEditCamp);
    setDisabledBySelector('.js-delete-camp', !canDeleteCamp);
    setFormActionDisabled('add-camp-form', !canAddCamp);
    setFormActionDisabled('edit-camp-form', !canEditCamp);
    updateSystemManagementVisibility();
  }

  function renderCampImportSummary(summary) {
    const summaryNode = byId('camp-import-summary');
    if (!summaryNode) return;
    if (!summary) {
      summaryNode.innerHTML = '';
      return;
    }

    summaryNode.innerHTML = [
      { value: summary.addedCount || 0, label: 'Added' },
      { value: summary.updatedCount || 0, label: 'Updated' },
      { value: summary.skippedCount || 0, label: 'Skipped' },
      { value: summary.errorCount || 0, label: 'Errors' },
    ]
      .map(
        (item) => `
          <div class="camp-import-summary-item">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `,
      )
      .join('');
  }

  function renderCampImportErrors(errors = []) {
    const errorsNode = byId('camp-import-errors');
    if (!errorsNode) return;
    if (!errors.length) {
      errorsNode.hidden = true;
      errorsNode.innerHTML = '';
      return;
    }

    errorsNode.hidden = false;
    errorsNode.innerHTML = errors
      .map(
        (error) =>
          `<div>Row ${escapeHtml(error.rowNumber)}: ${escapeHtml(error.message || 'The row could not be processed.')}</div>`,
      )
      .join('');
  }

  function renderCampImportProgress() {
    const panel = byId('camp-import-progress-panel');
    if (!panel) return;

    panel.hidden = !state.campImport.visible;
    byId('camp-template-selected-file').textContent =
      state.campImport.fileName || 'No file selected.';
    byId('camp-import-upload-label').textContent = `${state.campImport.uploadPercent}%`;
    byId('camp-import-processing-label').textContent = `${state.campImport.processingPercent}%`;
    setProgressValue(byId('camp-import-upload-progress-bar'), state.campImport.uploadPercent);
    setProgressValue(
      byId('camp-import-processing-progress-bar'),
      state.campImport.processingPercent,
    );
    byId('camp-import-status-message').textContent =
      state.campImport.statusMessage || 'Waiting to start.';
    renderCampImportSummary(state.campImport.summary);
    renderCampImportErrors(state.campImport.errors);
    updateControlVisibility();
  }

  function setCampImportBusy(isBusy) {
    state.campImport.isBusy = isBusy;
    renderCampImportProgress();
  }

  function resetCampImportProgress({ keepFileName = false } = {}) {
    state.campImport.uploadPercent = 0;
    state.campImport.processingPercent = 0;
    state.campImport.statusMessage = 'Download the template to begin.';
    state.campImport.summary = null;
    state.campImport.errors = [];
    state.campImport.visible = false;
    if (!keepFileName) {
      state.campImport.fileName = '';
    }
    renderCampImportProgress();
  }

  function clearBulkCampImportModal() {
    const fileInput = byId('camp-template-file-input');
    if (fileInput) {
      fileInput.value = '';
    }
    resetCampImportProgress();
  }

  function applyCampImportPayload(payload = {}) {
    const summary = payload.summary || state.campImport.summary;
    state.campImport.visible = true;
    state.campImport.statusMessage = payload.message || state.campImport.statusMessage;
    state.campImport.processingPercent = Number(payload.progressPercent) || 0;
    if (state.campImport.processingPercent > 0) {
      state.campImport.uploadPercent = 100;
    }

    if (summary) {
      state.campImport.summary = {
        totalRows: Number(summary.totalRows) || 0,
        processedRows: Number(summary.processedRows) || 0,
        addedCount: Number(summary.addedCount) || 0,
        updatedCount: Number(summary.updatedCount) || 0,
        skippedCount: Number(summary.skippedCount) || 0,
        errorCount: Number(summary.errorCount) || 0,
      };
      if (Array.isArray(summary.errors)) {
        state.campImport.errors = summary.errors;
      }
    }

    if (Array.isArray(payload.errors) && payload.errors.length) {
      state.campImport.errors = payload.errors;
    }

    renderCampImportProgress();
  }

  async function handleCampTemplateUpload() {
    if (!canImportCamps()) {
      updateControlVisibility();
      return;
    }

    const input = byId('camp-template-file-input');
    const file = input?.files?.[0];

    if (!file) {
      toast.show({
        title: 'Missing information',
        message: 'Choose a completed camp template before uploading.',
        variant: 'warning',
      });
      return;
    }

    state.campImport.fileName = file.name;
    state.campImport.uploadPercent = 0;
    state.campImport.processingPercent = 0;
    state.campImport.statusMessage = 'Uploading template…';
    state.campImport.summary = null;
    state.campImport.errors = [];
    state.campImport.visible = true;
    renderCampImportProgress();
    setCampImportBusy(true);

    const result = await api.importCampTemplate(file, {
      onUploadProgress(progress) {
        state.campImport.visible = true;
        state.campImport.uploadPercent = progress;
        state.campImport.statusMessage =
          progress >= 100 ? 'Upload complete. Processing template…' : 'Uploading template…';
        renderCampImportProgress();
      },
    });

    setCampImportBusy(false);

    if (result.data?.summary) {
      applyCampImportPayload({
        summary: result.data.summary,
        message: result.data.message,
        progressPercent:
          result.data.summary.totalRows > 0
            ? Math.round(
                ((result.data.summary.processedRows || 0) / result.data.summary.totalRows) * 100,
              )
            : 0,
      });
    } else {
      state.campImport.statusMessage =
        result.message || 'The camp template request could not be completed.';
      state.campImport.visible = true;
      renderCampImportProgress();
    }

    if (!result.ok) {
      toast.show({
        title: 'Import failed',
        message: result.message || 'The camp template could not be processed.',
        variant: 'danger',
      });
      return;
    }

    if (input) {
      input.value = '';
    }

    toast.show({
      title:
        state.campImport.summary?.errorCount > 0
          ? 'Import completed with warnings'
          : 'Import completed',
      message: result.data?.message || 'The camp template was processed successfully.',
      variant: state.campImport.summary?.errorCount > 0 ? 'warning' : 'success',
    });
    state.campTable.page = 1;
    await loadCamps();
  }

  function buildCampsQuery() {
    const query = {
      page: state.campTable.page,
      limit: state.campTable.limit,
      sortDirection: state.campTable.sortDirection,
    };
    if (state.campTable.sortColumn && state.campTable.sortDirection !== 'default') {
      query.sortColumn = state.campTable.sortColumn;
    }
    return appendSearchFilters(query, state.campTable.filters);
  }

  function renderMainTableSortControls(tableKey, columns, headerIds = {}) {
    const tableState = state[tableKey];
    if (!tableState) return;
    columns.forEach((column) => {
      const active = tableState.sortColumn === column;
      const direction = active ? tableState.sortDirection : 'default';
      const indicator =
        document.querySelector(`[data-main-sort-indicator="${tableKey}:${column}"]`) ||
        byId(`${tableKey}-${column}-sort-indicator`);
      const header = byId(headerIds[column] || `${tableKey}-${column}-header`);

      if (indicator) {
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      }

      if (header) {
        header.setAttribute(
          'aria-sort',
          direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
        );
      }
    });
  }

  function renderCamps() {
    const tbody = byId('camp-table-body');
    if (!tbody) return;
    const canEditCamp = canEditCamps();
    const canDeleteCamp = canDeleteCamps();

    if (!state.camps.length) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="table-empty">No camps matched the current filters.</td></tr>';
    } else {
      tbody.innerHTML = state.camps
        .map((camp) => {
          const isActive = String(camp.id) === String(state.currentCampId);
          const canAccessCamp = camp.canAccess !== false;
          const canSelectCamp = canAccessCamp && !isActive;
          const selectTitle = canAccessCamp
            ? isActive
              ? 'This camp is active.'
              : 'Set this camp as the active scope.'
            : 'You do not have access to this camp.';

          return `
      <tr>
        <td><code>${escapeHtml(camp.id)}</code></td>
        <td>${escapeHtml(camp.name)}</td>
        <td>
          <div class="table-action-group">
            <button class="btn btn-primary js-edit-camp" type="button" data-camp-id="${escapeAttr(camp.id)}" data-camp-name="${escapeAttr(camp.name)}" ${canEditCamp ? '' : 'disabled'}>
              <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg>
              <span>Edit</span>
            </button>
            <button class="btn btn-ghost js-select-camp" type="button" data-camp-id="${escapeAttr(camp.id)}" data-camp-name="${escapeAttr(camp.name)}" data-can-access="${canAccessCamp ? 'true' : 'false'}" title="${escapeAttr(selectTitle)}" ${canSelectCamp ? '' : 'disabled'}>
              ${isActive ? 'Active' : 'Set active'}
            </button>
            <button class="btn btn-danger js-delete-camp" type="button" data-camp-id="${escapeAttr(camp.id)}" ${canDeleteCamp ? '' : 'disabled'}>
              <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
              <span>Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
        })
        .join('');
    }

    byId('camps-page-label').textContent =
      `Page ${state.campTable.page} of ${state.campTable.totalPages}`;
    byId('camps-prev-button').disabled = state.campTable.page <= 1;
    byId('camps-next-button').disabled = state.campTable.page >= state.campTable.totalPages;
    renderMainTableSortControls('campTable', ['name', 'id'], {
      name: 'camp-name-header',
      id: 'camp-id-header',
    });
    updateControlVisibility();
  }

  async function loadCamps() {
    pageState.set('loading', 'Loading camps…');
    const requestedPage = state.campTable.page;
    const request = campsLoadScope.next();
    const result = await api.getCamps(buildCampsQuery(), request.signal);
    if (result.aborted || !campsLoadScope.isCurrent(request.token)) return;
    if (!result.ok) {
      renderCamps();
      handleResult(result);
      return;
    }

    const rows = Array.isArray(result.data?.camps) ? result.data.camps : [];
    const totalPages = Number(result.data?.totalPages) || 1;
    const total = Number(result.data?.total) || 0;

    if (requestedPage > totalPages && total > 0) {
      state.campTable.page = totalPages;
      await loadCamps();
      return;
    }

    state.camps = rows;
    state.campTable.page = Math.min(requestedPage, totalPages);
    state.campTable.totalPages = totalPages;
    state.campTable.total = total;
    state.campTable.sortColumn = result.data?.sortColumn || null;
    state.campTable.sortDirection = result.data?.sortDirection || 'default';
    const selectedCamp = state.camps.find(
      (camp) => String(camp.id) === String(state.currentCampId),
    );
    if (selectedCamp && selectedCamp.canAccess !== false) {
      state.currentCampId = selectedCamp.id || '';
      state.currentCampName = selectedCamp.name || '';
    } else if (state.currentCampId) {
      await clearCurrentCampSelectionAndPersist();
    }
    renderCamps();
    updateSummaries();
    pageState.clear();
  }

  async function refreshCurrentCampAccess() {
    if (!state.currentCampId) return;

    const campId = state.currentCampId;
    const result = await api.getCamps({
      page: 1,
      limit: 1,
      searchColumn: 'id',
      searchValue: campId,
    });
    if (!result?.ok) return;

    const camps = Array.isArray(result.data?.camps) ? result.data.camps : [];
    const camp = camps.find((item) => String(item.id) === String(campId)) || null;
    if (camp && camp.canAccess !== false) {
      state.currentCampName = camp.name || state.currentCampName;
      updateSummaries();
      renderCamps();
      return;
    }

    await clearCurrentCampSelectionAndPersist();
    toast.show({
      title: 'Camp access changed',
      message: 'Your active camp is no longer available.',
      variant: 'warning',
    });
  }

  function buildUsersQuery() {
    const query = {
      page: state.users.page,
      limit: 10,
      sortDirection: state.users.sortDirection,
    };
    if (state.users.sortColumn && state.users.sortDirection !== 'default') {
      query.sortColumn = state.users.sortColumn;
    }
    return appendSearchFilters(query, state.users.filters);
  }

  function renderUsers() {
    const tbody = byId('user-table-body');
    if (!tbody) return;
    const canManageUsers = canAccessSystemManagement();

    expireStaleUserRequests();

    if (!state.users.rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="table-empty">No users matched the current filters.</td></tr>';
    } else {
      tbody.innerHTML = state.users.rows
        .map(
          (user) => `
        <tr>
          <td>
            <div class="table-user-cell">
              <span>${escapeHtml(user.username)}</span>
            </div>
          </td>
          <td>${renderUserLockState(user)}</td>
          <td>
            <div class="table-action-group">
              <button class="btn btn-primary js-edit-user" type="button" data-user-id="${escapeAttr(user.id)}" data-username="${escapeAttr(user.username)}" ${canManageUsers ? '' : 'disabled'}>
                <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg>
                <span>Edit</span>
              </button>
              <button class="btn ${user.isLocked ? 'btn-secondary' : 'btn-danger'} js-toggle-user-lock" type="button" data-user-id="${escapeAttr(user.id)}" data-username="${escapeAttr(user.username)}" data-user-locked="${user.isLocked ? 'true' : 'false'}" ${canManageUsers ? '' : 'disabled'}>
                <svg class="icon" aria-hidden="true"><use href="#${user.isLocked ? 'icon-unlock' : 'icon-lock'}"></use></svg>
                <span>${user.isLocked ? 'Unlock' : 'Lock'}</span>
              </button>
              <button class="btn btn-danger js-delete-user" type="button" data-user-id="${escapeAttr(user.id)}" ${canManageUsers ? '' : 'disabled'}>
                <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
                <span>Delete</span>
              </button>
            </div>
          </td>
        </tr>
      `,
        )
        .join('');
    }
    byId('users-page-label').textContent = `Page ${state.users.page} of ${state.users.totalPages}`;
    byId('users-prev-button').disabled = state.users.page <= 1;
    byId('users-next-button').disabled = state.users.page >= state.users.totalPages;
    renderMainTableSortControls('users', ['username', 'account'], {
      username: 'user-name-header',
      account: 'user-account-header',
    });
    scheduleUserRequestExpiryCheck();
    updateControlVisibility();
  }

  function renderUserRequestActions(user) {
    const effectiveStatus = getEffectiveUserRequestStatus(user);

    if (user.pendingRequestId && effectiveStatus === 'pending') {
      return `
        <div class="table-action-group">
          <button
            class="btn btn-primary js-resolve-user-request"
            type="button"
            data-request-id="${escapeAttr(user.pendingRequestId)}"
            data-request-type="${escapeAttr(user.pendingRequestType || '')}"
            data-username="${escapeAttr(user.username)}"
            data-decision="approved"
            ${canAccessSystemManagement() ? '' : 'disabled'}
          >
            <span>Approve</span>
          </button>
          <button
            class="btn btn-danger js-resolve-user-request"
            type="button"
            data-request-id="${escapeAttr(user.pendingRequestId)}"
            data-request-type="${escapeAttr(user.pendingRequestType || '')}"
            data-username="${escapeAttr(user.username)}"
            data-decision="denied"
            ${canAccessSystemManagement() ? '' : 'disabled'}
          >
            <span>Reject</span>
          </button>
        </div>
      `;
    }

    return `<span class="table-badge" data-status="${escapeAttr(user.status || 'none')}">${escapeHtml(user.status || '—')}</span>`;
  }

  function renderUserLockState(user) {
    if (user?.isLocked) {
      return '<span class="table-badge" data-status="locked">Locked</span>';
    }

    return '<span class="table-badge" data-status="approved">Active</span>';
  }

  function applyUserRequestUpdate({ userId, requestId, requestType, status, expiresAt } = {}) {
    const normalizedUserId = String(userId || '');
    if (!normalizedUserId) return false;

    const row = state.users.rows.find((item) => String(item.id) === normalizedUserId);
    if (!row) return false;

    row.status = status || row.status || null;

    if (status === 'pending') {
      row.pendingRequestId = requestId || row.pendingRequestId || null;
      row.pendingRequestType = requestType || row.pendingRequestType || null;
      row.pendingRequestExpiresAt = expiresAt || row.pendingRequestExpiresAt || null;
    } else {
      row.pendingRequestId = null;
      row.pendingRequestType = null;
      row.pendingRequestExpiresAt = null;
    }

    renderUsers();
    return true;
  }

  function formatRequestType(requestType) {
    if (requestType === 'show_qr') return 'QR access';
    if (requestType === 'password_change') return 'password change';
    return 'user';
  }

  async function handleUserRequestDecision({ requestId, decision, username, requestType }) {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }

    const actionLabel = decision === 'approved' ? 'Approve' : 'Reject';
    const confirmed = await confirmAction({
      title: `${actionLabel} request`,
      message: () => {
        const user =
          state.users.rows.find((item) => item.pendingRequestId === requestId) ||
          state.users.rows.find((item) => item.username === username);
        return `${actionLabel} the ${formatRequestType(user?.pendingRequestType || requestType)} request for "${user?.username || username}" and update their pending access state.`;
      },
      confirmText: actionLabel,
      variant: decision === 'approved' ? 'warning' : 'danger',
      canConfirm: canAccessSystemManagement,
    });
    if (!confirmed) return;

    pageState.set('loading', `${actionLabel}ing request…`);
    const result = await api.resolveUserRequest(requestId, decision);
    if (!handleResult(result, `Request ${decision === 'approved' ? 'approved' : 'rejected'}.`)) {
      return;
    }

    toast.show({
      title: `Request ${decision === 'approved' ? 'approved' : 'rejected'}`,
      message: result.data?.message || `The request for ${username} was updated successfully.`,
      variant: 'success',
    });
    const applied = applyUserRequestUpdate({
      userId: result.data?.userId,
      requestId: result.data?.requestId,
      requestType: result.data?.requestType,
      status: result.data?.decision,
    });
    if (!applied) loadUsers();
    if (state.activeTab === 'admin') loadAdminInbox();
  }

  async function handleUserLockToggle({ userId, username, locked }) {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }

    const nextLocked = !locked;
    const actionLabel = nextLocked ? 'Lock' : 'Unlock';
    const successLabel = nextLocked ? 'locked' : 'unlocked';
    const confirmed = await confirmAction({
      title: `${actionLabel} user`,
      message: () => {
        const user = state.users.rows.find((item) => String(item.id) === String(userId));
        const currentUsername = user?.username || username;
        return nextLocked
          ? `Lock "${currentUsername}" and end any active or pending sessions?`
          : `Unlock "${currentUsername}" so the account can sign in again?`;
      },
      confirmText: actionLabel,
      variant: nextLocked ? 'danger' : 'warning',
      canConfirm: canAccessSystemManagement,
    });
    if (!confirmed) return;

    pageState.set('loading', `${actionLabel}ing user…`);
    const result = await api.editUser({
      id: userId,
      username,
      password: '',
      locked: nextLocked,
    });
    if (!handleResult(result, `User ${successLabel}.`)) {
      return;
    }

    toast.show({
      title: `User ${successLabel}`,
      message: result.data?.message || `The user was ${successLabel} successfully.`,
      variant: 'success',
    });
    await loadUsers();
  }

  async function loadUsers() {
    if (!canAccessSystemManagement()) {
      if (state.activeTab === 'admin') {
        setActiveTab('overview');
      }
      return;
    }

    pageState.set('loading', 'Loading users…');
    const requestedPage = state.users.page;
    const request = usersLoadScope.next();
    const result = await api.getUsers(buildUsersQuery(), request.signal);
    if (result.aborted || !usersLoadScope.isCurrent(request.token)) return;
    if (!result.ok) {
      renderUsers();
      handleResult(result);
      return;
    }

    const rows = Array.isArray(result.data?.users) ? result.data.users : [];
    const totalPages = Number(result.data?.totalPages) || 1;

    if (requestedPage > totalPages && totalPages > 0) {
      state.users.page = totalPages;
      await loadUsers();
      return;
    }

    state.users.rows = rows;
    state.users.page = Math.min(requestedPage, totalPages);
    state.users.totalPages = totalPages;
    if (!syncExpiredUserRequests()) {
      renderUsers();
    }
    pageState.clear();
  }

  function formatAdminInboxType(item = {}) {
    if (item.kind === 'access_request') return formatRequestType(item.type);
    if (item.type === 'issue') return 'Issue';
    if (item.type === 'message') return 'Message';
    if (item.type === 'other') return 'Other';
    return 'Suggestion';
  }

  function formatAdminInboxStatus(status) {
    const normalized = String(status || 'open');
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'denied') return 'Denied';
    if (normalized === 'expired') return 'Expired';
    if (normalized === 'pending') return 'Pending';
    if (normalized === 'closed') return 'Closed';
    return 'Open';
  }

  function formatAdminInboxDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 || 12;
    const hours = String(hours12).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    return `${year}-${month}-${day} ${hours}:${minutes} ${meridiem}`;
  }

  function renderAdminInboxActions(item = {}) {
    const canManage = canAccessSystemManagement();
    if (item.kind === 'access_request' && item.status === 'pending') {
      return `
        <div class="table-action-group">
          <button class="btn btn-primary js-resolve-user-request" type="button" data-request-id="${escapeAttr(item.sourceId)}" data-request-type="${escapeAttr(item.type || '')}" data-username="${escapeAttr(item.username || 'this user')}" data-decision="approved" ${canManage ? '' : 'disabled'}>
            <span>Approve</span>
          </button>
          <button class="btn btn-danger js-resolve-user-request" type="button" data-request-id="${escapeAttr(item.sourceId)}" data-request-type="${escapeAttr(item.type || '')}" data-username="${escapeAttr(item.username || 'this user')}" data-decision="denied" ${canManage ? '' : 'disabled'}>
            <span>Reject</span>
          </button>
          <button class="btn btn-danger js-delete-admin-inbox-item" type="button" data-inbox-id="${escapeAttr(item.sourceId)}" data-inbox-kind="${escapeAttr(item.kind)}" data-inbox-subject="${escapeAttr(item.subject || 'Access request')}" ${canManage ? '' : 'disabled'}>
            <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
            <span>Delete</span>
          </button>
        </div>
      `;
    }

    if (item.kind === 'user_message') {
      const nextStatus = item.status === 'closed' ? 'open' : 'closed';
      const label = item.status === 'closed' ? 'Reopen' : 'Close';
      return `
        <div class="table-action-group">
          <button class="btn btn-secondary js-update-user-message" type="button" data-message-id="${escapeAttr(item.sourceId)}" data-message-status="${escapeAttr(nextStatus)}" ${canManage ? '' : 'disabled'}>
            <span>${label}</span>
          </button>
          <button class="btn btn-danger js-delete-admin-inbox-item" type="button" data-inbox-id="${escapeAttr(item.sourceId)}" data-inbox-kind="${escapeAttr(item.kind)}" data-inbox-subject="${escapeAttr(item.subject || 'Untitled')}" ${canManage ? '' : 'disabled'}>
            <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
            <span>Delete</span>
          </button>
        </div>
      `;
    }

    if (item.kind === 'access_request') {
      return `
        <button class="btn btn-danger js-delete-admin-inbox-item" type="button" data-inbox-id="${escapeAttr(item.sourceId)}" data-inbox-kind="${escapeAttr(item.kind)}" data-inbox-subject="${escapeAttr(item.subject || 'Access request')}" ${canManage ? '' : 'disabled'}>
          <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
          <span>Delete</span>
        </button>
      `;
    }

    return '<span class="token token--soft">No action</span>';
  }

  function renderAdminInbox() {
    const tbody = byId('admin-inbox-table-body');
    if (!tbody) return;

    if (!state.adminInbox.items.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="table-empty">No user messages or access requests matched the current filter.</td></tr>';
    } else {
      tbody.innerHTML = state.adminInbox.items
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(formatAdminInboxType(item))}</td>
          <td>${escapeHtml(item.username || 'Public request')}</td>
          <td>
            <div class="admin-inbox-message">
              <span class="admin-inbox-message__subject">${escapeHtml(item.subject || 'Untitled')}</span>
              ${item.body ? `<span class="admin-inbox-message__body">${escapeHtml(item.body)}</span>` : ''}
            </div>
          </td>
          <td><span class="table-badge" data-status="${escapeAttr(item.status || 'open')}">${escapeHtml(formatAdminInboxStatus(item.status))}</span></td>
          <td>${escapeHtml(formatAdminInboxDate(item.createdAt))}</td>
          <td>${renderAdminInboxActions(item)}</td>
        </tr>
      `,
        )
        .join('');
    }

    byId('admin-inbox-page-label').textContent =
      `Page ${state.adminInbox.page} of ${state.adminInbox.totalPages}`;
    byId('admin-inbox-prev-button').disabled = state.adminInbox.page <= 1;
    byId('admin-inbox-next-button').disabled =
      state.adminInbox.page >= state.adminInbox.totalPages;
    renderMainTableSortControls(
      'adminInbox',
      ['type', 'username', 'subject', 'status', 'createdAt'],
      {
        type: 'admin-inbox-type-header',
        username: 'admin-inbox-username-header',
        subject: 'admin-inbox-subject-header',
        status: 'admin-inbox-status-header',
        createdAt: 'admin-inbox-created-at-header',
      },
    );
    updateControlVisibility();
  }

  function buildAdminInboxQuery() {
    const query = {
      page: state.adminInbox.page,
      limit: 10,
      sortDirection: state.adminInbox.sortDirection,
    };
    if (state.adminInbox.sortColumn && state.adminInbox.sortDirection !== 'default') {
      query.sortColumn = state.adminInbox.sortColumn;
    }
    return appendSearchFilters(query, state.adminInbox.filters);
  }

  async function loadAdminInbox() {
    if (!canAccessSystemManagement()) {
      if (state.activeTab === 'admin') {
        setActiveTab('overview');
      }
      return;
    }

    pageState.set('loading', 'Loading user inbox...');
    const requestedPage = state.adminInbox.page;
    const request = adminInboxLoadScope.next();
    const result = await api.getAdminInbox(buildAdminInboxQuery(), request.signal);
    if (result.aborted || !adminInboxLoadScope.isCurrent(request.token)) return;
    if (!result.ok) {
      renderAdminInbox();
      handleResult(result);
      return;
    }

    const items = Array.isArray(result.data?.items) ? result.data.items : [];
    const totalPages = Number(result.data?.totalPages) || 1;

    if (requestedPage > totalPages && totalPages > 0) {
      state.adminInbox.page = totalPages;
      await loadAdminInbox();
      return;
    }

    state.adminInbox.items = items;
    state.adminInbox.page = Math.min(requestedPage, totalPages);
    state.adminInbox.totalPages = totalPages;
    renderAdminInbox();
    pageState.clear();
  }

  function getPermissionChecked(userId, permissionId) {
    return state.permissions.userPermissions.some(
      (item) =>
        String(item.userId) === String(userId) &&
        String(item.permissionId) === String(permissionId),
    );
  }

  function renderPermissionBanner() {
    const banner = byId('permission-dirty-banner');
    if (!banner) return;
    if (state.permissions.pending.size === 0) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.hidden = false;
    banner.textContent = `Saving ${state.permissions.pending.size} permission change${state.permissions.pending.size === 1 ? '' : 's'}...`;
  }

  function renderPermissionSortIndicator() {
    if (state.permissions.sortColumn !== 'name' || state.permissions.sortDirection === 'default') {
      return { indicator: '-', ariaSort: 'none' };
    }

    if (state.permissions.sortDirection === 'asc') {
      return { indicator: '^', ariaSort: 'ascending' };
    }

    return { indicator: 'v', ariaSort: 'descending' };
  }

  function renderPermissionHeader() {
    const { indicator, ariaSort } = renderPermissionSortIndicator();
    const canManagePermissions = canAccessSystemManagement();

    return `
      <tr>
        <th id="permission-name-header" aria-sort="${ariaSort}">
          <div class="table-header-stack">
            <label class="search-field" for="permission-search-input">
              <svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg>
              <input
                id="permission-search-input"
                type="search"
                placeholder="Search by permission name"
              autocomplete="off"
              value="${escapeAttr(state.permissions.searchValue)}"
              ${canManagePermissions ? '' : 'disabled'}
            />
            </label>
            <button
              class="sort-header-button"
              type="button"
              data-main-sort-table="permissions"
              data-main-sort-column="name"
              aria-label="Sort by permission name"
              ${canManagePermissions ? '' : 'disabled'}
            >
              <span>Permission name</span>
              <span class="sort-header-button__indicator" data-main-sort-indicator="permissions:name" aria-hidden="true">${indicator}</span>
            </button>
          </div>
        </th>
        ${state.permissions.users.map((user) => `<th>${escapeHtml(user.username)}</th>`).join('')}
      </tr>
    `;
  }

  function renderPermissions() {
    const head = byId('permission-table-head');
    const body = byId('permission-table-body');
    if (!head || !body) return;
    const canManagePermissions = canAccessSystemManagement();
    const activeElement = document.activeElement;
    const shouldRestoreSearchFocus =
      activeElement instanceof HTMLInputElement && activeElement.id === 'permission-search-input';
    const searchSelection =
      shouldRestoreSearchFocus && typeof activeElement.selectionStart === 'number'
        ? {
            start: activeElement.selectionStart,
            end: activeElement.selectionEnd,
          }
        : null;

    head.innerHTML = renderPermissionHeader();
    if (shouldRestoreSearchFocus) {
      const searchInput = byId('permission-search-input');
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        if (searchSelection) {
          searchInput.setSelectionRange(searchSelection.start, searchSelection.end);
        }
      }
    }

    if (!state.permissions.permissions.length || !state.permissions.users.length) {
      body.innerHTML =
        '<tr><td class="table-empty">No permission data matched the current filters.</td></tr>';
      renderPermissionBanner();
      return;
    }

    body.innerHTML = state.permissions.permissions
      .map(
        (permission) => `
      <tr>
        <td>${escapeHtml(permission.name)}</td>
        ${state.permissions.users
          .map(
            (user) => `
          <td>
            <input
              type="checkbox"
              class="js-permission-toggle"
              data-user-id="${escapeAttr(user.id)}"
              data-perm-id="${escapeAttr(permission.id)}"
              ${getPermissionChecked(user.id, permission.id) ? 'checked' : ''}
              ${!canManagePermissions || state.permissions.pending.has(`${user.id}:${permission.id}`) ? 'disabled' : ''}
            />
          </td>
        `,
          )
          .join('')}
      </tr>
    `,
      )
      .join('');

    byId('permissions-page-label').textContent =
      `Page ${state.permissions.page} of ${state.permissions.totalPages}`;
    byId('permissions-prev-button').disabled = state.permissions.page <= 1;
    byId('permissions-next-button').disabled =
      state.permissions.page >= state.permissions.totalPages;
    renderPermissionBanner();
    updateControlVisibility();
  }

  function buildPermissionsQuery() {
    const query = {
      page: state.permissions.page,
      limit: 10,
      sortDirection: state.permissions.sortDirection,
    };
    if (state.permissions.sortColumn && state.permissions.sortDirection !== 'default') {
      query.sortColumn = state.permissions.sortColumn;
    }
    if (state.permissions.searchValue.trim()) {
      query.searchColumn = 'name';
      query.searchValue = state.permissions.searchValue.trim();
    }
    return query;
  }

  async function loadPermissions() {
    if (!canAccessSystemManagement()) {
      if (state.activeTab === 'admin') {
        setActiveTab('overview');
      }
      return;
    }

    pageState.set('loading', 'Loading permission matrix…');
    const requestedPage = state.permissions.page;
    const request = permissionsLoadScope.next();
    const result = await api.getPermissions(buildPermissionsQuery(), request.signal);
    if (result.aborted || !permissionsLoadScope.isCurrent(request.token)) return;
    if (!result.ok) {
      renderPermissions();
      handleResult(result);
      return;
    }

    const users = Array.isArray(result.data?.users) ? result.data.users : [];
    const permissions = Array.isArray(result.data?.permissions) ? result.data.permissions : [];
    const userPermissions = Array.isArray(result.data?.userPermissions)
      ? result.data.userPermissions
      : [];
    const totalPages = Number(result.data?.totalPages) || 1;

    if (requestedPage > totalPages && totalPages > 0) {
      state.permissions.page = totalPages;
      await loadPermissions();
      return;
    }

    state.permissions.users = users;
    state.permissions.permissions = permissions;
    state.permissions.userPermissions = userPermissions;
    state.permissions.page = Math.min(requestedPage, totalPages);
    state.permissions.totalPages = totalPages;
    renderPermissions();
    pageState.clear();
  }

  function applyPermissionChange({ userId, permissionId, isChecked }) {
    const existingIndex = state.permissions.userPermissions.findIndex(
      (item) =>
        String(item.userId) === String(userId) &&
        String(item.permissionId) === String(permissionId),
    );

    if (isChecked && existingIndex === -1) {
      state.permissions.userPermissions.push({ userId, permissionId });
      return;
    }

    if (!isChecked && existingIndex >= 0) {
      state.permissions.userPermissions.splice(existingIndex, 1);
    }
  }

  async function savePermissions(permissions = []) {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      renderPermissions();
      return false;
    }
    if (!permissions.length) return false;

    const pendingKeys = permissions.map((item) => `${item.userId}:${item.permId}`);
    pendingKeys.forEach((key) => state.permissions.pending.add(key));
    renderPermissions();

    pageState.set('loading', 'Saving permission changes…');
    const result = await api.savePermissions(permissions);
    if (!result.ok) {
      pendingKeys.forEach((key) => state.permissions.pending.delete(key));
      renderPermissions();
      handleResult(result);
      return false;
    }

    permissions.forEach((item) =>
      applyPermissionChange({
        userId: item.userId,
        permissionId: item.permId,
        isChecked: item.isCheck,
      }),
    );

    pendingKeys.forEach((key) => state.permissions.pending.delete(key));
    await loadCurrentUserPermissions();
    renderPermissions();
    pageState.clear();
    return true;
  }

  function getCampAccessChecked(userId, campId) {
    return state.campAccess.userCampAccess.some(
      (item) =>
        String(item.userId) === String(userId) && String(item.campId) === String(campId),
    );
  }

  function renderCampAccessBanner() {
    const banner = byId('camp-access-dirty-banner');
    if (!banner) return;
    if (state.campAccess.pending.size === 0) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.hidden = false;
    banner.textContent = `Saving ${state.campAccess.pending.size} camp access change${state.campAccess.pending.size === 1 ? '' : 's'}...`;
  }

  function renderCampAccessSortIndicator() {
    if (state.campAccess.sortDirection === 'default') {
      return { indicator: '-', ariaSort: 'none' };
    }

    if (state.campAccess.sortDirection === 'asc') {
      return { indicator: '^', ariaSort: 'ascending' };
    }

    return { indicator: 'v', ariaSort: 'descending' };
  }

  function renderCampAccessHeader() {
    const { indicator, ariaSort } = renderCampAccessSortIndicator();
    const canManageCampAccess = canAccessSystemManagement();

    return `
      <tr>
        <th id="camp-access-name-header" aria-sort="${ariaSort}">
          <div class="table-header-stack">
            <label class="search-field" for="camp-access-search-input">
              <svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg>
              <input
                id="camp-access-search-input"
                type="search"
                placeholder="Search by camp name"
                autocomplete="off"
                value="${escapeAttr(state.campAccess.searchValue)}"
                ${canManageCampAccess ? '' : 'disabled'}
              />
            </label>
            <button
              class="sort-header-button"
              type="button"
              data-main-sort-table="campAccess"
              data-main-sort-column="name"
              aria-label="Sort by camp name"
              ${canManageCampAccess ? '' : 'disabled'}
            >
              <span>Camp name</span>
              <span class="sort-header-button__indicator" data-main-sort-indicator="campAccess:name" aria-hidden="true">${indicator}</span>
            </button>
          </div>
        </th>
        ${state.campAccess.users.map((user) => `<th>${escapeHtml(user.username)}</th>`).join('')}
      </tr>
    `;
  }

  function renderCampAccess() {
    const head = byId('camp-access-table-head');
    const body = byId('camp-access-table-body');
    if (!head || !body) return;
    const canManageCampAccess = canAccessSystemManagement();
    const activeElement = document.activeElement;
    const shouldRestoreSearchFocus =
      activeElement instanceof HTMLInputElement && activeElement.id === 'camp-access-search-input';
    const searchSelection =
      shouldRestoreSearchFocus && typeof activeElement.selectionStart === 'number'
        ? {
            start: activeElement.selectionStart,
            end: activeElement.selectionEnd,
          }
        : null;

    head.innerHTML = renderCampAccessHeader();
    if (shouldRestoreSearchFocus) {
      const searchInput = byId('camp-access-search-input');
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        if (searchSelection) {
          searchInput.setSelectionRange(searchSelection.start, searchSelection.end);
        }
      }
    }

    if (!state.campAccess.camps.length || !state.campAccess.users.length) {
      body.innerHTML =
        '<tr><td class="table-empty">No camp access data matched the current filters.</td></tr>';
      renderCampAccessBanner();
      return;
    }

    body.innerHTML = state.campAccess.camps
      .map(
        (camp) => `
      <tr>
        <td>${escapeHtml(camp.name)}</td>
        ${state.campAccess.users
          .map(
            (user) => `
          <td>
            <input
              type="checkbox"
              class="js-camp-access-toggle"
              data-user-id="${escapeAttr(user.id)}"
              data-camp-id="${escapeAttr(camp.id)}"
              ${getCampAccessChecked(user.id, camp.id) ? 'checked' : ''}
              ${!canManageCampAccess || state.campAccess.pending.has(`${user.id}:${camp.id}`) ? 'disabled' : ''}
            />
          </td>
        `,
          )
          .join('')}
      </tr>
    `,
      )
      .join('');

    byId('camp-access-page-label').textContent =
      `Page ${state.campAccess.page} of ${state.campAccess.totalPages}`;
    byId('camp-access-prev-button').disabled = state.campAccess.page <= 1;
    byId('camp-access-next-button').disabled =
      state.campAccess.page >= state.campAccess.totalPages;
    renderCampAccessBanner();
    updateControlVisibility();
  }

  function buildCampAccessQuery() {
    const query = {
      page: state.campAccess.page,
      limit: 10,
      sortDirection: state.campAccess.sortDirection,
    };
    if (state.campAccess.sortColumn && state.campAccess.sortDirection !== 'default') {
      query.sortColumn = state.campAccess.sortColumn;
    }
    if (state.campAccess.searchValue.trim()) {
      query.searchColumn = 'name';
      query.searchValue = state.campAccess.searchValue.trim();
    }
    return query;
  }

  async function loadCampAccess() {
    if (!canAccessSystemManagement()) {
      if (state.activeTab === 'admin') {
        setActiveTab('overview');
      }
      return;
    }

    pageState.set('loading', 'Loading camp access matrix...');
    const requestedPage = state.campAccess.page;
    const request = campAccessLoadScope.next();
    const result = await api.getCampAccess(buildCampAccessQuery(), request.signal);
    if (result.aborted || !campAccessLoadScope.isCurrent(request.token)) return;
    if (!result.ok) {
      renderCampAccess();
      handleResult(result);
      return;
    }

    const users = Array.isArray(result.data?.users) ? result.data.users : [];
    const camps = Array.isArray(result.data?.camps) ? result.data.camps : [];
    const userCampAccess = Array.isArray(result.data?.userCampAccess)
      ? result.data.userCampAccess
      : [];
    const totalPages = Number(result.data?.totalPages) || 1;

    if (requestedPage > totalPages && totalPages > 0) {
      state.campAccess.page = totalPages;
      await loadCampAccess();
      return;
    }

    state.campAccess.users = users;
    state.campAccess.camps = camps;
    state.campAccess.userCampAccess = userCampAccess;
    state.campAccess.page = Math.min(requestedPage, totalPages);
    state.campAccess.totalPages = totalPages;
    renderCampAccess();
    pageState.clear();
  }

  function applyCampAccessChange({ userId, campId, isChecked }) {
    const existingIndex = state.campAccess.userCampAccess.findIndex(
      (item) =>
        String(item.userId) === String(userId) && String(item.campId) === String(campId),
    );

    if (isChecked && existingIndex === -1) {
      state.campAccess.userCampAccess.push({ userId, campId });
      return;
    }

    if (!isChecked && existingIndex >= 0) {
      state.campAccess.userCampAccess.splice(existingIndex, 1);
    }
  }

  async function saveCampAccess(campAccess = []) {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      renderCampAccess();
      return false;
    }
    if (!campAccess.length) return false;

    const pendingKeys = campAccess.map((item) => `${item.userId}:${item.campId}`);
    pendingKeys.forEach((key) => state.campAccess.pending.add(key));
    renderCampAccess();

    pageState.set('loading', 'Saving camp access changes...');
    const result = await api.saveCampAccess(campAccess);
    if (!result.ok) {
      pendingKeys.forEach((key) => state.campAccess.pending.delete(key));
      renderCampAccess();
      handleResult(result);
      return false;
    }

    campAccess.forEach((item) =>
      applyCampAccessChange({
        userId: item.userId,
        campId: item.campId,
        isChecked: item.isCheck,
      }),
    );

    pendingKeys.forEach((key) => state.campAccess.pending.delete(key));
    renderCampAccess();
    if (state.activeTab === 'camps') await loadCamps();
    pageState.clear();
    return true;
  }

  function openCreateCampModal() {
    if (!canAddCamps()) {
      updateControlVisibility();
      return;
    }
    byId('add-camp-form').reset();
    addCampModalState.clear();
    updateControlVisibility();
    addCampModal?.open();
  }

  function openBulkCampImportModal() {
    if (!canImportCamps()) {
      updateControlVisibility();
      return;
    }
    updateControlVisibility();
    bulkCampImportModal?.open();
  }

  function openEditCampModal(campId, campName) {
    if (!canEditCamps()) {
      updateControlVisibility();
      return;
    }
    editCampModalState.clear();
    byId('edit-camp-id-input').value = campId || '';
    byId('edit-camp-name-input').value = campName || '';
    byId('edit-camp-modal-title').textContent = 'Edit camp';
    byId('edit-camp-modal-text').textContent =
      'Update the camp name while keeping the active workspace context stable.';
    byId('save-camp-button').textContent = 'Save changes';
    updateControlVisibility();
    editCampModal?.open();
  }

  function openCreateUserModal() {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    userModalState.clear();
    byId('user-form-mode').value = 'create';
    byId('user-id-input').value = '';
    byId('user-name-input').value = '';
    byId('user-password-input').value = '';
    byId('user-password-input').placeholder = 'Generated when needed';
    byId('user-password-field').hidden = true;
    byId('user-password-label').textContent = 'Temporary password';
    byId('user-password-hint').textContent =
      'Leave empty during create to let the system generate one.';
    byId('user-modal-title').textContent = 'Add user';
    byId('user-modal-text').textContent =
      'Create a user account with a controlled temporary password flow.';
    byId('save-user-button').textContent = 'Create user';
    updateControlVisibility();
    userModal?.open();
  }

  function openEditUserModal(userId, username) {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    userModalState.clear();
    byId('user-form-mode').value = 'edit';
    byId('user-id-input').value = userId;
    byId('user-name-input').value = username;
    byId('user-password-input').value = '';
    byId('user-password-input').placeholder = 'Leave blank to keep the current credential';
    byId('user-password-field').hidden = false;
    byId('user-password-label').textContent = 'New password';
    byId('user-password-hint').textContent =
      'If the user has a current password or temporary password, this value replaces it.';
    byId('user-modal-title').textContent = 'Edit user';
    byId('user-modal-text').textContent =
      'Change the username and optionally replace the user password or temporary password.';
    byId('save-user-button').textContent = 'Save changes';
    updateControlVisibility();
    userModal?.open();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  document.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('[data-tab-trigger]');
    if (tabButton) {
      setActiveTab(tabButton.dataset.tabTrigger);
      return;
    }

    const selectCampButton = event.target.closest('.js-select-camp');
    if (selectCampButton) {
      if (selectCampButton.disabled || selectCampButton.dataset.canAccess === 'false') {
        renderCamps();
        return;
      }
      pageState.set('loading', 'Switching active camp…');
      const result = await api.setCamp(selectCampButton.dataset.campId);
      if (!handleResult(result, 'Active camp updated.')) return;
      state.currentCampId = selectCampButton.dataset.campId;
      state.currentCampName = selectCampButton.dataset.campName || '';
      renderCamps();
      updateSummaries();
      notifyCampContextChanged();
      toast.show({
        title: 'Camp updated',
        message: 'The active camp context has been updated.',
        variant: 'success',
      });
      return;
    }

    if (event.target.closest('#open-add-camp-modal')) {
      openCreateCampModal();
      return;
    }
    if (event.target.closest('#open-bulk-camp-import-modal')) {
      openBulkCampImportModal();
      return;
    }
    const mainSortButton = event.target.closest('[data-main-sort-table][data-main-sort-column]');
    if (mainSortButton) {
      const tableKey = mainSortButton.dataset.mainSortTable;
      const column = mainSortButton.dataset.mainSortColumn;
      if (
        (tableKey === 'users' ||
          tableKey === 'permissions' ||
          tableKey === 'campAccess' ||
          tableKey === 'adminInbox') &&
        !canAccessSystemManagement()
      ) {
        updateControlVisibility();
        return;
      }

      const tableState = state[tableKey];
      if (!tableState) return;
      if (tableState.sortColumn === column) {
        tableState.sortDirection = getNextSortDirection(tableState.sortDirection);
      } else {
        tableState.sortColumn = column;
        tableState.sortDirection = 'asc';
      }
      if (tableState.sortDirection === 'default') tableState.sortColumn = null;
      tableState.page = 1;

      if (tableKey === 'campTable') loadCamps();
      if (tableKey === 'users') loadUsers();
      if (tableKey === 'permissions') loadPermissions();
      if (tableKey === 'campAccess') loadCampAccess();
      if (tableKey === 'adminInbox') loadAdminInbox();
      return;
    }
    const editCampButton = event.target.closest('.js-edit-camp');
    if (editCampButton) {
      if (!canEditCamps()) {
        updateControlVisibility();
        return;
      }
      openEditCampModal(editCampButton.dataset.campId, editCampButton.dataset.campName);
      return;
    }

    const deleteCampButton = event.target.closest('.js-delete-camp');
    if (deleteCampButton) {
      if (!canDeleteCamps()) {
        updateControlVisibility();
        return;
      }
      const campId = deleteCampButton.dataset.campId || '';
      const campName =
        state.camps.find((camp) => String(camp.id) === String(campId))?.name || 'this camp';
      const confirmed = await confirmAction({
        title: 'Delete camp',
        message: () => {
          const currentCampName =
            state.camps.find((camp) => String(camp.id) === String(campId))?.name || campName;
          return `Permanently remove camp "${currentCampName}". Dependent records must be cleared before deletion can succeed.`;
        },
        confirmText: 'Delete camp',
        variant: 'danger',
        canConfirm: canDeleteCamps,
      });
      if (!confirmed) return;

      pageState.set('loading', 'Deleting camp…');
      const result = await api.deleteCamp(campId);
      if (!handleResult(result, 'Camp removed successfully.')) return;
      toast.show({
        title: 'Camp removed',
        message: result.data?.message || 'The camp was removed successfully.',
        variant: 'success',
      });
      if (String(state.currentCampId) === String(campId)) clearCurrentCampSelection();
      loadCamps();
      return;
    }

    if (event.target.closest('#open-add-user-modal')) {
      openCreateUserModal();
      return;
    }

    const editUserButton = event.target.closest('.js-edit-user');
    if (editUserButton) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      openEditUserModal(editUserButton.dataset.userId, editUserButton.dataset.username);
      return;
    }

    const toggleUserLockButton = event.target.closest('.js-toggle-user-lock');
    if (toggleUserLockButton) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      await handleUserLockToggle({
        userId: toggleUserLockButton.dataset.userId || '',
        username: toggleUserLockButton.dataset.username || 'this user',
        locked: toggleUserLockButton.dataset.userLocked === 'true',
      });
      return;
    }

    const resolveUserRequestButton = event.target.closest('.js-resolve-user-request');
    if (resolveUserRequestButton) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      await handleUserRequestDecision({
        requestId: resolveUserRequestButton.dataset.requestId || '',
        decision: resolveUserRequestButton.dataset.decision || '',
        username: resolveUserRequestButton.dataset.username || 'this user',
        requestType: resolveUserRequestButton.dataset.requestType || '',
      });
      return;
    }

    const updateUserMessageButton = event.target.closest('.js-update-user-message');
    if (updateUserMessageButton) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      const messageId = updateUserMessageButton.dataset.messageId || '';
      const status = updateUserMessageButton.dataset.messageStatus || '';
      const actionLabel = status === 'closed' ? 'Close' : 'Reopen';
      const confirmed = await confirmAction({
        title: `${actionLabel} message`,
        message: () => `${actionLabel} this user message in the admin inbox?`,
        confirmText: actionLabel,
        variant: status === 'closed' ? 'warning' : 'danger',
        canConfirm: canAccessSystemManagement,
      });
      if (!confirmed) return;

      pageState.set('loading', `${actionLabel}ing message...`);
      const result = await api.updateUserMessageStatus(messageId, status);
      if (!handleResult(result, result.data?.message || 'Message updated.')) return;
      toast.show({
        title: 'Message updated',
        message: result.data?.message || 'The user message was updated.',
        variant: 'success',
      });
      await loadAdminInbox();
      return;
    }

    const deleteAdminInboxButton = event.target.closest('.js-delete-admin-inbox-item');
    if (deleteAdminInboxButton) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }

      const itemId = deleteAdminInboxButton.dataset.inboxId || '';
      const itemKind = deleteAdminInboxButton.dataset.inboxKind || '';
      const itemSubject = deleteAdminInboxButton.dataset.inboxSubject || 'this inbox entry';
      const confirmed = await confirmAction({
        title: 'Delete inbox entry',
        message: () => `Permanently delete "${itemSubject}" from the user inbox?`,
        confirmText: 'Delete',
        variant: 'danger',
        canConfirm: canAccessSystemManagement,
      });
      if (!confirmed) return;

      pageState.set('loading', 'Deleting inbox entry...');
      const result = await api.deleteAdminInboxItem(itemId, itemKind);
      if (!handleResult(result, result.data?.message || 'Inbox entry deleted.')) return;
      toast.show({
        title: 'Inbox entry deleted',
        message: result.data?.message || 'The inbox entry was removed.',
        variant: 'success',
      });
      await loadAdminInbox();
      if (itemKind === 'access_request') loadUsers();
      return;
    }

    if (event.target.closest('#refresh-camps-button')) {
      loadCamps();
      return;
    }
    if (event.target.closest('#upload-camp-template-button')) {
      if (!canImportCamps()) {
        updateControlVisibility();
        return;
      }
      handleCampTemplateUpload();
      return;
    }
    if (event.target.closest('#refresh-users-button')) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      loadUsers();
      return;
    }
    if (event.target.closest('#refresh-admin-inbox-button')) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      loadAdminInbox();
      return;
    }
    if (event.target.closest('#refresh-permissions-button')) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      loadPermissions();
      return;
    }
    if (event.target.closest('#refresh-camp-access-button')) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      loadCampAccess();
      return;
    }
    const deleteUserButton = event.target.closest('.js-delete-user');
    if (deleteUserButton) {
      if (!canAccessSystemManagement()) {
        updateControlVisibility();
        return;
      }
      const userId = deleteUserButton.dataset.userId || '';
      const userName =
        state.users.rows.find((user) => String(user.id) === String(userId))?.username ||
        'this user';
      const confirmed = await confirmAction({
        title: 'Delete user',
        message: () => {
          const currentUserName =
            state.users.rows.find((user) => String(user.id) === String(userId))?.username ||
            userName;
          return `Permanently remove user "${currentUserName}" and revoke their access to the system.`;
        },
        confirmText: 'Delete user',
        variant: 'danger',
        canConfirm: canAccessSystemManagement,
      });
      if (!confirmed) return;

      pageState.set('loading', 'Deleting user…');
      const result = await api.deleteUsers([userId]);
      if (!handleResult(result, 'User removed successfully.')) return;
      toast.show({
        title: 'User removed',
        message: result.data?.message || 'The user was removed successfully.',
        variant: 'success',
      });
      loadUsers();
      return;
    }
  });

  byId('add-camp-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canAddCamps()) {
      updateControlVisibility();
      return;
    }
    const campName = byId('add-camp-name-input').value.trim();
    if (!campName) {
      showMissingInformation(
        addCampModalState,
        'Enter a camp name before saving.',
        'add-camp-name-input',
      );
      return;
    }

    const confirmed = await confirmAction({
      title: 'Create camp',
      message: () =>
        `Create camp "${byId('add-camp-name-input')?.value.trim() || campName}" so records can be assigned to it across the system.`,
      confirmText: 'Create camp',
      variant: 'warning',
      canConfirm: canAddCamps,
    });
    if (!confirmed) return;

    addCampModalState.set('loading', 'Creating camp…');
    const result = await api.addCamp(campName);
    if (!result?.ok) {
      handleResult(result);
      addCampModalState.set(
        result?.pageState || 'error',
        result?.message || 'The camp could not be created.',
      );
      return;
    }
    addCampModalState.set('success', 'Camp added successfully.');
    addCampModal?.close();
    toast.show({
      title: 'Camp created',
      message: result.data?.message || 'Camp added successfully.',
      variant: 'success',
    });
    state.campTable.page = 1;
    loadCamps();
  });

  byId('edit-camp-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canEditCamps()) {
      updateControlVisibility();
      return;
    }
    const campId = byId('edit-camp-id-input').value;
    const campName = byId('edit-camp-name-input').value.trim();
    if (!campId || !campName) {
      showMissingInformation(
        editCampModalState,
        'Enter a camp name before saving.',
        'edit-camp-name-input',
      );
      return;
    }

    const confirmed = await confirmAction({
      title: 'Save camp changes',
      message: () =>
        `Save the edited camp name as "${byId('edit-camp-name-input')?.value.trim() || campName}" and update it wherever this camp is shown.`,
      confirmText: 'Save changes',
      variant: 'warning',
      canConfirm: canEditCamps,
    });
    if (!confirmed) return;

    editCampModalState.set('loading', 'Saving camp changes…');
    const result = await api.editCamp(campId, campName);
    if (!result?.ok) {
      showRequestFailureToast(result);
      editCampModalState.set(
        result?.pageState || 'error',
        result?.message || 'The camp could not be updated.',
      );
      return;
    }
    editCampModalState.set('success', 'Camp updated successfully.');

    if (String(state.currentCampId) === String(campId)) {
      state.currentCampName = campName;
      updateSummaries();
    }

    editCampModal?.close();
    toast.show({
      title: 'Camp updated',
      message: result.data?.message || 'Camp edited successfully.',
      variant: 'success',
    });
    loadCamps();
  });

  byId('user-message-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const type = userMessageTypeLookup.getValue();
    const subject = byId('user-message-subject-input')?.value.trim() || '';
    const message = byId('user-message-body-input')?.value.trim() || '';

    if (!type) {
      showMissingInformation(null, 'Select a message type before sending.', 'user-message-type-input');
      return;
    }

    if (!subject) {
      showMissingInformation(null, 'Enter a subject before sending.', 'user-message-subject-input');
      return;
    }

    if (message.length < 10) {
      showMissingInformation(
        null,
        'Enter a message with at least 10 characters before sending.',
        'user-message-body-input',
      );
      return;
    }

    const confirmed = await confirmAction({
      title: 'Send message',
      message: () =>
        `Send "${byId('user-message-subject-input')?.value.trim() || subject}" to the administrators?`,
      confirmText: 'Send',
      variant: 'warning',
    });
    if (!confirmed) return;

    pageState.set('loading', 'Sending message...');
    const result = await api.submitUserMessage({ type, subject, message });
    if (!handleResult(result, result.data?.message || 'Message sent successfully.')) return;

    byId('user-message-form')?.reset();
    userMessageTypeLookup.clear();
    toast.show({
      title: 'Message sent',
      message: result.data?.message || 'Your message was sent to the administrators.',
      variant: 'success',
    });
  });

  byId('user-message-form')?.addEventListener('reset', () => {
    window.setTimeout(() => userMessageTypeLookup.clear(), 0);
  });

  byId('user-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    const mode = byId('user-form-mode').value;
    const username = byId('user-name-input').value.trim();
    const password = byId('user-password-input').value;

    if (!username) {
      showMissingInformation(userModalState, 'Enter a username before saving.', 'user-name-input');
      return;
    }

    if (mode === 'create') {
      const confirmed = await confirmAction({
        title: 'Create user',
        message: () =>
          `Create user "${byId('user-name-input')?.value.trim() || username}" and issue a temporary password for first sign-in.`,
        confirmText: 'Create user',
        variant: 'warning',
        canConfirm: canAccessSystemManagement,
      });
      if (!confirmed) return;

      userModalState.set('loading', 'Creating user…');
      const result = await api.addUser(username);
      if (!result?.ok) {
        showRequestFailureToast(result);
        userModalState.set(
          result?.pageState || 'error',
          result?.message || 'The user could not be created.',
        );
        return;
      }
      userModalState.set('success', 'User added successfully.');
      userModal?.close();
      byId('temp-password-value').textContent = result.data?.temporaryPassword || '';
      tempPasswordModalState.clear();
      tempPasswordModal?.open();
      toast.show({
        title: 'User created',
        message: result.data?.message || 'User added successfully.',
        variant: 'success',
      });
      loadUsers();
      return;
    }

    const confirmed = await confirmAction({
      title: 'Save user changes',
      message: () =>
        `Save the edited account details for user "${byId('user-name-input')?.value.trim() || username}". Leave the password field blank to keep the current password.`,
      confirmText: 'Save changes',
      variant: 'warning',
      canConfirm: canAccessSystemManagement,
    });
    if (!confirmed) return;

    userModalState.set('loading', 'Saving user changes…');
    const result = await api.editUser({
      id: byId('user-id-input').value,
      username,
      password,
    });
    if (!result?.ok) {
      showRequestFailureToast(result);
      userModalState.set(
        result?.pageState || 'error',
        result?.message || 'The user could not be updated.',
      );
      return;
    }
    userModalState.set('success', 'User updated successfully.');
    userModal?.close();
    toast.show({
      title: 'User updated',
      message: result.data?.message || 'User edited successfully.',
      variant: 'success',
    });
    loadUsers();
  });

  byId('copy-temp-password-button')?.addEventListener('click', async () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    const password = byId('temp-password-value')?.textContent || '';
    if (!password) {
      tempPasswordModalState.set('error', 'There is no temporary password to copy.');
      return;
    }

    tempPasswordModalState.set('loading', 'Copying temporary password…');

    try {
      await navigator.clipboard.writeText(password);
      tempPasswordModalState.set('success', 'Temporary password copied to clipboard.');
      toast.show({
        title: 'Password copied',
        message: 'The temporary password was copied to the clipboard.',
        variant: 'success',
      });
    } catch {
      tempPasswordModalState.set(
        'error',
        'Clipboard access is unavailable. Copy the temporary password manually.',
      );
    }
  });

  byId('permission-table-body')?.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('js-permission-toggle'))
      return;

    if (!canAccessSystemManagement()) {
      renderPermissions();
      updateControlVisibility();
      return;
    }

    const userId = input.dataset.userId || '';
    const permId = input.dataset.permId || '';
    const key = `${userId}:${permId}`;
    if (!userId || !permId || state.permissions.pending.has(key)) {
      renderPermissions();
      return;
    }

    const original = state.permissions.userPermissions.some(
      (item) =>
        String(item.userId) === String(userId) && String(item.permissionId) === String(permId),
    );
    if (input.checked === original) return;

    const nextChecked = input.checked;
    input.checked = original;
    await savePermissions([{ userId, permId, isCheck: nextChecked }]);
  });

  byId('camp-access-table-body')?.addEventListener('change', async (event) => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      !input.classList.contains('js-camp-access-toggle')
    )
      return;

    if (!canAccessSystemManagement()) {
      renderCampAccess();
      updateControlVisibility();
      return;
    }

    const userId = input.dataset.userId || '';
    const campId = input.dataset.campId || '';
    const key = `${userId}:${campId}`;
    if (!userId || !campId || state.campAccess.pending.has(key)) {
      renderCampAccess();
      return;
    }

    const original = state.campAccess.userCampAccess.some(
      (item) => String(item.userId) === String(userId) && String(item.campId) === String(campId),
    );
    if (input.checked === original) return;

    const nextChecked = input.checked;
    input.checked = original;
    await saveCampAccess([{ userId, campId, isCheck: nextChecked }]);
  });

  byId('camps-prev-button')?.addEventListener('click', () => {
    if (state.campTable.page <= 1) return;
    state.campTable.page -= 1;
    loadCamps();
  });
  byId('camps-next-button')?.addEventListener('click', () => {
    if (state.campTable.page >= state.campTable.totalPages) return;
    state.campTable.page += 1;
    loadCamps();
  });

  document.addEventListener(
    'input',
    debounce((event) => {
      const input = event.target;
      if (
        !(input instanceof HTMLInputElement) ||
        !input.dataset.mainSearchTable ||
        !input.dataset.mainSearchColumn
      ) {
        return;
      }

      const tableKey = input.dataset.mainSearchTable;
      if (
        (tableKey === 'users' ||
          tableKey === 'permissions' ||
          tableKey === 'campAccess' ||
          tableKey === 'adminInbox') &&
        !canAccessSystemManagement()
      ) {
        updateControlVisibility();
        return;
      }

      const tableState = state[tableKey];
      if (!tableState?.filters) return;
      tableState.filters[input.dataset.mainSearchColumn] = input.value;
      tableState.page = 1;

      if (tableKey === 'campTable') loadCamps();
      if (tableKey === 'users') loadUsers();
      if (tableKey === 'adminInbox') loadAdminInbox();
    }, 250),
  );

  byId('camp-template-file-input')?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0] || null;
    if (!file) {
      resetCampImportProgress();
      return;
    }

    state.campImport.fileName = file.name;
    state.campImport.visible = false;
    state.campImport.uploadPercent = 0;
    state.campImport.processingPercent = 0;
    state.campImport.statusMessage = 'Template selected and ready to upload.';
    state.campImport.summary = null;
    state.campImport.errors = [];
    renderCampImportProgress();
  });

  byId('users-prev-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.users.page <= 1) return;
    state.users.page -= 1;
    loadUsers();
  });
  byId('users-next-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.users.page >= state.users.totalPages) return;
    state.users.page += 1;
    loadUsers();
  });
  byId('permissions-prev-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.permissions.page <= 1) return;
    state.permissions.page -= 1;
    loadPermissions();
  });
  byId('permissions-next-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.permissions.page >= state.permissions.totalPages) return;
    state.permissions.page += 1;
    loadPermissions();
  });
  byId('camp-access-prev-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.campAccess.page <= 1) return;
    state.campAccess.page -= 1;
    loadCampAccess();
  });
  byId('camp-access-next-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.campAccess.page >= state.campAccess.totalPages) return;
    state.campAccess.page += 1;
    loadCampAccess();
  });
  byId('admin-inbox-prev-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.adminInbox.page <= 1) return;
    state.adminInbox.page -= 1;
    loadAdminInbox();
  });
  byId('admin-inbox-next-button')?.addEventListener('click', () => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    if (state.adminInbox.page >= state.adminInbox.totalPages) return;
    state.adminInbox.page += 1;
    loadAdminInbox();
  });
  const handlePermissionSearchInput = debounce((value) => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    state.permissions.searchValue = String(value || '');
    state.permissions.page = 1;
    loadPermissions();
  }, 250);

  byId('permission-table-head')?.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'permission-search-input') return;
    handlePermissionSearchInput(input.value);
  });

  const handleCampAccessSearchInput = debounce((value) => {
    if (!canAccessSystemManagement()) {
      updateControlVisibility();
      return;
    }
    state.campAccess.searchValue = String(value || '');
    state.campAccess.page = 1;
    loadCampAccess();
  }, 250);

  byId('camp-access-table-head')?.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'camp-access-search-input') return;
    handleCampAccessSearchInput(input.value);
  });

  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const roomManager = socket ? createSocketRoomManager(socket) : null;
  bindLateBicycleToast({
    socket,
    roomManager,
    toast,
    pageData: {
      get currentCampId() {
        return state.currentCampId;
      },
    },
  });
  bindUpcomingAccommodationToasts({
    toast,
    pageData: {
      get currentCampId() {
        return state.currentCampId;
      },
    },
  });
  let activeSharedRooms = [];
  let userRequestExpiryTimer = null;

  function parseUserRequestExpiry(value) {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function clearUserRequestExpiryTimer() {
    if (!userRequestExpiryTimer) return;
    window.clearTimeout(userRequestExpiryTimer);
    userRequestExpiryTimer = null;
  }

  function getEffectiveUserRequestStatus(user) {
    const expiresAt = parseUserRequestExpiry(user?.pendingRequestExpiresAt);
    if (user?.pendingRequestId && expiresAt && expiresAt <= Date.now()) {
      return 'expired';
    }
    return user?.status || null;
  }

  function scheduleUserRequestExpiryCheck() {
    clearUserRequestExpiryTimer();

    let nextExpiry = null;
    const now = Date.now();

    for (const row of state.users.rows) {
      if (!row?.pendingRequestId) continue;
      const expiresAt = parseUserRequestExpiry(row.pendingRequestExpiresAt);
      if (!expiresAt || expiresAt <= now) continue;
      if (!nextExpiry || expiresAt < nextExpiry) nextExpiry = expiresAt;
    }

    if (!nextExpiry) return;

    userRequestExpiryTimer = window.setTimeout(
      () => {
        syncExpiredUserRequests();
      },
      Math.max(0, nextExpiry - Date.now()) + 25,
    );
  }

  function expireStaleUserRequests() {
    const now = Date.now();
    let changed = false;

    for (const row of state.users.rows) {
      if (!row?.pendingRequestId) continue;
      const expiresAt = parseUserRequestExpiry(row.pendingRequestExpiresAt);
      if (!expiresAt || expiresAt > now) continue;

      row.status = 'expired';
      row.pendingRequestId = null;
      row.pendingRequestType = null;
      row.pendingRequestExpiresAt = null;
      changed = true;
    }

    return changed;
  }

  function syncExpiredUserRequests() {
    const changed = expireStaleUserRequests();

    if (changed) {
      renderUsers();
      return true;
    }

    scheduleUserRequestExpiryCheck();
    return false;
  }

  async function refreshUserDependentViews() {
    if (state.activeTab === 'admin') {
      await loadUsers();
      await loadPermissions();
      await loadCampAccess();
    }
  }

  function syncOpenUserModalFromRealtime(payload = {}) {
    const userId = payload.userId || payload.id;
    const username = payload.username;
    const mode = byId('user-form-mode')?.value;
    const openUserId = byId('user-id-input')?.value;

    if (mode !== 'edit' || !userId || !username || String(openUserId) !== String(userId)) {
      return;
    }

    byId('user-name-input').value = username;
  }

  function closeOpenUserModalIfDeleted(payload = {}) {
    const deletedUserIds = Array.isArray(payload.deletedUserIds) ? payload.deletedUserIds : [];
    const openUserId = byId('user-id-input')?.value;
    if (!openUserId || !deletedUserIds.some((userId) => String(userId) === String(openUserId))) {
      return;
    }

    userModal?.close();
  }

  function getDesiredSharedRooms() {
    const desired = [];
    if (state.activeTab === 'admin') {
      desired.push('ui:user:list');
      desired.push('ui:permission:list');
    }
    if (state.activeTab === 'camps') desired.push('ui:camp:list');
    return desired;
  }

  async function syncSocketSubscriptions({ reset = false } = {}) {
    if (!roomManager) return;

    const desiredRooms = getDesiredSharedRooms();

    if (reset) {
      roomManager.clear();
      activeSharedRooms = [];
    }

    const roomsToUnsubscribe = activeSharedRooms.filter((room) => !desiredRooms.includes(room));
    const roomsToSubscribe = desiredRooms.filter((room) => !activeSharedRooms.includes(room));

    if (roomsToUnsubscribe.length > 0) {
      await roomManager.unsubscribe(roomsToUnsubscribe);
    }

    if (roomsToSubscribe.length > 0) {
      await roomManager.subscribe(roomsToSubscribe);
    }

    activeSharedRooms =
      typeof roomManager.getSubscribedRooms === 'function'
        ? roomManager.getSubscribedRooms()
        : desiredRooms;
  }

  if (socket) {
    const onSocketEvents = (eventNames, handler) => {
      for (const eventName of eventNames) {
        socket.on(eventName, handler);
      }
    };

    socket.on('connect', () => {
      void syncSocketSubscriptions({ reset: true });
    });
    onSocketEvents(['camp:add', 'camp:record:created'], () => {
      if (state.activeTab === 'camps') loadCamps();
    });
    onSocketEvents(['camp:updated', 'camp:record:updated'], () => {
      if (state.activeTab === 'camps') loadCamps();
    });
    onSocketEvents(['soldier:changed', 'soldier:record:changed'], () => {
      if (state.activeTab === 'camps') loadCamps();
    });
    onSocketEvents(['camp:deleted', 'camp:record:deleted'], (payload = {}) => {
      const deletedCampId = payload.campId || payload.id || '';
      if (deletedCampId && String(state.currentCampId) === String(deletedCampId)) {
        clearCurrentCampSelection();
      }
      if (state.activeTab === 'camps') loadCamps();
    });
    onSocketEvents(['camp:import:progress', 'camp:import:progressed'], (payload = {}) => {
      applyCampImportPayload({
        summary: {
          totalRows: payload.totalRows,
          processedRows: payload.processedRows,
          addedCount: payload.addedCount,
          updatedCount: payload.updatedCount,
          skippedCount: payload.skippedCount,
          errorCount: payload.errorCount,
          errors: payload.errors,
        },
        message: payload.message,
        progressPercent: payload.progressPercent,
        errors: payload.errors,
      });
    });
    onSocketEvents(['user:add', 'user:record:created'], () => {
      void refreshUserDependentViews();
    });
    onSocketEvents(['user:updated', 'user:record:updated'], (payload = {}) => {
      syncOpenUserModalFromRealtime(payload);
      void refreshUserDependentViews();
    });
    onSocketEvents(['user:deleted', 'user:record:deleted'], () => {
      safeRedirect('/', '/');
    });
    onSocketEvents(['user:deleted:list', 'user:record:bulk_deleted'], (payload = {}) => {
      closeOpenUserModalIfDeleted(payload);
      void refreshUserDependentViews();
    });
    socket.on('user:request:updated', (payload = {}) => {
      if (state.activeTab !== 'admin') return;
      const applied = applyUserRequestUpdate(payload);
      if (!applied) loadUsers();
      loadAdminInbox();
    });
    socket.on('admin:inbox:updated', (payload = {}) => {
      if (state.activeTab === 'admin') loadAdminInbox();
      if (state.activeTab === 'admin' && payload?.kind === 'public_access_request') {
        toast.show({
          title: 'Access request received',
          message: 'A new request access message was added to the user inbox.',
          variant: 'success',
        });
      }
    });
    onSocketEvents(['permission:updated', 'permission:catalog:updated'], async () => {
      await loadCurrentUserPermissions();
      if (state.activeTab === 'admin') await loadPermissions();
    });
    onSocketEvents(['permission:access:changed', 'permission:access:updated'], async () => {
      await loadCurrentUserPermissions();
    });
    onSocketEvents(['permission:self:refresh', 'permission:self:refreshed'], async () => {
      await loadCurrentUserPermissions();
      if (state.activeTab === 'admin') await loadPermissions();
    });
    onSocketEvents(['camp:access:changed', 'camp:access:updated'], async () => {
      if (state.activeTab === 'admin') await loadCampAccess();
      if (state.activeTab === 'camps') await loadCamps();
    });
    onSocketEvents(['camp:access:self:refresh', 'camp:access:self:refreshed'], async () => {
      await refreshCurrentCampAccess();
      if (state.activeTab === 'camps') await loadCamps();
    });
  }

  window.addEventListener('pagehide', () => {
    clearUserRequestExpiryTimer();
    if (!roomManager || activeSharedRooms.length === 0) return;
    void roomManager.unsubscribe(activeSharedRooms);
    activeSharedRooms = [];
    roomManager.clear();
  });

  loadCurrentUserPermissions();
  updateSummaries();
  renderCampImportProgress();
  setActiveTab('overview');
});
