// @ts-nocheck
import { bootstrapPage } from '/assets/shared/js/app/bootstrap-page.ts';
import {
  byId,
  qsa,
  bindPasswordToggle,
  safeRedirect,
  reloadIfBackForwardCache,
  setBusy,
} from '/assets/shared/js/core/dom.ts';
import { createAlertController, setFieldValidity } from '/assets/shared/js/core/form-feedback.ts';
import { createRequestScope } from '/assets/shared/js/core/request-client.ts';
import { createPageStateController } from '/assets/shared/js/core/page-state.ts';
import { PAGE_STATES } from '/assets/shared/js/core/app-errors.ts';
import { submitLogin } from '/assets/auth/js/login/login.api.ts';
import { validateLoginFields } from '/assets/auth/js/login/login.validation.ts';
import { initInviteModal } from '/assets/auth/js/login/invite-modal.ts';
import { initThemeToggle } from '/assets/shared/js/core/theme-toggle.ts';

bootstrapPage(() => {
  const form = byId('login-form');
  if (!form) return;

  const usernameEl = byId('username');
  const passwordEl = byId('password');
  const loadingEl = byId('loading-indicator');
  const submitBtn = form.querySelector('button[type="submit"]');
  const csrfToken = document.getElementsByName('_csrf')[0]?.value || '';
  const scope = createRequestScope();
  const alert = createAlertController({
    alertEl: byId('login-alert'),
    textEl: byId('error-message'),
  });
  const state = createPageStateController({
    root: form,
        loadingTargets: [loadingEl],
    disableTargets: [submitBtn],
  });

  const setLoading = (isLoading) => {
    state.set(
      isLoading ? PAGE_STATES.LOADING : PAGE_STATES.IDLE,
      isLoading ? 'Submitting your sign-in request…' : '',
    );
    setBusy(form, isLoading);
  };

  qsa('[data-toggle]').forEach((button) => bindPasswordToggle([button]));
  initInviteModal();
  reloadIfBackForwardCache();
  initThemeToggle();
  alert.clear();
  state.clear();

  usernameEl?.addEventListener('input', () => {
    setFieldValidity(
      usernameEl,
      validateLoginFields({ username: usernameEl.value.trim(), password: null }).validUsername,
    );
    alert.clear();
    state.clear();
  });

  passwordEl?.addEventListener('input', () => {
    setFieldValidity(
      passwordEl,
      validateLoginFields({ username: null, password: passwordEl.value }).validPassword,
    );
    alert.clear();
    state.clear();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.clear();
    state.clear();

    const username = usernameEl?.value.trim() || '';
    const password = passwordEl?.value || '';
    const { validUsername, validPassword } = validateLoginFields({ username, password });

    setFieldValidity(usernameEl, validUsername);
    setFieldValidity(passwordEl, validPassword);
    if (!validUsername || !validPassword) {
      state.set(PAGE_STATES.ERROR, 'Enter a valid username and password before continuing.');
      alert.show('Enter a valid username and password.');
      return;
    }

    const { token, signal } = scope.next();
    setLoading(true);

    try {
      const result = await submitLogin({
        action: form.action,
        csrfToken,
        payload: { username, password },
        signal,
      });
      if (!scope.isCurrent(token)) return;

      if (!result.ok) {
        state.set(result.pageState, result.message || 'Sign-in failed. Please try again.');
        alert.show(result.message || 'Sign-in failed. Please try again.');
        passwordEl.value = '';
        setFieldValidity(passwordEl, false);
        passwordEl.focus();
        return;
      }

      state.set(PAGE_STATES.SUCCESS, 'Sign-in accepted. Redirecting…');
      safeRedirect(result.redirectTo, '/');
    } catch (error) {
      state.set(PAGE_STATES.ERROR, 'There was a problem signing in. Please try again.');
      alert.show(error?.message || 'There was a problem signing in. Please try again.');
    } finally {
      if (scope.isCurrent(token)) {
        if (!state.is(PAGE_STATES.SUCCESS)) state.clear();
        setBusy(form, false);
      }
    }
  });
});
