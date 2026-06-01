const { jsonResponse } = require('../../../../shared/http/response-contract');
const { toRefreshTokenResponseDto } = require('./http/auth.response.dto');

function presentTokenResponse(model) {
  return jsonResponse(toRefreshTokenResponseDto(model), 200);
}

function presentLogoutResponse(model = {}) {
  return jsonResponse({ success: Boolean(model.success) }, 200);
}

module.exports = { presentLogoutResponse, presentTokenResponse };
