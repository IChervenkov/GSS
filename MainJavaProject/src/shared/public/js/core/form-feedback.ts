export function createAlertController({ alertEl, textEl }) {
  const variants = ['is-danger', 'is-success', 'is-info', 'is-warning'];

  function show(message, type = 'danger') {
    if (!alertEl || !textEl) return;
    textEl.textContent = message || '';
    alertEl.hidden = false;
    alertEl.classList.add('is-visible');
    alertEl.classList.remove(...variants);
    alertEl.classList.add(`is-${type}`);
  }

  function clear() {
    if (!alertEl || !textEl) return;
    textEl.textContent = '';
    alertEl.hidden = true;
    alertEl.classList.remove('is-visible', ...variants);
  }

  return { show, clear };
}

export function setFieldValidity(field, valid) {
  if (!field) return;
  const hasValue = String(field.value || '').trim() !== '';
  field.classList.toggle('is-invalid', !valid);
  field.classList.toggle('is-valid', valid && hasValue);
  field.setAttribute('aria-invalid', valid ? 'false' : 'true');
}

export function clearFieldState(fields) {
  fields.forEach((field) => {
    if (!field) return;
    field.classList.remove('is-valid', 'is-invalid');
    field.setAttribute('aria-invalid', 'false');
  });
}
