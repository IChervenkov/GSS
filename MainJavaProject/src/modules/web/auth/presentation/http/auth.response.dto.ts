const {
  getActionMeta,
  toActionPayload,
} = require('../../../../../shared/application/action-result');

const AUTH_NEXT_STEP_TO_REDIRECT = Object.freeze({
  login: '/',
  verify: '/web/login/verify/data',
  mainPage: '/web/main-page',
});

function toAuthActionResponseDto(result = {}) {
  const payload = { ...toActionPayload(result) };
  const meta = getActionMeta(result);
  const redirectTo = AUTH_NEXT_STEP_TO_REDIRECT[payload.nextStep || meta.nextStep];

  if (redirectTo && !payload.redirectTo) {
    payload.redirectTo = redirectTo;
  }

  delete payload.nextStep;
  return payload;
}

function toVerifyViewResponseDto(model = {}) {
  const view = {
    title: String(model?.title || '2FA Verification'),
    qrCodeDataURL: model?.qrCodeDataURL || null,
  };

  if (model?.csrfToken != null) {
    view.csrfToken = model.csrfToken;
  }

  return view;
}

function toChangePasswordViewResponseDto(model = {}) {
  const view = {
    title: String(model?.title || 'Change password'),
  };

  if (model?.csrfToken != null) {
    view.csrfToken = model.csrfToken;
  }

  return view;
}

module.exports = {
  toAuthActionResponseDto,
  toChangePasswordViewResponseDto,
  toVerifyViewResponseDto,
};
