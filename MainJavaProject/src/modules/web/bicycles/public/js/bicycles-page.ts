import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import { byId, debounce, setProgressValue } from '/assets/shared/js/core/dom.ts';
import { readPageData } from '/assets/shared/js/core/page-data.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { formatDateTimeDisplay } from '/assets/shared/js/core/display-date-time.ts';
import { confirmAction, initConfirmModal } from '/assets/shared/js/core/confirm.ts';
import {
  bindForcedSignOut,
  createSocketRoomManager,
} from '/assets/shared/js/core/socket-client.ts';
import { createModalController } from '/assets/shared/js/ui/modal.ts';
import { createWorkspacePermissionAccessRefresh } from '/assets/shared/js/workspace/permission-access.ts';
import {
  bindUpcomingAccommodationToasts,
  createToastManager,
  initWorkspacePage,
  syncTabPanels,
} from '/assets/shared/js/workspace/page-shell.ts';
import { createBicyclesPageApi } from '/assets/bicycles/js/bicycles-page.api.ts';

const PERMISSIONS = Object.freeze({
  full: 'Full permission',
  section: 'Bicycles',
  add: 'Add bike',
  edit: 'Edit bike',
  remove: 'Remove bike',
  addHelmet: 'Add helmet',
  editHelmet: 'Edit helmet',
  removeHelmet: 'Remove helmet',
  status: 'Save bike status',
  downloadBikeApp: 'Download bicycle app',
});

const EDITABLE_STATUS_INPUTS = Object.freeze({
  rented: 'rented',
  late: 'rented',
  repair: 'repair',
  long_term: 'long_term',
  'long term': 'long_term',
});
const EDITABLE_STATUS_OPTIONS = Object.freeze([
  { id: 'rented', label: 'Rented' },
  { id: 'repair', label: 'Repair' },
  { id: 'long_term', label: 'Long term' },
]);
const RETURNABLE_STATUSES = Object.freeze(new Set(['rented', 'long_term', 'late', 'repair']));

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

function formatStatusLabel(value) {
  return (
    {
      available: 'Available',
      rented: 'Rented',
      repair: 'Repair',
      late: 'Late',
      long_term: 'Long term',
    }[String(value || '').toLowerCase()] || String(value || 'Unknown')
  );
}

function normalizeEditableStatusInput(value) {
  return EDITABLE_STATUS_INPUTS[String(value || '').trim().toLowerCase()] || '';
}

function toLocalDateTimeInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toIsoDateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function isFutureDateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

function formatDateTime(value) {
  return formatDateTimeDisplay(value, 'None');
}

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function isRentStatus(value) {
  const normalized = normalizeStatus(value);
  return normalized === 'rent' || normalized === 'rented';
}

function isLateStatus(value) {
  const normalized = normalizeStatus(value);
  return normalized === 'late' || normalized === 'overdue';
}

