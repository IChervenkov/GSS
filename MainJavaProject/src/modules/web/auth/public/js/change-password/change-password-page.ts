// @ts-nocheck
import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import {
  byId,
  qsa,
  bindPasswordToggle,
  safeRedirect,
  reloadIfBackForwardCache,
  setBusy,
  setProgressValue,
} from '/assets/shared/js/core/dom.ts';
import {
  createAlertController,
  setFieldValidity,
  clearFieldState,
} from '/assets/shared/js/core/form-feedback.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { PAGE_STATES } from '/assets/shared/js/core/app-errors.ts';
import { bindForcedSignOut } from '/assets/shared/js/core/socket-client.ts';
import { submitPasswordChange } from '/assets/auth/js/change-password/change-password.api.ts';
import { createApprovalFlow } from '/assets/auth/js/verify/verify-approval-flow.ts';
import {
  validateChangePassword,
  getPasswordChecks,
} from '/assets/auth/js/change-password/change-password.validation.ts';
import { initThemeToggle } from '/assets/shared/js/core/theme-toggle.ts';

bootstrapPage(() => {
  const form = byId('change-password');
  if (!form) return;

  const username = byId('username');
  const currentPassword = byId('current-password');
  const newPassword = byId('new-password');
  const confirmNewPassword = byId('confirm-new-password');
  const csrfToken = document.getElementsByName('_csrf')[0]?.value || '';
  const loadingIndicator = byId('loading-indicator');
  const submitButton = form.querySelector('button[type="submit"]');
  const pwMeterBar = byId('pw-meter-bar');
  const scope = createRequestScope();
  const alert = createAlertController({
    alertEl: byId('change-password-alert'),
    textEl: byId('change-password-error-message'),
  });
  const state = createPageStateController({
    root: form,
    loadingTargets: [loadingIndicator],
    disableTargets: [submitButton],
  });

  const rules = {
    len: byId('rule-len'),
    upper: byId('rule-upper'),
    lower: byId('rule-lower'),
    num: byId('rule-num'),
    sym: byId('rule-sym'),
    diff: byId('rule-diff'),
  };

  const passwordFields = [currentPassword, newPassword, confirmNewPassword];
  let latestSubmittedValues = null;
  let socket = null;
  let approvalFlow = null;

  const setLoading = (isLoading, message = 'Submitting the password update...') => {
    state.set(isLoading ? PAGE_STATES.LOADING : PAGE_STATES.IDLE, isLoading ? message : '');
    setBusy(form, isLoading);
  };

  const updatePasswordUI = () => {
    const checks = getPasswordChecks(currentPassword.value || '', newPassword.value || '');
    Object.entries(checks).forEach(([key, passed]) => {
      const el = rules[key];
      if (!el) return;
      el.classList.toggle('ok', passed);
      el.classList.toggle('bad', !passed && newPassword.value.length > 0);
    });
    if (pwMeterBar) {
      const score = Object.values(checks).filter(Boolean).length;
      setProgressValue(pwMeterBar, Math.round((score / 6) * 100));
    }
  };

  const clearSensitiveFields = () => {
    passwordFields.forEach((field) => {
      if (field) field.value = '';
    });
    clearFieldState(passwordFields);
    latestSubmittedValues = null;
  };

  const sendPasswordChange = async ({ values, signal }) => {
    latestSubmittedValues = values;
    return submitPasswordChange({
      action: form.action,
      csrfToken,
      payload: {
        username: values.username,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      signal,
    });
  };

  const ensureApprovalFlow = () => {
    if (approvalFlow) return approvalFlow;
    if (typeof window.io !== 'function') {
      throw new Error('Realtime updates are unavailable right now. Please refresh the page.');
    }

    socket = window.io({ transports: ['websocket', 'polling'] });
    bindForcedSignOut(socket);
    socket.on('disconnect', () => {
      alert.show(
        'Realtime connection was interrupted. Refresh the page if you do not receive an approval update.',
        'warning',
      );
    });
    const handleUserDeleted = () => {
      safeRedirect('/', '/');
    };
    socket.on('user:deleted', handleUserDeleted);
    socket.on('user:record:deleted', handleUserDeleted);

    approvalFlow = createApprovalFlow({
      socket,
      onResolved: ({ status } = {}) => {
        if (status === 'denied') {
          state.set(PAGE_STATES.ERROR, 'The administrator denied the password change request.');
        }
      },
    });

    return approvalFlow;
  };

  bindPasswordToggle(qsa('[data-toggle]'));
  reloadIfBackForwardCache();
  updatePasswordUI();
  alert.clear();
  state.clear();
  initThemeToggle();

  [username, currentPassword, newPassword, confirmNewPassword].forEach((field) =>
    field?.addEventListener('input', () => {
      alert.clear();
      state.clear();
    }),
  );
  currentPassword?.addEventListener('input', updatePasswordUI);
  newPassword?.addEventListener('input', updatePasswordUI);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.clear();
    state.clear();

    const values = {
      username: username.value.trim(),
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmNewPassword.value,
    };
    const validation = validateChangePassword(values);

    setFieldValidity(username, validation.validUsername);
    setFieldValidity(currentPassword, validation.validCurrent);
    setFieldValidity(newPassword, validation.validNew);
    setFieldValidity(confirmNewPassword, validation.validConfirm);

    if (!Object.values(validation).every(Boolean)) {
      state.set(PAGE_STATES.ERROR, 'Fix the highlighted fields before submitting the form.');
      alert.show('Please fix the highlighted fields and try again.');
      return;
    }

    const { token, signal } = scope.next();
    setLoading(true);

    try {
      const result = await sendPasswordChange({ values, signal });

      if (!scope.isCurrent(token)) return;

      if (result.status === 202) {
        state.set(PAGE_STATES.LOADING, result.message || 'Waiting for administrator approval.');
        alert.show(result.message || 'Waiting for administrator approval.', 'info');

        const approvalResult = await ensureApprovalFlow().watch({
          requestId: result.body?.requestId || result.body?.request_id,
          expiresAt: result.body?.expiresAt || result.body?.expires_at,
        });

        if (!scope.isCurrent(token) || !latestSubmittedValues) return;

        if (approvalResult?.status === 'approved') {
          const completionResult = await sendPasswordChange({
            values: latestSubmittedValues,
            signal,
          });

          if (!scope.isCurrent(token)) return;

          if (!completionResult.ok) {
            clearSensitiveFields();
            updatePasswordUI();
            state.set(
              completionResult.pageState,
              completionResult.message || 'Could not complete the password change.',
            );
            alert.show(completionResult.message || 'Could not complete the password change.');
            currentPassword.focus();
            return;
          }

          latestSubmittedValues = null;
          state.set(PAGE_STATES.SUCCESS, 'Password changed successfully. Redirecting...');
          safeRedirect(completionResult.redirectTo, '/');
          return;
        }

        if (approvalResult?.status === 'denied') {
          clearSensitiveFields();
          updatePasswordUI();
          state.set(PAGE_STATES.ERROR, 'The administrator denied the password change request.');
          alert.show('The administrator denied the password change request.');
          currentPassword.focus();
          return;
        }

        state.set(PAGE_STATES.ERROR, 'The password change approval did not complete correctly.');
        alert.show('The password change approval did not complete correctly.');
        return;
      }

      if (!result.ok) {
        clearSensitiveFields();
        updatePasswordUI();
        state.set(
          result.pageState,
          result.message || 'Could not change password. Please try again.',
        );
        alert.show(result.message || 'Could not change password. Please try again.');
        currentPassword.focus();
        return;
      }

      latestSubmittedValues = null;
      state.set(PAGE_STATES.SUCCESS, 'Password changed successfully. Redirecting...');
      safeRedirect(result.redirectTo, '/');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      state.set(PAGE_STATES.ERROR, 'There was a problem changing your password.');
      alert.show(error?.message || 'There was a problem changing your password.');
    } finally {
      if (scope.isCurrent(token)) {
        if (!state.is(PAGE_STATES.SUCCESS) && !state.is(PAGE_STATES.ERROR)) {
          state.clear();
        }
        setBusy(form, false);
      }
    }
  });
});
