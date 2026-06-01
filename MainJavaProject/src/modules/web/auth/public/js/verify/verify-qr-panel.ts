import { byId, setVisible } from '/assets/shared/js/core/dom.ts';

export function createQrPanelController({
  invitePanel,
  panelTitle,
  panelText,
  qrRequestBtn,
  qrRequestCard,
  defaultTtlSeconds = 30,
}) {
  let qrExpiryAt = null;
  let qrTickTimer = null;

  const stopQrTick = () => {
    if (qrTickTimer) {
      window.clearInterval(qrTickTimer);
      qrTickTimer = null;
    }
  };

  const resetText = () => {
    if (panelTitle) panelTitle.textContent = 'Need to visualize the QR code?';
    if (panelText)
      panelText.textContent =
        'If you have not set up your authenticator yet, request a one-time QR code visualization for this active session only.';
  };

  const setRequestUiVisible = (visible) => {
    setVisible(qrRequestBtn, visible);
    setVisible(qrRequestCard, visible);
  };

  const syncRequestUiWithQrVisibility = () => {
    setRequestUiVisible(!byId('qr-wrapper'));
  };

  const hide = () => {
    const wrapper = byId('qr-wrapper');
    if (wrapper) {
      wrapper.innerHTML = '';
      wrapper.remove();
    }
    qrExpiryAt = null;
    stopQrTick();
    resetText();
    syncRequestUiWithQrVisibility();
  };

  const updateCountdown = () => {
    if (!qrExpiryAt) return;
    const wrapper = byId('qr-wrapper');
    if (!wrapper) return hide();
    const countdownEl = byId('qr-countdown');
    const remainingMs = qrExpiryAt - Date.now();
    if (remainingMs <= 0) return hide();
    if (countdownEl) countdownEl.textContent = `Hidden in ${Math.ceil(remainingMs / 1000)}s`;
  };

  const show = (qrCodeDataURL, ttlSeconds = defaultTtlSeconds) => {
    if (!invitePanel || !panelTitle || !panelText || !qrCodeDataURL) return;
    hide();
    let wrapper = byId('qr-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'qr-wrapper';
      wrapper.className = 'qr-wrapper';
      invitePanel.appendChild(wrapper);
    }
    wrapper.hidden = false;
    wrapper.innerHTML = `
      <div class="qr-visual"><img src="${qrCodeDataURL}" alt="One-time QR code for authenticator setup" /></div>
      <div class="qr-panel__meta">Visible only for the current allowed session.<span class="countdown" id="qr-countdown"></span></div>
    `;
    panelTitle.textContent = 'Your one-time QR code';
    panelText.textContent =
      'Scan this QR code in your authenticator app before continuing. Treat it like a secret.';
    syncRequestUiWithQrVisibility();
    qrExpiryAt = Date.now() + Math.max(Number(ttlSeconds) || defaultTtlSeconds, 1) * 1000;
    updateCountdown();
    stopQrTick();
    qrTickTimer = window.setInterval(updateCountdown, 1000);
  };

  syncRequestUiWithQrVisibility();

  return { show, hide, updateCountdown };
}
