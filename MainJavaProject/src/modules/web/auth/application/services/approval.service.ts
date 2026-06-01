const { createUserRequestService } = require('./user-request.service');

function createApprovalService(dependencies) {
  return createUserRequestService(dependencies);
}

module.exports = createApprovalService;
module.exports.createApprovalService = createApprovalService;
module.exports.createUserRequestService = createUserRequestService;