bootstrapPage(() => {
  const pageData = readPageData();
  initWorkspacePage();
  initConfirmModal();

  const csrfToken = byId('csrf-token')?.value || '';
  const api = createBicyclesPageApi({ csrfToken });
  const toast = createToastManager(byId('toast-stack'));
  const pageState = createPageStateController({
    root: byId('main-content'),
    disableTargets: [
      byId('refresh-bicycles-button'),
      byId('refresh-bikes-table-button'),
      byId('refresh-helmets-table-button'),
      byId('reset-bicycle-report-button'),
    ],
  });
  const overviewScope = createRequestScope();
  const reportScope = createRequestScope();
  const soldierLookupScope = createRequestScope();
  const helmetLookupScope = createRequestScope();
  const editSoldierLookupScope = createRequestScope();
  const editHelmetLookupScope = createRequestScope();
  const reportAssetScope = createRequestScope();
  const reportSoldierScope = createRequestScope();
  const reportAssetLookupScope = createRequestScope();
  const reportSoldierLookupScope = createRequestScope();
  const tabButtons = Array.from(document.querySelectorAll('[data-tab-trigger]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));

  const state = {
    rows: [],
    helmetRows: [],
    permissions: new Set(),
    activeTab: 'overview',
    bicycleTable: {
      rows: [],
      page: 1,
      limit: 10,
      totalRows: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {
        name: '',
        id: '',
        nfcCode: '',
        status: '',
        assignedSoldier: '',
        helmetCode: '',
        rentedAt: '',
      },
      sortColumn: null,
      sortDirection: 'default',
    },
    helmetTable: {
      rows: [],
      page: 1,
      limit: 10,
      totalRows: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {
        code: '',
        nfcCode: '',
        id: '',
        bicycleName: '',
        assignedSoldier: '',
        status: '',
      },
      sortColumn: null,
      sortDirection: 'default',
    },
    report: {
      rows: [],
      dailyTotals: [],
      assetRows: [],
      soldierRows: [],
      fromDate: '',
      toDate: '',
      totalRentals: 0,
      dailyPage: 1,
      dailyLimit: 10,
      dailyTotalRows: 0,
      dailyTotalPages: 1,
      dailySourceTotal: 0,
      historyPage: 1,
      historyLimit: 10,
      historyTotalRows: 0,
      historyTotalPages: 1,
      historySourceTotal: 0,
      helmetRentalCount: 0,
      filters: {
        rentedAt: '',
        returnedAt: '',
        status: '',
        bicycleName: '',
        bicycleNfcCode: '',
        soldierName: '',
        helmetCode: '',
        helmetNfcCode: '',
      },
      sortColumn: null,
      sortDirection: 'default',
      assetType: 'bicycle',
      assetId: '',
      soldierId: '',
      loaded: false,
      isBusy: false,
      isAssetBusy: false,
      isSoldierBusy: false,
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
    helmetImport: {
      fileName: '',
      uploadPercent: 0,
      processingPercent: 0,
      statusMessage: 'Download the template to begin.',
      summary: null,
      errors: [],
      isBusy: false,
      visible: false,
    },
    lateBikeNotifications: new Set(),
    soldiers: new Map(),
    helmets: new Map(),
    editStatuses: new Map(),
    editSoldiers: new Map(),
    editHelmets: new Map(),
    reportAssets: new Map(),
    reportSoldiers: new Map(),
    editAssignmentBackup: null,
    editAssignmentSnapshot: null,
  };

  const bulkImportModal = createModalController({
    root: byId('bulk-bicycle-import-modal'),
    dialog: byId('bulk-bicycle-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => clearBulkImportModal(),
  });
  const bulkHelmetImportModal = createModalController({
    root: byId('bulk-helmet-import-modal'),
    dialog: byId('bulk-helmet-import-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => clearBulkHelmetImportModal(),
  });
  const bicycleModal = createModalController({
    root: byId('bicycle-modal'),
    dialog: byId('bicycle-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const helmetModal = createModalController({
    root: byId('helmet-modal'),
    dialog: byId('helmet-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const rentModal = createModalController({
    root: byId('rent-bicycle-modal'),
    dialog: byId('rent-bicycle-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => {
      soldierLookup?.close();
      helmetLookup?.close();
    },
  });
  const returnModal = createModalController({
    root: byId('return-bicycle-modal'),
    dialog: byId('return-bicycle-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const bicycleModalState = createPageStateController({
    root: byId('bicycle-modal'),
    disableTargets: [
      byId('bicycle-name-input'),
      byId('bicycle-nfc-input'),
      byId('bicycle-status-input'),
      byId('bicycle-soldier-search-input'),
      byId('bicycle-helmet-search-input'),
      byId('bicycle-rent-date-input'),
    ],
  });
  const helmetModalState = createPageStateController({
    root: byId('helmet-modal'),
    disableTargets: [byId('helmet-code-input'), byId('helmet-nfc-input')],
  });
  const rentModalState = createPageStateController({
    root: byId('rent-bicycle-modal'),
    disableTargets: [
      byId('rent-soldier-search-input'),
      byId('rent-helmet-search-input'),
      byId('rent-date-input'),
      byId('rent-repair-input'),
      byId('rent-long-term-input'),
    ],
  });
  const returnModalState = createPageStateController({
    root: byId('return-bicycle-modal'),
    disableTargets: [byId('return-date-input')],
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
    return state.permissions.has(PERMISSIONS.full) || state.permissions.has(name);
  }

  const canAdd = () => hasPermission(PERMISSIONS.add);
  const canEdit = () => hasPermission(PERMISSIONS.edit);
  const canDelete = () => hasPermission(PERMISSIONS.remove);
  const canAddHelmet = () => hasPermission(PERMISSIONS.addHelmet);
  const canEditHelmet = () => hasPermission(PERMISSIONS.editHelmet);
  const canDeleteHelmet = () => hasPermission(PERMISSIONS.removeHelmet);
  const canRentReturn = () => hasPermission(PERMISSIONS.status);
  const canImport = () => canAdd() || canEdit();
  const canImportHelmets = () => canAddHelmet() || canEditHelmet();
  const canViewReport = () => hasPermission(PERMISSIONS.section);
  const canDownloadBikeMobileApp = () => hasPermission(PERMISSIONS.downloadBikeApp);

  function setDisabled(element, disabled) {
    if (element && 'disabled' in element) element.disabled = Boolean(disabled);
  }

  function setDisabledById(id, disabled) {
    setDisabled(byId(id), disabled);
  }

  function setDisabledBySelector(selector, disabled) {
    document.querySelectorAll(selector).forEach((element) => setDisabled(element, disabled));
  }

  function setFormDisabled(formId, disabled) {
    byId(formId)
      ?.querySelectorAll('input, select, textarea, button[type="submit"]')
      .forEach((element) => setDisabled(element, disabled));
  }

  function setDateInputMax(inputId) {
    const input = byId(inputId);
    if (!input) return;
    input.max = toLocalDateTimeInputValue(new Date());
  }

  function setDateInputMin(inputId, date) {
    const input = byId(inputId);
    if (!input) return;
    input.min = toLocalDateTimeInputValue(date);
  }

  function canUseCurrentBicycleFormMode() {
    const mode = byId('bicycle-form-mode')?.value || 'create';
    return mode === 'edit' ? canEdit() : canAdd();
  }

  function syncRepairModeControls() {
    const repairInput = byId('rent-repair-input');
    const repair = Boolean(repairInput?.checked);
    const baseDisabled = !canRentReturn();
    const lookupDisabled = baseDisabled || repair;
    const soldierInput = byId('rent-soldier-search-input');
    const helmetInput = byId('rent-helmet-search-input');
    const longTermInput = byId('rent-long-term-input');
    const submitButton = byId('rent-bicycle-submit-button');

    setDisabled(soldierInput, lookupDisabled);
    setDisabled(helmetInput, lookupDisabled);
    setDisabled(byId('rent-date-input'), baseDisabled);
    setDisabled(repairInput, baseDisabled);
    setDisabled(longTermInput, lookupDisabled);

    soldierInput
      ?.closest('[data-lookup-combobox]')
      ?.classList.toggle('is-disabled', lookupDisabled);
    helmetInput?.closest('[data-lookup-combobox]')?.classList.toggle('is-disabled', lookupDisabled);
    if (soldierInput) soldierInput.required = !repair;
    if (repair) {
      byId('rent-soldier-id-input').value = '';
      byId('rent-helmet-id-input').value = '';
      if (soldierInput) soldierInput.value = '';
      if (helmetInput) helmetInput.value = '';
      if (longTermInput) longTermInput.checked = false;
      soldierLookup?.close();
      helmetLookup?.close();
    }
    if (submitButton) submitButton.textContent = repair ? 'Mark repair' : 'Rent bike';
  }

  function syncBicycleAssignmentEditControls() {
    const mode = byId('bicycle-form-mode')?.value || 'create';
    const currentStatus = String(byId('bicycle-current-status-input')?.value || '').toLowerCase();
    const fields = byId('bicycle-assignment-fields');
    const statusInput = byId('bicycle-status-input');
    const statusValueInput = byId('bicycle-status-value-input');
    const soldierInput = byId('bicycle-soldier-search-input');
    const helmetInput = byId('bicycle-helmet-search-input');
    const dateInput = byId('bicycle-rent-date-input');
    const editable = mode === 'edit' && currentStatus !== 'available';
    const disabled = !canEdit() || !editable;
    const selectedStatus =
      normalizeEditableStatusInput(statusValueInput?.value) ||
      normalizeEditableStatusInput(statusInput?.value) ||
      currentStatus;
    const repair = selectedStatus === 'repair';
    const assignmentLookupDisabled = disabled || repair;
    const soldierRequired = editable && selectedStatus !== 'repair';

    if (fields) fields.hidden = !editable;
    setDisabled(statusInput, disabled);
    setDisabled(soldierInput, assignmentLookupDisabled);
    setDisabled(helmetInput, assignmentLookupDisabled);
    setDisabled(dateInput, disabled);
    statusInput?.closest('.lookup-combobox')?.classList.toggle('is-disabled', disabled);
    soldierInput
      ?.closest('[data-lookup-combobox]')
      ?.classList.toggle('is-disabled', assignmentLookupDisabled);
    helmetInput
      ?.closest('[data-lookup-combobox]')
      ?.classList.toggle('is-disabled', assignmentLookupDisabled);
    if (soldierInput) soldierInput.required = soldierRequired;
    if (repair) {
      const soldierIdInput = byId('bicycle-soldier-id-input');
      const helmetIdInput = byId('bicycle-helmet-id-input');
      const hasAssignmentValues =
        soldierInput?.value || soldierIdInput?.value || helmetInput?.value || helmetIdInput?.value;
      if (hasAssignmentValues) {
        state.editAssignmentBackup = {
          soldierId: soldierIdInput?.value || '',
          soldierLabel: soldierInput?.value || '',
          helmetId: helmetIdInput?.value || '',
          helmetLabel: helmetInput?.value || '',
        };
      }
      byId('bicycle-soldier-id-input').value = '';
      byId('bicycle-helmet-id-input').value = '';
      if (soldierInput) soldierInput.value = '';
      if (helmetInput) helmetInput.value = '';
      editSoldierLookup?.close();
      editHelmetLookup?.close();
    } else if (editable && state.editAssignmentBackup) {
      byId('bicycle-soldier-id-input').value ||= state.editAssignmentBackup.soldierId;
      byId('bicycle-helmet-id-input').value ||= state.editAssignmentBackup.helmetId;
      if (soldierInput) soldierInput.value ||= state.editAssignmentBackup.soldierLabel;
      if (helmetInput) helmetInput.value ||= state.editAssignmentBackup.helmetLabel;
      state.editAssignmentBackup = null;
    }
    if (!editable) {
      state.editAssignmentBackup = null;
      byId('bicycle-status-input').value = '';
      byId('bicycle-status-value-input').value = '';
      byId('bicycle-soldier-id-input').value = '';
      byId('bicycle-helmet-id-input').value = '';
      if (soldierInput) soldierInput.value = '';
      if (helmetInput) helmetInput.value = '';
      editStatusLookup?.close();
      editSoldierLookup?.close();
      editHelmetLookup?.close();
    }
  }

  function updateControlVisibility() {
    setDisabledById('open-add-bicycle-modal', !canAdd());
    setDisabledById('open-bulk-bicycle-import-modal', !canImport());
    setDisabledById('download-bicycle-template-button', !canImport());
    setDisabledById('bicycle-template-file-input', !canImport());
    setDisabledById('upload-bicycle-template-button', !canImport() || state.import.isBusy);
    setDisabledById('open-add-helmet-modal', !canAddHelmet());
    setDisabledById('open-bulk-helmet-import-modal', !canImportHelmets());
    setDisabledById('download-helmet-template-button', !canImportHelmets());
    setDisabledById('helmet-template-file-input', !canImportHelmets());
    setDisabledById('upload-helmet-template-button', !canImportHelmets() || state.helmetImport.isBusy);
    setDisabledById('reset-bicycle-report-button', !canViewReport() || state.report.isBusy);
    setDisabledById('download-bike-mobile-app-button', !canDownloadBikeMobileApp());
    setDisabledById('report-asset-search-input', !canViewReport() || state.report.isAssetBusy);
    setDisabledById('report-soldier-search-input', !canViewReport() || state.report.isSoldierBusy);
    setDisabledBySelector('[name="reportAssetType"]', !canViewReport() || state.report.isAssetBusy);
    setDisabledBySelector('.js-edit-bicycle', !canEdit());
    setDisabledBySelector('.js-delete-bicycle', !canDelete());
    setDisabledBySelector('.js-edit-helmet', !canEditHelmet());
    setDisabledBySelector('.js-delete-helmet', !canDeleteHelmet());
    setFormDisabled('bicycle-form', !canUseCurrentBicycleFormMode());
    setFormDisabled(
      'helmet-form',
      byId('helmet-form-mode')?.value === 'edit' ? !canEditHelmet() : !canAddHelmet(),
    );
    setFormDisabled('rent-bicycle-form', !canRentReturn());
    setFormDisabled('return-bicycle-form', !canRentReturn());
    syncBicycleAssignmentEditControls();
    syncRepairModeControls();
    syncReportDownloadButton();
  }

  function setActiveTab(tab) {
    state.activeTab = tab || 'overview';
    syncTabPanels({ activeTab: state.activeTab, tabButtons, tabPanels });
    if (state.activeTab === 'report' && !state.report.loaded && !state.report.isBusy) {
      void refreshReport();
    }
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
    showRequestFailureToast(result);
    return false;
  }

  function findBicycle(identifier) {
    return state.rows.find((row) => String(row.id) === String(identifier)) || null;
  }

  function findHelmet(helmetId) {
    return state.helmetRows.find((row) => String(row.id) === String(helmetId)) || null;
  }

  function updateOpenReturnBicycleModal() {
    const root = byId('return-bicycle-modal');
    if (!root || root.hidden) return;
    const identifier = byId('return-bicycle-id-input')?.value || '';
    if (!identifier) return;
    const row = findBicycle(identifier);
    const status = String(row?.status || '').toLowerCase();
    if (!row || !RETURNABLE_STATUSES.has(status)) {
      returnModalState.clear();
      returnModal?.close();
      return;
    }
    byId('return-bike-name-text').textContent = row.name || '-';
    byId('return-soldier-name-text').textContent = row.assignedSoldier || 'Unassigned';
    byId('return-helmet-code-text').textContent = row.helmetCode || 'None';
    byId('return-rented-at-text').textContent = formatDateTime(row.rentedAt);
    setDateInputMin('return-date-input', row.rentedAt);
    const returnDateInput = byId('return-date-input');
    const minDate = new Date(row.rentedAt);
    const selectedDate = new Date(returnDateInput?.value || '');
    if (
      returnDateInput &&
      Number.isFinite(minDate.getTime()) &&
      (!Number.isFinite(selectedDate.getTime()) || selectedDate.getTime() < minDate.getTime())
    ) {
      returnDateInput.value = toLocalDateTimeInputValue(new Date());
    }
  }

  function updateOpenEditBicycleModal() {
    const root = byId('bicycle-modal');
    if (!root || root.hidden || byId('bicycle-form-mode')?.value !== 'edit') return;

    const identifier = byId('bicycle-id-input')?.value || '';
    if (!identifier) return;
    const row = findBicycle(identifier);
    if (!row) {
      bicycleModalState.clear();
      bicycleModal?.close();
      toast.show({
        title: 'Edit bike updated',
        message: 'This bike is no longer available in the current list.',
        variant: 'warning',
      });
      return;
    }

    const snapshot = state.editAssignmentSnapshot || {};
    const soldierIdInput = byId('bicycle-soldier-id-input');
    const soldierInput = byId('bicycle-soldier-search-input');
    const helmetIdInput = byId('bicycle-helmet-id-input');
    const helmetInput = byId('bicycle-helmet-search-input');
    const previousSoldierId = snapshot.soldierId || '';
    const previousHelmetId = snapshot.helmetId || '';
    const currentSoldierId = soldierIdInput?.value || '';
    const currentHelmetId = helmetIdInput?.value || '';
    const nextSoldierId = row.assignedSoldierId || '';
    const nextHelmetId = row.helmetId || '';

    if (soldierIdInput && soldierInput && currentSoldierId === previousSoldierId) {
      soldierIdInput.value = nextSoldierId;
      soldierInput.value = row.assignedSoldier || '';
      state.editSoldiers.clear();
      if (row.assignedSoldier && nextSoldierId) {
        state.editSoldiers.set(row.assignedSoldier, nextSoldierId);
      }
    }

    if (helmetIdInput && helmetInput && currentHelmetId === previousHelmetId) {
      helmetIdInput.value = nextHelmetId;
      helmetInput.value = row.helmetCode || '';
      state.editHelmets.clear();
      if (row.helmetCode && nextHelmetId) {
        state.editHelmets.set(row.helmetCode, nextHelmetId);
      }
    }

    state.editAssignmentSnapshot = {
      bicycleId: row.id || '',
      soldierId: nextSoldierId,
      helmetId: nextHelmetId,
    };
    syncBicycleAssignmentEditControls();
  }

  function notifyLateBikeFromPayload(payload = {}) {
    const identifier = String(payload?.identifier || payload?.bicycleId || payload?.id || '');
    const row = identifier ? findBicycle(identifier) : null;
    const previousStatus =
      payload?.previousStatus || payload?.oldStatus || payload?.fromStatus || row?.status;
    const status = payload?.status || payload?.newStatus || payload?.toStatus || '';
    if (!isRentStatus(previousStatus) || !isLateStatus(status)) return;
    const bicycleName = payload?.bicycleName || payload?.name || row?.name || 'Bicycle';
    const soldierName = payload?.soldierName || row?.assignedSoldier || '';
    const rentedAt = payload?.rentedAt || row?.rentedAt || '';
    const key = `${identifier || bicycleName}|${rentedAt}`;
    if (state.lateBikeNotifications.has(key)) return;
    state.lateBikeNotifications.add(key);
    toast.show({
      title: 'Bike is late',
      message: `${bicycleName} is now late${soldierName ? ` for ${soldierName}` : ''}.`,
      variant: 'warning',
    });
  }

  function notifyNewLateBikes(previousStatuses, bikes = []) {
    for (const bike of bikes) {
      if (!isLateStatus(bike?.status)) {
        const identity = bike?.id || bike?.name || '';
        if (identity) {
          [...state.lateBikeNotifications]
            .filter((key) => key.startsWith(`${identity}|`))
            .forEach((key) => state.lateBikeNotifications.delete(key));
        }
        continue;
      }
      const previousStatus = previousStatuses.get(String(bike?.id || ''));
      if (!isRentStatus(previousStatus) || !isLateStatus(bike?.status)) continue;
      notifyLateBikeFromPayload({
        identifier: bike.id,
        previousStatus,
        status: bike.status,
        bicycleName: bike.name,
        soldierName: bike.assignedSoldier,
        rentedAt: bike.rentedAt,
      });
    }
  }

  function getNextSortDirection(currentDirection) {
    if (currentDirection === 'default') return 'asc';
    if (currentDirection === 'asc') return 'desc';
    return 'default';
  }

  function renderBicyclePagination(totalRows = 0) {
    const pageLabel = byId('bikes-page-label');
    const prevButton = byId('bikes-prev-button');
    const nextButton = byId('bikes-next-button');
    const totalPages = state.bicycleTable.totalPages;

    if (pageLabel) {
      pageLabel.textContent =
        totalRows > 0 ? `Page ${state.bicycleTable.page} of ${totalPages}` : 'Page 1 of 1';
    }
    if (prevButton) prevButton.disabled = state.bicycleTable.page <= 1;
    if (nextButton) nextButton.disabled = state.bicycleTable.page >= totalPages;
  }

  function renderHelmetPagination(totalRows = 0) {
    const pageLabel = byId('helmets-page-label');
    const prevButton = byId('helmets-prev-button');
    const nextButton = byId('helmets-next-button');
    const totalPages = state.helmetTable.totalPages;

    if (pageLabel) {
      pageLabel.textContent =
        totalRows > 0 ? `Page ${state.helmetTable.page} of ${totalPages}` : 'Page 1 of 1';
    }
    if (prevButton) prevButton.disabled = state.helmetTable.page <= 1;
    if (nextButton) nextButton.disabled = state.helmetTable.page >= totalPages;
  }

  function renderBicycleTableControls() {
    const headerIds = {
      name: 'bicycle-name-header',
      id: 'bicycle-id-header',
      nfcCode: 'bicycle-nfc-header',
      status: 'bicycle-status-header',
      assignedSoldier: 'bicycle-soldier-header',
      helmetCode: 'bicycle-helmet-header',
      rentedAt: 'bicycle-rented-at-header',
    };

    Object.entries(headerIds).forEach(([column, headerId]) => {
      const active = state.bicycleTable.sortColumn === column;
      const direction = active ? state.bicycleTable.sortDirection : 'default';
      const indicator = document.querySelector(`[data-bicycle-sort-indicator="${column}"]`);
      const header = byId(headerId);
      if (indicator) {
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      }
      if (!header) return;
      header.setAttribute(
        'aria-sort',
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      );
    });
  }

  function renderHelmetTableControls() {
    const headerIds = {
      code: 'helmet-code-header',
      nfcCode: 'helmet-nfc-header',
      id: 'helmet-id-header',
      bicycleName: 'helmet-bicycle-header',
      assignedSoldier: 'helmet-soldier-header',
      status: 'helmet-status-header',
    };

    Object.entries(headerIds).forEach(([column, headerId]) => {
      const active = state.helmetTable.sortColumn === column;
      const direction = active ? state.helmetTable.sortDirection : 'default';
      const indicator = document.querySelector(`[data-helmet-sort-indicator="${column}"]`);
      const header = byId(headerId);
      if (indicator) {
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      }
      if (!header) return;
      header.setAttribute(
        'aria-sort',
        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      );
    });
  }

  function renderReportTableControls() {
    const headerIds = {
      rentedAt: 'report-rented-at-header',
      returnedAt: 'report-returned-at-header',
      status: 'report-status-header',
      bicycleName: 'report-bicycle-header',
      bicycleNfcCode: 'report-bicycle-nfc-header',
      soldierName: 'report-soldier-header',
      helmetCode: 'report-helmet-header',
      helmetNfcCode: 'report-helmet-nfc-header',
    };

    Object.entries(headerIds).forEach(([column, headerId]) => {
      const active = state.report.sortColumn === column;
      const direction = active ? state.report.sortDirection : 'default';
      const indicator = document.querySelector(`[data-report-sort-indicator="${column}"]`);
      const header = byId(headerId);
      if (indicator) {
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      }
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

  function buildOverviewQuery() {
    return {
      state: JSON.stringify({
        bicycle: buildTableRequestState(state.bicycleTable),
        helmet: buildTableRequestState(state.helmetTable),
      }),
    };
  }

  function buildReportTableState() {
    return {
      daily: {
        page: state.report.dailyPage,
        limit: state.report.dailyLimit,
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

  function buildReportQuery(baseQuery = getReportQuery()) {
    if (!baseQuery) return null;
    return {
      ...baseQuery,
      state: JSON.stringify(buildReportTableState()),
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

  function renderRows(rows = state.rows) {
    const tbody = byId('bicycles-table-body');
    if (!tbody) return;
    renderBicycleTableControls();
    const pageRows = Array.isArray(state.bicycleTable.rows) ? state.bicycleTable.rows : [];
    renderBicyclePagination(state.bicycleTable.totalRows);

    if (!state.bicycleTable.sourceTotal) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="table-empty">No bicycles are available for the current camp.</td></tr>';
      return;
    }

    if (!state.bicycleTable.totalRows) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="table-empty">No bicycles match the current search.</td></tr>';
      return;
    }

    tbody.innerHTML = pageRows
      .map((row) => {
        const status = String(row.status || '').toLowerCase();
        const canRent = canRentReturn() && status === 'available';
        const canReturn =
          canRentReturn() && ['rented', 'long_term', 'late', 'repair'].includes(status);

        return `
          <tr>
            <td><code>${escapeHtml(row.id)}</code></td>
            <td>${escapeHtml(row.name)}</td>
            <td><code>${escapeHtml(row.nfcCode || '')}</code></td>
            <td><span class="status-pill status-pill--${escapeAttr(status || 'unknown')}">${escapeHtml(formatStatusLabel(row.status))}</span></td>
            <td>${escapeHtml(row.assignedSoldier || 'Unassigned')}</td>
            <td>${escapeHtml(row.helmetCode || 'None')}</td>
            <td>${escapeHtml(row.rentedAt ? formatDateTime(row.rentedAt) : 'None')}</td>
            <td>
              <div class="table-action-group">
                <button class="btn btn-primary js-edit-bicycle" type="button" data-identifier="${escapeAttr(row.id)}" ${canEdit() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
                </button>
                <button class="btn btn-ghost js-rent-bicycle" type="button" data-identifier="${escapeAttr(row.id)}" ${canRent ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-bicycle"></use></svg><span>Rent</span>
                </button>
                <button class="btn btn-ghost js-return-bicycle" type="button" data-identifier="${escapeAttr(row.id)}" ${canReturn ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-arrow-return"></use></svg><span>Return</span>
                </button>
                <button class="btn btn-danger js-delete-bicycle" type="button" data-identifier="${escapeAttr(row.id)}" ${canDelete() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderHelmetRows(rows = state.helmetRows) {
    const tbody = byId('helmets-table-body');
    if (!tbody) return;
    renderHelmetTableControls();
    const pageRows = Array.isArray(state.helmetTable.rows) ? state.helmetTable.rows : [];
    renderHelmetPagination(state.helmetTable.totalRows);

    if (!state.helmetTable.sourceTotal) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="table-empty">No helmets are available for the current camp.</td></tr>';
      return;
    }

    if (!state.helmetTable.totalRows) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="table-empty">No helmets match the current search.</td></tr>';
      return;
    }

    tbody.innerHTML = pageRows
      .map(
        (row) => {
          const status = row.assignmentId ? String(row.status || '').toLowerCase() : 'available';
          return `
          <tr>
            <td><code>${escapeHtml(row.id || '')}</code></td>
            <td>${escapeHtml(row.code)}</td>
            <td><code>${escapeHtml(row.nfcCode || '')}</code></td>
            <td>${escapeHtml(row.bicycleName || 'Unassigned')}</td>
            <td>${escapeHtml(row.assignedSoldier || 'Unassigned')}</td>
            <td><span class="status-pill status-pill--${escapeAttr(status || 'unknown')}">${escapeHtml(formatStatusLabel(status))}</span></td>
            <td>
              <div class="table-action-group">
                <button class="btn btn-primary js-edit-helmet" type="button" data-helmet-id="${escapeAttr(row.id)}" ${canEditHelmet() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
                </button>
                <button class="btn btn-danger js-delete-helmet" type="button" data-helmet-id="${escapeAttr(row.id)}" ${canDeleteHelmet() ? '' : 'disabled'}>
                  <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
        },
      )
      .join('');
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
    const fromInput = byId('bicycle-report-from-date-input');
    const toInput = byId('bicycle-report-to-date-input');
    if (fromInput && !fromInput.value) fromInput.value = defaults.fromDate;
    if (toInput && !toInput.value) toInput.value = defaults.toDate;
  }

  function getReportQuery({ notify = true } = {}) {
    const fromDate = byId('bicycle-report-from-date-input')?.value || '';
    const toDate = byId('bicycle-report-to-date-input')?.value || '';
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

  function resetReportTableState() {
    state.report.dailyPage = 1;
    state.report.historyPage = 1;
    state.report.filters = {
      rentedAt: '',
      returnedAt: '',
      status: '',
      bicycleName: '',
      bicycleNfcCode: '',
      soldierName: '',
      helmetCode: '',
      helmetNfcCode: '',
    };
    state.report.sortColumn = null;
    state.report.sortDirection = 'default';
    document.querySelectorAll('[data-report-filter-column]').forEach((input) => {
      if (input instanceof HTMLInputElement) input.value = '';
    });
  }

  function resetReportDateFiltersToDefault() {
    const defaults = getDefaultReportRange();
    const fromInput = byId('bicycle-report-from-date-input');
    const toInput = byId('bicycle-report-to-date-input');
    if (fromInput) fromInput.value = defaults.fromDate;
    if (toInput) toInput.value = defaults.toDate;
    state.report.fromDate = '';
    state.report.toDate = '';
  }

  async function handleReportDateFilterChange() {
    state.report.fromDate = '';
    state.report.toDate = '';
    state.report.dailyPage = 1;
    state.report.historyPage = 1;
    syncReportDownloadButton();

    const fromDate = byId('bicycle-report-from-date-input')?.value || '';
    const toDate = byId('bicycle-report-to-date-input')?.value || '';
    if (!fromDate || !toDate) return;

    await refreshReport({ quiet: true });
  }

  function syncReportDownloadButton() {
    const button = byId('download-bicycle-report-button');
    if (!button) return;
    const fromDate = state.report.fromDate || byId('bicycle-report-from-date-input')?.value || '';
    const toDate = state.report.toDate || byId('bicycle-report-to-date-input')?.value || '';
    const query = fromDate && toDate && fromDate <= toDate ? { fromDate, toDate } : null;
    const disabled = !canViewReport() || state.report.isBusy || !query;
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    button.href = disabled ? '#' : api.getRentalReportDownloadUrl(buildReportQuery(query));
  }

  function renderReportPagination({
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
      pageLabel.textContent = `Page ${state.report[pageKey]} of ${totalPages}`;
    }
    setDisabled(prevButton, state.report[pageKey] <= 1);
    setDisabled(nextButton, state.report[pageKey] >= totalPages);
  }

  function renderRentalHistoryRows(tbody, rows, emptyText) {
    if (!tbody) return;
    tbody.innerHTML = rows.length
      ? rows
          .map((row) => {
            const status = String(row.status || 'rented').toLowerCase();
            return `
              <tr>
                <td>${escapeHtml(row.rentedAt ? formatDateTime(row.rentedAt) : 'None')}</td>
                <td>${escapeHtml(row.returnedAt ? formatDateTime(row.returnedAt) : 'Active')}</td>
                <td><span class="status-pill status-pill--${escapeAttr(status)}">${escapeHtml(formatStatusLabel(status))}</span></td>
                <td>${escapeHtml(row.bicycleName || 'Unknown')}</td>
                <td><code>${escapeHtml(row.bicycleNfcCode || '')}</code></td>
                <td>${escapeHtml(row.soldierName || 'Unassigned')}</td>
                <td>${escapeHtml(row.helmetCode || 'None')}</td>
                <td><code>${escapeHtml(row.helmetNfcCode || '')}</code></td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="8" class="table-empty">${escapeHtml(emptyText)}</td></tr>`;
  }

  function renderReportAssetHistory() {
    const body = byId('report-asset-history-body');
    if (!body) return;
    if (state.report.isAssetBusy) {
      body.innerHTML = '<tr><td colspan="8" class="table-empty">Loading recent rentals...</td></tr>';
      return;
    }
    if (!state.report.assetId) {
      body.innerHTML = '<tr><td colspan="8" class="table-empty">Select a bike or helmet.</td></tr>';
      return;
    }
    renderRentalHistoryRows(
      body,
      Array.isArray(state.report.assetRows) ? state.report.assetRows : [],
      'No rental history is available for the selected bike or helmet.',
    );
  }

  function renderReportSoldierActiveRows() {
    const body = byId('report-soldier-active-body');
    if (!body) return;
    if (state.report.isSoldierBusy) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">Loading active assignments...</td></tr>';
      return;
    }
    if (!state.report.soldierId) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">Select a soldier.</td></tr>';
      return;
    }
    const rows = Array.isArray(state.report.soldierRows) ? state.report.soldierRows : [];
    body.innerHTML = rows.length
      ? rows
          .map((row) => {
            const status = String(row.status || 'rented').toLowerCase();
            return `
              <tr>
                <td>${escapeHtml(row.bicycleName || 'Unknown')}</td>
                <td><code>${escapeHtml(row.bicycleNfcCode || '')}</code></td>
                <td>${escapeHtml(row.helmetCode || 'None')}</td>
                <td><code>${escapeHtml(row.helmetNfcCode || '')}</code></td>
                <td><span class="status-pill status-pill--${escapeAttr(status)}">${escapeHtml(formatStatusLabel(status))}</span></td>
                <td>${escapeHtml(row.rentedAt ? formatDateTime(row.rentedAt) : 'None')}</td>
              </tr>
            `;
          })
          .join('')
      : '<tr><td colspan="6" class="table-empty">No active bike or helmet assignments for the selected soldier.</td></tr>';
  }

  function renderReport() {
    const dailyBody = byId('bicycle-report-daily-body');
    const historyBody = byId('bicycle-report-history-body');
    const rows = Array.isArray(state.report.rows) ? state.report.rows : [];
    const dailyTotals = Array.isArray(state.report.dailyTotals) ? state.report.dailyTotals : [];
    renderReportTableControls();

    byId('bicycle-report-row-count').textContent = String(state.report.historyTotalRows);
    byId('bicycle-report-helmet-count').textContent = String(state.report.helmetRentalCount);
    renderReportPagination({
      pageLabelId: 'report-daily-page-label',
      prevButtonId: 'report-daily-prev-button',
      nextButtonId: 'report-daily-next-button',
      pageKey: 'dailyPage',
      totalPagesKey: 'dailyTotalPages',
      totalRows: state.report.dailyTotalRows,
    });
    renderReportPagination({
      pageLabelId: 'report-history-page-label',
      prevButtonId: 'report-history-prev-button',
      nextButtonId: 'report-history-next-button',
      pageKey: 'historyPage',
      totalPagesKey: 'historyTotalPages',
      totalRows: state.report.historyTotalRows,
    });

    if (dailyBody) {
      dailyBody.innerHTML = dailyTotals.length
        ? dailyTotals
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.date)}</td>
                  <td>${escapeHtml(row.rentalCount ?? 0)}</td>
                </tr>
              `,
            )
            .join('')
        : '<tr><td colspan="2" class="table-empty">No daily totals are available for the selected interval.</td></tr>';
    }

    if (historyBody) {
      renderRentalHistoryRows(
        historyBody,
        rows,
        state.report.historySourceTotal
          ? 'No rental history matches the current search.'
          : 'No rental history matches the selected interval.',
      );
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
    const requestQuery = buildReportQuery(query);

    state.report.isBusy = true;
    if (!quiet) pageState.set('loading', 'Loading bicycle report...');
    updateControlVisibility();

    const request = reportScope.next();
    const result = await api.getRentalReport(requestQuery, request.signal);
    if (result.aborted || !reportScope.isCurrent(request.token)) return false;

    state.report.isBusy = false;
    if (!result.ok) {
      state.report.rows = [];
      state.report.dailyTotals = [];
      state.report.totalRentals = 0;
      state.report.dailyTotalRows = 0;
      state.report.historyTotalRows = 0;
      state.report.helmetRentalCount = 0;
      state.report.dailyPage = 1;
      state.report.historyPage = 1;
      state.report.loaded = false;
      renderReport();
      pageState.set(
        result.pageState || 'error',
        result.message || 'Bicycle report is not available right now.',
      );
      toast.show({
        title: 'Report failed',
        message: result.message || 'The bicycle report could not be loaded.',
        variant: 'danger',
      });
      updateControlVisibility();
      return false;
    }

    const body = result.data || {};
    applyReportTableResult(body.rows, body.tables?.history);
    applyReportDailyResult(body.dailyTotals, body.tables?.daily);
    state.report.fromDate = body.fromDate || query.fromDate;
    state.report.toDate = body.toDate || query.toDate;
    state.report.totalRentals = Number(body.totalRentals) || 0;
    state.report.helmetRentalCount = Number(body.helmetRentalCount) || 0;
    state.report.loaded = true;
    renderReport();
    pageState.clear();
    updateControlVisibility();
    return true;
  }

  function renderOverviewMetrics(body = {}) {
    const rows = Array.isArray(body.lookups?.rows)
      ? body.lookups.rows
      : Array.isArray(body.rows)
        ? body.rows
        : [];
    const totalFromSummary =
      Number(body.available || 0) +
      Number(body.rented || 0) +
      Number(body.repair || 0) +
      Number(body.late || 0) +
      Number(body.longTerm || 0);
    const total = rows.length || totalFromSummary;
    byId('bike-count-total').textContent = String(total);
    byId('helmet-pairing-count').textContent = String(
      body.helmetPairingCount ?? rows.filter((row) => row.helmetCode).length,
    );
    byId('bike-count-attention').textContent = String(
      Number(body.repair || 0) + Number(body.late || 0),
    );
  }

  async function refreshOverview({ quiet = false } = {}) {
    if (!quiet) pageState.set('loading', 'Loading bicycle overview...');
    const request = overviewScope.next();
    const result = await api.getOverview(buildOverviewQuery(), request.signal);
    if (result.aborted || !overviewScope.isCurrent(request.token)) return false;

    if (!result.ok) {
      pageState.set(
        result.pageState || 'error',
        result.message || 'Bicycle overview is not available right now.',
      );
      state.helmetRows = [];
      state.bicycleTable.rows = [];
      state.helmetTable.rows = [];
      renderRows([]);
      renderHelmetRows([]);
      renderOverviewMetrics();
      toast.show({
        title: 'Bicycle overview failed',
        message: result.message || 'The bicycle overview could not be loaded.',
        variant: 'danger',
      });
      return false;
    }

    const previousStatuses = new Map(
      state.rows.map((row) => [String(row.id || ''), row.status || '']),
    );
    const body = result.data || {};
    state.rows = Array.isArray(body.lookups?.rows)
      ? body.lookups.rows
      : Array.isArray(body.rows)
        ? body.rows
        : [];
    state.helmetRows = Array.isArray(body.lookups?.helmets)
      ? body.lookups.helmets
      : Array.isArray(body.helmets)
        ? body.helmets
        : [];
    applyServerTableResult(state.bicycleTable, body.rows, body.tables?.bicycles);
    applyServerTableResult(state.helmetTable, body.helmets, body.tables?.helmets);
    byId('bike-count-available').textContent = String(body.available ?? '0');
    byId('bike-count-rented').textContent = String(body.rented ?? '0');
    byId('bike-count-repair').textContent = String(body.repair ?? '0');
    byId('bike-count-late').textContent = String(body.late ?? 0);
    byId('bike-count-long-term').textContent = String(body.longTerm ?? 0);
    notifyNewLateBikes(previousStatuses, state.rows);
    renderRows();
    renderHelmetRows();
    renderOverviewMetrics(body);
    updateOpenReturnBicycleModal();
    updateOpenEditBicycleModal();
    pageState.clear();
    updateControlVisibility();
    return true;
  }

  async function refreshFleetDataAfterChange({ quiet = true, refreshLoadedReport = true } = {}) {
    const refreshed = await refreshOverview({ quiet });
    if (!refreshed) return false;
    await Promise.all([
      refreshReportSearchInformation({ refreshLoadedReport }),
      refreshBicycleLookupOptions(),
    ]);
    return true;
  }

  function renderImportSummary(summary) {
    const node = byId('bicycle-import-summary');
    if (!node) return;
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
          <div class="bicycle-import-summary-item">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `,
      )
      .join('');
  }

  function renderImportErrors(errors = []) {
    const node = byId('bicycle-import-errors');
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

  function renderImportProgress() {
    const panel = byId('bicycle-import-progress-panel');
    if (!panel) return;
    panel.hidden = !state.import.visible;
    byId('bicycle-template-selected-file').textContent =
      state.import.fileName || 'No file selected.';
    byId('bicycle-import-upload-label').textContent = `${state.import.uploadPercent}%`;
    byId('bicycle-import-processing-label').textContent = `${state.import.processingPercent}%`;
    setProgressValue(byId('bicycle-import-upload-progress-bar'), state.import.uploadPercent);
    setProgressValue(
      byId('bicycle-import-processing-progress-bar'),
      state.import.processingPercent,
    );
    byId('bicycle-import-status-message').textContent =
      state.import.statusMessage || 'Waiting to start.';
    renderImportSummary(state.import.summary);
    renderImportErrors(state.import.errors);
    updateControlVisibility();
  }

  function resetImportProgress({ keepFileName = false } = {}) {
    state.import.uploadPercent = 0;
    state.import.processingPercent = 0;
    state.import.statusMessage = 'Download the template to begin.';
    state.import.summary = null;
    state.import.errors = [];
    state.import.visible = false;
    if (!keepFileName) state.import.fileName = '';
    renderImportProgress();
  }

  function clearBulkImportModal() {
    const fileInput = byId('bicycle-template-file-input');
    if (fileInput) fileInput.value = '';
    resetImportProgress();
  }

  function renderHelmetImportSummary(summary) {
    const node = byId('helmet-import-summary');
    if (!node) return;
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
          <div class="bicycle-import-summary-item">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `,
      )
      .join('');
  }

  function renderHelmetImportErrors(errors = []) {
    const node = byId('helmet-import-errors');
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

  function renderHelmetImportProgress() {
    const panel = byId('helmet-import-progress-panel');
    if (!panel) return;
    panel.hidden = !state.helmetImport.visible;
    byId('helmet-template-selected-file').textContent =
      state.helmetImport.fileName || 'No file selected.';
    byId('helmet-import-upload-label').textContent = `${state.helmetImport.uploadPercent}%`;
    byId('helmet-import-processing-label').textContent =
      `${state.helmetImport.processingPercent}%`;
    setProgressValue(byId('helmet-import-upload-progress-bar'), state.helmetImport.uploadPercent);
    setProgressValue(
      byId('helmet-import-processing-progress-bar'),
      state.helmetImport.processingPercent,
    );
    byId('helmet-import-status-message').textContent =
      state.helmetImport.statusMessage || 'Waiting to start.';
    renderHelmetImportSummary(state.helmetImport.summary);
    renderHelmetImportErrors(state.helmetImport.errors);
    updateControlVisibility();
  }

  function resetHelmetImportProgress({ keepFileName = false } = {}) {
    state.helmetImport.uploadPercent = 0;
    state.helmetImport.processingPercent = 0;
    state.helmetImport.statusMessage = 'Download the template to begin.';
    state.helmetImport.summary = null;
    state.helmetImport.errors = [];
    state.helmetImport.visible = false;
    if (!keepFileName) state.helmetImport.fileName = '';
    renderHelmetImportProgress();
  }

  function clearBulkHelmetImportModal() {
    const fileInput = byId('helmet-template-file-input');
    if (fileInput) fileInput.value = '';
    resetHelmetImportProgress();
  }

  function applyImportPayload(payload = {}) {
    const summary = payload.summary || state.import.summary;
    state.import.visible = true;
    state.import.statusMessage = payload.message || state.import.statusMessage;
    state.import.processingPercent = Number(payload.progressPercent) || 0;
    if (state.import.processingPercent > 0) state.import.uploadPercent = 100;
    if (summary) {
      state.import.summary = {
        totalRows: Number(summary.totalRows) || 0,
        processedRows: Number(summary.processedRows) || 0,
        addedCount: Number(summary.addedCount) || 0,
        updatedCount: Number(summary.updatedCount) || 0,
        skippedCount: Number(summary.skippedCount) || 0,
        errorCount: Number(summary.errorCount) || 0,
      };
      if (Array.isArray(summary.errors)) state.import.errors = summary.errors;
    }
    if (Array.isArray(payload.errors) && payload.errors.length)
      state.import.errors = payload.errors;
    renderImportProgress();
  }

  function applyHelmetImportPayload(payload = {}) {
    const summary = payload.summary || state.helmetImport.summary;
    state.helmetImport.visible = true;
    state.helmetImport.statusMessage = payload.message || state.helmetImport.statusMessage;
    state.helmetImport.processingPercent = Number(payload.progressPercent) || 0;
    if (state.helmetImport.processingPercent > 0) state.helmetImport.uploadPercent = 100;
    if (summary) {
      state.helmetImport.summary = {
        totalRows: Number(summary.totalRows) || 0,
        processedRows: Number(summary.processedRows) || 0,
        addedCount: Number(summary.addedCount) || 0,
        updatedCount: Number(summary.updatedCount) || 0,
        skippedCount: Number(summary.skippedCount) || 0,
        errorCount: Number(summary.errorCount) || 0,
      };
      if (Array.isArray(summary.errors)) state.helmetImport.errors = summary.errors;
    }
    if (Array.isArray(payload.errors) && payload.errors.length)
      state.helmetImport.errors = payload.errors;
    renderHelmetImportProgress();
  }

  async function handleTemplateUpload() {
    if (!canImport()) {
      updateControlVisibility();
      return;
    }
    const input = byId('bicycle-template-file-input');
    const file = input?.files?.[0];
    if (!file) {
      toast.show({
        title: 'Missing information',
        message: 'Choose a completed bicycle template before uploading.',
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
    renderImportProgress();

    const result = await api.importBicycleTemplate(file, {
      onUploadProgress(progress) {
        state.import.visible = true;
        state.import.uploadPercent = progress;
        state.import.statusMessage =
          progress >= 100 ? 'Upload complete. Processing template...' : 'Uploading template...';
        renderImportProgress();
      },
    });

    state.import.isBusy = false;
    if (result.data?.summary) {
      applyImportPayload({
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
      state.import.statusMessage =
        result.message || 'The bicycle template request could not be completed.';
      state.import.visible = true;
      renderImportProgress();
    }

    if (!result.ok) {
      toast.show({
        title: 'Import failed',
        message: result.message || 'The bicycle template could not be processed.',
        variant: 'danger',
      });
      return;
    }

    if (input) input.value = '';
    toast.show({
      title:
        state.import.summary?.errorCount > 0
          ? 'Import completed with warnings'
          : 'Import completed',
      message: result.data?.message || 'The bicycle template was processed successfully.',
      variant: state.import.summary?.errorCount > 0 ? 'warning' : 'success',
    });
    await refreshFleetDataAfterChange();
  }

  async function handleHelmetTemplateUpload() {
    if (!canImportHelmets()) {
      updateControlVisibility();
      return;
    }
    const input = byId('helmet-template-file-input');
    const file = input?.files?.[0];
    if (!file) {
      toast.show({
        title: 'Missing information',
        message: 'Choose a completed helmet template before uploading.',
        variant: 'warning',
      });
      return;
    }

    state.helmetImport.fileName = file.name;
    state.helmetImport.uploadPercent = 0;
    state.helmetImport.processingPercent = 0;
    state.helmetImport.statusMessage = 'Uploading template...';
    state.helmetImport.summary = null;
    state.helmetImport.errors = [];
    state.helmetImport.visible = true;
    state.helmetImport.isBusy = true;
    renderHelmetImportProgress();

    const result = await api.importHelmetTemplate(file, {
      onUploadProgress(progress) {
        state.helmetImport.visible = true;
        state.helmetImport.uploadPercent = progress;
        state.helmetImport.statusMessage =
          progress >= 100 ? 'Upload complete. Processing template...' : 'Uploading template...';
        renderHelmetImportProgress();
      },
    });

    state.helmetImport.isBusy = false;
    if (result.data?.summary) {
      applyHelmetImportPayload({
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
      state.helmetImport.statusMessage =
        result.message || 'The helmet template request could not be completed.';
      state.helmetImport.visible = true;
      renderHelmetImportProgress();
    }

    if (!result.ok) {
      toast.show({
        title: 'Import failed',
        message: result.message || 'The helmet template could not be processed.',
        variant: 'danger',
      });
      return;
    }

    if (input) input.value = '';
    toast.show({
      title:
        state.helmetImport.summary?.errorCount > 0
          ? 'Import completed with warnings'
          : 'Import completed',
      message: result.data?.message || 'The helmet template was processed successfully.',
      variant: state.helmetImport.summary?.errorCount > 0 ? 'warning' : 'success',
    });
    await refreshFleetDataAfterChange();
  }

  function openCreateBicycleModal() {
    if (!canAdd()) {
      updateControlVisibility();
      return;
    }
    bicycleModalState.clear();
    byId('bicycle-form').reset();
    byId('bicycle-form-mode').value = 'create';
    byId('bicycle-id-input').value = '';
    byId('bicycle-current-status-input').value = 'available';
    byId('bicycle-status-input').value = '';
    byId('bicycle-status-value-input').value = '';
    byId('bicycle-soldier-id-input').value = '';
    byId('bicycle-helmet-id-input').value = '';
    state.editAssignmentBackup = null;
    state.editAssignmentSnapshot = null;
    editStatusLookup.clear();
    editSoldierLookup.clear();
    editHelmetLookup.clear();
    byId('bicycle-modal-title').textContent = 'Add bicycle';
    byId('bicycle-modal-text').textContent =
      'Register a bicycle with a unique NFC code for scan-based workflows.';
    byId('save-bicycle-button').textContent = 'Create bike';
    updateControlVisibility();
    bicycleModal?.open();
  }

  function openEditBicycleModal(identifier) {
    if (!canEdit()) {
      updateControlVisibility();
      return;
    }
    const row = findBicycle(identifier);
    if (!row) return;
    bicycleModalState.clear();
    byId('bicycle-form-mode').value = 'edit';
    byId('bicycle-id-input').value = row.id || '';
    byId('bicycle-name-input').value = row.name || '';
    byId('bicycle-nfc-input').value = row.nfcCode || '';
    byId('bicycle-current-status-input').value = row.status || 'available';
    const editableStatus = normalizeEditableStatusInput(row.status);
    byId('bicycle-status-input').value = editableStatus ? formatStatusLabel(editableStatus) : '';
    byId('bicycle-status-value-input').value = editableStatus;
    byId('bicycle-soldier-id-input').value = row.assignedSoldierId || '';
    byId('bicycle-helmet-id-input').value = row.helmetId || '';
    byId('bicycle-soldier-search-input').value = row.assignedSoldier || '';
    byId('bicycle-helmet-search-input').value = row.helmetCode || '';
    byId('bicycle-rent-date-input').value = toLocalDateTimeInputValue(row.rentedAt);
    state.editStatuses.clear();
    state.editSoldiers.clear();
    state.editHelmets.clear();
    state.editAssignmentBackup = null;
    state.editAssignmentSnapshot = {
      bicycleId: row.id || '',
      soldierId: row.assignedSoldierId || '',
      helmetId: row.helmetId || '',
    };
    EDITABLE_STATUS_OPTIONS.forEach((status) => state.editStatuses.set(status.label, status.id));
    if (row.assignedSoldier && row.assignedSoldierId) {
      state.editSoldiers.set(row.assignedSoldier, row.assignedSoldierId);
    }
    if (row.helmetCode && row.helmetId) {
      state.editHelmets.set(row.helmetCode, row.helmetId);
    }
    setDateInputMax('bicycle-rent-date-input');
    byId('bicycle-modal-title').textContent = 'Edit bicycle';
    byId('bicycle-modal-text').textContent = 'Update bike details and active assignment fields.';
    byId('save-bicycle-button').textContent = 'Save changes';
    updateControlVisibility();
    syncBicycleAssignmentEditControls();
    bicycleModal?.open();
    if (String(row.status || '').toLowerCase() !== 'available') {
      void loadEditSoldierOptions('', { open: false });
      void loadEditHelmetOptions('', { open: false });
      loadEditStatusOptions('', { open: false });
    }
  }

  function openCreateHelmetModal() {
    if (!canAddHelmet()) {
      updateControlVisibility();
      return;
    }
    helmetModalState.clear();
    byId('helmet-form').reset();
    byId('helmet-form-mode').value = 'create';
    byId('helmet-id-input').value = '';
    byId('helmet-code-input').value = '';
    byId('helmet-nfc-input').value = '';
    byId('helmet-modal-title').textContent = 'Add helmet';
    byId('helmet-modal-text').textContent = 'Register a helmet code and NFC code for bike rental workflows.';
    byId('save-helmet-button').textContent = 'Create helmet';
    updateControlVisibility();
    helmetModal?.open();
  }

  function openEditHelmetModal(helmetId) {
    if (!canEditHelmet()) {
      updateControlVisibility();
      return;
    }
    const row = findHelmet(helmetId);
    if (!row) return;
    helmetModalState.clear();
    byId('helmet-form-mode').value = 'edit';
    byId('helmet-id-input').value = row.id || '';
    byId('helmet-code-input').value = row.code || '';
    byId('helmet-nfc-input').value = row.nfcCode || '';
    byId('helmet-modal-title').textContent = 'Edit helmet';
    byId('helmet-modal-text').textContent = 'Update the helmet code and NFC code used at the selected camp.';
    byId('save-helmet-button').textContent = 'Save changes';
    updateControlVisibility();
    helmetModal?.open();
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

    function renderOptions(rows = [], { open = true, syncSelection = false } = {}) {
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
      if (syncSelection && hiddenInput.value) {
        const selectedOption = lookupState.options.find(
          (option) => String(option.id) === String(hiddenInput.value),
        );
        if (selectedOption) {
          input.value = selectedOption.label;
        } else {
          input.value = '';
          hiddenInput.value = '';
        }
      }

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

    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
    });

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
      renderLoading,
      renderOptions,
      syncHiddenId,
    };
  }

  function getCurrentReportAssetType() {
    return document.querySelector('[name="reportAssetType"]:checked')?.value === 'helmet'
      ? 'helmet'
      : 'bicycle';
  }

  function getReportAssetLabel(row, type = getCurrentReportAssetType()) {
    if (!row) return '';
    return type === 'helmet'
      ? [row.code, row.nfcCode ? `NFC ${row.nfcCode}` : ''].filter(Boolean).join(' | ')
      : [row.name, row.nfcCode ? `NFC ${row.nfcCode}` : ''].filter(Boolean).join(' | ');
  }

  function findReportAssetRow(assetId = byId('report-asset-id-input')?.value || '') {
    const type = getCurrentReportAssetType();
    const rows = type === 'helmet' ? state.helmetRows : state.rows;
    return (Array.isArray(rows) ? rows : []).find((row) => String(row.id) === String(assetId));
  }

  function syncSelectedReportAssetLabel() {
    const assetIdInput = byId('report-asset-id-input');
    const searchInput = byId('report-asset-search-input');
    const assetId = assetIdInput?.value || state.report.assetId || '';
    if (!assetId || !searchInput) return '';

    const row = findReportAssetRow(assetId);
    if (!row) {
      if (assetIdInput) assetIdInput.value = '';
      searchInput.value = '';
      state.report.assetId = '';
      state.report.assetRows = [];
      renderReportAssetHistory();
      return '';
    }

    const label = getReportAssetLabel(row);
    searchInput.value = label;
    if (assetIdInput) assetIdInput.value = row.id || '';
    return row.id || '';
  }

  function syncReportSearchOptions() {
    const assetSearch =
      byId('report-asset-id-input')?.value || byId('report-asset-search-input')?.value || '';
    const soldierSearch =
      byId('report-soldier-id-input')?.value || byId('report-soldier-search-input')?.value || '';
    void loadReportAssetOptions(assetSearch, { open: false, syncSelection: true });
    void loadReportSoldierOptions(soldierSearch, { open: false, syncSelection: true });
  }

  async function refreshReportSearchInformation({ refreshLoadedReport = false } = {}) {
    if (!canViewReport()) return false;

    const assetId = syncSelectedReportAssetLabel();
    syncReportSearchOptions();

    const soldierId = byId('report-soldier-id-input')?.value || state.report.soldierId || '';
    const refreshes = [];
    if (assetId) refreshes.push(refreshReportAssetHistory(assetId));
    if (soldierId) refreshes.push(refreshReportSoldierActiveRows(soldierId));
    if (refreshLoadedReport && state.report.loaded) refreshes.push(refreshReport({ quiet: true }));

    if (!refreshes.length) return true;
    const results = await Promise.all(refreshes);
    return results.every(Boolean);
  }

  async function loadReportAssetOptions(search = '', { open = true, syncSelection = false } = {}) {
    reportAssetLookup.renderLoading({ open });
    const request = reportAssetLookupScope.next();
    const result = await api.searchReportAssets(
      { assetType: getCurrentReportAssetType(), search, limit: 20 },
      request.signal,
    );
    if (result.aborted || !reportAssetLookupScope.isCurrent(request.token)) return;
    const rows = result.ok && Array.isArray(result.data?.assets) ? result.data.assets : [];
    reportAssetLookup.renderOptions(rows, { open, syncSelection });
    reportAssetLookup.syncHiddenId();
  }

  async function loadReportSoldierOptions(search = '', { open = true, syncSelection = false } = {}) {
    reportSoldierLookup.renderLoading({ open });
    const request = reportSoldierLookupScope.next();
    const result = await api.searchReportSoldiers({ search, limit: 20 }, request.signal);
    if (result.aborted || !reportSoldierLookupScope.isCurrent(request.token)) return;
    const rows = result.ok && Array.isArray(result.data?.soldiers) ? result.data.soldiers : [];
    reportSoldierLookup.renderOptions(rows, { open, syncSelection });
    reportSoldierLookup.syncHiddenId();
  }

  async function refreshReportAssetHistory(assetId = byId('report-asset-id-input')?.value || '') {
    const selectedAssetId = String(assetId || '').trim();
    state.report.assetId = selectedAssetId;
    state.report.assetType = getCurrentReportAssetType();
    state.report.assetRows = [];
    if (!selectedAssetId) {
      renderReportAssetHistory();
      return false;
    }

    state.report.isAssetBusy = true;
    renderReportAssetHistory();
    updateControlVisibility();

    const request = reportAssetScope.next();
    const result = await api.getRecentAssetRentals(
      { assetType: state.report.assetType, assetId: selectedAssetId, limit: 2 },
      request.signal,
    );
    if (result.aborted || !reportAssetScope.isCurrent(request.token)) return false;

    state.report.isAssetBusy = false;
    state.report.assetRows = result.ok && Array.isArray(result.data?.rows) ? result.data.rows : [];
    renderReportAssetHistory();
    updateControlVisibility();
    if (!result.ok) {
      toast.show({
        title: 'Lookup failed',
        message: result.message || 'Recent rentals could not be loaded.',
        variant: 'danger',
      });
      return false;
    }
    return true;
  }

  async function refreshReportSoldierActiveRows(
    soldierId = byId('report-soldier-id-input')?.value || '',
  ) {
    const selectedSoldierId = String(soldierId || '').trim();
    state.report.soldierId = selectedSoldierId;
    state.report.soldierRows = [];
    if (!selectedSoldierId) {
      renderReportSoldierActiveRows();
      return false;
    }

    state.report.isSoldierBusy = true;
    renderReportSoldierActiveRows();
    updateControlVisibility();

    const request = reportSoldierScope.next();
    const result = await api.getActiveSoldierAssignments(
      { soldierId: selectedSoldierId },
      request.signal,
    );
    if (result.aborted || !reportSoldierScope.isCurrent(request.token)) return false;

    state.report.isSoldierBusy = false;
    state.report.soldierRows =
      result.ok && Array.isArray(result.data?.rows) ? result.data.rows : [];
    renderReportSoldierActiveRows();
    updateControlVisibility();
    if (!result.ok) {
      toast.show({
        title: 'Lookup failed',
        message: result.message || 'Active assignments could not be loaded.',
        variant: 'danger',
      });
      return false;
    }
    return true;
  }

  async function loadSoldierOptions(search = '', { open = true, syncSelection = false } = {}) {
    if (open) soldierLookup.renderLoading();
    const request = soldierLookupScope.next();
    const result = await api.searchSoldiers({ search, limit: 20 }, request.signal);
    if (result.aborted || !soldierLookupScope.isCurrent(request.token)) return;
    soldierLookup.renderOptions(result.ok ? result.data?.soldiers || [] : [], {
      open,
      syncSelection,
    });
    soldierLookup.syncHiddenId();
  }

  async function loadHelmetOptions(search = '', { open = true, syncSelection = false } = {}) {
    if (open) helmetLookup.renderLoading();
    const request = helmetLookupScope.next();
    const result = await api.searchHelmets({ search, limit: 20 }, request.signal);
    if (result.aborted || !helmetLookupScope.isCurrent(request.token)) return;
    helmetLookup.renderOptions(result.ok ? result.data?.helmets || [] : [], {
      open,
      syncSelection,
    });
    helmetLookup.syncHiddenId();
  }

  function loadEditStatusOptions(search = '', { open = true } = {}) {
    const query = String(search || '').trim().toLowerCase();
    const rows = EDITABLE_STATUS_OPTIONS.filter(
      (status) => !query || status.label.toLowerCase().includes(query) || status.id.includes(query),
    );
    editStatusLookup.renderOptions(rows, { open });
    editStatusLookup.syncHiddenId();
  }

  async function loadEditSoldierOptions(search = '', { open = true, syncSelection = false } = {}) {
    if (open) editSoldierLookup.renderLoading();
    const request = editSoldierLookupScope.next();
    const result = await api.searchSoldiers({ search, limit: 20 }, request.signal);
    if (result.aborted || !editSoldierLookupScope.isCurrent(request.token)) return;
    editSoldierLookup.renderOptions(result.ok ? result.data?.soldiers || [] : [], {
      open,
      syncSelection,
    });
  }

  async function loadEditHelmetOptions(search = '', { open = true, syncSelection = false } = {}) {
    if (open) editHelmetLookup.renderLoading();
    const request = editHelmetLookupScope.next();
    const result = await api.searchHelmets(
      { search, limit: 20, identifier: byId('bicycle-id-input')?.value || '' },
      request.signal,
    );
    if (result.aborted || !editHelmetLookupScope.isCurrent(request.token)) return;
    editHelmetLookup.renderOptions(result.ok ? result.data?.helmets || [] : [], {
      open,
      syncSelection,
    });
  }

  function isLookupOpen(inputId) {
    return byId(inputId)?.getAttribute('aria-expanded') === 'true';
  }

  async function refreshBicycleLookupOptions() {
    const refreshes = [];
    const rentSoldierInput = byId('rent-soldier-search-input');
    const rentHelmetInput = byId('rent-helmet-search-input');
    const editSoldierInput = byId('bicycle-soldier-search-input');
    const editHelmetInput = byId('bicycle-helmet-search-input');

    if (!rentSoldierInput?.disabled) {
      refreshes.push(
        loadSoldierOptions(byId('rent-soldier-id-input')?.value || rentSoldierInput.value.trim(), {
          open: isLookupOpen('rent-soldier-search-input'),
          syncSelection: true,
        }),
      );
    }
    if (!rentHelmetInput?.disabled) {
      refreshes.push(
        loadHelmetOptions(byId('rent-helmet-id-input')?.value || rentHelmetInput.value.trim(), {
          open: isLookupOpen('rent-helmet-search-input'),
          syncSelection: true,
        }),
      );
    }
    if (!editSoldierInput?.disabled) {
      refreshes.push(
        loadEditSoldierOptions(
          byId('bicycle-soldier-id-input')?.value || editSoldierInput.value.trim(),
          {
            open: isLookupOpen('bicycle-soldier-search-input'),
            syncSelection: true,
          },
        ),
      );
    }
    if (!editHelmetInput?.disabled) {
      refreshes.push(
        loadEditHelmetOptions(
          byId('bicycle-helmet-id-input')?.value || editHelmetInput.value.trim(),
          {
            open: isLookupOpen('bicycle-helmet-search-input'),
            syncSelection: true,
          },
        ),
      );
    }

    await Promise.all(refreshes);
  }

  const soldierLookup = createLookupCombobox({
    inputId: 'rent-soldier-search-input',
    hiddenInputId: 'rent-soldier-id-input',
    listboxId: 'rent-soldier-options',
    targetMap: state.soldiers,
    emptyText: 'No soldiers match that search.',
    loadingText: 'Searching soldiers...',
    getLabel: (soldier) =>
      [soldier.name, soldier.country, soldier.mealCard].filter(Boolean).join(' | '),
    getTitle: (soldier) => soldier.name,
    getMeta: (soldier) =>
      [soldier.country, soldier.mealCard ? `Meal card ${soldier.mealCard}` : '']
        .filter(Boolean)
        .join(' | '),
    onSearch: loadSoldierOptions,
  });

  const helmetLookup = createLookupCombobox({
    inputId: 'rent-helmet-search-input',
    hiddenInputId: 'rent-helmet-id-input',
    listboxId: 'rent-helmet-options',
    targetMap: state.helmets,
    emptyText: 'No available helmets match that search.',
    loadingText: 'Searching helmets...',
    getLabel: (helmet) => helmet.code,
    getTitle: (helmet) => helmet.code,
    getMeta: (helmet) => (helmet.nfcCode ? `NFC ${helmet.nfcCode}` : ''),
    onSearch: loadHelmetOptions,
  });

  const editStatusLookup = createLookupCombobox({
    inputId: 'bicycle-status-input',
    hiddenInputId: 'bicycle-status-value-input',
    listboxId: 'bicycle-status-options',
    targetMap: state.editStatuses,
    emptyText: 'No editable statuses match that search.',
    loadingText: 'Searching statuses...',
    getLabel: (status) => status.label,
    getTitle: (status) => status.label,
    onSearch: loadEditStatusOptions,
    onSelect: syncBicycleAssignmentEditControls,
  });

  const editSoldierLookup = createLookupCombobox({
    inputId: 'bicycle-soldier-search-input',
    hiddenInputId: 'bicycle-soldier-id-input',
    listboxId: 'bicycle-soldier-options',
    targetMap: state.editSoldiers,
    emptyText: 'No soldiers match that search.',
    loadingText: 'Searching soldiers...',
    getLabel: (soldier) =>
      [soldier.name, soldier.country, soldier.mealCard].filter(Boolean).join(' | '),
    getTitle: (soldier) => soldier.name,
    getMeta: (soldier) =>
      [soldier.country, soldier.mealCard ? `Meal card ${soldier.mealCard}` : '']
        .filter(Boolean)
        .join(' | '),
    onSearch: loadEditSoldierOptions,
  });

  const editHelmetLookup = createLookupCombobox({
    inputId: 'bicycle-helmet-search-input',
    hiddenInputId: 'bicycle-helmet-id-input',
    listboxId: 'bicycle-helmet-options',
    targetMap: state.editHelmets,
    emptyText: 'No available helmets match that search.',
    loadingText: 'Searching helmets...',
    getLabel: (helmet) => helmet.code,
    getTitle: (helmet) => helmet.code,
    getMeta: (helmet) => (helmet.nfcCode ? `NFC ${helmet.nfcCode}` : ''),
    onSearch: loadEditHelmetOptions,
  });

  const reportAssetLookup = createLookupCombobox({
    inputId: 'report-asset-search-input',
    hiddenInputId: 'report-asset-id-input',
    listboxId: 'report-asset-options',
    targetMap: state.reportAssets,
    emptyText: 'No matching bike or helmet.',
    loadingText: 'Searching bike or helmet...',
    getLabel: getReportAssetLabel,
    getTitle: (row) => (getCurrentReportAssetType() === 'helmet' ? row.code : row.name),
    getMeta: (row) => row.id || '',
    onSearch: loadReportAssetOptions,
    onSelect: (option) => {
      void refreshReportAssetHistory(option.id);
    },
  });

  const reportSoldierLookup = createLookupCombobox({
    inputId: 'report-soldier-search-input',
    hiddenInputId: 'report-soldier-id-input',
    listboxId: 'report-soldier-options',
    targetMap: state.reportSoldiers,
    emptyText: 'No active soldiers match that search.',
    loadingText: 'Searching soldiers...',
    getLabel: (soldier) => soldier.name,
    getTitle: (soldier) => soldier.name,
    getMeta: (soldier) => soldier.id || '',
    onSearch: loadReportSoldierOptions,
    onSelect: (option) => {
      void refreshReportSoldierActiveRows(option.id);
    },
  });

  function syncLookupHiddenIds() {
    soldierLookup.syncHiddenId();
    helmetLookup.syncHiddenId();
  }

  function syncEditLookupHiddenIds() {
    editStatusLookup.syncHiddenId();
    editSoldierLookup.syncHiddenId();
    editHelmetLookup.syncHiddenId();
  }

  function openRentBicycleModal(identifier) {
    if (!canRentReturn()) {
      updateControlVisibility();
      return;
    }
    const row = findBicycle(identifier);
    if (!row) return;
    rentModalState.clear();
    byId('rent-bicycle-form').reset();
    byId('rent-bicycle-id-input').value = row.id || '';
    byId('rent-bicycle-name-input').value = row.name || '';
    setDateInputMax('rent-date-input');
    byId('rent-date-input').value = toLocalDateTimeInputValue(new Date());
    byId('rent-soldier-id-input').value = '';
    byId('rent-helmet-id-input').value = '';
    soldierLookup.clear();
    helmetLookup.clear();
    updateControlVisibility();
    syncRepairModeControls();
    rentModal?.open();
    void loadSoldierOptions('', { open: false });
    void loadHelmetOptions('', { open: false });
  }

  function openReturnBicycleModal(identifier) {
    if (!canRentReturn()) {
      updateControlVisibility();
      return;
    }
    const row = findBicycle(identifier);
    if (!row) return;
    returnModalState.clear();
    byId('return-bicycle-form').reset();
    byId('return-bicycle-id-input').value = row.id || '';
    byId('return-bike-name-text').textContent = row.name || '-';
    byId('return-soldier-name-text').textContent = row.assignedSoldier || 'Unassigned';
    byId('return-helmet-code-text').textContent = row.helmetCode || 'None';
    byId('return-rented-at-text').textContent = formatDateTime(row.rentedAt);
    setDateInputMin('return-date-input', row.rentedAt);
    byId('return-date-input').value = toLocalDateTimeInputValue(new Date());
    updateControlVisibility();
    returnModal?.open();
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTrigger));
  });

  document.addEventListener('click', async (event) => {
    if (event.target.closest('#refresh-bicycles-button')) {
      await refreshFleetDataAfterChange({ quiet: false });
      return;
    }
    if (event.target.closest('#refresh-bikes-table-button')) {
      await refreshFleetDataAfterChange({ quiet: false });
      return;
    }
    if (event.target.closest('#refresh-helmets-table-button')) {
      await refreshFleetDataAfterChange({ quiet: false });
      return;
    }
    if (event.target.closest('#open-add-bicycle-modal')) {
      openCreateBicycleModal();
      return;
    }
    if (event.target.closest('#open-add-helmet-modal')) {
      openCreateHelmetModal();
      return;
    }
    if (event.target.closest('#open-bulk-bicycle-import-modal')) {
      if (!canImport()) return updateControlVisibility();
      bulkImportModal?.open();
      return;
    }
    if (event.target.closest('#open-bulk-helmet-import-modal')) {
      if (!canImportHelmets()) return updateControlVisibility();
      bulkHelmetImportModal?.open();
      return;
    }
    if (event.target.closest('#upload-bicycle-template-button')) {
      await handleTemplateUpload();
      return;
    }
    if (event.target.closest('#upload-helmet-template-button')) {
      await handleHelmetTemplateUpload();
      return;
    }
    if (event.target.closest('#download-bicycle-report-button')) {
      if (byId('download-bicycle-report-button')?.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        syncReportDownloadButton();
      }
      return;
    }

    const sortButton = event.target.closest('[data-bicycle-sort-column]');
    if (sortButton) {
      const column = sortButton.dataset.bicycleSortColumn;
      if (state.bicycleTable.sortColumn === column) {
        state.bicycleTable.sortDirection = getNextSortDirection(state.bicycleTable.sortDirection);
      } else {
        state.bicycleTable.sortColumn = column;
        state.bicycleTable.sortDirection = 'asc';
      }
      if (state.bicycleTable.sortDirection === 'default') state.bicycleTable.sortColumn = null;
      state.bicycleTable.page = 1;
      void refreshOverview({ quiet: true });
      return;
    }

    const helmetSortButton = event.target.closest('[data-helmet-sort-column]');
    if (helmetSortButton) {
      const column = helmetSortButton.dataset.helmetSortColumn;
      if (state.helmetTable.sortColumn === column) {
        state.helmetTable.sortDirection = getNextSortDirection(state.helmetTable.sortDirection);
      } else {
        state.helmetTable.sortColumn = column;
        state.helmetTable.sortDirection = 'asc';
      }
      if (state.helmetTable.sortDirection === 'default') state.helmetTable.sortColumn = null;
      state.helmetTable.page = 1;
      void refreshOverview({ quiet: true });
      return;
    }

    const reportSortButton = event.target.closest('[data-report-sort-column]');
    if (reportSortButton) {
      const column = reportSortButton.dataset.reportSortColumn;
      if (state.report.sortColumn === column) {
        state.report.sortDirection = getNextSortDirection(state.report.sortDirection);
      } else {
        state.report.sortColumn = column;
        state.report.sortDirection = 'asc';
      }
      if (state.report.sortDirection === 'default') state.report.sortColumn = null;
      state.report.historyPage = 1;
      void refreshReport({ quiet: true });
      return;
    }

    const editButton = event.target.closest('.js-edit-bicycle');
    if (editButton) {
      openEditBicycleModal(editButton.dataset.identifier);
      return;
    }

    const editHelmetButton = event.target.closest('.js-edit-helmet');
    if (editHelmetButton) {
      openEditHelmetModal(editHelmetButton.dataset.helmetId);
      return;
    }

    const rentButton = event.target.closest('.js-rent-bicycle');
    if (rentButton) {
      openRentBicycleModal(rentButton.dataset.identifier);
      return;
    }

    const returnButton = event.target.closest('.js-return-bicycle');
    if (returnButton) {
      openReturnBicycleModal(returnButton.dataset.identifier);
      return;
    }

    const deleteHelmetButton = event.target.closest('.js-delete-helmet');
    if (deleteHelmetButton) {
      if (!canDeleteHelmet()) return updateControlVisibility();
      const helmetId = deleteHelmetButton.dataset.helmetId || '';
      const row = findHelmet(helmetId);
      const confirmed = await confirmAction({
        title: 'Delete helmet',
        message: () => {
          const currentRow = findHelmet(helmetId) || row;
          return `Permanently remove helmet "${currentRow?.code || 'this helmet'}" from the selected camp. The server will block deletion if it is still assigned to an active rental.`;
        },
        confirmText: 'Delete helmet',
        variant: 'danger',
        canConfirm: canDeleteHelmet,
      });
      if (!confirmed) return;

      pageState.set('loading', 'Deleting helmet...');
      const result = await api.deleteHelmet(helmetId);
      if (!handleResult(result, 'Helmet removed successfully.')) return;
      toast.show({
        title: 'Helmet removed',
        message: result.data?.message || 'The helmet was removed successfully.',
        variant: 'success',
      });
      await refreshFleetDataAfterChange();
      return;
    }

    const deleteButton = event.target.closest('.js-delete-bicycle');
    if (!deleteButton) return;
    if (!canDelete()) return updateControlVisibility();
    const identifier = deleteButton.dataset.identifier || '';
    const row = findBicycle(identifier);
    const confirmed = await confirmAction({
      title: 'Delete bicycle',
      message: () => {
        const currentRow = findBicycle(identifier) || row;
        return `Permanently remove "${currentRow?.name || 'this bicycle'}" from the selected camp. The server will block deletion if active rental history still uses it.`;
      },
      confirmText: 'Delete bike',
      variant: 'danger',
      canConfirm: canDelete,
    });
    if (!confirmed) return;

    pageState.set('loading', 'Deleting bicycle...');
    const result = await api.deleteBicycle(identifier);
    if (!handleResult(result, 'Bicycle removed successfully.')) return;
    toast.show({
      title: 'Bicycle removed',
      message: result.data?.message || 'The bicycle was removed successfully.',
      variant: 'success',
    });
    await refreshFleetDataAfterChange();
  });

  byId('bicycle-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mode = byId('bicycle-form-mode').value;
    const creating = mode === 'create';
    if (creating && !canAdd()) return updateControlVisibility();
    if (!creating && !canEdit()) return updateControlVisibility();

    const payload = {
      name: byId('bicycle-name-input').value.trim(),
      nfcCode: byId('bicycle-nfc-input').value.trim(),
    };
    if (!creating && !byId('bicycle-assignment-fields').hidden) {
      syncEditLookupHiddenIds();
      const currentStatus = String(byId('bicycle-current-status-input').value || '').toLowerCase();
      const rawStatusInput = byId('bicycle-status-input').value.trim();
      const selectedStatus =
        normalizeEditableStatusInput(byId('bicycle-status-value-input').value) ||
        normalizeEditableStatusInput(rawStatusInput);
      const rentedAtInputValue = byId('bicycle-rent-date-input').value;
      const nextStatus = selectedStatus || currentStatus;

      if (rawStatusInput && !selectedStatus) {
        bicycleModalState.set('error', 'Choose Rented, Repair, or Long term for status.');
        return;
      }
      if (selectedStatus) payload.status = selectedStatus;
      payload.soldierId = byId('bicycle-soldier-id-input').value || '';
      payload.helmetId = byId('bicycle-helmet-id-input').value || '';
      payload.rentedAt = toIsoDateTime(rentedAtInputValue);

      if (!payload.rentedAt) {
        showMissingInformation(
          bicycleModalState,
          'Set the rental date before saving assignment changes.',
          'bicycle-rent-date-input',
        );
        return;
      }
      if (nextStatus !== 'repair' && !payload.soldierId) {
        showMissingInformation(
          bicycleModalState,
          'Select a soldier before saving assignment changes.',
          'bicycle-soldier-search-input',
        );
        return;
      }
      if (isFutureDateTime(rentedAtInputValue)) {
        bicycleModalState.set('error', 'Rental date cannot be in the future.');
        return;
      }
    }
    if (!payload.name) {
      showMissingInformation(bicycleModalState, 'Enter a bicycle name before saving.', 'bicycle-name-input');
      return;
    }
    if (!payload.nfcCode) {
      showMissingInformation(bicycleModalState, 'Enter an NFC code before saving.', 'bicycle-nfc-input');
      return;
    }

    const confirmed = await confirmAction({
      title: creating ? 'Create bicycle' : 'Save bicycle changes',
      message: () => {
        const name = byId('bicycle-name-input')?.value.trim() || payload.name;
        const nfcCode = byId('bicycle-nfc-input')?.value.trim() || payload.nfcCode;
        return creating
          ? `Create bicycle "${name}" with NFC ${nfcCode} in the selected camp.`
          : `Save the edited name, NFC code, and assignment details for "${name}".`;
      },
      confirmText: creating ? 'Create bike' : 'Save changes',
      variant: 'warning',
      canConfirm: () => (creating ? canAdd() : canEdit()),
    });
    if (!confirmed) return;

    bicycleModalState.set('loading', creating ? 'Creating bicycle...' : 'Saving bicycle...');
    const result = creating
      ? await api.addBicycle(payload)
      : await api.editBicycle({ ...payload, identifier: byId('bicycle-id-input').value });
    if (!result?.ok) {
      showRequestFailureToast(result);
      bicycleModalState.set(
        result?.pageState || 'error',
        result?.message || 'The bicycle could not be saved.',
      );
      return;
    }
    bicycleModalState.set('success', 'Bicycle saved successfully.');
    bicycleModal?.close();
    toast.show({
      title: creating ? 'Bicycle created' : 'Bicycle updated',
      message: result.data?.message || 'Bicycle saved successfully.',
      variant: 'success',
    });
    await refreshFleetDataAfterChange();
  });

  byId('helmet-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mode = byId('helmet-form-mode').value;
    const creating = mode === 'create';
    if (creating && !canAddHelmet()) return updateControlVisibility();
    if (!creating && !canEditHelmet()) return updateControlVisibility();

    const payload = {
      code: byId('helmet-code-input').value.trim(),
      nfcCode: byId('helmet-nfc-input').value.trim(),
    };
    if (!payload.code) {
      showMissingInformation(helmetModalState, 'Enter a helmet code before saving.', 'helmet-code-input');
      return;
    }
    if (!payload.nfcCode) {
      showMissingInformation(helmetModalState, 'Enter an NFC code before saving.', 'helmet-nfc-input');
      return;
    }

    const confirmed = await confirmAction({
      title: creating ? 'Create helmet' : 'Save helmet changes',
      message: () => {
        const code = byId('helmet-code-input')?.value.trim() || payload.code;
        const nfcCode = byId('helmet-nfc-input')?.value.trim() || payload.nfcCode;
        return creating
          ? `Create helmet "${code}" with NFC ${nfcCode} in the selected camp.`
          : `Save the edited code and NFC tag for helmet "${code}".`;
      },
      confirmText: creating ? 'Create helmet' : 'Save changes',
      variant: 'warning',
      canConfirm: () => (creating ? canAddHelmet() : canEditHelmet()),
    });
    if (!confirmed) return;

    helmetModalState.set('loading', creating ? 'Creating helmet...' : 'Saving helmet...');
    const result = creating
      ? await api.addHelmet(payload)
      : await api.editHelmet({ ...payload, helmetId: byId('helmet-id-input').value });
    if (!result?.ok) {
      showRequestFailureToast(result);
      helmetModalState.set(
        result?.pageState || 'error',
        result?.message || 'The helmet could not be saved.',
      );
      return;
    }
    helmetModalState.set('success', 'Helmet saved successfully.');
    helmetModal?.close();
    toast.show({
      title: creating ? 'Helmet created' : 'Helmet updated',
      message: result.data?.message || 'Helmet saved successfully.',
      variant: 'success',
    });
    await refreshFleetDataAfterChange();
  });

  byId('rent-bicycle-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canRentReturn()) return updateControlVisibility();
    setDateInputMax('rent-date-input');
    syncLookupHiddenIds();
    const repair = byId('rent-repair-input').checked;
    const rentedAtInputValue = byId('rent-date-input').value;
    const payload = {
      identifier: byId('rent-bicycle-id-input').value,
      soldierId: repair ? '' : byId('rent-soldier-id-input').value,
      helmetId: repair ? '' : byId('rent-helmet-id-input').value || '',
      rentedAt: toIsoDateTime(rentedAtInputValue),
      repair,
      longTerm: !repair && byId('rent-long-term-input').checked,
    };
    if (!payload.identifier || !payload.rentedAt || (!payload.repair && !payload.soldierId)) {
      showMissingInformation(
        rentModalState,
        'Select a soldier and rental date before renting.',
        !payload.rentedAt ? 'rent-date-input' : 'rent-soldier-search-input',
      );
      syncRepairModeControls();
      return;
    }
    if (isFutureDateTime(rentedAtInputValue)) {
      rentModalState.set('error', 'Rental date cannot be in the future.');
      syncRepairModeControls();
      return;
    }
    const confirmed = await confirmAction({
      title: payload.repair ? 'Mark bicycle for repair' : 'Rent bicycle',
      message: () => {
        const bike = findBicycle(payload.identifier);
        const name = bike?.name || byId('rent-bicycle-name-input').value || 'this bicycle';
        return payload.repair
          ? `Move "${name}" to Repair so it is unavailable for rental.`
          : `Rent "${name}" to the selected soldier with the selected rental details.`;
      },
      confirmText: payload.repair ? 'Mark repair' : 'Rent bike',
      variant: 'warning',
      canConfirm: canRentReturn,
    });
    if (!confirmed) return;

    rentModalState.set(
      'loading',
      payload.repair ? 'Marking bicycle for repair...' : 'Renting bicycle...',
    );
    const result = await api.rentBicycle(payload);
    if (!result?.ok) {
      showRequestFailureToast(result);
      rentModalState.set(
        result?.pageState || 'error',
        result?.message || 'The bicycle could not be rented.',
      );
      syncRepairModeControls();
      return;
    }
    rentModalState.set(
      'success',
      payload.repair ? 'Bicycle marked for repair.' : 'Bicycle rented successfully.',
    );
    rentModal?.close();
    toast.show({
      title: payload.repair ? 'Bicycle marked for repair' : 'Bicycle rented',
      message:
        result.data?.message ||
        (payload.repair ? 'Bicycle marked for repair.' : 'Bicycle rented successfully.'),
      variant: 'success',
    });
    await refreshFleetDataAfterChange();
  });

  byId('return-bicycle-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canRentReturn()) return updateControlVisibility();
    const payload = {
      identifier: byId('return-bicycle-id-input').value,
      returnedAt: toIsoDateTime(byId('return-date-input').value),
    };
    if (!payload.identifier || !payload.returnedAt) {
      showMissingInformation(
        returnModalState,
        'Set the return date before returning the bike.',
        'return-date-input',
      );
      return;
    }
    const confirmed = await confirmAction({
      title: 'Return bicycle',
      message: () => {
        const bike = findBicycle(payload.identifier);
        return `Complete the rental for "${bike?.name || byId('return-bike-name-text').textContent || 'this bicycle'}" using the selected return time and make the bicycle available again.`;
      },
      confirmText: 'Return bike',
      variant: 'warning',
      canConfirm: canRentReturn,
    });
    if (!confirmed) return;

    returnModalState.set('loading', 'Returning bicycle...');
    const result = await api.returnBicycle(payload);
    if (!result?.ok) {
      showRequestFailureToast(result);
      returnModalState.set(
        result?.pageState || 'error',
        result?.message || 'The bicycle could not be returned.',
      );
      return;
    }
    returnModalState.set('success', 'Bicycle returned successfully.');
    returnModal?.close();
    toast.show({
      title: 'Bicycle returned',
      message: result.data?.message || 'Bicycle returned successfully.',
      variant: 'success',
    });
    await refreshFleetDataAfterChange();
  });

  byId('bicycle-report-filter-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.report.dailyPage = 1;
    state.report.historyPage = 1;
    await refreshReport();
  });

  byId('bicycle-report-from-date-input')?.addEventListener('change', () => {
    void handleReportDateFilterChange();
  });

  byId('bicycle-report-to-date-input')?.addEventListener('change', () => {
    void handleReportDateFilterChange();
  });

  byId('reset-bicycle-report-button')?.addEventListener('click', () => {
    resetReportTableState();
    resetReportDateFiltersToDefault();
    void refreshReport({ quiet: true });
  });

  document.querySelectorAll('[name="reportAssetType"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.report.assetType = getCurrentReportAssetType();
      state.report.assetId = '';
      state.report.assetRows = [];
      byId('report-asset-id-input').value = '';
      const searchInput = byId('report-asset-search-input');
      if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder =
          state.report.assetType === 'helmet' ? 'Search helmet' : 'Search bike';
      }
      reportAssetLookup.clear();
      renderReportAssetHistory();
      void loadReportAssetOptions('', { open: false });
    });
  });

  document.addEventListener(
    'input',
    debounce((event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.dataset.bicycleFilterColumn) {
        state.bicycleTable.filters[input.dataset.bicycleFilterColumn] = input.value;
        state.bicycleTable.page = 1;
        void refreshOverview({ quiet: true });
        return;
      }
      if (input.dataset.helmetFilterColumn) {
        state.helmetTable.filters[input.dataset.helmetFilterColumn] = input.value;
        state.helmetTable.page = 1;
        void refreshOverview({ quiet: true });
        return;
      }
      if (input.dataset.reportFilterColumn) {
        state.report.filters[input.dataset.reportFilterColumn] = input.value;
        state.report.historyPage = 1;
        void refreshReport({ quiet: true });
        return;
      }
      if (input.id === 'report-asset-search-input') {
        state.report.assetId = '';
        state.report.assetRows = [];
        renderReportAssetHistory();
        return;
      }
      if (input.id === 'report-soldier-search-input') {
        state.report.soldierId = '';
        state.report.soldierRows = [];
        renderReportSoldierActiveRows();
      }
    }, 150),
  );

  byId('bikes-prev-button')?.addEventListener('click', () => {
    if (state.bicycleTable.page <= 1) return;
    state.bicycleTable.page -= 1;
    void refreshOverview({ quiet: true });
  });

  byId('bikes-next-button')?.addEventListener('click', () => {
    if (state.bicycleTable.page >= state.bicycleTable.totalPages) return;
    state.bicycleTable.page += 1;
    void refreshOverview({ quiet: true });
  });

  byId('helmets-prev-button')?.addEventListener('click', () => {
    if (state.helmetTable.page <= 1) return;
    state.helmetTable.page -= 1;
    void refreshOverview({ quiet: true });
  });

  byId('helmets-next-button')?.addEventListener('click', () => {
    if (state.helmetTable.page >= state.helmetTable.totalPages) return;
    state.helmetTable.page += 1;
    void refreshOverview({ quiet: true });
  });

  byId('report-daily-prev-button')?.addEventListener('click', () => {
    if (state.report.dailyPage <= 1) return;
    state.report.dailyPage -= 1;
    void refreshReport({ quiet: true });
  });

  byId('report-daily-next-button')?.addEventListener('click', () => {
    if (state.report.dailyPage >= state.report.dailyTotalPages) return;
    state.report.dailyPage += 1;
    void refreshReport({ quiet: true });
  });

  byId('report-history-prev-button')?.addEventListener('click', () => {
    if (state.report.historyPage <= 1) return;
    state.report.historyPage -= 1;
    void refreshReport({ quiet: true });
  });

  byId('report-history-next-button')?.addEventListener('click', () => {
    if (state.report.historyPage >= state.report.historyTotalPages) return;
    state.report.historyPage += 1;
    void refreshReport({ quiet: true });
  });

  byId('rent-repair-input')?.addEventListener('change', () => {
    syncRepairModeControls();
  });

  byId('bicycle-status-input')?.addEventListener('input', () => {
    syncBicycleAssignmentEditControls();
  });

  byId('bicycle-template-file-input')?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0] || null;
    if (!file) {
      resetImportProgress();
      return;
    }
    state.import.fileName = file.name;
    state.import.visible = false;
    state.import.uploadPercent = 0;
    state.import.processingPercent = 0;
    state.import.statusMessage = 'Template selected and ready to upload.';
    state.import.summary = null;
    state.import.errors = [];
    renderImportProgress();
  });

  byId('helmet-template-file-input')?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0] || null;
    if (!file) {
      resetHelmetImportProgress();
      return;
    }
    state.helmetImport.fileName = file.name;
    state.helmetImport.visible = false;
    state.helmetImport.uploadPercent = 0;
    state.helmetImport.processingPercent = 0;
    state.helmetImport.statusMessage = 'Template selected and ready to upload.';
    state.helmetImport.summary = null;
    state.helmetImport.errors = [];
    renderHelmetImportProgress();
  });
  byId('download-bike-mobile-app-button')?.addEventListener('click', (event) => {
    if (!canDownloadBikeMobileApp()) {
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
    renderRows();
    renderHelmetRows();
    updateControlVisibility();
    if (state.activeTab === 'report' && !state.report.loaded && !state.report.isBusy) {
      void refreshReport();
    }
  });

  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const accessRefresh = createWorkspacePermissionAccessRefresh({ socket, pageData });
  accessRefresh.bind();
  const roomManager = socket ? createSocketRoomManager(socket) : null;
  bindUpcomingAccommodationToasts({ toast, pageData });

  async function subscribeBicycleRoom() {
    if (!roomManager || !hasPermission(PERMISSIONS.section)) return;
    await roomManager.subscribe(['ui:bicycle:list']);
  }

  function isCurrentCampRealtimePayload(payload = {}) {
    const changedCampId = String(payload?.campId || '');
    const currentCampId = String(pageData.campId || '');
    return !changedCampId || !currentCampId || changedCampId === currentCampId;
  }

  if (socket) {
    socket.on('connect', () => {
      void subscribeBicycleRoom();
    });
    ['bicycle:add', 'bicycle:updated', 'bicycle:deleted'].forEach(
      (eventName) =>
        socket.on(eventName, () => {
          void refreshFleetDataAfterChange();
        }),
    );
    socket.on('bicycle:status:changed', (payload = {}) => {
      if (!isCurrentCampRealtimePayload(payload)) return;
      notifyLateBikeFromPayload(payload);
      void refreshFleetDataAfterChange();
    });
    ['soldier:changed', 'soldier:record:changed'].forEach((eventName) => {
      socket.on(eventName, (payload = {}) => {
        if (!isCurrentCampRealtimePayload(payload)) return;
        void refreshFleetDataAfterChange();
      });
    });
    socket.on('bicycle:import:progress', (payload = {}) => {
      if (payload.resource === 'helmets') {
        applyHelmetImportPayload({
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
        return;
      }
      applyImportPayload({
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
  }

  window.addEventListener('pagehide', () => {
    if (!roomManager) return;
    void roomManager.unsubscribe(['ui:bicycle:list']);
    roomManager.clear();
  });

  accessRefresh.refreshNavigation().then((permissionNames) => {
    state.permissions = new Set(permissionNames || []);
    renderRows();
    renderHelmetRows();
    updateControlVisibility();
    if (state.activeTab === 'report' && !state.report.loaded && !state.report.isBusy) {
      void refreshReport();
    }
    void subscribeBicycleRoom();
  });
  initializeReportFilterDefaults();
  renderReport();
  renderReportAssetHistory();
  renderReportSoldierActiveRows();
  setActiveTab('overview');
  renderImportProgress();
  renderHelmetImportProgress();
  void refreshOverview();
});
