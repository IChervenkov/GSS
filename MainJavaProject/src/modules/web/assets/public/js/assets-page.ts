// @ts-nocheck
import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import { byId, debounce, qsa, setProgressValue } from '/assets/shared/js/core/dom.ts';
import { confirmAction, initConfirmModal } from '/assets/shared/js/core/confirm.ts';
import { readPageData } from '/assets/shared/js/core/page-data.ts';
import { PAGE_STATES } from '/assets/shared/js/core/app-errors.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import {
  bindForcedSignOut,
  createSocketRoomManager,
} from '/assets/shared/js/core/socket-client.ts';
import { createModalController } from '/assets/shared/js/ui/modal.ts';
import { createWorkspacePermissionAccessRefresh } from '/assets/shared/js/workspace/permission-access.ts';
import {
  bindLateBicycleToast,
  bindUpcomingAccommodationToasts,
  createToastManager,
  initWorkspacePage,
  syncTabPanels,
} from '/assets/shared/js/workspace/page-shell.ts';
import { createAssetsPageApi } from './assets-page.api.ts';

const PERMISSIONS = Object.freeze({
  full: 'Full permission',
  section: 'Asset management',
  legacySection: 'Assets',
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

const TABLE_KEYS = Object.freeze([
  'allAssets',
  'inventoryStatusRows',
  'inventoryEvents',
  'assetTypes',
  'cleanItems',
]);

const TABLE_COLUMNS = Object.freeze({
  allAssets: [
    'id',
    'code',
    'rfidCode',
    'name',
    'typeName',
    'location',
    'status',
    'inventoryStatus',
    'lastInventoryDate',
    'owner',
    'category',
    'service',
    'expandable',
    'isFixedLabel',
    'isQuantitativeLabel',
    'description',
    'mrah',
    'comments',
    'replacedOff',
    'replacedBy',
    'purchaseDate',
    'writtenOffDate',
    'createdAt',
    'updatedAt',
    'm2Inside',
    'yearOfLifeCycle',
    'restOfLifeCycle',
    'restValue',
    'purchasePrice',
    'quantity',
    'actions',
  ],
  inventoryStatusRows: ['status', 'lastInventoryDate', 'assetCount', 'quantity'],
  inventoryEvents: [
    'changedAt',
    'addedQuantity',
    'removedQuantity',
    'lostQuantity',
    'modifiedQuantity',
  ],
  assetTypes: ['id', 'name', 'assetCount', 'notFoundCount', 'completedCount', 'actions'],
  cleanItems: [
    'id',
    'itemName',
    'totalAmount',
    'countGetItem',
    'availableAmount',
    'actions',
  ],
});

const TABLE_EMPTY_TEXT = Object.freeze({
  allAssets: 'No assets found for the selected camp.',
  inventoryStatusRows: 'No inventory statuses match the current table state.',
  inventoryEvents: 'No inventory activity has been recorded yet.',
  assetTypes: 'No asset types are currently configured.',
  cleanItems: 'No clean items are currently configured.',
});

const ASSET_STATUS_OPTIONS = Object.freeze([
  { id: 'Excellent', label: 'Excellent' },
  { id: 'Good', label: 'Good' },
  { id: 'Fair', label: 'Fair' },
  { id: 'Poor', label: 'Poor' },
  { id: 'Unacceptable', label: 'Unacceptable' },
]);

const INVENTORY_STATUS_OPTIONS = Object.freeze([
  { id: 'undiscovered', label: 'Not found' },
  { id: 'completed', label: 'Completed' },
  { id: 'written_off', label: 'Written off' },
]);

const EXPANDABLE_OPTIONS = Object.freeze([
  { id: 'Non Expandable', label: 'Non Expandable' },
  { id: 'Expandable', label: 'Expandable' },
]);
const WAREHOUSE_LABELS = Object.freeze({
  large: 'Large warehouse',
  small: 'Small warehouse',
});
const WAREHOUSE_OPTIONS = Object.freeze(
  Object.entries(WAREHOUSE_LABELS).map(([id, label]) => ({ id, label })),
);
const BED_ASSET_TYPE_NAME = 'Bed';
const BULK_IMPORT_CONFIGS = Object.freeze({
  assets: {
    fileInputId: 'asset-template-file-input',
    selectedFileId: 'asset-template-selected-file',
    progressPanelId: 'asset-import-progress-panel',
    uploadLabelId: 'asset-import-upload-label',
    processingLabelId: 'asset-import-processing-label',
    uploadBarId: 'asset-import-upload-progress-bar',
    processingBarId: 'asset-import-processing-progress-bar',
    statusMessageId: 'asset-import-status-message',
    summaryId: 'asset-import-summary',
    errorsId: 'asset-import-errors',
    uploadButtonId: 'upload-asset-template-button',
    emptyStatus: 'Download the template to begin.',
    selectedStatus: 'Template selected and ready to upload.',
    requiredMessage: 'Choose a completed asset template before uploading.',
    requestErrorMessage: 'The asset template request could not be completed.',
    failureMessage: 'The asset template could not be processed.',
    successMessage: 'Asset template processed successfully.',
  },
  assetTypes: {
    fileInputId: 'asset-type-template-file-input',
    selectedFileId: 'asset-type-template-selected-file',
    progressPanelId: 'asset-type-import-progress-panel',
    uploadLabelId: 'asset-type-import-upload-label',
    processingLabelId: 'asset-type-import-processing-label',
    uploadBarId: 'asset-type-import-upload-progress-bar',
    processingBarId: 'asset-type-import-processing-progress-bar',
    statusMessageId: 'asset-type-import-status-message',
    summaryId: 'asset-type-import-summary',
    errorsId: 'asset-type-import-errors',
    uploadButtonId: 'upload-asset-type-template-button',
    emptyStatus: 'Download the template to begin.',
    selectedStatus: 'Template selected and ready to upload.',
    requiredMessage: 'Choose a completed asset type template before uploading.',
    requestErrorMessage: 'The asset type template request could not be completed.',
    failureMessage: 'The asset type template could not be processed.',
    successMessage: 'Asset type template processed successfully.',
  },
  cleanItems: {
    fileInputId: 'clean-item-template-file-input',
    selectedFileId: 'clean-item-template-selected-file',
    progressPanelId: 'clean-item-import-progress-panel',
    uploadLabelId: 'clean-item-import-upload-label',
    processingLabelId: 'clean-item-import-processing-label',
    uploadBarId: 'clean-item-import-upload-progress-bar',
    processingBarId: 'clean-item-import-processing-progress-bar',
    statusMessageId: 'clean-item-import-status-message',
    summaryId: 'clean-item-import-summary',
    errorsId: 'clean-item-import-errors',
    uploadButtonId: 'upload-clean-item-template-button',
    emptyStatus: 'Download the template to begin.',
    selectedStatus: 'Template selected and ready to upload.',
    requiredMessage: 'Choose a completed clean item template before uploading.',
    requestErrorMessage: 'The clean item template request could not be completed.',
    failureMessage: 'The clean item template could not be processed.',
    successMessage: 'Clean item template processed successfully.',
  },
});

function createImportState(emptyStatus = 'Download the template to begin.') {
  return {
    fileName: '',
    uploadPercent: 0,
    processingPercent: 0,
    statusMessage: emptyStatus,
    summary: null,
    errors: [],
    isBusy: false,
    visible: false,
  };
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
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function nextSortDirection(currentDirection = 'default') {
  if (currentDirection === 'default') return 'asc';
  if (currentDirection === 'asc') return 'desc';
  return 'default';
}

function createInitialTables() {
  return TABLE_KEYS.reduce((tables, key) => {
    tables[key] = {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      sourceTotal: 0,
      filters: {},
      sortColumn: null,
      sortDirection: 'default',
    };
    return tables;
  }, {});
}

function normalizeText(value, fallback = 'No information') {
  const text = String(value || '').trim();
  return text || fallback;
}

function emptyIfPlaceholder(value) {
  const text = String(value || '').trim();
  return text === 'No information' || text === 'Not recorded' ? '' : text;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function toDatetimeLocalInputValue(value) {
  const text = emptyIfPlaceholder(value);
  if (!text) return '';
  const localMatch = text.match(
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?)?/i,
  );
  if (localMatch) {
    let hour = Number(localMatch[2] || 0);
    const minute = localMatch[3] || '00';
    const meridiem = (localMatch[4] || '').toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return `${localMatch[1]}T${padDatePart(hour)}:${minute}`;
  }
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return '';
  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`,
  ].join('T');
}

function statusBadge(status, label) {
  return `<span class="table-badge" data-assets-status="${escapeAttr(status)}">${escapeHtml(label)}</span>`;
}

bootstrapPage(() => {
  const pageData = readPageData();
  const csrfToken = byId('csrf-token')?.value || '';
  const api = createAssetsPageApi({ csrfToken });
  const loadScope = createRequestScope();
  const toast = createToastManager(byId('toast-stack'));
  const state = {
    activeTab: 'overview',
    permissions: new Set(Array.isArray(pageData.permissionNames) ? pageData.permissionNames : []),
    rowsById: new Map(),
    assetTypesById: new Map(),
    cleanItemsById: new Map(),
    cleanItemsWarehouse: 'large',
    lookups: {
      assetTypes: [],
      rooms: [],
      keys: [],
      assets: [],
    },
    lookupMaps: {
      assetTypes: new Map(),
      rooms: new Map(),
      keys: new Map(),
      assets: new Map(),
      statuses: new Map(),
      inventoryStatuses: new Map(),
      expandable: new Map(),
      replacedOffAssets: new Map(),
      replacedByAssets: new Map(),
      warehouses: new Map(),
    },
    tables: createInitialTables(),
    imports: {
      assets: createImportState(BULK_IMPORT_CONFIGS.assets.emptyStatus),
      assetTypes: createImportState(BULK_IMPORT_CONFIGS.assetTypes.emptyStatus),
      cleanItems: createImportState(BULK_IMPORT_CONFIGS.cleanItems.emptyStatus),
    },
  };

  const pageState = createPageStateController({
    root: byId('main-content'),
    disableTargets: [
      ...qsa('[data-refresh-assets]'),
      ...qsa('[data-assets-prev-table]'),
      ...qsa('[data-assets-next-table]'),
      ...qsa('[data-assets-sort-table]'),
      byId('restart-inventory-button'),
    ],
  });

  const tabButtons = qsa('[data-tab-trigger]');
  const tabPanels = qsa('[data-tab-panel]');
  const assetModal = createModalController({
    root: byId('asset-modal'),
    dialog: byId('asset-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const assetBulkModal = createModalController({
    root: byId('asset-bulk-modal'),
    dialog: byId('asset-bulk-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => clearBulkImportModal('assets'),
  });
  const assetTypeModal = createModalController({
    root: byId('asset-type-modal'),
    dialog: byId('asset-type-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const assetTypeBulkModal = createModalController({
    root: byId('asset-type-bulk-modal'),
    dialog: byId('asset-type-bulk-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => clearBulkImportModal('assetTypes'),
  });
  const cleanItemModal = createModalController({
    root: byId('clean-item-modal'),
    dialog: byId('clean-item-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const cleanItemMoveModal = createModalController({
    root: byId('clean-item-move-modal'),
    dialog: byId('clean-item-move-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
  });
  const cleanItemBulkModal = createModalController({
    root: byId('clean-item-bulk-modal'),
    dialog: byId('clean-item-bulk-modal')?.querySelector('.workspace-modal__dialog'),
    closeSelectors: ['[data-close-modal="true"]'],
    onAfterClose: () => clearBulkImportModal('cleanItems'),
  });
  const assetModalState = createPageStateController({
    root: byId('asset-modal'),
    disableTargets: [
      byId('save-asset-button'),
      byId('asset-code-input'),
      byId('asset-rfid-input'),
      byId('asset-name-input'),
      byId('asset-type-search-input'),
      byId('asset-room-search-input'),
      byId('asset-key-search-input'),
      byId('asset-quantity-input'),
      byId('asset-status-input'),
      byId('asset-inventory-status-search-input'),
      byId('asset-expandable-search-input'),
      byId('asset-quantitative-input'),
      byId('asset-mrah-input'),
      byId('asset-m2-inside-input'),
      byId('asset-purchase-date-input'),
      byId('asset-purchase-price-input'),
      byId('asset-replaced-off-search-input'),
      byId('asset-replaced-by-search-input'),
      byId('asset-year-life-cycle-input'),
      byId('asset-rest-life-cycle-input'),
      byId('asset-rest-value-input'),
      byId('asset-comments-input'),
    ],
  });
  const assetBulkState = createPageStateController({
    root: byId('asset-bulk-modal'),
    disableTargets: [
      byId('asset-bulk-payload-input'),
      byId('run-asset-bulk-button'),
      byId('upload-asset-template-button'),
      byId('asset-template-file-input'),
    ],
  });
  const assetTypeModalState = createPageStateController({
    root: byId('asset-type-modal'),
    disableTargets: [byId('save-asset-type-button'), byId('asset-type-name-input')],
  });
  const assetTypeBulkState = createPageStateController({
    root: byId('asset-type-bulk-modal'),
    disableTargets: [byId('asset-type-bulk-payload-input'), byId('run-asset-type-bulk-button')],
  });
  const cleanItemModalState = createPageStateController({
    root: byId('clean-item-modal'),
    disableTargets: [
      byId('save-clean-item-button'),
      byId('clean-item-name-input'),
      byId('clean-item-total-input'),
    ],
  });
  const cleanItemMoveState = createPageStateController({
    root: byId('clean-item-move-modal'),
    disableTargets: [byId('move-clean-item-button'), byId('clean-item-move-quantity-input')],
  });
  const cleanItemBulkState = createPageStateController({
    root: byId('clean-item-bulk-modal'),
    disableTargets: [byId('clean-item-bulk-payload-input'), byId('run-clean-item-bulk-button')],
  });

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

  function hasPermission(permissionName) {
    return state.permissions.has(PERMISSIONS.full) || state.permissions.has(permissionName);
  }

  function resultMessage(result, fallback) {
    return result?.message || fallback;
  }

  function isPermissionDeniedResult(result) {
    return (
      Number(result?.status) === 403 ||
      result?.pageState === PAGE_STATES.UNAUTHORIZED ||
      result?.pageState === PAGE_STATES.PERMISSION_REVOKED
    );
  }

  function stateForResult(result) {
    return isPermissionDeniedResult(result)
      ? PAGE_STATES.PERMISSION_REVOKED
      : result?.pageState || PAGE_STATES.ERROR;
  }

  async function refreshPermissionsAfterDeniedResult(result) {
    if (!isPermissionDeniedResult(result)) return false;
    const permissionNames = await accessRefresh.refreshNavigation();
    if (permissionNames) state.permissions = new Set(permissionNames);
    updateControlVisibility();
    return true;
  }

  async function handleRequestFailure({
    result,
    fallbackTitle = 'Assets request failed',
    fallbackMessage = 'The assets request could not be completed.',
    stateControllers = [pageState],
    focusId,
  } = {}) {
    const message = resultMessage(result, fallbackMessage);
    const permissionDenied = isPermissionDeniedResult(result);
    if (permissionDenied) {
      try {
        await refreshPermissionsAfterDeniedResult(result);
      } catch {
        updateControlVisibility();
      }
    }
    stateControllers.forEach((controller) => controller?.set(stateForResult(result), message));
    showRequestFailureToast(result, fallbackTitle, fallbackMessage);
    const field = focusId ? byId(focusId) : null;
    if (field && typeof field.focus === 'function') field.focus();
  }

  function showRequestFailureToast(
    result,
    fallbackTitle = 'Assets request failed',
    fallbackMessage = 'The assets request could not be completed.',
  ) {
    toast.show({
      title: isPermissionDeniedResult(result) ? 'Assets request failed' : fallbackTitle,
      message: resultMessage(result, fallbackMessage),
      variant: 'danger',
    });
  }

  const canAddAsset = () => hasPermission(PERMISSIONS.addAsset);
  const canEditAsset = () => hasPermission(PERMISSIONS.editAsset);
  const canDeleteAsset = () => hasPermission(PERMISSIONS.deleteAsset);
  const canSaveInventory = () => hasPermission(PERMISSIONS.saveInventory);
  const canBulkAssets = () => canAddAsset() || canEditAsset();
  const canAddAssetType = () => hasPermission(PERMISSIONS.addAssetType);
  const canEditAssetType = () => hasPermission(PERMISSIONS.editAssetType);
  const canDeleteAssetType = () => hasPermission(PERMISSIONS.deleteAssetType);
  const canBulkAssetTypes = () => canAddAssetType() || canEditAssetType();
  const canAddCleanItem = () => hasPermission(PERMISSIONS.addCleanItem);
  const canEditCleanItem = () => hasPermission(PERMISSIONS.editCleanItem);
  const canMoveCleanItem = () => hasPermission(PERMISSIONS.moveCleanItem);
  const canDeleteCleanItem = () => hasPermission(PERMISSIONS.deleteCleanItem);
  const canBulkCleanItems = () => canAddCleanItem() || canEditCleanItem();
  const canDownloadAssetsMobileApp = () => hasPermission(PERMISSIONS.downloadAssetsApp);

  function canBulkImportKey(key) {
    if (key === 'assetTypes') return canBulkAssetTypes();
    if (key === 'cleanItems') return canBulkCleanItems();
    return canBulkAssets();
  }

  function canUseAssetFormMode() {
    return byId('asset-form-mode')?.value === 'edit' ? canEditAsset() : canAddAsset();
  }

  function canUseAssetTypeFormMode() {
    return byId('asset-type-form-mode')?.value === 'edit' ? canEditAssetType() : canAddAssetType();
  }

  function canUseCleanItemFormMode() {
    return byId('clean-item-form-mode')?.value === 'edit' ? canEditCleanItem() : canAddCleanItem();
  }

  function syncTemplateDownloadLink(id, allowed, enabledTitle, disabledTitle) {
    const link = byId(id);
    if (!link) return;
    setDisabled(link, !allowed);
    link.setAttribute('title', allowed ? enabledTitle : disabledTitle);
  }

  function updateControlVisibility() {
    setDisabledById('open-add-asset-modal', !canAddAsset());
    setDisabledById('open-asset-bulk-modal', !canBulkAssets());
    setDisabledById('restart-inventory-button', !canSaveInventory());
    setDisabledById('download-assets-mobile-app-button', !canDownloadAssetsMobileApp());
    byId('download-assets-mobile-app-button')?.setAttribute(
      'title',
      canDownloadAssetsMobileApp()
        ? 'Download the assets mobile app.'
        : 'You do not have permission to download the assets mobile app.',
    );

    setDisabledById('asset-template-file-input', !canBulkAssets());
    setDisabledById('upload-asset-template-button', !canBulkAssets() || state.imports.assets.isBusy);
    syncTemplateDownloadLink(
      'download-asset-template-button',
      canBulkAssets(),
      'Download the asset template.',
      'You do not have permission to download asset templates.',
    );

    setDisabledById('run-asset-bulk-button', !canBulkAssets());
    setDisabledById('asset-bulk-payload-input', !canBulkAssets());
    setDisabledById('asset-type-template-file-input', !canBulkAssetTypes());
    setDisabledById(
      'upload-asset-type-template-button',
      !canBulkAssetTypes() || state.imports.assetTypes.isBusy,
    );
    syncTemplateDownloadLink(
      'download-asset-type-template-button',
      canBulkAssetTypes(),
      'Download the asset type template.',
      'You do not have permission to download asset type templates.',
    );
    setDisabledById('run-asset-type-bulk-button', !canBulkAssetTypes());
    setDisabledById('asset-type-bulk-payload-input', !canBulkAssetTypes());

    setDisabledById('clean-item-template-file-input', !canBulkCleanItems());
    setDisabledById(
      'upload-clean-item-template-button',
      !canBulkCleanItems() || state.imports.cleanItems.isBusy,
    );
    syncTemplateDownloadLink(
      'download-clean-item-template-button',
      canBulkCleanItems(),
      'Download the clean item template.',
      'You do not have permission to download clean item templates.',
    );
    setDisabledById('run-clean-item-bulk-button', !canBulkCleanItems());
    setDisabledById('clean-item-bulk-payload-input', !canBulkCleanItems());

    setDisabledById('open-add-clean-item-modal', !canAddCleanItem());
    setDisabledById('open-clean-item-bulk-modal', !canBulkCleanItems());
    qsa('[data-open-add-asset-type-modal]').forEach((button) =>
      setDisabled(button, !canAddAssetType()),
    );
    qsa('[data-open-asset-type-bulk-modal]').forEach((button) =>
      setDisabled(button, !canBulkAssetTypes()),
    );

    qsa('.js-edit-asset').forEach((button) => {
      setDisabled(button, !canEditAsset());
      button.title = canEditAsset()
        ? 'Edit this asset.'
        : 'You do not have permission to edit assets.';
    });
    qsa('.js-delete-asset').forEach((button) => {
      setDisabled(button, !canDeleteAsset());
      button.title = canDeleteAsset()
        ? 'Delete this asset.'
        : 'You do not have permission to remove assets.';
    });
    qsa('.js-edit-asset-type').forEach((button) => {
      const protectedType = button.getAttribute('data-protected') === 'true';
      setDisabled(button, !canEditAssetType() || protectedType);
      button.title = !canEditAssetType()
        ? 'You do not have permission to edit asset types.'
        : protectedType
          ? 'This asset type is protected.'
          : 'Edit this asset type.';
    });
    qsa('.js-delete-asset-type').forEach((button) => {
      const isBedType = button.getAttribute('data-is-bed') === 'true';
      setDisabled(button, !canDeleteAssetType() || isBedType);
      if (!canDeleteAssetType()) {
        button.title = 'You do not have permission to remove asset types.';
      } else if (isBedType) {
        button.title = 'The Bed asset type is protected.';
      } else {
        button.title = 'Delete this asset type.';
      }
    });
    qsa('.js-edit-clean-item').forEach((button) => {
      setDisabled(button, !canEditCleanItem());
      button.title = canEditCleanItem()
        ? 'Edit this clean item.'
        : 'You do not have permission to edit clean items.';
    });
    qsa('.js-move-clean-item').forEach((button) => {
      setDisabled(button, !canMoveCleanItem());
      button.title = canMoveCleanItem()
        ? 'Move this clean item.'
        : 'You do not have permission to move clean items.';
    });
    qsa('.js-delete-clean-item').forEach((button) => {
      setDisabled(button, !canDeleteCleanItem());
      button.title = canDeleteCleanItem()
        ? 'Delete this clean item.'
        : 'You do not have permission to remove clean items.';
    });

    const canUseAssetForm = canUseAssetFormMode();
    setFormDisabled('asset-form', !canUseAssetForm);
    if (canUseAssetForm) {
      syncAssetQuantityMode({
        creating: byId('asset-form-mode')?.value !== 'edit',
        isQuantitative: Boolean(byId('asset-quantitative-input')?.checked),
      });
      syncAssetKeyAvailability();
    }
    setFormDisabled('asset-type-form', !canUseAssetTypeFormMode());
    setFormDisabled('clean-item-form', !canUseCleanItemFormMode());
    setFormDisabled('clean-item-move-form', !canMoveCleanItem());
    renderImportProgress('assets');
    renderImportProgress('assetTypes');
    renderImportProgress('cleanItems');
  }

  function setActiveTab(nextTab) {
    state.activeTab =
      nextTab && tabPanels.some((panel) => panel.dataset.tabPanel === nextTab)
        ? nextTab
        : state.activeTab;
    syncTabPanels({ activeTab: state.activeTab, tabButtons, tabPanels });
  }

  function createLookupCombobox({
    inputId,
    hiddenInputId,
    listboxId,
    targetMap,
    emptyText,
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
    const lookupState = { options: [], activeIndex: -1, selectedId: '', selectedLabel: '' };

    if (!input || !hiddenInput || !listbox || !root) {
      return {
        close() {},
        clear() {},
        getSelectedId() {
          return '';
        },
        renderOptions() {},
        setValue() {},
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

    function renderStatus(message, { open = true } = {}) {
      lookupState.options = [];
      listbox.innerHTML = `
        <div class="lookup-option lookup-option--status" role="option" aria-disabled="true">
          <span class="lookup-option__title">${escapeHtml(message)}</span>
        </div>
      `;
      setOpen(open);
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
        renderStatus(emptyText || 'No matches found.', { open });
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
      hiddenInput.dataset.selectedLookupId = option.id;
      lookupState.selectedId = option.id;
      lookupState.selectedLabel = option.label;
      setOpen(false);
      onSelect(option);
      input.focus();
    }

    function syncHiddenId() {
      const matchedId = targetMap.get(input.value);
      if (matchedId) {
        hiddenInput.value = matchedId;
        hiddenInput.dataset.selectedLookupId = matchedId;
        lookupState.selectedId = matchedId;
        lookupState.selectedLabel = input.value;
        return;
      }
      if (!input.value) {
        hiddenInput.value = '';
        hiddenInput.dataset.selectedLookupId = '';
        lookupState.selectedId = '';
        lookupState.selectedLabel = '';
      }
    }

    const debouncedSearch = debounce(() => {
      if (typeof onSearch === 'function') onSearch(input.value.trim());
    }, 180);

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
      hiddenInput.dataset.selectedLookupId = '';
      lookupState.selectedId = '';
      lookupState.selectedLabel = '';
      debouncedSearch();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
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
        setOpen(true);
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
      close: () => setOpen(false),
      clear() {
        input.value = '';
        hiddenInput.value = '';
        hiddenInput.dataset.selectedLookupId = '';
        lookupState.selectedId = '';
        lookupState.selectedLabel = '';
        targetMap.clear();
        lookupState.options = [];
        listbox.innerHTML = '';
        setOpen(false);
      },
      getSelectedId() {
        return lookupState.selectedId || hiddenInput.dataset.selectedLookupId || hiddenInput.value || '';
      },
      renderOptions,
      setValue({ id = '', label = '' } = {}) {
        hiddenInput.value = id || '';
        hiddenInput.dataset.selectedLookupId = id || '';
        input.value = label || '';
        lookupState.selectedId = id || '';
        lookupState.selectedLabel = label || '';
        if (label && id) targetMap.set(label, id);
      },
      syncHiddenId,
    };
  }

  function filterLookupRows(rows = [], search = '', { labelKey = 'label' } = {}) {
    const query = String(search || '')
      .trim()
      .toLowerCase();
    return rows.filter((row) => {
      const fields = [
        row[labelKey],
        row.name,
        row.code,
        row.id,
        row.meta,
        row.buildingName,
        row.buildingType,
        row.roomName,
        row.status,
      ];
      return !query || fields.filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  }

  function isBedAssetType(type = {}) {
    return (
      String(type.name || type.label || '')
        .trim()
        .toLowerCase() === BED_ASSET_TYPE_NAME.toLowerCase()
    );
  }

  function getSelectedAssetType() {
    const typeId = byId('asset-type-input')?.value || '';
    const typeLabel = byId('asset-type-search-input')?.value || '';
    return (
      state.lookups.assetTypes.find((type) => String(type.id || '') === String(typeId)) ||
      state.lookups.assetTypes.find(
        (type) => String(type.name || '').toLowerCase() === String(typeLabel).toLowerCase(),
      ) ||
      null
    );
  }

  function syncAssetKeyAvailability() {
    const keyInput = byId('asset-key-search-input');
    const keyHiddenInput = byId('asset-key-input');
    const selectedType = getSelectedAssetType();
    const canSetKey = Boolean(selectedType && isBedAssetType(selectedType));
    if (keyInput) {
      keyInput.disabled = !canSetKey;
      keyInput.placeholder = canSetKey ? 'Search key' : 'Only Bed assets can use keys';
    }
    if (!canSetKey) {
      assetKeyLookup.clear();
      if (keyHiddenInput) keyHiddenInput.value = '';
    }
    return canSetKey;
  }

  function keyRowsForCurrentRoom() {
    const roomId = byId('asset-room-input')?.value || '';
    return roomId ? state.lookups.keys.filter((key) => key.roomId === roomId) : state.lookups.keys;
  }

  const assetTypeLookup = createLookupCombobox({
    inputId: 'asset-type-search-input',
    hiddenInputId: 'asset-type-input',
    listboxId: 'asset-type-options',
    targetMap: state.lookupMaps.assetTypes,
    emptyText: 'No asset types match that search.',
    getLabel: (type) => type.name,
    getTitle: (type) => type.name,
    onSearch: (search) =>
      assetTypeLookup.renderOptions(
        filterLookupRows(state.lookups.assetTypes, search, { labelKey: 'name' }),
      ),
    onSelect: () => {
      syncAssetKeyAvailability();
      assetKeyLookup.renderOptions(keyRowsForCurrentRoom(), { open: false });
    },
  });

  const assetRoomLookup = createLookupCombobox({
    inputId: 'asset-room-search-input',
    hiddenInputId: 'asset-room-input',
    listboxId: 'asset-room-options',
    targetMap: state.lookupMaps.rooms,
    emptyText: 'No rooms match that search.',
    getLabel: (room) => room.label,
    getTitle: (room) => room.label,
    getMeta: (room) =>
      room.meta || [room.buildingName, room.buildingType].filter(Boolean).join(' | '),
    onSearch: (search) =>
      assetRoomLookup.renderOptions(filterLookupRows(state.lookups.rooms, search)),
    onSelect: () => {
      assetKeyLookup.clear();
      assetKeyLookup.renderOptions(keyRowsForCurrentRoom(), { open: false });
    },
  });

  const assetKeyLookup = createLookupCombobox({
    inputId: 'asset-key-search-input',
    hiddenInputId: 'asset-key-input',
    listboxId: 'asset-key-options',
    targetMap: state.lookupMaps.keys,
    emptyText: 'No keys match that search.',
    getLabel: (key) => key.label,
    getTitle: (key) => key.label,
    getMeta: (key) =>
      key.meta || [key.buildingName, key.roomName, key.status].filter(Boolean).join(' | '),
    onSearch: (search) =>
      assetKeyLookup.renderOptions(filterLookupRows(keyRowsForCurrentRoom(), search)),
  });

  const assetStatusLookup = createLookupCombobox({
    inputId: 'asset-status-input',
    hiddenInputId: 'asset-status-value-input',
    listboxId: 'asset-status-options',
    targetMap: state.lookupMaps.statuses,
    emptyText: 'No asset statuses match that search.',
    getLabel: (status) => status.label,
    getTitle: (status) => status.label,
    onSearch: (search) =>
      assetStatusLookup.renderOptions(filterLookupRows(ASSET_STATUS_OPTIONS, search)),
  });

  const assetInventoryStatusLookup = createLookupCombobox({
    inputId: 'asset-inventory-status-search-input',
    hiddenInputId: 'asset-inventory-status-input',
    listboxId: 'asset-inventory-status-options',
    targetMap: state.lookupMaps.inventoryStatuses,
    emptyText: 'No inventory statuses match that search.',
    getLabel: (status) => status.label,
    getTitle: (status) => status.label,
    onSearch: (search) =>
      assetInventoryStatusLookup.renderOptions(filterLookupRows(INVENTORY_STATUS_OPTIONS, search)),
  });

  const assetExpandableLookup = createLookupCombobox({
    inputId: 'asset-expandable-search-input',
    hiddenInputId: 'asset-expandable-input',
    listboxId: 'asset-expandable-options',
    targetMap: state.lookupMaps.expandable,
    emptyText: 'No expandable values match that search.',
    getLabel: (option) => option.label,
    getTitle: (option) => option.label,
    onSearch: (search) =>
      assetExpandableLookup.renderOptions(filterLookupRows(EXPANDABLE_OPTIONS, search)),
  });

  const assetReplacedOffLookup = createLookupCombobox({
    inputId: 'asset-replaced-off-search-input',
    hiddenInputId: 'asset-replaced-off-input',
    listboxId: 'asset-replaced-off-options',
    targetMap: state.lookupMaps.replacedOffAssets,
    emptyText: 'No assets match that search.',
    getLabel: (asset) => asset.label,
    getTitle: (asset) => asset.label,
    getMeta: (asset) => asset.meta,
    onSearch: (search) =>
      assetReplacedOffLookup.renderOptions(filterLookupRows(state.lookups.assets, search)),
  });

  const assetReplacedByLookup = createLookupCombobox({
    inputId: 'asset-replaced-by-search-input',
    hiddenInputId: 'asset-replaced-by-input',
    listboxId: 'asset-replaced-by-options',
    targetMap: state.lookupMaps.replacedByAssets,
    emptyText: 'No assets match that search.',
    getLabel: (asset) => asset.label,
    getTitle: (asset) => asset.label,
    getMeta: (asset) => asset.meta,
    onSearch: (search) =>
      assetReplacedByLookup.renderOptions(filterLookupRows(state.lookups.assets, search)),
  });

  const cleanItemWarehouseLookup = createLookupCombobox({
    inputId: 'clean-item-warehouse-search-input',
    hiddenInputId: 'clean-item-warehouse-input',
    listboxId: 'clean-item-warehouse-options',
    targetMap: state.lookupMaps.warehouses,
    emptyText: 'No warehouses match that search.',
    getLabel: (option) => option.label,
    getTitle: (option) => option.label,
    onSearch: (search) =>
      cleanItemWarehouseLookup.renderOptions(filterLookupRows(WAREHOUSE_OPTIONS, search)),
  });

  function findLookupLabel(rows = [], id, fallback = '') {
    const row = rows.find((item) => String(item.id || '') === String(id || ''));
    return row?.label || row?.name || fallback;
  }

  function findAssetLookupByValue(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return null;
    return (
      state.lookups.assets.find(
        (asset) =>
          String(asset.id || '').toLowerCase() === text ||
          String(asset.code || '').toLowerCase() === text ||
          String(asset.name || '').toLowerCase() === text ||
          String(asset.label || '').toLowerCase() === text,
      ) || null
    );
  }

  function renderAssetLookupOptions(selected = {}) {
    assetTypeLookup.renderOptions(state.lookups.assetTypes, { open: false });
    assetRoomLookup.renderOptions(state.lookups.rooms, { open: false });
    assetStatusLookup.renderOptions(ASSET_STATUS_OPTIONS, { open: false });
    assetInventoryStatusLookup.renderOptions(INVENTORY_STATUS_OPTIONS, { open: false });
    assetExpandableLookup.renderOptions(EXPANDABLE_OPTIONS, { open: false });
    assetReplacedOffLookup.renderOptions(state.lookups.assets, { open: false });
    assetReplacedByLookup.renderOptions(state.lookups.assets, { open: false });

    assetTypeLookup.setValue({
      id: selected.typeId || '',
      label: findLookupLabel(state.lookups.assetTypes, selected.typeId, ''),
    });
    assetRoomLookup.setValue({
      id: selected.locationRoomId || '',
      label: findLookupLabel(state.lookups.rooms, selected.locationRoomId, ''),
    });
    assetKeyLookup.renderOptions(keyRowsForCurrentRoom(), { open: false });
    assetKeyLookup.setValue({
      id: selected.locationKeyId || '',
      label: findLookupLabel(keyRowsForCurrentRoom(), selected.locationKeyId, ''),
    });
    const status = ASSET_STATUS_OPTIONS.find(
      (option) => option.id.toLowerCase() === String(selected.status || '').toLowerCase(),
    );
    assetStatusLookup.setValue({
      id: status?.id || '',
      label: status?.label || '',
    });
    const inventoryStatus = INVENTORY_STATUS_OPTIONS.find(
      (option) => option.id === (selected.inventoryStatus || 'undiscovered'),
    );
    assetInventoryStatusLookup.setValue({
      id: inventoryStatus?.id || 'undiscovered',
      label: inventoryStatus?.label || 'Not found',
    });
    const expandable = EXPANDABLE_OPTIONS.find(
      (option) => option.id === (selected.expandable || 'Non Expandable'),
    );
    assetExpandableLookup.setValue({
      id: expandable?.id || 'Non Expandable',
      label: expandable?.label || 'Non Expandable',
    });
    const replacedOff = findAssetLookupByValue(selected.replacedOff);
    const replacedBy = findAssetLookupByValue(selected.replacedBy);
    assetReplacedOffLookup.setValue({
      id: replacedOff?.id || '',
      label: replacedOff?.label || emptyIfPlaceholder(selected.replacedOff),
    });
    assetReplacedByLookup.setValue({
      id: replacedBy?.id || '',
      label: replacedBy?.label || emptyIfPlaceholder(selected.replacedBy),
    });
    syncAssetKeyAvailability();
  }

  function isLookupOpen(inputId) {
    return byId(inputId)?.getAttribute('aria-expanded') === 'true';
  }

  function reconcileLookupSelection({ inputId, hiddenInputId, lookup, rows, getLabel }) {
    const input = byId(inputId);
    const hiddenInput = byId(hiddenInputId);
    if (!input || !hiddenInput) return;
    const selectedId =
      (typeof lookup.getSelectedId === 'function' ? lookup.getSelectedId() : '') ||
      hiddenInput.dataset.selectedLookupId ||
      hiddenInput.value ||
      '';
    if (!selectedId) return;
    const selectedRow = rows.find((row) => String(row.id || '') === String(selectedId));
    if (!selectedRow) {
      lookup.setValue({ id: '', label: '' });
      return;
    }
    lookup.setValue({
      id: selectedId,
      label: getLabel(selectedRow) || '',
    });
  }

  function reconcileAssetFormSelections() {
    reconcileLookupSelection({
      inputId: 'asset-type-search-input',
      hiddenInputId: 'asset-type-input',
      lookup: assetTypeLookup,
      rows: state.lookups.assetTypes,
      getLabel: (row) => row.name,
    });
    reconcileLookupSelection({
      inputId: 'asset-room-search-input',
      hiddenInputId: 'asset-room-input',
      lookup: assetRoomLookup,
      rows: state.lookups.rooms,
      getLabel: (row) => row.label,
    });
    reconcileLookupSelection({
      inputId: 'asset-key-search-input',
      hiddenInputId: 'asset-key-input',
      lookup: assetKeyLookup,
      rows: keyRowsForCurrentRoom(),
      getLabel: (row) => row.label,
    });
    syncAssetKeyAvailability();
  }

  function refreshLookupOptions() {
    reconcileAssetFormSelections();
    const refreshes = [
      {
        inputId: 'asset-type-search-input',
        hiddenInputId: 'asset-type-input',
        lookup: assetTypeLookup,
        sourceRows: () => state.lookups.assetTypes,
        getLabel: (row) => row.name,
        rows: (search) => filterLookupRows(state.lookups.assetTypes, search, { labelKey: 'name' }),
      },
      {
        inputId: 'asset-room-search-input',
        hiddenInputId: 'asset-room-input',
        lookup: assetRoomLookup,
        sourceRows: () => state.lookups.rooms,
        getLabel: (row) => row.label,
        rows: (search) => filterLookupRows(state.lookups.rooms, search),
      },
      {
        inputId: 'asset-key-search-input',
        hiddenInputId: 'asset-key-input',
        lookup: assetKeyLookup,
        sourceRows: keyRowsForCurrentRoom,
        getLabel: (row) => row.label,
        rows: (search) => filterLookupRows(keyRowsForCurrentRoom(), search),
      },
      {
        inputId: 'asset-status-input',
        lookup: assetStatusLookup,
        rows: (search) => filterLookupRows(ASSET_STATUS_OPTIONS, search),
      },
      {
        inputId: 'asset-inventory-status-search-input',
        lookup: assetInventoryStatusLookup,
        rows: (search) => filterLookupRows(INVENTORY_STATUS_OPTIONS, search),
      },
      {
        inputId: 'asset-expandable-search-input',
        lookup: assetExpandableLookup,
        rows: (search) => filterLookupRows(EXPANDABLE_OPTIONS, search),
      },
      {
        inputId: 'asset-replaced-off-search-input',
        hiddenInputId: 'asset-replaced-off-input',
        lookup: assetReplacedOffLookup,
        sourceRows: () => state.lookups.assets,
        getLabel: (row) => row.label,
        rows: (search) => filterLookupRows(state.lookups.assets, search),
      },
      {
        inputId: 'asset-replaced-by-search-input',
        hiddenInputId: 'asset-replaced-by-input',
        lookup: assetReplacedByLookup,
        sourceRows: () => state.lookups.assets,
        getLabel: (row) => row.label,
        rows: (search) => filterLookupRows(state.lookups.assets, search),
      },
      {
        inputId: 'clean-item-warehouse-search-input',
        lookup: cleanItemWarehouseLookup,
        rows: (search) => filterLookupRows(WAREHOUSE_OPTIONS, search),
      },
    ];

    refreshes.forEach(({ inputId, hiddenInputId, lookup, rows, sourceRows, getLabel }) => {
      const input = byId(inputId);
      if (!input) return;
      const hiddenInput = hiddenInputId ? byId(hiddenInputId) : null;
      const selectedId =
        (typeof lookup.getSelectedId === 'function' ? lookup.getSelectedId() : '') ||
        hiddenInput?.value ||
        '';
      if (selectedId && typeof sourceRows === 'function') {
        const selectedRow = sourceRows().find(
          (row) => String(row.id || '') === String(selectedId),
        );
        if (selectedRow) {
          lookup.setValue({
            id: selectedId,
            label: getLabel(selectedRow) || input.value,
          });
        } else {
          lookup.setValue({ id: '', label: '' });
        }
      }
      lookup.renderOptions(rows(input.value.trim()), { open: isLookupOpen(inputId) });
      lookup.syncHiddenId();
    });
  }

  function collectAssetPayload() {
    assetTypeLookup.syncHiddenId();
    assetRoomLookup.syncHiddenId();
    assetKeyLookup.syncHiddenId();
    assetStatusLookup.syncHiddenId();
    assetInventoryStatusLookup.syncHiddenId();
    assetExpandableLookup.syncHiddenId();
    assetReplacedOffLookup.syncHiddenId();
    assetReplacedByLookup.syncHiddenId();

    return {
      code: byId('asset-code-input')?.value.trim() || '',
      rfidCode: byId('asset-rfid-input')?.value.trim() || '',
      name: byId('asset-name-input')?.value.trim() || '',
      typeId: byId('asset-type-input')?.value || '',
      locationRoomId: byId('asset-room-input')?.value || '',
      locationKeyId: syncAssetKeyAvailability() ? byId('asset-key-input')?.value || '' : '',
      category: byId('asset-category-input')?.value.trim() || '',
      quantity: byId('asset-quantity-input')?.value || '1',
      owner: byId('asset-owner-input')?.value.trim() || '',
      status:
        byId('asset-status-value-input')?.value || byId('asset-status-input')?.value.trim() || '',
      expandable: byId('asset-expandable-input')?.value || 'Non Expandable',
      description: byId('asset-description-input')?.value.trim() || '',
      mrah: byId('asset-mrah-input')?.value.trim() || '',
      m2Inside: byId('asset-m2-inside-input')?.value.trim() || '',
      purchaseDate: byId('asset-purchase-date-input')?.value || '',
      purchasePrice: byId('asset-purchase-price-input')?.value.trim() || '',
      comments: byId('asset-comments-input')?.value.trim() || '',
      replacedOff:
        byId('asset-replaced-off-input')?.value ||
        byId('asset-replaced-off-search-input')?.value.trim() ||
        '',
      replacedBy:
        byId('asset-replaced-by-input')?.value ||
        byId('asset-replaced-by-search-input')?.value.trim() ||
        '',
      yearOfLifeCycle: byId('asset-year-life-cycle-input')?.value.trim() || '',
      restOfLifeCycle: byId('asset-rest-life-cycle-input')?.value.trim() || '',
      restValue: byId('asset-rest-value-input')?.value.trim() || '',
      service: byId('asset-service-input')?.value.trim() || '',
      inventoryStatus: byId('asset-inventory-status-input')?.value || 'undiscovered',
      isFixed: Boolean(byId('asset-fixed-input')?.checked),
      isQuantitative: Boolean(byId('asset-quantitative-input')?.checked),
    };
  }

  function isIntegerAtLeast(value, minimum) {
    const text = String(value ?? '').trim();
    if (!text) return false;
    const number = Number(text);
    return Number.isInteger(number) && number >= minimum;
  }

  function isDecimalAtLeast(value, minimum) {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!text) return true;
    const number = Number(text);
    return Number.isFinite(number) && number >= minimum;
  }

  function isBedAssetType(type) {
    return String(type?.name || type?.label || '').trim().toLowerCase() === 'bed';
  }

  function selectedAssetTypeIsBed(typeId) {
    const text = String(typeId || '').trim().toLowerCase();
    if (!text) return false;
    const assetTypes = Array.isArray(state.lookups.assetTypes) ? state.lookups.assetTypes : [];
    return assetTypes.some(
      (type) =>
        isBedAssetType(type) &&
        (String(type.id || '').toLowerCase() === text ||
          String(type.name || '').toLowerCase() === text ||
          String(type.label || '').toLowerCase() === text),
    );
  }

  function showMissingInformation(_stateController, message, focusId, title = 'Missing information') {
    toast.show({ title, message, variant: 'warning' });
    const field = byId(focusId);
    if (field && typeof field.focus === 'function') field.focus();
    return false;
  }

  function validateAssetPayload(payload) {
    if (!payload.code) {
      return showMissingInformation(
        assetModalState,
        'Enter an asset code before saving.',
        'asset-code-input',
      );
    }
    if (!payload.name) {
      return showMissingInformation(
        assetModalState,
        'Enter an asset name before saving.',
        'asset-name-input',
      );
    }
    if (!payload.typeId) {
      return showMissingInformation(
        assetModalState,
        'Choose an asset type before saving.',
        'asset-type-search-input',
      );
    }
    if (!payload.locationRoomId) {
      return showMissingInformation(
        assetModalState,
        'Choose a room before saving.',
        'asset-room-search-input',
      );
    }
    if (payload.isQuantitative && selectedAssetTypeIsBed(payload.typeId)) {
      return showMissingInformation(
        assetModalState,
        'Quantitative assets cannot use the Bed asset type.',
        'asset-type-search-input',
        'Invalid asset type',
      );
    }
    if (!payload.isQuantitative && !payload.rfidCode) {
      return showMissingInformation(
        assetModalState,
        'Enter an RFID code before saving.',
        'asset-rfid-input',
      );
    }
    if (!isIntegerAtLeast(byId('asset-quantity-input')?.value, 1)) {
      return showMissingInformation(
        assetModalState,
        'Enter a quantity of at least 1 before saving.',
        'asset-quantity-input',
      );
    }
    if (!payload.status) {
      return showMissingInformation(
        assetModalState,
        'Choose an asset status before saving.',
        'asset-status-input',
      );
    }
    if (!isDecimalAtLeast(payload.m2Inside, 0)) {
      return showMissingInformation(
        assetModalState,
        'Enter M2 inside as a decimal value such as 0.01, 1.00, or 10.10.',
        'asset-m2-inside-input',
      );
    }
    if (!isDecimalAtLeast(payload.purchasePrice, 0)) {
      return showMissingInformation(
        assetModalState,
        'Enter Purchase price as a decimal value such as 0.00, 0.01, or 10.10.',
        'asset-purchase-price-input',
      );
    }
    for (const [value, label, focusId] of [
      [payload.yearOfLifeCycle, 'Lifecycle year', 'asset-year-life-cycle-input'],
      [payload.restOfLifeCycle, 'Lifecycle rest', 'asset-rest-life-cycle-input'],
      [payload.restValue, 'Rest value', 'asset-rest-value-input'],
    ]) {
      if (!isDecimalAtLeast(value, 0)) {
        return showMissingInformation(assetModalState, `${label} must be a number.`, focusId);
      }
    }
    if (byId('asset-replaced-off-search-input')?.value.trim() && !byId('asset-replaced-off-input')?.value) {
      return showMissingInformation(
        assetModalState,
        'Choose Replaced off from the asset list.',
        'asset-replaced-off-search-input',
      );
    }
    if (byId('asset-replaced-by-search-input')?.value.trim() && !byId('asset-replaced-by-input')?.value) {
      return showMissingInformation(
        assetModalState,
        'Choose Replaced by from the asset list.',
        'asset-replaced-by-search-input',
      );
    }
    return true;
  }

  function validateAssetTypePayload(payload) {
    if (!payload.name) {
      return showMissingInformation(
        assetTypeModalState,
        'Enter an asset type name before saving.',
        'asset-type-name-input',
      );
    }
    return true;
  }

  function validateCleanItemPayload(payload) {
    if (!payload.itemName) {
      return showMissingInformation(
        cleanItemModalState,
        'Enter an item name before saving.',
        'clean-item-name-input',
      );
    }
    if (!payload.warehouse) {
      return showMissingInformation(
        cleanItemModalState,
        'Choose a warehouse before saving.',
        'clean-item-warehouse-search-input',
      );
    }
    if (!isIntegerAtLeast(byId('clean-item-total-input')?.value, 0)) {
      return showMissingInformation(
        cleanItemModalState,
        'Enter a total amount of 0 or more before saving.',
        'clean-item-total-input',
      );
    }
    return true;
  }

  function syncAssetQuantityMode({
    creating = byId('asset-form-mode')?.value !== 'edit',
    isQuantitative = false,
  } = {}) {
    const quantitativeField = byId('asset-quantitative-field');
    const quantitativeInput = byId('asset-quantitative-input');
    const rfidInput = byId('asset-rfid-input');
    const quantityInput = byId('asset-quantity-input');
    if (quantitativeField) quantitativeField.hidden = !creating;
    if (quantitativeInput) quantitativeInput.checked = Boolean(isQuantitative);
    if (rfidInput) {
      rfidInput.disabled = Boolean(isQuantitative);
      rfidInput.required = !isQuantitative;
      rfidInput.placeholder = isQuantitative ? 'Generated on save' : 'RFID-ASSET-001';
      if (isQuantitative && creating) rfidInput.value = '';
    }
    if (quantityInput) {
      quantityInput.disabled = false;
      quantityInput.readOnly = !isQuantitative;
      quantityInput.required = true;
      if (!isQuantitative) quantityInput.value = '1';
    }
  }

  function openCreateAssetModal() {
    if (!canAddAsset()) {
      updateControlVisibility();
      return;
    }
    assetModalState.clear();
    byId('asset-form')?.reset();
    byId('asset-form-mode').value = 'create';
    byId('asset-id-input').value = '';
    byId('asset-modal-title').textContent = 'Add asset';
    byId('asset-modal-text').textContent = 'Create a tracked asset in the selected camp.';
    byId('save-asset-button').textContent = 'Create asset';
    byId('asset-owner-input').value = 'Owner not recorded';
    byId('asset-status-input').value = '';
    byId('asset-status-value-input').value = '';
    byId('asset-service-input').value = 'Billeting';
    byId('asset-quantity-input').value = '1';
    byId('asset-rfid-input').value = '';
    byId('asset-mrah-input').value = 'MRAH not recorded';
    byId('asset-m2-inside-input').value = '';
    byId('asset-purchase-date-input').value = '';
    byId('asset-purchase-price-input').value = '';
    assetReplacedOffLookup.setValue();
    assetReplacedByLookup.setValue();
    byId('asset-year-life-cycle-input').value = '';
    byId('asset-rest-life-cycle-input').value = '';
    byId('asset-rest-value-input').value = '';
    byId('asset-comments-input').value = '';
    byId('asset-description-input').value = '';
    syncAssetQuantityMode({ creating: true, isQuantitative: false });
    renderAssetLookupOptions({
      status: 'Good',
      inventoryStatus: 'undiscovered',
      expandable: 'Non Expandable',
    });
    updateControlVisibility();
    assetModal?.open();
  }

  async function openEditAssetModal(assetId) {
    if (!canEditAsset()) {
      updateControlVisibility();
      return;
    }
    const normalizedAssetId = String(assetId || '').trim();
    if (!normalizedAssetId) return;
    let row = state.rowsById.get(normalizedAssetId);
    if (!row && (await loadAssets({ quiet: true }))) {
      row = state.rowsById.get(normalizedAssetId);
    }
    if (!row) {
      toast.show({
        title: 'Asset unavailable',
        message: 'Refresh assets and try editing this row again.',
        variant: 'warning',
      });
      return;
    }
    assetModalState.clear();
    byId('asset-form-mode').value = 'edit';
    byId('asset-id-input').value = row.id || '';
    byId('asset-modal-title').textContent = 'Edit asset';
    byId('asset-modal-text').textContent = 'Update asset details and inventory state.';
    byId('save-asset-button').textContent = 'Save changes';
    byId('asset-code-input').value = row.code || '';
    byId('asset-rfid-input').value = row.rfidCode === 'No RFID' ? '' : row.rfidCode || '';
    byId('asset-name-input').value = row.name || '';
    byId('asset-category-input').value =
      row.category === 'No information' ? '' : row.category || '';
    byId('asset-quantity-input').value = row.quantity || '1';
    byId('asset-owner-input').value = row.owner === 'No information' ? '' : row.owner || '';
    byId('asset-status-input').value = row.status === 'No information' ? '' : row.status || '';
    byId('asset-service-input').value = row.service === 'No information' ? '' : row.service || '';
    byId('asset-mrah-input').value = emptyIfPlaceholder(row.mrah);
    byId('asset-m2-inside-input').value = emptyIfPlaceholder(row.m2Inside);
    byId('asset-purchase-date-input').value = toDatetimeLocalInputValue(row.purchaseDate);
    byId('asset-purchase-price-input').value = emptyIfPlaceholder(row.purchasePrice);
    byId('asset-year-life-cycle-input').value = emptyIfPlaceholder(row.yearOfLifeCycle);
    byId('asset-rest-life-cycle-input').value = emptyIfPlaceholder(row.restOfLifeCycle);
    byId('asset-rest-value-input').value = emptyIfPlaceholder(row.restValue);
    byId('asset-comments-input').value = emptyIfPlaceholder(row.comments);
    byId('asset-fixed-input').checked = Boolean(row.isFixed);
    syncAssetQuantityMode({ creating: false, isQuantitative: Boolean(row.isQuantitative) });
    byId('asset-description-input').value =
      row.description === 'No information' ? '' : row.description || '';
    renderAssetLookupOptions(row);
    updateControlVisibility();
    assetModal?.open();
  }

  function openBulkModal() {
    if (!canBulkAssets()) {
      updateControlVisibility();
      return;
    }
    assetBulkState.clear();
    renderImportProgress('assets');
    assetBulkModal?.open();
  }

  function openCreateAssetTypeModal() {
    if (!canAddAssetType()) {
      updateControlVisibility();
      return;
    }
    assetTypeModalState.clear();
    byId('asset-type-form')?.reset();
    byId('asset-type-form-mode').value = 'create';
    byId('asset-type-id-input').value = '';
    byId('asset-type-modal-title').textContent = 'Add asset type';
    byId('asset-type-modal-text').textContent = 'Create an asset type.';
    byId('save-asset-type-button').textContent = 'Create type';
    updateControlVisibility();
    assetTypeModal?.open();
  }

  function openEditAssetTypeModal(typeId) {
    if (!canEditAssetType()) {
      updateControlVisibility();
      return;
    }
    const row = state.assetTypesById.get(String(typeId || ''));
    if (!row) {
      toast.show({
        title: 'Asset type unavailable',
        message: 'Refresh asset types and try again.',
        variant: 'warning',
      });
      return;
    }
    assetTypeModalState.clear();
    byId('asset-type-form-mode').value = 'edit';
    byId('asset-type-id-input').value = row.id || '';
    byId('asset-type-name-input').value = row.name || '';
    byId('asset-type-modal-title').textContent = 'Edit asset type';
    byId('asset-type-modal-text').textContent = 'Update this asset type.';
    byId('save-asset-type-button').textContent = 'Save changes';
    updateControlVisibility();
    assetTypeModal?.open();
  }

  function openAssetTypeBulkModal() {
    if (!canBulkAssetTypes()) {
      updateControlVisibility();
      return;
    }
    assetTypeBulkState.clear();
    renderImportProgress('assetTypes');
    assetTypeBulkModal?.open();
  }

  function collectCleanItemPayload() {
    cleanItemWarehouseLookup.syncHiddenId();
    return {
      itemName: byId('clean-item-name-input')?.value.trim() || '',
      warehouse: byId('clean-item-warehouse-input')?.value || 'large',
      totalAmount: Number(byId('clean-item-total-input')?.value || 0),
    };
  }

  function openCreateCleanItemModal() {
    if (!canAddCleanItem()) {
      updateControlVisibility();
      return;
    }
    cleanItemModalState.clear();
    byId('clean-item-form')?.reset();
    byId('clean-item-form-mode').value = 'create';
    byId('clean-item-id-input').value = '';
    byId('clean-item-warehouse-input').value = 'large';
    byId('clean-item-total-input').value = '0';
    byId('clean-item-modal-title').textContent = 'Add clean item';
    byId('clean-item-modal-text').textContent =
      'Create clean item stock in the large warehouse. A small warehouse row starts at 0.';
    byId('save-clean-item-button').textContent = 'Create item';
    updateControlVisibility();
    cleanItemModal?.open();
  }

  function openEditCleanItemModal(itemId) {
    if (!canEditCleanItem()) {
      updateControlVisibility();
      return;
    }
    const row = state.cleanItemsById.get(String(itemId || ''));
    if (!row) {
      toast.show({
        title: 'Clean item unavailable',
        message: 'Refresh clean items and try again.',
        variant: 'warning',
      });
      return;
    }
    cleanItemModalState.clear();
    byId('clean-item-form-mode').value = 'edit';
    byId('clean-item-id-input').value = row.id || '';
    byId('clean-item-name-input').value = row.itemName || '';
    byId('clean-item-warehouse-input').value = row.warehouse || 'large';
    byId('clean-item-total-input').value = row.availableAmount ?? 0;
    byId('clean-item-modal-title').textContent = 'Edit clean item';
    byId('clean-item-modal-text').textContent = `Update ${WAREHOUSE_LABELS[row.warehouse] || 'warehouse'} stock.`;
    byId('save-clean-item-button').textContent = 'Save changes';
    updateControlVisibility();
    cleanItemModal?.open();
  }

  function openMoveCleanItemModal(itemId) {
    if (!canMoveCleanItem()) {
      updateControlVisibility();
      return;
    }
    const row = state.cleanItemsById.get(String(itemId || ''));
    if (!row) {
      toast.show({
        title: 'Clean item unavailable',
        message: 'Refresh clean items and try again.',
        variant: 'warning',
      });
      return;
    }
    const targetWarehouse = row.warehouse === 'large' ? 'small' : 'large';
    cleanItemMoveState.clear();
    byId('clean-item-move-id-input').value = row.id || '';
    byId('clean-item-move-target-input').value = targetWarehouse;
    byId('clean-item-move-quantity-input').value = String(Math.min(1, Number(row.availableAmount) || 1));
    byId('clean-item-move-quantity-input').max = String(Math.max(1, Number(row.availableAmount) || 1));
    byId('clean-item-move-modal-title').textContent = 'Move clean item quantity';
    byId('clean-item-move-modal-text').textContent =
      `Move available "${row.itemName}" from ${WAREHOUSE_LABELS[row.warehouse] || 'this warehouse'} to ${WAREHOUSE_LABELS[targetWarehouse]}.`;
    updateControlVisibility();
    cleanItemMoveModal?.open();
  }

  function openCleanItemBulkModal() {
    if (!canBulkCleanItems()) {
      updateControlVisibility();
      return;
    }
    cleanItemBulkState.clear();
    renderImportProgress('cleanItems');
    cleanItemBulkModal?.open();
  }

  function renderImportSummary(key, summary) {
    const config = BULK_IMPORT_CONFIGS[key] || BULK_IMPORT_CONFIGS.assets;
    const node = byId(config.summaryId);
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
          <div class="asset-import-summary-item">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `,
      )
      .join('');
  }

  function renderImportErrors(key, errors = []) {
    const config = BULK_IMPORT_CONFIGS[key] || BULK_IMPORT_CONFIGS.assets;
    const node = byId(config.errorsId);
    if (!node) return;
    const normalizedErrors = (Array.isArray(errors) ? errors : [])
      .map((error, index) => {
        if (typeof error === 'string') return { rowNumber: '-', message: error };
        if (!error || typeof error !== 'object') return null;
        return {
          rowNumber: error.rowNumber || error.row || error.index || '-',
          message: error.message || error.detail || error.error || 'The row could not be processed.',
          key: error.code || error.path || index,
        };
      })
      .filter(Boolean);
    if (!normalizedErrors.length) {
      node.hidden = true;
      node.innerHTML = '';
      return;
    }
    node.hidden = false;
    node.innerHTML = normalizedErrors
      .map(
        (error) =>
          `<div>Row ${escapeHtml(error.rowNumber || '-')}: ${escapeHtml(error.message || 'The row could not be processed.')}</div>`,
      )
      .join('');
  }

  function renderImportProgress(key = 'assets') {
    const config = BULK_IMPORT_CONFIGS[key] || BULK_IMPORT_CONFIGS.assets;
    const importState = state.imports[key] || state.imports.assets;
    const panel = byId(config.progressPanelId);
    if (!panel) return;
    panel.hidden = !importState.visible;
    const selectedFile = byId(config.selectedFileId);
    const uploadLabel = byId(config.uploadLabelId);
    const processingLabel = byId(config.processingLabelId);
    const uploadBar = byId(config.uploadBarId);
    const processingBar = byId(config.processingBarId);
    const statusMessage = byId(config.statusMessageId);
    if (selectedFile) selectedFile.textContent = importState.fileName || 'No file selected.';
    if (uploadLabel) uploadLabel.textContent = `${importState.uploadPercent}%`;
    if (processingLabel) processingLabel.textContent = `${importState.processingPercent}%`;
    setProgressValue(uploadBar, importState.uploadPercent);
    setProgressValue(processingBar, importState.processingPercent);
    if (statusMessage) statusMessage.textContent = importState.statusMessage || 'Waiting to start.';
    renderImportSummary(key, importState.summary);
    renderImportErrors(key, importState.errors);
    const uploadButton = byId(config.uploadButtonId);
    const fileInput = byId(config.fileInputId);
    if (uploadButton) uploadButton.disabled = importState.isBusy || !canBulkImportKey(key);
    if (fileInput) fileInput.disabled = importState.isBusy || !canBulkImportKey(key);
  }

  function resetImportProgress(key = 'assets', { keepFileName = false } = {}) {
    const config = BULK_IMPORT_CONFIGS[key] || BULK_IMPORT_CONFIGS.assets;
    const importState = state.imports[key] || state.imports.assets;
    importState.uploadPercent = 0;
    importState.processingPercent = 0;
    importState.statusMessage = config.emptyStatus;
    importState.summary = null;
    importState.errors = [];
    importState.visible = false;
    importState.isBusy = false;
    if (!keepFileName) importState.fileName = '';
    renderImportProgress(key);
  }

  function clearBulkImportModal(key = 'assets') {
    const config = BULK_IMPORT_CONFIGS[key] || BULK_IMPORT_CONFIGS.assets;
    const fileInput = byId(config.fileInputId);
    if (fileInput) fileInput.value = '';
    resetImportProgress(key);
  }

  function applyImportPayload(key = 'assets', payload = {}) {
    const importState = state.imports[key] || state.imports.assets;
    const summary = payload.summary || importState.summary;
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
        skippedCount: Number(summary.skippedCount) || Number(summary.missingCount) || 0,
        errorCount: Number(summary.errorCount) || 0,
      };
      if (Array.isArray(summary.errors)) importState.errors = summary.errors;
    }
    if (Array.isArray(payload.errors) && payload.errors.length) importState.errors = payload.errors;
    renderImportProgress(key);
  }

  function collectImportErrors(result = {}, fallbackMessage = '') {
    const body = result.data || result.body || {};
    const details = Array.isArray(body.details) ? body.details : [];
    return details
      .map((detail, index) => {
        if (typeof detail === 'string') return { rowNumber: '-', message: detail };
        if (!detail || typeof detail !== 'object') return null;
        return {
          rowNumber: detail.rowNumber || detail.row || detail.index || '-',
          message: detail.message || detail.detail || detail.error || fallbackMessage,
          code: detail.code || detail.path || index,
        };
      })
      .filter((error) => error?.message);
  }

  function buildRequestState() {
    return TABLE_KEYS.reduce((payload, key) => {
      const table = state.tables[key];
      const filters =
        key === 'cleanItems'
          ? {
              ...table.filters,
              warehouse: WAREHOUSE_LABELS[state.cleanItemsWarehouse] || 'Large warehouse',
            }
          : table.filters;
      payload[key] = {
        page: table.page,
        limit: table.limit,
        filters,
        sortColumn: table.sortColumn,
        sortDirection: table.sortDirection,
      };
      return payload;
    }, {});
  }

  function applyMeta(tableKey, meta = {}) {
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

    const pageLabel = document.querySelector(`[data-assets-page-label="${tableKey}"]`);
    if (pageLabel) {
      pageLabel.textContent =
        table.total > 0 ? `Page ${table.page} of ${table.totalPages}` : 'Page 1 of 1';
    }

    const prev = document.querySelector(`[data-assets-prev-table="${tableKey}"]`);
    const next = document.querySelector(`[data-assets-next-table="${tableKey}"]`);
    if (prev) prev.disabled = table.total <= 0 || table.totalPages <= 1 || table.page <= 1;
    if (next)
      next.disabled = table.total <= 0 || table.totalPages <= 1 || table.page >= table.totalPages;

    qsa(`[data-assets-sort-table="${tableKey}"][data-assets-sort-column]`).forEach((button) => {
      const column = button.getAttribute('data-assets-sort-column');
      const active = table.sortColumn === column;
      const direction = active ? table.sortDirection : 'default';
      const indicator = document.querySelector(
        `[data-assets-sort-indicator="${tableKey}:${column}"]`,
      );
      if (indicator)
        indicator.textContent = direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '-';
      button
        .closest('th')
        ?.setAttribute(
          'aria-sort',
          direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
        );
    });
  }

  function renderTable(tableKey, rows = []) {
    const body = document.querySelector(`[data-assets-table-body="${tableKey}"]`);
    if (!body) return;
    const table = state.tables[tableKey];
    const colspan = TABLE_COLUMNS[tableKey]?.length || 1;

    if (!table.sourceTotal) {
      body.innerHTML = `<tr><td class="table-empty" colspan="${colspan}">${escapeHtml(TABLE_EMPTY_TEXT[tableKey])}</td></tr>`;
      return;
    }

    if (!table.total) {
      body.innerHTML = `<tr><td class="table-empty" colspan="${colspan}">No rows match the current table state.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map((row) => renderRow(tableKey, row)).join('');
  }

  function renderRow(tableKey, row = {}) {
    if (tableKey === 'allAssets') {
      return `<tr>
        <td><code>${escapeHtml(row.id)}</code></td>
        <td><code>${escapeHtml(row.code)}</code></td>
        <td><code>${escapeHtml(row.rfidCode)}</code></td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.typeName)}</td>
        <td>${escapeHtml(row.location)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${statusBadge(row.inventoryStatus, row.inventoryStatusLabel)}</td>
        <td>${escapeHtml(row.lastInventoryDate)}</td>
        <td>${escapeHtml(row.owner)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${escapeHtml(row.service)}</td>
        <td>${escapeHtml(row.expandable)}</td>
        <td>${escapeHtml(row.isFixedLabel)}</td>
        <td>${escapeHtml(row.isQuantitativeLabel)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td>${escapeHtml(row.mrah)}</td>
        <td>${escapeHtml(row.comments)}</td>
        <td>${escapeHtml(row.replacedOff)}</td>
        <td>${escapeHtml(row.replacedBy)}</td>
        <td>${escapeHtml(row.purchaseDate)}</td>
        <td>${escapeHtml(row.writtenOffDate)}</td>
        <td>${escapeHtml(row.createdAt)}</td>
        <td>${escapeHtml(row.updatedAt)}</td>
        <td>${escapeHtml(row.m2Inside)}</td>
        <td>${escapeHtml(row.yearOfLifeCycle)}</td>
        <td>${escapeHtml(row.restOfLifeCycle)}</td>
        <td>${escapeHtml(row.restValue)}</td>
        <td>${escapeHtml(row.purchasePrice)}</td>
        <td>${escapeHtml(row.quantity)}</td>
        <td>
          <div class="table-action-group">
            <button class="btn btn-primary js-edit-asset" type="button" data-asset-id="${escapeAttr(row.id)}" ${canEditAsset() ? '' : 'disabled'}>
              <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
            </button>
            <button class="btn btn-danger js-delete-asset" type="button" data-asset-id="${escapeAttr(row.id)}" ${canDeleteAsset() ? '' : 'disabled'}>
              <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
            </button>
          </div>
        </td>
      </tr>`;
    }

    if (tableKey === 'inventoryStatusRows') {
      return `<tr>
        <td>${statusBadge(row.status, row.label)}</td>
        <td>${escapeHtml(row.lastInventoryDate)}</td>
        <td>${escapeHtml(row.assetCount)}</td>
        <td>${escapeHtml(row.quantity)}</td>
      </tr>`;
    }

    if (tableKey === 'inventoryEvents') {
      return `<tr>
        <td>${escapeHtml(row.changedAt)}</td>
        <td>${escapeHtml(row.addedQuantity)}</td>
        <td>${escapeHtml(row.removedQuantity)}</td>
        <td>${escapeHtml(row.lostQuantity)}</td>
        <td>${escapeHtml(row.modifiedQuantity)}</td>
      </tr>`;
    }

    if (tableKey === 'assetTypes') {
      const isBedType = normalizeText(row.name, '') === BED_ASSET_TYPE_NAME;
      const deleteBlockedAttr = !canDeleteAssetType() || isBedType ? 'disabled' : '';
      const protectedAttr = !canEditAssetType() || row.isProtected ? 'disabled' : '';
      const isProtected = row.isProtected ? 'true' : 'false';
      const hasAssets = Number(row.assetCount) > 0 ? 'true' : 'false';
      return `<tr>
      <td><code>${escapeHtml(row.id)}</code></td>
      <td>${escapeHtml(normalizeText(row.name, 'Unnamed type'))}</td>
      <td>${escapeHtml(row.assetCount)}</td>
      <td>${escapeHtml(row.notFoundCount)}</td>
      <td>${escapeHtml(row.completedCount)}</td>
      <td>
        <div class="table-action-group">
          <button class="btn btn-primary js-edit-asset-type" type="button" data-type-id="${escapeAttr(row.id)}" data-protected="${isProtected}" ${protectedAttr}>
            <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
          </button>
          <button class="btn btn-danger js-delete-asset-type" type="button" data-type-id="${escapeAttr(row.id)}" data-protected="${isProtected}" data-has-assets="${hasAssets}" data-is-bed="${isBedType ? 'true' : 'false'}" ${deleteBlockedAttr}>
            <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
          </button>
        </div>
      </td>
    </tr>`;
    }

    return `<tr>
      <td><code>${escapeHtml(row.id)}</code></td>
      <td>${escapeHtml(row.itemName)}</td>
      <td>${escapeHtml(row.totalAmount)}</td>
      <td>${escapeHtml(row.countGetItem)}</td>
      <td>${escapeHtml(row.availableAmount)}</td>
      <td>
        <div class="table-action-group">
          <button class="btn btn-primary js-edit-clean-item" type="button" data-item-id="${escapeAttr(row.id)}" ${canEditCleanItem() ? '' : 'disabled'}>
            <svg class="icon" aria-hidden="true"><use href="#icon-pencil-square"></use></svg><span>Edit</span>
          </button>
          <button class="btn btn-secondary js-move-clean-item" type="button" data-item-id="${escapeAttr(row.id)}" ${canMoveCleanItem() ? '' : 'disabled'}>
            <svg class="icon" aria-hidden="true"><use href="#icon-refresh"></use></svg><span>Move</span>
          </button>
          <button class="btn btn-danger js-delete-clean-item" type="button" data-item-id="${escapeAttr(row.id)}" ${canDeleteCleanItem() ? '' : 'disabled'}>
            <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg><span>Delete</span>
          </button>
        </div>
      </td>
    </tr>`;
  }

  function renderSummary(data = {}) {
    const totalAssets = Number(data.totalAssets) || 0;
    const completedAssets = Number(data.completedAssets) || 0;
    const notFoundAssets = Number(data.notFoundAssets) || 0;
    const totalQuantity = Number(String(data.totalQuantity || '0').replace(',', '.')) || 0;
    const updates = [
      ['assets-summary-total', data.totalAssets],
      ['assets-summary-quantity', data.totalQuantity],
      ['assets-summary-not-found', data.notFoundAssets],
      ['assets-summary-completed', data.completedAssets],
      ['assets-summary-types', data.typeCount],
      ['assets-summary-clean-items', data.cleanItemSummary?.totalItems],
      ['clean-total-items', data.cleanItemSummary?.totalItems],
      ['clean-large-total-amount', data.cleanItemSummary?.largeTotalAmount],
      ['clean-small-total-amount', data.cleanItemSummary?.smallTotalAmount],
      ['clean-total-amount', data.cleanItemSummary?.totalAmount],
      ['clean-large-checked-out', data.cleanItemSummary?.largeCheckedOutAmount],
      ['clean-small-checked-out', data.cleanItemSummary?.smallCheckedOutAmount],
      ['clean-checked-out', data.cleanItemSummary?.checkedOutAmount],
    ];
    updates.forEach(([id, value]) => {
      const element = byId(id);
      if (element) element.textContent = String(value ?? '0');
    });
    const completionShare = byId('assets-completion-share');
    const notFoundShare = byId('assets-not-found-share');
    const averageQuantity = byId('assets-average-quantity');
    if (completionShare)
      completionShare.textContent = totalAssets
        ? `${Math.round((completedAssets / totalAssets) * 100)}%`
        : '0%';
    if (notFoundShare)
      notFoundShare.textContent = totalAssets
        ? `${Math.round((notFoundAssets / totalAssets) * 100)}%`
        : '0%';
    if (averageQuantity)
      averageQuantity.textContent = totalAssets ? (totalQuantity / totalAssets).toFixed(1) : '0';
  }

  async function loadAssets({ quiet = false } = {}) {
    const request = loadScope.next();
    if (!quiet) pageState.set('loading', 'Loading assets...');

    let result;
    try {
      result = await api.getAssetsData(
        { state: JSON.stringify(buildRequestState()) },
        request.signal,
      );
    } catch {
      pageState.set('error', 'Assets could not be loaded right now.');
      if (!quiet) {
        showRequestFailureToast(
          null,
          'Assets overview failed',
          'Assets could not be loaded right now.',
        );
      }
      return false;
    }

    if (result.aborted || !loadScope.isCurrent(request.token)) return false;
    if (!result.ok) {
      pageState.set(
        stateForResult(result),
        result.message || 'Assets could not be loaded right now.',
      );
      if (!quiet) {
        showRequestFailureToast(
          result,
          'Assets overview failed',
          'Assets could not be loaded right now.',
        );
      }
      return false;
    }

    const data = result.data || {};
    pageState.clear();
    renderSummary(data);
    state.lookups = {
      assetTypes: Array.isArray(data.lookups?.assetTypes) ? data.lookups.assetTypes : [],
      rooms: Array.isArray(data.lookups?.rooms) ? data.lookups.rooms : [],
      keys: Array.isArray(data.lookups?.keys) ? data.lookups.keys : [],
      assets: Array.isArray(data.lookups?.assets) ? data.lookups.assets : [],
    };
    state.rowsById = new Map(
      (Array.isArray(data.allAssets) ? data.allAssets : []).map((row) => [String(row.id), row]),
    );
    state.assetTypesById = new Map(
      (Array.isArray(data.assetTypes) ? data.assetTypes : []).map((row) => [String(row.id), row]),
    );
    state.cleanItemsById = new Map(
      (Array.isArray(data.cleanItems) ? data.cleanItems : []).map((row) => [String(row.id), row]),
    );
    TABLE_KEYS.forEach((tableKey) => {
      applyMeta(tableKey, data.tables?.[tableKey] || {});
      renderTable(tableKey, Array.isArray(data[tableKey]) ? data[tableKey] : []);
    });
    reconcileAssetFormSelections();
    refreshLookupOptions();
    updateControlVisibility();
    return true;
  }

  const handleFilterInput = debounce((input) => {
    const tableKey = input.getAttribute('data-assets-filter-table');
    const column = input.getAttribute('data-assets-filter-column');
    const table = state.tables[tableKey];
    if (!table || !column) return;

    const value = input.value.trim();
    if (value) table.filters[column] = value;
    else delete table.filters[column];
    table.page = 1;
    void loadAssets({ quiet: true });
  }, 250);

  async function deleteAsset(assetId) {
    if (!canDeleteAsset()) {
      updateControlVisibility();
      return;
    }
    const normalizedAssetId = String(assetId || '').trim();
    if (!normalizedAssetId) return;
    let row = state.rowsById.get(normalizedAssetId);
    if (!row && (await loadAssets({ quiet: true }))) {
      row = state.rowsById.get(normalizedAssetId);
    }
    if (!row) {
      toast.show({
        title: 'Asset unavailable',
        variant: 'warning',
        message: 'Refresh assets and try deleting this row again.',
      });
      return;
    }
    const confirmed = await confirmAction({
      title: 'Delete asset',
      message: () => {
        const currentRow = state.rowsById.get(normalizedAssetId) || row;
        return `Permanently remove asset "${currentRow?.name || 'this asset'}" from the selected camp and update the inventory activity totals.`;
      },
      confirmText: 'Delete',
      variant: 'danger',
      canConfirm: canDeleteAsset,
    });
    if (!confirmed) return;

    pageState.set('loading', 'Deleting asset...');
    const result = await api.deleteAsset(normalizedAssetId);
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Asset not removed',
        fallbackMessage: 'The asset could not be removed.',
      });
      return;
    }
    toast.show({
      title: 'Asset removed',
      variant: 'success',
      message: result.data?.message || 'Asset removed successfully.',
    });
    await loadAssets({ quiet: true });
  }

  async function deleteAssetType(typeId) {
    if (!canDeleteAssetType()) {
      updateControlVisibility();
      return;
    }
    const row = state.assetTypesById.get(String(typeId || ''));
    if (!row) return;
    const confirmed = await confirmAction({
      title: 'Delete asset type',
      message: () => {
        const currentRow = state.assetTypesById.get(String(row.id || typeId || '')) || row;
        return `Permanently remove asset type "${currentRow.name}". This is only allowed when no assets use this type.`;
      },
      confirmText: 'Delete',
      variant: 'danger',
      canConfirm: canDeleteAssetType,
    });
    if (!confirmed) return;

    const currentRow = state.assetTypesById.get(String(row.id || typeId || '')) || row;
    if (currentRow.isProtected) {
      toast.show({
        title: 'Asset type cannot be deleted',
        variant: 'warning',
        message: 'This asset type is protected and cannot be deleted.',
      });
      return;
    }
    if (Number(currentRow.assetCount) > 0) {
      toast.show({
        title: 'Asset type cannot be deleted',
        variant: 'warning',
        message: 'This asset type cannot be deleted while assets of that type exist.',
      });
      return;
    }

    pageState.set('loading', 'Deleting asset type...');
    const result = await api.deleteAssetType(currentRow.id);
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Asset type not removed',
        fallbackMessage: 'The asset type could not be removed.',
      });
      return;
    }
    toast.show({
      title: 'Asset type removed',
      variant: 'success',
      message: result.data?.message || 'Asset type removed.',
    });
    await loadAssets({ quiet: true });
  }

  async function deleteCleanItem(itemId) {
    if (!canDeleteCleanItem()) {
      updateControlVisibility();
      return;
    }
    const row = state.cleanItemsById.get(String(itemId || ''));
    if (!row) return;
    const confirmed = await confirmAction({
      title: 'Delete clean item',
      message: () => {
        const currentRow = state.cleanItemsById.get(String(row.id || itemId || '')) || row;
        return `Permanently remove clean item "${currentRow.itemName}" from ${currentRow.warehouseLabel || 'this warehouse'} inventory.`;
      },
      confirmText: 'Delete',
      variant: 'danger',
      canConfirm: canDeleteCleanItem,
    });
    if (!confirmed) return;

    pageState.set('loading', 'Deleting clean item...');
    const result = await api.deleteCleanItem(row.id);
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Clean item not removed',
        fallbackMessage: 'The clean item could not be removed.',
      });
      return;
    }
    toast.show({
      title: 'Clean item removed',
      variant: 'success',
      message: result.data?.message || 'Clean item removed.',
    });
    await loadAssets({ quiet: true });
  }

  async function moveCleanItem({ itemId, warehouse, quantity }) {
    if (!canMoveCleanItem()) {
      updateControlVisibility();
      return;
    }
    const row = state.cleanItemsById.get(String(itemId || ''));
    if (!row) return;
    const nextWarehouse = warehouse || (row.warehouse === 'large' ? 'small' : 'large');
    const confirmed = await confirmAction({
      title: 'Move clean item',
      message: () => {
        const currentRow = state.cleanItemsById.get(String(row.id || itemId || '')) || row;
        const currentQuantity = byId('clean-item-move-quantity-input')?.value || quantity;
        return `Move ${currentQuantity} "${currentRow.itemName}" from ${currentRow.warehouseLabel || 'the current warehouse'} to ${WAREHOUSE_LABELS[nextWarehouse]}.`;
      },
      confirmText: 'Move',
      variant: 'warning',
      canConfirm: canMoveCleanItem,
    });
    if (!confirmed) return;

    pageState.set('loading', 'Moving clean item...');
    const result = await api.moveCleanItem({ itemId: row.id, warehouse: nextWarehouse, quantity });
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Clean item not moved',
        fallbackMessage: 'The clean item could not be moved.',
        stateControllers: [cleanItemMoveState, pageState],
      });
      return;
    }
    cleanItemMoveState.set('success', result.data?.message || 'Clean item moved.');
    toast.show({
      title: 'Clean item moved',
      variant: 'success',
      message: result.data?.message || 'Clean item moved.',
    });
    cleanItemMoveModal?.close();
    await loadAssets({ quiet: true });
  }

  async function restartInventory() {
    if (!canSaveInventory()) {
      updateControlVisibility();
      return;
    }
    const confirmed = await confirmAction({
      title: 'Restart inventory',
      message: () =>
        'Restart inventory for the selected camp. Completed assets will be marked as not found and their last inventory dates will be cleared.',
      confirmText: 'Restart',
      variant: 'danger',
      canConfirm: canSaveInventory,
    });
    if (!confirmed) return;

    pageState.set('loading', 'Restarting inventory...');
    const result = await api.restartInventory();
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Inventory not restarted',
        fallbackMessage: 'Inventory could not be restarted right now.',
      });
      return;
    }
    toast.show({
      title: 'Inventory restarted',
      variant: 'success',
      message: result.data?.message || 'Inventory restarted successfully.',
    });
    await loadAssets({ quiet: true });
  }

  async function uploadTemplate(key = 'assets') {
    if (!canBulkImportKey(key)) {
      updateControlVisibility();
      return;
    }
    const config = BULK_IMPORT_CONFIGS[key] || BULK_IMPORT_CONFIGS.assets;
    const importState = state.imports[key] || state.imports.assets;
    const input = byId(config.fileInputId);
    const file = input?.files?.[0];
    if (!file) {
      showMissingInformation(null, config.requiredMessage, config.fileInputId);
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
    renderImportProgress(key);

    const importRequest =
      key === 'assetTypes'
        ? api.importAssetTypeTemplate
        : key === 'cleanItems'
          ? api.importCleanItemTemplate
          : api.importAssetTemplate;

    const result = await importRequest.call(api, file, {
      onUploadProgress: (percent) => {
        importState.visible = true;
        importState.uploadPercent = percent;
        importState.statusMessage =
          percent >= 100 ? 'Upload complete. Processing template...' : 'Uploading template...';
        renderImportProgress(key);
      },
    });

    importState.isBusy = false;
    if (result.data?.summary) {
      applyImportPayload(key, {
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
      importState.statusMessage = resultMessage(result, config.requestErrorMessage);
      importState.errors = collectImportErrors(result, config.failureMessage);
      importState.visible = true;
      renderImportProgress(key);
    }

    if (!result.ok) {
      if (!importState.errors.length) {
        importState.errors = collectImportErrors(result, config.failureMessage);
        renderImportProgress(key);
      }
      if (isPermissionDeniedResult(result)) {
        try {
          await refreshPermissionsAfterDeniedResult(result);
        } catch {
          updateControlVisibility();
        }
      }
      showRequestFailureToast(result, 'Import failed', config.failureMessage);
      return;
    }
    if (input) input.value = '';
    toast.show({
      title:
        importState.summary?.errorCount > 0 ? 'Import completed with warnings' : 'Import completed',
      message: result.data?.message || config.successMessage,
      variant: importState.summary?.errorCount > 0 ? 'warning' : 'success',
    });
    await loadAssets({ quiet: true });
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTrigger));
  });

  qsa('input[name="cleanItemsWarehouse"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const warehouse = event.target?.value === 'small' ? 'small' : 'large';
      state.cleanItemsWarehouse = warehouse;
      state.tables.cleanItems.page = 1;
      void loadAssets({ quiet: true });
    });
  });

  byId('download-assets-mobile-app-button')?.addEventListener('click', (event) => {
    if (!canDownloadAssetsMobileApp()) {
      event.preventDefault();
      return;
    }
    const downloadUrl = event.currentTarget?.dataset?.downloadUrl || '';
    if (downloadUrl) {
      window.location.assign(downloadUrl);
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const disabledAnchor = target.closest('a[aria-disabled="true"]');
    if (disabledAnchor) {
      event.preventDefault();
      return;
    }

    if (target.closest('[data-refresh-assets]')) {
      void loadAssets();
      return;
    }

    if (target.closest('#open-add-asset-modal')) {
      openCreateAssetModal();
      return;
    }

    if (target.closest('#open-asset-bulk-modal')) {
      openBulkModal();
      return;
    }

    if (target.closest('[data-open-add-asset-type-modal]')) {
      openCreateAssetTypeModal();
      return;
    }

    if (target.closest('[data-open-asset-type-bulk-modal]')) {
      openAssetTypeBulkModal();
      return;
    }

    if (target.closest('#open-add-clean-item-modal')) {
      openCreateCleanItemModal();
      return;
    }

    if (target.closest('#open-clean-item-bulk-modal')) {
      openCleanItemBulkModal();
      return;
    }

    if (target.closest('#restart-inventory-button')) {
      void restartInventory();
      return;
    }

    if (target.closest('#upload-asset-template-button')) {
      void uploadTemplate('assets');
      return;
    }

    if (target.closest('#upload-asset-type-template-button')) {
      void uploadTemplate('assetTypes');
      return;
    }

    if (target.closest('#upload-clean-item-template-button')) {
      void uploadTemplate('cleanItems');
      return;
    }

    const editButton = target.closest('.js-edit-asset');
    if (editButton) {
      void openEditAssetModal(editButton.getAttribute('data-asset-id'));
      return;
    }

    const deleteButton = target.closest('.js-delete-asset');
    if (deleteButton) {
      void deleteAsset(deleteButton.getAttribute('data-asset-id'));
      return;
    }

    const editTypeButton = target.closest('.js-edit-asset-type');
    if (editTypeButton) {
      openEditAssetTypeModal(editTypeButton.getAttribute('data-type-id'));
      return;
    }

    const deleteTypeButton = target.closest('.js-delete-asset-type');
    if (deleteTypeButton) {
      void deleteAssetType(deleteTypeButton.getAttribute('data-type-id'));
      return;
    }

    const moveCleanItemButton = target.closest('.js-move-clean-item');
    if (moveCleanItemButton) {
      openMoveCleanItemModal(moveCleanItemButton.getAttribute('data-item-id'));
      return;
    }

    const editCleanItemButton = target.closest('.js-edit-clean-item');
    if (editCleanItemButton) {
      openEditCleanItemModal(editCleanItemButton.getAttribute('data-item-id'));
      return;
    }

    const deleteCleanItemButton = target.closest('.js-delete-clean-item');
    if (deleteCleanItemButton) {
      void deleteCleanItem(deleteCleanItemButton.getAttribute('data-item-id'));
      return;
    }

    const sortButton = target.closest('[data-assets-sort-table][data-assets-sort-column]');
    if (sortButton) {
      const tableKey = sortButton.getAttribute('data-assets-sort-table');
      const column = sortButton.getAttribute('data-assets-sort-column');
      const table = state.tables[tableKey];
      if (!table || !column) return;
      if (table.sortColumn === column) table.sortDirection = nextSortDirection(table.sortDirection);
      else {
        table.sortColumn = column;
        table.sortDirection = 'asc';
      }
      if (table.sortDirection === 'default') table.sortColumn = null;
      table.page = 1;
      void loadAssets({ quiet: true });
      return;
    }

    const prevButton = target.closest('[data-assets-prev-table]');
    const nextButton = target.closest('[data-assets-next-table]');
    if (prevButton || nextButton) {
      const tableKey =
        prevButton?.getAttribute('data-assets-prev-table') ||
        nextButton?.getAttribute('data-assets-next-table');
      const table = state.tables[tableKey];
      if (!table) return;
      if (prevButton && (prevButton.disabled || table.page <= 1)) return;
      if (nextButton && (nextButton.disabled || table.page >= table.totalPages || table.total <= 0))
        return;
      table.page = prevButton
        ? Math.max(1, table.page - 1)
        : Math.min(table.totalPages || 1, table.page + 1);
      void loadAssets({ quiet: true });
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches('[data-assets-filter-table][data-assets-filter-column]')) {
      handleFilterInput(target);
    }
  });

  byId('asset-quantitative-input')?.addEventListener('change', (event) => {
    syncAssetQuantityMode({
      creating: byId('asset-form-mode')?.value !== 'edit',
      isQuantitative: Boolean(event.target?.checked),
    });
  });

  function bindTemplateFileInput(key) {
    const config = BULK_IMPORT_CONFIGS[key] || BULK_IMPORT_CONFIGS.assets;
    byId(config.fileInputId)?.addEventListener('change', (event) => {
      const importState = state.imports[key] || state.imports.assets;
      const file = event.target?.files?.[0] || null;
      if (!file) {
        resetImportProgress(key);
        return;
      }
      importState.fileName = file.name;
      importState.visible = false;
      importState.uploadPercent = 0;
      importState.processingPercent = 0;
      importState.statusMessage = config.selectedStatus;
      importState.summary = null;
      importState.errors = [];
      renderImportProgress(key);
    });
  }

  bindTemplateFileInput('assets');
  bindTemplateFileInput('assetTypes');
  bindTemplateFileInput('cleanItems');

  byId('asset-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const creating = byId('asset-form-mode')?.value !== 'edit';
    if (creating ? !canAddAsset() : !canEditAsset()) {
      updateControlVisibility();
      return;
    }
    const payload = collectAssetPayload();
    if (!validateAssetPayload(payload)) return;
    const confirmed = await confirmAction({
      title: creating ? 'Create asset' : 'Save asset changes',
      message: () => {
        const currentPayload = collectAssetPayload();
        return creating
          ? `Create asset "${currentPayload.name || payload.name}" in the selected camp with the entered type, quantity, and tag details.`
          : `Save the edited type, quantity, tag, and assignment details for asset "${currentPayload.name || payload.name}".`;
      },
      confirmText: creating ? 'Create' : 'Save',
      variant: 'warning',
      canConfirm: () => (creating ? canAddAsset() : canEditAsset()),
    });
    if (!confirmed) return;

    assetModalState.set('loading', creating ? 'Creating asset...' : 'Saving asset...');
    const result = creating
      ? await api.addAsset(payload)
      : await api.editAsset({ ...payload, assetId: byId('asset-id-input')?.value || '' });
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: creating ? 'Asset not created' : 'Asset not updated',
        fallbackMessage: 'The asset could not be saved.',
        stateControllers: [assetModalState],
      });
      return;
    }
    assetModalState.set('success', result.data?.message || 'Asset saved successfully.');
    toast.show({
      title: creating ? 'Asset created' : 'Asset updated',
      variant: 'success',
      message: result.data?.message || 'Asset saved successfully.',
    });
    assetModal?.close();
    await loadAssets({ quiet: true });
  });

  byId('asset-type-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const creating = byId('asset-type-form-mode')?.value !== 'edit';
    if (creating ? !canAddAssetType() : !canEditAssetType()) {
      updateControlVisibility();
      return;
    }
    const payload = { name: byId('asset-type-name-input')?.value.trim() || '' };
    if (!validateAssetTypePayload(payload)) return;
    const confirmed = await confirmAction({
      title: creating ? 'Create asset type' : 'Save asset type',
      message: () => {
        const name = byId('asset-type-name-input')?.value.trim() || payload.name;
        return creating
          ? `Create asset type "${name}" so assets can be assigned to it.`
          : `Save the edited name for asset type "${name}".`;
      },
      confirmText: creating ? 'Create' : 'Save',
      variant: 'warning',
      canConfirm: () => (creating ? canAddAssetType() : canEditAssetType()),
    });
    if (!confirmed) return;

    assetTypeModalState.set(
      'loading',
      creating ? 'Creating asset type...' : 'Saving asset type...',
    );
    const result = creating
      ? await api.addAssetType(payload)
      : await api.editAssetType({ ...payload, typeId: byId('asset-type-id-input')?.value || '' });
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: creating ? 'Asset type not created' : 'Asset type not updated',
        fallbackMessage: 'The asset type could not be saved.',
        stateControllers: [assetTypeModalState],
        focusId: 'asset-type-name-input',
      });
      return;
    }
    toast.show({
      title: creating ? 'Asset type created' : 'Asset type updated',
      variant: 'success',
      message: result.data?.message || 'Asset type saved.',
    });
    assetTypeModal?.close();
    await loadAssets({ quiet: true });
  });

  byId('asset-type-bulk-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canBulkAssetTypes()) {
      updateControlVisibility();
      return;
    }
    const payload = byId('asset-type-bulk-payload-input')?.value || '';
    if (!payload.trim()) {
      const message = 'Paste asset type rows before running a bulk update.';
      assetTypeBulkState.set('warning', message);
      showMissingInformation(assetTypeBulkState, message, 'asset-type-bulk-payload-input');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Run asset type bulk update',
      message: () =>
        'Apply the pasted asset type rows to the selected camp. Existing matching rows may be updated.',
      confirmText: 'Run update',
      variant: 'warning',
      canConfirm: canBulkAssetTypes,
    });
    if (!confirmed) return;

    assetTypeBulkState.set('loading', 'Running asset type bulk update...');
    const result = await api.bulkUpdateAssetTypes({ payload });
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Asset type bulk update failed',
        fallbackMessage: 'The asset type bulk update could not be completed.',
        stateControllers: [assetTypeBulkState],
      });
      return;
    }
    toast.show({
      title: 'Bulk update completed',
      variant: 'success',
      message: result.data?.message || 'Bulk update completed.',
    });
    assetTypeBulkModal?.close();
    await loadAssets({ quiet: true });
  });

  byId('clean-item-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const creating = byId('clean-item-form-mode')?.value !== 'edit';
    if (creating ? !canAddCleanItem() : !canEditCleanItem()) {
      updateControlVisibility();
      return;
    }
    const payload = collectCleanItemPayload();
    if (!validateCleanItemPayload(payload)) return;
    const confirmed = await confirmAction({
      title: creating ? 'Create clean item' : 'Save clean item',
      message: () => {
        const currentPayload = collectCleanItemPayload();
        return creating
          ? `Create clean item "${currentPayload.itemName || payload.itemName}" with the entered warehouse and quantity.`
          : `Save the edited warehouse and quantity details for clean item "${currentPayload.itemName || payload.itemName}".`;
      },
      confirmText: creating ? 'Create' : 'Save',
      variant: 'warning',
      canConfirm: () => (creating ? canAddCleanItem() : canEditCleanItem()),
    });
    if (!confirmed) return;

    cleanItemModalState.set(
      'loading',
      creating ? 'Creating clean item...' : 'Saving clean item...',
    );
    const result = creating
      ? await api.addCleanItem(payload)
      : await api.editCleanItem({ ...payload, itemId: byId('clean-item-id-input')?.value || '' });
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: creating ? 'Clean item not created' : 'Clean item not updated',
        fallbackMessage: 'The clean item could not be saved.',
        stateControllers: [cleanItemModalState],
      });
      return;
    }
    toast.show({
      title: creating ? 'Clean item created' : 'Clean item updated',
      variant: 'success',
      message: result.data?.message || 'Clean item saved.',
    });
    cleanItemModal?.close();
    await loadAssets({ quiet: true });
  });

  byId('clean-item-move-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canMoveCleanItem()) {
      updateControlVisibility();
      return;
    }
    const itemId = byId('clean-item-move-id-input')?.value || '';
    const warehouse = byId('clean-item-move-target-input')?.value || '';
    const quantityValue = byId('clean-item-move-quantity-input')?.value || '';
    const row = state.cleanItemsById.get(String(itemId));
    if (!isIntegerAtLeast(quantityValue, 1)) {
      const message = 'Enter a quantity of 1 or more.';
      cleanItemMoveState.set('warning', message);
      showMissingInformation(cleanItemMoveState, message, 'clean-item-move-quantity-input');
      return;
    }
    const quantity = Number(quantityValue);
    if (row && quantity > Number(row.availableAmount || 0)) {
      const message = 'Move quantity cannot be greater than the available amount.';
      cleanItemMoveState.set('warning', message);
      toast.show({ title: 'Invalid quantity', message, variant: 'warning' });
      byId('clean-item-move-quantity-input')?.focus();
      return;
    }
    cleanItemMoveState.set('loading', 'Moving clean item quantity...');
    await moveCleanItem({ itemId, warehouse, quantity });
  });

  byId('clean-item-bulk-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canBulkCleanItems()) {
      updateControlVisibility();
      return;
    }
    const payload = byId('clean-item-bulk-payload-input')?.value || '';
    if (!payload.trim()) {
      const message = 'Paste clean item rows before running a bulk update.';
      cleanItemBulkState.set('warning', message);
      showMissingInformation(cleanItemBulkState, message, 'clean-item-bulk-payload-input');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Run clean item bulk update',
      message: () =>
        'Apply the pasted clean item rows to the selected camp and update matching inventory quantities.',
      confirmText: 'Run update',
      variant: 'warning',
      canConfirm: canBulkCleanItems,
    });
    if (!confirmed) return;

    cleanItemBulkState.set('loading', 'Running clean item bulk update...');
    const result = await api.bulkUpdateCleanItems({ payload });
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Clean item bulk update failed',
        fallbackMessage: 'The clean item bulk update could not be completed.',
        stateControllers: [cleanItemBulkState],
      });
      return;
    }
    cleanItemBulkState.set('success', result.data?.message || 'Bulk update completed.');
    toast.show({
      title: 'Bulk update completed',
      variant: 'success',
      message: result.data?.message || 'Bulk update completed.',
    });
    await loadAssets({ quiet: true });
  });

  byId('asset-bulk-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canBulkAssets()) {
      updateControlVisibility();
      return;
    }
    const payload = byId('asset-bulk-payload-input')?.value || '';
    if (!payload.trim()) {
      const message = 'Paste asset rows before running a bulk update.';
      assetBulkState.set('warning', message);
      showMissingInformation(assetBulkState, message, 'asset-bulk-payload-input');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Run bulk update',
      message: () =>
        'Apply the pasted asset rows to the selected camp. Matching assets may be updated and new assets may be created.',
      confirmText: 'Run update',
      variant: 'warning',
      canConfirm: canBulkAssets,
    });
    if (!confirmed) return;

    assetBulkState.set('loading', 'Running asset bulk update...');
    const result = await api.bulkUpdateAssets({ payload });
    if (!result.ok) {
      await handleRequestFailure({
        result,
        fallbackTitle: 'Asset bulk update failed',
        fallbackMessage: 'The bulk update could not be completed.',
        stateControllers: [assetBulkState],
      });
      return;
    }
    assetBulkState.set('success', result.data?.message || 'Bulk update completed.');
    toast.show({
      title: 'Bulk update completed',
      variant: 'success',
      message: result.data?.message || 'Bulk update completed.',
    });
    await loadAssets({ quiet: true });
  });

  document.addEventListener('workspace:permissions:refreshed', (event) => {
    const nextPermissions = new Set(event.detail?.permissionNames || []);
    state.permissions = nextPermissions;
    const allowed = canDownloadAssetsMobileApp();
    if (document.body) {
      document.body.dataset.canDownloadAssetsMobileApp = allowed ? 'true' : 'false';
    }
    updateControlVisibility();
    void loadAssets({ quiet: true });
  });

  document.addEventListener('workspace:camp-access:refreshed', (event) => {
    if (!event.detail?.revoked) return;
    pageData.campId = '';
    if (document.body) document.body.dataset.currentCampId = '';
    void loadAssets({ quiet: true });
  });

  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const accessRefresh = createWorkspacePermissionAccessRefresh({ socket, pageData });
  accessRefresh.bind();
  const roomManager = socket ? createSocketRoomManager(socket) : null;
  bindLateBicycleToast({ socket, roomManager, toast, pageData });
  bindUpcomingAccommodationToasts({ toast, pageData });

  async function subscribeAssetsRoom() {
    if (!roomManager) return;
    await roomManager.subscribe(['ui:assets:list']);
  }

  function isCurrentCampRealtimePayload(payload = {}) {
    const changedCampId = String(payload?.campId || '');
    const currentCampId = String(pageData.campId || '');
    return !changedCampId || !currentCampId || changedCampId === currentCampId;
  }

  if (socket) {
    socket.on('connect', () => {
      void subscribeAssetsRoom();
    });
    socket.on('assets:changed', (payload = {}) => {
      if (!isCurrentCampRealtimePayload(payload)) return;
      void loadAssets({ quiet: true });
    });
    socket.on('accommodation:changed', (payload = {}) => {
      if (!isCurrentCampRealtimePayload(payload)) return;
      void loadAssets({ quiet: true });
    });
    socket.on('soldier:changed', (payload = {}) => {
      if (!isCurrentCampRealtimePayload(payload)) return;
      void loadAssets({ quiet: true });
    });
  }
  void subscribeAssetsRoom();

  window.addEventListener('pagehide', () => {
    if (!roomManager) return;
    void roomManager.unsubscribe(['ui:assets:list']);
    roomManager.clear();
  });

  initConfirmModal();
  initWorkspacePage();
  setActiveTab('overview');
  renderImportProgress('assets');
  renderImportProgress('assetTypes');
  renderImportProgress('cleanItems');
  updateControlVisibility();
  accessRefresh.refreshNavigation().then((permissionNames) => {
    if (permissionNames) {
      state.permissions = new Set(permissionNames);
      updateControlVisibility();
    }
    void subscribeAssetsRoom();
  });
  void loadAssets();
});
