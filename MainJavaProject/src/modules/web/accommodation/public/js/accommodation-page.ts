import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import { byId, debounce, setProgressValue } from '/assets/shared/js/core/dom.ts';
import { readPageData } from '/assets/shared/js/core/page-data.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { confirmAction, initConfirmModal } from '/assets/shared/js/core/confirm.ts';
import {
  bindForcedSignOut,
  createSocketRoomManager,
} from '/assets/shared/js/core/socket-client.ts';
import { createModalController } from '/assets/shared/js/ui/modal.ts';
import { createAccommodationPageApi } from '/assets/accommodation/js/accommodation-page.api.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { formatDateTimeDisplay } from '/assets/shared/js/core/display-date-time.ts';
import { createWorkspacePermissionAccessRefresh } from '/assets/shared/js/workspace/permission-access.ts';
import {
  bindLateBicycleToast,
  bindUpcomingAccommodationToasts,
  initWorkspacePage,
  createToastManager,
  syncTabPanels,
} from '/assets/shared/js/workspace/page-shell.ts';

const PERMISSIONS = Object.freeze({
  full: 'Full permission',
  section: 'Accommodation and keys',
  addBuilding: 'Add destination',
  editBuilding: 'Edit destination',
  deleteBuilding: 'Remove destination',
  addRoom: 'Add room',
  editRoom: 'Edit room',
  deleteRoom: 'Remove room',
  addKey: 'Add key',
  editKey: 'Reload keys',
  deleteKey: 'Remove keys',
  addSoldier: 'Add soldier',
  editSoldier: 'Edit soldier',
  deleteSoldier: 'Remove soldier',
  manageAccommodation: 'Manage accommodation',
  addAdditionalItem: 'Add additional item',
  editAdditionalItem: 'Edit additional item',
  deleteAdditionalItem: 'Remove additional item',
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

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizePositiveIntegerText(value) {
  return String(value ?? '')
    .replace(/\D+/g, '')
    .replace(/^0+/, '');
}

function syncPositiveIntegerInput(input) {
  const nextValue = normalizePositiveIntegerText(input.value);
  if (input.value !== nextValue) input.value = nextValue;
}

function getAccommodationOccupancyStatus(row = {}) {
  const freeKeys = Number(row.freeKeys ?? 0);
  const occupiedKeys = Number(row.occupiedKeys ?? 0);
  if (occupiedKeys <= 0) return 'Fully free';
  if (freeKeys > 0) return 'Free';
  return 'Occupied';
}

function isAccommodationKeyEligible(key = {}) {
  const buildingType = normalizeText(key.buildingType).toLowerCase();
  return buildingType === 'accommodation' && Boolean(key.hasBedAsset);
}

function normalizeStatusKey(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function formatStatusLabel(value) {
  const status = normalizeStatusKey(value);
  if (status === 'fully-free') return 'Fully free';
  if (status === 'free') return 'Free';
  if (status === 'occupied') return 'Occupied';
  if (status === 'accommodated') return 'Accommodated';
  if (status === 'not-accommodated') return 'Not accommodated';
  return normalizeText(value) || 'Unknown';
}

function renderStatusPill(value) {
  const label = formatStatusLabel(value);
  return `<span class="status-pill" data-status="${escapeAttr(normalizeStatusKey(label))}">${escapeHtml(label)}</span>`;
}

function getNextSortDirection(currentDirection) {
  if (currentDirection === 'default') return 'asc';
  if (currentDirection === 'asc') return 'desc';
  return 'default';
}

function renderNames(target, items, fallbackText) {
  if (!target) return;
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) {
    target.innerHTML = `<li>${escapeHtml(fallbackText)}</li>`;
    return;
  }
  target.innerHTML = values.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function formatDateForInput(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDateForDisplay(value) {
  if (!value) return 'None';
  return formatDateForInput(value) || 'None';
}

function formatDateTimeForDisplay(value) {
  return formatDateTimeDisplay(value, normalizeText(value) || 'None');
}

const SOLDIER_SCHEDULE_MESSAGE =
  'Upcoming release must be the same day as or after upcoming accommodation.';

bootstrapPage(() => {
  const pageData = readPageData();
  initWorkspacePage();
  initConfirmModal();

  const api = createAccommodationPageApi({ csrfToken: byId('csrf-token')?.value || '' });
  const overviewScope = createRequestScope();
  const lookupScopes = {
    building: createRequestScope(),
    room: createRequestScope(),
    soldierLaundryBag: createRequestScope(),
    soldierUpcomingKey: createRequestScope(),
    accommodateKey: createRequestScope(),
    issueKeySoldier: createRequestScope(),
    additionalItemSoldier: createRequestScope(),
    additionalItemLaundryBag: createRequestScope(),
    bulkKey: createRequestScope(),
    chainKey: createRequestScope(),
  };
  const toast = createToastManager(byId('toast-stack'));
  const pageState = createPageStateController({
    root: byId('main-content'),
    disableTargets: [
      byId('refresh-accommodation-button'),
      byId('refresh-buildings-button'),
      byId('refresh-rooms-button'),
      byId('refresh-keys-button'),
      byId('refresh-soldiers-button'),
      byId('refresh-additional-items-button'),
      byId('open-add-building-modal'),
      byId('open-add-room-modal'),
      byId('open-add-key-modal'),
      byId('open-add-soldier-modal'),
      byId('open-add-additional-item-modal'),
      byId('release-selected-buildings-button'),
      byId('release-selected-rooms-button'),
      byId('open-bulk-accommodate-soldiers-modal'),
    ],
  });
  function showMissingInformation(form, { message, focusId } = {}) {
    toast.show({
      title: 'Missing information',
      message: message || 'Complete the required fields before saving.',
      variant: 'warning',
    });
    const field =
      byId(focusId) ||
      form?.querySelector?.('input:invalid, select:invalid, textarea:invalid, [required]');
    if (field && typeof field.focus === 'function') field.focus();
  }
  const tabButtons = Array.from(document.querySelectorAll('[data-tab-trigger]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));

  const state = {
    activeTab: 'overview',
    buildings: [],
    rooms: [],
    keys: [],
    soldiers: [],
    laundryBags: [],
    additionalItems: [],
    buildingLookup: new Map(),
    roomLookup: new Map(),
    soldierLaundryBagLookup: new Map(),
    soldierUpcomingKeyLookup: new Map(),
    accommodateKeyLookup: new Map(),
    issueKeySoldierLookup: new Map(),
    additionalItemSoldierLookup: new Map(),
    additionalItemLaundryBagLookup: new Map(),
    selectedBuildingReleaseIds: new Set(),
    selectedRoomReleaseIds: new Set(),
    selectedSoldierAccommodationIds: new Set(),
    isBusy: false,
    permissions: new Set(pageData.permissionNames || []),
    imports: {
      building: {
        fileName: '',
        uploadPercent: 0,
        processingPercent: 0,
        statusMessage: 'Download the template to begin.',
        summary: null,
        errors: [],
        visible: false,
        isBusy: false,
      },
      room: {
        fileName: '',
        uploadPercent: 0,
        processingPercent: 0,
        statusMessage: 'Download the template to begin.',
        summary: null,
        errors: [],
        visible: false,
        isBusy: false,
      },
      key: {
        fileName: '',
        uploadPercent: 0,
        processingPercent: 0,
        statusMessage: 'Download the template to begin.',
        summary: null,
        errors: [],
        visible: false,
        isBusy: false,
      },
      soldier: {
        fileName: '',
        uploadPercent: 0,
        processingPercent: 0,
        statusMessage: 'Download the template to begin.',
        summary: null,
        errors: [],
        visible: false,
        isBusy: false,
      },
      'additional-item': {
        fileName: '',
        uploadPercent: 0,
        processingPercent: 0,
        statusMessage: 'Download the template to begin.',
        summary: null,
        errors: [],
        visible: false,
        isBusy: false,
      },
    },
    buildingTable: {
      rows: [],
      page: 1,
      limit: 10,
      totalRows: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {
        id: '',
        name: '',
        status: '',
        type: '',
      },
      sortColumn: null,
      sortDirection: 'default',
    },
    roomTable: {
      rows: [],
      page: 1,
      limit: 10,
      totalRows: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {
        id: '',
        buildingName: '',
        name: '',
        status: '',
      },
      sortColumn: null,
      sortDirection: 'default',
    },
    keyTable: {
      rows: [],
      page: 1,
      limit: 10,
      totalRows: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {
        id: '',
        buildingName: '',
        roomName: '',
        name: '',
        nfcCode: '',
        status: '',
        soldierName: '',
      },
      sortColumn: null,
      sortDirection: 'default',
    },
    soldierTable: {
      rows: [],
      page: 1,
      limit: 10,
      totalRows: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {
        country: '',
        id: '',
        keyName: '',
        laundryBagCode: '',
        mealCard: '',
        name: '',
        roomName: '',
        status: '',
      },
      sortColumn: null,
      sortDirection: 'default',
    },
    additionalItemTable: {
      rows: [],
      page: 1,
      limit: 10,
      totalRows: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {
        description: '',
        id: '',
        laundryBagCode: '',
        quantity: '',
        soldierName: '',
      },
      sortColumn: null,
      sortDirection: 'default',
    },
    report: {
      checkEvents: [],
      moveEvents: [],
      additionalItems: [],
      checkPage: 1,
      checkLimit: 10,
      checkTotalRows: 0,
      checkSourceTotal: 0,
      checkTotalPages: 1,
      movePage: 1,
      moveLimit: 10,
      moveTotalRows: 0,
      moveSourceTotal: 0,
      moveTotalPages: 1,
      itemPage: 1,
      itemLimit: 10,
      itemTotalRows: 0,
      itemSourceTotal: 0,
      itemTotalPages: 1,
      filters: {
        check: {},
        move: {},
        item: {},
      },
      dateFilters: {
        check: { fromDate: '', toDate: '' },
        move: { fromDate: '', toDate: '' },
        item: { fromDate: '', toDate: '' },
      },
      sort: {
        check: { column: null, direction: 'default' },
        move: { column: null, direction: 'default' },
        item: { column: null, direction: 'default' },
      },
    },
  };

  const buildingImportModal = createModalController({
    root: byId('building-import-modal'),
    dialog: byId('building-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => resetImportProgress('building'),
  });
  const roomImportModal = createModalController({
    root: byId('room-import-modal'),
    dialog: byId('room-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => resetImportProgress('room'),
  });
  const keyImportModal = createModalController({
    root: byId('key-import-modal'),
    dialog: byId('key-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => resetImportProgress('key'),
  });
  const soldierImportModal = createModalController({
    root: byId('soldier-import-modal'),
    dialog: byId('soldier-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => resetImportProgress('soldier'),
  });
  const additionalItemImportModal = createModalController({
    root: byId('additional-item-import-modal'),
    dialog: byId('additional-item-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => resetImportProgress('additional-item'),
  });
  const buildingModal = createModalController({
    root: byId('building-modal'),
    dialog: byId('building-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const roomModal = createModalController({
    root: byId('room-modal'),
    dialog: byId('room-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => buildingLookup?.clear(),
  });
  const keyModal = createModalController({
    root: byId('key-modal'),
    dialog: byId('key-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => roomLookup?.clear(),
  });
  const issueKeyModal = createModalController({
    root: byId('issue-key-modal'),
    dialog: byId('issue-key-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => issueKeySoldierLookup?.clear(),
  });
  const soldierModal = createModalController({
    root: byId('soldier-modal'),
    dialog: byId('soldier-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const accommodateSoldierModal = createModalController({
    root: byId('accommodate-soldier-modal'),
    dialog: byId('accommodate-soldier-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const bulkAccommodateSoldiersModal = createModalController({
    root: byId('bulk-accommodate-soldiers-modal'),
    dialog: byId('bulk-accommodate-soldiers-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => {
      bulkAccommodationKeyLookups.forEach((lookup) => lookup.destroy?.());
      bulkAccommodationKeyLookups = [];
    },
  });
  const swapSoldiersModal = createModalController({
    root: byId('swap-soldiers-modal'),
    dialog: byId('swap-soldiers-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => resetChainMoveForm(),
  });
  const dischargeSoldierModal = createModalController({
    root: byId('discharge-soldier-modal'),
    dialog: byId('discharge-soldier-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const additionalItemModal = createModalController({
    root: byId('additional-item-modal'),
    dialog: byId('additional-item-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });

  function hasPermission(name) {
    return state.permissions.has(PERMISSIONS.full) || state.permissions.has(name);
  }

  const canAddBuilding = () => hasPermission(PERMISSIONS.addBuilding);
  const canEditBuilding = () => hasPermission(PERMISSIONS.editBuilding);
  const canDeleteBuilding = () => hasPermission(PERMISSIONS.deleteBuilding);
  const canAddRoom = () => hasPermission(PERMISSIONS.addRoom);
  const canEditRoom = () => hasPermission(PERMISSIONS.editRoom);
  const canDeleteRoom = () => hasPermission(PERMISSIONS.deleteRoom);
  const canAddKey = () => hasPermission(PERMISSIONS.addKey);
  const canEditKey = () => hasPermission(PERMISSIONS.editKey);
  const canDeleteKey = () => hasPermission(PERMISSIONS.deleteKey);
  const canAddSoldier = () => hasPermission(PERMISSIONS.addSoldier);
  const canEditSoldier = () => hasPermission(PERMISSIONS.editSoldier);
  const canDeleteSoldier = () => hasPermission(PERMISSIONS.deleteSoldier);
  const canManageAccommodation = () => hasPermission(PERMISSIONS.manageAccommodation);
  const canAddAdditionalItem = () => hasPermission(PERMISSIONS.addAdditionalItem);
  const canEditAdditionalItem = () => hasPermission(PERMISSIONS.editAdditionalItem);
  const canDeleteAdditionalItem = () => hasPermission(PERMISSIONS.deleteAdditionalItem);
  const canImportBuildings = () => canAddBuilding() || canEditBuilding();
  const canImportRooms = () => canAddRoom() || canEditRoom();
  const canImportKeys = () => canAddKey() || canEditKey();
  const canImportSoldiers = () => canAddSoldier() || canEditSoldier();
  const canImportAdditionalItems = () => canAddAdditionalItem() || canEditAdditionalItem();

  const importConfigs = {
    building: {
      label: 'building',
      modal: buildingImportModal,
      canImport: canImportBuildings,
      fileInputId: 'building-template-file-input',
      selectedFileId: 'building-template-selected-file',
      openButtonId: 'open-building-import-modal',
      downloadButtonId: 'download-building-template-button',
      uploadButtonId: 'upload-building-template-button',
      progressPanelId: 'building-import-progress-panel',
      uploadLabelId: 'building-import-upload-label',
      uploadBarId: 'building-import-upload-progress-bar',
      processingLabelId: 'building-import-processing-label',
      processingBarId: 'building-import-processing-progress-bar',
      statusId: 'building-import-status-message',
      summaryId: 'building-import-summary',
      errorsId: 'building-import-errors',
      upload: (file, options) => api.importBuildingTemplate(file, options),
    },
    room: {
      label: 'room',
      modal: roomImportModal,
      canImport: canImportRooms,
      fileInputId: 'room-template-file-input',
      selectedFileId: 'room-template-selected-file',
      openButtonId: 'open-room-import-modal',
      downloadButtonId: 'download-room-template-button',
      uploadButtonId: 'upload-room-template-button',
      progressPanelId: 'room-import-progress-panel',
      uploadLabelId: 'room-import-upload-label',
      uploadBarId: 'room-import-upload-progress-bar',
      processingLabelId: 'room-import-processing-label',
      processingBarId: 'room-import-processing-progress-bar',
      statusId: 'room-import-status-message',
      summaryId: 'room-import-summary',
      errorsId: 'room-import-errors',
      upload: (file, options) => api.importRoomTemplate(file, options),
    },
    key: {
      label: 'key',
      modal: keyImportModal,
      canImport: canImportKeys,
      fileInputId: 'key-template-file-input',
      selectedFileId: 'key-template-selected-file',
      openButtonId: 'open-key-import-modal',
      downloadButtonId: 'download-key-template-button',
      uploadButtonId: 'upload-key-template-button',
      progressPanelId: 'key-import-progress-panel',
      uploadLabelId: 'key-import-upload-label',
      uploadBarId: 'key-import-upload-progress-bar',
      processingLabelId: 'key-import-processing-label',
      processingBarId: 'key-import-processing-progress-bar',
      statusId: 'key-import-status-message',
      summaryId: 'key-import-summary',
      errorsId: 'key-import-errors',
      upload: (file, options) => api.importKeyTemplate(file, options),
    },
    soldier: {
      label: 'soldier',
      modal: soldierImportModal,
      canImport: canImportSoldiers,
      fileInputId: 'soldier-template-file-input',
      selectedFileId: 'soldier-template-selected-file',
      openButtonId: 'open-soldier-import-modal',
      downloadButtonId: 'download-soldier-template-button',
      uploadButtonId: 'upload-soldier-template-button',
      progressPanelId: 'soldier-import-progress-panel',
      uploadLabelId: 'soldier-import-upload-label',
      uploadBarId: 'soldier-import-upload-progress-bar',
      processingLabelId: 'soldier-import-processing-label',
      processingBarId: 'soldier-import-processing-progress-bar',
      statusId: 'soldier-import-status-message',
      summaryId: 'soldier-import-summary',
      errorsId: 'soldier-import-errors',
      upload: (file, options) => api.importSoldierTemplate(file, options),
    },
    'additional-item': {
      label: 'additional item',
      modal: additionalItemImportModal,
      canImport: canImportAdditionalItems,
      fileInputId: 'additional-item-template-file-input',
      selectedFileId: 'additional-item-template-selected-file',
      openButtonId: 'open-additional-item-import-modal',
      downloadButtonId: 'download-additional-item-template-button',
      uploadButtonId: 'upload-additional-item-template-button',
      progressPanelId: 'additional-item-import-progress-panel',
      uploadLabelId: 'additional-item-import-upload-label',
      uploadBarId: 'additional-item-import-upload-progress-bar',
      processingLabelId: 'additional-item-import-processing-label',
      processingBarId: 'additional-item-import-processing-progress-bar',
      statusId: 'additional-item-import-status-message',
      summaryId: 'additional-item-import-summary',
      errorsId: 'additional-item-import-errors',
      upload: (file, options) => api.importAdditionalItemTemplate(file, options),
    },
  };

  function setActiveTab(nextTab) {
    state.activeTab = nextTab || 'overview';
    syncTabPanels({ activeTab: state.activeTab, tabButtons, tabPanels });
  }

  function setBusy(isBusy, message = 'Loading accommodation information...') {
    state.isBusy = Boolean(isBusy);
    if (state.isBusy) {
      pageState.set('loading', message);
    } else if (pageState.is('loading')) {
      pageState.clear();
    }
    updateControlVisibility();
  }

  function setElementDisabledState(element, disabled) {
    if (!element) return;
    if ('disabled' in element) element.disabled = Boolean(disabled);
    element.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (element instanceof HTMLAnchorElement) element.tabIndex = disabled ? -1 : 0;
  }

  function setElementDisabled(id, disabled) {
    setElementDisabledState(byId(id), disabled);
  }

  function setDisabledBySelector(selector, disabled) {
    document
      .querySelectorAll(selector)
      .forEach((element) => setElementDisabledState(element, disabled));
  }

  function setFormDisabled(formId, disabled) {
    byId(formId)
      ?.querySelectorAll('input, select, textarea, button[type="submit"]')
      .forEach((element) => setElementDisabledState(element, disabled));
  }

  function syncLookupDisabledState(inputId) {
    const input = byId(inputId);
    input
      ?.closest('[data-lookup-combobox]')
      ?.classList.toggle('is-disabled', Boolean(input.disabled));
  }

  function syncAllLookupDisabledStates() {
    [
      'room-building-search-input',
      'key-room-search-input',
      'soldier-laundry-bag-search-input',
      'soldier-upcoming-key-search-input',
      'accommodate-soldier-key-search-input',
      'additional-item-soldier-search-input',
      'additional-item-laundry-bag-search-input',
    ].forEach(syncLookupDisabledState);
    document.querySelectorAll('.js-bulk-accommodation-key-search').forEach((input) => {
      input
        .closest('[data-lookup-combobox]')
        ?.classList.toggle('is-disabled', Boolean(input.disabled));
    });
    document.querySelectorAll('.js-chain-move-key-search').forEach((input) => {
      input
        .closest('[data-lookup-combobox]')
        ?.classList.toggle('is-disabled', Boolean(input.disabled));
    });
  }

  function canUseCurrentBuildingFormMode() {
    const mode = byId('building-form-mode')?.value || 'create';
    return mode === 'edit' ? canEditBuilding() : canAddBuilding();
  }

  function canUseCurrentRoomFormMode() {
    const mode = byId('room-form-mode')?.value || 'create';
    return (mode === 'edit' ? canEditRoom() : canAddRoom()) && state.buildings.length > 0;
  }

  function canUseCurrentKeyFormMode() {
    const mode = byId('key-form-mode')?.value || 'create';
    return (mode === 'edit' ? canEditKey() : canAddKey()) && state.rooms.length > 0;
  }

  function canUseCurrentSoldierFormMode() {
    const mode = byId('soldier-form-mode')?.value || 'create';
    return mode === 'edit' ? canEditSoldier() : canAddSoldier();
  }

  function canUseCurrentAdditionalItemFormMode() {
    const mode = byId('additional-item-form-mode')?.value || 'create';
    return (
      (mode === 'edit' ? canEditAdditionalItem() : canAddAdditionalItem()) &&
      state.soldiers.length > 0
    );
  }

  function updateControlVisibility() {
    if (byId('refresh-accommodation-button'))
      byId('refresh-accommodation-button').disabled = state.isBusy;
    if (byId('refresh-buildings-button')) byId('refresh-buildings-button').disabled = state.isBusy;
    if (byId('refresh-rooms-button')) byId('refresh-rooms-button').disabled = state.isBusy;
    if (byId('refresh-keys-button')) byId('refresh-keys-button').disabled = state.isBusy;
    if (byId('refresh-soldiers-button')) byId('refresh-soldiers-button').disabled = state.isBusy;
    if (byId('refresh-additional-items-button'))
      byId('refresh-additional-items-button').disabled = state.isBusy;
    if (byId('refresh-report-button')) byId('refresh-report-button').disabled = state.isBusy;
    if (byId('open-add-building-modal'))
      byId('open-add-building-modal').disabled = state.isBusy || !canAddBuilding();
    if (byId('open-add-room-modal'))
      byId('open-add-room-modal').disabled =
        state.isBusy || !canAddRoom() || state.buildings.length === 0;
    if (byId('open-add-key-modal'))
      byId('open-add-key-modal').disabled =
        state.isBusy || !canAddKey() || state.rooms.length === 0;
    if (byId('open-add-soldier-modal'))
      byId('open-add-soldier-modal').disabled = state.isBusy || !canAddSoldier();
    if (byId('open-add-additional-item-modal'))
      byId('open-add-additional-item-modal').disabled =
        state.isBusy || !canAddAdditionalItem() || state.soldiers.length === 0;
    Object.entries(importConfigs).forEach(([resource, config]) => {
      const importState = state.imports[resource];
      const disabled = state.isBusy || !config.canImport();
      setElementDisabled(config.openButtonId, disabled);
      setElementDisabled(config.downloadButtonId, disabled);
      setElementDisabled(config.fileInputId, disabled);
      setElementDisabled(config.uploadButtonId, disabled || importState.isBusy);
    });
    setDisabledBySelector('.js-edit-building', state.isBusy || !canEditBuilding());
    setDisabledBySelector('.js-delete-building', state.isBusy || !canDeleteBuilding());
    setDisabledBySelector('.js-edit-room', state.isBusy || !canEditRoom());
    setDisabledBySelector('.js-delete-room', state.isBusy || !canDeleteRoom());
    setDisabledBySelector('.js-edit-key', state.isBusy || !canEditKey());
    setDisabledBySelector('.js-delete-key', state.isBusy || !canDeleteKey());
    setDisabledBySelector('.js-edit-soldier', state.isBusy || !canEditSoldier());
    setDisabledBySelector('.js-delete-soldier', state.isBusy || !canDeleteSoldier());
    document.querySelectorAll('.js-accommodate-soldier').forEach((element) => {
      const row = findSoldier(element.dataset?.soldierId || '');
      setElementDisabledState(
        element,
        state.isBusy || !canManageAccommodation() || isSoldierAccommodated(row),
      );
    });
    document.querySelectorAll('.js-discharge-soldier, .js-move-soldier').forEach((element) => {
      const row = findSoldier(element.dataset?.soldierId || '');
      setElementDisabledState(
        element,
        state.isBusy || !canManageAccommodation() || !isSoldierAccommodated(row),
      );
    });
    setDisabledBySelector('.js-edit-additional-item', state.isBusy || !canEditAdditionalItem());
    setDisabledBySelector('.js-delete-additional-item', state.isBusy || !canDeleteAdditionalItem());
    setFormDisabled('building-form', state.isBusy || !canUseCurrentBuildingFormMode());
    setFormDisabled('room-form', state.isBusy || !canUseCurrentRoomFormMode());
    setFormDisabled('key-form', state.isBusy || !canUseCurrentKeyFormMode());
    setFormDisabled('soldier-form', state.isBusy || !canUseCurrentSoldierFormMode());
    setFormDisabled('additional-item-form', state.isBusy || !canUseCurrentAdditionalItemFormMode());
    setFormDisabled(
      'accommodate-soldier-form',
      state.isBusy || !canManageAccommodation() || state.soldiers.length === 0,
    );
    setFormDisabled(
      'swap-soldiers-form',
      state.isBusy || !canManageAccommodation() || state.soldiers.length === 0,
    );
    setElementDisabled(
      'save-swap-soldiers-button',
      state.isBusy ||
        !canManageAccommodation() ||
        !getChainMoveTerminalState(chainMoveSourceSoldier, chainMoveKeyIds).complete,
    );
    setFormDisabled(
      'discharge-soldier-form',
      state.isBusy || !canManageAccommodation() || state.soldiers.length === 0,
    );
    setFormDisabled(
      'bulk-accommodate-soldiers-form',
      state.isBusy || !canManageAccommodation() || state.soldiers.length === 0,
    );
    setFormDisabled(
      'issue-key-form',
      state.isBusy || !canManageAccommodation() || state.soldiers.length === 0,
    );
    updateBulkActionButtons();
    syncAllLookupDisabledStates();
  }

  function setText(id, value) {
    const target = byId(id);
    if (target) target.textContent = String(value ?? 0);
  }

  function findBuilding(buildingId) {
    return state.buildings.find((row) => String(row.id) === String(buildingId)) || null;
  }

  function findRoom(roomId) {
    return state.rooms.find((row) => String(row.id) === String(roomId)) || null;
  }

  function findKey(keyId) {
    return state.keys.find((row) => String(row.id) === String(keyId)) || null;
  }

  function findSoldier(soldierId) {
    return state.soldiers.find((row) => String(row.id) === String(soldierId)) || null;
  }

  function isActiveAccommodationKey(row = {}) {
    const soldier = findSoldier(row.soldierId || '');
    return Boolean(
      soldier && String(soldier.keyId || soldier.usedKey || '') === String(row.id || ''),
    );
  }

  function findLaundryBag(laundryBagId) {
    return state.laundryBags.find((row) => String(row.id) === String(laundryBagId)) || null;
  }

  function findAdditionalItem(itemId) {
    return state.additionalItems.find((row) => String(row.id) === String(itemId)) || null;
  }

  function pruneSelection(selection, rows, isEligible) {
    const validIds = new Set(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => (typeof isEligible === 'function' ? isEligible(row) : true))
        .map((row) => String(row.id)),
    );
    for (const id of [...selection]) {
      if (!validIds.has(String(id))) selection.delete(id);
    }
  }

  function isBuildingReleaseEligible(row) {
    return canManageAccommodation() && Number(row?.occupiedKeys || 0) > 0;
  }

  function isRoomReleaseEligible(row) {
    return canManageAccommodation() && Number(row?.occupiedKeys || 0) > 0;
  }

  function isSoldierAccommodationEligible(row) {
    return canManageAccommodation() && !isSoldierAccommodated(row);
  }

  function isSoldierAccommodated(row) {
    return Boolean(
      row?.keyId || row?.usedKey || normalizeStatusKey(row?.status) === 'accommodated',
    );
  }

  function getKnownSoldierDeleteBlockerMessage(row) {
    if (!row) return 'The soldier record is not loaded yet.';
    if (isSoldierAccommodated(row)) {
      return 'Discharge the soldier from their key before deleting the record.';
    }
    const itemCount = state.additionalItems.filter(
      (item) => String(item.soldierId || '') === String(row.id || ''),
    ).length;
    if (itemCount > 0) {
      return `Delete or reassign ${itemCount} additional item${itemCount === 1 ? '' : 's'} before deleting this soldier.`;
    }
    const activeBikeRentalCount = Number(row.activeBikeRentalCount || 0);
    if (activeBikeRentalCount > 0) {
      return `Return ${activeBikeRentalCount} active bike rental${activeBikeRentalCount === 1 ? '' : 's'} before deleting this soldier.`;
    }
    return '';
  }

  function getSelectedRows(selection, rows, isEligible) {
    return (Array.isArray(rows) ? rows : []).filter(
      (row) => selection.has(String(row.id)) && (!isEligible || isEligible(row)),
    );
  }

  function syncPageSelectionCheckbox({ checkboxId, pageRows, selection, isEligible }) {
    const checkbox = byId(checkboxId);
    if (!checkbox) return;
    const eligibleRows = pageRows.filter(isEligible);
    const selectedCount = eligibleRows.filter((row) => selection.has(String(row.id))).length;
    checkbox.disabled = state.isBusy || !eligibleRows.length;
    checkbox.checked = eligibleRows.length > 0 && selectedCount === eligibleRows.length;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < eligibleRows.length;
  }

  function getCurrentPageRows(rows, tableState, getColumnValue) {
    return Array.isArray(tableState?.rows) ? tableState.rows : [];
  }

  function syncCurrentPageSelectionCheckboxes() {
    syncPageSelectionCheckbox({
      checkboxId: 'building-select-page-checkbox',
      pageRows: getCurrentPageRows(state.buildings, state.buildingTable),
      selection: state.selectedBuildingReleaseIds,
      isEligible: isBuildingReleaseEligible,
    });
    syncPageSelectionCheckbox({
      checkboxId: 'room-select-page-checkbox',
      pageRows: getCurrentPageRows(state.rooms, state.roomTable),
      selection: state.selectedRoomReleaseIds,
      isEligible: isRoomReleaseEligible,
    });
    syncPageSelectionCheckbox({
      checkboxId: 'soldier-select-page-checkbox',
      pageRows: getCurrentPageRows(state.soldiers, state.soldierTable),
      selection: state.selectedSoldierAccommodationIds,
      isEligible: isSoldierAccommodationEligible,
    });
  }

  function updateBulkActionButtons() {
    setElementDisabled(
      'release-selected-buildings-button',
      state.isBusy ||
        !canManageAccommodation() ||
        getSelectedRows(
          state.selectedBuildingReleaseIds,
          state.buildings,
          isBuildingReleaseEligible,
        ).length === 0,
    );
    setElementDisabled(
      'release-selected-rooms-button',
      state.isBusy ||
        !canManageAccommodation() ||
        getSelectedRows(state.selectedRoomReleaseIds, state.rooms, isRoomReleaseEligible).length ===
          0,
    );
    setElementDisabled(
      'open-bulk-accommodate-soldiers-modal',
      state.isBusy ||
        !canManageAccommodation() ||
        getSelectedRows(
          state.selectedSoldierAccommodationIds,
          state.soldiers,
          isSoldierAccommodationEligible,
        ).length === 0,
    );
    syncCurrentPageSelectionCheckboxes();
  }

  function pruneAllSelections() {
    pruneSelection(state.selectedBuildingReleaseIds, state.buildings, isBuildingReleaseEligible);
    pruneSelection(state.selectedRoomReleaseIds, state.rooms, isRoomReleaseEligible);
    pruneSelection(
      state.selectedSoldierAccommodationIds,
      state.soldiers,
      isSoldierAccommodationEligible,
    );
  }

  function renderPagination(
    tableState,
    { pageLabelId, prevButtonId, nextButtonId },
    totalRows = 0,
  ) {
    const pageLabel = byId(pageLabelId);
    const prevButton = byId(prevButtonId);
    const nextButton = byId(nextButtonId);
    const totalPages = tableState.totalPages;

    if (pageLabel) {
      pageLabel.textContent =
        totalRows > 0 ? `Page ${tableState.page} of ${totalPages}` : 'Page 1 of 1';
    }
    if (prevButton) prevButton.disabled = tableState.page <= 1;
    if (nextButton) nextButton.disabled = tableState.page >= totalPages;
  }

  function renderTableControls(kind, tableState, headerIds) {
    Object.entries(headerIds).forEach(([column, headerId]) => {
      const active = tableState.sortColumn === column;
      const direction = active ? tableState.sortDirection : 'default';
      const indicator = document.querySelector(`[data-${kind}-sort-indicator="${column}"]`);
      const header = byId(headerId);
      if (indicator)
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      if (!header) return;
      header.setAttribute(
        'aria-sort',
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      );
    });
  }

  function buildTableRequestState(tableState) {
    return {
      page: tableState.page,
      limit: tableState.limit,
      filters: tableState.filters,
      sortColumn: tableState.sortColumn,
      sortDirection: tableState.sortDirection,
    };
  }

  function buildReportTableRequestState(table) {
    const sort = state.report.sort[table] || {};
    return {
      page: state.report[getAccommodationReportPageKey(table)],
      limit: state.report[getAccommodationReportLimitKey(table)],
      filters: state.report.filters[table] || {},
      dateFilters: state.report.dateFilters[table] || { fromDate: '', toDate: '' },
      sortColumn: sort.column,
      sortDirection: sort.direction,
    };
  }

  function buildAccommodationDataQuery() {
    return {
      state: JSON.stringify({
        building: buildTableRequestState(state.buildingTable),
        room: buildTableRequestState(state.roomTable),
        key: buildTableRequestState(state.keyTable),
        soldier: buildTableRequestState(state.soldierTable),
        additionalItem: buildTableRequestState(state.additionalItemTable),
        report: {
          check: buildReportTableRequestState('check'),
          move: buildReportTableRequestState('move'),
          item: buildReportTableRequestState('item'),
        },
      }),
    };
  }

  function applyServerTableResult(tableState, rows, meta = {}) {
    tableState.rows = Array.isArray(rows) ? rows : [];
    tableState.page = Number(meta.page) || tableState.page || 1;
    tableState.limit = Number(meta.limit) || tableState.limit || 10;
    tableState.totalRows = Number(meta.total) || 0;
    tableState.totalPages = Number(meta.totalPages) || 1;
    tableState.sourceTotal = Number(meta.sourceTotal) || 0;
    tableState.sortColumn = meta.sortColumn || null;
    tableState.sortDirection = meta.sortDirection || 'default';
  }

  function applyReportTableResult(table, rows, meta = {}) {
    state.report[getAccommodationReportRowsKey(table)] = Array.isArray(rows) ? rows : [];
    state.report[getAccommodationReportPageKey(table)] = Number(meta.page) || 1;
    state.report[getAccommodationReportLimitKey(table)] = Number(meta.limit) || 10;
    state.report[getAccommodationReportTotalRowsKey(table)] = Number(meta.total) || 0;
    state.report[getAccommodationReportSourceTotalKey(table)] = Number(meta.sourceTotal) || 0;
    state.report[getAccommodationReportTotalPagesKey(table)] = Number(meta.totalPages) || 1;
    const sort = state.report.sort[table] || {};
    sort.column = meta.sortColumn || null;
    sort.direction = meta.sortDirection || 'default';
    state.report.sort[table] = sort;
    if (meta.dateFilters && typeof meta.dateFilters === 'object') {
      state.report.dateFilters[table] = {
        fromDate: meta.dateFilters.fromDate || '',
        toDate: meta.dateFilters.toDate || '',
      };
    }
  }

  function renderBuildings() {
    const tbody = byId('buildings-table-body');
    if (!tbody) return;
    renderTableControls('building', state.buildingTable, {
      id: 'building-id-header',
      name: 'building-name-header',
      type: 'building-type-header',
      roomCount: 'building-rooms-header',
      totalKeys: 'building-total-keys-header',
      freeKeys: 'building-free-keys-header',
      occupiedKeys: 'building-occupied-keys-header',
      status: 'building-status-header',
    });

    const rows = Array.isArray(state.buildingTable.rows) ? state.buildingTable.rows : [];
    const pageRows = rows;
    renderPagination(
      state.buildingTable,
      {
        pageLabelId: 'buildings-page-label',
        prevButtonId: 'buildings-prev-button',
        nextButtonId: 'buildings-next-button',
      },
      state.buildingTable.totalRows,
    );
    if (!state.buildingTable.sourceTotal) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="table-empty">No buildings found for the selected camp.</td></tr>';
      syncPageSelectionCheckbox({
        checkboxId: 'building-select-page-checkbox',
        pageRows: [],
        selection: state.selectedBuildingReleaseIds,
        isEligible: isBuildingReleaseEligible,
      });
      return;
    }
    if (!state.buildingTable.totalRows) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="table-empty">No buildings match the current search.</td></tr>';
      syncPageSelectionCheckbox({
        checkboxId: 'building-select-page-checkbox',
        pageRows: [],
        selection: state.selectedBuildingReleaseIds,
        isEligible: isBuildingReleaseEligible,
      });
      return;
    }

    tbody.innerHTML = pageRows
      .map((row) => {
        const selectable = isBuildingReleaseEligible(row);
        return `
          <tr>
            <td class="table-select-col">
              <input class="js-building-release-select" type="checkbox" data-building-id="${escapeAttr(row.id)}" aria-label="Select ${escapeAttr(row.name || 'building')} for release" ${state.selectedBuildingReleaseIds.has(String(row.id)) ? 'checked' : ''} ${selectable ? '' : 'disabled'} />
            </td>
            <td class="table-id-col"><code>${escapeHtml(row.id || 'None')}</code></td>
            <td>${escapeHtml(row.name || 'None')}</td>
            <td>${escapeHtml(row.type || 'Unspecified')}</td>
            <td>${renderStatusPill(row.status || getAccommodationOccupancyStatus(row))}</td>
            <td>${escapeHtml(row.roomCount ?? 0)}</td>
            <td>${escapeHtml(row.totalKeys ?? 0)}</td>
            <td>${escapeHtml(row.freeKeys ?? 0)}</td>
            <td>${escapeHtml(row.occupiedKeys ?? 0)}</td>
            <td>
              <div class="table-action-group">
                <button class="btn btn-primary js-edit-building" type="button" data-building-id="${escapeAttr(row.id)}" ${canEditBuilding() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
                </button>
                <button class="btn btn-danger js-delete-building" type="button" data-building-id="${escapeAttr(row.id)}" ${canDeleteBuilding() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
    syncPageSelectionCheckbox({
      checkboxId: 'building-select-page-checkbox',
      pageRows,
      selection: state.selectedBuildingReleaseIds,
      isEligible: isBuildingReleaseEligible,
    });
    updateBulkActionButtons();
  }

  function renderRooms() {
    const tbody = byId('rooms-table-body');
    if (!tbody) return;
    renderTableControls('room', state.roomTable, {
      id: 'room-id-header',
      buildingName: 'room-building-header',
      name: 'room-name-header',
      totalKeys: 'room-total-keys-header',
      freeKeys: 'room-free-keys-header',
      occupiedKeys: 'room-occupied-keys-header',
      status: 'room-status-header',
    });

    const rows = Array.isArray(state.roomTable.rows) ? state.roomTable.rows : [];
    const pageRows = rows;
    renderPagination(
      state.roomTable,
      {
        pageLabelId: 'rooms-page-label',
        prevButtonId: 'rooms-prev-button',
        nextButtonId: 'rooms-next-button',
      },
      state.roomTable.totalRows,
    );
    if (!state.roomTable.sourceTotal) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="table-empty">No rooms found for the selected camp.</td></tr>';
      syncPageSelectionCheckbox({
        checkboxId: 'room-select-page-checkbox',
        pageRows: [],
        selection: state.selectedRoomReleaseIds,
        isEligible: isRoomReleaseEligible,
      });
      return;
    }
    if (!state.roomTable.totalRows) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="table-empty">No rooms match the current search.</td></tr>';
      syncPageSelectionCheckbox({
        checkboxId: 'room-select-page-checkbox',
        pageRows: [],
        selection: state.selectedRoomReleaseIds,
        isEligible: isRoomReleaseEligible,
      });
      return;
    }

    tbody.innerHTML = pageRows
      .map((row) => {
        const selectable = isRoomReleaseEligible(row);
        return `
          <tr>
            <td class="table-select-col">
              <input class="js-room-release-select" type="checkbox" data-room-id="${escapeAttr(row.id)}" aria-label="Select ${escapeAttr(row.name || 'room')} for release" ${state.selectedRoomReleaseIds.has(String(row.id)) ? 'checked' : ''} ${selectable ? '' : 'disabled'} />
            </td>
            <td class="table-id-col"><code>${escapeHtml(row.id || 'None')}</code></td>
            <td>${escapeHtml(row.name || 'None')}</td>
            <td>${escapeHtml(row.buildingName || 'Unmapped')}</td>
            <td>${renderStatusPill(row.status || getAccommodationOccupancyStatus(row))}</td>
            <td>${escapeHtml(row.totalKeys ?? 0)}</td>
            <td>${escapeHtml(row.freeKeys ?? 0)}</td>
            <td>${escapeHtml(row.occupiedKeys ?? 0)}</td>
            <td>
              <div class="table-action-group">
                <button class="btn btn-primary js-edit-room" type="button" data-room-id="${escapeAttr(row.id)}" ${canEditRoom() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
                </button>
                <button class="btn btn-danger js-delete-room" type="button" data-room-id="${escapeAttr(row.id)}" ${canDeleteRoom() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
    syncPageSelectionCheckbox({
      checkboxId: 'room-select-page-checkbox',
      pageRows,
      selection: state.selectedRoomReleaseIds,
      isEligible: isRoomReleaseEligible,
    });
    updateBulkActionButtons();
  }

  function renderKeys() {
    const tbody = byId('keys-table-body');
    if (!tbody) return;
    renderTableControls('key', state.keyTable, {
      id: 'key-id-header',
      nfcCode: 'key-nfc-header',
      buildingName: 'key-building-header',
      roomName: 'key-room-header',
      name: 'key-name-header',
      status: 'key-status-header',
      soldierName: 'key-soldier-header',
    });

    const rows = Array.isArray(state.keyTable.rows) ? state.keyTable.rows : [];
    const pageRows = rows;
    renderPagination(
      state.keyTable,
      {
        pageLabelId: 'keys-page-label',
        prevButtonId: 'keys-prev-button',
        nextButtonId: 'keys-next-button',
      },
      state.keyTable.totalRows,
    );
    if (!state.keyTable.sourceTotal) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="table-empty">No keys found for the selected camp.</td></tr>';
      return;
    }
    if (!state.keyTable.totalRows) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="table-empty">No keys match the current search.</td></tr>';
      return;
    }

    tbody.innerHTML = pageRows
      .map(
        (row) => `
          <tr>
            <td class="table-id-col"><code>${escapeHtml(row.id || 'None')}</code></td>
            <td>${escapeHtml(row.name || 'None')}</td>
            <td><code>${escapeHtml(row.nfcCode || '')}</code></td>
            <td>${escapeHtml(row.roomName || 'Unmapped')}</td>
            <td>${escapeHtml(row.buildingName || 'Unmapped')}</td>
            <td>${renderStatusPill(row.status)}</td>
            <td>${escapeHtml(row.soldierName || 'Unassigned')}</td>
            <td>
              <div class="table-action-group">
                <button class="btn btn-primary js-edit-key" type="button" data-key-id="${escapeAttr(row.id)}" ${canEditKey() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
                </button>
                <button class="btn btn-secondary js-issue-key" type="button" data-key-id="${escapeAttr(row.id)}" ${canManageAccommodation() && !row.soldierId ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-people"></use></svg><span>Issue</span>
                </button>
                <button class="btn btn-secondary js-release-key" type="button" data-key-id="${escapeAttr(row.id)}" ${canManageAccommodation() && row.soldierId && !isActiveAccommodationKey(row) ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-refresh"></use></svg><span>Release</span>
                </button>
                <button class="btn btn-danger js-delete-key" type="button" data-key-id="${escapeAttr(row.id)}" ${canDeleteKey() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        `,
      )
      .join('');
  }

  function renderSoldiers() {
    const tbody = byId('soldiers-table-body');
    if (!tbody) return;
    renderTableControls('soldier', state.soldierTable, {
      id: 'soldier-id-header',
      country: 'soldier-country-header',
      keyName: 'soldier-key-header',
      laundryBagCode: 'soldier-bag-header',
      mealCard: 'soldier-meal-card-header',
      name: 'soldier-name-header',
      roomName: 'soldier-room-header',
      status: 'soldier-status-header',
    });

    const rows = Array.isArray(state.soldierTable.rows) ? state.soldierTable.rows : [];
    const pageRows = rows;
    renderPagination(
      state.soldierTable,
      {
        pageLabelId: 'soldiers-page-label',
        prevButtonId: 'soldiers-prev-button',
        nextButtonId: 'soldiers-next-button',
      },
      state.soldierTable.totalRows,
    );
    if (!state.soldierTable.sourceTotal) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="table-empty">No soldiers found for the selected camp.</td></tr>';
      syncPageSelectionCheckbox({
        checkboxId: 'soldier-select-page-checkbox',
        pageRows: [],
        selection: state.selectedSoldierAccommodationIds,
        isEligible: isSoldierAccommodationEligible,
      });
      return;
    }
    if (!state.soldierTable.totalRows) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="table-empty">No soldiers match the current search.</td></tr>';
      syncPageSelectionCheckbox({
        checkboxId: 'soldier-select-page-checkbox',
        pageRows: [],
        selection: state.selectedSoldierAccommodationIds,
        isEligible: isSoldierAccommodationEligible,
      });
      return;
    }

    tbody.innerHTML = pageRows
      .map((row) => {
        const accommodated = isSoldierAccommodated(row);
        const selectable = isSoldierAccommodationEligible(row);
        return `
          <tr>
            <td class="table-select-col">
              <input class="js-soldier-bulk-accommodate-select" type="checkbox" data-soldier-id="${escapeAttr(row.id)}" aria-label="Select ${escapeAttr(row.name || 'soldier')} for accommodation" ${state.selectedSoldierAccommodationIds.has(String(row.id)) ? 'checked' : ''} ${selectable ? '' : 'disabled'} />
            </td>
            <td class="table-id-col"><code>${escapeHtml(row.id || 'None')}</code></td>
            <td>${escapeHtml(row.name || 'None')}</td>
            <td>${escapeHtml(row.country || 'Unspecified')}</td>
            <td>${escapeHtml(row.mealCard || 'None')}</td>
            <td>${escapeHtml(row.laundryBagCode || 'None')}</td>
            <td>${renderStatusPill(row.status || 'not accommodated')}</td>
            <td>${escapeHtml(row.keyName || 'Unassigned')}</td>
            <td>${escapeHtml(row.roomName || 'Unassigned')}</td>
            <td>
              <div class="table-action-group table-action-group--wrap">
                <button class="btn btn-primary js-edit-soldier" type="button" data-soldier-id="${escapeAttr(row.id)}" ${canEditSoldier() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
                </button>
                <button class="btn btn-secondary js-accommodate-soldier" type="button" data-soldier-id="${escapeAttr(row.id)}" ${canManageAccommodation() && !accommodated ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-key"></use></svg><span>Accommodate</span>
                </button>
                <button class="btn btn-secondary js-move-soldier" type="button" data-soldier-id="${escapeAttr(row.id)}" ${canManageAccommodation() && accommodated ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-arrow-return"></use></svg><span>Move</span>
                </button>
                <button class="btn btn-secondary js-discharge-soldier" type="button" data-soldier-id="${escapeAttr(row.id)}" ${canManageAccommodation() && accommodated ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-box-arrow-right"></use></svg><span>Discharge</span>
                </button>
                <button class="btn btn-danger js-delete-soldier" type="button" data-soldier-id="${escapeAttr(row.id)}" ${canDeleteSoldier() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
    syncPageSelectionCheckbox({
      checkboxId: 'soldier-select-page-checkbox',
      pageRows,
      selection: state.selectedSoldierAccommodationIds,
      isEligible: isSoldierAccommodationEligible,
    });
    updateBulkActionButtons();
  }

  function renderAdditionalItems() {
    const tbody = byId('additional-items-table-body');
    if (!tbody) return;
    renderTableControls('additional-item', state.additionalItemTable, {
      id: 'additional-item-id-header',
      soldierName: 'additional-item-soldier-header',
      description: 'additional-item-description-header',
      quantity: 'additional-item-quantity-header',
      laundryBagCode: 'additional-item-bag-header',
    });

    const rows = Array.isArray(state.additionalItemTable.rows)
      ? state.additionalItemTable.rows
      : [];
    const pageRows = rows;
    renderPagination(
      state.additionalItemTable,
      {
        pageLabelId: 'additional-items-page-label',
        prevButtonId: 'additional-items-prev-button',
        nextButtonId: 'additional-items-next-button',
      },
      state.additionalItemTable.totalRows,
    );
    if (!state.additionalItemTable.sourceTotal) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="table-empty">No additional items found for the selected camp.</td></tr>';
      return;
    }
    if (!state.additionalItemTable.totalRows) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="table-empty">No additional items match the current search.</td></tr>';
      return;
    }

    tbody.innerHTML = pageRows
      .map(
        (row) => `
          <tr>
            <td class="table-id-col"><code>${escapeHtml(row.id || 'None')}</code></td>
            <td>${escapeHtml(row.soldierName || 'Unassigned')}</td>
            <td>${escapeHtml(row.description || 'None')}</td>
            <td>${escapeHtml(row.laundryBagCode || 'None')}</td>
            <td>${escapeHtml(row.quantity || 'Unspecified')}</td>
            <td>
              <div class="table-action-group">
                <button class="btn btn-primary js-edit-additional-item" type="button" data-item-id="${escapeAttr(row.id)}" ${canEditAdditionalItem() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
                </button>
                <button class="btn btn-danger js-delete-additional-item" type="button" data-item-id="${escapeAttr(row.id)}" ${canDeleteAdditionalItem() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        `,
      )
      .join('');
  }

  function renderReportPager({
    pageLabelId,
    prevButtonId,
    nextButtonId,
    pageKey,
    totalPagesKey,
    totalRows,
  }) {
    const pageLabel = byId(pageLabelId);
    const prevButton = byId(prevButtonId);
    const nextButton = byId(nextButtonId);
    const totalPages = state.report[totalPagesKey];
    if (pageLabel) {
      pageLabel.textContent =
        totalRows > 0 ? `Page ${state.report[pageKey]} of ${totalPages}` : 'Page 1 of 1';
    }
    if (prevButton) prevButton.disabled = state.report[pageKey] <= 1;
    if (nextButton) nextButton.disabled = state.report[pageKey] >= totalPages;
  }

  function getReportCheckKeyName(row) {
    return row.eventType === 'check-in' ? row.newKeyName || '' : row.previousKeyName || '';
  }

  function renderAccommodationReportSortControls() {
    const headerIds = {
      check: {
        happenedAt: 'accommodation-report-check-time-header',
        eventLabel: 'accommodation-report-check-action-header',
        soldierName: 'accommodation-report-check-soldier-header',
        soldierMealCard: 'accommodation-report-check-meal-card-header',
        laundryBagCode: 'accommodation-report-check-bag-header',
        keyName: 'accommodation-report-check-key-header',
      },
      move: {
        happenedAt: 'accommodation-report-move-time-header',
        soldierName: 'accommodation-report-move-soldier-header',
        previousKeyName: 'accommodation-report-move-prev-key-header',
        newKeyName: 'accommodation-report-move-new-key-header',
      },
      item: {
        createdAt: 'accommodation-report-item-time-header',
        soldierName: 'accommodation-report-item-soldier-header',
        description: 'accommodation-report-item-description-header',
        quantity: 'accommodation-report-item-quantity-header',
        laundryBagCode: 'accommodation-report-item-bag-header',
      },
    };

    Object.entries(headerIds).forEach(([table, columns]) => {
      Object.entries(columns).forEach(([column, headerId]) => {
        const sort = state.report.sort[table] || {};
        const active = sort.column === column;
        const direction = active ? sort.direction : 'default';
        const indicator = document.querySelector(
          `[data-accommodation-report-sort-indicator="${table}:${column}"]`,
        );
        const header = byId(headerId);
        if (indicator)
          indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
        if (header)
          header.setAttribute(
            'aria-sort',
            direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
          );
      });
    });
  }

  function syncAccommodationReportDownloadLinks() {
    const link = byId('download-accommodation-report-button');
    if (!link) return;
    const params = new URLSearchParams({
      section: 'all',
      state: JSON.stringify({
        report: {
          check: buildReportTableRequestState('check'),
          move: buildReportTableRequestState('move'),
          item: buildReportTableRequestState('item'),
        },
      }),
    });
    link.href = `/web/accommodation/report/download?${params.toString()}`;
  }

  function getAccommodationReportPageKey(table) {
    return table === 'item' ? 'itemPage' : `${table}Page`;
  }

  function getAccommodationReportLimitKey(table) {
    return table === 'item' ? 'itemLimit' : `${table}Limit`;
  }

  function getAccommodationReportTotalPagesKey(table) {
    return table === 'item' ? 'itemTotalPages' : `${table}TotalPages`;
  }

  function getAccommodationReportTotalRowsKey(table) {
    return table === 'item' ? 'itemTotalRows' : `${table}TotalRows`;
  }

  function getAccommodationReportSourceTotalKey(table) {
    return table === 'item' ? 'itemSourceTotal' : `${table}SourceTotal`;
  }

  function getAccommodationReportRowsKey(table) {
    return table === 'item' ? 'additionalItems' : `${table}Events`;
  }

  function resetAccommodationReportFilters(table) {
    if (!['check', 'move', 'item'].includes(table)) return;
    if (!state.report.filters[table]) state.report.filters[table] = {};
    if (!state.report.dateFilters[table]) state.report.dateFilters[table] = {};
    if (!state.report.sort[table]) state.report.sort[table] = {};

    state.report.filters[table] = {};
    state.report.dateFilters[table] = { fromDate: '', toDate: '' };
    state.report.sort[table] = { column: null, direction: 'default' };
    state.report[getAccommodationReportPageKey(table)] = 1;

    document
      .querySelectorAll(
        `[data-accommodation-report-filter-table="${table}"], [data-accommodation-report-date-filter^="${table}:"]`,
      )
      .forEach((input) => {
        if (input instanceof HTMLInputElement) input.value = '';
      });
  }

  function renderAccommodationReport() {
    const checkRows = Array.isArray(state.report.checkEvents) ? state.report.checkEvents : [];
    const moveRows = Array.isArray(state.report.moveEvents) ? state.report.moveEvents : [];
    const itemRows = Array.isArray(state.report.additionalItems)
      ? state.report.additionalItems
      : [];
    renderAccommodationReportSortControls();
    syncAccommodationReportDownloadLinks();
    setText('accommodation-report-check-count', state.report.checkTotalRows);
    setText('accommodation-report-move-count', state.report.moveTotalRows);
    setText('accommodation-report-item-count', state.report.itemTotalRows);

    renderReportPager({
      pageLabelId: 'accommodation-report-check-page-label',
      prevButtonId: 'accommodation-report-check-prev-button',
      nextButtonId: 'accommodation-report-check-next-button',
      pageKey: 'checkPage',
      totalPagesKey: 'checkTotalPages',
      totalRows: state.report.checkTotalRows,
    });
    renderReportPager({
      pageLabelId: 'accommodation-report-move-page-label',
      prevButtonId: 'accommodation-report-move-prev-button',
      nextButtonId: 'accommodation-report-move-next-button',
      pageKey: 'movePage',
      totalPagesKey: 'moveTotalPages',
      totalRows: state.report.moveTotalRows,
    });
    renderReportPager({
      pageLabelId: 'accommodation-report-item-page-label',
      prevButtonId: 'accommodation-report-item-prev-button',
      nextButtonId: 'accommodation-report-item-next-button',
      pageKey: 'itemPage',
      totalPagesKey: 'itemTotalPages',
      totalRows: state.report.itemTotalRows,
    });

    const checkBody = byId('accommodation-report-check-body');
    if (checkBody) {
      checkBody.innerHTML = checkRows.length
        ? checkRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(formatDateTimeForDisplay(row.happenedAt))}</td>
                  <td>${escapeHtml(row.eventType === 'check-in' ? 'Check-in' : 'Check-out')}</td>
                  <td>${escapeHtml(row.soldierName || 'Unknown soldier')}</td>
                  <td>${escapeHtml(row.soldierMealCard || 'None')}</td>
                  <td>${escapeHtml(row.laundryBagCode || 'None')}</td>
                  <td>${escapeHtml(getReportCheckKeyName(row) || 'None')}</td>
                </tr>
              `,
            )
            .join('')
        : '<tr><td colspan="6" class="table-empty">No check-in or check-out history matches the current filters.</td></tr>';
    }

    const moveBody = byId('accommodation-report-move-body');
    if (moveBody) {
      moveBody.innerHTML = moveRows.length
        ? moveRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(formatDateTimeForDisplay(row.happenedAt))}</td>
                  <td>${escapeHtml(row.soldierName || 'Unknown soldier')}</td>
                  <td>${escapeHtml(row.previousKeyName || 'None')}</td>
                  <td>${escapeHtml(row.newKeyName || 'None')}</td>
                </tr>
              `,
            )
            .join('')
        : '<tr><td colspan="4" class="table-empty">No soldier move history is available.</td></tr>';
    }

    const itemBody = byId('accommodation-report-item-body');
    if (itemBody) {
      itemBody.innerHTML = itemRows.length
        ? itemRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(formatDateTimeForDisplay(row.createdAt))}</td>
                  <td>${escapeHtml(row.soldierName || 'Unknown soldier')}</td>
                  <td>${escapeHtml(row.description || 'None')}</td>
                  <td>${escapeHtml(row.laundryBagCode || 'None')}</td>
                  <td>${escapeHtml(row.quantity || 'Unspecified')}</td>
                </tr>
              `,
            )
            .join('')
        : '<tr><td colspan="5" class="table-empty">No additional item history is available.</td></tr>';
    }
  }

  function renderAllTables() {
    renderBuildings();
    renderRooms();
    renderKeys();
    renderSoldiers();
    renderAdditionalItems();
    renderAccommodationReport();
    updateControlVisibility();
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
    onInput = () => {},
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
        destroy() {},
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
        const activeOption = byId(`${listboxId}-option-${index}`);
        input.setAttribute('aria-activedescendant', `${listboxId}-option-${index}`);
        activeOption?.scrollIntoView({ block: 'nearest' });
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
        <div class="lookup-option lookup-option--status ${modifier}" role="option" aria-disabled="true">
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
              ${
                option.meta
                  ? `<span class="lookup-option__meta">${escapeHtml(option.meta)}</span>`
                  : ''
              }
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

    function setSelection(row) {
      if (!row) {
        input.value = '';
        hiddenInput.value = '';
        setOpen(false);
        return;
      }
      const label = getLabel(row);
      input.value = label;
      hiddenInput.value = row.id || '';
      if (label && row.id) targetMap.set(label, row.id);
      setOpen(false);
    }

    function syncHiddenId() {
      const matchedId = targetMap.get(input.value);
      if (matchedId) {
        hiddenInput.value = matchedId;
        return;
      }
      if (!input.value) hiddenInput.value = '';
    }

    const debouncedSearch = debounce(() => {
      if (typeof onSearch === 'function') onSearch(input.value.trim());
    }, 250);

    input.addEventListener('focus', () => {
      if (lookupState.options.length) {
        setOpen(true);
        return;
      }
      if (typeof onSearch === 'function') onSearch(input.value.trim());
    });

    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!root.contains(document.activeElement)) setOpen(false);
      }, 0);
    });

    input.addEventListener('input', () => {
      hiddenInput.value = '';
      onInput(input.value.trim());
      renderLoading();
      debouncedSearch();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
        if (!lookupState.options.length) return;
        const nextIndex =
          lookupState.activeIndex < lookupState.options.length - 1
            ? lookupState.activeIndex + 1
            : 0;
        setActiveIndex(nextIndex);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
        if (!lookupState.options.length) return;
        const nextIndex =
          lookupState.activeIndex > 0
            ? lookupState.activeIndex - 1
            : lookupState.options.length - 1;
        setActiveIndex(nextIndex);
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

    const handleDocumentClick = (event) => {
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);

    return {
      close: () => setOpen(false),
      clear() {
        input.value = '';
        hiddenInput.value = '';
        targetMap.clear();
        lookupState.options = [];
        listbox.innerHTML = '';
        setOpen(false);
      },
      destroy() {
        document.removeEventListener('click', handleDocumentClick);
        setOpen(false);
      },
      inputId,
      hiddenInputId,
      listboxId,
      renderLoading,
      renderOptions,
      setSelection,
      syncHiddenId,
    };
  }

  function getBuildingLookupLabel(building) {
    return building?.name || building?.id || '';
  }

  function getRoomLookupLabel(room) {
    if (!room) return '';
    const roomName = room.name || room.id || '';
    return room.buildingName && roomName ? `${room.buildingName} - ${roomName}` : roomName;
  }

  async function loadLookupOptions(lookup, scope, query = {}, { open = true } = {}) {
    lookup.renderLoading({ open });
    const request = scope.next();
    const result = await api.searchLookup({ limit: 20, ...query }, request.signal);
    if (result.aborted || !scope.isCurrent(request.token)) return;
    const rows = result.ok && Array.isArray(result.data?.rows) ? result.data.rows : [];
    lookup.renderOptions(rows, { open });
    lookup.syncHiddenId();
  }

  function loadBuildingOptions(search = '', { open = true } = {}) {
    return loadLookupOptions(
      buildingLookup,
      lookupScopes.building,
      {
        type: 'building',
        search,
      },
      { open },
    );
  }

  function loadRoomOptions(search = '', { open = true } = {}) {
    return loadLookupOptions(
      roomLookup,
      lookupScopes.room,
      {
        type: 'room',
        search,
      },
      { open },
    );
  }

  function renderBuildingOptions(selectedId = '') {
    const selectedBuildingId = selectedId || byId('room-building-input')?.value || '';
    loadBuildingOptions('', { open: false });
    if (selectedBuildingId) buildingLookup.setSelection(findBuilding(selectedBuildingId));
  }

  function renderRoomOptions(selectedId = '') {
    const selectedRoomId = selectedId || byId('key-room-input')?.value || '';
    loadRoomOptions('', { open: false });
    if (selectedRoomId) roomLookup.setSelection(findRoom(selectedRoomId));
  }

  const buildingLookup = createLookupCombobox({
    inputId: 'room-building-search-input',
    hiddenInputId: 'room-building-input',
    listboxId: 'room-building-options',
    targetMap: state.buildingLookup,
    emptyText: 'No buildings match that search.',
    loadingText: 'Searching buildings...',
    getLabel: getBuildingLookupLabel,
    getTitle: getBuildingLookupLabel,
    getMeta: (building) => building.type || building.id || '',
    onSearch: loadBuildingOptions,
  });

  const roomLookup = createLookupCombobox({
    inputId: 'key-room-search-input',
    hiddenInputId: 'key-room-input',
    listboxId: 'key-room-options',
    targetMap: state.roomLookup,
    emptyText: 'No rooms match that search.',
    loadingText: 'Searching rooms...',
    getLabel: getRoomLookupLabel,
    getTitle: (room) => room.name,
    getMeta: (room) => room.buildingName || room.id || '',
    onSearch: loadRoomOptions,
  });

  const soldierLaundryBagLookup = createLookupCombobox({
    inputId: 'soldier-laundry-bag-search-input',
    hiddenInputId: 'soldier-laundry-bag-input',
    listboxId: 'soldier-laundry-bag-options',
    targetMap: state.soldierLaundryBagLookup,
    emptyText: 'No laundry bags match that search.',
    loadingText: 'Searching laundry bags...',
    getLabel: getLaundryBagLookupLabel,
    getTitle: (bag) => bag.code || bag.id,
    getMeta: getLaundryBagLookupMeta,
    onSearch: loadSoldierLaundryBagOptions,
  });

  const soldierUpcomingKeyLookup = createLookupCombobox({
    inputId: 'soldier-upcoming-key-search-input',
    hiddenInputId: 'soldier-upcoming-key-input',
    listboxId: 'soldier-upcoming-key-options',
    targetMap: state.soldierUpcomingKeyLookup,
    emptyText: 'No keys match that search.',
    loadingText: 'Searching keys...',
    getLabel: getKeyLookupLabel,
    getTitle: (key) => key.name || key.id,
    getMeta: getKeyLookupMeta,
    onSearch: loadSoldierUpcomingKeyOptions,
  });

  const accommodateKeyLookup = createLookupCombobox({
    inputId: 'accommodate-soldier-key-search-input',
    hiddenInputId: 'accommodate-soldier-key-input',
    listboxId: 'accommodate-soldier-key-options',
    targetMap: state.accommodateKeyLookup,
    emptyText: 'No free keys match that search.',
    loadingText: 'Searching free keys...',
    getLabel: getKeyLookupLabel,
    getTitle: (key) => key.name || key.id,
    getMeta: getKeyLookupMeta,
    onSearch: loadAccommodateKeyOptions,
  });

  const issueKeySoldierLookup = createLookupCombobox({
    inputId: 'issue-key-soldier-search-input',
    hiddenInputId: 'issue-key-soldier-input',
    listboxId: 'issue-key-soldier-options',
    targetMap: state.issueKeySoldierLookup,
    emptyText: 'No soldiers match that search.',
    loadingText: 'Searching soldiers...',
    getLabel: getSoldierLookupLabel,
    getTitle: (soldier) => soldier.name || soldier.id,
    getMeta: getSoldierLookupMeta,
    onSearch: loadIssueKeySoldierOptions,
  });

  const additionalItemSoldierLookup = createLookupCombobox({
    inputId: 'additional-item-soldier-search-input',
    hiddenInputId: 'additional-item-soldier-input',
    listboxId: 'additional-item-soldier-options',
    targetMap: state.additionalItemSoldierLookup,
    emptyText: 'No soldiers match that search.',
    loadingText: 'Searching soldiers...',
    getLabel: getSoldierLookupLabel,
    getTitle: (soldier) => soldier.name || soldier.id,
    getMeta: getSoldierLookupMeta,
    onSearch: loadAdditionalItemSoldierOptions,
  });

  const additionalItemLaundryBagLookup = createLookupCombobox({
    inputId: 'additional-item-laundry-bag-search-input',
    hiddenInputId: 'additional-item-laundry-bag-input',
    listboxId: 'additional-item-laundry-bag-options',
    targetMap: state.additionalItemLaundryBagLookup,
    emptyText: 'No laundry bags match that search.',
    loadingText: 'Searching laundry bags...',
    getLabel: getLaundryBagLookupLabel,
    getTitle: (bag) => bag.code || bag.id,
    getMeta: getLaundryBagLookupMeta,
    onSearch: loadAdditionalItemLaundryBagOptions,
    onSelect: syncAdditionalItemQuantityForBag,
    onInput: syncAdditionalItemQuantityForBag,
  });

  let bulkAccommodationKeyLookups = [];
  let chainMoveKeyLookups = [];
  let chainMoveKeyIds = [];
  let chainMoveSourceSoldier = null;

  function setModalTitle(titleId, title) {
    const titleEl = byId(titleId);
    if (titleEl) titleEl.textContent = title;
  }

  function syncAdditionalItemQuantityForBag() {
    const quantityInput = byId('additional-item-quantity-input');
    const hasLaundryBag = Boolean(byId('additional-item-laundry-bag-input')?.value);
    if (!quantityInput) return;

    quantityInput.readOnly = hasLaundryBag;
    quantityInput.max = hasLaundryBag ? '1' : '100000';
    quantityInput.title = hasLaundryBag
      ? 'Quantity is fixed at 1 when a laundry bag is selected.'
      : '';
    if (hasLaundryBag) quantityInput.value = '1';
  }

  function getSoldierLookupLabel(soldier) {
    return [soldier?.name || soldier?.id, soldier?.country, soldier?.mealCard]
      .filter(Boolean)
      .join(' | ');
  }

  function getSoldierLookupMeta(soldier) {
    return [
      soldier?.country || 'Unspecified',
      soldier?.mealCard ? `Meal card ${soldier.mealCard}` : '',
      soldier?.laundryBagCode ? `Bag ${soldier.laundryBagCode}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  function getLaundryBagLookupLabel(bag) {
    return [
      bag?.code || bag?.id,
      bag?.rfidCode ? `RFID ${bag.rfidCode}` : '',
      bag?.soldierName ? `assigned to ${bag.soldierName}` : 'available',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  function getLaundryBagLookupMeta(bag) {
    return [
      bag?.rfidCode ? `RFID ${bag.rfidCode}` : '',
      bag?.soldierName ? `Assigned to ${bag.soldierName}` : 'Available',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  function getKeyLookupLabel(key) {
    return [key?.name || key?.id, key?.roomName || 'Unmapped', key?.buildingName || 'No building']
      .filter(Boolean)
      .join(' | ');
  }

  function getKeyLookupMeta(key) {
    return [
      key?.buildingName || '',
      key?.roomName || 'Unmapped',
      key?.soldierName ? `Assigned to ${key.soldierName}` : 'Free',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  function renderLookupOptions(lookup, rows, { open = true } = {}) {
    lookup.renderOptions(rows, { open });
    lookup.syncHiddenId();
  }

  function loadSoldierLaundryBagOptions(search = '', options = {}) {
    return loadLookupOptions(
      soldierLaundryBagLookup,
      lookupScopes.soldierLaundryBag,
      { type: 'laundryBag', search, onlyFree: true },
      options,
    );
  }

  function loadSoldierUpcomingKeyOptions(search = '', options = {}) {
    return loadLookupOptions(
      soldierUpcomingKeyLookup,
      lookupScopes.soldierUpcomingKey,
      { type: 'key', search },
      options,
    );
  }

  function loadAccommodateKeyOptions(search = '', options = {}) {
    return loadLookupOptions(
      accommodateKeyLookup,
      lookupScopes.accommodateKey,
      { type: 'key', search, onlyFree: true },
      options,
    );
  }

  function loadIssueKeySoldierOptions(search = '', options = {}) {
    return loadLookupOptions(
      issueKeySoldierLookup,
      lookupScopes.issueKeySoldier,
      { type: 'soldier', search },
      options,
    );
  }

  function loadAdditionalItemSoldierOptions(search = '', options = {}) {
    return loadLookupOptions(
      additionalItemSoldierLookup,
      lookupScopes.additionalItemSoldier,
      { type: 'soldier', search },
      options,
    );
  }

  function loadAdditionalItemLaundryBagOptions(search = '', options = {}) {
    return loadLookupOptions(
      additionalItemLaundryBagLookup,
      lookupScopes.additionalItemLaundryBag,
      { type: 'laundryBag', search, onlyFree: true },
      options,
    );
  }

  function isLookupOpen(inputId) {
    return byId(inputId)?.getAttribute('aria-expanded') === 'true';
  }

  async function refreshAccommodationLookupOptions() {
    const refreshes = [
      ['room-building-search-input', loadBuildingOptions],
      ['key-room-search-input', loadRoomOptions],
      ['soldier-laundry-bag-search-input', loadSoldierLaundryBagOptions],
      ['soldier-upcoming-key-search-input', loadSoldierUpcomingKeyOptions],
      ['accommodate-soldier-key-search-input', loadAccommodateKeyOptions],
      ['issue-key-soldier-search-input', loadIssueKeySoldierOptions],
      ['additional-item-soldier-search-input', loadAdditionalItemSoldierOptions],
      ['additional-item-laundry-bag-search-input', loadAdditionalItemLaundryBagOptions],
    ]
      .map(([inputId, loadOptions]) => {
        const input = byId(inputId);
        if (!input || input.disabled) return null;
        return loadOptions(input.value.trim(), { open: isLookupOpen(inputId) });
      })
      .filter(Boolean);

    bulkAccommodationKeyLookups.forEach((lookup) => {
      const input = byId(lookup.inputId);
      if (!input || input.disabled || typeof lookup.refreshOptions !== 'function') return;
      refreshes.push(lookup.refreshOptions({ open: isLookupOpen(lookup.inputId) }));
    });

    chainMoveKeyLookups.forEach((lookup) => {
      const input = byId(lookup.inputId);
      if (!input || input.disabled || typeof lookup.refreshOptions !== 'function') return;
      refreshes.push(lookup.refreshOptions({ open: isLookupOpen(lookup.inputId) }));
    });

    await Promise.all(refreshes);
  }

  function renderLookupSelection(lookup, selectedId = '', options = {}) {
    const row = options.selectedRow || null;
    renderLookupOptions(lookup, row ? [row] : [], { open: false });
    lookup.setSelection(selectedId ? row : null);
    if (typeof options.onSelect === 'function') options.onSelect(row);
  }

  function syncSelectedLookupWithRow(lookup, hiddenInputId, findRow, options = {}) {
    const selectedId = byId(hiddenInputId)?.value || '';
    if (!selectedId) return;
    const row = findRow(selectedId);
    lookup.setSelection(row);
    if (typeof options.onSync === 'function') options.onSync(row);
  }

  function syncSelectedLookupText() {
    syncSelectedLookupWithRow(buildingLookup, 'room-building-input', findBuilding);
    syncSelectedLookupWithRow(roomLookup, 'key-room-input', findRoom);
    syncSelectedLookupWithRow(
      soldierLaundryBagLookup,
      'soldier-laundry-bag-input',
      findLaundryBag,
    );
    syncSelectedLookupWithRow(soldierUpcomingKeyLookup, 'soldier-upcoming-key-input', findKey);
    syncSelectedLookupWithRow(accommodateKeyLookup, 'accommodate-soldier-key-input', findKey);
    syncSelectedLookupWithRow(issueKeySoldierLookup, 'issue-key-soldier-input', findSoldier);
    syncSelectedLookupWithRow(
      additionalItemSoldierLookup,
      'additional-item-soldier-input',
      findSoldier,
    );
    syncSelectedLookupWithRow(
      additionalItemLaundryBagLookup,
      'additional-item-laundry-bag-input',
      findLaundryBag,
      { onSync: syncAdditionalItemQuantityForBag },
    );
  }

  function setDetailText(id, value, fallback = '-') {
    const target = byId(id);
    if (target) target.textContent = normalizeText(value) || fallback;
  }

  function getSoldierScheduleValidationMessage() {
    const upcomingAccommodation = byId('soldier-upcoming-accommodation-input')?.value || '';
    const upcomingRelease = byId('soldier-upcoming-release-input')?.value || '';
    if (upcomingAccommodation && upcomingRelease && upcomingRelease < upcomingAccommodation) {
      return SOLDIER_SCHEDULE_MESSAGE;
    }
    return '';
  }

  function syncSoldierScheduleDateBounds() {
    const upcomingAccommodationInput = byId('soldier-upcoming-accommodation-input');
    const upcomingReleaseInput = byId('soldier-upcoming-release-input');
    if (!upcomingAccommodationInput || !upcomingReleaseInput) return;

    upcomingReleaseInput.min = upcomingAccommodationInput.value || '';
    upcomingAccommodationInput.max = upcomingReleaseInput.value || '';
  }

  function renderBriefSoldierDetails(prefix, soldier, mode) {
    setDetailText(`${prefix}-soldier-name-text`, soldier?.name);
    setDetailText(`${prefix}-soldier-country-text`, soldier?.country || 'Unspecified');
    if (mode === 'bag') {
      setDetailText(`${prefix}-soldier-bag-text`, soldier?.laundryBagCode || 'None');
      setDetailText(`${prefix}-soldier-meal-card-text`, soldier?.mealCard || 'None');
      return;
    }
    setDetailText(`${prefix}-soldier-current-key-text`, soldier?.keyName || 'Unassigned');
  }

  function destroyChainMoveLookups() {
    chainMoveKeyLookups.forEach((lookup) => lookup.destroy?.());
    chainMoveKeyLookups = [];
  }

  function resetChainMoveForm() {
    destroyChainMoveLookups();
    chainMoveKeyIds = [];
    chainMoveSourceSoldier = null;
    const list = byId('swap-soldiers-chain-list');
    if (list) list.innerHTML = '';
  }

  function getSoldierCurrentKeyId(soldier) {
    return soldier?.keyId || soldier?.usedKey || '';
  }

  function getChainMoveTerminalState(sourceSoldier, keyIds = []) {
    if (!sourceSoldier || !keyIds.length) return { complete: false, mode: '' };
    const sourceKeyId = getSoldierCurrentKeyId(sourceSoldier);
    const lastKey = findKey(keyIds[keyIds.length - 1]);
    if (!lastKey) return { complete: false, mode: '' };
    if (!lastKey.soldierId) return { complete: true, mode: 'move' };
    if (sourceKeyId && String(lastKey.id) === String(sourceKeyId)) {
      return { complete: keyIds.length > 1, mode: 'swap' };
    }
    return { complete: false, mode: '' };
  }

  function buildChainMoveSteps(sourceSoldier, selectedKeyIds = []) {
    const steps = [];
    const sourceKeyId = getSoldierCurrentKeyId(sourceSoldier);
    let actor = sourceSoldier;

    for (let index = 0; actor && index < 50; index += 1) {
      const selectedKeyId = selectedKeyIds[index] || '';
      const selectedKey = selectedKeyId ? findKey(selectedKeyId) : null;
      steps.push({ index, actor, selectedKeyId, selectedKey });

      if (!selectedKey) break;
      const closesCycle = sourceKeyId && String(selectedKey.id) === String(sourceKeyId);
      if (!selectedKey.soldierId || closesCycle) break;

      const nextActor = findSoldier(selectedKey.soldierId);
      if (!nextActor) break;
      actor = nextActor;
    }

    return steps;
  }

  function getChainMoveExcludedKeyIds(stepIndex = 0, actor = null) {
    const sourceKeyId = getSoldierCurrentKeyId(chainMoveSourceSoldier);
    const actorKeyId = getSoldierCurrentKeyId(actor);
    const selectedBefore = new Set(chainMoveKeyIds.slice(0, stepIndex).map(String));
    const excluded = new Set([...selectedBefore]);
    if (actorKeyId) excluded.add(String(actorKeyId));
    if (stepIndex === 0 && sourceKeyId) excluded.add(String(sourceKeyId));
    return [...excluded].filter(Boolean).join(',');
  }

  function renderChainMoveRows(selectedKeyIds = chainMoveKeyIds) {
    const list = byId('swap-soldiers-chain-list');
    if (!list || !chainMoveSourceSoldier) return;

    destroyChainMoveLookups();
    chainMoveKeyIds = selectedKeyIds.filter(Boolean);
    const steps = buildChainMoveSteps(chainMoveSourceSoldier, chainMoveKeyIds);
    const terminal = getChainMoveTerminalState(chainMoveSourceSoldier, chainMoveKeyIds);

    list.innerHTML = steps
      .map((step) => {
        const searchId = `chain-move-key-search-input-${step.index}`;
        const hiddenId = `chain-move-key-input-${step.index}`;
        const optionsId = `chain-move-key-options-${step.index}`;
        const keyText = step.selectedKey
          ? step.selectedKey.soldierName
            ? `Selected: ${step.selectedKey.name} (${step.selectedKey.soldierName})`
            : `Selected: ${step.selectedKey.name} (free)`
          : 'No destination selected';
        return `
          <div class="rental-detail-panel">
            <div><span>Soldier ${step.index + 1}</span><strong>${escapeHtml(step.actor?.name || '-')}</strong></div>
            <div><span>Nationality</span><strong>${escapeHtml(step.actor?.country || 'Unspecified')}</strong></div>
            <div><span>Current key</span><strong>${escapeHtml(step.actor?.keyName || 'Unassigned')}</strong></div>
            <div><span>Destination</span><strong>${escapeHtml(keyText)}</strong></div>
          </div>
          <div class="field lookup-field">
            <label for="${escapeAttr(searchId)}">Destination key</label>
            <input id="${escapeAttr(hiddenId)}" class="js-chain-move-key-input" name="keyIds[]" type="hidden" />
            <div class="lookup-combobox" data-lookup-combobox>
              <div class="lookup-combobox__control">
                <svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg>
                <input id="${escapeAttr(searchId)}" class="js-chain-move-key-search" type="search" placeholder="Search key" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="${escapeAttr(optionsId)}" required />
                <span class="lookup-combobox__chevron" aria-hidden="true"></span>
              </div>
              <div class="lookup-menu" id="${escapeAttr(optionsId)}" role="listbox" aria-label="Destination key results" hidden></div>
            </div>
          </div>
        `;
      })
      .join('');

    steps.forEach((step) => {
      const targetMap = new Map();
      const scope = createRequestScope();
      let lookup;
      lookup = createLookupCombobox({
        inputId: `chain-move-key-search-input-${step.index}`,
        hiddenInputId: `chain-move-key-input-${step.index}`,
        listboxId: `chain-move-key-options-${step.index}`,
        targetMap,
        emptyText: 'No keys match that search.',
        loadingText: 'Searching keys...',
        getLabel: getKeyLookupLabel,
        getTitle: (key) => key.name || key.id,
        getMeta: getKeyLookupMeta,
        onSearch: (search, options = {}) => {
          void loadLookupOptions(
            lookup,
            scope,
            {
              type: 'key',
              search,
              excludedKeyIds: getChainMoveExcludedKeyIds(step.index, step.actor),
            },
            options,
          );
        },
        onSelect: (option) => {
          const nextKeyIds = chainMoveKeyIds.slice(0, step.index);
          nextKeyIds[step.index] = option.id;
          renderChainMoveRows(nextKeyIds);
        },
        onInput: () => {
          chainMoveKeyIds = chainMoveKeyIds.slice(0, step.index);
        },
      });
      lookup.refreshOptions = (options = {}) =>
        loadLookupOptions(
          lookup,
          scope,
          {
            type: 'key',
            search: byId(lookup.inputId)?.value.trim() || '',
            excludedKeyIds: getChainMoveExcludedKeyIds(step.index, step.actor),
          },
          options,
        );
      chainMoveKeyLookups.push(lookup);
      renderLookupSelection(lookup, step.selectedKeyId, { selectedRow: step.selectedKey });
    });

    setElementDisabled('save-swap-soldiers-button', !terminal.complete || state.isBusy);
    syncAllLookupDisabledStates();
  }

  function isModalVisible(modalId) {
    const modal = byId(modalId);
    return Boolean(modal && !modal.hidden);
  }

  function refreshIssueKeyDetailPanel() {
    if (!isModalVisible('issue-key-modal')) return;
    const keyId = byId('issue-key-id-input')?.value || '';
    const key = findKey(keyId);
    if (!canManageAccommodation() || !key || key.soldierId) {
      issueKeyModal?.close();
      return;
    }

    setDetailText('issue-key-name-text', key.name || 'Unnamed key');
    setDetailText('issue-key-room-text', key.roomName || 'Unmapped');
    setDetailText('issue-key-building-text', key.buildingName || 'Unmapped');

    const selectedSoldierId = byId('issue-key-soldier-input')?.value || '';
    const selectedSoldier = selectedSoldierId ? findSoldier(selectedSoldierId) : null;
    const canKeepSelection =
      selectedSoldier && !isSoldierAccommodated(selectedSoldier) && canManageAccommodation();
    renderLookupSelection(issueKeySoldierLookup, canKeepSelection ? selectedSoldierId : '', {
      selectedRow: canKeepSelection ? selectedSoldier : null,
    });
  }

  function refreshAccommodateSoldierDetailPanel() {
    if (!isModalVisible('accommodate-soldier-modal')) return;
    const soldierId = byId('accommodate-soldier-id-input')?.value || '';
    const soldier = findSoldier(soldierId);
    if (!canManageAccommodation() || !soldier || isSoldierAccommodated(soldier)) {
      accommodateSoldierModal?.close();
      return;
    }

    renderBriefSoldierDetails('accommodate', soldier, 'bag');

    const selectedKeyId = byId('accommodate-soldier-key-input')?.value || '';
    const selectedKey = selectedKeyId ? findKey(selectedKeyId) : null;
    const canKeepSelection =
      selectedKey && !selectedKey.soldierId && isAccommodationKeyEligible(selectedKey);
    renderLookupSelection(accommodateKeyLookup, canKeepSelection ? selectedKeyId : '', {
      selectedRow: canKeepSelection ? selectedKey : null,
    });
  }

  function refreshSwapSoldiersDetailPanel() {
    if (!isModalVisible('swap-soldiers-modal')) return;
    const soldierId = byId('swap-soldier-id-input')?.value || chainMoveSourceSoldier?.id || '';
    const soldier = findSoldier(soldierId);
    if (!canManageAccommodation() || !soldier || !isSoldierAccommodated(soldier)) {
      swapSoldiersModal?.close();
      return;
    }

    chainMoveSourceSoldier = soldier;
    const refreshedKeyIds = [];
    for (const keyId of chainMoveKeyIds) {
      const key = findKey(keyId);
      if (!key || !isAccommodationKeyEligible(key)) break;
      refreshedKeyIds.push(keyId);
    }
    renderChainMoveRows(refreshedKeyIds);
  }

  function refreshDischargeSoldierDetailPanel() {
    if (!isModalVisible('discharge-soldier-modal')) return;
    const soldierId = byId('discharge-soldier-id-input')?.value || '';
    const soldier = findSoldier(soldierId);
    if (!canManageAccommodation() || !soldier || !isSoldierAccommodated(soldier)) {
      dischargeSoldierModal?.close();
      return;
    }

    renderBriefSoldierDetails('discharge', soldier, 'bag');
  }

  function refreshBuildingFormSelection() {
    if (!isModalVisible('building-modal')) return;
    const mode = byId('building-form-mode')?.value || 'create';
    if (mode !== 'edit') return;
    const row = findBuilding(byId('building-id-input')?.value || '');
    if (!canEditBuilding() || !row) {
      buildingModal?.close();
      return;
    }
    byId('building-name-input').value = row.name || '';
    byId('building-type-input').value = row.type || '';
  }

  function refreshRoomFormSelection() {
    if (!isModalVisible('room-modal')) return;
    const mode = byId('room-form-mode')?.value || 'create';
    if (mode !== 'edit') return;
    const row = findRoom(byId('room-id-input')?.value || '');
    if (!canEditRoom() || !row) {
      roomModal?.close();
      return;
    }
    byId('room-name-input').value = row.name || '';
    renderLookupSelection(buildingLookup, row.buildingId || '', {
      selectedRow: findBuilding(row.buildingId || ''),
    });
  }

  function refreshKeyFormSelection() {
    if (!isModalVisible('key-modal')) return;
    const mode = byId('key-form-mode')?.value || 'create';
    if (mode !== 'edit') return;
    const row = findKey(byId('key-id-input')?.value || '');
    if (!canEditKey() || !row) {
      keyModal?.close();
      return;
    }
    byId('key-name-input').value = row.name || '';
    byId('key-nfc-input').value = row.nfcCode || '';
    renderLookupSelection(roomLookup, row.roomId || '', {
      selectedRow: findRoom(row.roomId || ''),
    });
  }

  function refreshSoldierFormSelection() {
    if (!isModalVisible('soldier-modal')) return;
    const mode = byId('soldier-form-mode')?.value || 'create';
    if (mode !== 'edit') return;
    const row = findSoldier(byId('soldier-id-input')?.value || '');
    if (!canEditSoldier() || !row) {
      soldierModal?.close();
      return;
    }
    byId('soldier-name-input').value = row.name || '';
    byId('soldier-country-input').value = row.country || '';
    byId('soldier-meal-card-input').value = row.mealCard || '';
    byId('soldier-upcoming-accommodation-input').value = formatDateForInput(
      row.upcomingAccommodation,
    );
    byId('soldier-upcoming-release-input').value = formatDateForInput(row.upcomingRelease);
    syncSoldierScheduleDateBounds();
    renderLookupSelection(soldierLaundryBagLookup, row.laundryBagId || '', {
      selectedRow: findLaundryBag(row.laundryBagId || ''),
    });
    renderLookupSelection(soldierUpcomingKeyLookup, row.upcomingAccommodationKey || '', {
      selectedRow: findKey(row.upcomingAccommodationKey || ''),
    });
  }

  function refreshAdditionalItemFormSelection() {
    if (!isModalVisible('additional-item-modal')) return;
    const mode = byId('additional-item-form-mode')?.value || 'create';
    if (mode !== 'edit') return;
    const row = findAdditionalItem(byId('additional-item-id-input')?.value || '');
    if (!canEditAdditionalItem() || !row) {
      additionalItemModal?.close();
      return;
    }
    byId('additional-item-description-input').value = row.description || '';
    byId('additional-item-quantity-input').value = row.quantity || '1';
    renderLookupSelection(additionalItemSoldierLookup, row.soldierId || '', {
      selectedRow: findSoldier(row.soldierId || ''),
    });
    renderLookupSelection(additionalItemLaundryBagLookup, row.laundryBagId || '', {
      selectedRow: findLaundryBag(row.laundryBagId || ''),
    });
    syncAdditionalItemQuantityForBag();
  }

  function refreshOpenAccommodationDetailPanels() {
    syncSelectedLookupText();
    refreshBuildingFormSelection();
    refreshRoomFormSelection();
    refreshKeyFormSelection();
    refreshSoldierFormSelection();
    refreshAdditionalItemFormSelection();
    refreshIssueKeyDetailPanel();
    refreshAccommodateSoldierDetailPanel();
    refreshBulkAccommodateSoldiersDetailPanel();
    refreshSwapSoldiersDetailPanel();
    refreshDischargeSoldierDetailPanel();
  }

  function openBuildingModal(mode, row = null) {
    if (mode === 'create' && !canAddBuilding()) return updateControlVisibility();
    if (mode === 'edit' && !canEditBuilding()) return updateControlVisibility();
    byId('building-form')?.reset();
    byId('building-form-mode').value = mode;
    byId('building-id-input').value = row?.id || '';
    byId('building-name-input').value = row?.name || '';
    byId('building-type-input').value = row?.type || '';
    setModalTitle('building-modal-title', mode === 'edit' ? 'Edit building' : 'Add building');
    updateControlVisibility();
    buildingModal?.open();
  }

  function openRoomModal(mode, row = null) {
    if (mode === 'create' && (!canAddRoom() || state.buildings.length === 0))
      return updateControlVisibility();
    if (mode === 'edit' && !canEditRoom()) return updateControlVisibility();
    byId('room-form')?.reset();
    byId('room-form-mode').value = mode;
    byId('room-id-input').value = row?.id || '';
    byId('room-name-input').value = row?.name || '';
    renderBuildingOptions(row?.buildingId || '');
    setModalTitle('room-modal-title', mode === 'edit' ? 'Edit room' : 'Add room');
    updateControlVisibility();
    roomModal?.open();
  }

  function openKeyModal(mode, row = null) {
    if (mode === 'create' && (!canAddKey() || state.rooms.length === 0))
      return updateControlVisibility();
    if (mode === 'edit' && !canEditKey()) return updateControlVisibility();
    byId('key-form')?.reset();
    byId('key-form-mode').value = mode;
    byId('key-id-input').value = row?.id || '';
    byId('key-name-input').value = row?.name || '';
    byId('key-nfc-input').value = row?.nfcCode || '';
    renderRoomOptions(row?.roomId || '');
    setModalTitle('key-modal-title', mode === 'edit' ? 'Edit key' : 'Add key');
    updateControlVisibility();
    keyModal?.open();
  }

  function openIssueKeyModal(row = null) {
    if (!canManageAccommodation() || !row || row.soldierId) return updateControlVisibility();
    byId('issue-key-form')?.reset();
    byId('issue-key-id-input').value = row.id || '';
    setDetailText('issue-key-name-text', row.name || 'Unnamed key');
    setDetailText('issue-key-room-text', row.roomName || 'Unmapped');
    setDetailText('issue-key-building-text', row.buildingName || 'Unmapped');
    renderLookupSelection(issueKeySoldierLookup, '');
    loadIssueKeySoldierOptions('', { open: false });
    updateControlVisibility();
    issueKeyModal?.open();
  }

  function openSoldierModal(mode, row = null) {
    if (mode === 'create' && !canAddSoldier()) return updateControlVisibility();
    if (mode === 'edit' && !canEditSoldier()) return updateControlVisibility();
    byId('soldier-form')?.reset();
    byId('soldier-form-mode').value = mode;
    byId('soldier-id-input').value = row?.id || '';
    byId('soldier-name-input').value = row?.name || '';
    byId('soldier-country-input').value = row?.country || '';
    byId('soldier-meal-card-input').value = row?.mealCard || '';
    byId('soldier-upcoming-accommodation-input').value = formatDateForInput(
      row?.upcomingAccommodation,
    );
    byId('soldier-upcoming-release-input').value = formatDateForInput(row?.upcomingRelease);
    syncSoldierScheduleDateBounds();
    renderLookupSelection(soldierLaundryBagLookup, row?.laundryBagId || '', {
      selectedRow: findLaundryBag(row?.laundryBagId || ''),
    });
    loadSoldierLaundryBagOptions('', { open: false });
    renderLookupSelection(soldierUpcomingKeyLookup, row?.upcomingAccommodationKey || '', {
      selectedRow: findKey(row?.upcomingAccommodationKey || ''),
    });
    loadSoldierUpcomingKeyOptions('', { open: false });
    setModalTitle('soldier-modal-title', mode === 'edit' ? 'Edit soldier' : 'Add soldier');
    updateControlVisibility();
    soldierModal?.open();
  }

  function openAccommodateSoldierModal(row = null) {
    if (!canManageAccommodation() || !row || isSoldierAccommodated(row))
      return updateControlVisibility();
    byId('accommodate-soldier-form')?.reset();
    byId('accommodate-soldier-id-input').value = row.id || '';
    renderBriefSoldierDetails('accommodate', row, 'bag');
    renderLookupSelection(accommodateKeyLookup, '');
    loadAccommodateKeyOptions('', { open: false });
    updateControlVisibility();
    accommodateSoldierModal?.open();
  }

  function getBulkAccommodationSelectionMap() {
    const selections = new Map();
    byId('bulk-accommodate-soldiers-form')
      ?.querySelectorAll('.js-bulk-accommodation-key-input')
      ?.forEach((input) => {
        const soldierId = input.dataset.soldierId || '';
        const keyId = input.value || '';
        if (soldierId && keyId) selections.set(String(soldierId), String(keyId));
      });
    return selections;
  }

  function renderBulkAccommodationRows(selectedSoldiers, selectedKeyIds = new Map()) {
    const list = byId('bulk-accommodate-soldiers-list');
    if (!list) return;
    bulkAccommodationKeyLookups.forEach((lookup) => lookup.destroy?.());
    bulkAccommodationKeyLookups = [];
    if (!selectedSoldiers.length) {
      list.innerHTML = '<p class="table-empty">Select soldiers before opening this action.</p>';
      return;
    }

    list.innerHTML = selectedSoldiers
      .map((soldier, index) => {
        const inputId = `bulk-accommodation-key-input-${index}`;
        const searchInputId = `bulk-accommodation-key-search-${index}`;
        const optionsId = `bulk-accommodation-key-options-${index}`;
        return `
          <div class="bulk-accommodation-row" data-bulk-soldier-id="${escapeAttr(soldier.id)}">
            <div class="bulk-accommodation-row__details">
              <strong>${escapeHtml(soldier.name || 'Unnamed soldier')}</strong>
              <span>${escapeHtml([soldier.country || 'Unspecified', soldier.laundryBagCode || 'No bag'].join(' - '))}</span>
            </div>
            <div class="field lookup-field">
              <label class="sr-only" for="${escapeAttr(searchInputId)}">Free key for ${escapeHtml(soldier.name || 'soldier')}</label>
              <input id="${escapeAttr(inputId)}" class="js-bulk-accommodation-key-input" type="hidden" data-soldier-id="${escapeAttr(soldier.id)}" />
              <div class="lookup-combobox" data-lookup-combobox>
                <div class="lookup-combobox__control">
                  <svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg>
                  <input id="${escapeAttr(searchInputId)}" class="js-bulk-accommodation-key-search" type="search" placeholder="Search free key" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="${escapeAttr(optionsId)}" required />
                  <span class="lookup-combobox__chevron" aria-hidden="true"></span>
                </div>
                <div class="lookup-menu" id="${escapeAttr(optionsId)}" role="listbox" aria-label="Free key results" hidden></div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    bulkAccommodationKeyLookups = selectedSoldiers.map((soldier, index) => {
      const scope = createRequestScope();
      const selectedKeyId = selectedKeyIds.get(String(soldier.id)) || '';
      const selectedKey = selectedKeyId ? findKey(selectedKeyId) : null;
      let lookup;
      lookup = createLookupCombobox({
        inputId: `bulk-accommodation-key-search-${index}`,
        hiddenInputId: `bulk-accommodation-key-input-${index}`,
        listboxId: `bulk-accommodation-key-options-${index}`,
        targetMap: new Map(),
        emptyText: 'No free keys match that search.',
        loadingText: 'Searching free keys...',
        getLabel: getKeyLookupLabel,
        getTitle: (key) => key.name || key.id,
        getMeta: getKeyLookupMeta,
        onSearch: (search = '', options = {}) => {
          void loadLookupOptions(lookup, scope, { type: 'key', search, onlyFree: true }, options);
        },
      });
      lookup.refreshOptions = (options = {}) =>
        loadLookupOptions(
          lookup,
          scope,
          {
            type: 'key',
            search: byId(lookup.inputId)?.value.trim() || '',
            onlyFree: true,
          },
          options,
        );
      void loadLookupOptions(
        lookup,
        scope,
        { type: 'key', search: '', onlyFree: true },
        { open: false },
      );
      if (selectedKey && !selectedKey.soldierId && isAccommodationKeyEligible(selectedKey)) {
        renderLookupSelection(lookup, selectedKeyId, { selectedRow: selectedKey });
      }
      return lookup;
    });
  }

  function refreshBulkAccommodateSoldiersDetailPanel() {
    if (!isModalVisible('bulk-accommodate-soldiers-modal')) return;
    if (!canManageAccommodation()) {
      bulkAccommodateSoldiersModal?.close();
      return;
    }
    const selectedKeyIds = getBulkAccommodationSelectionMap();
    const selectedSoldiers = getSelectedRows(
      state.selectedSoldierAccommodationIds,
      state.soldiers,
      isSoldierAccommodationEligible,
    );
    renderBulkAccommodationRows(selectedSoldiers, selectedKeyIds);
  }

  function openBulkAccommodateSoldiersModal() {
    if (!canManageAccommodation()) return updateControlVisibility();
    const selectedSoldiers = getSelectedRows(
      state.selectedSoldierAccommodationIds,
      state.soldiers,
      isSoldierAccommodationEligible,
    );
    if (!selectedSoldiers.length) {
      toast.show({
        title: 'No soldiers selected',
        message: 'Select one or more unaccommodated soldiers first.',
        variant: 'warning',
      });
      return;
    }
    const freeKeyCount = state.keys.filter(
      (key) => !key.soldierId && isAccommodationKeyEligible(key),
    ).length;
    if (freeKeyCount < selectedSoldiers.length) {
      toast.show({
        title: 'Not enough free keys',
        message: `Select ${selectedSoldiers.length} free keys, but only ${freeKeyCount} are available.`,
        variant: 'warning',
      });
      return;
    }

    byId('bulk-accommodate-soldiers-form')?.reset();
    renderBulkAccommodationRows(selectedSoldiers);
    updateControlVisibility();
    bulkAccommodateSoldiersModal?.open();
  }

  function openSwapSoldiersModal(row = null) {
    if (!canManageAccommodation() || !row || !isSoldierAccommodated(row))
      return updateControlVisibility();
    byId('swap-soldiers-form')?.reset();
    byId('swap-soldier-id-input').value = row.id || '';
    chainMoveSourceSoldier = row;
    chainMoveKeyIds = [];
    renderChainMoveRows([]);
    updateControlVisibility();
    swapSoldiersModal?.open();
  }

  function openDischargeSoldierModal(row = null) {
    if (!canManageAccommodation() || !row || !isSoldierAccommodated(row))
      return updateControlVisibility();
    byId('discharge-soldier-form')?.reset();
    byId('discharge-soldier-id-input').value = row.id || '';
    renderBriefSoldierDetails('discharge', row, 'bag');
    updateControlVisibility();
    dischargeSoldierModal?.open();
  }

  function openAdditionalItemModal(mode, row = null) {
    if (mode === 'create' && (!canAddAdditionalItem() || state.soldiers.length === 0))
      return updateControlVisibility();
    if (mode === 'edit' && !canEditAdditionalItem()) return updateControlVisibility();
    byId('additional-item-form')?.reset();
    byId('additional-item-form-mode').value = mode;
    byId('additional-item-id-input').value = row?.id || '';
    byId('additional-item-description-input').value = row?.description || '';
    byId('additional-item-quantity-input').value = row?.quantity || '1';
    renderLookupSelection(additionalItemSoldierLookup, row?.soldierId || '', {
      selectedRow: findSoldier(row?.soldierId || ''),
    });
    loadAdditionalItemSoldierOptions('', { open: false });
    renderLookupSelection(additionalItemLaundryBagLookup, row?.laundryBagId || '', {
      selectedRow: findLaundryBag(row?.laundryBagId || ''),
    });
    syncAdditionalItemQuantityForBag();
    loadAdditionalItemLaundryBagOptions('', { open: false });
    setModalTitle('additional-item-modal-title', mode === 'edit' ? 'Edit item' : 'Add item');
    updateControlVisibility();
    additionalItemModal?.open();
  }

  function reportInvalidForm(form, message) {
    if (message) {
      showMissingInformation(form, { message });
      return true;
    }
    if (!form?.checkValidity()) {
      showMissingInformation(form);
      return true;
    }
    return false;
  }

  function getImportConfig(resource) {
    return importConfigs[resource] || null;
  }

  function renderImportSummary(resource) {
    const config = getImportConfig(resource);
    const importState = state.imports[resource];
    const node = byId(config?.summaryId);
    if (!node) return;
    const summary = importState?.summary;
    if (!summary) {
      node.innerHTML = '';
      return;
    }
    node.innerHTML = [
      { value: summary.addedCount || 0, label: 'Added' },
      { value: summary.updatedCount || 0, label: 'Updated' },
      { value: summary.skippedCount || 0, label: 'Skipped' },
      { value: summary.errorCount || 0, label: 'Errors' },
    ]
      .map(
        (item) => `
          <div class="accommodation-import-summary-item">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `,
      )
      .join('');
  }

  function renderImportErrors(resource) {
    const config = getImportConfig(resource);
    const importState = state.imports[resource];
    const node = byId(config?.errorsId);
    if (!node) return;
    const errors = Array.isArray(importState?.errors) ? importState.errors : [];
    node.hidden = errors.length === 0;
    node.innerHTML = errors
      .map(
        (error) =>
          `<div>Row ${escapeHtml(error.rowNumber || '-')}: ${escapeHtml(error.message || 'The row could not be processed.')}</div>`,
      )
      .join('');
  }

  function renderImportProgress(resource) {
    const config = getImportConfig(resource);
    const importState = state.imports[resource];
    if (!config || !importState) return;

    const panel = byId(config.progressPanelId);
    if (panel) panel.hidden = !importState.visible;
    const selectedFile = byId(config.selectedFileId);
    if (selectedFile) selectedFile.textContent = importState.fileName || 'No file selected.';
    const uploadLabel = byId(config.uploadLabelId);
    if (uploadLabel) uploadLabel.textContent = `${importState.uploadPercent}%`;
    const uploadBar = byId(config.uploadBarId);
    setProgressValue(uploadBar, importState.uploadPercent);
    const processingLabel = byId(config.processingLabelId);
    if (processingLabel) processingLabel.textContent = `${importState.processingPercent}%`;
    const processingBar = byId(config.processingBarId);
    setProgressValue(processingBar, importState.processingPercent);
    const status = byId(config.statusId);
    if (status) status.textContent = importState.statusMessage || 'Waiting to start.';
    renderImportSummary(resource);
    renderImportErrors(resource);
    updateControlVisibility();
  }

  function resetImportProgress(resource, { keepFileName = false } = {}) {
    const config = getImportConfig(resource);
    const importState = state.imports[resource];
    if (!config || !importState) return;
    importState.uploadPercent = 0;
    importState.processingPercent = 0;
    importState.statusMessage = 'Download the template to begin.';
    importState.summary = null;
    importState.errors = [];
    importState.visible = false;
    importState.isBusy = false;
    if (!keepFileName) importState.fileName = '';
    if (!keepFileName) {
      const fileInput = byId(config.fileInputId);
      if (fileInput) fileInput.value = '';
    }
    renderImportProgress(resource);
  }

  function applyImportPayload(resource, payload = {}) {
    const importState = state.imports[resource];
    if (!importState) return;
    const summary = payload.summary || null;
    importState.visible = true;
    importState.statusMessage = payload.message || importState.statusMessage;
    importState.processingPercent = Number(payload.progressPercent) || 0;
    if (importState.processingPercent > 0) importState.uploadPercent = 100;
    if (summary) {
      importState.summary = {
        totalRows: Number(summary.totalRows) || 0,
        processedRows: Number(summary.processedRows) || 0,
        addedCount: Number(summary.addedCount) || 0,
        updatedCount: Number(summary.updatedCount) || 0,
        skippedCount: Number(summary.skippedCount) || 0,
        errorCount: Number(summary.errorCount) || 0,
      };
      if (Array.isArray(summary.errors)) importState.errors = summary.errors;
    }
    if (Array.isArray(payload.errors) && payload.errors.length) importState.errors = payload.errors;
    renderImportProgress(resource);
  }

  async function uploadImportTemplate(resource) {
    const config = getImportConfig(resource);
    const importState = state.imports[resource];
    if (!config || !importState) return;
    if (!config.canImport()) return updateControlVisibility();

    const input = byId(config.fileInputId);
    const file = input?.files?.[0];
    if (!file) {
      toast.show({
        title: 'Missing information',
        message: `Choose a completed ${config.label} template before uploading.`,
        variant: 'warning',
      });
      return;
    }

    importState.fileName = file.name;
    importState.uploadPercent = 0;
    importState.processingPercent = 0;
    importState.statusMessage = 'Uploading template...';
    importState.summary = null;
    importState.errors = [];
    importState.visible = true;
    importState.isBusy = true;
    renderImportProgress(resource);

    const result = await config.upload(file, {
      onUploadProgress: (progress) => {
        importState.uploadPercent = progress;
        importState.statusMessage =
          progress >= 100 ? 'Upload complete. Processing template...' : 'Uploading template...';
        renderImportProgress(resource);
      },
    });

    importState.isBusy = false;
    const body = result?.data || result?.body || {};
    applyImportPayload(resource, {
      message: body?.message || result?.message || `The ${config.label} template was processed.`,
      summary: body?.summary || null,
      progressPercent:
        body?.summary?.totalRows > 0
          ? Math.round(((body.summary.processedRows || 0) / body.summary.totalRows) * 100)
          : 0,
    });

    if (!result?.ok) {
      toast.show({
        title: 'Import failed',
        message:
          body?.message ||
          result?.message ||
          `The ${config.label} template could not be processed.`,
        variant: 'danger',
      });
      return;
    }

    if (input) input.value = '';
    toast.show({
      title:
        importState.summary?.errorCount > 0 ? 'Import completed with warnings' : 'Import completed',
      message: body?.message || `The ${config.label} template was processed successfully.`,
      variant: importState.summary?.errorCount > 0 ? 'warning' : 'success',
    });
    await load({ quiet: true });
  }

  async function saveBuilding(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = byId('building-form-mode').value || 'create';
    if (mode === 'create' && !canAddBuilding()) return updateControlVisibility();
    if (mode === 'edit' && !canEditBuilding()) return updateControlVisibility();
    if (reportInvalidForm(form)) return;

    const payload = {
      name: normalizeText(byId('building-name-input').value),
      type: normalizeText(byId('building-type-input').value),
    };

    if (!payload.name) return;

    const confirmed = await confirmAction({
      title: mode === 'edit' ? 'Save building changes' : 'Create building',
      message: () => {
        const name = normalizeText(byId('building-name-input')?.value);
        const type = normalizeText(byId('building-type-input')?.value);
        return mode === 'edit'
          ? `Save the edited name and type for building "${name || payload.name}".`
          : `Create building "${name || payload.name}" with type "${type || 'not set'}".`;
      },
      confirmText: mode === 'edit' ? 'Save changes' : 'Create building',
      variant: 'warning',
      canConfirm: () => (mode === 'edit' ? canEditBuilding() : canAddBuilding()),
    });
    if (!confirmed) return;

    const button = byId('save-building-button');
    if (button) button.disabled = true;
    pageState.set('loading', mode === 'edit' ? 'Saving building...' : 'Creating building...');
    const result =
      mode === 'edit'
        ? await api.editBuilding({ ...payload, buildingId: byId('building-id-input').value })
        : await api.addBuilding(payload);
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    buildingModal?.close();
    pageState.set('success', result.data?.message || 'Building saved successfully.');
    toast.show({
      title: 'Building saved',
      message: result.data?.message || 'Building saved successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveRoom(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = byId('room-form-mode').value || 'create';
    if (mode === 'create' && !canAddRoom()) return updateControlVisibility();
    if (mode === 'edit' && !canEditRoom()) return updateControlVisibility();
    if (
      reportInvalidForm(form, state.buildings.length ? '' : 'Add a building before saving rooms.')
    )
      return;
    buildingLookup.syncHiddenId();

    const payload = {
      name: normalizeText(byId('room-name-input').value),
      buildingId: byId('room-building-input').value,
    };
    if (!payload.buildingId) {
      showMissingInformation(form, {
        message: 'Choose a building from the search results before saving the room.',
        focusId: 'room-building-search-input',
      });
      return;
    }
    const confirmed = await confirmAction({
      title: mode === 'edit' ? 'Save room changes' : 'Create room',
      message: () => {
        const name = normalizeText(byId('room-name-input')?.value) || payload.name;
        const building = findBuilding(byId('room-building-input')?.value || payload.buildingId);
        return mode === 'edit'
          ? `Save the edited name and building assignment for room "${name}".`
          : `Create room "${name}" in ${building?.name || 'the selected building'}.`;
      },
      confirmText: mode === 'edit' ? 'Save changes' : 'Create room',
      variant: 'warning',
      canConfirm: () =>
        (mode === 'edit' ? canEditRoom() : canAddRoom()) && state.buildings.length > 0,
    });
    if (!confirmed) return;

    const button = byId('save-room-button');
    if (button) button.disabled = true;
    pageState.set('loading', mode === 'edit' ? 'Saving room...' : 'Creating room...');
    const result =
      mode === 'edit'
        ? await api.editRoom({ ...payload, roomId: byId('room-id-input').value })
        : await api.addRoom(payload);
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    roomModal?.close();
    pageState.set('success', result.data?.message || 'Room saved successfully.');
    toast.show({
      title: 'Room saved',
      message: result.data?.message || 'Room saved successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveKey(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = byId('key-form-mode').value || 'create';
    if (mode === 'create' && !canAddKey()) return updateControlVisibility();
    if (mode === 'edit' && !canEditKey()) return updateControlVisibility();
    if (reportInvalidForm(form, state.rooms.length ? '' : 'Add a room before saving keys.')) return;
    roomLookup.syncHiddenId();

    const payload = {
      name: normalizeText(byId('key-name-input').value),
      nfcCode: normalizeText(byId('key-nfc-input').value),
      roomId: byId('key-room-input').value,
    };
    if (!payload.roomId) {
      showMissingInformation(form, {
        message: 'Choose a room from the search results before saving the key.',
        focusId: 'key-room-search-input',
      });
      return;
    }
    const confirmed = await confirmAction({
      title: mode === 'edit' ? 'Save key changes' : 'Create key',
      message: () => {
        const name = normalizeText(byId('key-name-input')?.value) || payload.name;
        const nfcCode = normalizeText(byId('key-nfc-input')?.value) || 'not set';
        const room = findRoom(byId('key-room-input')?.value || payload.roomId);
        return mode === 'edit'
          ? `Save the edited room assignment and NFC code for key "${name}".`
          : `Create key "${name}" with NFC ${nfcCode} for ${room?.name || 'the selected room'}.`;
      },
      confirmText: mode === 'edit' ? 'Save changes' : 'Create key',
      variant: 'warning',
      canConfirm: () => (mode === 'edit' ? canEditKey() : canAddKey()) && state.rooms.length > 0,
    });
    if (!confirmed) return;

    const button = byId('save-key-button');
    if (button) button.disabled = true;
    pageState.set('loading', mode === 'edit' ? 'Saving key...' : 'Creating key...');
    const result =
      mode === 'edit'
        ? await api.editKey({ ...payload, keyId: byId('key-id-input').value })
        : await api.addKey(payload);
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    keyModal?.close();
    pageState.set('success', result.data?.message || 'Key saved successfully.');
    toast.show({
      title: 'Key saved',
      message: result.data?.message || 'Key saved successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveIssueKey(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!canManageAccommodation()) return updateControlVisibility();
    if (reportInvalidForm(form)) return;
    issueKeySoldierLookup.syncHiddenId();

    const keyId = byId('issue-key-id-input').value || '';
    const soldierId = byId('issue-key-soldier-input').value || '';
    if (!soldierId) {
      showMissingInformation(form, {
        message: 'Choose a soldier from the search results before issuing the key.',
        focusId: 'issue-key-soldier-search-input',
      });
      return;
    }

    const confirmed = await confirmAction({
      title: 'Issue key',
      message: () => {
        const key = findKey(keyId);
        const soldier = findSoldier(byId('issue-key-soldier-input')?.value || soldierId);
        return `Issue key "${key?.name || 'this key'}" to "${soldier?.name || 'the selected soldier'}" and mark it as occupied.`;
      },
      confirmText: 'Issue key',
      variant: 'warning',
      canConfirm: () => {
        const key = findKey(keyId);
        const selectedSoldier = findSoldier(byId('issue-key-soldier-input')?.value || soldierId);
        return Boolean(
          canManageAccommodation() &&
            key &&
            !key.soldierId &&
            selectedSoldier &&
            !isSoldierAccommodated(selectedSoldier),
        );
      },
    });
    if (!confirmed) return;

    const button = byId('save-issue-key-button');
    if (button) button.disabled = true;
    pageState.set('loading', 'Issuing key...');
    const result = await api.issueKey({ keyId, soldierId });
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    issueKeyModal?.close();
    pageState.set('success', result.data?.message || 'Key issued successfully.');
    toast.show({
      title: 'Key issued',
      message: result.data?.message || 'Key issued successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveSoldier(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = byId('soldier-form-mode').value || 'create';
    if (mode === 'create' && !canAddSoldier()) return updateControlVisibility();
    if (mode === 'edit' && !canEditSoldier()) return updateControlVisibility();
    syncSoldierScheduleDateBounds();
    if (reportInvalidForm(form, getSoldierScheduleValidationMessage())) return;
    soldierLaundryBagLookup.syncHiddenId();
    soldierUpcomingKeyLookup.syncHiddenId();

    const payload = {
      name: normalizeText(byId('soldier-name-input').value),
      country: normalizeText(byId('soldier-country-input').value),
      mealCard: normalizeText(byId('soldier-meal-card-input').value),
      laundryBagId: byId('soldier-laundry-bag-input').value || '',
      upcomingAccommodation: byId('soldier-upcoming-accommodation-input').value || '',
      upcomingRelease: byId('soldier-upcoming-release-input').value || '',
      upcomingAccommodationKey: byId('soldier-upcoming-key-input').value || '',
    };
    if (!payload.name) return;

    const confirmed = await confirmAction({
      title: mode === 'edit' ? 'Save soldier changes' : 'Create soldier',
      message: () => {
        const name = normalizeText(byId('soldier-name-input')?.value) || payload.name;
        return mode === 'edit'
          ? `Save the edited profile, laundry bag, and upcoming accommodation details for "${name}".`
          : `Create soldier "${name}" with the entered profile and assignment details.`;
      },
      confirmText: mode === 'edit' ? 'Save changes' : 'Create soldier',
      variant: 'warning',
      canConfirm: () => (mode === 'edit' ? canEditSoldier() : canAddSoldier()),
    });
    if (!confirmed) return;

    const button = byId('save-soldier-button');
    if (button) button.disabled = true;
    pageState.set('loading', mode === 'edit' ? 'Saving soldier...' : 'Creating soldier...');
    const result =
      mode === 'edit'
        ? await api.editSoldier({ ...payload, soldierId: byId('soldier-id-input').value })
        : await api.addSoldier(payload);
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    soldierModal?.close();
    pageState.set('success', result.data?.message || 'Soldier saved successfully.');
    toast.show({
      title: 'Soldier saved',
      message: result.data?.message || 'Soldier saved successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveAccommodateSoldier(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!canManageAccommodation()) return updateControlVisibility();
    if (reportInvalidForm(form)) return;
    accommodateKeyLookup.syncHiddenId();

    const soldierId = byId('accommodate-soldier-id-input').value;
    const keyId = byId('accommodate-soldier-key-input').value;
    if (!keyId) {
      showMissingInformation(form, {
        message: 'Choose a free key before accommodating the soldier.',
        focusId: 'accommodate-soldier-key-search-input',
      });
      return;
    }

    const confirmed = await confirmAction({
      title: 'Accommodate soldier',
      message: () => {
        const soldier = findSoldier(soldierId);
        const key = findKey(byId('accommodate-soldier-key-input')?.value || keyId);
        return `Assign key "${key?.name || 'the selected free key'}" to "${soldier?.name || 'this soldier'}" and mark the soldier as accommodated.`;
      },
      confirmText: 'Accommodate',
      variant: 'warning',
      canConfirm: () => {
        const soldier = findSoldier(soldierId);
        const key = findKey(byId('accommodate-soldier-key-input')?.value || keyId);
        return Boolean(
          canManageAccommodation() &&
            soldier &&
            isSoldierAccommodationEligible(soldier) &&
            key &&
            !key.soldierId &&
            isAccommodationKeyEligible(key),
        );
      },
    });
    if (!confirmed) return;

    const button = byId('save-accommodate-soldier-button');
    if (button) button.disabled = true;
    pageState.set('loading', 'Accommodating soldier...');
    const result = await api.accommodateSoldier({ soldierId, keyId });
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    accommodateSoldierModal?.close();
    pageState.set('success', result.data?.message || 'Soldier accommodated successfully.');
    toast.show({
      title: 'Soldier accommodated',
      message: result.data?.message || 'Soldier accommodated successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveBulkAccommodateSoldiers(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!canManageAccommodation()) return updateControlVisibility();
    if (reportInvalidForm(form)) return;

    const collectAssignments = () => {
      bulkAccommodationKeyLookups.forEach((lookup) => lookup.syncHiddenId());
      const keyInputs = Array.from(form.querySelectorAll('.js-bulk-accommodation-key-input'));
      const assignments = keyInputs
        .map((input) => ({
          soldierId: input.dataset.soldierId || '',
          keyId: input.value || '',
        }))
        .filter((assignment) => assignment.soldierId && assignment.keyId);
      return { assignments, keyInputs };
    };
    const hasValidBulkAccommodationSelection = () => {
      const { assignments, keyInputs } = collectAssignments();
      const keyIds = assignments.map((assignment) => assignment.keyId);
      if (assignments.length !== keyInputs.length || new Set(keyIds).size !== keyIds.length) {
        return false;
      }
      return assignments.every((assignment) => {
        const soldier = findSoldier(assignment.soldierId);
        const key = findKey(assignment.keyId);
        return (
          soldier &&
          isSoldierAccommodationEligible(soldier) &&
          key &&
          !key.soldierId &&
          isAccommodationKeyEligible(key)
        );
      });
    };
    let { assignments, keyInputs } = collectAssignments();
    let keyIds = assignments.map((assignment) => assignment.keyId);
    if (assignments.length !== keyInputs.length) {
      showMissingInformation(form, {
        message: 'Choose one free key for each selected soldier.',
      });
      return;
    }
    if (new Set(keyIds).size !== keyIds.length) {
      toast.show({
        title: 'Duplicate key',
        message: 'Choose a different free key for each soldier.',
        variant: 'warning',
      });
      return;
    }

    const confirmed = await confirmAction({
      title: 'Accommodate selected soldiers',
      message: () => {
        const currentAssignments = collectAssignments().assignments;
        return `Assign selected free keys to ${currentAssignments.length} soldiers and mark them as accommodated.`;
      },
      confirmText: 'Accommodate selected',
      variant: 'warning',
      canConfirm: () => canManageAccommodation() && hasValidBulkAccommodationSelection(),
    });
    if (!confirmed) return;
    ({ assignments, keyInputs } = collectAssignments());
    keyIds = assignments.map((assignment) => assignment.keyId);
    if (
      assignments.length !== keyInputs.length ||
      new Set(keyIds).size !== keyIds.length ||
      !hasValidBulkAccommodationSelection()
    ) {
      toast.show({
        title: 'Selection changed',
        message: 'Review the selected soldiers and free keys before accommodating.',
        variant: 'warning',
      });
      return;
    }

    const button = byId('save-bulk-accommodate-soldiers-button');
    if (button) button.disabled = true;
    pageState.set('loading', 'Accommodating selected soldiers...');
    const result = await api.accommodateSoldiers({ assignments });
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    state.selectedSoldierAccommodationIds.clear();
    bulkAccommodateSoldiersModal?.close();
    pageState.set(
      'success',
      result.data?.message || 'Selected soldiers accommodated successfully.',
    );
    toast.show({
      title: 'Soldiers accommodated',
      message: result.data?.message || 'Selected soldiers accommodated successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function releaseSelectedRooms() {
    if (!canManageAccommodation()) return updateControlVisibility();
    let rows = getSelectedRows(state.selectedRoomReleaseIds, state.rooms, isRoomReleaseEligible);
    if (!rows.length) {
      toast.show({
        title: 'No rooms selected',
        message: 'Select one or more occupied rooms first.',
        variant: 'warning',
      });
      return;
    }

    const confirmed = await confirmAction({
      title: 'Release selected rooms',
      message: () => {
        const currentRows = getSelectedRows(
          state.selectedRoomReleaseIds,
          state.rooms,
          isRoomReleaseEligible,
        );
        return `Release all accommodated soldiers from ${currentRows.length} selected rooms and free their assigned keys.`;
      },
      confirmText: 'Release rooms',
      variant: 'danger',
      canConfirm: () =>
        canManageAccommodation() &&
        getSelectedRows(state.selectedRoomReleaseIds, state.rooms, isRoomReleaseEligible).length >
          0,
    });
    if (!confirmed) return;
    rows = getSelectedRows(state.selectedRoomReleaseIds, state.rooms, isRoomReleaseEligible);
    if (!rows.length) {
      toast.show({
        title: 'Selection changed',
        message: 'Select one or more occupied rooms first.',
        variant: 'warning',
      });
      return;
    }

    pageState.set('loading', 'Releasing selected rooms...');
    const result = await api.releaseRooms(rows.map((row) => row.id));
    if (!result?.ok) return showRequestFailureToast(result);
    state.selectedRoomReleaseIds.clear();
    pageState.set('success', result.data?.message || 'Selected rooms released successfully.');
    toast.show({
      title: 'Rooms released',
      message: result.data?.message || 'Selected rooms released successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function releaseSelectedBuildings() {
    if (!canManageAccommodation()) return updateControlVisibility();
    let rows = getSelectedRows(
      state.selectedBuildingReleaseIds,
      state.buildings,
      isBuildingReleaseEligible,
    );
    if (!rows.length) {
      toast.show({
        title: 'No buildings selected',
        message: 'Select one or more occupied buildings first.',
        variant: 'warning',
      });
      return;
    }

    const confirmed = await confirmAction({
      title: 'Release selected buildings',
      message: () => {
        const currentRows = getSelectedRows(
          state.selectedBuildingReleaseIds,
          state.buildings,
          isBuildingReleaseEligible,
        );
        return `Release all accommodated soldiers from ${currentRows.length} selected buildings and free their assigned keys.`;
      },
      confirmText: 'Release buildings',
      variant: 'danger',
      canConfirm: () =>
        canManageAccommodation() &&
        getSelectedRows(
          state.selectedBuildingReleaseIds,
          state.buildings,
          isBuildingReleaseEligible,
        ).length > 0,
    });
    if (!confirmed) return;
    rows = getSelectedRows(
      state.selectedBuildingReleaseIds,
      state.buildings,
      isBuildingReleaseEligible,
    );
    if (!rows.length) {
      toast.show({
        title: 'Selection changed',
        message: 'Select one or more occupied buildings first.',
        variant: 'warning',
      });
      return;
    }

    pageState.set('loading', 'Releasing selected buildings...');
    const result = await api.releaseBuildings(rows.map((row) => row.id));
    if (!result?.ok) return showRequestFailureToast(result);
    state.selectedBuildingReleaseIds.clear();
    pageState.set('success', result.data?.message || 'Selected buildings released successfully.');
    toast.show({
      title: 'Buildings released',
      message: result.data?.message || 'Selected buildings released successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveSwapSoldiers(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!canManageAccommodation()) return updateControlVisibility();
    if (reportInvalidForm(form)) return;
    chainMoveKeyLookups.forEach((lookup) => lookup.syncHiddenId());

    const soldierId = byId('swap-soldier-id-input').value;
    const keyIds = Array.from(document.querySelectorAll('.js-chain-move-key-input'))
      .map((input) => input.value)
      .filter(Boolean);
    const terminal = getChainMoveTerminalState(chainMoveSourceSoldier, keyIds);
    if (!keyIds.length) {
      showMissingInformation(form, {
        message: 'Choose a destination key before moving soldiers.',
      });
      return;
    }
    if (!terminal.complete) {
      toast.show({
        title: 'Chain incomplete',
        message: 'Choose a destination for each displaced soldier.',
        variant: 'warning',
      });
      return;
    }

    const confirmed = await confirmAction({
      title: 'Move soldiers',
      message: () => {
        const source = findSoldier(soldierId) || chainMoveSourceSoldier;
        const count = buildChainMoveSteps(source, chainMoveKeyIds).filter(
          (step) => step.selectedKey,
        ).length;
        return `Move ${count || 'the selected'} soldiers through this key chain and update each affected key assignment.`;
      },
      confirmText: 'Move soldiers',
      variant: 'warning',
      canConfirm: () =>
        canManageAccommodation() &&
        getChainMoveTerminalState(chainMoveSourceSoldier, chainMoveKeyIds).complete,
    });
    if (!confirmed) return;

    const button = byId('save-swap-soldiers-button');
    if (button) button.disabled = true;
    pageState.set('loading', 'Moving soldiers...');
    const result = await api.moveSoldier({ soldierId, keyIds });
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    swapSoldiersModal?.close();
    pageState.set('success', result.data?.message || 'Soldiers moved successfully.');
    toast.show({
      title: 'Soldiers moved',
      message: result.data?.message || 'Soldiers moved successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveDischargeSoldier(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!canManageAccommodation()) return updateControlVisibility();
    if (reportInvalidForm(form)) return;

    const soldierId = byId('discharge-soldier-id-input').value;
    const confirmed = await confirmAction({
      title: 'Discharge soldier',
      message: () => {
        const soldier = findSoldier(soldierId);
        return `Discharge "${soldier?.name || 'this soldier'}", clear their accommodation, and release their assigned key.`;
      },
      confirmText: 'Discharge soldier',
      variant: 'danger',
      canConfirm: () => {
        const soldier = findSoldier(soldierId);
        return Boolean(canManageAccommodation() && soldier && isSoldierAccommodated(soldier));
      },
    });
    if (!confirmed) return;

    const button = byId('save-discharge-soldier-button');
    if (button) button.disabled = true;
    pageState.set('loading', 'Discharging soldier...');
    const result = await api.dischargeSoldier(soldierId);
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    dischargeSoldierModal?.close();
    pageState.set('success', result.data?.message || 'Soldier discharged successfully.');
    toast.show({
      title: 'Soldier discharged',
      message: result.data?.message || 'Soldier discharged successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  async function saveAdditionalItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = byId('additional-item-form-mode').value || 'create';
    if (mode === 'create' && !canAddAdditionalItem()) return updateControlVisibility();
    if (mode === 'edit' && !canEditAdditionalItem()) return updateControlVisibility();
    if (reportInvalidForm(form, state.soldiers.length ? '' : 'Add a soldier before saving items.'))
      return;
    additionalItemSoldierLookup.syncHiddenId();
    additionalItemLaundryBagLookup.syncHiddenId();
    syncAdditionalItemQuantityForBag();

    const payload = {
      soldierId: byId('additional-item-soldier-input').value,
      description: normalizeText(byId('additional-item-description-input').value),
      quantity: normalizePositiveIntegerText(byId('additional-item-quantity-input').value),
      laundryBagId: byId('additional-item-laundry-bag-input').value || '',
    };
    if (!payload.soldierId) {
      showMissingInformation(form, {
        message: 'Choose a soldier before saving the item.',
        focusId: 'additional-item-soldier-search-input',
      });
      return;
    }
    if (!payload.description) {
      showMissingInformation(form, {
        message: 'Enter an item description before saving.',
        focusId: 'additional-item-description-input',
      });
      return;
    }

    const confirmed = await confirmAction({
      title: mode === 'edit' ? 'Save item changes' : 'Create item',
      message: () => {
        const description =
          normalizeText(byId('additional-item-description-input')?.value) || payload.description;
        const soldier = findSoldier(byId('additional-item-soldier-input')?.value || payload.soldierId);
        return mode === 'edit'
          ? `Save the edited soldier, quantity, and laundry bag details for item "${description}".`
          : `Create additional item "${description}" for ${soldier?.name || 'the selected soldier'}.`;
      },
      confirmText: mode === 'edit' ? 'Save changes' : 'Create item',
      variant: 'warning',
      canConfirm: () =>
        (mode === 'edit' ? canEditAdditionalItem() : canAddAdditionalItem()) &&
        state.soldiers.length > 0,
    });
    if (!confirmed) return;

    const button = byId('save-additional-item-button');
    if (button) button.disabled = true;
    pageState.set('loading', mode === 'edit' ? 'Saving item...' : 'Creating item...');
    const result =
      mode === 'edit'
        ? await api.editAdditionalItem({
            ...payload,
            itemId: byId('additional-item-id-input').value,
          })
        : await api.addAdditionalItem(payload);
    if (button) button.disabled = false;
    updateControlVisibility();
    if (!result?.ok) return showRequestFailureToast(result);

    additionalItemModal?.close();
    pageState.set('success', result.data?.message || 'Additional item saved successfully.');
    toast.show({
      title: 'Item saved',
      message: result.data?.message || 'Additional item saved successfully.',
      variant: 'success',
    });
    await load({ quiet: true });
  }

  function showRequestFailureToast(result) {
    pageState.set(
      result?.pageState || 'error',
      result?.message || 'The request could not be completed.',
    );
    toast.show({
      title: 'Request failed',
      message: result?.message || 'The request could not be completed.',
      variant: 'danger',
    });
  }

  async function load({ quiet = false } = {}) {
    if (!quiet) setBusy(true);
    const request = overviewScope.next();
    try {
      const response = await api.getOverview(buildAccommodationDataQuery(), request.signal);
      if (response?.aborted || !overviewScope.isCurrent(request.token)) return;
      if (!response?.ok)
        throw new Error(response?.message || 'The accommodation workspace could not be loaded.');
      const data = response?.data || response || {};
      const overview = data.overview || {};
      const upcoming = data.upcoming || {};
      const lookups = data.lookups || {};
      const tables = data.tables || {};
      const reportTables = data.report?.tables || {};

      state.buildings = Array.isArray(lookups.buildings)
        ? lookups.buildings
        : Array.isArray(data.buildings)
          ? data.buildings
          : [];
      state.rooms = Array.isArray(lookups.rooms)
        ? lookups.rooms
        : Array.isArray(data.rooms)
          ? data.rooms
          : [];
      state.keys = Array.isArray(lookups.keys)
        ? lookups.keys
        : Array.isArray(data.keys)
          ? data.keys
          : [];
      state.soldiers = Array.isArray(lookups.soldiers)
        ? lookups.soldiers
        : Array.isArray(data.soldiers)
          ? data.soldiers
          : [];
      state.laundryBags = Array.isArray(lookups.laundryBags)
        ? lookups.laundryBags
        : Array.isArray(data.laundryBags)
          ? data.laundryBags
          : [];
      state.additionalItems = Array.isArray(lookups.additionalItems)
        ? lookups.additionalItems
        : Array.isArray(data.additionalItems)
          ? data.additionalItems
          : [];
      syncSelectedLookupText();

      applyServerTableResult(state.buildingTable, data.buildings, tables.buildings);
      applyServerTableResult(state.roomTable, data.rooms, tables.rooms);
      applyServerTableResult(state.keyTable, data.keys, tables.keys);
      applyServerTableResult(state.soldierTable, data.soldiers, tables.soldiers);
      applyServerTableResult(
        state.additionalItemTable,
        data.additionalItems,
        tables.additionalItems,
      );
      applyReportTableResult('check', data.report?.checkEvents, reportTables.check);
      applyReportTableResult('move', data.report?.moveEvents, reportTables.move);
      applyReportTableResult('item', data.report?.additionalItems, reportTables.item);
      pruneAllSelections();

      setText('summary-buildings', overview.totalBuildings ?? 0);
      setText('summary-rooms', overview.totalRooms ?? 0);
      setText('summary-keys', overview.totalKeys ?? 0);
      setText('summary-free-keys', overview.freeKeys ?? 0);
      setText('summary-occupied-keys', overview.occupiedKeys ?? 0);
      setText('summary-soldiers', overview.totalSoldiers ?? state.soldiers.length);
      setText(
        'summary-additional-items',
        overview.totalAdditionalItems ?? state.additionalItems.length,
      );
      setText(
        'summary-upcoming-action',
        (overview.upcomingAccommodationCount ?? 0) + (overview.upcomingReleaseCount ?? 0),
      );

      renderNames(
        byId('upcoming-accommodation-list'),
        upcoming.accommodationList,
        'No pending accommodation entries.',
      );
      renderNames(
        byId('upcoming-release-list'),
        upcoming.releaseList,
        'No pending release entries.',
      );
      renderBuildingOptions();
      renderRoomOptions();
      renderAllTables();
      state.isBusy = false;
      refreshOpenAccommodationDetailPanels();
      pageState.clear();
      updateControlVisibility();
    } catch (error) {
      state.isBusy = false;
      pageState.set('error', error?.message || 'The accommodation workspace could not be loaded.');
      updateControlVisibility();
      toast.show({
        title: 'Accommodation load failed',
        message: error?.message || 'The accommodation workspace could not be loaded.',
        variant: 'danger',
      });
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTrigger || 'overview'));
  });
  setActiveTab(state.activeTab);

  byId('buildings-prev-button')?.addEventListener('click', () => {
    if (state.buildingTable.page <= 1) return;
    state.buildingTable.page -= 1;
    void load({ quiet: true });
  });
  byId('buildings-next-button')?.addEventListener('click', () => {
    if (state.buildingTable.page >= state.buildingTable.totalPages) return;
    state.buildingTable.page += 1;
    void load({ quiet: true });
  });
  byId('rooms-prev-button')?.addEventListener('click', () => {
    if (state.roomTable.page <= 1) return;
    state.roomTable.page -= 1;
    void load({ quiet: true });
  });
  byId('rooms-next-button')?.addEventListener('click', () => {
    if (state.roomTable.page >= state.roomTable.totalPages) return;
    state.roomTable.page += 1;
    void load({ quiet: true });
  });
  byId('keys-prev-button')?.addEventListener('click', () => {
    if (state.keyTable.page <= 1) return;
    state.keyTable.page -= 1;
    void load({ quiet: true });
  });
  byId('keys-next-button')?.addEventListener('click', () => {
    if (state.keyTable.page >= state.keyTable.totalPages) return;
    state.keyTable.page += 1;
    void load({ quiet: true });
  });
  byId('soldiers-prev-button')?.addEventListener('click', () => {
    if (state.soldierTable.page <= 1) return;
    state.soldierTable.page -= 1;
    void load({ quiet: true });
  });
  byId('soldiers-next-button')?.addEventListener('click', () => {
    if (state.soldierTable.page >= state.soldierTable.totalPages) return;
    state.soldierTable.page += 1;
    void load({ quiet: true });
  });
  byId('additional-items-prev-button')?.addEventListener('click', () => {
    if (state.additionalItemTable.page <= 1) return;
    state.additionalItemTable.page -= 1;
    void load({ quiet: true });
  });
  byId('additional-items-next-button')?.addEventListener('click', () => {
    if (state.additionalItemTable.page >= state.additionalItemTable.totalPages) return;
    state.additionalItemTable.page += 1;
    void load({ quiet: true });
  });
  byId('accommodation-report-check-prev-button')?.addEventListener('click', () => {
    if (state.report.checkPage <= 1) return;
    state.report.checkPage -= 1;
    void load({ quiet: true });
  });
  byId('accommodation-report-check-next-button')?.addEventListener('click', () => {
    if (state.report.checkPage >= state.report.checkTotalPages) return;
    state.report.checkPage += 1;
    void load({ quiet: true });
  });
  byId('accommodation-report-move-prev-button')?.addEventListener('click', () => {
    if (state.report.movePage <= 1) return;
    state.report.movePage -= 1;
    void load({ quiet: true });
  });
  byId('accommodation-report-move-next-button')?.addEventListener('click', () => {
    if (state.report.movePage >= state.report.moveTotalPages) return;
    state.report.movePage += 1;
    void load({ quiet: true });
  });
  byId('accommodation-report-item-prev-button')?.addEventListener('click', () => {
    if (state.report.itemPage <= 1) return;
    state.report.itemPage -= 1;
    void load({ quiet: true });
  });
  byId('accommodation-report-item-next-button')?.addEventListener('click', () => {
    if (state.report.itemPage >= state.report.itemTotalPages) return;
    state.report.itemPage += 1;
    void load({ quiet: true });
  });

  byId('refresh-accommodation-button')?.addEventListener('click', () => {
    void load();
  });
  byId('refresh-buildings-button')?.addEventListener('click', () => {
    void load();
  });
  byId('refresh-rooms-button')?.addEventListener('click', () => {
    void load();
  });
  byId('refresh-keys-button')?.addEventListener('click', () => {
    void load();
  });
  byId('refresh-soldiers-button')?.addEventListener('click', () => {
    void load();
  });
  byId('refresh-additional-items-button')?.addEventListener('click', () => {
    void load();
  });
  byId('refresh-report-button')?.addEventListener('click', () => {
    void load();
  });
  byId('building-form')?.addEventListener('submit', saveBuilding);
  byId('room-form')?.addEventListener('submit', saveRoom);
  byId('key-form')?.addEventListener('submit', saveKey);
  byId('issue-key-form')?.addEventListener('submit', saveIssueKey);
  byId('soldier-form')?.addEventListener('submit', saveSoldier);
  byId('soldier-upcoming-accommodation-input')?.addEventListener(
    'input',
    syncSoldierScheduleDateBounds,
  );
  byId('soldier-upcoming-release-input')?.addEventListener('input', syncSoldierScheduleDateBounds);
  byId('accommodate-soldier-form')?.addEventListener('submit', saveAccommodateSoldier);
  byId('bulk-accommodate-soldiers-form')?.addEventListener('submit', saveBulkAccommodateSoldiers);
  byId('swap-soldiers-form')?.addEventListener('submit', saveSwapSoldiers);
  byId('discharge-soldier-form')?.addEventListener('submit', saveDischargeSoldier);
  byId('additional-item-form')?.addEventListener('submit', saveAdditionalItem);
  document.querySelectorAll('[data-accommodation-report-filter-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void load({ quiet: true });
    });
  });

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    if (input.dataset.accommodationReportDateFilter) {
      const [table, field] = String(input.dataset.accommodationReportDateFilter).split(':');
      if (state.report.dateFilters[table] && ['fromDate', 'toDate'].includes(field)) {
        state.report.dateFilters[table][field] = input.value;
        state.report[getAccommodationReportPageKey(table)] = 1;
        void load({ quiet: true });
      }
      return;
    }

    if (input.id === 'building-select-page-checkbox') {
      const rows = state.buildingTable.rows || [];
      rows.filter(isBuildingReleaseEligible).forEach((row) => {
        if (input.checked) state.selectedBuildingReleaseIds.add(String(row.id));
        else state.selectedBuildingReleaseIds.delete(String(row.id));
      });
      renderBuildings();
      return;
    }

    if (input.id === 'room-select-page-checkbox') {
      const rows = state.roomTable.rows || [];
      rows.filter(isRoomReleaseEligible).forEach((row) => {
        if (input.checked) state.selectedRoomReleaseIds.add(String(row.id));
        else state.selectedRoomReleaseIds.delete(String(row.id));
      });
      renderRooms();
      return;
    }

    if (input.id === 'soldier-select-page-checkbox') {
      const rows = state.soldierTable.rows || [];
      rows.filter(isSoldierAccommodationEligible).forEach((row) => {
        if (input.checked) state.selectedSoldierAccommodationIds.add(String(row.id));
        else state.selectedSoldierAccommodationIds.delete(String(row.id));
      });
      renderSoldiers();
      return;
    }

    if (input.classList.contains('js-building-release-select')) {
      const id = input.dataset.buildingId || '';
      if (input.checked) state.selectedBuildingReleaseIds.add(String(id));
      else state.selectedBuildingReleaseIds.delete(String(id));
      renderBuildings();
      return;
    }

    if (input.classList.contains('js-room-release-select')) {
      const id = input.dataset.roomId || '';
      if (input.checked) state.selectedRoomReleaseIds.add(String(id));
      else state.selectedRoomReleaseIds.delete(String(id));
      renderRooms();
      return;
    }

    if (input.classList.contains('js-soldier-bulk-accommodate-select')) {
      const id = input.dataset.soldierId || '';
      if (input.checked) state.selectedSoldierAccommodationIds.add(String(id));
      else state.selectedSoldierAccommodationIds.delete(String(id));
      renderSoldiers();
    }
  });

  document.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.positiveIntegerInput !== undefined) {
      syncPositiveIntegerInput(input);
    }
  });

  document.addEventListener(
    'input',
    debounce((event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.dataset.buildingFilterColumn) {
        state.buildingTable.filters[input.dataset.buildingFilterColumn] = input.value;
        state.buildingTable.page = 1;
        void load({ quiet: true });
      } else if (input.dataset.roomFilterColumn) {
        state.roomTable.filters[input.dataset.roomFilterColumn] = input.value;
        state.roomTable.page = 1;
        void load({ quiet: true });
      } else if (input.dataset.keyFilterColumn) {
        state.keyTable.filters[input.dataset.keyFilterColumn] = input.value;
        state.keyTable.page = 1;
        void load({ quiet: true });
      } else if (input.dataset.soldierFilterColumn) {
        state.soldierTable.filters[input.dataset.soldierFilterColumn] = input.value;
        state.soldierTable.page = 1;
        void load({ quiet: true });
      } else if (input.dataset.additionalItemFilterColumn) {
        state.additionalItemTable.filters[input.dataset.additionalItemFilterColumn] = input.value;
        state.additionalItemTable.page = 1;
        void load({ quiet: true });
      } else if (
        input.dataset.accommodationReportFilterTable &&
        input.dataset.accommodationReportFilterColumn
      ) {
        const table = input.dataset.accommodationReportFilterTable;
        if (!state.report.filters[table]) return;
        state.report.filters[table][input.dataset.accommodationReportFilterColumn] = input.value;
        state.report[getAccommodationReportPageKey(table)] = 1;
        void load({ quiet: true });
      }
    }, 150),
  );

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const disabledLink = target.closest('a[aria-disabled="true"]');
    if (disabledLink) {
      event.preventDefault();
      return;
    }

    if (target.closest('#open-building-import-modal')) {
      if (!canImportBuildings()) return updateControlVisibility();
      renderImportProgress('building');
      buildingImportModal?.open();
      return;
    }
    if (target.closest('#open-room-import-modal')) {
      if (!canImportRooms()) return updateControlVisibility();
      renderImportProgress('room');
      roomImportModal?.open();
      return;
    }
    if (target.closest('#open-key-import-modal')) {
      if (!canImportKeys()) return updateControlVisibility();
      renderImportProgress('key');
      keyImportModal?.open();
      return;
    }
    if (target.closest('#open-soldier-import-modal')) {
      if (!canImportSoldiers()) return updateControlVisibility();
      renderImportProgress('soldier');
      soldierImportModal?.open();
      return;
    }
    if (target.closest('#open-additional-item-import-modal')) {
      if (!canImportAdditionalItems()) return updateControlVisibility();
      renderImportProgress('additional-item');
      additionalItemImportModal?.open();
      return;
    }
    if (target.closest('#upload-building-template-button')) {
      await uploadImportTemplate('building');
      return;
    }
    if (target.closest('#upload-room-template-button')) {
      await uploadImportTemplate('room');
      return;
    }
    if (target.closest('#upload-key-template-button')) {
      await uploadImportTemplate('key');
      return;
    }
    if (target.closest('#upload-soldier-template-button')) {
      await uploadImportTemplate('soldier');
      return;
    }
    if (target.closest('#upload-additional-item-template-button')) {
      await uploadImportTemplate('additional-item');
      return;
    }

    if (target.closest('#open-add-building-modal')) return openBuildingModal('create');
    if (target.closest('#open-add-room-modal')) return openRoomModal('create');
    if (target.closest('#open-add-key-modal')) return openKeyModal('create');
    if (target.closest('#open-add-soldier-modal')) return openSoldierModal('create');
    if (target.closest('#open-bulk-accommodate-soldiers-modal'))
      return openBulkAccommodateSoldiersModal();
    if (target.closest('#release-selected-rooms-button')) {
      await releaseSelectedRooms();
      return;
    }
    if (target.closest('#release-selected-buildings-button')) {
      await releaseSelectedBuildings();
      return;
    }
    if (target.closest('#open-add-additional-item-modal')) return openAdditionalItemModal('create');

    const reportResetButton = target.closest('[data-accommodation-report-reset]');
    if (reportResetButton) {
      resetAccommodationReportFilters(
        reportResetButton.getAttribute('data-accommodation-report-reset'),
      );
      void load({ quiet: true });
      return;
    }

    const reportSortButton = target.closest('[data-accommodation-report-sort-column]');
    if (reportSortButton) {
      const table = reportSortButton.getAttribute('data-accommodation-report-sort-table') || '';
      const column = reportSortButton.getAttribute('data-accommodation-report-sort-column') || '';
      if (state.report.sort[table]) {
        const tableSort = state.report.sort[table];
        if (tableSort.column === column) {
          tableSort.direction = getNextSortDirection(tableSort.direction);
        } else {
          tableSort.column = column;
          tableSort.direction = 'asc';
        }
        if (tableSort.direction === 'default') tableSort.column = null;
        state.report[getAccommodationReportPageKey(table)] = 1;
        void load({ quiet: true });
      }
      return;
    }

    const sortConfig = [
      ['building', state.buildingTable],
      ['room', state.roomTable],
      ['key', state.keyTable],
      ['soldier', state.soldierTable],
      ['additional-item', state.additionalItemTable],
    ];
    for (const [kind, tableState] of sortConfig) {
      const sortButton = target.closest(`[data-${kind}-sort-column]`);
      if (sortButton) {
        const column = sortButton.getAttribute(`data-${kind}-sort-column`);
        if (tableState.sortColumn === column) {
          tableState.sortDirection = getNextSortDirection(tableState.sortDirection);
        } else {
          tableState.sortColumn = column;
          tableState.sortDirection = 'asc';
        }
        if (tableState.sortDirection === 'default') tableState.sortColumn = null;
        tableState.page = 1;
        void load({ quiet: true });
        return;
      }
    }

    const editBuildingButton = target.closest('.js-edit-building');
    if (editBuildingButton)
      return openBuildingModal('edit', findBuilding(editBuildingButton.dataset.buildingId));

    const editRoomButton = target.closest('.js-edit-room');
    if (editRoomButton) return openRoomModal('edit', findRoom(editRoomButton.dataset.roomId));

    const editKeyButton = target.closest('.js-edit-key');
    if (editKeyButton) return openKeyModal('edit', findKey(editKeyButton.dataset.keyId));

    const issueKeyButton = target.closest('.js-issue-key');
    if (issueKeyButton) return openIssueKeyModal(findKey(issueKeyButton.dataset.keyId));

    const releaseKeyButton = target.closest('.js-release-key');
    if (releaseKeyButton) {
      if (!canManageAccommodation()) return updateControlVisibility();
      const keyId = releaseKeyButton.dataset.keyId || '';
      const row = findKey(keyId);
      const getReleaseKeyRow = () => findKey(keyId) || row;
      const canReleaseSelectedKey = () => {
        const currentRow = findKey(keyId);
        return Boolean(
          canManageAccommodation() &&
            currentRow?.soldierId &&
            !isActiveAccommodationKey(currentRow),
        );
      };
      const confirmed = await confirmAction({
        title: 'Release key',
        message: () => {
          const currentRow = getReleaseKeyRow();
          return `Release key "${currentRow?.name || 'this key'}" from ${currentRow?.soldierName || 'the assigned soldier'} and make the key available again.`;
        },
        confirmText: 'Release key',
        variant: 'warning',
        canConfirm: canReleaseSelectedKey,
      });
      if (!confirmed) return;
      pageState.set('loading', 'Releasing key...');
      const result = await api.releaseKey(keyId);
      if (!result?.ok) return showRequestFailureToast(result);
      pageState.set('success', result.data?.message || 'Key released successfully.');
      toast.show({
        title: 'Key released',
        message: result.data?.message || 'Key released successfully.',
        variant: 'success',
      });
      await load({ quiet: true });
      return;
    }

    const editSoldierButton = target.closest('.js-edit-soldier');
    if (editSoldierButton)
      return openSoldierModal('edit', findSoldier(editSoldierButton.dataset.soldierId));

    const editAdditionalItemButton = target.closest('.js-edit-additional-item');
    if (editAdditionalItemButton)
      return openAdditionalItemModal(
        'edit',
        findAdditionalItem(editAdditionalItemButton.dataset.itemId),
      );

    const accommodateSoldierButton = target.closest('.js-accommodate-soldier');
    if (accommodateSoldierButton)
      return openAccommodateSoldierModal(findSoldier(accommodateSoldierButton.dataset.soldierId));

    const moveSoldierButton = target.closest('.js-move-soldier');
    if (moveSoldierButton)
      return openSwapSoldiersModal(findSoldier(moveSoldierButton.dataset.soldierId));

    const dischargeSoldierButton = target.closest('.js-discharge-soldier');
    if (dischargeSoldierButton) {
      const row = findSoldier(dischargeSoldierButton.dataset.soldierId);
      return openDischargeSoldierModal(row);
    }

    const deleteBuildingButton = target.closest('.js-delete-building');
    if (deleteBuildingButton) {
      if (!canDeleteBuilding()) return updateControlVisibility();
      const buildingId = deleteBuildingButton.dataset.buildingId || '';
      const row = findBuilding(buildingId);
      const confirmed = await confirmAction({
        title: 'Delete building',
        message: () => {
          const currentRow = findBuilding(buildingId) || row;
          return `Permanently remove building "${currentRow?.name || 'this building'}". Remove or move all rooms first.`;
        },
        confirmText: 'Delete building',
        variant: 'danger',
        canConfirm: canDeleteBuilding,
      });
      if (!confirmed) return;
      pageState.set('loading', 'Deleting building...');
      const result = await api.deleteBuilding(buildingId);
      if (!result?.ok) return showRequestFailureToast(result);
      pageState.set('success', result.data?.message || 'Building removed successfully.');
      toast.show({
        title: 'Building removed',
        message: result.data?.message || 'Building removed successfully.',
        variant: 'success',
      });
      await load({ quiet: true });
      return;
    }

    const deleteRoomButton = target.closest('.js-delete-room');
    if (deleteRoomButton) {
      if (!canDeleteRoom()) return updateControlVisibility();
      const roomId = deleteRoomButton.dataset.roomId || '';
      const row = findRoom(roomId);
      const confirmed = await confirmAction({
        title: 'Delete room',
        message: () => {
          const currentRow = findRoom(roomId) || row;
          return `Permanently remove room "${currentRow?.name || 'this room'}". Remove or move all keys first.`;
        },
        confirmText: 'Delete room',
        variant: 'danger',
        canConfirm: canDeleteRoom,
      });
      if (!confirmed) return;
      pageState.set('loading', 'Deleting room...');
      const result = await api.deleteRoom(roomId);
      if (!result?.ok) return showRequestFailureToast(result);
      pageState.set('success', result.data?.message || 'Room removed successfully.');
      toast.show({
        title: 'Room removed',
        message: result.data?.message || 'Room removed successfully.',
        variant: 'success',
      });
      await load({ quiet: true });
      return;
    }

    const deleteKeyButton = target.closest('.js-delete-key');
    if (deleteKeyButton) {
      if (!canDeleteKey()) return updateControlVisibility();
      const keyId = deleteKeyButton.dataset.keyId || '';
      const row = findKey(keyId);
      const confirmed = await confirmAction({
        title: 'Delete key',
        message: () => {
          const currentRow = findKey(keyId) || row;
          return `Permanently remove key "${currentRow?.name || 'this key'}". Occupied keys must be released first.`;
        },
        confirmText: 'Delete key',
        variant: 'danger',
        canConfirm: canDeleteKey,
      });
      if (!confirmed) return;
      pageState.set('loading', 'Deleting key...');
      const result = await api.deleteKey(keyId);
      if (!result?.ok) return showRequestFailureToast(result);
      pageState.set('success', result.data?.message || 'Key removed successfully.');
      toast.show({
        title: 'Key removed',
        message: result.data?.message || 'Key removed successfully.',
        variant: 'success',
      });
      await load({ quiet: true });
      return;
    }

    const deleteSoldierButton = target.closest('.js-delete-soldier');
    if (deleteSoldierButton) {
      if (!canDeleteSoldier()) return updateControlVisibility();
      const soldierId = deleteSoldierButton.dataset.soldierId || '';
      const row = findSoldier(soldierId);
      const confirmed = await confirmAction({
        title: 'Delete soldier',
        message: () => {
          const currentRow = findSoldier(soldierId) || row;
          return `Permanently remove soldier "${currentRow?.name || 'this soldier'}". Active keys, additional items, and bike rentals must be cleared first.`;
        },
        confirmText: 'Delete soldier',
        variant: 'danger',
        canConfirm: canDeleteSoldier,
      });
      if (!confirmed) return;
      const blockerMessage = getKnownSoldierDeleteBlockerMessage(row);
      if (blockerMessage) {
        toast.show({
          title: 'Cannot delete soldier',
          message: blockerMessage,
          variant: 'warning',
        });
        pageState.set('warning', blockerMessage);
        return;
      }
      pageState.set('loading', 'Deleting soldier...');
      const result = await api.deleteSoldier(soldierId);
      if (!result?.ok) return showRequestFailureToast(result);
      pageState.set('success', result.data?.message || 'Soldier removed successfully.');
      toast.show({
        title: 'Soldier removed',
        message: result.data?.message || 'Soldier removed successfully.',
        variant: 'success',
      });
      await load({ quiet: true });
      return;
    }

    const deleteAdditionalItemButton = target.closest('.js-delete-additional-item');
    if (deleteAdditionalItemButton) {
      if (!canDeleteAdditionalItem()) return updateControlVisibility();
      const itemId = deleteAdditionalItemButton.dataset.itemId || '';
      const row = findAdditionalItem(itemId);
      const confirmed = await confirmAction({
        title: 'Delete additional item',
        message: () => {
          const currentRow = findAdditionalItem(itemId) || row;
          return `Permanently remove additional item "${currentRow?.description || 'this item'}" from the selected soldier.`;
        },
        confirmText: 'Delete item',
        variant: 'danger',
        canConfirm: canDeleteAdditionalItem,
      });
      if (!confirmed) return;
      pageState.set('loading', 'Deleting item...');
      const result = await api.deleteAdditionalItem(
        itemId,
      );
      if (!result?.ok) return showRequestFailureToast(result);
      pageState.set('success', result.data?.message || 'Additional item removed successfully.');
      toast.show({
        title: 'Item removed',
        message: result.data?.message || 'Additional item removed successfully.',
        variant: 'success',
      });
      await load({ quiet: true });
    }
  });

  Object.keys(importConfigs).forEach((resource) => {
    const config = getImportConfig(resource);
    byId(config.fileInputId)?.addEventListener('change', (event) => {
      const file = event.target?.files?.[0] || null;
      if (!file) {
        resetImportProgress(resource);
        return;
      }
      const importState = state.imports[resource];
      importState.fileName = file.name;
      importState.uploadPercent = 0;
      importState.processingPercent = 0;
      importState.statusMessage = 'Template selected and ready to upload.';
      importState.summary = null;
      importState.errors = [];
      importState.visible = false;
      importState.isBusy = false;
      renderImportProgress(resource);
    });
  });

  document.addEventListener('workspace:permissions:refreshed', (event) => {
    state.permissions = new Set(event.detail?.permissionNames || []);
    refreshOpenAccommodationDetailPanels();
    renderAllTables();
    Object.keys(importConfigs).forEach((resource) => renderImportProgress(resource));
    updateControlVisibility();
    void syncAccommodationRealtimeRoom();
  });

  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const accessRefresh = createWorkspacePermissionAccessRefresh({ socket, pageData });
  accessRefresh.bind();
  const roomManager = socket ? createSocketRoomManager(socket) : null;
  bindLateBicycleToast({ socket, roomManager, toast, pageData });
  bindUpcomingAccommodationToasts({ toast, pageData });
  let isSubscribedToAccommodationRoom = false;
  let accommodationRealtimeRefreshTimer = null;

  async function syncAccommodationRealtimeRoom() {
    if (!roomManager) return;
    const canSubscribe = hasPermission(PERMISSIONS.section);
    if (canSubscribe && !isSubscribedToAccommodationRoom) {
      const response = await roomManager.subscribe(['ui:accommodation:list']);
      isSubscribedToAccommodationRoom = response?.joined?.includes('ui:accommodation:list');
      return;
    }
    if (!canSubscribe && isSubscribedToAccommodationRoom) {
      await roomManager.unsubscribe(['ui:accommodation:list']);
      isSubscribedToAccommodationRoom = false;
    }
  }

  if (socket) {
    const scheduleAccommodationRealtimeRefresh = (payload = {}) => {
      const changedCampId = String(payload?.campId || '');
      const currentCampId = String(
        pageData.campId || document.body?.dataset?.currentCampId || '',
      );
      if (changedCampId && currentCampId && changedCampId !== currentCampId) return;
      if (accommodationRealtimeRefreshTimer) {
        window.clearTimeout(accommodationRealtimeRefreshTimer);
      }
      accommodationRealtimeRefreshTimer = window.setTimeout(() => {
        accommodationRealtimeRefreshTimer = null;
        void load({ quiet: true }).then(refreshAccommodationLookupOptions);
      }, 120);
    };

    socket.on('connect', () => {
      isSubscribedToAccommodationRoom = false;
      void syncAccommodationRealtimeRoom();
    });
    [
      'accommodation:changed',
      'accommodation:record:changed',
      'soldier:changed',
      'soldier:record:changed',
    ].forEach((eventName) => {
      socket.on(eventName, scheduleAccommodationRealtimeRefresh);
    });
    window.addEventListener('beforeunload', () => {
      if (accommodationRealtimeRefreshTimer) {
        window.clearTimeout(accommodationRealtimeRefreshTimer);
      }
      if (!roomManager || !isSubscribedToAccommodationRoom) return;
      void roomManager.unsubscribe(['ui:accommodation:list']);
      roomManager.clear();
    });
  }

  void accessRefresh.refreshNavigation().then((permissionNames) => {
    state.permissions = new Set(permissionNames || []);
    refreshOpenAccommodationDetailPanels();
    renderAllTables();
    updateControlVisibility();
    void syncAccommodationRealtimeRoom();
  });

  Object.keys(importConfigs).forEach((resource) => renderImportProgress(resource));
  renderAllTables();
  void syncAccommodationRealtimeRoom();
  void load();
});
