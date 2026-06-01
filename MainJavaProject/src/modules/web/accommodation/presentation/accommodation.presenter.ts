const {
  fileResponse,
  jsonResponse,
  renderResponse,
} = require('../../../../shared/http/response-contract');
const {
  toAccommodationResponseDto,
  toAccommodationViewResponseDto,
} = require('./http/accommodation.response.dto');

function presentAccommodationView(model = {}) {
  return renderResponse('accommodation-page', toAccommodationViewResponseDto(model), 200);
}

function presentAccommodationSummary(result = {}) {
  return jsonResponse(
    toAccommodationResponseDto(result),
    Number.isInteger(result?.status) ? result.status : 200,
  );
}

function presentAccommodationFileResult(result = {}) {
  return fileResponse(result);
}

module.exports = {
  presentAccommodationFileResult,
  presentAccommodationSummary,
  presentAccommodationView,
};
