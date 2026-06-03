type ModalControllerOptions = {
  root?: HTMLElement | null;
  dialog?: Element | null;
  closeSelectors?: string[];
  onAfterClose?: (() => void) | null;
};

export function createModalController({
  root,
  dialog,
  closeSelectors = [],
  onAfterClose = null,
}: ModalControllerOptions = {}) {
  if (!root || !dialog) return null;

  let lastFocusedElement: any = null;
  let closingTimer: number | null = null;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const getFocusable = () =>
    Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
    );

  const finishClose = () => {
    if (closingTimer) {
      window.clearTimeout(closingTimer);
      closingTimer = null;
    }

    root.hidden = true;
    root.classList.remove('is-open', 'is-closing');
    document.body.classList.remove('modal-open');
    lastFocusedElement?.focus?.();
    if (typeof onAfterClose === 'function') {
      onAfterClose();
    }
  };

  const close = () => {
    if (root.hidden || root.classList.contains('is-closing')) return;

    root.classList.remove('is-open');
    root.classList.add('is-closing');
    closingTimer = window.setTimeout(finishClose, 180);
  };

  const open = () => {
    if (closingTimer) {
      window.clearTimeout(closingTimer);
      closingTimer = null;
    }

    lastFocusedElement = document.activeElement;
    root.hidden = false;
    root.classList.remove('is-closing');

    window.requestAnimationFrame(() => {
      root.classList.add('is-open');
      document.body.classList.add('modal-open');
      getFocusable()[0]?.focus();
    });
  };

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target === root || closeSelectors.some((selector) => target.matches(selector))) close();
  });

  document.addEventListener('workspace:navigation-open', close);

  document.addEventListener('keydown', (event) => {
    if (root.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusable();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  root.addEventListener('transitionend', (event) => {
    if (!root.classList.contains('is-closing')) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target !== dialog && !event.target.classList.contains('workspace-modal__backdrop'))
      return;
    finishClose();
  });

  return { open, close };
}
