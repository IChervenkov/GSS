// @ts-nocheck
import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import {
  byId,
  debounce,
  qsa,
  reloadIfBackForwardCache,
  setProgressValue,
} from '/assets/shared/js/core/dom.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { formatDateTimeDisplay } from '/assets/shared/js/core/display-date-time.ts';
import { readPageData } from '/assets/shared/js/core/page-data.ts';
import { confirmAction, initConfirmModal } from '/assets/shared/js/core/confirm.ts';
import {
  bindForcedSignOut,
  createSocketRoomManager,
} from '/assets/shared/js/core/socket-client.ts';
import { createModalController } from '/assets/shared/js/ui/modal.ts';
import {
  bindLateBicycleToast,
  bindUpcomingAccommodationToasts,
  createToastManager,
  initWorkspacePage,
  syncTabPanels,
} from '/assets/shared/js/workspace/page-shell.ts';
import { createWorkspacePermissionAccessRefresh } from '/assets/shared/js/workspace/permission-access.ts';
import { createLaundryPageApi } from './laundry-page.api.ts';

const PERMISSIONS = Object.freeze({
  full: 'Full permission',
  section: 'Laundry',
  add: 'Add laundry bag',
  edit: 'Edit laundry bag',
  remove: 'Remove laundry bag',
  status: 'Save laundry status',
  downloadLaundryApp: 'Download laundry app',
});

const STATUS_LABELS = Object.freeze({
  in_soldier: 'In soldier',
  drop_off: 'Drop-off',
  laundry_facility: 'Laundry facility',
  ready_to_pick_up: 'Ready to pick up',
  pick_up: 'Available',
  overdue: 'Overdue',
});
const ACTIVE_STATUSES = ['drop_off', 'laundry_facility', 'ready_to_pick_up'];
const TABLE_KEYS = ['all', ...ACTIVE_STATUSES, 'available'];
const TABLE_ROW_SOURCES = Object.freeze({
  all: 'rows',
  available: 'availableRows',
  drop_off: 'statusRows.drop_off',
  laundry_facility: 'statusRows.laundry_facility',
  ready_to_pick_up: 'statusRows.ready_to_pick_up',
});
const LAUNDRY_STATUS_OPTIONS = Object.freeze([
  { id: 'in_soldier', label: 'In soldier' },
  { id: 'drop_off', label: 'Drop-off' },
  { id: 'laundry_facility', label: 'Laundry facility' },
  { id: 'ready_to_pick_up', label: 'Ready to pick up' },
]);
const LAUNDRY_STATUS_TRANSITIONS = Object.freeze({
  in_soldier: ['drop_off', 'laundry_facility'],
  drop_off: ['laundry_facility', 'ready_to_pick_up'],
  laundry_facility: ['drop_off', 'ready_to_pick_up'],
  ready_to_pick_up: ['in_soldier'],
});
const TABLE_COLUMNS = Object.freeze({
  all: ['id', 'code', 'rfidCode', 'type', 'status', 'soldierName', 'laundryCount', 'maxCountLaundry'],
  available: ['id', 'code', 'rfidCode', 'type', 'status', 'soldierName', 'laundryCount', 'maxCountLaundry'],
  drop_off: ['id', 'code', 'type', 'status', 'soldierName'],
  laundry_facility: ['id', 'code', 'type', 'status', 'soldierName'],
  ready_to_pick_up: ['id', 'code', 'type', 'status', 'soldierName'],
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function getNested(source, path) {
  return String(path)
    .split('.')
    .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), source);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || 'Available';
}


function reportStatusLabel(status) {
  return status === 'washed' ? 'Washed' : 'Being washed';
}

function toDateInputValue(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  return formatDateTimeDisplay(value);
}

function createInitialTables() {
  return TABLE_KEYS.reduce((tables, key) => {
    tables[key] = {
      page: 1,
      limit: 10,
      filters: {},
      sortColumn: null,
      sortDirection: 'default',
      totalPages: 1,
      total: 0,
      sourceTotal: 0,
    };
    return tables;
  }, {});
}

