// @ts-nocheck
const ACTION_META = Symbol('actionResult.meta');

const AUTH_NEXT_STEP_TO_REDIRECT = Object.freeze({
  login: '/',
  verify: '/web/login/verify/data',
  mainPage: '/web/main-page',
});

function normalizeBody(body = {}) {
  return body && typeof body === 'object' ? { ...body } : { value: body };
}

function attachActionMeta(result, meta = {}) {
  Object.defineProperty(result, ACTION_META, {
    value: Object.freeze({ ...meta }),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return result;
}

function createActionResult(status, body = {}, meta = {}) {
  const result = {
    status: Number.isInteger(status) ? status : 200,
    body: normalizeBody(body),
  };

  return attachActionMeta(result, meta);
}

function success(body = {}, meta = {}) {
  return createActionResult(200, body, meta);
}

function accepted(body = {}, meta = {}) {
  return createActionResult(202, body, meta);
}

function invalid(body = {}, meta = {}) {
  return createActionResult(422, body, meta);
}

function authRedirect(nextStep, body = {}, status = 200) {
  const redirectTo = AUTH_NEXT_STEP_TO_REDIRECT[nextStep];
  const payload = normalizeBody(body);

  if (redirectTo && !payload.redirectTo) {
    payload.redirectTo = redirectTo;
  }

  return createActionResult(status, payload, { nextStep });
}

function authSuccess(nextStep, body = {}) {
  return authRedirect(nextStep, body, 200);
}

function isActionResult(value) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    Number.isInteger(value.status) &&
    Object.prototype.hasOwnProperty.call(value, 'body')
  );
}

function getActionMeta(result = {}) {
  if (isActionResult(result) && result[ACTION_META]) {
    return result[ACTION_META];
  }

  if (typeof result === 'object' && result !== null && typeof result.kind === 'string') {
    return { kind: result.kind };
  }

  return {};
}

function toActionPayload(result = {}) {
  if (isActionResult(result)) {
    const payload = normalizeBody(result.body || {});
    const meta = getActionMeta(result);

    if (meta.nextStep && !payload.redirectTo) {
      const redirectTo = AUTH_NEXT_STEP_TO_REDIRECT[meta.nextStep];
      if (redirectTo) {
        payload.redirectTo = redirectTo;
      }
    }

    return payload;
  }

  if (typeof result !== 'object' || result === null) {
    return { value: result };
  }

  if (Object.prototype.hasOwnProperty.call(result, 'data')) {
    return normalizeBody(result.data || {});
  }

  return normalizeBody(result);
}

function toActionStatus(result = {}) {
  if (isActionResult(result)) {
    return result.status;
  }

  if (typeof result === 'object' && result !== null && typeof result.kind === 'string') {
    if (result.kind === 'accepted') return 202;
    if (result.kind === 'invalid') return 422;
    return 200;
  }

  return 200;
}

module.exports = {
  accepted,
  authRedirect,
  authSuccess,
  getActionMeta,
  invalid,
  isActionResult,
  success,
  toActionPayload,
  toActionStatus,
};
