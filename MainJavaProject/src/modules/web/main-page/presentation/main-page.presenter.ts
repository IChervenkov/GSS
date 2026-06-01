const {
  fileResponse,
  jsonResponse,
  redirectResponse,
  renderResponse,
} = require('../../../../shared/http/response-contract');
const { toMainActionResponseDto, toMainPageViewResponseDto } = require('./http/main-page.response.dto');
const { toActionStatus } = require('../../../../shared/application/action-result');

function presentMainAction(result = {}) {
  return jsonResponse(toMainActionResponseDto(result), toActionStatus(result));
}

function presentFileResult(result = {}) {
  return fileResponse({
    status: Number.isInteger(result?.status) ? result.status : 200,
    fileName: result?.fileName,
    contentType: result?.contentType,
    buffer: result?.buffer,
  });
}

function presentMainPageView(model = {}) {
  return renderResponse('main-page', toMainPageViewResponseDto(model), 200);
}

function presentWebRedirect(location, status = 303) {
  return redirectResponse(location, status);
}

module.exports = {
  presentMainAction,
  presentFileResult,
  presentMainPageView,
  presentWebRedirect,
};
