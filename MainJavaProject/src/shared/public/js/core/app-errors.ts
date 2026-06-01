export const PAGE_STATES = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
  UNAUTHORIZED: 'unauthorized',
  EXPIRED_SESSION: 'expired-session',
  PERMISSION_REVOKED: 'permission-revoked',
});

export const SECURITY_REDIRECT_CODES = new Set([
  'EBADCSRFTOKEN',
  'UNAUTHORIZED',
  'INVALID_REFRESH_TOKEN',
  'INVALID_TOKEN',
  'SESSION_EXPIRED',
]);

export function normalizeApiResult({ response, body, aborted = false } = {}) {
  const status = Number(response?.status || 0);
  const code = String(body?.code || body?.errorCode || '').trim();
  const message = body?.message || body?.errorMessage || defaultMessageForStatus(status);
  const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : null;

  return {
    ok: Boolean(response?.ok),
    status,
    code,
    message,
    data: body,
    body,
    redirectTo,
    aborted,
    retryable: isRetryable({ status, code, aborted }),
    pageState: derivePageState({ status, code, aborted }),
  };
}

export function defaultMessageForStatus(status) {
  if (status === 401) return 'You must sign in again.';
  if (status === 403) return 'You no longer have access to perform this action.';
  if (status === 404) return 'The requested resource could not be found.';
  if (status === 408) return 'The request timed out.';
  if (status === 410) return 'The request has expired.';
  if (status >= 500) return 'The server could not complete the request.';
  return 'The operation could not be completed.';
}

export function derivePageState({ status = 0, code = '', aborted = false } = {}) {
  if (aborted) return PAGE_STATES.IDLE;
  if (SECURITY_REDIRECT_CODES.has(code) || status === 401) return PAGE_STATES.EXPIRED_SESSION;
  if (code === 'PERMISSION_REVOKED') return PAGE_STATES.PERMISSION_REVOKED;
  if (status === 403) return PAGE_STATES.UNAUTHORIZED;
  if (status === 204 || code === 'EMPTY_RESULT') return PAGE_STATES.EMPTY;
  if (status >= 400) return PAGE_STATES.ERROR;
  return PAGE_STATES.SUCCESS;
}

export function isRetryable({ status = 0, code = '', aborted = false } = {}) {
  if (aborted) return false;
  if (SECURITY_REDIRECT_CODES.has(code)) return false;
  return status in { 408: 1, 425: 1, 429: 1, 502: 1, 503: 1, 504: 1 };
}
