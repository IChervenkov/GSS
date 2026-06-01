const {
  jsonResponse,
  redirectResponse,
  renderResponse,
} = require('../../../../shared/http/response-contract');
const {
  toAuthActionResponseDto,
  toChangePasswordViewResponseDto,
  toVerifyViewResponseDto,
} = require('./http/auth.response.dto');
const { toActionStatus } = require('../../../../shared/application/action-result');

function presentAuthAction(result) {
  return jsonResponse(toAuthActionResponseDto(result), toActionStatus(result));
}

function presentAuthRedirect(location, status = 303) {
  return redirectResponse(location, status);
}

function presentVerifyView(model) {
  return renderResponse('verify-qr-code', toVerifyViewResponseDto(model), 200);
}

function presentChangePasswordView(model) {
  return renderResponse('change-password', toChangePasswordViewResponseDto(model), 200);
}

module.exports = {
  presentAuthAction,
  presentAuthRedirect,
  presentVerifyView,
  presentChangePasswordView,
};
