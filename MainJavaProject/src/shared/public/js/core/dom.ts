export const byId = (id) => document.getElementById(id);
export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

export { SECURITY_REDIRECT_CODES } from '/assets/shared/js/core/app-errors.ts';

export function setVisible(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.setAttribute('aria-hidden', visible ? 'false' : 'true');
  element.dataset.visible = visible ? 'true' : 'false';
}

export function setBusy(element, busy) {
  if (!element) return;
  element.setAttribute('aria-busy', busy ? 'true' : 'false');
}

export function setProgressValue(element, value) {
  if (!element) return;
  const normalized = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  element.value = normalized;
  element.setAttribute('value', String(normalized));
  element.setAttribute('aria-valuenow', String(normalized));
}

export function bindPasswordToggle(buttons, getInputById = byId) {
  buttons.forEach((button) => {
    const iconUse = button.querySelector('use');

    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-toggle');
      const input = targetId ? getInputById(targetId) : null;
      if (!input) return;

      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';

      if (iconUse) {
        iconUse.setAttribute('href', show ? '#icon-eye-slash' : '#icon-eye');
      }

      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      button.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  });
}

export function safeRedirect(maybeUrl, fallback = '/') {
  try {
    const url = new URL(maybeUrl || fallback, window.location.origin);
    if (url.origin !== window.location.origin) {
      window.location.assign(fallback);
      return;
    }
    window.location.assign(url.pathname + url.search + url.hash);
  } catch {
    window.location.assign(fallback);
  }
}

export function reloadIfBackForwardCache() {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
}

export function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
