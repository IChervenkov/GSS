function announceTo(selector, message) {
  const region = document.querySelector(selector);
  if (!(region instanceof HTMLElement)) return;
  region.textContent = '';
  window.requestAnimationFrame(() => {
    region.textContent = String(message || '');
  });
}

export function announceStatus(message) {
  announceTo('[data-global-status-region]', message);
}

export function announceAlert(message) {
  announceTo('[data-global-alert-region]', message);
}
