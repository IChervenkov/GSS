import { PAGE_STATES } from '/assets/shared/js/core/app-errors.ts';

const VARIANT_BY_STATE = {
  [PAGE_STATES.IDLE]: 'info',
  [PAGE_STATES.LOADING]: 'info',
  [PAGE_STATES.SUCCESS]: 'success',
  [PAGE_STATES.EMPTY]: 'info',
  [PAGE_STATES.ERROR]: 'danger',
  [PAGE_STATES.UNAUTHORIZED]: 'warning',
  [PAGE_STATES.EXPIRED_SESSION]: 'warning',
  [PAGE_STATES.PERMISSION_REVOKED]: 'warning',
  warning: 'warning',
};

type PageStateControllerOptions = {
  root?: HTMLElement | null;
  panel?: HTMLElement | null;
  messageEl?: HTMLElement | null;
  loadingTargets?: HTMLElement[];
  disableTargets?: any[];
};

export function createPageStateController({
  root,
  panel,
  messageEl,
  loadingTargets = [],
  disableTargets = [],
}: PageStateControllerOptions = {}) {
  let currentState: string = PAGE_STATES.IDLE;
  let currentMessage = '';

  const render = () => {
    if (root) root.dataset.pageState = currentState;

    disableTargets.forEach((element) => {
      if (!element) return;
      const disable =
        currentState === PAGE_STATES.LOADING || currentState === PAGE_STATES.PERMISSION_REVOKED;
      element.disabled = disable;
    });

    loadingTargets.forEach((element) => {
      if (!element) return;
      element.hidden = currentState !== PAGE_STATES.LOADING;
      element.classList.toggle('is-visible', currentState === PAGE_STATES.LOADING);
    });

    if (!panel || !messageEl) return;

    const variant = VARIANT_BY_STATE[currentState] || 'info';
    panel.dataset.state = currentState;
    panel.classList.remove('is-visible', 'is-danger', 'is-success', 'is-info', 'is-warning');

    if (!currentMessage || currentState === PAGE_STATES.IDLE) {
      messageEl.textContent = '';
      panel.hidden = true;
      return;
    }

    messageEl.textContent = currentMessage;
    panel.hidden = false;
    panel.classList.add('is-visible', `is-${variant}`);
  };

  return {
    set(state, message = '') {
      currentState = state || PAGE_STATES.IDLE;
      currentMessage = message || '';
      render();
    },
    clear() {
      currentState = PAGE_STATES.IDLE;
      currentMessage = '';
      render();
    },
    is(state) {
      return currentState === state;
    },
    get value() {
      return currentState;
    },
  };
}
