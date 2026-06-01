import { byId } from '/assets/shared/js/core/dom.ts';
import { createModalController } from '/assets/shared/js/ui/modal.ts';

let confirmController = null;
let confirmElements = null;
let pendingResolve = null;
let pendingCleanup = null;

function resolveCanConfirm(canConfirm) {
  if (typeof canConfirm !== 'function') return canConfirm !== false;

  try {
    return Boolean(canConfirm());
  } catch {
    return false;
  }
}

function resolveTextOption(value, fallback = '') {
  if (typeof value !== 'function') return value ?? fallback;

  try {
    return value() ?? fallback;
  } catch {
    return fallback;
  }
}

function cleanupPending(result) {
  if (typeof pendingCleanup === 'function') {
    pendingCleanup();
  }

  if (typeof pendingResolve === 'function') {
    pendingResolve(result);
  }

  pendingResolve = null;
  pendingCleanup = null;
}

function buildController() {
  const root = byId('global-confirm-modal');
  const dialog = root?.querySelector('.workspace-modal__dialog');

  if (!root || !dialog) return null;

  const controller = createModalController({
    root,
    dialog,
    closeSelectors: ['[data-close-modal="true"]'],
  });

  if (!controller) return null;

  const title = root.querySelector('[data-confirm-title]');
  const message = root.querySelector('[data-confirm-message]');
  const confirmButton = root.querySelector('[data-confirm-accept]');
  const cancelButton = root.querySelector('[data-confirm-cancel]');

  const handleCancel = () => {
    controller.close();
    cleanupPending(false);
  };

  const handleConfirm = () => {
    controller.close();
    cleanupPending(true);
  };

  cancelButton?.addEventListener('click', handleCancel);
  confirmButton?.addEventListener('click', handleConfirm);

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target === root || target.matches('[data-close-modal="true"]')) {
      cleanupPending(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (root.hidden) return;
    if (event.key === 'Escape') {
      cleanupPending(false);
    }
  });

  confirmElements = {
    root,
    title,
    message,
    confirmButton,
    cancelButton,
  };

  return controller;
}

export function initConfirmModal() {
  if (confirmController) return confirmController;
  confirmController = buildController();
  return confirmController;
}

export async function confirmAction(options = {}) {
  const controller = initConfirmModal();
  if (!controller || !confirmElements) return false;

  if (typeof pendingResolve === 'function') {
    cleanupPending(false);
  }

  const {
    title = 'Confirm action',
    message = 'Are you sure you want to continue?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    canConfirm = true,
  } = options;

  confirmElements.root.dataset.variant = variant;

  let refreshTimer = null;
  const hasDynamicContent = [title, message, confirmText, cancelText].some(
    (value) => typeof value === 'function',
  );
  const refreshConfirmContent = () => {
    confirmElements.title.textContent = resolveTextOption(title, 'Confirm action');
    confirmElements.message.textContent = resolveTextOption(
      message,
      'Are you sure you want to continue?',
    );
    confirmElements.confirmButton.textContent = resolveTextOption(confirmText, 'Confirm');
    confirmElements.cancelButton.textContent = resolveTextOption(cancelText, 'Cancel');
  };
  const refreshConfirmState = () => {
    const enabled = resolveCanConfirm(canConfirm);
    confirmElements.confirmButton.disabled = !enabled;
    confirmElements.confirmButton.setAttribute('aria-disabled', String(!enabled));
  };
  const refreshConfirm = () => {
    refreshConfirmContent();
    refreshConfirmState();
  };

  refreshConfirm();
  document.addEventListener('workspace:permissions:refreshed', refreshConfirm);
  if (typeof canConfirm === 'function' || hasDynamicContent) {
    refreshTimer = window.setInterval(refreshConfirm, 250);
  }

  controller.open();

  return new Promise((resolve) => {
    pendingResolve = resolve;
    pendingCleanup = () => {
      if (refreshTimer) window.clearInterval(refreshTimer);
      document.removeEventListener('workspace:permissions:refreshed', refreshConfirm);
      confirmElements.root.dataset.variant = 'default';
      confirmElements.confirmButton.disabled = false;
      confirmElements.confirmButton.setAttribute('aria-disabled', 'false');
    };
  });
}