bootstrapPage(() => {
  reloadIfBackForwardCache();
  const pageData = readPageData();
  initWorkspacePage();
  const csrfToken = byId('csrf-token')?.value || pageData.csrfToken || '';
  const api = createLaundryPageApi({ csrfToken });
  const toast = createToastManager(byId('toast-stack'));
  const overviewScope = createRequestScope();
  const lookupScope = createRequestScope();
  const actionScope = createRequestScope();
  const reportScope = createRequestScope();
  const state = {
    permissions: new Set(),
    tables: createInitialTables(),
    rowsById: new Map(),
    activeTab: 'overview',
    moveSourceStatus: '',
    report: {
      loaded: false,
      isBusy: false,
      fromDate: '',
      toDate: '',
      rows: [],
      dailyTotals: [],
      countryTotals: [],
      totalBags: 0,
      beingWashedCount: 0,
      washedCount: 0,
      linenExchangeCount: 0,
      filters: {
        dateDropOff: '',
        dateReadyToPickUp: '',
        status: '',
        flowType: '',
        bagCode: '',
        soldierName: '',
        soldierCountry: '',
      },
      sortColumn: null,
      sortDirection: 'default',
      historyPage: 1,
      historyLimit: 10,
      historyTotalRows: 0,
      historyTotalPages: 1,
      historySourceTotal: 0,
      dailyPage: 1,
      dailyLimit: 10,
      dailyTotalRows: 0,
      dailyTotalPages: 1,
      dailySourceTotal: 0,
      countryPage: 1,
      countryLimit: 10,
      countryFilters: {},
      countrySortColumn: null,
      countrySortDirection: 'default',
      countryTotalRows: 0,
      countryTotalPages: 1,
      countrySourceTotal: 0,
    },
    import: {
      fileName: '',
      uploadPercent: 0,
      processingPercent: 0,
      statusMessage: 'Download the template to begin.',
      summary: null,
      errors: [],
      isBusy: false,
      visible: false,
    },
  };
  const tabButtons = Array.from(document.querySelectorAll('[data-tab-trigger]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
  const pageState = createPageStateController({
    root: byId('main-content'),
    disableTargets: [
      ...qsa('[data-refresh-laundry]'),
      ...qsa('[data-open-add-status-modal]'),
      ...qsa('[data-laundry-prev-table]'),
      ...qsa('[data-laundry-next-table]'),
    ],
  });

  const modals = {
    bag: createModal('bag-modal'),
    addStatus: createModal('status-add-modal'),
    move: createModal('move-bag-modal'),
    bulk: createModal('bulk-bag-modal', { onAfterClose: clearBulkImportModal }),
  };
  const bagModalState = createPageStateController({
    root: byId('bag-modal'),
    disableTargets: [
      byId('bag-code-input'),
      byId('bag-rfid-input'),
      byId('bag-type-input'),
      byId('bag-max-count-input'),
      byId('save-bag-button'),
    ],
  });
  const statusAddModalState = createPageStateController({
    root: byId('status-add-modal'),
    disableTargets: [byId('status-bag-search-input'), byId('save-status-add-button')],
  });
  const moveBagModalState = createPageStateController({
    root: byId('move-bag-modal'),
    disableTargets: [byId('move-bag-status-input'), byId('save-move-bag-button')],
  });
  initConfirmModal();
  const statusBagOptions = new Map();
  const moveBagStatusOptions = new Map();
  const statusBagLookup = createLookupCombobox({
    inputId: 'status-bag-search-input',
    hiddenInputId: 'status-bag-input',
    listboxId: 'status-bag-options',
    targetMap: statusBagOptions,
    emptyText: 'No available bags found.',
    loadingText: 'Searching available bags...',
    getLabel: (row) => row.code || row.id || '',
    getTitle: (row) => row.code || row.id || '',
    getMeta: (row) => {
      const details = [];
      if (row.rfidCode) details.push(`RFID ${row.rfidCode}`);
      if (row.type) details.push(row.type);
      if (row.id) details.push(row.id);
      return details.join(' | ');
    },
    onSearch: (search, options = {}) => {
      void loadAvailableOptions(search, options);
    },
  });
  const moveBagStatusLookup = createLookupCombobox({
    inputId: 'move-bag-status-input',
    hiddenInputId: 'move-bag-status-value-input',
    listboxId: 'move-bag-status-options',
    targetMap: moveBagStatusOptions,
    emptyText: 'No statuses match that search.',
    loadingText: 'Searching statuses...',
    getLabel: (status) => status.label,
    getTitle: (status) => status.label,
    onSearch: (search, options = {}) => {
      loadStatusOptions(moveBagStatusLookup, search, {
        ...options,
        sourceStatus: state.moveSourceStatus,
      });
    },
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

  function createModal(id, options = {}) {
    const root = byId(id);
    const dialog = root?.querySelector('.workspace-modal__dialog');
    return createModalController({
      root,
      dialog,
      closeSelectors: ['[data-close-modal="true"]'],
      ...options,
    });
  }

  function setDisabled(element, disabled) {
    if (!element) return;
    const isDisabled = Boolean(disabled);
    if ('disabled' in element) {
      element.disabled = isDisabled;
      return;
    }
    element.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
    if (element.tagName === 'A') {
      if (isDisabled) element.setAttribute('tabindex', '-1');
      else element.removeAttribute('tabindex');
    }
  }

  function setDisabledById(id, disabled) {
    setDisabled(byId(id), disabled);
  }

  function setFormDisabled(formId, disabled) {
    byId(formId)
      ?.querySelectorAll('input, select, textarea, button[type="submit"]')
      .forEach((element) => setDisabled(element, disabled));
  }

  function hasPermission(name) {
    return state.permissions.has(PERMISSIONS.full) || state.permissions.has(name);
  }

  const canAdd = () => hasPermission(PERMISSIONS.add);
  const canEdit = () => hasPermission(PERMISSIONS.edit);
  const canDelete = () => hasPermission(PERMISSIONS.remove);
  const canMove = () => hasPermission(PERMISSIONS.status);
  const canImport = () => canAdd() || canEdit();
  const canViewReport = () => hasPermission(PERMISSIONS.section);
  const canDownloadLaundryMobileApp = () => hasPermission(PERMISSIONS.downloadLaundryApp);

  function canMoveBag(row) {
    return canMove() && Boolean(row?.soldierId);
  }

  function canRecordLinenExchange(row) {
    return canMove() && Boolean(row?.soldierId);
  }

  function getDeleteBlockedReason(row) {
    if (!canDelete()) return 'You do not have permission to remove laundry bags.';
    if (row?.soldierId) return 'Assigned bags cannot be deleted until they are unassigned.';
    if (row?.status && row.status !== 'pick_up') return 'Only Available bags can be deleted.';
    return '';
  }

  function canDeleteBag(row) {
    return canDelete();
  }

  function getDeleteTitle(row) {
    return getDeleteBlockedReason(row) || 'Delete this bag.';
  }

  function canUseCurrentBagFormMode() {
    const mode = byId('bag-form-mode')?.value || 'create';
    return mode === 'edit' ? canEdit() : canAdd();
  }

  function syncLookupDisabled(inputId, disabled, lookup) {
    const input = byId(inputId);
    setDisabled(input, disabled);
    input?.closest('[data-lookup-combobox]')?.classList.toggle('is-disabled', Boolean(disabled));
    if (disabled) lookup?.close();
  }

  function syncActionButton(element) {
    const row = state.rowsById.get(String(element.getAttribute('data-bag-id') || ''));
    const action = element.getAttribute('data-laundry-action');
    if (action === 'move') {
      const disabled = !canMoveBag(row);
      setDisabled(element, disabled);
      element.title = canMove()
        ? row?.soldierId
          ? 'Move this bag.'
          : 'Only bags assigned to a soldier can be moved.'
        : 'You do not have permission to move laundry bags.';
      return;
    }
    if (action === 'linen-exchange') {
      const disabled = !canRecordLinenExchange(row);
      setDisabled(element, disabled);
      element.title = canMove()
        ? row?.soldierId
          ? 'Record linen exchange.'
          : 'Only bags assigned to a soldier can be used for linen exchange.'
        : 'You do not have permission to record linen exchanges.';
      return;
    }
    if (action === 'edit') {
      const disabled = !canEdit();
      setDisabled(element, disabled);
      element.title = canEdit()
        ? 'Edit this bag.'
        : 'You do not have permission to edit laundry bags.';
      return;
    }
    if (action === 'delete') {
      const disabled = !canDelete();
      setDisabled(element, disabled);
      element.title = getDeleteTitle(row);
    }
  }

  function updateControlVisibility() {
    setDisabledById('open-add-bag-modal', !canAdd());
    setDisabledById('open-bulk-bag-modal', !canImport());
    setDisabledById('download-bag-template-button', !canImport());
    byId('download-bag-template-button')?.setAttribute(
      'title',
      canImport()
        ? 'Download the laundry bag template.'
        : 'You do not have permission to download the laundry bag template.',
    );
    setDisabledById('bag-template-file-input', !canImport());
    setDisabledById('upload-bag-template-button', !canImport() || state.import.isBusy);
    setDisabledById('download-laundry-mobile-app-button', !canDownloadLaundryMobileApp());
    byId('download-laundry-mobile-app-button')?.setAttribute(
      'title',
      canDownloadLaundryMobileApp()
        ? 'Download the laundry mobile app.'
        : 'You do not have permission to download the laundry mobile app.',
    );
    syncReportDownloadButton();
    document.querySelectorAll('[data-laundry-action][data-bag-id]').forEach(syncActionButton);
    setFormDisabled('bag-form', !canUseCurrentBagFormMode());
    setFormDisabled('status-add-form', !canMove());
    setFormDisabled('move-bag-form', !canMove());
    syncLookupDisabled('status-bag-search-input', !canMove(), statusBagLookup);
    syncLookupDisabled('move-bag-status-input', !canMove(), moveBagStatusLookup);
    renderBulkProgress();
  }

  function createLookupCombobox({
    inputId,
    hiddenInputId,
    listboxId,
    targetMap,
    emptyText,
    loadingText,
    getLabel,
    getTitle,
    getMeta = () => '',
    onSearch,
    onSelect = () => {},
  }) {
    const input = byId(inputId);
    const hiddenInput = byId(hiddenInputId);
    const listbox = byId(listboxId);
    const root = input?.closest('[data-lookup-combobox]');
    const lookupState = { options: [], activeIndex: -1 };

    if (!input || !hiddenInput || !listbox || !root) {
      return {
        close() {},
        clear() {},
        renderLoading() {},
        renderOptions() {},
        setSelection() {},
        syncHiddenId() {},
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
        input.setAttribute('aria-activedescendant', `${listboxId}-option-${index}`);
        byId(`${listboxId}-option-${index}`)?.scrollIntoView({ block: 'nearest' });
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

    function renderStatus(message, modifier = '', { open = true } = {}) {
      lookupState.options = [];
      listbox.innerHTML = `
        <div class="lookup-option lookup-option--status ${modifier}" role="option" data-disabled="true">
          <span class="lookup-option__title">${escapeHtml(message)}</span>
        </div>
      `;
      setOpen(open);
    }

    function renderLoading(options = {}) {
      renderStatus(loadingText || 'Searching...', 'is-loading', options);
    }

    function renderOptions(rows = [], { open = true } = {}) {
      const normalizedRows = Array.isArray(rows) ? rows : [];
      targetMap.clear();
      lookupState.options = normalizedRows
        .map((row) => {
          const label = getLabel(row);
          return {
            id: row.id || '',
            label,
            title: getTitle(row) || label,
            meta: getMeta(row) || '',
          };
        })
        .filter((option) => option.id && option.label)
        .map((option, index) => ({ ...option, index }));
      lookupState.options.forEach((option) => targetMap.set(option.label, option.id));

      if (!lookupState.options.length) {
        renderStatus(emptyText || 'No matches found.', '', { open });
        return;
      }

      listbox.innerHTML = lookupState.options
        .map(
          (option) => `
            <div
              class="lookup-option"
              id="${escapeAttr(`${listboxId}-option-${option.index}`)}"
              role="option"
              aria-selected="false"
              data-lookup-option="true"
              data-index="${escapeAttr(option.index)}"
            >
              <span class="lookup-option__title">${escapeHtml(option.title)}</span>
              ${option.meta ? `<span class="lookup-option__meta">${escapeHtml(option.meta)}</span>` : ''}
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
      onSelect(option);
      input.focus();
    }

    function syncHiddenId() {
      const matchedId = targetMap.get(input.value);
      if (matchedId) {
        hiddenInput.value = matchedId;
        return;
      }
      if (!input.value) hiddenInput.value = '';
    }

    function setSelection(row) {
      const label = row ? getLabel(row) : '';
      input.value = label;
      hiddenInput.value = row?.id || '';
      setOpen(false);
    }

    const debouncedSearch = debounce(() => {
      if (typeof onSearch === 'function') onSearch(input.value.trim());
    }, 250);

    input.addEventListener('focus', () => {
      if (lookupState.options.length) {
        setOpen(true);
        return;
      }
      if (typeof onSearch === 'function') onSearch(input.value.trim(), { open: true });
    });

    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!root.contains(document.activeElement)) setOpen(false);
      }, 0);
    });

    input.addEventListener('input', () => {
      hiddenInput.value = '';
      renderLoading();
      debouncedSearch();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
        if (!lookupState.options.length) return;
        setActiveIndex(
          lookupState.activeIndex < lookupState.options.length - 1 ? lookupState.activeIndex + 1 : 0,
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
        if (!lookupState.options.length) return;
        setActiveIndex(
          lookupState.activeIndex > 0 ? lookupState.activeIndex - 1 : lookupState.options.length - 1,
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
      const option = event.target.closest('[data-lookup-option]');
      if (!option) return;
      selectOption(Number(option.dataset.index));
    });

    return {
      close() {
        setOpen(false);
      },
      clear() {
        targetMap.clear();
        hiddenInput.value = '';
        input.value = '';
        listbox.innerHTML = '';
        setOpen(false);
      },
      renderLoading,
      renderOptions,
      setSelection,
      syncHiddenId,
    };
  }

  function setActiveTab(nextTab) {
    state.activeTab = nextTab || 'overview';
    syncTabPanels({ activeTab: state.activeTab, tabButtons, tabPanels });
    if (state.activeTab === 'report' && !state.report.loaded && !state.report.isBusy) {
      void refreshReport();
    }
  }

  function getQueryState() {
    return JSON.stringify(
      TABLE_KEYS.reduce((payload, key) => {
        const table = state.tables[key];
        payload[key] = {
          page: table.page,
          limit: table.limit,
          filters: table.filters,
          sortColumn: table.sortColumn,
          sortDirection: table.sortDirection,
        };
        return payload;
      }, {}),
    );
  }

  function getDefaultReportRange() {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return {
      fromDate: toDateInputValue(from),
      toDate: toDateInputValue(today),
    };
  }

  function initializeReportFilterDefaults() {
    const defaults = getDefaultReportRange();
    const fromInput = byId('laundry-report-from-date-input');
    const toInput = byId('laundry-report-to-date-input');
    if (fromInput && !fromInput.value) fromInput.value = defaults.fromDate;
    if (toInput && !toInput.value) toInput.value = defaults.toDate;
  }

  function buildReportTableState() {
    return {
      daily: {
        page: state.report.dailyPage,
        limit: state.report.dailyLimit,
      },
      country: {
        page: state.report.countryPage,
        limit: state.report.countryLimit,
        filters: state.report.countryFilters,
        sortColumn: state.report.countrySortColumn,
        sortDirection: state.report.countrySortDirection,
      },
      history: {
        page: state.report.historyPage,
        limit: state.report.historyLimit,
        filters: state.report.filters,
        sortColumn: state.report.sortColumn,
        sortDirection: state.report.sortDirection,
      },
    };
  }

  function getReportQuery({ notify = true } = {}) {
    const fromDate = byId('laundry-report-from-date-input')?.value || '';
    const toDate = byId('laundry-report-to-date-input')?.value || '';
    if (!fromDate || !toDate) {
      if (notify) {
        toast.show({
          title: 'Missing information',
          message: 'Select both report dates before loading the report.',
          variant: 'warning',
        });
      }
      return null;
    }
    if (fromDate > toDate) {
      if (notify) {
        toast.show({
          title: 'Invalid date interval',
          message: 'From date cannot be after To date.',
          variant: 'warning',
        });
      }
      return null;
    }
    return { fromDate, toDate };
  }

  function buildReportQuery(baseQuery = getReportQuery()) {
    if (!baseQuery) return null;
    return {
      ...baseQuery,
      state: JSON.stringify(buildReportTableState()),
    };
  }

  function resetReportTableState() {
    state.report.dailyPage = 1;
    state.report.countryPage = 1;
    state.report.historyPage = 1;
    state.report.filters = {
      dateDropOff: '',
      dateReadyToPickUp: '',
      status: '',
      flowType: '',
      bagCode: '',
      soldierName: '',
      soldierCountry: '',
    };
    state.report.sortColumn = null;
    state.report.sortDirection = 'default';
    state.report.countryFilters = {};
    state.report.countrySortColumn = null;
    state.report.countrySortDirection = 'default';
    document.querySelectorAll('[data-laundry-report-filter-column]').forEach((input) => {
      if (input instanceof HTMLInputElement) input.value = '';
    });
    document.querySelectorAll('[data-laundry-country-filter-column]').forEach((input) => {
      if (input instanceof HTMLInputElement) input.value = '';
    });
  }

  function resetReportDateFiltersToDefault() {
    const defaults = getDefaultReportRange();
    const fromInput = byId('laundry-report-from-date-input');
    const toInput = byId('laundry-report-to-date-input');
    if (fromInput) fromInput.value = defaults.fromDate;
    if (toInput) toInput.value = defaults.toDate;
    state.report.fromDate = '';
    state.report.toDate = '';
  }

  async function handleReportDateFilterChange() {
    state.report.fromDate = '';
    state.report.toDate = '';
    state.report.dailyPage = 1;
    state.report.countryPage = 1;
    state.report.historyPage = 1;
    syncReportDownloadButton();

    const fromDate = byId('laundry-report-from-date-input')?.value || '';
    const toDate = byId('laundry-report-to-date-input')?.value || '';
    if (!fromDate || !toDate) return;

    await refreshReport({ quiet: true });
  }

  function syncReportDownloadButton() {
    const button = byId('download-laundry-report-button');
    if (!button) return;
    const fromDate = state.report.fromDate || byId('laundry-report-from-date-input')?.value || '';
    const toDate = state.report.toDate || byId('laundry-report-to-date-input')?.value || '';
    const query = fromDate && toDate && fromDate <= toDate ? { fromDate, toDate } : null;
    const disabled = !canViewReport() || state.report.isBusy || !query;
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    button.href = disabled ? '#' : api.getLaundryReportDownloadUrl(buildReportQuery(query));
  }

  function applyReportTableResult(rows, meta = {}) {
    state.report.rows = Array.isArray(rows) ? rows : [];
    state.report.historyPage = Number(meta.page) || state.report.historyPage || 1;
    state.report.historyLimit = Number(meta.limit) || state.report.historyLimit || 10;
    state.report.historyTotalRows = Number(meta.total) || 0;
    state.report.historyTotalPages = Number(meta.totalPages) || 1;
    state.report.historySourceTotal = Number(meta.sourceTotal) || 0;
    state.report.sortColumn = meta.sortColumn || null;
    state.report.sortDirection = meta.sortDirection || 'default';
  }

  function applyReportDailyResult(rows, meta = {}) {
    state.report.dailyTotals = Array.isArray(rows) ? rows : [];
    state.report.dailyPage = Number(meta.page) || state.report.dailyPage || 1;
    state.report.dailyLimit = Number(meta.limit) || state.report.dailyLimit || 10;
    state.report.dailyTotalRows = Number(meta.total) || 0;
    state.report.dailyTotalPages = Number(meta.totalPages) || 1;
    state.report.dailySourceTotal = Number(meta.sourceTotal) || 0;
  }

  function applyReportCountryResult(rows, meta = {}) {
    state.report.countryTotals = Array.isArray(rows) ? rows : [];
    state.report.countryPage = Number(meta.page) || state.report.countryPage || 1;
    state.report.countryLimit = Number(meta.limit) || state.report.countryLimit || 10;
    state.report.countryTotalRows = Number(meta.total) || 0;
    state.report.countryTotalPages = Number(meta.totalPages) || 1;
    state.report.countrySourceTotal = Number(meta.sourceTotal) || 0;
    state.report.countryFilters = meta.filters && typeof meta.filters === 'object' ? meta.filters : {};
    state.report.countrySortColumn = meta.sortColumn || null;
    state.report.countrySortDirection = meta.sortDirection || 'default';
  }

  async function loadOverview({ quiet = false } = {}) {
    const request = overviewScope.next();
    if (!quiet) pageState.set('loading', 'Loading laundry overview...');

    const result = await api.getOverview({ state: getQueryState() }, request.signal);
    if (result.aborted || !overviewScope.isCurrent(request.token)) return false;

    if (!result.ok) {
      pageState.set(
        result.pageState || 'error',
        result.message || 'Laundry overview is not available right now.',
      );
      TABLE_KEYS.forEach((tableKey) => {
        applyTableMeta(tableKey, {});
        renderTable(tableKey, []);
      });
      ACTIVE_STATUSES.forEach((status) => renderTypeBreakdown(status, []));
      if (!quiet) {
        showRequestFailureToast(result, 'Laundry overview failed');
      }
      return false;
    }

    pageState.clear();
    applyOverview(result.data || {});
    return true;
  }

  function applyOverview(data) {
    state.rowsById.clear();
    const allRows = Array.isArray(data.lookups?.rows) ? data.lookups.rows : [];
    allRows.forEach((row) => state.rowsById.set(String(row.id), row));

    setText('laundry-count-total', data.total ?? 0);
    setText('laundry-count-available', data.pickUp ?? 0);
    setText('laundry-count-drop-off', data.dropOff ?? 0);
    setText('laundry-count-facility', data.laundryFacility ?? 0);
    setText('laundry-count-ready', data.readyToPickUp ?? 0);
    setText('laundry-count-in-soldier', data.inSoldier ?? 0);
    setText('laundry-count-active', data.active ?? 0);
    setText(
      'laundry-available-share',
      data.total ? `${Math.round(((Number(data.pickUp) || 0) / Number(data.total)) * 100)}%` : '0%',
    );

    TABLE_KEYS.forEach((tableKey) => {
      applyTableMeta(tableKey, data.tables?.[tableKey] || {});
      renderTable(tableKey, getNested(data, TABLE_ROW_SOURCES[tableKey]) || []);
    });
    ACTIVE_STATUSES.forEach((status) => {
      renderTypeBreakdown(status, data.statusTypeBreakdown?.[status] || []);
    });
    syncOpenMoveModalFromOverview();
    updateControlVisibility();
  }


  function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = String(value);
  }

  function renderTypeBreakdown(status, items) {
    const node = document.querySelector(`[data-laundry-type-breakdown="${status}"]`);
    if (!node) return;
    const breakdown = Array.isArray(items) ? items : [];

    if (!breakdown.length) {
      node.innerHTML = '<span class="type-breakdown__empty">No bags in this status.</span>';
      return;
    }

    node.innerHTML = breakdown
      .map(
        (item) => `
          <span class="type-breakdown__item">
            <span class="type-breakdown__label">${escapeHtml(item.type || 'Unspecified')}</span>
            <strong class="type-breakdown__count">${escapeHtml(Number(item.count) || 0)}</strong>
          </span>
        `,
      )
      .join('');
  }

  function renderBulkSummary(summary = null) {
    const node = byId('laundry-bulk-summary');
    if (!node) return;
    if (!summary) {
      node.innerHTML = '';
      return;
    }

    const items = [
      { label: 'Added', value: Number(summary.addedCount) || 0 },
      { label: 'Updated', value: Number(summary.updatedCount) || 0 },
      { label: 'Skipped', value: Number(summary.skippedCount ?? summary.missingCount) || 0 },
      { label: 'Errors', value: Number(summary.errorCount) || 0 },
    ];
    node.innerHTML = items
      .map(
        (item) => `
          <div class="laundry-bulk-summary-item">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `,
      )
      .join('');
  }

  function renderBulkErrors(errors = []) {
    const node = byId('laundry-bulk-errors');
    if (!node) return;
    if (!errors.length) {
      node.hidden = true;
      node.innerHTML = '';
      return;
    }

    node.hidden = false;
    node.innerHTML = errors
      .map(
        (error) =>
          `<div>Row ${escapeHtml(error.rowNumber)}: ${escapeHtml(error.message || 'The row could not be processed.')}</div>`,
      )
      .join('');
  }

  function renderBulkProgress({
    visible = state.import.visible,
    fileName = state.import.fileName,
    uploadPercent = state.import.uploadPercent,
    processingPercent = state.import.processingPercent,
    statusMessage = state.import.statusMessage,
    summary = state.import.summary,
    errors = state.import.errors,
  } = {}) {
    const panel = byId('laundry-bulk-progress-panel');
    if (!panel) return;
    panel.hidden = !visible;
    setText('bag-template-selected-file', fileName || 'No file selected.');
    setText('laundry-bulk-upload-label', `${uploadPercent}%`);
    setText('laundry-bulk-processing-label', `${processingPercent}%`);
    const uploadBar = byId('laundry-bulk-upload-progress-bar');
    const processingBar = byId('laundry-bulk-processing-progress-bar');
    setProgressValue(uploadBar, uploadPercent);
    setProgressValue(processingBar, processingPercent);
    setText('laundry-bulk-status-message', statusMessage || 'Waiting to start.');
    renderBulkSummary(summary);
    renderBulkErrors(errors);
    setDisabled(byId('upload-bag-template-button'), !canImport() || state.import.isBusy);
    setDisabled(byId('bag-template-file-input'), !canImport() || state.import.isBusy);
  }

  function resetBulkProgress({ keepFileName = false } = {}) {
    state.import.uploadPercent = 0;
    state.import.processingPercent = 0;
    state.import.statusMessage = 'Download the template to begin.';
    state.import.summary = null;
    state.import.errors = [];
    state.import.visible = false;
    state.import.isBusy = false;
    if (!keepFileName) state.import.fileName = '';
    renderBulkProgress();
  }

  function clearBulkImportModal() {
    const input = byId('bag-template-file-input');
    if (input) input.value = '';
    resetBulkProgress();
  }

  function applyBulkImportPayload(payload = {}) {
    const summary = payload.summary || state.import.summary;
    state.import.visible = true;
    state.import.statusMessage = payload.message || state.import.statusMessage;
    state.import.processingPercent = Number(payload.progressPercent) || 0;
    if (state.import.processingPercent > 0) state.import.uploadPercent = 100;
    if (summary) {
      state.import.summary = {
        totalRows: Number(summary.totalRows) || 0,
        processedRows: Number(summary.processedRows ?? summary.totalRows) || 0,
        addedCount: Number(summary.addedCount) || 0,
        updatedCount: Number(summary.updatedCount) || 0,
        skippedCount: Number(summary.skippedCount ?? summary.missingCount) || 0,
        errorCount: Number(summary.errorCount) || 0,
      };
      if (Array.isArray(summary.errors)) state.import.errors = summary.errors;
    }
    if (Array.isArray(payload.errors)) state.import.errors = payload.errors;
    renderBulkProgress();
  }

  async function handleTemplateUpload() {
    if (!canImport()) {
      updateControlVisibility();
      return;
    }
    const input = byId('bag-template-file-input');
    const file = input?.files?.[0];
    if (!file) {
      toast.show({
        title: 'Missing information',
        message: 'Choose a completed laundry bag template before uploading.',
        variant: 'warning',
      });
      return;
    }

    state.import.fileName = file.name;
    state.import.uploadPercent = 0;
    state.import.processingPercent = 0;
    state.import.statusMessage = 'Uploading template...';
    state.import.summary = null;
    state.import.errors = [];
    state.import.visible = true;
    state.import.isBusy = true;
    renderBulkProgress();

    const result = await api.importBagTemplate(file, {
      onUploadProgress(progress) {
        state.import.visible = true;
        state.import.uploadPercent = progress;
        state.import.statusMessage =
          progress >= 100 ? 'Upload complete. Processing template...' : 'Uploading template...';
        renderBulkProgress();
      },
    });

    state.import.isBusy = false;
    const rowErrors = buildBulkMissingErrors(result.data?.rows || []);
    const summaryErrors = Array.isArray(result.data?.summary?.errors)
      ? result.data.summary.errors
      : [];
    const errors = [...summaryErrors, ...rowErrors];

    if (result.data?.summary) {
      applyBulkImportPayload({
        summary: result.data.summary,
        errors,
        message: result.data.message,
        progressPercent:
          Number(result.data.summary?.totalRows) > 0
            ? Math.round(
                ((Number(result.data.summary?.processedRows) ||
                  Number(result.data.summary?.totalRows) ||
                  0) /
                  Number(result.data.summary.totalRows)) *
                  100,
              )
            : 0,
      });
    } else {
      state.import.statusMessage = result.message || 'The laundry template request could not be completed.';
      state.import.visible = true;
      renderBulkProgress();
    }

    if (!result.ok) {
      pageState.set(
        result.pageState || 'error',
        result.message || 'The laundry template could not be processed.',
      );
      toast.show({
        title: 'Import failed',
        message: result.message || 'The laundry template could not be processed.',
        variant: 'danger',
      });
      return;
    }

    if (input) input.value = '';
    pageState.set('success', result.data?.message || 'Laundry import completed.');
    toast.show({
      title: errors.length ? 'Import completed with warnings' : 'Import completed',
      message: result.data?.message || 'The laundry template was processed successfully.',
      variant: errors.length ? 'warning' : 'success',
    });
    await loadOverview({ quiet: true });
  }

  function renderReportTableControls() {
    const headerIds = {
      dateDropOff: 'laundry-report-drop-off-header',
      dateReadyToPickUp: 'laundry-report-ready-header',
      status: 'laundry-report-status-header',
      flowType: 'laundry-report-flow-header',
      bagCode: 'laundry-report-bag-header',
      soldierName: 'laundry-report-soldier-header',
      soldierCountry: 'laundry-report-country-header',
    };

    Object.entries(headerIds).forEach(([column, headerId]) => {
      const active = state.report.sortColumn === column;
      const direction = active ? state.report.sortDirection : 'default';
      const indicator = document.querySelector(
        `[data-laundry-report-sort-indicator="${column}"]`,
      );
      const header = byId(headerId);
      if (indicator) {
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      }
      header?.setAttribute(
        'aria-sort',
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      );
    });
  }

  function renderCountryTableControls() {
    const headerIds = {
      country: 'laundry-report-country-country-header',
      totalCount: 'laundry-report-country-total-header',
      beingWashedCount: 'laundry-report-country-being-washed-header',
      washableCount: 'laundry-report-country-washable-header',
      linenExchangeCount: 'laundry-report-country-linen-header',
    };

    Object.entries(headerIds).forEach(([column, headerId]) => {
      const active = state.report.countrySortColumn === column;
      const direction = active ? state.report.countrySortDirection : 'default';
      const indicator = document.querySelector(
        `[data-laundry-country-sort-indicator="${column}"]`,
      );
      const header = byId(headerId);
      if (indicator) {
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      }
      header?.setAttribute(
        'aria-sort',
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      );
    });
  }

  function renderReportPagination({ pageLabelId, prevButtonId, nextButtonId, pageKey, totalPagesKey }) {
    const pageLabel = byId(pageLabelId);
    const prevButton = byId(prevButtonId);
    const nextButton = byId(nextButtonId);
    const totalPages = state.report[totalPagesKey];
    if (pageLabel) pageLabel.textContent = `Page ${state.report[pageKey]} of ${totalPages}`;
    setDisabled(prevButton, state.report[pageKey] <= 1);
    setDisabled(nextButton, state.report[pageKey] >= totalPages);
  }

  function renderReport() {
    const dailyBody = byId('laundry-report-daily-body');
    const countryBody = byId('laundry-report-country-body');
    const historyBody = byId('laundry-report-history-body');
    const rows = Array.isArray(state.report.rows) ? state.report.rows : [];
    const dailyTotals = Array.isArray(state.report.dailyTotals) ? state.report.dailyTotals : [];
    const countryTotals = Array.isArray(state.report.countryTotals) ? state.report.countryTotals : [];

    renderReportTableControls();
    renderCountryTableControls();
    setText('laundry-report-row-count', state.report.historyTotalRows);
    setText('laundry-report-active-count', state.report.beingWashedCount);
    setText('laundry-report-washed-count', state.report.washedCount);
    setText('laundry-report-linen-count', state.report.linenExchangeCount);
    renderReportPagination({
      pageLabelId: 'laundry-report-daily-page-label',
      prevButtonId: 'laundry-report-daily-prev-button',
      nextButtonId: 'laundry-report-daily-next-button',
      pageKey: 'dailyPage',
      totalPagesKey: 'dailyTotalPages',
    });
    renderReportPagination({
      pageLabelId: 'laundry-report-country-page-label',
      prevButtonId: 'laundry-report-country-prev-button',
      nextButtonId: 'laundry-report-country-next-button',
      pageKey: 'countryPage',
      totalPagesKey: 'countryTotalPages',
    });
    renderReportPagination({
      pageLabelId: 'laundry-report-history-page-label',
      prevButtonId: 'laundry-report-history-prev-button',
      nextButtonId: 'laundry-report-history-next-button',
      pageKey: 'historyPage',
      totalPagesKey: 'historyTotalPages',
    });

    if (dailyBody) {
      dailyBody.innerHTML = dailyTotals.length
        ? dailyTotals
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.date)}</td>
                  <td>${escapeHtml(row.totalCount ?? 0)}</td>
                  <td>${escapeHtml(row.beingWashedCount ?? 0)}</td>
                  <td>${escapeHtml(row.washedCount ?? 0)}</td>
                  <td>${escapeHtml(row.linenExchangeCount ?? 0)}</td>
                </tr>
              `,
            )
            .join('')
        : '<tr><td colspan="5" class="table-empty">No daily totals are available for the selected interval.</td></tr>';
    }

    if (countryBody) {
      countryBody.innerHTML = countryTotals.length
        ? countryTotals
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.country || 'Unknown')}</td>
                  <td>${escapeHtml(row.totalCount ?? 0)}</td>
                  <td>${escapeHtml(row.beingWashedCount ?? 0)}</td>
                  <td>${escapeHtml(row.washableCount ?? 0)}</td>
                  <td>${escapeHtml(row.linenExchangeCount ?? 0)}</td>
                </tr>
              `,
            )
            .join('')
        : '<tr><td colspan="5" class="table-empty">No washed bags by country match the selected interval.</td></tr>';
    }

    if (historyBody) {
      historyBody.innerHTML = rows.length
        ? rows
            .map((row) => {
              const status = String(row.status || 'being_washed').toLowerCase();
              const flowClass = row.isLinenExchange ? 'linen_exchange' : 'washed';
              return `
                <tr>
                  <td>${escapeHtml(row.dateDropOff ? formatDateTime(row.dateDropOff) : 'None')}</td>
                  <td>${escapeHtml(row.dateReadyToPickUp ? formatDateTime(row.dateReadyToPickUp) : 'Active')}</td>
                  <td><span class="status-pill status-pill--${escapeAttr(status)}">${escapeHtml(reportStatusLabel(status))}</span></td>
                  <td><span class="status-pill status-pill--${escapeAttr(flowClass)}">${escapeHtml(row.flowType || 'Laundry wash')}</span></td>
                  <td>${escapeHtml(row.bagCode || 'Unknown')}</td>
                  <td>${escapeHtml(row.soldierName || 'Unassigned')}</td>
                  <td>${escapeHtml(row.soldierCountry || 'Unknown')}</td>
                </tr>
              `;
            })
            .join('')
        : `<tr><td colspan="7" class="table-empty">${escapeHtml(
            state.report.historySourceTotal
              ? 'No laundry history matches the current search.'
              : 'No laundry history matches the selected interval.',
          )}</td></tr>`;
    }

    syncReportDownloadButton();
  }

  async function refreshReport({ quiet = false, notifyInvalid = true } = {}) {
    if (!canViewReport()) {
      updateControlVisibility();
      return false;
    }
    const query = getReportQuery({ notify: notifyInvalid });
    if (!query) {
      syncReportDownloadButton();
      return false;
    }

    state.report.isBusy = true;
    if (!quiet) pageState.set('loading', 'Loading laundry report...');
    updateControlVisibility();

    const request = reportScope.next();
    const result = await api.getLaundryReport(buildReportQuery(query), request.signal);
    if (result.aborted || !reportScope.isCurrent(request.token)) return false;

    state.report.isBusy = false;
    if (!result.ok) {
      state.report.rows = [];
      state.report.dailyTotals = [];
      state.report.countryTotals = [];
      state.report.totalBags = 0;
      state.report.beingWashedCount = 0;
      state.report.washedCount = 0;
      state.report.linenExchangeCount = 0;
      state.report.loaded = false;
      renderReport();
      pageState.set(
        result.pageState || 'error',
        result.message || 'Laundry report is not available right now.',
      );
      toast.show({
        title: 'Report failed',
        message: result.message || 'The laundry report could not be loaded.',
        variant: 'danger',
      });
      updateControlVisibility();
      return false;
    }

    const body = result.data || {};
    applyReportTableResult(body.rows, body.tables?.history);
    applyReportDailyResult(body.dailyTotals, body.tables?.daily);
    applyReportCountryResult(body.countryTotals, body.tables?.country);
    state.report.fromDate = body.fromDate || query.fromDate;
    state.report.toDate = body.toDate || query.toDate;
    state.report.totalBags = Number(body.totalBags) || 0;
    state.report.beingWashedCount = Number(body.beingWashedCount) || 0;
    state.report.washedCount = Number(body.washedCount) || 0;
    state.report.linenExchangeCount = Number(body.linenExchangeCount) || 0;
    state.report.loaded = true;
    renderReport();
    pageState.clear();
    updateControlVisibility();
    return true;
  }

  function applyTableMeta(tableKey, meta = {}) {
    const table = state.tables[tableKey];
    if (!table) return;
    table.page = Number(meta.page) || 1;
    table.limit = Number(meta.limit) || 10;
    table.total = Number(meta.total) || 0;
    table.totalPages = Number(meta.totalPages) || 1;
    table.sourceTotal = Number(meta.sourceTotal) || 0;
    table.filters = meta.filters && typeof meta.filters === 'object' ? meta.filters : {};
    table.sortColumn = meta.sortColumn || null;
    table.sortDirection = meta.sortDirection || 'default';

    const label = document.querySelector(`[data-laundry-page-label="${tableKey}"]`);
    if (label) {
      label.textContent =
        table.total > 0 ? `Page ${table.page} of ${table.totalPages}` : 'Page 1 of 1';
    }

    const prev = document.querySelector(`[data-laundry-prev-table="${tableKey}"]`);
    const next = document.querySelector(`[data-laundry-next-table="${tableKey}"]`);
    setDisabled(prev, table.total <= 0 || table.totalPages <= 1 || table.page <= 1);
    setDisabled(next, table.total <= 0 || table.totalPages <= 1 || table.page >= table.totalPages);

    qsa(`[data-laundry-sort-table="${tableKey}"][data-laundry-sort-column]`).forEach((button) => {
      const column = button.getAttribute('data-laundry-sort-column');
      const active = table.sortColumn === column;
      const direction = active ? table.sortDirection : 'default';
      const indicator = document.querySelector(
        `[data-laundry-sort-indicator="${tableKey}:${column}"]`,
      );
      if (indicator) indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      const th = button.closest('th');
      th?.setAttribute(
        'aria-sort',
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      );
    });
  }

  function getTableColumnCount(tableKey) {
    return (TABLE_COLUMNS[tableKey] || TABLE_COLUMNS.all).length + 1;
  }

  function renderTable(tableKey, rows) {
    const body = document.querySelector(`[data-laundry-table-body="${tableKey}"]`);
    if (!body) return;
    const data = Array.isArray(rows) ? rows : [];
    const table = state.tables[tableKey];
    const colspan = getTableColumnCount(tableKey);
    if (!table?.sourceTotal) {
      body.innerHTML =
        `<tr><td colspan="${colspan}" class="table-empty">No laundry bags are available for the current camp.</td></tr>`;
      return;
    }

    if (!table.total) {
      body.innerHTML =
        `<tr><td colspan="${colspan}" class="table-empty">No laundry bags match the current table state.</td></tr>`;
      return;
    }

    body.innerHTML = data.map((row) => renderBagRow(row, tableKey)).join('');
  }

  function renderBagRow(row, tableKey) {
    const canEditRow = canEdit();
    const canDeleteRow = canDeleteBag(row);
    const canMoveRow = canMoveBag(row);
    const canExchangeRow = canRecordLinenExchange(row);
    const moveTitle = canMove()
      ? row?.soldierId
        ? 'Move this bag.'
        : 'Only bags assigned to a soldier can be moved.'
      : 'You do not have permission to move laundry bags.';
    const exchangeTitle = canMove()
      ? row?.soldierId
        ? 'Record linen exchange.'
        : 'Only bags assigned to a soldier can be used for linen exchange.'
      : 'You do not have permission to record linen exchanges.';
    const editTitle = canEdit()
      ? 'Edit this bag.'
      : 'You do not have permission to edit laundry bags.';
    const deleteTitle = getDeleteTitle(row);
    const cellRenderers = {
      id: () => `<td><code>${escapeHtml(row.id)}</code></td>`,
      code: () => `<td>${escapeHtml(row.code || '')}</td>`,
      rfidCode: () => `<td><code>${escapeHtml(row.rfidCode || '')}</code></td>`,
      type: () => `<td>${escapeHtml(row.type || 'Unspecified')}</td>`,
      status: () =>
        `<td><span class="status-pill status-pill--${escapeAttr(row.displayStatus || row.status)}">${escapeHtml(
          row.statusLabel || statusLabel(row.status),
        )}</span></td>`,
      soldierName: () => `<td>${escapeHtml(row.soldierName || 'Unassigned')}</td>`,
      laundryCount: () => `<td>${escapeHtml(row.laundryCount ?? 0)}</td>`,
      maxCountLaundry: () => `<td>${escapeHtml(row.maxCountLaundry ?? 1)}</td>`,
    };
    const cells = (TABLE_COLUMNS[tableKey] || TABLE_COLUMNS.all)
      .map((column) => cellRenderers[column]?.())
      .filter(Boolean);

    const actions = [
      `<button class="btn btn-primary" type="button" data-laundry-action="edit" data-bag-id="${escapeAttr(
        row.id,
      )}" ${canEditRow ? '' : 'disabled'} title="${escapeAttr(editTitle)}"><svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span></button>`,
      `<button class="btn btn-secondary" type="button" data-laundry-action="move" data-bag-id="${escapeAttr(
        row.id,
      )}" ${canMoveRow ? '' : 'disabled'} title="${escapeAttr(moveTitle)}"><svg class="icon" aria-hidden="true"><use href="#icon-refresh"></use></svg><span>Move</span></button>`,
      `<button class="btn btn-secondary" type="button" data-laundry-action="linen-exchange" data-bag-id="${escapeAttr(
        row.id,
      )}" ${canExchangeRow ? '' : 'disabled'} title="${escapeAttr(exchangeTitle)}"><svg class="icon" aria-hidden="true"><use href="#icon-refresh"></use></svg><span>Linen exchange</span></button>`,
      `<button class="btn btn-danger" type="button" data-laundry-action="delete" data-bag-id="${escapeAttr(
        row.id,
      )}" ${canDeleteRow ? '' : 'disabled'} title="${escapeAttr(deleteTitle)}"><svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span></button>`,
    ];

    cells.push(`<td><div class="table-action-group">${actions.join('')}</div></td>`);
    return `<tr>${cells.join('')}</tr>`;
  }

  function openBagModal(row = null) {
    bagModalState.clear();
    const form = byId('bag-form');
    form?.reset();
    byId('bag-form-mode').value = row?.id ? 'edit' : 'create';
    byId('bag-id-input').value = row?.id || '';
    byId('bag-code-input').value = row?.code || '';
    byId('bag-rfid-input').value = row?.rfidCode || '';
    byId('bag-type-input').value = row?.type || '';
    byId('bag-max-count-input').value = row?.maxCountLaundry || 1;
    byId('bag-status-value-input').value = 'pick_up';
    byId('bag-modal-title').textContent = row?.id ? 'Edit laundry bag' : 'Add laundry bag';
    byId('bag-modal-text').textContent = row?.id
      ? 'Update the selected bag details, RFID code, and laundry limit.'
      : 'Register a laundry bag with its code, RFID code, type, and laundry limit. New bags are added as Available.';
    byId('save-bag-button').textContent = row?.id ? 'Save changes' : 'Create bag';
    updateControlVisibility();
    modals.bag?.open();
  }

  async function openAddStatusModal(status) {
    statusAddModalState.clear();
    byId('status-add-target-input').value = status;
    byId('status-add-modal-title').textContent = `Add bag to ${statusLabel(status)}`;
    byId('status-add-modal-text').textContent =
      'Search the available inventory, choose a bag, and place it into the selected status lane.';
    statusBagLookup.clear();
    await loadAvailableOptions('', { open: false });
    updateControlVisibility();
    modals.addStatus?.open();
  }

  function openMoveModal(row) {
    if (!row) return;
    moveBagModalState.clear();
    state.moveSourceStatus = row.status || '';
    byId('move-bag-id-input').value = row.id;
    syncMoveModalDestinationOptions({ open: false, forceDefault: true });
    byId('move-bag-modal-title').textContent = `Move ${row.code || 'bag'}`;
    byId('move-bag-code-text').textContent = row.code || 'Unknown';
    byId('move-bag-current-status-text').textContent = statusLabel(row.status);
    byId('move-bag-soldier-text').textContent = row.soldierName || 'Unassigned';
    byId('move-bag-count-text').textContent = `${row.laundryCount ?? 0} / ${row.maxCountLaundry ?? 1}`;
    updateControlVisibility();
    modals.move?.open();
  }

  async function loadAvailableOptions(search = '', { open = true } = {}) {
    statusBagLookup.renderLoading({ open });
    const request = lookupScope.next();
    const result = await api.searchAvailableBags({ search, limit: 30 }, request.signal);
    if (result.aborted || !lookupScope.isCurrent(request.token)) return;

    if (!result.ok) {
      statusBagLookup.renderOptions([], { open });
      return;
    }

    const rows = Array.isArray(result.data?.rows) ? result.data.rows : [];
    statusBagLookup.renderOptions(rows, { open });
  }

  function getAllowedMoveStatusOptions(sourceStatus) {
    const allowedStatuses = LAUNDRY_STATUS_TRANSITIONS[sourceStatus] || [];
    return LAUNDRY_STATUS_OPTIONS.filter((option) => allowedStatuses.includes(option.id));
  }

  function loadStatusOptions(lookup, search = '', { open = true, sourceStatus = '' } = {}) {
    const query = String(search || '').trim().toLowerCase();
    const sourceRows = sourceStatus ? getAllowedMoveStatusOptions(sourceStatus) : LAUNDRY_STATUS_OPTIONS;
    const rows = sourceRows.filter(
      (status) => !query || status.label.toLowerCase().includes(query) || status.id.includes(query),
    );
    lookup.renderOptions(rows, { open });
    lookup.syncHiddenId();
  }

  function isMoveModalOpen() {
    return Boolean(byId('move-bag-modal') && !byId('move-bag-modal').hidden);
  }

  function syncMoveModalDestinationOptions({ open = false, forceDefault = false } = {}) {
    const allowedOptions = getAllowedMoveStatusOptions(state.moveSourceStatus);
    const selectedStatus = byId('move-bag-status-value-input')?.value || '';
    const selectedOption = allowedOptions.find((option) => option.id === selectedStatus);
    loadStatusOptions(moveBagStatusLookup, '', { open, sourceStatus: state.moveSourceStatus });
    if (forceDefault || !selectedOption) moveBagStatusLookup.setSelection(allowedOptions[0] || null);
  }

  function syncOpenMoveModalFromOverview() {
    if (!isMoveModalOpen()) return;

    const bagId = byId('move-bag-id-input')?.value || '';
    const row = state.rowsById.get(String(bagId));
    if (!row || !canMoveBag(row)) {
      state.moveSourceStatus = '';
      moveBagStatusLookup.clear();
      modals.move?.close();
      return;
    }

    state.moveSourceStatus = row.status || '';
    byId('move-bag-modal-title').textContent = `Move ${row.code || 'bag'}`;
    byId('move-bag-code-text').textContent = row.code || 'Unknown';
    byId('move-bag-current-status-text').textContent = statusLabel(row.status);
    byId('move-bag-soldier-text').textContent = row.soldierName || 'Unassigned';
    byId('move-bag-count-text').textContent = `${row.laundryCount ?? 0} / ${row.maxCountLaundry ?? 1}`;
    syncMoveModalDestinationOptions({ open: isLookupOpen('move-bag-status-input') });
  }

  function isLookupOpen(inputId) {
    return byId(inputId)?.getAttribute('aria-expanded') === 'true';
  }

  function refreshLaundryLookupOptions() {
    const statusBagInput = byId('status-bag-search-input');
    if (!statusBagInput?.disabled) {
      void loadAvailableOptions(statusBagInput.value.trim(), {
        open: isLookupOpen('status-bag-search-input'),
      });
    }

    const moveStatusInput = byId('move-bag-status-input');
    if (!moveStatusInput?.disabled) {
      loadStatusOptions(moveBagStatusLookup, moveStatusInput.value.trim(), {
        open: isLookupOpen('move-bag-status-input'),
        sourceStatus: state.moveSourceStatus,
      });
    }
  }

  function nextSortDirection(direction) {
    if (direction === 'asc') return 'desc';
    if (direction === 'desc') return 'default';
    return 'asc';
  }

  function showRequestFailureToast(result, fallbackTitle = 'Laundry request failed') {
    toast.show({
      title: fallbackTitle,
      message: result?.message || 'The laundry request could not be completed.',
      variant: 'danger',
    });
  }

  function buildBulkMissingErrors(rows = []) {
    return rows
      .filter((row) => row?.action === 'missing')
      .map((row, index) => ({
        rowNumber: row.rowNumber || index + 1,
        message: 'Identifier not found in the selected camp.',
      }));
  }

  async function runAction(action) {
    const request = actionScope.next();
    const result = await action(request.signal);
    if (result.aborted) return false;
    if (!result.ok) {
      pageState.set(
        result.pageState || 'error',
        result.message || result.data?.message || 'The laundry action could not be completed.',
      );
      showRequestFailureToast(result);
      return false;
    }
    pageState.set('success', result.data?.message || 'Laundry action completed.');
    await loadOverview({ quiet: true });
    return true;
  }

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const tabButton = target.closest('[data-tab-trigger]');
    if (tabButton) {
      setActiveTab(tabButton.getAttribute('data-tab-trigger'));
      return;
    }

    if (target.closest('[data-refresh-laundry]')) {
      await loadOverview();
      return;
    }

    const addStatusButton = target.closest('[data-open-add-status-modal]');
    if (addStatusButton) {
      if (!canMove()) return updateControlVisibility();
      await openAddStatusModal(addStatusButton.getAttribute('data-open-add-status-modal'));
      return;
    }

    if (target.closest('#open-add-bag-modal')) {
      if (!canAdd()) return updateControlVisibility();
      openBagModal();
      return;
    }

    if (target.closest('#open-bulk-bag-modal')) {
      if (!canImport()) return updateControlVisibility();
      resetBulkProgress();
      modals.bulk?.open();
      return;
    }

    if (target.closest('#download-bag-template-button')) {
      if (!canImport()) {
        event.preventDefault();
        return updateControlVisibility();
      }
      return;
    }

    if (target.closest('#download-laundry-report-button')) {
      if (byId('download-laundry-report-button')?.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        syncReportDownloadButton();
      }
      return;
    }

    if (target.closest('#upload-bag-template-button')) {
      if (!canImport()) return updateControlVisibility();
      await handleTemplateUpload();
      return;
    }

    if (target.closest('#reset-laundry-report-button')) {
      resetReportTableState();
      resetReportDateFiltersToDefault();
      void refreshReport({ quiet: true });
      return;
    }

    const reportSortButton = target.closest('[data-laundry-report-sort-column]');
    if (reportSortButton) {
      const column = reportSortButton.getAttribute('data-laundry-report-sort-column');
      if (state.report.sortColumn === column) {
        state.report.sortDirection = nextSortDirection(state.report.sortDirection);
      } else {
        state.report.sortColumn = column;
        state.report.sortDirection = 'asc';
      }
      if (state.report.sortDirection === 'default') state.report.sortColumn = null;
      state.report.historyPage = 1;
      void refreshReport({ quiet: true });
      return;
    }

    const countrySortButton = target.closest('[data-laundry-country-sort-column]');
    if (countrySortButton) {
      const column = countrySortButton.getAttribute('data-laundry-country-sort-column');
      if (state.report.countrySortColumn === column) {
        state.report.countrySortDirection = nextSortDirection(state.report.countrySortDirection);
      } else {
        state.report.countrySortColumn = column;
        state.report.countrySortDirection = 'asc';
      }
      if (state.report.countrySortDirection === 'default') {
        state.report.countrySortColumn = null;
      }
      state.report.countryPage = 1;
      void refreshReport({ quiet: true });
      return;
    }

    const sortButton = target.closest('[data-laundry-sort-table][data-laundry-sort-column]');
    if (sortButton) {
      const tableKey = sortButton.getAttribute('data-laundry-sort-table');
      const column = sortButton.getAttribute('data-laundry-sort-column');
      const table = state.tables[tableKey];
      if (table && column) {
        if (table.sortColumn === column) {
          table.sortDirection = nextSortDirection(table.sortDirection);
        } else {
          table.sortColumn = column;
          table.sortDirection = 'asc';
        }
        if (table.sortDirection === 'default') table.sortColumn = null;
        table.page = 1;
        await loadOverview({ quiet: true });
      }
      return;
    }

    const prevButton = target.closest('[data-laundry-prev-table]');
    const nextButton = target.closest('[data-laundry-next-table]');
    if (prevButton || nextButton) {
      const tableKey =
        prevButton?.getAttribute('data-laundry-prev-table') ||
        nextButton?.getAttribute('data-laundry-next-table');
      const table = state.tables[tableKey];
      if (!table) return;
      if (prevButton && (prevButton.disabled || table.page <= 1)) return;
      if (nextButton && (nextButton.disabled || table.page >= table.totalPages || table.total <= 0))
        return;
      table.page = prevButton
        ? Math.max(1, table.page - 1)
        : Math.min(table.totalPages || 1, table.page + 1);
      await loadOverview({ quiet: true });
      return;
    }

    const reportPageTargets = [
      {
        prevId: 'laundry-report-daily-prev-button',
        nextId: 'laundry-report-daily-next-button',
        pageKey: 'dailyPage',
        totalPagesKey: 'dailyTotalPages',
      },
      {
        prevId: 'laundry-report-country-prev-button',
        nextId: 'laundry-report-country-next-button',
        pageKey: 'countryPage',
        totalPagesKey: 'countryTotalPages',
      },
      {
        prevId: 'laundry-report-history-prev-button',
        nextId: 'laundry-report-history-next-button',
        pageKey: 'historyPage',
        totalPagesKey: 'historyTotalPages',
      },
    ];
    const reportPageTarget = reportPageTargets.find(
      (item) => target.closest(`#${item.prevId}`) || target.closest(`#${item.nextId}`),
    );
    if (reportPageTarget) {
      const previous = Boolean(target.closest(`#${reportPageTarget.prevId}`));
      const totalPages = state.report[reportPageTarget.totalPagesKey] || 1;
      if (previous && state.report[reportPageTarget.pageKey] <= 1) return;
      if (!previous && state.report[reportPageTarget.pageKey] >= totalPages) return;
      state.report[reportPageTarget.pageKey] = previous
        ? Math.max(1, state.report[reportPageTarget.pageKey] - 1)
        : Math.min(totalPages, state.report[reportPageTarget.pageKey] + 1);
      void refreshReport({ quiet: true });
      return;
    }

    const actionButton = target.closest('[data-laundry-action][data-bag-id]');
    if (!actionButton) return;
    const bagId = actionButton.getAttribute('data-bag-id');
    const action = actionButton.getAttribute('data-laundry-action');
    const row = state.rowsById.get(String(bagId));

    if (action === 'move') {
      if (!canMoveBag(row)) return updateControlVisibility();
      openMoveModal(row);
      return;
    }
    if (action === 'linen-exchange') {
      if (!canRecordLinenExchange(row)) return updateControlVisibility();
      const confirmed = await confirmAction({
        title: 'Record linen exchange',
        message: () => {
          const currentRow = state.rowsById.get(String(bagId)) || row;
          return `Record a completed linen exchange for ${currentRow?.code || 'this bag'} and add it to the laundry report history.`;
        },
        confirmText: 'Record exchange',
        variant: 'warning',
        canConfirm: () => canRecordLinenExchange(row),
      });
      if (confirmed) {
        const ok = await runAction((signal) => api.recordLinenExchange(bagId, signal));
        if (ok) {
          toast.show({
            title: 'Linen exchange recorded',
            message: `${row?.code || 'Bag'} was added to laundry reports.`,
            variant: 'success',
          });
        }
      }
      return;
    }
    if (action === 'edit') {
      if (!canEdit()) return updateControlVisibility();
      openBagModal(row);
      return;
    }
    if (action === 'remove-status') {
      const confirmed = await confirmAction({
        title: 'Remove from status',
        message: () => {
          const currentRow = state.rowsById.get(String(bagId)) || row;
          return `Move ${currentRow?.code || 'this bag'} out of the active laundry flow and return it to Available inventory.`;
        },
        confirmText: 'Remove',
        canConfirm: canMove,
      });
      if (confirmed) {
        const ok = await runAction((signal) => api.removeBagFromStatus(bagId, signal));
        if (ok) {
          toast.show({
            title: 'Bag moved',
            message: `${row?.code || 'Bag'} moved back to Available.`,
            variant: 'success',
          });
        }
      }
      return;
    }
    if (action === 'delete') {
      if (!canDelete()) return updateControlVisibility();
      const blockedReason = getDeleteBlockedReason(row);
      const confirmed = await confirmAction({
        title: 'Delete bag',
        message: () => {
          const currentRow = state.rowsById.get(String(bagId)) || row;
          return `Permanently remove ${currentRow?.code || 'this bag'} from laundry inventory. This cannot be undone after deletion succeeds.`;
        },
        confirmText: 'Delete',
        variant: 'danger',
        canConfirm: canDelete,
      });
      if (!confirmed) return;
      if (blockedReason) {
        toast.show({
          title: 'Bag cannot be deleted',
          message: blockedReason,
          variant: 'warning',
        });
        return;
      }
      const ok = await runAction((signal) => api.deleteBag(bagId, signal));
      if (ok) {
        toast.show({
          title: 'Bag removed',
          message: `${row?.code || 'Bag'} was removed successfully.`,
          variant: 'success',
        });
      }
    }
  });

  document.addEventListener(
    'input',
    debounce(async (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;

      if (input.matches('[data-laundry-filter-table][data-laundry-filter-column]')) {
        const tableKey = input.getAttribute('data-laundry-filter-table');
        const column = input.getAttribute('data-laundry-filter-column');
        const table = state.tables[tableKey];
        if (!table || !column) return;
        const value = input.value.trim();
        if (value) table.filters[column] = value;
        else delete table.filters[column];
        table.page = 1;
        await loadOverview({ quiet: true });
      }

      if (input.matches('[data-laundry-report-filter-column]')) {
        const column = input.getAttribute('data-laundry-report-filter-column');
        if (!column) return;
        const value = input.value.trim();
        if (value) state.report.filters[column] = value;
        else delete state.report.filters[column];
        state.report.historyPage = 1;
        await refreshReport({ quiet: true });
      }

      if (input.matches('[data-laundry-country-filter-column]')) {
        const column = input.getAttribute('data-laundry-country-filter-column');
        if (!column) return;
        const value = input.value.trim();
        if (value) state.report.countryFilters[column] = value;
        else delete state.report.countryFilters[column];
        state.report.countryPage = 1;
        await refreshReport({ quiet: true });
      }
    }, 280),
  );

  byId('laundry-report-filter-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.report.dailyPage = 1;
    state.report.countryPage = 1;
    state.report.historyPage = 1;
    await refreshReport();
  });

  byId('laundry-report-from-date-input')?.addEventListener('change', () => {
    void handleReportDateFilterChange();
  });

  byId('laundry-report-to-date-input')?.addEventListener('change', () => {
    void handleReportDateFilterChange();
  });

  byId('bag-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mode = byId('bag-form-mode').value || 'create';
    const creating = mode === 'create';
    if (creating && !canAdd()) return updateControlVisibility();
    if (!creating && !canEdit()) return updateControlVisibility();
    const bagId = byId('bag-id-input').value;
    const payload = {
      code: byId('bag-code-input').value.trim(),
      rfidCode: byId('bag-rfid-input').value.trim(),
      type: byId('bag-type-input').value.trim(),
      maxCountLaundry: Number(byId('bag-max-count-input').value) || 1,
    };
    if (!payload.code) {
      showMissingInformation(bagModalState, 'Enter a bag code before saving.', 'bag-code-input');
      return;
    }
    if (!payload.rfidCode) {
      showMissingInformation(bagModalState, 'Enter an RFID code before saving.', 'bag-rfid-input');
      return;
    }

    const confirmed = await confirmAction({
      title: creating ? 'Create laundry bag' : 'Save laundry bag changes',
      message: () => {
        const code = byId('bag-code-input')?.value.trim() || payload.code;
        const rfidCode = byId('bag-rfid-input')?.value.trim() || payload.rfidCode;
        return creating
          ? `Create "${code}" with RFID "${rfidCode}" and add it to Available inventory for this camp.`
          : `Save the edited code, RFID, type, and laundry limit for "${code}".`;
      },
      confirmText: creating ? 'Create bag' : 'Save changes',
      variant: 'warning',
      canConfirm: () => (creating ? canAdd() : canEdit()),
    });
    if (!confirmed) return;

    const ok = await runAction((signal) =>
      bagId
        ? api.editBag({ bagId, ...payload }, signal)
        : api.addBag(payload, signal),
    );
    if (ok) {
      modals.bag?.close();
      toast.show({
        title: creating ? 'Bag created' : 'Bag updated',
        message: creating
          ? 'Laundry bag saved successfully.'
          : 'Laundry bag changes saved successfully.',
        variant: 'success',
      });
    }
  });

  byId('status-add-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canMove()) return updateControlVisibility();
    statusBagLookup.syncHiddenId();
    const payload = {
      bagId: byId('status-bag-input').value,
      status: byId('status-add-target-input').value,
    };
    if (!payload.bagId || !payload.status) {
      showMissingInformation(
        statusAddModalState,
        'Choose an available bag before adding it to a status.',
        'status-bag-search-input',
      );
      return;
    }

    const label = byId('status-bag-search-input')?.value?.trim() || 'this bag';
    const confirmed = await confirmAction({
      title: 'Add bag to status',
      message: () =>
        `Move "${byId('status-bag-search-input')?.value?.trim() || label}" from Available inventory into ${statusLabel(byId('status-add-target-input')?.value || payload.status)} for active laundry processing.`,
      confirmText: 'Add bag',
      variant: 'warning',
      canConfirm: canMove,
    });
    if (!confirmed) return;

    const ok = await runAction((signal) => api.addBagToStatus(payload, signal));
    if (ok) {
      modals.addStatus?.close();
      toast.show({
        title: 'Bag moved',
        message: `Bag moved to ${statusLabel(payload.status)}.`,
        variant: 'success',
      });
    }
  });

  byId('move-bag-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canMove()) return updateControlVisibility();
    moveBagStatusLookup.syncHiddenId();
    const payload = {
      bagId: byId('move-bag-id-input').value,
      status: byId('move-bag-status-value-input').value,
    };
    if (!payload.bagId || !payload.status) {
      showMissingInformation(
        moveBagModalState,
        'Choose a destination status before moving the bag.',
        'move-bag-status-input',
      );
      return;
    }

    const confirmed = await confirmAction({
      title: 'Move laundry bag',
      message: () => {
        const currentRow = state.rowsById.get(String(payload.bagId));
        return `Move "${currentRow?.code || byId('move-bag-code-text')?.textContent || 'this bag'}" to ${statusLabel(byId('move-bag-status-value-input')?.value || payload.status)} and update the status tables for this camp.`;
      },
      confirmText: 'Move bag',
      variant: 'warning',
      canConfirm: canMove,
    });
    if (!confirmed) return;

    const ok = await runAction((signal) => api.moveBag(payload, signal));
    if (ok) {
      modals.move?.close();
      toast.show({
        title: 'Bag moved',
        message: `Bag moved to ${statusLabel(payload.status)}.`,
        variant: 'success',
      });
    }
  });

  byId('bag-template-file-input')?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0] || null;
    if (!file) {
      resetBulkProgress();
      return;
    }
    state.import.fileName = file.name;
    state.import.uploadPercent = 0;
    state.import.processingPercent = 0;
    state.import.statusMessage = 'Template selected and ready to upload.';
    state.import.summary = null;
    state.import.errors = [];
    state.import.visible = false;
    renderBulkProgress();
  });
  byId('download-laundry-mobile-app-button')?.addEventListener('click', (event) => {
    if (!canDownloadLaundryMobileApp()) {
      event.preventDefault();
      return;
    }
    const downloadUrl = event.currentTarget?.dataset?.downloadUrl || '';
    if (downloadUrl) {
      window.location.assign(downloadUrl);
    }
  });

  document.addEventListener('workspace:permissions:refreshed', (event) => {
    state.permissions = new Set(event.detail?.permissionNames || []);
    updateControlVisibility();
    void loadOverview({ quiet: true });
    if (state.activeTab === 'report') void refreshReport({ quiet: true, notifyInvalid: false });
  });

  document.addEventListener('workspace:camp-access:refreshed', (event) => {
    if (!event.detail?.revoked) return;
    pageData.campId = '';
    if (document.body) document.body.dataset.currentCampId = '';
    void loadOverview({ quiet: true });
    if (state.report.loaded) void refreshReport({ quiet: true, notifyInvalid: false });
  });

  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const accessRefresh = createWorkspacePermissionAccessRefresh({ socket, pageData });
  accessRefresh.bind();
  const roomManager = socket ? createSocketRoomManager(socket) : null;
  bindLateBicycleToast({ socket, roomManager, toast, pageData });
  bindUpcomingAccommodationToasts({ toast, pageData });

  async function subscribeLaundryRoom() {
    if (!roomManager || !hasPermission(PERMISSIONS.section)) return;
    await roomManager.subscribe(['ui:laundry:list']);
  }

  function isCurrentCampRealtimePayload(payload = {}) {
    const changedCampId = String(payload?.campId || '');
    const currentCampId = String(pageData.campId || '');
    return !changedCampId || !currentCampId || changedCampId === currentCampId;
  }

  if (socket) {
    socket.on('connect', () => {
      void subscribeLaundryRoom();
    });
    socket.on('laundry:changed', () => {
      void loadOverview({ quiet: true }).then((loaded) => {
        if (loaded) refreshLaundryLookupOptions();
      });
      if (state.report.loaded) void refreshReport({ quiet: true, notifyInvalid: false });
    });
    socket.on('soldier:changed', (payload = {}) => {
      if (!isCurrentCampRealtimePayload(payload)) return;
      void loadOverview({ quiet: true }).then((loaded) => {
        if (loaded) refreshLaundryLookupOptions();
      });
      if (state.report.loaded) void refreshReport({ quiet: true, notifyInvalid: false });
    });
  }

  window.addEventListener('pagehide', () => {
    if (!roomManager) return;
    void roomManager.unsubscribe(['ui:laundry:list']);
    roomManager.clear();
  });

  setActiveTab(state.activeTab);
  initializeReportFilterDefaults();
  renderReport();
  renderBulkProgress();
  updateControlVisibility();
  accessRefresh.refreshNavigation().then((permissionNames) => {
    state.permissions = new Set(permissionNames || []);
    updateControlVisibility();
    void subscribeLaundryRoom();
  });
  void loadOverview();
});
