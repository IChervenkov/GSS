// @ts-nocheck
import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import {
  byId,
  qsa,
  safeRedirect,
  reloadIfBackForwardCache,
  setBusy,
} from '/assets/shared/js/core/dom.ts';
import { createAlertController } from '/assets/shared/js/core/form-feedback.ts';
import {
  bindForcedSignOut,
  createSocketRoomManager,
} from '/assets/shared/js/core/socket-client.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { PAGE_STATES } from '/assets/shared/js/core/app-errors.ts';
import {
  requestQrApproval,
  fetchQrPayload,
  submitVerificationCode,
} from '/assets/auth/js/verify/verify.api.ts';
import { createCodeInputController } from '/assets/auth/js/verify/verify-code-input.ts';
import { createQrPanelController } from '/assets/auth/js/verify/verify-qr-panel.ts';
import { createApprovalFlow } from '/assets/auth/js/verify/verify-approval-flow.ts';
import { initThemeToggle } from '/assets/shared/js/core/theme-toggle.ts';

bootstrapPage(() => {
  const form = byId('verify-form');
  const hiddenCodeInput = byId('code');
  if (!form || !hiddenCodeInput) return;

  const loadingEl = byId('loading-indicator');
  const submitBtn = form.querySelector('button[type="submit"]');
  const qrRequestBtn = byId('qr-request');
  const csrfToken = document.getElementsByName('_csrf')[0]?.value || '';
  const scope = createRequestScope();
  const alert = createAlertController({
    alertEl: byId('verify-alert'),
    textEl: byId('error-message'),
  });
  const state = createPageStateController({
    root: form,
    loadingTargets: [loadingEl],
    disableTargets: [submitBtn, qrRequestBtn],
  });

  const codeController = createCodeInputController({
    digitInputs: qsa('.code-digit'),
    hiddenCodeInput,
    codeStatus: byId('code-status'),
  });

  const qrPanel = createQrPanelController({
    invitePanel: document.querySelector('.invite-panel'),
    panelTitle: byId('qr-panel-title'),
    panelText: byId('qr-panel-text'),
    qrRequestBtn,
    qrRequestCard: byId('qr-request-card'),
  });

  const socket =
    typeof window.io === 'function' ? window.io({ transports: ['websocket', 'polling'] }) : null;
  bindForcedSignOut(socket);
  const roomManager = socket ? createSocketRoomManager(socket) : null;

  const setLoading = (isLoading, message = 'Processing your request…') => {
    state.set(isLoading ? PAGE_STATES.LOADING : PAGE_STATES.IDLE, isLoading ? message : '');
    setBusy(form, isLoading);
  };

  const approvalFlow = createApprovalFlow({
    socket,
    onResolved: ({ status } = {}) => {
      if (status === 'denied') {
        state.set(PAGE_STATES.ERROR, 'The administrator denied the QR code request.');
      }
      if (status === 'expired') {
        state.set(
          PAGE_STATES.EXPIRED_SESSION,
          'The QR approval window expired. Request a new QR code if you still need it.',
        );
      }
    },
  });

  const pollApprovalState = async (requestId, cycle) => {
    const result = await fetchQrPayload({ csrfToken, requestId });
    if (cycle !== approvalFlow.getActiveCycle()) return null;
    if (result.status === 200 && result.body?.status === 'approved')
      return { status: 'approved', version: 1 };
    if (result.status === 403 && result.code === 'REQUEST_DENIED')
      return { status: 'denied', version: 1 };
    if (result.status === 410 && result.code === 'REQUEST_EXPIRED')
      return { status: 'expired', version: 1 };
    if (result.status === 403 && result.code === 'PERMISSION_REVOKED')
      return { status: 'permission-revoked', version: 1 };
    return null;
  };

  socket?.on('connect', () => {
    roomManager?.resubscribeAll();
  });

  socket?.on('disconnect', () => {
    alert.show(
      'Realtime connection was interrupted. The page will keep polling until the request finishes.',
      'warning',
    );
    state.set(
      PAGE_STATES.ERROR,
      'Realtime connection was interrupted. The page switched to polling mode.',
    );
  });

  const handleUserDeleted = () => {
    safeRedirect('/', '/');
  };
  socket?.on('user:deleted', handleUserDeleted);
  socket?.on('user:record:deleted', handleUserDeleted);

  socket?.on('permission:revoked', () => {
    state.set(
      PAGE_STATES.PERMISSION_REVOKED,
      'Your permission changed while this page was open. Reload or sign in again if the problem persists.',
    );
    alert.show('Your permission changed while this page was open.', 'warning');
  });

  qrRequestBtn?.addEventListener('click', async () => {
    alert.clear();
    setLoading(true, 'Creating the QR approval request…');

    const { token, signal } = scope.next();
    try {
      const result = await requestQrApproval({ csrfToken, signal });
      if (!scope.isCurrent(token)) return;
      if (!result.ok) {
        state.set(
          result.pageState,
          result.message || 'Could not create the QR approval request. Please try again.',
        );
        alert.show(result.message || 'Could not create the QR approval request. Please try again.');
        return;
      }

      state.set(PAGE_STATES.LOADING, result.message || 'Waiting for administrator approval.');
      alert.show(result.message || 'Waiting for administrator approval.', 'info');
      const approvalResult = await approvalFlow.watch({
        requestId: result.body?.requestId || result.body?.request_id,
        expiresAt: result.body?.expiresAt || result.body?.expires_at,
        poll: pollApprovalState,
      });

      if (!scope.isCurrent(token)) return;

      if (approvalResult?.status === 'approved') {
        const payloadResult = await fetchQrPayload({
          csrfToken,
          requestId: approvalResult.requestId,
          signal,
        });
        if (
          !payloadResult.ok ||
          payloadResult.body?.status !== 'approved' ||
          !payloadResult.body?.qrCodeDataURL
        ) {
          throw new Error(payloadResult.message || 'Could not load the approved QR code.');
        }
        alert.clear();
        state.set(
          PAGE_STATES.SUCCESS,
          'The QR code is ready and visible only for this approved session.',
        );
        qrPanel.show(payloadResult.body.qrCodeDataURL, payloadResult.body.ttlSeconds || 30);
        return;
      }

      if (approvalResult?.status === 'denied') {
        state.set(PAGE_STATES.ERROR, 'The administrator denied the QR code request.');
        alert.show('The administrator denied the QR code request.');
        return;
      }
      if (approvalResult?.status === 'expired') {
        state.set(
          PAGE_STATES.EXPIRED_SESSION,
          'Admin approval timeout has expired. Please request the QR code again.',
        );
        alert.show('Admin approval timeout has expired. Please request the QR code again.');
        return;
      }
      if (approvalResult?.status === 'permission-revoked') {
        state.set(
          PAGE_STATES.PERMISSION_REVOKED,
          'You no longer have permission to continue this action.',
        );
        alert.show('You no longer have permission to continue this action.', 'warning');
        return;
      }
      state.set(PAGE_STATES.ERROR, 'Invalid administrator response for the QR request.');
      alert.show('Invalid administrator response for QR request.');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (!scope.isCurrent(token)) return;
      state.set(
        PAGE_STATES.ERROR,
        error?.message || 'There was a problem requesting the QR code. Please try again.',
      );
      alert.show(error?.message || 'There was a problem requesting the QR code. Please try again.');
    } finally {
      if (scope.isCurrent(token) && !state.is(PAGE_STATES.SUCCESS)) {
        if (
          !state.is(PAGE_STATES.ERROR) &&
          !state.is(PAGE_STATES.EXPIRED_SESSION) &&
          !state.is(PAGE_STATES.PERMISSION_REVOKED)
        )
          state.clear();
        setBusy(form, false);
      }
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.clear();
    state.clear();
    codeController.sync();
    const code = hiddenCodeInput.value;
    if (!/^\d{6}$/.test(code)) {
      state.set(PAGE_STATES.ERROR, 'Enter a valid 6-digit code.');
      alert.show('Enter a valid 6-digit code.');
      codeController.focusDigit(0);
      return;
    }

    const { token, signal } = scope.next();
    setLoading(true, 'Checking the verification code…');

    try {
      const result = await submitVerificationCode({ action: form.action, csrfToken, code, signal });
      if (!scope.isCurrent(token)) return;
      if (!result.ok) {
        state.set(result.pageState, result.message || 'Verification failed. Please try again.');
        alert.show(result.message || 'Verification failed. Please try again.');
        codeController.clear();
        codeController.focusDigit(0);
        return;
      }
      state.set(PAGE_STATES.SUCCESS, 'Verification succeeded. Redirecting…');
      safeRedirect(result.redirectTo, '/web/main-page');
    } catch (error) {
      state.set(PAGE_STATES.ERROR, 'There was a problem verifying the code. Please try again.');
      alert.show(error?.message || 'There was a problem verifying the code. Please try again.');
    } finally {
      if (scope.isCurrent(token)) {
        if (!state.is(PAGE_STATES.SUCCESS)) state.clear();
        setBusy(form, false);
      }
    }
  });

  initThemeToggle();
  reloadIfBackForwardCache();
  alert.clear();
  state.clear();
  codeController.focusDigit(0);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) qrPanel.updateCountdown();
  });

  window.addEventListener('focus', () => qrPanel.updateCountdown());
});
