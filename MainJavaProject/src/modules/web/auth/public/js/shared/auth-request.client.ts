import { createRequestClient } from '/assets/shared/js/core/request-client.ts';

const client = createRequestClient();

export function submitLogin({ action, csrfToken, payload, signal }) {
  return client.postJson(action, { csrfToken, body: payload, signal });
}

export function submitPasswordChange({ action, csrfToken, payload, signal }) {
  return client.postJson(action, { csrfToken, body: payload, signal });
}

export function requestQrApproval({ csrfToken, signal }) {
  return client.postJson('/web/login/request-qr', { csrfToken, body: {}, signal });
}

export function fetchQrPayload({ csrfToken, requestId, signal }) {
  return client.getJson('/web/login/request-qr/payload', {
    csrfToken,
    query: { requestId },
    signal,
  });
}

export function submitVerificationCode({ action, csrfToken, code, signal }) {
  return client.postJson(action, { csrfToken, body: { code }, signal });
}
