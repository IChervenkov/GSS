const {
  fileResponse,
  jsonResponse,
  renderResponse,
} = require('../../../../shared/http/response-contract');
const {
  toBicyclesOverviewResponseDto,
  toBicyclesViewResponseDto,
} = require('./http/bicycles.response.dto');

function presentBicyclesView(model = {}) {
  return renderResponse('bicycles-page', toBicyclesViewResponseDto(model), 200);
}

function presentBicyclesResult(result = {}) {
  return jsonResponse(
    toBicyclesOverviewResponseDto(result),
    Number.isInteger(result?.status) ? result.status : 200,
  );
}

function presentBicyclesFileResult(result = {}) {
  return fileResponse(result);
}

module.exports = {
  presentBicyclesFileResult,
  presentBicyclesResult,
  presentBicyclesView,
};
