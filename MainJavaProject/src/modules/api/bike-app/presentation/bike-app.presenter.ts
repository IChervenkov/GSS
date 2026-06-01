const { fileResponse, jsonResponse } = require('../../../../shared/http/response-contract');

function presentBikeAppResult(result = {}) {
  return jsonResponse(result?.body || result || {}, Number.isInteger(result?.status) ? result.status : 200);
}

function presentBikeAppRaw(body = {}, status = 200) {
  return jsonResponse(body, status);
}

function presentBikeAppFile(result = {}) {
  return fileResponse(result);
}

module.exports = {
  presentBikeAppFile,
  presentBikeAppRaw,
  presentBikeAppResult,
};
